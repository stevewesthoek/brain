import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AGENT_MODE_RUNTIME_PROFILES,
  CHILD_ASSIGNMENT_SCHEMA_VERSION,
  DEFERRED_MODEL_REF,
  DEFERRED_ROUTE_REF,
  MOCK_AGENT_RUNTIME_PROFILE_REF,
  MOCK_AGENT_RUNTIME_REF,
  RESTRICTED_HARNESS_PROFILE_REF,
  RESTRICTED_HARNESS_RUNTIME_REF,
  assignmentIntentKey,
  type AgentModeChildAssignmentRequest,
} from '../agent-mode/child-assignment.js';
import {
  evaluateSpawnAdmission,
  SPAWN_POLICY_READ_ONLY,
  SPAWN_ROLE_READ_ONLY,
  type SpawnAuthorityFacts,
  type SpawnRequest,
} from '../agent-mode/spawn-policy.js';
import { AgentModeSqliteStateStore, type AgentModeSpawnCreationInput } from '../agent-mode/sqlite-state-store.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { WORKCELL_READ_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY, WORKCELL_WRITE_CAPABILITY } from '../agent-mode/workcell.js';

const now = '2026-09-10T10:00:00.000Z';
const deadline = '2026-09-10T11:00:00.000Z';
const assignmentDeadline = '2026-09-10T10:00:30.000Z';

function spawnRequest(rootGoalId: string, eventId: string, overrides: Partial<SpawnRequest> = {}): SpawnRequest {
  return {
    schemaVersion: 1, requestId: `request:${eventId}`, policyId: SPAWN_POLICY_READ_ONLY, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, sourceId: 'source:git', sourceEventId: eventId,
    sourceType: GIT_REPOSITORY_REVISION_SOURCE, eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, eventRootGoalId: rootGoalId,
    eventScope: { repositoryRef: 'brain', resourceRef: null }, parentAgentId: null, parentTaskId: null, parentRunId: null,
    rootGoalId, requestedScope: { repositoryRef: 'brain', resourceRef: null }, requestedCapabilities: [WORKCELL_READ_CAPABILITY],
    requestedTtl: 60_000, requestedStepBudget: 10, requestedCostBudget: 0.1, requestedAt: now, deadline, requestedDepth: 1,
    ...overrides,
  };
}

function spawnFacts(rootGoalId: string, overrides: Partial<SpawnAuthorityFacts> = {}): SpawnAuthorityFacts {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: {
      rootGoalId, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active', remainingSteps: 1000,
      remainingBudget: 2, deadline, delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [],
    }, parent: null, ...overrides,
  };
}

function spawnInput(rootGoalId: string, eventId: string, overrides: Partial<SpawnRequest> = {}): AgentModeSpawnCreationInput {
  const request = spawnRequest(rootGoalId, eventId, overrides);
  const decision = evaluateSpawnAdmission(request, spawnFacts(rootGoalId));
  assert.equal(decision.result, 'ALLOW');
  return { request, facts: spawnFacts(rootGoalId), admission: decision };
}

function assignmentRequest(childAgentId: string, overrides: Partial<AgentModeChildAssignmentRequest> = {}): AgentModeChildAssignmentRequest {
  return {
    schemaVersion: CHILD_ASSIGNMENT_SCHEMA_VERSION, assignmentId: 'assignment:1', childAgentId, rootGoalId: 'goal:1',
    taskSpecRef: 'task-spec:read-brain', sourceEventId: 'event:assignment', runtimeRef: MOCK_AGENT_RUNTIME_REF,
    runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF, requestedSteps: 5, requestedCostCeiling: 0.05,
    requestedCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScope: 'brain', resourceScope: null,
    deadline: assignmentDeadline, requestedAt: now, ...overrides,
  };
}

function withStore<T>(fn: (store: AgentModeSqliteStateStore, databasePath: string, directory: string) => T): T {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42c-assignment-'));
  const databasePath = path.join(directory, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return fn(store, databasePath, directory); } finally { try { store.close(); } catch { /* restart tests close explicitly */ } rmSync(directory, { recursive: true, force: true }); }
}

function child(store: AgentModeSqliteStateStore, rootGoalId = 'goal:1', eventId = 'event:spawn') {
  const result = store.reserveSpawnAndCreateChild(spawnInput(rootGoalId, eventId, { requestId: `request:${eventId}` }));
  assert.equal(result.result, 'created');
  if (result.result !== 'created') throw new Error('expected child creation');
  return result.receipt;
}

