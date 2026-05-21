import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { getInfraVOJobs, _injectPoolForTesting } from '../adapters/infra-video-orchestrator-jobs.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Make a pool that returns different row sets per successive query call.
 * The jobs adapter issues two queries: first the COUNT, then the data SELECT.
 */
function makePool(rowSets: Record<string, unknown>[][]): pg.Pool {
  let callIndex = 0;
  return {
    connect: async () => ({
      query: async () => {
        const rows = rowSets[callIndex] ?? [];
        callIndex++;
        return { rows, rowCount: rows.length };
      },
      release: () => undefined,
    }),
    on: () => undefined,
  } as unknown as pg.Pool;
}

function makeFailingPool(): pg.Pool {
  return {
    connect: async () => {
      throw new Error('Connection refused');
    },
    on: () => undefined,
  } as unknown as pg.Pool;
}

function makeJobRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    job_id: 'bbbbbbbb-0000-0000-0000-000000000001',
    job_type: 'post',
    job_status: 'succeeded',
    pipeline_state: 'posted',
    platform: 'youtube',
    account_handle: '@test_handle',
    title: 'Test Video',
    error_message: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    completed_at: new Date('2026-01-01T01:00:00Z'),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('getInfraVOJobs returns ok response with jobs array', async () => {
  const jobRow = makeJobRow();
  // rowSets[0] = COUNT result, rowSets[1] = data result
  _injectPoolForTesting(makePool([[{ cnt: '1' }], [jobRow]]));
  const result = await getInfraVOJobs();
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.jobs), 'jobs must be an array');
  assert.equal(result.jobs.length, 1);
  assert.equal(result.totalCount, 1);

  const job = result.jobs[0];
  assert.ok(job !== undefined);
  assert.equal(job.jobId, 'bbbbbbbb-0000-0000-0000-000000000001');
  assert.equal(job.jobType, 'post');
  assert.equal(job.jobStatus, 'succeeded');
  assert.equal(job.platform, 'youtube');
  assert.equal(job.title, 'Test Video');
  assert.ok(typeof job.createdAt === 'string', 'createdAt must be an ISO string');
  assert.ok(typeof job.completedAt === 'string', 'completedAt must be an ISO string when present');
});

test('getInfraVOJobs applies status filter', async () => {
  const pendingRow = makeJobRow({ job_status: 'pending', completed_at: null });
  _injectPoolForTesting(makePool([[{ cnt: '1' }], [pendingRow]]));
  const result = await getInfraVOJobs({ status: 'pending' });
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0]?.jobStatus, 'pending');
  assert.equal(result.jobs[0]?.completedAt, null);
});

test('getInfraVOJobs resolves account handle from JOIN', async () => {
  // Simulate JOIN providing the account_handle from the accounts table
  const rowWithJoin = makeJobRow({
    account_handle: '@joined_handle',
    platform: 'tiktok',
  });
  _injectPoolForTesting(makePool([[{ cnt: '1' }], [rowWithJoin]]));
  const result = await getInfraVOJobs();
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.equal(result.jobs[0]?.accountHandle, '@joined_handle');
  assert.equal(result.jobs[0]?.platform, 'tiktok');
});

test('getInfraVOJobs falls back gracefully when DB unreachable', async () => {
  _injectPoolForTesting(makeFailingPool());
  const result = await getInfraVOJobs();
  _injectPoolForTesting(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(result.error.length > 0, 'error must be non-empty');
  assert.ok(Array.isArray(result.jobs), 'jobs must still be an array on error');
  assert.equal(result.jobs.length, 0);
  assert.equal(result.totalCount, 0);
});
