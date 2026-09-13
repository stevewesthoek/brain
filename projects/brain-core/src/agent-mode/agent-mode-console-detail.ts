import { defaultAgentModeDatabasePath } from './sqlite-state-store.js';
import { readAgentModeObserver, type AgentModeObserverProjection } from './agent-mode-observer.js';

export const AGENT_MODE_CONSOLE_DETAIL_VERSION = 'agent-mode-console-detail-v1' as const;

export const AGENT_MODE_CONSOLE_DETAIL_KINDS = [
  'agent', 'task', 'run', 'attempt', 'organization', 'budget', 'schedule', 'failure', 'evidence',
] as const;

export type AgentModeConsoleDetailKind = typeof AGENT_MODE_CONSOLE_DETAIL_KINDS[number];

export const AGENT_MODE_CONSOLE_DETAIL_BOUNDS = Object.freeze({
  children: 50,
  tasks: 50,
  runs: 50,
  attempts: 50,
  workItems: 16,
  dependencies: 32,
  evidenceRefs: 64,
  budgetSettlements: 100,
  schedulerHistory: 50,
  failureEvents: 50,
});

type Row = Record<string, unknown>;

export type AgentModeConsoleDetailFreshness = {
  status: 'fresh' | 'unavailable';
  sourceStatus: 'available' | 'unavailable';
  generatedAt: string;
  stateStorePresent: boolean;
  message: string;
};

export type AgentModeConsoleDetailEvidence = {
  evidenceRef: string;
  evidenceType: string;
  ownerRootGoalId: string | null;
  ownerAgentId: string | null;
  ownerTaskId: string | null;
  ownerRunId: string | null;
  ownerAttemptId: string | null;
  receiptType: string;
  verificationStatus: string;
  createdAt: string | null;
  contentSize: number | null;
  digest: string | null;
  redactionStatus: 'metadata-only';
  relatedOperationId: string | null;
  relatedResultRef: string | null;
};

export type AgentModeConsoleDetailBudget = {
  budgetId: string;
  rootGoalId: string | null;
  budgetScopeId: string | null;
  maxSteps: number | null;
  usedSteps: number | null;
  reservedSteps: number | null;
  remainingSteps: number | null;
  maxTokens: number | null;
  usedTokens: number | null;
  reservedTokens: number | null;
  remainingTokens: number | null;
  maxCost: number | null;
  usedCost: number | null;
  reservedCost: number | null;
  settledCost: number | null;
  remainingCost: number | null;
  activeChildren: number | null;
  totalChildCreations: number | null;
  childAllocations: Array<{
    attemptId: string;
    agentId: string;
    taskId: string | null;
    reservedSteps: number;
    reservedTokens: number;
    reservedCost: number;
    settledCost: number;
    status: string;
  }>;
};

export type AgentModeConsoleDetailLifecycle = {
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  status: string | null;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  modelRef: string | null;
  providerId: string | null;
  route: string | null;
  region: string | null;
  uncertaintyState: string | null;
  cancellationState: string | null;
  resultRef: string | null;
  evidenceRefs: string[];
  settledCost: number | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
};

export type AgentModeConsoleAgentDetail = {
  kind: 'agent';
  agentId: string;
  rootGoalId: string | null;
  parentAgentId: string | null;
  organizationPlanId: string | null;
  workItemId: string | null;
  organizationRoleId: string | null;
  roleTemplateId: string | null;
  lifecycleStatus: string;
  depth: number | null;
  deadline: string | null;
  cancellationState: string | null;
  killState: string | null;
  childCount: number;
  activeChildCount: number;
  children: Array<{ agentId: string; parentAgentId: string | null; status: string; depth: number | null; updatedAt: string | null }>;
  relatedTasks: Array<{ taskId: string; runId: string | null; attemptId: string | null; status: string; updatedAt: string | null }>;
  relatedAttempts: Array<{ attemptId: string; runId: string; status: string; uncertaintyState: string | null; cancellationState: string | null; updatedAt: string | null }>;
  runtime: AgentModeConsoleDetailLifecycle | null;
  budget: AgentModeConsoleDetailBudget | null;
};

export type AgentModeConsoleTaskDetail = {
  kind: 'task';
  taskId: string;
  taskType: string | null;
  taskSpecRef: string | null;
  inputHash: string | null;
  rootGoalId: string | null;
  agentId: string | null;
  parentAgentId: string | null;
  status: string;
  createdAt: string | null;
  lifecycle: AgentModeConsoleDetailLifecycle;
};

