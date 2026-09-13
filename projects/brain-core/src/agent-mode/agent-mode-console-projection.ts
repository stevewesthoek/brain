import { defaultAgentModeDatabasePath } from './sqlite-state-store.js';
import { readAgentModeObserver, type AgentModeObserverProjection } from './agent-mode-observer.js';

export const AGENT_MODE_CONSOLE_PROJECTION_VERSION = 'agent-mode-console-v1' as const;

export const AGENT_MODE_CONSOLE_BOUNDS = Object.freeze({
  agents: 100,
  organizations: 50,
  tasks: 100,
  runs: 100,
  attempts: 100,
  failures: 50,
  approvals: 50,
  schedules: 50,
  evidence: 100,
  runtimes: 100,
  budgets: 100,
  modelResources: 100,
  nodeResources: 100,
});

type LifecycleStatus = string;

export type AgentModeConsoleAgent = {
  agentId: string;
  rootGoalId: string | null;
  parentAgentId: string | null;
  organizationRoleId: string | null;
  roleTemplateId: string | null;
  lifecycleStatus: LifecycleStatus;
  depth: number | null;
  childCount: number;
  activeChildCount: number;
  deadline: string | null;
  cancellationState: string | null;
  runtimeRef: string | null;
  modelRef: string | null;
  updatedAt: string | null;
};

export type AgentModeConsoleTask = {
  taskId: string;
  runId: string | null;
  attemptId: string | null;
  agentId: string | null;
  rootGoalId: string | null;
  parentAgentId: string | null;
  status: LifecycleStatus;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  modelRef: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  uncertaintyState: string | null;
  cancellationState: string | null;
};

export type AgentModeConsoleRun = {
  runId: string;
  taskId: string;
  attemptId: string | null;
  agentId: string | null;
  rootGoalId: string | null;
  status: LifecycleStatus;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  modelRef: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  uncertaintyState: string | null;
  cancellationState: string | null;
};

export type AgentModeConsoleAttempt = {
  attemptId: string;
  runId: string;
  agentId: string;
  rootGoalId: string | null;
  status: LifecycleStatus;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  modelRef: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  uncertaintyState: string | null;
  cancellationState: string | null;
};

export type AgentModeConsoleOrganizationWorkItem = {
  workItemId: string;
  workItemKey: string;
  organizationRoleId: string;
  dependencyCount: number;
  readiness: string;
  delegationState: string;
  childAgentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  terminalStatus: string | null;
  resultRef: string | null;
  evidenceRefCount: number;
  settledCost: number;
};

export type AgentModeConsoleOrganization = {
  organizationPlanId: string;
  rootGoalId: string;
  supervisorAgentId: string;
  supervisorOrganizationRoleId: string;
  status: string;
  workItemCount: number;
  dependencyCount: number;
  readyCount: number;
  runningCount: number;
  succeededCount: number;
  failedCount: number;
  uncertainCount: number;
  auditorStatus: string | null;
  finalResultId: string | null;
  finalStatus: string | null;
  aggregateCost: number;
  updatedAt: string | null;
  workItems: AgentModeConsoleOrganizationWorkItem[];
};

export type AgentModeConsoleRuntime = {
  dispatchId: string | null;
  attemptId: string | null;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  status: string;
  startedAt: string | null;
  updatedAt: string | null;
  uncertaintyState: string | null;
};

export type AgentModeConsoleModelResource = {
  operationId: string;
  attemptId: string;
  status: string;
  providerId: string | null;
  modelRef: string | null;
  route: string | null;
  region: string | null;
  completedAt: string | null;
};

export type AgentModeConsoleNodeResource = {
  sourceId: string;
  resourceId: string | null;
  providerId: string | null;
  bindingId: string | null;
  status: string | null;
  freshness: string | null;
  observedAt: string | null;
};

export type AgentModeConsoleBudget = {
  rootGoalId: string;
  maxSteps: number;
  reservedSteps: number;
  maxCost: number;
  reservedCost: number;
  settledCost: number;
  remainingCost: number | null;
  activeChildren: number;
  totalChildCreations: number;
  updatedAt: string | null;
};

export type AgentModeConsoleSchedule = {
  scheduleId: string;
  kind: string;
  status: string;
  dueAt: string;
  nextEligibleAt: string;
  completedAt: string | null;
  deadLetteredAt: string | null;
};

