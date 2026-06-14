import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runMindMaintenancePilotCli,
  type MindMaintenancePilotCliDependencies,
} from '../bin/mind-maintenance-pilot.js';
import type { MindMaintenancePilotRunnerInput } from '../mind-maintenance-pilot/pilot-runner.js';

interface CapturedIo {
  stdout: string[];
  stderr: string[];
}

function createIo(): CapturedIo & {
  io: {
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  };
} {
  const captured: CapturedIo = { stdout: [], stderr: [] };
  return {
    ...captured,
    io: {
      stdout: (message) => captured.stdout.push(message),
      stderr: (message) => captured.stderr.push(message),
    },
  };
}

function createDependencies(
  overrides: Partial<MindMaintenancePilotCliDependencies> = {},
): MindMaintenancePilotCliDependencies {
  return {
    now: () => new Date('2026-06-13T12:00:00.000Z'),
    resolveMindRoot: (value) => `/resolved/${value}`,
    resolveSourceCommit: async () => 'resolved-commit',
    listChangedPaths: async () => [],
    runPilot: async (input: MindMaintenancePilotRunnerInput) => ({
      ok: true,
      status: 'completed',
      mode: 'report-only',
      reportId: 'mind-maintenance-20260613T120000Z',
      sourceCommit: input.sourceCommit,
      filesConsidered: 5,
      findingsTotal: 1,
      detectorErrors: 0,
      reports: [
        '/resolved/mind/system/reports/maintenance-latest.json',
        '/resolved/mind/system/reports/maintenance-latest.md',
      ],
      sourceFilesChanged: 0,
      integrity: {
        ok: true,
        changedSourcePaths: [],
        allowedOutputPaths: [
          'system/reports/maintenance-latest.json',
          'system/reports/maintenance-latest.md',
        ],
        unexpectedChangedPaths: [],
      },
      nextAction: 'Review the Markdown report.',
    }),
    ...overrides,
  };
}

