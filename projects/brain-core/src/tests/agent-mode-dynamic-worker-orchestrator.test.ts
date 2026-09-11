import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AgentModeDynamicWorkerOrchestrator,
  DEFAULT_SCHEDULER_EVENT_ACTION_RULES,
  E1_FIXTURE_ACTION_RULE,
  E1_FIXTURE_ACTION_RULE_ID,
  E1_FIXTURE_CONTROLLER_REF,
  E1_FIXTURE_TASK_SPEC_REF,
  E1_FIXTURE_SOURCE_ID,
  runAgentModeDynamicWorkerPass,
  type DynamicWorkerPhase,
  type SchedulerEventActionRule,
} from '../agent-mode/dynamic-worker-orchestrator.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { MOCK_AGENT_RUNTIME_PROFILE_REF, MOCK_AGENT_RUNTIME_REF, DEFERRED_MODEL_REF, DEFERRED_ROUTE_REF } from '../agent-mode/child-assignment.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { AgentModeSqliteStateStore, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';

const T0 = '2026-09-11T10:00:00.000Z';
const T1 = '2026-09-11T10:00:01.000Z';
const T2 = '2026-09-11T10:00:02.000Z';
const T3 = '2026-09-11T10:00:03.000Z';
const ROOT_DEADLINE = '2026-09-11T11:00:00.000Z';
const ROOT_GOAL_ID = 'goal:e1-fixture';

function enabledRule(overrides: Partial<SchedulerEventActionRule> = {}): SchedulerEventActionRule {
  return { ...E1_FIXTURE_ACTION_RULE, enabled: true, ...overrides };
}

function rootFacts(now: string = T0) {
  return {
    now,
    globalKillSwitchDenied: false,
    rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: {
      rootGoalId: ROOT_GOAL_ID,
      depth: 0,
      activeChildren: 0,
      totalChildCreations: 0,
      cancellation: 'active' as const,
      remainingSteps: 1000,
      remainingBudget: 2,
      deadline: ROOT_DEADLINE,
      delegableCapabilities: ['repo.read'],
      repositoryScopes: ['brain'],
      resourceScopes: [],
    },
    parent: null,
  };
}

function event(eventId: string, overrides: Partial<AgentModeSchedulerEventInput> = {}): AgentModeSchedulerEventInput {
  return {
    eventId,
    eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
    source: E1_FIXTURE_SOURCE_ID,
    occurredAt: T0,
    receivedAt: T0,
    causationId: 'commit:parent',
    correlationId: 'corr:e1',
    deduplicationKey: `dedupe:${eventId}`,
    payloadVersion: 'k4.0',
    payload: { rootGoalId: ROOT_GOAL_ID, repositoryRef: 'brain', commitSha: `sha:${eventId}`, subject: 'fixture' },
    nextEligibleAt: T0,
    deadline: null,
    maxAttempts: 3,
    ...overrides,
  };
}

function fixtureRuntime(overrides: ConstructorParameters<typeof MockAgentRuntime>[0]['dispatch'] = {}) {
  return new MockAgentRuntime({
    runtimeRef: MOCK_AGENT_RUNTIME_REF,
    routeRef: DEFERRED_ROUTE_REF,
    modelRef: DEFERRED_MODEL_REF,
    modelResult: { kind: 'typed-fixture-result', traceId: 'e1', intent: { kind: 'no-outbox', relativePath: 'README.md' } },
    dispatch: overrides,
  });
}

function createDatabase(): { root: string; databasePath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-e1-'));
  return { root, databasePath: path.join(root, 'agent-mode.db') };
}

function configureSource(store: AgentModeSqliteStateStore): void {
  assert.equal(store.upsertEventSource({ sourceId: E1_FIXTURE_SOURCE_ID, sourceType: GIT_REPOSITORY_REVISION_SOURCE, repositoryRef: 'brain', adapterType: 'git.repository.revision', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 16, enabled: true, bootstrapWatermark: null }), 'created');
}

function orchestrator(store: AgentModeSqliteStateStore, runtime: MockAgentRuntime, options: Partial<ConstructorParameters<typeof AgentModeDynamicWorkerOrchestrator>[0]> = {}) {
  return new AgentModeDynamicWorkerOrchestrator({
    store,
    runtime,
    actionRules: [enabledRule()],
    rootFacts: (rootGoalId, now) => rootGoalId === ROOT_GOAL_ID ? rootFacts(now) : undefined,
    ownerId: 'owner:e1',
    controllerRef: E1_FIXTURE_CONTROLLER_REF,
    now: T0,
    clock: () => T0,
    ...options,
  });
}

async function withStore<T>(fn: (store: AgentModeSqliteStateStore, databasePath: string, root: string) => Promise<T>): Promise<T> {
  const fixture = createDatabase();
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  try { return await fn(store, fixture.databasePath, fixture.root); } finally { try { store.close(); } catch {} rmSync(fixture.root, { recursive: true, force: true }); }
}

function enqueue(store: AgentModeSqliteStateStore, item: AgentModeSchedulerEventInput): void { assert.equal(store.createSchedulerEvent(item), 'created'); }

test('E1 action intent is a separate closed registry from spawn permission', () => {
  assert.equal(DEFAULT_SCHEDULER_EVENT_ACTION_RULES[0]?.enabled, false);
  assert.doesNotThrow(() => new AgentModeDynamicWorkerOrchestrator({ store: new AgentModeSqliteStateStore(':memory:'), runtime: fixtureRuntime(), rootFacts: () => rootFacts() }));
  assert.throws(() => new AgentModeDynamicWorkerOrchestrator({ store: new AgentModeSqliteStateStore(':memory:'), runtime: fixtureRuntime(), rootFacts: () => rootFacts(), actionRules: [enabledRule({ sourceType: 'unknown.source' })] }), /RULE_EVENT_UNKNOWN/);
});

test('E1 valid event with no configured action rule is a bounded NO_ACTION', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:no-rule'));
  const runtime = fixtureRuntime();
  const result = await new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [], rootFacts: () => rootFacts(), now: T0, clock: () => T0 }).advance();
  assert.equal(result.decisions[0]?.result, 'NO_ACTION');
  assert.equal(store.getSchedulerEvent('event:no-rule')?.status, 'completed');
  assert.equal(store.listAgents().length, 0); assert.equal(runtime.dispatchInvocationCount, 0);
}));

