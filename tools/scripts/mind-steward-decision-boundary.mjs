import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DECISIONS = new Set(['accepted', 'rejected', 'deferred', 'archived']);

function safeDecisionRoot(repoRoot, outputRoot) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'decisions'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error(`unsafe_decision_output: ${resolved}`);
  return resolved;
}

export function createDecisionArtifact({ reviewItem, decision, decidedAt, reviewer, reason, notes = '' } = {}) {
  const errors = [];
  if (!reviewItem?.ingestion_id || !reviewItem.source_hash || !reviewItem.source_file) errors.push('review item provenance is required');
  if (!DECISIONS.has(decision)) errors.push('decision must be accepted, rejected, deferred, or archived');
  if (!decidedAt) errors.push('decidedAt is required');
  if (!reviewer) errors.push('reviewer is required');
  if (decision !== 'accepted' && !reason) errors.push(`reason is required for ${decision}`);
  if (errors.length) throw new Error(errors.join('; '));
  const decisionId = `decision:${crypto.createHash('sha256').update(`${reviewItem.ingestion_id}|${reviewItem.source_hash}|${decision}|${decidedAt}|${reviewer}`).digest('hex').slice(0, 24)}`;
  const base = {
    schema_version: '1.0.0',
    decision_id: decisionId,
    decision,
    decided_at: decidedAt,
    reviewer,
    source: {
      file: reviewItem.source_file,
      ingestion_id: reviewItem.ingestion_id,
      source_hash: reviewItem.source_hash,
    },
    reason: reason ?? null,
    notes,
    provenance_preserved: true,
    writes_to_mind: false,
    writes_to_brain_canonical: false,
    automatic_promotion: false,
  };
  if (decision === 'accepted') {
    base.outcome = {
      kind: 'promotion_candidate',
      status: 'candidate_only',
      next_step: 'human approval through the existing bounded Mind/Brain transaction flow',
    };
  } else if (decision === 'rejected') {
    base.outcome = { kind: 'retained_evidence', status: 'rejected_pending_retention', next_step: 'retain source and rejection reason for review history' };
  } else if (decision === 'deferred') {
    base.outcome = { kind: 'review_queue_item', status: 'deferred_pending_review', next_step: 'return to the human review queue' };
  } else {
    base.outcome = { kind: 'historical_evidence', status: 'archived_pending_retention', next_step: 'retain traceable source and decision evidence' };
  }
  return base;
}

export function writeDecisionArtifact({ artifact, repoRoot = process.cwd(), outputRoot } = {}) {
  const root = safeDecisionRoot(repoRoot, outputRoot);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const filePath = path.join(root, `${artifact.decision_id.replace(':', '-')}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}
