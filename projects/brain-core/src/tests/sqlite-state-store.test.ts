import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { OperationReceipt } from '../agent-mode/agent-mode-contracts.js';
import {
  AgentModeSqliteStateStore,
  type AgentModeAdmission,
  type AgentModeAttemptInput,
  type AgentModeBudgetSettlement,
  type AgentModeTask,
} from '../agent-mode/sqlite-state-store.js';

const T0 = '2026-09-08T00:00:00.000Z';
const T1 = '2026-09-08T00:01:00.000Z';
const T2 = '2026-09-08T00:02:00.000Z';
const EXPIRY = '2026-09-09T00:00:00.000Z';

function withDatabase(callback: (store: AgentModeSqliteStateStore, reopen: () => AgentModeSqliteStateStore) => void): void {
  const root = mkdtempSync(path.join('/tmp', 'brain-agent-mode-k02-'));
  const stores: AgentModeSqliteStateStore[] = [];
  const open = () => {
    const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
    stores.push(store);
    return store;
  };
  try {
    callback(open(), open);
  } finally {
    for (const store of stores) {
      try { store.close(); } catch { /* already closed by a fixture */ }
    }
    rmSync(root, { recursive: true, force: true });
  }
}

function admission(suffix = 'one', overrides: Partial<AgentModeAdmission> = {}): AgentModeAdmission {
  const task: AgentModeTask = {
    taskId: `task:${suffix}`,
    taskType: 'fixture.read',
    inputHash: `input:${suffix}`,
    createdAt: T0,
  };
  const run = {
    runId: `run:${suffix}`,
    taskId: task.taskId,
    agentId: 'agent:worker',
    createdAt: T0,
  };
  const attempt: AgentModeAttemptInput = {
    attemptId: `attempt:${suffix}`,
    runId: run.runId,
    agentId: run.agentId,
    runtimeRef: 'runtime:fixture',
    routeRef: 'amazon-bedrock/agent-mode/glm-5',
    modelRef: 'agent-mode/glm-5',
    policyVersion: 'agent-mode-policy-v1',
    capabilityScopeHash: `scope:${suffix}`,
    budgetScopeId: `budget:${suffix}`,
    createdAt: T0,
  };
  const base: AgentModeAdmission = {
    task,
    run,
    attempt,
    budget: { budgetScopeId: `budget:${suffix}`, maxSteps: 5, maxTokens: 100, maxDollars: 1 },
    estimate: { reservationId: `reservation:${suffix}`, steps: 3, tokens: 60, dollars: 0.5 },
    lease: { leaseId: `lease:${suffix}`, resourceKey: `resource:${suffix}`, ownerId: 'node:office', expiresAt: EXPIRY },
    now: T0,
  };
  const budgetScopeId = overrides.budget?.budgetScopeId ?? overrides.attempt?.budgetScopeId ?? base.budget.budgetScopeId;
  return {
    ...base,
    ...overrides,
    task: { ...base.task, ...overrides.task },
    run: { ...base.run, ...overrides.run },
    attempt: { ...base.attempt, ...overrides.attempt, budgetScopeId },
    budget: { ...base.budget, ...overrides.budget },
    estimate: { ...base.estimate, ...overrides.estimate },
    lease: { ...base.lease, ...overrides.lease },
  };
}

function operation(a: AgentModeAdmission, operationId = `operation:${a.attempt.attemptId}`) {
  return {
    operationId,
    attemptId: a.attempt.attemptId,
    effectKind: 'capability.read' as const,
    capabilityId: 'capability:fixture-read',
    scopeHash: a.attempt.capabilityScopeHash,
    policyVersion: a.attempt.policyVersion,
    leaseResourceKey: a.lease.resourceKey,
    leaseId: a.lease.leaseId,
    leaseFence: 1,
    deadline: EXPIRY,
    preparedAt: T1,
  };
}

function receipt(a: AgentModeAdmission, effectHash = 'effect:one', status: OperationReceipt['status'] = 'succeeded', operationId = `operation:${a.attempt.attemptId}`): OperationReceipt {
  return {
    operationId,
    attemptId: a.attempt.attemptId,
    scopeHash: a.attempt.capabilityScopeHash,
    effectHash,
    status,
    recordedAt: T2,
  };
}