test('E1 disabled rule and policy allowlist alone do not spawn', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:disabled'));
  const runtime = fixtureRuntime();
  const result = await new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [E1_FIXTURE_ACTION_RULE], rootFacts: () => rootFacts(), now: T0, clock: () => T0 }).advance();
  assert.equal(result.decisions[0]?.result, 'NO_ACTION'); assert.equal(runtime.dispatchInvocationCount, 0); assert.equal(store.listAgents().length, 0);
}));

test('E1 missing authoritative root binding creates no child', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:no-root', { payload: { repositoryRef: 'brain', subject: 'root missing' } }));
  let rootLookups = 0;
  const result = await new AgentModeDynamicWorkerOrchestrator({ store, runtime: fixtureRuntime(), actionRules: [enabledRule()], rootFacts: () => { rootLookups += 1; return rootFacts(); }, now: T0, clock: () => T0 }).advance();
  assert.equal(result.decisions[0]?.result, 'NO_ACTION'); assert.equal(result.decisions[0]?.reasonCode, 'ROOT_GOAL_REQUIRED'); assert.equal(rootLookups, 0); assert.equal(store.listAgents().length, 0);
}));

test('E1 positive path composes scheduler, spawn, assignment, D1 Mock runtime, settlement, reopen, and observer', async () => withStore(async (store, databasePath) => {
  configureSource(store); enqueue(store, event('event:positive'));
  const runtime = fixtureRuntime(); const result = await orchestrator(store, runtime).advance(); const decision = result.decisions[0]!;
  assert.equal(decision.result, 'COMPLETED'); assert.equal(decision.terminalWorkerOutcome, 'succeeded'); assert.equal(runtime.dispatchInvocationCount, 1);
  assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(store.listTasks().length, 1); assert.equal(store.listRuns().length, 1); assert.equal(store.listAttempts().length, 1); assert.equal(store.listWorkcells().length, 0);
  assert.equal(store.getSchedulerEvent('event:positive')?.status, 'completed');
  const child = store.getAgent(decision.childAgentId!); const assignment = store.getChildAssignment(decision.childAgentId!); assert.equal(child?.spawnIntentKey, decision.spawnIntentKey); assert.equal(assignment?.assignmentIntentKey, decision.assignmentIntentKey); assert.equal(assignment?.status, 'completed');
  store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); try {
    const observer = readAgentModeObserver(T1, databasePath); const chain = observer.dynamicWorkerOrchestrations.find((item) => item.schedulerEventId === 'event:positive');
    assert.equal(chain?.actionRuleId, E1_FIXTURE_ACTION_RULE_ID); assert.equal(chain?.actionRuleApplicationId, decision.actionRuleApplicationId); assert.equal(chain?.childAgentId, decision.childAgentId); assert.equal(chain?.taskId, decision.taskId); assert.equal(chain?.runId, decision.runId); assert.equal(chain?.attemptId, decision.attemptId); assert.equal(chain?.operationId, decision.operationId); assert.equal(chain?.dispatchId, decision.dispatchId); assert.equal(chain?.terminalWorkerOutcome, 'succeeded');
  } finally { reopened.close(); }
}));

