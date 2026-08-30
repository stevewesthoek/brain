import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runScheduler } from './brain-scheduler-runner.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(root, 'operations/specs/typed-scheduler-jobs.json');

function tempEnv() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-scheduler-runner-'));
  return { directory, env: { ...process.env, FORCE_RUN: '1', BRAIN_SCHEDULER_MANIFEST_PATH: manifestPath, OFFICE_SCHEDULER_STATE_DIR: path.join(directory, 'state'), OFFICE_SCHEDULER_LOG_DIR: path.join(directory, 'logs'), OFFICE_SCHEDULER_REPORT_FILE: path.join(directory, 'report.md'), BRAIN_SCHEDULER_NOW: '2026-08-29T03:00:00+01:00' } };
}
function child({ closeCode = 0, output = '' } = {}) {
  const instance = new EventEmitter(); instance.stdout = new EventEmitter(); instance.stderr = new EventEmitter(); instance.kill = () => {};
  queueMicrotask(() => { if (output) instance.stdout.emit('data', Buffer.from(output)); instance.emit('close', closeCode); });
  return instance;
}
function cleanup(directory) { fs.rmSync(directory, { recursive: true, force: true }); }

test('dry-run emits one receipt for every registry job and spawns nothing', async () => {
  const { directory, env } = tempEnv(); env.BRAIN_SCHEDULER_DRY_RUN = '1'; let calls = 0;
  try {
    const result = await runScheduler({ env, spawnImpl: () => { calls += 1; return child(); } });
    assert.equal(result.status, 'success'); assert.equal(result.jobCount, 17); assert.equal(calls, 0);
    assert.equal(fs.readdirSync(path.join(directory, 'state', 'receipts')).length, 17);
    const blocked = JSON.parse(fs.readFileSync(path.join(directory, 'state', 'receipts', 'ing-bank-statement-download.json')));
    assert.equal(blocked.status, 'blocked');
    const memoryRefresh = JSON.parse(fs.readFileSync(path.join(directory, 'state', 'receipts', 'memory-context-refresh.json')));
    assert.equal(memoryRefresh.status, 'disabled');
    assert.equal(memoryRefresh.lifecycle, 'disabled');
    assert.equal(memoryRefresh.mode, 'disabled');
    assert.deepEqual(memoryRefresh.artifacts, ['~/.brain/memory-context.md']);
  } finally { cleanup(directory); }
});

test('only four active report jobs spawn, with redacted output and receipts', async () => {
  const { directory, env } = tempEnv(); const calls = []; let sawRunningReceipt = false;
  try {
    const result = await runScheduler({ env: { ...env, API_KEY: 'super-secret-value' }, spawnImpl: (command, args) => {
      calls.push([command, args]);
      const running = JSON.parse(fs.readFileSync(path.join(directory, 'state', 'receipts', 'mind-steward-dry-run.json')));
      sawRunningReceipt ||= running.status === 'running';
      return child({ output: 'api_key=super-secret-value' });
    } });
    assert.equal(result.status, 'success'); assert.equal(calls.length, 4); assert.equal(sawRunningReceipt, true);
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'state', 'receipts', 'mind-steward-dry-run.json')));
    assert.equal(receipt.status, 'success'); assert.doesNotMatch(receipt.output, /super-secret-value/); assert.match(receipt.output, /REDACTED/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'state', 'receipts', 'gws-token-refresh.json'))).status, 'blocked');
  } finally { cleanup(directory); }
});

test('failure blocks its dependent active job and does not retry', async () => {
  const { directory, env } = tempEnv(); let calls = 0;
  try {
    const result = await runScheduler({ env, spawnImpl: () => { calls += 1; return child({ closeCode: calls === 1 ? 2 : 0 }); } });
    assert.equal(result.status, 'failed'); assert.equal(calls, 3);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'state', 'receipts', 'mind-compile-loop.json'))).status, 'blocked');
  } finally { cleanup(directory); }
});

test('before-cutoff, duplicate-day, and held-lock guards are explicit', async () => {
  const first = tempEnv();
  try {
    const before = await runScheduler({ env: { ...first.env, FORCE_RUN: '', BRAIN_SCHEDULER_NOW: '2026-08-29T00:00:00+01:00' }, spawnImpl: () => child() });
    assert.equal(before.status, 'skipped'); assert.equal(before.reason, 'before-lisbon-schedule');
    const completed = await runScheduler({ env: first.env, spawnImpl: () => child() }); assert.equal(completed.status, 'success');
    const duplicate = await runScheduler({ env: { ...first.env, FORCE_RUN: '' }, spawnImpl: () => child() }); assert.equal(duplicate.status, 'skipped'); assert.equal(duplicate.reason, 'already-completed-for-lisbon-day');
    fs.mkdirSync(path.join(first.directory, 'state', 'nightly.lock'), { recursive: true }); fs.writeFileSync(path.join(first.directory, 'state', 'nightly.lock', 'pid'), `${process.pid}\n`);
    const held = await runScheduler({ env: { ...first.env, FORCE_RUN: '1' }, spawnImpl: () => child() }); assert.equal(held.status, 'running');
  } finally { cleanup(first.directory); }
});
