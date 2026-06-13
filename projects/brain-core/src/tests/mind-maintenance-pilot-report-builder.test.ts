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
  assert.equal(result.report.detectors['duplicate-candidate'].status, 'disabled');
  assert.equal(result.report.detectors['contradiction-candidate'].status, 'disabled');
  assert.equal(result.report.detectors['capture-promotion'].status, 'disabled');
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
