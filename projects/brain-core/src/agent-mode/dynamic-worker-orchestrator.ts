import { createHash } from 'node:crypto';
import {
  CI_WORKFLOW_COMPLETED_EVENT,
  CI_WORKFLOW_STARTED_EVENT,
  CI_WORKFLOW_RUN_SOURCE,
  GIT_REPOSITORY_REVISION_SOURCE,
  REPOSITORY_COMMIT_OBSERVED_EVENT,
  BRAIN_TASK_LIFECYCLE_SOURCE,
  TASK_LIFECYCLE_OBSERVED_EVENT,
  INFRASTRUCTURE_HOST_HEALTH_SOURCE,
  INFRASTRUCTURE_HOST_HEALTH_CHANGED_EVENT,
} from './event-source.js';
import {
  AGENT_MODE_ROLE_TEMPLATES,
  AGENT_MODE_SPAWN_POLICIES,
  getRoleTemplate,
  getSpawnPolicy,
  evaluateSpawnAdmission,
  spawnCreationMaterialHash,
  spawnIntentKey,
  SPAWN_POLICY_READ_ONLY,
  SPAWN_ROLE_READ_ONLY,
  type AgentRoleTemplate,
  type AgentSpawnPolicy,
  type SpawnAuthorityFacts,
  type SpawnRequest,
} from './spawn-policy.js';
import {
  AGENT_MODE_RUNTIME_PROFILES,
  MOCK_AGENT_RUNTIME_PROFILE_REF,
  MOCK_AGENT_RUNTIME_REF,
  RESTRICTED_HARNESS_PROFILE_REF,
  RESTRICTED_HARNESS_RUNTIME_REF,
  assignmentIntentKey,
  type AgentModeChildAssignmentRequest,
} from './child-assignment.js';
import {
  AgentModeRuntimeDispatcher,
  type AgentModeRuntimeDispatchRequest,
  type AgentModeRuntimeDispatchResult,
  type AgentRuntime,
} from './runtime-dispatch.js';
import type {
  AgentModeSchedulerClaim,
  AgentModeSchedulerEvent,
  AgentModeSqliteStateStore,
  AgentModeSpawnCreationInput,
} from './sqlite-state-store.js';

export const E1_FIXTURE_ACTION_RULE_ID = 'agent-mode.action.e1-read-only-fixture.v1' as const;
export const E1_FIXTURE_TASK_SPEC_REF = 'task-spec:agent-mode-read-only-fixture' as const;
export const E1_FIXTURE_SOURCE_ID = 'source:e1-fixture' as const;
export const E1_FIXTURE_CONTROLLER_REF = 'controller:agent-mode-e1' as const;
export const E2_FIXTURE_ACTION_RULE_ID = 'agent-mode.action.e2-restricted-harness-fixture.v1' as const;
export const E2_FIXTURE_TASK_SPEC_REF = 'task-spec:agent-mode-restricted-harness-fixture' as const;
export const E2_FIXTURE_SOURCE_ID = 'source:e2-fixture' as const;
export const E2_FIXTURE_CONTROLLER_REF = 'controller:agent-mode-e2' as const;
export const K43A_LIVE_MINIMAX_ACTION_RULE_ID = 'agent-mode.action.k4-3-a-live-minimax.v1' as const;
export const K43A_LIVE_MINIMAX_TASK_SPEC_REF = 'task-spec:agent-mode-live-minimax-acceptance' as const;
export const K43A_LIVE_MINIMAX_SOURCE_ID = 'source:k4-3-a-live-minimax' as const;
export const K43A_LIVE_MINIMAX_CONTROLLER_REF = 'controller:agent-mode-k4-3-a' as const;

const MAX_RULES = 32;
const MAX_EVENTS_PER_PASS = 16;
const MAX_RULE_ID_LENGTH = 128;
const MAX_TASK_SPEC_LENGTH = 128;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const KNOWN_SOURCES: ReadonlySet<string> = new Set([
  GIT_REPOSITORY_REVISION_SOURCE,
  BRAIN_TASK_LIFECYCLE_SOURCE,
  INFRASTRUCTURE_HOST_HEALTH_SOURCE,
  CI_WORKFLOW_RUN_SOURCE,
]);
const KNOWN_EVENTS: ReadonlySet<string> = new Set([
  REPOSITORY_COMMIT_OBSERVED_EVENT,
  TASK_LIFECYCLE_OBSERVED_EVENT,
  INFRASTRUCTURE_HOST_HEALTH_CHANGED_EVENT,
  CI_WORKFLOW_STARTED_EVENT,
  CI_WORKFLOW_COMPLETED_EVENT,
]);

