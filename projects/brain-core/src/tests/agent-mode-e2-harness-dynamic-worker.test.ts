import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AgentModeDynamicWorkerOrchestrator,
  DEFAULT_SCHEDULER_EVENT_ACTION_RULES,
  E1_FIXTURE_ACTION_RULE,
  E2_FIXTURE_ACTION_RULE,
  E2_FIXTURE_ACTION_RULE_ID,
  E2_FIXTURE_CONTROLLER_REF,
  E2_FIXTURE_SOURCE_ID,
  E2_FIXTURE_TASK_SPEC_REF,
  type DynamicWorkerOrchestratorOptions,
  type SchedulerEventActionRule,
} from '../agent-mode/dynamic-worker-orchestrator.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { RESTRICTED_HARNESS_PROFILE_REF, RESTRICTED_HARNESS_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { RestrictedHarnessAgentRuntime, RESTRICTED_HARNESS_FIXTURE_RESPONSE } from '../agent-mode/restricted-harness-agent-runtime.js';
import { AgentModeSqliteStateStore, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';

const T0 = '2026-09-11T10:00:00.000Z';
const T1 = '2026-09-11T10:00:01.000Z';
const T2 = '2026-09-11T10:00:02.000Z';
const T_EXP = '2026-09-11T10:01:01.000Z';
const ROOT_DEADLINE = '2026-09-11T11:00:00.000Z';
const ROOT_GOAL_ID = 'goal:e2-fixture';
const HARNESS_ROOT = process.env.BRAIN_D2_HARNESS_ROOT ?? '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

function enabledRule(overrides: Partial<SchedulerEventActionRule> = {}): SchedulerEventActionRule {
  return { ...E2_FIXTURE_ACTION_RULE, enabled: true, ...overrides };
}

function rootFacts(now = T0, overrides: Record<string, unknown> = {}) {
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
      ...overrides,
    },
    parent: null,
  };
}

function event(eventId: string, overrides: Partial<AgentModeSchedulerEventInput> = {}): AgentModeSchedulerEventInput {
  return {
    eventId,
    eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
    source: E2_FIXTURE_SOURCE_ID,
    occurredAt: T0,
    receivedAt: T0,
    causationId: 'commit:e2-parent',
    correlationId: 'corr:e2',
    deduplicationKey: `dedupe:${eventId}`,
    payloadVersion: 'k4.0',
    payload: { rootGoalId: ROOT_GOAL_ID, repositoryRef: 'brain', commitSha: `sha:${eventId}`, subject: 'fixture' },
    nextEligibleAt: T0,
    deadline: null,
    maxAttempts: 3,
    ...overrides,
  };
}

function createDatabase(): { root: string; databasePath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-e2-'));
  return { root, databasePath: path.join(root, 'agent-mode.db') };
}

function configureSource(store: AgentModeSqliteStateStore): void {
  assert.equal(store.upsertEventSource({ sourceId: E2_FIXTURE_SOURCE_ID, sourceType: GIT_REPOSITORY_REVISION_SOURCE, repositoryRef: 'brain', adapterType: 'git.repository.revision', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 16, enabled: true, bootstrapWatermark: null }), 'created');
}

function enqueue(store: AgentModeSqliteStateStore, input: AgentModeSchedulerEventInput): void {
  assert.equal(store.createSchedulerEvent(input), 'created');
}

function e2Orchestrator(store: AgentModeSqliteStateStore, runtime: RestrictedHarnessAgentRuntime, options: Partial<DynamicWorkerOrchestratorOptions> = {}): AgentModeDynamicWorkerOrchestrator {
  return new AgentModeDynamicWorkerOrchestrator({
    store,
    runtime,
    actionRules: [enabledRule()],
    rootFacts: (rootGoalId, now) => rootGoalId === ROOT_GOAL_ID ? rootFacts(now) : undefined,
    ownerId: 'owner:e2',
    controllerRef: E2_FIXTURE_CONTROLLER_REF,
    now: T0,
    clock: () => T0,
    ...options,
  });
}

