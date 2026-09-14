import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runAgentModeSchedulerTick } from '../agent-mode/scheduler.js';
import { AgentModeSqliteStateStore, type AgentModeSchedulerEventInput, type AgentModeSchedulerScheduleInput } from '../agent-mode/sqlite-state-store.js';

const T0 = '2026-09-10T10:00:00.000Z';
const T1 = '2026-09-10T10:00:01.000Z';
const T2 = '2026-09-10T10:00:02.000Z';
const T3 = '2026-09-10T10:00:03.000Z';

function fixtureDb(): { databasePath: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k40-'));
  const databasePath = path.join(root, 'agent-mode.db');
  return { databasePath, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function event(overrides: Partial<AgentModeSchedulerEventInput> = {}): AgentModeSchedulerEventInput {
  return {
    eventId: 'event:1', eventType: 'agent_mode.test.noop', source: 'test', occurredAt: T0, receivedAt: T0,
    causationId: null, correlationId: 'corr:1', deduplicationKey: 'dedupe:1', payloadVersion: 'k4.0', payload: { value: 'fixture' },
    nextEligibleAt: T0, deadline: null, maxAttempts: 3, ...overrides,
  };
}

function schedule(overrides: Partial<AgentModeSchedulerScheduleInput> = {}): AgentModeSchedulerScheduleInput {
  return {
    scheduleId: 'schedule:1', kind: 'agent_mode.test.noop', dueAt: T1, createdAt: T0, deduplicationKey: 'dedupe:1',
    causationId: null, correlationId: 'corr:1', payloadVersion: 'k4.0', payload: { value: 'fixture' }, nextEligibleAt: T1, deadline: null, maxAttempts: 2, ...overrides,
  };
}

function withStore<T>(databasePath: string, callback: (store: AgentModeSqliteStateStore) => T): T {
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return callback(store); } finally { store.close(); }
}

test('K4.0 durable event ingestion, deduplication, conflict, and reopen', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      assert.equal(store.createSchedulerEvent(event()), 'created');
      assert.equal(store.createSchedulerEvent(event()), 'duplicate');
      assert.equal(store.createSchedulerEvent(event({ eventId: 'event:transport-retry' })), 'duplicate');
      assert.equal(store.createSchedulerEvent(event({ payload: { value: 'different' } })), 'conflict');
      assert.equal(store.createSchedulerEvent(event({ eventId: 'event:2', deduplicationKey: 'dedupe:2' })), 'created');
      assert.equal(store.getSchedulerEvent('event:1')?.status, 'pending');
    });
    withStore(fixture.databasePath, (store) => {
      assert.equal(store.schemaVersion, 8);
      assert.equal(store.listSchedulerEvents().length, 2);
      assert.equal(store.getSchedulerEvent('event:1')?.deduplicationKey, 'dedupe:1');
    });
  } finally { fixture.cleanup(); }
});

test('K4.0 schedule persists and remains future until due', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      assert.equal(store.createSchedulerSchedule(schedule()), 'created');
      const tick = runAgentModeSchedulerTick({ store, now: T0, ownerId: 'tick:a' });
      assert.equal(tick.outcome, 'NO_ACTION');
      assert.equal(tick.noOp, true);
      assert.equal(store.getSchedulerSchedule('schedule:1')?.status, 'pending');
    });
    withStore(fixture.databasePath, (store) => assert.equal(store.getSchedulerSchedule('schedule:1')?.dueAt, T1));
  } finally { fixture.cleanup(); }
});

test('K4.0 due schedule and event are deterministically claimed and completed', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      store.createSchedulerEvent(event());
      store.createSchedulerSchedule(schedule({ dueAt: T0, nextEligibleAt: T0 }));
      const tick = runAgentModeSchedulerTick({ store, now: T0, ownerId: 'tick:a', leaseDurationMs: 1000 });
      assert.deepEqual(tick.decisions.map((item) => item.itemId), ['event:1', 'schedule:1']);
      assert.equal(tick.claimed, 2);
      assert.equal(tick.completed, 2);
      assert.equal(store.getSchedulerEvent('event:1')?.status, 'completed');
      assert.equal(store.getSchedulerSchedule('schedule:1')?.status, 'completed');
    });
  } finally { fixture.cleanup(); }
});

