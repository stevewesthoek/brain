import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {
  getInfraVONormalizeHistory,
  _injectPoolForTesting as _injectNormalizePool,
} from '../adapters/infra-video-orchestrator-normalize-history.js';
import {
  getInfraVOManualQueue,
  _injectPoolForTesting as _injectManualPool,
} from '../adapters/infra-video-orchestrator-manual-queue.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

function makePool(queryFn: QueryFn): pg.Pool {
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
    connect: async () => {
      throw new Error('Connection refused');
    },
    on: () => undefined,
  } as unknown as pg.Pool;
}

function makeSimplePool(rows: Record<string, unknown>[]): pg.Pool {
  return makePool(async () => ({ rows, rowCount: rows.length }));
}

// ── Normalize History ─────────────────────────────────────────────────────────

test('getInfraVONormalizeHistory returns ok with empty jobs', async () => {
  let callCount = 0;
  _injectNormalizePool(makePool(async () => {
    callCount++;
    if (callCount === 1) return { rows: [], rowCount: 0 };
    return { rows: [{ cnt: '0' }], rowCount: 1 };
  }));

  const result = await getInfraVONormalizeHistory();
  _injectNormalizePool(null);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.jobs), 'jobs must be an array');
  assert.equal(result.jobs.length, 0);
  assert.equal(result.totalCount, 0);
});

test('getInfraVONormalizeHistory returns jobs with correct shape', async () => {
  const createdAt = new Date('2026-05-21T10:00:00Z');
  const completedAt = new Date('2026-05-21T10:35:00Z');
  const fakeRows = [
    {
      job_id: '23c87e1b-aaaa-bbbb-cccc-000000000001',
      job_status: 'succeeded',
      task_config: {
        master_path: '/tmp/genesis-noah-30m.mp4',
        output_dir: '/tmp/vo_norm_genesis_noah',
        format_keys: ['landscape_1920x1080', 'portrait_1080x1920'],
      },
      created_at: createdAt,
      completed_at: completedAt,
      error_message: null,
    },
  ];

  let callCount = 0;
  _injectNormalizePool(makePool(async () => {
    callCount++;
    if (callCount === 1) return { rows: fakeRows, rowCount: 1 };
    return { rows: [{ cnt: '1' }], rowCount: 1 };
  }));

  const result = await getInfraVONormalizeHistory({ limit: 5 });
  _injectNormalizePool(null);

  assert.equal(result.ok, true);
  assert.equal(result.totalCount, 1);
  assert.equal(result.jobs.length, 1);
  const job = result.jobs[0];
  assert.ok(job, 'job must exist');
  assert.equal(job.jobId, '23c87e1b-aaaa-bbbb-cccc-000000000001');
  assert.equal(job.status, 'succeeded');
  assert.equal(job.inputPath, '/tmp/genesis-noah-30m.mp4');
  assert.equal(job.outputDir, '/tmp/vo_norm_genesis_noah');
  assert.deepEqual(job.formats, ['landscape_1920x1080', 'portrait_1080x1920']);
  assert.equal(job.createdAt, createdAt.toISOString());
  assert.equal(job.completedAt, completedAt.toISOString());
  assert.equal(job.errorMessage, null);
  assert.ok(Array.isArray(job.outputFiles), 'outputFiles must be an array');
});

test('getInfraVONormalizeHistory returns error gracefully when DB unreachable', async () => {
  _injectNormalizePool(makeFailingPool());
  const result = await getInfraVONormalizeHistory();
  _injectNormalizePool(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(Array.isArray(result.jobs), 'jobs must still be an array on error');
  assert.equal(result.jobs.length, 0);
  assert.equal(result.totalCount, 0);
});

test('getInfraVONormalizeHistory respects limit cap at 100', async () => {
  let firstCallParams: unknown[] = [];
  let callCount = 0;
  _injectNormalizePool(makePool(async (_sql, params) => {
    callCount++;
    if (callCount === 1) {
      firstCallParams = params ?? [];
      return { rows: [], rowCount: 0 };
    }
    return { rows: [{ cnt: '0' }], rowCount: 1 };
  }));

  await getInfraVONormalizeHistory({ limit: 999 });
  _injectNormalizePool(null);

  assert.equal(firstCallParams[0], 100, 'limit must be capped at 100');
});

// ── Manual Queue ─────────────────────────────────────────────────────────────

test('getInfraVOManualQueue returns ok with empty jobs', async () => {
  let callCount = 0;
  _injectManualPool(makePool(async () => {
    callCount++;
    if (callCount === 1) return { rows: [], rowCount: 0 };
    return { rows: [{ cnt: '0' }], rowCount: 1 };
  }));

  const result = await getInfraVOManualQueue();
  _injectManualPool(null);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.jobs), 'jobs must be an array');
  assert.equal(result.jobs.length, 0);
  assert.equal(result.totalCount, 0);
});

