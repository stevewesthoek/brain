import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runMindMaintenancePilot } from '../mind-maintenance-pilot/pilot-runner.js';
import { MIND_MAINTENANCE_PILOT_FILES } from '../mind-maintenance-pilot/pilot-file-loader.js';

async function createMindFixture(): Promise<string> {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-runner-'));
  const contents: Record<string, string> = {
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
    'wiki/organisations/prochat/brand/product-strategy.md': `# ProChat OS Strategy

Status: current
Last reviewed: 2026-06-13
Review after: 2026-07-13
Freshness risk: high
`,
    'live/dashboard.md': '# Dashboard\n\nStatus: current\n',
    'system/automation-roadmap.md': '# Automation Roadmap\n\nStatus: active\n',
  };

  for (const relativePath of MIND_MAINTENANCE_PILOT_FILES) {
    const absolutePath = path.join(mindRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents[relativePath] ?? '', 'utf8');
  }

  await writeFile(path.join(mindRoot, 'kanban.md'), '# Kanban\n', 'utf8');
  return mindRoot;
}

function changedPathSequence(...states: readonly string[][]): () => Promise<readonly string[]> {
  let index = 0;
  return async () => {
    const state = states[Math.min(index, states.length - 1)] ?? [];
    index += 1;
    return state;
  };
}

