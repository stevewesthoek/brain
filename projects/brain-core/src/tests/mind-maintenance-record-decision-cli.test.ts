import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  runMindMaintenancePilotCli,
  type MindMaintenancePilotCliDependencies,
} from '../bin/mind-maintenance-pilot.js';

interface CapturedIo {
  stdout: string[];
  stderr: string[];
  io: {
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  };
}

function createIo(): CapturedIo {
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
    now: () => new Date('2026-06-16T12:00:00.000Z'),
    resolveMindRoot: (value) => path.resolve(value),
    resolveSourceCommit: async () => 'unused',
    listChangedPaths: async () => [],
    runPilot: async () => {
      throw new Error('record-decision must not run the report pilot');
    },
    ...overrides,
  };
}

function baseArguments(mindRoot: string): string[] {
  return [
    'record-decision',
    '--mind-root', mindRoot,
    '--finding-id', 'finding-stale-page-router-00-current-context-001',
    '--deduplication-key', 'stale-page:router/00-current-context.md:review_after',
    '--source-report', 'mind-maintenance-20260614T103145Z',
    '--source-commit', 'c60f7f8',
    '--reviewer', 'Steve Westhoek',
    '--reviewed-at', '2026-06-14T11:04:45.000Z',
    '--decision', 'accepted',
    '--reason', 'The review date elapsed and the page requires review.',
    '--next-action', 'Review the page.',
  ];
}

