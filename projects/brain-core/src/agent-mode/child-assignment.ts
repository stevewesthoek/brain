import { createHash } from 'node:crypto';

export const CHILD_ASSIGNMENT_SCHEMA_VERSION = 1 as const;
export const MOCK_AGENT_RUNTIME_REF = 'runtime:mock-k0-4' as const;
export const MOCK_AGENT_RUNTIME_PROFILE_REF = 'runtime-profile:mock-k0-4' as const;
export const RESTRICTED_HARNESS_RUNTIME_REF = 'runtime:deepseek-harness:c389f96bf3a9b6807cb71ed6bdad5849be0df6d8' as const;
export const RESTRICTED_HARNESS_PROFILE_REF = 'brain-agent-mode-restricted' as const;
export const DEFERRED_ROUTE_REF = 'route:deferred' as const;
export const DEFERRED_MODEL_REF = 'model:deferred' as const;

export type AgentModeChildAssignmentRequest = {
  schemaVersion: typeof CHILD_ASSIGNMENT_SCHEMA_VERSION;
  assignmentId: string;
  childAgentId: string;
  rootGoalId: string;
  taskSpecRef: string;
  sourceEventId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  requestedSteps: number;
  requestedCostCeiling: number;
  requestedCapabilities: readonly string[];
  repositoryScope: string | null;
  resourceScope: string | null;
  deadline: string;
  requestedAt: string;
};

export type AgentModeRuntimeProfile = {
  runtimeRef: string;
  runtimeProfileRef: string;
  allowedRoleTemplateIds: readonly string[];
  allowedCapabilities: readonly string[];
  restrictedHarness: boolean;
};

export type AgentModeChildAssignmentStatus = 'dispatch_ready' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'uncertain';

