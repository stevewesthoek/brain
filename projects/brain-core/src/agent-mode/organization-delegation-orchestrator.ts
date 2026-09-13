import { createHash } from 'node:crypto';
import {
  type DelegatedResultFact,
  type OrganizationPlan,
  type OrganizationReadiness,
  ORGANIZATION_ROLE_ENGINEERING,
  ORGANIZATION_ROLE_INDEPENDENT_AUDITOR,
  ORGANIZATION_ROLE_JARVIS_CEO,
  ORGANIZATION_ROLE_MEMORY_ARCHIVIST,
  ORGANIZATION_ROLE_OPERATIONS,
  ORGANIZATION_ROLE_RESEARCH,
  ORGANIZATION_ROLE_REGISTRY,
} from './organization.js';
import {
  evaluateSpawnAdmissionWithDurableControls,
  ORGANIZATION_DELEGATION_SOURCE,
  ORGANIZATION_WORK_ITEM_READY_EVENT,
  SPAWN_POLICY_READ_ONLY,
  SPAWN_ROLE_READ_ONLY,
  type SpawnAuthorityFacts,
  type SpawnRequest,
} from './spawn-policy.js';
import {
  MOCK_AGENT_RUNTIME_PROFILE_REF,
  MOCK_AGENT_RUNTIME_REF,
  type AgentModeChildAssignmentRequest,
} from './child-assignment.js';
import {
  AgentModeRuntimeDispatcher,
  type AgentModeRuntimeDispatchRequest,
  type AgentModeRuntimeReceipt,
  type AgentRuntime,
} from './runtime-dispatch.js';
import type {
  AgentModeAgent,
  AgentModeOrganizationWorkItem,
  AgentModeSqliteStateStore,
} from './sqlite-state-store.js';

export const ORGANIZATION_DELEGATION_RULE_SCHEMA_VERSION = 1 as const;
export const ORGANIZATION_DELEGATION_CONTROLLER_VERSION = 'agent-mode.organization-delegation.v1' as const;
export const DEFAULT_MAX_ORGANIZATION_ADVANCEMENT = 4;

export type OrganizationDelegationRule = {
  schemaVersion: typeof ORGANIZATION_DELEGATION_RULE_SCHEMA_VERSION;
  ruleId: string;
  version: 1;
  enabled: boolean;
  organizationRoleId: string;
  spawnPolicyId: typeof SPAWN_POLICY_READ_ONLY;
  spawnPolicyVersion: 1;
  roleTemplateId: typeof SPAWN_ROLE_READ_ONLY;
  roleTemplateVersion: 1;
  runtimeRef: typeof MOCK_AGENT_RUNTIME_REF;
  runtimeProfileRef: typeof MOCK_AGENT_RUNTIME_PROFILE_REF;
  taskSpecMode: 'fixture-v1';
  capabilityCeiling: readonly ['repo.read'];
  scopeMode: 'repository-read';
  taskSpecRefs: readonly string[];
};

const FIXTURE_TASK_SPECS = Object.freeze([
  'task-spec:k5-a-research',
  'task-spec:k5-a-engineering',
  'task-spec:k5-a-audit',
] as const);

function rule(roleId: string, key: string, enabled: boolean, taskSpecRefs: readonly string[] = []): OrganizationDelegationRule {
  return {
    schemaVersion: 1, ruleId: `agent-mode.org-delegation.${key}.v1`, version: 1, enabled,
    organizationRoleId: roleId, spawnPolicyId: SPAWN_POLICY_READ_ONLY, spawnPolicyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1,
    runtimeRef: MOCK_AGENT_RUNTIME_REF, runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF,
    taskSpecMode: 'fixture-v1', capabilityCeiling: ['repo.read'], scopeMode: 'repository-read', taskSpecRefs,
  };
}

export const ORGANIZATION_DELEGATION_RULES: readonly OrganizationDelegationRule[] = Object.freeze([
  rule(ORGANIZATION_ROLE_JARVIS_CEO, 'jarvis-ceo', false),
  rule(ORGANIZATION_ROLE_ENGINEERING, 'engineering', false, [FIXTURE_TASK_SPECS[1]]),
  rule(ORGANIZATION_ROLE_RESEARCH, 'research', false, [FIXTURE_TASK_SPECS[0]]),
  rule(ORGANIZATION_ROLE_OPERATIONS, 'operations', false),
  rule(ORGANIZATION_ROLE_MEMORY_ARCHIVIST, 'memory-archivist', false),
  rule(ORGANIZATION_ROLE_INDEPENDENT_AUDITOR, 'independent-auditor', false, [FIXTURE_TASK_SPECS[2]]),
]);

