import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AgentModeOrganizationFinalizer,
  deriveOrganizationAggregation,
  organizationAuditorCandidates,
  organizationAggregationDigest,
  organizationFinalResultId,
  validateOrganizationAggregation,
  type OrganizationAggregation,
} from '../agent-mode/organization-finalization.js';
import { AgentModeOrganizationDelegationOrchestrator, K5_B_FIXTURE_DELEGATION_RULES } from '../agent-mode/organization-delegation-orchestrator.js';
import { createK5AFixturePlan, deriveOrganizationPlanId } from '../agent-mode/organization.js';
import { MOCK_AGENT_RUNTIME_PROFILE_REF, MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';

const NOW = '2026-09-13T10:00:00.000Z';
const ROOT_DEADLINE = '2026-09-13T12:00:00.000Z';
const ROOT_GOAL = 'goal:k5-c-fixture';
const SUPERVISOR = 'agent:jarvis:k5-c';
const SUPERVISOR_RUN = 'run:jarvis:k5-c';

function rootFacts(now = NOW) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT_GOAL, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1000, remainingBudget: 2, deadline: ROOT_DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: { agentId: SUPERVISOR, taskId: ROOT_GOAL, runId: SUPERVISOR_RUN, rootGoalId: ROOT_GOAL, depth: 0, cancellation: 'active' as const, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
  };
}

function runtime(overrides: ConstructorParameters<typeof MockAgentRuntime>[0]['dispatch'] = {}) {
  return new MockAgentRuntime({
    runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:deferred', modelRef: 'model:deferred',
    modelResult: { kind: 'typed-fixture-result', traceId: 'k5-c', intent: { kind: 'no-outbox', relativePath: 'README.md' } },
    dispatch: overrides,
  });
}

