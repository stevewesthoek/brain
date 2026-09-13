import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AgentModeOrganizationDelegationOrchestrator,
  deriveOrganizationExecutionProjection,
  delegationIntentKey,
  K5_B_FIXTURE_DELEGATION_RULES,
  ORGANIZATION_DELEGATION_RULES,
} from '../agent-mode/organization-delegation-orchestrator.js';
import {
  createK5AFixturePlan,
  deriveOrganizationPlanId,
  ORGANIZATION_ROLE_RESEARCH,
} from '../agent-mode/organization.js';
import { MOCK_AGENT_RUNTIME_PROFILE_REF, MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';

const NOW = '2026-09-13T10:00:00.000Z';
const ROOT_DEADLINE = '2026-09-13T12:00:00.000Z';
const ROOT_GOAL = 'goal:k5-b-fixture';
const SUPERVISOR = 'agent:jarvis:k5-b';
const SUPERVISOR_RUN = 'run:jarvis:k5-b';

function rootFacts(now = NOW) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT_GOAL, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1000, remainingBudget: 2, deadline: ROOT_DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: { agentId: SUPERVISOR, taskId: ROOT_GOAL, runId: SUPERVISOR_RUN, rootGoalId: ROOT_GOAL, depth: 0, cancellation: 'active' as const, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
  };
}

function fixtureRuntime(overrides: ConstructorParameters<typeof MockAgentRuntime>[0]['dispatch'] = {}) {
  return new MockAgentRuntime({
    runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:deferred', modelRef: 'model:deferred',
    modelResult: { kind: 'typed-fixture-result', traceId: 'k5-b', intent: { kind: 'no-outbox', relativePath: 'README.md' } },
    dispatch: overrides,
  });
}