test('E1 redelivery ten times converges on one lifecycle and no duplicate budget or total creation', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:redelivery'));
  const runtime = fixtureRuntime(); const first = await orchestrator(store, runtime).advance(); const firstDecision = first.decisions[0]!;
  for (let index = 0; index < 10; index += 1) {
    const result = await orchestrator(store, runtime, { now: T1, clock: () => T1 }).handleSchedulerEvent({ event: store.getSchedulerEvent('event:redelivery')!, now: T1 });
    assert.equal(result.result, 'COMPLETED');
  }
  const root = store.getSpawnRootState(ROOT_GOAL_ID)!; assert.equal(root.totalChildCreations, 1); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(store.listTasks().length, 1); assert.equal(store.listAttempts().length, 1); assert.equal(runtime.dispatchInvocationCount, 1); assert.equal(firstDecision.childAgentId, store.listAgents().find((agent) => agent.agentKind === 'worker')?.agentId);
}));

test('E1 concurrent scheduler claims produce one worker', async () => withStore(async (store, databasePath) => {
  configureSource(store); enqueue(store, event('event:concurrent'));
  const firstStore = new AgentModeSqliteStateStore(databasePath); const secondStore = new AgentModeSqliteStateStore(databasePath); const firstRuntime = fixtureRuntime(); const secondRuntime = fixtureRuntime();
  try {
    const [first, second] = await Promise.all([orchestrator(firstStore, firstRuntime).advance(), orchestrator(secondStore, secondRuntime).advance()]);
    assert.equal([first, second].filter((item) => item.decisions[0]?.result === 'COMPLETED').length, 1); assert.equal(firstRuntime.dispatchInvocationCount + secondRuntime.dispatchInvocationCount, 1); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
  } finally { firstStore.close(); secondStore.close(); }
}));

test('E1 root concurrency ceiling is enforced while workers are in flight', async () => withStore(async (store) => {
  configureSource(store);
  for (let index = 1; index <= 5; index += 1) enqueue(store, event(`event:in-flight-${index}`));
  let startedCount = 0;
  let release!: () => void;
  const checkpoint = new Promise<void>((resolve) => { release = resolve; });
  let resolveFour!: () => void;
  const fourStarted = new Promise<void>((resolve) => { resolveFour = resolve; });
  const runtime = fixtureRuntime({ checkpoint, started: () => { startedCount += 1; if (startedCount === 4) resolveFour(); } });
  const pending = Array.from({ length: 5 }, () => orchestrator(store, runtime).advance());
  await Promise.race([fourStarted, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('bounded concurrency fixture timed out')), 1_000))]);
  release();
  const results = await Promise.all(pending);
  assert.equal(results.filter((item) => item.decisions[0]?.result === 'DEFERRED').length, 1);
  assert.equal(runtime.dispatchInvocationCount, 4);
  assert.equal(store.getSpawnRootState(ROOT_GOAL_ID)?.activeChildren, 0);
  assert.equal(store.getSpawnRootState(ROOT_GOAL_ID)?.totalChildCreations, 4);
}));

