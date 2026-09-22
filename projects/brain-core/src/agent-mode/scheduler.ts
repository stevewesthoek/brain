import { createHash } from 'node:crypto';
import {
  AgentModeSqliteStateStore,
  type AgentModeSchedulerClaim,
  type AgentModeSchedulerEvent,
  type AgentModeSchedulerSchedule,
  type AgentModeSchedulerTickSummary,
} from './sqlite-state-store.js';

export type AgentModeSchedulerDecision = {
  itemType: 'event' | 'schedule';
  itemId: string;
  action: 'completed' | 'retry_scheduled' | 'dead_lettered' | 'deferred';
  attempt: number;
  fence?: number;
  reason?: string;
};

export type AgentModeSchedulerTickResult = AgentModeSchedulerTickSummary & {
  decisions: AgentModeSchedulerDecision[];
};

export type AgentModeSchedulerTickOptions = {
  store: AgentModeSqliteStateStore;
  now?: string;
  ownerId?: string;
  maxItems?: number;
  maxAttempts?: number;
  leaseDurationMs?: number;
  clock?: () => string;
};

export type AgentModeSchedulerEventHandler = (input: {
  event: AgentModeSchedulerEvent;
  claim: AgentModeSchedulerClaim;
  now: string;
}) => Promise<unknown>;

export type AgentModeAsyncSchedulerTickOptions = AgentModeSchedulerTickOptions & {
  eventHandlers?: ReadonlyMap<string, AgentModeSchedulerEventHandler>;
};

const NOOP_EVENT_TYPE = 'agent_mode.test.noop';
const NOOP_SCHEDULE_KIND = 'agent_mode.test.noop';

function boundedPositive(value: number | undefined, fallback: number, maximum: number): number {
  return Math.max(1, Math.min(maximum, Math.floor(value ?? fallback)));
}

function readyEvent(event: AgentModeSchedulerEvent, now: string): boolean {
  return (event.status === 'pending' || event.status === 'failed') && event.nextEligibleAt <= now
    || event.status === 'claimed' && Boolean(event.claimExpiresAt && event.claimExpiresAt <= now);
}

function readySchedule(schedule: AgentModeSchedulerSchedule, now: string): boolean {
  return (schedule.status === 'pending' || schedule.status === 'failed') && schedule.nextEligibleAt <= now
    || schedule.status === 'claimed' && Boolean(schedule.claimExpiresAt && schedule.claimExpiresAt <= now);
}

function tickId(startedAt: string, ownerId: string): string {
  return `scheduler-tick:${createHash('sha256').update(`${startedAt}:${ownerId}`).digest('hex').slice(0, 20)}`;
}

function isNoopPayload(payload: Record<string, unknown>): { ok: true } | { ok: false; reason: string; deadLetter: boolean } {
  if (payload.outcome === 'fail') return { ok: false, reason: 'fixture_requested_failure', deadLetter: false };
  if (payload.outcome === 'dead_letter') return { ok: false, reason: 'fixture_requested_dead_letter', deadLetter: true };
  return { ok: true };
}

/**
 * One finite scheduler pass. The handler registry is deliberately closed: the
 * only K4.0 handler is an internal no-effect fixture. There is no runtime,
 * model, worker, shell, network, timer, or background loop in this module.
 */