export type AgentModeConsoleRunDetail = {
  kind: 'run';
  runId: string;
  taskId: string;
  agentId: string | null;
  rootGoalId: string | null;
  status: string;
  createdAt: string | null;
  lifecycle: AgentModeConsoleDetailLifecycle;
};

export type AgentModeConsoleAttemptDetail = {
  kind: 'attempt';
  attemptId: string;
  runId: string;
  taskId: string | null;
  agentId: string;
  rootGoalId: string | null;
  status: string;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  modelRef: string | null;
  route: string | null;
  cancellationState: string | null;
  uncertaintyState: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  budget: AgentModeConsoleDetailBudget | null;
  runtime: AgentModeConsoleDetailLifecycle | null;
  evidence: AgentModeConsoleDetailEvidence[];
};

export type AgentModeConsoleOrganizationDetail = {
  kind: 'organization';
  organizationPlanId: string;
  rootGoalId: string;
  supervisorAgentId: string;
  supervisorOrganizationRoleId: string;
  planVersion: number | null;
  status: string;
  readiness: string;
  deadline: string | null;
  workItems: Array<{
    workItemId: string;
    workItemKey: string;
    organizationRoleId: string;
    dependencies: Array<{ workItemKey: string; dependencyType: string; status: string }>;
    readiness: string;
    delegationState: string;
    childAgentId: string | null;
    taskId: string | null;
    runId: string | null;
    attemptId: string | null;
    terminalStatus: string | null;
    resultRef: string | null;
    evidenceRefs: string[];
    settledCost: number;
  }>;
  finalResult: {
    finalResultId: string;
    status: string;
    auditorWorkItemId: string | null;
    auditorResultRef: string | null;
    aggregateDigest: string | null;
    totalSettledCost: number;
    finalizedAt: string | null;
  } | null;
};

export type AgentModeConsoleScheduleDetail = {
  kind: 'schedule';
  scheduleId: string;
  eventIdentity: string | null;
  enabled: boolean;
  sourceType: string | null;
  status: string;
  nextDueAt: string | null;
  nextEligibleAt: string | null;
  latestDispatch: { eventId: string; status: string; occurredAt: string | null } | null;
  latestTerminalResult: string | null;
  retryState: { attemptCount: number; maxAttempts: number; lastFailure: string | null };
  deadLetterCount: number;
  deadline: string | null;
  rootGoalId: string | null;
  history: Array<{ eventId: string; status: string; occurredAt: string | null; reasonCode: string | null }>;
};

export type AgentModeConsoleFailureDetail = {
  kind: 'failure';
  objectType: string;
  objectId: string;
  rootGoalId: string | null;
  agentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  status: string;
  reasonCode: string;
  reasonMessage: string;
  uncertaintyClassification: string | null;
  updatedAt: string | null;
  evidenceRefs: string[];
  reconciliationState: string | null;
  relatedEvents: Array<{ eventId: string; eventType: string; occurredAt: string; reasonCode: string | null }>;
};

export type AgentModeConsoleEvidenceDetail = AgentModeConsoleDetailEvidence & { kind: 'evidence' };

export type AgentModeConsoleBudgetDetail = AgentModeConsoleDetailBudget & { kind: 'budget' };

export type AgentModeConsoleDetail = AgentModeConsoleAgentDetail
  | AgentModeConsoleTaskDetail
  | AgentModeConsoleRunDetail
  | AgentModeConsoleAttemptDetail
  | AgentModeConsoleOrganizationDetail
  | AgentModeConsoleBudgetDetail
  | AgentModeConsoleScheduleDetail
  | AgentModeConsoleFailureDetail
  | AgentModeConsoleEvidenceDetail;

type AvailableResponse = {
  schemaVersion: typeof AGENT_MODE_CONSOLE_DETAIL_VERSION;
  generatedAt: string;
  source: 'agent-mode-state-store';
  freshness: AgentModeConsoleDetailFreshness;
  kind: AgentModeConsoleDetailKind;
  id: string;
  status: 'available';
  detail: AgentModeConsoleDetail;
};

type EmptyResponse = {
  schemaVersion: typeof AGENT_MODE_CONSOLE_DETAIL_VERSION;
  generatedAt: string;
  source: 'agent-mode-state-store';
  freshness: AgentModeConsoleDetailFreshness;
  kind: AgentModeConsoleDetailKind;
  id: string;
  status: 'not_found' | 'unavailable';
  reasonCode: 'DETAIL_NOT_FOUND' | 'STATESTORE_UNAVAILABLE';
  detail: null;
};

