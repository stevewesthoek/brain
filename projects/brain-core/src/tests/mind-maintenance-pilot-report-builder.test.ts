import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMindMaintenancePilotReport } from '../mind-maintenance-pilot/pilot-report-builder.js';
import {
  MIND_MAINTENANCE_PILOT_FILES,
  type LoadedMindMaintenancePilotDataset,
} from '../mind-maintenance-pilot/pilot-file-loader.js';

function createDataset(): LoadedMindMaintenancePilotDataset {
  const contents: Record<(typeof MIND_MAINTENANCE_PILOT_FILES)[number], string> = {
    'router/00-current-context.md': `---
status: review-needed
last_reviewed: 2026-05-22
review_after: 2026-06-05
freshness_risk: high
---
# Current Context
`,
    'live/projects/prochat-qa-memory/STRATEGY-PLAN.md': `# QA Memory Strategy

Status: draft
Last reviewed: 2026-06-13
Review after: 2026-07-13
Freshness risk: medium
`,
    'wiki/organisations/prochat/brand/prochat-os-strategy.md': `# ProChat OS Strategy

Status: current
Last reviewed: 2026-06-13
Review after: 2026-07-13
Freshness risk: high
`,
    'live/dashboard.md': `# Dashboard

Status: current
Primary interface: Brain Console
`,
    'system/automation-roadmap.md': `# Automation Roadmap

Status: active

## Foundation — completed

## Report writer — remaining
`,
  };

  return {
    mindRoot: '/tmp/mind',
    files: MIND_MAINTENANCE_PILOT_FILES.map((filePath) => ({
      path: filePath,
      absolutePath: `/tmp/mind/${filePath}`,
      content: contents[filePath],
    })),
  };
}

test('builds the canonical in-memory five-file pilot report', () => {
  const result = buildMindMaintenancePilotReport({
    dataset: createDataset(),
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
  });

  assert.equal(result.report.mode, 'report-only');
  assert.equal(result.report.noWritePerformed, true);
  assert.equal(result.report.sourceCommit, 'abc1234');
  assert.equal(result.report.summary.filesConsidered, 5);
  assert.equal(result.report.summary.findingsTotal, 1);
  assert.equal(result.report.summary.findingsOpen, 1);
  assert.equal(result.report.summary.detectorErrors, 0);
  assert.equal(result.report.findings[0]?.type, 'stale-page');
  assert.equal(result.report.findings[0]?.paths[0], 'router/00-current-context.md');
  assert.equal(result.report.detectors['duplicate-candidate'].status, 'completed');
  assert.equal(result.report.detectors['contradiction-candidate'].status, 'completed');
  assert.equal(result.report.detectors['capture-promotion'].status, 'completed');
  assert.equal(result.report.safety.sourceFilesChanged, 0);
  assert.deepEqual(result.ambiguousSourceGapCandidates, []);
  assert.deepEqual(result.excludedSourceGapCandidates, []);
});

test('includes a valid source-gap finding and keeps summary counts aligned', () => {
  const dataset = createDataset();
  const strategyPath = 'wiki/organisations/prochat/brand/prochat-os-strategy.md' as const;
  const result = buildMindMaintenancePilotReport({
    dataset,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    sourceGapCandidates: {
      [strategyPath]: [
        {
          path: strategyPath,
          location: 'Market position section',
          claim: 'ProChat OS is the most widely adopted AI operating system in its market.',
          kind: 'external-factual',
          impact: 'high',
          presentedAsCurrentTruth: true,
          provenance: [],
        },
      ],
    },
  });

  assert.equal(result.report.summary.findingsTotal, 2);
  assert.equal(result.report.summary.findingsOpen, 2);
  assert.deepEqual(
    result.report.findings.map((finding) => finding.type).sort(),
    ['source-gap', 'stale-page'],
  );
});

