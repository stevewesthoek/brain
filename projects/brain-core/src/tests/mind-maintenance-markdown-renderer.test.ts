import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMindMaintenanceReportMarkdown } from '../mind-maintenance-pilot/markdown-report-renderer.js';
import type { MaintenanceReport } from '../mind-maintenance-pilot/types.js';

function createReport(): MaintenanceReport {
  return {
    schemaVersion: '1.0',
    reportId: 'mind-maintenance-20260613T120000Z',
    generatedAt: '2026-06-13T12:00:00.000Z',
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
    findings: [
      {
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
            location: 'freshness metadata',
            summary: 'review_after is earlier than the report date',
          },
        ],
        comparisonEvidence: [],
        uncertainty: 'Review is due; this does not prove the page is incorrect.',
        confidence: 0.98,
        risk: 'medium',
        recommendedAction: 'Review the page and update only affected sections if needed.',
        requiresApproval: true,
        noWritePerformed: true,
        deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
        suppressionUntil: null,
        review: null,
      },
    ],
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

test('renders canonical identity, summary, detector, finding, and safety sections', () => {
  const markdown = renderMindMaintenanceReportMarkdown(createReport());

  assert.match(markdown, /^# Mind Maintenance Report/m);
  assert.match(markdown, /mind-maintenance-20260613T120000Z/);
  assert.match(markdown, /Source commit:\*\* `abc1234`/);
  assert.match(markdown, /Mode:\*\* report-only/);
  assert.match(markdown, /Writes performed:\*\* none/);
  assert.match(markdown, /Files considered: 5/);
  assert.match(markdown, /Open findings: 1/);
  assert.match(markdown, /Duplicate Candidate: disabled/);
  assert.match(markdown, /finding-stale-page-current-context-001/);
  assert.match(markdown, /review_after is earlier than the report date/);
  assert.match(markdown, /Accepting a finding does not authorize a content write/);
  assert.match(markdown, /Source files changed: no/);
});

test('keeps report identity and counts in parity with the source report', () => {
  const report = createReport();
  const markdown = renderMindMaintenanceReportMarkdown(report);

  assert.ok(markdown.includes(report.reportId));
  assert.ok(markdown.includes(report.generatedAt));
  assert.ok(markdown.includes(report.sourceCommit));
  assert.ok(markdown.includes(`Files considered: ${report.summary.filesConsidered}`));
  assert.ok(markdown.includes(`Open findings: ${report.summary.findingsOpen}`));
  assert.ok(markdown.includes(`Detector errors: ${report.summary.detectorErrors}`));
});

test('renders careful no-finding language for unaffected pages', () => {
  const markdown = renderMindMaintenanceReportMarkdown(createReport());

  assert.match(markdown, /## No findings detected/);
  assert.match(markdown, /enabled detectors found no evidence meeting the configured threshold/i);
  assert.match(markdown, /does not prove those pages can never require maintenance/i);
  assert.doesNotMatch(markdown, /no maintenance problems exist/i);
});

test('renders detector failures explicitly instead of presenting a clean result', () => {
  const report = createReport();
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

  const markdown = renderMindMaintenanceReportMarkdown(report);

  assert.match(markdown, /Source Gap: failed/);
  assert.match(markdown, /Source-gap semantic review exceeded its bounded execution time/);
  assert.match(markdown, /retryable: yes/);
  assert.doesNotMatch(markdown, /Detector errors\n\nNone\./);
});

test('renders a valid zero-finding report without inventing findings', () => {
  const report = createReport();
  report.findings = [];
  report.summary.findingsTotal = 0;
  report.summary.findingsOpen = 0;

  const markdown = renderMindMaintenanceReportMarkdown(report);

  assert.match(markdown, /No valid findings were detected by enabled detectors/);
  assert.doesNotMatch(markdown, /finding-stale-page-current-context-001/);
});

test('is deterministic for the same validated report', () => {
  const report = createReport();

  assert.equal(
    renderMindMaintenanceReportMarkdown(report),
    renderMindMaintenanceReportMarkdown(report),
  );
});
