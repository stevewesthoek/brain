#!/usr/bin/env node

/**
 * BS0.19 — Cross-repository deletion-readiness gate.
 *
 * Reads the canonical path registry and a structured evidence index to
 * evaluate each non-canonical path as SAFE, PARTIAL, or BLOCKED.
 *
 * Rules (fail-closed by default):
 *  BLOCKED — any of: active producer, active consumer, unresolved authority,
 *             missing provenance, missing rollback, missing approval evidence
 *  PARTIAL — evidence is present but one or more preconditions are ambiguous,
 *             compatibility references exist without cleanup tasks, or the
 *             generator is still active without a retirement plan
 *  SAFE    — no active producer, no active consumer, all deletion prerequisites
 *             are recorded, no unresolved authority, provenance clear
 *
 * The validator is deterministic: identical registry + evidence → identical
 * output in identical key order. It never reads or writes the Mind vault or
 * any production filesystem path.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadPathRegistry } from './mind-canonical-path-registry.mjs';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const VERDICTS = /** @type {const} */ ({ SAFE: 'SAFE', PARTIAL: 'PARTIAL', BLOCKED: 'BLOCKED' });

/**
 * Validate a positive proof that can contribute to SAFE.
 *
 * @param {unknown} value
 * @param {{ proofId: string, registryLiteral: string | null, kind: 'universal-proof' | 'prerequisite' }} options
 * @returns {{ ok: true, evidence: string } | { ok: false, reason: string }}
 */
function validatePositiveProof(value, { proofId, registryLiteral, kind }) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, reason: `fail-closed: ${kind}-${proofId}-requires-structured-evidence` };
  }

  const status = value.status;
  const evidence = typeof value.evidence === 'string' ? value.evidence.trim() : '';

  if (status === 'unmet' || status === 'unresolved') {
    return {
      ok: false,
      reason: `${kind}-${status}: ${proofId}: ${evidence || '(no evidence)'}`,
    };
  }
  if (status !== 'satisfied') {
    return { ok: false, reason: `fail-closed: ${kind}-${proofId}-missing-satisfied-status` };
  }
  if (evidence.length === 0) {
    return { ok: false, reason: `fail-closed: ${kind}-${proofId}-missing-evidence-text` };
  }

  const appliesTo = value.appliesTo;
  const scopeMatches = appliesTo === 'global'
    || (Array.isArray(appliesTo) && registryLiteral !== null && appliesTo.includes(registryLiteral));
  if (!scopeMatches) {
    const renderedScope = Array.isArray(appliesTo) ? appliesTo.join(', ') : String(appliesTo);
    return {
      ok: false,
      reason: `${kind}-scope-mismatch: ${proofId} applies to [${renderedScope}] not [${registryLiteral}]`,
    };
  }

  return { ok: true, evidence };
}

/**
 * Evaluate a single path registry entry against its evidence record.
 *
 * @param {object} entry - path registry entry
 * @param {object} evidence - evidence record for this pathId (may be absent)
 * @returns {{ verdict: string, reasons: string[] }}
 */