// Tests may opt into this exact deterministic fixture. Production callers use
// the disabled registry unless an explicit, separately reviewed configuration
// enables a rule.
export const K5_B_FIXTURE_DELEGATION_RULES: readonly OrganizationDelegationRule[] = Object.freeze(
  ORGANIZATION_DELEGATION_RULES.map((candidate) => ({
    ...candidate,
    enabled: [ORGANIZATION_ROLE_RESEARCH, ORGANIZATION_ROLE_ENGINEERING, ORGANIZATION_ROLE_INDEPENDENT_AUDITOR].includes(candidate.organizationRoleId),
  })),
);

export type OrganizationDelegationReasonCode =
  | 'READY'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_NOT_ACTIVE'
  | 'ROOT_BLOCKED'
  | 'PLAN_EXPIRED'
  | 'DEPENDENCY_BLOCKED'
  | 'DEPENDENCY_FAILED'
  | 'ROLE_NOT_ALLOWED'
  | 'RULE_NOT_FOUND'
  | 'RULE_DISABLED'
  | 'TASK_SPEC_NOT_ALLOWED'
  | 'SUPERVISOR_LIFECYCLE_UNAVAILABLE'
  | 'SPAWN_DENIED'
  | 'BINDING_CONFLICT'
  | 'ASSIGNMENT_DENIED'
  | 'DISPATCH_DENIED'
  | 'RUNTIME_UNCERTAIN'
  | 'ALREADY_TERMINAL';

export type OrganizationDelegationOutcome = 'NO_ACTION' | 'ADVANCED' | 'DEFERRED' | 'BLOCKED' | 'TERMINAL' | 'UNCERTAIN';

export type OrganizationDelegatedItemProjection = {
  workItemId: string;
  workItemKey: string;
  organizationRoleId: string;
  readiness: 'ready' | 'blocked' | 'dependency_failed' | 'completed';
  delegationState: 'unbound' | 'bound' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain';
  delegationIntentKey?: string;
  childAgentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  terminalStatus: 'succeeded' | 'failed' | 'cancelled' | null;
  resultRef: string | null;
  evidenceRefCount: number;
  settledCost: number;
};

export type OrganizationExecutionProjection = {
  organizationPlanId: string;
  rootGoalId: string;
  supervisorAgentId: string;
  readyCount: number;
  runningCount: number;
  succeededCount: number;
  failedCount: number;
  cancelledCount: number;
  dependencyFailedCount: number;
  uncertainCount: number;
  settledCost: number;
  terminal: boolean;
  terminalStatus: 'succeeded' | 'failed' | 'cancelled' | 'uncertain' | null;
  workItems: readonly OrganizationDelegatedItemProjection[];
};

export type OrganizationAdvancementResult = {
  outcome: OrganizationDelegationOutcome;
  organizationPlanId: string;
  advancedCount: number;
  deferredCount: number;
  blockedCount: number;
  reasonCodes: readonly OrganizationDelegationReasonCode[];
  projection: OrganizationExecutionProjection;
};

export type OrganizationDelegationPhase = 'after_spawn' | 'after_binding' | 'after_assignment' | 'before_dispatch';

export type OrganizationDelegationOrchestratorOptions = {
  store: AgentModeSqliteStateStore;
  runtime: AgentRuntime;
  rootFacts: (rootGoalId: string, now: string) => SpawnAuthorityFacts | undefined;
  now?: string;
  clock?: () => string;
  controllerRef?: string;
  supervisorTaskId?: string;
  supervisorRunId?: string;
  rules?: readonly OrganizationDelegationRule[];
  phaseHook?: (phase: OrganizationDelegationPhase, workItemId: string) => void;
};

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function delegationIntentKey(organizationPlanId: string, workItemId: string, ruleId: string, version: number): string {
  return `delegation-intent:sha256:${hash({ organizationPlanId, workItemId, ruleId, version })}`;
}

function boundedId(prefix: string, material: string): string { return `${prefix}:${hash(material).slice(0, 64)}`; }