test('K4.0 tick bounds eligible work and reports deferred items', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      for (let index = 1; index <= 5; index += 1) store.createSchedulerEvent(event({ eventId: `event:${index}`, deduplicationKey: `dedupe:${index}` }));
      const tick = runAgentModeSchedulerTick({ store, now: T0, ownerId: 'tick:a', maxItems: 2, maxAttempts: 2 });
      assert.equal(tick.considered, 5);
      assert.equal(tick.claimed, 2);
      assert.equal(tick.deferred, 3);
      assert.equal(tick.outcome, 'BOUNDED');
    });
  } finally { fixture.cleanup(); }
});

test('K4.0 concurrent claim and durable lease fence reject a second live claimant', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => store.createSchedulerEvent(event()));
    const first = new AgentModeSqliteStateStore(fixture.databasePath);
    const second = new AgentModeSqliteStateStore(fixture.databasePath);
    try {
      const claim = first.claimSchedulerEvent('event:1', 'owner:a', T1, T0);
      assert.equal(claim?.fence, 1);
      assert.equal(second.claimSchedulerEvent('event:1', 'owner:b', T1, T0), undefined);
      assert.throws(() => second.completeSchedulerEvent({ itemType: 'event', itemId: 'event:1', ownerId: 'owner:b', fence: 2, now: T0 }), /stale_scheduler/);
    } finally { first.close(); second.close(); }
  } finally { fixture.cleanup(); }
});

test('K4.0 expired claim is recoverable with a fresh fence and stale claimant is fenced', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => store.createSchedulerEvent(event()));
    const first = new AgentModeSqliteStateStore(fixture.databasePath);
    const second = new AgentModeSqliteStateStore(fixture.databasePath);
    try {
      const oldClaim = first.claimSchedulerEvent('event:1', 'owner:a', T1, T0);
      const newClaim = second.claimSchedulerEvent('event:1', 'owner:b', T2, T1);
      assert.equal(oldClaim?.fence, 1);
      assert.equal(newClaim?.fence, 2);
      assert.throws(() => first.completeSchedulerEvent({ itemType: 'event', itemId: 'event:1', ownerId: 'owner:a', fence: oldClaim!.fence, now: T1 }), /stale_scheduler/);
      second.completeSchedulerEvent({ itemType: 'event', itemId: 'event:1', ownerId: 'owner:b', fence: newClaim!.fence, now: T1 });
      assert.equal(second.getSchedulerEvent('event:1')?.status, 'completed');
    } finally { first.close(); second.close(); }
  } finally { fixture.cleanup(); }
});

test('K4.0 deterministic retry backoff and durable dead-letter', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      store.createSchedulerEvent(event({ payload: { outcome: 'fail' }, maxAttempts: 2 }));
      const first = runAgentModeSchedulerTick({ store, now: T0, ownerId: 'tick:a' });
      assert.equal(first.decisions[0]?.action, 'retry_scheduled');
      assert.equal(store.getSchedulerEvent('event:1')?.status, 'failed');
      assert.equal(store.getSchedulerEvent('event:1')?.nextEligibleAt, T0.replace('10:00:00', '10:00:01'));
      assert.equal(runAgentModeSchedulerTick({ store, now: T1, ownerId: 'tick:a' }).decisions[0]?.action, 'dead_lettered');
      const dead = store.getSchedulerEvent('event:1');
      assert.equal(dead?.status, 'dead_letter');
      assert.equal(dead?.attemptCount, 2);
      assert.equal(dead?.lastFailure, 'fixture_requested_failure');
    });
  } finally { fixture.cleanup(); }
});

test('K4.0 unknown event handler fails closed to dead-letter without execution', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      store.createSchedulerEvent(event({ eventType: 'agent_mode.unknown' }));
      const tick = runAgentModeSchedulerTick({ store, now: T0, ownerId: 'tick:a' });
      assert.equal(tick.deadLettered, 1);
      assert.equal(store.getSchedulerEvent('event:1')?.lastFailure, 'unknown_k4_handler');
      assert.equal(store.getSchedulerEvent('event:1')?.status, 'dead_letter');
    });
  } finally { fixture.cleanup(); }
});