test('stays disabled by default and performs no reads or writes', async () => {
  let changedPathCalls = 0;
  const result = await runMindMaintenancePilot({
    enabled: false,
    mindRoot: '/does/not/need/to/exist',
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: async () => {
      changedPathCalls += 1;
      return [];
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'disabled');
  assert.equal(result.mode, 'report-only');
  assert.equal(changedPathCalls, 0);
});

test('runs the bounded pilot and writes only the two latest reports', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const result = await runMindMaintenancePilot({
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: changedPathSequence(
      [],
      [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
    ),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.status, 'completed');
  assert.equal(result.mode, 'report-only');
  assert.equal(result.filesConsidered, 5);
  assert.equal(result.findingsTotal, 1);
  assert.equal(result.detectorErrors, 0);
  assert.equal(result.sourceFilesChanged, 0);
  assert.equal(result.integrity.ok, true);
  assert.equal(result.reports.length, 2);

  const json = JSON.parse(
    await readFile(path.join(mindRoot, 'system/reports/maintenance-latest.json'), 'utf8'),
  ) as { reportId: string; findings: Array<{ type: string }> };
  const markdown = await readFile(
    path.join(mindRoot, 'system/reports/maintenance-latest.md'),
    'utf8',
  );

  assert.equal(json.reportId, result.reportId);
  assert.equal(json.findings[0]?.type, 'stale-page');
  assert.match(markdown, new RegExp(result.reportId));
  assert.match(markdown, /Writes performed:\*\* none/);
});

test('does not attribute pre-existing dirty paths to the pilot', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const preExisting = ['kanban.md', 'wiki/log.md'];
  const result = await runMindMaintenancePilot({
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: changedPathSequence(
      preExisting,
      [
        ...preExisting,
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
    ),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.integrity.unexpectedChangedPaths, []);
  assert.deepEqual(result.integrity.changedSourcePaths, []);
});

test('returns integrity-failed when the run introduces an unexpected changed path', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const result = await runMindMaintenancePilot({
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: changedPathSequence(
      [],
      [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
        'wiki/unexpected-change.md',
      ],
    ),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'integrity-failed');
  if (result.ok || result.status !== 'integrity-failed') return;
  assert.equal(result.integrity?.ok, false);
  assert.deepEqual(result.integrity?.unexpectedChangedPaths, ['wiki/unexpected-change.md']);
  if (result.integrity?.changedSourcePaths.includes(
    'system/reports/maintenance-decisions.json',
  )) {
    assert.match(result.error, /decision file changed during a report-only run/i);
    assert.match(result.nextAction, /maintenance-decisions\.json/i);
    assert.match(result.nextAction, /discard the generated reports/i);
  } else {
    assert.match(result.error, /protected source change/i);
    assert.match(result.nextAction, /Inspect integrity failures/i);
  }
});

test('preserves structured detector failures in the completed report', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const result = await runMindMaintenancePilot({
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    detectorErrors: [
      {
        detector: 'source-gap',
        path: 'wiki/organisations/prochat/brand/product-strategy.md',
        errorType: 'timeout',
        summary: 'Source-gap semantic review exceeded its bounded execution time.',
        retryable: true,
      },
    ],
    listChangedPaths: changedPathSequence(
      [],
      [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
    ),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.detectorErrors, 1);
  assert.equal(result.findingsTotal, 1);
});




test('loads persisted dismissal decisions without modifying the decision file', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  await mkdir(path.dirname(decisionPath), { recursive: true });
  const decisionContent = `${JSON.stringify({
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-13T11:30:00.000Z',
    decisions: [{
      findingId: 'finding-stale-page-router-00-current-context-001',
      deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
      sourceReportId: 'mind-maintenance-20260613T110000Z',
      sourceCommit: 'previous1',
      reviewedBy: 'Steve Westhoek',
      reviewedAt: '2026-06-13T11:30:00.000Z',
      decision: 'dismissed',
      reason: 'The content is intentionally retained for this review window.',
      nextAction: '',
      resolutionRef: null,
      suppressionUntil: '2026-07-01',
    }],
  }, null, 2)}\n`;
  await writeFile(decisionPath, decisionContent, 'utf8');

  const result = await runMindMaintenancePilot({
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: changedPathSequence(
      [],
      [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
    ),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.findingsTotal, 0);

  const report = JSON.parse(
    await readFile(path.join(mindRoot, 'system/reports/maintenance-latest.json'), 'utf8'),
  ) as {
    findings: unknown[];
    suppressedFindings: Array<{ status: string; suppressionUntil: string | null }>;
    summary: { findingsSuppressed: number };
  };
  assert.equal(report.findings.length, 0);
  assert.equal(report.suppressedFindings[0]?.status, 'dismissed');
  assert.equal(report.suppressedFindings[0]?.suppressionUntil, '2026-07-01');
  assert.equal(report.summary.findingsSuppressed, 1);
  assert.equal(await readFile(decisionPath, 'utf8'), decisionContent);
});

test('returns a structured failure for an invalid decision file without writing reports', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(decisionPath, '{ invalid json', 'utf8');

  const result = await runMindMaintenancePilot({
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: changedPathSequence([]),
  });

  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected decision-load-failed result.');
  assert.equal(result.status, 'decision-load-failed');
  assert.match(result.error, /invalid JSON/i);
  await assert.rejects(
    readFile(path.join(mindRoot, 'system/reports/maintenance-latest.json'), 'utf8'),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    readFile(path.join(mindRoot, 'system/reports/maintenance-latest.md'), 'utf8'),
    { code: 'ENOENT' },
  );
});




test('returns integrity-failed when the decision file mutates during a report-only run', async (context) => {
  const mindRoot = await createMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  const { writeFileSync } = await import('node:fs');
  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(
    decisionPath,
    `${JSON.stringify({
      schemaVersion: '1.0',
      sourceRepo: 'mind',
      updatedAt: '2026-06-13T11:30:00.000Z',
      decisions: [],
    }, null, 2)}\n`,
    'utf8',
  );

  const input: Parameters<typeof runMindMaintenancePilot>[0] = {
    enabled: true,
    mindRoot,
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-13T12:00:00Z',
    listChangedPaths: changedPathSequence(
      [],
      [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
    ),
  };
  let mutated = false;
  Object.defineProperty(input, 'sourceGapCandidates', {
    enumerable: true,
    get: () => {
      if (!mutated) {
        mutated = true;
        writeFileSync(
          decisionPath,
          `${JSON.stringify({
            schemaVersion: '1.0',
            sourceRepo: 'mind',
            updatedAt: '2026-06-13T11:45:00.000Z',
            decisions: [],
          }, null, 2)}\n`,
        );
      }
      return undefined;
    },
  });

  const result = await runMindMaintenancePilot(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'integrity-failed');
  if (result.ok || result.status !== 'integrity-failed') return;
  assert.equal(result.integrity?.ok, false);
  assert.deepEqual(result.integrity?.changedSourcePaths, [
    'system/reports/maintenance-decisions.json',
  ]);
  assert.deepEqual(result.integrity?.unexpectedChangedPaths, []);
  if (result.integrity?.changedSourcePaths.includes(
    'system/reports/maintenance-decisions.json',
  )) {
    assert.match(result.error, /decision file changed during a report-only run/i);
    assert.match(result.nextAction, /maintenance-decisions\.json/i);
    assert.match(result.nextAction, /discard the generated reports/i);
  } else {
    assert.match(result.error, /protected source change/i);
    assert.match(result.nextAction, /Inspect integrity failures/i);
  }
});
