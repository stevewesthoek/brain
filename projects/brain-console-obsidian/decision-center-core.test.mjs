import assert from 'node:assert/strict';
import test from 'node:test';
import core from './decision-center-core.cjs';

const {
  normalizeBaseUrl,
  normalizeQueue,
  decisionCounts,
  buildDecisionPayload,
  genericNotificationText,
  safeEvidenceRefs,
} = core;

function item(overrides = {}) {
  return {
    decisionId: 'proposal:p1',
    proposalId: 'p1',
    proposalHash: 'abc123',
    category: 'strategy',
    title: 'Private strategic decision',
    summary: 'Sensitive narrative',
    whyNow: 'Needs human authority',
    recommendedAction: 'Review it',
    alternatives: ['Reject'],
    consequenceOfDelay: 'Remains blocked',
    priority: 'normal',
    risk: 'medium',
    evidenceRefs: ['private/source.md'],
    writesToMindIfApproved: true,
    status: 'pending',
    pending: true,
    deferUntil: null,
    ...overrides,
  };
}

test('queue sorts pending high-priority decisions ahead of lower-priority terminal decisions', () => {
  const queue = normalizeQueue({
    items: [
      item({ proposalId: 'approved', status: 'approved', pending: false, priority: 'critical', title: 'Approved' }),
      item({ proposalId: 'normal', priority: 'normal', title: 'Normal' }),
      item({ proposalId: 'critical', priority: 'critical', title: 'Critical' }),
      item({ proposalId: 'deferred', status: 'deferred', pending: false, priority: 'high', title: 'Deferred' }),
    ],
  });
  assert.deepEqual(queue.map((entry) => entry.proposalId), ['critical', 'normal', 'deferred', 'approved']);
  assert.deepEqual(decisionCounts({ items: queue }), { total: 4, pending: 2, highPriorityPending: 1 });
});

test('decision payload carries stale-protection hash but no source evidence or summary text', () => {
  const current = item();
  const payload = buildDecisionPayload(current, 'approved', 'obsidian-owner', { reason: 'Reviewed' });
  assert.deepEqual(payload, {
    proposalHash: 'abc123',
    decision: 'approved',
    decidedBy: 'obsidian-owner',
    reason: 'Reviewed',
  });
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('Sensitive narrative'), false);
  assert.equal(serialized.includes('private/source.md'), false);
});

test('deferred decision payload requires a valid explicit future timestamp value', () => {
  const current = item();
  const payload = buildDecisionPayload(current, 'deferred', 'obsidian-owner', {
    deferUntil: new Date('2026-08-17T09:00:00.000Z'),
  });
  assert.equal(payload.deferUntil, '2026-08-17T09:00:00.000Z');
  assert.throws(() => buildDecisionPayload(current, 'deferred', 'obsidian-owner', { deferUntil: 'invalid' }), /valid deferUntil/);
});

test('notification text is generated only from aggregate counts, never backend source text', () => {
  const notification = {
    kind: 'attention',
    pendingCount: 4,
    highPriorityPendingCount: 2,
    message: 'Sensitive payroll merger plan from private/source.md',
  };
  const text = genericNotificationText(notification);
  assert.equal(text, 'Decision Center: 4 pending, 2 high-priority.');
  assert.equal(text.includes('Sensitive payroll'), false);
  assert.equal(text.includes('private/source.md'), false);
});

test('Brain Core URL normalization is configurable but rejects non-http transports', () => {
  assert.equal(normalizeBaseUrl('https://brain.example.test:4877/path?q=1'), 'https://brain.example.test:4877');
  assert.equal(normalizeBaseUrl('file:///tmp/brain-core'), 'http://127.0.0.1:4877');
});

test('evidence rendering is bounded', () => {
  const refs = safeEvidenceRefs({ evidenceRefs: Array.from({ length: 20 }, (_, index) => `source-${index}.md`) }, 5);
  assert.equal(refs.length, 5);
});
