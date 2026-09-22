import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CHILD_ASSIGNMENT_SCHEMA_VERSION,
  DEFERRED_MODEL_REF,
  DEFERRED_ROUTE_REF,
  MOCK_AGENT_RUNTIME_PROFILE_REF,
  MOCK_AGENT_RUNTIME_REF,
  type AgentModeChildAssignmentRequest,
} from '../agent-mode/child-assignment.js';
import { AgentModeRuntimeDispatcher, RUNTIME_DISPATCH_SCHEMA_VERSION, type AgentModeRuntimeDispatchRequest } from '../agent-mode/runtime-dispatch.js';
import { runtimeReceiptEffectHash, type AgentModeRuntimeReceipt, type AgentRuntimeExecutionContext } from '../agent-mode/runtime-dispatch.js';
import { MockAgentRuntime, type MockAgentRuntimeFixture } from '../agent-mode/mock-agent-runtime.js';
import { evaluateSpawnAdmission, SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY, type SpawnAuthorityFacts, type SpawnRequest } from '../agent-mode/spawn-policy.js';
import { AgentModeSqliteStateStore, type AgentModeSpawnCreationInput } from '../agent-mode/sqlite-state-store.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { WORKCELL_READ_CAPABILITY } from '../agent-mode/workcell.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';

const now = '2026-09-10T10:00:01.000Z';
const rootDeadline = '2026-09-10T11:00:00.000Z';
const childDeadline = '2026-09-10T10:00:30.000Z';

function spawnRequest(rootGoalId = 'goal:runtime', eventId = 'event:runtime', overrides: Partial<SpawnRequest> = {}): SpawnRequest {
  return {
    schemaVersion: 1, requestId: `request:${eventId}`, policyId: SPAWN_POLICY_READ_ONLY, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, sourceId: 'source:git', sourceEventId: eventId,
    sourceType: GIT_REPOSITORY_REVISION_SOURCE, eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, eventRootGoalId: rootGoalId,
    eventScope: { repositoryRef: 'brain', resourceRef: null }, parentAgentId: null, parentTaskId: null, parentRunId: null,
    rootGoalId, requestedScope: { repositoryRef: 'brain', resourceRef: null }, requestedCapabilities: [WORKCELL_READ_CAPABILITY],
    requestedTtl: 60_000, requestedStepBudget: 10, requestedCostBudget: 0.1, requestedAt: now, deadline: rootDeadline, requestedDepth: 1,
    ...overrides,
  };
}

function spawnFacts(rootGoalId: string): SpawnAuthorityFacts {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active', remainingSteps: 1000, remainingBudget: 2, deadline: rootDeadline, delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: null,
  };
}

function createChildInput(rootGoalId = 'goal:runtime', eventId = 'event:runtime'): AgentModeSpawnCreationInput {
  const request = spawnRequest(rootGoalId, eventId);
  const facts = spawnFacts(rootGoalId);
  const admission = evaluateSpawnAdmission(request, facts);
  assert.equal(admission.result, 'ALLOW');
  return { request, facts, admission };
}

function assignmentRequest(childAgentId: string, overrides: Partial<AgentModeChildAssignmentRequest> = {}): AgentModeChildAssignmentRequest {
  return {
    schemaVersion: CHILD_ASSIGNMENT_SCHEMA_VERSION, assignmentId: 'assignment:runtime', childAgentId, rootGoalId: 'goal:runtime',
    taskSpecRef: 'task-spec:runtime', sourceEventId: 'event:assignment', runtimeRef: MOCK_AGENT_RUNTIME_REF,
    runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF, requestedSteps: 5, requestedCostCeiling: 0.05,
    requestedCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScope: 'brain', resourceScope: null,
    deadline: childDeadline, requestedAt: now, ...overrides,
  };
}

