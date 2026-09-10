import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import {
  BRAIN_TASK_LIFECYCLE_SOURCE,
  InternalLifecycleEventSourceAdapter,
  pollEventSourcesOnce,
  type BrainTaskLifecycleEvent,
  type EventSourceAdapter,
} from '../agent-mode/event-source.js';
import { AgentModeSqliteStateStore, type AgentModeEvent, type AgentModeEventSourceConfig, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';
import { runAgentModeSchedulerTick } from '../agent-mode/scheduler.js';

const T0 = '2026-09-10T10:00:00.000Z';
const T1 = '2026-09-10T10:00:01.000Z';
const T2 = '2026-09-10T10:00:02.000Z';
const T3 = '2026-09-10T10:00:03.000Z';

function fixture(): { databasePath: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k41-b1-'));
  return { databasePath: path.join(root, 'agent-mode.db'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function config(overrides: Partial<AgentModeEventSourceConfig> = {}): AgentModeEventSourceConfig {
  return { sourceId: BRAIN_TASK_LIFECYCLE_SOURCE, sourceType: BRAIN_TASK_LIFECYCLE_SOURCE, repositoryRef: 'agent-mode', adapterType: 'brain.task.lifecycle', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 2, enabled: true, bootstrapWatermark: null, ...overrides };
}

function lifecycle(eventId: string, entityType: AgentModeEvent['entityType'], entityId: string, eventType: string, occurredAt: string, payload: Record<string, unknown> = {}): AgentModeEvent {
  return { eventId, entityType, entityId, eventType, occurredAt, payload };
}

async function withStore<T>(databasePath: string, callback: (store: AgentModeSqliteStateStore) => T | Promise<T>): Promise<T> {
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return await callback(store); } finally { store.close(); }
}

function setup(store: AgentModeSqliteStateStore, overrides: Partial<AgentModeEventSourceConfig> = {}): InternalLifecycleEventSourceAdapter {
  store.upsertEventSource(config(overrides));
  return new InternalLifecycleEventSourceAdapter({ store, scanLimit: 4 });
}

function schedulerEvent(overrides: Partial<AgentModeSchedulerEventInput> = {}): AgentModeSchedulerEventInput {
  return { eventId: 'brain.task.lifecycle:event-1', eventType: 'conflict', source: BRAIN_TASK_LIFECYCLE_SOURCE, occurredAt: T0, receivedAt: T0, causationId: null, correlationId: null, deduplicationKey: 'conflict', payloadVersion: 'k4.0', payload: { safe: true }, nextEligibleAt: T0, deadline: null, maxAttempts: 1, ...overrides };
}

test('internal lifecycle adapter satisfies the shared finite contract and bootstrap is non-replaying', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    store.recordEvent(lifecycle('old:1', 'run', 'run:1', 'run_paused', T0));
    const adapter = setup(store);
    const observation = await adapter.observe({ sourceId: BRAIN_TASK_LIFECYCLE_SOURCE, previousWatermark: null, observedAt: T1, catchUpLimit: 2, debounceWindowMs: 0 });
    assert.equal(observation.status, 'bootstrapped'); assert.equal(observation.events.length, 0); assert.equal(observation.observedWatermark, '1');
  }); } finally { f.cleanup(); }
});

test('new eligible lifecycle event maps once, preserves lineage, and repeated poll deduplicates', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter = setup(store);
    await pollEventSourcesOnce({ store, adapters: [adapter], now: T0 });
    store.recordEvent(lifecycle('attempt:admitted', 'attempt', 'attempt:1', 'attempt_admitted', T1, { taskId: 'task:1', runId: 'run:1', reservationId: 'res:1' }));
    const first = await pollEventSourcesOnce({ store, adapters: [adapter], now: T2 });
    assert.equal(first.sources[0]?.emittedEventCount, 1);
    const event = store.listSchedulerEvents()[0];
    assert.equal(event?.eventType, 'task.lifecycle.observed'); assert.equal(event?.payload.sourceEventId, 'attempt:admitted'); assert.equal(event?.payload.entityType, 'attempt'); assert.equal(event?.payload.taskId, 'task:1');
    const second = await pollEventSourcesOnce({ store, adapters: [adapter], now: T3 });
    assert.equal(second.sources[0]?.status, 'unchanged'); assert.equal(store.listSchedulerEvents().length, 1);
  }); } finally { f.cleanup(); }
});