export type SchedulerEventActionRule = {
  ruleId: string;
  version: number;
  enabled: boolean;
  sourceType: string;
  eventType: string;
  spawnPolicyId: string;
  spawnPolicyVersion: number;
  roleTemplateId: string;
  roleTemplateVersion: number;
  runtimeRef: string;
  runtimeProfileRef: string;
  taskSpecRef: string;
  requestedTtl: number;
  requestedSteps: number;
  requestedCost: number;
  requestedTokens?: number;
  requestedCapabilities: readonly string[];
  scopeMode: 'event.repository' | 'none';
};

/** The production registry is intentionally closed and inactive. Tests or an explicit controller inject the enabled fixture rule. */
export const E1_FIXTURE_ACTION_RULE: SchedulerEventActionRule = Object.freeze({
  ruleId: E1_FIXTURE_ACTION_RULE_ID,
  version: 1,
  enabled: false,
  sourceType: GIT_REPOSITORY_REVISION_SOURCE,
  eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
  spawnPolicyId: SPAWN_POLICY_READ_ONLY,
  spawnPolicyVersion: 1,
  roleTemplateId: SPAWN_ROLE_READ_ONLY,
  roleTemplateVersion: 1,
  runtimeRef: MOCK_AGENT_RUNTIME_REF,
  runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF,
  taskSpecRef: E1_FIXTURE_TASK_SPEC_REF,
  requestedTtl: 60_000,
  requestedSteps: 5,
  requestedCost: 0.05,
  requestedCapabilities: ['repo.read'],
  scopeMode: 'event.repository',
});

/** E2 is a deliberately disabled process-backed fixture; it is injected only by its acceptance tests. */
export const E2_FIXTURE_ACTION_RULE: SchedulerEventActionRule = Object.freeze({
  ruleId: E2_FIXTURE_ACTION_RULE_ID,
  version: 1,
  enabled: false,
  sourceType: GIT_REPOSITORY_REVISION_SOURCE,
  eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
  spawnPolicyId: SPAWN_POLICY_READ_ONLY,
  spawnPolicyVersion: 1,
  roleTemplateId: SPAWN_ROLE_READ_ONLY,
  roleTemplateVersion: 1,
  runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF,
  runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF,
  taskSpecRef: E2_FIXTURE_TASK_SPEC_REF,
  requestedTtl: 60_000,
  requestedSteps: 5,
  requestedCost: 0.05,
  requestedCapabilities: [],
  scopeMode: 'event.repository',
});

/** Live acceptance is explicit-test-only and remains disabled in the production registry. */
export const K43A_LIVE_MINIMAX_ACTION_RULE: SchedulerEventActionRule = Object.freeze({
  ruleId: K43A_LIVE_MINIMAX_ACTION_RULE_ID,
  version: 1,
  enabled: false,
  sourceType: GIT_REPOSITORY_REVISION_SOURCE,
  eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
  spawnPolicyId: SPAWN_POLICY_READ_ONLY,
  spawnPolicyVersion: 1,
  roleTemplateId: SPAWN_ROLE_READ_ONLY,
  roleTemplateVersion: 1,
  runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF,
  runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF,
  taskSpecRef: K43A_LIVE_MINIMAX_TASK_SPEC_REF,
  requestedTtl: 60_000,
  requestedSteps: 1,
  requestedCost: 0.01,
  requestedTokens: 6_000,
  requestedCapabilities: [],
  scopeMode: 'event.repository',
});

export const DEFAULT_SCHEDULER_EVENT_ACTION_RULES: readonly SchedulerEventActionRule[] = Object.freeze([E1_FIXTURE_ACTION_RULE, E2_FIXTURE_ACTION_RULE, K43A_LIVE_MINIMAX_ACTION_RULE]);

export type DynamicWorkerPhase =
  | 'claimed'
  | 'before_policy'
  | 'before_child_creation'
  | 'child_created'
  | 'before_assignment'
  | 'assignment_created'
  | 'before_dispatch'
  | 'runtime_settled'
  | 'before_event_settlement';

export type DynamicWorkerOutcome = 'NO_ACTION' | 'DENIED' | 'DEFERRED' | 'COMPLETED' | 'FAILED' | 'UNCERTAIN';

export type DynamicWorkerOrchestrationResult = {
  result: DynamicWorkerOutcome;
  eventId: string;
  ruleId: string | null;
  ruleVersion: number | null;
  actionRuleApplicationId: string | null;
  schedulerFence: number | null;
  spawnIntentKey: string | null;
  childAgentId: string | null;
  assignmentIntentKey: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  operationId: string | null;
  dispatchId: string | null;
  terminalWorkerOutcome: 'succeeded' | 'failed' | 'cancelled' | 'uncertain' | null;
  reasonCode?: string;
};

export type DynamicWorkerRootFacts = (rootGoalId: string, now: string) => SpawnAuthorityFacts | undefined;

