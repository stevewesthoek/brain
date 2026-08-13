import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAgentTaskGraph } from '../adapters/agent-ledger.js';
import { readAgentTaskState } from '../adapters/agent-task-state.js';
import { readAgentExecutorPlan, saveAgentExecutorPlanSnapshot } from '../adapters/agent-executor-plan.js';

const snapshotPath = '/Users/Office/.local/video-orchestrator/state/agent-executor-plan.json';

function cleanupSnapshot(): void {
  fs.rmSync(snapshotPath, { force: true });
}

test.beforeEach(cleanupSnapshot);
test.afterEach(cleanupSnapshot);

test('readAgentExecutorPlan returns a derived executor selection plan', () => {
  const taskGraph = readAgentTaskGraph();
  const taskState = readAgentTaskState(taskGraph);
  const plan = readAgentExecutorPlan(taskGraph, taskState);

  assert.equal(plan.id, 'agent-executor-plan');
  assert.equal(plan.status, 'read-only');
  assert.equal(plan.stepCount, taskState.stepCount);
  assert.ok(plan.steps.some((step) => step.executorId === 'claude-bedrock'));
  assert.equal(plan.steps.some((step) => step.executorId.startsWith('local-ollama')), false);
});

test('saveAgentExecutorPlanSnapshot writes and reloads executor selections', () => {
  const taskGraph = readAgentTaskGraph();
  const taskState = readAgentTaskState(taskGraph);
  const plan = readAgentExecutorPlan(taskGraph, taskState);

  assert.equal(saveAgentExecutorPlanSnapshot(plan), true);

  const reloaded = readAgentExecutorPlan(taskGraph, taskState);

  assert.equal(reloaded.source, 'snapshot');
  assert.equal(reloaded.status, 'snapshot');
  assert.equal(reloaded.stepCount, plan.stepCount);
});