test('lifecycle catch-up is bounded, ascending, and hasMore is truthful', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    store.recordEvent(lifecycle('old', 'operation', 'op:old', 'receipt_recorded', T0));
    const adapter = setup(store, { bootstrapWatermark: '1' });
    for (const [id, time] of [['e2', T1], ['e3', T2], ['e4', T3]] as const) store.recordEvent(lifecycle(id, 'run', 'run:1', 'run_paused', time));
    const first = await pollEventSourcesOnce({ store, adapters: [adapter], now: T3 });
    assert.equal(first.sources[0]?.emittedEventCount, 2); assert.equal(first.sources[0]?.hasMore, true); assert.equal(store.getEventSource(BRAIN_TASK_LIFECYCLE_SOURCE)?.watermark, '3');
    const second = await pollEventSourcesOnce({ store, adapters: [adapter], now: T3 });
    assert.equal(second.sources[0]?.emittedEventCount, 1); assert.equal(second.sources[0]?.hasMore, false); assert.equal(store.getEventSource(BRAIN_TASK_LIFECYCLE_SOURCE)?.watermark, '4');
    assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.sourceSequence), [2, 3, 4]);
  }); } finally { f.cleanup(); }
});

test('non-eligible events advance the bounded scan without cursor deadlock', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter = setup(store, { bootstrapWatermark: '1', catchUpLimit: 2 });
    store.recordEvent(lifecycle('audit', 'operation', 'op:1', 'receipt_recorded', T1));
    store.recordEvent(lifecycle('eligible', 'run', 'run:1', 'run_resumed', T2));
    const observation = await adapter.observe({ sourceId: BRAIN_TASK_LIFECYCLE_SOURCE, previousWatermark: '1', observedAt: T3, catchUpLimit: 2, scanLimit: 2, debounceWindowMs: 0 });
    assert.deepEqual(observation.events.map((event) => event.sourceSequence), [2]); assert.equal(observation.observedWatermark, '2'); assert.equal(observation.hasMore, false);
  }); } finally { f.cleanup(); }
});

test('pause/resume, cancellation, and process-loss lifecycle events preserve source order', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter = setup(store, { bootstrapWatermark: '0', catchUpLimit: 10 });
    store.recordEvent(lifecycle('pause', 'run', 'run:1', 'run_paused', T0, { taskId: 'task:1', attemptId: 'attempt:1' }));
    store.recordEvent(lifecycle('resume', 'run', 'run:1', 'run_resumed', T1, { taskId: 'task:1', attemptId: 'attempt:1' }));
    store.recordEvent(lifecycle('cancel', 'attempt', 'attempt:1', 'cancellation_requested', T2, { runId: 'run:1', taskId: 'task:1' }));
    store.recordEvent(lifecycle('lost', 'run', 'run:1', 'controller_lost', T3, { attemptId: 'attempt:1' }));
    const result = await pollEventSourcesOnce({ store, adapters: [adapter], now: T3 });
    assert.equal(result.sources[0]?.emittedEventCount, 4); assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.lifecycleEventType), ['run_paused', 'run_resumed', 'cancellation_requested', 'controller_lost']);
  }); } finally { f.cleanup(); }
});

test('malformed lifecycle payload fails closed and leaves prior watermark durable', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter = setup(store, { bootstrapWatermark: '0' }); store.recordEvent(lifecycle('bad', 'run', 'run:1', 'run_paused', T1));
    const database = (store as unknown as { database: { prepare(sql: string): { run(...args: unknown[]): unknown } } }).database;
    database.prepare('UPDATE events SET payload_json = ? WHERE event_id = ?').run('{bad json', 'bad');
    const result = await pollEventSourcesOnce({ store, adapters: [adapter], now: T2 });
    assert.equal(result.sources[0]?.status, 'failed'); assert.equal(store.getEventSource(BRAIN_TASK_LIFECYCLE_SOURCE)?.watermark, null); assert.equal(store.listSchedulerEvents().length, 0);
  }); } finally { f.cleanup(); }
});