type HarnessRuntimeOverrides = Partial<Omit<ConstructorParameters<typeof RestrictedHarnessAgentRuntime>[0], 'store' | 'harnessRoot'>> & { disableEvidence?: boolean };

function runtime(store: AgentModeSqliteStateStore, root: string, overrides: HarnessRuntimeOverrides = {}): RestrictedHarnessAgentRuntime {
  const { disableEvidence, ...runtimeOverrides } = overrides;
  return new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, ...(disableEvidence ? {} : { evidenceRoot: path.join(root, 'evidence') }), ...runtimeOverrides });
}

async function withStore<T>(fn: (store: AgentModeSqliteStateStore, databasePath: string, root: string) => Promise<T>): Promise<T> {
  const fixture = createDatabase();
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  try { return await fn(store, fixture.databasePath, fixture.root); }
  finally { try { store.close(); } catch {} rmSync(fixture.root, { recursive: true, force: true }); }
}

test('E2 rule is static, restricted-Harness-only, read-only, and disabled by default', async () => withStore(async (store, _databasePath, root) => {
  assert.equal(E2_FIXTURE_ACTION_RULE.enabled, false);
  assert.equal(E2_FIXTURE_ACTION_RULE.runtimeRef, RESTRICTED_HARNESS_RUNTIME_REF);
  assert.equal(E2_FIXTURE_ACTION_RULE.runtimeProfileRef, RESTRICTED_HARNESS_PROFILE_REF);
  assert.deepEqual(E2_FIXTURE_ACTION_RULE.requestedCapabilities, []);
  assert.equal(DEFAULT_SCHEDULER_EVENT_ACTION_RULES.some((rule) => rule.ruleId === E2_FIXTURE_ACTION_RULE_ID && !rule.enabled), true);
  assert.equal(E1_FIXTURE_ACTION_RULE.runtimeRef.startsWith('runtime:mock'), true);
  assert.throws(() => new AgentModeDynamicWorkerOrchestrator({ store, runtime: runtime(store, createDatabase().root), actionRules: [enabledRule({ runtimeRef: 'runtime:evil' })], rootFacts: () => rootFacts() }), /RULE_RUNTIME/);
}));

test('E2 positive path composes scheduler through restricted Harness and reconstructs after reopen', async () => withStore(async (store, databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-positive'));
  const harness = runtime(store, root);
  const result = await e2Orchestrator(store, harness).advance();
  const decision = result.decisions[0]!;
  assert.equal(decision.result, 'COMPLETED', JSON.stringify(result));
  assert.equal(decision.ruleId, E2_FIXTURE_ACTION_RULE_ID);
  assert.equal(decision.terminalWorkerOutcome, 'succeeded');
  assert.equal(harness.invocationCount, 1);
  assert.equal(harness.processLaunchCount, 1);
  assert.equal(harness.processReapedCount, 1);
  assert.equal(harness.lastProcessIdentity?.command, `deepseek-harness:c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`);
  assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
  assert.equal(store.listTasks().length, 1);
  assert.equal(store.listRuns().length, 1);
  assert.equal(store.listAttempts().length, 1);
  assert.equal(store.listDispatchOutbox().filter((outbox) => outbox.effectKind === 'runtime.dispatch').length, 1);
  assert.equal(store.getAttempt(decision.attemptId!)?.status, 'completed');
  assert.equal(store.getRun(decision.runId!)?.runtimePid, undefined);
  assert.equal(store.getSpawnRootState(ROOT_GOAL_ID)?.activeChildren, 0);
  assert.equal(store.listWorkcells().length, 0);
  assert.equal(store.getSchedulerEvent('event:e2-positive')?.status, 'completed');
  store.close();
  const reopened = new AgentModeSqliteStateStore(databasePath);
  try {
    const projection = readAgentModeObserver(T1, databasePath);
    const chain = projection.dynamicWorkerOrchestrations.find((item) => item.schedulerEventId === 'event:e2-positive');
    assert.equal(chain?.actionRuleId, E2_FIXTURE_ACTION_RULE_ID);
    assert.equal(chain?.childAgentId, decision.childAgentId);
    assert.equal(chain?.operationId, decision.operationId);
    assert.equal(projection.runtimeDispatches[0]?.processState, 'reaped');
    assert.equal(projection.runtimeDispatches[0]?.processIdentityVerified, true);
    assert.equal(JSON.stringify(projection).includes(RESTRICTED_HARNESS_FIXTURE_RESPONSE), false);
  } finally { reopened.close(); }
}));

