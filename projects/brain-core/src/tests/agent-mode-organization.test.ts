import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import {
  createK5AFixturePlan, deriveOrganizationPlanId, deriveOrganizationWorkItemId, evaluateOrganizationReadiness, getOrganizationRole,
  ORGANIZATION_ROLE_ENGINEERING, ORGANIZATION_ROLE_INDEPENDENT_AUDITOR, ORGANIZATION_ROLE_JARVIS_CEO, ORGANIZATION_ROLE_REGISTRY,
  ORGANIZATION_ROLE_RESEARCH, validateOrganizationPlan, validateOrganizationRoleRegistry, type OrganizationPlan,
} from '../agent-mode/organization.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const T0 = '2026-09-13T00:00:00.000Z';
const T1 = '2026-09-13T00:30:00.000Z';
const DEADLINE = '2026-09-13T02:00:00.000Z';

function fixture(rootGoalId = 'goal:k5-a', supervisorAgentId = 'agent:jarvis'): OrganizationPlan {
  return createK5AFixturePlan({ rootGoalId, supervisorAgentId, createdAt: T0, deadline: DEADLINE });
}

function setupStore(databasePath: string, rootGoalId = 'goal:k5-a', supervisorAgentId = 'agent:jarvis'): AgentModeSqliteStateStore {
  const store = new AgentModeSqliteStateStore(databasePath);
  store.createTask({ taskId: rootGoalId, taskType: 'root.goal', inputHash: 'root-input', createdAt: T0, status: 'pending' });
  store.upsertAgent({ agentId: supervisorAgentId, agentKind: 'jarvis', role: 'persistent-executive', displayName: 'Jarvis', policyId: 'policy:k5-a', status: 'active', rootGoalId });
  return store;
}