function withStore<T>(fn: (store: AgentModeSqliteStateStore, databasePath: string) => Promise<T> | T): Promise<T> | T {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42d1-runtime-'));
  const databasePath = path.join(directory, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  const finish = (): void => { try { store.close(); } catch { /* already closed for restart tests */ } rmSync(directory, { recursive: true, force: true }); };
  try {
    const result = fn(store, databasePath);
    return result instanceof Promise ? result.finally(finish) : (finish(), result);
  } catch (error) { finish(); throw error; }
}

function fixture(overrides: Partial<NonNullable<MockAgentRuntimeFixture['dispatch']>> = {}): MockAgentRuntimeFixture {
  return {
    runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:fixture', modelRef: DEFERRED_MODEL_REF,
    modelResult: { kind: 'typed-fixture-result', traceId: 'trace:runtime', intent: { kind: 'repo.read', relativePath: 'README.md' } },
    dispatch: overrides,
  };
}

function setup(store: AgentModeSqliteStateStore, fixtureOverrides: Partial<NonNullable<MockAgentRuntimeFixture['dispatch']>> = {}, rootGoalId = 'goal:runtime') {
  const spawned = store.reserveSpawnAndCreateChild(createChildInput(rootGoalId, `event:${rootGoalId}`));
  assert.equal(spawned.result, 'created');
  if (spawned.result !== 'created') throw new Error('child setup failed');
  const assignment = store.assignChildAgent(assignmentRequest(spawned.receipt.childAgentId, { rootGoalId }));
  assert.equal(assignment.result, 'assigned', JSON.stringify(assignment));
  if (assignment.result !== 'assigned') throw new Error('assignment setup failed');
  const request: AgentModeRuntimeDispatchRequest = {
    schemaVersion: RUNTIME_DISPATCH_SCHEMA_VERSION, dispatchId: 'dispatch:runtime', operationId: 'operation:runtime',
    assignmentIntentKey: assignment.receipt.assignmentIntentKey, childAgentId: assignment.receipt.childAgentId,
    taskId: assignment.receipt.taskId, runId: assignment.receipt.runId, attemptId: assignment.receipt.attemptId,
    runtimeRef: MOCK_AGENT_RUNTIME_REF, runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF, controllerRef: 'controller:runtime', requestedAt: now,
  };
  const runtime = new MockAgentRuntime(fixture(fixtureOverrides));
  return { request, runtime, dispatcher: new AgentModeRuntimeDispatcher(store, runtime), assignment: assignment.receipt };
}

function manualReceipt(request: AgentModeRuntimeDispatchRequest, prepared: { leaseId: string; fence: number }, status: 'succeeded' | 'failed' | 'cancelled' = 'succeeded'): AgentModeRuntimeReceipt {
  const base = {
    receiptId: `runtime-receipt:manual:${status}`, operationId: request.operationId, dispatchId: request.dispatchId,
    assignmentIntentKey: request.assignmentIntentKey, childAgentId: request.childAgentId, attemptId: request.attemptId,
    runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef, leaseId: prepared.leaseId, fence: prepared.fence,
    resultHash: 'a'.repeat(64), evidenceRef: 'evidence:manual', status, usage: { steps: 0, tokens: 0, cost: 0 }, traceSummary: [],
    ...(status === 'failed' ? { failureCode: 'MANUAL_FAILURE' } : {}), ...(status === 'cancelled' ? { cancellationObserved: true } : {}), recordedAt: now,
  } satisfies Omit<AgentModeRuntimeReceipt, 'effectHash'>;
  return { ...base, effectHash: runtimeReceiptEffectHash(base) };
}

test('D1 succeeds through exactly one bounded MockAgentRuntime invocation', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'succeeded', JSON.stringify(result)); assert.equal(state.runtime.dispatchInvocationCount, 1);
  assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'completed');
  assert.equal(store.getRun(state.assignment.runId)?.status, 'completed'); assert.equal(store.getTask(state.assignment.taskId)?.status, 'completed');
  assert.equal(store.getAgent(state.assignment.childAgentId)?.status, 'completed'); assert.equal(store.getChildAssignment(state.assignment.childAgentId)?.status, 'completed');
  assert.equal(store.getReservation(state.assignment.reservationId)?.status, 'settled');
  assert.equal(store.getSpawnRootState('goal:runtime')?.activeChildren, 0);
}));