async function listReportFiles(mindRoot: string): Promise<string[]> {
  const reportDirectory = path.join(mindRoot, 'system/reports');
  try {
    return (await readdir(reportDirectory)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

test('creates and atomically writes the canonical decision file', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-record-decision-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  const captured = createIo();

  const result = await runMindMaintenancePilotCli(
    baseArguments(mindRoot),
    captured.io,
    createDependencies(),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(captured.stderr.length, 0);
  const output = JSON.parse(captured.stdout.join('')) as {
    ok: boolean;
    status: string;
    operation: string;
    decisionPath: string;
    decisionCount: number;
  };
  assert.deepEqual(
    {
      ok: output.ok,
      status: output.status,
      operation: output.operation,
      decisionCount: output.decisionCount,
    },
    { ok: true, status: 'recorded', operation: 'created', decisionCount: 1 },
  );
  assert.equal(
    output.decisionPath,
    path.join(mindRoot, 'system/reports/maintenance-decisions.json'),
  );

  const document = JSON.parse(await readFile(output.decisionPath, 'utf8')) as {
    updatedAt: string;
    decisions: Array<{
      findingId: string;
      decision: string;
      nextAction: string;
    }>;
  };
  assert.equal(document.updatedAt, '2026-06-16T12:00:00.000Z');
  assert.deepEqual(document.decisions, [{
    findingId: 'finding-stale-page-router-00-current-context-001',
    deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
    sourceReportId: 'mind-maintenance-20260614T103145Z',
    sourceCommit: 'c60f7f8',
    reviewedBy: 'Steve Westhoek',
    reviewedAt: '2026-06-14T11:04:45.000Z',
    decision: 'accepted',
    reason: 'The review date elapsed and the page requires review.',
    nextAction: 'Review the page.',
    resolutionRef: null,
    suppressionUntil: null,
  }]);
  assert.deepEqual(await listReportFiles(mindRoot), ['maintenance-decisions.json']);
});

test('replaces recurring decisions by deduplication key', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-record-decision-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const first = await runMindMaintenancePilotCli(
    baseArguments(mindRoot),
    createIo().io,
    createDependencies(),
  );
  assert.equal(first.exitCode, 0);

  const captured = createIo();
  const replacementArguments = [
    ...baseArguments(mindRoot),
  ];
  replacementArguments[replacementArguments.indexOf('--finding-id') + 1] =
    'finding-stale-page-router-00-current-context-002';
  replacementArguments[replacementArguments.indexOf('--source-report') + 1] =
    'mind-maintenance-20260701T090000Z';
  replacementArguments[replacementArguments.indexOf('--source-commit') + 1] = 'def5678';
  replacementArguments[replacementArguments.indexOf('--reviewed-at') + 1] =
    '2026-06-16T11:30:00.000Z';
  replacementArguments[replacementArguments.indexOf('--decision') + 1] = 'dismissed';
  replacementArguments[replacementArguments.indexOf('--reason') + 1] =
    'The content is intentionally retained for this review window.';
  replacementArguments.splice(replacementArguments.indexOf('--next-action'), 2);
  replacementArguments.push('--suppression-until', '2026-07-16');

  const result = await runMindMaintenancePilotCli(
    replacementArguments,
    captured.io,
    createDependencies(),
  );

  assert.equal(result.exitCode, 0);
  const output = JSON.parse(captured.stdout.join('')) as {
    operation: string;
    replacedFindingId: string | null;
    decisionCount: number;
  };
  assert.equal(output.operation, 'replaced');
  assert.equal(output.replacedFindingId, 'finding-stale-page-router-00-current-context-001');
  assert.equal(output.decisionCount, 1);

  const document = JSON.parse(
    await readFile(path.join(mindRoot, 'system/reports/maintenance-decisions.json'), 'utf8'),
  ) as { decisions: Array<{ findingId: string; decision: string; suppressionUntil: string }> };
  assert.deepEqual(document.decisions, [{
    findingId: 'finding-stale-page-router-00-current-context-002',
    deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
    sourceReportId: 'mind-maintenance-20260701T090000Z',
    sourceCommit: 'def5678',
    reviewedBy: 'Steve Westhoek',
    reviewedAt: '2026-06-16T11:30:00.000Z',
    decision: 'dismissed',
    reason: 'The content is intentionally retained for this review window.',
    nextAction: '',
    resolutionRef: null,
    suppressionUntil: '2026-07-16',
  }]);
});

test('enforces accepted, resolved, and dismissed decision-specific arguments', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-record-decision-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const acceptedMissingAction = baseArguments(mindRoot);
  acceptedMissingAction.splice(acceptedMissingAction.indexOf('--next-action'), 2);

  const resolvedMissingReference = baseArguments(mindRoot);
  resolvedMissingReference[resolvedMissingReference.indexOf('--decision') + 1] = 'resolved';
  resolvedMissingReference.splice(resolvedMissingReference.indexOf('--next-action'), 2);

  const dismissedWithReference = baseArguments(mindRoot);
  dismissedWithReference[dismissedWithReference.indexOf('--decision') + 1] = 'dismissed';
  dismissedWithReference.splice(dismissedWithReference.indexOf('--next-action'), 2);
  dismissedWithReference.push('--resolution-ref', 'mind:abc1234');

  const acceptedWithSuppression = baseArguments(mindRoot);
  acceptedWithSuppression.push('--suppression-until', '2026-07-16');

  const cases: Array<[string[], RegExp]> = [
    [acceptedMissingAction, /--next-action is required/i],
    [resolvedMissingReference, /--resolution-ref is required/i],
    [dismissedWithReference, /--resolution-ref is not valid/i],
    [acceptedWithSuppression, /--suppression-until is only valid/i],
  ];

  for (const [args, expected] of cases) {
    const captured = createIo();
    const result = await runMindMaintenancePilotCli(args, captured.io, createDependencies());
    assert.equal(result.exitCode, 1);
    assert.match(captured.stderr.join(''), expected);
  }

  const resolved = baseArguments(mindRoot);
  resolved[resolved.indexOf('--decision') + 1] = 'resolved';
  resolved.splice(resolved.indexOf('--next-action'), 2);
  resolved.push('--resolution-ref', 'mind:b77f203');
  const resolvedResult = await runMindMaintenancePilotCli(
    resolved,
    createIo().io,
    createDependencies(),
  );
  assert.equal(resolvedResult.exitCode, 0);
});

test('rejects an invalid existing decision file without overwriting it', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-record-decision-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(decisionPath, '{ invalid json', 'utf8');
  const captured = createIo();

  const result = await runMindMaintenancePilotCli(
    baseArguments(mindRoot),
    captured.io,
    createDependencies(),
  );

  assert.equal(result.exitCode, 1);
  assert.match(captured.stderr.join(''), /decision-record-failed/i);
  assert.match(captured.stderr.join(''), /invalid JSON/i);
  assert.equal(await readFile(decisionPath, 'utf8'), '{ invalid json');
  assert.deepEqual(await listReportFiles(mindRoot), ['maintenance-decisions.json']);
});
