import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReviewSession, recordDailyReviewDecision } from './mind-steward-daily-review.mjs';

function workflow() {
  return {
    items: [{
      review_id: 'review:source:1', state: 'new', history: [],
      source: { source_reference: 'mind/inbox/new/a.md', evidence_references: ['a.md'], source_hash: 'sha256:a', ingestion_or_review_id: 'ingestion:a', timestamp: 'fixed', authority_owner: 'external-source', confidence: 1, freshness: 'fresh', uncertainty: ['review required'] },
    }],
    counts: { new: 1, reviewing: 0, accepted: 0, rejected: 0, deferred: 0, archived: 0 },
  };
}

test('builds a bounded review session from existing workflow state', () => {
  const session = buildReviewSession({ workflow: workflow(), readiness: { status: 'ready', usable_for_daily_review: true }, calibration: { signals: { missing_provenance_items: 0 } }, generatedAt: 'fixed' });
  assert.equal(session.pending.length, 1);
  assert.equal(session.pending[0].ingestion_id, 'ingestion:a');
  assert.deepEqual(session.pending[0].decision_options, ['accepted', 'rejected', 'deferred', 'archived']);
  assert.equal(session.invariants.automatic_promotion, false);
});

test('records an explicit human decision without canonical mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-'));
  const workflowRoot = path.join(root, 'runtime', 'local', 'mind-steward', 'unified-review');
  fs.mkdirSync(workflowRoot, { recursive: true });
  fs.writeFileSync(path.join(workflowRoot, 'workflow-latest.json'), `${JSON.stringify(workflow())}\n`);
  const session = recordDailyReviewDecision({ repoRoot: root, reviewId: 'review:source:1', state: 'deferred', reason: 'needs Mind context', reviewer: 'human', sourceReference: 'mind/inbox/new/a.md', decidedAt: 'fixed' });
  assert.equal(session.pending[0].review_id, 'review:source:1');
  assert.equal(JSON.parse(fs.readFileSync(path.join(workflowRoot, 'workflow-latest.json'), 'utf8')).items[0].state, 'deferred');
  assert.equal(session.invariants.writes_to_mind, false);
});
