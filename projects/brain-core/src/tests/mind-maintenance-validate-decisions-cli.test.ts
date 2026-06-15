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
    nextAction: 'Repair or remove the invalid maintenance decision file before retrying validation.',
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