test('K0.1 state survives reopen and K0.2 admission atomically correlates all records', () => {
  withDatabase((store, reopen) => {
    const a = admission();
    assert.equal(store.schemaVersion, 2);
    assert.equal(store.admitAttempt(a), 'created');
    assert.equal(store.admitAttempt(a), 'duplicate');
    assert.equal(store.createTask(a.task), 'duplicate');
    assert.equal(store.createRun(a.run), 'duplicate');
    assert.equal(store.createAttempt(a.attempt), 'duplicate');
    assert.equal(store.createAttempt({ ...a.attempt, modelRef: 'agent-mode/other-model' }), 'conflict');
    assert.equal(store.createTask({ ...a.task, inputHash: 'input:conflict' }), 'conflict');
    assert.equal(store.getAttempt(a.attempt.attemptId)?.status, 'admitted');

    store.close();
    const reopened = reopen();
    assert.equal(reopened.getTask(a.task.taskId)?.status, 'admitted');
    assert.equal(reopened.getRun(a.run.runId)?.status, 'active');
    assert.equal(reopened.getAttempt(a.attempt.attemptId)?.leaseFence, 1);
    assert.deepEqual(reopened.getBudget(a.budget.budgetScopeId), {
      ...a.budget,
      usedSteps: 0,
      reservedSteps: 3,
      usedTokens: 0,
      reservedTokens: 60,
      usedDollars: 0,
      reservedDollars: 0.5,
    });
    assert.deepEqual(reopened.listEvents(a.attempt.attemptId).map((event) => event.eventType), ['attempt_admitted']);
  });
});

test('budget reservations prevent oversubscription and settle exactly once', () => {
  withDatabase((store) => {
    const first = admission('one');
    assert.equal(store.admitAttempt(first), 'created');
    const second = admission('two', {
      budget: first.budget,
      estimate: { reservationId: 'reservation:two', steps: 3, tokens: 60, dollars: 0.5 },
    });
    assert.throws(() => store.admitAttempt(second), /budget exhausted/);
    assert.equal(store.getAttempt(second.attempt.attemptId), undefined);
    const settlement: AgentModeBudgetSettlement = {
      reservationId: first.estimate.reservationId,
      steps: 2,
      tokens: 40,
      dollars: 0.25,
      settledAt: T2,
    };
    assert.equal(store.settleBudget(settlement), 'created');
    assert.equal(store.settleBudget(settlement), 'duplicate');
    assert.equal(store.settleBudget({ ...settlement, dollars: 0.3 }), 'conflict');
    assert.deepEqual(store.getBudget(first.budget.budgetScopeId), {
      ...first.budget,
      usedSteps: 2,
      reservedSteps: 0,
      usedTokens: 40,
      reservedTokens: 0,
      usedDollars: 0.25,
      reservedDollars: 0,
    });
    assert.equal(store.admitAttempt(second), 'created');
  });
});

test('effect preparation is durable before dispatch and idempotent', () => {
  withDatabase((store, reopen) => {
    const a = admission();
    store.admitAttempt(a);
    const prepared = operation(a);
    assert.equal(store.prepareOperation(prepared), 'created');
    assert.equal(store.prepareOperation(prepared), 'duplicate');
    assert.equal(store.prepareOperation({ ...prepared, scopeHash: 'scope:conflict' }), 'conflict');
    assert.equal(store.getOutbox(prepared.operationId)?.state, 'dispatchable');
    assert.equal(store.markDispatched(prepared.operationId, T1), 'created');
    assert.equal(store.markDispatched(prepared.operationId, T2), 'duplicate');
    store.close();
    const reopened = reopen();
    assert.equal(reopened.getOutbox(prepared.operationId)?.state, 'dispatched');
    assert.equal(reopened.getEffect(prepared.operationId)?.status, 'dispatched');
  });
});

test('receipt and settlement commit together; duplicates and conflicts remain explicit', () => {
  withDatabase((store) => {
    const a = admission();
    store.admitAttempt(a);
    const prepared = operation(a);
    store.prepareOperation(prepared);
    store.markDispatched(prepared.operationId, T1);
    const successfulReceipt = receipt(a);
    assert.equal(store.recordReceipt(successfulReceipt, {
      reservationId: a.estimate.reservationId,
      steps: 1,
      tokens: 20,
      dollars: 0.1,
      settledAt: T2,
    }), 'recorded');
    assert.equal(store.recordReceipt(successfulReceipt), 'duplicate');
    assert.equal(store.recordReceipt(receipt(a, 'effect:two')), 'conflict');
    assert.equal(store.getEffect(prepared.operationId)?.status, 'uncertain');
    assert.equal(store.getOutbox(prepared.operationId)?.state, 'uncertain');
    assert.deepEqual(store.listReceipts(prepared.operationId).map((item) => item.state), ['accepted', 'conflict']);
    assert.deepEqual(store.listEvents(prepared.operationId).map((event) => event.eventType), [
      'operation_prepared',
      'operation_dispatched',
      'receipt_recorded',
      'receipt_conflict',
    ]);
    assert.equal(store.getReservation(a.estimate.reservationId)?.status, 'settled');
  });
});