function canonicalDelegationRules(input: readonly OrganizationDelegationRule[]): readonly OrganizationDelegationRule[] {
  const allowedKeys = ['schemaVersion', 'ruleId', 'version', 'enabled', 'organizationRoleId', 'spawnPolicyId', 'spawnPolicyVersion', 'roleTemplateId', 'roleTemplateVersion', 'runtimeRef', 'runtimeProfileRef', 'taskSpecMode', 'capabilityCeiling', 'scopeMode', 'taskSpecRefs'];
  return input.map((candidate) => {
    if (Object.keys(candidate).sort().join('|') !== allowedKeys.sort().join('|')) throw new Error('organization delegation rule contains unsupported authority fields');
    if (typeof candidate.enabled !== 'boolean') throw new Error('organization delegation rule enabled flag is invalid');
    const registered = ORGANIZATION_DELEGATION_RULES.find((rule) => rule.ruleId === candidate.ruleId && rule.version === candidate.version);
    if (!registered || candidate.schemaVersion !== registered.schemaVersion || candidate.organizationRoleId !== registered.organizationRoleId
      || candidate.spawnPolicyId !== registered.spawnPolicyId || candidate.spawnPolicyVersion !== registered.spawnPolicyVersion
      || candidate.roleTemplateId !== registered.roleTemplateId || candidate.roleTemplateVersion !== registered.roleTemplateVersion
      || candidate.runtimeRef !== registered.runtimeRef || candidate.runtimeProfileRef !== registered.runtimeProfileRef
      || candidate.taskSpecMode !== registered.taskSpecMode || candidate.scopeMode !== registered.scopeMode
      || JSON.stringify(candidate.capabilityCeiling) !== JSON.stringify(registered.capabilityCeiling)
      || JSON.stringify(candidate.taskSpecRefs) !== JSON.stringify(registered.taskSpecRefs)) throw new Error('organization delegation rule is not Brain-owned');
    return { ...registered, enabled: candidate.enabled };
  });
}

function resultReceipt(store: AgentModeSqliteStateStore, attemptId: string): AgentModeRuntimeReceipt | undefined {
  const outbox = store.listDispatchOutbox().find((candidate) => candidate.attemptId === attemptId);
  if (!outbox) return undefined;
  const effect = store.getEffect(outbox.operationId);
  if (!effect?.receiptJson) return undefined;
  try { return JSON.parse(effect.receiptJson) as AgentModeRuntimeReceipt; } catch { return undefined; }
}

function deriveFact(store: AgentModeSqliteStateStore, item: AgentModeOrganizationWorkItem): DelegatedResultFact {
  if (!item.boundChildAgentId || !item.boundTaskId) return { workItemId: item.workItemId, status: 'pending' };
  const assignment = store.getChildAssignment(item.boundChildAgentId);
  if (!assignment || assignment.taskId !== item.boundTaskId) return { workItemId: item.workItemId, status: 'pending' };
  const attempt = store.getAttempt(assignment.attemptId);
  const receipt = attempt ? resultReceipt(store, attempt.attemptId) : undefined;
  if (attempt?.status === 'uncertain' || assignment.status === 'uncertain') return { workItemId: item.workItemId, status: 'pending' };
  if (attempt?.status === 'completed' && receipt?.status === 'succeeded' && receipt.evidenceRef) {
    return { workItemId: item.workItemId, status: 'succeeded', resultRef: `k4:runtime:${receipt.receiptId}`, evidenceRefs: [`k4:evidence:${receipt.evidenceRef}`] };
  }
  if (attempt?.status === 'failed' || assignment.status === 'failed') return { workItemId: item.workItemId, status: 'failed' };
  if (attempt?.status === 'cancelled' || assignment.status === 'cancelled') return { workItemId: item.workItemId, status: 'cancelled' };
  return { workItemId: item.workItemId, status: 'running' };
}

function itemCost(store: AgentModeSqliteStateStore, item: AgentModeOrganizationWorkItem): number {
  if (!item.boundChildAgentId) return 0;
  const assignment = store.getChildAssignment(item.boundChildAgentId);
  if (!assignment) return 0;
  const reservation = store.getReservation(assignment.reservationId);
  return reservation?.status === 'settled' ? reservation.settledDollars ?? reservation.dollars : 0;
}