test('E1 crash after child creation resumes the same child and assignment', async () => withStore(async (store, databasePath, root) => {
  configureSource(store); enqueue(store, event('event:crash-child'));
  let crashed = false; const first = await orchestrator(store, fixtureRuntime(), { phaseHook: (phase: DynamicWorkerPhase) => { if (!crashed && phase === 'before_assignment') { crashed = true; throw new Error('fixture crash'); } } }).advance();
  assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(store.listTasks().length, 0); store.close();
  const reopened = new AgentModeSqliteStateStore(databasePath); try { const second = await orchestrator(reopened, fixtureRuntime(), { rootFacts: (id, now) => id === ROOT_GOAL_ID ? rootFacts(now) : undefined }).advance(T1); assert.equal(second.decisions[0]?.result, 'COMPLETED'); assert.equal(reopened.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(reopened.listTasks().length, 1); } finally { reopened.close(); }
}));

test('E1 crash before policy and before child commit are safe to retry', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:crash-policy'));
  let firstCrash = true; const first = await orchestrator(store, fixtureRuntime(), { phaseHook: (phase) => { if (firstCrash && phase === 'before_policy') { firstCrash = false; throw new Error('fixture crash'); } } }).advance(); assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listAgents().length, 0);
  const second = await orchestrator(store, fixtureRuntime(), { now: T1, clock: () => T1, phaseHook: (phase) => { if (phase === 'before_child_creation') throw new Error('fixture crash'); } }).advance(T1); assert.equal(second.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listAgents().length, 0);
  const third = await orchestrator(store, fixtureRuntime(), { now: T3, clock: () => T3 }).advance(T3); assert.equal(third.decisions[0]?.result, 'COMPLETED'); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
}));

test('E1 crash after assignment resumes the same dispatch', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:crash-assignment'));
  let crashed = false; const runtime = fixtureRuntime(); const first = await orchestrator(store, runtime, { phaseHook: (phase: DynamicWorkerPhase) => { if (!crashed && phase === 'before_dispatch') { crashed = true; throw new Error('fixture crash'); } } }).advance();
  assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listTasks().length, 1); assert.equal(runtime.dispatchInvocationCount, 0); const secondRuntime = fixtureRuntime(); const second = await orchestrator(store, secondRuntime, { now: T1, clock: () => T1 }).advance(T1); assert.equal(second.decisions[0]?.result, 'COMPLETED'); assert.equal(secondRuntime.dispatchInvocationCount, 1); assert.equal(store.listTasks().length, 1); assert.equal(store.listAttempts().length, 1);
}));

test('E1 uncertain runtime never replays or creates a replacement', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:uncertain'));
  const runtime = fixtureRuntime({ crashAfterInvocation: true }); const first = await orchestrator(store, runtime).advance(); assert.equal(first.decisions[0]?.result, 'UNCERTAIN'); assert.equal(store.getSchedulerEvent('event:uncertain')?.status, 'failed');
  const second = await orchestrator(store, runtime, { now: T1, clock: () => T1 }).advance(T1); assert.equal(second.decisions[0]?.result, 'UNCERTAIN', JSON.stringify(second)); assert.equal(runtime.dispatchInvocationCount, 1); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(store.listAttempts()[0]?.status, 'uncertain');
}));

test('E1 crash after worker settlement resumes event completion without runtime replay', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:crash-event-settlement'));
  let crashed = false; const firstRuntime = fixtureRuntime(); const first = await orchestrator(store, firstRuntime, { phaseHook: (phase) => { if (!crashed && phase === 'before_event_settlement') { crashed = true; throw new Error('fixture crash'); } } }).advance(); assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(firstRuntime.dispatchInvocationCount, 1); assert.equal(store.listAttempts()[0]?.status, 'completed');
  const secondRuntime = fixtureRuntime(); const second = await orchestrator(store, secondRuntime, { now: T1, clock: () => T1 }).advance(T1); assert.equal(second.decisions[0]?.result, 'COMPLETED', JSON.stringify({ second, event: store.getSchedulerEvent('event:crash-event-settlement') })); assert.equal(secondRuntime.dispatchInvocationCount, 0); assert.equal(store.getSchedulerEvent('event:crash-event-settlement')?.status, 'completed');
}));

