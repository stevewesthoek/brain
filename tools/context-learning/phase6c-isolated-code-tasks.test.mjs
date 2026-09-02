import assert from 'node:assert/strict';
import test from 'node:test';
import { isolatedCodeTasks } from './phase6c-code-task-fixtures.mjs';
import { runPhase6cIsolatedCodeTasks } from './run-phase6c-isolated-code-tasks.mjs';

test('Phase 6C has twenty bounded disposable coding fixtures across required task classes', () => {
  assert.equal(isolatedCodeTasks.length, 20);
  assert.ok(new Set(isolatedCodeTasks.map((task) => task.category)).size >= 10);
  assert.ok(isolatedCodeTasks.some((task) => task.repairPatches?.length));
  assert.ok(isolatedCodeTasks.some((task) => task.expectedFiles.length > 1));
});

test('isolated coding outcomes are executable, repaired once when needed, and leave no production writes', () => {
  const result = runPhase6cIsolatedCodeTasks();
  assert.equal(result.count, 20);
  assert.equal(result.rows.filter((row) => row.canary.selectedPath === 'v2').length, 20);
  assert.equal(result.rows.filter((row) => row.v2.final.tests.pass).length, 20);
  assert.equal(result.rows.filter((row) => row.v2.repair.attempted).length, 1);
  assert.equal(result.rows.filter((row) => row.v2.repair.success).length, 1);
  assert.equal(result.rows.reduce((sum, row) => sum + row.v2.quality.leftoverDefects, 0), 0);
  assert.equal(result.rows.filter((row) => row.prior.liveConsumed).length, 20);
  assert.equal(result.safety.productionWrites, 0);
  assert.equal(result.safety.mindWrites, 0);
  assert.equal(result.safety.providers, 0);
});
