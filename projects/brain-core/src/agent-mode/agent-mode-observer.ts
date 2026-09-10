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
    resultCount: number;
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
        resultCount: 0,
        executionSource: 'none',
        nextSafeState: 'No Agent Mode StateStore exists; no execution history is available.',
      },
      agents: [], tasks: [], runs: [], attempts: [], events: [], recovery: [], operations: [], workcells: [], workcellWrites: [], workcellValidations: [], workcellLeases: [], workcellDiffs: [], results: [], reviewRequests: [], reviewDecisions: [], targetRefLeases: [], commitOperations: [], mergeApprovals: [], mergeOperations: [], mergeReceipts: [],
    };
  }

  try {
    const agents = store.listAgents().map((agent) => ({ ...agent }));
    const tasks = store.listTasks().map((task) => ({ ...task }));
    const runs = store.listRuns().map((run) => ({ ...run }));
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
      availability: agents.length || tasks.length || runs.length || attempts.length || events.length ? 'available' : 'empty',
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
        resultCount: results.length,
        executionSource: 'agent-mode-state-store',
        nextSafeState: blockedOrUncertainCount ? 'Inspect durable recovery classifications before resuming.' : 'Durable Agent Mode state is observable; no observer action is required.',
      },
      agents, tasks, runs, attempts, events, recovery, operations, workcells, workcellWrites, workcellValidations, workcellLeases, workcellDiffs, results, reviewRequests, reviewDecisions, targetRefLeases, commitOperations, mergeApprovals, mergeOperations, mergeReceipts,
    };
  } finally {
    store.close();
  }
}