test('failed scheduler ingest does not advance lifecycle watermark', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter = setup(store, { bootstrapWatermark: '0' }); store.recordEvent(lifecycle('event-1', 'run', 'run:1', 'run_resumed', T1));
    store.createSchedulerEvent(schedulerEvent({ payloadVersion: 'k4.0' }));
    const result = await pollEventSourcesOnce({ store, adapters: [adapter], now: T2 });
    assert.equal(result.sources[0]?.status, 'failed'); assert.equal(store.getEventSource(BRAIN_TASK_LIFECYCLE_SOURCE)?.watermark, null); assert.equal(store.listSchedulerEvents().length, 1);
  }); } finally { f.cleanup(); }
});

test('restart reconstructs lifecycle source and observer state without duplication or feedback', async () => {
  const f = fixture();
  try {
    await withStore(f.databasePath, async (store) => { const adapter = setup(store, { bootstrapWatermark: '0', catchUpLimit: 1 }); store.recordEvent(lifecycle('one', 'run', 'run:1', 'run_paused', T1)); await pollEventSourcesOnce({ store, adapters: [adapter], now: T2 }); });
    await withStore(f.databasePath, async (store) => {
      const adapter = new InternalLifecycleEventSourceAdapter({ store, scanLimit: 4 }); store.recordEvent(lifecycle('two', 'run', 'run:1', 'run_resumed', T3));
      const result = await pollEventSourcesOnce({ store, adapters: [adapter], now: T3 });
      assert.equal(result.sources[0]?.emittedEventCount, 1); assert.equal(store.listSchedulerEvents().length, 2);
      assert.equal(store.listSchedulerEvents().every((event) => event.source === BRAIN_TASK_LIFECYCLE_SOURCE), true);
      const observer = readAgentModeObserver(T3, f.databasePath);
      assert.equal(observer.eventSources[0]?.sourceType, BRAIN_TASK_LIFECYCLE_SOURCE); assert.equal(observer.eventSources[0]?.watermark, '2'); assert.equal(observer.eventSources[0]?.lastEmittedEventCount, 1);
      assert.equal(observer.schedulerEvents.every((event) => event.payload && typeof event.payload === 'object' && !('payloadJson' in event.payload)), true);
    });
  } finally { f.cleanup(); }
});

test('shared conformance remains source-neutral for lifecycle adapter shape', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter: EventSourceAdapter<BrainTaskLifecycleEvent> = setup(store, { bootstrapWatermark: '0' });
    assert.equal(typeof adapter.sourceId, 'string'); assert.equal(typeof adapter.sourceType, 'string');
    const empty = await adapter.observe({ sourceId: adapter.sourceId, previousWatermark: '0', observedAt: T0, catchUpLimit: 2, scanLimit: 2, debounceWindowMs: 0 });
    assert.equal(empty.events.length, 0); assert.equal(empty.hasMore, false); assert.equal(empty.status, 'unchanged');
  }); } finally { f.cleanup(); }
});

test('lifecycle-derived scheduler events remain inert under the finite no-op heartbeat', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const adapter = setup(store, { bootstrapWatermark: '0' });
    const emptyTick = runAgentModeSchedulerTick({ store, now: T0, ownerId: 'empty-heartbeat', maxItems: 1 });
    assert.equal(emptyTick.outcome, 'NO_ACTION'); assert.equal(emptyTick.claimed, 0); assert.equal(emptyTick.noOp, true);
    store.recordEvent(lifecycle('event-1', 'run', 'run:1', 'run_paused', T1)); await pollEventSourcesOnce({ store, adapters: [adapter], now: T2 });
    const tick = runAgentModeSchedulerTick({ store, now: T2, ownerId: 'test-heartbeat', maxItems: 1 });
    assert.equal(tick.claimed, 1); assert.equal(tick.completed, 0); assert.equal(tick.deadLettered, 1); assert.equal(tick.outcome, 'PROCESSED');
    assert.equal(store.listSchedulerEvents()[0]?.eventType, 'task.lifecycle.observed');
  }); } finally { f.cleanup(); }
});
