import { createHash } from 'node:crypto';
import type { AgentModeSqliteStateStore, AgentModeSpawnAdmissionControls } from './sqlite-state-store.js';
import {
  WORKCELL_READ_CAPABILITY,
  WORKCELL_VALIDATION_CAPABILITY,
  WORKCELL_WRITE_CAPABILITY,
} from './workcell.js';
// Keep policy manifests dependency-free from the event adapter implementation.
// These canonical strings are the stable K4.1 envelope values, not executable
// or model-authored routing inputs.
const CI_WORKFLOW_COMPLETED_EVENT = 'ci.workflow.completed' as const;
const CI_WORKFLOW_STARTED_EVENT = 'ci.workflow.started' as const;
const CI_WORKFLOW_RUN_SOURCE = 'ci.workflow-run' as const;
const GIT_REPOSITORY_REVISION_SOURCE = 'git.repository.revision' as const;
const REPOSITORY_COMMIT_OBSERVED_EVENT = 'repository.commit.observed' as const;
const BRAIN_TASK_LIFECYCLE_SOURCE = 'brain.task.lifecycle' as const;
const TASK_LIFECYCLE_OBSERVED_EVENT = 'task.lifecycle.observed' as const;

export const SPAWN_REQUEST_SCHEMA_VERSION = 1 as const;
export const SPAWN_POLICY_SCHEMA_VERSION = 1 as const;
export const ROLE_TEMPLATE_SCHEMA_VERSION = 1 as const;

export const SPAWN_ROLE_READ_ONLY = 'agent-mode.role.read-only.v1' as const;
export const SPAWN_ROLE_SAFE_ENGINEERING = 'agent-mode.role.safe-engineering.v1' as const;
export const SPAWN_POLICY_READ_ONLY = 'agent-mode.policy.read-only.v1' as const;
export const SPAWN_POLICY_SAFE_ENGINEERING = 'agent-mode.policy.safe-engineering.v1' as const;

export const KNOWN_SPAWN_CAPABILITIES = Object.freeze([
  WORKCELL_READ_CAPABILITY,
  WORKCELL_WRITE_CAPABILITY,
  WORKCELL_VALIDATION_CAPABILITY,
] as const);

export type SpawnCapabilityId = typeof KNOWN_SPAWN_CAPABILITIES[number];
export type SpawnScope = { repositoryRef: string | null; resourceRef: string | null };
export type SpawnScopeRules = { allowed: readonly string[]; requireEventMatch: boolean };

export type AgentSpawnPolicy = {
  schemaVersion: typeof SPAWN_POLICY_SCHEMA_VERSION;
  policyId: string;
  version: number;
  enabled: boolean;
  allowedSourceTypes: readonly string[];
  allowedEventTypes: readonly string[];
  allowedRoleTemplateIds: readonly string[];
  maxSpawnDepth: number;
  maxConcurrentChildren: number;
  maxTotalChildCreations: number;
  maxChildTtl: number;
  maxChildSteps: number;
  maxChildBudget: number;
  capabilityCeiling: readonly SpawnCapabilityId[];
  repositoryScopeRules: SpawnScopeRules;
  resourceScopeRules: SpawnScopeRules;
  rootBudgetRules: { requireRemainingFacts: boolean; maxAggregateChildSteps: number; maxAggregateChildBudget: number };
  deadlineRules: { requireDeadline: boolean; maxTtl: number };
};

export type AgentRoleTemplate = {
  schemaVersion: typeof ROLE_TEMPLATE_SCHEMA_VERSION;
  roleTemplateId: string;
  version: number;
  displayName: string;
  capabilities: readonly SpawnCapabilityId[];
  maxTtl: number;
  maxSteps: number;
  maxBudget: number;
  maxSpawnDepth: number;
  allowsChildSpawning: boolean;
  repositoryScope: 'none' | 'requested';
  resourceScope: 'none' | 'requested';
};

