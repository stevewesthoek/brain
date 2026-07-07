import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MIND_MAINTENANCE_PILOT_FILES } from '../mind-maintenance-pilot/pilot-file-loader.js';
import { buildMindStructureValidationReport } from '../mind-structure-validator/validator.js';

async function writeFixtureFile(root: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
}

async function createMindStructureFixture(): Promise<string> {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-structure-validator-'));

  await writeFixtureFile(mindRoot, 'home.md', '# Home\n');
  await writeFixtureFile(mindRoot, 'tasks.md', '# Tasks\n');
  await writeFixtureFile(mindRoot, 'kanban.md', '# Kanban legacy fallback\n');
  await writeFixtureFile(mindRoot, 'wiki/log.md', '# Log\n');
  await writeFixtureFile(
    mindRoot,
    'router/00-current-context.md',
    `# Current Context

## Status

\`\`\`yaml
status: current
last_reviewed: 2026-07-05
review_after: 2026-07-19
freshness_risk: high
\`\`\`
`,
  );
  await writeFixtureFile(mindRoot, 'router/00-memory-map.md', '# Memory Map\n');
  await mkdir(path.join(mindRoot, 'inbox/new'), { recursive: true });
  await mkdir(path.join(mindRoot, 'inbox/raw'), { recursive: true });
  await mkdir(path.join(mindRoot, 'inbox/processed'), { recursive: true });
  await mkdir(path.join(mindRoot, 'inbox/failed'), { recursive: true });
  await mkdir(path.join(mindRoot, 'projects'), { recursive: true });
  await mkdir(path.join(mindRoot, 'organizations'), { recursive: true });
  await mkdir(path.join(mindRoot, 'repos'), { recursive: true });
  await mkdir(path.join(mindRoot, 'people'), { recursive: true });
  await mkdir(path.join(mindRoot, 'faith'), { recursive: true });
  await mkdir(path.join(mindRoot, 'knowledge'), { recursive: true });
  await mkdir(path.join(mindRoot, 'resources'), { recursive: true });
  await mkdir(path.join(mindRoot, 'history'), { recursive: true });
  await mkdir(path.join(mindRoot, 'system/agent-context'), { recursive: true });
  await mkdir(path.join(mindRoot, 'capture/inbox'), { recursive: true });
  await mkdir(path.join(mindRoot, 'capture/failed'), { recursive: true });
  await mkdir(path.join(mindRoot, 'system/generated/graph'), { recursive: true });

  for (const pilotPath of MIND_MAINTENANCE_PILOT_FILES) {
    const content = pilotPath === 'router/00-current-context.md'
      ? `# Current Context

## Status

\`\`\`yaml
status: current
last_reviewed: 2026-07-05
review_after: 2026-07-19
freshness_risk: high
\`\`\`
`
      : `# ${pilotPath}\n\nStatus: current\n`;
    await writeFixtureFile(mindRoot, pilotPath, content);
  }

  await writeFixtureFile(
    mindRoot,
    'system/reports/maintenance-latest.json',
    `${JSON.stringify({ schemaVersion: '1.0', mode: 'report-only', findings: [] }, null, 2)}\n`,
  );
  await writeFixtureFile(mindRoot, 'system/reports/maintenance-latest.md', '# Maintenance Report\n');

  return mindRoot;
}

function checksWithStatus(
  report: Awaited<ReturnType<typeof buildMindStructureValidationReport>>,
  status: 'pass' | 'warn' | 'fail',
) {
  return report.checks.filter((check) => check.status === status);
}

test('builds a report-only pass report for a complete Mind structure fixture', async (context) => {
  const mindRoot = await createMindStructureFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const report = await buildMindStructureValidationReport({
    mindRoot,
    generatedAt: '2026-07-05T12:00:00.000Z',
    generatedBy: 'test',
  });

  assert.equal(report.mode, 'report-only');
  assert.equal(report.status, 'pass');
  assert.equal(report.safety.noWritePerformed, true);
  assert.equal(report.safety.sourceFilesChanged, 0);
  assert.equal(checksWithStatus(report, 'fail').length, 0);
  assert.equal(checksWithStatus(report, 'warn').length, 0);
  assert.ok(report.checks.some((check) => check.id === 'required-path:home.md' && check.status === 'pass'));
  assert.ok(report.checks.some((check) => check.id === 'graphify-output:path-consistency' && check.status === 'pass'));
});

test('fails when invariant Mind root paths are missing', async (context) => {
  const mindRoot = await createMindStructureFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  await rm(path.join(mindRoot, 'home.md'), { force: true });

  const report = await buildMindStructureValidationReport({
    mindRoot,
    generatedAt: '2026-07-05T12:00:00.000Z',
  });

  assert.equal(report.status, 'fail');
  assert.ok(report.checks.some(
    (check) => check.id === 'required-path:home.md'
      && check.status === 'fail'
      && check.message.includes('missing'),
  ));
});

test('warns when only the legacy .graphify-out path exists', async (context) => {
  const mindRoot = await createMindStructureFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  await rm(path.join(mindRoot, 'system/generated/graph'), { recursive: true, force: true });
  await rm(path.join(mindRoot, 'graphify-out'), { recursive: true, force: true });
  await mkdir(path.join(mindRoot, '.graphify-out'), { recursive: true });

  const report = await buildMindStructureValidationReport({
    mindRoot,
    generatedAt: '2026-07-05T12:00:00.000Z',
  });

  assert.equal(report.status, 'warn');
  assert.ok(report.checks.some(
    (check) => check.id === 'graphify-output:path-consistency'
      && check.status === 'warn'
      && check.path === '.graphify-out',
  ));
});

test('fails when freshness metadata is present but invalid', async (context) => {
  const mindRoot = await createMindStructureFixture();
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  await writeFixtureFile(
    mindRoot,
    'router/00-current-context.md',
    `# Current Context

## Status

\`\`\`yaml
status: current
last_reviewed: someday
review_after: soon
freshness_risk: urgent
\`\`\`
`,
  );

  const report = await buildMindStructureValidationReport({
    mindRoot,
    generatedAt: '2026-07-05T12:00:00.000Z',
  });

  assert.equal(report.status, 'fail');
  const freshnessCheck = report.checks.find(
    (check) => check.id === 'freshness-metadata:router/00-current-context.md',
  );
  assert.equal(freshnessCheck?.status, 'fail');
  assert.match(freshnessCheck?.message ?? '', /last_reviewed/);
  assert.match(freshnessCheck?.message ?? '', /review_after/);
  assert.match(freshnessCheck?.message ?? '', /freshness_risk/);
});
