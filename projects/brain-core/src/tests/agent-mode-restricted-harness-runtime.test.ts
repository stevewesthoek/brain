import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { RESTRICTED_HARNESS_PROFILE_REF, RESTRICTED_HARNESS_RUNTIME_REF, type AgentModeChildAssignmentRequest } from '../agent-mode/child-assignment.js';
import { AgentModeRuntimeDispatcher, RUNTIME_DISPATCH_SCHEMA_VERSION, type AgentModeRuntimeDispatchRequest } from '../agent-mode/runtime-dispatch.js';
import { RestrictedHarnessAgentRuntime, RESTRICTED_HARNESS_FIXTURE_RESPONSE } from '../agent-mode/restricted-harness-agent-runtime.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { evaluateSpawnAdmission, SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY, type SpawnAuthorityFacts, type SpawnRequest } from '../agent-mode/spawn-policy.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { WORKCELL_READ_CAPABILITY } from '../agent-mode/workcell.js';

const NOW = '2026-09-10T10:00:01.000Z';
const ROOT_DEADLINE = '2026-09-10T11:00:00.000Z';
const DEADLINE = '2026-09-10T10:00:30.000Z';
const HARNESS_ROOT = process.env.BRAIN_D2_HARNESS_ROOT ?? '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

function spawnInput(): { request: SpawnRequest; facts: SpawnAuthorityFacts; admission: ReturnType<typeof evaluateSpawnAdmission> } {
  const request: SpawnRequest = {
    schemaVersion: 1, requestId: 'request:d2', policyId: SPAWN_POLICY_READ_ONLY, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, sourceId: 'source:git', sourceEventId: 'event:d2',
    sourceType: GIT_REPOSITORY_REVISION_SOURCE, eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, eventRootGoalId: 'goal:d2',
    eventScope: { repositoryRef: 'brain', resourceRef: null }, parentAgentId: null, parentTaskId: null, parentRunId: null,
    rootGoalId: 'goal:d2', requestedScope: { repositoryRef: 'brain', resourceRef: null }, requestedCapabilities: [WORKCELL_READ_CAPABILITY],
    requestedTtl: 60_000, requestedStepBudget: 10, requestedCostBudget: 0.1, requestedAt: NOW, deadline: ROOT_DEADLINE, requestedDepth: 1,
  };
  const facts: SpawnAuthorityFacts = {
    now: NOW, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: 'goal:d2', depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active', remainingSteps: 1000, remainingBudget: 2, deadline: ROOT_DEADLINE, delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: null,
  };
  const admission = evaluateSpawnAdmission(request, facts);
  assert.equal(admission.result, 'ALLOW');
  return { request, facts, admission };
}

function setup(store: AgentModeSqliteStateStore, options: { harnessRoot?: string; fixtureOutcome?: 'success' | 'failure' | 'wait' | 'crash'; fixtureFailureCode?: string; fixtureStarted?: () => void; fixtureEnvironmentObserved?: (sentinelPresent: boolean) => void; fixtureCheckpoint?: Promise<void>; fixtureProtocol?: 'malformed' | 'oversized'; evidenceRoot?: string; simulateLostResponse?: boolean } = {}) {
  const spawned = store.reserveSpawnAndCreateChild(spawnInput());
  assert.equal(spawned.result, 'created');
  if (spawned.result !== 'created') throw new Error('D2 child setup failed');
  const assignmentRequest: AgentModeChildAssignmentRequest = {
    schemaVersion: 1, assignmentId: 'assignment:d2', childAgentId: spawned.receipt.childAgentId, rootGoalId: 'goal:d2',
    taskSpecRef: 'task-spec:d2', sourceEventId: 'event:assignment:d2', runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF,
    runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF, requestedSteps: 5, requestedCostCeiling: 0.05,
    requestedCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScope: 'brain', resourceScope: null, deadline: DEADLINE, requestedAt: NOW,
  };
  const assigned = store.assignChildAgent(assignmentRequest);
  assert.equal(assigned.result, 'assigned', JSON.stringify(assigned));
  if (assigned.result !== 'assigned') throw new Error('D2 assignment setup failed');
  const request: AgentModeRuntimeDispatchRequest = {
    schemaVersion: RUNTIME_DISPATCH_SCHEMA_VERSION, dispatchId: 'dispatch:d2', operationId: 'operation:d2',
    assignmentIntentKey: assigned.receipt.assignmentIntentKey, childAgentId: assigned.receipt.childAgentId,
    taskId: assigned.receipt.taskId, runId: assigned.receipt.runId, attemptId: assigned.receipt.attemptId,
    runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF, runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF,
    controllerRef: 'controller:d2', requestedAt: NOW,
  };
  const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: options.harnessRoot ?? HARNESS_ROOT, ...options });
  return { request, runtime, dispatcher: new AgentModeRuntimeDispatcher(store, runtime), assignment: assigned.receipt };
}