test('shows help without resolving the repository or running the pilot', async () => {
  const captured = createIo();
  let runCalls = 0;
  const result = await runMindMaintenancePilotCli(
    ['--help'],
    captured.io,
    createDependencies({
      runPilot: async () => {
        runCalls += 1;
        throw new Error('should not run');
      },
    }),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(runCalls, 0);
  assert.match(captured.stdout.join(''), /--enable-report-only/);
  assert.equal(captured.stderr.length, 0);
});

test('refuses to run without the explicit report-only enable flag', async () => {
  const captured = createIo();
  const result = await runMindMaintenancePilotCli(
    ['run', '--mind-root', 'mind'],
    captured.io,
    createDependencies(),
  );

  assert.equal(result.exitCode, 2);
  assert.match(captured.stderr.join(''), /disabled unless --enable-report-only/i);
  assert.equal(captured.stdout.length, 0);
});

test('requires a Mind root and rejects unknown arguments', async () => {
  const missingRoot = createIo();
  const missingRootResult = await runMindMaintenancePilotCli(
    ['run', '--enable-report-only'],
    missingRoot.io,
    createDependencies(),
  );
  assert.equal(missingRootResult.exitCode, 2);
  assert.match(missingRoot.stderr.join(''), /--mind-root is required/i);

  const unknown = createIo();
  const unknownResult = await runMindMaintenancePilotCli(
    ['run', '--enable-report-only', '--mind-root', 'mind', '--write-source'],
    unknown.io,
    createDependencies(),
  );
  assert.equal(unknownResult.exitCode, 2);
  assert.match(unknown.stderr.join(''), /Unknown argument: --write-source/);
});

test('resolves the Mind root and HEAD commit, then prints successful JSON to stdout', async () => {
  const captured = createIo();
  let receivedInput: MindMaintenancePilotRunnerInput | undefined;
  const dependencies = createDependencies({
    runPilot: async (input) => {
      receivedInput = input;
      return {
        ok: true,
        status: 'completed',
        mode: 'report-only',
        reportId: 'mind-maintenance-20260613T120000Z',
        sourceCommit: input.sourceCommit,
        filesConsidered: 5,
        findingsTotal: 1,
        detectorErrors: 0,
        reports: ['/report.json', '/report.md'],
        sourceFilesChanged: 0,
        integrity: {
          ok: true,
          changedSourcePaths: [],
          allowedOutputPaths: [
            'system/reports/maintenance-latest.json',
            'system/reports/maintenance-latest.md',
          ],
          unexpectedChangedPaths: [],
        },
        nextAction: 'Review the Markdown report.',
      };
    },
  });

  const result = await runMindMaintenancePilotCli(
    ['run', '--enable-report-only', '--mind-root', 'mind'],
    captured.io,
    dependencies,
  );

  assert.equal(result.exitCode, 0);
  assert.equal(receivedInput?.enabled, true);
  assert.equal(receivedInput?.mindRoot, '/resolved/mind');
  assert.equal(receivedInput?.sourceCommit, 'resolved-commit');
  assert.equal(receivedInput?.generatedAt, '2026-06-13T12:00:00.000Z');
  assert.equal(captured.stderr.length, 0);

  const output = JSON.parse(captured.stdout.join('')) as { ok: boolean; reportId: string };
  assert.equal(output.ok, true);
  assert.equal(output.reportId, 'mind-maintenance-20260613T120000Z');
});

test('honors explicit source commit and timestamp overrides', async () => {
  const captured = createIo();
  let commitResolutionCalls = 0;
  let receivedInput: MindMaintenancePilotRunnerInput | undefined;
  const dependencies = createDependencies({
    resolveSourceCommit: async () => {
      commitResolutionCalls += 1;
      return 'unexpected';
    },
    runPilot: async (input) => {
      receivedInput = input;
      return {
        ok: false,
        status: 'integrity-failed',
        mode: 'report-only',
        reportId: 'report-id',
        sourceCommit: input.sourceCommit,
        integrity: {
          ok: false,
          changedSourcePaths: ['kanban.md'],
          allowedOutputPaths: [
            'system/reports/maintenance-latest.json',
            'system/reports/maintenance-latest.md',
          ],
          unexpectedChangedPaths: [],
        },
        error: 'Protected source changed.',
        nextAction: 'Inspect integrity failures before treating the generated reports as valid.',
      };
    },
  });

  const result = await runMindMaintenancePilotCli(
    [
      'run',
      '--enable-report-only',
      '--mind-root',
      'mind',
      '--source-commit',
      'override-commit',
      '--generated-at',
      '2026-06-13T13:00:00Z',
      '--generated-by',
      'manual-test',
    ],
    captured.io,
    dependencies,
  );

  assert.equal(result.exitCode, 1);
  assert.equal(commitResolutionCalls, 0);
  assert.equal(receivedInput?.sourceCommit, 'override-commit');
  assert.equal(receivedInput?.generatedAt, '2026-06-13T13:00:00Z');
  assert.equal(receivedInput?.generatedBy, 'manual-test');
  assert.equal(captured.stdout.length, 0);
  assert.match(captured.stderr.join(''), /integrity-failed/);
});

test('prints dependency failures as structured JSON and exits one', async () => {
  const captured = createIo();
  const result = await runMindMaintenancePilotCli(
    ['run', '--enable-report-only', '--mind-root', 'mind'],
    captured.io,
    createDependencies({
      resolveSourceCommit: async () => {
        throw new Error('not a git repository');
      },
    }),
  );

  assert.equal(result.exitCode, 1);
  assert.equal(captured.stdout.length, 0);
  const output = JSON.parse(captured.stderr.join('')) as {
    ok: boolean;
    status: string;
    error: string;
  };
  assert.equal(output.ok, false);
  assert.equal(output.status, 'failed');
  assert.equal(output.error, 'not a git repository');
});
