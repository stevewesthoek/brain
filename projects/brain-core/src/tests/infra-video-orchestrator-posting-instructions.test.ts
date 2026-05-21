import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {
  getInfraVOPostingInstructions,
  _injectPackagesDirForTesting,
  _injectPoolForTesting,
} from '../adapters/infra-video-orchestrator-posting-instructions.js';

function makePool(rows: Record<string, unknown>[]): pg.Pool {
  return {
    connect: async () => ({
      query: async () => ({ rows, rowCount: rows.length }),
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

test('getInfraVOPostingInstructions returns content when package exists', async () => {
  const jobId = '12345678-1234-4234-9234-123456789abc';
  const root = mkdtempSync(path.join(tmpdir(), 'vo-posting-instructions-'));
  fs.mkdirSync(path.join(root, jobId.slice(0, 8)), { recursive: true });
  fs.writeFileSync(path.join(root, jobId.slice(0, 8), 'posting_instructions.md'), '# Posting Instructions\n\nCopy this.');

  _injectPackagesDirForTesting(root);
  _injectPoolForTesting(makePool([{
    job_id: jobId,
    platform: 'youtube',
    account_handle: '@test',
  }]));

  const result = await getInfraVOPostingInstructions(jobId.slice(0, 8));

  _injectPoolForTesting(null);
  _injectPackagesDirForTesting(null);
  fs.rmSync(root, { recursive: true, force: true });

  assert.equal(result.ok, true);
  assert.equal(result.exists, true);
  assert.equal(result.jobId, jobId);
  assert.equal(result.platform, 'youtube');
  assert.equal(result.account, '@test');
  assert.match(result.content, /Copy this/);
});

test('getInfraVOPostingInstructions returns exists false when package is missing', async () => {
  const jobId = '22345678-1234-4234-9234-123456789abc';
  const root = mkdtempSync(path.join(tmpdir(), 'vo-posting-instructions-'));

  _injectPackagesDirForTesting(root);
  _injectPoolForTesting(makePool([{
    job_id: jobId,
    platform: 'tiktok',
    account_handle: '@tt',
  }]));

  const result = await getInfraVOPostingInstructions(jobId);

  _injectPoolForTesting(null);
  _injectPackagesDirForTesting(null);
  fs.rmSync(root, { recursive: true, force: true });

  assert.equal(result.ok, true);
  assert.equal(result.exists, false);
  assert.equal(result.content, '');
  assert.equal(result.platform, 'tiktok');
  assert.equal(result.account, '@tt');
});

test('getInfraVOPostingInstructions rejects unsafe job ids', async () => {
  const result = await getInfraVOPostingInstructions('../../secrets');
  assert.equal(result.ok, false);
  assert.equal(result.exists, false);
  assert.match(result.error ?? '', /Invalid/);
});

test('getInfraVOPostingInstructions handles DB failures safely', async () => {
  _injectPoolForTesting(makeFailingPool());
  const result = await getInfraVOPostingInstructions('12345678');
  _injectPoolForTesting(null);

  assert.equal(result.ok, false);
  assert.equal(result.exists, false);
  assert.equal(result.error, 'VO DB unreachable');
});
