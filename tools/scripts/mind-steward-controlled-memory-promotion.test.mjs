import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { approvePromotion, createPromotionCandidate, recordPromotionReceipt, rejectPromotion, requestPromotionConfirmation, writePromotionArtifact } from './mind-steward-controlled-memory-promotion.mjs';

const review = (state = 'accepted') => ({ review_id: 'review:example:1', state, source: { source_reference: 'mind/inbox/new/example.md', ingestion_or_review_id: 'review:example:1', source_hash: 'sha256:example', timestamp: '2026-08-23T12:00:00Z', authority_owner: 'mind', freshness: 'fresh', confidence: 0.9, uncertainty: [], evidence_references: ['evidence/example.json'] }, history: [{ action_id: 'review-action:accepted', state: 'accepted', reason: 'human reviewed', decided_at: '2026-08-23T13:00:00Z', reviewer: 'human' }] });

test('creates a promotion candidate only from an accepted review', () => {
  const candidate = createPromotionCandidate({ review: review(), targetDomain: 'personal-knowledge', proposedDestination: 'Mind', rollbackReference: 'rollback:example' });
  assert.equal(candidate.state, 'promotion_candidate');
  assert.equal(candidate.source.decision_reference, 'review-action:accepted');
  assert.equal(candidate.source.review_history_reference, 'review-history:review:example:1');
  assert.equal(candidate.evidence_preserved, true);
  assert.equal(candidate.automatic_promotion, false);
  assert.throws(() => createPromotionCandidate({ review: review('reviewing'), targetDomain: 'x', proposedDestination: 'Mind', rollbackReference: 'r' }), /accepted/);
  assert.throws(() => createPromotionCandidate({ review: { ...review(), source: { ...review().source, source_hash: null } }, targetDomain: 'x', proposedDestination: 'Mind', rollbackReference: 'r' }), /provenance/);
  assert.throws(() => createPromotionCandidate({ review: review(), existingPromotion: candidate, targetDomain: 'personal-knowledge', proposedDestination: 'Mind', rollbackReference: 'r' }), /duplicate promotion/);
});

test('requires explicit target, scope, reason, and human approval', () => {
  let candidate = createPromotionCandidate({ review: review(), targetDomain: 'operational-knowledge', proposedDestination: 'Brain', rollbackReference: 'rollback:example' });
  assert.throws(() => createPromotionCandidate({ review: review(), targetDomain: 'x', proposedDestination: 'Other', rollbackReference: 'r' }), /invalid promotion destination/);
  candidate = requestPromotionConfirmation(candidate, { requestedAt: '2026-08-23T14:00:00Z', reviewer: 'human', reason: 'confirm target' });
  assert.equal(candidate.state, 'awaiting_confirmation');
  assert.throws(() => approvePromotion(candidate, { targetDomain: 'operational-knowledge', proposedDestination: 'Brain', approvedAt: '2026-08-23T15:00:00Z', reviewer: 'human', reason: 'approved' }), /scope/);
  candidate = approvePromotion(candidate, { targetDomain: 'operational-knowledge', proposedDestination: 'Brain', scope: 'one reviewed item', approvedAt: '2026-08-23T15:00:00Z', reviewer: 'human', reason: 'approved' });
  assert.equal(candidate.state, 'approved_for_promotion');
});

test('promotion receipt is explicit, rollback is retained, and no writes occur', () => {
  let candidate = createPromotionCandidate({ review: review(), targetDomain: 'operational-knowledge', proposedDestination: 'evidence/archive only', rollbackReference: 'rollback:example' });
  candidate = requestPromotionConfirmation(candidate, { requestedAt: '2026-08-23T14:00:00Z', reviewer: 'human', reason: 'confirm archive' });
  candidate = approvePromotion(candidate, { targetDomain: 'operational-knowledge', proposedDestination: 'evidence/archive only', scope: 'one item', approvedAt: '2026-08-23T15:00:00Z', reviewer: 'human', reason: 'approved' });
  candidate = recordPromotionReceipt(candidate, { receiptReference: 'receipt:example', promotedAt: '2026-08-23T16:00:00Z', reviewer: 'human', rollbackReference: 'rollback:receipt-example' });
  assert.equal(candidate.state, 'promoted');
  assert.equal(candidate.history.at(-1).receipt_reference, 'receipt:example');
  assert.equal(candidate.rollback_reference, 'rollback:receipt-example');
  assert.equal(candidate.writes_to_mind, false);
  assert.equal(candidate.writes_to_brain_canonical, false);
  assert.throws(() => recordPromotionReceipt(candidate, { receiptReference: 'duplicate', promotedAt: 'x', reviewer: 'human', rollbackReference: 'r' }), /approved promotion/);
});

test('rejection and output containment are deterministic and safe', () => {
  let candidate = createPromotionCandidate({ review: review(), targetDomain: 'personal-knowledge', proposedDestination: 'Mind', rollbackReference: 'rollback:example' });
  candidate = rejectPromotion(candidate, { rejectedAt: '2026-08-23T14:00:00Z', reviewer: 'human', reason: 'insufficient scope' });
  assert.equal(candidate.state, 'rejected');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-promotion-'));
  fs.mkdirSync(path.join(root, 'runtime', 'local', 'mind-steward'), { recursive: true });
  assert.ok(writePromotionArtifact({ artifact: candidate, repoRoot: root }).startsWith(path.join(root, 'runtime', 'local', 'mind-steward')));
  assert.throws(() => writePromotionArtifact({ artifact: candidate, repoRoot: root, outputRoot: path.join(root, 'outside') }), /unsafe_promotion_output/);
});