test('preserves ambiguous source-gap candidates without creating findings', () => {
  const dataset = createDataset();
  const strategyPath = 'wiki/organisations/prochat/brand/prochat-os-strategy.md' as const;
  const result = buildMindMaintenancePilotReport({
    dataset,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    sourceGapCandidates: {
      [strategyPath]: [
        {
          path: strategyPath,
          location: 'Positioning',
          claim: 'ProChat OS is becoming the standard operating layer for AI work.',
          kind: 'ambiguous',
          impact: 'high',
          presentedAsCurrentTruth: true,
          provenance: [],
        },
      ],
    },
  });

  assert.equal(result.report.summary.findingsTotal, 1);
  assert.equal(result.ambiguousSourceGapCandidates.length, 1);
  assert.equal(result.excludedSourceGapCandidates.length, 0);
});

test('marks detector failures explicitly while preserving other findings', () => {
  const result = buildMindMaintenancePilotReport({
    dataset: createDataset(),
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    detectorErrors: [
      {
        detector: 'source-gap',
        path: 'wiki/organisations/prochat/brand/prochat-os-strategy.md',
        errorType: 'timeout',
        summary: 'Source-gap semantic review exceeded its bounded execution time.',
        retryable: true,
      },
    ],
  });

  assert.equal(result.report.detectors['source-gap'].status, 'failed');
  assert.equal(result.report.summary.detectorErrors, 1);
  assert.equal(result.report.summary.findingsTotal, 1);
  assert.equal(result.report.findings[0]?.type, 'stale-page');
});

test('rejects missing, duplicate, or incomplete pilot datasets', () => {
  const missing = createDataset();
  missing.files = missing.files.slice(0, 4);
  assert.throws(
    () => buildMindMaintenancePilotReport({
      dataset: missing,
      sourceCommit: 'abc1234',
      generatedAt: '2026-06-13T12:00:00Z',
    }),
    /exactly 5 files/i,
  );

  const duplicate = createDataset();
  duplicate.files[4] = duplicate.files[0]!;
  assert.throws(
    () => buildMindMaintenancePilotReport({
      dataset: duplicate,
      sourceCommit: 'abc1234',
      generatedAt: '2026-06-13T12:00:00Z',
    }),
    /duplicate paths|missing required path/i,
  );
});

test('rejects empty source commits and invalid timestamps', () => {
  assert.throws(
    () => buildMindMaintenancePilotReport({
      dataset: createDataset(),
      sourceCommit: '   ',
      generatedAt: '2026-06-13T12:00:00Z',
    }),
    /source commit/i,
  );

  assert.throws(
    () => buildMindMaintenancePilotReport({
      dataset: createDataset(),
      sourceCommit: 'abc1234',
      generatedAt: 'not-a-date',
    }),
    /generatedAt timestamp/i,
  );
});




test('applies an accepted persisted decision and recalculates summary counts', () => {
  const decisionDocument = {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-13T12:00:00.000Z',
    decisions: [{
      findingId: 'finding-stale-page-router-00-current-context-001',
      deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
      sourceReportId: 'mind-maintenance-20260613T110000Z',
      sourceCommit: 'previous1',
      reviewedBy: 'Steve Westhoek',
      reviewedAt: '2026-06-13T11:30:00.000Z',
      decision: 'accepted',
      reason: 'The review date elapsed and the page requires review.',
      nextAction: 'Review the page.',
      resolutionRef: null,
      suppressionUntil: null,
    }],
  } satisfies import('../mind-maintenance-pilot/finding-decision-store.js').MaintenanceFindingDecisionDocument;

  const result = buildMindMaintenancePilotReport({
    dataset: createDataset(),
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    decisionDocument,
  });

  assert.equal(result.report.summary.findingsTotal, 1);
  assert.equal(result.report.summary.findingsOpen, 0);
  assert.equal(result.report.summary.findingsAccepted, 1);
  assert.equal(result.report.summary.findingsSuppressed, 0);
  assert.equal(result.report.findings[0]?.status, 'accepted');
  assert.equal(result.report.findings[0]?.review?.decision, 'accepted');
  assert.deepEqual(result.unmatchedDecisions, []);
});

