import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMaintenanceFindingDecisions } from '../mind-maintenance-pilot/finding-decision-applier.js';
import type {
  MaintenanceFindingDecision,
  MaintenanceFindingDecisionDocument,
} from '../mind-maintenance-pilot/finding-decision-store.js';
import type { MaintenanceFinding } from '../mind-maintenance-pilot/types.js';

function createFinding(overrides: Partial<MaintenanceFinding> = {}): MaintenanceFinding {
  return {
    id: 'finding-stale-page-router-00-current-context-001',
    type: 'stale-page',
    status: 'open',
    created: '2026-06-14',
    sourceRepo: 'mind',
    scope: 'system',
    paths: ['router/00-current-context.md'],
    trigger: 'review_after date has passed',
    matchedEvidence: [{
      path: 'router/00-current-context.md',
      location: 'freshness metadata',
      summary: 'review_after is earlier than the report date',
    }],
    comparisonEvidence: [],
    uncertainty: 'Review is due; this does not prove the page is incorrect.',
    confidence: 0.98,
    risk: 'high',
    recommendedAction: 'Review the page.',
    requiresApproval: true,
    noWritePerformed: true,
    deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
    suppressionUntil: null,
    review: null,
    ...overrides,
  };
}

function createDecision(
  overrides: Partial<MaintenanceFindingDecision> = {},
): MaintenanceFindingDecision {
  return {
    findingId: 'finding-stale-page-router-00-current-context-001',
    deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
    sourceReportId: 'mind-maintenance-20260614T103145Z',
    sourceCommit: 'c60f7f8',
    reviewedBy: 'Steve Westhoek',
    reviewedAt: '2026-06-14T11:04:45.000Z',
    decision: 'accepted',
    reason: 'The finding is valid.',
    nextAction: 'Review the page.',
    resolutionRef: null,
    suppressionUntil: null,
    ...overrides,
  };
}

function createDocument(
  decisions: MaintenanceFindingDecision[],
): MaintenanceFindingDecisionDocument {
  return {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-14T12:00:00.000Z',
    decisions,
  };
}

test('applies accepted decisions to visible findings', () => {
  const finding = createFinding();
  const decision = createDecision();
  const result = applyMaintenanceFindingDecisions({
    findings: [finding],
    decisions: createDocument([decision]),
    reportDate: '2026-06-14',
  });

  assert.equal(result.findings[0]?.status, 'accepted');
  assert.equal(result.findings[0]?.review?.decision, 'accepted');
  assert.equal(result.suppressedFindings.length, 0);
  assert.equal(result.unmatchedDecisions.length, 0);
});

test('suppresses dismissed recurrence through suppressionUntil inclusively', () => {
  const decision = createDecision({
    decision: 'dismissed',
    reason: 'Intentional content.',
    nextAction: '',
    suppressionUntil: '2026-07-14',
  });
  const result = applyMaintenanceFindingDecisions({
    findings: [createFinding()],
    decisions: createDocument([decision]),
    reportDate: '2026-07-14',
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.suppressedFindings[0]?.status, 'dismissed');
  assert.equal(result.suppressedFindings[0]?.suppressionUntil, '2026-07-14');
});

test('reopens expired dismissals as visible findings', () => {
  const decision = createDecision({
    decision: 'dismissed',
    reason: 'Intentional content.',
    nextAction: '',
    suppressionUntil: '2026-07-14',
  });
  const result = applyMaintenanceFindingDecisions({
    findings: [createFinding()],
    decisions: createDocument([decision]),
    reportDate: '2026-07-15',
  });

  assert.equal(result.findings[0]?.status, 'open');
  assert.equal(result.findings[0]?.review, null);
  assert.equal(result.suppressedFindings.length, 0);
});

test('reopens resolved recurrence instead of silently inheriting the old resolution', () => {
  const decision = createDecision({
    decision: 'resolved',
    reason: 'The page was refreshed.',
    nextAction: '',
    resolutionRef: 'mind:b77f203',
  });
  const result = applyMaintenanceFindingDecisions({
    findings: [createFinding()],
    decisions: createDocument([decision]),
    reportDate: '2026-08-01',
  });

  assert.equal(result.findings[0]?.status, 'open');
  assert.equal(result.findings[0]?.review, null);
});

test('returns unmatched decisions without affecting findings', () => {
  const unmatched = createDecision({
    findingId: 'finding-source-gap-strategy-001',
    deduplicationKey: 'source-gap:wiki/strategy.md:claim',
    decision: 'dismissed',
    reason: 'Intentional strategy.',
    nextAction: '',
  });
  const result = applyMaintenanceFindingDecisions({
    findings: [createFinding()],
    decisions: createDocument([unmatched]),
    reportDate: '2026-06-14',
  });

  assert.equal(result.findings[0]?.status, 'open');
  assert.deepEqual(result.unmatchedDecisions, [unmatched]);
});

test('does not mutate source findings or decisions', () => {
  const finding = createFinding();
  const decision = createDecision();
  const findingsSnapshot = structuredClone([finding]);
  const document = createDocument([decision]);
  const documentSnapshot = structuredClone(document);

  applyMaintenanceFindingDecisions({
    findings: [finding],
    decisions: document,
    reportDate: '2026-06-14',
  });

  assert.deepEqual([finding], findingsSnapshot);
  assert.deepEqual(document, documentSnapshot);
});

test('rejects invalid report dates', () => {
  assert.throws(
    () => applyMaintenanceFindingDecisions({
      findings: [],
      decisions: createDocument([]),
      reportDate: '2026-02-31',
    }),
    /ISO report date/i,
  );
});
