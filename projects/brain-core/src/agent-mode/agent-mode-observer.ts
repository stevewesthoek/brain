import {
  defaultAgentModeDatabasePath,
  AgentModeSqliteStateStore,
  type AgentModeEvent,
} from './sqlite-state-store.js';

export const AGENT_MODE_OBSERVER_VERSION = 'agent-mode-observer-v1';

export type AgentModeObserverProjection = {
  version: typeof AGENT_MODE_OBSERVER_VERSION;
  source: 'agent-mode-state-store';
  availability: 'available' | 'empty' | 'unavailable';
  generatedAt: string;
  persistence: { databasePresent: boolean };
  summary: {
    agentCount: number;
    taskCount: number;
    runCount: number;
    attemptCount: number;
    activeRunCount: number;
    blockedOrUncertainCount: number;
    recentEventCount: number;
    cancellationCount: number;
    recoveryCount: number;
    workcellCount: number;
    workcellWriteCount: number;
    workcellValidationCount: number;
    verifiedWorkcellResultCount: number;
    workcellDiffCount: number;
    activeWorkcellWriterLeaseCount: number;
    reviewRequestCount: number;
    reviewDecisionCount: number;
    targetRefLeaseCount: number;
    commitOperationCount: number;
    mergeApprovalCount: number;
    mergeOperationCount: number;
    mergeReceiptCount: number;
    schedulerEventCount: number;
    schedulerScheduleCount: number;
    schedulerPendingCount: number;
    schedulerClaimedCount: number;
    schedulerDeadLetterCount: number;
    eventSourceCount: number;
    failedEventSourceCount: number;
    resultCount: number;
    organizationPlanCount: number;
    organizationWorkItemCount: number;
    executionSource: 'agent-mode-state-store' | 'none';
    nextSafeState: string;
  };
  agents: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  recovery: Array<Record<string, unknown>>;
  operations: Array<Record<string, unknown>>;
  runtimeDispatches: Array<Record<string, unknown>>;
  workcells: Array<Record<string, unknown>>;
  workcellWrites: Array<Record<string, unknown>>;
  workcellValidations: Array<Record<string, unknown>>;
  workcellLeases: Array<Record<string, unknown>>;
  workcellDiffs: Array<Record<string, unknown>>;
  results: Array<Record<string, unknown>>;
  reviewRequests: Array<Record<string, unknown>>;
  reviewDecisions: Array<Record<string, unknown>>;
  targetRefLeases: Array<Record<string, unknown>>;
  commitOperations: Array<Record<string, unknown>>;
  mergeApprovals: Array<Record<string, unknown>>;
  mergeOperations: Array<Record<string, unknown>>;
  mergeReceipts: Array<Record<string, unknown>>;
  schedulerEvents: Array<Record<string, unknown>>;
  schedulerSchedules: Array<Record<string, unknown>>;
  sourceWatermarks: Array<Record<string, unknown>>;
  latestSchedulerTick: Record<string, unknown> | null;
  eventSources: Array<Record<string, unknown>>;
  hostHealthStates: Array<Record<string, unknown>>;
  ciWorkflowStates: Array<Record<string, unknown>>;
  spawnAdmissionControls: Array<Record<string, unknown>>;
  spawnRootStates: Array<Record<string, unknown>>;
  childAssignments: Array<Record<string, unknown>>;
  modelOperations: Array<Record<string, unknown>>;
  dynamicWorkerOrchestrations: Array<Record<string, unknown>>;
  organizationPlans: Array<Record<string, unknown>>;
  organizationWorkItems: Array<Record<string, unknown>>;
};

function safePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/(auth|proof|token|secret|password|credential|private|provider.?payload)/i.test(key)) {
      result[key] = '[redacted]';
    } else if (typeof value === 'string' && (/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(value) || value.includes('://'))) {
      result[key] = '[redacted]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = safePayload(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function mapEvent(event: AgentModeEvent): Record<string, unknown> {
  return {
    eventId: event.eventId,
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    payload: safePayload(event.payload),
  };
}