export type AgentModeChildAssignment = {
  assignmentIntentKey: string;
  assignmentId: string;
  childAgentId: string;
  rootGoalId: string;
  sourceEventId: string;
  taskSpecRef: string;
  taskId: string;
  runId: string;
  attemptId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  roleTemplateId: string;
  roleTemplateVersion: number;
  policyId: string;
  policyVersion: number;
  capabilitySetHash: string;
  capabilities: readonly string[];
  repositoryScope: string | null;
  resourceScope: string | null;
  requestedSteps: number;
  requestedCost: number;
  budgetScopeId: string;
  reservationId: string;
  deadline: string;
  status: AgentModeChildAssignmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentModeChildAssignmentReceipt = {
  assignmentIntentKey: string;
  assignmentId: string;
  childAgentId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  rootGoalId: string;
  sourceEventId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  stepCeiling: number;
  costCeiling: number;
  budgetScopeId: string;
  reservationId: string;
  createdAt: string;
  deadline: string;
  status: 'dispatch_ready';
};

export type AgentModePreparedChildDispatch = {
  assignmentIntentKey: string;
  childAgentId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  roleTemplateId: string;
  roleTemplateVersion: number;
  policyId: string;
  policyVersion: number;
  capabilitySetHash: string;
  capabilities: readonly string[];
  repositoryScope: string | null;
  resourceScope: string | null;
  rootGoalId: string;
  sourceEventId: string;
  stepCeiling: number;
  costCeiling: number;
  remainingSteps: number;
  remainingCost: number;
  deadline: string;
  status: 'dispatch_ready';
};

export type AgentModeChildAssignmentResult =
  | { result: 'assigned' | 'duplicate'; receipt: AgentModeChildAssignmentReceipt; dispatch: AgentModePreparedChildDispatch | null }
  | { result: 'denied' | 'conflict'; reasonCode: string };

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
// Keep these admission identifiers dependency-free so importing the assignment
// contract cannot participate in the spawn-policy/event-source/StateStore cycle.
const READ_ONLY_ROLE_TEMPLATE = 'agent-mode.role.read-only.v1';
const SAFE_ENGINEERING_ROLE_TEMPLATE = 'agent-mode.role.safe-engineering.v1';
const REPOSITORY_READ_CAPABILITY = 'repo.read';
const KNOWN_CAPABILITIES = [
  REPOSITORY_READ_CAPABILITY,
  'repo.write(workcell)',
  'validation.run(workcell)',
] as const;

export const AGENT_MODE_RUNTIME_PROFILES: readonly AgentModeRuntimeProfile[] = Object.freeze([
  {
    runtimeRef: MOCK_AGENT_RUNTIME_REF,
    runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF,
    allowedRoleTemplateIds: [READ_ONLY_ROLE_TEMPLATE, SAFE_ENGINEERING_ROLE_TEMPLATE],
    allowedCapabilities: [REPOSITORY_READ_CAPABILITY],
    restrictedHarness: false,
  },
  {
    runtimeRef: RESTRICTED_HARNESS_RUNTIME_REF,
    runtimeProfileRef: RESTRICTED_HARNESS_PROFILE_REF,
    allowedRoleTemplateIds: [READ_ONLY_ROLE_TEMPLATE],
    allowedCapabilities: [REPOSITORY_READ_CAPABILITY],
    restrictedHarness: true,
  },
]);

function assignmentMaterial(request: AgentModeChildAssignmentRequest): Record<string, unknown> {
  return {
    schemaVersion: request.schemaVersion,
    childAgentId: request.childAgentId,
    rootGoalId: request.rootGoalId,
    taskSpecRef: request.taskSpecRef,
    sourceEventId: request.sourceEventId,
    runtimeRef: request.runtimeRef,
    runtimeProfileRef: request.runtimeProfileRef,
    requestedSteps: request.requestedSteps,
    requestedCostCeiling: request.requestedCostCeiling,
    requestedCapabilities: [...request.requestedCapabilities].sort(),
    repositoryScope: request.repositoryScope,
    resourceScope: request.resourceScope,
    deadline: request.deadline,
  };
}

export function assignmentMaterialHash(request: AgentModeChildAssignmentRequest): string {
  return createHash('sha256').update(JSON.stringify(assignmentMaterial(request))).digest('hex');
}

export function assignmentIntentKey(request: AgentModeChildAssignmentRequest): string {
  return `assignment-intent:sha256:${assignmentMaterialHash(request)}`;
}

export function taskSpecHash(taskSpecRef: string): string {
  return createHash('sha256').update(taskSpecRef).digest('hex');
}

export function assignmentCapabilityScopeHash(request: AgentModeChildAssignmentRequest): string {
  return createHash('sha256').update(JSON.stringify({
    childAgentId: request.childAgentId,
    rootGoalId: request.rootGoalId,
    requestedCapabilities: [...request.requestedCapabilities].sort(),
    repositoryScope: request.repositoryScope,
    resourceScope: request.resourceScope,
  })).digest('hex');
}

export function getRuntimeProfile(runtimeRef: string, runtimeProfileRef: string): AgentModeRuntimeProfile | undefined {
  return AGENT_MODE_RUNTIME_PROFILES.find((profile) => profile.runtimeRef === runtimeRef && profile.runtimeProfileRef === runtimeProfileRef);
}

export function validateChildAssignmentRequest(request: AgentModeChildAssignmentRequest): boolean {
  return request.schemaVersion === CHILD_ASSIGNMENT_SCHEMA_VERSION
    && SAFE_ID.test(request.assignmentId)
    && SAFE_ID.test(request.childAgentId)
    && SAFE_ID.test(request.rootGoalId)
    && SAFE_REF.test(request.taskSpecRef)
    && SAFE_ID.test(request.sourceEventId)
    && Number.isSafeInteger(request.requestedSteps) && request.requestedSteps >= 0
    && Number.isFinite(request.requestedCostCeiling) && request.requestedCostCeiling >= 0
    && request.requestedCapabilities.length <= 16
    && request.requestedCapabilities.every((capability) => typeof capability === 'string' && KNOWN_CAPABILITIES.includes(capability as typeof KNOWN_CAPABILITIES[number]))
    && (request.repositoryScope === null || SAFE_REF.test(request.repositoryScope))
    && (request.resourceScope === null || SAFE_REF.test(request.resourceScope))
    && Number.isFinite(Date.parse(request.deadline))
    && Number.isFinite(Date.parse(request.requestedAt));
}
