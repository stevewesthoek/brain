import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAgentTaskGraph } from '../adapters/agent-ledger.js';
import { readAgentTaskState, saveAgentTaskStateSnapshot } from '../adapters/agent-task-state.js';

const snapshotPath = '/Users/Office/.local/video-orchestrator/state/agent-task-state.json';

function cleanupSnapshot(): void {
  fs.rmSync(snapshotPath, { force: true });
}

test.beforeEach(cleanupSnapshot);
test.afterEach(cleanupSnapshot);

test('readAgentTaskState returns a resumable read-only task state', () => {
  const state = readAgentTaskState(readAgentTaskGraph());

  assert.equal(state.id, 'agent-task-state');
  assert.equal(state.status, 'read-only');
  assert.ok(state.stepCount >= 1);
  assert.equal(state.taskGraphId, 'agent-task-graph');
  assert.ok(typeof state.nextSafeStep === 'string' && state.nextSafeStep.length > 0);
});

test('saveAgentTaskStateSnapshot writes and reloads task state', () => {
  const taskGraph = readAgentTaskGraph();
  const state = readAgentTaskState(taskGraph);

  assert.equal(saveAgentTaskStateSnapshot(state), true);

  const reloaded = readAgentTaskState(taskGraph);

  assert.equal(reloaded.source, 'snapshot');
  assert.equal(reloaded.status, 'snapshot');
  assert.equal(reloaded.stepCount, state.stepCount);
  assert.equal(reloaded.currentTaskId, state.currentTaskId);
});