function withStore<T>(fn: (store: AgentModeSqliteStateStore, root: string) => Promise<T> | T): Promise<T> | T {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k42-d2-test-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'state.db'));
  try {
    const result = fn(store, root);
    return result instanceof Promise ? result.finally(() => { try { store.close(); } catch {} rmSync(root, { recursive: true, force: true }); }) : (store.close(), rmSync(root, { recursive: true, force: true }), result);
  } catch (error) {
    try { store.close(); } catch {}
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

test('D2 RestrictedHarnessAgentRuntime executes one pinned child and settles through D1', async () => withStore(async (store, root) => {
  const state = setup(store, { evidenceRoot: path.join(root, 'evidence') });
  const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'succeeded', JSON.stringify(result) + ' events=' + JSON.stringify(store.listEvents(state.assignment.attemptId)));
  assert.equal(state.runtime.invocationCount, 1);
  assert.equal(state.runtime.processLaunchCount, 1);
  assert.equal(state.runtime.processReapedCount, 1);
  assert.equal(state.runtime.lastProcessIdentity?.command, 'deepseek-harness:c389f96bf3a9b6807cb71ed6bdad5849be0df6d8');
  assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'completed');
  assert.equal(store.getRun(state.assignment.runId)?.runtimePid, undefined);
  assert.equal(store.listWorkcells().length, 0);
  assert.equal(result.result === 'succeeded' && result.receipt.usage.tokens, 0);
}));

test('D2 deterministic Harness failure is truthful and is not retried', async () => withStore(async (store) => {
  const state = setup(store, { fixtureOutcome: 'failure', fixtureFailureCode: 'D2_KNOWN_FAILURE' });
  const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'failed', JSON.stringify(result));
  assert.equal(state.runtime.processLaunchCount, 1);
  assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'failed');
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'duplicate');
  assert.equal(state.runtime.invocationCount, 1);
}));

test('D2 cancellation reaches an in-flight Harness and waits for reaping', async () => withStore(async (store) => {
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  const checkpoint = new Promise<void>((resolve) => { release = resolve; });
  const state = setup(store, { fixtureOutcome: 'wait', fixtureStarted: started, fixtureCheckpoint: checkpoint });
  const pending = state.dispatcher.dispatch(state.request);
  await startedPromise;
  assert.equal(state.dispatcher.requestCancellation({ requestId: 'cancel:d2', attemptId: state.assignment.attemptId, operationId: state.request.operationId, requestedAt: NOW }), 'created');
  release();
  const result = await pending;
  assert.equal(result.result, 'cancelled', JSON.stringify(result));
  assert.equal(state.runtime.processReapedCount, 1);
  assert.equal(store.getAttempt(state.assignment.attemptId)?.cancellationStatus, 'completed');
  assert.equal(store.getAttempt(state.assignment.attemptId)?.status, 'cancelled');
}));

test('D2 missing pin is a bounded pre-effect failure, not uncertainty', async () => withStore(async (store) => {
  const state = setup(store, { harnessRoot: '/tmp/not-the-pinned-harness' });
  const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'failed', JSON.stringify(result));
  assert.equal(state.runtime.processLaunchCount, 0);
}));