export function deriveOrganizationResultFacts(store: AgentModeSqliteStateStore, plan: OrganizationPlan): readonly DelegatedResultFact[] {
  return store.listOrganizationWorkItems(plan.organizationPlanId).map((item) => deriveFact(store, item));
}

export function deriveOrganizationExecutionProjection(store: AgentModeSqliteStateStore, plan: OrganizationPlan, now: string, readiness?: OrganizationReadiness): OrganizationExecutionProjection {
  const items = store.listOrganizationWorkItems(plan.organizationPlanId);
  const facts = deriveOrganizationResultFacts(store, plan);
  const resolvedReadiness = readiness ?? store.readOrganizationPlanReadiness(plan.organizationPlanId, now, facts);
  const readinessById = new Map((resolvedReadiness?.workItems ?? []).map((item) => [item.workItemId, item.state]));
  const projections = items.map((item): OrganizationDelegatedItemProjection => {
    const fact = facts.find((candidate) => candidate.workItemId === item.workItemId);
    const assignment = item.boundChildAgentId ? store.getChildAssignment(item.boundChildAgentId) : undefined;
    const attempt = assignment ? store.getAttempt(assignment.attemptId) : undefined;
    const receipt = attempt ? resultReceipt(store, attempt.attemptId) : undefined;
    const terminalStatus = fact?.status === 'succeeded' || fact?.status === 'failed' || fact?.status === 'cancelled' ? fact.status : null;
    const delegationState = terminalStatus ?? (attempt?.status === 'uncertain' ? 'uncertain' : assignment ? assignment.status === 'dispatch_ready' ? 'bound' : 'running' : 'unbound');
    return {
      workItemId: item.workItemId, workItemKey: item.workItemKey, organizationRoleId: item.organizationRoleId,
      readiness: readinessById.get(item.workItemId) ?? 'blocked', delegationState: delegationState as OrganizationDelegatedItemProjection['delegationState'],
      ...(assignment ? { delegationIntentKey: assignment.assignmentIntentKey } : {}), childAgentId: item.boundChildAgentId, taskId: item.boundTaskId,
      runId: assignment?.runId ?? null, attemptId: assignment?.attemptId ?? null, terminalStatus,
      resultRef: fact?.status === 'succeeded' && receipt?.status === 'succeeded' ? `k4:runtime:${receipt.receiptId}` : null, evidenceRefCount: fact?.status === 'succeeded' && receipt?.evidenceRef ? 1 : 0,
      settledCost: itemCost(store, item),
    };
  });
  const counts = {
    readyCount: projections.filter((item) => item.readiness === 'ready').length,
    runningCount: projections.filter((item) => ['bound', 'running'].includes(item.delegationState)).length,
    succeededCount: projections.filter((item) => item.terminalStatus === 'succeeded').length,
    failedCount: projections.filter((item) => item.terminalStatus === 'failed').length,
    cancelledCount: projections.filter((item) => item.terminalStatus === 'cancelled').length,
    dependencyFailedCount: projections.filter((item) => item.readiness === 'dependency_failed').length,
    uncertainCount: projections.filter((item) => item.delegationState === 'uncertain').length,
  };
  const terminal = counts.succeededCount + counts.failedCount + counts.cancelledCount + counts.dependencyFailedCount === items.length;
  return {
    organizationPlanId: plan.organizationPlanId, rootGoalId: plan.rootGoalId, supervisorAgentId: plan.supervisorAgentId,
    ...counts, settledCost: projections.reduce((total, item) => total + item.settledCost, 0), terminal,
    terminalStatus: terminal ? counts.failedCount + counts.dependencyFailedCount > 0 ? 'failed' : counts.cancelledCount > 0 ? 'cancelled' : 'succeeded' : counts.uncertainCount > 0 ? 'uncertain' : null,
    workItems: projections,
  };
}

export class AgentModeOrganizationDelegationOrchestrator {
  private readonly clock: () => string;
  private readonly rules: readonly OrganizationDelegationRule[];
  private readonly controllerRef: string;

  constructor(private readonly options: OrganizationDelegationOrchestratorOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.rules = canonicalDelegationRules(options.rules ?? ORGANIZATION_DELEGATION_RULES);
    this.controllerRef = options.controllerRef ?? 'controller:organization-delegation';
  }