test('stale fenced writers are rejected while late receipts are retained as stale evidence', () => {
  withDatabase((store) => {
    const a = admission();
    store.admitAttempt(a);
    const prepared = operation(a);
    store.prepareOperation(prepared);
    store.markDispatched(prepared.operationId, T1);
    assert.equal(store.releaseLease(a.lease.resourceKey, a.lease.leaseId, 1), true);
    assert.equal(store.acquireLease({ leaseId: 'lease:new', resourceKey: a.lease.resourceKey, ownerId: 'node:new', expiresAt: EXPIRY })?.fence, 2);
    assert.throws(() => store.prepareOperation({ ...prepared, operationId: 'operation:stale' }), /stale lease fence/);
    assert.equal(store.recordReceipt(receipt(a)), 'stale');
    assert.equal(store.getEffect(prepared.operationId)?.status, 'dispatched');
    assert.deepEqual(store.listReceipts(prepared.operationId).map((item) => item.state), ['stale']);
    assert.equal(store.classifyRecovery(a.attempt.attemptId, T2), 'stale_fenced_writer');
  });
});

test('K0.1 effect primitive remains idempotent across the extended schema', () => {
  withDatabase((store) => {
    const effect = {
      operationId: 'operation:legacy',
      attemptId: 'attempt:legacy',
      effectKind: 'capability.read',
      scopeHash: 'scope:legacy',
      status: 'effect_applied' as const,
    };
    assert.equal(store.recordEffect(effect), 'created');
    assert.equal(store.recordEffect(effect), 'duplicate');
    assert.equal(store.recordEffect({ ...effect, scopeHash: 'scope:other' }), 'conflict');
    assert.equal(store.getEffect(effect.operationId)?.status, 'effect_applied');
  });
});

test('cancellation request remains distinct from acknowledgement and is restart-safe', () => {
  withDatabase((store, reopen) => {
    const a = admission();
    store.admitAttempt(a);
    const request = { requestId: 'cancel:one', attemptId: a.attempt.attemptId, requestedAt: T1 };
    assert.equal(store.requestCancellation(request), 'created');
    assert.equal(store.requestCancellation(request), 'duplicate');
    assert.equal(store.requestCancellation({ ...request, requestId: 'cancel:conflict', requestedAt: T2 }), 'duplicate');
    assert.throws(() => store.prepareOperation(operation(a, 'operation:cancelled')), /cancellation requested/);
    store.close();
    const reopened = reopen();
    assert.equal(reopened.classifyRecovery(a.attempt.attemptId, T2), 'cancelled_ack_pending');
    assert.throws(() => reopened.finishAttempt(a.attempt.attemptId, 'cancelled', T2), /acknowledgement/);
    assert.equal(reopened.acknowledgeCancellation(a.attempt.attemptId, T2), 'created');
    assert.equal(reopened.acknowledgeCancellation(a.attempt.attemptId, T2), 'duplicate');
    assert.equal(reopened.finishAttempt(a.attempt.attemptId, 'cancelled', T2), 'created');
    assert.equal(reopened.classifyRecovery(a.attempt.attemptId, T2), 'already_completed');
  });
});

test('injected admission and preparation failures roll back and prevent unsafe progression', () => {
  withDatabase((store) => {
    const a = admission();
    store.injectPersistenceFailureOnce('admission');
    assert.throws(() => store.admitAttempt(a), /injected persistence failure/);
    assert.equal(store.getTask(a.task.taskId), undefined);
    assert.equal(store.getAttempt(a.attempt.attemptId), undefined);
    assert.equal(store.admitAttempt(a), 'created');

    const prepared = operation(a);
    store.injectPersistenceFailureOnce('effect-preparation');
    assert.throws(() => store.prepareOperation(prepared), /injected persistence failure/);
    assert.equal(store.getEffect(prepared.operationId), undefined);
    assert.equal(store.getOutbox(prepared.operationId), undefined);
    assert.equal(store.prepareOperation(prepared), 'created');
  });
});