test('D1 persists one generic outbox, effect, receipt, verification, and settlement trail', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'succeeded');
  assert.equal(store.listEffects().length, 1); assert.equal(store.listDispatchOutbox().length, 1); assert.equal(store.listReceipts(state.request.operationId).length, 1);
  assert.equal(store.listEffects()[0]?.status, 'succeeded'); assert.equal(store.listDispatchOutbox()[0]?.state, 'verified');
  const eventTypes = store.listEvents(state.assignment.attemptId).map((event) => event.eventType);
  assert.ok(eventTypes.includes('runtime_dispatch_prepared')); assert.ok(eventTypes.includes('runtime_started')); assert.ok(eventTypes.includes('runtime_receipt_recorded')); assert.ok(eventTypes.includes('runtime_verified')); assert.ok(eventTypes.includes('runtime_completed'));
}));

test('D1 rejects invalid request before preparing durable state', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, operationId: '' });
  assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0); assert.equal(store.listEffects().length, 0);
}));

test('D1 rejects an assignment identity mismatch on fresh authority recheck', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, taskId: 'task:wrong' });
  assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0); assert.equal(store.listEffects().length, 0);
}));

test('D1 rejects a runtime/profile mismatch without invocation', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, runtimeProfileRef: 'runtime-profile:wrong' });
  assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 rejects a missing child and an already settled attempt', async () => withStore(async (store) => {
  const state = setup(store); const missing = await state.dispatcher.dispatch({ ...state.request, childAgentId: 'agent:missing' }); assert.equal(missing.result, 'denied');
  const done = await state.dispatcher.dispatch(state.request); assert.equal(done.result, 'succeeded'); const retry = await state.dispatcher.dispatch(state.request);
  assert.equal(retry.result, 'duplicate'); assert.equal(state.runtime.dispatchInvocationCount, 1);
}));

test('D1 fails closed on the global and root kill switches', async () => withStore(async (store) => {
  const first = setup(store); store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'stop', updatedAt: now });
  const denied = await first.dispatcher.dispatch(first.request); assert.equal(denied.result, 'denied'); assert.equal(first.runtime.dispatchInvocationCount, 0);
}));

test('D1 fails closed on root cancellation and child expiry', async () => withStore(async (store) => {
  const state = setup(store); store.setSpawnRootCancellation('goal:runtime', 'cancelled', now); const denied = await state.dispatcher.dispatch(state.request); assert.equal(denied.result, 'denied');
}));

test('D1 fails closed after child expiry reconciliation', async () => withStore(async (store) => {
  const state = setup(store); store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z'); const expired = await state.dispatcher.dispatch(state.request); assert.equal(expired.result, 'denied');
}));

test('D1 records failed runtime outcome without replacement or retry', async () => withStore(async (store) => {
  const state = setup(store, { status: 'failed', failureCode: 'FIXTURE_FAILURE' }); const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'failed'); assert.equal(state.runtime.dispatchInvocationCount, 1); assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'failed');
  assert.equal(store.getChildAssignment(state.assignment.childAgentId)?.status, 'failed'); const retry = await state.dispatcher.dispatch(state.request); assert.equal(retry.result, 'duplicate'); assert.equal(state.runtime.dispatchInvocationCount, 1);
}));

test('D1 cancellation observes a deterministic in-flight barrier and settles only after acknowledgement', async () => withStore(async (store) => {
  let started!: () => void; const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void; const checkpoint = new Promise<void>((resolve) => { release = resolve; });
  const state = setup(store, { started, checkpoint }); const pending = state.dispatcher.dispatch(state.request); await startedPromise;
  assert.equal(state.dispatcher.requestCancellation({ requestId: 'cancel:runtime', attemptId: state.assignment.attemptId, operationId: state.request.operationId, requestedAt: now }), 'created');
  assert.equal(store.getAttempt(state.assignment.attemptId)?.cancellationStatus, 'requested'); release(); const result = await pending;
  assert.equal(result.result, 'cancelled'); assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'cancelled'); assert.equal(store.getAttempt(state.assignment.attemptId)?.cancellationStatus, 'completed');
}));

