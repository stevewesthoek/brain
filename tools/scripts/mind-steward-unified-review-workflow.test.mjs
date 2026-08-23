import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyReviewAction, buildReviewWorkflow, renderReviewWorkflow, transitionReviewItem, writeReviewWorkflow } from './mind-steward-unified-review-workflow.mjs';

const item = (review_id = 'review:source:1') => ({ review_id, source_reference: 'mind/inbox/new/example.md', source_hash: 'sha256:example', timestamp: '2026-08-23T12:00:00Z', authority_owner: 'mind', freshness: 'fresh', confidence: 0.9, uncertainty: [], provenance: { evidence_references: ['evidence/example.json'] } });
const briefing = (entries = [item()]) => ({ generated_at: '2026-08-23T12:00:00Z', source: 'infinite-brain-unified-review', attention_queue: entries });

test('creates a new workflow while preserving review identity and evidence', () => {
  const workflow = buildReviewWorkflow({ briefing: briefing() });
  assert.equal(workflow.items[0].state, 'new');
  assert.equal(workflow.items[0].source.ingestion_or_review_id, 'review:source:1');
  assert.deepEqual(workflow.items[0].source.evidence_references, ['evidence/example.json']);
  assert.equal(workflow.items[0].evidence_preserved, true);
});

test('requires explicit human reason and matching source for decisions', () => {
  const workflow = buildReviewWorkflow({ briefing: briefing() });
  assert.throws(() => applyReviewAction(workflow, { reviewId: 'review:source:1', state: 'accepted', decidedAt: '2026-08-23T13:00:00Z', reviewer: 'human', sourceReference: item().source_reference }), /reason is required/);
  assert.throws(() => applyReviewAction(workflow, { reviewId: 'review:source:1', state: 'accepted', reason: 'reviewed', decidedAt: '2026-08-23T13:00:00Z', reviewer: 'human', sourceReference: 'wrong.md' }), /source reference/);
  const accepted = applyReviewAction(workflow, { reviewId: 'review:source:1', state: 'accepted', reason: 'reviewed', decidedAt: '2026-08-23T13:00:00Z', reviewer: 'human', sourceReference: item().source_reference });
  assert.equal(accepted.items[0].state, 'accepted');
  assert.equal(accepted.items[0].unresolved, false);
  assert.equal(accepted.items[0].history.length, 1);
});

test('preserves history through reviewing and deferral without canonical mutation', () => {
  let workflow = buildReviewWorkflow({ briefing: briefing() });
  workflow = applyReviewAction(workflow, { reviewId: 'review:source:1', state: 'reviewing', decidedAt: '2026-08-23T13:00:00Z', reviewer: 'human', sourceReference: item().source_reference });
  workflow = applyReviewAction(workflow, { reviewId: 'review:source:1', state: 'deferred', reason: 'needs Mind context', decidedAt: '2026-08-23T14:00:00Z', reviewer: 'human', sourceReference: item().source_reference });
  assert.equal(workflow.items[0].history.length, 2);
  assert.equal(workflow.items[0].unresolved, true);
  assert.equal(workflow.invariants.writes_to_mind, false);
  assert.equal(workflow.invariants.writes_to_brain_canonical, false);
});

test('rejects duplicate review identities and unsafe output', () => {
  assert.throws(() => buildReviewWorkflow({ briefing: briefing([item(), item()]) }), /duplicate review item/);
  const workflow = buildReviewWorkflow({ briefing: briefing() });
  assert.throws(() => transitionReviewItem(workflow.items[0], { state: 'invalid', decidedAt: 'x', reviewer: 'human', sourceReference: item().source_reference }), /invalid review state/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-review-workflow-'));
  fs.mkdirSync(path.join(root, 'runtime', 'local', 'mind-steward'), { recursive: true });
  const paths = writeReviewWorkflow({ workflow, repoRoot: root });
  assert.ok(paths.jsonPath.startsWith(path.join(root, 'runtime', 'local', 'mind-steward')));
  assert.match(renderReviewWorkflow(workflow), /State: \*\*new\*\*/);
  assert.throws(() => writeReviewWorkflow({ workflow, repoRoot: root, outputRoot: path.join(root, 'outside') }), /unsafe_review_workflow_output/);
});