export type AgentModeConsoleApproval = {
  approvalId: string;
  objectType: string;
  status: string;
  requestedAt: string | null;
  updatedAt: string | null;
};

export type AgentModeConsoleEvidenceSummary = {
  evidenceCount: number;
  receiptCount: number;
  latestEvidenceRefs: string[];
};

export type AgentModeConsoleFailure = {
  objectType: string;
  objectId: string;
  rootGoalId: string | null;
  status: string;
  reasonCode: string;
  updatedAt: string | null;
};

export type AgentModeConsoleFreshness = {
  status: 'fresh' | 'empty' | 'unavailable';
  sourceStatus: 'available' | 'unavailable';
  generatedAt: string;
  stateStorePresent: boolean;
  message: string;
};

export type AgentModeConsoleSummary = {
  activeRootGoalCount: number;
  activeAgentCount: number;
  runningTaskCount: number;
  runningAttemptCount: number;
  blockedCount: number;
  failedCount: number;
  uncertainCount: number;
  pendingApprovalCount: number;
  activeScheduleCount: number;
  reservedCost: number;
  settledCost: number;
};

export type AgentModeConsoleProjection = {
  schemaVersion: typeof AGENT_MODE_CONSOLE_PROJECTION_VERSION;
  generatedAt: string;
  source: 'agent-mode-state-store';
  freshness: AgentModeConsoleFreshness;
  summary: AgentModeConsoleSummary;
  agents: AgentModeConsoleAgent[];
  organizations: AgentModeConsoleOrganization[];
  tasks: AgentModeConsoleTask[];
  runs: AgentModeConsoleRun[];
  attempts: AgentModeConsoleAttempt[];
  runtimes: AgentModeConsoleRuntime[];
  budgets: AgentModeConsoleBudget[];
  schedules: AgentModeConsoleSchedule[];
  approvals: AgentModeConsoleApproval[];
  evidenceSummary: AgentModeConsoleEvidenceSummary;
  failures: AgentModeConsoleFailure[];
  modelResources: AgentModeConsoleModelResource[];
  nodeResources: AgentModeConsoleNodeResource[];
};

type Row = Record<string, unknown>;

function stringValue(row: Row, key: string): string | null {
  return typeof row[key] === 'string' ? row[key] as string : null;
}

function numberValue(row: Row, key: string): number | null {
  return typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] as number : null;
}

function recordValue(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function activeStatus(status: string): boolean {
  return ['active', 'assigned', 'reserved', 'running', 'created', 'pending', 'dispatch_ready'].includes(status);
}

function terminalStatus(status: string): boolean {
  return ['completed', 'succeeded', 'failed', 'cancelled', 'expired', 'retired'].includes(status);
}

function stableOrder<T extends { id: string; status: string; updatedAt: string | null }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const activeDifference = Number(terminalStatus(a.status)) - Number(terminalStatus(b.status));
    if (activeDifference !== 0) return activeDifference;
    const updatedDifference = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    return updatedDifference || a.id.localeCompare(b.id);
  });
}

function limit<T>(rows: readonly T[], bound: number): T[] {
  return rows.slice(0, bound);
}

function organizationRoleByChild(observer: AgentModeObserverProjection): Map<string, string> {
  const roles = new Map<string, string>();
  for (const item of observer.organizationWorkItems) {
    const childAgentId = stringValue(item, 'childAgentId') ?? stringValue(item, 'boundChildAgentId');
    const role = stringValue(item, 'organizationRoleId');
    if (childAgentId && role) roles.set(childAgentId, role);
  }
  return roles;
}