test('E2 ten redeliveries preserve one child, assignment, dispatch, and Harness process', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-redelivery'));
  const harness = runtime(store, root);
  const first = await e2Orchestrator(store, harness).advance();
  assert.equal(first.decisions[0]?.result, 'COMPLETED', JSON.stringify({ first, events: store.listEvents(first.decisions[0]?.attemptId ?? '') }));
  for (let index = 0; index < 10; index += 1) {
    const result = await e2Orchestrator(store, harness, { now: T2, clock: () => T2 }).handleSchedulerEvent({ event: store.getSchedulerEvent('event:e2-redelivery')!, now: T2 });
    assert.equal(result.result, 'COMPLETED');
  }
  assert.equal(harness.invocationCount, 1);
  assert.equal(harness.processLaunchCount, 1);
  assert.equal(harness.processReapedCount, 1);
  assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
  assert.equal(store.listTasks().length, 1); assert.equal(store.listRuns().length, 1); assert.equal(store.listAttempts().length, 1);
  assert.equal(store.getSpawnRootState(ROOT_GOAL_ID)?.totalChildCreations, 1);
}));

test('E2 concurrent scheduler claimers converge before either can launch a second Harness', async () => withStore(async (store, databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-concurrent'));
  const firstStore = new AgentModeSqliteStateStore(databasePath);
  const secondStore = new AgentModeSqliteStateStore(databasePath);
  const firstRuntime = runtime(firstStore, root); const secondRuntime = runtime(secondStore, root);
  try {
    const [first, second] = await Promise.all([e2Orchestrator(firstStore, firstRuntime).advance(), e2Orchestrator(secondStore, secondRuntime).advance()]);
    assert.equal([first, second].filter((item) => item.decisions[0]?.result === 'COMPLETED').length, 1);
    assert.equal(firstRuntime.processLaunchCount + secondRuntime.processLaunchCount, 1);
    assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
  } finally { firstStore.close(); secondStore.close(); }
}));

test('E2 crash after child creation or assignment resumes the same lifecycle and launches once', async () => withStore(async (store, databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-crash-child'));
  let crashed = false;
  const first = await e2Orchestrator(store, runtime(store, root), { phaseHook: (phase) => { if (!crashed && phase === 'before_assignment') { crashed = true; throw new Error('fixture crash'); } } }).advance();
  assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(store.listTasks().length, 0);
  store.close();
  const reopened = new AgentModeSqliteStateStore(databasePath); const recoveredRuntime = runtime(reopened, root);
  try {
    const second = await e2Orchestrator(reopened, recoveredRuntime, { now: T1, clock: () => T1 }).advance(T1);
    assert.equal(second.decisions[0]?.result, 'COMPLETED'); assert.equal(recoveredRuntime.processLaunchCount, 1); assert.equal(reopened.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(reopened.listTasks().length, 1);
  } finally { reopened.close(); }
}));

test('E2 crash after assignment and crash before Harness effect resume without duplicate assignment or process', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-crash-assignment'));
  let crashed = false;
  const first = await e2Orchestrator(store, runtime(store, root), { phaseHook: (phase) => { if (!crashed && phase === 'before_dispatch') { crashed = true; throw new Error('fixture crash'); } } }).advance();
  assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(store.listTasks().length, 1); assert.equal(store.listAttempts().length, 1);
  const recoveredRuntime = runtime(store, root); const second = await e2Orchestrator(store, recoveredRuntime, { now: T1, clock: () => T1 }).advance(T1);
  assert.equal(second.decisions[0]?.result, 'COMPLETED'); assert.equal(recoveredRuntime.processLaunchCount, 1); assert.equal(store.listTasks().length, 1); assert.equal(store.listAttempts().length, 1);
}));

