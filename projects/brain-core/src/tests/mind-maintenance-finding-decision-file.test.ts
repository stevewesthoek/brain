import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  MIND_MAINTENANCE_DECISION_PATH,
  loadMaintenanceFindingDecisionDocument,
  writeMaintenanceFindingDecisionDocument,
} from '../mind-maintenance-pilot/finding-decision-file.js';
import type { MaintenanceFindingDecisionDocument } from '../mind-maintenance-pilot/finding-decision-store.js';

function createDocument(): MaintenanceFindingDecisionDocument {
  return {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-14T12:00:00.000Z',
    decisions: [
      {
        findingId: 'finding-stale-page-router-00-current-context-001',
        deduplicationKey: 'stale-page:router/00-current-context.md:review_after',
        sourceReportId: 'mind-maintenance-20260614T103145Z',
        sourceCommit: 'c60f7f8',
        reviewedBy: 'Steve Westhoek',
        reviewedAt: '2026-06-14T11:04:45.000Z',
        decision: 'resolved',
        reason: 'The page was reviewed and remains current.',
        nextAction: '',
        resolutionRef: 'mind:b77f203',
        suppressionUntil: null,
      },
    ],
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

test('loads a missing decision file as an empty validated document', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-decisions-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const document = await loadMaintenanceFindingDecisionDocument(mindRoot, {
    whenMissingUpdatedAt: '2026-06-14T12:00:00.000Z',
  });

  assert.deepEqual(document, {
    schemaVersion: '1.0',
    sourceRepo: 'mind',
    updatedAt: '2026-06-14T12:00:00.000Z',
    decisions: [],
  });
  assert.deepEqual(await listFilesRecursively(mindRoot), []);
});

test('atomically writes and reloads the single canonical decision file', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-decisions-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const document = createDocument();
  const result = await writeMaintenanceFindingDecisionDocument(mindRoot, document);

  assert.equal(result.path, path.join(mindRoot, MIND_MAINTENANCE_DECISION_PATH));
  assert.equal(result.decisionCount, 1);
  assert.ok(result.bytesWritten > 0);
  assert.deepEqual(await listFilesRecursively(mindRoot), [MIND_MAINTENANCE_DECISION_PATH]);

  const reloaded = await loadMaintenanceFindingDecisionDocument(mindRoot, {
    whenMissingUpdatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(reloaded, document);
});

test('replaces an existing decision file without leaving temporary files', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-decisions-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));

  const first = createDocument();
  await writeMaintenanceFindingDecisionDocument(mindRoot, first);

  const second = createDocument();
  second.updatedAt = '2026-06-14T13:00:00.000Z';
  second.decisions[0]!.reviewedAt = '2026-06-14T13:00:00.000Z';
  await writeMaintenanceFindingDecisionDocument(mindRoot, second);

  const raw = await readFile(path.join(mindRoot, MIND_MAINTENANCE_DECISION_PATH), 'utf8');
  const parsed = JSON.parse(raw) as MaintenanceFindingDecisionDocument;
  assert.equal(parsed.updatedAt, second.updatedAt);
  assert.equal((await listFilesRecursively(mindRoot)).some((file) => file.includes('.tmp-')), false);
});

test('rejects invalid JSON and invalid decision documents', async (context) => {
  const mindRoot = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-decisions-'));
  context.after(async () => rm(mindRoot, { recursive: true, force: true }));
  const absolutePath = path.join(mindRoot, MIND_MAINTENANCE_DECISION_PATH);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  await writeFile(absolutePath, '{ invalid json', 'utf8');
  await assert.rejects(
    loadMaintenanceFindingDecisionDocument(mindRoot, {
      whenMissingUpdatedAt: '2026-06-14T12:00:00.000Z',
    }),
    /invalid JSON/i,
  );

  await writeFile(absolutePath, JSON.stringify({ schemaVersion: '1.0' }), 'utf8');
  await assert.rejects(
    loadMaintenanceFindingDecisionDocument(mindRoot, {
      whenMissingUpdatedAt: '2026-06-14T12:00:00.000Z',
    }),
    /Invalid maintenance finding decision document/i,
  );
});

test('rejects relative Mind roots before reading or writing', async () => {
  await assert.rejects(
    loadMaintenanceFindingDecisionDocument('relative/mind', {
      whenMissingUpdatedAt: '2026-06-14T12:00:00.000Z',
    }),
    /absolute root/i,
  );

  await assert.rejects(
    writeMaintenanceFindingDecisionDocument('relative/mind', createDocument()),
    /absolute root/i,
  );
});