export type AgentModeConsoleDetailResponse = AvailableResponse | EmptyResponse;

function row(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function rows(values: readonly Record<string, unknown>[]): Row[] {
  return values.map(row).filter((value): value is Row => value !== null);
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function arrayOfText(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, limit) : [];
}

function canonicalEvidenceRef(value: string): string {
  return value.startsWith('k4:evidence:') ? value : `k4:evidence:${value}`;
}

function canonicalResultRef(value: string): string {
  return value.startsWith('k4:runtime:') ? value : `k4:runtime:${value}`;
}

function terminal(status: string | null): boolean {
  return status !== null && ['completed', 'succeeded', 'failed', 'cancelled', 'expired', 'retired'].includes(status);
}

function byId(values: Row[], key: string, id: string): Row | null {
  return values.find((value) => text(value[key]) === id) ?? null;
}

function relatedOrganization(observer: AgentModeObserverProjection, agentId: string): { planId: string; workItemId: string; roleId: string } | null {
  for (const item of rows(observer.organizationWorkItems)) {
    const childId = text(item.childAgentId) ?? text(item.boundChildAgentId);
    if (childId !== agentId) continue;
    return { planId: text(item.organizationPlanId) ?? '', workItemId: text(item.workItemId) ?? '', roleId: text(item.organizationRoleId) ?? '' };
  }
  return null;
}

function budgetForRoot(observer: AgentModeObserverProjection, rootGoalId: string | null): Row | null {
  if (!rootGoalId) return null;
  return rows(observer.spawnRootStates).find((value) => text(value.rootGoalId) === rootGoalId) ?? null;
}

function attemptBudget(observer: AgentModeObserverProjection, attemptId: string): Row | null {
  const attempt = byId(rows(observer.attempts), 'attemptId', attemptId);
  return row(attempt?.budget) ?? null;
}

function evidenceForAttempt(observer: AgentModeObserverProjection, attemptId: string): AgentModeConsoleDetailEvidence[] {
  const attempts = rows(observer.attempts);
  const attempt = byId(attempts, 'attemptId', attemptId);
  const run = attempt ? byId(rows(observer.runs), 'runId', text(attempt.runId) ?? '') : null;
  const task = run ? byId(rows(observer.tasks), 'taskId', text(run.taskId) ?? '') : null;
  const agent = attempt ? byId(rows(observer.agents), 'agentId', text(attempt.agentId) ?? '') : null;
  const result: AgentModeConsoleDetailEvidence[] = [];
  const seen = new Set<string>();
  const add = (rawRef: string | null, operationId: string | null, digest: string | null, status: string, createdAt: string | null, resultRef: string | null) => {
    if (!rawRef) return;
    const evidenceRef = canonicalEvidenceRef(rawRef);
    if (seen.has(evidenceRef) || result.length >= AGENT_MODE_CONSOLE_DETAIL_BOUNDS.evidenceRefs) return;
    seen.add(evidenceRef);
    result.push({
      evidenceRef,
      evidenceType: 'runtime-receipt',
      ownerRootGoalId: text(agent?.rootGoalId),
      ownerAgentId: text(attempt?.agentId),
      ownerTaskId: text(task?.taskId),
      ownerRunId: text(run?.runId),
      ownerAttemptId: attemptId,
      receiptType: 'k4-runtime-receipt',
      verificationStatus: status === 'verified' || status === 'succeeded' ? 'verified' : 'durably-recorded',
      createdAt,
      contentSize: null,
      digest,
      redactionStatus: 'metadata-only',
      relatedOperationId: operationId,
      relatedResultRef: resultRef,
    });
  };
  for (const dispatch of rows(observer.runtimeDispatches)) {
    if (text(dispatch.attemptId) !== attemptId) continue;
    const receipt = row(dispatch.receipt);
    add(text(receipt?.evidenceRef), text(dispatch.operationId), text(receipt?.resultHash), text(dispatch.state) ?? 'unknown', text(receipt?.recordedAt) ?? text(dispatch.dispatchedAt) ?? text(dispatch.preparedAt), text(receipt?.resultHash) ? canonicalResultRef(text(receipt?.resultHash) as string) : null);
  }
  for (const operation of rows(observer.operations)) {
    if (text(operation.attemptId) !== attemptId) continue;
    add(text(operation.evidenceRef), text(operation.operationId), text(operation.resultHash), text(operation.state) ?? 'unknown', text(operation.dispatchedAt) ?? text(operation.preparedAt), null);
  }
  return result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.evidenceRef.localeCompare(b.evidenceRef));
}