export type DynamicWorkerOrchestratorOptions = {
  store: AgentModeSqliteStateStore;
  runtime: AgentRuntime;
  rootFacts: DynamicWorkerRootFacts;
  actionRules?: readonly SchedulerEventActionRule[];
  ownerId?: string;
  controllerRef?: string;
  now?: string;
  clock?: () => string;
  leaseDurationMs?: number;
  phaseHook?: (phase: DynamicWorkerPhase, event: AgentModeSchedulerEvent) => void;
};

export type DynamicWorkerPassOptions = Omit<DynamicWorkerOrchestratorOptions, 'now'> & {
  now?: string;
  maxEvents?: number;
};

export type DynamicWorkerPassResult = {
  result: 'NO_ACTION' | 'PROCESSED' | 'BOUNDED';
  now: string;
  considered: number;
  processed: number;
  deferred: number;
  decisions: DynamicWorkerOrchestrationResult[];
};

type DerivedLifecycle = {
  request: SpawnRequest;
  admissionFacts: SpawnAuthorityFacts;
  assignmentRequest: AgentModeChildAssignmentRequest;
  actionRuleApplicationId: string;
  spawnIntent: string;
  assignmentIntent: string;
  operationId: string;
  dispatchId: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }

function boundedPositive(value: number, maximum: number): boolean { return Number.isSafeInteger(value) && value > 0 && value <= maximum; }

function boundedOutcome(result: DynamicWorkerOrchestrationResult): DynamicWorkerOrchestrationResult {
  const { reasonCode, ...rest } = result;
  return reasonCode === undefined
    ? { ...rest, ruleId: result.ruleId?.slice(0, MAX_RULE_ID_LENGTH) ?? null }
    : { ...rest, ruleId: result.ruleId?.slice(0, MAX_RULE_ID_LENGTH) ?? null, reasonCode: reasonCode.slice(0, 128) };
}

function validRule(rule: SchedulerEventActionRule, policies: readonly AgentSpawnPolicy[], templates: readonly AgentRoleTemplate[]): string | undefined {
  if (!rule || typeof rule !== 'object' || !SAFE_ID.test(rule.ruleId) || rule.ruleId.length > MAX_RULE_ID_LENGTH || !Number.isSafeInteger(rule.version) || rule.version < 1 || typeof rule.enabled !== 'boolean') return 'RULE_ID_INVALID';
  if (!KNOWN_SOURCES.has(rule.sourceType) || !KNOWN_EVENTS.has(rule.eventType)) return 'RULE_EVENT_UNKNOWN';
  const policy = getSpawnPolicy(rule.spawnPolicyId, rule.spawnPolicyVersion, policies);
  const template = getRoleTemplate(rule.roleTemplateId, rule.roleTemplateVersion, templates);
  if (!policy) return 'RULE_POLICY_UNKNOWN';
  if (!template) return 'RULE_ROLE_UNKNOWN';
  const runtimeProfile = AGENT_MODE_RUNTIME_PROFILES.find((profile) => profile.runtimeRef === rule.runtimeRef && profile.runtimeProfileRef === rule.runtimeProfileRef);
  if (!runtimeProfile) return 'RULE_RUNTIME_UNKNOWN';
  if ((rule.runtimeRef !== MOCK_AGENT_RUNTIME_REF || rule.runtimeProfileRef !== MOCK_AGENT_RUNTIME_PROFILE_REF)
    && (rule.runtimeRef !== RESTRICTED_HARNESS_RUNTIME_REF || rule.runtimeProfileRef !== RESTRICTED_HARNESS_PROFILE_REF)) return 'RULE_RUNTIME_NOT_ALLOWED';
  if ((rule.runtimeProfileRef === RESTRICTED_HARNESS_PROFILE_REF && rule.requestedCapabilities.length !== 0) || (rule.runtimeProfileRef === MOCK_AGENT_RUNTIME_PROFILE_REF && rule.taskSpecRef !== E1_FIXTURE_TASK_SPEC_REF) || (rule.runtimeProfileRef === RESTRICTED_HARNESS_PROFILE_REF && ![E2_FIXTURE_TASK_SPEC_REF, K43A_LIVE_MINIMAX_TASK_SPEC_REF].includes(rule.taskSpecRef as typeof E2_FIXTURE_TASK_SPEC_REF | typeof K43A_LIVE_MINIMAX_TASK_SPEC_REF)) || !SAFE_REF.test(rule.taskSpecRef) || rule.taskSpecRef.length > MAX_TASK_SPEC_LENGTH) return 'RULE_TASK_SPEC_INVALID';
  if (!boundedPositive(rule.requestedTtl, 15 * 60 * 1000) || !Number.isSafeInteger(rule.requestedSteps) || rule.requestedSteps < 1 || rule.requestedSteps > 100 || !Number.isFinite(rule.requestedCost) || rule.requestedCost < 0 || rule.requestedCost > 0.25 || !Number.isSafeInteger(rule.requestedTokens ?? 0) || (rule.requestedTokens ?? 0) < 0 || (rule.requestedTokens ?? 0) > 6_000) return 'RULE_LIMIT_INVALID';
  if (rule.scopeMode !== 'event.repository' && rule.scopeMode !== 'none') return 'RULE_SCOPE_MODE_INVALID';
  if (new Set(rule.requestedCapabilities).size !== rule.requestedCapabilities.length || rule.requestedCapabilities.length > 8) return 'RULE_CAPABILITY_INVALID';
  if (!rule.requestedCapabilities.every((capability) => typeof capability === 'string' && SAFE_ID.test(capability) && policy.capabilityCeiling.includes(capability as never) && template.capabilities.includes(capability as never))) return 'RULE_CAPABILITY_INVALID';
  if (!policy.allowedSourceTypes.includes(rule.sourceType) || !policy.allowedEventTypes.includes(rule.eventType) || !policy.allowedRoleTemplateIds.includes(rule.roleTemplateId)) return 'RULE_POLICY_INCOMPATIBLE';
  if (template.allowsChildSpawning || rule.roleTemplateId !== SPAWN_ROLE_READ_ONLY) return 'RULE_ROLE_INCOMPATIBLE';
  if (rule.scopeMode === 'event.repository' && template.repositoryScope !== 'requested') return 'RULE_SCOPE_INCOMPATIBLE';
  if (rule.scopeMode === 'none' && template.repositoryScope === 'requested') return 'RULE_SCOPE_INCOMPATIBLE';
  return undefined;
}

