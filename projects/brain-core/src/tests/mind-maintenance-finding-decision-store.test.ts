import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidMaintenanceFindingDecisionDocument,
  toMaintenanceReviewRecord,
  validateMaintenanceFindingDecisionDocument,
  type MaintenanceFindingDecision,
  type MaintenanceFindingDecisionDocument,
} from '../mind-maintenance-pilot/finding-decision-store.js';

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
    reason: 'The review date elapsed and the page required confirmation.',
    nextAction: 'Review the page and refresh freshness metadata if still current.',
    resolutionRef: null,
    suppressionUntil: null,
    ...overrides,
  };
}

function createDocument(
  decisions: MaintenanceFindingDecision[] = [createDecision()],
): MaintenanceFindingDecisionDocument {
  return {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-14T11:04:45.000Z',
    decisions,
  };
}

function issuePaths(value: unknown): string[] {
  const result = validateMaintenanceFindingDecisionDocument(value);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

test('validates accepted, dismissed, and resolved decisions', () => {
  const document = createDocument([
    createDecision(),
    createDecision({
      findingId: 'finding-source-gap-strategy-001',
      deduplicationKey: 'source-gap:wiki/strategy.md:claim',
      decision: 'dismissed',
      reason: 'The statement is an intentional strategic position, not an external fact.',
      nextAction: '',
      suppressionUntil: '2026-07-14',
    }),
    createDecision({
      findingId: 'finding-stale-page-dashboard-001',
      deduplicationKey: 'stale-page:live/dashboard.md:review_after',
      decision: 'resolved',
      reason: 'The page was reviewed and its freshness metadata was updated.',
      nextAction: '',
      resolutionRef: 'mind:b77f203',
    }),
  ]);

  assert.equal(validateMaintenanceFindingDecisionDocument(document).ok, true);
  assert.doesNotThrow(() => assertValidMaintenanceFindingDecisionDocument(document));
});

test('requires accepted findings to have a next action', () => {
  const document = createDocument([createDecision({ nextAction: '   ' })]);

  assert.ok(issuePaths(document).includes('decisions[0].nextAction'));
});

test('requires resolved findings to have a resolution reference', () => {
  const document = createDocument([
    createDecision({
      decision: 'resolved',
      nextAction: '',
      resolutionRef: null,
    }),
  ]);

  assert.ok(issuePaths(document).includes('decisions[0].resolutionRef'));
});

test('rejects resolution references on dismissed findings', () => {
  const document = createDocument([
    createDecision({
      decision: 'dismissed',
      nextAction: '',
      resolutionRef: 'mind:abc1234',
    }),
  ]);

  assert.ok(issuePaths(document).includes('decisions[0].resolutionRef'));
});

test('rejects duplicate finding IDs and deduplication keys', () => {
  const first = createDecision();
  const duplicate = createDecision({ reviewedAt: '2026-06-14T12:00:00.000Z' });
  const paths = issuePaths(createDocument([first, duplicate]));

  assert.ok(paths.includes('decisions[1].findingId'));
  assert.ok(paths.includes('decisions[1].deduplicationKey'));
});

test('rejects non-canonical timestamps and invalid suppression dates', () => {
  const document = createDocument([
    createDecision({
      reviewedAt: '2026-06-14T11:04:45Z',
      suppressionUntil: '2026-02-31',
    }),
  ]);
  document.updatedAt = 'not-a-date';

  const paths = issuePaths(document);
  assert.ok(paths.includes('updatedAt'));
  assert.ok(paths.includes('decisions[0].reviewedAt'));
  assert.ok(paths.includes('decisions[0].suppressionUntil'));
});

test('converts a stored decision into the existing report review record', () => {
  const decision = createDecision({
    decision: 'resolved',
    nextAction: '',
    resolutionRef: 'mind:b77f203',
  });

  assert.deepEqual(toMaintenanceReviewRecord(decision), {
    reviewedBy: decision.reviewedBy,
    reviewedAt: decision.reviewedAt,
    decision: 'resolved',
    reason: decision.reason,
    nextAction: '',
    resolutionRef: 'mind:b77f203',
  });
});
