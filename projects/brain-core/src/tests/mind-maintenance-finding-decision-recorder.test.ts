import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recordMaintenanceFindingDecision,
} from '../mind-maintenance-pilot/finding-decision-recorder.js';
import type {
  MaintenanceFindingDecision,
  MaintenanceFindingDecisionDocument,
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
    decision: 'resolved',
    reason: 'The page was reviewed and remains current.',
    nextAction: '',
    resolutionRef: 'mind:b77f203',
    suppressionUntil: null,
    ...overrides,
  };
}

function createDocument(
  decisions: MaintenanceFindingDecision[] = [],
): MaintenanceFindingDecisionDocument {
  return {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-14T11:00:00.000Z',
    decisions,
  };
}

test('creates a new decision without mutating the source document', () => {
  const source = createDocument();
  const sourceSnapshot = structuredClone(source);
  const decision = createDecision();

  const result = recordMaintenanceFindingDecision({
    document: source,
    decision,
    updatedAt: '2026-06-14T11:05:00.000Z',
  });

  assert.equal(result.operation, 'created');
  assert.equal(result.replacedFindingId, null);
  assert.deepEqual(result.document.decisions, [decision]);
  assert.equal(result.document.updatedAt, '2026-06-14T11:05:00.000Z');
  assert.deepEqual(source, sourceSnapshot);
});

test('replaces a recurring decision by deduplication key', () => {
  const previous = createDecision({
    findingId: 'finding-stale-page-router-00-current-context-001',
    reviewedAt: '2026-06-14T11:04:45.000Z',
  });
  const recurring = createDecision({
    findingId: 'finding-stale-page-router-00-current-context-002',
    sourceReportId: 'mind-maintenance-20260701T090000Z',
    sourceCommit: 'def5678',
    reviewedAt: '2026-07-01T09:30:00.000Z',
    decision: 'accepted',
    reason: 'The review date elapsed again.',
    nextAction: 'Review the page again.',
    resolutionRef: null,
  });

  const result = recordMaintenanceFindingDecision({
    document: createDocument([previous]),
    decision: recurring,
    updatedAt: '2026-07-01T09:35:00.000Z',
  });

  assert.equal(result.operation, 'replaced');
  assert.equal(result.replacedFindingId, previous.findingId);
  assert.deepEqual(result.document.decisions, [recurring]);
});

test('rejects replacement with an older review timestamp', () => {
  const current = createDecision({ reviewedAt: '2026-07-01T09:30:00.000Z' });
  const stale = createDecision({
    findingId: 'finding-stale-page-router-00-current-context-002',
    reviewedAt: '2026-06-14T11:04:45.000Z',
  });

  assert.throws(
    () => recordMaintenanceFindingDecision({
      document: createDocument([current]),
      decision: stale,
      updatedAt: '2026-07-01T09:35:00.000Z',
    }),
    /older review timestamp/i,
  );
});

test('rejects finding IDs already assigned to another deduplication key', () => {
  const existing = createDecision();
  const conflict = createDecision({
    deduplicationKey: 'source-gap:wiki/strategy.md:claim',
    decision: 'dismissed',
    reason: 'Intentional strategic statement.',
    nextAction: '',
    resolutionRef: null,
  });

  assert.throws(
    () => recordMaintenanceFindingDecision({
      document: createDocument([existing]),
      decision: conflict,
      updatedAt: '2026-06-14T12:00:00.000Z',
    }),
    /Finding ID already belongs to another deduplication key/i,
  );
});

test('sorts decisions deterministically by deduplication key and review time', () => {
  const sourceGap = createDecision({
    findingId: 'finding-source-gap-strategy-001',
    deduplicationKey: 'source-gap:wiki/strategy.md:claim',
    decision: 'dismissed',
    reason: 'Intentional strategic statement.',
    nextAction: '',
    resolutionRef: null,
  });
  const completedActive = createDecision({
    findingId: 'finding-completed-active-roadmap-001',
    deduplicationKey: 'completed-but-active:system/automation-roadmap.md:status',
    decision: 'accepted',
    reason: 'Status metadata is inconsistent.',
    nextAction: 'Review the roadmap status.',
    resolutionRef: null,
  });

  const result = recordMaintenanceFindingDecision({
    document: createDocument([sourceGap]),
    decision: completedActive,
    updatedAt: '2026-06-14T12:00:00.000Z',
  });

  assert.deepEqual(
    result.document.decisions.map((decision) => decision.deduplicationKey),
    [
      'completed-but-active:system/automation-roadmap.md:status',
      'source-gap:wiki/strategy.md:claim',
    ],
  );
});

test('rejects non-canonical updatedAt and decisions reviewed after updatedAt', () => {
  assert.throws(
    () => recordMaintenanceFindingDecision({
      document: createDocument(),
      decision: createDecision(),
      updatedAt: '2026-06-14T11:05:00Z',
    }),
    /canonical ISO timestamp/i,
  );

  assert.throws(
    () => recordMaintenanceFindingDecision({
      document: createDocument(),
      decision: createDecision({ reviewedAt: '2026-06-14T12:00:00.000Z' }),
      updatedAt: '2026-06-14T11:05:00.000Z',
    }),
    /reviewedAt cannot be later/i,
  );
});
