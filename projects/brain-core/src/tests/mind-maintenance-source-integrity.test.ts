import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  captureMindMaintenanceIntegritySnapshot,
  compareMindMaintenanceIntegritySnapshots,
} from '../mind-maintenance-pilot/source-integrity-validator.js';
import {
  MIND_MAINTENANCE_PILOT_FILES,
  type LoadedMindMaintenancePilotDataset,
} from '../mind-maintenance-pilot/pilot-file-loader.js';

async function createFixture(): Promise<LoadedMindMaintenancePilotDataset> {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-integrity-'));

  for (const relativePath of [...MIND_MAINTENANCE_PILOT_FILES, 'kanban.md']) {
    const absolutePath = path.join(mindRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `# ${relativePath}\n`, 'utf8');
  }

  return {
    mindRoot,
    files: MIND_MAINTENANCE_PILOT_FILES.map((filePath) => ({
      path: filePath,
      absolutePath: path.join(mindRoot, filePath),
      content: `# ${filePath}\n`,
    })),
  };
}

test('passes when source files remain unchanged and only report outputs are new', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, [
    'system/reports/maintenance-latest.json',
    'system/reports/maintenance-latest.md',
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.changedSourcePaths, []);
  assert.deepEqual(result.unexpectedChangedPaths, []);
  assert.deepEqual(result.allowedOutputPaths, [
    'system/reports/maintenance-latest.json',
    'system/reports/maintenance-latest.md',
  ]);
});

test('detects mutation of any pilot source file', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  await writeFile(
    path.join(dataset.mindRoot, 'router/00-current-context.md'),
    '# Changed current context\n',
    'utf8',
  );
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, ['router/00-current-context.md']);
});

test('detects kanban.md mutation', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  await writeFile(path.join(dataset.mindRoot, 'kanban.md'), '# Changed kanban\n', 'utf8');
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, ['kanban.md']);
});

test('detects deletion of a protected source file', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  await unlink(path.join(dataset.mindRoot, 'live/dashboard.md'));
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, ['live/dashboard.md']);
});

test('treats a file missing in both snapshots as unchanged', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  await unlink(path.join(dataset.mindRoot, 'kanban.md'));
  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, true);
  assert.deepEqual(result.changedSourcePaths, []);
});

test('rejects newly introduced paths outside the two report outputs', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, [
    'system/reports/maintenance-latest.json',
    'wiki/unexpected-change.md',
    'root-output.json',
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, []);
  assert.deepEqual(result.unexpectedChangedPaths, [
    'wiki/unexpected-change.md',
    'root-output.json',
  ]);
});

test('rejects snapshots from different Mind roots', async (context) => {
  const first = await createFixture();
  const second = await createFixture();
  context.after(async () => rm(first.mindRoot, { recursive: true, force: true }));
  context.after(async () => rm(second.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(first);
  const after = await captureMindMaintenanceIntegritySnapshot(second);

  assert.throws(
    () => compareMindMaintenanceIntegritySnapshots(before, after, []),
    /same Mind repository root/i,
  );
});




test('detects maintenance decision file mutation', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));
  const decisionPath = path.join(
    dataset.mindRoot,
    'system/reports/maintenance-decisions.json',
  );
  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(decisionPath, '{"version":1}\n', 'utf8');

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  await writeFile(decisionPath, '{"version":2}\n', 'utf8');
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, [
    'system/reports/maintenance-decisions.json',
  ]);
});

test('detects maintenance decision file creation during a report run', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));
  const decisionPath = path.join(
    dataset.mindRoot,
    'system/reports/maintenance-decisions.json',
  );

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(decisionPath, '{"version":1}\n', 'utf8');
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, [
    'system/reports/maintenance-decisions.json',
  ]);
});

test('detects maintenance decision file deletion during a report run', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));
  const decisionPath = path.join(
    dataset.mindRoot,
    'system/reports/maintenance-decisions.json',
  );
  await mkdir(path.dirname(decisionPath), { recursive: true });
  await writeFile(decisionPath, '{"version":1}\n', 'utf8');

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  await unlink(decisionPath);
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, false);
  assert.deepEqual(result.changedSourcePaths, [
    'system/reports/maintenance-decisions.json',
  ]);
});

test('treats an absent maintenance decision file as unchanged across snapshots', async (context) => {
  const dataset = await createFixture();
  context.after(async () => rm(dataset.mindRoot, { recursive: true, force: true }));

  const before = await captureMindMaintenanceIntegritySnapshot(dataset);
  const after = await captureMindMaintenanceIntegritySnapshot(dataset);
  const result = compareMindMaintenanceIntegritySnapshots(before, after, []);

  assert.equal(result.ok, true);
  assert.deepEqual(result.changedSourcePaths, []);
});