export function runAgentModeSchedulerTick(options: AgentModeSchedulerTickOptions): AgentModeSchedulerTickResult {
  const clock = options.clock ?? (() => new Date().toISOString());
  const startedAt = options.now ?? clock();
  const ownerId = options.ownerId ?? 'brain-agent-heartbeat';
  const maxItems = boundedPositive(options.maxItems, 16, 64);
  const maxAttempts = boundedPositive(options.maxAttempts, maxItems, 64);
  const leaseDurationMs = Math.max(1, Math.min(300_000, Math.floor(options.leaseDurationMs ?? 30_000)));
  const eventCandidates = options.store.listSchedulerEvents(500).filter((event) => readyEvent(event, startedAt)).map((event) => ({ itemType: 'event' as const, item: event, dueAt: event.nextEligibleAt, itemId: event.eventId }));
  const scheduleCandidates = options.store.listSchedulerSchedules(500).filter((schedule) => readySchedule(schedule, startedAt)).map((schedule) => ({ itemType: 'schedule' as const, item: schedule, dueAt: schedule.nextEligibleAt, itemId: schedule.scheduleId }));
  const candidates = [...eventCandidates, ...scheduleCandidates].sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.itemType.localeCompare(right.itemType) || left.itemId.localeCompare(right.itemId));
  const processLimit = Math.min(maxItems, maxAttempts);
  const decisions: AgentModeSchedulerDecision[] = [];
  let claimed = 0;
  let completed = 0;
  let deferred = Math.max(0, candidates.length - processLimit);
  let deadLettered = 0;

  for (const candidate of candidates.slice(0, processLimit)) {
    const expiresAt = new Date(Date.parse(startedAt) + leaseDurationMs).toISOString();
    const claim = candidate.itemType === 'event'
      ? options.store.claimSchedulerEvent(candidate.itemId, ownerId, expiresAt, startedAt)
      : options.store.claimSchedulerSchedule(candidate.itemId, ownerId, expiresAt, startedAt);
    if (!claim) {
      deferred += 1;
      decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'deferred', attempt: candidate.item.attemptCount, reason: 'claim_unavailable' });
      continue;
    }
    claimed += 1;
    const payload = candidate.item.payload;
    const handlerKnown = candidate.itemType === 'event' ? candidate.item.eventType === NOOP_EVENT_TYPE : candidate.item.kind === NOOP_SCHEDULE_KIND;
    if (!handlerKnown) {
      const settlement = { itemType: candidate.itemType, itemId: candidate.itemId, ownerId, fence: claim.fence, now: startedAt, reason: 'unknown_k4_handler', forceDeadLetter: true } as const;
      if (candidate.itemType === 'event') options.store.failSchedulerEvent(settlement); else options.store.failSchedulerSchedule(settlement);
      deadLettered += 1;
      decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'dead_lettered', attempt: candidate.item.attemptCount + 1, fence: claim.fence, reason: settlement.reason });
      continue;
    }
    const result = isNoopPayload(payload);
    if (!result.ok) {
      const settlement = { itemType: candidate.itemType, itemId: candidate.itemId, ownerId, fence: claim.fence, now: startedAt, reason: result.reason, ...(result.deadLetter ? { forceDeadLetter: true } : {}) } as const;
      const status = candidate.itemType === 'event' ? options.store.failSchedulerEvent(settlement) : options.store.failSchedulerSchedule(settlement);
      if (status === 'dead_letter') {
        deadLettered += 1;
        decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'dead_lettered', attempt: candidate.item.attemptCount + 1, fence: claim.fence, reason: result.reason });
      } else {
        decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'retry_scheduled', attempt: candidate.item.attemptCount + 1, fence: claim.fence, reason: result.reason });
      }
      continue;
    }
    const settlement = { itemType: candidate.itemType, itemId: candidate.itemId, ownerId, fence: claim.fence, now: startedAt } as const;
    if (candidate.itemType === 'event') options.store.completeSchedulerEvent(settlement); else options.store.completeSchedulerSchedule(settlement);
    completed += 1;
    decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'completed', attempt: candidate.item.attemptCount + 1, fence: claim.fence });
  }

  const completedAt = options.now ?? startedAt;
  const summary: AgentModeSchedulerTickSummary = {
    tickId: tickId(startedAt, ownerId), startedAt, completedAt,
    outcome: claimed === 0 ? 'NO_ACTION' : deferred > 0 ? 'BOUNDED' : 'PROCESSED',
    considered: candidates.length, claimed, completed, deferred, deadLettered,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)), noOp: claimed === 0,
  };
  options.store.saveLatestSchedulerTick(summary);
  return { ...summary, decisions };
}

/**
 * Production scheduler pass. The synchronous function above remains the
 * finite no-effect fixture heartbeat; this pass keeps the same durable claim,
 * fence, retry, and settlement authority while allowing registered K4 event
 * handlers to perform asynchronous execution.
 */