test('D1 marks runtime invocation crash uncertain and never blindly replays it', async () => withStore(async (store) => {
  const state = setup(store, { crashAfterInvocation: true }); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'uncertain');
  assert.equal(state.runtime.dispatchInvocationCount, 1); assert.equal(store.getChildAssignment(state.assignment.childAgentId)?.status, 'uncertain');
  const retry = await state.dispatcher.dispatch(state.request); assert.equal(retry.result, 'uncertain'); assert.equal(state.runtime.dispatchInvocationCount, 1);
}));

test('D1 validates bounded results before receipt recording', async () => withStore(async (store) => {
  const state = setup(store); const invalidRuntime = { run: async () => ({ status: 'succeeded' as const, runtimeReceiptId: 'runtime-receipt:invalid', resultHash: 'not-a-hash', evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, traceSummary: [] }) }; const invalidDispatcher = new AgentModeRuntimeDispatcher(store, invalidRuntime); const result = await invalidDispatcher.dispatch(state.request);
  assert.equal(result.result, 'uncertain'); assert.equal(store.listReceipts(state.request.operationId).length, 0);
}));

test('D1 writes a lease and fence before runtime invocation', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready');
  if (prepared.result === 'ready') { assert.ok(prepared.prepared.leaseId); assert.ok(prepared.prepared.fence > 0); assert.equal(store.getLease(prepared.prepared.resourceKey)?.fence, prepared.prepared.fence); }
  assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 prepared-but-not-dispatched state resumes safely', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'succeeded'); assert.equal(state.runtime.dispatchInvocationCount, 1);
}));

test('D1 injected preparation failure leaves no durable dispatch intent', async () => withStore(async (store) => {
  const state = setup(store); store.injectPersistenceFailureOnce('effect-preparation'); const prepared = store.prepareRuntimeDispatch(state.request);
  assert.equal(prepared.result, 'denied'); assert.equal(store.listEffects().length, 0); assert.equal(store.listDispatchOutbox().length, 0); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 observer exposes bounded runtime dispatch state and no hidden trace', async () => withStore(async (store, databasePath) => {
  const state = setup(store); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'succeeded');
  const observer = readAgentModeObserver(now, databasePath);
  assert.equal(JSON.stringify(observer).includes('README.md'), false); assert.equal(JSON.stringify(observer).includes('typed-fixture-result'), false);
}));

test('D1 dispatch uses deferred model identity and never creates a Workcell', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'succeeded');
  assert.equal(store.getAttempt(state.assignment.attemptId)?.modelRef, DEFERRED_MODEL_REF); assert.equal(store.listWorkcells().length, 0); assert.equal(store.listRuns()[0]?.runtimePid, undefined); assert.equal(store.listRuns()[0]?.runtimeIdentity, undefined);
}));

test('D1 parent lineage is untouched while the child owns the runtime lease', async () => withStore(async (store) => {
  const state = setup(store); await state.dispatcher.dispatch(state.request); const leases = [store.getLease(`runtime-dispatch:${state.assignment.attemptId}`)]; assert.equal(leases.length, 1); assert.equal(store.getAttempt(state.assignment.attemptId)?.leaseResourceKey, `runtime-dispatch:${state.assignment.attemptId}`);
}));