test('D2 crash after admitted Harness input is uncertain and never blindly relaunched', async () => withStore(async (store, root) => {
  const state = setup(store, { fixtureOutcome: 'crash', evidenceRoot: path.join(root, 'evidence') });
  const result = await state.dispatcher.dispatch(state.request);
  assert.equal(result.result, 'uncertain', JSON.stringify(result));
  assert.equal(state.runtime.processLaunchCount, 1);
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'uncertain');
  assert.equal(state.runtime.invocationCount, 1);
}));

test('D2 malformed bridge response is a known failure and is not retried', async () => withStore(async (store) => {
  const state = setup(store, { fixtureProtocol: 'malformed' });
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'failed');
  assert.equal(state.runtime.processLaunchCount, 1);
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'duplicate');
  assert.equal(state.runtime.invocationCount, 1);
}));

test('D2 oversized bridge response is a known failure and is not retried', async () => withStore(async (store) => {
  const state = setup(store, { fixtureProtocol: 'oversized' });
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'failed');
  assert.equal(state.runtime.processLaunchCount, 1);
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'duplicate');
  assert.equal(state.runtime.invocationCount, 1);
}));

test('D2 durable fixture evidence reconciles without another process', async () => withStore(async (store, root) => {
  const evidenceRoot = path.join(root, 'evidence');
  const state = setup(store, { evidenceRoot });
  const first = await state.dispatcher.dispatch(state.request);
  assert.equal(first.result, 'succeeded');
}));

test('D2 observer exposes bounded process lifecycle without environment or argv', async () => withStore(async (store, root) => {
  const evidenceRoot = path.join(root, 'evidence');
  const state = setup(store, { evidenceRoot });
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'succeeded');
  const projection = readAgentModeObserver(NOW, path.join(root, 'state.db'));
  const dispatch = projection.runtimeDispatches[0]!;
  assert.equal(dispatch.processState, 'reaped');
  assert.equal(dispatch.processIdentityVerified, true);
  assert.equal(dispatch.lastExitClassification, 'valid_result');
  assert.equal('environment' in dispatch, false);
  assert.equal(JSON.stringify(projection).includes(RESTRICTED_HARNESS_FIXTURE_RESPONSE), false);
}));

test('D2 child environment excludes a parent sentinel without exposing its value', async () => withStore(async (store) => {
  const previous = process.env.BRAIN_D2_PARENT_SENTINEL;
  process.env.BRAIN_D2_PARENT_SENTINEL = 'sentinel-value-must-not-cross';
  let present: boolean | undefined;
  try {
    const state = setup(store, { fixtureEnvironmentObserved: (value) => { present = value; } });
    assert.equal((await state.dispatcher.dispatch(state.request)).result, 'succeeded');
    assert.equal(present, false);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_D2_PARENT_SENTINEL;
    else process.env.BRAIN_D2_PARENT_SENTINEL = previous;
  }
}));

test('D2 reconciliation resolves only durable fixture evidence and never relaunches', async () => withStore(async (store, root) => {
  const state = setup(store, { evidenceRoot: path.join(root, 'evidence'), simulateLostResponse: true });
  const first = await state.dispatcher.dispatch(state.request);
  assert.equal(first.result, 'uncertain', JSON.stringify(first));
  const resolved = await state.dispatcher.reconcile(state.request);
  assert.equal(resolved.result, 'succeeded', JSON.stringify(resolved));
  assert.equal(state.runtime.processLaunchCount, 1);
  assert.equal(state.runtime.invocationCount, 1);
}));

test('D2 reconciliation without durable evidence remains uncertain', async () => withStore(async (store) => {
  const state = setup(store, { fixtureOutcome: 'crash' });
  assert.equal((await state.dispatcher.dispatch(state.request)).result, 'uncertain');
  assert.equal((await state.dispatcher.reconcile(state.request)).result, 'uncertain');
}));
