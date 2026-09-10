import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { verifyRuntimeProcessIdentity } from '../agent-mode/runtime-process-identity.js';
import { AgentModeSqliteStateStore, type AgentModeEffect } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-09T12:00:00.000Z';
const LATER = '2026-09-09T12:10:00.000Z';
const IDENTITY = { startedAt: 'fixture-start', command: 'brain-agent fixture', token: 'fixture-token' };

function admit(store: AgentModeSqliteStateStore, suffix = 'recovery'): void {
  store.admitAttempt({
    task: { taskId: `task:${suffix}`, taskType: 'agent-mode.recovery', inputHash: `hash:${suffix}`, createdAt: NOW },
    run: { runId: `run:${suffix}`, taskId: `task:${suffix}`, agentId: 'agent:worker', createdAt: NOW },
    attempt: { attemptId: `attempt:${suffix}`, runId: `run:${suffix}`, agentId: 'agent:worker', runtimeRef: 'runtime:test', routeRef: 'minimax.minimax-m2.5', modelRef: 'agent-mode/minimax-m2.5', policyVersion: 'test-policy', capabilityScopeHash: 'scope', budgetScopeId: `budget:${suffix}`, createdAt: NOW },
    budget: { budgetScopeId: `budget:${suffix}`, maxSteps: 4, maxTokens: 5000, maxDollars: 1 },
    estimate: { reservationId: `reservation:${suffix}`, steps: 1, tokens: 10, dollars: 0.001 },
    lease: { leaseId: `lease:${suffix}`, resourceKey: `resource:${suffix}`, ownerId: 'agent:worker', expiresAt: LATER },
    now: NOW,
  });
  store.setRunRuntimePid(`run:${suffix}`, 12345, IDENTITY);
}

function addEffect(store: AgentModeSqliteStateStore, suffix: string, status: AgentModeEffect['status']): void {
  store.recordEffect({ operationId: `operation:${suffix}`, attemptId: `attempt:${suffix}`, effectKind: 'test.effect', scopeHash: `scope:${suffix}`, status });
}