test('D1 concurrent duplicate dispatchers produce one invocation', async () => withStore(async (store, databasePath) => {
  const initial = setup(store); store.close(); const a = new AgentModeSqliteStateStore(databasePath); const b = new AgentModeSqliteStateStore(databasePath);
  const runtimeA = new MockAgentRuntime(fixture()); const runtimeB = new MockAgentRuntime(fixture()); const results = await Promise.all([
    new AgentModeRuntimeDispatcher(a, runtimeA).dispatch(initial.request), new AgentModeRuntimeDispatcher(b, runtimeB).dispatch(initial.request),
  ]);
  assert.equal(results.filter((result) => result.result === 'succeeded').length, 1); assert.equal(runtimeA.dispatchInvocationCount + runtimeB.dispatchInvocationCount, 1); a.close(); b.close();
}));

test('D1 stale dispatcher fence cannot start or settle', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return;
  assert.equal(store.releaseLease(prepared.prepared.resourceKey, prepared.prepared.leaseId, prepared.prepared.fence), true);
  const replacement = store.acquireLease({ resourceKey: prepared.prepared.resourceKey, leaseId: 'lease:replacement', ownerId: 'controller:other', expiresAt: '2026-09-12T00:00:00.000Z' }); assert.ok(replacement);
  const started = store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); assert.equal(started.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 restart after settlement returns a duplicate without rerun', async () => withStore(async (store, databasePath) => {
  const state = setup(store); assert.equal((await state.dispatcher.dispatch(state.request)).result, 'succeeded'); store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); const runtime = new MockAgentRuntime(fixture()); const result = await new AgentModeRuntimeDispatcher(reopened, runtime).dispatch(state.request); assert.equal(result.result, 'duplicate'); assert.equal(runtime.dispatchInvocationCount, 0); reopened.close();
}));

test('D1 restart sees dispatched-without-receipt as uncertain', async () => withStore(async (store, databasePath) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; assert.equal(store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now).result, 'created'); store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); const runtime = new MockAgentRuntime(fixture()); const result = await new AgentModeRuntimeDispatcher(reopened, runtime).dispatch(state.request); assert.equal(result.result, 'uncertain'); assert.equal(runtime.dispatchInvocationCount, 0); reopened.close();
}));

test('D1 receipt is durable before verification and settlement', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); const receipt = manualReceipt(state.request, prepared.prepared); assert.equal(store.recordRuntimeDispatchReceipt(receipt).result, 'recorded'); assert.equal(store.listDispatchOutbox()[0]?.state, 'receipt_recorded'); assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'running');
}));

test('D1 verification is required before settlement', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); const receipt = manualReceipt(state.request, prepared.prepared); store.recordRuntimeDispatchReceipt(receipt); const denied = store.settleRuntimeDispatch(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); assert.equal(denied.result, 'denied'); assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'running');
}));

test('D1 duplicate receipt recording is idempotent', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); const receipt = manualReceipt(state.request, prepared.prepared); assert.equal(store.recordRuntimeDispatchReceipt(receipt).result, 'recorded'); assert.equal(store.recordRuntimeDispatchReceipt(receipt).result, 'duplicate'); assert.equal(store.listReceipts(state.request.operationId).length, 1);
}));

test('D1 conflicting receipt marks the operation uncertain', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); const first = manualReceipt(state.request, prepared.prepared); const second = { ...manualReceipt(state.request, prepared.prepared, 'failed'), receiptId: 'runtime-receipt:manual:conflict', resultHash: 'b'.repeat(64) }; const conflicting = { ...second, effectHash: runtimeReceiptEffectHash(second) }; store.recordRuntimeDispatchReceipt(first); assert.equal(store.recordRuntimeDispatchReceipt(conflicting).result, 'conflict'); assert.equal(store.listDispatchOutbox()[0]?.state, 'uncertain');
}));

test('D1 rejects result usage above the reserved step allocation', async () => withStore(async (store) => {
  const state = setup(store, { usage: { steps: 6, tokens: 0, cost: 0 } }); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 1); assert.equal(store.getReservation(state.assignment.reservationId)?.status, 'reserved');
}));

test('D1 rejects result usage above the reserved cost allocation', async () => withStore(async (store) => {
  const state = setup(store, { usage: { steps: 0, tokens: 0, cost: 0.06 } }); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'denied'); assert.equal(store.getReservation(state.assignment.reservationId)?.status, 'reserved');
}));