export type SpawnRequest = {
  schemaVersion: typeof SPAWN_REQUEST_SCHEMA_VERSION;
  requestId: string;
  policyId: string;
  policyVersion: number;
  roleTemplateId: string;
  roleTemplateVersion: number;
  sourceId: string;
  sourceEventId: string;
  sourceType: string;
  eventType: string;
  eventRootGoalId: string | null;
  eventScope: SpawnScope;
  parentAgentId: string | null;
  parentTaskId: string | null;
  parentRunId: string | null;
  rootGoalId: string | null;
  requestedScope: SpawnScope;
  requestedCapabilities: readonly string[];
  requestedTtl: number;
  requestedStepBudget: number;
  requestedCostBudget: number;
  requestedAt: string;
  deadline: string;
  requestedDepth: number;
};

export type SpawnAuthorityFacts = {
  now: string;
  globalKillSwitchDenied: boolean;
  rootKillSwitchDenied: boolean;
  authority: {
    killSwitch: boolean;
    rootLookup: boolean;
    parentLookup: boolean;
    cancellation: boolean;
    budget: boolean;
  };
  root: {
    rootGoalId: string;
    depth: number;
    activeChildren: number;
    totalChildCreations: number;
    cancellation: 'active' | 'requested' | 'cancelled';
    remainingSteps: number;
    remainingBudget: number;
    deadline: string;
    delegableCapabilities: readonly string[];
    repositoryScopes: readonly string[];
    resourceScopes: readonly string[];
  } | null;
  parent: {
    agentId: string;
    taskId: string;
    runId: string;
    rootGoalId: string;
    depth: number;
    cancellation: 'active' | 'requested' | 'cancelled';
    delegableCapabilities: readonly string[];
    repositoryScopes: readonly string[];
    resourceScopes: readonly string[];
  } | null;
};

export type SpawnDecisionReasonCode =
  | 'ALLOWED'
  | 'POLICY_NOT_FOUND'
  | 'POLICY_DISABLED'
  | 'SOURCE_NOT_ALLOWED'
  | 'EVENT_NOT_ALLOWED'
  | 'ROLE_NOT_ALLOWED'
  | 'ROOT_GOAL_REQUIRED'
  | 'ROOT_MISMATCH'
  | 'PARENT_INVALID'
  | 'CANCELLED'
  | 'GLOBAL_KILL_SWITCH'
  | 'ROOT_KILL_SWITCH'
  | 'CAPABILITY_EXCEEDED'
  | 'SCOPE_EXCEEDED'
  | 'TTL_EXCEEDED'
  | 'SPAWN_DEPTH_EXCEEDED'
  | 'CONCURRENCY_EXCEEDED'
  | 'TOTAL_CREATIONS_EXCEEDED'
  | 'BUDGET_EXCEEDED'
  | 'STEP_BUDGET_EXCEEDED'
  | 'DEADLINE_EXPIRED'
  | 'AUTHORITY_UNAVAILABLE'
  | 'INVALID_REQUEST';