test('E1 known runtime failure is terminal without replacement', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:failure'));
  const runtime = fixtureRuntime({ status: 'failed', failureCode: 'E1_FIXTURE_FAILURE' }); const result = await orchestrator(store, runtime).advance(); assert.equal(result.decisions[0]?.result, 'COMPLETED'); assert.equal(result.decisions[0]?.terminalWorkerOutcome, 'failed'); assert.equal(store.getSchedulerEvent('event:failure')?.status, 'completed'); assert.equal(runtime.dispatchInvocationCount, 1); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
}));

test('E1 cancellation before dispatch settles cancelled without runtime invocation', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:cancel-before'));
  let requested = false; const runtime = fixtureRuntime(); const result = await orchestrator(store, runtime, { phaseHook: (phase) => { if (!requested && phase === 'before_dispatch') { requested = true; const attempt = store.listAttempts()[0]!; assert.equal(store.requestCancellation({ requestId: 'cancel:e1', attemptId: attempt.attemptId, requestedAt: T0 }), 'created'); } } }).advance();
  assert.equal(result.decisions[0]?.result, 'COMPLETED'); assert.equal(result.decisions[0]?.terminalWorkerOutcome, 'cancelled'); assert.equal(runtime.dispatchInvocationCount, 0); assert.equal(store.getAgent(result.decisions[0]!.childAgentId!)?.status, 'cancelled'); assert.equal(store.getSchedulerEvent('event:cancel-before')?.status, 'completed');
}));

test('E1 in-flight cancellation propagates through D1 and settles once', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:cancel-running'));
  let release!: () => void; const checkpoint = new Promise<void>((resolve) => { release = resolve; }); let requested = false; const runtime = fixtureRuntime({ checkpoint, started: () => { if (!requested) { requested = true; const attempt = store.listAttempts()[0]!; assert.equal(store.requestCancellation({ requestId: 'cancel:e1-running', attemptId: attempt.attemptId, requestedAt: T0 }), 'created'); } } });
  const pending = orchestrator(store, runtime).advance(); await new Promise((resolve) => setImmediate(resolve)); release(); const result = await pending; assert.equal(result.decisions[0]?.result, 'COMPLETED'); assert.equal(result.decisions[0]?.terminalWorkerOutcome, 'cancelled'); assert.equal(runtime.dispatchInvocationCount, 1); assert.equal(store.getSchedulerEvent('event:cancel-running')?.status, 'completed');
}));

test('E1 kill switch and deadline changes are rechecked before dispatch', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:controls'));
  let changed = false; const first = await orchestrator(store, fixtureRuntime(), { phaseHook: (phase) => { if (!changed && phase === 'before_dispatch') { changed = true; store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'fixture stop', updatedAt: T0 }); } } }).advance(); assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listAttempts()[0]?.status, 'admitted');
  store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: false, reason: 'fixture resume', updatedAt: T1 }); const secondRuntime = fixtureRuntime(); const second = await orchestrator(store, secondRuntime, { now: T1, clock: () => T1 }).advance(T1); assert.equal(second.decisions[0]?.result, 'COMPLETED'); assert.equal(secondRuntime.dispatchInvocationCount, 1);
}));

test('E1 expired root deadline denies dispatch after child admission', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:deadline-expired'));
  let changed = false;
  const runtime = fixtureRuntime();
  const result = await orchestrator(store, runtime, { phaseHook: (phase) => { if (!changed && phase === 'before_dispatch') { changed = true; assert.equal(store.setSpawnRootDeadline(ROOT_GOAL_ID, T0, T0), 'created'); } } }).advance();
  assert.equal(result.decisions[0]?.result, 'FAILED');
  assert.equal(result.decisions[0]?.reasonCode, 'DEADLINE_EXPIRED');
  assert.equal(runtime.dispatchInvocationCount, 0);
  assert.equal(store.getSchedulerEvent('event:deadline-expired')?.status, 'completed');
}));