  private now(): string { return this.options.now ?? this.clock(); }

  private rootFacts(plan: OrganizationPlan, now: string): SpawnAuthorityFacts | undefined {
    return this.options.rootFacts(plan.rootGoalId, now);
  }

  private supervisorLifecycle(plan: OrganizationPlan): { supervisor: AgentModeAgent; taskId: string; runId: string } | undefined {
    const supervisor = this.options.store.getAgent(plan.supervisorAgentId);
    const taskId = this.options.supervisorTaskId ?? plan.rootGoalId;
    const runId = this.options.supervisorRunId ?? this.options.store.listRuns().find((run) => run.agentId === plan.supervisorAgentId && run.taskId === taskId)?.runId;
    return supervisor && taskId && runId ? { supervisor, taskId, runId } : undefined;
  }

  private spawnRequest(plan: OrganizationPlan, item: AgentModeOrganizationWorkItem, rule: OrganizationDelegationRule, now: string, lifecycle: { supervisor: AgentModeAgent; taskId: string; runId: string }): SpawnRequest {
    const effectiveTtl = Math.min(item.requestedTtl, 15 * 60 * 1000);
    const deadline = new Date(Math.min(Date.parse(plan.deadline), Date.parse(now) + effectiveTtl)).toISOString();
    const sourceEventId = boundedId('organization-ready', `${plan.organizationPlanId}:${item.workItemId}`);
    const request: SpawnRequest = {
      schemaVersion: 1, requestId: boundedId('request:organization', `${plan.organizationPlanId}:${item.workItemId}:${rule.ruleId}:${rule.version}`),
      policyId: rule.spawnPolicyId, policyVersion: rule.spawnPolicyVersion, roleTemplateId: rule.roleTemplateId, roleTemplateVersion: rule.roleTemplateVersion,
      sourceId: ORGANIZATION_DELEGATION_SOURCE, sourceEventId, sourceType: ORGANIZATION_DELEGATION_SOURCE, eventType: ORGANIZATION_WORK_ITEM_READY_EVENT,
      eventRootGoalId: plan.rootGoalId, eventScope: { repositoryRef: 'brain', resourceRef: null }, parentAgentId: lifecycle.supervisor.agentId,
      parentTaskId: lifecycle.taskId, parentRunId: lifecycle.runId, rootGoalId: plan.rootGoalId, requestedScope: { repositoryRef: 'brain', resourceRef: null },
      requestedCapabilities: [...rule.capabilityCeiling], requestedTtl: effectiveTtl, requestedStepBudget: item.requestedSteps,
      requestedCostBudget: item.requestedCost, requestedAt: now, deadline, requestedDepth: (lifecycle.supervisor.depth ?? 0) + 1,
    };
    return request;
  }

  private assignmentRequest(plan: OrganizationPlan, item: AgentModeOrganizationWorkItem, rule: OrganizationDelegationRule, request: SpawnRequest, childAgentId: string, now: string): AgentModeChildAssignmentRequest {
    return {
      schemaVersion: 1, assignmentId: boundedId('assignment:organization', `${plan.organizationPlanId}:${item.workItemId}:${rule.ruleId}:${rule.version}`), childAgentId,
      rootGoalId: plan.rootGoalId, taskSpecRef: item.taskSpecRef, sourceEventId: request.sourceEventId, runtimeRef: rule.runtimeRef,
      runtimeProfileRef: rule.runtimeProfileRef, requestedSteps: item.requestedSteps, requestedCostCeiling: item.requestedCost, requestedTokenCeiling: item.requestedTokens,
      requestedCapabilities: [...rule.capabilityCeiling], repositoryScope: 'brain', resourceScope: null, deadline: request.deadline, requestedAt: now,
    };
  }

  private dispatchRequest(assignment: { assignmentIntentKey: string; childAgentId: string; taskId: string; runId: string; attemptId: string }, rule: OrganizationDelegationRule, now: string): AgentModeRuntimeDispatchRequest {
    return {
      schemaVersion: 1, dispatchId: boundedId('dispatch:organization', assignment.assignmentIntentKey), operationId: boundedId('operation:organization', assignment.assignmentIntentKey),
      assignmentIntentKey: assignment.assignmentIntentKey, childAgentId: assignment.childAgentId, taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId,
      runtimeRef: rule.runtimeRef, runtimeProfileRef: rule.runtimeProfileRef, controllerRef: this.controllerRef, requestedAt: now,
    };
  }

