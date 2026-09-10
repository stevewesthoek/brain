import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-09T12:00:00.000Z';

function admit(store: AgentModeSqliteStateStore): void {
  store.admitAttempt({
    task: { taskId: 'task:controls', taskType: 'agent-mode.controls', inputHash: 'hash', createdAt: NOW },
    run: { runId: 'run:controls', taskId: 'task:controls', agentId: 'agent:worker', createdAt: NOW },
    attempt: { attemptId: 'attempt:controls', runId: 'run:controls', agentId: 'agent:worker', runtimeRef: 'runtime:test', routeRef: 'minimax.minimax-m2.5', modelRef: 'agent-mode/minimax-m2.5', policyVersion: 'test-policy', capabilityScopeHash: 'scope', budgetScopeId: 'budget:controls', createdAt: NOW },
    budget: { budgetScopeId: 'budget:controls', maxSteps: 4, maxTokens: 5000, maxDollars: 1 },
    estimate: { reservationId: 'reservation:controls', steps: 1, tokens: 10, dollars: 0.001 },
    lease: { leaseId: 'lease:controls', resourceKey: 'resource:controls', ownerId: 'agent:worker', expiresAt: '2026-09-09T13:00:00.000Z' },
    now: NOW,
  });
  store.setRunRuntimePid('run:controls', 12345, { startedAt: 'fixture', command: 'brain-agent fixture', token: 'fixture-token' });
}

test('pause and resume are durable run controls', async () => {
  const root = await mkdtemp('/tmp/brain-agent-controls-');
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  try {
    admit(store);
    assert.equal(store.pauseRun('run:controls', '2026-09-09T12:01:00.000Z'), 'created');
    assert.equal(store.getRun('run:controls')?.status, 'paused');
    assert.equal(store.getAttempt('attempt:controls')?.status, 'paused');
    assert.equal(store.resumeRun('run:controls', '2026-09-09T12:02:00.000Z'), 'created');
    assert.equal(store.getRun('run:controls')?.status, 'active');
    assert.equal(store.getAttempt('attempt:controls')?.status, 'running');
    assert.deepEqual(store.listEvents('run:controls').map((event) => event.eventType), ['run_paused', 'run_resumed']);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('cancel and kill are durable terminal controls with audit events', async () => {
  const root = await mkdtemp('/tmp/brain-agent-controls-');
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  try {
    admit(store);
    assert.equal(store.cancelRun('run:controls', '2026-09-09T12:03:00.000Z'), 'created');
    assert.equal(store.getRun('run:controls')?.status, 'active');
    assert.equal(store.getTask('task:controls')?.status, 'admitted');
    assert.equal(store.getAttempt('attempt:controls')?.status, 'admitted');
    assert.equal(store.getAttempt('attempt:controls')?.cancellationStatus, 'requested');
    assert.equal(store.getRun('run:controls')?.runtimePid, 12345);
    assert.deepEqual(store.listEvents('run:controls').map((event) => event.eventType), ['run_cancel_requested']);

    const secondRoot = await mkdtemp('/tmp/brain-agent-controls-');
    const secondPath = path.join(secondRoot, 'agent-mode.db');
    const second = new AgentModeSqliteStateStore(secondPath);
    try {
      admit(second);
      assert.equal(second.cancelRun('run:controls', '2026-09-09T12:04:00.000Z', 'kill'), 'created');
      assert.equal(second.getRun('run:controls')?.status, 'cancelled');
      assert.equal(second.listEvents('run:controls').at(-1)?.eventType, 'run_killed');
    } finally {
      second.close();
      await rm(secondRoot, { recursive: true, force: true });
    }
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('brain-agent CLI exposes inspect, pause, resume, cancel, and kill from another terminal', async () => {
  const root = await mkdtemp('/tmp/brain-agent-cli-controls-');
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  admit(store);
  store.close();
  const cli = path.resolve('src/bin/brain-agent.ts');
  const tsx = path.resolve('node_modules/.bin/tsx');
  const env = { ...process.env, BRAIN_AGENT_MODE_DATABASE: databasePath };
  const invoke = (action: string): Record<string, unknown> => JSON.parse(execFileSync(tsx, [cli, action, 'run:controls'], { env, encoding: 'utf8' })) as Record<string, unknown>;
  try {
    assert.equal(invoke('inspect').run && typeof invoke('inspect').run, 'object');
    assert.equal(invoke('pause').status, 'paused');
    assert.equal(invoke('resume').status, 'paused');
    assert.equal(invoke('resume').recovery, 're-admission_required');
    assert.equal(invoke('cancel').status, 'cancelled');
    assert.equal(invoke('kill').status, 'cancelled');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
