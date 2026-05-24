import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {
  declareThumbnailWinner,
  _injectPoolForTesting,
  type DeclareThumbnailWinnerRequest,
} from '../adapters/infra-video-orchestrator-thumbnail-winner.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a fake pg.Pool that returns a pre-defined set of rows for successive queries.
 * Queries are served in order; once exhausted, returns an empty row set.
 */
function makePool(rowSets: Record<string, unknown>[][]): pg.Pool {
  let callIndex = 0;
  const client = {
    query: async (_sql: string, _params?: unknown[]) => {
      const rows = rowSets[callIndex] ?? [];
      callIndex++;
      return { rows, rowCount: rows.length };
    },
    release: () => undefined,
  };
  return {
    connect: async () => client,
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

/**
 * Minimal job row with a thumbnail artifact containing two variants.
 */
function makeJobRow(variantOverrides: Partial<Record<string, unknown>>[] = []): Record<string, unknown> {
  const variants = [
    { id: 'variant-A', url: 'https://cdn.example.com/thumb-a.jpg', active: false },
    { id: 'variant-B', url: 'https://cdn.example.com/thumb-b.jpg', active: false },
    ...variantOverrides,
  ];
  return {
    job_id: 'job-0001',
    task_config: {
      platform: 'youtube',
      thumbnail_artifact: {
        variants,
        winner_declared_at: null,
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('declareThumbnailWinner: succeeds and sets the winning variant as active', async () => {
  const jobRow = makeJobRow();

  // Query 1: SELECT job row
  // Query 2: UPDATE task_config (returns nothing important)
  _injectPoolForTesting(makePool([[jobRow], []]));

  const req: DeclareThumbnailWinnerRequest = {
    jobId: 'job-0001',
    variantId: 'variant-A',
    reason: 'manual',
  };

  const result = await declareThumbnailWinner(req);
  _injectPoolForTesting(null);

  assert.equal(result.ok, true, 'result.ok must be true');
  assert.equal(result.jobId, 'job-0001');
  assert.equal(result.winningVariantId, 'variant-A');
  assert.ok(typeof result.winner_declared_at === 'string', 'winner_declared_at must be a string');
  assert.ok(result.winner_declared_at.length > 0, 'winner_declared_at must be non-empty');
  // re_applied_to_youtube may be false in test env (script not present) — only type-check
  assert.ok(typeof result.re_applied_to_youtube === 'boolean', 're_applied_to_youtube must be boolean');
  assert.equal(result.error, undefined, 'error must be absent on success');
});

test('declareThumbnailWinner: returns error when variant not found', async () => {
  const jobRow = makeJobRow();

  _injectPoolForTesting(makePool([[jobRow], []]));

  const req: DeclareThumbnailWinnerRequest = {
    jobId: 'job-0001',
    variantId: 'variant-NONEXISTENT',
    reason: 'manual',
  };

  const result = await declareThumbnailWinner(req);
  _injectPoolForTesting(null);

  assert.equal(result.ok, false, 'result.ok must be false when variant not found');
  assert.equal(result.jobId, 'job-0001');
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(result.error.includes('variant-NONEXISTENT'), `error should mention missing variantId, got: ${result.error}`);
});

test('declareThumbnailWinner: winner_declared_at is a valid ISO timestamp', async () => {
  const jobRow = makeJobRow();

  _injectPoolForTesting(makePool([[jobRow], []]));

  const before = new Date().toISOString();
  const result = await declareThumbnailWinner({
    jobId: 'job-0001',
    variantId: 'variant-B',
    reason: 'auto-ctr',
  });
  const after = new Date().toISOString();
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.ok(result.winner_declared_at >= before, 'winner_declared_at must not be before test start');
  assert.ok(result.winner_declared_at <= after, 'winner_declared_at must not be after test end');

  // Verify it parses as a valid date
  const parsed = new Date(result.winner_declared_at);
  assert.ok(!isNaN(parsed.getTime()), 'winner_declared_at must parse as a valid Date');
});

test('declareThumbnailWinner: returns error when job not found', async () => {
  // Empty row set simulates job not found
  _injectPoolForTesting(makePool([[]]));

  const result = await declareThumbnailWinner({
    jobId: 'nonexistent-job',
    variantId: 'variant-A',
    reason: 'manual',
  });
  _injectPoolForTesting(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(result.error.includes('not found'), `error should indicate job not found, got: ${result.error}`);
});

test('declareThumbnailWinner: returns error when DB is unreachable', async () => {
  _injectPoolForTesting(makeFailingPool());

  const result = await declareThumbnailWinner({
    jobId: 'job-0001',
    variantId: 'variant-A',
    reason: 'manual',
  });
  _injectPoolForTesting(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(result.error.length > 0);
});
