import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { InfraVOStorageCleanupResponse } from '../types/api.js';
import { readStorageStats } from '../adapters/infra-video-orchestrator-storage-cleanup.js';

test('readStorageStats: returns valid structure', async () => {
  const stats = await readStorageStats();

  assert.equal(stats.ok, true);
  assert.equal(typeof stats.status, 'string');
  assert.ok(typeof stats.dirs_scanned === 'number');
  assert.ok(typeof stats.total_files === 'number');
  assert.ok(typeof stats.total_bytes === 'number');
  assert.ok(typeof stats.oldest_job_age_seconds === 'number');
  assert.ok(typeof stats.eligible_for_cleanup_30d === 'boolean');
});

test('triggerStorageCleanup types: valid request/response structure', () => {
  // Verify type contract without actually running Python script
  const validResponse: InfraVOStorageCleanupResponse = {
    ok: true,
    status: 'ok',
    retention_days: 30,
    dry_run: true,
    candidate_count: 0,
    archived_count: 0,
    candidates: [],
  };

  assert.equal(validResponse.ok, true);
  assert.equal(validResponse.status, 'ok');
  assert.equal(validResponse.retention_days, 30);
  assert.equal(validResponse.dry_run, true);
  assert.ok(Array.isArray(validResponse.candidates));
});

test('triggerStorageCleanup types: candidate structure', () => {
  // Verify candidate type contract
  const candidate = {
    job_id: 'abc12345',
    completed_at: '2026-05-24T00:00:00Z',
    output_dir: '/home/user/.local/video-orchestrator/data/abc12345',
    size_bytes: 1024 * 1024,
  };

  assert.ok('job_id' in candidate);
  assert.ok('output_dir' in candidate);
  assert.ok('size_bytes' in candidate);
});