test('getInfraVOManualQueue returns jobs with correct shape', async () => {
  const createdAt = new Date('2026-05-21T11:00:00Z');
  const completedAt = new Date('2026-05-21T11:05:00Z');
  const fakeRows = [
    {
      job_id: 'fbe09ce7-aaaa-bbbb-cccc-000000000001',
      job_status: 'succeeded',
      task_config: {
        platform: 'youtube',
        video_path: '/tmp/vo_norm_genesis_noah/landscape_1920x1080_16x9.mp4',
        title: 'Genesis — Noah',
      },
      output: {
        adapter_mode: 'manual',
        status: 'draft',
        instructions_path: '/tmp/posting_instructions.md',
      },
      created_at: createdAt,
      completed_at: completedAt,
      account_handle: '@says-the-bible',
    },
  ];

  let callCount = 0;
  _injectManualPool(makePool(async () => {
    callCount++;
    if (callCount === 1) return { rows: fakeRows, rowCount: 1 };
    return { rows: [{ cnt: '1' }], rowCount: 1 };
  }));

  const result = await getInfraVOManualQueue({ limit: 5 });
  _injectManualPool(null);

  assert.equal(result.ok, true);
  assert.equal(result.totalCount, 1);
  assert.equal(result.jobs.length, 1);
  const job = result.jobs[0];
  assert.ok(job, 'job must exist');
  assert.equal(job.jobId, 'fbe09ce7-aaaa-bbbb-cccc-000000000001');
  assert.equal(job.platform, 'youtube');
  assert.equal(job.accountHandle, '@says-the-bible');
  assert.equal(job.title, 'Genesis — Noah');
  assert.equal(job.status, 'draft');
  assert.equal(job.createdAt, createdAt.toISOString());
  assert.equal(typeof job.hasInstructions, 'boolean', 'hasInstructions must be boolean');
  assert.equal(typeof job.instructionsPath, 'string', 'instructionsPath must be a string');
});

test('getInfraVOManualQueue returns error gracefully when DB unreachable', async () => {
  _injectManualPool(makeFailingPool());
  const result = await getInfraVOManualQueue();
  _injectManualPool(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(Array.isArray(result.jobs), 'jobs must still be an array on error');
  assert.equal(result.jobs.length, 0);
  assert.equal(result.totalCount, 0);
});

test('getInfraVOManualQueue falls back to task_config platform when output lacks it', async () => {
  const createdAt = new Date('2026-05-21T11:00:00Z');
  const fakeRows = [
    {
      job_id: 'aabbccdd-0000-0000-0000-000000000001',
      job_status: 'succeeded',
      task_config: { platform: 'instagram' },
      output: { adapter_mode: 'manual' },
      created_at: createdAt,
      completed_at: null,
      account_handle: '@saysthebible_ig',
    },
  ];

  let callCount = 0;
  _injectManualPool(makePool(async () => {
    callCount++;
    if (callCount === 1) return { rows: fakeRows, rowCount: 1 };
    return { rows: [{ cnt: '1' }], rowCount: 1 };
  }));

  const result = await getInfraVOManualQueue();
  _injectManualPool(null);

  assert.equal(result.ok, true);
  assert.equal(result.jobs[0]?.platform, 'instagram');
});

test('getInfraVOManualQueue uses output platform when task_config lacks it', async () => {
  const createdAt = new Date('2026-05-21T11:00:00Z');
  const fakeRows = [
    {
      job_id: 'aabbccdd-0000-0000-0000-000000000002',
      job_status: 'succeeded',
      task_config: {},
      output: { adapter_mode: 'manual', platform: 'tiktok' },
      created_at: createdAt,
      completed_at: null,
      account_handle: '@stb-tiktok-1',
    },
  ];

  let callCount = 0;
  _injectManualPool(makePool(async () => {
    callCount++;
    if (callCount === 1) return { rows: fakeRows, rowCount: 1 };
    return { rows: [{ cnt: '1' }], rowCount: 1 };
  }));

  const result = await getInfraVOManualQueue();
  _injectManualPool(null);

  assert.equal(result.ok, true);
  assert.equal(result.jobs[0]?.platform, 'tiktok');
});