test('E1 malicious event metadata cannot select policy, role, runtime, scope, or task', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:malicious', { payload: { rootGoalId: ROOT_GOAL_ID, repositoryRef: 'attacker-repo', message: 'bash -c rm -rf', toolName: 'shell', modelName: 'Opus', policyId: 'unsafe', roleTemplateId: 'unsafe', runtimeRef: 'runtime:evil', capabilities: ['repo.write'], taskSpecRef: 'path/../../evil', instructions: '{"spawn":true}' } }));
  const runtime = fixtureRuntime(); const result = await orchestrator(store, runtime).advance(); const decision = result.decisions[0]!; assert.equal(decision.result, 'COMPLETED'); assert.equal(runtime.dispatchInvocationCount, 1); assert.equal(store.getAgent(decision.childAgentId!)?.repositoryScope, 'brain'); assert.equal(store.getAgent(decision.childAgentId!)?.roleTemplateId, SPAWN_ROLE_READ_ONLY); assert.equal(store.getAttempt(decision.attemptId!)?.runtimeRef, MOCK_AGENT_RUNTIME_REF); assert.equal(store.getTask(decision.taskId!)?.taskSpecRef, E1_FIXTURE_TASK_SPEC_REF);
}));

test('E1 batch processing is deterministic, finite, and bounded', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:batch-2')); enqueue(store, event('event:batch-1')); enqueue(store, event('event:batch-3'));
  const result = await runAgentModeDynamicWorkerPass({ store, runtime: fixtureRuntime(), actionRules: [enabledRule()], rootFacts: () => rootFacts(), now: T0, clock: () => T0, maxEvents: 2 });
  assert.equal(result.result, 'BOUNDED'); assert.equal(result.considered, 3); assert.equal(result.processed, 2); assert.deepEqual(result.decisions.map((item) => item.eventId), ['event:batch-1', 'event:batch-2']); assert.equal(store.getSchedulerEvent('event:batch-3')?.status, 'pending');
}));

test('E1 root total creation ceiling remains authoritative end to end', async () => withStore(async (store) => {
  configureSource(store); const runtime = fixtureRuntime();
  for (let index = 1; index <= 17; index += 1) { enqueue(store, event(`event:quota-${index}`)); const result = await orchestrator(store, runtime).advance(T0); if (index <= 16) assert.equal(result.decisions[0]?.result, 'COMPLETED'); else assert.equal(result.decisions[0]?.result, 'DENIED'); }
  assert.equal(store.getSpawnRootState(ROOT_GOAL_ID)?.totalChildCreations, 16); assert.equal(runtime.dispatchInvocationCount, 16); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 16);
}));

test('E1 root aggregate budget denial creates no child or runtime call', async () => withStore(async (store) => {
  configureSource(store); enqueue(store, event('event:budget-denied'));
  const runtime = fixtureRuntime(); const result = await new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [enabledRule()], rootFacts: (id, now) => id === ROOT_GOAL_ID ? { ...rootFacts(now), root: { ...rootFacts(now).root!, remainingBudget: 0.01 } } : undefined, now: T0, clock: () => T0 }).advance(); assert.equal(result.decisions[0]?.result, 'DENIED'); assert.equal(result.decisions[0]?.reasonCode, 'BUDGET_EXCEEDED'); assert.equal(store.listAgents().length, 0); assert.equal(runtime.dispatchInvocationCount, 0);
}));

test('E1 quiet pass is NO_ACTION with zero workers and runtime calls', async () => withStore(async (store) => {
  const runtime = fixtureRuntime(); const result = await runAgentModeDynamicWorkerPass({ store, runtime, actionRules: [enabledRule()], rootFacts: () => rootFacts(), now: T0, clock: () => T0 }); assert.equal(result.result, 'NO_ACTION'); assert.equal(result.processed, 0); assert.equal(store.listAgents().length, 0); assert.equal(runtime.dispatchInvocationCount, 0);
}));