function mapHostHealthStates(eventSources: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const states: Array<Record<string, unknown>> = [];
  for (const source of eventSources) {
    if (source.sourceType !== 'infrastructure.host-health' || typeof source.watermark !== 'string') continue;
    try {
      const cursor = JSON.parse(source.watermark) as { version?: unknown; states?: unknown };
      if (cursor.version !== 1 || !Array.isArray(cursor.states)) continue;
      for (const state of cursor.states.slice(0, 500)) {
        if (!state || typeof state !== 'object') continue;
        const value = state as Record<string, unknown>;
        states.push({ sourceId: source.sourceId, resourceId: value.resourceId, providerId: value.providerId, bindingId: value.bindingId, status: value.status, freshness: value.freshness, conditionCodes: Array.isArray(value.conditionCodes) ? value.conditionCodes.slice(0, 32) : [], observedAt: value.observedAt, lastTransitionAt: value.lastTransitionAt ?? null });
      }
    } catch { /* malformed source state remains visible through source error status */ }
  }
  return states;
}

function mapCiWorkflowStates(eventSources: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const states: Array<Record<string, unknown>> = [];
  for (const source of eventSources) {
    if (source.sourceType !== 'ci.workflow-run' || typeof source.watermark !== 'string') continue;
    try {
      const cursor = JSON.parse(source.watermark) as { version?: unknown; states?: unknown };
      if (cursor.version !== 1 || !Array.isArray(cursor.states)) continue;
      for (const state of cursor.states.slice(0, 500)) {
        if (!state || typeof state !== 'object') continue;
        const value = state as Record<string, unknown>;
        states.push(safePayload({ sourceId: source.sourceId, providerId: value.providerId, repositoryRef: value.repositoryRef, workflowId: value.workflowId, workflowName: value.workflowName, runId: value.runId, attempt: value.attempt, headSha: value.headSha, status: value.status, conclusion: value.conclusion, queuedAt: value.queuedAt ?? null, startedAt: value.startedAt ?? null, completedAt: value.completedAt ?? null, lastEmittedPhase: value.lastEmittedPhase ?? null }));
      }
    } catch { /* malformed source state remains visible through source error status */ }
  }
  return states;
}