export function validateSchedulerEventActionRules(rules: readonly SchedulerEventActionRule[] = DEFAULT_SCHEDULER_EVENT_ACTION_RULES): void {
  if (!Array.isArray(rules) || rules.length > MAX_RULES) throw new Error('RULE_REGISTRY_BOUNDED');
  const identities = new Set<string>();
  for (const rule of rules) {
    const identity = `${rule.ruleId}:${rule.version}`;
    if (identities.has(identity)) throw new Error('RULE_DUPLICATE');
    identities.add(identity);
    const reason = validRule(rule, AGENT_MODE_SPAWN_POLICIES, AGENT_MODE_ROLE_TEMPLATES);
    if (reason) throw new Error(reason);
  }
}

function ready(event: AgentModeSchedulerEvent, now: string): boolean {
  return ((event.status === 'pending' || event.status === 'failed') && event.nextEligibleAt <= now)
    || (event.status === 'claimed' && Boolean(event.claimExpiresAt && event.claimExpiresAt <= now));
}

function schedulerEventSourceType(store: AgentModeSqliteStateStore, event: AgentModeSchedulerEvent): string | undefined {
  return store.getEventSource(event.source)?.sourceType;
}

function resultTemplate(eventId: string, result: DynamicWorkerOutcome, schedulerFence: number | null, reasonCode?: string): DynamicWorkerOrchestrationResult {
  return boundedOutcome({ result, eventId, ruleId: null, ruleVersion: null, actionRuleApplicationId: null, schedulerFence, spawnIntentKey: null, childAgentId: null, assignmentIntentKey: null, taskId: null, runId: null, attemptId: null, operationId: null, dispatchId: null, terminalWorkerOutcome: null, ...(reasonCode ? { reasonCode } : {}) });
}

function toDeadline(now: string, ttl: number, eventDeadline: string | null): string {
  const staticDeadline = new Date(Date.parse(now) + ttl).toISOString();
  if (!eventDeadline) return staticDeadline;
  return Date.parse(eventDeadline) < Date.parse(staticDeadline) ? eventDeadline : staticDeadline;
}

function eventRootGoalId(event: AgentModeSchedulerEvent): string | undefined {
  const value = event.payload.rootGoalId;
  return typeof value === 'string' && SAFE_ID.test(value) ? value : undefined;
}