test('process-loss recovery matrix classifies all ten controller/runtime-loss fixtures', async () => {
  const cases: Array<{ name: string; setup?: (store: AgentModeSqliteStateStore, suffix: string) => void; expected: string }> = [
    { name: 'no effect', expected: 'safe_to_resume' },
    { name: 'model outbox before invocation', setup: (store, suffix) => addEffect(store, suffix, 'prepared'), expected: 'safe_to_resume' },
    { name: 'model result persistence', setup: (store, suffix) => addEffect(store, suffix, 'succeeded'), expected: 'already_completed' },
    { name: 'tool before dispatch', setup: (store, suffix) => addEffect(store, suffix, 'prepared'), expected: 'safe_to_resume' },
    { name: 'tool after dispatch receipt known', setup: (store, suffix) => addEffect(store, suffix, 'succeeded'), expected: 'already_completed' },
    { name: 'possible external effect without receipt', setup: (store, suffix) => addEffect(store, suffix, 'effect_applied'), expected: 'uncertain_non_idempotent_effect' },
    { name: 'paused', setup: (store, suffix) => { store.pauseRun(`run:${suffix}`, LATER); }, expected: 'safe_to_resume' },
    { name: 'cancellation requested', setup: (store, suffix) => { store.requestCancellation({ requestId: `cancel:${suffix}`, attemptId: `attempt:${suffix}`, requestedAt: LATER }); }, expected: 'cancelled_ack_pending' },
    { name: 'runtime child unexpected exit', setup: (store, suffix) => { store.recordEvent({ eventId: `child-exit:${suffix}`, entityType: 'run', entityId: `run:${suffix}`, eventType: 'runtime_child_exited', occurredAt: LATER, payload: { unexpected: true } }); }, expected: 'safe_to_resume' },
    { name: 'stale metadata with no owned process', setup: (store, suffix) => { assert.equal(verifyRuntimeProcessIdentity(12345, `run:${suffix}`, { ...IDENTITY, token: 'wrong' }), false); }, expected: 'safe_to_resume' },
  ];

  for (const [index, fixture] of cases.entries()) {
    const root = await mkdtemp(`/tmp/brain-agent-recovery-${index}-`);
    const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
    const suffix = `case-${index}`;
    try {
      admit(store, suffix);
      fixture.setup?.(store, suffix);
      assert.equal(store.markControllerLost(`run:${suffix}`, LATER, fixture.name), 'created', fixture.name);
      assert.equal(store.classifyRecovery(`attempt:${suffix}`, LATER), fixture.expected, fixture.name);
      if (fixture.name === 'paused') assert.equal(store.getRun(`run:${suffix}`)?.status, 'paused');
      assert.equal(store.getRun(`run:${suffix}`)?.runtimePid, undefined, fixture.name);
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('safe re-admission preserves lineage and rotates the fencing token', async () => {
  const root = await mkdtemp('/tmp/brain-agent-readmission-');
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  try {
    admit(store, 'readmit');
    store.markControllerLost('run:readmit', LATER, 'controller exited');
    const lease = store.reAdmitRun('run:readmit', { runtimePid: 12346, runtimeIdentity: { ...IDENTITY, token: 'fresh-token' }, lease: { leaseId: 'lease:readmit-2', resourceKey: 'resource:readmit', ownerId: 'agent:worker-recovery', expiresAt: '2026-09-09T13:00:00.000Z' }, now: LATER, accessEvidenceValid: true });
    assert.equal(lease.fence, 2);
    assert.deepEqual([store.getTask('task:readmit')?.taskId, store.getRun('run:readmit')?.runId, store.getAttempt('attempt:readmit')?.attemptId], ['task:readmit', 'run:readmit', 'attempt:readmit']);
    assert.equal(store.getRun('run:readmit')?.runtimePid, 12346);
    assert.equal(store.getAttempt('attempt:readmit')?.leaseFence, 2);
    assert.equal(store.listEvents('run:readmit').at(-1)?.eventType, 'attempt_readmitted_after_process_loss');
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('re-admission fails closed for access, effects, cancellation, budget, and live old lease', async () => {
  const fixtures: Array<{ name: string; setup: (store: AgentModeSqliteStateStore) => void; message: string }> = [
    { name: 'access', setup: () => {}, message: 'fresh access evidence' },
    { name: 'uncertain-effect', setup: (store) => addEffect(store, 'deny', 'uncertain'), message: 'not safe to resume' },
    { name: 'cancellation', setup: (store) => { store.requestCancellation({ requestId: 'cancel:deny', attemptId: 'attempt:deny', requestedAt: LATER }); }, message: 'not safe to resume' },
    { name: 'budget', setup: (store) => { store.settleBudget({ reservationId: 'reservation:deny', steps: 1, tokens: 10, dollars: 0.001, settledAt: LATER }); }, message: 'budget reservation' },
    { name: 'live-lease', setup: () => {}, message: 'not safe to resume' },
  ];
  for (const fixture of fixtures) {
    const root = await mkdtemp(`/tmp/brain-agent-readmission-deny-${fixture.name}-`);
    const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
    try {
      admit(store, 'deny');
      if (fixture.name !== 'live-lease') store.markControllerLost('run:deny', LATER, fixture.name);
      fixture.setup(store);
      const input = { runtimePid: 12346, runtimeIdentity: { ...IDENTITY, token: 'fresh-token' }, lease: { leaseId: 'lease:deny-2', resourceKey: 'resource:deny', ownerId: 'agent:worker-recovery', expiresAt: '2026-09-09T13:00:00.000Z' }, now: LATER, accessEvidenceValid: fixture.name !== 'access' };
      assert.throws(() => store.reAdmitRun('run:deny', input), new RegExp(fixture.message));
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  }
});