function lifecycle(observer: AgentModeObserverProjection, attempt: Row | null, taskId: string | null, runId: string | null): AgentModeConsoleDetailLifecycle {
  const attemptId = text(attempt?.attemptId);
  const dispatch = attemptId ? rows(observer.runtimeDispatches).find((value) => text(value.attemptId) === attemptId) ?? null : null;
  const receipt = row(dispatch?.receipt);
  const modelOperation = attemptId ? rows(observer.modelOperations).find((value) => text(value.attemptId) === attemptId) ?? null : null;
  const modelReceipt = row(modelOperation?.receipt);
  const status = text(attempt?.status);
  const updatedAt = text(attempt?.updatedAt) ?? text(attempt?.createdAt);
  return {
    taskId,
    runId,
    attemptId,
    status,
    runtimeRef: text(attempt?.runtimeRef),
    runtimeProfileRef: text(attempt?.runtimeProfileRef),
    modelRef: text(attempt?.modelRef) ?? text(modelReceipt?.modelRef),
    providerId: text(modelReceipt?.providerId),
    route: text(modelReceipt?.route) ?? text(attempt?.routeRef),
    region: text(modelReceipt?.region),
    uncertaintyState: status === 'uncertain' || text(dispatch?.reconciliationStatus) === 'pending' ? 'uncertain' : null,
    cancellationState: text(attempt?.cancellationStatus),
    resultRef: text(receipt?.resultHash) ? canonicalResultRef(text(receipt?.resultHash) as string) : null,
    evidenceRefs: text(receipt?.evidenceRef) ? [canonicalEvidenceRef(text(receipt?.evidenceRef) as string)] : [],
    settledCost: number(row(attempt?.budget)?.usedDollars) ?? number(row(attempt?.budget)?.settledCost),
    startedAt: text(dispatch?.dispatchedAt) ?? text(attempt?.createdAt),
    updatedAt,
    completedAt: terminal(status) ? updatedAt : null,
  };
}

function budgetDetail(observer: AgentModeObserverProjection, id: string, rootGoalId: string | null = null): AgentModeConsoleDetailBudget | null {
  const root = budgetForRoot(observer, rootGoalId ?? id);
  const agentRows = rows(observer.agents);
  const attempts = rows(observer.attempts).filter((attempt) => {
    const budget = row(attempt.budget);
    const attemptAgent = agentRows.find((candidate) => text(candidate.agentId) === text(attempt.agentId));
    return (rootGoalId ?? id) === (text(attempt.rootGoalId) ?? text(attemptAgent?.rootGoalId)) || text(budget?.budgetScopeId) === id;
  });
  if (!root && attempts.length === 0) return null;
  const rootId = root ? text(root.rootGoalId) : text(attempts[0]?.rootGoalId);
  const maxSteps = number(root?.maxAggregateChildSteps) ?? number(attempts[0] && row(attempts[0].budget)?.maxSteps);
  const reservedSteps = number(root?.reservedChildSteps) ?? attempts.reduce((sum, attempt) => sum + (number(row(attempt.budget)?.reservedSteps) ?? 0), 0);
  const usedSteps = attempts.reduce((sum, attempt) => sum + (number(row(attempt.budget)?.usedSteps) ?? 0), 0);
  const maxTokens = attempts.length ? number(row(attempts[0]?.budget)?.maxTokens) : null;
  const reservedTokens = attempts.reduce((sum, attempt) => sum + (number(row(attempt.budget)?.reservedTokens) ?? 0), 0);
  const usedTokens = attempts.reduce((sum, attempt) => sum + (number(row(attempt.budget)?.usedTokens) ?? 0), 0);
  const maxCost = number(root?.maxAggregateChildCost) ?? number(row(attempts[0]?.budget)?.maxDollars);
  const reservedCost = number(root?.reservedChildCost) ?? attempts.reduce((sum, attempt) => sum + (number(row(attempt.budget)?.reservedDollars) ?? 0), 0);
  const usedCost = attempts.reduce((sum, attempt) => sum + (number(row(attempt.budget)?.usedDollars) ?? 0), 0);
  const settledCost = rootId ? rows(observer.organizationPlans).filter((plan) => text(plan.rootGoalId) === rootId).reduce((sum, plan) => sum + (number(plan.totalSettledCost) ?? 0), 0) : usedCost;
  return {
    budgetId: id,
    rootGoalId: rootId,
    budgetScopeId: text(attempts[0] && row(attempts[0].budget)?.budgetScopeId),
    maxSteps,
    usedSteps,
    reservedSteps,
    remainingSteps: maxSteps === null ? null : Math.max(0, maxSteps - usedSteps - reservedSteps),
    maxTokens,
    usedTokens,
    reservedTokens,
    remainingTokens: maxTokens === null ? null : Math.max(0, maxTokens - usedTokens - reservedTokens),
    maxCost,
    usedCost,
    reservedCost,
    settledCost,
    remainingCost: maxCost === null ? null : Math.max(0, maxCost - reservedCost),
    activeChildren: number(root?.activeChildren),
    totalChildCreations: number(root?.totalChildCreations),
    childAllocations: attempts.slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.budgetSettlements).map((attempt) => {
      const budget = row(attempt.budget);
      const task = rows(observer.runs).find((run) => text(run.runId) === text(attempt.runId));
      return {
        attemptId: text(attempt.attemptId) ?? 'unknown-attempt',
        agentId: text(attempt.agentId) ?? 'unknown-agent',
        taskId: task ? text(task.taskId) : null,
        reservedSteps: number(budget?.reservedSteps) ?? 0,
        reservedTokens: number(budget?.reservedTokens) ?? 0,
        reservedCost: number(budget?.reservedDollars) ?? 0,
        settledCost: number(budget?.usedDollars) ?? 0,
        status: text(attempt.status) ?? 'unknown',
      };
    }),
  };
}

