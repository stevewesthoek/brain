import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { loadBrainRuntimeConfig } from './portable-runtime-config.js';
import path from 'node:path';
import type { EffectKind, OperationReceipt } from './agent-mode-contracts.js';
import type { RuntimeProcessIdentity } from './runtime-process-identity.js';
import { evaluateSpawnAdmission, getRoleTemplate, getSpawnPolicy, spawnCreationMaterialHash, spawnIntentKey, type SpawnAuthorityFacts, type SpawnDecision, type SpawnRequest } from './spawn-policy.js';
import { DEFERRED_MODEL_REF, DEFERRED_ROUTE_REF, AGENT_MODE_RUNTIME_PROFILES, assignmentCapabilityScopeHash, assignmentIntentKey, assignmentMaterialHash, getRuntimeProfile, taskSpecHash, validateChildAssignmentRequest, type AgentModeChildAssignment, type AgentModeChildAssignmentReceipt, type AgentModeChildAssignmentRequest, type AgentModeChildAssignmentResult, type AgentModePreparedChildDispatch } from './child-assignment.js';
import { runtimeDispatchResourceKey, runtimeReceiptEffectHash, validateRuntimeDispatchRequest, validateRuntimeResult } from './runtime-dispatch.js';
import type { AgentModeRuntimeDispatchMutation, AgentModeRuntimeDispatchPrepared, AgentModeRuntimeDispatchRequest, AgentModeRuntimeDispatchStorePreparation, AgentModeRuntimeReceipt, AgentModeRuntimeReceiptMutation, AgentModeRuntimeSettlement, AgentModeRuntimeVerification, AgentRuntimeResult } from './runtime-dispatch.js';
import { deriveOrganizationPlanId, deriveOrganizationWorkItemId, evaluateOrganizationReadiness, organizationPlanMaterial, validateOrganizationPlan, type DelegatedResultFact, type OrganizationPlan, type OrganizationReadiness } from './organization.js';
import { deriveOrganizationAggregation, organizationFinalResultFromAggregation, organizationFinalResultMaterial, type OrganizationFinalResult } from './organization-finalization.js';
import { AGENT_MODE_ATTENTION_MAX_ITEMS, AGENT_MODE_ATTENTION_SCHEMA_VERSION, deriveEscalationId, deriveNotificationId, escalationMaterial, notificationMaterial, type AgentModeAttentionReconcileResult, type AgentModeAttentionSourceType, type AgentModeEscalation, type AgentModeEscalationKind, type AgentModeEscalationSeverity, type AgentModeEscalationStatus, type AgentModeNotification, type AgentModeNotificationKind } from './agent-mode-attention.js';
import { canonicalJarvisUserResponseText, deriveJarvisUserResponseId, deriveJarvisUserResponseTextHash, jarvisUserResponseMaterialHash, type JarvisUserResponseV1 } from './jarvis-user-response.js';
import { deriveJarvisReadableResultContentHash, validateJarvisReadableResult, validateJarvisTaskInput, type JarvisReadableResultV1, type JarvisTaskInputV1 } from './jarvis-response-sources.js';

export type AgentModeAgent = {
  agentId: string;
  agentKind: 'jarvis' | 'worker' | 'reviewer' | 'system';
  role: string;
  displayName: string;
  policyId: string;
  status: 'active' | 'paused' | 'retired' | 'reserved' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'uncertain';
  roleTemplateId?: string;
  roleTemplateVersion?: number;
  policyVersion?: number;
  parentAgentId?: string | null;
  parentTaskId?: string | null;
  parentRunId?: string | null;
  rootGoalId?: string;
  spawnIntentKey?: string;
  sourceEventId?: string;
  depth?: number;
  repositoryScope?: string | null;
  resourceScope?: string | null;
  capabilitySetHash?: string;
  capabilities?: readonly string[];
  requestedChildSteps?: number;
  reservedChildSteps?: number;
  requestedChildCost?: number;
  reservedChildCost?: number;
  childCreatedAt?: string;
  expiresAt?: string;
};

export type AgentModeSpawnRootState = {
  rootGoalId: string;
  policyId: string;
  policyVersion: number;
  maxConcurrentChildren: number;
  maxTotalChildCreations: number;
  maxAggregateChildSteps: number;
  maxAggregateChildCost: number;
  activeChildren: number;
  totalChildCreations: number;
  reservedChildSteps: number;
  reservedChildCost: number;
  depth: number;
  cancellation: 'active' | 'requested' | 'cancelled';
  deadline: string;
  delegableCapabilities: readonly string[];
  repositoryScopes: readonly string[];
  resourceScopes: readonly string[];
  updatedAt: string;
};

export type AgentModeSpawnCreationReceipt = {
  spawnIntentKey: string;
  childAgentId: string;
  rootGoalId: string;
  parentAgentId: string | null;
  parentTaskId: string | null;
  parentRunId: string | null;
  roleTemplateId: string;
  roleTemplateVersion: number;
  policyId: string;
  policyVersion: number;
  activeSlotReserved: boolean;
  stepAllocation: number;
  costAllocation: number;
  depth: number;
  createdAt: string;
  expiresAt: string;
};

export type AgentModeSpawnCreationResult =
  | { result: 'created' | 'duplicate'; receipt: AgentModeSpawnCreationReceipt }
  | { result: 'denied' | 'conflict'; reasonCode: string };

export type AgentModeSpawnCreationInput = {
  request: SpawnRequest;
  admission: SpawnDecision;
  facts: SpawnAuthorityFacts;
};

export type AgentModeOrganizationPlanResult =
  | { result: 'created' | 'duplicate'; plan: OrganizationPlan }
  | { result: 'conflict'; reasonCode: 'ORGANIZATION_PLAN_CONFLICT' };

function mapOrganizationPlanRow(row: Record<string, unknown>, workItems: AgentModeOrganizationWorkItem[], dependencies: AgentModeOrganizationDependency[]): OrganizationPlan {
  return {
    schemaVersion: Number(row.schema_version) as 1,
    organizationPlanId: String(row.organization_plan_id),
    planVersion: Number(row.plan_version) as 1,
    rootGoalId: String(row.root_goal_id),
    supervisorAgentId: String(row.supervisor_agent_id),
    supervisorOrganizationRoleId: String(row.supervisor_organization_role_id),
    planKey: String(row.plan_key),
    status: row.status as OrganizationPlan['status'],
    createdAt: String(row.created_at),
    deadline: String(row.deadline),
    workItems: workItems.map((item) => ({
      workItemId: item.workItemId, workItemKey: item.workItemKey, organizationRoleId: item.organizationRoleId, taskSpecRef: item.taskSpecRef,
      dependencyKeys: item.dependencyKeys, requestedTtl: item.requestedTtl, requestedSteps: item.requestedSteps, requestedCost: item.requestedCost,
      requestedTokens: item.requestedTokens, resultContract: item.resultContract,
    })),
    dependencies: dependencies.map((dependency) => ({ workItemKey: dependency.workItemKey, dependsOnWorkItemKey: dependency.dependsOnWorkItemKey, type: dependency.type })),
  };
}

export type AgentModeOrganizationWorkItem = {
  organizationPlanId: string;
  workItemId: string;
  workItemKey: string;
  organizationRoleId: string;
  taskSpecRef: string;
  dependencyKeys: string[];
  requestedTtl: number;
  requestedSteps: number;
  requestedCost: number;
  requestedTokens: number;
  resultContract: OrganizationPlan['workItems'][number]['resultContract'];
  boundChildAgentId: string | null;
  boundTaskId: string | null;
};

export type AgentModeOrganizationDependency = {
  organizationPlanId: string;
  workItemKey: string;
  dependsOnWorkItemKey: string;
  type: 'requires_success';
};

export type AgentModeOrganizationBindingRequest = {
  organizationPlanId: string;
  workItemId: string;
  childAgentId: string;
  taskId: string;
  occurredAt: string;
};

export type AgentModeOrganizationBindingResult =
  | { result: 'bound' | 'duplicate' }
  | { result: 'conflict' | 'denied'; reasonCode: string };

export type AgentModeOrganizationFinalizationResult =
  | { result: 'created' | 'duplicate'; finalResult: OrganizationFinalResult }
  | { result: 'conflict' | 'denied'; reasonCode: string };

function mapJarvisIntakeRow(row: Record<string, unknown>): AgentModeJarvisIntakeRecord {
  return {
    intakeId: String(row.intake_id),
    materialHash: String(row.material_hash),
    schemaVersion: Number(row.schema_version) as 1,
    source: String(row.source) as 'typed' | 'voice',
    operatorId: String(row.operator_id),
    canonicalTextHash: String(row.canonical_text_hash),
    rootGoalId: String(row.root_goal_id),
    taskId: String(row.task_id),
    jarvisAgentId: String(row.jarvis_agent_id),
    receivedAt: String(row.received_at),
    createdAt: String(row.created_at),
  };
}

function mapJarvisUserResponseRow(row: Record<string, unknown>): AgentModeJarvisUserResponseRecord {
  return {
    schemaVersion: String(row.schema_version) as JarvisUserResponseV1['schemaVersion'],
    responseId: String(row.response_id),
    rootGoalId: String(row.root_goal_id),
    taskId: String(row.task_id),
    jarvisAgentId: String(row.jarvis_agent_id) as 'agent:jarvis',
    speakerRole: String(row.speaker_role) as 'jarvis',
    sourceResultRef: String(row.source_result_ref),
    status: String(row.status) as 'published',
    text: String(row.text),
    textHash: String(row.text_hash),
    createdAt: String(row.created_at),
    materialHash: String(row.material_hash),
  };
}

function mapJarvisTaskInputRow(row: Record<string, unknown>): JarvisTaskInputV1 {
  return {
    schemaVersion: String(row.schema_version) as JarvisTaskInputV1['schemaVersion'],
    rootGoalId: String(row.root_goal_id),
    taskId: String(row.task_id),
    jarvisAgentId: String(row.jarvis_agent_id) as 'agent:jarvis',
    source: String(row.source) as JarvisTaskInputV1['source'],
    text: String(row.text),
    contentHash: String(row.content_hash),
    retentionClass: String(row.retention_class) as JarvisTaskInputV1['retentionClass'],
    createdAt: String(row.created_at),
  };
}

function mapJarvisReadableResultRow(row: Record<string, unknown>): JarvisReadableResultV1 {
  let facts: JarvisReadableResultV1['facts'] = [];
  try {
    const parsed = JSON.parse(String(row.facts_json)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not an array');
    facts = parsed as JarvisReadableResultV1['facts'];
  } catch { throw new Error('Jarvis readable result is corrupt'); }
  return {
    schemaVersion: String(row.schema_version) as JarvisReadableResultV1['schemaVersion'],
    resultRef: String(row.result_ref),
    rootGoalId: String(row.root_goal_id),
    taskId: String(row.task_id),
    owner: String(row.owner) as JarvisReadableResultV1['owner'],
    resultType: String(row.result_type) as JarvisReadableResultV1['resultType'],
    facts,
    contentHash: String(row.content_hash),
    createdAt: String(row.created_at),
  };
}

function mapOrganizationFinalResultRow(row: Record<string, unknown>): OrganizationFinalResult {
  let workItemResults: OrganizationFinalResult['workItemResults'] = [];
  try {
    const parsed = JSON.parse(String(row.work_item_results_json)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not an array');
    workItemResults = parsed as OrganizationFinalResult['workItemResults'];
  } catch { throw new Error('organization final result is corrupt'); }
  return {
    schemaVersion: Number(row.schema_version) as 1,
    organizationFinalResultId: String(row.organization_final_result_id),
    organizationPlanId: String(row.organization_plan_id),
    planVersion: Number(row.plan_version) as 1,
    rootGoalId: String(row.root_goal_id),
    supervisorAgentId: String(row.supervisor_agent_id),
    status: row.status as OrganizationFinalResult['status'],
    auditorWorkItemId: row.auditor_work_item_id === null ? null : String(row.auditor_work_item_id),
    auditorResultRef: row.auditor_result_ref === null ? null : String(row.auditor_result_ref),
    workItemResults,
    totalSettledCost: Number(row.total_settled_cost),
    aggregateDigest: String(row.aggregate_digest),
    finalizedAt: String(row.finalized_at),
  };
}

function mapEscalationRow(row: Record<string, unknown>): AgentModeEscalation {
  return {
    schemaVersion: String(row.schema_version) as typeof AGENT_MODE_ATTENTION_SCHEMA_VERSION,
    escalationId: String(row.escalation_id),
    kind: String(row.kind) as AgentModeEscalationKind,
    severity: String(row.severity) as AgentModeEscalationSeverity,
    rootGoalId: row.root_goal_id == null ? null : String(row.root_goal_id),
    agentId: row.agent_id == null ? null : String(row.agent_id),
    taskId: row.task_id == null ? null : String(row.task_id),
    runId: row.run_id == null ? null : String(row.run_id),
    attemptId: row.attempt_id == null ? null : String(row.attempt_id),
    workcellId: row.workcell_id == null ? null : String(row.workcell_id),
    reviewId: row.review_id == null ? null : String(row.review_id),
    sourceType: String(row.source_type) as AgentModeAttentionSourceType,
    sourceId: String(row.source_id),
    reasonCode: String(row.reason_code),
    status: String(row.status) as AgentModeEscalationStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
  };
}

function mapNotificationRow(row: Record<string, unknown>): AgentModeNotification {
  return {
    schemaVersion: String(row.schema_version) as typeof AGENT_MODE_ATTENTION_SCHEMA_VERSION,
    notificationId: String(row.notification_id),
    kind: String(row.kind) as AgentModeNotificationKind,
    severity: String(row.severity) as AgentModeNotification['severity'],
    sourceType: String(row.source_type) as AgentModeNotification['sourceType'],
    sourceId: String(row.source_id),
    escalationId: row.escalation_id == null ? null : String(row.escalation_id),
    reviewId: row.review_id == null ? null : String(row.review_id),
    rootGoalId: row.root_goal_id == null ? null : String(row.root_goal_id),
    agentId: row.agent_id == null ? null : String(row.agent_id),
    taskId: row.task_id == null ? null : String(row.task_id),
    runId: row.run_id == null ? null : String(row.run_id),
    attemptId: row.attempt_id == null ? null : String(row.attempt_id),
    workcellId: row.workcell_id == null ? null : String(row.workcell_id),
    titleCode: String(row.title_code),
    messageCode: String(row.message_code),
    createdAt: String(row.created_at),
    read: row.operator_id === undefined || row.operator_id === null ? null : row.read_at != null,
    readAt: row.read_at == null ? null : String(row.read_at),
  };
}

function mapOrganizationWorkItemRow(row: Record<string, unknown>): AgentModeOrganizationWorkItem {
  let dependencyKeys: string[] = [];
  let resultContract: OrganizationPlan['workItems'][number]['resultContract'];
  try { dependencyKeys = JSON.parse(String(row.dependency_keys_json)) as string[]; } catch { dependencyKeys = []; }
  try { resultContract = JSON.parse(String(row.result_contract_json)) as OrganizationPlan['workItems'][number]['resultContract']; } catch { throw new Error('organization result contract is corrupt'); }
  return {
    organizationPlanId: String(row.organization_plan_id), workItemId: String(row.work_item_id), workItemKey: String(row.work_item_key), organizationRoleId: String(row.organization_role_id),
    taskSpecRef: String(row.task_spec_ref), dependencyKeys, requestedTtl: Number(row.requested_ttl), requestedSteps: Number(row.requested_steps), requestedCost: Number(row.requested_cost), requestedTokens: Number(row.requested_tokens), resultContract,
    boundChildAgentId: row.bound_child_agent_id === null ? null : String(row.bound_child_agent_id), boundTaskId: row.bound_task_id === null ? null : String(row.bound_task_id),
  };
}

function mapAgentRow(row: Record<string, unknown>): AgentModeAgent {
  let capabilities: unknown;
  try { capabilities = typeof row.capabilities_json === 'string' ? JSON.parse(row.capabilities_json) as unknown : undefined; } catch { capabilities = undefined; }
  return {
    agentId: String(row.agent_id),
    agentKind: row.agent_kind as AgentModeAgent['agentKind'],
    role: String(row.role),
    displayName: String(row.display_name),
    policyId: String(row.policy_id),
    status: row.status as AgentModeAgent['status'],
    ...(typeof row.role_template_id === 'string' ? { roleTemplateId: row.role_template_id } : {}),
    ...(Number.isSafeInteger(row.role_template_version) ? { roleTemplateVersion: Number(row.role_template_version) } : {}),
    ...(Number.isSafeInteger(row.policy_version) ? { policyVersion: Number(row.policy_version) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'parent_agent_id') ? { parentAgentId: row.parent_agent_id === null ? null : String(row.parent_agent_id) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'parent_task_id') ? { parentTaskId: row.parent_task_id === null ? null : String(row.parent_task_id) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'parent_run_id') ? { parentRunId: row.parent_run_id === null ? null : String(row.parent_run_id) } : {}),
    ...(typeof row.root_goal_id === 'string' ? { rootGoalId: row.root_goal_id } : {}),
    ...(typeof row.spawn_intent_key === 'string' ? { spawnIntentKey: row.spawn_intent_key } : {}),
    ...(typeof row.source_event_id === 'string' ? { sourceEventId: row.source_event_id } : {}),
    ...(Number.isSafeInteger(row.spawn_depth) ? { depth: Number(row.spawn_depth) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'repository_scope') ? { repositoryScope: row.repository_scope === null ? null : String(row.repository_scope) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'resource_scope') ? { resourceScope: row.resource_scope === null ? null : String(row.resource_scope) } : {}),
    ...(typeof row.capability_set_hash === 'string' ? { capabilitySetHash: row.capability_set_hash } : {}),
    ...(Array.isArray(capabilities) ? { capabilities: capabilities.filter((value): value is string => typeof value === 'string') } : {}),
    ...(Number.isSafeInteger(row.requested_child_steps) ? { requestedChildSteps: Number(row.requested_child_steps) } : {}),
    ...(Number.isSafeInteger(row.reserved_child_steps) ? { reservedChildSteps: Number(row.reserved_child_steps) } : {}),
    ...(typeof row.requested_child_cost === 'number' ? { requestedChildCost: Number(row.requested_child_cost) } : {}),
    ...(typeof row.reserved_child_cost === 'number' ? { reservedChildCost: Number(row.reserved_child_cost) } : {}),
    ...(typeof row.child_created_at === 'string' ? { childCreatedAt: row.child_created_at } : {}),
    ...(typeof row.expires_at === 'string' ? { expiresAt: row.expires_at } : {}),
  };
}

function stringArrayJson(values: readonly string[]): string {
  return JSON.stringify([...values]);
}

function parseStringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : undefined;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch { return []; }
}

function mapSpawnRootRow(row: Record<string, unknown>): AgentModeSpawnRootState {
  return {
    rootGoalId: String(row.root_goal_id),
    policyId: String(row.policy_id),
    policyVersion: Number(row.policy_version),
    maxConcurrentChildren: Number(row.max_concurrent_children),
    maxTotalChildCreations: Number(row.max_total_child_creations),
    maxAggregateChildSteps: Number(row.max_aggregate_child_steps),
    maxAggregateChildCost: Number(row.max_aggregate_child_cost),
    activeChildren: Number(row.active_children),
    totalChildCreations: Number(row.total_child_creations),
    reservedChildSteps: Number(row.reserved_child_steps),
    reservedChildCost: Number(row.reserved_child_cost),
    depth: Number(row.depth),
    cancellation: row.cancellation as AgentModeSpawnRootState['cancellation'],
    deadline: String(row.deadline),
    delegableCapabilities: parseStringArray(row.delegable_capabilities_json),
    repositoryScopes: parseStringArray(row.repository_scopes_json),
    resourceScopes: parseStringArray(row.resource_scopes_json),
    updatedAt: String(row.updated_at),
  };
}

function mapChildAssignmentRow(row: Record<string, unknown>): AgentModeChildAssignment {
  return {
    assignmentIntentKey: String(row.assignment_intent_key),
    assignmentId: String(row.assignment_id),
    childAgentId: String(row.child_agent_id),
    rootGoalId: String(row.root_goal_id),
    sourceEventId: String(row.source_event_id),
    taskSpecRef: String(row.task_spec_ref),
    taskId: String(row.task_id),
    runId: String(row.run_id),
    attemptId: String(row.attempt_id),
    runtimeRef: String(row.runtime_ref),
    runtimeProfileRef: String(row.runtime_profile_ref),
    roleTemplateId: String(row.role_template_id),
    roleTemplateVersion: Number(row.role_template_version),
    policyId: String(row.policy_id),
    policyVersion: Number(row.policy_version),
    capabilitySetHash: String(row.capability_set_hash),
    capabilities: parseStringArray(row.capabilities_json),
    repositoryScope: row.repository_scope === null ? null : String(row.repository_scope),
    resourceScope: row.resource_scope === null ? null : String(row.resource_scope),
    requestedSteps: Number(row.requested_steps),
    requestedCost: Number(row.requested_cost),
    requestedTokens: Number(row.requested_tokens ?? 0),
    budgetScopeId: String(row.budget_scope_id),
    reservationId: String(row.reservation_id),
    deadline: String(row.deadline),
    status: row.status as AgentModeChildAssignment['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export type AgentModeEvent = {
  eventId: string;
  sequence?: number;
  entityType: string;
  entityId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type AgentModeSchedulerItemStatus = 'pending' | 'claimed' | 'completed' | 'failed' | 'dead_letter';

export type AgentModeSchedulerEvent = {
  eventId: string;
  eventType: string;
  source: string;
  occurredAt: string;
  receivedAt: string;
  causationId: string | null;
  correlationId: string | null;
  deduplicationKey: string;
  payloadVersion: string;
  payload: Record<string, unknown>;
  status: AgentModeSchedulerItemStatus;
  attemptCount: number;
  nextEligibleAt: string;
  deadline: string | null;
  maxAttempts: number;
  contentHash: string;
  claimOwner: string | null;
  claimFence: number | null;
  claimExpiresAt: string | null;
  lastFailure: string | null;
  lastFailureAt: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
};

export type AgentModeSchedulerSchedule = {
  scheduleId: string;
  kind: string;
  dueAt: string;
  createdAt: string;
  status: AgentModeSchedulerItemStatus;
  deduplicationKey: string;
  causationId: string | null;
  correlationId: string | null;
  payloadVersion: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  nextEligibleAt: string;
  deadline: string | null;
  maxAttempts: number;
  contentHash: string;
  claimOwner: string | null;
  claimFence: number | null;
  claimExpiresAt: string | null;
  lastFailure: string | null;
  lastFailureAt: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
};

export type AgentModeSourceWatermark = { sourceId: string; watermark: string; updatedAt: string };

export type AgentModeEventSourceStatus = 'ready' | 'cooldown' | 'failed' | 'diverged' | 'disabled';

export type AgentModeEventSourceConfig = {
  sourceId: string;
  sourceType: string;
  repositoryRef: string;
  adapterType: 'git.repository.revision' | 'brain.task.lifecycle' | 'infrastructure.host-health' | 'ci.workflow-run';
  debounceWindowMs: number;
  cooldownWindowMs: number;
  catchUpLimit: number;
  enabled: boolean;
  bootstrapWatermark: string | null;
};

const MAX_EVENT_SOURCE_REGISTRATIONS = 16;

export type AgentModeEventSourceState = AgentModeEventSourceConfig & {
  status: AgentModeEventSourceStatus;
  watermark: string | null;
  lastObservedAt: string | null;
  lastSuccessfulObservation: string | null;
  lastErrorReason: string | null;
  cooldownNotBefore: string | null;
  nextEligibleAt: string | null;
  catchUpPending: boolean;
  lastEmittedEventCount: number;
  failureAttemptCount: number;
};

export type AgentModeEventSourceObservationResult = {
  sourceId: string;
  status: 'bootstrapped' | 'advanced' | 'unchanged' | 'cooldown' | 'diverged' | 'failed';
  previousWatermark: string | null;
  observedWatermark: string | null;
  emittedEventCount: number;
  duplicates: number;
  hasMore: boolean;
  observedAt: string;
  errorReason?: string;
};

export type AgentModeSchedulerTickSummary = {
  tickId: string;
  startedAt: string;
  completedAt: string;
  outcome: 'NO_ACTION' | 'PROCESSED' | 'BOUNDED';
  considered: number;
  claimed: number;
  completed: number;
  deferred: number;
  deadLettered: number;
  durationMs: number;
  noOp: boolean;
};

export type AgentModeQueueOperationResult = 'created' | 'duplicate' | 'conflict';

export type AgentModeSchedulerEventInput = Omit<AgentModeSchedulerEvent, 'status' | 'attemptCount' | 'contentHash' | 'claimOwner' | 'claimFence' | 'claimExpiresAt' | 'lastFailure' | 'lastFailureAt' | 'completedAt' | 'deadLetteredAt'>;
export type AgentModeSchedulerScheduleInput = Omit<AgentModeSchedulerSchedule, 'status' | 'attemptCount' | 'contentHash' | 'claimOwner' | 'claimFence' | 'claimExpiresAt' | 'lastFailure' | 'lastFailureAt' | 'completedAt' | 'deadLetteredAt'>;
export type AgentModeSchedulerClaim = { ownerId: string; fence: number; expiresAt: string };
export type AgentModeSchedulerSettlement = { itemType: 'event' | 'schedule'; itemId: string; ownerId: string; fence: number; now: string };
export type AgentModeSchedulerFailure = AgentModeSchedulerSettlement & { reason: string; forceDeadLetter?: boolean };

export type AgentModeSpawnAdmissionControl = {
  scope: 'global' | 'root';
  rootGoalId: string | null;
  denied: boolean;
  reason: string;
  updatedAt: string;
};

export type AgentModeSpawnAdmissionControls = {
  global: AgentModeSpawnAdmissionControl;
  root?: AgentModeSpawnAdmissionControl;
};

function schedulerStableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(schedulerStableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${schedulerStableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function schedulerPayloadJson(payload: Record<string, unknown>): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('scheduler payload must be an object');
  const json = schedulerStableJson(payload);
  if (json.length > 32_768) throw new Error('scheduler payload exceeds 32 KiB');
  const visit = (value: unknown, depth: number): void => {
    if (depth > 6) throw new Error('scheduler payload exceeds maximum depth');
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) value.forEach((entry) => visit(entry, depth + 1));
      else for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (/^(?:command|commands|exec|shell|spawn|script|handler|code|url|path)$/i.test(key)) throw new Error(`scheduler payload key is not permitted: ${key}`);
        visit(entry, depth + 1);
      }
    } else if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('scheduler payload contains a non-finite number');
    } else if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new Error('scheduler payload contains an executable value');
    }
  };
  visit(payload, 0);
  return json;
}

function schedulerContentHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(schedulerStableJson(input)).digest('hex');
}

function ensureSchedulerInput(input: { payloadVersion: string; payload: Record<string, unknown>; maxAttempts: number; nextEligibleAt: string; deadline: string | null }): string {
  if (input.payloadVersion !== 'k4.0') throw new Error('scheduler payloadVersion must be k4.0');
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10) throw new Error('scheduler maxAttempts must be between 1 and 10');
  if (!Number.isFinite(Date.parse(input.nextEligibleAt))) throw new Error('scheduler nextEligibleAt must be an ISO timestamp');
  if (input.deadline !== null && !Number.isFinite(Date.parse(input.deadline))) throw new Error('scheduler deadline must be an ISO timestamp');
  if (input.deadline !== null && input.deadline < input.nextEligibleAt) throw new Error('scheduler deadline must not precede nextEligibleAt');
  return schedulerPayloadJson(input.payload);
}

function ensureSchedulerText(value: string | null, label: string, required = false): void {
  if (required && !value) throw new Error(`scheduler ${label} is required`);
  if (value !== null && value.length > 256) throw new Error(`scheduler ${label} exceeds 256 characters`);
}

export type AgentModeTaskStatus = 'pending' | 'admitted' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type AgentModeRunStatus = 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type AgentModeAttemptStatus = 'created' | 'admitted' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'uncertain' | 'duplicate';

export type AgentModeTask = {
  taskId: string;
  taskType: string;
  inputHash: string;
  createdAt: string;
  status?: AgentModeTaskStatus;
  childAgentId?: string | null;
  assignmentIntentKey?: string | null;
  taskSpecRef?: string | null;
};

export type AgentModeJarvisIntakeRecord = {
  intakeId: string;
  materialHash: string;
  schemaVersion: 1;
  source: 'typed' | 'voice';
  operatorId: string;
  canonicalTextHash: string;
  rootGoalId: string;
  taskId: string;
  jarvisAgentId: string;
  receivedAt: string;
  createdAt: string;
};

export type AgentModeJarvisIntakePersistenceResult =
  | { result: 'created' | 'duplicate'; record: AgentModeJarvisIntakeRecord }
  | { result: 'conflict'; reasonCode: 'JARVIS_INTAKE_CONFLICT' };

export type AgentModeJarvisUserResponseRecord = JarvisUserResponseV1 & {
  materialHash: string;
};

export type AgentModeJarvisUserResponsePersistenceResult =
  | { result: 'created' | 'duplicate'; response: AgentModeJarvisUserResponseRecord }
  | { result: 'conflict' | 'denied'; reasonCode: string };

export type AgentModeJarvisReadableResultPersistenceResult =
  | { result: 'created' | 'duplicate'; resultRecord: JarvisReadableResultV1 }
  | { result: 'conflict' | 'denied'; reasonCode: string };

export type AgentModeRun = {
  runId: string;
  taskId: string;
  agentId: string;
  createdAt: string;
  status?: AgentModeRunStatus;
  runtimePid?: number;
  runtimeIdentity?: RuntimeProcessIdentity;
  childAgentId?: string | null;
  assignmentIntentKey?: string | null;
};

export type AgentModeBudgetLimits = {
  budgetScopeId: string;
  maxSteps: number;
  maxTokens: number;
  maxDollars: number;
};

export type AgentModeBudgetState = AgentModeBudgetLimits & {
  usedSteps: number;
  reservedSteps: number;
  usedTokens: number;
  reservedTokens: number;
  usedDollars: number;
  reservedDollars: number;
};

export type AgentModeBudgetEstimate = {
  steps: number;
  tokens: number;
  dollars: number;
};

export type AgentModeBudgetReservation = AgentModeBudgetEstimate & {
  reservationId: string;
  budgetScopeId: string;
  attemptId: string;
  status: 'reserved' | 'settled';
  createdAt: string;
  settledAt?: string;
  settledSteps?: number;
  settledTokens?: number;
  settledDollars?: number;
};

export type AgentModeBudgetSettlement = AgentModeBudgetEstimate & {
  reservationId: string;
  settledAt: string;
};

export type AgentModeAttempt = {
  attemptId: string;
  runId: string;
  agentId: string;
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  policyVersion: string;
  capabilityScopeHash: string;
  budgetScopeId: string;
  reservationId?: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseOwnerId?: string;
  leaseFence?: number;
  status: AgentModeAttemptStatus;
  cancellationStatus: 'running' | 'requested' | 'acknowledged' | 'completed';
  cancellationRequestedAt?: string;
  cancellationAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
  runtimeProfileRef?: string;
  childAgentId?: string | null;
  assignmentIntentKey?: string | null;
};

export type AgentModeAttemptInput = {
  attemptId: string;
  runId: string;
  agentId: string;
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  policyVersion: string;
  capabilityScopeHash: string;
  budgetScopeId: string;
  createdAt: string;
  updatedAt?: string;
  runtimeProfileRef?: string;
  childAgentId?: string | null;
  assignmentIntentKey?: string | null;
};

export type AgentModeLease = {
  leaseId: string;
  resourceKey: string;
  ownerId: string;
  fence: number;
  expiresAt: string;
};

export type AgentModeEffect = {
  operationId: string;
  attemptId: string;
  effectKind: string;
  scopeHash: string;
  status: 'reserved' | 'prepared' | 'dispatchable' | 'dispatched' | 'effect_applied' | 'receipt_recorded' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain';
  receiptJson?: string;
  capabilityId?: string;
  grantId?: string;
  policyVersion?: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline?: string;
  preparedAt?: string;
  dispatchedAt?: string;
  observedAt?: string;
  dispatchId?: string;
  assignmentIntentKey?: string;
  childAgentId?: string;
  runtimeRef?: string;
  runtimeProfileRef?: string;
  controllerRef?: string;
};

export type AgentModeDispatchState = 'dispatchable' | 'dispatched' | 'effect_applied' | 'receipt_recorded' | 'verified' | 'failed' | 'cancelled' | 'uncertain';

export type AgentModeDispatchOutbox = {
  operationId: string;
  attemptId: string;
  effectKind: EffectKind | string;
  capabilityId: string;
  grantId?: string;
  scopeHash: string;
  policyVersion: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline: string;
  state: AgentModeDispatchState;
  preparedAt: string;
  dispatchedAt?: string;
  dispatchId?: string;
  assignmentIntentKey?: string;
  childAgentId?: string;
  runtimeRef?: string;
  runtimeProfileRef?: string;
  controllerRef?: string;
};

export type AgentModeReceiptState = 'accepted' | 'conflict' | 'stale';

export type AgentModeJournalReceipt = OperationReceipt & {
  receiptId: string;
  state: AgentModeReceiptState;
};

export type AgentModeAdmission = {
  task: AgentModeTask;
  run: AgentModeRun;
  attempt: AgentModeAttemptInput;
  budget: AgentModeBudgetLimits;
  estimate: AgentModeBudgetEstimate & { reservationId: string };
  lease: Omit<AgentModeLease, 'fence'>;
  now: string;
  eventId?: string;
};

export type AgentModePreparedOperation = {
  operationId: string;
  attemptId: string;
  effectKind: EffectKind | string;
  capabilityId: string;
  grantId?: string;
  scopeHash: string;
  policyVersion: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline: string;
  preparedAt: string;
};

export type AgentModeRecoveryClassification =
  | 'safe_to_resume'
  | 'already_completed'
  | 'duplicate'
  | 'stale_fenced_writer'
  | 'awaiting_receipt_reconciliation'
  | 'uncertain_non_idempotent_effect'
  | 'cancelled_ack_pending'
  | 'terminal_failure';

export type AgentModePersistenceFailurePoint = 'admission' | 'effect-preparation' | 'receipt' | 'budget-settlement';
export type AgentModeSpawnReadFailurePoint = 'kill-switch' | 'root-lookup' | 'parent-lookup' | 'cancellation' | 'budget';
export type AgentModeChildAssignmentReadFailurePoint = 'child' | 'root' | 'cancellation' | 'kill-switch' | 'allocation' | 'runtime-profile';

export type AgentModeOperationResult = 'created' | 'duplicate' | 'conflict';

export type AgentModeReAdmission = {
  runtimePid: number;
  runtimeIdentity: RuntimeProcessIdentity;
  lease: Omit<AgentModeLease, 'fence'>;
  now: string;
  accessEvidenceValid: boolean;
};

export type AgentModeCancellationRequest = {
  requestId: string;
  attemptId: string;
  requestedAt: string;
};

export type AgentModeVerification = {
  resultHash: string;
  evidenceRef: string;
  verifiedAt: string;
};

export type AgentModeWorkcellStatus =
  | 'created'
  | 'prepared'
  | 'active'
  | 'testing'
  | 'awaiting_review'
  | 'approved'
  | 'committing'
  | 'committed'
  | 'merged'
  | 'discarded'
  | 'failed';

export type AgentModeWorkcell = {
  workcellId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  repositoryRef: string;
  repositoryRoot: string;
  worktreePath: string;
  branch: string;
  ownerAgent: string;
  baseRef: string;
  createdAt: string;
  updatedAt: string;
  status: AgentModeWorkcellStatus;
};

export type AgentModeWorkcellReceiptType =
  | 'WorkcellCreatedReceipt'
  | 'WorkcellPreparedReceipt'
  | 'WorkcellDestroyedReceipt'
  | 'ValidationReceipt'
  | 'WorkcellCommitReceipt';

export type AgentModeWorkcellReceipt = {
  receiptId: string;
  receiptType: AgentModeWorkcellReceiptType;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  actor: string;
  timestamp: string;
  operationHash: string;
  operation: 'create' | 'prepare' | 'inspect' | 'destroy' | 'recover' | 'commit';
  resultState: AgentModeWorkcellStatus | 'valid' | 'invalid' | 'stale';
};

export type AgentModeWriterLeaseStatus = 'active' | 'expired' | 'released' | 'revoked';

export type AgentModeWriterLease = {
  leaseId: string;
  workcellId: string;
  ownerAgent: string;
  ownerAttempt: string;
  createdAt: string;
  expiresAt: string;
  fenceToken: number;
  status: AgentModeWriterLeaseStatus;
};

export type AgentModeWriterReceiptType =
  | 'WriterLeaseGrantedReceipt'
  | 'WriterLeaseReleasedReceipt'
  | 'WriteRejectedReceipt'
  | 'DiffCapturedReceipt'
  | 'ValidationAdmissionReceipt';

export type AgentModeWriterReceipt = {
  receiptId: string;
  receiptType: AgentModeWriterReceiptType;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  leaseId: string | null;
  fenceToken: number | null;
  timestamp: string;
  operationHash: string;
  resultState: string;
};

export type AgentModeWorkcellDiffEvidence = {
  diffId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  branch: string;
  baseRevision: string;
  currentRevision: string;
  changedFiles: string[];
  diffHash: string;
  leaseId: string;
  fenceToken: number;
  capturedAt: string;
};

export type AgentModeWorkcellValidationEvidence = {
  validationId: string;
  diffId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  requestedAt: string;
  result: 'passed' | 'failed' | 'unknown';
  state: 'validation_ready' | 'rejected';
  recordedAt: string;
};

export type AgentModeWorkcellMutationStatus =
  | 'prepared'
  | 'preimage_verified'
  | 'temp_prepared'
  | 'effect_applied'
  | 'receipt_recorded'
  | 'reconciled'
  | 'rejected';

export type AgentModeWorkcellMutation = {
  operationId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  relativePath: string;
  leaseId: string;
  fenceToken: number;
  expectedPreimageHash: string;
  preimageState: 'present';
  preimageHash: string | undefined;
  replacementHash: string;
  postimageHash: string | undefined;
  operationHash: string;
  status: AgentModeWorkcellMutationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentModeWorkcellWriteReceiptType =
  | 'WorkcellWriteAppliedReceipt'
  | 'WorkcellWriteRejectedReceipt'
  | 'WorkcellWriteReconciledReceipt';

export type AgentModeWorkcellWriteReceipt = {
  receiptId: string;
  receiptType: AgentModeWorkcellWriteReceiptType;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  operationId: string;
  leaseId: string;
  fenceToken: number;
  repositoryRef: string;
  relativePath: string;
  preimageHash: string;
  postimageHash: string | null;
  timestamp: string;
  result: string;
  operationHash: string;
};

export type AgentModeWorkcellValidationStatus = 'started' | 'completed' | 'rejected';

export type AgentModeWorkcellValidationResult = 'started' | 'passed' | 'failed' | 'rejected' | 'timed_out' | 'interrupted';

export type AgentModeWorkcellValidation = {
  validationId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  validatorProfile: string;
  diffId: string | null;
  leaseId: string;
  fenceToken: number;
  operationHash: string;
  status: AgentModeWorkcellValidationStatus;
  result: AgentModeWorkcellValidationResult;
  evidenceHash: string | undefined;
  evidenceJson: string | undefined;
  startedAt: string;
  completedAt: string | undefined;
  updatedAt: string;
};

export type AgentModeWorkcellValidationReceiptType =
  | 'ValidationStartedReceipt'
  | 'ValidationCompletedReceipt'
  | 'ValidationRejectedReceipt';

export type AgentModeWorkcellValidationReceipt = {
  receiptId: string;
  receiptType: AgentModeWorkcellValidationReceiptType;
  validationId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  validatorProfile: string;
  evidenceHash: string | null;
  timestamp: string;
  result: AgentModeWorkcellValidationResult;
  operationHash: string;
};

export type AgentModeReviewRequest = {
  reviewId: string;
  workcellId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workerAgentId: string;
  repositoryRef: string;
  branch: string;
  baseRevision: string;
  currentRevision: string;
  diffId: string;
  diffHash: string;
  validationId: string;
  validationEvidenceHash: string;
  requestingActor: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'stale';
};

export type AgentModeReviewDecision = {
  decisionId: string;
  reviewId: string;
  decision: 'approved' | 'rejected';
  reviewer: string;
  decidedAt: string;
  reason: string;
  evidenceHash: string;
};

export type AgentModeReviewReceiptType =
  | 'ReviewRequestedReceipt'
  | 'ReviewApprovedReceipt'
  | 'ReviewRejectedReceipt';

export type AgentModeReviewReceipt = {
  receiptId: string;
  receiptType: AgentModeReviewReceiptType;
  reviewId: string;
  decisionId?: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  workerAgentId: string;
  diffHash: string;
  validationEvidenceHash: string;
  reviewer: string;
  timestamp: string;
  operationHash: string;
};

export type AgentModeTargetRefLease = {
  leaseId: string;
  repositoryRef: string;
  targetRef: string;
  ownerOperation: string;
  fenceToken: number;
  expectedTargetHead: string;
  expiresAt: string;
  status: 'active' | 'released' | 'consumed' | 'expired';
};

export type AgentModeCommitOperation = {
  operationId: string;
  workcellId: string;
  repositoryRef: string;
  branch: string;
  parentCommit: string;
  resultingCommit?: string;
  approvedDiffHash: string;
  validationEvidenceHash: string;
  reviewId: string;
  actor: string;
  message: string;
  createdAt: string;
  status: 'prepared' | 'committed' | 'reconciled' | 'rejected';
  resultingTreeRevision?: string;
  receiptHash?: string;
  reason?: string;
};

export type AgentModeCommitReceiptType =
  | 'CommitRequestedReceipt'
  | 'CommitCompletedReceipt'
  | 'CommitRejectedReceipt'
  | 'CommitReconciledReceipt';

export type AgentModeCommitReceipt = {
  receiptId: string;
  receiptType: AgentModeCommitReceiptType;
  operationId: string;
  workcellId: string;
  branch: string;
  parentCommit: string | null;
  resultingCommit: string | null;
  diffHash: string;
  validationEvidenceHash: string;
  reviewId: string;
  actor: string;
  timestamp: string;
  operationHash: string;
  result: 'requested' | 'completed' | 'rejected' | 'reconciled';
};

export type AgentModeMergeApproval = {
  approvalId: string;
  repositoryRef: string;
  sourceWorkcellId: string;
  sourceBranch: string;
  sourceCommit: string;
  reviewId: string;
  diffHash: string;
  validationId: string;
  validationEvidenceHash: string;
  targetRef: string;
  expectedTargetHead: string;
  approver: string;
  createdAt: string;
  expiresAt: string;
  operationId: string;
  status: 'pending' | 'consumed' | 'rejected' | 'expired' | 'stale';
};

export type AgentModeMergeOperation = {
  operationId: string;
  approvalId: string;
  repositoryRef: string;
  sourceWorkcellId: string;
  sourceBranch: string;
  sourceCommit: string;
  reviewId: string;
  validationId: string;
  targetRef: string;
  expectedTargetHead: string;
  targetFenceToken: number;
  resultingTargetHead?: string;
  actor: string;
  createdAt: string;
  status: 'prepared' | 'merged' | 'reconciled' | 'rejected';
  receiptHash?: string;
  reason?: string;
};

export type AgentModeMergeReceiptType =
  | 'MergeRequestedReceipt'
  | 'MergeCompletedReceipt'
  | 'MergeRejectedReceipt'
  | 'MergeReconciledReceipt';

export type AgentModeMergeReceipt = {
  receiptId: string;
  receiptType: AgentModeMergeReceiptType;
  operationId: string;
  approvalId: string;
  workcellId: string;
  sourceCommit: string | null;
  targetRef: string;
  targetBefore: string | null;
  targetAfter: string | null;
  reviewId: string;
  validationId: string;
  actor: string;
  timestamp: string;
  operationHash: string;
  result: 'requested' | 'completed' | 'rejected' | 'reconciled';
};

function receiptIdFor(receipt: OperationReceipt): string {
  return `receipt:${createHash('sha256').update(JSON.stringify({
    operationId: receipt.operationId,
    attemptId: receipt.attemptId,
    scopeHash: receipt.scopeHash,
    effectHash: receipt.effectHash,
    status: receipt.status,
  })).digest('hex')}`;
}

function runtimeResultFromReceipt(receipt: AgentModeRuntimeReceipt): AgentRuntimeResult {
  return {
    status: receipt.status,
    runtimeReceiptId: receipt.receiptId,
    resultHash: receipt.resultHash,
    evidenceRef: receipt.evidenceRef,
    usage: receipt.usage,
    traceSummary: receipt.traceSummary,
    ...(receipt.failureCode === undefined ? {} : { failureCode: receipt.failureCode }),
    ...(receipt.cancellationObserved === undefined ? {} : { cancellationObserved: receipt.cancellationObserved }),
  };
}

function writerOperationHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function makeWriterReceipt(
  workcell: AgentModeWorkcell,
  receiptType: AgentModeWriterReceiptType,
  operation: string,
  timestamp: string,
  resultState: string,
  leaseId: string | null,
  fenceToken: number | null,
  extra: Record<string, unknown> = {},
): AgentModeWriterReceipt {
  const operationHash = writerOperationHash({ receiptType, operation, workcellId: workcell.workcellId, leaseId, fenceToken, resultState, ...extra });
  return {
    receiptId: `workcell-writer-receipt:${operationHash}`,
    receiptType,
    taskId: workcell.taskId,
    runId: workcell.runId,
    attemptId: workcell.attemptId,
    workcellId: workcell.workcellId,
    leaseId,
    fenceToken,
    timestamp,
    operationHash,
    resultState,
  };
}

function makeWorkcellWriteReceipt(
  workcell: AgentModeWorkcell,
  input: Pick<AgentModeWorkcellWriteReceipt, 'operationId' | 'leaseId' | 'fenceToken' | 'relativePath' | 'preimageHash' | 'postimageHash' | 'timestamp' | 'result' | 'operationHash'>,
  receiptType: AgentModeWorkcellWriteReceiptType,
): AgentModeWorkcellWriteReceipt {
  return {
    receiptId: `workcell-write-receipt:${input.operationId}:${input.operationHash}:${receiptType}`,
    receiptType,
    taskId: workcell.taskId,
    runId: workcell.runId,
    attemptId: workcell.attemptId,
    workcellId: workcell.workcellId,
    operationId: input.operationId,
    leaseId: input.leaseId,
    fenceToken: input.fenceToken,
    repositoryRef: workcell.repositoryRef,
    relativePath: input.relativePath,
    preimageHash: input.preimageHash,
    postimageHash: input.postimageHash,
    timestamp: input.timestamp,
    result: input.result,
    operationHash: input.operationHash,
  };
}

function makeValidationReceipt(
  validation: AgentModeWorkcellValidation,
  receiptType: AgentModeWorkcellValidationReceiptType,
  timestamp: string,
  result: AgentModeWorkcellValidationResult,
): AgentModeWorkcellValidationReceipt {
  return {
    receiptId: `workcell-validation-receipt:${validation.validationId}:${receiptType}:${result}`,
    receiptType,
    validationId: validation.validationId,
    taskId: validation.taskId,
    runId: validation.runId,
    attemptId: validation.attemptId,
    workcellId: validation.workcellId,
    validatorProfile: validation.validatorProfile,
    evidenceHash: validation.evidenceHash ?? null,
    timestamp,
    result,
    operationHash: validation.operationHash,
  };
}

function makeReviewReceipt(
  request: AgentModeReviewRequest,
  receiptType: AgentModeReviewReceiptType,
  reviewer: string,
  timestamp: string,
  decisionId?: string,
): AgentModeReviewReceipt {
  const operationHash = writerOperationHash({
    receiptType,
    reviewId: request.reviewId,
    decisionId: decisionId ?? null,
    taskId: request.taskId,
    runId: request.runId,
    attemptId: request.attemptId,
    workcellId: request.workcellId,
    workerAgentId: request.workerAgentId,
    diffHash: request.diffHash,
    validationEvidenceHash: request.validationEvidenceHash,
    reviewer,
    timestamp,
  });
  return {
    receiptId: `agent-mode-review-receipt:${request.reviewId}:${receiptType}:${decisionId ?? 'request'}`,
    receiptType,
    reviewId: request.reviewId,
    ...(decisionId ? { decisionId } : {}),
    taskId: request.taskId,
    runId: request.runId,
    attemptId: request.attemptId,
    workcellId: request.workcellId,
    workerAgentId: request.workerAgentId,
    diffHash: request.diffHash,
    validationEvidenceHash: request.validationEvidenceHash,
    reviewer,
    timestamp,
    operationHash,
  };
}

function makeCommitReceipt(
  operation: AgentModeCommitOperation,
  receiptType: AgentModeCommitReceiptType,
  result: AgentModeCommitReceipt['result'],
  timestamp: string,
): AgentModeCommitReceipt {
  const operationHash = writerOperationHash({
    receiptType,
    operationId: operation.operationId,
    workcellId: operation.workcellId,
    branch: operation.branch,
    parentCommit: operation.parentCommit,
    resultingCommit: operation.resultingCommit ?? null,
    diffHash: operation.approvedDiffHash,
    validationEvidenceHash: operation.validationEvidenceHash,
    reviewId: operation.reviewId,
    actor: operation.actor,
    timestamp,
    result,
  });
  return {
    receiptId: `agent-mode-commit-receipt:${operation.operationId}:${receiptType}`,
    receiptType,
    operationId: operation.operationId,
    workcellId: operation.workcellId,
    branch: operation.branch,
    parentCommit: operation.parentCommit,
    resultingCommit: operation.resultingCommit ?? null,
    diffHash: operation.approvedDiffHash,
    validationEvidenceHash: operation.validationEvidenceHash,
    reviewId: operation.reviewId,
    actor: operation.actor,
    timestamp,
    operationHash,
    result,
  };
}

function makeMergeReceipt(
  operation: AgentModeMergeOperation,
  receiptType: AgentModeMergeReceiptType,
  result: AgentModeMergeReceipt['result'],
  timestamp: string,
): AgentModeMergeReceipt {
  const operationHash = writerOperationHash({
    receiptType,
    operationId: operation.operationId,
    approvalId: operation.approvalId,
    workcellId: operation.sourceWorkcellId,
    sourceCommit: operation.sourceCommit,
    targetRef: operation.targetRef,
    targetFenceToken: operation.targetFenceToken,
    targetBefore: operation.expectedTargetHead,
    targetAfter: operation.resultingTargetHead ?? null,
    reviewId: operation.reviewId,
    validationId: operation.validationId,
    actor: operation.actor,
    timestamp,
    result,
  });
  return {
    receiptId: `agent-mode-merge-receipt:${operation.operationId}:${receiptType}`,
    receiptType,
    operationId: operation.operationId,
    approvalId: operation.approvalId,
    workcellId: operation.sourceWorkcellId,
    sourceCommit: operation.sourceCommit,
    targetRef: operation.targetRef,
    targetBefore: operation.expectedTargetHead,
    targetAfter: operation.resultingTargetHead ?? null,
    reviewId: operation.reviewId,
    validationId: operation.validationId,
    actor: operation.actor,
    timestamp,
    operationHash,
    result,
  };
}

export function defaultAgentModeDatabasePath(): string {
  return loadBrainRuntimeConfig().stateStore.path;
}

export type AgentModePortableRecordFamily = {
  family: string;
  records: Array<Record<string, unknown>>;
};

/**
 * SQLite StateStore for the fixture-backed K0 kernel.
 *
 * This is intentionally a domain-specific store, not a generic CRUD wrapper.
 * Transactions own event/effect/lease invariants; callers must not mutate the
 * SQLite file or use an ad-hoc lock as a second authority.
 */
export class AgentModeSqliteStateStore {
  readonly databasePath: string;
  private readonly database: DatabaseSync;
  private transactionDepth = 0;
  private readonly injectedFailures = new Set<AgentModePersistenceFailurePoint>();
  private readonly injectedSpawnReadFailures = new Set<AgentModeSpawnReadFailurePoint>();
  private readonly injectedChildAssignmentReadFailures = new Set<AgentModeChildAssignmentReadFailurePoint>();

  private readonly readOnly: boolean;
  private readonly hasRuntimePidColumn: boolean;
  private readonly hasRuntimeIdentityColumns: boolean;
  private readonly hasWorkcellTables: boolean;
  private readonly hasWriterTables: boolean;
  private readonly hasMutationTables: boolean;
  private readonly hasValidationTables: boolean;
  private readonly hasPromotionTables: boolean;
  private readonly hasReviewReceiptTables: boolean;
  private readonly hasCommitReceiptTables: boolean;
  private readonly hasMergeReceiptTables: boolean;
  private readonly hasSchedulerTables: boolean;
  private readonly hasEventSourceTables: boolean;
  private readonly hasSpawnAdmissionControlTables: boolean;
  private readonly hasChildAssignmentTables: boolean;
  private readonly hasOrganizationTables: boolean;
  private readonly hasAttentionTables: boolean;
  private readonly hasJarvisIntakeTables: boolean;
  private readonly hasJarvisResponseSourceTables: boolean;
  private readonly hasJarvisUserResponseTables: boolean;

  constructor(databasePath = defaultAgentModeDatabasePath(), options: { readOnly?: boolean } = {}) {
    this.databasePath = databasePath;
    this.readOnly = options.readOnly ?? false;
    if (!this.readOnly && databasePath !== ':memory:') mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath, { readOnly: this.readOnly });
    if (this.readOnly) {
      this.hasRuntimePidColumn = this.tableHasColumn('runs', 'runtime_pid');
      this.hasRuntimeIdentityColumns = this.tableHasColumn('runs', 'runtime_started_at')
        && this.tableHasColumn('runs', 'runtime_command')
        && this.tableHasColumn('runs', 'runtime_identity');
      this.hasWorkcellTables = this.tableExists('workcells') && this.tableExists('workcell_receipts');
      this.hasWriterTables = this.tableExists('workcell_writer_leases')
        && this.tableExists('workcell_writer_receipts')
        && this.tableExists('workcell_diff_evidence')
        && this.tableExists('workcell_validation_evidence');
      this.hasMutationTables = this.tableExists('workcell_file_mutations')
        && this.tableExists('workcell_write_receipts');
      this.hasValidationTables = this.tableExists('workcell_validations')
        && this.tableExists('workcell_validation_receipts');
      this.hasPromotionTables = this.tableExists('agent_mode_review_requests')
        && this.tableExists('agent_mode_review_decisions')
        && this.tableExists('agent_mode_target_ref_leases')
        && this.tableExists('agent_mode_commit_operations')
        && this.tableExists('agent_mode_merge_approvals')
        && this.tableExists('agent_mode_merge_operations');
      this.hasReviewReceiptTables = this.tableExists('agent_mode_review_receipts');
      this.hasCommitReceiptTables = this.tableExists('agent_mode_commit_receipts');
      this.hasMergeReceiptTables = this.tableExists('agent_mode_merge_receipts');
      this.hasSchedulerTables = this.tableExists('agent_mode_scheduler_events')
        && this.tableExists('agent_mode_scheduler_schedules')
        && this.tableExists('agent_mode_source_watermarks')
        && this.tableExists('agent_mode_scheduler_observer');
      this.hasEventSourceTables = this.tableExists('agent_mode_event_sources');
      this.hasSpawnAdmissionControlTables = this.tableExists('agent_mode_spawn_admission_controls');
      this.hasChildAssignmentTables = this.tableExists('agent_mode_child_assignments');
      this.hasOrganizationTables = this.tableExists('agent_mode_organization_plans')
        && this.tableExists('agent_mode_organization_work_items')
        && this.tableExists('agent_mode_organization_dependencies');
      this.hasAttentionTables = this.tableExists('agent_mode_escalations')
        && this.tableExists('agent_mode_notifications')
        && this.tableExists('agent_mode_notification_reads');
      this.hasJarvisIntakeTables = this.tableExists('agent_mode_jarvis_intakes');
      this.hasJarvisResponseSourceTables = this.tableExists('agent_mode_jarvis_task_inputs') && this.tableExists('agent_mode_jarvis_readable_results');
      this.hasJarvisUserResponseTables = this.tableExists('agent_mode_jarvis_user_responses');
      return;
    }
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA busy_timeout = 5000;');
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec('PRAGMA synchronous = NORMAL;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS store_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agents (
        agent_id TEXT PRIMARY KEY,
        agent_kind TEXT NOT NULL,
        role TEXT NOT NULL,
        display_name TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        status TEXT NOT NULL,
        role_template_id TEXT,
        role_template_version INTEGER,
        policy_version INTEGER,
        parent_agent_id TEXT,
        parent_task_id TEXT,
        parent_run_id TEXT,
        root_goal_id TEXT,
        spawn_intent_key TEXT UNIQUE,
        source_event_id TEXT,
        spawn_depth INTEGER CHECK (spawn_depth IS NULL OR spawn_depth >= 0),
        repository_scope TEXT,
        resource_scope TEXT,
        capability_set_hash TEXT,
        capabilities_json TEXT,
        requested_child_steps INTEGER CHECK (requested_child_steps IS NULL OR requested_child_steps >= 0),
        reserved_child_steps INTEGER CHECK (reserved_child_steps IS NULL OR reserved_child_steps >= 0),
        requested_child_cost REAL CHECK (requested_child_cost IS NULL OR requested_child_cost >= 0),
        reserved_child_cost REAL CHECK (reserved_child_cost IS NULL OR reserved_child_cost >= 0),
        child_created_at TEXT,
        expires_at TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_mode_spawn_roots (
        root_goal_id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL CHECK (policy_version > 0),
        max_concurrent_children INTEGER NOT NULL CHECK (max_concurrent_children >= 0),
        max_total_child_creations INTEGER NOT NULL CHECK (max_total_child_creations >= 0),
        max_aggregate_child_steps INTEGER NOT NULL CHECK (max_aggregate_child_steps >= 0),
        max_aggregate_child_cost REAL NOT NULL CHECK (max_aggregate_child_cost >= 0),
        active_children INTEGER NOT NULL DEFAULT 0 CHECK (active_children >= 0),
        total_child_creations INTEGER NOT NULL DEFAULT 0 CHECK (total_child_creations >= 0),
        reserved_child_steps INTEGER NOT NULL DEFAULT 0 CHECK (reserved_child_steps >= 0),
        reserved_child_cost REAL NOT NULL DEFAULT 0 CHECK (reserved_child_cost >= 0),
        depth INTEGER NOT NULL CHECK (depth >= 0),
        cancellation TEXT NOT NULL CHECK (cancellation IN ('active', 'requested', 'cancelled')),
        deadline TEXT NOT NULL,
        delegable_capabilities_json TEXT NOT NULL,
        repository_scopes_json TEXT NOT NULL,
        resource_scopes_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_spawn_receipts (
        spawn_intent_key TEXT PRIMARY KEY,
        child_agent_id TEXT NOT NULL UNIQUE REFERENCES agents(agent_id),
        immutable_material_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        sequence INTEGER,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leases (
        resource_key TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        fence INTEGER NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS effects (
        operation_id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL,
        effect_kind TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        receipt_json TEXT,
        grant_id TEXT,
        dispatch_id TEXT,
        assignment_intent_key TEXT,
        child_agent_id TEXT,
        runtime_ref TEXT,
        runtime_profile_ref TEXT,
        controller_ref TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        child_agent_id TEXT,
        assignment_intent_key TEXT,
        task_spec_ref TEXT
      );
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(task_id),
        agent_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        runtime_pid INTEGER,
        runtime_started_at TEXT,
        runtime_command TEXT,
        runtime_identity TEXT,
        child_agent_id TEXT,
        assignment_intent_key TEXT
      );
      CREATE TABLE IF NOT EXISTS attempts (
        attempt_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(run_id),
        agent_id TEXT NOT NULL,
        runtime_ref TEXT NOT NULL,
        route_ref TEXT NOT NULL,
        model_ref TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        capability_scope_hash TEXT NOT NULL,
        budget_scope_id TEXT NOT NULL,
        reservation_id TEXT,
        lease_resource_key TEXT,
        lease_id TEXT,
        lease_owner_id TEXT,
        lease_fence INTEGER,
        status TEXT NOT NULL,
        cancellation_status TEXT NOT NULL,
        cancellation_requested_at TEXT,
        cancellation_acknowledged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        runtime_profile_ref TEXT,
        child_agent_id TEXT,
        assignment_intent_key TEXT
      );
      CREATE TABLE IF NOT EXISTS budget_scopes (
        budget_scope_id TEXT PRIMARY KEY,
        max_steps INTEGER NOT NULL CHECK (max_steps >= 0),
        used_steps INTEGER NOT NULL DEFAULT 0 CHECK (used_steps >= 0),
        reserved_steps INTEGER NOT NULL DEFAULT 0 CHECK (reserved_steps >= 0),
        max_tokens INTEGER NOT NULL CHECK (max_tokens >= 0),
        used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
        reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
        max_dollars REAL NOT NULL CHECK (max_dollars >= 0),
        used_dollars REAL NOT NULL DEFAULT 0 CHECK (used_dollars >= 0),
        reserved_dollars REAL NOT NULL DEFAULT 0 CHECK (reserved_dollars >= 0)
      );
      CREATE TABLE IF NOT EXISTS budget_reservations (
        reservation_id TEXT PRIMARY KEY,
        budget_scope_id TEXT NOT NULL REFERENCES budget_scopes(budget_scope_id),
        attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
        steps INTEGER NOT NULL CHECK (steps >= 0),
        tokens INTEGER NOT NULL CHECK (tokens >= 0),
        dollars REAL NOT NULL CHECK (dollars >= 0),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        settled_at TEXT,
        settled_steps INTEGER,
        settled_tokens INTEGER,
        settled_dollars REAL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_child_assignments (
        assignment_intent_key TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        assignment_id TEXT NOT NULL UNIQUE,
        child_agent_id TEXT NOT NULL UNIQUE REFERENCES agents(agent_id),
        root_goal_id TEXT NOT NULL,
        source_event_id TEXT NOT NULL,
        task_spec_ref TEXT NOT NULL,
        task_id TEXT NOT NULL UNIQUE REFERENCES tasks(task_id),
        run_id TEXT NOT NULL UNIQUE REFERENCES runs(run_id),
        attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
        runtime_ref TEXT NOT NULL,
        runtime_profile_ref TEXT NOT NULL,
        role_template_id TEXT NOT NULL,
        role_template_version INTEGER NOT NULL,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        capability_set_hash TEXT NOT NULL,
        capabilities_json TEXT NOT NULL,
        repository_scope TEXT,
        resource_scope TEXT,
        requested_steps INTEGER NOT NULL CHECK (requested_steps >= 0),
        requested_cost REAL NOT NULL CHECK (requested_cost >= 0),
        requested_tokens INTEGER NOT NULL DEFAULT 0 CHECK (requested_tokens >= 0),
        budget_scope_id TEXT NOT NULL,
        reservation_id TEXT NOT NULL UNIQUE REFERENCES budget_reservations(reservation_id),
        deadline TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('dispatch_ready', 'running', 'completed', 'failed', 'cancelled', 'expired', 'uncertain')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dispatch_outbox (
        operation_id TEXT PRIMARY KEY REFERENCES effects(operation_id),
        attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
        effect_kind TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        grant_id TEXT,
        scope_hash TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        lease_resource_key TEXT,
        lease_id TEXT,
        lease_fence INTEGER,
        deadline TEXT NOT NULL,
        state TEXT NOT NULL,
        prepared_at TEXT NOT NULL,
        dispatched_at TEXT,
        dispatch_id TEXT,
        assignment_intent_key TEXT,
        child_agent_id TEXT,
        runtime_ref TEXT,
        runtime_profile_ref TEXT,
        controller_ref TEXT
      );
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL REFERENCES effects(operation_id),
        attempt_id TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        effect_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cancellation_requests (
        request_id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
        requested_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcells (
        workcell_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        repository_ref TEXT NOT NULL,
        repository_root TEXT NOT NULL,
        worktree_path TEXT NOT NULL UNIQUE,
        branch TEXT NOT NULL UNIQUE,
        owner_agent TEXT NOT NULL,
        base_ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_receipts (
        receipt_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        receipt_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        repository_ref TEXT NOT NULL,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        operation TEXT NOT NULL,
        result_state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_writer_leases (
        lease_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        owner_agent TEXT NOT NULL,
        owner_attempt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        fence_token INTEGER NOT NULL CHECK (fence_token > 0),
        status TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS workcell_one_active_writer
        ON workcell_writer_leases (workcell_id) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS workcell_writer_receipts (
        receipt_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        receipt_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        lease_id TEXT,
        fence_token INTEGER,
        timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        result_state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_diff_evidence (
        diff_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL,
        branch TEXT NOT NULL,
        base_revision TEXT NOT NULL,
        current_revision TEXT NOT NULL,
        changed_files_json TEXT NOT NULL,
        diff_hash TEXT NOT NULL,
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        captured_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_validation_evidence (
        validation_id TEXT PRIMARY KEY,
        diff_id TEXT NOT NULL REFERENCES workcell_diff_evidence(diff_id),
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        requested_at TEXT NOT NULL,
        result TEXT NOT NULL,
        state TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_file_mutations (
        operation_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        expected_preimage_hash TEXT NOT NULL,
        preimage_state TEXT NOT NULL,
        preimage_hash TEXT,
        replacement_hash TEXT NOT NULL,
        postimage_hash TEXT,
        operation_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_write_receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL REFERENCES workcell_file_mutations(operation_id),
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        repository_ref TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        preimage_hash TEXT NOT NULL,
        postimage_hash TEXT,
        timestamp TEXT NOT NULL,
        result TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workcell_write_receipts_by_operation
        ON workcell_write_receipts (operation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS workcell_validations (
        validation_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL,
        validator_profile TEXT NOT NULL,
        diff_id TEXT,
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        operation_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        result TEXT NOT NULL,
        evidence_hash TEXT,
        evidence_json TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_validation_receipts (
        receipt_id TEXT PRIMARY KEY,
        validation_id TEXT NOT NULL REFERENCES workcell_validations(validation_id),
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        validator_profile TEXT NOT NULL,
        evidence_hash TEXT,
        timestamp TEXT NOT NULL,
        result TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workcell_validation_receipts_by_validation
        ON workcell_validation_receipts (validation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_review_requests (
        review_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        task_id TEXT NOT NULL, run_id TEXT NOT NULL, attempt_id TEXT NOT NULL, worker_agent_id TEXT NOT NULL,
        repository_ref TEXT NOT NULL, branch TEXT NOT NULL, base_revision TEXT NOT NULL,
        current_revision TEXT NOT NULL, diff_id TEXT NOT NULL, diff_hash TEXT NOT NULL,
        validation_id TEXT NOT NULL, validation_evidence_hash TEXT NOT NULL,
        requesting_actor TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        status TEXT NOT NULL, request_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_review_decisions (
        decision_id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES agent_mode_review_requests(review_id),
        decision TEXT NOT NULL, reviewer TEXT NOT NULL, decided_at TEXT NOT NULL,
        reason TEXT NOT NULL, evidence_hash TEXT NOT NULL, decision_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_one_review_decision
        ON agent_mode_review_decisions (review_id);
      CREATE TABLE IF NOT EXISTS agent_mode_review_receipts (
        receipt_id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES agent_mode_review_requests(review_id),
        decision_id TEXT,
        task_id TEXT NOT NULL, run_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id), worker_agent_id TEXT NOT NULL,
        diff_hash TEXT NOT NULL, validation_evidence_hash TEXT NOT NULL,
        reviewer TEXT NOT NULL, timestamp TEXT NOT NULL, operation_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_review_receipts_by_review
        ON agent_mode_review_receipts (review_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_target_ref_leases (
        lease_id TEXT PRIMARY KEY,
        repository_ref TEXT NOT NULL, target_ref TEXT NOT NULL,
        owner_operation TEXT NOT NULL, fence_token INTEGER NOT NULL CHECK (fence_token > 0),
        expected_target_head TEXT NOT NULL, expires_at TEXT NOT NULL,
        status TEXT NOT NULL, lease_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_one_active_target_ref_lease
        ON agent_mode_target_ref_leases (repository_ref, target_ref) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS agent_mode_commit_operations (
        operation_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL, branch TEXT NOT NULL, parent_commit TEXT NOT NULL,
        resulting_commit TEXT, approved_diff_hash TEXT NOT NULL,
        validation_evidence_hash TEXT NOT NULL, review_id TEXT NOT NULL,
        actor TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL,
        receipt_hash TEXT, reason TEXT, operation_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_merge_approvals (
        approval_id TEXT PRIMARY KEY,
        repository_ref TEXT NOT NULL, source_workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        source_branch TEXT NOT NULL, source_commit TEXT NOT NULL, diff_hash TEXT NOT NULL,
        validation_evidence_hash TEXT NOT NULL, target_ref TEXT NOT NULL,
        expected_target_head TEXT NOT NULL, approver TEXT NOT NULL, created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
        approval_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_merge_receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL, approval_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        source_commit TEXT, target_ref TEXT NOT NULL,
        target_before TEXT, target_after TEXT,
        review_id TEXT NOT NULL, validation_id TEXT NOT NULL,
        actor TEXT NOT NULL, timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL, result TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_merge_receipts_by_operation
        ON agent_mode_merge_receipts (operation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_commit_receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        branch TEXT NOT NULL, parent_commit TEXT, resulting_commit TEXT,
        diff_hash TEXT NOT NULL, validation_evidence_hash TEXT NOT NULL,
        review_id TEXT NOT NULL, actor TEXT NOT NULL, timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL, result TEXT NOT NULL, receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_commit_receipts_by_operation
        ON agent_mode_commit_receipts (operation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_merge_operations (
        operation_id TEXT PRIMARY KEY,
        approval_id TEXT NOT NULL REFERENCES agent_mode_merge_approvals(approval_id),
        repository_ref TEXT NOT NULL, source_workcell_id TEXT NOT NULL,
        source_branch TEXT NOT NULL, source_commit TEXT NOT NULL, target_ref TEXT NOT NULL,
        expected_target_head TEXT NOT NULL, resulting_target_head TEXT, actor TEXT NOT NULL,
        created_at TEXT NOT NULL, status TEXT NOT NULL, receipt_hash TEXT, reason TEXT,
        operation_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_scheduler_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        causation_id TEXT,
        correlation_id TEXT,
        deduplication_key TEXT NOT NULL,
        payload_version TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        next_eligible_at TEXT NOT NULL,
        deadline TEXT,
        max_attempts INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        claim_owner TEXT,
        claim_fence INTEGER,
        claim_expires_at TEXT,
        last_failure TEXT,
        last_failure_at TEXT,
        completed_at TEXT,
        dead_lettered_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_scheduler_events_dedup
        ON agent_mode_scheduler_events (source, deduplication_key);
      CREATE INDEX IF NOT EXISTS agent_mode_scheduler_events_ready
        ON agent_mode_scheduler_events (status, next_eligible_at, event_id);
      CREATE TABLE IF NOT EXISTS agent_mode_scheduler_schedules (
        schedule_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        due_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        deduplication_key TEXT NOT NULL,
        causation_id TEXT,
        correlation_id TEXT,
        payload_version TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        next_eligible_at TEXT NOT NULL,
        deadline TEXT,
        max_attempts INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        claim_owner TEXT,
        claim_fence INTEGER,
        claim_expires_at TEXT,
        last_failure TEXT,
        last_failure_at TEXT,
        completed_at TEXT,
        dead_lettered_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_scheduler_schedules_dedup
        ON agent_mode_scheduler_schedules (kind, deduplication_key);
      CREATE INDEX IF NOT EXISTS agent_mode_scheduler_schedules_ready
        ON agent_mode_scheduler_schedules (status, next_eligible_at, schedule_id);
      CREATE TABLE IF NOT EXISTS agent_mode_source_watermarks (
        source_id TEXT PRIMARY KEY,
        watermark TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_scheduler_observer (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        latest_tick_json TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_mode_event_sources (
        source_id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        repository_ref TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        debounce_window_ms INTEGER NOT NULL,
        cooldown_window_ms INTEGER NOT NULL,
        catch_up_limit INTEGER NOT NULL,
        enabled INTEGER NOT NULL,
        bootstrap_watermark TEXT,
        status TEXT NOT NULL,
        watermark TEXT,
        last_observed_at TEXT,
        last_successful_observation TEXT,
        last_error_reason TEXT,
        cooldown_not_before TEXT,
        next_eligible_at TEXT,
        catch_up_pending INTEGER NOT NULL,
        last_emitted_event_count INTEGER NOT NULL,
        failure_attempt_count INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_spawn_admission_controls (
        control_id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'root')),
        root_goal_id TEXT,
        denied INTEGER NOT NULL CHECK (denied IN (0, 1)),
        reason TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (scope, root_goal_id)
      );
      CREATE TABLE IF NOT EXISTS agent_mode_organization_plans (
        organization_plan_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version INTEGER NOT NULL CHECK (schema_version = 1),
        plan_version INTEGER NOT NULL CHECK (plan_version = 1),
        root_goal_id TEXT NOT NULL,
        supervisor_agent_id TEXT NOT NULL,
        supervisor_organization_role_id TEXT NOT NULL,
        plan_key TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deadline TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_organization_work_items (
        work_item_id TEXT PRIMARY KEY,
        organization_plan_id TEXT NOT NULL REFERENCES agent_mode_organization_plans(organization_plan_id) ON DELETE CASCADE,
        work_item_key TEXT NOT NULL,
        organization_role_id TEXT NOT NULL,
        task_spec_ref TEXT NOT NULL,
        dependency_keys_json TEXT NOT NULL,
        requested_ttl INTEGER NOT NULL CHECK (requested_ttl > 0),
        requested_steps INTEGER NOT NULL CHECK (requested_steps > 0),
        requested_cost REAL NOT NULL CHECK (requested_cost > 0),
        requested_tokens INTEGER NOT NULL CHECK (requested_tokens > 0),
        result_contract_json TEXT NOT NULL,
        bound_child_agent_id TEXT,
        bound_task_id TEXT,
        UNIQUE (organization_plan_id, work_item_key)
      );
      CREATE TABLE IF NOT EXISTS agent_mode_organization_dependencies (
        organization_plan_id TEXT NOT NULL REFERENCES agent_mode_organization_plans(organization_plan_id) ON DELETE CASCADE,
        work_item_key TEXT NOT NULL,
        depends_on_work_item_key TEXT NOT NULL,
        dependency_type TEXT NOT NULL CHECK (dependency_type = 'requires_success'),
        PRIMARY KEY (organization_plan_id, work_item_key, depends_on_work_item_key)
      );
      CREATE INDEX IF NOT EXISTS agent_mode_organization_work_items_plan ON agent_mode_organization_work_items (organization_plan_id, work_item_key);
      CREATE INDEX IF NOT EXISTS agent_mode_organization_dependencies_plan ON agent_mode_organization_dependencies (organization_plan_id, work_item_key);
      CREATE TABLE IF NOT EXISTS agent_mode_organization_final_results (
        organization_plan_id TEXT PRIMARY KEY REFERENCES agent_mode_organization_plans(organization_plan_id) ON DELETE CASCADE,
        organization_final_result_id TEXT NOT NULL UNIQUE,
        material_hash TEXT NOT NULL,
        schema_version INTEGER NOT NULL CHECK (schema_version = 1),
        plan_version INTEGER NOT NULL CHECK (plan_version = 1),
        root_goal_id TEXT NOT NULL,
        supervisor_agent_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'cancelled', 'expired')),
        auditor_work_item_id TEXT,
        auditor_result_ref TEXT,
        work_item_results_json TEXT NOT NULL,
        total_settled_cost REAL NOT NULL CHECK (total_settled_cost >= 0),
        aggregate_digest TEXT NOT NULL,
        finalized_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_escalations (
        escalation_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode-attention-v1'),
        kind TEXT NOT NULL CHECK (kind IN ('uncertain_attempt', 'scheduler_dead_letter', 'workcell_validation_failure')),
        severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
        root_goal_id TEXT,
        agent_id TEXT,
        task_id TEXT,
        run_id TEXT,
        attempt_id TEXT,
        workcell_id TEXT,
        review_id TEXT,
        source_type TEXT NOT NULL CHECK (source_type IN ('attempt', 'scheduler_event', 'scheduler_schedule', 'workcell_validation')),
        source_id TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_escalations_source ON agent_mode_escalations (kind, source_type, source_id, reason_code);
      CREATE TABLE IF NOT EXISTS agent_mode_notifications (
        notification_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode-attention-v1'),
        kind TEXT NOT NULL CHECK (kind IN ('operator_escalation', 'pending_review', 'uncertain_attempt', 'scheduler_dead_letter')),
        severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
        source_type TEXT NOT NULL CHECK (source_type IN ('attempt', 'scheduler_event', 'scheduler_schedule', 'workcell_validation', 'review')),
        source_id TEXT NOT NULL,
        escalation_id TEXT,
        review_id TEXT,
        root_goal_id TEXT,
        agent_id TEXT,
        task_id TEXT,
        run_id TEXT,
        attempt_id TEXT,
        workcell_id TEXT,
        title_code TEXT NOT NULL,
        message_code TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_notifications_source_transition ON agent_mode_notifications (kind, source_type, source_id, created_at);
      CREATE TABLE IF NOT EXISTS agent_mode_notification_reads (
        notification_id TEXT NOT NULL REFERENCES agent_mode_notifications(notification_id) ON DELETE CASCADE,
        operator_id TEXT NOT NULL,
        read_at TEXT NOT NULL,
        PRIMARY KEY (notification_id, operator_id)
      );
      CREATE INDEX IF NOT EXISTS agent_mode_notifications_created ON agent_mode_notifications (created_at DESC, notification_id);
      INSERT INTO store_meta (key, value) VALUES ('schema_version', '7')
        ON CONFLICT(key) DO NOTHING;
    `);
    this.migrateEventsTable();
    this.migrateEffectsTable();
    this.migrateOutboxTable();
    this.migrateRunsTable();
    this.migrateReviewTables();
    this.migrateAgentTable();
    this.migrateChildAssignmentTables();
    this.ensureOrganizationFinalResultTable();
    this.ensureAttentionTables();
    this.ensureJarvisIntakeTable();
    this.ensureJarvisResponseSourceTables();
    this.ensureJarvisUserResponseTable();
    this.hasRuntimePidColumn = true;
    this.hasRuntimeIdentityColumns = true;
    this.hasWorkcellTables = true;
    this.hasWriterTables = true;
    this.hasMutationTables = true;
    this.hasValidationTables = true;
    this.hasPromotionTables = true;
    this.hasReviewReceiptTables = true;
    this.hasCommitReceiptTables = true;
    this.hasMergeReceiptTables = true;
    this.database.prepare("UPDATE store_meta SET value = '10' WHERE key = 'schema_version' AND value IN ('1', '2', '3', '4', '5', '6', '7', '8', '9')").run();
    this.hasSchedulerTables = true;
    this.hasEventSourceTables = true;
    this.hasSpawnAdmissionControlTables = true;
    this.hasChildAssignmentTables = true;
    this.hasOrganizationTables = true;
    this.hasAttentionTables = true;
    this.hasJarvisIntakeTables = true;
    this.hasJarvisResponseSourceTables = true;
    this.hasJarvisUserResponseTables = true;
  }

  static openExisting(databasePath = defaultAgentModeDatabasePath()): AgentModeSqliteStateStore | undefined {
    if (!existsSync(databasePath)) return undefined;
    return new AgentModeSqliteStateStore(databasePath, { readOnly: true });
  }

  private migrateReviewTables(): void {
    const columns = this.database.prepare('PRAGMA table_info(agent_mode_review_requests)').all() as Array<{ name?: string }>;
    if (columns.some((column) => column.name === 'worker_agent_id')) return;
    this.database.exec('ALTER TABLE agent_mode_review_requests ADD COLUMN worker_agent_id TEXT');
    this.database.exec('UPDATE agent_mode_review_requests SET worker_agent_id = (SELECT owner_agent FROM workcells WHERE workcells.workcell_id = agent_mode_review_requests.workcell_id) WHERE worker_agent_id IS NULL');
  }

  private migrateEffectsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(effects)').all() as Array<{ name?: string }>;
    const existing = new Set(columns.map((column) => column.name));
    const additions: Record<string, string> = {
      capability_id: 'TEXT',
      grant_id: 'TEXT',
      policy_version: 'TEXT',
      lease_resource_key: 'TEXT',
      lease_id: 'TEXT',
      lease_fence: 'INTEGER',
      deadline: 'TEXT',
      prepared_at: 'TEXT',
      dispatched_at: 'TEXT',
      observed_at: 'TEXT',
      dispatch_id: 'TEXT',
      assignment_intent_key: 'TEXT',
      child_agent_id: 'TEXT',
      runtime_ref: 'TEXT',
      runtime_profile_ref: 'TEXT',
      controller_ref: 'TEXT',
    };
    for (const [name, type] of Object.entries(additions)) {
      if (!existing.has(name)) this.database.exec(`ALTER TABLE effects ADD COLUMN ${name} ${type}`);
    }
  }

  private migrateEventsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(events)').all() as Array<{ name?: string }>;
    if (columns.some((column) => column.name === 'sequence')) return;
    this.database.exec('ALTER TABLE events ADD COLUMN sequence INTEGER');
    this.database.exec('UPDATE events SET sequence = rowid WHERE sequence IS NULL');
  }

  private migrateOutboxTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(dispatch_outbox)').all() as Array<{ name?: string }>;
    const existing = new Set(columns.map((column) => column.name));
    const additions: Record<string, string> = {
      grant_id: 'TEXT', dispatch_id: 'TEXT', assignment_intent_key: 'TEXT', child_agent_id: 'TEXT',
      runtime_ref: 'TEXT', runtime_profile_ref: 'TEXT', controller_ref: 'TEXT',
    };
    for (const [name, type] of Object.entries(additions)) if (!existing.has(name)) this.database.exec(`ALTER TABLE dispatch_outbox ADD COLUMN ${name} ${type}`);
  }

  private migrateRunsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(runs)').all() as Array<{ name?: string }>;
    if (!columns.some((column) => column.name === 'runtime_pid')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_pid INTEGER');
    if (!columns.some((column) => column.name === 'runtime_started_at')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_started_at TEXT');
    if (!columns.some((column) => column.name === 'runtime_command')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_command TEXT');
    if (!columns.some((column) => column.name === 'runtime_identity')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_identity TEXT');
  }

  private migrateAgentTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(agents)').all() as Array<{ name?: string }>;
    const existing = new Set(columns.map((column) => column.name));
    const additions: Record<string, string> = {
      role_template_id: 'TEXT', role_template_version: 'INTEGER', policy_version: 'INTEGER',
      parent_agent_id: 'TEXT', parent_task_id: 'TEXT', parent_run_id: 'TEXT', root_goal_id: 'TEXT',
      spawn_intent_key: 'TEXT', source_event_id: 'TEXT', spawn_depth: 'INTEGER',
      repository_scope: 'TEXT', resource_scope: 'TEXT', capability_set_hash: 'TEXT', capabilities_json: 'TEXT',
      requested_child_steps: 'INTEGER', reserved_child_steps: 'INTEGER', requested_child_cost: 'REAL', reserved_child_cost: 'REAL',
      child_created_at: 'TEXT', expires_at: 'TEXT',
    };
    for (const [name, type] of Object.entries(additions)) if (!existing.has(name)) this.database.exec(`ALTER TABLE agents ADD COLUMN ${name} ${type}`);
    this.database.exec('CREATE UNIQUE INDEX IF NOT EXISTS agents_spawn_intent_key ON agents(spawn_intent_key) WHERE spawn_intent_key IS NOT NULL');
  }

  private ensureOrganizationFinalResultTable(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_mode_organization_final_results (
        organization_plan_id TEXT PRIMARY KEY REFERENCES agent_mode_organization_plans(organization_plan_id) ON DELETE CASCADE,
        organization_final_result_id TEXT NOT NULL UNIQUE,
        material_hash TEXT NOT NULL,
        schema_version INTEGER NOT NULL CHECK (schema_version = 1),
        plan_version INTEGER NOT NULL CHECK (plan_version = 1),
        root_goal_id TEXT NOT NULL,
        supervisor_agent_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'cancelled', 'expired')),
        auditor_work_item_id TEXT,
        auditor_result_ref TEXT,
        work_item_results_json TEXT NOT NULL,
        total_settled_cost REAL NOT NULL CHECK (total_settled_cost >= 0),
        aggregate_digest TEXT NOT NULL,
        finalized_at TEXT NOT NULL
      );
    `);
  }

  private ensureAttentionTables(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_mode_escalations (
        escalation_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode-attention-v1'),
        kind TEXT NOT NULL CHECK (kind IN ('uncertain_attempt', 'scheduler_dead_letter', 'workcell_validation_failure')),
        severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
        root_goal_id TEXT, agent_id TEXT, task_id TEXT, run_id TEXT, attempt_id TEXT, workcell_id TEXT, review_id TEXT,
        source_type TEXT NOT NULL CHECK (source_type IN ('attempt', 'scheduler_event', 'scheduler_schedule', 'workcell_validation')),
        source_id TEXT NOT NULL, reason_code TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_escalations_source ON agent_mode_escalations (kind, source_type, source_id, reason_code);
      CREATE TABLE IF NOT EXISTS agent_mode_notifications (
        notification_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode-attention-v1'),
        kind TEXT NOT NULL CHECK (kind IN ('operator_escalation', 'pending_review', 'uncertain_attempt', 'scheduler_dead_letter')),
        severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
        source_type TEXT NOT NULL CHECK (source_type IN ('attempt', 'scheduler_event', 'scheduler_schedule', 'workcell_validation', 'review')),
        source_id TEXT NOT NULL, escalation_id TEXT, review_id TEXT,
        root_goal_id TEXT, agent_id TEXT, task_id TEXT, run_id TEXT, attempt_id TEXT, workcell_id TEXT,
        title_code TEXT NOT NULL, message_code TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_notifications_source_transition ON agent_mode_notifications (kind, source_type, source_id, created_at);
      CREATE TABLE IF NOT EXISTS agent_mode_notification_reads (
        notification_id TEXT NOT NULL REFERENCES agent_mode_notifications(notification_id) ON DELETE CASCADE,
        operator_id TEXT NOT NULL, read_at TEXT NOT NULL,
        PRIMARY KEY (notification_id, operator_id)
      );
      CREATE INDEX IF NOT EXISTS agent_mode_notifications_created ON agent_mode_notifications (created_at DESC, notification_id);
    `);
  }

  private ensureJarvisIntakeTable(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_mode_jarvis_intakes (
        intake_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version INTEGER NOT NULL CHECK (schema_version = 1),
        source TEXT NOT NULL CHECK (source IN ('typed', 'voice')),
        operator_id TEXT NOT NULL,
        canonical_text_hash TEXT NOT NULL,
        root_goal_id TEXT NOT NULL UNIQUE,
        task_id TEXT NOT NULL UNIQUE REFERENCES tasks(task_id),
        jarvis_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
        received_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_jarvis_intakes_created ON agent_mode_jarvis_intakes(created_at DESC, intake_id);
    `);
  }

  private ensureJarvisResponseSourceTables(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_mode_jarvis_task_inputs (
        task_id TEXT PRIMARY KEY REFERENCES tasks(task_id),
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode.jarvis-task-input.v1'),
        root_goal_id TEXT NOT NULL UNIQUE,
        jarvis_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
        source TEXT NOT NULL CHECK (source IN ('typed', 'voice')),
        text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 4000),
        content_hash TEXT NOT NULL,
        retention_class TEXT NOT NULL CHECK (retention_class = 'root-lifecycle'),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_jarvis_task_inputs_created ON agent_mode_jarvis_task_inputs(created_at DESC, task_id);
      CREATE TABLE IF NOT EXISTS agent_mode_jarvis_readable_results (
        result_ref TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode.jarvis-readable-result.v1'),
        root_goal_id TEXT NOT NULL,
        task_id TEXT NOT NULL REFERENCES tasks(task_id),
        owner TEXT NOT NULL CHECK (owner = 'brain'),
        result_type TEXT NOT NULL CHECK (result_type = 'organization-summary'),
        facts_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (root_goal_id)
      );
      CREATE INDEX IF NOT EXISTS agent_mode_jarvis_readable_results_created ON agent_mode_jarvis_readable_results(created_at DESC, result_ref);
    `);
  }

  private ensureJarvisUserResponseTable(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_mode_jarvis_user_responses (
        response_id TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        schema_version TEXT NOT NULL CHECK (schema_version = 'agent-mode.jarvis-user-response.v1'),
        root_goal_id TEXT NOT NULL,
        task_id TEXT NOT NULL REFERENCES tasks(task_id),
        jarvis_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
        speaker_role TEXT NOT NULL CHECK (speaker_role = 'jarvis'),
        source_result_ref TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status = 'published'),
        text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 2000),
        text_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (root_goal_id)
      );
      CREATE INDEX IF NOT EXISTS agent_mode_jarvis_user_responses_created ON agent_mode_jarvis_user_responses(created_at DESC, response_id);
    `);
  }

  private migrateChildAssignmentTables(): void {
    const additions: Record<string, string> = {
      child_agent_id: 'TEXT', assignment_intent_key: 'TEXT', task_spec_ref: 'TEXT',
    };
    const taskColumns = new Set((this.database.prepare('PRAGMA table_info(tasks)').all() as Array<{ name?: string }>).map((column) => column.name));
    for (const [name, type] of Object.entries(additions)) if (!taskColumns.has(name)) this.database.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${type}`);
    const runAdditions: Record<string, string> = { child_agent_id: 'TEXT', assignment_intent_key: 'TEXT' };
    const runColumns = new Set((this.database.prepare('PRAGMA table_info(runs)').all() as Array<{ name?: string }>).map((column) => column.name));
    for (const [name, type] of Object.entries(runAdditions)) if (!runColumns.has(name)) this.database.exec(`ALTER TABLE runs ADD COLUMN ${name} ${type}`);
    const attemptAdditions: Record<string, string> = { runtime_profile_ref: 'TEXT', child_agent_id: 'TEXT', assignment_intent_key: 'TEXT' };
    const attemptColumns = new Set((this.database.prepare('PRAGMA table_info(attempts)').all() as Array<{ name?: string }>).map((column) => column.name));
    for (const [name, type] of Object.entries(attemptAdditions)) if (!attemptColumns.has(name)) this.database.exec(`ALTER TABLE attempts ADD COLUMN ${name} ${type}`);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_mode_child_assignments (
        assignment_intent_key TEXT PRIMARY KEY,
        material_hash TEXT NOT NULL,
        assignment_id TEXT NOT NULL UNIQUE,
        child_agent_id TEXT NOT NULL UNIQUE REFERENCES agents(agent_id),
        root_goal_id TEXT NOT NULL,
        source_event_id TEXT NOT NULL,
        task_spec_ref TEXT NOT NULL,
        task_id TEXT NOT NULL UNIQUE REFERENCES tasks(task_id),
        run_id TEXT NOT NULL UNIQUE REFERENCES runs(run_id),
        attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
        runtime_ref TEXT NOT NULL,
        runtime_profile_ref TEXT NOT NULL,
        role_template_id TEXT NOT NULL,
        role_template_version INTEGER NOT NULL,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        capability_set_hash TEXT NOT NULL,
        capabilities_json TEXT NOT NULL,
        repository_scope TEXT,
        resource_scope TEXT,
        requested_steps INTEGER NOT NULL CHECK (requested_steps >= 0),
        requested_cost REAL NOT NULL CHECK (requested_cost >= 0),
        requested_tokens INTEGER NOT NULL DEFAULT 0 CHECK (requested_tokens >= 0),
        budget_scope_id TEXT NOT NULL,
        reservation_id TEXT NOT NULL UNIQUE REFERENCES budget_reservations(reservation_id),
        deadline TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('dispatch_ready', 'running', 'completed', 'failed', 'cancelled', 'expired', 'uncertain')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
    `);
    const assignmentColumns = new Set((this.database.prepare('PRAGMA table_info(agent_mode_child_assignments)').all() as Array<{ name?: string }>).map((column) => column.name));
    if (!assignmentColumns.has('material_hash')) this.database.exec('ALTER TABLE agent_mode_child_assignments ADD COLUMN material_hash TEXT');
    if (!assignmentColumns.has('requested_tokens')) this.database.exec('ALTER TABLE agent_mode_child_assignments ADD COLUMN requested_tokens INTEGER NOT NULL DEFAULT 0');
  }

  private tableHasColumn(table: string, columnName: string): boolean {
    const columns = this.database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>;
    return columns.some((column) => column.name === columnName);
  }

  private tableExists(table: string): boolean {
    const row = this.database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { present?: number } | undefined;
    return row?.present === 1;
  }

  get schemaVersion(): number {
    const row = this.database.prepare('SELECT value FROM store_meta WHERE key = ?').get('schema_version') as { value?: string } | undefined;
    return Number(row?.value ?? 0);
  }

  get isReadOnly(): boolean {
    return this.readOnly;
  }

  /** Infrastructure-only logical row access used by the backend-neutral snapshot adapter. */
  readPortableRecordFamilies(maxRecords = 10_000): AgentModePortableRecordFamily[] {
    if (!this.readOnly) throw new Error('portable export requires a read-only, quiesced store');
    if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10_000) throw new Error('portable export bound is invalid');
    const tables = (this.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name?: string }>).map((row) => String(row.name)).filter(Boolean);
    let total = 0;
    return tables.map((table) => {
      const columns = (this.database.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all() as Array<{ name?: string }>).map((column) => String(column.name));
      const rows = this.database.prepare(`SELECT * FROM ${JSON.stringify(table)} ORDER BY rowid`).all() as Array<Record<string, unknown>>;
      total += rows.length;
      if (total > maxRecords) throw new Error('portable export exceeds record bound');
      return { family: table, records: rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))) };
    });
  }

  /** Infrastructure-only logical row import; callers must validate the snapshot before invoking it. */
  importPortableRecordFamilies(families: readonly AgentModePortableRecordFamily[]): void {
    if (this.readOnly) throw new Error('portable import requires a writable fresh store');
    this.withTransaction(() => {
      const pending = new Map(families.map((family) => [family.family, family]));
      const ordered: AgentModePortableRecordFamily[] = [];
      while (pending.size > 0) {
        let progressed = false;
        for (const [name, family] of pending) {
          const dependencies = (this.database.prepare(`PRAGMA foreign_key_list(${JSON.stringify(name)})`).all() as Array<{ table?: string }>).map((row) => String(row.table));
          if (dependencies.every((dependency) => !pending.has(dependency))) {
            ordered.push(family); pending.delete(name); progressed = true;
          }
        }
        if (!progressed) throw new Error('portable import dependency cycle');
      }
      for (const family of ordered) {
        if (!/^[A-Za-z0-9_]{1,96}$/u.test(family.family) || !this.tableExists(family.family)) throw new Error(`unknown portable record family: ${family.family}`);
        for (const row of family.records) {
          const columns = Object.keys(row).sort();
          if (columns.length === 0) continue;
          const placeholders = columns.map(() => '?').join(',');
          const verb = family.family === 'store_meta' ? 'INSERT OR REPLACE' : 'INSERT';
          this.database.prepare(`${verb} INTO ${JSON.stringify(family.family)} (${columns.map((column) => JSON.stringify(column)).join(',')}) VALUES (${placeholders})`).run(...columns.map((column) => row[column] as string | number | bigint | null | Uint8Array));
        }
      }
      const foreignKeys = this.database.prepare('PRAGMA foreign_key_check').all() as Array<Record<string, unknown>>;
      if (foreignKeys.length > 0) throw new Error('portable import foreign-key check failed');
    });
  }

  quickIntegrityCheck(): string {
    return String((this.database.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined)?.quick_check ?? 'unknown');
  }

  withTransaction<T>(callback: () => T): T {
    if (this.transactionDepth > 0) return callback();
    this.database.exec('BEGIN IMMEDIATE;');
    this.transactionDepth = 1;
    try {
      const result = callback();
      this.database.exec('COMMIT;');
      this.transactionDepth = 0;
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK;');
      this.transactionDepth = 0;
      throw error;
    }
  }

  upsertAgent(agent: AgentModeAgent): void {
    this.database.prepare(`
      INSERT INTO agents (agent_id, agent_kind, role, display_name, policy_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        agent_kind = excluded.agent_kind,
        role = excluded.role,
        display_name = excluded.display_name,
        policy_id = excluded.policy_id,
        status = excluded.status
    `).run(agent.agentId, agent.agentKind, agent.role, agent.displayName, agent.policyId, agent.status);
    // Root ownership is an authoritative fact used by K5 organization plans.
    // Preserve the historical compatibility behavior for callers that omit it.
    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    const set = (column: string, value: string | number | null | undefined): void => { if (value !== undefined) { updates.push(`${column} = ?`); values.push(value); } };
    set('role_template_id', agent.roleTemplateId);
    set('role_template_version', agent.roleTemplateVersion);
    set('policy_version', agent.policyVersion);
    set('parent_agent_id', agent.parentAgentId);
    set('parent_task_id', agent.parentTaskId);
    set('parent_run_id', agent.parentRunId);
    set('root_goal_id', agent.rootGoalId);
    set('source_event_id', agent.sourceEventId);
    set('spawn_depth', agent.depth);
    set('repository_scope', agent.repositoryScope);
    set('resource_scope', agent.resourceScope);
    set('capability_set_hash', agent.capabilitySetHash);
    if (agent.capabilities !== undefined) set('capabilities_json', JSON.stringify([...agent.capabilities]));
    set('requested_child_steps', agent.requestedChildSteps);
    set('reserved_child_steps', agent.reservedChildSteps);
    set('requested_child_cost', agent.requestedChildCost);
    set('reserved_child_cost', agent.reservedChildCost);
    set('child_created_at', agent.childCreatedAt);
    set('expires_at', agent.expiresAt);
    if (updates.length > 0) this.database.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE agent_id = ?`).run(...values, agent.agentId);
  }

  getAgent(agentId: string): AgentModeAgent | undefined {
    const row = this.database.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return mapAgentRow(row);
  }

  listAgents(): AgentModeAgent[] {
    const rows = this.database.prepare('SELECT * FROM agents ORDER BY agent_id').all() as Array<Record<string, unknown>>;
    return rows.map(mapAgentRow);
  }

  private assertOrganizationRootBinding(plan: OrganizationPlan): void {
    if (!this.getTask(plan.rootGoalId)) throw new Error('organization plan root goal is not authoritative');
    const supervisor = this.getAgent(plan.supervisorAgentId);
    if (!supervisor || supervisor.agentKind !== 'jarvis' || supervisor.rootGoalId !== plan.rootGoalId) throw new Error('organization plan supervisor is not bound to the root goal');
  }

  createOrganizationPlan(plan: OrganizationPlan, now: string): AgentModeOrganizationPlanResult {
    if (this.readOnly || !this.hasOrganizationTables) throw new Error('organization plan persistence is unavailable');
    const normalized = validateOrganizationPlan(plan, now);
    this.assertOrganizationRootBinding(normalized);
    const materialHash = organizationPlanMaterial(normalized);
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT material_hash FROM agent_mode_organization_plans WHERE organization_plan_id = ?').get(normalized.organizationPlanId) as { material_hash?: string } | undefined;
      if (existing) return existing.material_hash === materialHash ? { result: 'duplicate' as const, plan: this.getOrganizationPlan(normalized.organizationPlanId)! } : { result: 'conflict' as const, reasonCode: 'ORGANIZATION_PLAN_CONFLICT' as const };
      this.database.prepare(`
        INSERT INTO agent_mode_organization_plans (
          organization_plan_id, material_hash, schema_version, plan_version, root_goal_id,
          supervisor_agent_id, supervisor_organization_role_id, plan_key, status, created_at, deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(normalized.organizationPlanId, materialHash, normalized.schemaVersion, normalized.planVersion, normalized.rootGoalId, normalized.supervisorAgentId, normalized.supervisorOrganizationRoleId, normalized.planKey, normalized.status, normalized.createdAt, normalized.deadline);
      for (const item of normalized.workItems) {
        this.database.prepare(`
          INSERT INTO agent_mode_organization_work_items (
            work_item_id, organization_plan_id, work_item_key, organization_role_id, task_spec_ref,
            dependency_keys_json, requested_ttl, requested_steps, requested_cost, requested_tokens,
            result_contract_json, bound_child_agent_id, bound_task_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `).run(item.workItemId, normalized.organizationPlanId, item.workItemKey, item.organizationRoleId, item.taskSpecRef, JSON.stringify(item.dependencyKeys), item.requestedTtl, item.requestedSteps, item.requestedCost, item.requestedTokens, JSON.stringify(item.resultContract));
      }
      for (const dependency of normalized.dependencies) {
        this.database.prepare(`
          INSERT INTO agent_mode_organization_dependencies (organization_plan_id, work_item_key, depends_on_work_item_key, dependency_type)
          VALUES (?, ?, ?, ?)
        `).run(normalized.organizationPlanId, dependency.workItemKey, dependency.dependsOnWorkItemKey, dependency.type);
      }
      return { result: 'created' as const, plan: this.getOrganizationPlan(normalized.organizationPlanId)! };
    });
  }

  getOrganizationPlan(organizationPlanId: string): OrganizationPlan | undefined {
    if (!this.hasOrganizationTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_organization_plans WHERE organization_plan_id = ?').get(organizationPlanId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const workItems = (this.database.prepare('SELECT * FROM agent_mode_organization_work_items WHERE organization_plan_id = ? ORDER BY work_item_key LIMIT 16').all(organizationPlanId) as Array<Record<string, unknown>>).map(mapOrganizationWorkItemRow);
    const dependencies = (this.database.prepare('SELECT * FROM agent_mode_organization_dependencies WHERE organization_plan_id = ? ORDER BY work_item_key, depends_on_work_item_key LIMIT 32').all(organizationPlanId) as Array<Record<string, unknown>>).map((dependency) => ({ organizationPlanId, workItemKey: String(dependency.work_item_key), dependsOnWorkItemKey: String(dependency.depends_on_work_item_key), type: dependency.dependency_type as 'requires_success' }));
    return mapOrganizationPlanRow(row, workItems, dependencies);
  }

  listOrganizationPlans(limit = 16): OrganizationPlan[] {
    if (!this.hasOrganizationTables) return [];
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 16));
    const rows = this.database.prepare('SELECT * FROM agent_mode_organization_plans ORDER BY organization_plan_id LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>;
    return rows.map((row) => this.getOrganizationPlan(String(row.organization_plan_id))).filter((plan): plan is OrganizationPlan => plan !== undefined);
  }

  listOrganizationWorkItems(organizationPlanId: string): AgentModeOrganizationWorkItem[] {
    if (!this.hasOrganizationTables) return [];
    return (this.database.prepare('SELECT * FROM agent_mode_organization_work_items WHERE organization_plan_id = ? ORDER BY work_item_key LIMIT 16').all(organizationPlanId) as Array<Record<string, unknown>>).map(mapOrganizationWorkItemRow);
  }

  getOrganizationFinalResult(organizationPlanId: string): OrganizationFinalResult | undefined {
    if (!this.tableExists('agent_mode_organization_final_results')) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_organization_final_results WHERE organization_plan_id = ?').get(organizationPlanId) as Record<string, unknown> | undefined;
    return row ? mapOrganizationFinalResultRow(row) : undefined;
  }

  getOrganizationFinalResultById(organizationFinalResultId: string): OrganizationFinalResult | undefined {
    if (!this.tableExists('agent_mode_organization_final_results')) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_organization_final_results WHERE organization_final_result_id = ?').get(organizationFinalResultId) as Record<string, unknown> | undefined;
    return row ? mapOrganizationFinalResultRow(row) : undefined;
  }

  listOrganizationFinalResults(limit = 16): OrganizationFinalResult[] {
    if (!this.tableExists('agent_mode_organization_final_results')) return [];
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 16));
    return (this.database.prepare('SELECT * FROM agent_mode_organization_final_results ORDER BY organization_plan_id LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>).map(mapOrganizationFinalResultRow);
  }

  /** Persist only the immutable organization-level receipt; K4 remains the lifecycle ledger. */
  finalizeOrganizationPlan(result: OrganizationFinalResult): AgentModeOrganizationFinalizationResult {
    if (this.readOnly || !this.hasOrganizationTables || !this.tableExists('agent_mode_organization_final_results')) return { result: 'denied', reasonCode: 'ORGANIZATION_PERSISTENCE_UNAVAILABLE' };
    if (!Number.isFinite(Date.parse(result.finalizedAt)) || result.schemaVersion !== 1 || !Number.isFinite(result.totalSettledCost) || result.totalSettledCost < 0) return { result: 'denied', reasonCode: 'INVALID_FINAL_RESULT' };
    const materialHash = createHash('sha256').update(organizationFinalResultMaterial(result)).digest('hex');
    try {
      return this.withTransaction(() => {
        const plan = this.getOrganizationPlan(result.organizationPlanId);
        if (!plan || plan.rootGoalId !== result.rootGoalId || plan.supervisorAgentId !== result.supervisorAgentId) return { result: 'denied' as const, reasonCode: 'FINAL_RESULT_LINEAGE_MISMATCH' };
        const existing = this.database.prepare('SELECT * FROM agent_mode_organization_final_results WHERE organization_plan_id = ?').get(result.organizationPlanId) as Record<string, unknown> | undefined;
        if (existing) {
          return String(existing.material_hash) === materialHash
            ? { result: 'duplicate' as const, finalResult: mapOrganizationFinalResultRow(existing) }
            : { result: 'conflict' as const, reasonCode: 'ORGANIZATION_FINAL_RESULT_CONFLICT' };
        }
        const authoritativeAggregation = deriveOrganizationAggregation(this, plan, result.finalizedAt);
        if (authoritativeAggregation.aggregateStatus === 'not_ready' || authoritativeAggregation.aggregateStatus === 'uncertain') return { result: 'denied' as const, reasonCode: 'FINAL_RESULT_NOT_AUTHORITATIVE' };
        const authoritativeResult = organizationFinalResultFromAggregation(authoritativeAggregation, result.finalizedAt);
        if (organizationFinalResultMaterial(authoritativeResult) !== organizationFinalResultMaterial(result)) return { result: 'denied' as const, reasonCode: 'FINAL_RESULT_NOT_AUTHORITATIVE' };
        const targetPlanStatus = result.status === 'cancelled' ? 'cancelled' : result.status === 'expired' ? 'expired' : 'completed';
        if (plan.status !== 'active' && plan.status !== targetPlanStatus) return { result: 'denied' as const, reasonCode: 'PLAN_STATUS_CONFLICT' };
        this.database.prepare(`
          INSERT INTO agent_mode_organization_final_results (
            organization_plan_id, organization_final_result_id, material_hash, schema_version, plan_version,
            root_goal_id, supervisor_agent_id, status, auditor_work_item_id, auditor_result_ref,
            work_item_results_json, total_settled_cost, aggregate_digest, finalized_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(result.organizationPlanId, result.organizationFinalResultId, materialHash, result.schemaVersion, result.planVersion, result.rootGoalId, result.supervisorAgentId, result.status, result.auditorWorkItemId, result.auditorResultRef, JSON.stringify(result.workItemResults), result.totalSettledCost, result.aggregateDigest, result.finalizedAt);
        const planUpdate = this.database.prepare('UPDATE agent_mode_organization_plans SET status = ? WHERE organization_plan_id = ? AND status = ?').run(targetPlanStatus, result.organizationPlanId, plan.status);
        if (planUpdate.changes !== 1) throw new Error('organization plan lifecycle transition conflict');
        this.appendEventIfAbsent({ eventId: `organization-finalized:${result.organizationPlanId}:${result.organizationFinalResultId}`, entityType: 'organization_plan', entityId: result.organizationPlanId, eventType: 'organization_plan_finalized', occurredAt: result.finalizedAt, payload: { organizationPlanId: result.organizationPlanId, organizationFinalResultId: result.organizationFinalResultId, status: result.status, aggregateDigest: result.aggregateDigest } });
        return { result: 'created' as const, finalResult: result };
      });
    } catch {
      return { result: 'conflict', reasonCode: 'ORGANIZATION_FINAL_RESULT_CONFLICT' };
    }
  }

  /** Bind an already-admitted K4 lifecycle to its owning organization item. */
  bindOrganizationWorkItem(input: AgentModeOrganizationBindingRequest): AgentModeOrganizationBindingResult {
    if (this.readOnly || !this.hasOrganizationTables) return { result: 'denied', reasonCode: 'ORGANIZATION_PERSISTENCE_UNAVAILABLE' };
    if (!Number.isFinite(Date.parse(input.occurredAt))) return { result: 'denied', reasonCode: 'INVALID_TIMESTAMP' };
    try {
      return this.withTransaction(() => {
        const item = this.database.prepare('SELECT * FROM agent_mode_organization_work_items WHERE organization_plan_id = ? AND work_item_id = ?').get(input.organizationPlanId, input.workItemId) as Record<string, unknown> | undefined;
        const plan = this.getOrganizationPlan(input.organizationPlanId);
        const child = this.getAgent(input.childAgentId);
        const task = this.getTask(input.taskId);
        const assignment = this.getChildAssignment(input.childAgentId);
        if (!item || !plan || !child || !task) return { result: 'denied' as const, reasonCode: 'ORGANIZATION_BINDING_NOT_FOUND' };
        if (child.rootGoalId !== plan.rootGoalId || task.childAgentId !== child.agentId || task.taskType !== 'agent-mode.child-assignment' || assignment?.taskId !== task.taskId) return { result: 'denied' as const, reasonCode: 'ORGANIZATION_BINDING_LINEAGE_MISMATCH' };
        const existingChild = item.bound_child_agent_id === null ? null : String(item.bound_child_agent_id);
        const existingTask = item.bound_task_id === null ? null : String(item.bound_task_id);
        if (existingChild !== null || existingTask !== null) {
          return existingChild === input.childAgentId && existingTask === input.taskId
            ? { result: 'duplicate' as const }
            : { result: 'conflict' as const, reasonCode: 'ORGANIZATION_BINDING_CONFLICT' };
        }
        const result = this.database.prepare(`
          UPDATE agent_mode_organization_work_items
          SET bound_child_agent_id = ?, bound_task_id = ?
          WHERE organization_plan_id = ? AND work_item_id = ?
            AND bound_child_agent_id IS NULL AND bound_task_id IS NULL
        `).run(input.childAgentId, input.taskId, input.organizationPlanId, input.workItemId);
        if (result.changes !== 1) return { result: 'conflict' as const, reasonCode: 'ORGANIZATION_BINDING_CONFLICT' };
        this.appendEventIfAbsent({ eventId: `organization-binding:${input.organizationPlanId}:${input.workItemId}`, entityType: 'organization_work_item', entityId: input.workItemId, eventType: 'organization_work_item_bound', occurredAt: input.occurredAt, payload: { organizationPlanId: input.organizationPlanId, workItemId: input.workItemId, childAgentId: input.childAgentId, taskId: input.taskId } });
        return { result: 'bound' as const };
      });
    } catch {
      return { result: 'denied', reasonCode: 'ORGANIZATION_BINDING_UNAVAILABLE' };
    }
  }

  readOrganizationPlanReadiness(organizationPlanId: string, now: string, resultFacts: readonly DelegatedResultFact[] = []): OrganizationReadiness | undefined {
    const plan = this.getOrganizationPlan(organizationPlanId);
    if (!plan) return undefined;
    const task = this.getTask(plan.rootGoalId);
    const spawnRoot = this.getSpawnRootState(plan.rootGoalId);
    const controls = this.getSpawnAdmissionControls(plan.rootGoalId);
    return evaluateOrganizationReadiness(plan, {
      now,
      root: {
        exists: task !== undefined,
        cancelled: task?.status === 'cancelled' || (spawnRoot !== undefined && spawnRoot.cancellation !== 'active'),
        killed: controls.global.denied || controls.root?.denied === true,
      },
      resultFacts,
    });
  }

  getSpawnRootState(rootGoalId: string): AgentModeSpawnRootState | undefined {
    if (!this.tableExists('agent_mode_spawn_roots')) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_spawn_roots WHERE root_goal_id = ?').get(rootGoalId) as Record<string, unknown> | undefined;
    return row ? mapSpawnRootRow(row) : undefined;
  }

  listSpawnRootStates(): AgentModeSpawnRootState[] {
    if (!this.tableExists('agent_mode_spawn_roots')) return [];
    const rows = this.database.prepare('SELECT * FROM agent_mode_spawn_roots ORDER BY root_goal_id').all() as Array<Record<string, unknown>>;
    return rows.map(mapSpawnRootRow);
  }

  getSpawnCreationReceipt(spawnIntentKey: string): AgentModeSpawnCreationReceipt | undefined {
    if (!this.tableExists('agent_mode_spawn_receipts')) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_spawn_receipts WHERE spawn_intent_key = ?').get(spawnIntentKey) as { receipt_json?: string } | undefined;
    if (!row?.receipt_json) return undefined;
    try { return JSON.parse(row.receipt_json) as AgentModeSpawnCreationReceipt; } catch { return undefined; }
  }

  setSpawnRootCancellation(rootGoalId: string, cancellation: AgentModeSpawnRootState['cancellation'], updatedAt: string): AgentModeOperationResult {
    if (this.readOnly || !this.tableExists('agent_mode_spawn_roots')) throw new Error('spawn roots are unavailable');
    if (!rootGoalId || !['active', 'requested', 'cancelled'].includes(cancellation) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('invalid root cancellation state');
    return this.withTransaction(() => {
      const result = this.database.prepare('UPDATE agent_mode_spawn_roots SET cancellation = ?, updated_at = ? WHERE root_goal_id = ?').run(cancellation, updatedAt, rootGoalId);
      if (result.changes !== 1) return 'conflict';
      this.appendEventIfAbsent({ eventId: `spawn-root-cancellation:${rootGoalId}:${updatedAt}`, entityType: 'spawn_root', entityId: rootGoalId, eventType: 'spawn_root_cancellation_changed', occurredAt: updatedAt, payload: { cancellation } });
      return 'created';
    });
  }

  setSpawnRootDeadline(rootGoalId: string, deadline: string, updatedAt: string): AgentModeOperationResult {
    if (this.readOnly || !this.tableExists('agent_mode_spawn_roots')) throw new Error('spawn roots are unavailable');
    if (!rootGoalId || !Number.isFinite(Date.parse(deadline)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('invalid root deadline');
    return this.withTransaction(() => {
      const result = this.database.prepare('UPDATE agent_mode_spawn_roots SET deadline = ?, updated_at = ? WHERE root_goal_id = ?').run(deadline, updatedAt, rootGoalId);
      if (result.changes !== 1) return 'conflict';
      this.appendEventIfAbsent({ eventId: `spawn-root-deadline:${rootGoalId}:${updatedAt}`, entityType: 'spawn_root', entityId: rootGoalId, eventType: 'spawn_root_deadline_changed', occurredAt: updatedAt, payload: { deadline } });
      return 'created';
    });
  }

  reserveSpawnAndCreateChild(input: AgentModeSpawnCreationInput): AgentModeSpawnCreationResult {
    try {
      return this.withTransaction(() => this.reserveSpawnAndCreateChildInternal(input));
    } catch (error) {
      return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
  }

  retireChildAgent(childAgentId: string, reason: 'retired' | 'cancelled' | 'expired', retiredAt: string): { result: 'retired' | 'duplicate' | 'conflict'; childAgentId: string } {
    try {
      return this.withTransaction(() => this.retireChildAgentInternal(childAgentId, reason, retiredAt));
    } catch {
      return { result: 'conflict', childAgentId };
    }
  }

  reconcileExpiredChildAgents(now: string, limit = 64): string[] {
    try {
      return this.withTransaction(() => this.reconcileExpiredChildAgentsInternal(now, limit));
    } catch {
      return [];
    }
  }

  private reconcileExpiredChildAgentsInternal(now: string, limit: number): string[] {
    if (!Number.isFinite(Date.parse(now)) || !Number.isSafeInteger(limit) || limit < 1 || limit > 64) return [];
    const rows = this.database.prepare(`
      SELECT agent_id FROM agents
      WHERE spawn_intent_key IS NOT NULL AND status IN ('reserved', 'assigned') AND expires_at <= ?
      ORDER BY expires_at, agent_id LIMIT ?
    `).all(now, limit) as Array<{ agent_id?: string }>;
    const retired: string[] = [];
    for (const row of rows) {
      const result = this.retireChildAgentInternal(String(row.agent_id), 'expired', now);
      if (result.result === 'retired') retired.push(result.childAgentId);
    }
    return retired;
  }

  private retireChildAgentInternal(childAgentId: string, reason: 'retired' | 'cancelled' | 'expired', retiredAt: string): { result: 'retired' | 'duplicate' | 'conflict'; childAgentId: string } {
    if (!childAgentId || !Number.isFinite(Date.parse(retiredAt))) return { result: 'conflict', childAgentId };
    const child = this.getAgent(childAgentId);
    if (!child?.spawnIntentKey || !child.rootGoalId || child.status === 'active' || child.status === 'paused') return { result: 'conflict', childAgentId };
    if (child.status !== 'reserved' && child.status !== 'assigned') return { result: 'duplicate', childAgentId };
    if (child.status === 'assigned') {
      const assignment = this.database.prepare('SELECT * FROM agent_mode_child_assignments WHERE child_agent_id = ?').get(childAgentId) as Record<string, unknown> | undefined;
      if (!assignment || assignment.status !== 'dispatch_ready') throw new Error('assigned child has no dispatch-ready assignment');
      const reservationId = String(assignment.reservation_id);
      if (this.getReservation(reservationId)?.status === 'reserved') {
        this.settleBudgetInternal({ reservationId, steps: 0, tokens: 0, dollars: 0, settledAt: retiredAt });
      }
      const assignmentStatus = reason === 'expired' ? 'expired' : 'cancelled';
      this.database.prepare("UPDATE attempts SET status = 'cancelled', cancellation_status = 'completed', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(retiredAt, String(assignment.attempt_id));
      this.database.prepare("UPDATE runs SET status = 'cancelled' WHERE run_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(String(assignment.run_id));
      this.database.prepare("UPDATE tasks SET status = 'cancelled' WHERE task_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(String(assignment.task_id));
      this.database.prepare('UPDATE agent_mode_child_assignments SET status = ?, updated_at = ? WHERE assignment_intent_key = ? AND status = \'dispatch_ready\'').run(assignmentStatus, retiredAt, String(assignment.assignment_intent_key));
      this.appendEventIfAbsent({ eventId: `child-assignment-${assignmentStatus}:${String(assignment.assignment_intent_key)}`, entityType: 'child_assignment', entityId: String(assignment.assignment_intent_key), eventType: 'child_assignment_invalidated', occurredAt: retiredAt, payload: { assignmentIntentKey: String(assignment.assignment_intent_key), childAgentId, reason: assignmentStatus } });
    }
    const root = this.getSpawnRootState(child.rootGoalId);
    if (!root || root.activeChildren < 1 || root.reservedChildSteps < (child.reservedChildSteps ?? 0) || root.reservedChildCost < (child.reservedChildCost ?? 0)) throw new Error('spawn root aggregate is inconsistent');
    const result = this.database.prepare(`
      UPDATE agent_mode_spawn_roots SET
        active_children = active_children - 1,
        reserved_child_steps = reserved_child_steps - ?,
        reserved_child_cost = reserved_child_cost - ?,
        updated_at = ?
      WHERE root_goal_id = ? AND active_children > 0
        AND reserved_child_steps >= ? AND reserved_child_cost >= ?
    `).run(child.reservedChildSteps ?? 0, child.reservedChildCost ?? 0, retiredAt, child.rootGoalId, child.reservedChildSteps ?? 0, child.reservedChildCost ?? 0);
    if (result.changes !== 1) throw new Error('spawn root aggregate release failed');
    this.database.prepare("UPDATE agents SET status = ?, reserved_child_steps = 0, reserved_child_cost = 0 WHERE agent_id = ? AND status IN ('reserved', 'assigned')").run(reason, childAgentId);
    this.appendEventIfAbsent({ eventId: `child-agent-retired:${childAgentId}:${reason}`, entityType: 'agent', entityId: childAgentId, eventType: 'child_agent_retired', occurredAt: retiredAt, payload: { childAgentId, spawnIntentKey: child.spawnIntentKey, rootGoalId: child.rootGoalId, reason, releasedStepAllocation: child.reservedChildSteps ?? 0, releasedCostAllocation: child.reservedChildCost ?? 0 } });
    return { result: 'retired', childAgentId };
  }

  private reserveSpawnAndCreateChildInternal(input: AgentModeSpawnCreationInput): AgentModeSpawnCreationResult {
    const { request, admission, facts } = input;
    const intent = request.schemaVersion === 1 ? spawnIntentKey(request) : null;
    const materialHash = request.schemaVersion === 1 ? spawnCreationMaterialHash(request) : null;
    if (admission.result !== 'ALLOW' || !intent || admission.spawnIntentKey !== intent || admission.creationMaterialHash !== materialHash) return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    const existingRow = this.database.prepare('SELECT immutable_material_hash, receipt_json FROM agent_mode_spawn_receipts WHERE spawn_intent_key = ?').get(intent) as { immutable_material_hash?: string; receipt_json?: string } | undefined;
    if (existingRow) {
      if (existingRow.immutable_material_hash !== materialHash) return { result: 'conflict', reasonCode: 'INVALID_REQUEST' };
      try { return { result: 'duplicate', receipt: JSON.parse(String(existingRow.receipt_json)) as AgentModeSpawnCreationReceipt }; } catch { return { result: 'conflict', reasonCode: 'INVALID_REQUEST' }; }
    }
    const policy = getSpawnPolicy(request.policyId, request.policyVersion);
    const template = getRoleTemplate(request.roleTemplateId, request.roleTemplateVersion);
    if (!policy || !template) return { result: 'denied', reasonCode: 'POLICY_NOT_FOUND' };
    if (!request.rootGoalId || !facts.root || facts.root.rootGoalId !== request.rootGoalId) return { result: 'denied', reasonCode: 'ROOT_MISMATCH' };
    this.reconcileExpiredChildAgentsInternal(facts.now, 64);
    const controls = this.getSpawnAdmissionControls(request.rootGoalId);
    let root = this.getSpawnRootState(request.rootGoalId);
    if (!root) {
      const maxAggregateChildSteps = Math.min(policy.rootBudgetRules.maxAggregateChildSteps, facts.root.remainingSteps);
      const maxAggregateChildCost = Math.min(policy.rootBudgetRules.maxAggregateChildBudget, facts.root.remainingBudget);
      this.database.prepare(`
        INSERT INTO agent_mode_spawn_roots (
          root_goal_id, policy_id, policy_version, max_concurrent_children,
          max_total_child_creations, max_aggregate_child_steps, max_aggregate_child_cost,
          depth, cancellation, deadline, delegable_capabilities_json,
          repository_scopes_json, resource_scopes_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(request.rootGoalId, policy.policyId, policy.version, policy.maxConcurrentChildren, policy.maxTotalChildCreations, maxAggregateChildSteps, maxAggregateChildCost, facts.root.depth, facts.root.cancellation, facts.root.deadline, stringArrayJson(facts.root.delegableCapabilities), stringArrayJson(facts.root.repositoryScopes), stringArrayJson(facts.root.resourceScopes), facts.now);
      root = this.getSpawnRootState(request.rootGoalId);
    }
    if (!root || root.policyId !== policy.policyId || root.policyVersion !== policy.version) return { result: 'denied', reasonCode: 'PARENT_INVALID' };
    const rootTask = this.getTask(request.rootGoalId);
    const rootCancellation = rootTask?.status === 'cancelled' ? 'cancelled' : root.cancellation;
    const freshFacts: SpawnAuthorityFacts = {
      now: facts.now,
      globalKillSwitchDenied: controls.global.denied,
      rootKillSwitchDenied: controls.root?.denied ?? false,
      authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
      root: {
        rootGoalId: root.rootGoalId, depth: root.depth, activeChildren: root.activeChildren, totalChildCreations: root.totalChildCreations,
        cancellation: rootCancellation, remainingSteps: root.maxAggregateChildSteps - root.reservedChildSteps, remainingBudget: root.maxAggregateChildCost - root.reservedChildCost,
        deadline: root.deadline, delegableCapabilities: root.delegableCapabilities, repositoryScopes: root.repositoryScopes, resourceScopes: root.resourceScopes,
      },
      parent: this.freshParentFacts(request),
    };
    const freshDecision = evaluateSpawnAdmission(request, freshFacts);
    if (freshDecision.result !== 'ALLOW') return { result: 'denied', reasonCode: freshDecision.reasonCode };
    const update = this.database.prepare(`
      UPDATE agent_mode_spawn_roots SET
        active_children = active_children + 1,
        total_child_creations = total_child_creations + 1,
        reserved_child_steps = reserved_child_steps + ?,
        reserved_child_cost = reserved_child_cost + ?,
        updated_at = ?
      WHERE root_goal_id = ? AND policy_id = ? AND policy_version = ?
        AND cancellation = 'active' AND deadline > ?
        AND active_children < max_concurrent_children
        AND total_child_creations < max_total_child_creations
        AND reserved_child_steps + ? <= max_aggregate_child_steps
        AND reserved_child_cost + ? <= max_aggregate_child_cost
    `).run(request.requestedStepBudget, request.requestedCostBudget, facts.now, request.rootGoalId, policy.policyId, policy.version, facts.now, request.requestedStepBudget, request.requestedCostBudget);
    if (update.changes !== 1) return { result: 'denied', reasonCode: this.classifyCurrentSpawnDenial(request.rootGoalId, request.requestedStepBudget, request.requestedCostBudget) };
    const childAgentId = `agent:child:${createHash('sha256').update(intent).digest('hex')}`;
    const expiresAt = new Date(Date.parse(request.requestedAt) + request.requestedTtl).toISOString();
    this.database.prepare(`
      INSERT INTO agents (
        agent_id, agent_kind, role, display_name, policy_id, status,
        role_template_id, role_template_version, policy_version,
        parent_agent_id, parent_task_id, parent_run_id, root_goal_id,
        spawn_intent_key, source_event_id, spawn_depth, repository_scope,
        resource_scope, capability_set_hash, capabilities_json,
        requested_child_steps, reserved_child_steps, requested_child_cost,
        reserved_child_cost, child_created_at, expires_at
      ) VALUES (?, 'worker', ?, ?, ?, 'reserved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(childAgentId, template.roleTemplateId, template.displayName, policy.policyId, template.roleTemplateId, template.version, policy.version, request.parentAgentId, request.parentTaskId, request.parentRunId, request.rootGoalId, intent, request.sourceEventId, request.requestedDepth, request.requestedScope.repositoryRef, request.requestedScope.resourceRef, materialHash, stringArrayJson(request.requestedCapabilities), request.requestedStepBudget, request.requestedStepBudget, request.requestedCostBudget, request.requestedCostBudget, facts.now, expiresAt);
    const receipt: AgentModeSpawnCreationReceipt = {
      spawnIntentKey: intent, childAgentId, rootGoalId: request.rootGoalId, parentAgentId: request.parentAgentId, parentTaskId: request.parentTaskId, parentRunId: request.parentRunId,
      roleTemplateId: template.roleTemplateId, roleTemplateVersion: template.version, policyId: policy.policyId, policyVersion: policy.version,
      activeSlotReserved: true, stepAllocation: request.requestedStepBudget, costAllocation: request.requestedCostBudget, depth: request.requestedDepth, createdAt: facts.now, expiresAt,
    };
    const receiptJson = JSON.stringify(receipt);
    if (receiptJson.length > 8_192) throw new Error('spawn receipt exceeds bounded size');
    this.database.prepare('INSERT INTO agent_mode_spawn_receipts (spawn_intent_key, child_agent_id, immutable_material_hash, receipt_json, created_at) VALUES (?, ?, ?, ?, ?)').run(intent, childAgentId, materialHash, receiptJson, facts.now);
    this.appendEventIfAbsent({ eventId: `child-agent-created:${intent}`, entityType: 'agent', entityId: childAgentId, eventType: 'child_agent_created', occurredAt: facts.now, payload: { childAgentId, spawnIntentKey: intent, rootGoalId: request.rootGoalId, parentAgentId: request.parentAgentId, parentTaskId: request.parentTaskId, parentRunId: request.parentRunId, roleTemplateId: template.roleTemplateId, roleTemplateVersion: template.version, sourceEventId: request.sourceEventId, policyId: policy.policyId, policyVersion: policy.version, depth: request.requestedDepth } });
    return { result: 'created', receipt };
  }

  getChildAssignment(childAgentId: string): AgentModeChildAssignment | undefined {
    if (!this.hasChildAssignmentTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_child_assignments WHERE child_agent_id = ?').get(childAgentId) as Record<string, unknown> | undefined;
    return row ? mapChildAssignmentRow(row) : undefined;
  }

  listChildAssignments(limit = 32): AgentModeChildAssignment[] {
    if (!this.hasChildAssignmentTables) return [];
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 32));
    const rows = this.database.prepare('SELECT * FROM agent_mode_child_assignments ORDER BY created_at, assignment_intent_key LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>;
    return rows.map(mapChildAssignmentRow);
  }

  getChildAssignmentReceipt(assignmentIntent: string): AgentModeChildAssignmentReceipt | undefined {
    if (!this.hasChildAssignmentTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_child_assignments WHERE assignment_intent_key = ?').get(assignmentIntent) as { receipt_json?: string } | undefined;
    if (!row?.receipt_json) return undefined;
    try { return JSON.parse(row.receipt_json) as AgentModeChildAssignmentReceipt; } catch { return undefined; }
  }

  getPreparedChildDispatch(assignmentIntent: string, now = new Date().toISOString()): AgentModePreparedChildDispatch | undefined {
    if (!this.hasChildAssignmentTables || !Number.isFinite(Date.parse(now))) return undefined;
    const row = this.database.prepare("SELECT * FROM agent_mode_child_assignments WHERE assignment_intent_key = ? AND status = 'dispatch_ready'").get(assignmentIntent) as Record<string, unknown> | undefined;
    if (!row || Date.parse(String(row.deadline)) <= Date.parse(now)) return undefined;
    const child = this.getAgent(String(row.child_agent_id));
    if (!child || child.status !== 'assigned' || (child.expiresAt !== undefined && Date.parse(child.expiresAt) <= Date.parse(now))) return undefined;
    return {
      assignmentIntentKey: String(row.assignment_intent_key), childAgentId: child.agentId,
      taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id),
      runtimeRef: String(row.runtime_ref), runtimeProfileRef: String(row.runtime_profile_ref),
      roleTemplateId: String(row.role_template_id), roleTemplateVersion: Number(row.role_template_version),
      policyId: String(row.policy_id), policyVersion: Number(row.policy_version),
      capabilitySetHash: String(row.capability_set_hash), capabilities: parseStringArray(row.capabilities_json),
      repositoryScope: row.repository_scope === null ? null : String(row.repository_scope),
      resourceScope: row.resource_scope === null ? null : String(row.resource_scope),
      rootGoalId: String(row.root_goal_id), sourceEventId: String(row.source_event_id),
      stepCeiling: Number(row.requested_steps), costCeiling: Number(row.requested_cost),
      tokenCeiling: Number(row.requested_tokens ?? 0),
      remainingTokens: Number(row.requested_tokens ?? 0),
      remainingSteps: Math.max(0, (child.reservedChildSteps ?? 0) - Number(row.requested_steps)),
      remainingCost: Math.max(0, (child.reservedChildCost ?? 0) - Number(row.requested_cost)),
      deadline: String(row.deadline), status: 'dispatch_ready',
    };
  }

  prepareRuntimeDispatch(request: AgentModeRuntimeDispatchRequest): AgentModeRuntimeDispatchStorePreparation {
    if (this.readOnly || !this.hasChildAssignmentTables || !validateRuntimeDispatchRequest(request)) return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    try {
      return this.withTransaction(() => this.prepareRuntimeDispatchInternal(request));
    } catch {
      return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
  }

  private prepareRuntimeDispatchInternal(request: AgentModeRuntimeDispatchRequest): AgentModeRuntimeDispatchStorePreparation {
    const existingEffect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(request.operationId) as Record<string, unknown> | undefined;
    const existingOutbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(request.operationId) as Record<string, unknown> | undefined;
    if (existingEffect || existingOutbox) {
      if (!existingEffect || !existingOutbox
        || existingEffect.attempt_id !== request.attemptId
        || existingOutbox.attempt_id !== request.attemptId
        || existingEffect.dispatch_id !== request.dispatchId
        || existingOutbox.dispatch_id !== request.dispatchId
        || existingEffect.assignment_intent_key !== request.assignmentIntentKey
        || existingOutbox.assignment_intent_key !== request.assignmentIntentKey
        || existingEffect.child_agent_id !== request.childAgentId
        || existingOutbox.child_agent_id !== request.childAgentId
        || existingEffect.runtime_ref !== request.runtimeRef
        || existingOutbox.runtime_ref !== request.runtimeRef
        || existingEffect.runtime_profile_ref !== request.runtimeProfileRef
        || existingOutbox.runtime_profile_ref !== request.runtimeProfileRef) return { result: 'denied', reasonCode: 'DISPATCH_IDENTITY_MISMATCH' };
      const receipt = this.parseRuntimeReceipt(existingEffect.receipt_json);
      if (existingOutbox.state === 'uncertain' || existingEffect.status === 'uncertain' || existingOutbox.state === 'dispatched' || existingEffect.status === 'dispatched') {
        return { result: 'uncertain', reasonCode: 'RUNTIME_UNCERTAIN', ...(receipt ? { receipt } : {}) };
      }
      if (['verified', 'failed', 'cancelled'].includes(String(existingOutbox.state)) && receipt) return { result: 'terminal', receipt };
    }

    const assignment = this.getChildAssignment(request.childAgentId);
    if (!assignment || assignment.assignmentIntentKey !== request.assignmentIntentKey) return { result: 'denied', reasonCode: 'ASSIGNMENT_NOT_READY' };
    if (assignment.taskId !== request.taskId || assignment.runId !== request.runId || assignment.attemptId !== request.attemptId
      || assignment.runtimeRef !== request.runtimeRef || assignment.runtimeProfileRef !== request.runtimeProfileRef) return { result: 'denied', reasonCode: 'DISPATCH_IDENTITY_MISMATCH' };
    const child = this.getAgent(request.childAgentId);
    const task = this.getTask(request.taskId);
    const run = this.getRun(request.runId);
    const attempt = this.getAttempt(request.attemptId);
    if (!child || !task || !run || !attempt) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
    const continuation = existingOutbox?.state === 'receipt_recorded' || existingOutbox?.state === 'verified';
    const authorityFailure = this.runtimeDispatchAuthority(request, assignment, child, task, run, attempt, request.requestedAt, !continuation);
    if (authorityFailure) return { result: 'denied', reasonCode: authorityFailure };
    const resourceKey = runtimeDispatchResourceKey(request.attemptId);
    let lease = this.getLease(resourceKey);
    const storedLeaseId = existingOutbox?.lease_id == null ? undefined : String(existingOutbox.lease_id);
    const storedFence = existingOutbox?.lease_fence == null ? undefined : Number(existingOutbox.lease_fence);
    const activeStoredLease = lease && storedLeaseId === lease.leaseId && storedFence === lease.fence && Date.parse(lease.expiresAt) > Date.parse(request.requestedAt);
    if (lease && Date.parse(lease.expiresAt) > Date.parse(request.requestedAt) && !activeStoredLease) return { result: 'denied', reasonCode: 'LEASE_CONFLICT' };
    if (!activeStoredLease) {
      lease = this.acquireLeaseAt({ leaseId: `${resourceKey}:${request.controllerRef}:${request.dispatchId}`, resourceKey, ownerId: request.controllerRef, expiresAt: assignment.deadline }, request.requestedAt);
      if (!lease) return { result: 'denied', reasonCode: 'LEASE_CONFLICT' };
      this.database.prepare('UPDATE attempts SET lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?, updated_at = ? WHERE attempt_id = ?')
        .run(resourceKey, lease.leaseId, lease.ownerId, lease.fence, request.requestedAt, request.attemptId);
    }
    if (!lease) return { result: 'denied', reasonCode: 'LEASE_CONFLICT' };
    if (!existingEffect) {
      const prepared = this.prepareOperation({
        operationId: request.operationId,
        attemptId: request.attemptId,
        effectKind: 'runtime.dispatch',
        capabilityId: 'runtime.dispatch',
        scopeHash: attempt.capabilityScopeHash,
        policyVersion: attempt.policyVersion,
        leaseResourceKey: resourceKey,
        leaseId: lease.leaseId,
        leaseFence: lease.fence,
        deadline: assignment.deadline,
        preparedAt: request.requestedAt,
      });
      if (prepared === 'conflict') return { result: 'denied', reasonCode: 'DISPATCH_CONFLICT' };
    } else if (!activeStoredLease) {
      this.database.prepare('UPDATE effects SET lease_resource_key = ?, lease_id = ?, lease_fence = ?, controller_ref = ? WHERE operation_id = ?')
        .run(resourceKey, lease.leaseId, lease.fence, request.controllerRef, request.operationId);
      this.database.prepare('UPDATE dispatch_outbox SET lease_resource_key = ?, lease_id = ?, lease_fence = ?, controller_ref = ? WHERE operation_id = ?')
        .run(resourceKey, lease.leaseId, lease.fence, request.controllerRef, request.operationId);
    }
    this.database.prepare('UPDATE effects SET dispatch_id = ?, assignment_intent_key = ?, child_agent_id = ?, runtime_ref = ?, runtime_profile_ref = ?, controller_ref = ? WHERE operation_id = ?')
      .run(request.dispatchId, request.assignmentIntentKey, request.childAgentId, request.runtimeRef, request.runtimeProfileRef, request.controllerRef, request.operationId);
    this.database.prepare('UPDATE dispatch_outbox SET dispatch_id = ?, assignment_intent_key = ?, child_agent_id = ?, runtime_ref = ?, runtime_profile_ref = ?, controller_ref = ? WHERE operation_id = ?')
      .run(request.dispatchId, request.assignmentIntentKey, request.childAgentId, request.runtimeRef, request.runtimeProfileRef, request.controllerRef, request.operationId);
    if (!existingEffect) this.appendEventIfAbsent({ eventId: `runtime-dispatch-prepared:${request.operationId}`, entityType: 'attempt', entityId: request.attemptId, eventType: 'runtime_dispatch_prepared', occurredAt: request.requestedAt, payload: { operationId: request.operationId, dispatchId: request.dispatchId, childAgentId: request.childAgentId, assignmentIntentKey: request.assignmentIntentKey, runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef, leaseId: lease.leaseId, fence: lease.fence, deadline: assignment.deadline } });
    const outbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(request.operationId) as Record<string, unknown>;
    const phase = outbox.state === 'receipt_recorded' ? 'receipt_recorded' : outbox.state === 'verified' ? 'verified' : 'dispatchable';
    return { result: 'ready', prepared: this.makeRuntimeDispatchPrepared(request, this.runtimeDispatchAssignment(assignment, child), lease, phase, this.parseRuntimeReceipt(existingEffect?.receipt_json)) };
  }

  private runtimeDispatchAuthority(
    request: AgentModeRuntimeDispatchRequest,
    assignment: AgentModeChildAssignment,
    child: AgentModeAgent,
    task: AgentModeTask,
    run: AgentModeRun,
    attempt: AgentModeAttempt,
    now: string,
    beforeInvocation: boolean,
  ): string | undefined {
    if (assignment.rootGoalId !== child.rootGoalId) return 'DISPATCH_IDENTITY_MISMATCH';
    if (child.rootGoalId !== assignment.rootGoalId || child.status === 'expired') return 'CHILD_EXPIRED';
    if (beforeInvocation && child.status !== 'assigned') return child.status === 'cancelled' ? 'CANCELLATION_REQUESTED' : 'CHILD_NOT_ASSIGNED';
    if (!beforeInvocation && child.status !== 'assigned' && child.status !== 'running') return child.status === 'cancelled' ? 'CANCELLATION_REQUESTED' : 'ASSIGNMENT_NOT_READY';
    if (beforeInvocation && assignment.status !== 'dispatch_ready') return assignment.status === 'uncertain' ? 'RUNTIME_UNCERTAIN' : 'ASSIGNMENT_NOT_READY';
    if (task.childAgentId !== child.agentId || task.assignmentIntentKey !== assignment.assignmentIntentKey
      || run.taskId !== task.taskId || run.agentId !== child.agentId || run.childAgentId !== child.agentId || run.assignmentIntentKey !== assignment.assignmentIntentKey
      || attempt.runId !== run.runId || attempt.agentId !== child.agentId || attempt.childAgentId !== child.agentId || attempt.assignmentIntentKey !== assignment.assignmentIntentKey) return 'DISPATCH_IDENTITY_MISMATCH';
    if (attempt.runtimeRef !== assignment.runtimeRef || attempt.runtimeProfileRef !== assignment.runtimeProfileRef || assignment.runtimeRef !== request.runtimeRef || assignment.runtimeProfileRef !== request.runtimeProfileRef) return 'RUNTIME_MISMATCH';
    if (assignment.repositoryScope !== child.repositoryScope || assignment.resourceScope !== child.resourceScope || assignment.requestedSteps > (child.reservedChildSteps ?? -1) || assignment.requestedCost > (child.reservedChildCost ?? -1)) return 'SCOPE_MISMATCH';
    const policy = getSpawnPolicy(assignment.policyId, assignment.policyVersion);
    const template = getRoleTemplate(assignment.roleTemplateId, assignment.roleTemplateVersion);
    if (!policy || !template || template.roleTemplateId !== assignment.roleTemplateId || template.version !== assignment.roleTemplateVersion || policy.policyId !== assignment.policyId || policy.version !== assignment.policyVersion) return 'RUNTIME_PROFILE_INVALID';
    if (['completed', 'failed', 'cancelled', 'uncertain'].includes(attempt.status)) return attempt.status === 'uncertain' ? 'RUNTIME_UNCERTAIN' : 'ALREADY_SETTLED';
    if (beforeInvocation && attempt.status !== 'admitted') return attempt.status === 'running' ? 'ALREADY_DISPATCHED' : 'ASSIGNMENT_NOT_READY';
    if (beforeInvocation && (task.status !== 'admitted' || run.status !== 'created')) return 'ASSIGNMENT_NOT_READY';
    if (beforeInvocation && attempt.cancellationStatus !== 'running') return 'CANCELLATION_REQUESTED';
    if (Date.parse(assignment.deadline) <= Date.parse(now) || (child.expiresAt !== undefined && Date.parse(child.expiresAt) <= Date.parse(now))) return 'DEADLINE_EXPIRED';
    const root = this.getSpawnRootState(assignment.rootGoalId);
    if (!root || root.rootGoalId !== assignment.rootGoalId || root.policyId !== assignment.policyId || root.policyVersion !== assignment.policyVersion) return 'DISPATCH_IDENTITY_MISMATCH';
    if (Date.parse(root.deadline) <= Date.parse(now)) return 'DEADLINE_EXPIRED';
    if (beforeInvocation) {
      const controls = this.getSpawnAdmissionControls(assignment.rootGoalId);
      if (controls.global.denied) return 'GLOBAL_KILL_SWITCH';
      if (controls.root?.denied) return 'ROOT_KILL_SWITCH';
      if (root.cancellation !== 'active' || this.getTask(root.rootGoalId)?.status === 'cancelled') return 'CANCELLATION_REQUESTED';
      if (child.parentTaskId && this.getTask(child.parentTaskId)?.status === 'cancelled') return 'CANCELLATION_REQUESTED';
      if (child.parentRunId && this.getRun(child.parentRunId)?.status === 'cancelled') return 'CANCELLATION_REQUESTED';
    }
    const profile = getRuntimeProfile(request.runtimeRef, request.runtimeProfileRef);
    if (!profile || !profile.allowedRoleTemplateIds.includes(assignment.roleTemplateId) || child.capabilities?.some((capability) => !profile.allowedCapabilities.includes(capability))) return 'RUNTIME_PROFILE_INVALID';
    const reservation = attempt.reservationId ? this.getReservation(attempt.reservationId) : undefined;
    const budget = this.getBudget(attempt.budgetScopeId);
    if (!reservation || reservation.reservationId !== assignment.reservationId || reservation.status !== 'reserved' || !budget
      || budget.usedSteps + budget.reservedSteps > budget.maxSteps || budget.usedDollars + budget.reservedDollars > budget.maxDollars) return 'AUTHORITY_UNAVAILABLE';
    return undefined;
  }

  private runtimeDispatchAssignment(assignment: AgentModeChildAssignment, child: AgentModeAgent): AgentModePreparedChildDispatch {
    return {
      assignmentIntentKey: assignment.assignmentIntentKey,
      childAgentId: assignment.childAgentId,
      taskId: assignment.taskId,
      runId: assignment.runId,
      attemptId: assignment.attemptId,
      runtimeRef: assignment.runtimeRef,
      runtimeProfileRef: assignment.runtimeProfileRef,
      roleTemplateId: assignment.roleTemplateId,
      roleTemplateVersion: assignment.roleTemplateVersion,
      policyId: assignment.policyId,
      policyVersion: assignment.policyVersion,
      capabilitySetHash: assignment.capabilitySetHash,
      capabilities: assignment.capabilities,
      repositoryScope: assignment.repositoryScope,
      resourceScope: assignment.resourceScope,
      rootGoalId: assignment.rootGoalId,
      sourceEventId: assignment.sourceEventId,
      stepCeiling: assignment.requestedSteps,
      costCeiling: assignment.requestedCost,
      tokenCeiling: assignment.requestedTokens,
      remainingTokens: assignment.requestedTokens,
      remainingSteps: Math.max(0, (child.reservedChildSteps ?? 0) - assignment.requestedSteps),
      remainingCost: Math.max(0, (child.reservedChildCost ?? 0) - assignment.requestedCost),
      deadline: assignment.deadline,
      status: 'dispatch_ready',
    };
  }

  private makeRuntimeDispatchPrepared(
    request: AgentModeRuntimeDispatchRequest,
    assignment: AgentModePreparedChildDispatch,
    lease: AgentModeLease,
    phase: AgentModeRuntimeDispatchPrepared['phase'],
    receipt?: AgentModeRuntimeReceipt,
  ): AgentModeRuntimeDispatchPrepared {
    return { request, assignment, operationId: request.operationId, dispatchId: request.dispatchId, resourceKey: lease.resourceKey, leaseId: lease.leaseId, fence: lease.fence, leaseExpiresAt: lease.expiresAt, preparedAt: request.requestedAt, phase, ...(receipt ? { receipt } : {}) };
  }

  prepareRuntimeDispatchReconciliation(request: AgentModeRuntimeDispatchRequest): AgentModeRuntimeDispatchStorePreparation {
    if (this.readOnly || !this.hasChildAssignmentTables || !validateRuntimeDispatchRequest(request)) return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    try {
      return this.withTransaction(() => {
        const outbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(request.operationId) as Record<string, unknown> | undefined;
        const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(request.operationId) as Record<string, unknown> | undefined;
        const assignment = this.getChildAssignment(request.childAgentId);
        const child = this.getAgent(request.childAgentId);
        const attempt = this.getAttempt(request.attemptId);
        if (!outbox || !effect || !assignment || !child || !attempt) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        if (outbox.state !== 'uncertain' || effect.status !== 'uncertain' || outbox.dispatch_id !== request.dispatchId || outbox.assignment_intent_key !== request.assignmentIntentKey || outbox.child_agent_id !== request.childAgentId || outbox.attempt_id !== request.attemptId || outbox.runtime_ref !== request.runtimeRef || outbox.runtime_profile_ref !== request.runtimeProfileRef) return { result: 'denied', reasonCode: 'RECONCILIATION_NOT_REQUIRED' };
        const resourceKey = runtimeDispatchResourceKey(request.attemptId);
        let lease = this.getLease(resourceKey);
        if (lease && lease.ownerId !== request.controllerRef && Date.parse(lease.expiresAt) > Date.parse(request.requestedAt)) return { result: 'denied', reasonCode: 'LEASE_CONFLICT' };
        if (!lease || lease.ownerId !== request.controllerRef || Date.parse(lease.expiresAt) <= Date.parse(request.requestedAt)) {
          lease = this.acquireLeaseAt({ leaseId: `${resourceKey}:${request.controllerRef}:${request.dispatchId}:reconcile`, resourceKey, ownerId: request.controllerRef, expiresAt: assignment.deadline }, request.requestedAt);
        }
        if (!lease) return { result: 'denied', reasonCode: 'LEASE_CONFLICT' };
        this.database.prepare('UPDATE attempts SET lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?, updated_at = ? WHERE attempt_id = ?').run(resourceKey, lease.leaseId, request.controllerRef, lease.fence, request.requestedAt, request.attemptId);
        this.database.prepare('UPDATE effects SET lease_resource_key = ?, lease_id = ?, lease_fence = ?, controller_ref = ? WHERE operation_id = ?').run(resourceKey, lease.leaseId, lease.fence, request.controllerRef, request.operationId);
        this.database.prepare('UPDATE dispatch_outbox SET lease_resource_key = ?, lease_id = ?, lease_fence = ?, controller_ref = ? WHERE operation_id = ?').run(resourceKey, lease.leaseId, lease.fence, request.controllerRef, request.operationId);
        return { result: 'ready', prepared: this.makeRuntimeDispatchPrepared(request, this.runtimeDispatchAssignment(assignment, child), lease, 'dispatched', this.parseRuntimeReceipt(effect.receipt_json)) };
      });
    } catch {
      return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
  }

  getRuntimeDispatchPreparation(operationId: string, controllerRef: string, now: string): AgentModeRuntimeDispatchStorePreparation {
    const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    const effect = this.database.prepare('SELECT receipt_json FROM effects WHERE operation_id = ?').get(operationId) as { receipt_json?: string } | undefined;
    if (!row || !effect) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
    const receipt = this.parseRuntimeReceipt(effect.receipt_json);
    if (row.state === 'uncertain') return { result: 'uncertain', reasonCode: 'RUNTIME_UNCERTAIN', ...(receipt ? { receipt } : {}) };
    if (['verified', 'failed', 'cancelled'].includes(String(row.state)) && receipt) return { result: 'terminal', receipt };
    const assignment = this.getChildAssignment(String(row.child_agent_id));
    const child = this.getAgent(String(row.child_agent_id));
    const lease = this.getLease(String(row.lease_resource_key));
    if (!assignment || !child || !lease || !row.dispatch_id || !row.assignment_intent_key || !row.controller_ref) return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    const request: AgentModeRuntimeDispatchRequest = { schemaVersion: 1, dispatchId: String(row.dispatch_id), operationId, assignmentIntentKey: String(row.assignment_intent_key), childAgentId: String(row.child_agent_id), taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId, runtimeRef: String(row.runtime_ref), runtimeProfileRef: String(row.runtime_profile_ref), controllerRef, requestedAt: now };
    if (lease.ownerId !== controllerRef && Date.parse(lease.expiresAt) > Date.parse(now)) return { result: 'denied', reasonCode: 'LEASE_CONFLICT' };
    return { result: 'ready', prepared: this.makeRuntimeDispatchPrepared(request, this.runtimeDispatchAssignment(assignment, child), lease, row.state === 'receipt_recorded' ? 'receipt_recorded' : row.state === 'verified' ? 'verified' : 'dispatchable', receipt) };
  }

  markRuntimeDispatchStarted(operationId: string, controllerRef: string, leaseId: string, fence: number, now: string): AgentModeRuntimeDispatchMutation {
    try {
      return this.withTransaction(() => {
        const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        if (!row) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        if (row.state === 'dispatched' || row.state === 'receipt_recorded' || row.state === 'verified' || row.state === 'failed' || row.state === 'cancelled') return { result: 'denied', reasonCode: 'ALREADY_DISPATCHED' };
        if (row.state !== 'dispatchable' || row.controller_ref !== controllerRef || row.lease_id !== leaseId || Number(row.lease_fence) !== fence) return { result: 'denied', reasonCode: 'STALE_FENCE' };
        const assignment = this.getChildAssignment(String(row.child_agent_id)); const child = this.getAgent(String(row.child_agent_id)); const task = assignment ? this.getTask(assignment.taskId) : undefined; const run = assignment ? this.getRun(assignment.runId) : undefined; const attempt = this.getAttempt(String(row.attempt_id));
        if (!assignment || !child || !task || !run || !attempt) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        this.assertCurrentLease(attempt.attemptId, String(row.lease_resource_key), leaseId, fence, now);
        const request: AgentModeRuntimeDispatchRequest = { schemaVersion: 1, dispatchId: String(row.dispatch_id), operationId, assignmentIntentKey: String(row.assignment_intent_key), childAgentId: String(row.child_agent_id), taskId: assignment.taskId, runId: assignment.runId, attemptId: String(row.attempt_id), runtimeRef: String(row.runtime_ref), runtimeProfileRef: String(row.runtime_profile_ref), controllerRef, requestedAt: now };
        const authorityFailure = this.runtimeDispatchAuthority(request, assignment, child, task, run, attempt, now, true);
        if (authorityFailure) return { result: 'denied', reasonCode: authorityFailure };
        this.database.prepare("UPDATE dispatch_outbox SET state = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND state = 'dispatchable'").run(now, operationId);
        this.database.prepare("UPDATE effects SET status = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND status = 'prepared'").run(now, operationId);
        this.database.prepare("UPDATE agents SET status = 'running' WHERE agent_id = ? AND status = 'assigned'").run(child.agentId);
        this.database.prepare("UPDATE agent_mode_child_assignments SET status = 'running', updated_at = ? WHERE assignment_intent_key = ? AND status = 'dispatch_ready'").run(now, assignment.assignmentIntentKey);
        this.database.prepare("UPDATE attempts SET status = 'running', updated_at = ? WHERE attempt_id = ? AND status = 'admitted'").run(now, attempt.attemptId);
        this.database.prepare("UPDATE runs SET status = 'active' WHERE run_id = ? AND status = 'created'").run(run.runId);
        this.database.prepare("UPDATE tasks SET status = 'running' WHERE task_id = ? AND status = 'admitted'").run(task.taskId);
        this.appendEventIfAbsent({ eventId: `runtime-started:${operationId}`, entityType: 'attempt', entityId: attempt.attemptId, eventType: 'runtime_started', occurredAt: now, payload: { operationId, dispatchId: request.dispatchId, runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef, leaseId, fence } });
        return { result: 'created' };
      });
    } catch (error) {
      return { result: 'denied', reasonCode: error instanceof Error && error.message.includes('stale lease') ? 'STALE_FENCE' : 'AUTHORITY_UNAVAILABLE' };
    }
  }

  private parseRuntimeReceipt(value: unknown): AgentModeRuntimeReceipt | undefined {
    if (typeof value !== 'string') return undefined;
    try {
      const parsed = JSON.parse(value) as AgentModeRuntimeReceipt;
      return validateRuntimeResult(runtimeResultFromReceipt(parsed)) && runtimeReceiptEffectHash(parsed) === parsed.effectHash ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  recordRuntimeDispatchReceipt(receipt: AgentModeRuntimeReceipt): AgentModeRuntimeReceiptMutation {
    try {
      return this.withTransaction(() => {
        if (!validateRuntimeResult(runtimeResultFromReceipt(receipt)) || runtimeReceiptEffectHash(receipt) !== receipt.effectHash) return { result: 'denied', reasonCode: 'RUNTIME_RESULT_INVALID' };
        const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(receipt.operationId) as Record<string, unknown> | undefined;
        const outbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(receipt.operationId) as Record<string, unknown> | undefined;
        if (!effect || !outbox) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        if (effect.attempt_id !== receipt.attemptId || outbox.attempt_id !== receipt.attemptId
          || effect.dispatch_id !== receipt.dispatchId || outbox.dispatch_id !== receipt.dispatchId
          || effect.assignment_intent_key !== receipt.assignmentIntentKey || outbox.assignment_intent_key !== receipt.assignmentIntentKey
          || effect.child_agent_id !== receipt.childAgentId || outbox.child_agent_id !== receipt.childAgentId
          || effect.runtime_ref !== receipt.runtimeRef || outbox.runtime_ref !== receipt.runtimeRef
          || effect.runtime_profile_ref !== receipt.runtimeProfileRef || outbox.runtime_profile_ref !== receipt.runtimeProfileRef
          || effect.lease_id !== receipt.leaseId || Number(effect.lease_fence) !== receipt.fence
          || outbox.lease_id !== receipt.leaseId || Number(outbox.lease_fence) !== receipt.fence) return { result: 'stale', reasonCode: 'STALE_FENCE' };
        if (outbox.state !== 'dispatched' && outbox.state !== 'receipt_recorded' && outbox.state !== 'uncertain') return { result: 'denied', reasonCode: 'DISPATCH_NOT_STARTED' };
        const attempt = this.getAttempt(receipt.attemptId);
        const assignment = this.getChildAssignment(receipt.childAgentId);
        if (!attempt || !assignment || assignment.reservationId !== attempt.reservationId) return { result: 'denied', reasonCode: 'DISPATCH_IDENTITY_MISMATCH' };
        const reservation = attempt.reservationId ? this.getReservation(attempt.reservationId) : undefined;
        if (!reservation || receipt.usage.steps > reservation.steps || receipt.usage.tokens > reservation.tokens || receipt.usage.cost > reservation.dollars) return { result: 'denied', reasonCode: 'RESULT_EXCEEDS_ALLOCATION' };
        const genericReceipt: OperationReceipt = {
          operationId: receipt.operationId,
          attemptId: receipt.attemptId,
          scopeHash: attempt.capabilityScopeHash,
          effectHash: receipt.effectHash,
          status: receipt.status,
          recordedAt: receipt.recordedAt,
        };
        const recorded = this.recordReceipt(genericReceipt);
        if (recorded === 'stale') return { result: 'stale', reasonCode: 'STALE_FENCE' };
        if (recorded === 'conflict') return { result: 'conflict', reasonCode: 'RECEIPT_CONFLICT' };
        this.database.prepare('UPDATE effects SET status = ?, receipt_json = ? WHERE operation_id = ?').run(receipt.status, JSON.stringify(receipt), receipt.operationId);
        if (recorded === 'recorded') this.appendEventIfAbsent({ eventId: `runtime-receipt-recorded:${receipt.operationId}:${receipt.effectHash}`, entityType: 'attempt', entityId: receipt.attemptId, eventType: 'runtime_receipt_recorded', occurredAt: receipt.recordedAt, payload: { operationId: receipt.operationId, dispatchId: receipt.dispatchId, status: receipt.status, runtimeReceiptId: receipt.receiptId, resultHash: receipt.resultHash, evidenceRef: receipt.evidenceRef } });
        return { result: recorded === 'duplicate' ? 'duplicate' : 'recorded' };
      });
    } catch (error) {
      return { result: 'denied', reasonCode: error instanceof Error && error.message.includes('stale') ? 'STALE_FENCE' : 'AUTHORITY_UNAVAILABLE' };
    }
  }

  verifyRuntimeDispatch(operationId: string, now: string): AgentModeRuntimeVerification {
    try {
      return this.withTransaction(() => {
        const outbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        if (!outbox || !effect) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        if (outbox.state === 'verified' || outbox.state === 'failed' || outbox.state === 'cancelled') return { result: 'duplicate' };
        if (outbox.state !== 'receipt_recorded') return { result: 'denied', reasonCode: 'RECEIPT_NOT_RECORDED' };
        const receipt = this.parseRuntimeReceipt(effect.receipt_json);
        if (!receipt || receipt.operationId !== operationId) return { result: 'uncertain', reasonCode: 'RECEIPT_INVALID' };
        const attempt = this.getAttempt(String(outbox.attempt_id));
        const assignment = this.getChildAssignment(String(outbox.child_agent_id));
        if (!attempt || !assignment || receipt.attemptId !== attempt.attemptId || receipt.assignmentIntentKey !== assignment.assignmentIntentKey) return { result: 'uncertain', reasonCode: 'DISPATCH_IDENTITY_MISMATCH' };
        if (!this.isCurrentLease(attempt.attemptId, String(outbox.lease_resource_key), String(outbox.lease_id), Number(outbox.lease_fence), now)) return { result: 'uncertain', reasonCode: 'STALE_FENCE' };
        if (!validateRuntimeResult(runtimeResultFromReceipt(receipt))) return { result: 'uncertain', reasonCode: 'RECEIPT_INVALID' };
        if (attempt.cancellationStatus !== 'running' && (receipt.status !== 'cancelled' || receipt.cancellationObserved !== true)) return { result: 'uncertain', reasonCode: 'CANCELLATION_RACE' };
        const nextState = receipt.status === 'succeeded' ? 'verified' : receipt.status;
        this.database.prepare('UPDATE effects SET status = ? WHERE operation_id = ?').run(receipt.status, operationId);
        this.database.prepare('UPDATE dispatch_outbox SET state = ? WHERE operation_id = ?').run(nextState, operationId);
        this.appendEventIfAbsent({ eventId: `runtime-verified:${operationId}:${receipt.effectHash}`, entityType: 'attempt', entityId: attempt.attemptId, eventType: 'runtime_verified', occurredAt: now, payload: { operationId, dispatchId: receipt.dispatchId, status: receipt.status, resultHash: receipt.resultHash, evidenceRef: receipt.evidenceRef } });
        return { result: 'verified' };
      });
    } catch (error) {
      return { result: 'denied', reasonCode: error instanceof Error && error.message.includes('stale') ? 'STALE_FENCE' : 'AUTHORITY_UNAVAILABLE' };
    }
  }

  markRuntimeDispatchUncertain(operationId: string, now: string, reasonCode: string): AgentModeRuntimeDispatchMutation {
    try {
      return this.withTransaction(() => {
        const outbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        if (!outbox || !effect) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        if (outbox.state === 'uncertain' || effect.status === 'uncertain') return { result: 'duplicate' };
        if (['verified', 'failed', 'cancelled'].includes(String(outbox.state))) return { result: 'duplicate' };
        this.database.prepare("UPDATE effects SET status = 'uncertain' WHERE operation_id = ?").run(operationId);
        this.database.prepare("UPDATE dispatch_outbox SET state = 'uncertain' WHERE operation_id = ?").run(operationId);
        this.database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(now, String(outbox.attempt_id));
        this.database.prepare("UPDATE agents SET status = 'uncertain' WHERE agent_id = ? AND status NOT IN ('completed', 'failed', 'cancelled', 'expired')").run(String(outbox.child_agent_id));
        this.database.prepare("UPDATE agent_mode_child_assignments SET status = 'uncertain', updated_at = ? WHERE assignment_intent_key = ? AND status NOT IN ('completed', 'failed', 'cancelled', 'expired')").run(now, String(outbox.assignment_intent_key));
        this.appendEventIfAbsent({ eventId: `runtime-uncertain:${operationId}`, entityType: 'attempt', entityId: String(outbox.attempt_id), eventType: 'runtime_uncertain', occurredAt: now, payload: { operationId, dispatchId: outbox.dispatch_id, reasonCode } });
        return { result: 'created' };
      });
    } catch {
      return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
  }

  isRuntimeCancellationRequested(operationId: string, now: string): boolean {
    try {
      const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) return true;
      const attempt = this.getAttempt(String(row.attempt_id));
      const assignment = this.getChildAssignment(String(row.child_agent_id));
      const child = this.getAgent(String(row.child_agent_id));
      if (!attempt || !assignment || !child) return true;
      if (attempt.cancellationStatus !== 'running' || ['cancelled', 'expired', 'uncertain'].includes(child.status) || ['cancelled', 'expired', 'uncertain'].includes(assignment.status)) return true;
      const root = this.getSpawnRootState(assignment.rootGoalId);
      if (!root || root.cancellation !== 'active' || this.getTask(root.rootGoalId)?.status === 'cancelled') return true;
      const controls = this.getSpawnAdmissionControls(assignment.rootGoalId);
      return controls.global.denied || Boolean(controls.root?.denied) || Date.parse(assignment.deadline) <= Date.parse(now);
    } catch {
      return true;
    }
  }

  settleRuntimeDispatch(operationId: string, controllerRef: string, leaseId: string, fence: number, now: string): AgentModeRuntimeSettlement {
    try {
      return this.withTransaction(() => {
        const outbox = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
        if (!outbox || !effect) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        const receipt = this.parseRuntimeReceipt(effect.receipt_json);
        if (!receipt) return { result: 'uncertain', reasonCode: 'RECEIPT_INVALID' };
        const assignment = this.getChildAssignment(String(outbox.child_agent_id));
        const child = this.getAgent(String(outbox.child_agent_id));
        const attempt = this.getAttempt(String(outbox.attempt_id));
        if (!assignment || !child || !attempt) return { result: 'denied', reasonCode: 'DISPATCH_NOT_FOUND' };
        const terminal = ['completed', 'failed', 'cancelled'].includes(assignment.status);
        if (terminal && assignment.status === (receipt.status === 'succeeded' ? 'completed' : receipt.status) && this.getReservation(assignment.reservationId)?.status === 'settled') return { result: 'duplicate', receipt };
        if (!['verified', 'failed', 'cancelled'].includes(String(outbox.state))) return { result: 'denied', reasonCode: 'DISPATCH_NOT_VERIFIED' };
        if (outbox.controller_ref !== controllerRef || outbox.lease_id !== leaseId || Number(outbox.lease_fence) !== fence) return { result: 'denied', reasonCode: 'STALE_FENCE' };
        this.assertCurrentLease(attempt.attemptId, String(outbox.lease_resource_key), leaseId, fence, now);
        if (receipt.operationId !== operationId || receipt.attemptId !== attempt.attemptId || receipt.assignmentIntentKey !== assignment.assignmentIntentKey || receipt.childAgentId !== child.agentId || receipt.effectHash !== runtimeReceiptEffectHash(receipt)) return { result: 'uncertain', reasonCode: 'RECEIPT_INVALID' };
        const reservation = this.getReservation(assignment.reservationId);
        if (!reservation || reservation.status !== 'reserved' || receipt.usage.steps > reservation.steps || receipt.usage.tokens > reservation.tokens || receipt.usage.cost > reservation.dollars) return { result: 'denied', reasonCode: 'RESULT_EXCEEDS_ALLOCATION' };
        const terminalStatus = receipt.status === 'succeeded' ? 'completed' : receipt.status;
        if (receipt.status === 'cancelled') {
          if (attempt.cancellationStatus === 'running') return { result: 'denied', reasonCode: 'CANCELLATION_NOT_REQUESTED' };
          if (attempt.cancellationStatus === 'requested') this.acknowledgeCancellation(attempt.attemptId, now);
        }
        this.finishAttempt(attempt.attemptId, terminalStatus, now);
        const settled = this.settleBudgetInternal({ reservationId: reservation.reservationId, steps: receipt.usage.steps, tokens: receipt.usage.tokens, dollars: receipt.usage.cost, settledAt: now });
        if (settled === 'conflict') return { result: 'uncertain', reasonCode: 'BUDGET_CONFLICT' };
        const root = this.getSpawnRootState(assignment.rootGoalId);
        if (!root || root.activeChildren < 1 || root.reservedChildSteps < (child.reservedChildSteps ?? 0) || root.reservedChildCost < (child.reservedChildCost ?? 0)) throw new Error('spawn root aggregate release failed');
        const rootUpdate = this.database.prepare(`UPDATE agent_mode_spawn_roots SET active_children = active_children - 1, reserved_child_steps = reserved_child_steps - ?, reserved_child_cost = reserved_child_cost - ?, updated_at = ? WHERE root_goal_id = ? AND active_children > 0 AND reserved_child_steps >= ? AND reserved_child_cost >= ?`).run(child.reservedChildSteps ?? 0, child.reservedChildCost ?? 0, now, assignment.rootGoalId, child.reservedChildSteps ?? 0, child.reservedChildCost ?? 0);
        if (rootUpdate.changes !== 1) throw new Error('spawn root aggregate release failed');
        this.database.prepare('UPDATE agents SET status = ?, reserved_child_steps = 0, reserved_child_cost = 0 WHERE agent_id = ?').run(terminalStatus, child.agentId);
        this.database.prepare('UPDATE agent_mode_child_assignments SET status = ?, updated_at = ? WHERE assignment_intent_key = ?').run(terminalStatus, now, assignment.assignmentIntentKey);
        this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ? AND lease_id = ? AND owner_id = ? AND fence = ?').run(now, String(outbox.lease_resource_key), leaseId, controllerRef, fence);
        const eventType = receipt.status === 'succeeded' ? 'runtime_completed' : receipt.status === 'failed' ? 'runtime_failed' : 'runtime_cancelled';
        this.appendEventIfAbsent({ eventId: `${eventType}:${operationId}`, entityType: 'attempt', entityId: attempt.attemptId, eventType, occurredAt: now, payload: { operationId, dispatchId: receipt.dispatchId, childAgentId: child.agentId, resultHash: receipt.resultHash, evidenceRef: receipt.evidenceRef, usage: receipt.usage } });
        this.appendEventIfAbsent({ eventId: `child-settled:${assignment.assignmentIntentKey}`, entityType: 'child_assignment', entityId: assignment.assignmentIntentKey, eventType: 'child_settled', occurredAt: now, payload: { childAgentId: child.agentId, status: terminalStatus, operationId } });
        return { result: 'settled', receipt };
      });
    } catch (error) {
      return { result: 'denied', reasonCode: error instanceof Error && error.message.includes('stale lease') ? 'STALE_FENCE' : error instanceof Error && error.message.includes('cancellation') ? 'CANCELLATION_NOT_REQUESTED' : 'AUTHORITY_UNAVAILABLE' };
    }
  }

  assignChildAgent(request: AgentModeChildAssignmentRequest): AgentModeChildAssignmentResult {
    try {
      return this.withTransaction(() => this.assignChildAgentInternal(request));
    } catch {
      return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
  }

  private assignChildAgentInternal(request: AgentModeChildAssignmentRequest): AgentModeChildAssignmentResult {
    try {
      if (!validateChildAssignmentRequest(request)) return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    } catch {
      return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    }
    if (!this.hasChildAssignmentTables) throw new Error('child assignment authority is unavailable');
    const intent = assignmentIntentKey(request);
    const materialHash = assignmentMaterialHash(request);
    const existingIntent = this.database.prepare('SELECT * FROM agent_mode_child_assignments WHERE assignment_intent_key = ?').get(intent) as Record<string, unknown> | undefined;
    if (existingIntent) {
      if (existingIntent.material_hash !== materialHash) return { result: 'conflict', reasonCode: 'ASSIGNMENT_CONFLICT' };
      const receipt = this.parseChildAssignmentReceipt(existingIntent);
      if (!receipt) return { result: 'conflict', reasonCode: 'ASSIGNMENT_CONFLICT' };
      return { result: 'duplicate', receipt, dispatch: this.getPreparedChildDispatch(intent, request.requestedAt) ?? null };
    }
    const existingChildAssignment = this.database.prepare('SELECT assignment_intent_key FROM agent_mode_child_assignments WHERE child_agent_id = ?').get(request.childAgentId) as { assignment_intent_key?: string } | undefined;
    if (existingChildAssignment) return { result: 'denied', reasonCode: 'CHILD_ALREADY_ASSIGNED' };
    this.consumeChildAssignmentReadFailure('child');
    let child = this.getAgent(request.childAgentId);
    if (!child) return { result: 'denied', reasonCode: 'CHILD_NOT_FOUND' };
    if (child.status === 'reserved' && child.expiresAt && Date.parse(child.expiresAt) <= Date.parse(request.requestedAt)) {
      this.reconcileExpiredChildAgentsInternal(request.requestedAt, 64);
      child = this.getAgent(request.childAgentId);
    }
    if (!child) return { result: 'denied', reasonCode: 'CHILD_NOT_FOUND' };
    if (child.status === 'expired' || (child.expiresAt !== undefined && Date.parse(child.expiresAt) <= Date.parse(request.requestedAt))) return { result: 'denied', reasonCode: 'CHILD_EXPIRED' };
    if (child.status === 'cancelled') return { result: 'denied', reasonCode: 'CHILD_CANCELLED' };
    if (child.status !== 'reserved') return { result: 'denied', reasonCode: 'CHILD_NOT_RESERVED' };
    if (child.rootGoalId !== request.rootGoalId) return { result: 'denied', reasonCode: 'ROOT_MISMATCH' };
    this.consumeChildAssignmentReadFailure('root');
    const root = child.rootGoalId ? this.getSpawnRootState(child.rootGoalId) : undefined;
    if (!root || root.rootGoalId !== request.rootGoalId || root.policyId !== child.policyId || root.policyVersion !== child.policyVersion) return { result: 'denied', reasonCode: 'ROOT_MISMATCH' };
    this.consumeChildAssignmentReadFailure('kill-switch');
    const controls = this.getSpawnAdmissionControls(request.rootGoalId);
    if (controls.global.denied) return { result: 'denied', reasonCode: 'GLOBAL_KILL_SWITCH' };
    if (controls.root?.denied) return { result: 'denied', reasonCode: 'ROOT_KILL_SWITCH' };
    this.consumeChildAssignmentReadFailure('cancellation');
    if (root.cancellation !== 'active') return { result: 'denied', reasonCode: 'ROOT_CANCELLED' };
    if (this.getTask(request.rootGoalId)?.status === 'cancelled') return { result: 'denied', reasonCode: 'ROOT_CANCELLED' };
    if (Date.parse(root.deadline) <= Date.parse(request.requestedAt) || Date.parse(request.deadline) <= Date.parse(request.requestedAt) || (child.expiresAt && Date.parse(request.deadline) > Date.parse(child.expiresAt))) return { result: 'denied', reasonCode: 'DEADLINE_EXPIRED' };
    const policy = child.policyVersion === undefined ? undefined : getSpawnPolicy(child.policyId, child.policyVersion);
    const template = child.roleTemplateId === undefined || child.roleTemplateVersion === undefined ? undefined : getRoleTemplate(child.roleTemplateId, child.roleTemplateVersion);
    if (!policy || !template || template.roleTemplateId !== child.roleTemplateId || template.version !== child.roleTemplateVersion) return { result: 'denied', reasonCode: 'RUNTIME_PROFILE_INVALID' };
    if (!child.capabilitySetHash || !child.capabilities || child.repositoryScope === undefined || child.resourceScope === undefined || child.depth === undefined || child.reservedChildSteps === undefined || child.reservedChildCost === undefined) return { result: 'denied', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    if (child.parentAgentId !== null || child.parentTaskId !== null || child.parentRunId !== null) {
      if (!child.parentAgentId || !child.parentTaskId || !child.parentRunId) return { result: 'denied', reasonCode: 'PARENT_LINEAGE_MISMATCH' };
      const parent = this.getAgent(child.parentAgentId);
      const parentTask = this.getTask(child.parentTaskId);
      const parentRun = this.getRun(child.parentRunId);
      const parentAttemptCancelled = this.listAttempts().some((attempt) => attempt.runId === child.parentRunId && attempt.cancellationStatus !== 'running');
      if (!parent || !parentTask || !parentRun || parent.rootGoalId !== request.rootGoalId || parent.depth !== child.depth - 1 || parentRun.taskId !== parentTask.taskId || parentRun.agentId !== parent.agentId || parentTask.status === 'cancelled' || parentRun.status === 'cancelled' || parentAttemptCancelled) return { result: 'denied', reasonCode: parentTask?.status === 'cancelled' || parentRun?.status === 'cancelled' || parentAttemptCancelled ? 'CHILD_CANCELLED' : 'PARENT_LINEAGE_MISMATCH' };
    }
    if (request.requestedSteps > child.reservedChildSteps || request.requestedCostCeiling > child.reservedChildCost) return { result: 'denied', reasonCode: request.requestedSteps > child.reservedChildSteps ? 'STEP_ALLOCATION_EXCEEDED' : 'COST_ALLOCATION_EXCEEDED' };
    if (request.repositoryScope !== child.repositoryScope || request.resourceScope !== child.resourceScope) return { result: 'denied', reasonCode: 'SCOPE_MISMATCH' };
    const childCapabilities = new Set(child.capabilities);
    if (request.requestedCapabilities.some((capability) => !childCapabilities.has(capability))) return { result: 'denied', reasonCode: 'CAPABILITY_MISMATCH' };
    this.consumeChildAssignmentReadFailure('runtime-profile');
    const knownRuntime = AGENT_MODE_RUNTIME_PROFILES.some((profile) => profile.runtimeRef === request.runtimeRef);
    if (!knownRuntime) return { result: 'denied', reasonCode: 'RUNTIME_NOT_ALLOWED' };
    const runtimeProfile = getRuntimeProfile(request.runtimeRef, request.runtimeProfileRef);
    if (!runtimeProfile || !runtimeProfile.allowedRoleTemplateIds.includes(child.roleTemplateId) || child.capabilities.some((capability) => !runtimeProfile.allowedCapabilities.includes(capability))) return { result: 'denied', reasonCode: 'RUNTIME_PROFILE_INVALID' };
    this.consumeChildAssignmentReadFailure('allocation');
    const taskDigest = createHash('sha256').update(intent).digest('hex');
    const taskId = `task:child-assignment:${taskDigest}`;
    const runId = `run:child-assignment:${taskDigest}`;
    const attemptId = `attempt:child-assignment:${taskDigest}`;
    const budgetScopeId = `budget:child-assignment:${taskDigest}`;
    const reservationId = `reservation:child-assignment:${taskDigest}`;
    if (this.getTask(taskId) || this.getRun(runId) || this.getAttempt(attemptId) || this.getReservation(reservationId)) return { result: 'conflict', reasonCode: 'ASSIGNMENT_CONFLICT' };
    this.createTask({ taskId, taskType: 'agent-mode.child-assignment', inputHash: taskSpecHash(request.taskSpecRef), createdAt: request.requestedAt, status: 'admitted', childAgentId: child.agentId, assignmentIntentKey: intent, taskSpecRef: request.taskSpecRef });
    this.createRun({ runId, taskId, agentId: child.agentId, createdAt: request.requestedAt, status: 'created', childAgentId: child.agentId, assignmentIntentKey: intent });
    this.createAttempt({ attemptId, runId, agentId: child.agentId, runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef, routeRef: DEFERRED_ROUTE_REF, modelRef: DEFERRED_MODEL_REF, policyVersion: String(child.policyVersion), capabilityScopeHash: assignmentCapabilityScopeHash(request), budgetScopeId, createdAt: request.requestedAt, childAgentId: child.agentId, assignmentIntentKey: intent });
    const requestedTokens = request.requestedTokenCeiling ?? 0;
    this.ensureBudgetScope({ budgetScopeId, maxSteps: child.reservedChildSteps, maxTokens: requestedTokens, maxDollars: child.reservedChildCost });
    const reservationResult = this.reserveBudgetInternal({ reservationId, budgetScopeId, attemptId, steps: request.requestedSteps, tokens: requestedTokens, dollars: request.requestedCostCeiling, status: 'reserved', createdAt: request.requestedAt });
    if (reservationResult !== 'created') return { result: 'conflict', reasonCode: 'ASSIGNMENT_CONFLICT' };
    this.database.prepare('UPDATE attempts SET reservation_id = ? WHERE attempt_id = ?').run(reservationId, attemptId);
    this.database.prepare("UPDATE attempts SET status = 'admitted', updated_at = ? WHERE attempt_id = ? AND status = 'created'").run(request.requestedAt, attemptId);
    const receipt: AgentModeChildAssignmentReceipt = {
      assignmentIntentKey: intent, assignmentId: request.assignmentId, childAgentId: child.agentId, taskId, runId, attemptId,
      rootGoalId: request.rootGoalId, sourceEventId: request.sourceEventId, runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef,
      stepCeiling: request.requestedSteps, costCeiling: request.requestedCostCeiling, tokenCeiling: requestedTokens, budgetScopeId, reservationId,
      createdAt: request.requestedAt, deadline: request.deadline, status: 'dispatch_ready',
    };
    const receiptJson = JSON.stringify(receipt);
    if (receiptJson.length > 8_192) throw new Error('child assignment receipt exceeds bounded size');
    const updateChild = this.database.prepare("UPDATE agents SET status = 'assigned' WHERE agent_id = ? AND status = 'reserved'").run(child.agentId);
    if (updateChild.changes !== 1) throw new Error('child assignment claim failed');
    this.database.prepare(`
      INSERT INTO agent_mode_child_assignments (
        assignment_intent_key, material_hash, assignment_id, child_agent_id, root_goal_id, source_event_id, task_spec_ref,
        task_id, run_id, attempt_id, runtime_ref, runtime_profile_ref, role_template_id, role_template_version,
        policy_id, policy_version, capability_set_hash, capabilities_json, repository_scope, resource_scope,
        requested_steps, requested_cost, requested_tokens, budget_scope_id, reservation_id, deadline, status, created_at, updated_at, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(intent, materialHash, request.assignmentId, child.agentId, request.rootGoalId, request.sourceEventId, request.taskSpecRef, taskId, runId, attemptId, request.runtimeRef, request.runtimeProfileRef, child.roleTemplateId, child.roleTemplateVersion, child.policyId, child.policyVersion, child.capabilitySetHash, JSON.stringify(child.capabilities), child.repositoryScope, child.resourceScope, request.requestedSteps, request.requestedCostCeiling, requestedTokens, budgetScopeId, reservationId, request.deadline, 'dispatch_ready', request.requestedAt, request.requestedAt, receiptJson);
    this.failIfInjected('admission');
    this.appendEventIfAbsent({ eventId: `child-assignment-created:${intent}`, entityType: 'child_assignment', entityId: intent, eventType: 'child_assignment_created', occurredAt: request.requestedAt, payload: { assignmentIntentKey: intent, childAgentId: child.agentId, taskId, runId, attemptId, rootGoalId: request.rootGoalId, sourceEventId: request.sourceEventId, runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef, stepCeiling: request.requestedSteps, costCeiling: request.requestedCostCeiling, status: 'dispatch_ready' } });
    return { result: 'assigned', receipt, dispatch: this.getPreparedChildDispatch(intent, request.requestedAt) ?? (() => { throw new Error('prepared child dispatch missing'); })() };
  }

  private parseChildAssignmentReceipt(row: Record<string, unknown>): AgentModeChildAssignmentReceipt | undefined {
    if (typeof row.receipt_json !== 'string') return undefined;
    try { return JSON.parse(row.receipt_json) as AgentModeChildAssignmentReceipt; } catch { return undefined; }
  }

  private freshParentFacts(request: SpawnRequest): SpawnAuthorityFacts['parent'] {
    if (!request.parentAgentId || !request.parentTaskId || !request.parentRunId) return null;
    const parent = this.getAgent(request.parentAgentId);
    const task = this.getTask(request.parentTaskId);
    const run = this.getRun(request.parentRunId);
    if (!parent || !task || !run || run.taskId !== task.taskId || run.agentId !== parent.agentId || !parent.rootGoalId || parent.depth === undefined || !parent.roleTemplateId || parent.policyVersion === undefined) return null;
    const attemptCancelled = this.listAttempts().some((attempt) => attempt.runId === run.runId && attempt.cancellationStatus !== 'running');
    return {
      agentId: parent.agentId, taskId: task.taskId, runId: run.runId, rootGoalId: parent.rootGoalId, depth: parent.depth,
      cancellation: task.status === 'cancelled' || run.status === 'cancelled' || attemptCancelled ? 'cancelled' : 'active',
      delegableCapabilities: parent.capabilities ?? [], repositoryScopes: parent.repositoryScope ? [parent.repositoryScope] : [], resourceScopes: parent.resourceScope ? [parent.resourceScope] : [],
    };
  }

  private classifyCurrentSpawnDenial(rootGoalId: string, requestedSteps: number, requestedCost: number): string {
    const root = this.getSpawnRootState(rootGoalId);
    if (!root) return 'AUTHORITY_UNAVAILABLE';
    if (root.cancellation !== 'active') return 'CANCELLED';
    if (root.activeChildren >= root.maxConcurrentChildren) return 'CONCURRENCY_EXCEEDED';
    if (root.totalChildCreations >= root.maxTotalChildCreations) return 'TOTAL_CREATIONS_EXCEEDED';
    if (root.reservedChildSteps + requestedSteps > root.maxAggregateChildSteps) return 'STEP_BUDGET_EXCEEDED';
    if (root.reservedChildCost + requestedCost > root.maxAggregateChildCost) return 'BUDGET_EXCEEDED';
    return 'AUTHORITY_UNAVAILABLE';
  }

  injectPersistenceFailureOnce(point: AgentModePersistenceFailurePoint): void {
    this.injectedFailures.add(point);
  }

  injectSpawnReadFailureOnce(point: AgentModeSpawnReadFailurePoint): void {
    this.injectedSpawnReadFailures.add(point);
  }

  injectChildAssignmentReadFailureOnce(point: AgentModeChildAssignmentReadFailurePoint): void {
    this.injectedChildAssignmentReadFailures.add(point);
  }

  private consumeChildAssignmentReadFailure(point: AgentModeChildAssignmentReadFailurePoint): void {
    if (!this.injectedChildAssignmentReadFailures.delete(point)) return;
    throw new Error(`injected child assignment authority read failure at ${point}`);
  }

  consumeSpawnReadFailure(point: AgentModeSpawnReadFailurePoint): void {
    if (!this.injectedSpawnReadFailures.delete(point)) return;
    throw new Error(`injected spawn authority read failure at ${point}`);
  }

  setSpawnAdmissionControl(input: AgentModeSpawnAdmissionControl): void {
    if (this.readOnly || !this.hasSpawnAdmissionControlTables) throw new Error('spawn admission controls are unavailable');
    if (!input.updatedAt || !Number.isFinite(Date.parse(input.updatedAt)) || !input.reason || input.reason.length > 128) throw new Error('invalid spawn admission control');
    if (input.scope === 'global' && input.rootGoalId !== null) throw new Error('global control cannot bind a root goal');
    if (input.scope === 'root' && !input.rootGoalId) throw new Error('root control requires a root goal');
    const controlId = input.scope === 'global' ? 'global' : `root:${input.rootGoalId}`;
    this.database.prepare(`
      INSERT INTO agent_mode_spawn_admission_controls (control_id, scope, root_goal_id, denied, reason, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(control_id) DO UPDATE SET denied = excluded.denied, reason = excluded.reason, updated_at = excluded.updated_at
    `).run(controlId, input.scope, input.rootGoalId, input.denied ? 1 : 0, input.reason, input.updatedAt);
  }

  getSpawnAdmissionControls(rootGoalId: string | null): AgentModeSpawnAdmissionControls {
    if (!this.hasSpawnAdmissionControlTables) throw new Error('spawn admission controls are unavailable');
    this.consumeSpawnReadFailure('kill-switch');
    const map = (row: Record<string, unknown>): AgentModeSpawnAdmissionControl => ({
      scope: row.scope as AgentModeSpawnAdmissionControl['scope'],
      rootGoalId: row.root_goal_id === null || row.root_goal_id === undefined ? null : String(row.root_goal_id),
      denied: Number(row.denied) === 1,
      reason: String(row.reason),
      updatedAt: String(row.updated_at),
    });
    const globalRow = this.database.prepare("SELECT * FROM agent_mode_spawn_admission_controls WHERE control_id = 'global'").get() as Record<string, unknown> | undefined;
    const global: AgentModeSpawnAdmissionControl = globalRow ? map(globalRow) : { scope: 'global', rootGoalId: null, denied: false, reason: 'default-open', updatedAt: new Date(0).toISOString() };
    if (!rootGoalId) return { global };
    const rootRow = this.database.prepare('SELECT * FROM agent_mode_spawn_admission_controls WHERE control_id = ?').get(`root:${rootGoalId}`) as Record<string, unknown> | undefined;
    return rootRow ? { global, root: map(rootRow) } : { global };
  }

  listSpawnAdmissionControls(): AgentModeSpawnAdmissionControl[] {
    if (!this.hasSpawnAdmissionControlTables) return [];
    return (this.database.prepare('SELECT * FROM agent_mode_spawn_admission_controls ORDER BY scope, root_goal_id').all() as Array<Record<string, unknown>>).map((row) => ({
      scope: row.scope as AgentModeSpawnAdmissionControl['scope'],
      rootGoalId: row.root_goal_id === null || row.root_goal_id === undefined ? null : String(row.root_goal_id),
      denied: Number(row.denied) === 1,
      reason: String(row.reason),
      updatedAt: String(row.updated_at),
    }));
  }

  private failIfInjected(point: AgentModePersistenceFailurePoint): void {
    if (!this.injectedFailures.delete(point)) return;
    throw new Error(`injected persistence failure at ${point}`);
  }

  createTask(task: AgentModeTask): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT task_type, input_hash, created_at, child_agent_id, assignment_intent_key, task_spec_ref FROM tasks WHERE task_id = ?').get(task.taskId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_type === task.taskType
          && existing.input_hash === task.inputHash
          && existing.created_at === task.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      this.database.prepare('INSERT INTO tasks (task_id, task_type, input_hash, created_at, status, child_agent_id, assignment_intent_key, task_spec_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(task.taskId, task.taskType, task.inputHash, task.createdAt, task.status ?? 'pending', task.childAgentId ?? null, task.assignmentIntentKey ?? null, task.taskSpecRef ?? null);
      return 'created';
    });
  }

  getTask(taskId: string): AgentModeTask | undefined {
    const row = this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      taskId: String(row.task_id),
      taskType: String(row.task_type),
      inputHash: String(row.input_hash),
      createdAt: String(row.created_at),
      status: row.status as AgentModeTaskStatus,
      ...(row.child_agent_id === null || row.child_agent_id === undefined ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.assignment_intent_key === null || row.assignment_intent_key === undefined ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.task_spec_ref === null || row.task_spec_ref === undefined ? {} : { taskSpecRef: String(row.task_spec_ref) }),
    };
  }

  listTasks(): AgentModeTask[] {
    const rows = this.database.prepare('SELECT * FROM tasks ORDER BY created_at, task_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      taskId: String(row.task_id),
      taskType: String(row.task_type),
      inputHash: String(row.input_hash),
      createdAt: String(row.created_at),
      status: row.status as AgentModeTaskStatus,
      ...(row.child_agent_id === null || row.child_agent_id === undefined ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.assignment_intent_key === null || row.assignment_intent_key === undefined ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.task_spec_ref === null || row.task_spec_ref === undefined ? {} : { taskSpecRef: String(row.task_spec_ref) }),
    }));
  }

  getJarvisIntake(intakeId: string): AgentModeJarvisIntakeRecord | undefined {
    if (!this.hasJarvisIntakeTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_jarvis_intakes WHERE intake_id = ?').get(intakeId) as Record<string, unknown> | undefined;
    return row ? mapJarvisIntakeRow(row) : undefined;
  }

  listJarvisIntakes(limit = 50): AgentModeJarvisIntakeRecord[] {
    if (!this.hasJarvisIntakeTables) return [];
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 100));
    return (this.database.prepare('SELECT * FROM agent_mode_jarvis_intakes ORDER BY created_at DESC, intake_id LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>).map(mapJarvisIntakeRow);
  }

  /** Atomically records one intake, its root task, and the persistent Jarvis owner. */
  recordJarvisIntake(record: AgentModeJarvisIntakeRecord, taskInput?: JarvisTaskInputV1): AgentModeJarvisIntakePersistenceResult {
    if (this.readOnly || !this.hasJarvisIntakeTables) throw new Error('Jarvis intake persistence is unavailable');
    if (taskInput && (validateJarvisTaskInput(taskInput) || taskInput.rootGoalId !== record.rootGoalId || taskInput.taskId !== record.taskId || taskInput.jarvisAgentId !== record.jarvisAgentId || taskInput.source !== record.source || taskInput.contentHash !== record.canonicalTextHash)) throw new Error('invalid Jarvis task input');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM agent_mode_jarvis_intakes WHERE intake_id = ?').get(record.intakeId) as Record<string, unknown> | undefined;
      if (existing) {
        return String(existing.material_hash) === record.materialHash
          ? { result: 'duplicate' as const, record: mapJarvisIntakeRow(existing) }
          : { result: 'conflict' as const, reasonCode: 'JARVIS_INTAKE_CONFLICT' as const };
      }
      const task = this.getTask(record.taskId);
      if (task) throw new Error('Jarvis intake root task identity is already claimed');
      const jarvis = this.getAgent(record.jarvisAgentId);
      if (jarvis && jarvis.agentKind !== 'jarvis') throw new Error('Jarvis owner identity is not a Jarvis agent');
      if (!jarvis) {
        this.database.prepare('INSERT INTO agents (agent_id, agent_kind, role, display_name, policy_id, status) VALUES (?, ?, ?, ?, ?, ?)')
          .run(record.jarvisAgentId, 'jarvis', 'persistent-executive', 'Jarvis', 'agent-mode.jarvis-intake.v1', 'active');
      }
      this.database.prepare('INSERT INTO tasks (task_id, task_type, input_hash, created_at, status, child_agent_id, assignment_intent_key, task_spec_ref) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)')
        .run(record.taskId, 'root.goal', record.canonicalTextHash, record.receivedAt, 'admitted');
      this.database.prepare(`
        INSERT INTO agent_mode_jarvis_intakes (
          intake_id, material_hash, schema_version, source, operator_id, canonical_text_hash,
          root_goal_id, task_id, jarvis_agent_id, received_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(record.intakeId, record.materialHash, record.schemaVersion, record.source, record.operatorId, record.canonicalTextHash, record.rootGoalId, record.taskId, record.jarvisAgentId, record.receivedAt, record.createdAt);
      if (taskInput) this.database.prepare(`
        INSERT INTO agent_mode_jarvis_task_inputs (
          task_id, schema_version, root_goal_id, jarvis_agent_id, source, text,
          content_hash, retention_class, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskInput.taskId, taskInput.schemaVersion, taskInput.rootGoalId, taskInput.jarvisAgentId, taskInput.source, taskInput.text, taskInput.contentHash, taskInput.retentionClass, taskInput.createdAt);
      this.appendEventIfAbsent({
        eventId: `jarvis-intake:${record.intakeId}`,
        entityType: 'jarvis_intake',
        entityId: record.intakeId,
        eventType: 'jarvis_intake_accepted',
        occurredAt: record.createdAt,
        payload: { intakeId: record.intakeId, source: record.source, operatorId: record.operatorId, rootGoalId: record.rootGoalId, taskId: record.taskId, jarvisAgentId: record.jarvisAgentId, canonicalTextHash: record.canonicalTextHash },
      });
      return { result: 'created' as const, record };
    });
  }

  getJarvisTaskInput(taskId: string): JarvisTaskInputV1 | undefined {
    if (!this.hasJarvisResponseSourceTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_jarvis_task_inputs WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined;
    return row ? mapJarvisTaskInputRow(row) : undefined;
  }

  getJarvisReadableResult(resultRef: string): JarvisReadableResultV1 | undefined {
    if (!this.hasJarvisResponseSourceTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_jarvis_readable_results WHERE result_ref = ?').get(resultRef) as Record<string, unknown> | undefined;
    return row ? mapJarvisReadableResultRow(row) : undefined;
  }

  listJarvisReadableResults(limit = 50): JarvisReadableResultV1[] {
    if (!this.hasJarvisResponseSourceTables) return [];
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 100));
    return (this.database.prepare('SELECT * FROM agent_mode_jarvis_readable_results ORDER BY created_at DESC, result_ref LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>).map(mapJarvisReadableResultRow);
  }

  /** Stores bounded, Jarvis-readable business facts above K4 receipts; it is not a runtime/result ledger. */
  recordJarvisReadableResult(record: JarvisReadableResultV1): AgentModeJarvisReadableResultPersistenceResult {
    if (this.readOnly || !this.hasJarvisResponseSourceTables) return { result: 'denied', reasonCode: 'JARVIS_RESULT_PERSISTENCE_UNAVAILABLE' };
    if (validateJarvisReadableResult(record)) return { result: 'denied', reasonCode: 'JARVIS_READABLE_RESULT_INVALID' };
    try {
      return this.withTransaction(() => {
        const existing = this.database.prepare('SELECT * FROM agent_mode_jarvis_readable_results WHERE result_ref = ?').get(record.resultRef) as Record<string, unknown> | undefined;
        if (existing) return String(existing.content_hash) === record.contentHash
          ? { result: 'duplicate' as const, resultRecord: mapJarvisReadableResultRow(existing) }
          : { result: 'conflict' as const, reasonCode: 'JARVIS_READABLE_RESULT_CONFLICT' };
        const finalResult = this.getOrganizationFinalResultById(record.resultRef);
        if (!finalResult || finalResult.rootGoalId !== record.rootGoalId || finalResult.status !== 'succeeded') return { result: 'denied' as const, reasonCode: 'JARVIS_READABLE_RESULT_SOURCE_UNAVAILABLE' };
        if (finalResult.rootGoalId !== record.taskId || !finalResult.auditorWorkItemId) return { result: 'denied' as const, reasonCode: 'JARVIS_READABLE_RESULT_ROOT_INVALID' };
        const finalFacts = new Map(finalResult.workItemResults.flatMap((item) => item.evidenceRefs.map((evidenceRef) => [evidenceRef, item.workItemKey] as const)));
        if (record.facts.some((fact) => !finalResult.workItemResults.some((item) => item.workItemKey === fact.workItemKey) || fact.evidenceRefs.some((evidenceRef) => finalFacts.get(evidenceRef) !== fact.workItemKey))) return { result: 'denied' as const, reasonCode: 'JARVIS_READABLE_RESULT_EVIDENCE_INVALID' };
        this.database.prepare(`
          INSERT INTO agent_mode_jarvis_readable_results (
            result_ref, schema_version, root_goal_id, task_id, owner, result_type,
            facts_json, content_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(record.resultRef, record.schemaVersion, record.rootGoalId, record.taskId, record.owner, record.resultType, JSON.stringify(record.facts), record.contentHash, record.createdAt);
        this.appendEventIfAbsent({
          eventId: `jarvis-readable-result:${record.resultRef}`,
          entityType: 'organization_final_result',
          entityId: record.resultRef,
          eventType: 'jarvis_readable_result_published',
          occurredAt: record.createdAt,
          payload: { resultRef: record.resultRef, rootGoalId: record.rootGoalId, taskId: record.taskId, factCount: record.facts.length, contentHash: record.contentHash },
        });
        return { result: 'created' as const, resultRecord: record };
      });
    } catch {
      return { result: 'conflict', reasonCode: 'JARVIS_READABLE_RESULT_CONFLICT' };
    }
  }

  getJarvisUserResponse(responseId: string): AgentModeJarvisUserResponseRecord | undefined {
    if (!this.hasJarvisUserResponseTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_jarvis_user_responses WHERE response_id = ?').get(responseId) as Record<string, unknown> | undefined;
    return row ? mapJarvisUserResponseRow(row) : undefined;
  }

  getJarvisUserResponseForRoot(rootGoalId: string): AgentModeJarvisUserResponseRecord | undefined {
    if (!this.hasJarvisUserResponseTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_jarvis_user_responses WHERE root_goal_id = ?').get(rootGoalId) as Record<string, unknown> | undefined;
    return row ? mapJarvisUserResponseRow(row) : undefined;
  }

  listJarvisUserResponses(limit = 50): AgentModeJarvisUserResponseRecord[] {
    if (!this.hasJarvisUserResponseTables) return [];
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 100));
    return (this.database.prepare('SELECT * FROM agent_mode_jarvis_user_responses ORDER BY created_at DESC, response_id LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>).map(mapJarvisUserResponseRow);
  }

  /** Persist only the canonical Jarvis-facing text fact; no worker/runtime body is copied. */
  recordJarvisUserResponse(record: AgentModeJarvisUserResponseRecord): AgentModeJarvisUserResponsePersistenceResult {
    if (this.readOnly || !this.hasJarvisUserResponseTables) return { result: 'denied', reasonCode: 'JARVIS_RESPONSE_PERSISTENCE_UNAVAILABLE' };
    if (record.schemaVersion !== 'agent-mode.jarvis-user-response.v1'
      || record.jarvisAgentId !== 'agent:jarvis' || record.speakerRole !== 'jarvis' || record.status !== 'published'
      || record.text !== canonicalJarvisUserResponseText(record.text) || record.text.length === 0 || record.text.length > 2_000
      || record.textHash !== deriveJarvisUserResponseTextHash(record.text)
      || record.responseId !== deriveJarvisUserResponseId(record)
      || record.materialHash !== jarvisUserResponseMaterialHash(record)
      || !Number.isFinite(Date.parse(record.createdAt))) return { result: 'denied', reasonCode: 'JARVIS_RESPONSE_INVALID' };
    try {
      return this.withTransaction(() => {
        const existing = this.database.prepare('SELECT * FROM agent_mode_jarvis_user_responses WHERE response_id = ?').get(record.responseId) as Record<string, unknown> | undefined;
        if (existing) {
          return String(existing.material_hash) === record.materialHash
            ? { result: 'duplicate' as const, response: mapJarvisUserResponseRow(existing) }
            : { result: 'conflict' as const, reasonCode: 'JARVIS_RESPONSE_CONFLICT' };
        }
        const existingRoot = this.database.prepare('SELECT response_id FROM agent_mode_jarvis_user_responses WHERE root_goal_id = ?').get(record.rootGoalId) as { response_id?: string } | undefined;
        if (existingRoot) return { result: 'conflict' as const, reasonCode: 'JARVIS_RESPONSE_CONFLICT' };
        const task = this.getTask(record.taskId);
        const jarvis = this.getAgent(record.jarvisAgentId);
        if (!task || task.taskId !== record.rootGoalId || !['root.goal', 'root-goal'].includes(task.taskType)) return { result: 'denied' as const, reasonCode: 'JARVIS_RESPONSE_ROOT_INVALID' };
        if (!jarvis || jarvis.agentKind !== 'jarvis') throw new Error('Jarvis response owner is invalid');
        const source = this.database.prepare('SELECT root_goal_id, supervisor_agent_id FROM agent_mode_organization_final_results WHERE organization_final_result_id = ?').get(record.sourceResultRef) as { root_goal_id?: string; supervisor_agent_id?: string } | undefined;
        if (!source || source.root_goal_id !== record.rootGoalId || source.supervisor_agent_id !== record.jarvisAgentId) throw new Error('Jarvis response source is unavailable');
        this.database.prepare(`
          INSERT INTO agent_mode_jarvis_user_responses (
            response_id, material_hash, schema_version, root_goal_id, task_id, jarvis_agent_id,
            speaker_role, source_result_ref, status, text, text_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(record.responseId, record.materialHash, record.schemaVersion, record.rootGoalId, record.taskId, record.jarvisAgentId, record.speakerRole, record.sourceResultRef, record.status, record.text, record.textHash, record.createdAt);
        this.appendEventIfAbsent({
          eventId: `jarvis-user-response:${record.responseId}`,
          entityType: 'jarvis_user_response',
          entityId: record.responseId,
          eventType: 'jarvis_user_response_published',
          occurredAt: record.createdAt,
          payload: { responseId: record.responseId, rootGoalId: record.rootGoalId, taskId: record.taskId, jarvisAgentId: record.jarvisAgentId, sourceResultRef: record.sourceResultRef, textHash: record.textHash, status: record.status },
        });
        return { result: 'created' as const, response: record };
      });
    } catch (error) {
      if (error instanceof Error && (error.message === 'Jarvis response source is unavailable' || error.message === 'Jarvis response owner is invalid')) return { result: 'denied', reasonCode: error.message === 'Jarvis response owner is invalid' ? 'JARVIS_RESPONSE_OWNER_INVALID' : 'JARVIS_RESPONSE_SOURCE_UNAVAILABLE' };
      return { result: 'conflict', reasonCode: 'JARVIS_RESPONSE_CONFLICT' };
    }
  }

  createRun(run: AgentModeRun): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT task_id, agent_id, created_at, child_agent_id, assignment_intent_key FROM runs WHERE run_id = ?').get(run.runId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_id === run.taskId
          && existing.agent_id === run.agentId
          && existing.created_at === run.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      if (!this.getTask(run.taskId)) throw new Error(`task not found: ${run.taskId}`);
      this.database.prepare('INSERT INTO runs (run_id, task_id, agent_id, created_at, status, child_agent_id, assignment_intent_key) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(run.runId, run.taskId, run.agentId, run.createdAt, run.status ?? 'created', run.childAgentId ?? null, run.assignmentIntentKey ?? null);
      return 'created';
    });
  }

  getRun(runId: string): AgentModeRun | undefined {
    const columns = this.hasRuntimeIdentityColumns ? '*'
      : this.hasRuntimePidColumn ? 'run_id, task_id, agent_id, created_at, status, runtime_pid'
        : 'run_id, task_id, agent_id, created_at, status';
    const row = this.database.prepare(`SELECT ${columns} FROM runs WHERE run_id = ?`).get(runId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      runId: String(row.run_id),
      taskId: String(row.task_id),
      agentId: String(row.agent_id),
      createdAt: String(row.created_at),
      status: row.status as AgentModeRunStatus,
      ...(row.runtime_pid === null || row.runtime_pid === undefined ? {} : { runtimePid: Number(row.runtime_pid) }),
      ...(row.child_agent_id === null || row.child_agent_id === undefined ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.assignment_intent_key === null || row.assignment_intent_key === undefined ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.runtime_started_at && row.runtime_command && row.runtime_identity ? {
        runtimeIdentity: { startedAt: String(row.runtime_started_at), command: String(row.runtime_command), token: String(row.runtime_identity) },
      } : {}),
    };
  }

  listRuns(): AgentModeRun[] {
    const rows = this.database.prepare('SELECT * FROM runs ORDER BY created_at, run_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      runId: String(row.run_id),
      taskId: String(row.task_id),
      agentId: String(row.agent_id),
      createdAt: String(row.created_at),
      status: row.status as AgentModeRunStatus,
      ...(row.runtime_pid === null || row.runtime_pid === undefined ? {} : { runtimePid: Number(row.runtime_pid) }),
      ...(row.child_agent_id === null || row.child_agent_id === undefined ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.assignment_intent_key === null || row.assignment_intent_key === undefined ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.runtime_started_at && row.runtime_command && row.runtime_identity ? {
        runtimeIdentity: { startedAt: String(row.runtime_started_at), command: String(row.runtime_command), token: String(row.runtime_identity) },
      } : {}),
    }));
  }

  setRunRuntimePid(runId: string, runtimePid: number, runtimeIdentity: RuntimeProcessIdentity): void {
    if (!Number.isSafeInteger(runtimePid) || runtimePid <= 0) throw new Error(`invalid runtime pid: ${runtimePid}`);
    if (!runtimeIdentity.startedAt || !runtimeIdentity.command || !runtimeIdentity.token) throw new Error('runtime identity is incomplete');
    this.withTransaction(() => {
      const result = this.database.prepare('UPDATE runs SET runtime_pid = ?, runtime_started_at = ?, runtime_command = ?, runtime_identity = ? WHERE run_id = ?')
        .run(runtimePid, runtimeIdentity.startedAt, runtimeIdentity.command, runtimeIdentity.token, runId);
      if (result.changes !== 1) throw new Error(`run not found: ${runId}`);
    });
  }

  /** Brain may narrow an admitted attempt to the concrete Workcell scope once its ID exists. */
  setAttemptCapabilityScopeHash(attemptId: string, scopeHash: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.capabilityScopeHash === scopeHash) return 'duplicate';
      if (!scopeHash || ['completed', 'failed', 'cancelled'].includes(attempt.status)) return 'conflict';
      this.database.prepare('UPDATE attempts SET capability_scope_hash = ?, updated_at = ? WHERE attempt_id = ?').run(scopeHash, updatedAt, attemptId);
      this.appendEventIfAbsent({ eventId: `attempt-scope-narrowed:${attemptId}:${scopeHash}`, entityType: 'attempt', entityId: attemptId, eventType: 'attempt_scope_narrowed', occurredAt: updatedAt, payload: { scopeHash } });
      return 'created';
    });
  }

  clearRunRuntimePid(runId: string): void {
    this.withTransaction(() => {
      this.database.prepare('UPDATE runs SET runtime_pid = NULL, runtime_started_at = NULL, runtime_command = NULL, runtime_identity = NULL WHERE run_id = ?').run(runId);
    });
  }

  markControllerLost(runId: string, lostAt: string, reason = 'runtime_process_lost'): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (['completed', 'failed', 'cancelled'].includes(run.status ?? 'created')) return 'duplicate';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      this.clearRunRuntimePid(runId);
      if (attempt) {
        this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ?').run(lostAt, attempt.leaseResourceKey ?? '');
        this.database.prepare('UPDATE attempts SET lease_resource_key = NULL, lease_id = NULL, lease_owner_id = NULL, lease_fence = NULL, updated_at = ? WHERE attempt_id = ?').run(lostAt, attempt.attemptId);
      }
      this.appendEventIfAbsent({ eventId: `controller-lost:${runId}:${lostAt}`, entityType: 'run', entityId: runId, eventType: 'controller_lost', occurredAt: lostAt, payload: { attemptId: attempt?.attemptId ?? null, reason } });
      return 'created';
    });
  }

  reAdmitRun(runId: string, input: AgentModeReAdmission): AgentModeLease {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      if (!attempt) throw new Error(`no resumable attempt for run: ${runId}`);
      if (!input.accessEvidenceValid) throw new Error('re-admission requires fresh access evidence');
      if (this.classifyRecovery(attempt.attemptId, input.now) !== 'safe_to_resume') throw new Error(`run is not safe to resume: ${this.classifyRecovery(attempt.attemptId, input.now)}`);
      const reservation = attempt.reservationId ? this.getReservation(attempt.reservationId) : undefined;
      const budget = this.getBudget(attempt.budgetScopeId);
      if (!reservation || reservation.status !== 'reserved' || !budget
        || budget.usedSteps + budget.reservedSteps > budget.maxSteps
        || budget.usedTokens + budget.reservedTokens > budget.maxTokens
        || budget.usedDollars + budget.reservedDollars > budget.maxDollars) throw new Error('re-admission budget reservation is unavailable or exhausted');
      const lease = this.acquireLeaseAt(input.lease, input.now);
      if (!lease) throw new Error('fresh re-admission lease is unavailable');
      this.setRunRuntimePid(runId, input.runtimePid, input.runtimeIdentity);
      this.database.prepare('UPDATE attempts SET lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?, updated_at = ? WHERE attempt_id = ?')
        .run(input.lease.resourceKey, input.lease.leaseId, input.lease.ownerId, lease.fence, input.now, attempt.attemptId);
      if (run.status !== 'paused') {
        this.database.prepare("UPDATE runs SET status = 'active' WHERE run_id = ?").run(runId);
        this.database.prepare("UPDATE tasks SET status = 'running' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
        this.database.prepare("UPDATE attempts SET status = 'running' WHERE attempt_id = ?").run(attempt.attemptId);
      }
      this.appendEventIfAbsent({ eventId: `readmitted:${runId}:${input.lease.leaseId}`, entityType: 'run', entityId: runId, eventType: 'attempt_readmitted_after_process_loss', occurredAt: input.now, payload: { attemptId: attempt.attemptId, leaseId: input.lease.leaseId, leaseFence: lease.fence, sameLineage: true } });
      return lease;
    });
  }

  pauseRun(runId: string, pausedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (run.status === 'paused') return 'duplicate';
      if (['completed', 'failed', 'cancelled'].includes(run.status ?? 'created')) return 'conflict';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      this.database.prepare("UPDATE runs SET status = 'paused' WHERE run_id = ?").run(runId);
      this.database.prepare("UPDATE tasks SET status = 'paused' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
      if (attempt) this.database.prepare("UPDATE attempts SET status = 'paused', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(pausedAt, attempt.attemptId);
      this.appendEventIfAbsent({
        eventId: `run-paused:${runId}:${pausedAt}`,
        entityType: 'run',
        entityId: runId,
        eventType: 'run_paused',
        occurredAt: pausedAt,
        payload: { attemptId: attempt?.attemptId ?? null },
      });
      return 'created';
    });
  }

  resumeRun(runId: string, resumedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (run.status !== 'paused') return run.status === 'active' ? 'duplicate' : 'conflict';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && candidate.status === 'paused');
      this.database.prepare("UPDATE runs SET status = 'active' WHERE run_id = ?").run(runId);
      this.database.prepare("UPDATE tasks SET status = 'running' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
      if (attempt) this.database.prepare("UPDATE attempts SET status = 'running', updated_at = ? WHERE attempt_id = ? AND status = 'paused'").run(resumedAt, attempt.attemptId);
      this.appendEventIfAbsent({
        eventId: `run-resumed:${runId}:${resumedAt}`,
        entityType: 'run',
        entityId: runId,
        eventType: 'run_resumed',
        occurredAt: resumedAt,
        payload: { attemptId: attempt?.attemptId ?? null },
      });
      return 'created';
    });
  }

  cancelRun(runId: string, cancelledAt: string, action: 'cancel' | 'kill' = 'cancel'): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (['completed', 'failed', 'cancelled'].includes(run.status ?? 'created')) return 'duplicate';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      if (attempt) {
        if (attempt.cancellationStatus === 'running') this.requestCancellation({ requestId: `${action}:${runId}:${cancelledAt}`, attemptId: attempt.attemptId, requestedAt: cancelledAt });
        // A normal cancel is a durable request. Only the active controller can
        // truthfully acknowledge that it stopped dispatch and reconciled work.
        // Kill is the explicit force path and may close the attempt here.
        if (action === 'kill') {
          if (this.getAttempt(attempt.attemptId)?.cancellationStatus === 'requested') this.acknowledgeCancellation(attempt.attemptId, cancelledAt);
          this.finishAttempt(attempt.attemptId, 'cancelled', cancelledAt);
        }
      } else {
        this.database.prepare("UPDATE runs SET status = 'cancelled' WHERE run_id = ?").run(runId);
        this.database.prepare("UPDATE tasks SET status = 'cancelled' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
      }
      if (action === 'kill') this.clearRunRuntimePid(runId);
      this.appendEventIfAbsent({
        eventId: `run-${action}:${runId}:${cancelledAt}`,
        entityType: 'run',
        entityId: runId,
        eventType: action === 'kill' ? 'run_killed' : attempt ? 'run_cancel_requested' : 'run_cancelled',
        occurredAt: cancelledAt,
        payload: { attemptId: attempt?.attemptId ?? null, acknowledged: action === 'kill' || !attempt },
      });
      return 'created';
    });
  }

  createAttempt(attempt: AgentModeAttemptInput): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(attempt.attemptId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.run_id === attempt.runId
          && existing.agent_id === attempt.agentId
          && existing.runtime_ref === attempt.runtimeRef
          && existing.route_ref === attempt.routeRef
          && existing.model_ref === attempt.modelRef
          && existing.policy_version === attempt.policyVersion
          && existing.capability_scope_hash === attempt.capabilityScopeHash
          && existing.budget_scope_id === attempt.budgetScopeId
          && existing.created_at === attempt.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      if (!this.getRun(attempt.runId)) throw new Error(`run not found: ${attempt.runId}`);
      const updatedAt = attempt.updatedAt ?? attempt.createdAt;
      this.database.prepare(`
        INSERT INTO attempts (
          attempt_id, run_id, agent_id, runtime_ref, route_ref, model_ref,
          policy_version, capability_scope_hash, budget_scope_id, status,
          cancellation_status, created_at, updated_at, runtime_profile_ref,
          child_agent_id, assignment_intent_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 'running', ?, ?, ?, ?, ?)
      `).run(
        attempt.attemptId,
        attempt.runId,
        attempt.agentId,
        attempt.runtimeRef,
        attempt.routeRef,
        attempt.modelRef,
        attempt.policyVersion,
        attempt.capabilityScopeHash,
        attempt.budgetScopeId,
        attempt.createdAt,
        updatedAt,
        attempt.runtimeProfileRef ?? null,
        attempt.childAgentId ?? null,
        attempt.assignmentIntentKey ?? null,
      );
      return 'created';
    });
  }

  getAttempt(attemptId: string): AgentModeAttempt | undefined {
    const row = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(attemptId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapAttempt(row);
  }

  listAttempts(): AgentModeAttempt[] {
    const rows = this.database.prepare('SELECT * FROM attempts ORDER BY created_at, attempt_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapAttempt(row));
  }

  getBudget(budgetScopeId: string): AgentModeBudgetState | undefined {
    const row = this.database.prepare('SELECT * FROM budget_scopes WHERE budget_scope_id = ?').get(budgetScopeId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      budgetScopeId: String(row.budget_scope_id),
      maxSteps: Number(row.max_steps),
      usedSteps: Number(row.used_steps),
      reservedSteps: Number(row.reserved_steps),
      maxTokens: Number(row.max_tokens),
      usedTokens: Number(row.used_tokens),
      reservedTokens: Number(row.reserved_tokens),
      maxDollars: Number(row.max_dollars),
      usedDollars: Number(row.used_dollars),
      reservedDollars: Number(row.reserved_dollars),
    };
  }

  getReservation(reservationId: string): AgentModeBudgetReservation | undefined {
    const row = this.database.prepare('SELECT * FROM budget_reservations WHERE reservation_id = ?').get(reservationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      reservationId: String(row.reservation_id),
      budgetScopeId: String(row.budget_scope_id),
      attemptId: String(row.attempt_id),
      steps: Number(row.steps),
      tokens: Number(row.tokens),
      dollars: Number(row.dollars),
      status: row.status as AgentModeBudgetReservation['status'],
      createdAt: String(row.created_at),
      ...(row.settled_at === null ? {} : { settledAt: String(row.settled_at) }),
      ...(row.settled_steps === null ? {} : { settledSteps: Number(row.settled_steps) }),
      ...(row.settled_tokens === null ? {} : { settledTokens: Number(row.settled_tokens) }),
      ...(row.settled_dollars === null ? {} : { settledDollars: Number(row.settled_dollars) }),
    };
  }

  private mapAttempt(row: Record<string, unknown>): AgentModeAttempt {
    return {
      attemptId: String(row.attempt_id),
      runId: String(row.run_id),
      agentId: String(row.agent_id),
      runtimeRef: String(row.runtime_ref),
      routeRef: String(row.route_ref),
      modelRef: String(row.model_ref),
      policyVersion: String(row.policy_version),
      capabilityScopeHash: String(row.capability_scope_hash),
      budgetScopeId: String(row.budget_scope_id),
      ...(row.reservation_id === null ? {} : { reservationId: String(row.reservation_id) }),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_owner_id === null ? {} : { leaseOwnerId: String(row.lease_owner_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      status: row.status as AgentModeAttemptStatus,
      cancellationStatus: row.cancellation_status as AgentModeAttempt['cancellationStatus'],
      ...(row.cancellation_requested_at === null ? {} : { cancellationRequestedAt: String(row.cancellation_requested_at) }),
      ...(row.cancellation_acknowledged_at === null ? {} : { cancellationAcknowledgedAt: String(row.cancellation_acknowledged_at) }),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      ...(row.runtime_profile_ref === null || row.runtime_profile_ref === undefined ? {} : { runtimeProfileRef: String(row.runtime_profile_ref) }),
      ...(row.child_agent_id === null || row.child_agent_id === undefined ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.assignment_intent_key === null || row.assignment_intent_key === undefined ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
    };
  }

  appendEvent(event: AgentModeEvent): void {
    const nextSequence = this.database.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM events').get() as { next_sequence?: number };
    this.database.prepare(`
      INSERT INTO events (event_id, sequence, entity_type, entity_id, event_type, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(event.eventId, nextSequence.next_sequence ?? 1, event.entityType, event.entityId, event.eventType, event.occurredAt, JSON.stringify(event.payload));
  }

  private appendEventIfAbsent(event: AgentModeEvent): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT entity_type, entity_id, event_type, occurred_at, payload_json FROM events WHERE event_id = ?').get(event.eventId) as Record<string, unknown> | undefined;
    if (existing) {
      const same = existing.entity_type === event.entityType
        && existing.entity_id === event.entityId
        && existing.event_type === event.eventType
        && existing.occurred_at === event.occurredAt
        && existing.payload_json === JSON.stringify(event.payload);
      if (!same) throw new Error(`event conflict: ${event.eventId}`);
      return 'duplicate';
    }
    this.appendEvent(event);
    return 'created';
  }

  listEvents(entityId: string): AgentModeEvent[] {
    const rows = this.database.prepare('SELECT * FROM events WHERE entity_id = ? ORDER BY sequence, event_id').all(entityId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  listEventsAfterSequence(afterSequence: number, limit = 101): AgentModeEvent[] {
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error('event sequence cursor is invalid');
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 501));
    const rows = this.database.prepare('SELECT * FROM events WHERE sequence > ? ORDER BY sequence ASC LIMIT ?').all(afterSequence, boundedLimit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  getHighestEventSequence(): number {
    const row = this.database.prepare('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM events').get() as { sequence?: number };
    const sequence = Number(row.sequence ?? 0);
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('event sequence state is invalid');
    return sequence;
  }

  listRecentEvents(limit = 100): AgentModeEvent[] {
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 500));
    const rows = this.database.prepare('SELECT * FROM events ORDER BY sequence DESC, event_id DESC LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>;
    return rows.reverse().map((row) => ({
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  recordEvent(event: AgentModeEvent): AgentModeOperationResult {
    return this.withTransaction(() => this.appendEventIfAbsent(event));
  }

  admitAttempt(admission: AgentModeAdmission): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(admission.attempt.attemptId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.run_id === admission.attempt.runId
          && existing.agent_id === admission.attempt.agentId
          && existing.runtime_ref === admission.attempt.runtimeRef
          && existing.route_ref === admission.attempt.routeRef
          && existing.model_ref === admission.attempt.modelRef
          && existing.policy_version === admission.attempt.policyVersion
          && existing.capability_scope_hash === admission.attempt.capabilityScopeHash
          && existing.budget_scope_id === admission.attempt.budgetScopeId
          && existing.reservation_id === admission.estimate.reservationId
          && existing.lease_id === admission.lease.leaseId;
        if (!same) return 'conflict';
        if (existing.status === 'admitted' || existing.status === 'running') return 'duplicate';
      }

      if (this.ensureTask(admission.task) === 'conflict') return 'conflict';
      if (this.ensureRun(admission.run) === 'conflict') return 'conflict';
      if (!existing) {
        this.database.prepare(`
          INSERT INTO attempts (
            attempt_id, run_id, agent_id, runtime_ref, route_ref, model_ref,
            policy_version, capability_scope_hash, budget_scope_id, status,
            cancellation_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 'running', ?, ?)
        `).run(
          admission.attempt.attemptId,
          admission.attempt.runId,
          admission.attempt.agentId,
          admission.attempt.runtimeRef,
          admission.attempt.routeRef,
          admission.attempt.modelRef,
          admission.attempt.policyVersion,
          admission.attempt.capabilityScopeHash,
          admission.attempt.budgetScopeId,
          admission.now,
          admission.now,
        );
      }

      this.ensureBudgetScope(admission.budget);
      const reservationResult = this.reserveBudgetInternal({
        reservationId: admission.estimate.reservationId,
        budgetScopeId: admission.budget.budgetScopeId,
        attemptId: admission.attempt.attemptId,
        steps: admission.estimate.steps,
        tokens: admission.estimate.tokens,
        dollars: admission.estimate.dollars,
        status: 'reserved',
        createdAt: admission.now,
      });
      if (reservationResult === 'conflict') return 'conflict';

      const lease = this.acquireLeaseAt(admission.lease, admission.now);
      if (!lease) throw new Error(`lease unavailable for ${admission.lease.resourceKey}`);
      this.database.prepare(`
        UPDATE attempts SET
            reservation_id = ?, lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?,
          status = 'admitted', updated_at = ?
        WHERE attempt_id = ?
      `).run(
        admission.estimate.reservationId,
        admission.lease.resourceKey,
        admission.lease.leaseId,
        admission.lease.ownerId,
        lease.fence,
        admission.now,
        admission.attempt.attemptId,
      );
      this.database.prepare('UPDATE tasks SET status = \'admitted\' WHERE task_id = ?').run(admission.task.taskId);
      this.database.prepare('UPDATE runs SET status = \'active\' WHERE run_id = ?').run(admission.run.runId);
      this.appendEventIfAbsent({
        eventId: admission.eventId ?? `admission:${admission.attempt.attemptId}`,
        entityType: 'attempt',
        entityId: admission.attempt.attemptId,
        eventType: 'attempt_admitted',
        occurredAt: admission.now,
        payload: {
          taskId: admission.task.taskId,
          runId: admission.run.runId,
          reservationId: admission.estimate.reservationId,
          leaseFence: lease.fence,
        },
      });
      this.failIfInjected('admission');
      return reservationResult === 'duplicate' ? 'duplicate' : 'created';
    });
  }

  private ensureTask(task: AgentModeTask): AgentModeOperationResult {
    return this.createTask(task);
  }

  private ensureRun(run: AgentModeRun): AgentModeOperationResult {
    return this.createRun(run);
  }

  private ensureBudgetScope(budget: AgentModeBudgetLimits): void {
    const existing = this.database.prepare('SELECT * FROM budget_scopes WHERE budget_scope_id = ?').get(budget.budgetScopeId) as Record<string, unknown> | undefined;
    if (existing) {
      if (Number(existing.max_steps) !== budget.maxSteps
        || Number(existing.max_tokens) !== budget.maxTokens
        || Number(existing.max_dollars) !== budget.maxDollars) {
        throw new Error(`budget scope conflict: ${budget.budgetScopeId}`);
      }
      return;
    }
    this.database.prepare(`
      INSERT INTO budget_scopes (
        budget_scope_id, max_steps, max_tokens, max_dollars
      ) VALUES (?, ?, ?, ?)
    `).run(budget.budgetScopeId, budget.maxSteps, budget.maxTokens, budget.maxDollars);
  }

  private reserveBudgetInternal(reservation: AgentModeBudgetReservation): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT * FROM budget_reservations WHERE reservation_id = ?').get(reservation.reservationId) as Record<string, unknown> | undefined;
    if (existing) {
      const same = existing.budget_scope_id === reservation.budgetScopeId
        && existing.attempt_id === reservation.attemptId
        && Number(existing.steps) === reservation.steps
        && Number(existing.tokens) === reservation.tokens
        && Number(existing.dollars) === reservation.dollars;
      return same ? 'duplicate' : 'conflict';
    }
    const result = this.database.prepare(`
      UPDATE budget_scopes SET
        reserved_steps = reserved_steps + ?,
        reserved_tokens = reserved_tokens + ?,
        reserved_dollars = reserved_dollars + ?
      WHERE budget_scope_id = ?
        AND used_steps + reserved_steps + ? <= max_steps
        AND used_tokens + reserved_tokens + ? <= max_tokens
        AND used_dollars + reserved_dollars + ? <= max_dollars
    `).run(
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      reservation.budgetScopeId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
    );
    if (result.changes !== 1) throw new Error(`budget exhausted for ${reservation.budgetScopeId}`);
    this.database.prepare(`
      INSERT INTO budget_reservations (
        reservation_id, budget_scope_id, attempt_id, steps, tokens, dollars,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)
    `).run(
      reservation.reservationId,
      reservation.budgetScopeId,
      reservation.attemptId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      reservation.createdAt,
    );
    return 'created';
  }

  reserveBudget(reservation: AgentModeBudgetReservation, budget: AgentModeBudgetLimits): AgentModeOperationResult {
    return this.withTransaction(() => {
      this.ensureBudgetScope(budget);
      const result = this.reserveBudgetInternal(reservation);
      return result;
    });
  }

  prepareOperation(operation: Omit<AgentModePreparedOperation, 'preparedAt'> & { preparedAt?: string }): AgentModeOperationResult {
    const preparedAt = operation.preparedAt ?? new Date().toISOString();
    return this.withTransaction(() => {
      const attempt = this.getAttempt(operation.attemptId);
      if (!attempt) throw new Error(`attempt not found: ${operation.attemptId}`);
      if (attempt.cancellationStatus !== 'running') throw new Error(`cancellation requested for attempt ${operation.attemptId}`);
      if (attempt.status === 'paused') throw new Error(`run paused for attempt ${operation.attemptId}`);
      const existing = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operation.operationId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.attempt_id === operation.attemptId
          && existing.effect_kind === operation.effectKind
          && existing.scope_hash === operation.scopeHash
          && existing.capability_id === operation.capabilityId
          && existing.grant_id === (operation.grantId ?? null)
          && existing.policy_version === operation.policyVersion
          && existing.deadline === operation.deadline
          && existing.lease_resource_key === (operation.leaseResourceKey ?? null)
          && existing.lease_id === (operation.leaseId ?? null)
          && existing.lease_fence === (operation.leaseFence ?? null);
        return same ? 'duplicate' : 'conflict';
      }
      if (operation.leaseFence !== undefined) {
        this.assertCurrentLease(operation.attemptId, operation.leaseResourceKey, operation.leaseId, operation.leaseFence, preparedAt);
      } else if (attempt.leaseId) {
        throw new Error('operation missing attempt lease fence');
      }
      this.database.prepare(`
        INSERT INTO effects (
          operation_id, attempt_id, effect_kind, scope_hash, status, receipt_json,
          capability_id, grant_id, policy_version, lease_resource_key, lease_id, lease_fence,
          deadline, prepared_at
        ) VALUES (?, ?, ?, ?, 'prepared', NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        operation.operationId,
        operation.attemptId,
        operation.effectKind,
        operation.scopeHash,
        operation.capabilityId,
        operation.grantId ?? null,
        operation.policyVersion,
        operation.leaseResourceKey ?? null,
        operation.leaseId ?? null,
        operation.leaseFence ?? null,
        operation.deadline,
        preparedAt,
      );
      this.database.prepare(`
        INSERT INTO dispatch_outbox (
          operation_id, attempt_id, effect_kind, capability_id, grant_id, scope_hash,
          policy_version, lease_resource_key, lease_id, lease_fence, deadline,
          state, prepared_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dispatchable', ?)
      `).run(
        operation.operationId,
        operation.attemptId,
        operation.effectKind,
        operation.capabilityId,
        operation.grantId ?? null,
        operation.scopeHash,
        operation.policyVersion,
        operation.leaseResourceKey ?? null,
        operation.leaseId ?? null,
        operation.leaseFence ?? null,
        operation.deadline,
        preparedAt,
      );
      this.appendEventIfAbsent({
        eventId: `operation-prepared:${operation.operationId}`,
        entityType: 'operation',
        entityId: operation.operationId,
        eventType: 'operation_prepared',
        occurredAt: preparedAt,
        payload: { attemptId: operation.attemptId, scopeHash: operation.scopeHash },
      });
      this.failIfInjected('effect-preparation');
      return 'created';
    });
  }

  getOutbox(operationId: string): AgentModeDispatchOutbox | undefined {
    const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      capabilityId: String(row.capability_id),
      ...(row.grant_id === null ? {} : { grantId: String(row.grant_id) }),
      scopeHash: String(row.scope_hash),
      policyVersion: String(row.policy_version),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      deadline: String(row.deadline),
      state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at),
      ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.dispatch_id == null ? {} : { dispatchId: String(row.dispatch_id) }),
      ...(row.assignment_intent_key == null ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.child_agent_id == null ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.runtime_ref == null ? {} : { runtimeRef: String(row.runtime_ref) }),
      ...(row.runtime_profile_ref == null ? {} : { runtimeProfileRef: String(row.runtime_profile_ref) }),
      ...(row.controller_ref == null ? {} : { controllerRef: String(row.controller_ref) }),
    };
  }

  listOutbox(): AgentModeDispatchOutbox[] {
    const rows = this.database.prepare('SELECT * FROM dispatch_outbox ORDER BY prepared_at, operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      capabilityId: String(row.capability_id),
      ...(row.grant_id === null ? {} : { grantId: String(row.grant_id) }),
      scopeHash: String(row.scope_hash),
      policyVersion: String(row.policy_version),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      deadline: String(row.deadline),
      state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at),
      ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.dispatch_id == null ? {} : { dispatchId: String(row.dispatch_id) }),
      ...(row.assignment_intent_key == null ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.child_agent_id == null ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.runtime_ref == null ? {} : { runtimeRef: String(row.runtime_ref) }),
      ...(row.runtime_profile_ref == null ? {} : { runtimeProfileRef: String(row.runtime_profile_ref) }),
      ...(row.controller_ref == null ? {} : { controllerRef: String(row.controller_ref) }),
    }));
  }

  markDispatched(operationId: string, now: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      if (row.state === 'dispatched' || row.state === 'effect_applied' || row.state === 'receipt_recorded' || row.state === 'verified' || row.state === 'failed' || row.state === 'uncertain') return 'duplicate';
      const attempt = this.getAttempt(String(row.attempt_id));
      if (attempt?.cancellationStatus !== 'running') throw new Error(`cancellation requested for attempt ${String(row.attempt_id)}`);
      if (attempt?.status === 'paused') throw new Error(`run paused for attempt ${String(row.attempt_id)}`);
      this.assertCurrentLease(
        String(row.attempt_id),
        row.lease_resource_key === null ? undefined : String(row.lease_resource_key),
        row.lease_id === null ? undefined : String(row.lease_id),
        row.lease_fence === null ? undefined : Number(row.lease_fence),
        now,
      );
      this.database.prepare("UPDATE dispatch_outbox SET state = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND state = 'dispatchable'").run(now, operationId);
      this.database.prepare("UPDATE effects SET status = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND status = 'prepared'").run(now, operationId);
      this.appendEventIfAbsent({
        eventId: `operation-dispatched:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'operation_dispatched',
        occurredAt: now,
        payload: { attemptId: String(row.attempt_id) },
      });
      return 'created';
    });
  }

  markEffectObserved(operationId: string, now: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT attempt_id, status FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      if (row.status === 'effect_applied' || row.status === 'receipt_recorded' || row.status === 'succeeded' || row.status === 'failed' || row.status === 'uncertain') return 'duplicate';
      this.database.prepare("UPDATE effects SET status = 'effect_applied', observed_at = ? WHERE operation_id = ?").run(now, operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'effect_applied' WHERE operation_id = ?").run(operationId);
      this.appendEventIfAbsent({
        eventId: `effect-observed:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'effect_observed_without_receipt',
        occurredAt: now,
        payload: { attemptId: String(row.attempt_id) },
      });
      return 'created';
    });
  }

  markOperationVerified(operationId: string, verification: AgentModeVerification): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT attempt_id, status FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      const outbox = this.database.prepare('SELECT state FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as { state?: string } | undefined;
      if (row.status !== 'receipt_recorded' && row.status !== 'succeeded') throw new Error(`operation is not receipt-recorded: ${operationId}`);
      if (row.status === 'succeeded' && outbox?.state === 'verified') return 'duplicate';
      this.database.prepare("UPDATE effects SET status = 'succeeded' WHERE operation_id = ?").run(operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'verified' WHERE operation_id = ?").run(operationId);
      this.appendEventIfAbsent({
        eventId: `operation-verified:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'operation_verified',
        occurredAt: verification.verifiedAt,
        payload: {
          attemptId: String(row.attempt_id),
          resultHash: verification.resultHash,
          evidenceRef: verification.evidenceRef,
        },
      });
      return 'created';
    });
  }

  private assertCurrentLease(attemptId: string, resourceKey: string | undefined, leaseId: string | undefined, fence: number | undefined, now: string): void {
    if (!resourceKey || !leaseId || fence === undefined) throw new Error('stale lease fence: incomplete lease identity');
    const attempt = this.getAttempt(attemptId);
    const lease = this.database.prepare('SELECT lease_id, owner_id, fence, expires_at FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
    if (!attempt || attempt.leaseResourceKey !== resourceKey || attempt.leaseId !== leaseId || attempt.leaseFence !== fence
      || !lease || lease.lease_id !== leaseId || Number(lease.fence) !== fence || lease.owner_id !== attempt.leaseOwnerId
      || String(lease.expires_at) <= now) {
      throw new Error(`stale lease fence for attempt ${attemptId}`);
    }
  }

  private isCurrentLeaseForAttempt(attemptId: string, now: string): boolean {
    const attempt = this.getAttempt(attemptId);
    if (!attempt?.leaseResourceKey || !attempt.leaseId || attempt.leaseFence === undefined) return true;
    const lease = this.database.prepare('SELECT lease_id, owner_id, fence, expires_at FROM leases WHERE resource_key = ?').get(attempt.leaseResourceKey) as Record<string, unknown> | undefined;
    return Boolean(lease)
      && lease?.lease_id === attempt.leaseId
      && lease?.owner_id === attempt.leaseOwnerId
      && Number(lease?.fence) === attempt.leaseFence
      && String(lease?.expires_at) > now;
  }

  isCurrentLease(attemptId: string, resourceKey: string, leaseId: string, fence: number, now: string): boolean {
    return this.isCurrentLeaseForAttempt(attemptId, now)
      && (() => {
        try {
          this.assertCurrentLease(attemptId, resourceKey, leaseId, fence, now);
          return true;
        } catch {
          return false;
        }
      })();
  }

  private settleBudgetInternal(settlement: AgentModeBudgetSettlement): AgentModeOperationResult {
    const reservation = this.getReservation(settlement.reservationId);
    if (!reservation) throw new Error(`reservation not found: ${settlement.reservationId}`);
    if (reservation.status === 'settled') {
      const same = reservation.settledSteps === settlement.steps
        && reservation.settledTokens === settlement.tokens
        && reservation.settledDollars === settlement.dollars;
      return same ? 'duplicate' : 'conflict';
    }
    if ([settlement.steps, settlement.tokens, settlement.dollars].some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error('invalid budget settlement');
    }
    const result = this.database.prepare(`
      UPDATE budget_scopes SET
        reserved_steps = reserved_steps - ?,
        used_steps = used_steps + ?,
        reserved_tokens = reserved_tokens - ?,
        used_tokens = used_tokens + ?,
        reserved_dollars = reserved_dollars - ?,
        used_dollars = used_dollars + ?
      WHERE budget_scope_id = ?
        AND reserved_steps >= ?
        AND reserved_tokens >= ?
        AND reserved_dollars >= ?
        AND used_steps + ? <= max_steps
        AND used_tokens + ? <= max_tokens
        AND used_dollars + ? <= max_dollars
    `).run(
      reservation.steps,
      settlement.steps,
      reservation.tokens,
      settlement.tokens,
      reservation.dollars,
      settlement.dollars,
      reservation.budgetScopeId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      settlement.steps,
      settlement.tokens,
      settlement.dollars,
    );
    if (result.changes !== 1) throw new Error(`invalid budget settlement for ${settlement.reservationId}`);
    this.database.prepare(`
      UPDATE budget_reservations SET
        status = 'settled', settled_at = ?, settled_steps = ?, settled_tokens = ?, settled_dollars = ?
      WHERE reservation_id = ? AND status = 'reserved'
    `).run(settlement.settledAt, settlement.steps, settlement.tokens, settlement.dollars, settlement.reservationId);
    this.appendEventIfAbsent({
      eventId: `budget-settled:${settlement.reservationId}`,
      entityType: 'budget_reservation',
      entityId: settlement.reservationId,
      eventType: 'budget_settled',
      occurredAt: settlement.settledAt,
      payload: {
        attemptId: reservation.attemptId,
        steps: settlement.steps,
        tokens: settlement.tokens,
        dollars: settlement.dollars,
      },
    });
    this.failIfInjected('budget-settlement');
    return 'created';
  }

  settleBudget(settlement: AgentModeBudgetSettlement): AgentModeOperationResult {
    return this.withTransaction(() => this.settleBudgetInternal(settlement));
  }

  createWorkcell(workcell: AgentModeWorkcell, receipt: AgentModeWorkcellReceipt): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM workcells WHERE workcell_id = ?').get(workcell.workcellId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_id === workcell.taskId
          && existing.run_id === workcell.runId
          && existing.attempt_id === workcell.attemptId
          && existing.repository_ref === workcell.repositoryRef
          && existing.repository_root === workcell.repositoryRoot
          && existing.worktree_path === workcell.worktreePath
          && existing.branch === workcell.branch
          && existing.owner_agent === workcell.ownerAgent
          && existing.base_ref === workcell.baseRef
          && existing.created_at === workcell.createdAt;
        if (!same) return 'conflict';
        this.recordWorkcellReceiptInternal(receipt);
        return 'duplicate';
      }
      this.database.prepare(`
        INSERT INTO workcells (
          workcell_id, task_id, run_id, attempt_id, repository_ref, repository_root,
          worktree_path, branch, owner_agent, base_ref, created_at, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        workcell.workcellId,
        workcell.taskId,
        workcell.runId,
        workcell.attemptId,
        workcell.repositoryRef,
        workcell.repositoryRoot,
        workcell.worktreePath,
        workcell.branch,
        workcell.ownerAgent,
        workcell.baseRef,
        workcell.createdAt,
        workcell.updatedAt,
        workcell.status,
      );
      this.recordWorkcellReceiptInternal(receipt);
      this.appendEventIfAbsent({
        eventId: `workcell-created:${workcell.workcellId}`,
        entityType: 'workcell',
        entityId: workcell.workcellId,
        eventType: 'workcell_created',
        occurredAt: workcell.createdAt,
        payload: { taskId: workcell.taskId, runId: workcell.runId, attemptId: workcell.attemptId, repositoryRef: workcell.repositoryRef, ownerAgent: workcell.ownerAgent },
      });
      return 'created';
    });
  }

  getWorkcell(workcellId: string): AgentModeWorkcell | undefined {
    if (!this.hasWorkcellTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcells WHERE workcell_id = ?').get(workcellId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapWorkcell(row);
  }

  listWorkcells(): AgentModeWorkcell[] {
    if (!this.hasWorkcellTables) return [];
    const rows = this.database.prepare('SELECT * FROM workcells ORDER BY created_at, workcell_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapWorkcell(row));
  }

  updateWorkcellStatus(
    workcellId: string,
    status: AgentModeWorkcellStatus,
    updatedAt: string,
    expectedStatus: AgentModeWorkcellStatus,
    receipt: AgentModeWorkcellReceipt,
  ): AgentModeOperationResult {
    return this.withTransaction(() => {
      const current = this.getWorkcell(workcellId);
      if (!current) throw new Error(`workcell not found: ${workcellId}`);
      if (current.status !== expectedStatus) return current.status === status ? 'duplicate' : 'conflict';
      this.database.prepare('UPDATE workcells SET status = ?, updated_at = ? WHERE workcell_id = ? AND status = ?')
        .run(status, updatedAt, workcellId, expectedStatus);
      this.recordWorkcellReceiptInternal(receipt);
      this.appendEventIfAbsent({
        eventId: `workcell-${receipt.operation}:${workcellId}:${receipt.operationHash}`,
        entityType: 'workcell',
        entityId: workcellId,
        eventType: `workcell_${receipt.operation}`,
        occurredAt: updatedAt,
        payload: { status, actor: receipt.actor, operationHash: receipt.operationHash },
      });
      return 'created';
    });
  }

  recordWorkcellReceipt(receipt: AgentModeWorkcellReceipt): AgentModeOperationResult {
    return this.withTransaction(() => this.recordWorkcellReceiptInternal(receipt));
  }

  private recordWorkcellReceiptInternal(receipt: AgentModeWorkcellReceipt): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    const serialized = JSON.stringify(receipt);
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`workcell receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    if (!this.getWorkcell(receipt.workcellId)) throw new Error(`workcell not found: ${receipt.workcellId}`);
    this.database.prepare(`
      INSERT INTO workcell_receipts (
        receipt_id, workcell_id, receipt_type, task_id, run_id, attempt_id,
        repository_ref, actor, timestamp, operation_hash, operation, result_state, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      receipt.receiptId,
      receipt.workcellId,
      receipt.receiptType,
      receipt.taskId,
      receipt.runId,
      receipt.attemptId,
      receipt.repositoryRef,
      receipt.actor,
      receipt.timestamp,
      receipt.operationHash,
      receipt.operation,
      receipt.resultState,
      serialized,
    );
    return 'created';
  }

  listWorkcellReceipts(workcellId: string): AgentModeWorkcellReceipt[] {
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_receipts WHERE workcell_id = ? ORDER BY timestamp, receipt_id').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWorkcellReceipt);
  }

  private mapWorkcell(row: Record<string, unknown>): AgentModeWorkcell {
    return {
      workcellId: String(row.workcell_id),
      taskId: String(row.task_id),
      runId: String(row.run_id),
      attemptId: String(row.attempt_id),
      repositoryRef: String(row.repository_ref),
      repositoryRoot: String(row.repository_root),
      worktreePath: String(row.worktree_path),
      branch: String(row.branch),
      ownerAgent: String(row.owner_agent),
      baseRef: String(row.base_ref),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      status: row.status as AgentModeWorkcellStatus,
    };
  }

  getWorkcellWriterLease(leaseId: string): AgentModeWriterLease | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_writer_leases WHERE lease_id = ?').get(leaseId) as Record<string, unknown> | undefined;
    return row ? this.mapWriterLease(row) : undefined;
  }

  listWorkcellWriterLeases(workcellId: string): AgentModeWriterLease[] {
    if (!this.hasWriterTables) return [];
    const rows = this.database.prepare('SELECT * FROM workcell_writer_leases WHERE workcell_id = ? ORDER BY fence_token, lease_id').all(workcellId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapWriterLease(row));
  }

  grantWorkcellWriterLease(input: {
    leaseId: string;
    workcellId: string;
    ownerAgent: string;
    ownerAttempt: string;
    createdAt: string;
    expiresAt: string;
  }): { result: 'granted' | 'duplicate' | 'rejected'; lease?: AgentModeWriterLease; receipt: AgentModeWriterReceipt; reason?: string } {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${input.workcellId}`);
      const existing = this.getWorkcellWriterLease(input.leaseId);
      if (existing) {
        const same = existing.workcellId === input.workcellId
          && existing.ownerAgent === input.ownerAgent
          && existing.ownerAttempt === input.ownerAttempt
          && existing.createdAt === input.createdAt
          && existing.expiresAt === input.expiresAt;
        if (!same) throw new Error(`writer lease conflict: ${input.leaseId}`);
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseGrantedReceipt', 'grant', input.createdAt, existing.status, existing.leaseId, existing.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'duplicate', lease: existing, receipt };
      }
      if (!['prepared', 'active', 'testing'].includes(workcell.status)) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'lease-grant', input.createdAt, 'workcell_state_rejected', null, null, { requestedLeaseId: input.leaseId });
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', receipt, reason: `workcell state does not allow writing: ${workcell.status}` };
      }
      const active = this.database.prepare("SELECT * FROM workcell_writer_leases WHERE workcell_id = ? AND status = 'active'").get(input.workcellId) as Record<string, unknown> | undefined;
      if (active && Date.parse(String(active.expires_at)) > Date.parse(input.createdAt)) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'lease-grant', input.createdAt, 'active_writer_exists', String(active.lease_id), Number(active.fence_token), { requestedLeaseId: input.leaseId });
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', receipt, reason: 'an active writer lease already exists' };
      }
      if (active) {
        this.database.prepare("UPDATE workcell_writer_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(String(active.lease_id));
        const expiryReceipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'expire', input.createdAt, 'expired', String(active.lease_id), Number(active.fence_token));
        this.recordWriterReceiptInternal(expiryReceipt);
        this.appendEventIfAbsent({ eventId: `writer-lease-expired:${active.lease_id}`, entityType: 'workcell_writer_lease', entityId: String(active.lease_id), eventType: 'writer_lease_expired', occurredAt: input.createdAt, payload: { workcellId: input.workcellId, fenceToken: Number(active.fence_token) } });
      }
      const maxFence = this.database.prepare('SELECT COALESCE(MAX(fence_token), 0) AS max_fence FROM workcell_writer_leases WHERE workcell_id = ?').get(input.workcellId) as { max_fence?: number };
      const fenceToken = Number(maxFence.max_fence ?? 0) + 1;
      const lease: AgentModeWriterLease = { ...input, fenceToken, status: 'active' };
      this.database.prepare(`
        INSERT INTO workcell_writer_leases (
          lease_id, workcell_id, owner_agent, owner_attempt, created_at, expires_at, fence_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(lease.leaseId, lease.workcellId, lease.ownerAgent, lease.ownerAttempt, lease.createdAt, lease.expiresAt, lease.fenceToken);
      const receipt = makeWriterReceipt(workcell, 'WriterLeaseGrantedReceipt', 'grant', input.createdAt, 'active', lease.leaseId, lease.fenceToken);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `writer-lease-granted:${lease.leaseId}`, entityType: 'workcell_writer_lease', entityId: lease.leaseId, eventType: 'writer_lease_granted', occurredAt: input.createdAt, payload: { workcellId: lease.workcellId, ownerAgent: lease.ownerAgent, ownerAttempt: lease.ownerAttempt, fenceToken: lease.fenceToken } });
      return { result: 'granted', lease, receipt };
    });
  }

  releaseWorkcellWriterLease(input: {
    leaseId: string;
    ownerAgent: string;
    ownerAttempt: string;
    releasedAt: string;
  }): { result: 'released' | 'duplicate' | 'rejected'; lease: AgentModeWriterLease; receipt: AgentModeWriterReceipt; reason?: string } {
    return this.withTransaction(() => {
      const lease = this.getWorkcellWriterLease(input.leaseId);
      if (!lease) throw new Error(`writer lease not found: ${input.leaseId}`);
      const workcell = this.getWorkcell(lease.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${lease.workcellId}`);
      if (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'lease-release', input.releasedAt, 'wrong_owner', lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', lease, receipt, reason: 'writer lease owner does not match' };
      }
      if (lease.status !== 'active') {
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'release', input.releasedAt, lease.status, lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'duplicate', lease, receipt };
      }
      if (Date.parse(lease.expiresAt) <= Date.parse(input.releasedAt)) {
        this.database.prepare("UPDATE workcell_writer_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(lease.leaseId);
        const expired = { ...lease, status: 'expired' as const };
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'expire', input.releasedAt, 'expired', lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', lease: expired, receipt, reason: 'writer lease expired' };
      }
      this.database.prepare("UPDATE workcell_writer_leases SET status = 'released' WHERE lease_id = ? AND status = 'active'").run(lease.leaseId);
      const released = { ...lease, status: 'released' as const };
      const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'release', input.releasedAt, 'released', lease.leaseId, lease.fenceToken);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `writer-lease-released:${lease.leaseId}`, entityType: 'workcell_writer_lease', entityId: lease.leaseId, eventType: 'writer_lease_released', occurredAt: input.releasedAt, payload: { workcellId: lease.workcellId, fenceToken: lease.fenceToken } });
      return { result: 'released', lease: released, receipt };
    });
  }

  expireWorkcellWriterLeases(now: string): AgentModeWriterLease[] {
    return this.withTransaction(() => {
      const rows = this.database.prepare("SELECT * FROM workcell_writer_leases WHERE status = 'active' AND expires_at <= ? ORDER BY workcell_id, fence_token").all(now) as Array<Record<string, unknown>>;
      const expired: AgentModeWriterLease[] = [];
      for (const row of rows) {
        const lease = this.mapWriterLease(row);
        const workcell = this.getWorkcell(lease.workcellId);
        if (!workcell) continue;
        this.database.prepare("UPDATE workcell_writer_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(lease.leaseId);
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'expire', now, 'expired', lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        this.appendEventIfAbsent({ eventId: `writer-lease-expired:${lease.leaseId}`, entityType: 'workcell_writer_lease', entityId: lease.leaseId, eventType: 'writer_lease_expired', occurredAt: now, payload: { workcellId: lease.workcellId, fenceToken: lease.fenceToken } });
        expired.push({ ...lease, status: 'expired' });
      }
      return expired;
    });
  }

  admitWorkcellWrite(input: {
    workcellId: string;
    capability: string;
    ownerAgent: string;
    ownerAttempt: string;
    leaseId: string | null;
    fenceToken: number | null;
    repositoryRoot: string;
    worktreePath: string;
    now: string;
    resourceValid?: boolean;
  }): { ok: boolean; reason: string; operationHash: string; receipt?: AgentModeWriterReceipt } {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) return { ok: false, reason: 'workcell_not_found', operationHash: writerOperationHash(input) };
      const operationHash = writerOperationHash(input);
      let reason: string | undefined;
      if (input.capability !== 'repo.write(workcell)') reason = 'capability_not_admitted';
      else if (!['prepared', 'active', 'testing'].includes(workcell.status)) reason = 'workcell_state_does_not_allow_writing';
      else if (input.repositoryRoot !== workcell.repositoryRoot || input.worktreePath !== workcell.worktreePath || input.worktreePath === input.repositoryRoot || input.resourceValid === false) reason = 'resource_binding_mismatch';
      const lease = input.leaseId ? this.getWorkcellWriterLease(input.leaseId) : undefined;
      if (!reason && (!lease || lease.workcellId !== workcell.workcellId)) reason = 'lease_missing';
      if (!reason && lease && lease.status !== 'active') reason = `lease_${lease.status}`;
      if (!reason && lease && Date.parse(lease.expiresAt) <= Date.parse(input.now)) reason = 'lease_expired';
      if (!reason && lease && (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt)) reason = 'wrong_owner';
      if (!reason && lease && lease.fenceToken !== input.fenceToken) reason = 'stale_fence_token';
      if (reason) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'write-admission', input.now, reason, input.leaseId, input.fenceToken, { operationHash });
        this.recordWriterReceiptInternal(receipt);
        this.appendEventIfAbsent({ eventId: `write-rejected:${operationHash}`, entityType: 'workcell', entityId: workcell.workcellId, eventType: 'workcell_write_rejected', occurredAt: input.now, payload: { reason, operationHash, leaseId: input.leaseId, fenceToken: input.fenceToken } });
        return { ok: false, reason, operationHash, receipt };
      }
      this.appendEventIfAbsent({ eventId: `write-admitted:${operationHash}`, entityType: 'workcell', entityId: workcell.workcellId, eventType: 'workcell_write_admitted', occurredAt: input.now, payload: { operationHash, leaseId: input.leaseId, fenceToken: input.fenceToken } });
      return { ok: true, reason: 'writer lease and Workcell capability admitted', operationHash };
    });
  }

  prepareWorkcellMutation(input: {
    operationId: string;
    workcellId: string;
    capability: string;
    ownerAgent: string;
    ownerAttempt: string;
    leaseId: string;
    fenceToken: number;
    repositoryRoot: string;
    worktreePath: string;
    resourceValid: boolean;
    relativePath: string;
    expectedPreimageHash: string;
    replacementHash: string;
    operationHash: string;
    preparedAt: string;
  }): { result: 'prepared' | 'duplicate' | 'conflict' | 'rejected'; mutation?: AgentModeWorkcellMutation; receipt?: AgentModeWorkcellWriteReceipt; reason?: string } {
    return this.withTransaction(() => {
      const existing = this.getWorkcellMutation(input.operationId);
      if (existing) {
        if (existing.operationHash !== input.operationHash) {
          return { result: 'conflict', mutation: existing, reason: 'operation_id_reused_for_different_mutation' };
        }
        return { result: 'duplicate', mutation: existing };
      }
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${input.workcellId}`);
      const lease = this.getWorkcellWriterLease(input.leaseId);
      let reason: string | undefined;
      if (input.capability !== 'repo.write(workcell)') reason = 'capability_not_admitted';
      else if (!['prepared', 'active', 'testing'].includes(workcell.status)) reason = 'workcell_state_does_not_allow_writing';
      else if (input.repositoryRoot !== workcell.repositoryRoot || input.worktreePath !== workcell.worktreePath || input.worktreePath === input.repositoryRoot || !input.resourceValid) reason = 'resource_binding_mismatch';
      else if (!lease || lease.workcellId !== workcell.workcellId) reason = 'lease_missing';
      else if (lease.status !== 'active') reason = `lease_${lease.status}`;
      else if (Date.parse(lease.expiresAt) <= Date.parse(input.preparedAt)) reason = 'lease_expired';
      else if (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt) reason = 'wrong_owner';
      else if (lease.fenceToken !== input.fenceToken) reason = 'stale_fence_token';

      const baseMutation: AgentModeWorkcellMutation = {
        operationId: input.operationId,
        taskId: workcell.taskId,
        runId: workcell.runId,
        attemptId: workcell.attemptId,
        workcellId: workcell.workcellId,
        repositoryRef: workcell.repositoryRef,
        relativePath: input.relativePath,
        leaseId: input.leaseId,
        fenceToken: input.fenceToken,
        expectedPreimageHash: input.expectedPreimageHash,
        preimageState: 'present',
        preimageHash: undefined,
        replacementHash: input.replacementHash,
        postimageHash: undefined,
        operationHash: input.operationHash,
        status: reason ? 'rejected' : 'prepared',
        createdAt: input.preparedAt,
        updatedAt: input.preparedAt,
      };
      this.insertWorkcellMutation(baseMutation);
      if (reason) {
        const receipt = makeWorkcellWriteReceipt(workcell, {
          operationId: input.operationId,
          leaseId: input.leaseId,
          fenceToken: input.fenceToken,
          relativePath: input.relativePath,
          preimageHash: input.expectedPreimageHash,
          postimageHash: null,
          timestamp: input.preparedAt,
          result: reason,
          operationHash: input.operationHash,
        }, 'WorkcellWriteRejectedReceipt');
        this.recordWorkcellWriteReceiptInternal(receipt, 'rejected');
        this.appendEventIfAbsent({ eventId: `workcell-file-rejected:${input.operationId}:${input.operationHash}`, entityType: 'workcell_file_mutation', entityId: input.operationId, eventType: 'workcell_file_write_rejected', occurredAt: input.preparedAt, payload: { workcellId: workcell.workcellId, relativePath: input.relativePath, reason, operationHash: input.operationHash } });
        return { result: 'rejected', mutation: baseMutation, receipt, reason };
      }
      this.appendEventIfAbsent({ eventId: `workcell-file-prepared:${input.operationId}`, entityType: 'workcell_file_mutation', entityId: input.operationId, eventType: 'workcell_file_write_prepared', occurredAt: input.preparedAt, payload: { workcellId: workcell.workcellId, relativePath: input.relativePath, leaseId: input.leaseId, fenceToken: input.fenceToken, operationHash: input.operationHash } });
      return { result: 'prepared', mutation: baseMutation };
    });
  }

  getWorkcellMutation(operationId: string): AgentModeWorkcellMutation | undefined {
    if (!this.hasMutationTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_file_mutations WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    return row ? this.mapWorkcellMutation(row) : undefined;
  }

  listWorkcellMutations(workcellId?: string): AgentModeWorkcellMutation[] {
    if (!this.hasMutationTables) return [];
    const rows = (workcellId
      ? this.database.prepare('SELECT * FROM workcell_file_mutations WHERE workcell_id = ? ORDER BY created_at, operation_id').all(workcellId)
      : this.database.prepare('SELECT * FROM workcell_file_mutations ORDER BY created_at, operation_id').all()) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapWorkcellMutation(row));
  }

  markWorkcellMutationPreimage(operationId: string, preimageHash: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
      if (mutation.preimageHash === preimageHash && mutation.status !== 'rejected') return 'duplicate';
      if (mutation.status !== 'prepared' || mutation.expectedPreimageHash !== preimageHash) return 'conflict';
      this.database.prepare("UPDATE workcell_file_mutations SET preimage_hash = ?, status = 'preimage_verified', updated_at = ? WHERE operation_id = ? AND status = 'prepared'").run(preimageHash, updatedAt, operationId);
      return 'created';
    });
  }

  markWorkcellMutationTempPrepared(operationId: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
      if (mutation.status === 'temp_prepared') return 'duplicate';
      if (mutation.status !== 'preimage_verified') return 'conflict';
      this.database.prepare("UPDATE workcell_file_mutations SET status = 'temp_prepared', updated_at = ? WHERE operation_id = ? AND status = 'preimage_verified'").run(updatedAt, operationId);
      return 'created';
    });
  }

  markWorkcellMutationEffectApplied(operationId: string, postimageHash: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
      if (mutation.postimageHash === postimageHash && mutation.status === 'effect_applied') return 'duplicate';
      if (!['preimage_verified', 'temp_prepared'].includes(mutation.status)) return 'conflict';
      this.database.prepare("UPDATE workcell_file_mutations SET postimage_hash = ?, status = 'effect_applied', updated_at = ? WHERE operation_id = ? AND status IN ('preimage_verified', 'temp_prepared')").run(postimageHash, updatedAt, operationId);
      return 'created';
    });
  }

  validateWorkcellMutationLease(operationId: string, now: string): { ok: boolean; reason?: string } {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) return { ok: false, reason: 'mutation_not_found' };
      const workcell = this.getWorkcell(mutation.workcellId);
      if (!workcell || !['prepared', 'active', 'testing'].includes(workcell.status)) return { ok: false, reason: 'workcell_state_does_not_allow_writing' };
      const lease = this.getWorkcellWriterLease(mutation.leaseId);
      if (!lease || lease.workcellId !== mutation.workcellId) return { ok: false, reason: 'lease_missing' };
      if (lease.status !== 'active') return { ok: false, reason: `lease_${lease.status}` };
      if (Date.parse(lease.expiresAt) <= Date.parse(now)) return { ok: false, reason: 'lease_expired' };
      if (lease.fenceToken !== mutation.fenceToken) return { ok: false, reason: 'stale_fence_token' };
      return { ok: true };
    });
  }

  recordWorkcellWriteReceipt(receipt: AgentModeWorkcellWriteReceipt, status: 'receipt_recorded' | 'reconciled' | 'rejected' = 'receipt_recorded'): AgentModeOperationResult {
    return this.withTransaction(() => this.recordWorkcellWriteReceiptInternal(receipt, status));
  }

  getWorkcellWriteReceipt(operationId: string): AgentModeWorkcellWriteReceipt | undefined {
    if (!this.hasMutationTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM workcell_write_receipts WHERE operation_id = ? ORDER BY timestamp, receipt_id LIMIT 1').get(operationId) as { receipt_json?: string } | undefined;
    return row ? JSON.parse(String(row.receipt_json)) as AgentModeWorkcellWriteReceipt : undefined;
  }

  listWorkcellWriteReceipts(workcellId: string): AgentModeWorkcellWriteReceipt[] {
    if (!this.hasMutationTables) return [];
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_write_receipts WHERE workcell_id = ? ORDER BY timestamp, receipt_id').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWorkcellWriteReceipt);
  }

  private recordWorkcellWriteReceiptInternal(receipt: AgentModeWorkcellWriteReceipt, status: 'receipt_recorded' | 'reconciled' | 'rejected'): AgentModeOperationResult {
    const mutation = this.getWorkcellMutation(receipt.operationId);
    if (!mutation) throw new Error(`workcell mutation not found: ${receipt.operationId}`);
    if (mutation.operationHash !== receipt.operationHash || mutation.relativePath !== receipt.relativePath || mutation.leaseId !== receipt.leaseId || mutation.fenceToken !== receipt.fenceToken) throw new Error(`workcell write receipt conflicts with mutation: ${receipt.operationId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_write_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`workcell write receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO workcell_write_receipts (
        receipt_id, operation_id, task_id, run_id, attempt_id, workcell_id,
        lease_id, fence_token, repository_ref, relative_path, preimage_hash,
        postimage_hash, timestamp, result, operation_hash, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.operationId, receipt.taskId, receipt.runId, receipt.attemptId, receipt.workcellId, receipt.leaseId, receipt.fenceToken, receipt.repositoryRef, receipt.relativePath, receipt.preimageHash, receipt.postimageHash, receipt.timestamp, receipt.result, receipt.operationHash, serialized);
    this.database.prepare('UPDATE workcell_file_mutations SET status = ?, updated_at = ?, postimage_hash = COALESCE(?, postimage_hash) WHERE operation_id = ?').run(status, receipt.timestamp, receipt.postimageHash, receipt.operationId);
    return 'created';
  }

  private insertWorkcellMutation(mutation: AgentModeWorkcellMutation): void {
    this.database.prepare(`
      INSERT INTO workcell_file_mutations (
        operation_id, task_id, run_id, attempt_id, workcell_id, repository_ref,
        relative_path, lease_id, fence_token, expected_preimage_hash,
        preimage_state, preimage_hash, replacement_hash, postimage_hash,
        operation_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mutation.operationId, mutation.taskId, mutation.runId, mutation.attemptId, mutation.workcellId, mutation.repositoryRef, mutation.relativePath, mutation.leaseId, mutation.fenceToken, mutation.expectedPreimageHash, mutation.preimageState, mutation.preimageHash ?? null, mutation.replacementHash, mutation.postimageHash ?? null, mutation.operationHash, mutation.status, mutation.createdAt, mutation.updatedAt);
  }

  private mapWorkcellMutation(row: Record<string, unknown>): AgentModeWorkcellMutation {
    return {
      operationId: String(row.operation_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), relativePath: String(row.relative_path), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), expectedPreimageHash: String(row.expected_preimage_hash), preimageState: row.preimage_state as 'present', preimageHash: row.preimage_hash == null ? undefined : String(row.preimage_hash), replacementHash: String(row.replacement_hash), postimageHash: row.postimage_hash == null ? undefined : String(row.postimage_hash), operationHash: String(row.operation_hash), status: row.status as AgentModeWorkcellMutationStatus, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  startWorkcellValidation(input: {
    validationId: string;
    workcellId: string;
    capability: string;
    ownerAgent: string;
    ownerAttempt: string;
    leaseId: string;
    fenceToken: number;
    repositoryRoot: string;
    worktreePath: string;
    resourceValid: boolean;
    validatorAllowed: boolean;
    validatorProfile: string;
    diffId: string | null;
    operationHash: string;
    startedAt: string;
  }): { result: 'started' | 'duplicate' | 'conflict' | 'rejected'; validation?: AgentModeWorkcellValidation; receipt?: AgentModeWorkcellValidationReceipt; reason?: string } {
    return this.withTransaction(() => {
      const existing = this.getWorkcellValidationRun(input.validationId);
      if (existing) {
        if (existing.operationHash !== input.operationHash) return { result: 'conflict', validation: existing, reason: 'validation_id_reused_for_different_request' };
        const receipt = this.getWorkcellValidationRunReceipt(input.validationId);
        return receipt ? { result: 'duplicate', validation: existing, receipt } : { result: 'duplicate', validation: existing };
      }
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${input.workcellId}`);
      const lease = this.getWorkcellWriterLease(input.leaseId);
      const diff = input.diffId ? this.getWorkcellDiff(input.diffId) : undefined;
      let reason: string | undefined;
      if (input.capability !== 'validation.run(workcell)') reason = 'capability_not_admitted';
      else if (!input.validatorAllowed) reason = 'unknown_validator_profile';
      else if (!['prepared', 'active', 'testing'].includes(workcell.status)) reason = 'workcell_state_does_not_allow_validation';
      else if (input.repositoryRoot !== workcell.repositoryRoot || input.worktreePath !== workcell.worktreePath || input.worktreePath === input.repositoryRoot || !input.resourceValid) reason = 'resource_binding_mismatch';
      else if (!diff) reason = 'diff_evidence_missing';
      else if (diff.workcellId !== workcell.workcellId || diff.taskId !== workcell.taskId || diff.runId !== workcell.runId || diff.attemptId !== workcell.attemptId || diff.repositoryRef !== workcell.repositoryRef) reason = 'diff_evidence_lineage_mismatch';
      else if (!lease || lease.workcellId !== workcell.workcellId) reason = 'lease_missing';
      else if (lease.status !== 'active') reason = `lease_${lease.status}`;
      else if (Date.parse(lease.expiresAt) <= Date.parse(input.startedAt)) reason = 'lease_expired';
      else if (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt) reason = 'wrong_owner';
      else if (lease.fenceToken !== input.fenceToken) reason = 'stale_fence_token';

      const validation: AgentModeWorkcellValidation = {
        validationId: input.validationId,
        taskId: workcell.taskId,
        runId: workcell.runId,
        attemptId: workcell.attemptId,
        workcellId: workcell.workcellId,
        repositoryRef: workcell.repositoryRef,
        validatorProfile: input.validatorProfile,
        diffId: input.diffId,
        leaseId: input.leaseId,
        fenceToken: input.fenceToken,
        operationHash: input.operationHash,
        status: reason ? 'rejected' : 'started',
        result: reason ? 'rejected' : 'started',
        evidenceHash: undefined,
        evidenceJson: undefined,
        startedAt: input.startedAt,
        completedAt: undefined,
        updatedAt: input.startedAt,
      };
      this.insertWorkcellValidation(validation);
      if (reason) {
        const receipt = makeValidationReceipt(validation, 'ValidationRejectedReceipt', input.startedAt, 'rejected');
        this.recordWorkcellValidationReceiptInternal(receipt, 'rejected');
        this.appendEventIfAbsent({ eventId: `workcell-validation-rejected:${input.validationId}`, entityType: 'workcell_validation', entityId: input.validationId, eventType: 'workcell_validation_rejected', occurredAt: input.startedAt, payload: { workcellId: workcell.workcellId, validatorProfile: input.validatorProfile, reason, operationHash: input.operationHash } });
        return { result: 'rejected', validation, receipt, reason };
      }
      const receipt = makeValidationReceipt(validation, 'ValidationStartedReceipt', input.startedAt, 'started');
      this.recordWorkcellValidationReceiptInternal(receipt, 'started');
      this.appendEventIfAbsent({ eventId: `workcell-validation-started:${input.validationId}`, entityType: 'workcell_validation', entityId: input.validationId, eventType: 'workcell_validation_started', occurredAt: input.startedAt, payload: { workcellId: workcell.workcellId, validatorProfile: input.validatorProfile, diffId: input.diffId, operationHash: input.operationHash } });
      return { result: 'started', validation, receipt };
    });
  }

  completeWorkcellValidation(input: { validationId: string; evidenceHash: string; evidenceJson: string; result: 'passed' | 'failed'; completedAt: string }): AgentModeOperationResult {
    return this.withTransaction(() => {
      const validation = this.getWorkcellValidationRun(input.validationId);
      if (!validation) throw new Error(`workcell validation not found: ${input.validationId}`);
      if (validation.status === 'completed') return validation.result === input.result && validation.evidenceHash === input.evidenceHash ? 'duplicate' : 'conflict';
      if (validation.status !== 'started') return 'conflict';
      const updated = { ...validation, status: 'completed' as const, result: input.result, evidenceHash: input.evidenceHash, evidenceJson: input.evidenceJson, completedAt: input.completedAt, updatedAt: input.completedAt };
      this.database.prepare("UPDATE workcell_validations SET status = 'completed', result = ?, evidence_hash = ?, evidence_json = ?, completed_at = ?, updated_at = ? WHERE validation_id = ? AND status = 'started'").run(input.result, input.evidenceHash, input.evidenceJson, input.completedAt, input.completedAt, input.validationId);
      const receipt = makeValidationReceipt(updated, 'ValidationCompletedReceipt', input.completedAt, input.result);
      this.recordWorkcellValidationReceiptInternal(receipt, 'completed');
      this.appendEventIfAbsent({ eventId: `workcell-validation-completed:${input.validationId}`, entityType: 'workcell_validation', entityId: input.validationId, eventType: 'workcell_validation_completed', occurredAt: input.completedAt, payload: { workcellId: validation.workcellId, validatorProfile: validation.validatorProfile, result: input.result, evidenceHash: input.evidenceHash } });
      return 'created';
    });
  }

  rejectWorkcellValidation(validationId: string, result: 'rejected' | 'timed_out' | 'interrupted', completedAt: string): { result: AgentModeOperationResult; validation: AgentModeWorkcellValidation; receipt: AgentModeWorkcellValidationReceipt } {
    return this.withTransaction(() => {
      const validation = this.getWorkcellValidationRun(validationId);
      if (!validation) throw new Error(`workcell validation not found: ${validationId}`);
      const existingReceipt = this.getWorkcellValidationRunReceipt(validationId);
      if (validation.status === 'rejected') {
        if (!existingReceipt) throw new Error(`rejected validation receipt is missing: ${validationId}`);
        return { result: 'duplicate', validation, receipt: existingReceipt };
      }
      if (validation.status === 'completed') throw new Error(`completed validation cannot be rejected: ${validationId}`);
      const updated = { ...validation, status: 'rejected' as const, result, updatedAt: completedAt, completedAt };
      this.database.prepare("UPDATE workcell_validations SET status = 'rejected', result = ?, completed_at = ?, updated_at = ? WHERE validation_id = ? AND status = 'started'").run(result, completedAt, completedAt, validationId);
      const receipt = makeValidationReceipt(updated, 'ValidationRejectedReceipt', completedAt, result);
      this.recordWorkcellValidationReceiptInternal(receipt, 'rejected');
      this.appendEventIfAbsent({ eventId: `workcell-validation-rejected:${validationId}:${result}`, entityType: 'workcell_validation', entityId: validationId, eventType: 'workcell_validation_rejected', occurredAt: completedAt, payload: { workcellId: validation.workcellId, validatorProfile: validation.validatorProfile, result } });
      return { result: 'created', validation: updated, receipt };
    });
  }

  getWorkcellValidationRun(validationId: string): AgentModeWorkcellValidation | undefined {
    if (!this.hasValidationTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_validations WHERE validation_id = ?').get(validationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { validationId: String(row.validation_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), validatorProfile: String(row.validator_profile), diffId: row.diff_id == null ? null : String(row.diff_id), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), operationHash: String(row.operation_hash), status: row.status as AgentModeWorkcellValidationStatus, result: row.result as AgentModeWorkcellValidationResult, evidenceHash: row.evidence_hash == null ? undefined : String(row.evidence_hash), evidenceJson: row.evidence_json == null ? undefined : String(row.evidence_json), startedAt: String(row.started_at), completedAt: row.completed_at == null ? undefined : String(row.completed_at), updatedAt: String(row.updated_at) };
  }

  listWorkcellValidationRuns(workcellId?: string): AgentModeWorkcellValidation[] {
    if (!this.hasValidationTables) return [];
    const rows = (workcellId
      ? this.database.prepare('SELECT * FROM workcell_validations WHERE workcell_id = ? ORDER BY started_at, validation_id').all(workcellId)
      : this.database.prepare('SELECT * FROM workcell_validations ORDER BY started_at, validation_id').all()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ validationId: String(row.validation_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), validatorProfile: String(row.validator_profile), diffId: row.diff_id == null ? null : String(row.diff_id), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), operationHash: String(row.operation_hash), status: row.status as AgentModeWorkcellValidationStatus, result: row.result as AgentModeWorkcellValidationResult, evidenceHash: row.evidence_hash == null ? undefined : String(row.evidence_hash), evidenceJson: row.evidence_json == null ? undefined : String(row.evidence_json), startedAt: String(row.started_at), completedAt: row.completed_at == null ? undefined : String(row.completed_at), updatedAt: String(row.updated_at) }));
  }

  getWorkcellValidationRunReceipt(validationId: string): AgentModeWorkcellValidationReceipt | undefined {
    if (!this.hasValidationTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM workcell_validation_receipts WHERE validation_id = ? ORDER BY rowid DESC LIMIT 1').get(validationId) as { receipt_json?: string } | undefined;
    return row ? JSON.parse(String(row.receipt_json)) as AgentModeWorkcellValidationReceipt : undefined;
  }

  listWorkcellValidationReceipts(workcellId: string): AgentModeWorkcellValidationReceipt[] {
    if (!this.hasValidationTables) return [];
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_validation_receipts WHERE workcell_id = ? ORDER BY rowid').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWorkcellValidationReceipt);
  }

  private insertWorkcellValidation(validation: AgentModeWorkcellValidation): void {
    this.database.prepare(`
      INSERT INTO workcell_validations (
        validation_id, task_id, run_id, attempt_id, workcell_id, repository_ref,
        validator_profile, diff_id, lease_id, fence_token, operation_hash,
        status, result, evidence_hash, evidence_json, started_at, completed_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(validation.validationId, validation.taskId, validation.runId, validation.attemptId, validation.workcellId, validation.repositoryRef, validation.validatorProfile, validation.diffId, validation.leaseId, validation.fenceToken, validation.operationHash, validation.status, validation.result, validation.evidenceHash ?? null, validation.evidenceJson ?? null, validation.startedAt, validation.completedAt ?? null, validation.updatedAt);
  }

  private recordWorkcellValidationReceiptInternal(receipt: AgentModeWorkcellValidationReceipt, status: 'started' | 'completed' | 'rejected'): AgentModeOperationResult {
    const validation = this.getWorkcellValidationRun(receipt.validationId);
    if (!validation) throw new Error(`workcell validation not found: ${receipt.validationId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_validation_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`validation receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO workcell_validation_receipts (
        receipt_id, validation_id, task_id, run_id, attempt_id, workcell_id,
        validator_profile, evidence_hash, timestamp, result, operation_hash,
        receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.validationId, receipt.taskId, receipt.runId, receipt.attemptId, receipt.workcellId, receipt.validatorProfile, receipt.evidenceHash, receipt.timestamp, receipt.result, receipt.operationHash, serialized);
    return 'created';
  }

  recordWorkcellDiff(diff: AgentModeWorkcellDiffEvidence, receipt: AgentModeWriterReceipt): AgentModeOperationResult {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(diff.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${diff.workcellId}`);
      if (diff.taskId !== workcell.taskId || diff.runId !== workcell.runId || diff.attemptId !== workcell.attemptId
        || diff.repositoryRef !== workcell.repositoryRef || diff.branch !== workcell.branch) throw new Error('diff evidence lineage conflicts with Workcell binding');
      const lease = this.getWorkcellWriterLease(diff.leaseId);
      if (!lease || lease.workcellId !== diff.workcellId || lease.status !== 'active' || lease.fenceToken !== diff.fenceToken) throw new Error('diff evidence writer lease is not current');
      const existing = this.database.prepare('SELECT * FROM workcell_diff_evidence WHERE diff_id = ?').get(diff.diffId) as Record<string, unknown> | undefined;
      if (existing) return String(existing.diff_hash) === diff.diffHash ? 'duplicate' : 'conflict';
      this.database.prepare(`
        INSERT INTO workcell_diff_evidence (
          diff_id, task_id, run_id, attempt_id, workcell_id, repository_ref, branch,
          base_revision, current_revision, changed_files_json, diff_hash, lease_id,
          fence_token, captured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(diff.diffId, diff.taskId, diff.runId, diff.attemptId, diff.workcellId, diff.repositoryRef, diff.branch, diff.baseRevision, diff.currentRevision, JSON.stringify(diff.changedFiles), diff.diffHash, diff.leaseId, diff.fenceToken, diff.capturedAt);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `diff-captured:${diff.diffId}`, entityType: 'workcell', entityId: diff.workcellId, eventType: 'workcell_diff_captured', occurredAt: diff.capturedAt, payload: { diffId: diff.diffId, diffHash: diff.diffHash, changedFileCount: diff.changedFiles.length, fenceToken: diff.fenceToken } });
      return 'created';
    });
  }

  getWorkcellDiff(diffId: string): AgentModeWorkcellDiffEvidence | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_diff_evidence WHERE diff_id = ?').get(diffId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      diffId: String(row.diff_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), branch: String(row.branch), baseRevision: String(row.base_revision), currentRevision: String(row.current_revision), changedFiles: JSON.parse(String(row.changed_files_json)) as string[], diffHash: String(row.diff_hash), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), capturedAt: String(row.captured_at),
    };
  }

  listWorkcellDiffs(workcellId?: string): AgentModeWorkcellDiffEvidence[] {
    if (!this.hasWriterTables) return [];
    const rows = (workcellId
      ? this.database.prepare('SELECT * FROM workcell_diff_evidence WHERE workcell_id = ? ORDER BY captured_at, diff_id').all(workcellId)
      : this.database.prepare('SELECT * FROM workcell_diff_evidence ORDER BY captured_at, diff_id').all()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      diffId: String(row.diff_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), branch: String(row.branch), baseRevision: String(row.base_revision), currentRevision: String(row.current_revision), changedFiles: JSON.parse(String(row.changed_files_json)) as string[], diffHash: String(row.diff_hash), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), capturedAt: String(row.captured_at),
    }));
  }

  getLatestWorkcellDiff(workcellId: string): AgentModeWorkcellDiffEvidence | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT diff_id FROM workcell_diff_evidence WHERE workcell_id = ? ORDER BY captured_at DESC, diff_id DESC LIMIT 1').get(workcellId) as { diff_id?: string } | undefined;
    return row?.diff_id ? this.getWorkcellDiff(String(row.diff_id)) : undefined;
  }

  recordWorkcellValidation(validation: AgentModeWorkcellValidationEvidence, receipt: AgentModeWriterReceipt): AgentModeOperationResult {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(validation.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${validation.workcellId}`);
      if (validation.taskId !== workcell.taskId || validation.runId !== workcell.runId || validation.attemptId !== workcell.attemptId) throw new Error('validation evidence lineage conflicts with Workcell binding');
      const diff = this.getWorkcellDiff(validation.diffId);
      if (!diff || diff.workcellId !== validation.workcellId) throw new Error(`diff evidence not found: ${validation.diffId}`);
      const existing = this.database.prepare('SELECT * FROM workcell_validation_evidence WHERE validation_id = ?').get(validation.validationId) as Record<string, unknown> | undefined;
      if (existing) return existing.state === validation.state && existing.result === validation.result ? 'duplicate' : 'conflict';
      this.database.prepare(`
        INSERT INTO workcell_validation_evidence (
          validation_id, diff_id, task_id, run_id, attempt_id, workcell_id,
          requested_at, result, state, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(validation.validationId, validation.diffId, validation.taskId, validation.runId, validation.attemptId, validation.workcellId, validation.requestedAt, validation.result, validation.state, validation.recordedAt);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `validation-admitted:${validation.validationId}`, entityType: 'workcell', entityId: validation.workcellId, eventType: 'workcell_validation_admission', occurredAt: validation.recordedAt, payload: { validationId: validation.validationId, diffId: validation.diffId, result: validation.result, state: validation.state } });
      return 'created';
    });
  }

  getWorkcellValidation(validationId: string): AgentModeWorkcellValidationEvidence | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_validation_evidence WHERE validation_id = ?').get(validationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { validationId: String(row.validation_id), diffId: String(row.diff_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), requestedAt: String(row.requested_at), result: row.result as AgentModeWorkcellValidationEvidence['result'], state: row.state as AgentModeWorkcellValidationEvidence['state'], recordedAt: String(row.recorded_at) };
  }

  listWorkcellWriterReceipts(workcellId: string): AgentModeWriterReceipt[] {
    if (!this.hasWriterTables) return [];
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_writer_receipts WHERE workcell_id = ? ORDER BY timestamp, receipt_id').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWriterReceipt);
  }

  private recordWriterReceiptInternal(receipt: AgentModeWriterReceipt): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_writer_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    const serialized = JSON.stringify(receipt);
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`writer receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO workcell_writer_receipts (
        receipt_id, workcell_id, receipt_type, task_id, run_id, attempt_id,
        lease_id, fence_token, timestamp, operation_hash, result_state, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.workcellId, receipt.receiptType, receipt.taskId, receipt.runId, receipt.attemptId, receipt.leaseId, receipt.fenceToken, receipt.timestamp, receipt.operationHash, receipt.resultState, serialized);
    return 'created';
  }

  private mapWriterLease(row: Record<string, unknown>): AgentModeWriterLease {
    return { leaseId: String(row.lease_id), workcellId: String(row.workcell_id), ownerAgent: String(row.owner_agent), ownerAttempt: String(row.owner_attempt), createdAt: String(row.created_at), expiresAt: String(row.expires_at), fenceToken: Number(row.fence_token), status: row.status as AgentModeWriterLeaseStatus };
  }

  getReceipt(operationId: string): AgentModeJournalReceipt | undefined {
    const row = this.database.prepare("SELECT * FROM receipts WHERE operation_id = ? AND state = 'accepted' ORDER BY recorded_at, receipt_id LIMIT 1").get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapReceipt(row);
  }

  listReceipts(operationId: string): AgentModeJournalReceipt[] {
    const rows = this.database.prepare('SELECT * FROM receipts WHERE operation_id = ? ORDER BY recorded_at, receipt_id').all(operationId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapReceipt(row));
  }

  private mapReceipt(row: Record<string, unknown>): AgentModeJournalReceipt {
    const receipt = JSON.parse(String(row.receipt_json)) as OperationReceipt;
    return {
      ...receipt,
      receiptId: String(row.receipt_id),
      state: row.state as AgentModeReceiptState,
    };
  }

  recordReceipt(receipt: OperationReceipt, settlement?: AgentModeBudgetSettlement): 'recorded' | 'duplicate' | 'conflict' | 'stale' {
    return this.withTransaction(() => {
      const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(receipt.operationId) as Record<string, unknown> | undefined;
      if (!effect) throw new Error(`operation not found: ${receipt.operationId}`);
      const sameScope = effect.attempt_id === receipt.attemptId && effect.scope_hash === receipt.scopeHash;
      const existingRows = this.database.prepare('SELECT * FROM receipts WHERE operation_id = ?').all(receipt.operationId) as Array<Record<string, unknown>>;
      const receiptId = receiptIdFor(receipt);
      const sameExisting = existingRows.find((row) => row.receipt_id === receiptId);
      if (sameExisting) return 'duplicate';

      const hasConflict = existingRows.some((row) => row.state === 'accepted' && (
        row.attempt_id !== receipt.attemptId
        || row.scope_hash !== receipt.scopeHash
        || row.effect_hash !== receipt.effectHash
        || row.status !== receipt.status
      ));
      const stale = !sameScope || !this.isCurrentLeaseForAttempt(receipt.attemptId, receipt.recordedAt);
      if (stale) {
        this.database.prepare(`
          INSERT INTO receipts (
            receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
            recorded_at, state, receipt_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'stale', ?)
        `).run(
          receiptId,
          receipt.operationId,
          receipt.attemptId,
          receipt.scopeHash,
          receipt.effectHash,
          receipt.status,
          receipt.recordedAt,
          JSON.stringify(receipt),
        );
        this.appendEventIfAbsent({
          eventId: `receipt-stale:${receiptId}`,
          entityType: 'operation',
          entityId: receipt.operationId,
          eventType: 'receipt_from_stale_attempt',
          occurredAt: receipt.recordedAt,
          payload: { attemptId: receipt.attemptId, effectHash: receipt.effectHash },
        });
        return 'stale';
      }

      if (existingRows.some((row) => row.state === 'conflict') || hasConflict || existingRows.some((row) => row.state === 'accepted' && (
        row.effect_hash !== receipt.effectHash || row.status !== receipt.status
      ))) {
        this.database.prepare(`
          INSERT INTO receipts (
            receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
            recorded_at, state, receipt_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'conflict', ?)
        `).run(
          receiptId,
          receipt.operationId,
          receipt.attemptId,
          receipt.scopeHash,
          receipt.effectHash,
          receipt.status,
          receipt.recordedAt,
          JSON.stringify(receipt),
        );
        this.database.prepare("UPDATE effects SET status = 'uncertain' WHERE operation_id = ?").run(receipt.operationId);
        this.database.prepare("UPDATE dispatch_outbox SET state = 'uncertain' WHERE operation_id = ?").run(receipt.operationId);
        this.database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(receipt.recordedAt, String(effect.attempt_id));
        this.appendEventIfAbsent({
          eventId: `receipt-conflict:${receiptId}`,
          entityType: 'operation',
          entityId: receipt.operationId,
          eventType: 'receipt_conflict',
          occurredAt: receipt.recordedAt,
          payload: { attemptId: receipt.attemptId, effectHash: receipt.effectHash },
        });
        return 'conflict';
      }

      this.database.prepare(`
        INSERT INTO receipts (
          receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
          recorded_at, state, receipt_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', ?)
      `).run(
        receiptId,
        receipt.operationId,
        receipt.attemptId,
        receipt.scopeHash,
        receipt.effectHash,
        receipt.status,
        receipt.recordedAt,
        JSON.stringify(receipt),
      );
      this.database.prepare('UPDATE effects SET status = ?, receipt_json = ? WHERE operation_id = ?').run(receipt.status, JSON.stringify(receipt), receipt.operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'receipt_recorded' WHERE operation_id = ?").run(receipt.operationId);
      if (settlement) this.settleBudgetInternal(settlement);
      this.appendEventIfAbsent({
        eventId: `receipt-recorded:${receiptId}`,
        entityType: 'operation',
        entityId: receipt.operationId,
        eventType: 'receipt_recorded',
        occurredAt: receipt.recordedAt,
        payload: { attemptId: receipt.attemptId, status: receipt.status, settled: Boolean(settlement) },
      });
      this.failIfInjected('receipt');
      return 'recorded';
    });
  }

  requestCancellation(request: AgentModeCancellationRequest): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(request.attemptId);
      if (!attempt) throw new Error(`attempt not found: ${request.attemptId}`);
      const existing = this.database.prepare('SELECT attempt_id, requested_at FROM cancellation_requests WHERE request_id = ?').get(request.requestId) as Record<string, unknown> | undefined;
      if (existing) {
        return existing.attempt_id === request.attemptId && existing.requested_at === request.requestedAt ? 'duplicate' : 'conflict';
      }
      if (attempt.cancellationStatus !== 'running') return 'duplicate';
      this.database.prepare('INSERT INTO cancellation_requests (request_id, attempt_id, requested_at) VALUES (?, ?, ?)')
        .run(request.requestId, request.attemptId, request.requestedAt);
      this.database.prepare("UPDATE attempts SET cancellation_status = 'requested', cancellation_requested_at = ?, updated_at = ? WHERE attempt_id = ? AND cancellation_status = 'running'")
        .run(request.requestedAt, request.requestedAt, request.attemptId);
      this.appendEventIfAbsent({
        eventId: `cancellation-requested:${request.requestId}`,
        entityType: 'attempt',
        entityId: request.attemptId,
        eventType: 'cancellation_requested',
        occurredAt: request.requestedAt,
        payload: { requestId: request.requestId },
      });
      return 'created';
    });
  }

  acknowledgeCancellation(attemptId: string, acknowledgedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.cancellationStatus === 'acknowledged' || attempt.cancellationStatus === 'completed') return 'duplicate';
      if (attempt.cancellationStatus !== 'requested') throw new Error(`cancellation was not requested: ${attemptId}`);
      this.database.prepare("UPDATE attempts SET cancellation_status = 'acknowledged', updated_at = ? WHERE attempt_id = ? AND cancellation_status = 'requested'")
        .run(acknowledgedAt, attemptId);
      this.appendEventIfAbsent({
        eventId: `cancellation-acknowledged:${attemptId}`,
        entityType: 'attempt',
        entityId: attemptId,
        eventType: 'cancellation_acknowledged',
        occurredAt: acknowledgedAt,
        payload: {},
      });
      return 'created';
    });
  }

  finishAttempt(attemptId: string, status: 'completed' | 'failed' | 'cancelled', finishedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.status === status) return 'duplicate';
      if (['completed', 'failed', 'cancelled'].includes(attempt.status)) return 'conflict';
      if (status === 'cancelled' && attempt.cancellationStatus !== 'acknowledged') {
        throw new Error('cancellation acknowledgement is required before terminal cancellation');
      }
      this.database.prepare('UPDATE attempts SET status = ?, cancellation_status = ?, updated_at = ? WHERE attempt_id = ?')
        .run(status, status === 'cancelled' ? 'completed' : attempt.cancellationStatus, finishedAt, attemptId);
      const runStatus = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed';
      this.database.prepare('UPDATE runs SET status = ? WHERE run_id = ?').run(runStatus, attempt.runId);
      this.database.prepare('UPDATE tasks SET status = ? WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)').run(runStatus, attempt.runId);
      this.appendEventIfAbsent({
        eventId: `attempt-finished:${attemptId}`,
        entityType: 'attempt',
        entityId: attemptId,
        eventType: 'attempt_finished',
        occurredAt: finishedAt,
        payload: { status },
      });
      return 'created';
    });
  }

  classifyRecovery(attemptId: string, now: string): AgentModeRecoveryClassification {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
    if (attempt.status === 'duplicate') return 'duplicate';
    if (attempt.status === 'completed') return 'already_completed';
    if (attempt.status === 'failed') return 'terminal_failure';
    if (attempt.status === 'cancelled') return 'already_completed';
    if (attempt.cancellationStatus === 'requested') return 'cancelled_ack_pending';
    if (!this.isCurrentLeaseForAttempt(attemptId, now)) return 'stale_fenced_writer';
    const effect = this.database.prepare('SELECT status FROM effects WHERE attempt_id = ? ORDER BY COALESCE(prepared_at, rowid) DESC LIMIT 1').get(attemptId) as { status?: string } | undefined;
    if (!effect) return 'safe_to_resume';
    if (effect.status === 'effect_applied' || effect.status === 'uncertain') return 'uncertain_non_idempotent_effect';
    if (effect.status === 'dispatched') return 'awaiting_receipt_reconciliation';
    if (effect.status === 'succeeded') return 'already_completed';
    if (effect.status === 'failed') return 'terminal_failure';
    return 'safe_to_resume';
  }

  acquireLease(input: Omit<AgentModeLease, 'fence'>): AgentModeLease | undefined {
    return this.withTransaction(() => this.acquireLeaseAt(input, new Date().toISOString()));
  }

  getLease(resourceKey: string): AgentModeLease | undefined {
    const row = this.database.prepare('SELECT * FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      resourceKey,
      leaseId: String(row.lease_id),
      ownerId: String(row.owner_id),
      fence: Number(row.fence),
      expiresAt: String(row.expires_at),
    };
  }

  private acquireLeaseAt(input: Omit<AgentModeLease, 'fence'>, now: string): AgentModeLease | undefined {
    const current = this.database.prepare('SELECT fence, expires_at FROM leases WHERE resource_key = ?').get(input.resourceKey) as { fence?: number; expires_at?: string } | undefined;
    const currentExpiresAt = current?.expires_at;
    if (current && currentExpiresAt && currentExpiresAt > now) return undefined;
    const fence = Number(current?.fence ?? 0) + 1;
    this.database.prepare(`
      INSERT INTO leases (resource_key, lease_id, owner_id, fence, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(resource_key) DO UPDATE SET
        lease_id = excluded.lease_id,
        owner_id = excluded.owner_id,
        fence = excluded.fence,
        expires_at = excluded.expires_at
    `).run(input.resourceKey, input.leaseId, input.ownerId, fence, input.expiresAt);
    return { ...input, fence };
  }

  releaseLease(resourceKey: string, leaseId: string, fence: number): boolean {
    // Retain the fence counter after release so a future owner can never reuse
    // an old token, even when the previous lease ended cleanly.
    return this.withTransaction(() => {
      const result = this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ? AND lease_id = ? AND fence = ?').run(new Date().toISOString(), resourceKey, leaseId, fence);
      return result.changes === 1;
    });
  }

  recordEffect(effect: AgentModeEffect): 'created' | 'duplicate' | 'conflict' {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT attempt_id, effect_kind, scope_hash, status, receipt_json FROM effects WHERE operation_id = ?').get(effect.operationId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.attempt_id === effect.attemptId
          && existing.effect_kind === effect.effectKind
          && existing.scope_hash === effect.scopeHash;
        if (!same) return 'conflict';
        return 'duplicate';
      }
      this.database.prepare(`
        INSERT INTO effects (operation_id, attempt_id, effect_kind, scope_hash, status, receipt_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(effect.operationId, effect.attemptId, effect.effectKind, effect.scopeHash, effect.status, effect.receiptJson ?? null);
      return 'created';
    });
  }

  getEffect(operationId: string): AgentModeEffect | undefined {
    const row = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      scopeHash: String(row.scope_hash),
      status: row.status as AgentModeEffect['status'],
      ...(row.receipt_json === null ? {} : { receiptJson: String(row.receipt_json) }),
      ...(row.capability_id == null ? {} : { capabilityId: String(row.capability_id) }),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }),
      ...(row.policy_version == null ? {} : { policyVersion: String(row.policy_version) }),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }),
      ...(row.deadline == null ? {} : { deadline: String(row.deadline) }),
      ...(row.prepared_at == null ? {} : { preparedAt: String(row.prepared_at) }),
      ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.observed_at == null ? {} : { observedAt: String(row.observed_at) }),
      ...(row.dispatch_id == null ? {} : { dispatchId: String(row.dispatch_id) }),
      ...(row.assignment_intent_key == null ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.child_agent_id == null ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.runtime_ref == null ? {} : { runtimeRef: String(row.runtime_ref) }),
      ...(row.runtime_profile_ref == null ? {} : { runtimeProfileRef: String(row.runtime_profile_ref) }),
      ...(row.controller_ref == null ? {} : { controllerRef: String(row.controller_ref) }),
    };
  }

  listEffects(): AgentModeEffect[] {
    const rows = this.database.prepare('SELECT * FROM effects ORDER BY COALESCE(prepared_at, rowid), operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      scopeHash: String(row.scope_hash),
      status: row.status as AgentModeEffect['status'],
      ...(row.receipt_json === null ? {} : { receiptJson: String(row.receipt_json) }),
      ...(row.capability_id == null ? {} : { capabilityId: String(row.capability_id) }),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }),
      ...(row.policy_version == null ? {} : { policyVersion: String(row.policy_version) }),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }),
      ...(row.deadline == null ? {} : { deadline: String(row.deadline) }),
      ...(row.prepared_at == null ? {} : { preparedAt: String(row.prepared_at) }),
      ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.observed_at == null ? {} : { observedAt: String(row.observed_at) }),
      ...(row.dispatch_id == null ? {} : { dispatchId: String(row.dispatch_id) }),
      ...(row.assignment_intent_key == null ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.child_agent_id == null ? {} : { childAgentId: String(row.child_agent_id) }),
      ...(row.runtime_ref == null ? {} : { runtimeRef: String(row.runtime_ref) }),
      ...(row.runtime_profile_ref == null ? {} : { runtimeProfileRef: String(row.runtime_profile_ref) }),
      ...(row.controller_ref == null ? {} : { controllerRef: String(row.controller_ref) }),
    }));
  }

  listDispatchOutbox(): AgentModeDispatchOutbox[] {
    const rows = this.database.prepare('SELECT * FROM dispatch_outbox ORDER BY prepared_at, operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id), attemptId: String(row.attempt_id), effectKind: String(row.effect_kind), capabilityId: String(row.capability_id),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }), scopeHash: String(row.scope_hash), policyVersion: String(row.policy_version),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }), ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }), deadline: String(row.deadline), state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at), ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.dispatch_id == null ? {} : { dispatchId: String(row.dispatch_id) }), ...(row.assignment_intent_key == null ? {} : { assignmentIntentKey: String(row.assignment_intent_key) }),
      ...(row.child_agent_id == null ? {} : { childAgentId: String(row.child_agent_id) }), ...(row.runtime_ref == null ? {} : { runtimeRef: String(row.runtime_ref) }),
      ...(row.runtime_profile_ref == null ? {} : { runtimeProfileRef: String(row.runtime_profile_ref) }), ...(row.controller_ref == null ? {} : { controllerRef: String(row.controller_ref) }),
    }));
  }

  createReviewRequest(request: AgentModeReviewRequest): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT request_json FROM agent_mode_review_requests WHERE review_id = ?').get(request.reviewId) as { request_json?: string } | undefined;
      const serialized = JSON.stringify(request);
      if (existing) return existing.request_json === serialized ? 'duplicate' : 'conflict';
      const workcell = this.getWorkcell(request.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${request.workcellId}`);
      if (request.requestingActor.startsWith('model:')) throw new Error('coding model cannot create a review authorization');
      if (request.taskId !== workcell.taskId || request.runId !== workcell.runId || request.attemptId !== workcell.attemptId || request.workerAgentId !== workcell.ownerAgent
        || request.repositoryRef !== workcell.repositoryRef || request.branch !== workcell.branch) throw new Error('review request lineage conflicts with Workcell');
      if (request.status !== 'pending') throw new Error('new review requests must be pending');
      const diff = this.getWorkcellDiff(request.diffId);
      const validation = this.getWorkcellValidationRun(request.validationId);
      if (!diff || diff.workcellId !== request.workcellId || diff.diffHash !== request.diffHash
        || diff.baseRevision !== request.baseRevision || diff.currentRevision !== request.currentRevision) throw new Error('review request diff binding is invalid');
      if (!validation || validation.workcellId !== request.workcellId || validation.diffId !== request.diffId
        || validation.status !== 'completed' || validation.result !== 'passed'
        || validation.evidenceHash !== request.validationEvidenceHash) throw new Error('review request validation binding is invalid');
      this.database.prepare(`INSERT INTO agent_mode_review_requests (
        review_id, workcell_id, task_id, run_id, attempt_id, worker_agent_id, repository_ref, branch,
        base_revision, current_revision, diff_id, diff_hash, validation_id,
        validation_evidence_hash, requesting_actor, created_at, expires_at, status, request_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(request.reviewId, request.workcellId, request.taskId, request.runId, request.attemptId, request.workerAgentId, request.repositoryRef, request.branch,
          request.baseRevision, request.currentRevision, request.diffId, request.diffHash, request.validationId,
          request.validationEvidenceHash, request.requestingActor, request.createdAt, request.expiresAt, request.status, serialized);
      this.recordReviewReceiptInternal(makeReviewReceipt(request, 'ReviewRequestedReceipt', request.requestingActor, request.createdAt));
      this.appendEventIfAbsent({ eventId: `review-requested:${request.reviewId}`, entityType: 'workcell', entityId: request.workcellId, eventType: 'workcell_review_requested', occurredAt: request.createdAt, payload: { reviewId: request.reviewId, diffId: request.diffId, diffHash: request.diffHash, validationId: request.validationId, validationEvidenceHash: request.validationEvidenceHash, status: request.status } });
      return 'created';
    });
  }

  getReviewRequest(reviewId: string): AgentModeReviewRequest | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT request_json FROM agent_mode_review_requests WHERE review_id = ?').get(reviewId) as { request_json?: string } | undefined;
    return row?.request_json ? JSON.parse(row.request_json) as AgentModeReviewRequest : undefined;
  }

  listReviewRequests(): AgentModeReviewRequest[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT request_json FROM agent_mode_review_requests ORDER BY created_at, review_id').all() as Array<{ request_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.request_json)) as AgentModeReviewRequest);
  }

  recordReviewDecision(decision: AgentModeReviewDecision): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const request = this.getReviewRequest(decision.reviewId);
      if (!request) throw new Error(`review request not found: ${decision.reviewId}`);
      const existing = this.database.prepare('SELECT decision_json FROM agent_mode_review_decisions WHERE review_id = ?').get(decision.reviewId) as { decision_json?: string } | undefined;
      const serialized = JSON.stringify(decision);
      if (existing) return existing.decision_json === serialized ? 'duplicate' : 'conflict';
      if (request.status !== 'pending') throw new Error(`review request is not pending: ${decision.reviewId}`);
      if (decision.reviewer === request.workerAgentId || decision.reviewer.startsWith('model:')) throw new Error('coding worker or model cannot modify approval state');
      this.database.prepare(`INSERT INTO agent_mode_review_decisions (
        decision_id, review_id, decision, reviewer, decided_at, reason, evidence_hash, decision_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(decision.decisionId, decision.reviewId, decision.decision, decision.reviewer, decision.decidedAt, decision.reason, decision.evidenceHash, serialized);
      const status = decision.decision === 'approved' ? 'approved' : 'rejected';
      this.database.prepare('UPDATE agent_mode_review_requests SET status = ?, request_json = ? WHERE review_id = ?')
        .run(status, JSON.stringify({ ...request, status }), decision.reviewId);
      this.recordReviewReceiptInternal(makeReviewReceipt(request, decision.decision === 'approved' ? 'ReviewApprovedReceipt' : 'ReviewRejectedReceipt', decision.reviewer, decision.decidedAt, decision.decisionId));
      this.appendEventIfAbsent({ eventId: `review-decision:${decision.decisionId}`, entityType: 'workcell', entityId: request.workcellId, eventType: `workcell_review_${decision.decision}`, occurredAt: decision.decidedAt, payload: { reviewId: decision.reviewId, decisionId: decision.decisionId, decision: decision.decision, reviewer: decision.reviewer, evidenceHash: decision.evidenceHash } });
      return 'created';
    });
  }

  getReviewDecision(reviewId: string): AgentModeReviewDecision | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT decision_json FROM agent_mode_review_decisions WHERE review_id = ?').get(reviewId) as { decision_json?: string } | undefined;
    return row?.decision_json ? JSON.parse(row.decision_json) as AgentModeReviewDecision : undefined;
  }

  listReviewDecisions(): AgentModeReviewDecision[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT decision_json FROM agent_mode_review_decisions ORDER BY decided_at, decision_id').all() as Array<{ decision_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.decision_json)) as AgentModeReviewDecision);
  }

  getReviewReceipt(receiptId: string): AgentModeReviewReceipt | undefined {
    if (!this.hasReviewReceiptTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts WHERE receipt_id = ?').get(receiptId) as { receipt_json?: string } | undefined;
    return row?.receipt_json ? JSON.parse(row.receipt_json) as AgentModeReviewReceipt : undefined;
  }

  listReviewReceipts(reviewId?: string): AgentModeReviewReceipt[] {
    if (!this.hasReviewReceiptTables) return [];
    const rows = (reviewId
      ? this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts WHERE review_id = ? ORDER BY timestamp, receipt_id').all(reviewId)
      : this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts ORDER BY timestamp, receipt_id').all()) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeReviewReceipt);
  }

  private recordReviewReceiptInternal(receipt: AgentModeReviewReceipt): AgentModeOperationResult {
    if (!this.hasReviewReceiptTables) throw new Error('K3.5 review receipt tables are unavailable');
    const request = this.getReviewRequest(receipt.reviewId);
    if (!request) throw new Error(`review request not found: ${receipt.reviewId}`);
    if (request.taskId !== receipt.taskId || request.runId !== receipt.runId || request.attemptId !== receipt.attemptId
      || request.workcellId !== receipt.workcellId || request.workerAgentId !== receipt.workerAgentId || request.diffHash !== receipt.diffHash
      || request.validationEvidenceHash !== receipt.validationEvidenceHash) throw new Error(`review receipt conflicts with request: ${receipt.reviewId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`review receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_review_receipts (
        receipt_id, review_id, decision_id, task_id, run_id, attempt_id, workcell_id, worker_agent_id,
        diff_hash, validation_evidence_hash, reviewer, timestamp, operation_hash, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.reviewId, receipt.decisionId ?? null, receipt.taskId, receipt.runId, receipt.attemptId, receipt.workcellId, receipt.workerAgentId, receipt.diffHash, receipt.validationEvidenceHash, receipt.reviewer, receipt.timestamp, receipt.operationHash, serialized);
    return 'created';
  }

  markReviewStale(reviewId: string, reason: string, timestamp: string): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const request = this.getReviewRequest(reviewId);
      if (!request) throw new Error(`review request not found: ${reviewId}`);
      if (request.status === 'stale') return 'duplicate';
      if (request.status === 'rejected') return 'conflict';
      const status: AgentModeReviewRequest['status'] = 'stale';
      this.database.prepare("UPDATE agent_mode_review_requests SET status = ?, request_json = ? WHERE review_id = ? AND status IN ('pending', 'approved')")
        .run(status, JSON.stringify({ ...request, status }), reviewId);
      this.appendEventIfAbsent({ eventId: `review-stale:${reviewId}:${request.diffHash}`, entityType: 'workcell', entityId: request.workcellId, eventType: 'workcell_review_stale', occurredAt: timestamp, payload: { reviewId, diffHash: request.diffHash, validationEvidenceHash: request.validationEvidenceHash, reason } });
      return 'created';
    });
  }

  acquireTargetRefLease(input: AgentModeTargetRefLease, now = new Date().toISOString()): { result: 'granted' | 'duplicate' | 'rejected'; lease?: AgentModeTargetRefLease; reason?: string } {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT lease_json, fence_token, status, expires_at FROM agent_mode_target_ref_leases WHERE repository_ref = ? AND target_ref = ? AND status = \'active\'').get(input.repositoryRef, input.targetRef) as { lease_json?: string; fence_token?: number; status?: string; expires_at?: string } | undefined;
      if (existing && existing.lease_json) {
        const current = JSON.parse(existing.lease_json) as AgentModeTargetRefLease;
        if (current.leaseId === input.leaseId && JSON.stringify(current) === JSON.stringify(input)) return { result: 'duplicate' as const, lease: current };
        if (Date.parse(current.expiresAt) > Date.parse(now)) return { result: 'rejected' as const, reason: 'active target ref authority exists' };
        this.database.prepare("UPDATE agent_mode_target_ref_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(current.leaseId);
      }
      const prior = this.database.prepare('SELECT MAX(fence_token) AS fence FROM agent_mode_target_ref_leases WHERE repository_ref = ? AND target_ref = ?').get(input.repositoryRef, input.targetRef) as { fence?: number } | undefined;
      const lease = { ...input, fenceToken: Math.max(1, Number(prior?.fence ?? 0) + 1), status: 'active' as const };
      try {
        this.database.prepare(`INSERT INTO agent_mode_target_ref_leases (
          lease_id, repository_ref, target_ref, owner_operation, fence_token,
          expected_target_head, expires_at, status, lease_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(lease.leaseId, lease.repositoryRef, lease.targetRef, lease.ownerOperation, lease.fenceToken, lease.expectedTargetHead, lease.expiresAt, lease.status, JSON.stringify(lease));
      } catch (error) {
        if (error instanceof Error && /UNIQUE/i.test(error.message)) return { result: 'rejected' as const, reason: 'target ref authority raced with another operation' };
        throw error;
      }
      this.appendEventIfAbsent({ eventId: `target-ref-lease:${lease.leaseId}`, entityType: 'target_ref', entityId: `${lease.repositoryRef}:${lease.targetRef}`, eventType: 'target_ref_lease_acquired', occurredAt: new Date().toISOString(), payload: { leaseId: lease.leaseId, ownerOperation: lease.ownerOperation, fenceToken: lease.fenceToken, expectedTargetHead: lease.expectedTargetHead } });
      return { result: 'granted' as const, lease };
    });
  }

  getTargetRefLease(leaseId: string): AgentModeTargetRefLease | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT lease_json FROM agent_mode_target_ref_leases WHERE lease_id = ?').get(leaseId) as { lease_json?: string } | undefined;
    return row?.lease_json ? JSON.parse(row.lease_json) as AgentModeTargetRefLease : undefined;
  }

  listTargetRefLeases(): AgentModeTargetRefLease[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT lease_json FROM agent_mode_target_ref_leases ORDER BY lease_id').all() as Array<{ lease_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.lease_json)) as AgentModeTargetRefLease);
  }

  updateTargetRefLeaseStatus(leaseId: string, status: AgentModeTargetRefLease['status']): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const lease = this.getTargetRefLease(leaseId);
      if (!lease) throw new Error(`target ref lease not found: ${leaseId}`);
      if (lease.status === status) return 'duplicate';
      if (lease.status !== 'active') return 'conflict';
      const next = { ...lease, status };
      this.database.prepare('UPDATE agent_mode_target_ref_leases SET status = ?, lease_json = ? WHERE lease_id = ? AND status = \'active\'').run(status, JSON.stringify(next), leaseId);
      return 'created';
    });
  }

  getCommitReceipt(receiptId: string): AgentModeCommitReceipt | undefined {
    if (!this.hasCommitReceiptTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts WHERE receipt_id = ?').get(receiptId) as { receipt_json?: string } | undefined;
    return row?.receipt_json ? JSON.parse(row.receipt_json) as AgentModeCommitReceipt : undefined;
  }

  listCommitReceipts(operationId?: string): AgentModeCommitReceipt[] {
    if (!this.hasCommitReceiptTables) return [];
    const rows = (operationId
      ? this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts WHERE operation_id = ? ORDER BY timestamp, receipt_id').all(operationId)
      : this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts ORDER BY timestamp, receipt_id').all()) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeCommitReceipt);
  }

  recordCommitReceipt(receipt: AgentModeCommitReceipt): AgentModeOperationResult {
    if (!this.hasCommitReceiptTables) throw new Error('K3.5 commit receipt tables are unavailable');
    return this.withTransaction(() => this.recordCommitReceiptInternal(receipt));
  }

  private recordCommitReceiptInternal(receipt: AgentModeCommitReceipt): AgentModeOperationResult {
    const workcell = this.getWorkcell(receipt.workcellId);
    if (!workcell || workcell.branch !== receipt.branch) throw new Error(`commit receipt Workcell binding is invalid: ${receipt.operationId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`commit receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_commit_receipts (
        receipt_id, operation_id, workcell_id, branch, parent_commit, resulting_commit,
        diff_hash, validation_evidence_hash, review_id, actor, timestamp,
        operation_hash, result, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.operationId, receipt.workcellId, receipt.branch, receipt.parentCommit, receipt.resultingCommit, receipt.diffHash, receipt.validationEvidenceHash, receipt.reviewId, receipt.actor, receipt.timestamp, receipt.operationHash, receipt.result, serialized);
    return 'created';
  }

  createCommitOperation(operation: AgentModeCommitOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT operation_json FROM agent_mode_commit_operations WHERE operation_id = ?').get(operation.operationId) as { operation_json?: string } | undefined;
      const serialized = JSON.stringify(operation);
      if (existing) return existing.operation_json === serialized ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_commit_operations (
        operation_id, workcell_id, repository_ref, branch, parent_commit, resulting_commit,
        approved_diff_hash, validation_evidence_hash, review_id, actor, created_at, status,
        receipt_hash, reason, operation_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(operation.operationId, operation.workcellId, operation.repositoryRef, operation.branch, operation.parentCommit, operation.resultingCommit ?? null,
          operation.approvedDiffHash, operation.validationEvidenceHash, operation.reviewId, operation.actor, operation.createdAt, operation.status,
          operation.receiptHash ?? null, operation.reason ?? null, serialized);
      this.recordCommitReceiptInternal(makeCommitReceipt(operation, 'CommitRequestedReceipt', 'requested', operation.createdAt));
      this.appendEventIfAbsent({ eventId: `commit-operation:${operation.operationId}`, entityType: 'workcell', entityId: operation.workcellId, eventType: 'workcell_commit_operation_recorded', occurredAt: operation.createdAt, payload: { operationId: operation.operationId, reviewId: operation.reviewId, status: operation.status, approvedDiffHash: operation.approvedDiffHash } });
      return 'created';
    });
  }

  updateCommitOperation(operation: AgentModeCommitOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.getCommitOperation(operation.operationId);
      if (!existing) throw new Error(`commit operation not found: ${operation.operationId}`);
      if (existing.workcellId !== operation.workcellId || existing.repositoryRef !== operation.repositoryRef || existing.branch !== operation.branch || existing.parentCommit !== operation.parentCommit || existing.approvedDiffHash !== operation.approvedDiffHash || existing.validationEvidenceHash !== operation.validationEvidenceHash || existing.reviewId !== operation.reviewId || existing.message !== operation.message) return 'conflict';
      if (JSON.stringify(existing) === JSON.stringify(operation)) return 'duplicate';
      this.database.prepare(`UPDATE agent_mode_commit_operations SET resulting_commit = ?, status = ?, receipt_hash = ?, reason = ?, operation_json = ? WHERE operation_id = ?`)
        .run(operation.resultingCommit ?? null, operation.status, operation.receiptHash ?? null, operation.reason ?? null, JSON.stringify(operation), operation.operationId);
      if (operation.status === 'committed' || operation.status === 'reconciled' || operation.status === 'rejected') {
        this.recordCommitReceiptInternal(makeCommitReceipt(operation, operation.status === 'committed' ? 'CommitCompletedReceipt' : operation.status === 'reconciled' ? 'CommitReconciledReceipt' : 'CommitRejectedReceipt', operation.status === 'committed' ? 'completed' : operation.status, operation.createdAt));
      }
      return 'created';
    });
  }

  getCommitOperation(operationId: string): AgentModeCommitOperation | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT operation_json FROM agent_mode_commit_operations WHERE operation_id = ?').get(operationId) as { operation_json?: string } | undefined;
    return row?.operation_json ? JSON.parse(row.operation_json) as AgentModeCommitOperation : undefined;
  }

  listCommitOperations(): AgentModeCommitOperation[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT operation_json FROM agent_mode_commit_operations ORDER BY created_at, operation_id').all() as Array<{ operation_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.operation_json)) as AgentModeCommitOperation);
  }

  createMergeApproval(approval: AgentModeMergeApproval): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT approval_json FROM agent_mode_merge_approvals WHERE approval_id = ?').get(approval.approvalId) as { approval_json?: string } | undefined;
      const serialized = JSON.stringify(approval);
      if (existing) return existing.approval_json === serialized ? 'duplicate' : 'conflict';
      const workcell = this.getWorkcell(approval.sourceWorkcellId);
      if (!workcell || workcell.repositoryRef !== approval.repositoryRef || workcell.branch !== approval.sourceBranch) throw new Error('merge approval source binding is invalid');
      this.database.prepare(`INSERT INTO agent_mode_merge_approvals (
        approval_id, repository_ref, source_workcell_id, source_branch, source_commit,
        diff_hash, validation_evidence_hash, target_ref, expected_target_head, approver,
        created_at, expires_at, operation_id, status, approval_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(approval.approvalId, approval.repositoryRef, approval.sourceWorkcellId, approval.sourceBranch, approval.sourceCommit, approval.diffHash, approval.validationEvidenceHash, approval.targetRef, approval.expectedTargetHead, approval.approver, approval.createdAt, approval.expiresAt, approval.operationId, approval.status, serialized);
      this.appendEventIfAbsent({ eventId: `merge-approval:${approval.approvalId}`, entityType: 'workcell', entityId: approval.sourceWorkcellId, eventType: 'workcell_merge_approval_created', occurredAt: approval.createdAt, payload: { approvalId: approval.approvalId, operationId: approval.operationId, targetRef: approval.targetRef, expectedTargetHead: approval.expectedTargetHead } });
      return 'created';
    });
  }

  getMergeApproval(approvalId: string): AgentModeMergeApproval | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT approval_json FROM agent_mode_merge_approvals WHERE approval_id = ?').get(approvalId) as { approval_json?: string } | undefined;
    return row?.approval_json ? JSON.parse(row.approval_json) as AgentModeMergeApproval : undefined;
  }

  updateMergeApproval(approval: AgentModeMergeApproval): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.getMergeApproval(approval.approvalId);
      if (!existing) throw new Error(`merge approval not found: ${approval.approvalId}`);
      if (JSON.stringify(existing) === JSON.stringify(approval)) return 'duplicate';
      if (existing.repositoryRef !== approval.repositoryRef || existing.sourceCommit !== approval.sourceCommit || existing.expectedTargetHead !== approval.expectedTargetHead || existing.operationId !== approval.operationId) return 'conflict';
      this.database.prepare('UPDATE agent_mode_merge_approvals SET status = ?, approval_json = ? WHERE approval_id = ?').run(approval.status, JSON.stringify(approval), approval.approvalId);
      return 'created';
    });
  }

  listMergeApprovals(): AgentModeMergeApproval[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT approval_json FROM agent_mode_merge_approvals ORDER BY created_at, approval_id').all() as Array<{ approval_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.approval_json)) as AgentModeMergeApproval);
  }

  getMergeReceipt(receiptId: string): AgentModeMergeReceipt | undefined {
    if (!this.hasMergeReceiptTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts WHERE receipt_id = ?').get(receiptId) as { receipt_json?: string } | undefined;
    return row?.receipt_json ? JSON.parse(row.receipt_json) as AgentModeMergeReceipt : undefined;
  }

  listMergeReceipts(operationId?: string): AgentModeMergeReceipt[] {
    if (!this.hasMergeReceiptTables) return [];
    const rows = (operationId
      ? this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts WHERE operation_id = ? ORDER BY timestamp, receipt_id').all(operationId)
      : this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts ORDER BY timestamp, receipt_id').all()) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeMergeReceipt);
  }

  recordMergeReceipt(receipt: AgentModeMergeReceipt): AgentModeOperationResult {
    if (!this.hasMergeReceiptTables) throw new Error('K3.5 merge receipt tables are unavailable');
    return this.withTransaction(() => this.recordMergeReceiptInternal(receipt));
  }

  private recordMergeReceiptInternal(receipt: AgentModeMergeReceipt): AgentModeOperationResult {
    const workcell = this.getWorkcell(receipt.workcellId);
    if (!workcell) throw new Error(`merge receipt Workcell does not exist: ${receipt.workcellId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`merge receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_merge_receipts (
        receipt_id, operation_id, approval_id, workcell_id, source_commit, target_ref,
        target_before, target_after, review_id, validation_id, actor, timestamp,
        operation_hash, result, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.operationId, receipt.approvalId, receipt.workcellId, receipt.sourceCommit, receipt.targetRef, receipt.targetBefore, receipt.targetAfter, receipt.reviewId, receipt.validationId, receipt.actor, receipt.timestamp, receipt.operationHash, receipt.result, serialized);
    return 'created';
  }

  createMergeOperation(operation: AgentModeMergeOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT operation_json FROM agent_mode_merge_operations WHERE operation_id = ?').get(operation.operationId) as { operation_json?: string } | undefined;
      const serialized = JSON.stringify(operation);
      if (existing) return existing.operation_json === serialized ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_merge_operations (
        operation_id, approval_id, repository_ref, source_workcell_id, source_branch,
        source_commit, target_ref, expected_target_head, resulting_target_head, actor,
        created_at, status, receipt_hash, reason, operation_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(operation.operationId, operation.approvalId, operation.repositoryRef, operation.sourceWorkcellId, operation.sourceBranch, operation.sourceCommit, operation.targetRef, operation.expectedTargetHead, operation.resultingTargetHead ?? null, operation.actor, operation.createdAt, operation.status, operation.receiptHash ?? null, operation.reason ?? null, serialized);
      this.recordMergeReceiptInternal(makeMergeReceipt(operation, 'MergeRequestedReceipt', 'requested', operation.createdAt));
      this.appendEventIfAbsent({ eventId: `merge-operation:${operation.operationId}`, entityType: 'target_ref', entityId: `${operation.repositoryRef}:${operation.targetRef}`, eventType: 'workcell_merge_operation_recorded', occurredAt: operation.createdAt, payload: { operationId: operation.operationId, approvalId: operation.approvalId, status: operation.status, expectedTargetHead: operation.expectedTargetHead } });
      return 'created';
    });
  }

  updateMergeOperation(operation: AgentModeMergeOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.getMergeOperation(operation.operationId);
      if (!existing) throw new Error(`merge operation not found: ${operation.operationId}`);
      if (existing.approvalId !== operation.approvalId || existing.repositoryRef !== operation.repositoryRef || existing.sourceWorkcellId !== operation.sourceWorkcellId || existing.sourceBranch !== operation.sourceBranch || existing.sourceCommit !== operation.sourceCommit || existing.reviewId !== operation.reviewId || existing.validationId !== operation.validationId || existing.targetRef !== operation.targetRef || existing.expectedTargetHead !== operation.expectedTargetHead || existing.targetFenceToken !== operation.targetFenceToken) return 'conflict';
      if (JSON.stringify(existing) === JSON.stringify(operation)) return 'duplicate';
      this.database.prepare('UPDATE agent_mode_merge_operations SET resulting_target_head = ?, status = ?, receipt_hash = ?, reason = ?, operation_json = ? WHERE operation_id = ?')
        .run(operation.resultingTargetHead ?? null, operation.status, operation.receiptHash ?? null, operation.reason ?? null, JSON.stringify(operation), operation.operationId);
      if (operation.status === 'merged' || operation.status === 'reconciled' || operation.status === 'rejected') {
        this.recordMergeReceiptInternal(makeMergeReceipt(operation, operation.status === 'merged' ? 'MergeCompletedReceipt' : operation.status === 'reconciled' ? 'MergeReconciledReceipt' : 'MergeRejectedReceipt', operation.status === 'merged' ? 'completed' : operation.status, operation.createdAt));
      }
      return 'created';
    });
  }

  getMergeOperation(operationId: string): AgentModeMergeOperation | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT operation_json FROM agent_mode_merge_operations WHERE operation_id = ?').get(operationId) as { operation_json?: string } | undefined;
    return row?.operation_json ? JSON.parse(row.operation_json) as AgentModeMergeOperation : undefined;
  }

  listMergeOperations(): AgentModeMergeOperation[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT operation_json FROM agent_mode_merge_operations ORDER BY created_at, operation_id').all() as Array<{ operation_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.operation_json)) as AgentModeMergeOperation);
  }

  get schedulerAvailable(): boolean {
    return this.hasSchedulerTables;
  }

  private mapSchedulerEvent(row: Record<string, unknown>): AgentModeSchedulerEvent {
    return {
      eventId: String(row.event_id), eventType: String(row.event_type), source: String(row.source),
      occurredAt: String(row.occurred_at), receivedAt: String(row.received_at),
      causationId: row.causation_id === null ? null : String(row.causation_id),
      correlationId: row.correlation_id === null ? null : String(row.correlation_id),
      deduplicationKey: String(row.deduplication_key), payloadVersion: String(row.payload_version),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
      status: row.status as AgentModeSchedulerItemStatus, attemptCount: Number(row.attempt_count),
      nextEligibleAt: String(row.next_eligible_at), deadline: row.deadline === null ? null : String(row.deadline),
      maxAttempts: Number(row.max_attempts), contentHash: String(row.content_hash),
      claimOwner: row.claim_owner === null ? null : String(row.claim_owner),
      claimFence: row.claim_fence === null ? null : Number(row.claim_fence),
      claimExpiresAt: row.claim_expires_at === null ? null : String(row.claim_expires_at),
      lastFailure: row.last_failure === null ? null : String(row.last_failure),
      lastFailureAt: row.last_failure_at === null ? null : String(row.last_failure_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at),
      deadLetteredAt: row.dead_lettered_at === null ? null : String(row.dead_lettered_at),
    };
  }

  private mapSchedulerSchedule(row: Record<string, unknown>): AgentModeSchedulerSchedule {
    return {
      scheduleId: String(row.schedule_id), kind: String(row.kind), dueAt: String(row.due_at), createdAt: String(row.created_at),
      status: row.status as AgentModeSchedulerItemStatus, deduplicationKey: String(row.deduplication_key),
      causationId: row.causation_id === null ? null : String(row.causation_id),
      correlationId: row.correlation_id === null ? null : String(row.correlation_id),
      payloadVersion: String(row.payload_version), payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
      attemptCount: Number(row.attempt_count), nextEligibleAt: String(row.next_eligible_at),
      deadline: row.deadline === null ? null : String(row.deadline), maxAttempts: Number(row.max_attempts),
      contentHash: String(row.content_hash), claimOwner: row.claim_owner === null ? null : String(row.claim_owner),
      claimFence: row.claim_fence === null ? null : Number(row.claim_fence),
      claimExpiresAt: row.claim_expires_at === null ? null : String(row.claim_expires_at),
      lastFailure: row.last_failure === null ? null : String(row.last_failure),
      lastFailureAt: row.last_failure_at === null ? null : String(row.last_failure_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at),
      deadLetteredAt: row.dead_lettered_at === null ? null : String(row.dead_lettered_at),
    };
  }

  createSchedulerEvent(input: AgentModeSchedulerEventInput): AgentModeQueueOperationResult {
    if (!this.hasSchedulerTables) throw new Error('scheduler tables are unavailable');
    ensureSchedulerText(input.eventId, 'eventId', true); ensureSchedulerText(input.eventType, 'eventType', true); ensureSchedulerText(input.source, 'source', true); ensureSchedulerText(input.deduplicationKey, 'deduplicationKey', true); ensureSchedulerText(input.causationId, 'causationId'); ensureSchedulerText(input.correlationId, 'correlationId');
    if (!Number.isFinite(Date.parse(input.occurredAt)) || !Number.isFinite(Date.parse(input.receivedAt))) throw new Error('scheduler event timestamps must be ISO timestamps');
    const payloadJson = ensureSchedulerInput(input);
    const contentHash = schedulerContentHash({ eventType: input.eventType, source: input.source, occurredAt: input.occurredAt, causationId: input.causationId, correlationId: input.correlationId, deduplicationKey: input.deduplicationKey, payloadVersion: input.payloadVersion, payload: input.payload, nextEligibleAt: input.nextEligibleAt, deadline: input.deadline, maxAttempts: input.maxAttempts });
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_events WHERE source = ? AND deduplication_key = ?').get(input.source, input.deduplicationKey) as { content_hash?: string } | undefined;
      if (existing) return existing.content_hash === contentHash ? 'duplicate' : 'conflict';
      const sameId = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_events WHERE event_id = ?').get(input.eventId) as { content_hash?: string } | undefined;
      if (sameId) return sameId.content_hash === contentHash ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_scheduler_events
        (event_id,event_type,source,occurred_at,received_at,causation_id,correlation_id,deduplication_key,payload_version,payload_json,status,attempt_count,next_eligible_at,deadline,max_attempts,content_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'pending',0,?,?,?,?)`).run(
        input.eventId, input.eventType, input.source, input.occurredAt, input.receivedAt, input.causationId, input.correlationId,
        input.deduplicationKey, input.payloadVersion, payloadJson, input.nextEligibleAt, input.deadline, input.maxAttempts, contentHash,
      );
      return 'created';
    });
  }

  createSchedulerSchedule(input: AgentModeSchedulerScheduleInput): AgentModeQueueOperationResult {
    if (!this.hasSchedulerTables) throw new Error('scheduler tables are unavailable');
    ensureSchedulerText(input.scheduleId, 'scheduleId', true); ensureSchedulerText(input.kind, 'kind', true); ensureSchedulerText(input.deduplicationKey, 'deduplicationKey', true); ensureSchedulerText(input.causationId, 'causationId'); ensureSchedulerText(input.correlationId, 'correlationId');
    if (!Number.isFinite(Date.parse(input.dueAt)) || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('scheduler timestamps must be ISO timestamps');
    const payloadJson = ensureSchedulerInput(input);
    const contentHash = schedulerContentHash({ kind: input.kind, dueAt: input.dueAt, deduplicationKey: input.deduplicationKey, causationId: input.causationId, correlationId: input.correlationId, payloadVersion: input.payloadVersion, payload: input.payload, nextEligibleAt: input.nextEligibleAt, deadline: input.deadline, maxAttempts: input.maxAttempts });
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_schedules WHERE kind = ? AND deduplication_key = ?').get(input.kind, input.deduplicationKey) as { content_hash?: string } | undefined;
      if (existing) return existing.content_hash === contentHash ? 'duplicate' : 'conflict';
      const sameId = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_schedules WHERE schedule_id = ?').get(input.scheduleId) as { content_hash?: string } | undefined;
      if (sameId) return sameId.content_hash === contentHash ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_scheduler_schedules
        (schedule_id,kind,due_at,created_at,status,deduplication_key,causation_id,correlation_id,payload_version,payload_json,attempt_count,next_eligible_at,deadline,max_attempts,content_hash)
        VALUES (?,?,?,?, 'pending',?,?,?,?,?,0,?,?,?,?)`).run(
        input.scheduleId, input.kind, input.dueAt, input.createdAt, input.deduplicationKey, input.causationId, input.correlationId,
        input.payloadVersion, payloadJson, input.nextEligibleAt, input.deadline, input.maxAttempts, contentHash,
      );
      return 'created';
    });
  }

  listSchedulerEvents(limit = 100): AgentModeSchedulerEvent[] {
    if (!this.hasSchedulerTables) return [];
    const bounded = Math.max(0, Math.min(Math.floor(limit), 500));
    return (this.database.prepare('SELECT * FROM agent_mode_scheduler_events ORDER BY rowid LIMIT ?').all(bounded) as Array<Record<string, unknown>>).map((row) => this.mapSchedulerEvent(row));
  }

  listSchedulerSchedules(limit = 100): AgentModeSchedulerSchedule[] {
    if (!this.hasSchedulerTables) return [];
    const bounded = Math.max(0, Math.min(Math.floor(limit), 500));
    return (this.database.prepare('SELECT * FROM agent_mode_scheduler_schedules ORDER BY due_at,schedule_id LIMIT ?').all(bounded) as Array<Record<string, unknown>>).map((row) => this.mapSchedulerSchedule(row));
  }

  getSchedulerEvent(eventId: string): AgentModeSchedulerEvent | undefined {
    if (!this.hasSchedulerTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_scheduler_events WHERE event_id = ?').get(eventId) as Record<string, unknown> | undefined;
    return row ? this.mapSchedulerEvent(row) : undefined;
  }

  getSchedulerSchedule(scheduleId: string): AgentModeSchedulerSchedule | undefined {
    if (!this.hasSchedulerTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_scheduler_schedules WHERE schedule_id = ?').get(scheduleId) as Record<string, unknown> | undefined;
    return row ? this.mapSchedulerSchedule(row) : undefined;
  }

  private claimSchedulerRow(itemType: 'event' | 'schedule', itemId: string, ownerId: string, expiresAt: string, now: string): AgentModeSchedulerClaim | undefined {
    const table = itemType === 'event' ? 'agent_mode_scheduler_events' : 'agent_mode_scheduler_schedules';
    const idColumn = itemType === 'event' ? 'event_id' : 'schedule_id';
    const resourceKey = `agent-mode-scheduler:${itemType}:${itemId}`;
    return this.withTransaction(() => {
      const row = this.database.prepare(`SELECT status,next_eligible_at,claim_expires_at FROM ${table} WHERE ${idColumn} = ?`).get(itemId) as { status?: string; next_eligible_at?: string; claim_expires_at?: string | null } | undefined;
      if (!row) return undefined;
      const liveClaim = row.status === 'claimed' && row.claim_expires_at !== null && row.claim_expires_at !== undefined && row.claim_expires_at > now;
      const eligible = (row.status === 'pending' || row.status === 'failed') && String(row.next_eligible_at) <= now;
      if (liveClaim || (!eligible && row.status !== 'claimed')) return undefined;
      const lease = this.acquireLeaseAt({ resourceKey, leaseId: `${resourceKey}:${ownerId}`, ownerId, expiresAt }, now);
      if (!lease) return undefined;
      const updated = this.database.prepare(`UPDATE ${table} SET status='claimed',attempt_count=attempt_count+1,claim_owner=?,claim_fence=?,claim_expires_at=? WHERE ${idColumn}=? AND (status IN ('pending','failed') OR (status='claimed' AND claim_expires_at <= ?))`).run(ownerId, lease.fence, expiresAt, itemId, now);
      if (updated.changes !== 1) return undefined;
      return { ownerId, fence: lease.fence, expiresAt };
    });
  }

  claimSchedulerEvent(eventId: string, ownerId: string, expiresAt: string, now: string): AgentModeSchedulerClaim | undefined {
    return this.claimSchedulerRow('event', eventId, ownerId, expiresAt, now);
  }

  claimSchedulerSchedule(scheduleId: string, ownerId: string, expiresAt: string, now: string): AgentModeSchedulerClaim | undefined {
    return this.claimSchedulerRow('schedule', scheduleId, ownerId, expiresAt, now);
  }

  private settleSchedulerRow(input: AgentModeSchedulerSettlement, status: 'completed' | 'dead_letter' | 'failed', failure?: AgentModeSchedulerFailure): AgentModeSchedulerItemStatus {
    const table = input.itemType === 'event' ? 'agent_mode_scheduler_events' : 'agent_mode_scheduler_schedules';
    const idColumn = input.itemType === 'event' ? 'event_id' : 'schedule_id';
    const resourceKey = `agent-mode-scheduler:${input.itemType}:${input.itemId}`;
    return this.withTransaction(() => {
      const current = this.database.prepare(`SELECT status,claim_owner,claim_fence,claim_expires_at,attempt_count,max_attempts,deadline FROM ${table} WHERE ${idColumn} = ?`).get(input.itemId) as Record<string, unknown> | undefined;
      if (!current || current.status !== 'claimed' || current.claim_owner !== input.ownerId || Number(current.claim_fence) !== input.fence || current.claim_expires_at === null || String(current.claim_expires_at) <= input.now) throw new Error('stale_scheduler_claim');
      const lease = this.database.prepare('SELECT owner_id,fence,expires_at FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
      if (!lease || lease.owner_id !== input.ownerId || Number(lease.fence) !== input.fence || String(lease.expires_at) <= input.now) throw new Error('stale_scheduler_fence');
      const failureText = failure?.reason ?? null;
      if (status === 'failed') {
        const attemptCount = Number(current.attempt_count);
        const backoffMs = Math.min(300_000, 1_000 * (2 ** Math.max(0, attemptCount - 1)));
        const nextEligibleAt = new Date(Date.parse(input.now) + backoffMs).toISOString();
        if (attemptCount >= Number(current.max_attempts) || (current.deadline !== null && String(current.deadline) <= nextEligibleAt)) status = 'dead_letter';
        this.database.prepare(`UPDATE ${table} SET status=?,next_eligible_at=?,last_failure=?,last_failure_at=?,dead_lettered_at=?,claim_owner=NULL,claim_fence=NULL,claim_expires_at=NULL WHERE ${idColumn}=?`).run(status, nextEligibleAt, failureText, input.now, status === 'dead_letter' ? input.now : null, input.itemId);
      } else {
        this.database.prepare(`UPDATE ${table} SET status=?,completed_at=?,dead_lettered_at=?,last_failure=?,last_failure_at=?,claim_owner=NULL,claim_fence=NULL,claim_expires_at=NULL WHERE ${idColumn}=?`).run(status, status === 'completed' ? input.now : null, status === 'dead_letter' ? input.now : null, failureText, failure ? input.now : null, input.itemId);
      }
      this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ? AND owner_id = ? AND fence = ?').run(input.now, resourceKey, input.ownerId, input.fence);
      return status;
    });
  }

  completeSchedulerEvent(input: AgentModeSchedulerSettlement): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, 'completed'); }
  completeSchedulerSchedule(input: AgentModeSchedulerSettlement): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, 'completed'); }
  failSchedulerEvent(input: AgentModeSchedulerFailure): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, input.forceDeadLetter ? 'dead_letter' : 'failed', input); }
  failSchedulerSchedule(input: AgentModeSchedulerFailure): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, input.forceDeadLetter ? 'dead_letter' : 'failed', input); }

  upsertSourceWatermark(input: AgentModeSourceWatermark): 'advanced' | 'duplicate' | 'stale' {
    if (!this.hasSchedulerTables || !input.sourceId || !input.watermark || !Number.isFinite(Date.parse(input.updatedAt))) throw new Error('invalid source watermark');
    return this.withTransaction(() => {
      const current = this.database.prepare('SELECT watermark FROM agent_mode_source_watermarks WHERE source_id = ?').get(input.sourceId) as { watermark?: string } | undefined;
      if (!current) {
        this.database.prepare('INSERT INTO agent_mode_source_watermarks (source_id,watermark,updated_at) VALUES (?,?,?)').run(input.sourceId, input.watermark, input.updatedAt);
        return 'advanced';
      }
      const currentWatermark = current.watermark ?? '';
      const oldTime = Date.parse(currentWatermark); const newTime = Date.parse(input.watermark);
      const comparison = Number.isFinite(oldTime) && Number.isFinite(newTime) ? newTime - oldTime : input.watermark.localeCompare(currentWatermark);
      if (comparison === 0) return 'duplicate';
      if (comparison < 0) return 'stale';
      this.database.prepare('UPDATE agent_mode_source_watermarks SET watermark=?,updated_at=? WHERE source_id=?').run(input.watermark, input.updatedAt, input.sourceId);
      return 'advanced';
    });
  }

  listSourceWatermarks(): AgentModeSourceWatermark[] {
    if (!this.hasSchedulerTables) return [];
    return (this.database.prepare('SELECT source_id,watermark,updated_at FROM agent_mode_source_watermarks ORDER BY source_id').all() as Array<Record<string, unknown>>).map((row) => ({ sourceId: String(row.source_id), watermark: String(row.watermark), updatedAt: String(row.updated_at) }));
  }

  saveLatestSchedulerTick(tick: AgentModeSchedulerTickSummary): void {
    if (!this.hasSchedulerTables) throw new Error('scheduler tables are unavailable');
    this.withTransaction(() => {
      this.database.prepare("INSERT INTO agent_mode_scheduler_observer (singleton,latest_tick_json) VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET latest_tick_json=excluded.latest_tick_json").run(JSON.stringify(tick));
    });
  }

  getLatestSchedulerTick(): AgentModeSchedulerTickSummary | undefined {
    if (!this.hasSchedulerTables) return undefined;
    const row = this.database.prepare('SELECT latest_tick_json FROM agent_mode_scheduler_observer WHERE singleton = 1').get() as { latest_tick_json?: string | null } | undefined;
    return row?.latest_tick_json ? JSON.parse(row.latest_tick_json) as AgentModeSchedulerTickSummary : undefined;
  }

  private mapEventSource(row: Record<string, unknown>): AgentModeEventSourceState {
    return {
      sourceId: String(row.source_id), sourceType: String(row.source_type), repositoryRef: String(row.repository_ref),
      adapterType: row.adapter_type as AgentModeEventSourceConfig['adapterType'],
      debounceWindowMs: Number(row.debounce_window_ms), cooldownWindowMs: Number(row.cooldown_window_ms), catchUpLimit: Number(row.catch_up_limit),
      enabled: Number(row.enabled) === 1, bootstrapWatermark: row.bootstrap_watermark === null ? null : String(row.bootstrap_watermark),
      status: row.status as AgentModeEventSourceStatus, watermark: row.watermark === null ? null : String(row.watermark),
      lastObservedAt: row.last_observed_at === null ? null : String(row.last_observed_at),
      lastSuccessfulObservation: row.last_successful_observation === null ? null : String(row.last_successful_observation),
      lastErrorReason: row.last_error_reason === null ? null : String(row.last_error_reason),
      cooldownNotBefore: row.cooldown_not_before === null ? null : String(row.cooldown_not_before),
      nextEligibleAt: row.next_eligible_at === null ? null : String(row.next_eligible_at),
      catchUpPending: Number(row.catch_up_pending) === 1, lastEmittedEventCount: Number(row.last_emitted_event_count), failureAttemptCount: Number(row.failure_attempt_count),
    };
  }

  upsertEventSource(config: AgentModeEventSourceConfig): 'created' | 'updated' | 'duplicate' | 'conflict' {
    if (!this.hasEventSourceTables) throw new Error('event source tables are unavailable');
    ensureSchedulerText(config.sourceId, 'sourceId', true); ensureSchedulerText(config.sourceType, 'sourceType', true); ensureSchedulerText(config.repositoryRef, 'repositoryRef', true);
    if (!['git.repository.revision', 'brain.task.lifecycle', 'infrastructure.host-health', 'ci.workflow-run'].includes(config.adapterType) || config.sourceType !== config.adapterType || !Number.isInteger(config.debounceWindowMs) || config.debounceWindowMs < 0 || config.debounceWindowMs > 300_000 || !Number.isInteger(config.cooldownWindowMs) || config.cooldownWindowMs < 0 || config.cooldownWindowMs > 300_000 || !Number.isInteger(config.catchUpLimit) || config.catchUpLimit < 1 || config.catchUpLimit > 100) throw new Error('event source configuration is outside K4.1 bounds');
    ensureSchedulerText(config.bootstrapWatermark, 'bootstrapWatermark');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM agent_mode_event_sources WHERE source_id = ?').get(config.sourceId) as Record<string, unknown> | undefined;
      if (!existing) {
        const count = this.database.prepare('SELECT COUNT(*) AS count FROM agent_mode_event_sources').get() as { count?: number };
        if (Number(count.count ?? 0) >= MAX_EVENT_SOURCE_REGISTRATIONS) throw new Error('event source registration limit reached');
        this.database.prepare(`INSERT INTO agent_mode_event_sources
          (source_id,source_type,repository_ref,adapter_type,debounce_window_ms,cooldown_window_ms,catch_up_limit,enabled,bootstrap_watermark,status,catch_up_pending,last_emitted_event_count,failure_attempt_count)
          VALUES (?,?,?,?,?,?,?,?,?,'ready',0,0,0)`).run(config.sourceId, config.sourceType, config.repositoryRef, config.adapterType, config.debounceWindowMs, config.cooldownWindowMs, config.catchUpLimit, config.enabled ? 1 : 0, config.bootstrapWatermark);
        return 'created';
      }
      if (existing.source_type !== config.sourceType || existing.repository_ref !== config.repositoryRef || existing.adapter_type !== config.adapterType || existing.bootstrap_watermark !== config.bootstrapWatermark) return 'conflict';
      const same = Number(existing.debounce_window_ms) === config.debounceWindowMs && Number(existing.cooldown_window_ms) === config.cooldownWindowMs && Number(existing.catch_up_limit) === config.catchUpLimit && Number(existing.enabled) === (config.enabled ? 1 : 0);
      if (same) return 'duplicate';
      this.database.prepare('UPDATE agent_mode_event_sources SET debounce_window_ms=?,cooldown_window_ms=?,catch_up_limit=?,enabled=?,status=CASE WHEN ?=0 THEN \'disabled\' WHEN status=\'disabled\' THEN \'ready\' ELSE status END WHERE source_id=?').run(config.debounceWindowMs, config.cooldownWindowMs, config.catchUpLimit, config.enabled ? 1 : 0, config.enabled ? 1 : 0, config.sourceId);
      return 'updated';
    });
  }

  listEventSources(): AgentModeEventSourceState[] {
    if (!this.hasEventSourceTables) return [];
    return (this.database.prepare('SELECT * FROM agent_mode_event_sources ORDER BY source_id').all() as Array<Record<string, unknown>>).map((row) => this.mapEventSource(row));
  }

  getEventSource(sourceId: string): AgentModeEventSourceState | undefined {
    if (!this.hasEventSourceTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_event_sources WHERE source_id = ?').get(sourceId) as Record<string, unknown> | undefined;
    return row ? this.mapEventSource(row) : undefined;
  }

  ingestSchedulerEventsAndAdvanceSource(input: { sourceId: string; observedAt: string; observedWatermark: string; events: AgentModeSchedulerEventInput[]; hasMore: boolean; cooldownNotBefore: string | null }): { created: number; duplicates: number } {
    if (!this.hasEventSourceTables) throw new Error('event source tables are unavailable');
    if (!this.getEventSource(input.sourceId)) throw new Error(`event source not found: ${input.sourceId}`);
    const created = { count: 0 }; const duplicates = { count: 0 };
    this.withTransaction(() => {
      for (const event of input.events) {
        if (event.source !== input.sourceId) throw new Error('scheduler event source does not match event source');
        const result = this.createSchedulerEvent(event);
        if (result === 'conflict') throw new Error(`scheduler event conflict: ${event.eventId}`);
        if (result === 'created') created.count += 1; else duplicates.count += 1;
      }
      this.database.prepare(`UPDATE agent_mode_event_sources SET status=?,watermark=?,last_observed_at=?,last_successful_observation=?,last_error_reason=NULL,cooldown_not_before=?,next_eligible_at=?,catch_up_pending=?,last_emitted_event_count=?,failure_attempt_count=0 WHERE source_id=?`).run(input.cooldownNotBefore && input.cooldownNotBefore > input.observedAt ? 'cooldown' : 'ready', input.observedWatermark, input.observedAt, input.observedAt, input.cooldownNotBefore, input.cooldownNotBefore, input.hasMore ? 1 : 0, input.events.length, input.sourceId);
    });
    return { created: created.count, duplicates: duplicates.count };
  }

  recordEventSourceFailure(input: { sourceId: string; observedAt: string; status: 'failed' | 'diverged'; reason: string }): void {
    if (!this.hasEventSourceTables) throw new Error('event source tables are unavailable');
    this.withTransaction(() => {
      const source = this.getEventSource(input.sourceId);
      if (!source) throw new Error(`event source not found: ${input.sourceId}`);
      const attempts = input.status === 'diverged' ? source.failureAttemptCount : source.failureAttemptCount + 1;
      const nextEligibleAt = input.status === 'diverged' ? null : new Date(Date.parse(input.observedAt) + Math.min(300_000, 1_000 * (2 ** Math.max(0, attempts - 1)))).toISOString();
      this.database.prepare('UPDATE agent_mode_event_sources SET status=?,last_observed_at=?,last_error_reason=?,next_eligible_at=?,failure_attempt_count=? WHERE source_id=?').run(input.status, input.observedAt, input.reason.slice(0, 256), nextEligibleAt, attempts, input.sourceId);
    });
  }

  private persistAttentionEscalation(escalation: AgentModeEscalation): 'created' | 'duplicate' | 'conflict' {
    const materialHash = createHash('sha256').update(escalationMaterial(escalation), 'utf8').digest('hex');
    const existing = this.database.prepare('SELECT * FROM agent_mode_escalations WHERE escalation_id = ?').get(escalation.escalationId) as Record<string, unknown> | undefined;
    if (existing) {
      if (String(existing.material_hash) !== materialHash) return 'conflict';
      const changed = String(existing.status) !== escalation.status || (existing.resolved_at ?? null) !== escalation.resolvedAt;
      if (changed) {
        this.database.prepare('UPDATE agent_mode_escalations SET status=?,updated_at=?,resolved_at=? WHERE escalation_id=?').run(escalation.status, escalation.updatedAt, escalation.resolvedAt, escalation.escalationId);
      }
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_escalations (
        escalation_id, material_hash, schema_version, kind, severity, root_goal_id, agent_id, task_id,
        run_id, attempt_id, workcell_id, review_id, source_type, source_id, reason_code, status,
        created_at, updated_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      escalation.escalationId, materialHash, escalation.schemaVersion, escalation.kind, escalation.severity,
      escalation.rootGoalId, escalation.agentId, escalation.taskId, escalation.runId, escalation.attemptId,
      escalation.workcellId, escalation.reviewId, escalation.sourceType, escalation.sourceId, escalation.reasonCode,
      escalation.status, escalation.createdAt, escalation.updatedAt, escalation.resolvedAt,
    );
    return 'created';
  }

  private persistAttentionNotification(notification: AgentModeNotification): 'created' | 'duplicate' | 'conflict' {
    const materialHash = createHash('sha256').update(notificationMaterial(notification), 'utf8').digest('hex');
    const existing = this.database.prepare('SELECT material_hash FROM agent_mode_notifications WHERE notification_id = ?').get(notification.notificationId) as { material_hash?: string } | undefined;
    if (existing) return existing.material_hash === materialHash ? 'duplicate' : 'conflict';
    this.database.prepare(`
      INSERT INTO agent_mode_notifications (
        notification_id, material_hash, schema_version, kind, severity, source_type, source_id,
        escalation_id, review_id, root_goal_id, agent_id, task_id, run_id, attempt_id, workcell_id,
        title_code, message_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      notification.notificationId, materialHash, notification.schemaVersion, notification.kind, notification.severity,
      notification.sourceType, notification.sourceId, notification.escalationId, notification.reviewId,
      notification.rootGoalId, notification.agentId, notification.taskId, notification.runId, notification.attemptId,
      notification.workcellId, notification.titleCode, notification.messageCode, notification.createdAt,
    );
    return 'created';
  }

  private attentionNotificationForEscalation(escalation: AgentModeEscalation, transitionId: string): AgentModeNotification {
    const kind: AgentModeNotificationKind = escalation.kind === 'uncertain_attempt'
      ? 'uncertain_attempt'
      : escalation.kind === 'scheduler_dead_letter' ? 'scheduler_dead_letter' : 'operator_escalation';
    return {
      schemaVersion: AGENT_MODE_ATTENTION_SCHEMA_VERSION,
      notificationId: deriveNotificationId({ kind, sourceType: escalation.sourceType, sourceId: escalation.sourceId, transitionId }),
      kind,
      severity: escalation.severity,
      sourceType: escalation.sourceType,
      sourceId: escalation.sourceId,
      escalationId: escalation.escalationId,
      reviewId: escalation.reviewId,
      rootGoalId: escalation.rootGoalId,
      agentId: escalation.agentId,
      taskId: escalation.taskId,
      runId: escalation.runId,
      attemptId: escalation.attemptId,
      workcellId: escalation.workcellId,
      titleCode: escalation.kind === 'uncertain_attempt' ? 'AGENT_ATTEMPT_UNCERTAIN' : escalation.kind === 'scheduler_dead_letter' ? 'SCHEDULER_ITEM_DEAD_LETTERED' : 'WORKCELL_VALIDATION_REQUIRES_ATTENTION',
      messageCode: escalation.reasonCode,
      createdAt: escalation.createdAt,
      read: null,
      readAt: null,
    };
  }

  private attentionEscalation(input: {
    kind: AgentModeEscalationKind;
    severity: AgentModeEscalationSeverity;
    sourceType: AgentModeAttentionSourceType;
    sourceId: string;
    rootGoalId?: string | null;
    agentId?: string | null;
    taskId?: string | null;
    runId?: string | null;
    attemptId?: string | null;
    workcellId?: string | null;
    reviewId?: string | null;
    reasonCode: string;
    createdAt: string;
    status: AgentModeEscalationStatus;
    resolvedAt?: string | null;
  }): AgentModeEscalation {
    const base = {
      schemaVersion: AGENT_MODE_ATTENTION_SCHEMA_VERSION,
      escalationId: deriveEscalationId(input),
      kind: input.kind,
      severity: input.severity,
      rootGoalId: input.rootGoalId ?? null,
      agentId: input.agentId ?? null,
      taskId: input.taskId ?? null,
      runId: input.runId ?? null,
      attemptId: input.attemptId ?? null,
      workcellId: input.workcellId ?? null,
      reviewId: input.reviewId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reasonCode: input.reasonCode,
      status: input.status,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      resolvedAt: input.resolvedAt ?? null,
    } satisfies AgentModeEscalation;
    return base;
  }

  private reconcileAttentionCandidate(escalation: AgentModeEscalation, transitionId: string, counts: AgentModeAttentionReconcileResult): void {
    const persisted = this.persistAttentionEscalation(escalation);
    if (persisted === 'conflict') throw new Error(`attention escalation conflict: ${escalation.escalationId}`);
    if (persisted === 'created') counts.createdEscalations += 1;
    if (escalation.status === 'open') {
      const notification = this.attentionNotificationForEscalation(escalation, transitionId);
      const notificationResult = this.persistAttentionNotification(notification);
      if (notificationResult === 'conflict') throw new Error(`attention notification conflict: ${notification.notificationId}`);
      if (notificationResult === 'created') counts.createdNotifications += 1; else counts.existingNotifications += 1;
    }
  }

  private listAttentionAttemptIds(limit: number): string[] {
    return (this.database.prepare("SELECT attempt_id FROM attempts WHERE status = 'uncertain' ORDER BY created_at, attempt_id LIMIT ?").all(limit) as Array<{ attempt_id?: unknown }>)
      .map((row) => String(row.attempt_id));
  }

  private listAttentionValidationIds(limit: number): string[] {
    return (this.database.prepare("SELECT validation_id FROM workcell_validations WHERE result IN ('failed', 'rejected', 'timed_out', 'interrupted') ORDER BY updated_at, validation_id LIMIT ?").all(limit) as Array<{ validation_id?: unknown }>)
      .map((row) => String(row.validation_id));
  }

  private listAttentionReviewIds(limit: number): string[] {
    return (this.database.prepare("SELECT review_id FROM agent_mode_review_requests WHERE status = 'pending' ORDER BY created_at, review_id LIMIT ?").all(limit) as Array<{ review_id?: unknown }>)
      .map((row) => String(row.review_id));
  }

  private attentionSourceStillQualifies(escalation: AgentModeEscalation): boolean | undefined {
    if (escalation.kind === 'uncertain_attempt') {
      const attempt = this.getAttempt(escalation.sourceId);
      return attempt ? attempt.status === 'uncertain' : undefined;
    }
    if (escalation.kind === 'scheduler_dead_letter') {
      const source = escalation.sourceType === 'scheduler_event'
        ? this.getSchedulerEvent(escalation.sourceId)
        : this.getSchedulerSchedule(escalation.sourceId);
      return source ? source.status === 'dead_letter' : undefined;
    }
    const validation = this.getWorkcellValidationRun(escalation.sourceId);
    return validation ? ['failed', 'rejected', 'timed_out', 'interrupted'].includes(validation.result) : undefined;
  }

  /** Reconcile bounded canonical transitions into the durable attention index. Never called by GET projections. */
  reconcileAgentModeAttention(now: string, limit = AGENT_MODE_ATTENTION_MAX_ITEMS): AgentModeAttentionReconcileResult {
    if (this.readOnly || !this.hasAttentionTables) throw new Error('attention persistence is unavailable');
    if (!Number.isFinite(Date.parse(now))) throw new Error('attention timestamp is invalid');
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), AGENT_MODE_ATTENTION_MAX_ITEMS));
    const counts: AgentModeAttentionReconcileResult = { createdEscalations: 0, resolvedEscalations: 0, createdNotifications: 0, existingNotifications: 0 };
    return this.withTransaction(() => {
      const activeEscalationKeys = new Set<string>();
      for (const attemptId of this.listAttentionAttemptIds(boundedLimit)) {
        const attempt = this.getAttempt(attemptId);
        if (!attempt) continue;
        const agent = this.getAgent(attempt.agentId);
        const escalation = this.attentionEscalation({ kind: 'uncertain_attempt', severity: 'critical', sourceType: 'attempt', sourceId: attempt.attemptId, rootGoalId: agent?.rootGoalId ?? null, agentId: attempt.agentId, taskId: this.getRun(attempt.runId)?.taskId ?? null, runId: attempt.runId, attemptId: attempt.attemptId, reasonCode: 'UNCERTAIN_RUNTIME', createdAt: attempt.updatedAt, status: 'open' });
        activeEscalationKeys.add(escalation.escalationId);
        this.reconcileAttentionCandidate(escalation, `runtime-uncertain:${attempt.attemptId}`, counts);
      }
      for (const item of [...this.listSchedulerEvents(boundedLimit), ...this.listSchedulerSchedules(boundedLimit)].filter((candidate) => candidate.status === 'dead_letter').slice(0, boundedLimit)) {
        const sourceType: AgentModeAttentionSourceType = 'eventId' in item ? 'scheduler_event' : 'scheduler_schedule';
        const sourceId = 'eventId' in item ? item.eventId : item.scheduleId;
        const escalation = this.attentionEscalation({ kind: 'scheduler_dead_letter', severity: 'warning', sourceType, sourceId, reasonCode: 'SCHEDULER_DEAD_LETTER', createdAt: item.deadLetteredAt ?? item.lastFailureAt ?? now, status: 'open' });
        activeEscalationKeys.add(escalation.escalationId);
        this.reconcileAttentionCandidate(escalation, `scheduler-dead-letter:${sourceType}:${sourceId}:${item.deadLetteredAt ?? item.lastFailureAt ?? now}`, counts);
      }
      for (const validationId of this.listAttentionValidationIds(boundedLimit)) {
        const validation = this.getWorkcellValidationRun(validationId);
        if (!validation) continue;
        const escalation = this.attentionEscalation({ kind: 'workcell_validation_failure', severity: 'warning', sourceType: 'workcell_validation', sourceId: validation.validationId, workcellId: validation.workcellId, taskId: validation.taskId, runId: validation.runId, attemptId: validation.attemptId, reasonCode: 'WORKCELL_VALIDATION_FAILED', createdAt: validation.updatedAt, status: 'open' });
        activeEscalationKeys.add(escalation.escalationId);
        this.reconcileAttentionCandidate(escalation, `workcell-validation:${validation.validationId}`, counts);
      }
      for (const reviewId of this.listAttentionReviewIds(boundedLimit)) {
        const review = this.getReviewRequest(reviewId);
        if (!review) continue;
        const notification: AgentModeNotification = {
          schemaVersion: AGENT_MODE_ATTENTION_SCHEMA_VERSION,
          notificationId: deriveNotificationId({ kind: 'pending_review', sourceType: 'review', sourceId: review.reviewId, transitionId: `review-requested:${review.reviewId}` }),
          kind: 'pending_review', severity: 'warning', sourceType: 'review', sourceId: review.reviewId,
          escalationId: null, reviewId: review.reviewId, rootGoalId: this.getAgent(review.workerAgentId)?.rootGoalId ?? null,
          agentId: review.workerAgentId, taskId: review.taskId, runId: review.runId, attemptId: review.attemptId,
          workcellId: review.workcellId, titleCode: 'PENDING_REVIEW_REQUEST', messageCode: 'REVIEW_DECISION_REQUIRED', createdAt: review.createdAt, read: null, readAt: null,
        };
        const result = this.persistAttentionNotification(notification);
        if (result === 'conflict') throw new Error(`attention notification conflict: ${notification.notificationId}`);
        if (result === 'created') counts.createdNotifications += 1; else counts.existingNotifications += 1;
      }
      const openRows = this.database.prepare("SELECT * FROM agent_mode_escalations WHERE status = 'open' ORDER BY updated_at, escalation_id LIMIT ?").all(AGENT_MODE_ATTENTION_MAX_ITEMS) as Array<Record<string, unknown>>;
      for (const row of openRows) {
        const escalation = mapEscalationRow(row);
        if (activeEscalationKeys.has(escalation.escalationId)) continue;
        if (this.attentionSourceStillQualifies(escalation) !== false) continue;
        const resolved = { ...escalation, status: 'resolved' as const, updatedAt: now, resolvedAt: now };
        const result = this.persistAttentionEscalation(resolved);
        if (result === 'conflict') throw new Error(`attention escalation conflict: ${escalation.escalationId}`);
        if (result === 'duplicate') counts.resolvedEscalations += 1;
      }
      return counts;
    });
  }

  listAgentModeEscalations(limit = AGENT_MODE_ATTENTION_MAX_ITEMS): AgentModeEscalation[] {
    if (!this.hasAttentionTables) return [];
    const bounded = Math.max(0, Math.min(Math.floor(limit), AGENT_MODE_ATTENTION_MAX_ITEMS));
    return (this.database.prepare('SELECT * FROM agent_mode_escalations ORDER BY CASE status WHEN \'open\' THEN 0 ELSE 1 END, updated_at DESC, escalation_id LIMIT ?').all(bounded) as Array<Record<string, unknown>>).map(mapEscalationRow);
  }

  listAgentModeNotifications(limit = AGENT_MODE_ATTENTION_MAX_ITEMS, operatorId?: string): AgentModeNotification[] {
    if (!this.hasAttentionTables) return [];
    const bounded = Math.max(0, Math.min(Math.floor(limit), AGENT_MODE_ATTENTION_MAX_ITEMS));
    if (operatorId === undefined) {
      return (this.database.prepare('SELECT *, NULL AS operator_id, NULL AS read_at FROM agent_mode_notifications ORDER BY created_at DESC, notification_id LIMIT ?').all(bounded) as Array<Record<string, unknown>>).map(mapNotificationRow);
    }
    if (operatorId.length === 0 || operatorId.length > 128) throw new Error('operator identity is invalid');
    return (this.database.prepare('SELECT n.*, ? AS operator_id, r.read_at FROM agent_mode_notifications n LEFT JOIN agent_mode_notification_reads r ON r.notification_id = n.notification_id AND r.operator_id = ? ORDER BY CASE WHEN r.read_at IS NULL THEN 0 ELSE 1 END, n.created_at DESC, n.notification_id LIMIT ?').all(operatorId, operatorId, bounded) as Array<Record<string, unknown>>).map(mapNotificationRow);
  }

  getAgentModeAttentionSummary(operatorId?: string): { openEscalationCount: number; pendingReviewCount: number; uncertainItemCount: number; deadLetterCount: number; notificationCount: number; unreadNotificationCount: number | null } {
    if (!this.hasAttentionTables) return { openEscalationCount: 0, pendingReviewCount: 0, uncertainItemCount: 0, deadLetterCount: 0, notificationCount: 0, unreadNotificationCount: operatorId === undefined ? null : 0 };
    const count = (sql: string, ...params: Array<string>): number => Number((this.database.prepare(sql).get(...params) as { count?: number } | undefined)?.count ?? 0);
    const deadLetterCount = this.hasSchedulerTables
      ? count("SELECT COUNT(*) AS count FROM agent_mode_scheduler_events WHERE status = 'dead_letter'") + count("SELECT COUNT(*) AS count FROM agent_mode_scheduler_schedules WHERE status = 'dead_letter'")
      : 0;
    const summary = {
      openEscalationCount: count("SELECT COUNT(*) AS count FROM agent_mode_escalations WHERE status = 'open'"),
      pendingReviewCount: this.hasPromotionTables ? count("SELECT COUNT(*) AS count FROM agent_mode_review_requests WHERE status = 'pending'") : 0,
      uncertainItemCount: count("SELECT COUNT(*) AS count FROM attempts WHERE status = 'uncertain'"),
      deadLetterCount,
      notificationCount: count('SELECT COUNT(*) AS count FROM agent_mode_notifications'),
      unreadNotificationCount: null as number | null,
    };
    if (operatorId !== undefined) {
      if (operatorId.length === 0 || operatorId.length > 128) throw new Error('operator identity is invalid');
      summary.unreadNotificationCount = count('SELECT COUNT(*) AS count FROM agent_mode_notifications n WHERE NOT EXISTS (SELECT 1 FROM agent_mode_notification_reads r WHERE r.notification_id = n.notification_id AND r.operator_id = ?)', operatorId);
    }
    return summary;
  }

  markAgentModeNotificationRead(input: { notificationId: string; operatorId: string; readAt: string }): { result: 'created' | 'duplicate' | 'denied'; readAt?: string; reasonCode?: string } {
    if (this.readOnly || !this.hasAttentionTables) return { result: 'denied', reasonCode: 'ATTENTION_PERSISTENCE_UNAVAILABLE' };
    if (!input.notificationId || input.notificationId.length > 256 || !input.operatorId || input.operatorId.length > 128 || !Number.isFinite(Date.parse(input.readAt))) return { result: 'denied', reasonCode: 'INVALID_NOTIFICATION_READ' };
    return this.withTransaction(() => {
      if (!this.database.prepare('SELECT 1 FROM agent_mode_notifications WHERE notification_id = ?').get(input.notificationId)) return { result: 'denied' as const, reasonCode: 'NOTIFICATION_NOT_FOUND' };
      const existing = this.database.prepare('SELECT read_at FROM agent_mode_notification_reads WHERE notification_id = ? AND operator_id = ?').get(input.notificationId, input.operatorId) as { read_at?: string } | undefined;
      if (existing) return { result: 'duplicate' as const, readAt: String(existing.read_at) };
      this.database.prepare('INSERT INTO agent_mode_notification_reads (notification_id, operator_id, read_at) VALUES (?, ?, ?)').run(input.notificationId, input.operatorId, input.readAt);
      return { result: 'created' as const, readAt: input.readAt };
    });
  }

  close(): void {
    this.database.close();
  }
}