function withStore(callback: (store: AgentModeSqliteStateStore, databasePath: string, root: string) => void): void {
  const root = mkdtempSync(path.join('/tmp', 'brain-agent-mode-k5-a-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const store = setupStore(databasePath);
  try { callback(store, databasePath, root); } finally { try { store.close(); } catch { /* already closed */ } rmSync(root, { recursive: true, force: true }); }
}

test('closed versioned organization role registry contains all six logical roles and no execution authority', () => {
  validateOrganizationRoleRegistry();
  assert.equal(ORGANIZATION_ROLE_REGISTRY.length, 6);
  assert.deepEqual(ORGANIZATION_ROLE_REGISTRY.map((role) => role.organizationRoleId), [
    'agent-mode.org-role.jarvis-ceo.v1', 'agent-mode.org-role.engineering.v1', 'agent-mode.org-role.research.v1',
    'agent-mode.org-role.operations.v1', 'agent-mode.org-role.memory-archivist.v1', 'agent-mode.org-role.independent-auditor.v1',
  ]);
  assert.equal(getOrganizationRole(ORGANIZATION_ROLE_ENGINEERING)?.kind, 'worker');
  for (const role of ORGANIZATION_ROLE_REGISTRY) assert.deepEqual(Object.keys(role).sort(), ['displayName', 'kind', 'organizationRoleId', 'schemaVersion', 'version']);
  assert.equal('modelRef' in ORGANIZATION_ROLE_REGISTRY[0]!, false);
  assert.equal('runtimeRef' in ORGANIZATION_ROLE_REGISTRY[0]!, false);
  assert.equal('capabilities' in ORGANIZATION_ROLE_REGISTRY[0]!, false);
});

test('plan and work item identities are deterministic and versioned', () => {
  const plan = fixture();
  assert.equal(plan.organizationPlanId, deriveOrganizationPlanId(plan));
  assert.equal(plan.workItems[0]!.workItemId, deriveOrganizationWorkItemId(plan.organizationPlanId, plan.workItems[0]!.workItemKey));
  assert.equal(plan.organizationPlanId, fixture().organizationPlanId);
  assert.equal(plan.workItems[0]!.workItemId, fixture().workItems[0]!.workItemId);
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.planVersion, 1);
});

test('DAG validation rejects duplicate keys, unknown roles/dependencies, self edges, cycles, duplicate edges, and bounds', () => {
  const plan = fixture();
  assert.throws(() => validateOrganizationPlan({ ...plan, workItems: [...plan.workItems, plan.workItems[0]!] }, T1), /duplicate work item key/);
  assert.throws(() => validateOrganizationPlan({ ...plan, workItems: plan.workItems.map((item, index) => index === 0 ? { ...item, organizationRoleId: 'agent-mode.org-role.attacker.v1' } : item) }, T1), /invalid delegated work item/);
  assert.throws(() => validateOrganizationPlan({ ...plan, dependencies: [...plan.dependencies, { workItemKey: 'independent-auditor', dependsOnWorkItemKey: 'missing', type: 'requires_success' }] }, T1), /unknown work item/);
  assert.throws(() => validateOrganizationPlan({ ...plan, dependencies: [...plan.dependencies, { workItemKey: 'research', dependsOnWorkItemKey: 'research', type: 'requires_success' }], workItems: plan.workItems.map((item) => item.workItemKey === 'research' ? { ...item, dependencyKeys: ['research'] } : item) }, T1), /depend on itself/);
  const cycle = { ...plan, dependencies: [{ workItemKey: 'research', dependsOnWorkItemKey: 'engineering', type: 'requires_success' as const }, { workItemKey: 'engineering', dependsOnWorkItemKey: 'research', type: 'requires_success' as const }, { workItemKey: 'independent-auditor', dependsOnWorkItemKey: 'research', type: 'requires_success' as const }, { workItemKey: 'independent-auditor', dependsOnWorkItemKey: 'engineering', type: 'requires_success' as const }], workItems: plan.workItems.map((item) => item.workItemKey === 'research' ? { ...item, dependencyKeys: ['engineering'] } : item.workItemKey === 'engineering' ? { ...item, dependencyKeys: ['research'] } : item) };
  assert.throws(() => validateOrganizationPlan(cycle, T1), /cycle/);
  const duplicateEdge = { ...plan, dependencies: [...plan.dependencies, plan.dependencies[0]!] };
  assert.throws(() => validateOrganizationPlan(duplicateEdge, T1), /duplicate organization dependency edge/);
  const tooMany = Array.from({ length: 17 }, (_, index) => ({ ...plan.workItems[0]!, workItemKey: `item-${index}`, workItemId: deriveOrganizationWorkItemId(plan.organizationPlanId, `item-${index}`), organizationRoleId: ORGANIZATION_ROLE_RESEARCH, dependencyKeys: [] }));
  assert.throws(() => validateOrganizationPlan({ ...plan, workItems: tooMany, dependencies: [] }, T1), /invalid organization plan envelope/);
  assert.throws(() => validateOrganizationPlan({ ...plan, workItems: plan.workItems.map((item) => item.workItemKey === 'research' ? { ...item, taskSpecRef: 'x'.repeat(257) } : item) }, T1), /invalid delegated work item/);
  assert.throws(() => validateOrganizationPlan({ ...plan, workItems: plan.workItems.map((item) => item.workItemKey === 'research' ? { ...item, requestedCost: Number.POSITIVE_INFINITY } : item) }, T1), /invalid delegated work item/);
});

test('root and supervisor binding are authoritative and malicious authority fields are rejected', () => {
  withStore((store) => {
    assert.throws(() => store.createOrganizationPlan(fixture('goal:missing'), T1), /root goal is not authoritative/);
    const wrongSupervisor = fixture('goal:k5-a', 'agent:not-bound');
    assert.throws(() => store.createOrganizationPlan(wrongSupervisor, T1), /supervisor is not bound/);
    const malicious = { ...fixture(), modelRef: 'provider:attacker', runtimeRef: 'runtime:attacker', providerId: 'provider:attacker', capabilityGrant: 'grant:attacker', shellCommand: 'rm -rf /', awsCredential: 'secret', repositoryPath: '/private' } as OrganizationPlan & Record<string, unknown>;
    assert.throws(() => store.createOrganizationPlan(malicious, T1), /unsupported fields/);
  });
});

test('plan creation is atomic, idempotent, and has zero K4 execution side effects', () => {
  withStore((store) => {
    const plan = fixture();
    const created = store.createOrganizationPlan(plan, T1);
    assert.equal(created.result, 'created');
    const duplicate = store.createOrganizationPlan(plan, T1);
    assert.equal(duplicate.result, 'duplicate');
    assert.equal(store.listOrganizationPlans().length, 1);
    assert.equal(store.listOrganizationWorkItems(plan.organizationPlanId).length, 3);
    assert.equal(store.getSpawnRootState(plan.rootGoalId), undefined);
    assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 0);
    assert.equal(store.listTasks().filter((task) => task.taskType === 'agent-mode.child-assignment').length, 0);
    assert.equal(store.listRuns().length, 0);
    assert.equal(store.listAttempts().length, 0);
    const conflicting = { ...plan, workItems: plan.workItems.map((item) => item.workItemKey === 'research' ? { ...item, taskSpecRef: 'task-spec:conflict' } : item) };
    assert.equal(store.createOrganizationPlan(conflicting, T1).result, 'conflict');
    assert.equal(store.listOrganizationPlans().length, 1);
    assert.equal(store.getOrganizationPlan(plan.organizationPlanId)?.workItems[0]?.taskSpecRef, 'task-spec:k5-a-engineering');
  });
});