test('D1 authority read failure blocks dispatch before invocation', async () => withStore(async (store) => {
  const state = setup(store); store.injectSpawnReadFailureOnce('kill-switch'); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0); assert.equal(store.listEffects().length, 0);
}));

test('D1 cancellation requested before dispatch blocks invocation', async () => withStore(async (store) => {
  const state = setup(store); assert.equal(store.requestCancellation({ requestId: 'cancel:before', attemptId: state.assignment.attemptId, requestedAt: now }), 'created'); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 cancellation acknowledgement is not written while the runtime is in flight', async () => withStore(async (store) => {
  let release!: () => void; let started!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }); const entered = new Promise<void>((resolve) => { started = resolve; }); const state = setup(store, { started, checkpoint: gate }); const pending = state.dispatcher.dispatch(state.request); await entered; state.dispatcher.requestCancellation({ requestId: 'cancel:inflight', attemptId: state.assignment.attemptId, operationId: state.request.operationId, requestedAt: now }); assert.equal(store.getAttempt(state.assignment.attemptId)?.cancellationStatus, 'requested'); release(); await pending;
}));

test('D1 cancellation receipt requires cancellation observation', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); store.requestCancellation({ requestId: 'cancel:receipt', attemptId: state.assignment.attemptId, requestedAt: now }); const invalid = { ...manualReceipt(state.request, prepared.prepared, 'cancelled'), cancellationObserved: false }; const receipt = { ...invalid, effectHash: runtimeReceiptEffectHash(invalid) }; assert.equal(store.recordRuntimeDispatchReceipt(receipt).result, 'denied');
}));

test('D1 reconcile unsupported remains uncertain', async () => withStore(async (store) => {
  const state = setup(store, { crashAfterInvocation: true }); await state.dispatcher.dispatch(state.request); const result = await state.dispatcher.reconcile(state.request); assert.equal(result.result, 'uncertain'); if (result.result === 'uncertain') assert.equal(result.reasonCode, 'RECONCILIATION_UNSUPPORTED');
}));

test('D1 reconcile supported evidence settles without a second run invocation', async () => withStore(async (store) => {
  const reconciled = { status: 'succeeded' as const, runtimeReceiptId: 'runtime-receipt:reconciled', resultHash: 'c'.repeat(64), evidenceRef: 'evidence:reconciled', usage: { steps: 0, tokens: 0, cost: 0 }, traceSummary: [] }; const state = setup(store, { crashAfterInvocation: true, reconcile: reconciled }); await state.dispatcher.dispatch(state.request); const result = await state.dispatcher.reconcile(state.request); assert.equal(result.result, 'succeeded', JSON.stringify(result)); assert.equal(state.runtime.dispatchInvocationCount, 1); assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'completed');
}));

test('D1 observer reconstructs a running dispatch from durable state', async () => withStore(async (store, databasePath) => {
  let release!: () => void; let started!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }); const entered = new Promise<void>((resolve) => { started = resolve; }); const state = setup(store, { started, checkpoint: gate }); const pending = state.dispatcher.dispatch(state.request); await entered; const observer = readAgentModeObserver(now, databasePath); assert.equal(observer.runtimeDispatches[0]?.state, 'dispatched'); assert.equal(observer.runtimeDispatches[0]?.operationId, state.request.operationId); release(); await pending;
}));

test('D1 observer exposes uncertain dispatches without runtime payloads', async () => withStore(async (store, databasePath) => {
  const state = setup(store, { crashAfterInvocation: true }); await state.dispatcher.dispatch(state.request); const observer = readAgentModeObserver(now, databasePath); assert.equal(observer.runtimeDispatches[0]?.state, 'uncertain'); assert.equal(JSON.stringify(observer).includes('traceSummary'), false);
}));