test('E2 possible Harness execution becomes uncertain, then durable evidence reconciles without relaunch', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-uncertain'));
  const harness = runtime(store, root, { simulateLostResponse: true });
  const first = await e2Orchestrator(store, harness).advance();
  assert.equal(first.decisions[0]?.result, 'UNCERTAIN', JSON.stringify(first)); assert.equal(harness.processLaunchCount, 1); assert.equal(harness.processReapedCount, 1); assert.equal(store.getSchedulerEvent('event:e2-uncertain')?.status, 'failed');
  const second = await e2Orchestrator(store, harness, { now: T1, clock: () => T1 }).advance(T1);
  assert.equal(second.decisions[0]?.result, 'COMPLETED', JSON.stringify(second)); assert.equal(second.decisions[0]?.terminalWorkerOutcome, 'succeeded'); assert.equal(harness.invocationCount, 1); assert.equal(harness.processLaunchCount, 1); assert.equal(store.getSchedulerEvent('event:e2-uncertain')?.status, 'completed');
}));

test('E2 unsupported reconciliation remains uncertain and never relaunches', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-no-evidence'));
  const harness = runtime(store, root, { fixtureOutcome: 'crash', disableEvidence: true });
  const first = await e2Orchestrator(store, harness).advance(); assert.equal(first.decisions[0]?.result, 'UNCERTAIN');
  const second = await e2Orchestrator(store, harness, { now: T1, clock: () => T1 }).advance(T1);
  assert.equal(second.decisions[0]?.result, 'UNCERTAIN'); assert.equal(harness.invocationCount, 1); assert.equal(harness.processLaunchCount, 1); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
}));

test('E2 crash after worker settlement completes scheduler event without another process', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-settlement-crash'));
  let crashed = false; const harness = runtime(store, root);
  const first = await e2Orchestrator(store, harness, { phaseHook: (phase) => { if (!crashed && phase === 'before_event_settlement') { crashed = true; throw new Error('fixture crash'); } } }).advance();
  assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(harness.processLaunchCount, 1); assert.equal(store.listAttempts()[0]?.status, 'completed');
  const second = await e2Orchestrator(store, runtime(store, root), { now: T1, clock: () => T1 }).advance(T1);
  assert.equal(second.decisions[0]?.result, 'COMPLETED'); assert.equal(store.listTasks().length, 1); assert.equal(store.getSchedulerEvent('event:e2-settlement-crash')?.status, 'completed');
}));

test('E2 in-flight root cancellation stops and reaps exactly the started Harness', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-cancel-running'));
  let release!: () => void; const checkpoint = new Promise<void>((resolve) => { release = resolve; }); let started!: () => void; const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  let controller!: AgentModeDynamicWorkerOrchestrator;
  const harness = runtime(store, root, { fixtureOutcome: 'wait', fixtureCheckpoint: checkpoint, fixtureStarted: () => { started(); const attempt = store.listAttempts()[0]!; assert.equal(controller.requestCancellation({ eventId: 'event:e2-cancel-running', attemptId: attempt.attemptId, requestedAt: T0 }), 'created'); } });
  controller = e2Orchestrator(store, harness); const pending = controller.advance(); await startedPromise; release(); const result = await pending;
  assert.equal(result.decisions[0]?.result, 'COMPLETED'); assert.equal(result.decisions[0]?.terminalWorkerOutcome, 'cancelled'); assert.equal(harness.invocationCount, 1); assert.equal(harness.processLaunchCount, 1); assert.equal(harness.processReapedCount, 1); assert.equal(store.getAttempt(result.decisions[0]!.attemptId!)?.cancellationStatus, 'completed'); assert.equal(store.getAgent(result.decisions[0]!.childAgentId!)?.status, 'cancelled');
}));