test('moves dismissed findings into suppression and keeps report counts aligned', () => {
  const decisionDocument = {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-13T12:00:00.000Z',
    decisions: [{
      findingId: 'finding-stale-page-router-00-current-context-001',
      deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
      sourceReportId: 'mind-maintenance-20260613T110000Z',
      sourceCommit: 'previous1',
      reviewedBy: 'Steve Westhoek',
      reviewedAt: '2026-06-13T11:30:00.000Z',
      decision: 'dismissed',
      reason: 'The content is intentionally retained.',
      nextAction: '',
      resolutionRef: null,
      suppressionUntil: '2026-07-01',
    }],
  } satisfies import('../mind-maintenance-pilot/finding-decision-store.js').MaintenanceFindingDecisionDocument;

  const result = buildMindMaintenancePilotReport({
    dataset: createDataset(),
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    decisionDocument,
  });

  assert.equal(result.report.summary.findingsTotal, 0);
  assert.equal(result.report.summary.findingsOpen, 0);
  assert.equal(result.report.summary.findingsDismissed, 0);
  assert.equal(result.report.summary.findingsSuppressed, 1);
  assert.equal(result.report.findings.length, 0);
  assert.equal(result.report.suppressedFindings[0]?.status, 'dismissed');
});

test('reopens resolved recurrence and exposes unmatched historical decisions', () => {
  const decisionDocument = {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-13T12:00:00.000Z',
    decisions: [
      {
        findingId: 'finding-stale-page-router-00-current-context-001',
        deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
        sourceReportId: 'mind-maintenance-20260601T110000Z',
        sourceCommit: 'previous1',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-01T11:30:00.000Z',
        decision: 'resolved',
        reason: 'The page was reviewed previously.',
        nextAction: '',
        resolutionRef: 'mind:old1234',
        suppressionUntil: null,
      },
      {
        findingId: 'finding-source-gap-unused-001',
        deduplicationKey: 'source-gap:wiki/unused.md:claim',
        sourceReportId: 'mind-maintenance-20260601T110000Z',
        sourceCommit: 'previous1',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-01T11:30:00.000Z',
        decision: 'dismissed',
        reason: 'Historical decision for a finding not present in this run.',
        nextAction: '',
        resolutionRef: null,
        suppressionUntil: null,
      },
    ],
  } satisfies import('../mind-maintenance-pilot/finding-decision-store.js').MaintenanceFindingDecisionDocument;

  const result = buildMindMaintenancePilotReport({
    dataset: createDataset(),
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    decisionDocument,
  });

  assert.equal(result.report.summary.findingsTotal, 1);
  assert.equal(result.report.summary.findingsOpen, 1);
  assert.equal(result.report.findings[0]?.status, 'open');
  assert.equal(result.report.findings[0]?.review, null);
  assert.equal(result.unmatchedDecisions.length, 1);
  assert.equal(result.unmatchedDecisions[0]?.findingId, 'finding-source-gap-unused-001');
});




test('reports exact normalized duplicate-page candidates without writing source files', () => {
  const dataset = createDataset();
  const first = dataset.files.find((file) => file.path === 'live/dashboard.md');
  const second = dataset.files.find((file) => file.path === 'system/automation-roadmap.md');

  assert.ok(first);
  assert.ok(second);

  first.content = `---
status: current
---
# Dashboard

This substantive page content is intentionally repeated for duplicate detection. It contains enough detail to exceed the conservative minimum comparison length and should produce exactly one report-only duplicate candidate finding.
`;
  second.content = `---
status: active
---
# Automation Roadmap

This substantive page content is intentionally repeated for duplicate detection. It contains enough detail to exceed the conservative minimum comparison length and should produce exactly one report-only duplicate candidate finding.
`;

  const result = buildMindMaintenancePilotReport({
    dataset,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
  });

  const duplicateFindings = result.report.findings.filter(
    (finding) => finding.type === 'duplicate-candidate',
  );

  assert.equal(duplicateFindings.length, 1);
  assert.deepEqual(duplicateFindings[0]?.paths, ['live/dashboard.md', 'system/automation-roadmap.md']);
  assert.equal(duplicateFindings[0]?.requiresApproval, true);
  assert.equal(duplicateFindings[0]?.noWritePerformed, true);
  assert.equal(result.report.safety.sourceFilesChanged, 0);
});




