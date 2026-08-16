import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeProposalHash,
  decisionRecordsEquivalent,
  evaluateDecisionWriteGuard,
  projectDecisionStatus,
  computeDecisionNotificationPlan,
} from '../adapters/infinite-brain-decision-runtime.mjs';

function proposal(overrides = {}) {
  return {
    proposalId: 'proposal-1',
    category: 'strategy',
    summary: 'Sensitive narrative that must not enter notifications.',
    priority: 'high',
    ...overrides,
  };
}

function decision(overrides = {}) {
  return {
    proposalId: 'proposal-1',
    decision: 'approved',
    decidedBy: 'owner',
    reason: 'Reviewed',
    proposalHash: computeProposalHash(proposal()),
    deferUntil: undefined,
    ...overrides,
  };
}

test('proposal hash changes when proposal content changes', () => {
  const first = computeProposalHash(proposal());
  const second = computeProposalHash(proposal({ summary: 'Changed proposal content.' }));
  assert.match(first, /^[a-f0-9]{16}$/);
  assert.notEqual(first, second);
});

test('decision equivalence is exact enough for idempotent repeat actions', () => {
  const first = decision();
  assert.equal(decisionRecordsEquivalent(first, { ...first }), true);
  assert.equal(decisionRecordsEquivalent(first, { ...first, decision: 'rejected' }), false);
  assert.equal(decisionRecordsEquivalent(first, { ...first, reason: 'Changed reason' }), false);
  assert.equal(decisionRecordsEquivalent(first, { ...first, proposalHash: 'stale000000000000' }), false);
});

test('decision write guard rejects stale proposal hashes and returns idempotent repeats', () => {
  const currentProposal = proposal();
  const currentHash = computeProposalHash(currentProposal);
  const nextRecord = decision({ proposalHash: currentHash });

  const stale = evaluateDecisionWriteGuard({
    proposal: currentProposal,
    expectedProposalHash: 'stale000000000000',
    existingRecord: undefined,
    nextRecord,
  });
  assert.deepEqual(stale, { ok: false, code: 'stale_proposal_hash', currentProposalHash: currentHash });

  const idempotent = evaluateDecisionWriteGuard({
    proposal: currentProposal,
    expectedProposalHash: currentHash,
    existingRecord: { ...nextRecord },
    nextRecord,
  });
  assert.deepEqual(idempotent, { ok: true, code: 'decision_idempotent', currentProposalHash: currentHash });

  const newDecision = evaluateDecisionWriteGuard({
    proposal: currentProposal,
    expectedProposalHash: currentHash,
    existingRecord: { ...nextRecord, decision: 'rejected' },
    nextRecord,
  });
  assert.deepEqual(newDecision, { ok: true, code: 'decision_recorded', currentProposalHash: currentHash });
});

test('decision lifecycle covers pending, approved, rejected, deferred, expired defer, needs-review, and superseded', () => {
  const now = new Date('2026-08-16T10:00:00.000Z');
  const hash = computeProposalHash(proposal());

  assert.deepEqual(projectDecisionStatus(undefined, hash, now), { status: 'pending', pending: true, deferUntil: null });
  assert.deepEqual(projectDecisionStatus(decision({ proposalHash: hash }), hash, now), { status: 'approved', pending: false, deferUntil: null });
  assert.deepEqual(projectDecisionStatus(decision({ proposalHash: hash, decision: 'rejected' }), hash, now), { status: 'rejected', pending: false, deferUntil: null });
  assert.deepEqual(projectDecisionStatus(decision({ proposalHash: hash, decision: 'needs-review' }), hash, now), { status: 'pending', pending: true, deferUntil: null });
  assert.deepEqual(
    projectDecisionStatus(decision({ proposalHash: hash, decision: 'deferred', deferUntil: '2026-08-17T10:00:00.000Z' }), hash, now),
    { status: 'deferred', pending: false, deferUntil: '2026-08-17T10:00:00.000Z' },
  );
  assert.deepEqual(
    projectDecisionStatus(decision({ proposalHash: hash, decision: 'deferred', deferUntil: '2026-08-15T10:00:00.000Z' }), hash, now),
    { status: 'pending', pending: true, deferUntil: '2026-08-15T10:00:00.000Z' },
  );
  assert.deepEqual(
    projectDecisionStatus(decision({ proposalHash: 'old0000000000000' }), hash, now),
    { status: 'superseded', pending: true, deferUntil: null },
  );
});

test('notification plan emits high-priority and zero-to-pending attention once', () => {
  const now = new Date('2026-08-16T10:10:00.000Z');
  const queue = {
    counts: { pending: 1, highPriorityPending: 1 },
    items: [{ decisionId: 'proposal:p1', pending: true, priority: 'high', title: 'Sensitive title', summary: 'Private text' }],
  };
  const initial = {
    schemaVersion: '1.0.0',
    lastPendingCount: 0,
    notifiedHighDecisionIds: [],
    lastDigestDate: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  const first = computeDecisionNotificationPlan(queue, initial, now);
  assert.equal(first.notifications.length, 1);
  assert.deepEqual(first.notifications[0].reasons, ['high-priority', 'zero-to-pending']);
  assert.equal(first.notifications[0].sensitiveSourceTextIncluded, false);
  assert.equal(JSON.stringify(first.notifications).includes('Sensitive title'), false);
  assert.equal(JSON.stringify(first.notifications).includes('Private text'), false);

  const second = computeDecisionNotificationPlan(queue, first.nextState, new Date('2026-08-16T10:15:00.000Z'));
  assert.equal(second.notifications.length, 0);
});

test('normal-priority daily digest dedupes by local calendar day', () => {
  const queue = {
    counts: { pending: 2, highPriorityPending: 0 },
    items: [
      { decisionId: 'proposal:n1', pending: true, priority: 'normal' },
      { decisionId: 'proposal:l1', pending: true, priority: 'low' },
    ],
  };
  const initial = {
    schemaVersion: '1.0.0',
    lastPendingCount: 2,
    notifiedHighDecisionIds: [],
    lastDigestDate: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  const first = computeDecisionNotificationPlan(queue, initial, new Date('2026-08-16T08:00:00.000Z'));
  assert.equal(first.notifications.length, 1);
  assert.equal(first.notifications[0].kind, 'daily-digest');

  const sameDay = computeDecisionNotificationPlan(queue, first.nextState, new Date('2026-08-16T18:00:00.000Z'));
  assert.equal(sameDay.notifications.length, 0);

  const nextDay = computeDecisionNotificationPlan(queue, sameDay.nextState, new Date('2026-08-17T08:00:00.000Z'));
  assert.equal(nextDay.notifications.length, 1);
  assert.equal(nextDay.notifications[0].kind, 'daily-digest');
});

test('notification plan prunes resolved high-priority dedupe keys', () => {
  const previous = {
    schemaVersion: '1.0.0',
    lastPendingCount: 1,
    notifiedHighDecisionIds: ['proposal:resolved'],
    lastDigestDate: null,
    updatedAt: '2026-08-16T09:00:00.000Z',
  };
  const queue = { counts: { pending: 0, highPriorityPending: 0 }, items: [] };
  const result = computeDecisionNotificationPlan(queue, previous, new Date('2026-08-16T10:00:00.000Z'));
  assert.equal(result.notifications.length, 0);
  assert.deepEqual(result.nextState.notifiedHighDecisionIds, []);
  assert.equal(result.nextState.lastPendingCount, 0);
});