function setup(): { store: AgentModeSqliteStateStore; databasePath: string; planId: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k5-c-'));
  const databasePath = path.join(root, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  store.upsertAgent({ agentId: SUPERVISOR, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId: ROOT_GOAL, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'supervisor-capabilities', capabilities: ['repo.read'] });
  assert.equal(store.createTask({ taskId: ROOT_GOAL, taskType: 'root-goal', inputHash: 'root-material', createdAt: NOW, status: 'admitted' }), 'created');
  assert.equal(store.createRun({ runId: SUPERVISOR_RUN, taskId: ROOT_GOAL, agentId: SUPERVISOR, createdAt: NOW, status: 'created' }), 'created');
  const plan = createK5AFixturePlan({ rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: ROOT_DEADLINE });
  assert.equal(store.createOrganizationPlan(plan, NOW).result, 'created');
  return { store, databasePath, planId: deriveOrganizationPlanId(plan) };
}

function orchestrator(store: AgentModeSqliteStateStore, worker: AgentRuntime) {
  return new AgentModeOrganizationDelegationOrchestrator({
    store, runtime: worker, now: NOW, controllerRef: 'controller:k5-c', supervisorTaskId: ROOT_GOAL, supervisorRunId: SUPERVISOR_RUN,
    rootFacts: (rootGoalId, now) => rootGoalId === ROOT_GOAL ? rootFacts(now) : undefined,
    rules: K5_B_FIXTURE_DELEGATION_RULES,
  });
}

async function runHappy(store: AgentModeSqliteStateStore): Promise<MockAgentRuntime> {
  const worker = runtime();
  const controller = orchestrator(store, worker);
  await controller.advanceOrganizationPlanOnce({ organizationPlanId: deriveOrganizationPlanId(createK5AFixturePlan({ rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: ROOT_DEADLINE })) });
  await controller.advanceOrganizationPlanOnce({ organizationPlanId: deriveOrganizationPlanId(createK5AFixturePlan({ rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: ROOT_DEADLINE })) });
  return worker;
}

test('K5-C happy path finalizes one bounded receipt from K4 facts and reconstructs the ownership chain', async () => {
  const { store, databasePath, planId } = setup();
  try {
    const worker = await runHappy(store);
    const finalizer = new AgentModeOrganizationFinalizer(store, () => NOW);
    const finalized = finalizer.finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(finalized.outcome, 'FINALIZED', JSON.stringify(finalized));
    assert.equal(finalized.finalResult?.status, 'succeeded');
    assert.equal(finalized.finalResult?.workItemResults.length, 3);
    assert.equal(finalized.finalResult?.workItemResults.reduce((total, item) => total + item.evidenceRefs.length, 0), 3);
    assert.equal(finalized.finalResult?.auditorWorkItemId, store.listOrganizationWorkItems(planId).find((item) => item.workItemKey === 'independent-auditor')?.workItemId);
    assert.equal(finalized.finalResult?.totalSettledCost, 0);
    assert.equal(store.listOrganizationFinalResults().length, 1);
    assert.equal(store.getOrganizationPlan(planId)?.status, 'completed');
    assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 3);
    assert.equal(store.listTasks().filter((task) => task.childAgentId).length, 3);
    assert.equal(store.listRuns().filter((run) => run.childAgentId).length, 3);
    assert.equal(store.listAttempts().filter((attempt) => attempt.childAgentId).length, 3);
    assert.equal(worker.dispatchInvocationCount, 3);
    const observer = readAgentModeObserver(NOW, databasePath);
    assert.equal(observer.organizationFinalResults.length, 1);
    assert.equal(observer.organizationFinalResults[0]?.status, 'succeeded');
    assert.equal(observer.organizationFinalResults[0]?.workItemResultCount, 3);
    assert.equal(observer.organizationFinalResults[0]?.evidenceRefCount, 3);
    assert.equal(observer.organizationFinalResults[0]?.totalSettledCost, 0);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('finalization is deterministic, immutable, idempotent, and restart-safe', async () => {
  const { store, databasePath, planId } = setup();
  try {
    const worker = await runHappy(store);
    const finalizer = new AgentModeOrganizationFinalizer(store, () => NOW);
    const first = finalizer.finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(first.outcome, 'FINALIZED');
    for (let index = 0; index < 10; index += 1) {
      const repeated = finalizer.finalizeOrganizationPlanOnce({ organizationPlanId: planId, now: '2026-09-13T11:59:00.000Z' });
      assert.equal(repeated.outcome, 'ALREADY_FINALIZED');
      assert.equal(repeated.finalResult?.organizationFinalResultId, first.finalResult?.organizationFinalResultId);
      assert.equal(repeated.finalResult?.aggregateDigest, first.finalResult?.aggregateDigest);
    }
    assert.equal(worker.dispatchInvocationCount, 3);
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      const receipt = reopened.getOrganizationFinalResult(planId);
      assert.equal(receipt?.organizationFinalResultId, first.finalResult?.organizationFinalResultId);
      assert.equal(reopened.getOrganizationPlan(planId)?.status, 'completed');
      const aggregate = deriveOrganizationAggregation(reopened, reopened.getOrganizationPlan(planId)!, NOW);
      assert.equal(aggregate.aggregateStatus, 'succeeded');
      assert.equal(aggregate.totalSettledCost, 0);
      assert.equal(reopened.listOrganizationWorkItems(planId).filter((item) => item.boundChildAgentId).length, 3);
    } finally { reopened.close(); }
  } finally { try { store.close(); } catch {} rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('concurrent finalizers converge on one receipt without a process-local mutex', async () => {
  const { store, databasePath, planId } = setup();
  const second = new AgentModeSqliteStateStore(databasePath);
  try {
    await runHappy(store);
    const [left, right] = await Promise.all([
      Promise.resolve(new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId })),
      Promise.resolve(new AgentModeOrganizationFinalizer(second, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId })),
    ]);
    assert.ok(['FINALIZED', 'ALREADY_FINALIZED'].includes(left.outcome));
    assert.ok(['FINALIZED', 'ALREADY_FINALIZED'].includes(right.outcome));
    assert.equal(store.listOrganizationFinalResults().length, 1);
    assert.equal(second.listOrganizationFinalResults().length, 1);
    assert.equal(left.finalResult?.organizationFinalResultId, right.finalResult?.organizationFinalResultId);
  } finally { second.close(); store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('finalization does not trust caller-supplied success and uncertain K4 state cannot finalize', async () => {
  const { store, databasePath, planId } = setup();
  try {
    const beforeExecution = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(beforeExecution.outcome, 'NOT_READY');
    assert.equal(store.listOrganizationFinalResults().length, 0);
    const worker = runtime({ crashAfterInvocation: true });
    await orchestrator(store, worker).advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    const uncertain = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(uncertain.outcome, 'UNCERTAIN');
    assert.equal(store.listOrganizationFinalResults().length, 0);
    assert.equal(worker.dispatchInvocationCount, 1);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('failed predecessor yields known failed organization result and never an auditor result', async () => {
  const { store, databasePath, planId } = setup();
  try {
    let calls = 0;
    const worker: AgentRuntime = {
      run: async ({ context }) => {
        calls += 1;
        return { status: calls === 1 ? 'failed' : 'succeeded', runtimeReceiptId: `runtime-receipt:k5-c-${calls}`, resultHash: 'c'.repeat(64), evidenceRef: calls === 1 ? 'evidence:k5-c-failure' : 'evidence:k5-c-success', usage: { steps: 0, tokens: 0, cost: 0 }, ...(calls === 1 ? { failureCode: 'FIXTURE_FAILURE' } : {}), traceSummary: [`attempt:${context.attemptId}`] };
      },
    };
    const controller = orchestrator(store, worker);
    await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 1 });
    await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    const finalized = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(finalized.outcome, 'FAILED');
    assert.equal(finalized.finalResult?.status, 'failed');
    assert.equal(store.listChildAssignments().length, 2);
    assert.equal(store.listOrganizationFinalResults().length, 1);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('pure aggregation validator enforces bounded refs, contracts, and exact auditor gate', () => {
  const { store, databasePath, planId } = setup();
  try {
    const plan = store.getOrganizationPlan(planId)!;
    const base = {
      schemaVersion: 1 as const, organizationPlanId: planId, planVersion: 1, rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR,
      workItems: plan.workItems.map((item) => ({ workItemId: item.workItemId, workItemKey: item.workItemKey, organizationRoleId: item.organizationRoleId, childAgentId: `child:${item.workItemKey}`, taskId: `task:${item.workItemKey}`, runId: `run:${item.workItemKey}`, attemptId: `attempt:${item.workItemKey}`, terminalStatus: 'succeeded' as const, resultRef: 'k4:runtime:receipt', evidenceRefs: ['k4:evidence:proof'], settledCost: 0, dependencyKeys: [...item.dependencyKeys] })),
      totalSettledCost: 0, auditorWorkItemId: plan.workItems.find((item) => item.workItemKey === 'independent-auditor')!.workItemId, auditorStatus: 'succeeded' as const, aggregateStatus: 'succeeded' as const,
    } satisfies OrganizationAggregation;
    assert.equal(validateOrganizationAggregation(base, plan).valid, true);
    const missingResult = { ...base, workItems: base.workItems.map((item) => item.workItemKey === 'research' ? { ...item, resultRef: null } : item) };
    assert.deepEqual(validateOrganizationAggregation(missingResult, plan), { valid: false, reasonCode: 'RESULT_CONTRACT_UNSATISFIED' });
    const tooManyEvidence = { ...base, workItems: base.workItems.map((item) => item.workItemKey === 'research' ? { ...item, evidenceRefs: Array.from({ length: 17 }, (_, index) => `k4:evidence:${index}`) } : item) };
    assert.equal(validateOrganizationAggregation(tooManyEvidence, plan).valid, false);
    assert.equal(organizationAggregationDigest(base).length, 64);
    const resultMaterial = { schemaVersion: 1 as const, organizationPlanId: planId, planVersion: 1 as const, rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR, status: 'succeeded' as const, auditorWorkItemId: base.auditorWorkItemId, auditorResultRef: 'k4:runtime:receipt', workItemResults: base.workItems, totalSettledCost: 0, aggregateDigest: organizationAggregationDigest(base) };
    assert.equal(organizationFinalResultId(resultMaterial), organizationFinalResultId({ ...resultMaterial }));
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('auditor gate is exact and root cancellation/expiry cannot become success', async () => {
  const { store, databasePath, planId } = setup();
  try {
    const plan = store.getOrganizationPlan(planId)!;
    assert.equal(organizationAuditorCandidates(plan).length, 1);
    assert.equal(organizationAuditorCandidates({ ...plan, workItems: plan.workItems.filter((item) => item.organizationRoleId !== 'agent-mode.org-role.independent-auditor.v1') }).length, 0);
    const auditor = plan.workItems.find((item) => item.organizationRoleId === 'agent-mode.org-role.independent-auditor.v1')!;
    const ambiguous = { ...plan, workItems: [...plan.workItems, { ...auditor, workItemId: `${auditor.workItemId}:second`, workItemKey: 'independent-auditor-2' }] };
    assert.equal(organizationAuditorCandidates(ambiguous).length, 2);

    const worker = await runHappy(store);
    assert.equal(store.setSpawnRootCancellation(ROOT_GOAL, 'cancelled', NOW), 'created');
    const cancelled = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(cancelled.outcome, 'CANCELLED');
    assert.equal(cancelled.finalResult?.status, 'cancelled');
    assert.equal(worker.dispatchInvocationCount, 3);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }

  const expired = setup();
  try {
    const result = new AgentModeOrganizationFinalizer(expired.store, () => ROOT_DEADLINE).finalizeOrganizationPlanOnce({ organizationPlanId: expired.planId, now: ROOT_DEADLINE });
    assert.equal(result.outcome, 'EXPIRED');
    assert.equal(result.finalResult?.status, 'expired');
    assert.equal(expired.store.getOrganizationPlan(expired.planId)?.status, 'expired');
  } finally { expired.store.close(); rmSync(path.dirname(expired.databasePath), { recursive: true, force: true }); }
});

test('conflicting immutable final receipt material fails closed', async () => {
  const { store, databasePath, planId } = setup();
  try {
    await runHappy(store);
    const first = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId });
    assert.equal(first.outcome, 'FINALIZED');
    assert.ok(first.finalResult);
    const conflicting = store.finalizeOrganizationPlan({ ...first.finalResult!, status: 'failed' });
    assert.equal(conflicting.result, 'conflict');
    assert.equal(store.listOrganizationFinalResults().length, 1);
  } finally { store.close(); rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});