test('D1 root active-child allocation is released once on success', async () => withStore(async (store) => {
  const state = setup(store); const before = store.getSpawnRootState('goal:runtime')!; await state.dispatcher.dispatch(state.request); const after = store.getSpawnRootState('goal:runtime')!; assert.equal(before.activeChildren, 1); assert.equal(after.activeChildren, 0); assert.equal(after.reservedChildSteps, 0); const retry = await state.dispatcher.dispatch(state.request); assert.equal(retry.result, 'duplicate'); assert.equal(store.getSpawnRootState('goal:runtime')?.activeChildren, 0);
}));

test('D1 child allocation and budget reservation settle once on failure', async () => withStore(async (store) => {
  const state = setup(store, { status: 'failed' }); await state.dispatcher.dispatch(state.request); const budget = store.getBudget(state.assignment.budgetScopeId)!; assert.equal(budget.reservedSteps, 0); assert.equal(budget.usedSteps, 0); assert.equal(store.getAgent(state.assignment.childAgentId)?.reservedChildSteps, 0);
}));

test('D1 cancellation releases active slot only after terminal cancellation', async () => withStore(async (store) => {
  const state = setup(store, { status: 'failed' }); store.requestCancellation({ requestId: 'cancel:slot', attemptId: state.assignment.attemptId, requestedAt: now }); const denied = await state.dispatcher.dispatch(state.request); assert.equal(denied.result, 'denied'); assert.equal(store.getSpawnRootState('goal:runtime')?.activeChildren, 1);
}));

test('D1 runtime dispatch does not use the restricted Harness profile', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, runtimeRef: 'runtime:deepseek-harness:c389f96bf3a9b6807cb71ed6bdad5849be0df6d8', runtimeProfileRef: 'brain-agent-mode-restricted' }); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 runtime context contains only bounded assignment authority', async () => withStore(async (store) => {
  const state = setup(store); let context!: AgentRuntimeExecutionContext; const runtime = { run: async (input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }) => { context = input.context; return { status: 'succeeded' as const, runtimeReceiptId: 'runtime-receipt:context', resultHash: 'd'.repeat(64), evidenceRef: 'evidence:context', usage: { steps: 0, tokens: 0, cost: 0 }, traceSummary: [] }; } }; const result = await new AgentModeRuntimeDispatcher(store, runtime).dispatch(state.request); assert.equal(result.result, 'succeeded'); assert.equal(context.operationId, state.request.operationId); assert.equal(Object.prototype.hasOwnProperty.call(context, 'prompt'), false); assert.equal(Object.prototype.hasOwnProperty.call(context, 'secret'), false);
}));

test('D1 malformed receipt identity is denied', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); if (prepared.result !== 'ready') return; store.markRuntimeDispatchStarted(state.request.operationId, state.request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, now); const receipt = manualReceipt(state.request, prepared.prepared); assert.equal(store.recordRuntimeDispatchReceipt({ ...receipt, operationId: 'operation:other' }).result, 'denied');
}));

test('D1 malformed result hash becomes uncertain before receipt persistence', async () => withStore(async (store) => {
  const state = setup(store); const runtime = { run: async () => ({ status: 'succeeded' as const, runtimeReceiptId: 'runtime-receipt:bad', resultHash: 'bad', evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, traceSummary: [] }) }; const result = await new AgentModeRuntimeDispatcher(store, runtime).dispatch(state.request); assert.equal(result.result, 'uncertain'); assert.equal(store.listReceipts(state.request.operationId).length, 0);
}));

test('D1 operation state is recoverable from the single generic outbox', async () => withStore(async (store) => {
  const state = setup(store); const prepared = store.prepareRuntimeDispatch(state.request); assert.equal(prepared.result, 'ready'); assert.equal(store.listDispatchOutbox().length, 1); assert.equal(store.listEffects().length, 1); if (prepared.result === 'ready') assert.equal(prepared.prepared.resourceKey, `runtime-dispatch:${state.assignment.attemptId}`);
}));