function detailFreshness(observer: AgentModeObserverProjection, now: string): AgentModeConsoleDetailFreshness {
  if (observer.availability === 'unavailable') return { status: 'unavailable', sourceStatus: 'unavailable', generatedAt: now, stateStorePresent: false, message: 'Agent Mode StateStore is unavailable; no durable detail was read.' };
  return { status: 'fresh', sourceStatus: 'available', generatedAt: now, stateStorePresent: observer.persistence.databasePresent, message: 'Detail derived from the durable Agent Mode StateStore observer.' };
}

function response(observer: AgentModeObserverProjection, now: string, kind: AgentModeConsoleDetailKind, id: string, detail: AgentModeConsoleDetail | null): AgentModeConsoleDetailResponse {
  const freshness = detailFreshness(observer, now);
  if (observer.availability === 'unavailable') return { schemaVersion: AGENT_MODE_CONSOLE_DETAIL_VERSION, generatedAt: now, source: 'agent-mode-state-store', freshness, kind, id, status: 'unavailable', reasonCode: 'STATESTORE_UNAVAILABLE', detail: null };
  if (!detail) return { schemaVersion: AGENT_MODE_CONSOLE_DETAIL_VERSION, generatedAt: now, source: 'agent-mode-state-store', freshness, kind, id, status: 'not_found', reasonCode: 'DETAIL_NOT_FOUND', detail: null };
  return { schemaVersion: AGENT_MODE_CONSOLE_DETAIL_VERSION, generatedAt: now, source: 'agent-mode-state-store', freshness, kind, id, status: 'available', detail };
}