export function readAgentModeObserver(now = new Date().toISOString(), databasePath = defaultAgentModeDatabasePath()): AgentModeObserverProjection {
  const store = AgentModeSqliteStateStore.openExisting(databasePath);
  if (!store) {
    return {
      version: AGENT_MODE_OBSERVER_VERSION,
      source: 'agent-mode-state-store',
      availability: 'unavailable',
      generatedAt: now,
      persistence: { databasePresent: false },
      summary: {
        agentCount: 0,
        taskCount: 0,
        runCount: 0,
        attemptCount: 0,
        activeRunCount: 0,
        blockedOrUncertainCount: 0,
        recentEventCount: 0,
        cancellationCount: 0,
        recoveryCount: 0,
        workcellCount: 0,
        workcellWriteCount: 0,
        workcellValidationCount: 0,
        verifiedWorkcellResultCount: 0,
        workcellDiffCount: 0,
        activeWorkcellWriterLeaseCount: 0,
        reviewRequestCount: 0, reviewDecisionCount: 0, targetRefLeaseCount: 0, commitOperationCount: 0, mergeApprovalCount: 0, mergeOperationCount: 0, mergeReceiptCount: 0,
        schedulerEventCount: 0, schedulerScheduleCount: 0, schedulerPendingCount: 0, schedulerClaimedCount: 0, schedulerDeadLetterCount: 0,
        eventSourceCount: 0, failedEventSourceCount: 0,
        resultCount: 0,
        organizationPlanCount: 0, organizationWorkItemCount: 0,
        executionSource: 'none',
        nextSafeState: 'No Agent Mode StateStore exists; no execution history is available.',
      },
      agents: [], tasks: [], runs: [], attempts: [], events: [], recovery: [], operations: [], runtimeDispatches: [], modelOperations: [], workcells: [], workcellWrites: [], workcellValidations: [], workcellLeases: [], workcellDiffs: [], results: [], reviewRequests: [], reviewDecisions: [], targetRefLeases: [], commitOperations: [], mergeApprovals: [], mergeOperations: [], mergeReceipts: [], schedulerEvents: [], schedulerSchedules: [], sourceWatermarks: [], latestSchedulerTick: null, eventSources: [], hostHealthStates: [], ciWorkflowStates: [], spawnAdmissionControls: [], spawnRootStates: [], childAssignments: [], dynamicWorkerOrchestrations: [], organizationPlans: [], organizationWorkItems: [],
    };
  }

  try {
    const agents = store.listAgents().map((agent) => ({ ...agent }));
    const tasks = store.listTasks().map((task) => ({ ...task }));
    const runs = store.listRuns().map((run) => ({
      runId: run.runId,
      taskId: run.taskId,
      agentId: run.agentId,
      createdAt: run.createdAt,
      status: run.status,
      ...(run.runtimePid === undefined ? {} : { runtimePid: run.runtimePid }),
      ...(run.childAgentId === undefined ? {} : { childAgentId: run.childAgentId }),
      ...(run.assignmentIntentKey === undefined ? {} : { assignmentIntentKey: run.assignmentIntentKey }),
      ...(run.runtimeIdentity ? {
        runtimeIdentity: { startedAt: run.runtimeIdentity.startedAt, command: run.runtimeIdentity.command, verified: true },
      } : {}),
    }));
    const attempts = store.listAttempts().map((attempt) => {
      const lease = attempt.leaseResourceKey ? store.getLease(attempt.leaseResourceKey) : undefined;
      const currentLease = Boolean(lease && lease.leaseId === attempt.leaseId && lease.fence === attempt.leaseFence && lease.expiresAt > now);
      const budget = store.getBudget(attempt.budgetScopeId);
      return {
        attemptId: attempt.attemptId,
        runId: attempt.runId,
        agentId: attempt.agentId,
        runtimeRef: attempt.runtimeRef,
        routeRef: attempt.routeRef,
        modelRef: attempt.modelRef,
        policyVersion: attempt.policyVersion,
        status: attempt.status,
        cancellationStatus: attempt.cancellationStatus,
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
        budget: budget ? {
          budgetScopeId: budget.budgetScopeId,
          maxSteps: budget.maxSteps,
          usedSteps: budget.usedSteps,
          reservedSteps: budget.reservedSteps,
          maxTokens: budget.maxTokens,
          usedTokens: budget.usedTokens,
          reservedTokens: budget.reservedTokens,
          maxDollars: budget.maxDollars,
          usedDollars: budget.usedDollars,
          reservedDollars: budget.reservedDollars,
        } : undefined,
        lease: lease ? {
          resourceKey: lease.resourceKey,
          leaseId: lease.leaseId,
          fence: lease.fence,
          expiresAt: lease.expiresAt,
          current: currentLease,
        } : undefined,
      };
    });
    const events = store.listRecentEvents(100).map(mapEvent);
    const workcells = store.listWorkcells().map((workcell) => ({
      workcellId: workcell.workcellId, taskId: workcell.taskId, runId: workcell.runId, attemptId: workcell.attemptId,
      repositoryRef: workcell.repositoryRef, branch: workcell.branch, ownerAgent: workcell.ownerAgent,
      baseRef: workcell.baseRef, status: workcell.status, createdAt: workcell.createdAt, updatedAt: workcell.updatedAt,
      repositoryRoot: '[redacted]', worktreePath: '[redacted]',
    }));
    const workcellWrites = store.listWorkcellMutations().map((mutation) => ({
      operationId: mutation.operationId, taskId: mutation.taskId, runId: mutation.runId, attemptId: mutation.attemptId,
      workcellId: mutation.workcellId, repositoryRef: mutation.repositoryRef, relativePath: mutation.relativePath,
      expectedPreimageHash: mutation.expectedPreimageHash, preimageHash: mutation.preimageHash, replacementHash: mutation.replacementHash,
      postimageHash: mutation.postimageHash, status: mutation.status, createdAt: mutation.createdAt, updatedAt: mutation.updatedAt,
    }));
    const workcellValidations = store.listWorkcellValidationRuns().map((validation) => ({
      validationId: validation.validationId, taskId: validation.taskId, runId: validation.runId, attemptId: validation.attemptId,
      workcellId: validation.workcellId, repositoryRef: validation.repositoryRef, validatorProfile: validation.validatorProfile,
      diffId: validation.diffId, status: validation.status, result: validation.result, evidenceHash: validation.evidenceHash,
      startedAt: validation.startedAt, completedAt: validation.completedAt, updatedAt: validation.updatedAt,
    }));
    const workcellLeases = store.listWorkcells().flatMap((workcell) => store.listWorkcellWriterLeases(workcell.workcellId).map((lease) => ({
      leaseId: lease.leaseId, workcellId: lease.workcellId, ownerAgent: lease.ownerAgent, ownerAttempt: lease.ownerAttempt,
      createdAt: lease.createdAt, expiresAt: lease.expiresAt, fenceToken: lease.fenceToken, status: lease.status,
      current: lease.status === 'active' && Date.parse(lease.expiresAt) > Date.parse(now),
    })));
    const workcellDiffs = store.listWorkcellDiffs().map((diff) => ({
      diffId: diff.diffId, taskId: diff.taskId, runId: diff.runId, attemptId: diff.attemptId, workcellId: diff.workcellId,
      repositoryRef: diff.repositoryRef, branch: diff.branch, baseRevision: diff.baseRevision, currentRevision: diff.currentRevision,
      changedFiles: diff.changedFiles, diffHash: diff.diffHash, capturedAt: diff.capturedAt,
    }));
    const reviewRequests = store.listReviewRequests().map((request) => ({ ...request }));
    const reviewDecisions = store.listReviewDecisions().map((decision) => ({ ...decision }));
    const targetRefLeases = store.listTargetRefLeases().map((lease) => ({ ...lease }));
    const commitOperations = store.listCommitOperations().map((operation) => ({ ...operation }));
    const mergeApprovals = store.listMergeApprovals().map((approval) => ({ ...approval }));
    const mergeOperations = store.listMergeOperations().map((operation) => ({ ...operation }));
    const mergeReceipts = store.listMergeReceipts().map((receipt) => ({ ...receipt }));
    const schedulerEvents = store.listSchedulerEvents(500).map((event) => ({ ...event, payload: safePayload(event.payload) }));
    const schedulerSchedules = store.listSchedulerSchedules(500).map((schedule) => ({ ...schedule, payload: safePayload(schedule.payload) }));
    const sourceWatermarks = store.listSourceWatermarks().map((watermark) => ({ ...watermark }));
    const latestSchedulerTick = store.getLatestSchedulerTick() ? { ...store.getLatestSchedulerTick() } : null;
    const eventSources = store.listEventSources().map((source) => ({ ...source }));
    const hostHealthStates = mapHostHealthStates(eventSources);
    const ciWorkflowStates = mapCiWorkflowStates(eventSources);
    const spawnAdmissionControls = store.listSpawnAdmissionControls().slice(0, 32).map((control) => ({
      scope: control.scope,
      rootGoalId: control.rootGoalId,
      denied: control.denied,
      reason: control.reason,
      updatedAt: control.updatedAt,
    }));
    const spawnRootStates = store.listSpawnRootStates().slice(0, 32).map((root) => ({
      rootGoalId: root.rootGoalId,
      policyId: root.policyId,
      policyVersion: root.policyVersion,
      maxConcurrentChildren: root.maxConcurrentChildren,
      maxTotalChildCreations: root.maxTotalChildCreations,
      maxAggregateChildSteps: root.maxAggregateChildSteps,
      maxAggregateChildCost: root.maxAggregateChildCost,
      activeChildren: root.activeChildren,
      totalChildCreations: root.totalChildCreations,
      reservedChildSteps: root.reservedChildSteps,
      reservedChildCost: root.reservedChildCost,
      depth: root.depth,
      cancellation: root.cancellation,
      deadline: root.deadline,
      updatedAt: root.updatedAt,
    }));
    const childAssignments = store.listChildAssignments(32).map((assignment) => ({
      assignmentIntentKey: assignment.assignmentIntentKey,
      childAgentId: assignment.childAgentId,
      taskId: assignment.taskId,
      runId: assignment.runId,
      attemptId: assignment.attemptId,
      rootGoalId: assignment.rootGoalId,
      sourceEventId: assignment.sourceEventId,
      runtimeRef: assignment.runtimeRef,
      runtimeProfileRef: assignment.runtimeProfileRef,
      status: assignment.status,
      deadline: assignment.deadline,
      stepCeiling: assignment.requestedSteps,
      costCeiling: assignment.requestedCost,
      tokenCeiling: assignment.requestedTokens,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    }));
    const organizationPlans: Array<Record<string, unknown>> = [];
    const organizationWorkItems: Array<Record<string, unknown>> = [];
    for (const plan of store.listOrganizationPlans(16)) {
      const readiness = store.readOrganizationPlanReadiness(plan.organizationPlanId, now);
      organizationPlans.push({
        organizationPlanId: plan.organizationPlanId, rootGoalId: plan.rootGoalId, supervisorAgentId: plan.supervisorAgentId,
        supervisorOrganizationRoleId: plan.supervisorOrganizationRoleId, status: plan.status, workItemCount: plan.workItems.length,
        dependencyCount: plan.dependencies.length, planVersion: plan.planVersion, createdAt: plan.createdAt, deadline: plan.deadline,
        readinessState: readiness?.planState ?? 'blocked',
      });
      const readinessById = new Map((readiness?.workItems ?? []).map((item) => [item.workItemId, item.state]));
      for (const item of store.listOrganizationWorkItems(plan.organizationPlanId).slice(0, 16)) {
        organizationWorkItems.push({
          organizationPlanId: plan.organizationPlanId, workItemId: item.workItemId, workItemKey: item.workItemKey,
          organizationRoleId: item.organizationRoleId, dependencyCount: item.dependencyKeys.length,
          readinessState: readinessById.get(item.workItemId) ?? 'blocked', boundChildAgentId: item.boundChildAgentId, boundTaskId: item.boundTaskId,
        });
      }
    }
    const dynamicWorkerOrchestrations = events
      .filter((event) => event.eventType === 'scheduler_worker_orchestrated')
      .reduce<Array<Record<string, unknown>>>((latest, event) => {
        const payload = event.payload as Record<string, unknown>;
        const schedulerEventId = typeof payload.schedulerEventId === 'string' ? payload.schedulerEventId : event.entityId;
        const priorIndex = latest.findIndex((item) => item.schedulerEventId === schedulerEventId);
        const projection = {
          schedulerEventId,
          actionRuleId: payload.actionRuleId ?? null,
          actionRuleVersion: payload.actionRuleVersion ?? null,
          actionRuleApplicationId: payload.actionRuleApplicationId ?? null,
          spawnIntentKey: payload.spawnIntentKey ?? null,
          childAgentId: payload.childAgentId ?? null,
          assignmentIntentKey: payload.assignmentIntentKey ?? null,
          taskId: payload.taskId ?? null,
          runId: payload.runId ?? null,
          attemptId: payload.attemptId ?? null,
          operationId: payload.operationId ?? null,
          dispatchId: payload.dispatchId ?? null,
          phase: payload.phase ?? null,
          terminalWorkerOutcome: payload.terminalWorkerOutcome ?? null,
          reasonCode: payload.reasonCode ?? null,
          occurredAt: event.occurredAt,
        };
        if (priorIndex >= 0) latest[priorIndex] = projection;
        else latest.push(projection);
        return latest;
      }, []);
    const results = store.listRecentEvents(500).filter((event) => event.eventType === 'jarvis_result_returned').map((event) => {
      const payload = event.payload;
      const usage = payload.usage && typeof payload.usage === 'object' ? payload.usage as Record<string, unknown> : {};
      return {
        eventId: event.eventId, attemptId: event.entityId, taskId: typeof payload.taskId === 'string' ? payload.taskId : undefined,
        runId: typeof payload.runId === 'string' ? payload.runId : undefined, workcellId: typeof payload.workcellId === 'string' ? payload.workcellId : undefined,
        resultHash: typeof payload.resultHash === 'string' ? payload.resultHash : undefined,
        validationResult: typeof payload.validationResult === 'string' ? payload.validationResult : undefined,
        modelTurns: typeof payload.modelTurns === 'number' ? payload.modelTurns : undefined,
        toolCalls: typeof payload.toolCalls === 'number' ? payload.toolCalls : undefined,
        usage: { inputTokens: Number(usage.inputTokens ?? 0), outputTokens: Number(usage.outputTokens ?? 0), totalTokens: Number(usage.totalTokens ?? 0) },
        estimatedCostUsd: typeof payload.actualCostUsd === 'number' ? payload.actualCostUsd : null,
        status: 'returned', occurredAt: event.occurredAt,
      };
    });
    const verified = new Map<string, { resultHash: string; evidenceRef: string }>();
    for (const event of store.listRecentEvents(500)) {
      if (event.eventType === 'operation_verified') {
        verified.set(event.entityId, {
          resultHash: String(event.payload.resultHash ?? ''),
          evidenceRef: String(event.payload.evidenceRef ?? ''),
        });
      }
    }
    const effectsByOperation = new Map(store.listEffects().map((effect) => [effect.operationId, effect]));
    const operations = store.listOutbox().map((outbox) => {
      const verification = verified.get(outbox.operationId);
      return {
        operationId: outbox.operationId,
        attemptId: outbox.attemptId,
        capabilityId: outbox.capabilityId,
        grantId: outbox.grantId,
        scopeHash: outbox.scopeHash,
        policyVersion: outbox.policyVersion,
        state: outbox.state,
        preparedAt: outbox.preparedAt,
        dispatchedAt: outbox.dispatchedAt,
        ...(verification ?? {}),
      };
    });
    const modelOperations = store.listOutbox().filter((outbox) => outbox.effectKind === 'model.invoke').map((outbox) => {
      const effect = effectsByOperation.get(outbox.operationId);
      let receipt: Record<string, unknown> | undefined;
      if (effect?.receiptJson) {
        try {
          const parsed = JSON.parse(effect.receiptJson) as Record<string, unknown>;
          receipt = {
            providerId: parsed.providerId,
            modelRef: parsed.modelRef,
            modelId: parsed.modelId,
            route: parsed.route,
            region: parsed.region,
            operationId: parsed.operationId,
            attemptId: parsed.attemptId,
            requestId: parsed.requestId,
            usage: parsed.usage,
            cost: parsed.cost,
            pricingSource: (parsed.cost as Record<string, unknown> | undefined)?.pricingSource,
            stopReason: parsed.stopReason,
            latencyMs: parsed.latencyMs,
            completedAt: parsed.completedAt,
            accessEvidenceVersion: parsed.accessEvidenceVersion,
          };
        } catch { /* malformed receipt remains visible through dispatch state */ }
      }
      return { operationId: outbox.operationId, attemptId: outbox.attemptId, state: outbox.state, capabilityId: outbox.capabilityId, scopeHash: outbox.scopeHash, policyVersion: outbox.policyVersion, preparedAt: outbox.preparedAt, dispatchedAt: outbox.dispatchedAt, ...(receipt ? { receipt } : {}) };
    });
    const runtimeDispatches = store.listDispatchOutbox().filter((outbox) => outbox.effectKind === 'runtime.dispatch').map((outbox) => {
      const assignment = outbox.childAgentId ? store.getChildAssignment(outbox.childAgentId) : undefined;
      const run = assignment ? store.getRun(assignment.runId) : undefined;
      const attempt = store.getAttempt(outbox.attemptId);
      const processEvents = run ? store.listEvents(run.runId).filter((event) => event.eventType === 'runtime_process_started' || event.eventType === 'runtime_process_reaped') : [];
      const processStartedEvent = processEvents.find((event) => event.eventType === 'runtime_process_started');
      const processEvent = processEvents.filter((event) => event.eventType === 'runtime_process_reaped').at(-1);
      let receipt: Record<string, unknown> | undefined;
      const receiptJson = effectsByOperation.get(outbox.operationId)?.receiptJson;
      if (receiptJson) {
        try {
          const parsed = JSON.parse(receiptJson) as Record<string, unknown>;
          receipt = { status: parsed.status, resultHash: parsed.resultHash, evidenceRef: parsed.evidenceRef, usage: parsed.usage, recordedAt: parsed.recordedAt };
        } catch { /* malformed receipt remains visible through dispatch state */ }
      }
      return {
        operationId: outbox.operationId, dispatchId: outbox.dispatchId, assignmentIntentKey: outbox.assignmentIntentKey,
        childAgentId: outbox.childAgentId, attemptId: outbox.attemptId, runtimeRef: outbox.runtimeRef, runtimeProfileRef: outbox.runtimeProfileRef,
        controllerRef: outbox.controllerRef, resourceKey: outbox.leaseResourceKey, leaseId: outbox.leaseId, fence: outbox.leaseFence,
        state: outbox.state, preparedAt: outbox.preparedAt, dispatchedAt: outbox.dispatchedAt,
        processState: run?.runtimePid === undefined ? (['verified', 'failed', 'cancelled'].includes(outbox.state) ? 'reaped' : 'not_started') : 'running',
        processPid: run?.runtimePid ?? processStartedEvent?.payload.pid ?? null,
        processStartedAt: run?.runtimeIdentity?.startedAt ?? processStartedEvent?.occurredAt ?? null,
        processIdentityVerified: Boolean(run?.runtimeIdentity || processStartedEvent?.payload.processIdentityVerified === true),
        dispatchPhase: outbox.state,
        reconciliationStatus: outbox.state === 'uncertain' ? 'pending' : 'not_required',
        lastExitClassification: processEvent?.payload.exitClassification ?? null,
        cancellationState: attempt?.cancellationStatus ?? 'unknown',
        ...(receipt ? { receipt } : {}),
      };
    });
    const recovery = store.listAttempts().map((attempt) => ({
      attemptId: attempt.attemptId,
      runId: attempt.runId,
      classification: store.classifyRecovery(attempt.attemptId, now),
      status: attempt.status,
      cancellationStatus: attempt.cancellationStatus,
    }));
    const activeRunCount = runs.filter((run) => run.status === 'active').length;
    const blockedOrUncertainCount = recovery.filter((item) => item.classification === 'uncertain_non_idempotent_effect' || item.classification === 'stale_fenced_writer' || item.classification === 'cancelled_ack_pending').length;
    return {
      version: AGENT_MODE_OBSERVER_VERSION,
      source: 'agent-mode-state-store',
      availability: agents.length || tasks.length || runs.length || attempts.length || events.length || organizationPlans.length ? 'available' : 'empty',
      generatedAt: now,
      persistence: { databasePresent: true },
      summary: {
        agentCount: agents.length,
        taskCount: tasks.length,
        runCount: runs.length,
        attemptCount: attempts.length,
        activeRunCount,
        blockedOrUncertainCount,
        recentEventCount: events.length,
        cancellationCount: attempts.filter((attempt) => attempt.cancellationStatus !== 'running').length,
        recoveryCount: recovery.length,
        workcellCount: workcells.length,
        workcellWriteCount: workcellWrites.length,
        workcellValidationCount: workcellValidations.length,
        verifiedWorkcellResultCount: workcellValidations.filter((validation) => validation.result === 'passed').length,
        workcellDiffCount: workcellDiffs.length,
        activeWorkcellWriterLeaseCount: workcellLeases.filter((lease) => lease.current).length,
        reviewRequestCount: reviewRequests.length,
        reviewDecisionCount: reviewDecisions.length,
        targetRefLeaseCount: targetRefLeases.length,
        commitOperationCount: commitOperations.length,
        mergeApprovalCount: mergeApprovals.length,
        mergeOperationCount: mergeOperations.length,
        mergeReceiptCount: mergeReceipts.length,
        schedulerEventCount: schedulerEvents.length,
        schedulerScheduleCount: schedulerSchedules.length,
        schedulerPendingCount: [...schedulerEvents, ...schedulerSchedules].filter((item) => item.status === 'pending' || item.status === 'failed').length,
        schedulerClaimedCount: [...schedulerEvents, ...schedulerSchedules].filter((item) => item.status === 'claimed').length,
        schedulerDeadLetterCount: [...schedulerEvents, ...schedulerSchedules].filter((item) => item.status === 'dead_letter').length,
        eventSourceCount: eventSources.length,
        failedEventSourceCount: eventSources.filter((source) => source.status === 'failed' || source.status === 'diverged').length,
        resultCount: results.length,
        organizationPlanCount: organizationPlans.length,
        organizationWorkItemCount: organizationWorkItems.length,
        executionSource: 'agent-mode-state-store',
        nextSafeState: blockedOrUncertainCount ? 'Inspect durable recovery classifications before resuming.' : 'Durable Agent Mode state is observable; no observer action is required.',
      },
      agents, tasks, runs, attempts, events, recovery, operations, runtimeDispatches, modelOperations, workcells, workcellWrites, workcellValidations, workcellLeases, workcellDiffs, results, reviewRequests, reviewDecisions, targetRefLeases, commitOperations, mergeApprovals, mergeOperations, mergeReceipts, schedulerEvents, schedulerSchedules, sourceWatermarks, latestSchedulerTick, eventSources, hostHealthStates, ciWorkflowStates, spawnAdmissionControls, spawnRootStates, childAssignments, dynamicWorkerOrchestrations, organizationPlans, organizationWorkItems,
    };
  } finally {
    store.close();
  }
}
