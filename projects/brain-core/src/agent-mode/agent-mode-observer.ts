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
        executionSource: 'none',
        nextSafeState: 'No Agent Mode StateStore exists; no execution history is available.',
      },
      agents: [], tasks: [], runs: [], attempts: [], events: [], recovery: [], operations: [],
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
        executionSource: 'agent-mode-state-store',
        nextSafeState: blockedOrUncertainCount ? 'Inspect durable recovery classifications before resuming.' : 'Durable Agent Mode state is observable; no observer action is required.',
      },
      agents, tasks, runs, attempts, events, recovery, operations,
    };
  } finally {
    store.close();
  }
}