export type SpawnDecision = {
  result: 'ALLOW' | 'DENY';
  reasonCode: SpawnDecisionReasonCode;
  spawnIntentKey: string | null;
  policyId: string | null;
  policyVersion: number | null;
  roleTemplateId: string | null;
  roleTemplateVersion: number | null;
  creationMaterialHash: string | null;
  evaluatedAt: string;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_SCOPE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const DENY: SpawnDecision['result'] = 'DENY';

export const AGENT_MODE_ROLE_TEMPLATES: readonly AgentRoleTemplate[] = Object.freeze([
  {
    schemaVersion: ROLE_TEMPLATE_SCHEMA_VERSION,
    roleTemplateId: SPAWN_ROLE_READ_ONLY,
    version: 1,
    displayName: 'Read-only worker',
    capabilities: [WORKCELL_READ_CAPABILITY],
    maxTtl: 15 * 60 * 1000,
    maxSteps: 100,
    maxBudget: 0.25,
    maxSpawnDepth: 1,
    allowsChildSpawning: false,
    repositoryScope: 'requested',
    resourceScope: 'none',
  },
  {
    schemaVersion: ROLE_TEMPLATE_SCHEMA_VERSION,
    roleTemplateId: SPAWN_ROLE_SAFE_ENGINEERING,
    version: 1,
    displayName: 'Safe engineering worker',
    capabilities: [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY],
    maxTtl: 30 * 60 * 1000,
    maxSteps: 300,
    maxBudget: 1,
    maxSpawnDepth: 1,
    allowsChildSpawning: false,
    repositoryScope: 'requested',
    resourceScope: 'requested',
  },
]);

export const AGENT_MODE_SPAWN_POLICIES: readonly AgentSpawnPolicy[] = Object.freeze([
  {
    schemaVersion: SPAWN_POLICY_SCHEMA_VERSION,
    policyId: SPAWN_POLICY_READ_ONLY,
    version: 1,
    enabled: true,
    allowedSourceTypes: [GIT_REPOSITORY_REVISION_SOURCE, BRAIN_TASK_LIFECYCLE_SOURCE, CI_WORKFLOW_RUN_SOURCE],
    allowedEventTypes: [REPOSITORY_COMMIT_OBSERVED_EVENT, TASK_LIFECYCLE_OBSERVED_EVENT, CI_WORKFLOW_STARTED_EVENT, CI_WORKFLOW_COMPLETED_EVENT],
    allowedRoleTemplateIds: [SPAWN_ROLE_READ_ONLY],
    maxSpawnDepth: 1,
    maxConcurrentChildren: 4,
    maxTotalChildCreations: 16,
    maxChildTtl: 15 * 60 * 1000,
    maxChildSteps: 100,
    maxChildBudget: 0.25,
    capabilityCeiling: [WORKCELL_READ_CAPABILITY],
    repositoryScopeRules: { allowed: ['brain'], requireEventMatch: true },
    resourceScopeRules: { allowed: [], requireEventMatch: true },
    rootBudgetRules: { requireRemainingFacts: true, maxAggregateChildSteps: 1000, maxAggregateChildBudget: 2 },
    deadlineRules: { requireDeadline: true, maxTtl: 15 * 60 * 1000 },
  },
  {
    schemaVersion: SPAWN_POLICY_SCHEMA_VERSION,
    policyId: SPAWN_POLICY_SAFE_ENGINEERING,
    version: 1,
    enabled: true,
    allowedSourceTypes: [GIT_REPOSITORY_REVISION_SOURCE, CI_WORKFLOW_RUN_SOURCE],
    allowedEventTypes: [REPOSITORY_COMMIT_OBSERVED_EVENT, CI_WORKFLOW_COMPLETED_EVENT],
    allowedRoleTemplateIds: [SPAWN_ROLE_SAFE_ENGINEERING],
    maxSpawnDepth: 1,
    maxConcurrentChildren: 2,
    maxTotalChildCreations: 8,
    maxChildTtl: 30 * 60 * 1000,
    maxChildSteps: 300,
    maxChildBudget: 1,
    capabilityCeiling: [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY],
    repositoryScopeRules: { allowed: ['brain'], requireEventMatch: true },
    resourceScopeRules: { allowed: ['workcell'], requireEventMatch: true },
    rootBudgetRules: { requireRemainingFacts: true, maxAggregateChildSteps: 1200, maxAggregateChildBudget: 4 },
    deadlineRules: { requireDeadline: true, maxTtl: 30 * 60 * 1000 },
  },
  {
    schemaVersion: SPAWN_POLICY_SCHEMA_VERSION,
    policyId: 'agent-mode.policy.disabled-fixture.v1',
    version: 1,
    enabled: false,
    allowedSourceTypes: [GIT_REPOSITORY_REVISION_SOURCE],
    allowedEventTypes: [REPOSITORY_COMMIT_OBSERVED_EVENT],
    allowedRoleTemplateIds: [SPAWN_ROLE_READ_ONLY],
    maxSpawnDepth: 1,
    maxConcurrentChildren: 1,
    maxTotalChildCreations: 1,
    maxChildTtl: 60 * 1000,
    maxChildSteps: 1,
    maxChildBudget: 0.01,
    capabilityCeiling: [WORKCELL_READ_CAPABILITY],
    repositoryScopeRules: { allowed: ['brain'], requireEventMatch: true },
    resourceScopeRules: { allowed: [], requireEventMatch: true },
    rootBudgetRules: { requireRemainingFacts: true, maxAggregateChildSteps: 1, maxAggregateChildBudget: 0.01 },
    deadlineRules: { requireDeadline: true, maxTtl: 60 * 1000 },
  },
]);

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length; }
function finitePositive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function finiteLimit(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function validId(value: unknown): value is string { return typeof value === 'string' && SAFE_ID.test(value); }
function validScope(value: unknown): value is string { return typeof value === 'string' && SAFE_SCOPE.test(value) && !value.includes('..') && !value.includes('://'); }
function validTimestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function subset(values: readonly string[], ceiling: readonly string[]): boolean { return values.every((value) => ceiling.includes(value)); }

export function validateRoleTemplateManifest(templates: readonly AgentRoleTemplate[] = AGENT_MODE_ROLE_TEMPLATES): void {
  const ids = templates.map((template) => template.roleTemplateId);
  if (!unique(ids)) throw new Error('role template IDs must be unique');
  for (const template of templates) {
    if (template.schemaVersion !== ROLE_TEMPLATE_SCHEMA_VERSION || !validId(template.roleTemplateId) || !Number.isSafeInteger(template.version) || template.version < 1) throw new Error('invalid role template identity or schema');
    if (!template.displayName || template.displayName.length > 128 || !unique(template.capabilities) || !subset(template.capabilities, KNOWN_SPAWN_CAPABILITIES)) throw new Error('invalid role template capabilities');
    if (!finitePositive(template.maxTtl) || !finiteLimit(template.maxSteps) || !Number.isFinite(template.maxBudget) || template.maxBudget < 0 || !finiteLimit(template.maxSpawnDepth) || template.repositoryScope === 'none' && template.resourceScope === 'none' && template.capabilities.includes(WORKCELL_WRITE_CAPABILITY)) throw new Error('invalid role template limits or scope');
  }
}

export function validateSpawnPolicyManifest(policies: readonly AgentSpawnPolicy[] = AGENT_MODE_SPAWN_POLICIES, templates: readonly AgentRoleTemplate[] = AGENT_MODE_ROLE_TEMPLATES): void {
  validateRoleTemplateManifest(templates);
  const keys = policies.map((policy) => `${policy.policyId}@${policy.version}`);
  if (!unique(keys)) throw new Error('spawn policy IDs and versions must be unique');
  const templateIds = new Set(templates.map((template) => template.roleTemplateId));
  for (const policy of policies) {
    if (policy.schemaVersion !== SPAWN_POLICY_SCHEMA_VERSION || !validId(policy.policyId) || !Number.isSafeInteger(policy.version) || policy.version < 1) throw new Error('invalid spawn policy identity or schema');
    if (!unique(policy.allowedSourceTypes) || !unique(policy.allowedEventTypes) || !unique(policy.allowedRoleTemplateIds) || policy.allowedSourceTypes.some((value) => !validId(value) || value === '*') || policy.allowedEventTypes.some((value) => !validId(value) || value === '*') || policy.allowedRoleTemplateIds.some((value) => !templateIds.has(value))) throw new Error('invalid spawn policy allowlist');
    if (!finiteLimit(policy.maxSpawnDepth) || !finiteLimit(policy.maxConcurrentChildren) || !finiteLimit(policy.maxTotalChildCreations) || !finitePositive(policy.maxChildTtl) || !finiteLimit(policy.maxChildSteps) || !Number.isFinite(policy.maxChildBudget) || policy.maxChildBudget < 0 || !unique(policy.capabilityCeiling) || !subset(policy.capabilityCeiling, KNOWN_SPAWN_CAPABILITIES)) throw new Error('invalid spawn policy limits or capabilities');
    for (const rules of [policy.repositoryScopeRules, policy.resourceScopeRules]) if (!unique(rules.allowed) || rules.allowed.some((value) => !validScope(value))) throw new Error('invalid spawn policy scope rule');
    if (!rulesBoolean(policy.rootBudgetRules.requireRemainingFacts) || !finiteLimit(policy.rootBudgetRules.maxAggregateChildSteps) || !Number.isFinite(policy.rootBudgetRules.maxAggregateChildBudget) || policy.rootBudgetRules.maxAggregateChildBudget < 0 || !rulesBoolean(policy.deadlineRules.requireDeadline) || !finitePositive(policy.deadlineRules.maxTtl)) throw new Error('invalid spawn policy aggregate or deadline rule');
    if (policy.deadlineRules.maxTtl > policy.maxChildTtl) throw new Error('deadline rule cannot widen child TTL');
  }
}

function rulesBoolean(value: boolean): boolean { return typeof value === 'boolean'; }

export function getRoleTemplate(roleTemplateId: string, version: number, templates: readonly AgentRoleTemplate[] = AGENT_MODE_ROLE_TEMPLATES): AgentRoleTemplate | undefined {
  return templates.find((template) => template.roleTemplateId === roleTemplateId && template.version === version);
}

export function getSpawnPolicy(policyId: string, version: number, policies: readonly AgentSpawnPolicy[] = AGENT_MODE_SPAWN_POLICIES): AgentSpawnPolicy | undefined {
  return policies.find((policy) => policy.policyId === policyId && policy.version === version);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function spawnIntentKey(request: SpawnRequest): string {
  const input = {
    sourceEventId: request.sourceEventId,
    policyId: request.policyId,
    policyVersion: request.policyVersion,
    roleTemplateId: request.roleTemplateId,
    roleTemplateVersion: request.roleTemplateVersion,
    sourceId: request.sourceId,
    parentAgentId: request.parentAgentId,
    parentTaskId: request.parentTaskId,
    parentRunId: request.parentRunId,
    rootGoalId: request.rootGoalId,
    requestedScope: request.requestedScope,
  };
  return `spawn-intent:sha256:${createHash('sha256').update(canonical(input)).digest('hex')}`;
}

export function spawnCreationMaterialHash(request: SpawnRequest): string {
  const input = {
    rootGoalId: request.rootGoalId,
    parentAgentId: request.parentAgentId,
    parentTaskId: request.parentTaskId,
    parentRunId: request.parentRunId,
    roleTemplateId: request.roleTemplateId,
    roleTemplateVersion: request.roleTemplateVersion,
    policyId: request.policyId,
    policyVersion: request.policyVersion,
    sourceEventId: request.sourceEventId,
    sourceId: request.sourceId,
    requestedScope: request.requestedScope,
    requestedCapabilities: [...request.requestedCapabilities].sort(),
    requestedTtl: request.requestedTtl,
    requestedStepBudget: request.requestedStepBudget,
    requestedCostBudget: request.requestedCostBudget,
    deadline: request.deadline,
    requestedDepth: request.requestedDepth,
  };
  return createHash('sha256').update(canonical(input)).digest('hex');
}

function deny(reasonCode: SpawnDecisionReasonCode, request: Partial<SpawnRequest>, evaluatedAt: string, intent: string | null = null): SpawnDecision {
  return { result: DENY, reasonCode, spawnIntentKey: intent, policyId: request.policyId ?? null, policyVersion: request.policyVersion ?? null, roleTemplateId: request.roleTemplateId ?? null, roleTemplateVersion: request.roleTemplateVersion ?? null, creationMaterialHash: null, evaluatedAt };
}

function requestValid(request: SpawnRequest): boolean {
  return request.schemaVersion === SPAWN_REQUEST_SCHEMA_VERSION
    && [request.requestId, request.policyId, request.roleTemplateId, request.sourceId, request.sourceEventId, request.sourceType, request.eventType].every(validId)
    && Number.isSafeInteger(request.policyVersion) && request.policyVersion > 0
    && Number.isSafeInteger(request.roleTemplateVersion) && request.roleTemplateVersion > 0
    && (request.eventRootGoalId === null || validId(request.eventRootGoalId))
    && [request.parentAgentId, request.parentTaskId, request.parentRunId, request.rootGoalId].every((value) => value === null || validId(value))
    && [request.eventScope.repositoryRef, request.eventScope.resourceRef, request.requestedScope.repositoryRef, request.requestedScope.resourceRef].every((value) => value === null || validScope(value))
    && unique(request.requestedCapabilities) && request.requestedCapabilities.every((value) => validId(value) || KNOWN_SPAWN_CAPABILITIES.includes(value as SpawnCapabilityId))
    && finitePositive(request.requestedTtl) && finiteLimit(request.requestedStepBudget) && Number.isFinite(request.requestedCostBudget) && request.requestedCostBudget >= 0
    && validTimestamp(request.requestedAt) && validTimestamp(request.deadline) && Number.isSafeInteger(request.requestedDepth) && request.requestedDepth >= 0;
}

function scopeAllowed(requested: string | null, allowed: readonly string[], roleAllows: boolean, eventScope: string | null, parentScopes: readonly string[], requireEventMatch: boolean): boolean {
  if (requested === null) return true;
  if (!roleAllows || !allowed.includes(requested)) return false;
  if (requireEventMatch && eventScope === null) return false;
  if (requireEventMatch && requested !== eventScope) return false;
  return parentScopes.includes(requested);
}

export function evaluateSpawnAdmission(
  request: SpawnRequest,
  facts: SpawnAuthorityFacts,
  registries: { policies?: readonly AgentSpawnPolicy[]; templates?: readonly AgentRoleTemplate[] } = {},
): SpawnDecision {
  const policies = registries.policies ?? AGENT_MODE_SPAWN_POLICIES;
  const templates = registries.templates ?? AGENT_MODE_ROLE_TEMPLATES;
  if (!requestValid(request) || !validTimestamp(facts.now)) return deny('INVALID_REQUEST', request, validTimestamp(facts.now) ? facts.now : new Date(0).toISOString());
  if (Date.parse(request.requestedAt) > Date.parse(facts.now)) return deny('INVALID_REQUEST', request, facts.now);
  const intent = spawnIntentKey(request);
  if (!facts.authority.killSwitch || !facts.authority.rootLookup || !facts.authority.parentLookup || !facts.authority.cancellation || !facts.authority.budget) return deny('AUTHORITY_UNAVAILABLE', request, facts.now, intent);
  if (facts.globalKillSwitchDenied) return deny('GLOBAL_KILL_SWITCH', request, facts.now, intent);
  if (request.rootGoalId === null) return deny('ROOT_GOAL_REQUIRED', request, facts.now, intent);
  if (request.eventRootGoalId !== null && request.eventRootGoalId !== request.rootGoalId) return deny('ROOT_MISMATCH', request, facts.now, intent);
  if (!facts.root || facts.root.rootGoalId !== request.rootGoalId) return deny('ROOT_MISMATCH', request, facts.now, intent);
  if (facts.rootKillSwitchDenied) return deny('ROOT_KILL_SWITCH', request, facts.now, intent);
  if (facts.root.cancellation !== 'active' || (facts.parent && facts.parent.cancellation !== 'active')) return deny('CANCELLED', request, facts.now, intent);
  if (Date.parse(request.deadline) <= Date.parse(facts.now) || Date.parse(facts.root.deadline) <= Date.parse(facts.now)) return deny('DEADLINE_EXPIRED', request, facts.now, intent);
  const policy = getSpawnPolicy(request.policyId, request.policyVersion, policies);
  if (!policy) return deny('POLICY_NOT_FOUND', request, facts.now, intent);
  if (!policy.enabled) return deny('POLICY_DISABLED', request, facts.now, intent);
  if (!policy.allowedSourceTypes.includes(request.sourceType)) return deny('SOURCE_NOT_ALLOWED', request, facts.now, intent);
  if (!policy.allowedEventTypes.includes(request.eventType)) return deny('EVENT_NOT_ALLOWED', request, facts.now, intent);
  if (!policy.allowedRoleTemplateIds.includes(request.roleTemplateId)) return deny('ROLE_NOT_ALLOWED', request, facts.now, intent);
  const template = getRoleTemplate(request.roleTemplateId, request.roleTemplateVersion, templates);
  if (!template) return deny('ROLE_NOT_ALLOWED', request, facts.now, intent);
  if (request.parentAgentId !== null || request.parentTaskId !== null || request.parentRunId !== null) {
    if (!facts.parent || facts.parent.agentId !== request.parentAgentId || facts.parent.taskId !== request.parentTaskId || facts.parent.runId !== request.parentRunId || facts.parent.rootGoalId !== request.rootGoalId) return deny('PARENT_INVALID', request, facts.now, intent);
  }
  const delegable = facts.parent?.delegableCapabilities ?? facts.root.delegableCapabilities;
  if (!subset(request.requestedCapabilities, template.capabilities) || !subset(request.requestedCapabilities, policy.capabilityCeiling) || !subset(request.requestedCapabilities, delegable) || request.requestedCapabilities.some((capability) => !KNOWN_SPAWN_CAPABILITIES.includes(capability as SpawnCapabilityId))) return deny('CAPABILITY_EXCEEDED', request, facts.now, intent);
  const parentRepositoryScopes = facts.parent?.repositoryScopes ?? facts.root.repositoryScopes;
  const parentResourceScopes = facts.parent?.resourceScopes ?? facts.root.resourceScopes;
  if (!scopeAllowed(request.requestedScope.repositoryRef, policy.repositoryScopeRules.allowed, template.repositoryScope === 'requested', request.eventScope.repositoryRef, parentRepositoryScopes, policy.repositoryScopeRules.requireEventMatch)
    || !scopeAllowed(request.requestedScope.resourceRef, policy.resourceScopeRules.allowed, template.resourceScope === 'requested', request.eventScope.resourceRef, parentResourceScopes, policy.resourceScopeRules.requireEventMatch)
    || request.requestedCapabilities.includes(WORKCELL_WRITE_CAPABILITY) && request.requestedScope.repositoryRef === null) return deny('SCOPE_EXCEEDED', request, facts.now, intent);
  if (request.requestedTtl > Math.min(template.maxTtl, policy.maxChildTtl, policy.deadlineRules.maxTtl, template.maxTtl) || request.requestedTtl > Date.parse(request.deadline) - Date.parse(request.requestedAt) || request.requestedTtl > Date.parse(facts.root.deadline) - Date.parse(request.requestedAt)) return deny('TTL_EXCEEDED', request, facts.now, intent);
  const expectedDepth = (facts.parent?.depth ?? facts.root.depth) + 1;
  if (request.requestedDepth !== expectedDepth || request.requestedDepth > Math.min(policy.maxSpawnDepth, template.maxSpawnDepth)) return deny('SPAWN_DEPTH_EXCEEDED', request, facts.now, intent);
  if (facts.root.activeChildren >= policy.maxConcurrentChildren) return deny('CONCURRENCY_EXCEEDED', request, facts.now, intent);
  if (facts.root.totalChildCreations >= policy.maxTotalChildCreations) return deny('TOTAL_CREATIONS_EXCEEDED', request, facts.now, intent);
  if (request.requestedStepBudget > Math.min(template.maxSteps, policy.maxChildSteps, facts.root.remainingSteps, policy.rootBudgetRules.maxAggregateChildSteps) || request.requestedCostBudget > Math.min(template.maxBudget, policy.maxChildBudget, facts.root.remainingBudget, policy.rootBudgetRules.maxAggregateChildBudget)) return deny(request.requestedStepBudget > Math.min(template.maxSteps, policy.maxChildSteps, facts.root.remainingSteps, policy.rootBudgetRules.maxAggregateChildSteps) ? 'STEP_BUDGET_EXCEEDED' : 'BUDGET_EXCEEDED', request, facts.now, intent);
  return { result: 'ALLOW', reasonCode: 'ALLOWED', spawnIntentKey: intent, policyId: policy.policyId, policyVersion: policy.version, roleTemplateId: template.roleTemplateId, roleTemplateVersion: template.version, creationMaterialHash: spawnCreationMaterialHash(request), evaluatedAt: facts.now };
}

export function evaluateSpawnAdmissionWithDurableControls(
  store: AgentModeSqliteStateStore,
  request: SpawnRequest,
  facts: SpawnAuthorityFacts,
  registries: { policies?: readonly AgentSpawnPolicy[]; templates?: readonly AgentRoleTemplate[] } = {},
): SpawnDecision {
  try {
    const controls: AgentModeSpawnAdmissionControls = store.getSpawnAdmissionControls(request.rootGoalId);
    return evaluateSpawnAdmission(request, { ...facts, globalKillSwitchDenied: controls.global.denied, rootKillSwitchDenied: controls.root?.denied ?? false }, registries);
  } catch {
    return deny('AUTHORITY_UNAVAILABLE', request, validTimestamp(facts.now) ? facts.now : new Date(0).toISOString(), requestValid(request) ? spawnIntentKey(request) : null);
  }
}

validateSpawnPolicyManifest();
