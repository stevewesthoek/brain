#!/usr/bin/env node
/**
 * verify-b8-1-plan-digest.mjs
 *
 * Standalone independent verifier for B8.1 canonical plans.
 *
 * Loads a committed plan file produced by --write-plan, recomputes its
 * planSha256 using the authoritative shared digest contract, and proves the
 * stored planSha256 matches the recomputed value.
 *
 * This verifier does NOT rerun preflight. It is a standalone integrity check
 * that any reviewer can run against the committed plan file.
 *
 * All digest logic is imported from tools/lib/b8-1-plan-digest.mjs so this
 * verifier uses the identical projection as preflight, executor, and evidence
 * validator.
 *
 * Usage:
 *   node tools/verify-b8-1-plan-digest.mjs <plan-file>
 *   node tools/verify-b8-1-plan-digest.mjs --plan=<plan-file> [--expected=<sha256>]
 *
 * Exit codes:
 *   0 = digest verified
 *   1 = digest mismatch, missing fields, placeholders, or unknown fields
 *   2 = parse error or bad invocation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLAN_VERSION,
  KNOWN_STALE_DIGESTS,
  DIGEST_ALLOWED_TOP_LEVEL,
  computePlanDigest,
  recomputeDigest,
  findPlaceholders,
  findUnknownTopLevelFields,
} from './lib/b8-1-plan-digest.mjs';

export const VERIFIER_VERSION = '4.1.0';
export const REQUIRED_PLAN_VERSION = PLAN_VERSION;

// Re-export shared contract symbols for tests.
export { KNOWN_STALE_DIGESTS, computePlanDigest, recomputeDigest, findPlaceholders, findUnknownTopLevelFields, DIGEST_ALLOWED_TOP_LEVEL };

/**
 * Verify a plan file and prove its digest.
 *
 * @param {string} planPath  - absolute path to the plan JSON file
 * @param {string} [expectedDigest]  - optional expected digest to compare against
 * @returns {{ ok: boolean, planSha256: string|null, errors: string[], info: object }}
 */
