import { createHash } from 'node:crypto';

export const ORGANIZATION_SCHEMA_VERSION = 1 as const;
export const ORGANIZATION_ROLE_MANIFEST_VERSION = 1 as const;
export const ORGANIZATION_PLAN_VERSION = 1 as const;
export const MAX_ORGANIZATION_WORK_ITEMS = 16;
export const MAX_ORGANIZATION_DEPENDENCY_EDGES = 32;
export const MAX_WORK_ITEM_KEY_LENGTH = 128;
export const MAX_TASK_SPEC_REF_LENGTH = 256;
export const MAX_RESULT_EVIDENCE_REFS = 16;
export const MAX_PLAN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_WORK_ITEM_STEPS = 10_000;
export const MAX_WORK_ITEM_TOKENS = 1_000_000;
export const MAX_WORK_ITEM_COST = 100;

export type OrganizationRoleKind = 'supervisor' | 'worker' | 'auditor';

export type OrganizationRoleManifest = {
  schemaVersion: typeof ORGANIZATION_ROLE_MANIFEST_VERSION;
  organizationRoleId: string;
  version: 1;
  displayName: string;
  kind: OrganizationRoleKind;
};

export const ORGANIZATION_ROLE_JARVIS_CEO = 'agent-mode.org-role.jarvis-ceo.v1';
export const ORGANIZATION_ROLE_ENGINEERING = 'agent-mode.org-role.engineering.v1';
export const ORGANIZATION_ROLE_RESEARCH = 'agent-mode.org-role.research.v1';
export const ORGANIZATION_ROLE_OPERATIONS = 'agent-mode.org-role.operations.v1';
export const ORGANIZATION_ROLE_MEMORY_ARCHIVIST = 'agent-mode.org-role.memory-archivist.v1';
export const ORGANIZATION_ROLE_INDEPENDENT_AUDITOR = 'agent-mode.org-role.independent-auditor.v1';

export const ORGANIZATION_ROLE_REGISTRY: readonly OrganizationRoleManifest[] = Object.freeze([
  { schemaVersion: 1, organizationRoleId: ORGANIZATION_ROLE_JARVIS_CEO, version: 1, displayName: 'Jarvis / CEO', kind: 'supervisor' },
  { schemaVersion: 1, organizationRoleId: ORGANIZATION_ROLE_ENGINEERING, version: 1, displayName: 'Engineering', kind: 'worker' },
  { schemaVersion: 1, organizationRoleId: ORGANIZATION_ROLE_RESEARCH, version: 1, displayName: 'Research', kind: 'worker' },
  { schemaVersion: 1, organizationRoleId: ORGANIZATION_ROLE_OPERATIONS, version: 1, displayName: 'Operations', kind: 'worker' },
  { schemaVersion: 1, organizationRoleId: ORGANIZATION_ROLE_MEMORY_ARCHIVIST, version: 1, displayName: 'Memory / Archivist', kind: 'worker' },
  { schemaVersion: 1, organizationRoleId: ORGANIZATION_ROLE_INDEPENDENT_AUDITOR, version: 1, displayName: 'Independent Auditor', kind: 'auditor' },
]);

export type DelegatedResultContract = {
  schemaVersion: typeof ORGANIZATION_SCHEMA_VERSION;
  requiredStatus: 'succeeded' | 'failed' | 'cancelled';
  requireResultRef: boolean;
  minEvidenceRefs: number;
  maxEvidenceRefs: number;
};

export type DelegatedWorkItem = {
  workItemId: string;
  workItemKey: string;
  organizationRoleId: string;
  taskSpecRef: string;
  dependencyKeys: readonly string[];
  requestedTtl: number;
  requestedSteps: number;
  requestedCost: number;
  requestedTokens: number;
  resultContract: DelegatedResultContract;
};

export type OrganizationDependency = {
  workItemKey: string;
  dependsOnWorkItemKey: string;
  type: 'requires_success';
};

export type OrganizationPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';