export async function runAgentModeSchedulerTickAsync(options: AgentModeAsyncSchedulerTickOptions): Promise<AgentModeSchedulerTickResult> {
  const clock = options.clock ?? (() => new Date().toISOString());
  const startedAt = options.now ?? clock();
  const ownerId = options.ownerId ?? 'brain-agent-scheduler';
  const maxItems = boundedPositive(options.maxItems, 16, 64);
  const maxAttempts = boundedPositive(options.maxAttempts, maxItems, 64);
  const leaseDurationMs = Math.max(1, Math.min(300_000, Math.floor(options.leaseDurationMs ?? 30_000)));
  const eventCandidates = options.store.listSchedulerEvents(500)
    .filter((event) => readyEvent(event, startedAt))
    .map((event) => ({ itemType: 'event' as const, item: event, dueAt: event.nextEligibleAt, itemId: event.eventId }));
  const scheduleCandidates = options.store.listSchedulerSchedules(500)
    .filter((schedule) => readySchedule(schedule, startedAt))
    .map((schedule) => ({ itemType: 'schedule' as const, item: schedule, dueAt: schedule.nextEligibleAt, itemId: schedule.scheduleId }));
  const candidates = [...eventCandidates, ...scheduleCandidates].sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.itemType.localeCompare(right.itemType) || left.itemId.localeCompare(right.itemId));
  const processLimit = Math.min(maxItems, maxAttempts);
  const decisions: AgentModeSchedulerDecision[] = [];
  let claimed = 0;
  let completed = 0;
  let deferred = Math.max(0, candidates.length - processLimit);
  let deadLettered = 0;

  for (const candidate of candidates.slice(0, processLimit)) {
    if (candidate.itemType === 'event'
      && !options.eventHandlers?.has(candidate.item.eventType)
      && candidate.item.eventType !== NOOP_EVENT_TYPE) {
      deferred += 1;
      decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'deferred', attempt: candidate.item.attemptCount, reason: 'handler_not_registered' });
      continue;
    }
    const expiresAt = new Date(Date.parse(startedAt) + leaseDurationMs).toISOString();
    const claim = candidate.itemType === 'event'
      ? options.store.claimSchedulerEvent(candidate.itemId, ownerId, expiresAt, startedAt)
      : options.store.claimSchedulerSchedule(candidate.itemId, ownerId, expiresAt, startedAt);
    if (!claim) {
      deferred += 1;
      decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'deferred', attempt: candidate.item.attemptCount, reason: 'claim_unavailable' });
      continue;
    }
    claimed += 1;

    if (candidate.itemType === 'event') {
      const handler = options.eventHandlers?.get(candidate.item.eventType);
      if (handler) {
        try {
          await handler({ event: candidate.item, claim, now: startedAt });
        } catch {
          const current = options.store.getSchedulerEvent(candidate.item.eventId);
          if (current?.status === 'claimed' && current.claimOwner === claim.ownerId && current.claimFence === claim.fence) {
            options.store.failSchedulerEvent({ itemType: 'event', itemId: candidate.item.eventId, ownerId: claim.ownerId, fence: claim.fence, now: startedAt, reason: 'SCHEDULER_HANDLER_ERROR' });
          }
        }
        const current = options.store.getSchedulerEvent(candidate.item.eventId);
        if (current?.status === 'completed') {
          completed += 1;
          decisions.push({ itemType: 'event', itemId: candidate.item.eventId, action: 'completed', attempt: current.attemptCount, fence: claim.fence });
        } else if (current?.status === 'dead_letter') {
          deadLettered += 1;
          decisions.push({ itemType: 'event', itemId: candidate.item.eventId, action: 'dead_lettered', attempt: current.attemptCount, fence: claim.fence, ...(current.lastFailure ? { reason: current.lastFailure } : {}) });
        } else if (current?.status === 'failed') {
          decisions.push({ itemType: 'event', itemId: candidate.item.eventId, action: 'retry_scheduled', attempt: current.attemptCount, fence: claim.fence, ...(current.lastFailure ? { reason: current.lastFailure } : {}) });
        } else {
          deferred += 1;
          decisions.push({ itemType: 'event', itemId: candidate.item.eventId, action: 'deferred', attempt: current?.attemptCount ?? candidate.item.attemptCount, fence: claim.fence, reason: 'handler_not_settled' });
        }
        continue;
      }
    }

    const payload = candidate.item.payload;
    const handlerKnown = candidate.itemType === 'event' ? candidate.item.eventType === NOOP_EVENT_TYPE : candidate.item.kind === NOOP_SCHEDULE_KIND;
    if (!handlerKnown) {
      const settlement = { itemType: candidate.itemType, itemId: candidate.itemId, ownerId, fence: claim.fence, now: startedAt, reason: 'unknown_k4_handler', forceDeadLetter: true } as const;
      if (candidate.itemType === 'event') options.store.failSchedulerEvent(settlement); else options.store.failSchedulerSchedule(settlement);
      deadLettered += 1;
      decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'dead_lettered', attempt: candidate.item.attemptCount + 1, fence: claim.fence, reason: settlement.reason });
      continue;
    }
    const result = isNoopPayload(payload);
    if (!result.ok) {
      const settlement = { itemType: candidate.itemType, itemId: candidate.itemId, ownerId, fence: claim.fence, now: startedAt, reason: result.reason, ...(result.deadLetter ? { forceDeadLetter: true } : {}) } as const;
      const status = candidate.itemType === 'event' ? options.store.failSchedulerEvent(settlement) : options.store.failSchedulerSchedule(settlement);
      if (status === 'dead_letter') {
        deadLettered += 1;
        decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'dead_lettered', attempt: candidate.item.attemptCount + 1, fence: claim.fence, reason: result.reason });
      } else {
        decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'retry_scheduled', attempt: candidate.item.attemptCount + 1, fence: claim.fence, reason: result.reason });
      }
      continue;
    }
    const settlement = { itemType: candidate.itemType, itemId: candidate.itemId, ownerId, fence: claim.fence, now: startedAt } as const;
    if (candidate.itemType === 'event') options.store.completeSchedulerEvent(settlement); else options.store.completeSchedulerSchedule(settlement);
    completed += 1;
    decisions.push({ itemType: candidate.itemType, itemId: candidate.itemId, action: 'completed', attempt: candidate.item.attemptCount + 1, fence: claim.fence });
  }

  const completedAt = options.clock?.() ?? startedAt;
  const summary: AgentModeSchedulerTickSummary = {
    tickId: tickId(startedAt, ownerId), startedAt, completedAt,
    outcome: claimed === 0 ? 'NO_ACTION' : deferred > 0 ? 'BOUNDED' : 'PROCESSED',
    considered: candidates.length, claimed, completed, deferred, deadLettered,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)), noOp: claimed === 0,
  };
  options.store.saveLatestSchedulerTick(summary);
  return { ...summary, decisions };
}

export { NOOP_EVENT_TYPE, NOOP_SCHEDULE_KIND };