test('D1 assignment creation count is unchanged by dispatch retries', async () => withStore(async (store) => {
  const state = setup(store); await state.dispatcher.dispatch(state.request); await state.dispatcher.dispatch(state.request); assert.equal(store.getSpawnRootState('goal:runtime')?.totalChildCreations, 1); assert.equal(store.listChildAssignments().length, 1);
}));

test('D1 no scheduler auto-wiring starts a runtime', async () => withStore(async (store) => {
  const state = setup(store); assert.equal(state.runtime.dispatchInvocationCount, 0); assert.equal(store.listSchedulerEvents().length, 0); assert.equal(store.listSchedulerSchedules().length, 0);
}));

test('D1 runtime result evidence is bounded and persisted without trace details', async () => withStore(async (store) => {
  const state = setup(store, { evidenceRef: 'evidence:bounded', traceSummary: ['step:1', 'step:2'] }); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'succeeded'); const receipt = store.getReceipt(state.request.operationId); assert.ok(receipt); assert.equal(JSON.stringify(store.listRecentEvents(100)).includes('step:1'), false);
}));

test('D1 expired authority is rejected before runtime invocation', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, requestedAt: '2026-09-10T10:01:00.000Z' }); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 deadline is enforced by the child assignment authority', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, requestedAt: childDeadline }); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 role template binding remains immutable at dispatch', async () => withStore(async (store) => {
  const state = setup(store); const result = await state.dispatcher.dispatch({ ...state.request, runtimeProfileRef: 'runtime-profile:mock-k0-4', assignmentIntentKey: `${state.request.assignmentIntentKey.slice(0, -1)}0` }); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 task, run, and attempt cancellation all fail closed', async () => withStore(async (store) => {
  const state = setup(store); assert.equal(store.cancelRun(state.assignment.runId, now), 'created'); const result = await state.dispatcher.dispatch(state.request); assert.equal(result.result, 'denied'); assert.equal(state.runtime.dispatchInvocationCount, 0);
}));

test('D1 no network or OS process identity is persisted', async () => withStore(async (store) => {
  const state = setup(store); await state.dispatcher.dispatch(state.request); const run = store.getRun(state.assignment.runId)!; assert.equal(run.runtimePid, undefined); assert.equal(run.runtimeIdentity, undefined); assert.equal(JSON.stringify(store.listRecentEvents(100)).includes('http'), false);
}));

test('D1 failed runtime receipt remains auditable after restart', async () => withStore(async (store, databasePath) => {
  const state = setup(store, { status: 'failed' }); await state.dispatcher.dispatch(state.request); store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); assert.equal(reopened.getReceipt(state.request.operationId)?.status, 'failed'); assert.equal(reopened.getChildAssignment(state.assignment.childAgentId)?.status, 'failed'); reopened.close();
}));

test('D1 uncertain runtime keeps budget reserved for reconciliation', async () => withStore(async (store) => {
  const state = setup(store, { crashAfterInvocation: true }); await state.dispatcher.dispatch(state.request); assert.equal(store.getReservation(state.assignment.reservationId)?.status, 'reserved'); assert.equal(store.getBudget(state.assignment.budgetScopeId)?.reservedSteps, 5); assert.equal(store.getSpawnRootState('goal:runtime')?.activeChildren, 1);
}));

test('D1 cancellation does not blindly replay an uncertain runtime', async () => withStore(async (store) => {
  const state = setup(store, { crashAfterInvocation: true }); await state.dispatcher.dispatch(state.request); store.requestCancellation({ requestId: 'cancel:uncertain', attemptId: state.assignment.attemptId, requestedAt: now }); const retry = await state.dispatcher.dispatch(state.request); assert.equal(retry.result, 'uncertain'); assert.equal(state.runtime.dispatchInvocationCount, 1);
}));

test('D1 runtime dispatch remains isolated to the child assignment root', async () => withStore(async (store) => {
  const state = setup(store); await state.dispatcher.dispatch(state.request); assert.equal(store.getSpawnRootState('goal:runtime')?.totalChildCreations, 1); assert.equal(store.listSpawnRootStates().length, 1);
}));