  private async advanceItem(plan: OrganizationPlan, item: AgentModeOrganizationWorkItem, readiness: OrganizationReadiness, now: string): Promise<{ outcome: OrganizationDelegationOutcome; reason: OrganizationDelegationReasonCode }> {
    const state = readiness.workItems.find((candidate) => candidate.workItemId === item.workItemId)?.state;
    if (state === 'completed') return { outcome: 'NO_ACTION', reason: 'ALREADY_TERMINAL' };
    if (state === 'dependency_failed') return { outcome: 'BLOCKED', reason: 'DEPENDENCY_FAILED' };
    if (state !== 'ready') return { outcome: 'NO_ACTION', reason: 'DEPENDENCY_BLOCKED' };
    if (item.boundChildAgentId) {
      const assignment = this.options.store.getChildAssignment(item.boundChildAgentId);
      if (!assignment) return { outcome: 'BLOCKED', reason: 'BINDING_CONFLICT' };
      if (assignment.status === 'uncertain') return { outcome: 'UNCERTAIN', reason: 'RUNTIME_UNCERTAIN' };
      const fact = deriveFact(this.options.store, item);
      if (fact.status === 'succeeded' || fact.status === 'failed' || fact.status === 'cancelled') return { outcome: 'NO_ACTION', reason: 'ALREADY_TERMINAL' };
      return { outcome: 'DEFERRED', reason: 'SPAWN_DENIED' };
    }
    const role = ORGANIZATION_ROLE_REGISTRY.find((candidate) => candidate.organizationRoleId === item.organizationRoleId);
    if (!role || role.kind === 'supervisor') return { outcome: 'BLOCKED', reason: 'ROLE_NOT_ALLOWED' };
    const rule = this.rules.find((candidate) => candidate.organizationRoleId === item.organizationRoleId);
    if (!rule) return { outcome: 'BLOCKED', reason: 'RULE_NOT_FOUND' };
    if (!rule.enabled) return { outcome: 'BLOCKED', reason: 'RULE_DISABLED' };
    if (!rule.taskSpecRefs.includes(item.taskSpecRef)) return { outcome: 'BLOCKED', reason: 'TASK_SPEC_NOT_ALLOWED' };
    const lifecycle = this.supervisorLifecycle(plan);
    const facts = this.rootFacts(plan, now);
    if (!lifecycle || !facts) return { outcome: 'BLOCKED', reason: 'SUPERVISOR_LIFECYCLE_UNAVAILABLE' };
    const request = this.spawnRequest(plan, item, rule, now, lifecycle);
    const admission = evaluateSpawnAdmissionWithDurableControls(this.options.store, request, facts);
    if (admission.result !== 'ALLOW') return { outcome: 'DEFERRED', reason: 'SPAWN_DENIED' };
    const creation = this.options.store.reserveSpawnAndCreateChild({ request, admission, facts });
    if (creation.result !== 'created' && creation.result !== 'duplicate') return { outcome: 'DEFERRED', reason: 'SPAWN_DENIED' };
    const childAgentId = creation.receipt.childAgentId;
    this.options.phaseHook?.('after_spawn', item.workItemId);
    const assignmentRequest = this.assignmentRequest(plan, item, rule, request, childAgentId, now);
    const assignment = this.options.store.assignChildAgent(assignmentRequest);
    if (assignment.result !== 'assigned' && assignment.result !== 'duplicate') return { outcome: 'DEFERRED', reason: 'ASSIGNMENT_DENIED' };
    this.options.phaseHook?.('after_assignment', item.workItemId);
    const binding = this.options.store.bindOrganizationWorkItem({ organizationPlanId: plan.organizationPlanId, workItemId: item.workItemId, childAgentId, taskId: assignment.receipt.taskId, occurredAt: now });
    if (binding.result !== 'bound' && binding.result !== 'duplicate') return { outcome: 'BLOCKED', reason: 'BINDING_CONFLICT' };
    this.options.phaseHook?.('after_binding', item.workItemId);
    const dispatch = assignment.dispatch ?? (assignment.result === 'duplicate' ? this.options.store.getPreparedChildDispatch(assignment.receipt.assignmentIntentKey, now) : null);
    if (!dispatch) return { outcome: 'DEFERRED', reason: 'DISPATCH_DENIED' };
    this.options.phaseHook?.('before_dispatch', item.workItemId);
    const dispatchResult = await new AgentModeRuntimeDispatcher(this.options.store, this.options.runtime).dispatch(this.dispatchRequest(dispatch, rule, now));
    if (dispatchResult.result === 'uncertain') return { outcome: 'UNCERTAIN', reason: 'RUNTIME_UNCERTAIN' };
    if (dispatchResult.result === 'denied') return { outcome: 'DEFERRED', reason: 'DISPATCH_DENIED' };
    return { outcome: 'ADVANCED', reason: 'READY' };
  }