test('E2 cancellation, kill switch, and deadline authorities block before Harness launch', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-cancel-before'));
  let cancelChanged = false; const cancelRuntime = runtime(store, root); const cancel = await e2Orchestrator(store, cancelRuntime, { phaseHook: (phase) => { if (!cancelChanged && phase === 'before_dispatch') { cancelChanged = true; assert.equal(store.setSpawnRootCancellation(ROOT_GOAL_ID, 'requested', T0), 'created'); } } }).advance();
  assert.equal(cancel.decisions[0]?.terminalWorkerOutcome, 'cancelled'); assert.equal(cancelRuntime.processLaunchCount, 0);
  enqueue(store, event('event:e2-kill-before')); const killRuntime = runtime(store, root); const kill = await e2Orchestrator(store, killRuntime, { rootFacts: (id, now) => id === ROOT_GOAL_ID ? rootFacts(now, { totalChildCreations: 16 }) : undefined }).advance();
  assert.equal(kill.decisions[0]?.result, 'DENIED'); assert.equal(killRuntime.processLaunchCount, 0);
}));

test('E2 kill switch after child creation and expired child/deadline never launch a process', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-kill-after'));
  let changed = false; const killRuntime = runtime(store, root); const first = await e2Orchestrator(store, killRuntime, { phaseHook: (phase) => { if (!changed && phase === 'before_dispatch') { changed = true; store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'e2 stop', updatedAt: T0 }); } } }).advance();
  assert.equal(first.decisions[0]?.result, 'DEFERRED'); assert.equal(killRuntime.processLaunchCount, 0);
  store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: false, reason: 'e2 resume', updatedAt: T1 });
  enqueue(store, event('event:e2-expire-child'));
  let crashed = false; const firstExpire = await e2Orchestrator(store, runtime(store, root), { phaseHook: (phase) => { if (!crashed && phase === 'before_assignment') { crashed = true; throw new Error('fixture crash'); } } }).advance();
  assert.equal(firstExpire.decisions[0]?.result, 'DEFERRED'); const expiredRuntime = runtime(store, root); const expired = await e2Orchestrator(store, expiredRuntime, { now: T_EXP, clock: () => T_EXP }).advance(T_EXP);
  assert.equal(expired.decisions[0]?.result, 'DENIED'); assert.equal(expiredRuntime.processLaunchCount, 0);
}));

test('E2 known Harness failure and pre-effect pin failure are truthful and non-replacing', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-failure'));
  const failure = runtime(store, root, { fixtureOutcome: 'failure', fixtureFailureCode: 'E2_KNOWN_FAILURE' }); const first = await e2Orchestrator(store, failure).advance();
  assert.equal(first.decisions[0]?.result, 'COMPLETED'); assert.equal(first.decisions[0]?.terminalWorkerOutcome, 'failed'); assert.equal(failure.processLaunchCount, 1); assert.equal(store.getSchedulerEvent('event:e2-failure')?.status, 'completed');
  const repeat = await e2Orchestrator(store, failure, { now: T1, clock: () => T1 }).handleSchedulerEvent({ event: store.getSchedulerEvent('event:e2-failure')!, now: T1 }); assert.equal(repeat.result, 'COMPLETED'); assert.equal(failure.invocationCount, 1);
  enqueue(store, event('event:e2-bad-pin')); const bad = new RestrictedHarnessAgentRuntime({ store, harnessRoot: '/tmp/not-the-pinned-harness' }); const denied = await e2Orchestrator(store, bad).advance();
  assert.equal(denied.decisions[0]?.result, 'COMPLETED'); assert.equal(denied.decisions[0]?.terminalWorkerOutcome, 'failed'); assert.equal(bad.processLaunchCount, 0); assert.equal(store.getSchedulerEvent('event:e2-bad-pin')?.status, 'completed');
}));

