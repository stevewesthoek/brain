import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidMaintenanceReport,
  isMaintenanceFinding,
  validateMaintenanceReport,
} from '../mind-maintenance-pilot/report-schema-validator.js';
import type { MaintenanceFinding, MaintenanceReport } from '../mind-maintenance-pilot/types.js';
import { MIND_MAINTENANCE_TARGET_PILOT_FILES } from '../mind-maintenance-pilot/pilot-file-loader.js';

function createStaleCurrentContextFinding(): MaintenanceFinding {
  return {
    id: 'finding-stale-page-current-context-001',
    type: 'stale-page',
    status: 'open',
    created: '2026-06-13',
    sourceRepo: 'mind',
    scope: 'system',
    paths: ['router/00-current-context.md'],
    trigger: 'review_after date has passed',
    matchedEvidence: [
      {
        path: 'router/00-current-context.md',
        location: 'Status YAML block',
        summary:
          'The page is marked review-needed and review_after is 2026-06-05, earlier than the report date.',
      },
    ],
    comparisonEvidence: [],
    uncertainty:
      'The elapsed review date shows that review is due; it does not show that any statement is incorrect.',
    confidence: 0.98,
    risk: 'medium',
    recommendedAction:
      'Review the current-context page and either confirm it as current or update only affected sections.',
    requiresApproval: true,
    noWritePerformed: true,
    deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
    suppressionUntil: null,
    review: null,
  };
}

function createValidReport(): MaintenanceReport {
  return {
    schemaVersion: '1.0',
    reportId: 'mind-maintenance-20260613-120000',
    generatedAt: '2026-06-13T12:00:00Z',
    generatedBy: 'brain/mind-steward',
    mode: 'report-only',
    sourceRepo: 'mind',
    sourceCommit: 'abc1234',
    configuration: {
      maxFiles: 5,
      maxFindingsPerDetector: 5,
      minimumConfidence: 0.7,
      aiAssist: 'when-ambiguous',
    },
    detectors: {
      'stale-page': { enabled: true, status: 'completed' },
      'completed-but-active': { enabled: true, status: 'completed' },
      'source-gap': { enabled: true, status: 'completed' },
      'duplicate-candidate': { enabled: false, status: 'disabled' },
      'contradiction-candidate': { enabled: false, status: 'disabled' },
      'capture-promotion': { enabled: false, status: 'disabled' },
    },
    filesConsidered: [
      'router/00-current-context.md',
      'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
      'wiki/organisations/prochat/brand/product-strategy.md',
      'live/dashboard.md',
      'system/automation-roadmap.md',
    ],
    summary: {
      filesConsidered: 5,
      findingsTotal: 1,
      findingsOpen: 1,
      findingsAccepted: 0,
      findingsDismissed: 0,
      findingsResolved: 0,
      findingsSuppressed: 0,
      detectorErrors: 0,
    },
    findings: [createStaleCurrentContextFinding()],
    suppressedFindings: [],
    errors: [],
    safety: {
      allowedOutputPaths: [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
      sourceFilesChanged: 0,
      kanbanChanged: false,
      captureFilesChanged: 0,
      wikiFilesChanged: 0,
      liveFilesChanged: 0,
      archiveFilesChanged: 0,
      rootFilesCreated: 0,
      noWritePerformed: true,
    },
    noWritePerformed: true,
  };
}

function issuePaths(value: unknown): string[] {
  const result = validateMaintenanceReport(value);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

test('validates the canonical five-file stale-page fixture', () => {
  const report = createValidReport();
  const result = validateMaintenanceReport(report);

  assert.equal(result.ok, true);
  assert.doesNotThrow(() => assertValidMaintenanceReport(report));
  assert.equal(isMaintenanceFinding(report.findings[0]), true);
});

test('validates target-path pilot files during Mind folder migration', () => {
  const report = createValidReport();
  report.filesConsidered = [...MIND_MAINTENANCE_TARGET_PILOT_FILES];
  report.findings[0]!.paths = ['system/agent-context/00-current-context.md'];
  report.findings[0]!.matchedEvidence[0]!.path = 'system/agent-context/00-current-context.md';
  report.findings[0]!.deduplicationKey = 'stale-page:system/agent-context/00-current-context.md:review_after';

  const result = validateMaintenanceReport(report);

  assert.equal(result.ok, true);
});

test('rejects a finding without matched evidence', () => {
  const report = createValidReport();
  report.findings[0]!.matchedEvidence = [];

  assert.ok(issuePaths(report).includes('findings[0].matchedEvidence'));
});

test('rejects a finding emitted by a disabled detector', () => {
  const report = createValidReport();
  report.findings[0] = {
    ...createStaleCurrentContextFinding(),
    id: 'finding-duplicate-001',
    type: 'duplicate-candidate',
    deduplicationKey:
      'duplicate:live/projects/prochat-qa-memory/STRATEGY-PLAN.md:wiki/organisations/prochat/brand/product-strategy.md',
  };

  assert.ok(issuePaths(report).includes('findings[0].type'));
});

test('rejects summary counts that do not match report arrays', () => {
  const report = createValidReport();
  report.summary.findingsTotal = 2;
  report.summary.findingsOpen = 0;

  const paths = issuePaths(report);
  assert.ok(paths.includes('summary.findingsTotal'));
  assert.ok(paths.includes('summary.findingsOpen'));
});

test('enforces report-only mode and no-write guarantees', () => {
  const report = createValidReport();
  report.mode = 'write-enabled' as never;
  report.noWritePerformed = false as never;
  report.safety.sourceFilesChanged = 1;
  report.safety.noWritePerformed = false as never;

  const paths = issuePaths(report);
  assert.ok(paths.includes('mode'));
  assert.ok(paths.includes('noWritePerformed'));
  assert.ok(paths.includes('safety.sourceFilesChanged'));
  assert.ok(paths.includes('safety.noWritePerformed'));
});

test('rejects files and finding paths outside the bounded pilot dataset', () => {
  const report = createValidReport();
  report.filesConsidered[4] = 'wiki/unbounded-page.md';
  report.findings[0]!.paths = ['wiki/unbounded-page.md'];

  const result = validateMaintenanceReport(report);
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.ok(result.issues.some((issue) => issue.path === 'filesConsidered'));
  assert.ok(result.issues.some((issue) => issue.path === 'findings[0].paths'));
});

test('rejects stale-page wording that omits uncertainty or approval boundaries', () => {
  const report = createValidReport();
  report.findings[0]!.uncertainty = '';
  report.findings[0]!.requiresApproval = false as never;
  report.findings[0]!.noWritePerformed = false as never;

  const paths = issuePaths(report);
  assert.ok(paths.includes('findings[0].uncertainty'));
  assert.ok(paths.includes('findings[0].requiresApproval'));
  assert.ok(paths.includes('findings[0].noWritePerformed'));
});

test('accepts a structured detector error while preserving valid findings', () => {
  const report = createValidReport();
  report.detectors['source-gap'] = { enabled: true, status: 'failed' };
  report.errors = [
    {
      detector: 'source-gap',
      path: 'wiki/organisations/prochat/brand/product-strategy.md',
      errorType: 'timeout',
      summary: 'Source-gap semantic review exceeded its bounded execution time.',
      retryable: true,
    },
  ];
  report.summary.detectorErrors = 1;

  const result = validateMaintenanceReport(report);
  assert.equal(result.ok, true);
});