test('readiness is deterministic, dependency-gated, and blocked by cancelled/killed roots and expiry', () => {
  const plan = fixture();
  const initial = evaluateOrganizationReadiness(plan, { now: T1, root: { exists: true, cancelled: false, killed: false } });
  assert.deepEqual(Object.fromEntries(initial.workItems.map((item) => [item.workItemKey, item.state])), { engineering: 'ready', research: 'ready', 'independent-auditor': 'blocked' });
  const ready = evaluateOrganizationReadiness(plan, { now: T1, root: { exists: true, cancelled: false, killed: false }, resultFacts: [
    { workItemId: plan.workItems.find((item) => item.workItemKey === 'research')!.workItemId, status: 'succeeded', resultRef: 'result:research', evidenceRefs: ['evidence:research'] },
    { workItemId: plan.workItems.find((item) => item.workItemKey === 'engineering')!.workItemId, status: 'succeeded', resultRef: 'result:engineering', evidenceRefs: ['evidence:engineering'] },
  ] });
  assert.equal(ready.workItems.find((item) => item.workItemKey === 'independent-auditor')?.state, 'ready');
  const incompleteEvidence = evaluateOrganizationReadiness(plan, { now: T1, root: { exists: true, cancelled: false, killed: false }, resultFacts: [{ workItemId: plan.workItems.find((item) => item.workItemKey === 'research')!.workItemId, status: 'succeeded', resultRef: 'result:research', evidenceRefs: [] }] });
  assert.equal(incompleteEvidence.workItems.find((item) => item.workItemKey === 'independent-auditor')?.state, 'blocked');
  const failed = evaluateOrganizationReadiness(plan, { now: T1, root: { exists: true, cancelled: false, killed: false }, resultFacts: [{ workItemId: plan.workItems.find((item) => item.workItemKey === 'research')!.workItemId, status: 'failed' }] });
  assert.equal(failed.workItems.find((item) => item.workItemKey === 'independent-auditor')?.state, 'dependency_failed');
  assert.equal(evaluateOrganizationReadiness(plan, { now: T1, root: { exists: true, cancelled: true, killed: false } }).planState, 'cancelled');
  assert.equal(evaluateOrganizationReadiness(plan, { now: T1, root: { exists: true, cancelled: false, killed: true } }).planState, 'cancelled');
  assert.equal(evaluateOrganizationReadiness(plan, { now: '2026-09-13T02:00:00.000Z', root: { exists: true, cancelled: false, killed: false } }).planState, 'expired');
});

test('restart reconstructs organization ownership, roles, DAG, IDs, and readiness', () => {
  withStore((store, databasePath) => {
    const plan = fixture();
    store.createOrganizationPlan(plan, T1);
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      assert.deepEqual(reopened.getOrganizationPlan(plan.organizationPlanId), plan);
      assert.deepEqual(Object.fromEntries(reopened.readOrganizationPlanReadiness(plan.organizationPlanId, T1)!.workItems.map((item) => [item.workItemKey, item.state])), { engineering: 'ready', research: 'ready', 'independent-auditor': 'blocked' });
      assert.equal(reopened.getAgent(plan.supervisorAgentId)?.rootGoalId, plan.rootGoalId);
    } finally { reopened.close(); }
  });
});