function setup(): { store: AgentModeSqliteStateStore; databasePath: string; planId: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k5-b-'));
  const databasePath = path.join(root, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  store.upsertAgent({ agentId: SUPERVISOR, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId: ROOT_GOAL, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'supervisor-capabilities', capabilities: ['repo.read'] });
  assert.equal(store.createTask({ taskId: ROOT_GOAL, taskType: 'root-goal', inputHash: 'root-material', createdAt: NOW, status: 'admitted' }), 'created');
  assert.equal(store.createRun({ runId: SUPERVISOR_RUN, taskId: ROOT_GOAL, agentId: SUPERVISOR, createdAt: NOW, status: 'created' }), 'created');
  const plan = createK5AFixturePlan({ rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: ROOT_DEADLINE });
  const created = store.createOrganizationPlan(plan, NOW);
  assert.equal(created.result, 'created');
  return { store, databasePath, planId: deriveOrganizationPlanId(plan) };
}

function orchestrator(store: AgentModeSqliteStateStore, runtime: AgentRuntime, options: Partial<ConstructorParameters<typeof AgentModeOrganizationDelegationOrchestrator>[0]> = {}) {
  return new AgentModeOrganizationDelegationOrchestrator({ store, runtime, rootFacts: (rootGoalId, now) => rootGoalId === ROOT_GOAL ? rootFacts(now) : undefined, now: NOW, controllerRef: 'controller:k5-b', supervisorTaskId: ROOT_GOAL, supervisorRunId: SUPERVISOR_RUN, rules: K5_B_FIXTURE_DELEGATION_RULES, ...options });
}

test('K5-B uses a closed delegation mapping separate from organization roles', () => {
  assert.equal(ORGANIZATION_DELEGATION_RULES.length, 6);
  assert.equal(ORGANIZATION_DELEGATION_RULES.some((rule) => rule.enabled), false);
  assert.ok(K5_B_FIXTURE_DELEGATION_RULES.some((rule) => rule.organizationRoleId === ORGANIZATION_ROLE_RESEARCH && rule.enabled));
  for (const rule of ORGANIZATION_DELEGATION_RULES) {
    assert.equal(rule.runtimeRef, MOCK_AGENT_RUNTIME_REF);
    assert.equal(rule.runtimeProfileRef, MOCK_AGENT_RUNTIME_PROFILE_REF);
    assert.ok(!('modelRef' in rule));
    assert.ok(!('providerId' in rule));
    assert.ok(!('capabilityGrant' in rule));
  }
  assert.equal(delegationIntentKey('plan:a', 'item:a', 'rule:a', 1), delegationIntentKey('plan:a', 'item:a', 'rule:a', 1));
  assert.notEqual(delegationIntentKey('plan:a', 'item:a', 'rule:a', 1), delegationIntentKey('plan:a', 'item:b', 'rule:a', 1));
  const store = new AgentModeSqliteStateStore(':memory:');
  try {
    const malicious = { ...ORGANIZATION_DELEGATION_RULES[2], modelRef: 'model:attacker' } as unknown;
    assert.throws(() => orchestrator(store, fixtureRuntime(), { rules: [malicious] as never }), /unsupported authority fields/);
  } finally { store.close(); }
});

test('happy path delegates Research and Engineering, then gates Auditor', async () => {
  const { store, databasePath, planId } = setup();
  const runtime = fixtureRuntime();
  try {
    const controller = orchestrator(store, runtime);
    const first = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.equal(first.outcome, 'ADVANCED', JSON.stringify(first));
    assert.equal(runtime.dispatchInvocationCount, 2);
    assert.equal(first.projection.succeededCount, 2);
    assert.equal(first.projection.workItems.find((item) => item.workItemKey === 'independent-auditor')?.readiness, 'ready');
    assert.equal(store.listChildAssignments().length, 2);
    const second = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.equal(second.outcome, 'TERMINAL', JSON.stringify(second));
    assert.equal(runtime.dispatchInvocationCount, 3);
    assert.equal(second.projection.terminal, true);
    assert.equal(second.projection.terminalStatus, 'succeeded');
    assert.equal(second.projection.succeededCount, 3);
    assert.equal(store.listChildAssignments().length, 3);
    assert.equal(store.listTasks().filter((task) => task.taskType === 'agent-mode.child-assignment').length, 3);
    assert.equal(store.listRuns().filter((run) => run.childAgentId !== undefined).length, 3);
    assert.equal(store.listAttempts().filter((attempt) => attempt.childAgentId !== undefined).length, 3);
    assert.equal(store.listWorkcells().length, 0);
    assert.equal(store.listEffects().length, 3);
    const observer = readAgentModeObserver(NOW, databasePath);
    assert.equal(observer.organizationExecution[0]?.terminalStatus, 'succeeded');
    assert.equal(observer.organizationExecution[0]?.succeededCount, 3);
    for (const item of observer.organizationWorkItems) {
      assert.ok(item.childAgentId); assert.ok(item.taskId); assert.ok(item.runId); assert.ok(item.attemptId);
      assert.equal('prompt' in item, false); assert.equal('providerPayload' in item, false);
    }
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('repeated advancement and restart preserve one lifecycle per work item', async () => {
  const { store, databasePath, planId } = setup();
  try {
    const runtime = fixtureRuntime(); const controller = orchestrator(store, runtime);
    await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId });
    await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId });
    const before = { agents: store.listAgents().filter((agent) => agent.spawnIntentKey).length, tasks: store.listTasks().filter((task) => task.childAgentId).length, runs: store.listRuns().filter((run) => run.childAgentId).length, attempts: store.listAttempts().filter((attempt) => attempt.childAgentId).length, calls: runtime.dispatchInvocationCount };
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath); const restartedRuntime = fixtureRuntime();
    try {
      const result = await orchestrator(reopened, restartedRuntime).advanceOrganizationPlanOnce({ organizationPlanId: planId });
      assert.equal(result.outcome, 'TERMINAL');
      assert.deepEqual({ agents: reopened.listAgents().filter((agent) => agent.spawnIntentKey).length, tasks: reopened.listTasks().filter((task) => task.childAgentId).length, runs: reopened.listRuns().filter((run) => run.childAgentId).length, attempts: reopened.listAttempts().filter((attempt) => attempt.childAgentId).length, calls: restartedRuntime.dispatchInvocationCount }, { ...before, calls: 0 });
      assert.equal(deriveOrganizationExecutionProjection(reopened, reopened.getOrganizationPlan(planId)!, NOW).terminal, true);
    } finally { reopened.close(); }
  } finally { try { store.close(); } catch {} rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('crash after K4 child creation resumes the same child and binds it once', async () => {
  const { store, databasePath, planId } = setup();
  let crash = true;
  try {
    const runtime = fixtureRuntime();
    const controller = orchestrator(store, runtime, { phaseHook: (phase) => { if (phase === 'after_spawn' && crash) { crash = false; throw new Error('simulated crash'); } } });
    await assert.rejects(() => controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 }), /simulated crash/);
    assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 1);
    assert.equal(store.listOrganizationWorkItems(planId).filter((item) => item.boundChildAgentId).length, 0);
    const resumed = await orchestrator(store, runtime).advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    assert.equal(resumed.outcome, 'ADVANCED', JSON.stringify(resumed));
    assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 1);
    assert.equal(store.listChildAssignments().length, 1);
    assert.equal(store.listOrganizationWorkItems(planId).filter((item) => item.boundChildAgentId).length, 1);
    assert.equal(runtime.dispatchInvocationCount, 1);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('root cancellation blocks a ready plan before delegation', async () => {
  const { store, databasePath, planId } = setup();
  try {
    assert.equal(store.createTask({ taskId: 'task:cancel-marker', taskType: 'marker', inputHash: 'x', createdAt: NOW, status: 'pending' }), 'created');
    // The authoritative root task is the plan root; cancellation is represented
    // by the existing K4 root cancellation API after its spawn root exists.
    const runtime = fixtureRuntime();
    const initial = await orchestrator(store, runtime).advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    assert.equal(initial.advancedCount, 1);
    assert.equal(store.setSpawnRootCancellation(ROOT_GOAL, 'cancelled', NOW), 'created');
    const blocked = await orchestrator(store, runtime).advanceOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(blocked.projection.readyCount, 0);
    assert.equal(store.listChildAssignments().length, 1);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('failed predecessor produces a derived failure and never delegates Auditor', async () => {
  const { store, databasePath, planId } = setup();
  try {
    let invocationCount = 0;
    const runtime = {
      run: async ({ context }: Parameters<AgentRuntime['run']>[0]) => {
        invocationCount += 1;
        const status = invocationCount === 1 ? 'failed' : 'succeeded';
        return { status, runtimeReceiptId: `runtime-receipt:alternating:${invocationCount}`, resultHash: 'b'.repeat(64), evidenceRef: 'evidence:alternating', usage: { steps: 0, tokens: 0, cost: 0 }, ...(status === 'failed' ? { failureCode: 'FIXTURE_FAILURE' } : {}), traceSummary: [`attempt:${context.attemptId}`] };
      },
    } satisfies AgentRuntime;
    const controller = orchestrator(store, runtime);
    const first = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    assert.equal(first.advancedCount, 1);
    const second = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.equal(second.projection.failedCount, 1);
    assert.equal(second.projection.dependencyFailedCount, 1);
    assert.equal(second.projection.workItems.find((item) => item.workItemKey === 'independent-auditor')?.childAgentId, null);
    assert.equal(store.listChildAssignments().length, 2);
    assert.equal(invocationCount, 2);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('uncertain K4 dispatch is durable and is not replayed by supervisor retry', async () => {
  const { store, databasePath, planId } = setup();
  try {
    const runtime = fixtureRuntime({ crashAfterInvocation: true });
    const controller = orchestrator(store, runtime);
    const first = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    assert.equal(first.outcome, 'UNCERTAIN');
    const second = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    assert.equal(second.outcome, 'UNCERTAIN');
    assert.equal(runtime.dispatchInvocationCount, 1);
    assert.equal(store.listChildAssignments().length, 1);
    assert.equal(store.listTasks().filter((task) => task.childAgentId).length, 1);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('kill switch and plan expiry are rechecked before a new delegation', async () => {
  const first = setup();
  try {
    first.store.setSpawnAdmissionControl({ scope: 'root', rootGoalId: ROOT_GOAL, denied: true, reason: 'fixture-kill', updatedAt: NOW });
    const runtime = fixtureRuntime();
    const blocked = await orchestrator(first.store, runtime).advanceOrganizationPlanOnce({ organizationPlanId: first.planId });
    assert.equal(blocked.advancedCount, 0);
    assert.equal(first.store.listChildAssignments().length, 0);
  } finally { first.store.close(); rmSync(path.dirname(first.databasePath), { recursive: true, force: true }); }
  const second = setup();
  try {
    const runtime = fixtureRuntime();
    const expired = await orchestrator(second.store, runtime, { now: ROOT_DEADLINE }).advanceOrganizationPlanOnce({ organizationPlanId: second.planId });
    assert.equal(expired.advancedCount, 0);
    assert.equal(expired.projection.readyCount, 0);
    assert.equal(second.store.listChildAssignments().length, 0);
  } finally { second.store.close(); rmSync(path.dirname(second.databasePath), { recursive: true, force: true }); }
});

test('two controllers converge on one child, assignment, dispatch, and observer chain', async () => {
  const { store, databasePath, planId } = setup();
  const concurrentStore = new AgentModeSqliteStateStore(databasePath);
  try {
    const runtimeA = fixtureRuntime(); const runtimeB = fixtureRuntime();
    const [a, b] = await Promise.all([
      orchestrator(store, runtimeA).advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 }),
      orchestrator(concurrentStore, runtimeB).advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 }),
    ]);
    assert.ok(['ADVANCED', 'UNCERTAIN', 'DEFERRED', 'TERMINAL'].includes(a.outcome));
    assert.ok(['ADVANCED', 'UNCERTAIN', 'DEFERRED', 'TERMINAL'].includes(b.outcome));
    assert.equal(concurrentStore.listAgents().filter((agent) => agent.spawnIntentKey).length, 1);
    assert.equal(concurrentStore.listChildAssignments().length, 1);
    assert.equal(concurrentStore.listTasks().filter((task) => task.childAgentId).length, 1);
    assert.equal(concurrentStore.listRuns().filter((run) => run.childAgentId).length, 1);
    assert.equal(concurrentStore.listAttempts().filter((attempt) => attempt.childAgentId).length, 1);
    const observer = readAgentModeObserver(NOW, databasePath);
    assert.equal(observer.organizationPlans[0]?.organizationPlanId, planId);
    assert.equal(observer.organizationExecution[0]?.workItems.length, 3);
    assert.equal(observer.organizationWorkItems[0]?.organizationPlanId, planId);
    assert.equal('prompt' in (observer.organizationWorkItems[0] ?? {}), false);
  } finally { try { concurrentStore.close(); } catch {} try { store.close(); } catch {} rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});