function assigned(store: AgentModeSqliteStateStore, childAgentId: string, overrides: Partial<AgentModeChildAssignmentRequest> = {}) {
  const result = store.assignChildAgent(assignmentRequest(childAgentId, overrides));
  if (result.result !== 'assigned') throw new Error(`expected assignment: ${JSON.stringify(result)}`);
  return result;
}

function reason(result: ReturnType<AgentModeSqliteStateStore['assignChildAgent']>): string {
  if (result.result === 'denied' || result.result === 'conflict') return result.reasonCode;
  throw new Error('expected assignment denial');
}

test('reserved child receives canonical Task Run Attempt atomically', () => withStore((store) => {
  const spawned = child(store); const result = assigned(store, spawned.childAgentId);
  assert.equal(store.getAgent(spawned.childAgentId)?.status, 'assigned'); assert.ok(store.getTask(result.receipt.taskId));
  assert.ok(store.getRun(result.receipt.runId)); assert.ok(store.getAttempt(result.receipt.attemptId));
}));
test('assignment uses existing canonical entity types and pre-dispatch states', () => withStore((store) => {
  const result = assigned(store, child(store).childAgentId);
  assert.equal(store.getTask(result.receipt.taskId)?.taskType, 'agent-mode.child-assignment'); assert.equal(store.getTask(result.receipt.taskId)?.status, 'admitted');
  assert.equal(store.getRun(result.receipt.runId)?.status, 'created'); assert.equal(store.getAttempt(result.receipt.attemptId)?.status, 'admitted');
}));
test('child Task Run Attempt lineage is durable and exact', () => withStore((store) => {
  const spawned = child(store); const result = assigned(store, spawned.childAgentId); const task = store.getTask(result.receipt.taskId)!; const run = store.getRun(result.receipt.runId)!; const attempt = store.getAttempt(result.receipt.attemptId)!;
  assert.equal(task.childAgentId, spawned.childAgentId); assert.equal(task.assignmentIntentKey, result.receipt.assignmentIntentKey); assert.equal(run.taskId, task.taskId); assert.equal(run.agentId, spawned.childAgentId); assert.equal(attempt.runId, run.runId); assert.equal(attempt.agentId, spawned.childAgentId);
}));
test('runtime binding persists on Attempt and receipt', () => withStore((store) => {
  const result = assigned(store, child(store).childAgentId); const attempt = store.getAttempt(result.receipt.attemptId)!;
  assert.equal(attempt.runtimeRef, MOCK_AGENT_RUNTIME_REF); assert.equal(attempt.runtimeProfileRef, MOCK_AGENT_RUNTIME_PROFILE_REF); assert.equal(result.receipt.runtimeProfileRef, MOCK_AGENT_RUNTIME_PROFILE_REF);
}));
test('Attempt is not running and no runtime identity or PID is fabricated', () => withStore((store) => {
  const result = assigned(store, child(store).childAgentId); const attempt = store.getAttempt(result.receipt.attemptId)!; const run = store.getRun(result.receipt.runId)!;
  assert.notEqual(attempt.status, 'running'); assert.equal(run.runtimePid, undefined); assert.equal(run.runtimeIdentity, undefined);
}));
test('child becomes assigned and dispatch preparation is explicit', () => withStore((store) => {
  const result = assigned(store, child(store).childAgentId); const prepared = store.getPreparedChildDispatch(result.receipt.assignmentIntentKey, now)!;
  assert.equal(prepared.status, 'dispatch_ready'); assert.equal(prepared.childAgentId, result.receipt.childAgentId); assert.equal(prepared.attemptId, result.receipt.attemptId);
}));
test('assignment intent is deterministic and excludes request identity', () => {
  const first = assignmentRequest('agent:child:1'); const second = assignmentRequest('agent:child:1', { assignmentId: 'assignment:2' });
  assert.equal(assignmentIntentKey(first), assignmentIntentKey(second));
});
test('materially different task identity changes assignment intent', () => {
  assert.notEqual(assignmentIntentKey(assignmentRequest('agent:child:1')), assignmentIntentKey(assignmentRequest('agent:child:1', { taskSpecRef: 'task-spec:other' })));
});
test('same assignment retry returns one receipt and one dispatch package', () => withStore((store) => {
  const spawned = child(store); const first = assigned(store, spawned.childAgentId); const retry = store.assignChildAgent(assignmentRequest(spawned.childAgentId));
  assert.equal(retry.result, 'duplicate'); if (retry.result === 'duplicate') { assert.deepEqual(retry.receipt, first.receipt); assert.deepEqual(retry.dispatch, first.dispatch); }
}));
test('retry does not duplicate Task Run Attempt', () => withStore((store) => {
  const spawned = child(store); assigned(store, spawned.childAgentId); store.assignChildAgent(assignmentRequest(spawned.childAgentId));
  assert.equal(store.listTasks().length, 1); assert.equal(store.listRuns().length, 1); assert.equal(store.listAttempts().length, 1);
}));
test('retry does not double-allocate existing budget reservation', () => withStore((store) => {
  const spawned = child(store); const result = assigned(store, spawned.childAgentId); store.assignChildAgent(assignmentRequest(spawned.childAgentId)); const reservation = store.getReservation(result.receipt.reservationId)!; const budget = store.getBudget(result.receipt.budgetScopeId)!;
  assert.equal(reservation.steps, 5); assert.equal(budget.reservedSteps, 5); assert.equal(budget.reservedDollars, 0.05);
}));
test('conflicting same child assignment fails closed', () => withStore((store) => {
  const spawned = child(store); assigned(store, spawned.childAgentId); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId, { taskSpecRef: 'task-spec:other' }));
  assert.equal(result.result, 'denied'); assert.equal(reason(result), 'CHILD_ALREADY_ASSIGNED');
}));
test('unknown runtime is denied', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { runtimeRef: 'runtime:unknown', runtimeProfileRef: 'profile:unknown' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'RUNTIME_NOT_ALLOWED'); }));
test('known runtime with unsafe profile is denied', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { runtimeProfileRef: 'runtime-profile:unsafe' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'RUNTIME_PROFILE_INVALID'); }));
test('restricted Harness profile binding is recognized without launch', () => withStore((store) => {
  const result = assigned(store, child(store).childAgentId, { runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF, runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF });
  assert.equal(result.receipt.runtimeProfileRef, RESTRICTED_HARNESS_PROFILE_REF); assert.equal(store.getAttempt(result.receipt.attemptId)?.runtimeRef, RESTRICTED_HARNESS_RUNTIME_REF);
}));
test('role, runtime, and model identities remain separate', () => withStore((store) => {
  const result = assigned(store, child(store).childAgentId); const agent = store.getAgent(result.receipt.childAgentId)!; const attempt = store.getAttempt(result.receipt.attemptId)!;
  assert.equal(agent.roleTemplateId, SPAWN_ROLE_READ_ONLY); assert.equal(attempt.runtimeRef, MOCK_AGENT_RUNTIME_REF); assert.equal(attempt.modelRef, DEFERRED_MODEL_REF); assert.notEqual(agent.role, attempt.runtimeRef);
}));
test('capability widening is denied', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { requestedCapabilities: [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY] })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'CAPABILITY_MISMATCH'); }));
test('repository scope widening is denied', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { repositoryScope: 'other-repo' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'SCOPE_MISMATCH'); }));
test('resource scope widening is denied', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { resourceScope: 'workcell' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'SCOPE_MISMATCH'); }));
test('step allocation cannot exceed child reservation', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { requestedSteps: 11 })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'STEP_ALLOCATION_EXCEEDED'); }));
test('cost allocation cannot exceed child reservation', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { requestedCostCeiling: 0.2 })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'COST_ALLOCATION_EXCEEDED'); }));
test('root aggregate is not double-reserved during assignment', () => withStore((store) => { const spawned = child(store); const before = store.getSpawnRootState('goal:1')!; const result = assigned(store, spawned.childAgentId); const after = store.getSpawnRootState('goal:1')!; assert.equal(after.reservedChildSteps, before.reservedChildSteps); assert.equal(after.reservedChildCost, before.reservedChildCost); assert.equal(result.receipt.stepCeiling, 5); }));
test('assignment uses the existing budget ledger as a child sub-allocation', () => withStore((store) => { const spawned = child(store); const result = assigned(store, spawned.childAgentId); const budget = store.getBudget(result.receipt.budgetScopeId)!; assert.equal(budget.maxSteps, spawned.stepAllocation); assert.equal(budget.maxDollars, spawned.costAllocation); assert.equal(budget.maxTokens, 0); }));
test('root mismatch denies before any canonical record is created', () => withStore((store) => { const spawned = child(store); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId, { rootGoalId: 'goal:other' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'ROOT_MISMATCH'); assert.equal(store.listTasks().length, 0); }));
test('cancelled root cannot gain a new assignment', () => withStore((store) => { const spawned = child(store); assert.equal(store.setSpawnRootCancellation('goal:1', 'cancelled', now), 'created'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'ROOT_CANCELLED'); }));
test('global kill switch blocks assignment', () => withStore((store) => { const spawned = child(store); store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'stop', updatedAt: now }); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'GLOBAL_KILL_SWITCH'); }));
test('root kill switch blocks matching root assignment', () => withStore((store) => { const spawned = child(store); store.setSpawnAdmissionControl({ scope: 'root', rootGoalId: 'goal:1', denied: true, reason: 'stop', updatedAt: now }); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'ROOT_KILL_SWITCH'); }));
test('missing child is denied', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest('agent:child:missing')); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'CHILD_NOT_FOUND'); }));
test('non-reserved child is denied', () => withStore((store) => { const spawned = child(store); assert.equal(store.retireChildAgent(spawned.childAgentId, 'retired', now).result, 'retired'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'CHILD_NOT_RESERVED'); }));
test('cancelled child is denied', () => withStore((store) => { const spawned = child(store); assert.equal(store.retireChildAgent(spawned.childAgentId, 'cancelled', now).result, 'retired'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'CHILD_CANCELLED'); }));
test('expired child is reconciled and denied before assignment', () => withStore((store) => { const spawned = child(store); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId, { requestedAt: '2026-09-10T10:02:00.000Z', deadline: '2026-09-10T10:30:00.000Z' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'CHILD_EXPIRED'); assert.equal(store.getAgent(spawned.childAgentId)?.status, 'expired'); }));
test('expired assignment becomes non-dispatchable and cancels canonical entities', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); assert.deepEqual(store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z'), [result.receipt.childAgentId]); assert.equal(store.getPreparedChildDispatch(result.receipt.assignmentIntentKey, '2026-09-10T10:02:00.000Z'), undefined); assert.equal(store.getAttempt(result.receipt.attemptId)?.status, 'cancelled'); assert.equal(store.getChildAssignment(result.receipt.childAgentId)?.status, 'expired'); }));
test('deadline cannot outlive child or root authority', () => withStore((store) => { const result = store.assignChildAgent(assignmentRequest(child(store).childAgentId, { deadline: '2026-09-10T12:00:00.000Z' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'DEADLINE_EXPIRED'); }));
test('invalid assignment request fails closed', () => withStore((store) => { const request = assignmentRequest(child(store).childAgentId, { requestedSteps: -1 }); const result = store.assignChildAgent(request); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'INVALID_REQUEST'); assert.equal(store.listTasks().length, 0); }));
test('child authority read failure leaves no assignment', () => withStore((store) => { const spawned = child(store); store.injectChildAssignmentReadFailureOnce('child'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'AUTHORITY_UNAVAILABLE'); assert.equal(store.listTasks().length, 0); }));
test('root authority read failure leaves no assignment', () => withStore((store) => { const spawned = child(store); store.injectChildAssignmentReadFailureOnce('root'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'AUTHORITY_UNAVAILABLE'); assert.equal(store.listRuns().length, 0); }));
test('cancellation authority read failure leaves no assignment', () => withStore((store) => { const spawned = child(store); store.injectChildAssignmentReadFailureOnce('cancellation'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'AUTHORITY_UNAVAILABLE'); assert.equal(store.listAttempts().length, 0); }));
test('runtime profile authority read failure leaves no assignment', () => withStore((store) => { const spawned = child(store); store.injectChildAssignmentReadFailureOnce('runtime-profile'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'AUTHORITY_UNAVAILABLE'); assert.equal(store.listTasks().length, 0); }));
test('allocation authority read failure leaves no assignment', () => withStore((store) => { const spawned = child(store); store.injectChildAssignmentReadFailureOnce('allocation'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'AUTHORITY_UNAVAILABLE'); assert.equal(store.listAttempts().length, 0); }));
test('injected uncommitted failure rolls back all assignment state', () => withStore((store) => { const spawned = child(store); store.injectPersistenceFailureOnce('admission'); const result = store.assignChildAgent(assignmentRequest(spawned.childAgentId)); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'AUTHORITY_UNAVAILABLE'); assert.equal(store.listTasks().length, 0); assert.equal(store.listRuns().length, 0); assert.equal(store.listAttempts().length, 0); assert.equal(store.getBudget(`budget:child-assignment:${assignmentIntentKey(assignmentRequest(spawned.childAgentId)).split(':').at(-1)}`), undefined); }));
test('reopen reconstructs assignment and prepared dispatch', () => withStore((store, databasePath) => { const spawned = child(store); const result = assigned(store, spawned.childAgentId); store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); assert.equal(reopened.getChildAssignment(spawned.childAgentId)?.attemptId, result.receipt.attemptId); assert.equal(reopened.getPreparedChildDispatch(result.receipt.assignmentIntentKey, now)?.runId, result.receipt.runId); reopened.close(); }));
test('lost response retry after reopen returns the same receipt', () => withStore((store, databasePath) => { const spawned = child(store); const request = assignmentRequest(spawned.childAgentId); const first = assigned(store, spawned.childAgentId); store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); const retry = reopened.assignChildAgent(request); assert.equal(retry.result, 'duplicate'); if (retry.result === 'duplicate') assert.deepEqual(retry.receipt, first.receipt); reopened.close(); }));
test('observer reconstructs child assignment linkage without secrets', () => withStore((store, databasePath) => { const spawned = child(store); const result = assigned(store, spawned.childAgentId); const projection = readAgentModeObserver(now, databasePath); const assignment = projection.childAssignments.find((candidate) => candidate.assignmentIntentKey === result.receipt.assignmentIntentKey)!; assert.equal(assignment.taskId, result.receipt.taskId); assert.equal(assignment.attemptId, result.receipt.attemptId); assert.equal('prompt' in assignment, false); assert.equal('secret' in assignment, false); }));
test('assignment lifecycle event is bounded and duplicate-free', () => withStore((store) => { const spawned = child(store); const result = assigned(store, spawned.childAgentId); store.assignChildAgent(assignmentRequest(spawned.childAgentId)); const events = store.listEvents(result.receipt.assignmentIntentKey); assert.equal(events.filter((event) => event.eventType === 'child_assignment_created').length, 1); assert.equal(JSON.stringify(events).includes('task-spec:read-brain'), false); }));
test('prepared dispatch carries immutable authority snapshot', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); assert.deepEqual(result.dispatch?.capabilities, [WORKCELL_READ_CAPABILITY]); assert.equal(result.dispatch?.repositoryScope, 'brain'); assert.equal(result.dispatch?.resourceScope, null); assert.equal(result.dispatch?.policyVersion, 1); }));
test('prepared dispatch is not an execution call', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); assert.equal(result.dispatch?.runtimeRef, MOCK_AGENT_RUNTIME_REF); assert.equal(result.dispatch?.status, 'dispatch_ready'); assert.equal(store.listEvents(result.receipt.attemptId).some((event) => event.eventType === 'runtime_started'), false); }));
test('same child cannot receive a second assignment under a different intent concurrently', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42c-race-')); const databasePath = path.join(directory, 'state.db'); const setup = new AgentModeSqliteStateStore(databasePath); const spawned = child(setup); setup.close(); const a = new AgentModeSqliteStateStore(databasePath); const b = new AgentModeSqliteStateStore(databasePath);
  const results = await Promise.all([Promise.resolve().then(() => a.assignChildAgent(assignmentRequest(spawned.childAgentId, { assignmentId: 'assignment:a', taskSpecRef: 'task-spec:a' }))), Promise.resolve().then(() => b.assignChildAgent(assignmentRequest(spawned.childAgentId, { assignmentId: 'assignment:b', taskSpecRef: 'task-spec:b' })))]); assert.equal(results.filter((result) => result.result === 'assigned').length, 1); assert.equal(results.filter((result) => result.result === 'denied' && reason(result) === 'CHILD_ALREADY_ASSIGNED').length, 1); a.close(); b.close(); rmSync(directory, { recursive: true, force: true });
});
test('identical concurrent assignment callers converge on one canonical set', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42c-dup-race-')); const databasePath = path.join(directory, 'state.db'); const setup = new AgentModeSqliteStateStore(databasePath); const spawned = child(setup); setup.close(); const a = new AgentModeSqliteStateStore(databasePath); const b = new AgentModeSqliteStateStore(databasePath); const request = assignmentRequest(spawned.childAgentId);
  const results = await Promise.all([Promise.resolve().then(() => a.assignChildAgent(request)), Promise.resolve().then(() => b.assignChildAgent(request))]); const receipts = results.filter((result): result is Extract<typeof result, { result: 'assigned' | 'duplicate' }> => result.result === 'assigned' || result.result === 'duplicate').map((result) => result.receipt); assert.equal(new Set(receipts.map((receipt) => receipt.attemptId)).size, 1); const check = new AgentModeSqliteStateStore(databasePath); assert.equal(check.listTasks().length, 1); assert.equal(check.listAttempts().length, 1); a.close(); b.close(); check.close(); rmSync(directory, { recursive: true, force: true });
});
test('runtime profile registry is finite and separates model identity', () => { assert.ok(AGENT_MODE_RUNTIME_PROFILES.length >= 2); assert.equal(AGENT_MODE_RUNTIME_PROFILES.some((profile) => profile.runtimeRef.includes('minimax') || profile.runtimeProfileRef.includes('opus')), false); });
test('mock runtime contract can consume the canonical Attempt shape without invocation', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); const attempt = store.getAttempt(result.receipt.attemptId)!; assert.equal(attempt.runtimeRef, MOCK_AGENT_RUNTIME_REF); assert.equal(attempt.routeRef, DEFERRED_ROUTE_REF); assert.equal(attempt.modelRef, DEFERRED_MODEL_REF); }));
test('restricted profile remains read-only at assignment boundary', () => withStore((store) => { const result = assigned(store, child(store).childAgentId, { runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF, runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF }); assert.deepEqual(result.dispatch?.capabilities, [WORKCELL_READ_CAPABILITY]); assert.equal(result.dispatch?.runtimeProfileRef, RESTRICTED_HARNESS_PROFILE_REF); }));
test('retirement of assigned child cancels Attempt and invalidates dispatch', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); assert.equal(store.retireChildAgent(result.receipt.childAgentId, 'cancelled', now).result, 'retired'); assert.equal(store.getAttempt(result.receipt.attemptId)?.status, 'cancelled'); assert.equal(store.getRun(result.receipt.runId)?.status, 'cancelled'); assert.equal(store.getTask(result.receipt.taskId)?.status, 'cancelled'); assert.equal(store.getPreparedChildDispatch(result.receipt.assignmentIntentKey, now), undefined); }));
test('assigned-child retirement is idempotent', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); assert.equal(store.retireChildAgent(result.receipt.childAgentId, 'retired', now).result, 'retired'); assert.equal(store.retireChildAgent(result.receipt.childAgentId, 'retired', now).result, 'duplicate'); }));
test('assignment does not create Workcell state', () => withStore((store) => { assigned(store, child(store).childAgentId); assert.equal(store.listWorkcells().length, 0); }));
test('assignment does not create runtime process identity state', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); assert.equal(store.getRun(result.receipt.runId)?.runtimePid, undefined); assert.equal(store.getRun(result.receipt.runId)?.runtimeIdentity, undefined); }));
test('assignment source event is durable but payload is not copied', () => withStore((store) => { const result = assigned(store, child(store).childAgentId); const event = store.listEvents(result.receipt.assignmentIntentKey)[0]!; assert.equal(event.payload.sourceEventId, 'event:assignment'); assert.equal('payload' in event.payload, false); }));
test('root isolation prevents assigning a child under another root', () => withStore((store) => { const first = child(store, 'goal:a', 'event:a'); const result = store.assignChildAgent(assignmentRequest(first.childAgentId, { rootGoalId: 'goal:b' })); assert.equal(result.result, 'denied'); assert.equal(reason(result), 'ROOT_MISMATCH'); assert.equal(store.getSpawnRootState('goal:b'), undefined); }));
test('K4.2-B child reservation remains intact after assignment failure', () => withStore((store) => { const spawned = child(store); store.injectPersistenceFailureOnce('admission'); store.assignChildAgent(assignmentRequest(spawned.childAgentId)); const root = store.getSpawnRootState('goal:1')!; assert.equal(root.activeChildren, 1); assert.equal(store.getAgent(spawned.childAgentId)?.status, 'reserved'); }));