export function verifyPlanFile(planPath, expectedDigest = null) {
  const errors = [];
  const info = {};

  // Load and parse
  let planText;
  try {
    planText = fs.readFileSync(planPath, 'utf8');
  } catch (e) {
    return { ok: false, planSha256: null, errors: [`cannot read plan file: ${e.message}`], info };
  }

  let plan;
  try {
    plan = JSON.parse(planText);
  } catch (e) {
    return { ok: false, planSha256: null, errors: [`cannot parse plan file as JSON: ${e.message}`], info };
  }

  // planVersion check
  if (plan.planVersion !== REQUIRED_PLAN_VERSION) {
    errors.push(`planVersion must be ${REQUIRED_PLAN_VERSION}, got: ${plan.planVersion ?? 'absent'}`);
  }

  // planSha256 must be present
  if (!plan.planSha256 || typeof plan.planSha256 !== 'string') {
    errors.push('planSha256 field is missing or not a string');
    return { ok: false, planSha256: null, errors, info };
  }
  if (!/^[a-f0-9]{64}$/.test(plan.planSha256)) {
    errors.push(`planSha256 is not a valid 64-char hex string: ${plan.planSha256}`);
    return { ok: false, planSha256: null, errors, info };
  }

  // Reject known stale digests
  if (KNOWN_STALE_DIGESTS.has(plan.planSha256)) {
    errors.push(`planSha256 ${plan.planSha256.slice(0, 16)}... is a known stale digest and must not be approved`);
    return { ok: false, planSha256: plan.planSha256, errors, info };
  }

  // Reject annotation fields (_xxx) — they indicate a template, not an emitted plan
  const { annotationFields } = recomputeDigest(plan);
  if (annotationFields.length > 0) {
    errors.push(`plan contains annotation fields (${annotationFields.join(', ')}) — this is a template file, not an emitted plan produced by --write-plan`);
  }

  // Reject BOUND_AT_PREFLIGHT placeholders anywhere in the plan
  const allPlaceholders = findPlaceholders(plan);
  if (allPlaceholders.length > 0) {
    errors.push(`plan contains ${allPlaceholders.length} BOUND_AT_PREFLIGHT placeholder(s) at: ${allPlaceholders.join(', ')} — this is a template, not an emitted plan`);
  }

  // Reject unknown top-level fields (explicit allowlist enforcement)
  const unknownFields = findUnknownTopLevelFields(plan);
  if (unknownFields.length > 0) {
    errors.push(`plan contains unknown top-level field(s): ${unknownFields.join(', ')} — not in DIGEST_ALLOWED_TOP_LEVEL`);
  }

  if (errors.length > 0) {
    return { ok: false, planSha256: plan.planSha256, errors, info };
  }

  // Recompute digest using the authoritative shared projection
  const recomputed = computePlanDigest(plan);
  info.storedDigest = plan.planSha256;
  info.recomputedDigest = recomputed;

  if (recomputed !== plan.planSha256) {
    errors.push(`digest mismatch: stored ${plan.planSha256.slice(0, 16)}... recomputed ${recomputed.slice(0, 16)}...`);
    return { ok: false, planSha256: plan.planSha256, errors, info };
  }

  // Compare against provided expected digest
  if (expectedDigest !== null) {
    if (typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
      errors.push('--expected must be exactly 64 lowercase hex characters');
      return { ok: false, planSha256: plan.planSha256, errors, info };
    }
    if (KNOWN_STALE_DIGESTS.has(expectedDigest)) {
      errors.push(`--expected ${expectedDigest.slice(0, 16)}... is a known stale digest`);
      return { ok: false, planSha256: plan.planSha256, errors, info };
    }
    if (expectedDigest !== recomputed) {
      errors.push(`expected digest mismatch: provided ${expectedDigest.slice(0, 16)}... recomputed ${recomputed.slice(0, 16)}...`);
      return { ok: false, planSha256: plan.planSha256, errors, info };
    }
  }

  // Validate implementationIdentity hashes if present (v6+)
  if (plan.implementationIdentity && typeof plan.implementationIdentity === 'object') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(__dirname, '..');
    for (const [key, entry] of Object.entries(plan.implementationIdentity)) {
      if (!entry || typeof entry !== 'object') {
        errors.push(`implementationIdentity.${key}: entry must be an object`);
        continue;
      }
      if (typeof entry.repoRelPath !== 'string') {
        errors.push(`implementationIdentity.${key}: repoRelPath must be a string`);
        continue;
      }
      if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
        errors.push(`implementationIdentity.${key}: sha256 must be a 64-char hex string`);
        continue;
      }
      const absPath = path.join(repoRoot, entry.repoRelPath);
      try {
        const actualSha256 = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
        if (actualSha256 !== entry.sha256) {
          errors.push(`implementationIdentity.${key}: sha256 mismatch for ${entry.repoRelPath} — stored ${entry.sha256.slice(0, 16)}... actual ${actualSha256.slice(0, 16)}...`);
        }
      } catch (e) {
        errors.push(`implementationIdentity.${key}: cannot read file ${entry.repoRelPath}: ${e.message}`);
      }
    }
    if (errors.length > 0) {
      return { ok: false, planSha256: plan.planSha256, errors, info };
    }
  }

  return { ok: true, planSha256: recomputed, errors: [], info };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const IS_MAIN = (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()
);

if (IS_MAIN) {
  const args = process.argv.slice(2);

  let planPath = null;
  let expectedDigest = null;

  // --plan=<path> or first positional arg
  const planArg = args.find(a => a.startsWith('--plan='));
  if (planArg) {
    planPath = planArg.slice('--plan='.length);
  } else {
    const idx = args.indexOf('--plan');
    if (idx >= 0 && idx + 1 < args.length) {
      planPath = args[idx + 1];
    } else {
      // positional
      const pos = args.find(a => !a.startsWith('--'));
      if (pos) planPath = pos;
    }
  }

  const expectedArg = args.find(a => a.startsWith('--expected='));
  if (expectedArg) {
    expectedDigest = expectedArg.slice('--expected='.length);
  } else {
    const idx = args.indexOf('--expected');
    if (idx >= 0 && idx + 1 < args.length) expectedDigest = args[idx + 1];
  }

  if (!planPath) {
    console.error('ERROR: plan file path is required');
    console.error('Usage: node tools/verify-b8-1-plan-digest.mjs <plan-file> [--expected=<sha256>]');
    process.exit(2);
  }

  const absPath = path.isAbsolute(planPath) ? planPath : path.resolve(process.cwd(), planPath);

  const { ok, planSha256, errors, info } = verifyPlanFile(absPath, expectedDigest);

  if (ok) {
    console.log(`PASS  planSha256: ${planSha256}`);
    if (info.storedDigest) {
      console.log(`      verified via shared digest contract (tools/lib/b8-1-plan-digest.mjs)`);
    }
  } else {
    for (const err of errors) {
      console.error(`FAIL  ${err}`);
    }
    if (info.storedDigest) {
      console.error(`      stored:     ${info.storedDigest}`);
    }
    if (info.recomputedDigest) {
      console.error(`      recomputed: ${info.recomputedDigest}`);
    }
    process.exitCode = 1;
  }
}