function buildProjection(observer: AgentModeObserverProjection, now: string): AgentModeConsoleProjection {
  const observerAgents = observer.agents.map(recordValue).filter((row): row is Row => row !== null);
  const observerTasks = observer.tasks.map(recordValue).filter((row): row is Row => row !== null);
  const observerRuns = observer.runs.map(recordValue).filter((row): row is Row => row !== null);
  const observerAttempts = observer.attempts.map(recordValue).filter((row): row is Row => row !== null);
  const roles = organizationRoleByChild(observer);
  const agentById = new Map(observerAgents.map((row) => [stringValue(row, 'agentId') ?? '', row]));
  const runByTask = new Map(observerRuns.map((row) => [stringValue(row, 'taskId') ?? '', row]));
  const attemptByRun = new Map(observerAttempts.map((row) => [stringValue(row, 'runId') ?? '', row]));
  const dispatchByAttempt = new Map(observer.runtimeDispatches.map(recordValue).filter((row): row is Row => row !== null).map((row) => [stringValue(row, 'attemptId') ?? '', row]));

  const agents = stableOrder(limit(observerAgents.map((row) => {
    const id = stringValue(row, 'agentId') ?? 'unknown-agent';
    const status = stringValue(row, 'status') ?? 'unknown';
    const children = observerAgents.filter((candidate) => stringValue(candidate, 'parentAgentId') === id);
    const attempt = observerAttempts.find((candidate) => stringValue(candidate, 'agentId') === id);
    return {
      id,
      status,
      updatedAt: stringValue(row, 'childCreatedAt'),
      agentId: id,
      rootGoalId: stringValue(row, 'rootGoalId'),
      parentAgentId: stringValue(row, 'parentAgentId'),
      organizationRoleId: roles.get(id) ?? null,
      roleTemplateId: stringValue(row, 'roleTemplateId'),
      lifecycleStatus: status,
      depth: numberValue(row, 'depth'),
      childCount: children.length,
      activeChildCount: children.filter((child) => activeStatus(stringValue(child, 'status') ?? 'unknown')).length,
      deadline: stringValue(row, 'expiresAt'),
      cancellationState: stringValue(row, 'cancellationStatus'),
      runtimeRef: attempt ? stringValue(attempt, 'runtimeRef') : null,
      modelRef: attempt ? stringValue(attempt, 'modelRef') : null,
    } satisfies AgentModeConsoleAgent & { id: string; status: string; updatedAt: string | null };
  }), AGENT_MODE_CONSOLE_BOUNDS.agents));

  const attempts = stableOrder(limit(observerAttempts.map((row) => {
    const id = stringValue(row, 'attemptId') ?? 'unknown-attempt';
    const dispatch = dispatchByAttempt.get(id);
    const agent = agentById.get(stringValue(row, 'agentId') ?? '');
    const status = stringValue(row, 'status') ?? 'unknown';
    const updatedAt = stringValue(row, 'updatedAt') ?? stringValue(row, 'createdAt');
    return {
      id,
      status,
      updatedAt,
      attemptId: id,
      runId: stringValue(row, 'runId') ?? '',
      agentId: stringValue(row, 'agentId') ?? '',
      rootGoalId: agent ? stringValue(agent, 'rootGoalId') : null,
      runtimeRef: stringValue(row, 'runtimeRef'),
      runtimeProfileRef: stringValue(row, 'runtimeProfileRef'),
      modelRef: stringValue(row, 'modelRef'),
      startedAt: stringValue(dispatch ?? {}, 'dispatchedAt') ?? stringValue(row, 'createdAt'),
      completedAt: terminalStatus(status) ? updatedAt : null,
      uncertaintyState: status === 'uncertain' || stringValue(dispatch ?? {}, 'reconciliationStatus') === 'pending' ? 'uncertain' : null,
      cancellationState: stringValue(row, 'cancellationStatus'),
    } satisfies AgentModeConsoleAttempt & { id: string; status: string; updatedAt: string | null };
  }), AGENT_MODE_CONSOLE_BOUNDS.attempts));

  const runs = stableOrder(limit(observerRuns.map((row) => {
    const id = stringValue(row, 'runId') ?? 'unknown-run';
    const attempt = attemptByRun.get(id);
    const agent = agentById.get(stringValue(row, 'agentId') ?? '');
    const dispatch = attempt ? dispatchByAttempt.get(stringValue(attempt, 'attemptId') ?? '') : undefined;
    const status = stringValue(row, 'status') ?? 'unknown';
    const updatedAt = stringValue(attempt ?? {}, 'updatedAt') ?? stringValue(row, 'createdAt');
    return {
      id,
      status,
      updatedAt,
      runId: id,
      taskId: stringValue(row, 'taskId') ?? '',
      attemptId: attempt ? stringValue(attempt, 'attemptId') : null,
      agentId: stringValue(row, 'agentId'),
      rootGoalId: agent ? stringValue(agent, 'rootGoalId') : null,
      runtimeRef: attempt ? stringValue(attempt, 'runtimeRef') : null,
      runtimeProfileRef: attempt ? stringValue(attempt, 'runtimeProfileRef') : null,
      modelRef: attempt ? stringValue(attempt, 'modelRef') : null,
      startedAt: stringValue(dispatch ?? {}, 'dispatchedAt') ?? stringValue(row, 'createdAt'),
      completedAt: terminalStatus(status) ? updatedAt : null,
      uncertaintyState: status === 'uncertain' || stringValue(dispatch ?? {}, 'reconciliationStatus') === 'pending' ? 'uncertain' : null,
      cancellationState: attempt ? stringValue(attempt, 'cancellationStatus') : null,
    } satisfies AgentModeConsoleRun & { id: string; status: string; updatedAt: string | null };
  }), AGENT_MODE_CONSOLE_BOUNDS.runs));

  const tasks = stableOrder(limit(observerTasks.map((row) => {
    const id = stringValue(row, 'taskId') ?? 'unknown-task';
    const run = runByTask.get(id);
    const attempt = run ? attemptByRun.get(stringValue(run, 'runId') ?? '') : undefined;
    const agent = run ? agentById.get(stringValue(run, 'agentId') ?? '') : undefined;
    const dispatch = attempt ? dispatchByAttempt.get(stringValue(attempt, 'attemptId') ?? '') : undefined;
    const status = stringValue(row, 'status') ?? 'unknown';
    const updatedAt = stringValue(attempt ?? {}, 'updatedAt') ?? stringValue(row, 'createdAt');
    return {
      id,
      status,
      updatedAt,
      taskId: id,
      runId: run ? stringValue(run, 'runId') : null,
      attemptId: attempt ? stringValue(attempt, 'attemptId') : null,
      agentId: run ? stringValue(run, 'agentId') : null,
      rootGoalId: agent ? stringValue(agent, 'rootGoalId') : null,
      parentAgentId: agent ? stringValue(agent, 'parentAgentId') : null,
      runtimeRef: attempt ? stringValue(attempt, 'runtimeRef') : null,
      runtimeProfileRef: attempt ? stringValue(attempt, 'runtimeProfileRef') : null,
      modelRef: attempt ? stringValue(attempt, 'modelRef') : null,
      startedAt: stringValue(dispatch ?? {}, 'dispatchedAt') ?? stringValue(run ?? {}, 'createdAt'),
      completedAt: terminalStatus(status) ? updatedAt : null,
      uncertaintyState: status === 'uncertain' || stringValue(dispatch ?? {}, 'reconciliationStatus') === 'pending' ? 'uncertain' : null,
      cancellationState: attempt ? stringValue(attempt, 'cancellationStatus') : null,
    } satisfies AgentModeConsoleTask & { id: string; status: string; updatedAt: string | null };
  }), AGENT_MODE_CONSOLE_BOUNDS.tasks));

  const executions = new Map(observer.organizationExecution.map((execution) => [execution.organizationPlanId, execution]));
  const workItemsByPlan = new Map<string, AgentModeConsoleOrganizationWorkItem[]>();
  for (const row of observer.organizationWorkItems.map(recordValue).filter((row): row is Row => row !== null)) {
    const planId = stringValue(row, 'organizationPlanId') ?? '';
    const items = workItemsByPlan.get(planId) ?? [];
    items.push({
      workItemId: stringValue(row, 'workItemId') ?? 'unknown-work-item',
      workItemKey: stringValue(row, 'workItemKey') ?? 'unknown',
      organizationRoleId: stringValue(row, 'organizationRoleId') ?? 'unknown',
      dependencyCount: numberValue(row, 'dependencyCount') ?? 0,
      readiness: stringValue(row, 'readiness') ?? stringValue(row, 'readinessState') ?? 'unknown',
      delegationState: stringValue(row, 'delegationState') ?? 'unknown',
      childAgentId: stringValue(row, 'childAgentId') ?? stringValue(row, 'boundChildAgentId'),
      taskId: stringValue(row, 'taskId') ?? stringValue(row, 'boundTaskId'),
      runId: stringValue(row, 'runId'),
      attemptId: stringValue(row, 'attemptId'),
      terminalStatus: stringValue(row, 'terminalStatus'),
      resultRef: stringValue(row, 'resultRef'),
      evidenceRefCount: numberValue(row, 'evidenceRefCount') ?? 0,
      settledCost: numberValue(row, 'settledCost') ?? 0,
    });
    workItemsByPlan.set(planId, items);
  }

  const organizations = limit(observer.organizationPlans.map(recordValue).filter((row): row is Row => row !== null).map((row) => {
    const id = stringValue(row, 'organizationPlanId') ?? 'unknown-organization';
    const execution = executions.get(id);
    const items = (workItemsByPlan.get(id) ?? []).sort((a, b) => a.workItemKey.localeCompare(b.workItemKey));
    const auditor = items.find((item) => item.organizationRoleId.endsWith('independent-auditor.v1'));
    const finalStatus = stringValue(row, 'finalStatus');
    return {
      organizationPlanId: id,
      rootGoalId: stringValue(row, 'rootGoalId') ?? '',
      supervisorAgentId: stringValue(row, 'supervisorAgentId') ?? '',
      supervisorOrganizationRoleId: stringValue(row, 'supervisorOrganizationRoleId') ?? '',
      status: stringValue(row, 'status') ?? 'unknown',
      workItemCount: numberValue(row, 'workItemCount') ?? items.length,
      dependencyCount: numberValue(row, 'dependencyCount') ?? 0,
      readyCount: execution?.readyCount ?? 0,
      runningCount: execution?.runningCount ?? 0,
      succeededCount: execution?.succeededCount ?? 0,
      failedCount: execution?.failedCount ?? 0,
      uncertainCount: execution?.uncertainCount ?? 0,
      auditorStatus: auditor?.terminalStatus ?? auditor?.readiness ?? null,
      finalResultId: stringValue(row, 'finalResultId'),
      finalStatus,
      aggregateCost: numberValue(row, 'totalSettledCost') ?? execution?.settledCost ?? 0,
      updatedAt: stringValue(row, 'finalizedAt') ?? stringValue(row, 'createdAt'),
      workItems: items,
    } satisfies AgentModeConsoleOrganization;
  }), AGENT_MODE_CONSOLE_BOUNDS.organizations);

  const runtimes = stableOrder(limit(observer.runtimeDispatches.map(recordValue).filter((row): row is Row => row !== null).map((row) => {
    const id = stringValue(row, 'dispatchId') ?? stringValue(row, 'operationId') ?? 'unknown-dispatch';
    const status = stringValue(row, 'state') ?? 'unknown';
    return {
      id,
      status,
      updatedAt: stringValue(row, 'dispatchedAt') ?? stringValue(row, 'preparedAt'),
      dispatchId: stringValue(row, 'dispatchId'),
      attemptId: stringValue(row, 'attemptId'),
      runtimeRef: stringValue(row, 'runtimeRef'),
      runtimeProfileRef: stringValue(row, 'runtimeProfileRef'),
      startedAt: stringValue(row, 'processStartedAt') ?? stringValue(row, 'dispatchedAt'),
      uncertaintyState: stringValue(row, 'reconciliationStatus') === 'pending' ? 'uncertain' : null,
    } satisfies AgentModeConsoleRuntime & { id: string; status: string; updatedAt: string | null };
  }), AGENT_MODE_CONSOLE_BOUNDS.runtimes));

  const budgets = limit(observer.spawnRootStates.map(recordValue).filter((row): row is Row => row !== null).map((row) => {
    const rootGoalId = stringValue(row, 'rootGoalId') ?? 'unknown-root';
    const maxCost = numberValue(row, 'maxAggregateChildCost') ?? 0;
    const reservedCost = numberValue(row, 'reservedChildCost') ?? 0;
    const settledCost = organizations.filter((organization) => organization.rootGoalId === rootGoalId).reduce((total, organization) => total + organization.aggregateCost, 0);
    return {
      rootGoalId,
      maxSteps: numberValue(row, 'maxAggregateChildSteps') ?? 0,
      reservedSteps: numberValue(row, 'reservedChildSteps') ?? 0,
      maxCost,
      reservedCost,
      settledCost,
      remainingCost: Number.isFinite(maxCost) ? Math.max(0, maxCost - reservedCost) : null,
      activeChildren: numberValue(row, 'activeChildren') ?? 0,
      totalChildCreations: numberValue(row, 'totalChildCreations') ?? 0,
      updatedAt: stringValue(row, 'updatedAt'),
    } satisfies AgentModeConsoleBudget;
  }), AGENT_MODE_CONSOLE_BOUNDS.budgets);

  const schedules = limit(observer.schedulerSchedules.map(recordValue).filter((row): row is Row => row !== null).map((row) => ({
    scheduleId: stringValue(row, 'scheduleId') ?? 'unknown-schedule',
    kind: stringValue(row, 'kind') ?? 'unknown',
    status: stringValue(row, 'status') ?? 'unknown',
    dueAt: stringValue(row, 'dueAt') ?? '',
    nextEligibleAt: stringValue(row, 'nextEligibleAt') ?? '',
    completedAt: stringValue(row, 'completedAt'),
    deadLetteredAt: stringValue(row, 'deadLetteredAt'),
  })), AGENT_MODE_CONSOLE_BOUNDS.schedules);

  const approvals = limit(observer.reviewRequests.map(recordValue).filter((row): row is Row => row !== null).filter((row) => ['pending', 'requested', 'awaiting_approval'].includes(stringValue(row, 'status') ?? '')).map((row) => ({
    approvalId: stringValue(row, 'requestId') ?? stringValue(row, 'reviewId') ?? stringValue(row, 'id') ?? 'unknown-approval',
    objectType: stringValue(row, 'requestType') ?? stringValue(row, 'objectType') ?? 'review',
    status: stringValue(row, 'status') ?? 'unknown',
    requestedAt: stringValue(row, 'requestedAt') ?? stringValue(row, 'createdAt'),
    updatedAt: stringValue(row, 'updatedAt') ?? stringValue(row, 'createdAt'),
  })), AGENT_MODE_CONSOLE_BOUNDS.approvals);

  const evidenceRefs = new Set<string>();
  let receiptCount = 0;
  for (const row of observer.runtimeDispatches.map(recordValue).filter((row): row is Row => row !== null)) {
    const receipt = recordValue(row.receipt);
    if (!receipt) continue;
    receiptCount += 1;
    const evidenceRef = stringValue(receipt, 'evidenceRef');
    if (evidenceRef) evidenceRefs.add(`k4:evidence:${evidenceRef}`.startsWith('k4:evidence:k4:') ? evidenceRef : `k4:evidence:${evidenceRef}`);
  }
  const evidenceSummary: AgentModeConsoleEvidenceSummary = {
    evidenceCount: evidenceRefs.size,
    receiptCount,
    latestEvidenceRefs: [...evidenceRefs].sort().slice(0, AGENT_MODE_CONSOLE_BOUNDS.evidence),
  };

  const failures: AgentModeConsoleFailure[] = [];
  for (const row of observerAttempts) {
    const status = stringValue(row, 'status') ?? 'unknown';
    if (!['failed', 'cancelled', 'uncertain'].includes(status)) continue;
    const agent = agentById.get(stringValue(row, 'agentId') ?? '');
    failures.push({ objectType: 'attempt', objectId: stringValue(row, 'attemptId') ?? 'unknown-attempt', rootGoalId: agent ? stringValue(agent, 'rootGoalId') : null, status, reasonCode: status === 'uncertain' ? 'UNCERTAIN_RUNTIME' : `ATTEMPT_${status.toUpperCase()}`, updatedAt: stringValue(row, 'updatedAt') ?? stringValue(row, 'createdAt') });
  }
  for (const item of observer.organizationWorkItems.map(recordValue).filter((row): row is Row => row !== null)) {
    const readiness = stringValue(item, 'readiness') ?? stringValue(item, 'readinessState');
    if (!['dependency_failed', 'blocked'].includes(readiness ?? '')) continue;
    failures.push({ objectType: 'organization-work-item', objectId: stringValue(item, 'workItemId') ?? 'unknown-work-item', rootGoalId: null, status: readiness ?? 'blocked', reasonCode: readiness === 'dependency_failed' ? 'DEPENDENCY_FAILED' : 'ORGANIZATION_BLOCKED', updatedAt: null });
  }
  const boundedFailures = failures.slice(0, AGENT_MODE_CONSOLE_BOUNDS.failures);

  const modelResources = limit(observer.modelOperations.map(recordValue).filter((row): row is Row => row !== null).map((row) => {
    const receipt = recordValue(row.receipt);
    return {
      operationId: stringValue(row, 'operationId') ?? 'unknown-operation',
      attemptId: stringValue(row, 'attemptId') ?? 'unknown-attempt',
      status: stringValue(row, 'state') ?? 'unknown',
      providerId: receipt ? stringValue(receipt, 'providerId') : null,
      modelRef: receipt ? stringValue(receipt, 'modelRef') : null,
      route: receipt ? stringValue(receipt, 'route') : null,
      region: receipt ? stringValue(receipt, 'region') : null,
      completedAt: receipt ? stringValue(receipt, 'completedAt') : null,
    } satisfies AgentModeConsoleModelResource;
  }), AGENT_MODE_CONSOLE_BOUNDS.modelResources);

  const nodeResources = limit(observer.hostHealthStates.map(recordValue).filter((row): row is Row => row !== null).map((row) => ({
    sourceId: stringValue(row, 'sourceId') ?? 'unknown-source',
    resourceId: stringValue(row, 'resourceId'),
    providerId: stringValue(row, 'providerId'),
    bindingId: stringValue(row, 'bindingId'),
    status: stringValue(row, 'status'),
    freshness: stringValue(row, 'freshness'),
    observedAt: stringValue(row, 'observedAt'),
  } satisfies AgentModeConsoleNodeResource)), AGENT_MODE_CONSOLE_BOUNDS.nodeResources);

  const activeRootGoalCount = observer.spawnRootStates.filter((row) => {
    const value = recordValue(row);
    return value && stringValue(value, 'cancellation') === 'active' && (Date.parse(stringValue(value, 'deadline') ?? '') > Date.parse(now));
  }).length;
  const activeAgentCount = agents.filter((agent) => activeStatus(agent.lifecycleStatus)).length;
  const runningTaskCount = tasks.filter((task) => ['running', 'active'].includes(task.status)).length;
  const runningAttemptCount = attempts.filter((attempt) => ['running', 'active'].includes(attempt.status)).length;
  const blockedCount = failures.filter((failure) => ['blocked', 'dependency_failed'].includes(failure.status)).length;
  const failedCount = failures.filter((failure) => failure.status === 'failed').length;
  const uncertainCount = failures.filter((failure) => failure.status === 'uncertain').length + organizations.reduce((total, organization) => total + organization.uncertainCount, 0);
  const reservedCost = budgets.reduce((total, budget) => total + budget.reservedCost, 0);
  const settledCost = budgets.reduce((total, budget) => total + budget.settledCost, 0);
  const sourceStatus = observer.persistence.databasePresent ? 'available' : 'unavailable';
  const freshnessStatus = observer.availability === 'unavailable' ? 'unavailable' : observer.availability === 'empty' ? 'empty' : 'fresh';

  return {
    schemaVersion: AGENT_MODE_CONSOLE_PROJECTION_VERSION,
    generatedAt: now,
    source: 'agent-mode-state-store',
    freshness: {
      status: freshnessStatus,
      sourceStatus,
      generatedAt: now,
      stateStorePresent: observer.persistence.databasePresent,
      message: observer.availability === 'unavailable' ? 'Agent Mode StateStore is unavailable; no durable state was read.' : observer.availability === 'empty' ? 'Agent Mode StateStore is present but contains no visible Agent Mode records.' : 'Projection derived from the durable Agent Mode StateStore observer.',
    },
    summary: {
      activeRootGoalCount,
      activeAgentCount,
      runningTaskCount,
      runningAttemptCount,
      blockedCount,
      failedCount,
      uncertainCount,
      pendingApprovalCount: approvals.length,
      activeScheduleCount: schedules.filter((schedule) => ['pending', 'claimed'].includes(schedule.status)).length,
      reservedCost,
      settledCost,
    },
    agents,
    organizations,
    tasks,
    runs,
    attempts,
    runtimes,
    budgets,
    schedules,
    approvals,
    evidenceSummary,
    failures: boundedFailures,
    modelResources,
    nodeResources,
  };
}

export function buildAgentModeConsoleProjection(observer: AgentModeObserverProjection, now: string): AgentModeConsoleProjection {
  return buildProjection(observer, now);
}

export function readAgentModeConsoleProjection(now = new Date().toISOString(), databasePath = defaultAgentModeDatabasePath()): AgentModeConsoleProjection {
  return buildProjection(readAgentModeObserver(now, databasePath), now);
}