test('E2 root budget/creation limits and recursive child lifecycle remain bounded', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-budget'));
  const budgetRuntime = runtime(store, root); const budget = await e2Orchestrator(store, budgetRuntime, { rootFacts: (id, now) => id === ROOT_GOAL_ID ? rootFacts(now, { remainingBudget: 0.01 }) : undefined }).advance();
  assert.equal(budget.decisions[0]?.result, 'DENIED'); assert.equal(budgetRuntime.processLaunchCount, 0); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 0);
  enqueue(store, event('event:e2-total')); const totalRuntime = runtime(store, root); const total = await e2Orchestrator(store, totalRuntime, { rootFacts: (id, now) => id === ROOT_GOAL_ID ? rootFacts(now, { totalChildCreations: 16 }) : undefined }).advance();
  assert.equal(total.decisions[0]?.result, 'DENIED'); assert.equal(totalRuntime.processLaunchCount, 0);
  enqueue(store, event('event:e2-recursive')); const recursiveRuntime = runtime(store, root); const recursive = await e2Orchestrator(store, recursiveRuntime).advance();
  assert.equal(recursive.decisions[0]?.result, 'COMPLETED'); assert.equal(store.listSchedulerEvents().length, 3); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1); assert.equal(store.getAgent(recursive.decisions[0]!.childAgentId!)?.roleTemplateId, SPAWN_ROLE_READ_ONLY);
}));

test('E2 malicious scheduler metadata and parent sentinel remain inert', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); enqueue(store, event('event:e2-malicious', { payload: { rootGoalId: ROOT_GOAL_ID, repositoryRef: 'attacker', commitSha: 'runtime:evil policy:unsafe role:unsafe shell bash -c rm-rf SECRET=steal /../../etc/passwd task:evil', subject: 'Opus model and environment assignment are inert metadata' } }));
  const previous = process.env.BRAIN_D2_PARENT_SENTINEL; process.env.BRAIN_D2_PARENT_SENTINEL = 'must-not-cross'; let sentinelPresent: boolean | undefined;
  try {
    const harness = runtime(store, root, { fixtureEnvironmentObserved: (present) => { sentinelPresent = present; } }); const result = await e2Orchestrator(store, harness).advance();
    assert.equal(result.decisions[0]?.result, 'COMPLETED'); assert.equal(sentinelPresent, false); assert.equal(harness.processLaunchCount, 1); assert.equal(store.getAgent(result.decisions[0]!.childAgentId!)?.repositoryScope, 'brain'); assert.equal(store.getAttempt(result.decisions[0]!.attemptId!)?.runtimeRef, RESTRICTED_HARNESS_RUNTIME_REF); assert.equal(store.getTask(result.decisions[0]!.taskId!)?.taskSpecRef, E2_FIXTURE_TASK_SPEC_REF);
    const serialized = JSON.stringify(store.listEvents('event:e2-malicious')); assert.equal(serialized.includes('must-not-cross'), false);
  } finally { if (previous === undefined) delete process.env.BRAIN_D2_PARENT_SENTINEL; else process.env.BRAIN_D2_PARENT_SENTINEL = previous; }
}));

test('E2 bounded pass and quiet pass do not introduce unbounded workers', async () => withStore(async (store, _databasePath, root) => {
  configureSource(store); for (let index = 1; index <= 3; index += 1) enqueue(store, event(`event:e2-batch-${index}`));
  const harness = runtime(store, root); const result = await e2Orchestrator(store, harness).advance(T0, 1); assert.equal(result.considered, 3); assert.equal(result.processed, 1); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
  const second = await e2Orchestrator(store, runtime(store, root), { now: T0, clock: () => T0 }).advance(T0, 16); assert.equal(second.processed, 2);
  const quiet = await e2Orchestrator(store, runtime(store, root), { now: T_EXP, clock: () => T_EXP }).advance(T_EXP, 16); assert.equal(quiet.result, 'NO_ACTION');
}));