test('K4.0 source watermark is monotonic across out-of-order delivery and reopen', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      assert.equal(store.upsertSourceWatermark({ sourceId: 'fixture', watermark: T1, updatedAt: T1 }), 'advanced');
      assert.equal(store.upsertSourceWatermark({ sourceId: 'fixture', watermark: T1, updatedAt: T2 }), 'duplicate');
      assert.equal(store.upsertSourceWatermark({ sourceId: 'fixture', watermark: T0, updatedAt: T2 }), 'stale');
      assert.equal(store.upsertSourceWatermark({ sourceId: 'fixture', watermark: T2, updatedAt: T2 }), 'advanced');
    });
    withStore(fixture.databasePath, (store) => assert.equal(store.listSourceWatermarks()[0]?.watermark, T2));
  } finally { fixture.cleanup(); }
});

test('K4.0 observer exposes queue state, dead letters, watermarks, and latest no-op tick', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      store.createSchedulerEvent(event({ eventId: 'event:dead', deduplicationKey: 'dedupe:dead', eventType: 'agent_mode.unknown' }));
      store.upsertSourceWatermark({ sourceId: 'fixture', watermark: T0, updatedAt: T0 });
      runAgentModeSchedulerTick({ store, now: T0, ownerId: 'tick:a' });
    });
    const projection = readAgentModeObserver(T0, fixture.databasePath);
    assert.equal(projection.summary.schedulerEventCount, 1);
    assert.equal(projection.summary.schedulerDeadLetterCount, 1);
    assert.equal(projection.sourceWatermarks[0]?.watermark, T0);
    assert.equal(projection.latestSchedulerTick?.noOp, false);
    assert.equal((projection.schedulerEvents[0]?.payload as { value?: string })?.value, 'fixture');
  } finally { fixture.cleanup(); }
});

test('K4.0 no-op heartbeat CLI makes no model, runtime, worker, network, or token call', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, () => undefined);
    const output = execFileSync(process.execPath, ['dist/bin/brain-agent.js', 'heartbeat', '--once'], {
      cwd: path.resolve(process.cwd()),
      env: { ...process.env, BRAIN_AGENT_MODE_DATABASE: fixture.databasePath },
      encoding: 'utf8',
    });
    const result = JSON.parse(output) as Record<string, unknown>;
    assert.equal(result.kind, 'agent-mode-heartbeat');
    assert.equal(result.outcome, 'NO_ACTION');
    assert.equal((result as { claimed?: number }).claimed, 0);
    assert.equal((result as { noOp?: boolean }).noOp, true);
  } finally { fixture.cleanup(); }
});

test('K4.0 crash window before settlement replays only the internal no-effect fixture after lease expiry', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => store.createSchedulerEvent(event()));
    withStore(fixture.databasePath, (store) => {
      assert.ok(store.claimSchedulerEvent('event:1', 'crashed-owner', T1, T0));
      assert.equal(runAgentModeSchedulerTick({ store, now: T0, ownerId: 'recovery-owner' }).outcome, 'NO_ACTION');
    });
    withStore(fixture.databasePath, (store) => {
      const tick = runAgentModeSchedulerTick({ store, now: T1, ownerId: 'recovery-owner' });
      assert.equal(tick.decisions[0]?.action, 'completed');
      assert.equal(store.getSchedulerEvent('event:1')?.status, 'completed');
    });
  } finally { fixture.cleanup(); }
});

test('K4.0 payload schema rejects executable-shaped and oversized inputs', () => {
  const fixture = fixtureDb();
  try {
    withStore(fixture.databasePath, (store) => {
      assert.throws(() => store.createSchedulerEvent(event({ payload: { command: 'never-run' } })), /not permitted/);
      assert.throws(() => store.createSchedulerEvent(event({ payload: { value: 'x'.repeat(33_000) } })), /32 KiB/);
    });
  } finally { fixture.cleanup(); }
});