export type OrganizationPlan = {
  schemaVersion: typeof ORGANIZATION_SCHEMA_VERSION;
  organizationPlanId: string;
  planVersion: 1;
  rootGoalId: string;
  supervisorAgentId: string;
  supervisorOrganizationRoleId: string;
  planKey: string;
  status: OrganizationPlanStatus;
  createdAt: string;
  deadline: string;
  workItems: readonly DelegatedWorkItem[];
  dependencies: readonly OrganizationDependency[];
};

export type OrganizationResultStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type DelegatedResultFact = {
  workItemId: string;
  status: OrganizationResultStatus;
  resultRef?: string;
  evidenceRefs?: readonly string[];
};

export type OrganizationReadinessState = 'ready' | 'blocked' | 'dependency_failed' | 'completed';

export type OrganizationReadiness = {
  organizationPlanId: string;
  planState: 'ready' | 'blocked' | 'expired' | 'cancelled';
  workItems: readonly {
    workItemId: string;
    workItemKey: string;
    state: OrganizationReadinessState;
    dependencyKeys: readonly string[];
  }[];
};

export type OrganizationRootAuthority = {
  exists: boolean;
  cancelled: boolean;
  killed: boolean;
};

export type OrganizationReadinessContext = {
  now: string;
  root: OrganizationRootAuthority;
  resultFacts?: readonly DelegatedResultFact[];
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function invalidText(value: unknown, max: number): boolean {
  return typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function exactKeys(value: object, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} contains unsupported fields`);
}

function registryRole(organizationRoleId: string): OrganizationRoleManifest | undefined {
  return ORGANIZATION_ROLE_REGISTRY.find((role) => role.organizationRoleId === organizationRoleId);
}

export function getOrganizationRole(organizationRoleId: string): OrganizationRoleManifest | undefined {
  return registryRole(organizationRoleId);
}

export function validateOrganizationRoleRegistry(registry: readonly OrganizationRoleManifest[] = ORGANIZATION_ROLE_REGISTRY): void {
  const ids = new Set<string>();
  for (const role of registry) {
    exactKeys(role, ['schemaVersion', 'organizationRoleId', 'version', 'displayName', 'kind'], 'organization role');
    if (role.schemaVersion !== ORGANIZATION_ROLE_MANIFEST_VERSION || role.version !== 1 || !SAFE_ID.test(role.organizationRoleId)
      || invalidText(role.displayName, 128) || !['supervisor', 'worker', 'auditor'].includes(role.kind) || ids.has(role.organizationRoleId)) {
      throw new Error('invalid or duplicate organization role manifest');
    }
    ids.add(role.organizationRoleId);
  }
}

export function deriveOrganizationPlanId(input: Pick<OrganizationPlan, 'rootGoalId' | 'supervisorAgentId' | 'planKey' | 'planVersion'>): string {
  if ([input.rootGoalId, input.supervisorAgentId, input.planKey].some((value) => invalidText(value, 128)) || input.planVersion !== 1) throw new Error('invalid organization plan identity');
  return `agent-mode.organization-plan:${hash({ rootGoalId: input.rootGoalId, supervisorAgentId: input.supervisorAgentId, planKey: input.planKey, planVersion: input.planVersion })}`;
}

export function deriveOrganizationWorkItemId(organizationPlanId: string, workItemKey: string): string {
  if (!SAFE_ID.test(organizationPlanId) || invalidText(workItemKey, MAX_WORK_ITEM_KEY_LENGTH)) throw new Error('invalid organization work item identity');
  return `agent-mode.organization-work-item:${hash({ organizationPlanId, workItemKey })}`;
}

function validateResultContract(contract: DelegatedResultContract): void {
  exactKeys(contract, ['schemaVersion', 'requiredStatus', 'requireResultRef', 'minEvidenceRefs', 'maxEvidenceRefs'], 'result contract');
  if (contract.schemaVersion !== ORGANIZATION_SCHEMA_VERSION || !['succeeded', 'failed', 'cancelled'].includes(contract.requiredStatus)
    || typeof contract.requireResultRef !== 'boolean' || !Number.isSafeInteger(contract.minEvidenceRefs) || !Number.isSafeInteger(contract.maxEvidenceRefs)
    || contract.minEvidenceRefs < 0 || contract.maxEvidenceRefs < contract.minEvidenceRefs || contract.maxEvidenceRefs > MAX_RESULT_EVIDENCE_REFS) {
    throw new Error('invalid delegated result contract');
  }
}

function validateWorkItem(workItem: DelegatedWorkItem, createdAt: string, planDeadline: string): void {
  exactKeys(workItem, ['workItemId', 'workItemKey', 'organizationRoleId', 'taskSpecRef', 'dependencyKeys', 'requestedTtl', 'requestedSteps', 'requestedCost', 'requestedTokens', 'resultContract'], 'delegated work item');
  if (invalidText(workItem.workItemKey, MAX_WORK_ITEM_KEY_LENGTH) || !SAFE_KEY.test(workItem.workItemKey)
    || invalidText(workItem.taskSpecRef, MAX_TASK_SPEC_REF_LENGTH) || !registryRole(workItem.organizationRoleId)
    || workItem.workItemId !== '__derived__' && !SAFE_ID.test(workItem.workItemId)
    || !Array.isArray(workItem.dependencyKeys) || new Set(workItem.dependencyKeys).size !== workItem.dependencyKeys.length
    || workItem.dependencyKeys.some((key) => invalidText(key, MAX_WORK_ITEM_KEY_LENGTH) || !SAFE_KEY.test(key))
    || !Number.isSafeInteger(workItem.requestedTtl) || workItem.requestedTtl <= 0 || workItem.requestedTtl > MAX_PLAN_TTL_MS
    || !Number.isSafeInteger(workItem.requestedSteps) || workItem.requestedSteps <= 0 || workItem.requestedSteps > MAX_WORK_ITEM_STEPS
    || !Number.isSafeInteger(workItem.requestedTokens) || workItem.requestedTokens <= 0 || workItem.requestedTokens > MAX_WORK_ITEM_TOKENS
    || !Number.isFinite(workItem.requestedCost) || workItem.requestedCost <= 0 || workItem.requestedCost > MAX_WORK_ITEM_COST) {
    throw new Error(`invalid delegated work item: ${workItem.workItemKey}`);
  }
  validateResultContract(workItem.resultContract);
  if (Date.parse(createdAt) + workItem.requestedTtl > Date.parse(planDeadline)) throw new Error(`work item TTL exceeds plan deadline: ${workItem.workItemKey}`);
}

export function normalizeOrganizationPlan(plan: OrganizationPlan): OrganizationPlan {
  const workItems = [...plan.workItems].map((item) => ({ ...item, dependencyKeys: [...item.dependencyKeys].sort() })).sort((a, b) => a.workItemKey.localeCompare(b.workItemKey));
  const dependencies = [...plan.dependencies].sort((a, b) => a.workItemKey.localeCompare(b.workItemKey) || a.dependsOnWorkItemKey.localeCompare(b.dependsOnWorkItemKey));
  return { ...plan, workItems, dependencies };
}

export function organizationPlanMaterial(plan: OrganizationPlan): string {
  return hash(normalizeOrganizationPlan({ ...plan, organizationPlanId: deriveOrganizationPlanId(plan) }));
}

export function validateOrganizationPlan(plan: OrganizationPlan, now: string): OrganizationPlan {
  exactKeys(plan, ['schemaVersion', 'organizationPlanId', 'planVersion', 'rootGoalId', 'supervisorAgentId', 'supervisorOrganizationRoleId', 'planKey', 'status', 'createdAt', 'deadline', 'workItems', 'dependencies'], 'organization plan');
  validateOrganizationRoleRegistry();
  if (plan.schemaVersion !== ORGANIZATION_SCHEMA_VERSION || plan.planVersion !== ORGANIZATION_PLAN_VERSION
    || deriveOrganizationPlanId(plan) !== plan.organizationPlanId || invalidText(plan.rootGoalId, 128) || invalidText(plan.supervisorAgentId, 128)
    || !SAFE_ID.test(plan.rootGoalId) || !SAFE_ID.test(plan.supervisorAgentId) || invalidText(plan.planKey, 128)
    || !['draft', 'active', 'completed', 'cancelled', 'expired'].includes(plan.status) || !validTimestamp(plan.createdAt) || !validTimestamp(plan.deadline)
    || !validTimestamp(now) || Date.parse(plan.createdAt) > Date.parse(now) || Date.parse(plan.deadline) <= Date.parse(now)
    || Date.parse(plan.deadline) - Date.parse(plan.createdAt) > MAX_PLAN_TTL_MS || !Array.isArray(plan.workItems) || plan.workItems.length === 0
    || plan.workItems.length > MAX_ORGANIZATION_WORK_ITEMS || !Array.isArray(plan.dependencies) || plan.dependencies.length > MAX_ORGANIZATION_DEPENDENCY_EDGES) {
    throw new Error('invalid organization plan envelope or identity');
  }
  const supervisorRole = registryRole(plan.supervisorOrganizationRoleId);
  if (!supervisorRole || supervisorRole.kind !== 'supervisor' || plan.supervisorOrganizationRoleId !== ORGANIZATION_ROLE_JARVIS_CEO) throw new Error('organization plan supervisor role is not admitted');
  const keys = new Set<string>();
  for (const item of plan.workItems) {
    validateWorkItem(item, plan.createdAt, plan.deadline);
    if (keys.has(item.workItemKey)) throw new Error(`duplicate work item key: ${item.workItemKey}`);
    if (item.workItemId !== deriveOrganizationWorkItemId(plan.organizationPlanId, item.workItemKey)) throw new Error(`work item identity mismatch: ${item.workItemKey}`);
    keys.add(item.workItemKey);
  }
  const edges = new Set<string>();
  for (const dependency of plan.dependencies) {
    exactKeys(dependency, ['workItemKey', 'dependsOnWorkItemKey', 'type'], 'organization dependency');
    const edge = `${dependency.workItemKey}\u0000${dependency.dependsOnWorkItemKey}`;
    if (dependency.type !== 'requires_success' || !keys.has(dependency.workItemKey) || !keys.has(dependency.dependsOnWorkItemKey)) throw new Error('organization dependency references an unknown work item');
    if (dependency.workItemKey === dependency.dependsOnWorkItemKey) throw new Error('organization work item cannot depend on itself');
    if (edges.has(edge)) throw new Error('duplicate organization dependency edge');
    edges.add(edge);
  }
  for (const item of plan.workItems) {
    const declared = new Set(item.dependencyKeys);
    const actual = new Set(plan.dependencies.filter((edge) => edge.workItemKey === item.workItemKey).map((edge) => edge.dependsOnWorkItemKey));
    if (declared.size !== actual.size || [...declared].some((key) => !actual.has(key))) throw new Error(`work item dependency declaration mismatch: ${item.workItemKey}`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): void => {
    if (visiting.has(key)) throw new Error('organization dependency graph contains a cycle');
    if (visited.has(key)) return;
    visiting.add(key);
    for (const edge of plan.dependencies.filter((candidate) => candidate.workItemKey === key)) visit(edge.dependsOnWorkItemKey);
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of keys) visit(key);
  return normalizeOrganizationPlan(plan);
}

export function evaluateOrganizationReadiness(plan: OrganizationPlan, context: OrganizationReadinessContext): OrganizationReadiness {
  const rootBlocked = !context.root.exists || context.root.cancelled || context.root.killed;
  const expired = !validTimestamp(context.now) || Date.parse(context.now) >= Date.parse(plan.deadline);
  const facts = new Map((context.resultFacts ?? []).map((fact) => [fact.workItemId, fact]));
  const successful = (item: DelegatedWorkItem): boolean => {
    const fact = facts.get(item.workItemId);
    if (!fact || fact.status !== item.resultContract.requiredStatus || fact.status !== 'succeeded') return false;
    if (item.resultContract.requireResultRef && (typeof fact.resultRef !== 'string' || invalidText(fact.resultRef, MAX_TASK_SPEC_REF_LENGTH))) return false;
    const evidenceRefs = fact.evidenceRefs ?? [];
    return Array.isArray(evidenceRefs) && evidenceRefs.length >= item.resultContract.minEvidenceRefs && evidenceRefs.length <= item.resultContract.maxEvidenceRefs
      && evidenceRefs.every((ref) => !invalidText(ref, MAX_TASK_SPEC_REF_LENGTH));
  };
  const workItems = plan.workItems.map((item) => {
    const fact = facts.get(item.workItemId);
    if (successful(item)) return { workItemId: item.workItemId, workItemKey: item.workItemKey, state: 'completed' as const, dependencyKeys: item.dependencyKeys };
    if (rootBlocked || expired) return { workItemId: item.workItemId, workItemKey: item.workItemKey, state: 'blocked' as const, dependencyKeys: item.dependencyKeys };
    const predecessors = item.dependencyKeys.map((key) => plan.workItems.find((candidate) => candidate.workItemKey === key));
    if (predecessors.some((predecessor) => !predecessor)) return { workItemId: item.workItemId, workItemKey: item.workItemKey, state: 'blocked' as const, dependencyKeys: item.dependencyKeys };
    if (predecessors.some((predecessor) => facts.get(predecessor!.workItemId)?.status === 'failed' || facts.get(predecessor!.workItemId)?.status === 'cancelled')) return { workItemId: item.workItemId, workItemKey: item.workItemKey, state: 'dependency_failed' as const, dependencyKeys: item.dependencyKeys };
    if (item.dependencyKeys.every((key) => successful(plan.workItems.find((candidate) => candidate.workItemKey === key)!))) return { workItemId: item.workItemId, workItemKey: item.workItemKey, state: 'ready' as const, dependencyKeys: item.dependencyKeys };
    return { workItemId: item.workItemId, workItemKey: item.workItemKey, state: 'blocked' as const, dependencyKeys: item.dependencyKeys };
  });
  return { organizationPlanId: plan.organizationPlanId, planState: rootBlocked ? 'cancelled' : expired ? 'expired' : 'ready', workItems };
}

export function createK5AFixturePlan(input: { rootGoalId: string; supervisorAgentId: string; createdAt: string; deadline: string }): OrganizationPlan {
  const base = {
    schemaVersion: ORGANIZATION_SCHEMA_VERSION,
    planVersion: ORGANIZATION_PLAN_VERSION,
    rootGoalId: input.rootGoalId,
    supervisorAgentId: input.supervisorAgentId,
    supervisorOrganizationRoleId: ORGANIZATION_ROLE_JARVIS_CEO,
    planKey: 'k5-a-fixture',
    status: 'active' as const,
    createdAt: input.createdAt,
    deadline: input.deadline,
  };
  const keys = { research: 'research', engineering: 'engineering', auditor: 'independent-auditor' };
  const make = (workItemKey: string, organizationRoleId: string, taskSpecRef: string, dependencyKeys: readonly string[]): DelegatedWorkItem => ({
    workItemId: deriveOrganizationWorkItemId(deriveOrganizationPlanId(base), workItemKey), workItemKey, organizationRoleId, taskSpecRef, dependencyKeys,
    requestedTtl: 60 * 60 * 1000, requestedSteps: 10, requestedCost: 0.01, requestedTokens: 100,
    resultContract: { schemaVersion: ORGANIZATION_SCHEMA_VERSION, requiredStatus: 'succeeded', requireResultRef: true, minEvidenceRefs: 1, maxEvidenceRefs: 4 },
  });
  const workItems = [make(keys.research, ORGANIZATION_ROLE_RESEARCH, 'task-spec:k5-a-research', []), make(keys.engineering, ORGANIZATION_ROLE_ENGINEERING, 'task-spec:k5-a-engineering', []), make(keys.auditor, ORGANIZATION_ROLE_INDEPENDENT_AUDITOR, 'task-spec:k5-a-audit', [keys.research, keys.engineering])];
  const plan = { ...base, organizationPlanId: deriveOrganizationPlanId(base), workItems, dependencies: [{ workItemKey: keys.auditor, dependsOnWorkItemKey: keys.research, type: 'requires_success' as const }, { workItemKey: keys.auditor, dependsOnWorkItemKey: keys.engineering, type: 'requires_success' as const }] };
  return validateOrganizationPlan(plan, input.createdAt);
}