function deriveLifecycle(store: AgentModeSqliteStateStore, event: AgentModeSchedulerEvent, rule: SchedulerEventActionRule, facts: SpawnAuthorityFacts, now: string): DerivedLifecycle | undefined {
  const source = store.getEventSource(event.source);
  const rootGoalId = eventRootGoalId(event);
  if (!source || !source.enabled || source.sourceType !== rule.sourceType || !rootGoalId || !facts.root || facts.root.rootGoalId !== rootGoalId) return undefined;
  const repositoryRef = rule.scopeMode === 'event.repository' ? source.repositoryRef : null;
  // Scheduler redelivery may occur at a later wall-clock instant. Keep the
  // creation material anchored to the immutable event receipt so retries cannot
  // manufacture a new spawn, assignment, or dispatch identity.
  const requestedAt = event.receivedAt;
  const requestDigest = digest({ eventId: event.eventId, ruleId: rule.ruleId, ruleVersion: rule.version });
  const actionRuleApplicationId = `action-rule-application:e1:${requestDigest.slice(0, 48)}`;
  const request: SpawnRequest = {
    schemaVersion: 1,
    requestId: `request:e1:${requestDigest.slice(0, 48)}`,
    policyId: rule.spawnPolicyId,
    policyVersion: rule.spawnPolicyVersion,
    roleTemplateId: rule.roleTemplateId,
    roleTemplateVersion: rule.roleTemplateVersion,
    sourceId: event.source,
    sourceEventId: event.eventId,
    sourceType: rule.sourceType,
    eventType: rule.eventType,
    eventRootGoalId: rootGoalId,
    eventScope: { repositoryRef, resourceRef: null },
    parentAgentId: null,
    parentTaskId: null,
    parentRunId: null,
    rootGoalId,
    requestedScope: { repositoryRef, resourceRef: null },
    requestedCapabilities: [...rule.requestedCapabilities],
    requestedTtl: rule.requestedTtl,
    requestedStepBudget: rule.requestedSteps,
    requestedCostBudget: rule.requestedCost,
    requestedAt,
    deadline: toDeadline(requestedAt, rule.requestedTtl, event.deadline),
    requestedDepth: (facts.parent?.depth ?? facts.root.depth) + 1,
  };
  const spawnIntent = spawnIntentKey(request);
  const materialHash = spawnCreationMaterialHash(request);
  const childAgentId = `agent:child:${createHash('sha256').update(spawnIntent).digest('hex')}`;
  const assignmentRequest: AgentModeChildAssignmentRequest = {
    schemaVersion: 1,
    assignmentId: `assignment:e1:${requestDigest.slice(0, 48)}`,
    childAgentId,
    rootGoalId,
    taskSpecRef: rule.taskSpecRef,
    sourceEventId: event.eventId,
    runtimeRef: rule.runtimeRef,
    runtimeProfileRef: rule.runtimeProfileRef,
    requestedSteps: rule.requestedSteps,
    requestedCostCeiling: rule.requestedCost,
    ...(rule.requestedTokens === undefined ? {} : { requestedTokenCeiling: rule.requestedTokens }),
    requestedCapabilities: [...rule.requestedCapabilities],
    repositoryScope: repositoryRef,
    resourceScope: null,
    deadline: request.deadline,
    requestedAt,
  };
  const assignmentIntent = assignmentIntentKey(assignmentRequest);
  const operationDigest = digest({ eventId: event.eventId, ruleId: rule.ruleId, ruleVersion: rule.version, spawnIntent, assignmentIntent, materialHash });
  return {
    request,
    admissionFacts: facts,
    assignmentRequest,
    actionRuleApplicationId,
    spawnIntent,
    assignmentIntent,
    operationId: `operation:e1:${operationDigest.slice(0, 48)}`,
    dispatchId: `dispatch:e1:${operationDigest.slice(0, 48)}`,
  };
}

function denialIsTemporary(reasonCode: string): boolean {
  return ['AUTHORITY_UNAVAILABLE', 'CONCURRENCY_EXCEEDED', 'GLOBAL_KILL_SWITCH', 'ROOT_KILL_SWITCH', 'CANCELLATION_REQUESTED'].includes(reasonCode);
}

function dispatchOutcome(result: AgentModeRuntimeDispatchResult): DynamicWorkerOutcome {
  if (result.result === 'succeeded' || result.result === 'failed' || result.result === 'cancelled' || result.result === 'duplicate') return 'COMPLETED';
  if (result.result === 'uncertain') return 'UNCERTAIN';
  return denialIsTemporary(result.result === 'denied' ? result.reasonCode : 'AUTHORITY_UNAVAILABLE') ? 'DEFERRED' : 'FAILED';
}

function workerOutcome(result: AgentModeRuntimeDispatchResult): DynamicWorkerOrchestrationResult['terminalWorkerOutcome'] {
  if (result.result === 'duplicate') return result.receipt.status;
  if (result.result === 'succeeded' || result.result === 'failed' || result.result === 'cancelled') return result.result;
  return result.result === 'uncertain' ? 'uncertain' : null;
}

