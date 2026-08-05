#!/usr/bin/env node
/**
 * verify-b8-1-plan-digest.mjs
 *
 * Independent verifier for B8.1 canonical plans.
 *
 * Loads a committed plan file produced by --write-plan, recomputes its
 * planSha256 from the digestInput fields (excluding planSha256, createdAt,
 * runContext, and _... annotation fields), and proves the stored planSha256
 * matches the recomputed value.
 *
 * This verifier does NOT rerun preflight. It is a standalone integrity check
 * that any reviewer can run against the committed plan file.
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

export const VERIFIER_VERSION = '1.0.0';
export const REQUIRED_PLAN_VERSION = '5.0.0';

// Fields excluded from the digest. These are run-local, observational, or
// injected by materialization. They must never appear in digestInput.
const EXCLUDED_FROM_DIGEST = new Set(['planSha256', 'createdAt', 'runContext']);

// Annotation fields injected by the plan template (prefixed with _).
// Their presence in a plan file indicates it was NOT produced by --write-plan.
const ANNOTATION_PREFIX = '_';

// Known stale digests — must not be accepted as valid.
export const KNOWN_STALE_DIGESTS = new Set([
  'dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4',
  '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda',
  '40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0',
  'c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4',
  'd9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42',
]);

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
  return sorted;
}

/**
 * Recompute the plan digest from a plan object.
 * Excludes planSha256, createdAt, runContext, and _annotation fields.
 *
 * @param {object} plan
 * @returns {{ digest: string, excludedFields: string[], annotationFields: string[] }}
 */
export function recomputeDigest(plan) {
  const excludedFields = [];
  const annotationFields = [];
  const digestInput = {};

  for (const [key, value] of Object.entries(plan)) {
    if (EXCLUDED_FROM_DIGEST.has(key)) {
      excludedFields.push(key);
      continue;
    }
    if (key.startsWith(ANNOTATION_PREFIX)) {
      annotationFields.push(key);
      continue;
    }
    digestInput[key] = value;
  }

  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(digestInput)))
    .digest('hex');

  return { digest, excludedFields, annotationFields, digestInput };
}

/**
 * Scan a plan for BOUND_AT_PREFLIGHT placeholders in all string values.
 * Returns an array of field paths that contain placeholders.
 *
 * @param {any} value
 * @param {string} path
 * @returns {string[]}
 */
export function findPlaceholders(value, fieldPath = '') {
  if (typeof value === 'string' && value === 'BOUND_AT_PREFLIGHT') return [fieldPath];
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findPlaceholders(v, `${fieldPath}[${i}]`));
  }
  return Object.entries(value).flatMap(([k, v]) => findPlaceholders(v, fieldPath ? `${fieldPath}.${k}` : k));
}

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
  const annotationKeys = Object.keys(plan).filter(k => k.startsWith(ANNOTATION_PREFIX));
  if (annotationKeys.length > 0) {
    errors.push(`plan contains annotation fields (${annotationKeys.join(', ')}) — this is a template file, not an emitted plan produced by --write-plan`);
  }

  // Reject BOUND_AT_PREFLIGHT placeholders anywhere in the plan
  const allPlaceholders = findPlaceholders(plan);
  if (allPlaceholders.length > 0) {
    errors.push(`plan contains ${allPlaceholders.length} BOUND_AT_PREFLIGHT placeholder(s) at: ${allPlaceholders.join(', ')} — this is a template, not an emitted plan`);
  }

  if (errors.length > 0) {
    return { ok: false, planSha256: plan.planSha256, errors, info };
  }

  // Recompute digest
  const { digest: recomputed, excludedFields, annotationFields } = recomputeDigest(plan);
  info.storedDigest = plan.planSha256;
  info.recomputedDigest = recomputed;
  info.excludedFields = excludedFields;
  info.annotationFieldsSkipped = annotationFields;

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
    if (info.excludedFields?.length) {
      console.log(`      excluded from digest: ${info.excludedFields.join(', ')}`);
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