test('StateStore readiness reuses root cancellation and kill authority without creating execution state', () => {
  withStore((store) => {
    const plan = fixture();
    store.createOrganizationPlan(plan, T1);
    store.setSpawnAdmissionControl({ scope: 'root', rootGoalId: plan.rootGoalId, denied: true, reason: 'k5-a test kill', updatedAt: T1 });
    assert.equal(store.readOrganizationPlanReadiness(plan.organizationPlanId, T1)?.planState, 'cancelled');
    assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 0);
    assert.equal(store.listRuns().length, 0);
  });
  withStore((store) => {
    const cancelledRoot = fixture('goal:cancelled', 'agent:cancelled-jarvis');
    store.createTask({ taskId: cancelledRoot.rootGoalId, taskType: 'root.goal', inputHash: 'cancelled-root', createdAt: T0, status: 'cancelled' });
    store.upsertAgent({ agentId: cancelledRoot.supervisorAgentId, agentKind: 'jarvis', role: 'persistent-executive', displayName: 'Jarvis', policyId: 'policy:k5-a', status: 'active', rootGoalId: cancelledRoot.rootGoalId });
    store.createOrganizationPlan(cancelledRoot, T1);
    assert.equal(store.readOrganizationPlanReadiness(cancelledRoot.organizationPlanId, T1)?.planState, 'cancelled');
  });
});

test('concurrent duplicate creation converges on one graph and conflicting material fails closed', async () => {
  const root = mkdtempSync(path.join('/tmp', 'brain-agent-mode-k5-a-concurrent-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const first = setupStore(databasePath);
  first.close();
  const a = new AgentModeSqliteStateStore(databasePath);
  const b = new AgentModeSqliteStateStore(databasePath);
  try {
    const plan = fixture();
    const results = await Promise.all([Promise.resolve().then(() => a.createOrganizationPlan(plan, T1)), Promise.resolve().then(() => b.createOrganizationPlan(plan, T1))]);
    assert.deepEqual(results.map((result) => result.result).sort(), ['created', 'duplicate']);
    assert.equal(a.listOrganizationPlans().length, 1);
    const conflicting = { ...plan, workItems: plan.workItems.map((item) => item.workItemKey === 'engineering' ? { ...item, taskSpecRef: 'task-spec:other' } : item) };
    assert.equal(b.createOrganizationPlan(conflicting, T1).result, 'conflict');
    assert.equal(b.listOrganizationWorkItems(plan.organizationPlanId).length, 3);
  } finally { a.close(); b.close(); rmSync(root, { recursive: true, force: true }); }
});

test('observer exposes bounded ownership and dependency projection without execution authority', () => {
  withStore((store, databasePath) => {
    const plan = fixture();
    store.createOrganizationPlan(plan, T1);
    store.close();
    const projection = readAgentModeObserver(T1, databasePath);
    const organization = projection.organizationPlans.find((item) => item.organizationPlanId === plan.organizationPlanId)!;
    assert.deepEqual({ rootGoalId: organization.rootGoalId, supervisorAgentId: organization.supervisorAgentId, supervisorOrganizationRoleId: organization.supervisorOrganizationRoleId, workItemCount: organization.workItemCount, dependencyCount: organization.dependencyCount }, { rootGoalId: plan.rootGoalId, supervisorAgentId: plan.supervisorAgentId, supervisorOrganizationRoleId: ORGANIZATION_ROLE_JARVIS_CEO, workItemCount: 3, dependencyCount: 2 });
    assert.equal(projection.organizationWorkItems.length, 3);
    assert.equal(projection.organizationWorkItems.find((item) => item.workItemKey === 'independent-auditor')?.readinessState, 'blocked');
    assert.equal(projection.organizationWorkItems.every((item) => !('taskSpecRef' in item) && !('modelRef' in item) && !('runtimeRef' in item)), true);
    assert.equal(projection.summary.organizationPlanCount, 1);
    assert.equal(projection.summary.organizationWorkItemCount, 3);
  });
});