test('deterministic crash fixtures produce safe recovery classifications after reopen', () => {
  withDatabase((store, reopen) => {
    const before = admission('before');
    store.createTask(before.task);
    store.createRun(before.run);
    store.createAttempt(before.attempt);
    store.close();
    let current = reopen();
    assert.equal(current.classifyRecovery(before.attempt.attemptId, T0), 'safe_to_resume');

    const admissionCrash = admission('admission-crash');
    current.injectPersistenceFailureOnce('admission');
    assert.throws(() => current.admitAttempt(admissionCrash), /injected persistence failure/);
    current.close();
    current = reopen();
    assert.equal(current.getAttempt(admissionCrash.attempt.attemptId), undefined);
    assert.equal(current.admitAttempt(admissionCrash), 'created');
    assert.equal(current.classifyRecovery(admissionCrash.attempt.attemptId, T0), 'safe_to_resume');

    const committed = admission('committed');
    current.admitAttempt(committed);
    current.close();
    current = reopen();
    assert.equal(current.classifyRecovery(committed.attempt.attemptId, T0), 'safe_to_resume');

    const outbox = admission('outbox');
    current.admitAttempt(outbox);
    const outboxOperation = operation(outbox);
    current.prepareOperation(outboxOperation);
    current.close();
    current = reopen();
    assert.equal(current.getOutbox(outboxOperation.operationId)?.state, 'dispatchable');
    assert.equal(current.classifyRecovery(outbox.attempt.attemptId, T1), 'safe_to_resume');

    const effect = admission('effect');
    current.admitAttempt(effect);
    const effectOperation = operation(effect);
    current.prepareOperation(effectOperation);
    current.markDispatched(effectOperation.operationId, T1);
    current.markEffectObserved(effectOperation.operationId, T2);
    current.close();
    current = reopen();
    assert.equal(current.classifyRecovery(effect.attempt.attemptId, T2), 'uncertain_non_idempotent_effect');

    const receiptCrash = admission('receipt-crash');
    current.admitAttempt(receiptCrash);
    const receiptCrashOperation = operation(receiptCrash);
    current.prepareOperation(receiptCrashOperation);
    current.markDispatched(receiptCrashOperation.operationId, T1);
    current.injectPersistenceFailureOnce('receipt');
    assert.throws(() => current.recordReceipt(receipt(receiptCrash)), /injected persistence failure/);
    current.close();
    current = reopen();
    assert.equal(current.getReceipt(receiptCrashOperation.operationId), undefined);
    assert.equal(current.classifyRecovery(receiptCrash.attempt.attemptId, T2), 'awaiting_receipt_reconciliation');

    const acknowledged = admission('acknowledged');
    current.admitAttempt(acknowledged);
    const acknowledgedOperation = operation(acknowledged);
    current.prepareOperation(acknowledgedOperation);
    current.markDispatched(acknowledgedOperation.operationId, T1);
    current.recordReceipt(receipt(acknowledged));
    current.close();
    current = reopen();
    assert.equal(current.classifyRecovery(acknowledged.attempt.attemptId, T2), 'already_completed');

    const settlementCrash = admission('settlement-crash');
    current.admitAttempt(settlementCrash);
    const settlementOperation = operation(settlementCrash);
    current.prepareOperation(settlementOperation);
    current.markDispatched(settlementOperation.operationId, T1);
    current.injectPersistenceFailureOnce('budget-settlement');
    assert.throws(() => current.recordReceipt(receipt(settlementCrash), {
      reservationId: settlementCrash.estimate.reservationId,
      steps: 1,
      tokens: 20,
      dollars: 0.1,
      settledAt: T2,
    }), /injected persistence failure/);
    current.close();
    current = reopen();
    assert.equal(current.getReservation(settlementCrash.estimate.reservationId)?.status, 'reserved');
    assert.equal(current.classifyRecovery(settlementCrash.attempt.attemptId, T2), 'awaiting_receipt_reconciliation');

    const cancelled = admission('cancelled');
    current.admitAttempt(cancelled);
    current.requestCancellation({ requestId: 'cancel:crash', attemptId: cancelled.attempt.attemptId, requestedAt: T1 });
    current.close();
    current = reopen();
    assert.equal(current.classifyRecovery(cancelled.attempt.attemptId, T2), 'cancelled_ack_pending');
  });
});

test('finishAttempt requires cancellation acknowledgement and records terminal recovery states', () => {
  withDatabase((store) => {
    const completed = admission('completed');
    store.admitAttempt(completed);
    assert.equal(store.finishAttempt(completed.attempt.attemptId, 'completed', T1), 'created');
    assert.equal(store.finishAttempt(completed.attempt.attemptId, 'completed', T2), 'duplicate');
    assert.equal(store.classifyRecovery(completed.attempt.attemptId, T2), 'already_completed');

    const failed = admission('failed');
    store.admitAttempt(failed);
    assert.equal(store.finishAttempt(failed.attempt.attemptId, 'failed', T1), 'created');
    assert.equal(store.classifyRecovery(failed.attempt.attemptId, T2), 'terminal_failure');

    const cancelled = admission('terminal-cancel');
    store.admitAttempt(cancelled);
    assert.throws(() => store.finishAttempt(cancelled.attempt.attemptId, 'cancelled', T1), /acknowledgement/);
    store.requestCancellation({ requestId: 'cancel:terminal', attemptId: cancelled.attempt.attemptId, requestedAt: T1 });
    store.acknowledgeCancellation(cancelled.attempt.attemptId, T2);
    assert.equal(store.finishAttempt(cancelled.attempt.attemptId, 'cancelled', T2), 'created');
    assert.equal(store.classifyRecovery(cancelled.attempt.attemptId, T2), 'already_completed');
  });
});
