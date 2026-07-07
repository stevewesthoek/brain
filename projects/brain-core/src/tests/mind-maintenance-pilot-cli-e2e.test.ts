import assert from 'node:assert/strict';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { MIND_MAINTENANCE_PILOT_FILES } from '../mind-maintenance-pilot/pilot-file-loader.js';

const execFile = promisify(execFileCallback);
const cliPath = fileURLToPath(new URL('../bin/mind-maintenance-pilot.js', import.meta.url));

async function createCommittedMindFixture(): Promise<string> {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-cli-e2e-'));
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

  await execFile('git', ['-C', mindRoot, 'init', '--quiet']);
  await execFile('git', ['-C', mindRoot, 'config', 'user.email', 'fixture@example.invalid']);
  await execFile('git', ['-C', mindRoot, 'config', 'user.name', 'Fixture']);
  await execFile('git', ['-C', mindRoot, 'add', '.']);
  await execFile('git', ['-C', mindRoot, 'commit', '--quiet', '-m', 'fixture']);

  return mindRoot;
}

async function runCli(args: readonly string[]): Promise<{
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

test('compiled CLI runs the complete report-only pilot against a committed Mind fixture', async (context) => {
  const mindRoot = await createCommittedMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const result = await runCli([
    'run',
    '--enable-report-only',
    '--mind-root',
    mindRoot,
    '--generated-at',
    '2026-06-13T12:00:00Z',
    '--generated-by',
    'cli-e2e-test',
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, '');

  const output = JSON.parse(result.stdout) as {
    ok: boolean;
    status: string;
    mode: string;
    reportId: string;
    sourceCommit: string;
    filesConsidered: number;
    findingsTotal: number;
    sourceFilesChanged: number;
  };
  assert.equal(output.ok, true);
  assert.equal(output.status, 'completed');
  assert.equal(output.mode, 'report-only');
  assert.equal(output.filesConsidered, 5);
  assert.equal(output.findingsTotal, 1);
  assert.equal(output.sourceFilesChanged, 0);

  const { stdout: head } = await execFile('git', ['-C', mindRoot, 'rev-parse', 'HEAD']);
  assert.equal(output.sourceCommit, head.trim());

  const jsonPath = path.join(mindRoot, 'system/reports/maintenance-latest.json');
  const markdownPath = path.join(mindRoot, 'system/reports/maintenance-latest.md');
  await stat(jsonPath);
  await stat(markdownPath);

  const report = JSON.parse(await readFile(jsonPath, 'utf8')) as {
    reportId: string;
    generatedBy: string;
    noWritePerformed: boolean;
  };
  const markdown = await readFile(markdownPath, 'utf8');
  assert.equal(report.reportId, output.reportId);
  assert.equal(report.generatedBy, 'cli-e2e-test');
  assert.equal(report.noWritePerformed, true);
  assert.match(markdown, new RegExp(output.reportId));

  const { stdout: dirty } = await execFile(
    'git',
    ['-C', mindRoot, 'status', '--porcelain=v1', '--untracked-files=all'],
  );
  const dirtyLines = dirty.trim().split('\n').filter(Boolean).sort();
  assert.deepEqual(dirtyLines, [
    '?? system/reports/maintenance-latest.json',
    '?? system/reports/maintenance-latest.md',
  ]);
});

test('compiled CLI refuses an unenabled run before creating reports', async (context) => {
  const mindRoot = await createCommittedMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const result = await runCli(['run', '--mind-root', mindRoot]);

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /disabled unless --enable-report-only/i);

  await assert.rejects(stat(path.join(mindRoot, 'system/reports/maintenance-latest.json')));
  await assert.rejects(stat(path.join(mindRoot, 'system/reports/maintenance-latest.md')));
});




test('compiled CLI records and replaces a finding decision in a temporary Mind fixture', async (context) => {
  const mindRoot = await createCommittedMindFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const created = await runCli([
    'record-decision',
    '--mind-root',
    mindRoot,
    '--finding-id',
    'finding-stale-page-router-00-current-context-001',
    '--deduplication-key',
    'stale-page:router/00-current-context.md:review_after',
    '--source-report',
    'mind-maintenance-20260614T103145Z',
    '--source-commit',
    'c60f7f8',
    '--reviewer',
    'Steve Westhoek',
    '--reviewed-at',
    '2026-06-14T11:04:45.000Z',
    '--decision',
    'accepted',
    '--reason',
    'The review date elapsed and the page requires review.',
    '--next-action',
    'Review the page.',
  ]);

  assert.equal(created.exitCode, 0, created.stderr);
  assert.equal(created.stderr, '');
  const createdOutput = JSON.parse(created.stdout) as {
    ok: boolean;
    status: string;
    operation: string;
    decisionPath: string;
    decisionCount: number;
  };
  assert.deepEqual(
    {
      ok: createdOutput.ok,
      status: createdOutput.status,
      operation: createdOutput.operation,
      decisionCount: createdOutput.decisionCount,
    },
    { ok: true, status: 'recorded', operation: 'created', decisionCount: 1 },
  );

  const decisionPath = path.join(mindRoot, 'system/reports/maintenance-decisions.json');
  assert.equal(createdOutput.decisionPath, decisionPath);

  const replaced = await runCli([
    'record-decision',
    '--mind-root',
    mindRoot,
    '--finding-id',
    'finding-stale-page-router-00-current-context-002',
    '--deduplication-key',
    'stale-page:router/00-current-context.md:review_after',
    '--source-report',
    'mind-maintenance-20260701T090000Z',
    '--source-commit',
    'def5678',
    '--reviewer',
    'Steve Westhoek',
    '--reviewed-at',
    '2026-06-14T11:05:45.000Z',
    '--decision',
    'dismissed',
    '--reason',
    'The content is intentionally retained for this review window.',
    '--suppression-until',
    '2026-07-14',
  ]);

  assert.equal(replaced.exitCode, 0, replaced.stderr);
  assert.equal(replaced.stderr, '');
  const replacedOutput = JSON.parse(replaced.stdout) as {
    operation: string;
    replacedFindingId: string | null;
    decisionCount: number;
  };
  assert.equal(replacedOutput.operation, 'replaced');
  assert.equal(
    replacedOutput.replacedFindingId,
    'finding-stale-page-router-00-current-context-001',
  );
  assert.equal(replacedOutput.decisionCount, 1);

  const document = JSON.parse(await readFile(decisionPath, 'utf8')) as {
    decisions: Array<{
      findingId: string;
      decision: string;
      suppressionUntil: string | null;
    }>;
  };
  assert.deepEqual(document.decisions, [{
    findingId: 'finding-stale-page-router-00-current-context-002',
    deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
    sourceReportId: 'mind-maintenance-20260701T090000Z',
    sourceCommit: 'def5678',
    reviewedBy: 'Steve Westhoek',
    reviewedAt: '2026-06-14T11:05:45.000Z',
    decision: 'dismissed',
    reason: 'The content is intentionally retained for this review window.',
    nextAction: '',
    resolutionRef: null,
    suppressionUntil: '2026-07-14',
  }]);
});