function phaseResult(base: DynamicWorkerOrchestrationResult, lifecycle: DerivedLifecycle, rule: SchedulerEventActionRule, schedulerFence: number | null, result: DynamicWorkerOutcome, terminalWorkerOutcome: DynamicWorkerOrchestrationResult['terminalWorkerOutcome'], reasonCode?: string): DynamicWorkerOrchestrationResult {
  return boundedOutcome({ ...base, result, ruleId: rule.ruleId, ruleVersion: rule.version, actionRuleApplicationId: lifecycle.actionRuleApplicationId, schedulerFence, spawnIntentKey: lifecycle.spawnIntent, assignmentIntentKey: lifecycle.assignmentIntent, operationId: lifecycle.operationId, dispatchId: lifecycle.dispatchId, terminalWorkerOutcome, ...(reasonCode ? { reasonCode } : {}) });
}

export class AgentModeDynamicWorkerOrchestrator {
  private readonly dispatcher: AgentModeRuntimeDispatcher;
  private readonly rules: readonly SchedulerEventActionRule[];
  private readonly ownerId: string;
  private readonly controllerRef: string;
  private readonly clock: () => string;
  private readonly phaseHook?: DynamicWorkerOrchestratorOptions['phaseHook'];
  private readonly leaseDurationMs: number;

  constructor(private readonly options: DynamicWorkerOrchestratorOptions) {
    this.rules = options.actionRules ?? DEFAULT_SCHEDULER_EVENT_ACTION_RULES;
    validateSchedulerEventActionRules(this.rules);
    this.dispatcher = new AgentModeRuntimeDispatcher(options.store, options.runtime);
    this.ownerId = options.ownerId ?? 'brain-agent-dynamic-worker';
    this.controllerRef = options.controllerRef ?? E1_FIXTURE_CONTROLLER_REF;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.phaseHook = options.phaseHook;
    this.leaseDurationMs = Math.max(1, Math.min(300_000, Math.floor(options.leaseDurationMs ?? 30_000)));
  }