  async advanceOrganizationPlanOnce(input: { organizationPlanId: string; maxWorkItems?: number }): Promise<OrganizationAdvancementResult> {
    const now = this.now();
    const plan = this.options.store.getOrganizationPlan(input.organizationPlanId);
    if (!plan) return { outcome: 'BLOCKED', organizationPlanId: input.organizationPlanId, advancedCount: 0, deferredCount: 0, blockedCount: 1, reasonCodes: ['PLAN_NOT_FOUND'], projection: { organizationPlanId: input.organizationPlanId, rootGoalId: '', supervisorAgentId: '', readyCount: 0, runningCount: 0, succeededCount: 0, failedCount: 0, cancelledCount: 0, dependencyFailedCount: 0, uncertainCount: 0, settledCost: 0, terminal: false, terminalStatus: null, workItems: [] } };
    if (plan.status !== 'active') {
      const projection = deriveOrganizationExecutionProjection(this.options.store, plan, now);
      return { outcome: plan.status === 'completed' ? 'TERMINAL' : 'BLOCKED', organizationPlanId: plan.organizationPlanId, advancedCount: 0, deferredCount: 0, blockedCount: 1, reasonCodes: ['PLAN_NOT_ACTIVE'], projection };
    }
    const requestedMax = input.maxWorkItems ?? DEFAULT_MAX_ORGANIZATION_ADVANCEMENT;
    const max = Number.isSafeInteger(requestedMax) && requestedMax > 0
      ? Math.min(requestedMax, DEFAULT_MAX_ORGANIZATION_ADVANCEMENT)
      : DEFAULT_MAX_ORGANIZATION_ADVANCEMENT;
    const facts = deriveOrganizationResultFacts(this.options.store, plan);
    const readiness = this.options.store.readOrganizationPlanReadiness(plan.organizationPlanId, now, facts);
    if (!readiness) return { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, advancedCount: 0, deferredCount: 0, blockedCount: 1, reasonCodes: ['PLAN_NOT_FOUND'], projection: deriveOrganizationExecutionProjection(this.options.store, plan, now) };
    const rootBlocked = readiness.planState === 'cancelled' || readiness.planState === 'expired';
    let advancedCount = 0; let deferredCount = 0; let blockedCount = 0; const reasons: OrganizationDelegationReasonCode[] = [];
    for (const item of this.options.store.listOrganizationWorkItems(plan.organizationPlanId).sort((a, b) => a.workItemKey.localeCompare(b.workItemKey)).slice(0, max)) {
      const result = rootBlocked ? { outcome: 'BLOCKED' as const, reason: readiness.planState === 'expired' ? 'PLAN_EXPIRED' as const : 'ROOT_BLOCKED' as const } : await this.advanceItem(plan, item, readiness, now);
      if (result.outcome === 'ADVANCED') advancedCount += 1;
      if (result.outcome === 'DEFERRED') deferredCount += 1;
      if (result.outcome === 'BLOCKED') blockedCount += 1;
      if (!reasons.includes(result.reason)) reasons.push(result.reason);
    }
    const projection = deriveOrganizationExecutionProjection(this.options.store, plan, now);
    const outcome: OrganizationDelegationOutcome = projection.terminal ? 'TERMINAL' : projection.uncertainCount > 0 ? 'UNCERTAIN' : advancedCount > 0 ? 'ADVANCED' : deferredCount > 0 ? 'DEFERRED' : blockedCount > 0 ? 'BLOCKED' : 'NO_ACTION';
    return { outcome, organizationPlanId: plan.organizationPlanId, advancedCount, deferredCount, blockedCount, reasonCodes: reasons, projection };
  }
}
