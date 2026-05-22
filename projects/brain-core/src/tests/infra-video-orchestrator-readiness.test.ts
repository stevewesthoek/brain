import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {
  getInfraVOAccountStats,
  _injectPoolForTesting as _injectStatsPool,
} from '../adapters/infra-video-orchestrator-accounts-stats.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePool(queryFn: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>): pg.Pool {
  return {
    connect: async () => ({
      query: queryFn,
      release: () => undefined,
    }),
    on: () => undefined,
  } as unknown as pg.Pool;
}

function makeFailingPool(): pg.Pool {
  return {
    connect: async () => { throw new Error('Connection refused'); },
    on: () => undefined,
  } as unknown as pg.Pool;
}

// ── Account Stats ─────────────────────────────────────────────────────────────

test('getInfraVOAccountStats returns ok with empty stats', async () => {
  _injectStatsPool(makePool(async () => ({ rows: [], rowCount: 0 })));
  const result = await getInfraVOAccountStats();
  _injectStatsPool(null);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.stats), 'stats must be an array');
  assert.equal(result.stats.length, 0);
});

test('getInfraVOAccountStats returns stats with correct shape', async () => {
  const lastJobAt = new Date('2026-05-21T10:00:00Z');
  const lastSucceededAt = new Date('2026-05-21T10:00:00Z');
  const fakeRows = [
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      account_handle: '@says-the-bible',
      platform: 'youtube',
      total_jobs: '5',
      succeeded_jobs: '4',
      failed_jobs: '1',
      last_job_at: lastJobAt,
      last_succeeded_at: lastSucceededAt,
      adapter_mode: 'manual',
    },
  ];

  _injectStatsPool(makePool(async () => ({ rows: fakeRows, rowCount: 1 })));
  const result = await getInfraVOAccountStats();
  _injectStatsPool(null);

  assert.equal(result.ok, true);
  assert.equal(result.stats.length, 1);
  const stat = result.stats[0];
  assert.ok(stat, 'stat must exist');
  assert.equal(stat.accountHandle, '@says-the-bible');
  assert.equal(stat.platform, 'youtube');
  assert.equal(stat.totalJobs30d, 5);
  assert.equal(stat.succeededJobs30d, 4);
  assert.equal(stat.failedJobs30d, 1);
  assert.equal(stat.successRate30d, 80, 'successRate30d must be 80% (4/5)');
  assert.equal(stat.lastJobAt, lastJobAt.toISOString());
  assert.equal(stat.lastSucceededAt, lastSucceededAt.toISOString());
  assert.equal(stat.lastAdapterMode, 'manual');
});

test('getInfraVOAccountStats handles zero total jobs (null success rate)', async () => {
  const fakeRows = [
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      account_handle: '@new-account',
      platform: 'instagram',
      total_jobs: '0',
      succeeded_jobs: '0',
      failed_jobs: '0',
      last_job_at: null,
      last_succeeded_at: null,
      adapter_mode: null,
    },
  ];

  _injectStatsPool(makePool(async () => ({ rows: fakeRows, rowCount: 1 })));
  const result = await getInfraVOAccountStats();
  _injectStatsPool(null);

  assert.equal(result.ok, true);
  assert.equal(result.stats[0]?.successRate30d, null, 'successRate30d must be null for zero total jobs');
  assert.equal(result.stats[0]?.lastJobAt, null);
  assert.equal(result.stats[0]?.lastAdapterMode, null);
});

test('getInfraVOAccountStats returns error gracefully when DB unreachable', async () => {
  _injectStatsPool(makeFailingPool());
  const result = await getInfraVOAccountStats();
  _injectStatsPool(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(Array.isArray(result.stats), 'stats must still be an array on error');
  assert.equal(result.stats.length, 0);
});

test('getInfraVOAccountStats does not expose credential material', async () => {
  const fakeRows = [
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      account_handle: '@says-the-bible',
      platform: 'youtube',
      total_jobs: '1',
      succeeded_jobs: '1',
      failed_jobs: '0',
      last_job_at: new Date('2026-05-21T10:00:00Z'),
      last_succeeded_at: new Date('2026-05-21T10:00:00Z'),
      adapter_mode: 'auto',
    },
  ];

  _injectStatsPool(makePool(async () => ({ rows: fakeRows, rowCount: 1 })));
  const result = await getInfraVOAccountStats();
  _injectStatsPool(null);

  const json = JSON.stringify(result);
  assert.ok(!json.includes('access_token'), 'must not expose access_token');
  assert.ok(!json.includes('refresh_token'), 'must not expose refresh_token');
  assert.ok(!json.includes('client_secret'), 'must not expose client_secret');
});
