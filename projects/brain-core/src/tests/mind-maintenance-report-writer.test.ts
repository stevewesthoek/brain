import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeMindMaintenanceLatestReports } from '../mind-maintenance-pilot/report-writer.js';
import {
  MIND_MAINTENANCE_PILOT_FILES,
  type LoadedMindMaintenancePilotDataset,
} from '../mind-maintenance-pilot/pilot-file-loader.js';
import type { MaintenanceReport } from '../mind-maintenance-pilot/types.js';

function createDataset(mindRoot: string): LoadedMindMaintenancePilotDataset {
  return {
    mindRoot,
    files: MIND_MAINTENANCE_PILOT_FILES.map((filePath) => ({
      path: filePath,
      absolutePath: path.join(mindRoot, filePath),
      content: '# Fixture\n',
    })),
  };
}

function createReport(): MaintenanceReport {
  return {
    schemaVersion: '1.0',
    reportId: 'mind-maintenance-20260613T120000Z',
    generatedAt: '2026-06-13T12:00:00.000Z',
    generatedBy: 'brain/mind-steward',
    mode: 'report-only',
    sourceRepo: 'mind',
    sourceCommit: 'abc1234',
    configuration: {
      maxFiles: 5,
      maxFindingsPerDetector: 5,
      minimumConfidence: 0.7,
      aiAssist: 'when-ambiguous',
    },
    detectors: {
      'stale-page': { enabled: true, status: 'completed' },
      'completed-but-active': { enabled: true, status: 'completed' },
      'source-gap': { enabled: true, status: 'completed' },
      'duplicate-candidate': { enabled: false, status: 'disabled' },
      'contradiction-candidate': { enabled: false, status: 'disabled' },
      'capture-promotion': { enabled: false, status: 'disabled' },
    },
    filesConsidered: [...MIND_MAINTENANCE_PILOT_FILES],
    summary: {
      filesConsidered: 5,
      findingsTotal: 0,
      findingsOpen: 0,
      findingsAccepted: 0,
      findingsDismissed: 0,
      findingsResolved: 0,
      findingsSuppressed: 0,
      detectorErrors: 0,
    },
    findings: [],
    suppressedFindings: [],
    errors: [],
    safety: {
      allowedOutputPaths: [
        'system/reports/maintenance-latest.json',
        'system/reports/maintenance-latest.md',
      ],
      sourceFilesChanged: 0,
      kanbanChanged: false,
      captureFilesChanged: 0,
      wikiFilesChanged: 0,
      liveFilesChanged: 0,
      archiveFilesChanged: 0,
      rootFilesCreated: 0,
      noWritePerformed: true,
    },
    noWritePerformed: true,
  };
}

async function listFilesRecursively(root: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else {
        results.push(path.relative(root, absolutePath).split(path.sep).join('/'));
      }
    }
  }

  await walk(root);
  return results.sort();
}

test('atomically writes only the canonical JSON and Markdown latest reports', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-writer-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const report = createReport();
  const result = await writeMindMaintenanceLatestReports({
    dataset: createDataset(mindRoot),
    report,
  });

  assert.equal(result.reportId, report.reportId);
  assert.ok(result.bytesWritten.json > 0);
  assert.ok(result.bytesWritten.markdown > 0);

  const json = JSON.parse(await readFile(result.jsonPath, 'utf8')) as MaintenanceReport;
  const markdown = await readFile(result.markdownPath, 'utf8');

  assert.equal(json.reportId, report.reportId);
  assert.equal(json.sourceCommit, report.sourceCommit);
  assert.match(markdown, new RegExp(report.reportId));
  assert.match(markdown, new RegExp(report.sourceCommit));
  assert.match(markdown, /Writes performed:\*\* none/);

  assert.deepEqual(await listFilesRecursively(mindRoot), [
    'system/reports/maintenance-latest.json',
    'system/reports/maintenance-latest.md',
  ]);
});

test('replaces existing latest reports without leaving temporary files', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-writer-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const dataset = createDataset(mindRoot);
  const first = createReport();
  await writeMindMaintenanceLatestReports({ dataset, report: first });

  const second = createReport();
  second.reportId = 'mind-maintenance-20260613T130000Z';
  second.generatedAt = '2026-06-13T13:00:00.000Z';
  await writeMindMaintenanceLatestReports({ dataset, report: second });

  const json = JSON.parse(
    await readFile(path.join(mindRoot, 'system/reports/maintenance-latest.json'), 'utf8'),
  ) as MaintenanceReport;
  assert.equal(json.reportId, second.reportId);

  const files = await listFilesRecursively(mindRoot);
  assert.equal(files.some((file) => file.includes('.tmp-')), false);
  assert.equal(files.length, 2);
});

test('rejects invalid reports before creating output files', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-writer-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const report = createReport();
  report.mode = 'write-enabled' as never;

  await assert.rejects(
    writeMindMaintenanceLatestReports({
      dataset: createDataset(mindRoot),
      report,
    }),
    /Invalid maintenance report/i,
  );

  assert.deepEqual(await listFilesRecursively(mindRoot), []);
});

test('rejects report paths that do not match the loaded dataset', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-writer-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const dataset = createDataset(mindRoot);
  dataset.files[4] = dataset.files[0]!;

  await assert.rejects(
    writeMindMaintenanceLatestReports({ dataset, report: createReport() }),
    /paths do not match|file count does not match/i,
  );

  assert.deepEqual(await listFilesRecursively(mindRoot), []);
});