export function evaluatePath(entry, evidence) {
  const reasons = [];

  // Canonical and future-target paths are not legacy; skip.
  if (entry.type.startsWith('canonical-') || entry.type === 'future-target') {
    return { verdict: VERDICTS.SAFE, reasons: ['canonical-or-future-target: not a legacy path'] };
  }

  // Fail-closed: evidence must be explicitly provided.
  if (!evidence) {
    reasons.push('fail-closed: no evidence record provided');
    return { verdict: VERDICTS.BLOCKED, reasons };
  }

  // BLOCKED conditions (any single one blocks).
  if (evidence.activeProducer) {
    reasons.push(`active-producer: ${evidence.activeProducer}`);
  }
  if (evidence.activeConsumer) {
    reasons.push(`active-consumer: ${evidence.activeConsumer}`);
  }
  if (evidence.unresolvedAuthority) {
    reasons.push(`unresolved-authority: ${evidence.unresolvedAuthority}`);
  }
  if (evidence.missingProvenance) {
    reasons.push(`missing-provenance: ${evidence.missingProvenance}`);
  }
  if (evidence.missingRollback) {
    reasons.push(`missing-rollback: ${evidence.missingRollback}`);
  }
  if (evidence.missingApproval) {
    reasons.push(`missing-approval: ${evidence.missingApproval}`);
  }

  if (reasons.length > 0) {
    return { verdict: VERDICTS.BLOCKED, reasons };
  }

  // PARTIAL conditions (any single one makes it partial).
  const partialReasons = [];
  if (evidence.ambiguousConsumer) {
    partialReasons.push(`ambiguous-consumer: ${evidence.ambiguousConsumer}`);
  }
  if (evidence.pendingCleanupTask) {
    partialReasons.push(`pending-cleanup-task: ${evidence.pendingCleanupTask}`);
  }
  if (evidence.activeGenerator) {
    partialReasons.push(`active-generator: ${evidence.activeGenerator}`);
  }
  if (evidence.unverifiedFixtureReference) {
    partialReasons.push(`unverified-fixture-reference: ${evidence.unverifiedFixtureReference}`);
  }

  if (partialReasons.length > 0) {
    return { verdict: VERDICTS.PARTIAL, reasons: partialReasons };
  }

  // SAFE is fail-closed: every universal deletion proof must be explicitly
  // satisfied, evidenced, and scoped to the exact registry literal or global.
  const requiredProofs = [
    ['noActiveProducer', 'producer-completeness'],
    ['noActiveConsumer', 'consumer-completeness'],
    ['provenanceProof', 'provenance'],
    ['rollbackProof', 'rollback'],
    ['approvalProof', 'approval'],
    ['authorityProof', 'authority'],
  ];
  const registryLiteral = entry.literal ?? entry.pattern ?? null;
  const validatedUniversalProofs = new Map();
  const universalProofFailures = [];

  for (const [field, label] of requiredProofs) {
    const result = validatePositiveProof(evidence[field], {
      proofId: label,
      registryLiteral,
      kind: 'universal-proof',
    });
    if (!result.ok) {
      universalProofFailures.push(result.reason);
    } else {
      validatedUniversalProofs.set(field, result.evidence);
    }
  }

  if (universalProofFailures.length > 0) {
    return { verdict: VERDICTS.BLOCKED, reasons: universalProofFailures };
  }

  // Every registry prerequisite must use the same structured positive-proof
  // contract. Plain strings never contribute to SAFE.
  const validatedPrerequisites = new Map();
  if (Array.isArray(entry.deletionPrerequisites) && entry.deletionPrerequisites.length > 0) {
    const prereqs = evidence.prerequisiteEvidence;
    const prerequisiteFailures = [];

    for (const id of entry.deletionPrerequisites) {
      if (!prereqs || typeof prereqs !== 'object' || Array.isArray(prereqs) || prereqs[id] === undefined) {
        prerequisiteFailures.push(`fail-closed: missing-prerequisite-${id}`);
        continue;
      }

      const result = validatePositiveProof(prereqs[id], {
        proofId: id,
        registryLiteral,
        kind: 'prerequisite',
      });
      if (!result.ok) {
        prerequisiteFailures.push(result.reason);
      } else {
        validatedPrerequisites.set(id, result.evidence);
      }
    }

    if (prerequisiteFailures.length > 0) {
      return { verdict: VERDICTS.BLOCKED, reasons: prerequisiteFailures };
    }
  }

  const safeReasons = requiredProofs.map(([field, label]) => `${label}-proof: ${validatedUniversalProofs.get(field)}`);
  if (evidence.fullyMigrated) safeReasons.unshift(`fully-migrated: ${evidence.fullyMigrated}`);

  if (Array.isArray(entry.deletionPrerequisites) && entry.deletionPrerequisites.length > 0) {
    for (const id of entry.deletionPrerequisites) {
      safeReasons.push(`prerequisite-satisfied: ${id}: ${validatedPrerequisites.get(id)}`);
    }
  }

  return { verdict: VERDICTS.SAFE, reasons: safeReasons };
}

/**
 * Run the full deletion-readiness evaluation.
 *
 * @param {{ registry: object, evidenceIndex: object }} options
 * @returns {{ result: string, verdictCounts: object, paths: object[] }}
 */
export function evaluateDeletionReadiness({ registry, evidenceIndex }) {
  const nonCanonicalEntries = registry.entries
    .filter((entry) => !entry.type.startsWith('canonical-') && entry.type !== 'future-target')
    .sort((a, b) => (a.pathId < b.pathId ? -1 : 1));

  const paths = nonCanonicalEntries.map((entry) => {
    const evidence = evidenceIndex[entry.pathId] ?? null;
    const { verdict, reasons } = evaluatePath(entry, evidence);
    return {
      pathId: entry.pathId,
      literal: entry.literal ?? entry.pattern ?? null,
      registryState: entry.lifecycleState,
      verdict,
      reasons,
    };
  });

  const verdictCounts = {
    [VERDICTS.SAFE]: paths.filter((p) => p.verdict === VERDICTS.SAFE).length,
    [VERDICTS.PARTIAL]: paths.filter((p) => p.verdict === VERDICTS.PARTIAL).length,
    [VERDICTS.BLOCKED]: paths.filter((p) => p.verdict === VERDICTS.BLOCKED).length,
  };

  const result = verdictCounts[VERDICTS.BLOCKED] > 0 ? 'blocked'
    : verdictCounts[VERDICTS.PARTIAL] > 0 ? 'partial'
    : 'safe';

  return { result, verdictCounts, paths };
}

export function loadEvidenceIndex(brainRoot) {
  const indexPath = path.join(brainRoot, 'operations/specs/deletion-readiness-evidence.json');
  const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return data.entries ?? data;
}

function main() {
  const argv = process.argv.slice(2);
  const brainRoot = argv.includes('--brain-root') ? argv[argv.indexOf('--brain-root') + 1] : SCRIPT_ROOT;
  const registry = loadPathRegistry({ repoRoot: brainRoot });
  const evidenceIndex = loadEvidenceIndex(brainRoot);
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.result === 'blocked') process.exitCode = 1;
    return;
  }

  process.stdout.write(`deletion-readiness=${report.result}\n`);
  process.stdout.write(`SAFE=${report.verdictCounts.SAFE}\n`);
  process.stdout.write(`PARTIAL=${report.verdictCounts.PARTIAL}\n`);
  process.stdout.write(`BLOCKED=${report.verdictCounts.BLOCKED}\n`);
  for (const entry of report.paths) {
    process.stdout.write(`path=${entry.pathId} verdict=${entry.verdict} reason=${entry.reasons[0] ?? 'none'}\n`);
  }
  process.stdout.write('filesystem_mutation=false\n');
  process.stdout.write('mind_content_read=false\n');
  if (report.result === 'blocked') process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