function buildDetail(observer: AgentModeObserverProjection, now: string, kind: AgentModeConsoleDetailKind, id: string): AgentModeConsoleDetail | null {
  const agents = rows(observer.agents);
  const tasks = rows(observer.tasks);
  const runs = rows(observer.runs);
  const attempts = rows(observer.attempts);
  const agentById = (value: string | null) => value ? byId(agents, 'agentId', value) : null;
  const runByTask = (value: string | null) => value ? byId(runs, 'taskId', value) : null;
  const attemptByRun = (value: string | null) => value ? byId(attempts, 'runId', value) : null;

  if (kind === 'agent') {
    const agent = byId(agents, 'agentId', id);
    if (!agent) return null;
    const relation = relatedOrganization(observer, id);
    const children = agents.filter((candidate) => text(candidate.parentAgentId) === id).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.children);
    const relatedTasks = tasks.map((task) => ({ task, run: runByTask(text(task.taskId)) })).filter(({ run }) => text(run?.agentId) === id).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.tasks);
    const relatedAttempts = attempts.filter((attempt) => text(attempt.agentId) === id).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.attempts);
    const attempt = relatedAttempts[0] ?? null;
    const rootGoalId = text(agent.rootGoalId);
    return {
      kind, agentId: id, rootGoalId, parentAgentId: text(agent.parentAgentId), organizationPlanId: relation?.planId ?? null, workItemId: relation?.workItemId ?? null,
      organizationRoleId: relation?.roleId ?? null, roleTemplateId: text(agent.roleTemplateId), lifecycleStatus: text(agent.status) ?? 'unknown', depth: number(agent.spawnDepth) ?? number(agent.depth),
      deadline: text(agent.expiresAt), cancellationState: text(agent.cancellationStatus), killState: text(agent.killState), childCount: children.length,
      activeChildCount: children.filter((child) => !terminal(text(child.status))).length,
      children: children.map((child) => ({ agentId: text(child.agentId) ?? 'unknown-agent', parentAgentId: text(child.parentAgentId), status: text(child.status) ?? 'unknown', depth: number(child.spawnDepth) ?? number(child.depth), updatedAt: text(child.childCreatedAt) })),
      relatedTasks: relatedTasks.map(({ task, run }) => ({ taskId: text(task.taskId) ?? 'unknown-task', runId: text(run?.runId), attemptId: text(attemptByRun(text(run?.runId))?.attemptId), status: text(task.status) ?? 'unknown', updatedAt: text(task.createdAt) })),
      relatedAttempts: relatedAttempts.map((candidate) => ({ attemptId: text(candidate.attemptId) ?? 'unknown-attempt', runId: text(candidate.runId) ?? 'unknown-run', status: text(candidate.status) ?? 'unknown', uncertaintyState: text(candidate.status) === 'uncertain' ? 'uncertain' : null, cancellationState: text(candidate.cancellationStatus), updatedAt: text(candidate.updatedAt) ?? text(candidate.createdAt) })),
      runtime: attempt ? lifecycle(observer, attempt, relatedTasks[0] ? text(relatedTasks[0].task.taskId) : null, text(attempt.runId)) : null,
      budget: budgetDetail(observer, rootGoalId ?? '', rootGoalId),
    };
  }

  if (kind === 'task') {
    const task = byId(tasks, 'taskId', id);
    if (!task) return null;
    const run = runByTask(id);
    const attempt = attemptByRun(text(run?.runId));
    const agent = agentById(text(run?.agentId));
    const taskLifecycle = lifecycle(observer, attempt, id, text(run?.runId));
    return { kind, taskId: id, taskType: text(task.taskType), taskSpecRef: text(task.taskSpecRef), inputHash: text(task.inputHash), rootGoalId: text(agent?.rootGoalId), agentId: text(run?.agentId), parentAgentId: text(agent?.parentAgentId), status: text(task.status) ?? 'unknown', createdAt: text(task.createdAt), lifecycle: taskLifecycle };
  }

  if (kind === 'run') {
    const run = byId(runs, 'runId', id);
    if (!run) return null;
    const attempt = attemptByRun(id);
    const agent = agentById(text(run.agentId));
    return { kind, runId: id, taskId: text(run.taskId) ?? 'unknown-task', agentId: text(run.agentId), rootGoalId: text(agent?.rootGoalId), status: text(run.status) ?? 'unknown', createdAt: text(run.createdAt), lifecycle: lifecycle(observer, attempt, text(run.taskId), id) };
  }

  if (kind === 'attempt') {
    const attempt = byId(attempts, 'attemptId', id);
    if (!attempt) return null;
    const run = byId(runs, 'runId', text(attempt.runId) ?? '');
    const agent = agentById(text(attempt.agentId));
    const evidence = evidenceForAttempt(observer, id);
    const runtime = lifecycle(observer, attempt, text(run?.taskId), text(run?.runId));
    return { kind, attemptId: id, runId: text(attempt.runId) ?? 'unknown-run', taskId: text(run?.taskId), agentId: text(attempt.agentId) ?? 'unknown-agent', rootGoalId: text(agent?.rootGoalId), status: text(attempt.status) ?? 'unknown', runtimeRef: text(attempt.runtimeRef), runtimeProfileRef: text(attempt.runtimeProfileRef), modelRef: text(attempt.modelRef), route: text(attempt.routeRef), cancellationState: text(attempt.cancellationStatus), uncertaintyState: runtime.uncertaintyState, startedAt: runtime.startedAt, updatedAt: runtime.updatedAt, completedAt: runtime.completedAt, budget: attemptBudget(observer, id) ? budgetDetail(observer, text(attemptBudget(observer, id)?.budgetScopeId) ?? id, text(agent?.rootGoalId)) : null, runtime, evidence };
  }

  const organizationRows = rows(observer.organizationPlans);
  if (kind === 'organization') {
    const plan = byId(organizationRows, 'organizationPlanId', id);
    if (!plan) return null;
    const itemRows = rows(observer.organizationWorkItems).filter((item) => text(item.organizationPlanId) === id).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.workItems);
    const itemStatus = new Map(itemRows.map((item) => [text(item.workItemKey) ?? '', text(item.readiness) ?? text(item.readinessState) ?? 'unknown']));
    const workItems = itemRows.map((item) => {
      const dependencies = arrayOfText(item.dependencyKeys, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.dependencies).map((workItemKey) => ({ workItemKey, dependencyType: 'requires_success', status: itemStatus.get(workItemKey) ?? 'unknown' }));
      const attemptId = text(item.attemptId);
      const evidence = attemptId ? evidenceForAttempt(observer, attemptId) : [];
      return { workItemId: text(item.workItemId) ?? 'unknown-work-item', workItemKey: text(item.workItemKey) ?? 'unknown', organizationRoleId: text(item.organizationRoleId) ?? 'unknown', dependencies, readiness: text(item.readiness) ?? text(item.readinessState) ?? 'unknown', delegationState: text(item.delegationState) ?? 'unknown', childAgentId: text(item.childAgentId) ?? text(item.boundChildAgentId), taskId: text(item.taskId) ?? text(item.boundTaskId), runId: text(item.runId), attemptId, terminalStatus: text(item.terminalStatus), resultRef: text(item.resultRef), evidenceRefs: evidence.map((entry) => entry.evidenceRef).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.evidenceRefs), settledCost: number(item.settledCost) ?? 0 };
    }).sort((a, b) => a.workItemKey.localeCompare(b.workItemKey));
    const final = rows(observer.organizationFinalResults).find((result) => text(result.organizationPlanId) === id);
    return { kind, organizationPlanId: id, rootGoalId: text(plan.rootGoalId) ?? 'unknown-root', supervisorAgentId: text(plan.supervisorAgentId) ?? 'unknown-supervisor', supervisorOrganizationRoleId: text(plan.supervisorOrganizationRoleId) ?? 'unknown-role', planVersion: number(plan.planVersion), status: text(plan.status) ?? 'unknown', readiness: text(plan.readinessState) ?? 'unknown', deadline: text(plan.deadline), workItems, finalResult: final ? { finalResultId: text(final.organizationFinalResultId) ?? 'unknown-final-result', status: text(final.status) ?? 'unknown', auditorWorkItemId: text(final.auditorWorkItemId), auditorResultRef: text(final.auditorResultRef), aggregateDigest: text(final.aggregateDigest), totalSettledCost: number(final.totalSettledCost) ?? 0, finalizedAt: text(final.finalizedAt) } : null };
  }

  if (kind === 'budget') {
    return budgetDetail(observer, id) ? { kind, ...budgetDetail(observer, id) as AgentModeConsoleDetailBudget } : null;
  }

  if (kind === 'schedule') {
    const schedule = rows(observer.schedulerSchedules).find((value) => text(value.scheduleId) === id);
    if (!schedule) return null;
    const history = rows(observer.schedulerEvents).filter((event) => text(event.correlationId) === text(schedule.correlationId) || text(event.scheduleId) === id).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.schedulerHistory).map((event) => ({ eventId: text(event.eventId) ?? 'unknown-event', status: text(event.status) ?? 'unknown', occurredAt: text(event.createdAt), reasonCode: text(event.lastFailure) }));
    return { kind, scheduleId: id, eventIdentity: text(schedule.deduplicationKey), enabled: !['disabled', 'dead_letter'].includes(text(schedule.status) ?? ''), sourceType: text(schedule.kind), status: text(schedule.status) ?? 'unknown', nextDueAt: text(schedule.dueAt), nextEligibleAt: text(schedule.nextEligibleAt), latestDispatch: history[0] ? { eventId: history[0].eventId, status: history[0].status, occurredAt: history[0].occurredAt } : null, latestTerminalResult: text(schedule.completedAt) ? 'completed' : text(schedule.deadLetteredAt) ? 'dead_letter' : null, retryState: { attemptCount: number(schedule.attemptCount) ?? 0, maxAttempts: number(schedule.maxAttempts) ?? 0, lastFailure: text(schedule.lastFailure) }, deadLetterCount: text(schedule.deadLetteredAt) ? 1 : 0, deadline: text(schedule.deadline), rootGoalId: text(schedule.rootGoalId), history };
  }

  const evidence = [...rows(observer.runtimeDispatches).flatMap((dispatch) => {
    const attemptId = text(dispatch.attemptId);
    return attemptId ? evidenceForAttempt(observer, attemptId) : [];
  }), ...rows(observer.operations).flatMap((operation) => {
    const attemptId = text(operation.attemptId);
    return attemptId ? evidenceForAttempt(observer, attemptId) : [];
  })].filter((value, index, all) => all.findIndex((candidate) => candidate.evidenceRef === value.evidenceRef) === index);
  if (kind === 'evidence') return evidence.find((value) => value.evidenceRef === id || value.evidenceRef === canonicalEvidenceRef(id)) ? { kind, ...evidence.find((value) => value.evidenceRef === id || value.evidenceRef === canonicalEvidenceRef(id)) as AgentModeConsoleDetailEvidence } : null;

  if (kind === 'failure') {
    const attempt = byId(attempts, 'attemptId', id);
    const orgItem = rows(observer.organizationWorkItems).find((item) => text(item.workItemId) === id);
    const schedule = rows(observer.schedulerSchedules).find((item) => text(item.scheduleId) === id);
    const target = attempt ?? orgItem ?? schedule;
    if (!target) return null;
    const objectType = attempt ? 'attempt' : orgItem ? 'organization-work-item' : 'schedule';
    const status = text(target.status) ?? text(target.readiness) ?? 'unknown';
    const attemptRun = attempt ? byId(runs, 'runId', text(attempt.runId) ?? '') : null;
    const agent = attempt ? agentById(text(attempt.agentId)) : null;
    const organizationPlan = orgItem ? byId(organizationRows, 'organizationPlanId', text(orgItem.organizationPlanId) ?? '') : null;
    const uncertain = status === 'uncertain' || text(target.reconciliationStatus) === 'pending';
    const eventRows = rows(observer.events).filter((event) => text(event.entityId) === id).slice(0, AGENT_MODE_CONSOLE_DETAIL_BOUNDS.failureEvents);
    return { kind, objectType, objectId: id, rootGoalId: text(agent?.rootGoalId) ?? text(target.rootGoalId) ?? text(organizationPlan?.rootGoalId), agentId: text(attempt?.agentId), taskId: text(attemptRun?.taskId), runId: text(attempt?.runId), attemptId: text(attempt?.attemptId), status, reasonCode: uncertain ? 'UNCERTAIN_RUNTIME' : status === 'dependency_failed' ? 'DEPENDENCY_FAILED' : `DURABLE_${status.toUpperCase()}`, reasonMessage: uncertain ? 'Runtime effect is uncertain and cannot be blindly replayed.' : status === 'dependency_failed' ? 'A required predecessor did not succeed.' : `Durable object state is ${status}.`, uncertaintyClassification: uncertain ? 'uncertain_non_idempotent_effect' : null, updatedAt: text(target.updatedAt) ?? text(target.createdAt), evidenceRefs: attempt ? evidenceForAttempt(observer, id).map((entry) => entry.evidenceRef) : [], reconciliationState: uncertain ? text(target.reconciliationStatus) ?? 'pending' : null, relatedEvents: eventRows.map((event) => ({ eventId: text(event.eventId) ?? 'unknown-event', eventType: text(event.eventType) ?? 'unknown', occurredAt: text(event.occurredAt) ?? now, reasonCode: text(row(event.payload)?.reasonCode) })) };
  }
  return null;
}

export function isAgentModeConsoleDetailKind(value: string): value is AgentModeConsoleDetailKind {
  return (AGENT_MODE_CONSOLE_DETAIL_KINDS as readonly string[]).includes(value);
}

export function buildAgentModeConsoleDetail(observer: AgentModeObserverProjection, kind: AgentModeConsoleDetailKind, id: string, now: string): AgentModeConsoleDetailResponse {
  return response(observer, now, kind, id, buildDetail(observer, now, kind, id));
}

export function readAgentModeConsoleDetail(kind: AgentModeConsoleDetailKind, id: string, now = new Date().toISOString(), databasePath = defaultAgentModeDatabasePath()): AgentModeConsoleDetailResponse {
  const observer = readAgentModeObserver(now, databasePath);
  return buildAgentModeConsoleDetail(observer, kind, id, now);
}
