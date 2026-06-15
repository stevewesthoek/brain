import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  runMindMaintenancePilotCli,
  type MindMaintenancePilotCliDependencies,
} from '../bin/mind-maintenance-pilot.js';

const cliPath = fileURLToPath(new URL('../bin/mind-maintenance-pilot.js', import.meta.url));

function createIo(): {
  stdout: string[];
  stderr: string[];
  io: {
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  };
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  };
}

function createDependencies(
  overrides: Partial<MindMaintenancePilotCliDependencies> = {},
): MindMaintenancePilotCliDependencies {
  return {
    now: () => new Date('2026-06-15T09:30:00.000Z'),
    resolveMindRoot: (value) => path.resolve(value),
    resolveSourceCommit: async () => {
      throw new Error('validate-decisions must not resolve Git HEAD');
    },
    listChangedPaths: async () => {
      throw new Error('validate-decisions must not inspect Git changes');
    },
    runPilot: async () => {
      throw new Error('validate-decisions must not run detectors');
    },
    writeDecisionDocument: async () => {
      throw new Error('validate-decisions must not write the decision file');
    },
    recordDecision: () => {
      throw new Error('validate-decisions must not record a decision');
    },
    ...overrides,
  };
}

function runCompiledCli(args: readonly string[]): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

test('validates and summarizes decisions without running detectors or writers', async () => {
  const captured = createIo();
  let loadedRoot = '';
  let missingTimestamp = '';
  const result = await runMindMaintenancePilotCli(
    ['validate-decisions', '--mind-root', '/mind'],
    captured.io,
    createDependencies({
      loadDecisionDocument: async (mindRoot, options) => {
        loadedRoot = mindRoot;
        missingTimestamp = options.whenMissingUpdatedAt;
        return {
          schemaVersion: '1.0',
          sourceRepo: 'mind',
          updatedAt: '2026-06-15T09:00:00.000Z',
          decisions: [
            {
              findingId: 'accepted-1',
              deduplicationKey: 'accepted:key',
              sourceReportId: 'report-1',
              sourceCommit: 'abc1234',
              reviewedBy: 'Steve Westhoek',
              reviewedAt: '2026-06-15T08:00:00.000Z',
              decision: 'accepted',
              reason: 'Valid concern.',
              nextAction: 'Review it.',
              resolutionRef: null,
              suppressionUntil: null,
            },
            {
              findingId: 'dismissed-1',
              deduplicationKey: 'dismissed:key',
              sourceReportId: 'report-1',
              sourceCommit: 'abc1234',
              reviewedBy: 'Steve Westhoek',
              reviewedAt: '2026-06-15T08:10:00.000Z',
              decision: 'dismissed',
              reason: 'Intentional state.',
              nextAction: '',
              resolutionRef: null,
              suppressionUntil: '2026-07-15',
            },
            {
              findingId: 'resolved-1',
              deduplicationKey: 'resolved:key',
              sourceReportId: 'report-1',
              sourceCommit: 'abc1234',
              reviewedBy: 'Steve Westhoek',
              reviewedAt: '2026-06-15T08:20:00.000Z',
              decision: 'resolved',
              reason: 'Reviewed and updated.',
              nextAction: '',
              resolutionRef: 'mind:def5678',
              suppressionUntil: null,
            },
          ],
        };
      },
    }),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(captured.stderr.length, 0);
  assert.equal(loadedRoot, path.resolve('/mind'));
  assert.equal(missingTimestamp, '2026-06-15T09:30:00.000Z');
  const output = JSON.parse(captured.stdout.join('')) as {
    ok: boolean;
    status: string;
    mode: string;
    decisionPath: string;
    decisionCount: number;
    counts: { accepted: number; dismissed: number; resolved: number };
  };
  assert.deepEqual(output, {
    ok: true,
    status: 'decision-summary',
    mode: 'read-only',
    decisionPath: path.join(path.resolve('/mind'), 'system/reports/maintenance-decisions.json'),
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-15T09:00:00.000Z',
    decisionCount: 3,
    counts: { accepted: 1, dismissed: 1, resolved: 1 },
  });
});

test('prints structured validation failure and rejects unsupported options', async () => {
  const failed = createIo();
  const failedResult = await runMindMaintenancePilotCli(
    ['validate-decisions', '--mind-root', '/mind'],
    failed.io,
    createDependencies({
      loadDecisionDocument: async () => {
        throw new Error('Mind maintenance decision file contains invalid JSON.');
      },
    }),
  );
  assert.equal(failedResult.exitCode, 1);
  assert.equal(failed.stdout.length, 0);
  assert.deepEqual(JSON.parse(failed.stderr.join('')), {
    ok: false,
    status: 'decision-summary-failed',
    mode: 'read-only',
    error: 'Mind maintenance decision file contains invalid JSON.',
    nextAction: 'Repair the invalid maintenance decision or latest report file before retrying validation.',
  });

  const invalid = createIo();
  const invalidResult = await runMindMaintenancePilotCli(
    ['validate-decisions', '--mind-root', '/mind', '--source-commit', 'abc1234'],
    invalid.io,
    createDependencies(),
  );
  assert.equal(invalidResult.exitCode, 2);
  assert.match(invalid.stderr.join(''), /accepts only --mind-root/i);
});

test('compiled CLI summarizes a real decision file without modifying it or writing reports', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-validate-decisions-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  await mkdir(path.dirname(decisionPath), { recursive: true });
  const content = `${JSON.stringify({
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-15T09:00:00.000Z',
    decisions: [
      {
        findingId: 'accepted-1',
        deduplicationKey: 'accepted:key',
        sourceReportId: 'report-1',
        sourceCommit: 'abc1234',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-15T08:00:00.000Z',
        decision: 'accepted',
        reason: 'Valid concern.',
        nextAction: 'Review it.',
        resolutionRef: null,
        suppressionUntil: null,
      },
      {
        findingId: 'dismissed-1',
        deduplicationKey: 'dismissed:key',
        sourceReportId: 'report-1',
        sourceCommit: 'abc1234',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-15T08:10:00.000Z',
        decision: 'dismissed',
        reason: 'Intentional state.',
        nextAction: '',
        resolutionRef: null,
        suppressionUntil: '2026-07-15',
      },
    ],
  }, null, 2)}\n`;
  await writeFile(decisionPath, content, 'utf8');

  const result = await runCompiledCli([
    'validate-decisions',
    '--mind-root',
    mindRoot,
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout) as {
    status: string;
    mode: string;
    decisionCount: number;
    counts: { accepted: number; dismissed: number; resolved: number };
  };
  assert.equal(output.status, 'decision-summary');
  assert.equal(output.mode, 'read-only');
  assert.equal(output.decisionCount, 2);
  assert.deepEqual(output.counts, { accepted: 1, dismissed: 1, resolved: 0 });
  assert.equal(await readFile(decisionPath, 'utf8'), content);
  await assert.rejects(
    readFile(path.join(mindRoot, 'system/reports/maintenance-latest.json'), 'utf8'),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    readFile(path.join(mindRoot, 'system/reports/maintenance-latest.md'), 'utf8'),
    { code: 'ENOENT' },
  );
});




test('lists only persisted decisions unmatched by visible or suppressed latest-report findings', async () => {
  const captured = createIo();
  const decision = (
    findingId: string,
    deduplicationKey: string,
    reviewedAt: string,
  ) => ({
    findingId,
    deduplicationKey,
    sourceReportId: 'report-1',
    sourceCommit: 'abc1234',
    reviewedBy: 'Steve Westhoek',
    reviewedAt,
    decision: 'accepted' as const,
    reason: 'Reviewed decision.',
    nextAction: 'Review the current finding.',
    resolutionRef: null,
    suppressionUntil: null,
  });
  const decisions = [
    decision('matched-visible', 'visible:key', '2026-06-15T08:00:00.000Z'),
    decision('unmatched-alpha', 'alpha:unmatched', '2026-06-15T08:10:00.000Z'),
    decision('matched-suppressed', 'suppressed:key', '2026-06-15T08:20:00.000Z'),
    decision('unmatched-zeta', 'zeta:unmatched', '2026-06-15T08:30:00.000Z'),
  ];

  const result = await runMindMaintenancePilotCli(
    ['validate-decisions', '--mind-root', '/mind', '--list-unmatched'],
    captured.io,
    createDependencies({
      loadDecisionDocument: async () => ({
        schemaVersion: '1.0',
        sourceRepo: 'mind',
        updatedAt: '2026-06-15T09:00:00.000Z',
        decisions,
      }),
      loadLatestReport: async () => ({
        reportId: 'mind-maintenance-20260615T090000Z',
        findings: [{ deduplicationKey: 'visible:key' }],
        suppressedFindings: [{ deduplicationKey: 'suppressed:key' }],
      } as never),
    }),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(captured.stderr.length, 0);
  const output = JSON.parse(captured.stdout.join('')) as {
    latestReportPath: string;
    latestReportId: string;
    unmatchedDecisionCount: number;
    unmatchedDecisions: Array<{ findingId: string; deduplicationKey: string }>;
  };
  assert.equal(
    output.latestReportPath,
    path.join(path.resolve('/mind'), 'system/reports/maintenance-latest.json'),
  );
  assert.equal(output.latestReportId, 'mind-maintenance-20260615T090000Z');
  assert.equal(output.unmatchedDecisionCount, 2);
  assert.deepEqual(
    output.unmatchedDecisions.map(({ findingId, deduplicationKey }) => ({
      findingId,
      deduplicationKey,
    })),
    [
      { findingId: 'unmatched-alpha', deduplicationKey: 'alpha:unmatched' },
      { findingId: 'unmatched-zeta', deduplicationKey: 'zeta:unmatched' },
    ],
  );
});

test('prints structured read-only failure when the latest report is invalid', async () => {
  const captured = createIo();
  const result = await runMindMaintenancePilotCli(
    ['validate-decisions', '--mind-root', '/mind', '--list-unmatched'],
    captured.io,
    createDependencies({
      loadDecisionDocument: async () => ({
        schemaVersion: '1.0',
        sourceRepo: 'mind',
        updatedAt: '2026-06-15T09:00:00.000Z',
        decisions: [],
      }),
      loadLatestReport: async () => {
        throw new Error('Mind maintenance latest report contains invalid JSON.');
      },
    }),
  );

  assert.equal(result.exitCode, 1);
  assert.equal(captured.stdout.length, 0);
  assert.deepEqual(JSON.parse(captured.stderr.join('')), {
    ok: false,
    status: 'decision-summary-failed',
    mode: 'read-only',
    error: 'Mind maintenance latest report contains invalid JSON.',
    nextAction: 'Repair the invalid maintenance decision or latest report file before retrying validation.',
  });
});

test('compiled CLI lists unmatched decisions without changing decisions or latest report bytes', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-list-unmatched-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  const pilotFiles = [
    'router/00-current-context.md',
    'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
    'wiki/organisations/prochat/brand/prochat-os-strategy.md',
    'live/dashboard.md',
    'system/automation-roadmap.md',
  ] as const;
  const contents: Record<(typeof pilotFiles)[number], string> = {
    'router/00-current-context.md': `---
status: review-needed
last_reviewed: 2026-05-22
review_after: 2026-06-05
freshness_risk: high
---
# Current Context
`,
    'live/projects/prochat-qa-memory/STRATEGY-PLAN.md': '# QA Memory Strategy\n\nStatus: draft\n',
    'wiki/organisations/prochat/brand/prochat-os-strategy.md': '# ProChat OS Strategy\n\nStatus: current\n',
    'live/dashboard.md': '# Dashboard\n\nStatus: current\n',
    'system/automation-roadmap.md': '# Automation Roadmap\n\nStatus: active\n',
  };
  for (const relativePath of pilotFiles) {
    const absolutePath = path.join(mindRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents[relativePath], 'utf8');
  }
  await writeFile(path.join(mindRoot, 'kanban.md'), '# Kanban\n', 'utf8');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const runFile = promisify(execFile);
  await runFile('git', ['-C', mindRoot, 'init', '--quiet']);

  const reportRun = await runCompiledCli([
    'run',
    '--enable-report-only',
    '--mind-root',
    mindRoot,
    '--source-commit',
    'abc1234',
    '--generated-at',
    '2026-06-15T09:00:00Z',
  ]);
  assert.equal(reportRun.exitCode, 0, reportRun.stderr);

  const reportPath = path.join(mindRoot, 'system/reports/maintenance-latest.json');
  const reportBefore = await readFile(reportPath, 'utf8');
  const report = JSON.parse(reportBefore) as {
    reportId: string;
    findings: Array<{ deduplicationKey: string }>;
  };
  assert.equal(report.findings.length, 1);
  const matchedKey = report.findings[0]?.deduplicationKey;
  assert.ok(matchedKey);

  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  const decisionBefore = `${JSON.stringify({
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-15T09:30:00.000Z',
    decisions: [
      {
        findingId: 'matched-latest',
        deduplicationKey: matchedKey,
        sourceReportId: report.reportId,
        sourceCommit: 'abc1234',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-15T09:10:00.000Z',
        decision: 'accepted',
        reason: 'Matches the latest visible finding.',
        nextAction: 'Review the finding.',
        resolutionRef: null,
        suppressionUntil: null,
      },
      {
        findingId: 'unmatched-alpha',
        deduplicationKey: 'alpha:historical',
        sourceReportId: 'older-report',
        sourceCommit: 'def5678',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-15T09:20:00.000Z',
        decision: 'accepted',
        reason: 'Historical finding.',
        nextAction: 'Review whether it still matters.',
        resolutionRef: null,
        suppressionUntil: null,
      },
      {
        findingId: 'unmatched-zeta',
        deduplicationKey: 'zeta:historical',
        sourceReportId: 'older-report',
        sourceCommit: 'def5678',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-15T09:25:00.000Z',
        decision: 'accepted',
        reason: 'Another historical finding.',
        nextAction: 'Review whether it still matters.',
        resolutionRef: null,
        suppressionUntil: null,
      },
    ],
  }, null, 2)}\n`;
  await writeFile(decisionPath, decisionBefore, 'utf8');

  const result = await runCompiledCli([
    'validate-decisions',
    '--mind-root',
    mindRoot,
    '--list-unmatched',
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout) as {
    latestReportId: string;
    unmatchedDecisionCount: number;
    unmatchedDecisions: Array<{ findingId: string; deduplicationKey: string }>;
  };
  assert.equal(output.latestReportId, report.reportId);
  assert.equal(output.unmatchedDecisionCount, 2);
  assert.deepEqual(
    output.unmatchedDecisions.map(({ findingId, deduplicationKey }) => ({
      findingId,
      deduplicationKey,
    })),
    [
      { findingId: 'unmatched-alpha', deduplicationKey: 'alpha:historical' },
      { findingId: 'unmatched-zeta', deduplicationKey: 'zeta:historical' },
    ],
  );
  assert.equal(await readFile(decisionPath, 'utf8'), decisionBefore);
  assert.equal(await readFile(reportPath, 'utf8'), reportBefore);
});
