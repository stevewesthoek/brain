import assert from 'node:assert/strict';
import test from 'node:test';
import { searchUnified } from '../adapters/unified-search.js';

test('unified search returns bounded metadata for real task and scheduler projections', async () => {
  const task = await searchUnified('Run ledger and task graph');
  const scheduler = await searchUnified('Mind compile loop');
  assert.equal(task.id, 'brain-unified-search-v1');
  assert.ok(task.results.some((entry) => entry.type === 'TASK'));
  assert.ok(scheduler.results.some((entry) => entry.type === 'SCHEDULER_JOB'));
  assert.ok(task.results.length <= 32);
  assert.equal(task.index.fullScanPerQuery, false);
  assert.equal(JSON.stringify(task).includes('packet body'), false);
});

test('unified search exposes bounded Obsidian note metadata without note bodies', async () => {
  const response = await searchUnified('brain mind bridge');
  const note = response.results.find((entry) => entry.type === 'OBSIDIAN_NOTE');
  assert.ok(note);
  assert.equal(note?.deepLink?.startsWith('obsidian://open?'), true);
  assert.equal(note?.subtitle.includes('.md'), true);
});
