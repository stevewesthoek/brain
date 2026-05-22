import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentLedger, readAgentTaskGraph } from '../adapters/agent-ledger.js';

test('readAgentTaskGraph returns the active agent task graph snapshot', () => {
  const graph = readAgentTaskGraph();

  assert.equal(graph.id, 'agent-task-graph');
  assert.equal(graph.status, 'read-only');
  assert.equal(graph.taskCount, graph.tasks.length);
  assert.ok(graph.tasks.some((task) => task.taskId === '0C-C'));
  assert.ok(graph.tasks.some((task) => task.taskId === '0C-D'));
  assert.ok(graph.tasks.every((task) => typeof task.title === 'string' && task.title.length > 0));
});

test('readAgentLedger returns a derived read-only ledger snapshot', () => {
  const ledger = readAgentLedger();

  assert.equal(ledger.id, 'agent-ledger');
  assert.equal(ledger.status, 'read-only');
  assert.equal(ledger.runCount, ledger.runs.length);
  assert.equal(ledger.eventCount, ledger.events.length);
  assert.equal(ledger.taskCount, ledger.taskGraph.taskCount);
  assert.ok(ledger.approvalIds.length >= 0);
  assert.ok(ledger.persistence.path.includes('agent-ledger.json'));
});