  async handleSchedulerEvent(input: { event: AgentModeSchedulerEvent; schedulerClaim?: AgentModeSchedulerClaim; now?: string }): Promise<DynamicWorkerOrchestrationResult> {
    const now = input.now ?? this.options.now ?? this.clock();
    const initial = input.event;
    const isRedelivery = initial.status === 'failed' || initial.status === 'claimed';
    const base = resultTemplate(initial.eventId, 'DEFERRED', input.schedulerClaim?.fence ?? null, 'CLAIM_UNAVAILABLE');
    try {
      if (initial.status === 'completed') return { ...base, result: 'COMPLETED', reasonCode: 'EVENT_ALREADY_COMPLETED' };
    if (initial.status === 'dead_letter') return { ...base, result: 'FAILED', reasonCode: initial.lastFailure ?? 'EVENT_DEAD_LETTERED' };
    if (!ready(initial, now) && !input.schedulerClaim) return base;
    const claim = input.schedulerClaim ?? this.options.store.claimSchedulerEvent(initial.eventId, this.ownerId, new Date(Date.parse(now) + this.leaseDurationMs).toISOString(), now);
    if (!claim) return base;
    this.phaseHook?.('claimed', initial);
    const rule = this.rules.find((candidate) => candidate.sourceType === schedulerEventSourceType(this.options.store, initial) && candidate.eventType === initial.eventType);
    if (!rule || !rule.enabled) {
      this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
      this.recordOrchestrationEvent(initial, resultTemplate(initial.eventId, 'NO_ACTION', claim.fence, rule ? 'RULE_DISABLED' : 'NO_ACTION_RULE'));
      return resultTemplate(initial.eventId, 'NO_ACTION', claim.fence, rule ? 'RULE_DISABLED' : 'NO_ACTION_RULE');
    }
    this.phaseHook?.('before_policy', initial);
    const rootGoalId = eventRootGoalId(initial);
    if (!rootGoalId) {
      this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
      return resultTemplate(initial.eventId, 'NO_ACTION', claim.fence, 'ROOT_GOAL_REQUIRED');
    }
    const facts = this.options.rootFacts(rootGoalId, now);
    if (!facts) {
      this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
      return resultTemplate(initial.eventId, 'NO_ACTION', claim.fence, 'ROOT_CONTEXT_UNAVAILABLE');
    }
    const lifecycle = deriveLifecycle(this.options.store, initial, rule, facts, now);
    if (!lifecycle) {
      this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
      return resultTemplate(initial.eventId, 'NO_ACTION', claim.fence, 'EVENT_ROOT_OR_SOURCE_BINDING_INVALID');
    }
    const admission = evaluateSpawnAdmission(lifecycle.request, lifecycle.admissionFacts);
    if (admission.result !== 'ALLOW') {
      const result = phaseResult(resultTemplate(initial.eventId, denialIsTemporary(admission.reasonCode) ? 'DEFERRED' : 'DENIED', claim.fence, admission.reasonCode), lifecycle, rule, claim.fence, denialIsTemporary(admission.reasonCode) ? 'DEFERRED' : 'DENIED', null, admission.reasonCode);
      if (denialIsTemporary(admission.reasonCode)) this.options.store.failSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now, reason: admission.reasonCode });
      else this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
      this.recordOrchestrationEvent(initial, result);
      return result;
    }
    if (admission.spawnIntentKey !== lifecycle.spawnIntent || admission.creationMaterialHash !== spawnCreationMaterialHash(lifecycle.request)) throw new Error('SPAWN_IDENTITY_DERIVATION_MISMATCH');
    this.phaseHook?.('before_child_creation', initial);
    const created = this.options.store.reserveSpawnAndCreateChild({ request: lifecycle.request, admission, facts } satisfies AgentModeSpawnCreationInput);
    if (!('receipt' in created)) {
      const denial = created.reasonCode;
      const result = phaseResult(resultTemplate(initial.eventId, denialIsTemporary(denial) ? 'DEFERRED' : 'DENIED', claim.fence, denial), lifecycle, rule, claim.fence, denialIsTemporary(denial) ? 'DEFERRED' : 'DENIED', null, denial);
      if (denialIsTemporary(denial)) this.options.store.failSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now, reason: denial });
      else this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
      this.recordOrchestrationEvent(initial, result);
      return result;
    }
    const childAgentId = created.receipt.childAgentId;
    if (childAgentId !== lifecycle.assignmentRequest.childAgentId) throw new Error('CHILD_IDENTITY_DERIVATION_MISMATCH');
    const assignmentRequest = { ...lifecycle.assignmentRequest, childAgentId };
    const assignmentIntent = assignmentIntentKey(assignmentRequest);
    if (assignmentIntent !== lifecycle.assignmentIntent) throw new Error('ASSIGNMENT_IDENTITY_DERIVATION_MISMATCH');
    let baseResult = phaseResult(resultTemplate(initial.eventId, 'DEFERRED', claim.fence), { ...lifecycle, assignmentRequest }, rule, claim.fence, 'DEFERRED', null);
    baseResult = { ...baseResult, childAgentId, assignmentIntentKey: assignmentIntent };
    this.phaseHook?.('child_created', initial);
    this.phaseHook?.('before_assignment', initial);
    const assigned = this.options.store.assignChildAgent(assignmentRequest);
    if (!('receipt' in assigned)) {
      const denial = assigned.reasonCode;
      const result = phaseResult({ ...baseResult, result: 'DEFERRED', reasonCode: denial }, { ...lifecycle, assignmentRequest, assignmentIntent }, rule, claim.fence, 'DEFERRED', null, denial);
      this.options.store.failSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now, reason: denial });
      this.recordOrchestrationEvent(initial, result);
      return result;
    }
    const taskId = assigned.receipt.taskId;
    const runId = assigned.receipt.runId;
    const attemptId = assigned.receipt.attemptId;
    baseResult = { ...baseResult, taskId, runId, attemptId };
    this.phaseHook?.('assignment_created', initial);
    this.phaseHook?.('before_dispatch', initial);
    const dispatchRequest: AgentModeRuntimeDispatchRequest = {
      schemaVersion: 1,
      dispatchId: lifecycle.dispatchId,
      operationId: lifecycle.operationId,
      assignmentIntentKey: assigned.receipt.assignmentIntentKey,
      childAgentId,
      taskId,
      runId,
      attemptId,
      runtimeRef: rule.runtimeRef,
      runtimeProfileRef: rule.runtimeProfileRef,
      controllerRef: this.controllerRef,
      requestedAt: now,
    };
    let dispatched = await this.dispatcher.dispatch(dispatchRequest);
    if (isRedelivery && dispatched.result === 'uncertain') {
      const reconciled = await this.dispatcher.reconcile(dispatchRequest);
      if (reconciled.result !== 'uncertain') dispatched = reconciled;
    }
    this.phaseHook?.('runtime_settled', initial);
    let outcome = dispatchOutcome(dispatched);
    let terminal = workerOutcome(dispatched);
    if (outcome === 'DEFERRED' && dispatched.result === 'denied' && ['CANCELLATION_REQUESTED', 'CANCELLATION_NOT_REQUESTED'].includes(dispatched.reasonCode)) {
      this.options.store.retireChildAgent(childAgentId, 'cancelled', now);
      outcome = 'COMPLETED';
      terminal = 'cancelled';
    }
    const result = phaseResult({ ...baseResult, result: outcome, reasonCode: 'RUNTIME_' + dispatched.result.toUpperCase() }, { ...lifecycle, assignmentRequest, assignmentIntent }, rule, claim.fence, outcome, terminal, dispatched.result === 'denied' || dispatched.result === 'uncertain' ? dispatched.reasonCode : undefined);
    if (outcome === 'COMPLETED') {
      this.phaseHook?.('before_event_settlement', initial);
      this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
    } else if (outcome === 'UNCERTAIN' || outcome === 'DEFERRED') {
      this.options.store.failSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now, reason: result.reasonCode ?? 'RUNTIME_UNCERTAIN' });
    } else {
      this.options.store.completeSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: claim.ownerId, fence: claim.fence, now });
    }
      this.recordOrchestrationEvent(initial, result);
      return result;
    } catch {
      const current = this.options.store.getSchedulerEvent(initial.eventId);
      const fence = current?.claimFence ?? input.schedulerClaim?.fence ?? null;
      if (current?.status === 'claimed' && current.claimOwner && current.claimFence !== null) {
        try { this.options.store.failSchedulerEvent({ itemType: 'event', itemId: initial.eventId, ownerId: current.claimOwner, fence: current.claimFence, now, reason: 'ORCHESTRATION_INTERRUPTED' }); } catch { /* scheduler lease expiry is the recovery path */ }
      }
      return resultTemplate(initial.eventId, 'DEFERRED', fence, 'ORCHESTRATION_INTERRUPTED');
    }
  }

  private recordOrchestrationEvent(event: AgentModeSchedulerEvent, result: DynamicWorkerOrchestrationResult): void {
    const existing = this.options.store.listEvents(event.eventId).some((candidate) => candidate.eventType === 'scheduler_worker_orchestrated' && candidate.payload.phase === result.result && candidate.payload.reasonCode === (result.reasonCode ?? null));
    if (existing) return;
    this.options.store.recordEvent({
      eventId: `scheduler-worker-orchestration:${event.eventId}:${result.result}`,
      entityType: 'scheduler_event',
      entityId: event.eventId,
      eventType: 'scheduler_worker_orchestrated',
      occurredAt: this.options.now ?? this.clock(),
      payload: {
        schedulerEventId: result.eventId,
        actionRuleId: result.ruleId,
        actionRuleVersion: result.ruleVersion,
        actionRuleApplicationId: result.actionRuleApplicationId,
        spawnIntentKey: result.spawnIntentKey,
        childAgentId: result.childAgentId,
        assignmentIntentKey: result.assignmentIntentKey,
        taskId: result.taskId,
        runId: result.runId,
        attemptId: result.attemptId,
        operationId: result.operationId,
        dispatchId: result.dispatchId,
        phase: result.result,
        terminalWorkerOutcome: result.terminalWorkerOutcome,
        reasonCode: result.reasonCode ?? null,
      },
    });
  }

  async advance(now = this.options.now ?? this.clock(), maxEvents = MAX_EVENTS_PER_PASS): Promise<DynamicWorkerPassResult> {
    const limit = Math.max(1, Math.min(MAX_EVENTS_PER_PASS, Math.floor(maxEvents)));
    const candidates = this.options.store.listSchedulerEvents(500)
      .filter((event) => ready(event, now))
      .sort((left, right) => left.nextEligibleAt.localeCompare(right.nextEligibleAt) || left.eventId.localeCompare(right.eventId));
    const decisions: DynamicWorkerOrchestrationResult[] = [];
    for (const event of candidates.slice(0, limit)) decisions.push(await this.handleSchedulerEvent({ event, now }));
    return { result: candidates.length === 0 ? 'NO_ACTION' : candidates.length > limit ? 'BOUNDED' : 'PROCESSED', now, considered: candidates.length, processed: decisions.length, deferred: Math.max(0, candidates.length - decisions.length), decisions };
  }

  requestCancellation(input: { eventId: string; attemptId: string; requestedAt: string }): string {
    const event = this.options.store.getSchedulerEvent(input.eventId);
    if (!event) return 'conflict';
    const rule = this.rules.find((candidate) => candidate.sourceType === schedulerEventSourceType(this.options.store, event) && candidate.eventType === event.eventType && candidate.enabled);
    if (!rule) return 'conflict';
    const rootGoalId = eventRootGoalId(event);
    const facts = rootGoalId ? this.options.rootFacts(rootGoalId, input.requestedAt) : undefined;
    const lifecycle = rootGoalId && facts ? deriveLifecycle(this.options.store, event, rule, facts, input.requestedAt) : undefined;
    if (!lifecycle) return 'conflict';
    return this.dispatcher.requestCancellation({ requestId: `cancel:${lifecycle.operationId}`, attemptId: input.attemptId, operationId: lifecycle.operationId, requestedAt: input.requestedAt });
  }
}

export async function runAgentModeDynamicWorkerPass(options: DynamicWorkerPassOptions): Promise<DynamicWorkerPassResult> {
  const orchestrator = new AgentModeDynamicWorkerOrchestrator(options);
  return orchestrator.advance(options.now ?? (options.clock ?? (() => new Date().toISOString()))(), options.maxEvents ?? MAX_EVENTS_PER_PASS);
}