test('reports explicit mutually exclusive contradiction candidates without writing source files', () => {
  const dataset = createDataset();
  const result = buildMindMaintenancePilotReport({
    dataset,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    contradictionCandidates: [
      {
        left: {
          path: 'live/dashboard.md',
          location: 'Primary interface line',
          statement: 'Primary interface: Brain Console',
          authority: 'current live dashboard',
          scope: 'daily operating interface',
          sourceReferences: [],
        },
        right: {
          path: 'system/automation-roadmap.md',
          location: 'Interface decision line',
          statement: 'Primary interface: Obsidian only',
          authority: 'canonical automation roadmap',
          scope: 'daily operating interface',
          sourceReferences: [],
        },
        mutuallyExclusive: true,
        explanation: 'Both claims assign different exclusive primary interfaces to the same operating scope.',
      },
      {
        left: {
          path: 'live/dashboard.md',
          location: 'Primary interface line',
          statement: 'Primary interface: Brain Console',
          authority: 'current live dashboard',
          scope: 'daily operating interface',
          sourceReferences: [],
        },
        right: {
          path: 'router/00-current-context.md',
          location: 'Context purpose line',
          statement: 'Agents should read this early.',
          authority: 'current routing context',
          scope: 'AI session startup',
          sourceReferences: [],
        },
        mutuallyExclusive: false,
        explanation: 'The statements apply to different scopes and can coexist.',
      },
    ],
  });

  const contradictionFindings = result.report.findings.filter(
    (finding) => finding.type === 'contradiction-candidate',
  );

  assert.equal(result.report.detectors['contradiction-candidate'].status, 'completed');
  assert.equal(contradictionFindings.length, 1);
  assert.deepEqual(contradictionFindings[0]?.paths, [
    'live/dashboard.md',
    'system/automation-roadmap.md',
  ]);
  assert.equal(contradictionFindings[0]?.matchedEvidence.length, 2);
  assert.equal(contradictionFindings[0]?.comparisonEvidence.length, 2);
  assert.equal(contradictionFindings[0]?.requiresApproval, true);
  assert.equal(contradictionFindings[0]?.noWritePerformed, true);
  assert.equal(result.report.safety.sourceFilesChanged, 0);
});




test('reports durable insights trapped in capture with duplicate-check evidence and no writes', () => {
  const result = buildMindMaintenancePilotReport({
    dataset: createDataset(),
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    capturePromotionCandidates: [
      {
        capturePath: 'capture/inbox/reusable-qa-lesson.md',
        location: 'lesson paragraph',
        summary: 'Repeated QA investigation lesson.',
        reusableInsight: 'Record recurring failure patterns once and reuse them across projects.',
        classification: 'lesson',
        confidence: 0.92,
        captureAgeDays: 45,
        priorReferenceCount: 2,
        repeatedConceptCount: 3,
        duplicateCheck: {
          matched: true,
          paths: ['live/projects/prochat-qa-memory/STRATEGY-PLAN.md'],
          summary: 'Related strategy exists and should be updated rather than duplicated.',
        },
        recommendedDestination: 'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
        recommendation: 'update-existing',
      },
      {
        capturePath: 'capture/inbox/private-reflection.md',
        location: 'reflection paragraph',
        summary: 'Temporary private reflection.',
        reusableInsight: 'Personal note not intended for durable promotion.',
        classification: 'personal',
        confidence: 0.95,
        captureAgeDays: 90,
        priorReferenceCount: 4,
        repeatedConceptCount: 4,
        duplicateCheck: {
          matched: false,
          paths: [],
          summary: 'No durable duplicate found.',
        },
        recommendedDestination: 'wiki/personal/private-reflection.md',
        recommendation: 'create-new',
      },
    ],
  });

  const findings = result.report.findings.filter((finding) => finding.type === 'capture-promotion');

  assert.equal(result.report.detectors['capture-promotion'].status, 'completed');
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0]?.paths, [
    'capture/inbox/reusable-qa-lesson.md',
    'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
  ]);
  assert.match(findings[0]?.comparisonEvidence[0]?.summary ?? '', /Matching durable content found/);
  assert.match(findings[0]?.recommendedAction ?? '', /Update the reviewed existing page/);
  assert.equal(findings[0]?.requiresApproval, true);
  assert.equal(findings[0]?.noWritePerformed, true);
  assert.equal(result.report.safety.sourceFilesChanged, 0);
});
