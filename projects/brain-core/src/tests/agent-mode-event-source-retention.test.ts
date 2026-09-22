import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BRAIN_JARVIS_CONTEXT_SOURCE,
  GIT_REPOSITORY_REVISION_SOURCE,
  JARVIS_CONTEXT_SOURCE_ID,
} from '../agent-mode/event-source.js';
import { applyEventSourceRetentionPlan, planEventSourceRetention } from '../agent-mode/event-source-retention.js';
import { AgentModeSqliteStateStore, type AgentModeEventSourceConfig, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';

const T0 = '2026-09-21T00:00:00.000Z';
const T1 = '2026-09-21T00:01:00.000Z';
const T2 = '2026-09-21T00:02:00.000Z';

function fixture(): { databasePath: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-event-source-retention-'));
  return { databasePath: path.join(root, 'agent-mode.db'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function config(sourceId: string, sourceType: AgentModeEventSourceConfig['adapterType'], repositoryRef = sourceId): AgentModeEventSourceConfig {
  return { sourceId, sourceType, repositoryRef, adapterType: sourceType, debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 1, enabled: true, bootstrapWatermark: null, registeredAt: T0 };
}

function event(sourceId: string, eventId: string): AgentModeSchedulerEventInput {
  return { eventId, eventType: 'jarvis.context.ready', source: sourceId, occurredAt: T0, receivedAt: T0, causationId: null, correlationId: null, deduplicationKey: eventId, payloadVersion: 'k4.0', payload: {}, nextEligibleAt: T0, deadline: null, maxAttempts: 1 };
}

function settleEvent(store: AgentModeSqliteStateStore, sourceId: string, eventId: string): void {
  assert.equal(store.createSchedulerEvent(event(sourceId, eventId)), 'created');
  const claim = store.claimSchedulerEvent(eventId, 'retention-test', T2, T0);
  assert.ok(claim);
  store.completeSchedulerEvent({ itemType: 'event', itemId: eventId, ownerId: 'retention-test', fence: claim!.fence, now: T1 });
}

test('active registration capacity is released only by eligible retirement and history remains', () => {
  const f = fixture();
  const store = new AgentModeSqliteStateStore(f.databasePath);
  try {
    const historical = 'source:jarvis:historical';
    store.upsertEventSource(config(historical, BRAIN_JARVIS_CONTEXT_SOURCE, BRAIN_JARVIS_CONTEXT_SOURCE));
    settleEvent(store, historical, 'event:jarvis:historical');
    for (let index = 0; index < 15; index += 1) store.upsertEventSource(config(`source:git:${index}`, GIT_REPOSITORY_REVISION_SOURCE, `repo:${index}`));
    assert.throws(() => store.upsertEventSource(config('source:git:overflow', GIT_REPOSITORY_REVISION_SOURCE, 'repo:overflow')), /registration limit/);
    const assessment = store.assessEventSourceRetirement(historical, T1);
    assert.equal(assessment.eligible, true);
    assert.deepEqual(store.retireEventSources([historical], T1), { retiredSourceIds: [historical], alreadyRetiredSourceIds: [] });
    assert.equal(store.listEventSources().length, 16);
    assert.equal(store.getEventSource(historical)?.lifecycleState, 'retired');
    assert.equal(store.upsertEventSource(config('source:git:overflow', GIT_REPOSITORY_REVISION_SOURCE, 'repo:overflow')), 'created');
    assert.deepEqual(store.retireEventSources([historical], T1), { retiredSourceIds: [], alreadyRetiredSourceIds: [historical] });
    assert.equal(store.schemaVersion, 11);
  } finally { store.close(); f.cleanup(); }
});

test('retention planning and application are deterministic, atomic, idempotent, and restart-safe', () => {
  const f = fixture();
  const store = new AgentModeSqliteStateStore(f.databasePath);
  try {
    const eligible = 'source:jarvis:eligible';
    const pending = 'source:jarvis:pending';
    store.upsertEventSource(config(eligible, BRAIN_JARVIS_CONTEXT_SOURCE, BRAIN_JARVIS_CONTEXT_SOURCE));
    store.upsertEventSource(config(pending, BRAIN_JARVIS_CONTEXT_SOURCE, `${BRAIN_JARVIS_CONTEXT_SOURCE}:pending`));
    settleEvent(store, eligible, 'event:jarvis:eligible');
    store.createSchedulerEvent(event(pending, 'event:jarvis:pending'));
    const plan = planEventSourceRetention(store, T1);
    assert.deepEqual(plan.eligibleSourceIds, [eligible]);
    assert.equal(plan.planDigest, planEventSourceRetention(store, T1).planDigest);
    const applied = applyEventSourceRetentionPlan(store, plan, T1);
    assert.deepEqual(applied.retiredSourceIds, [eligible]);
    assert.equal(applied.activeSourceCountAfter, 1);
    assert.throws(() => applyEventSourceRetentionPlan(store, { ...plan, eligibleSourceIds: [eligible, pending] }, T1), /not eligible/);
    assert.equal(store.getEventSource(pending)?.lifecycleState, 'active');
    store.close();
    const reopened = new AgentModeSqliteStateStore(f.databasePath);
    try {
      assert.equal(reopened.getEventSource(eligible)?.lifecycleState, 'retired');
      assert.equal(reopened.getEventSource(eligible)?.retiredAt, T1);
      assert.equal(reopened.getEventSource(pending)?.lifecycleState, 'active');
      assert.equal(reopened.listSchedulerEvents().length, 2);
    } finally { reopened.close(); }
  } finally { try { store.close(); } catch { /* already closed after restart */ } f.cleanup(); }
});

test('stable Jarvis source identity does not grow registration rows across many intakes', () => {
  const f = fixture();
  const store = new AgentModeSqliteStateStore(f.databasePath);
  try {
    assert.equal(store.upsertEventSource(config(JARVIS_CONTEXT_SOURCE_ID, BRAIN_JARVIS_CONTEXT_SOURCE, BRAIN_JARVIS_CONTEXT_SOURCE)), 'created');
    for (let index = 0; index < 100; index += 1) {
      assert.equal(store.upsertEventSource(config(JARVIS_CONTEXT_SOURCE_ID, BRAIN_JARVIS_CONTEXT_SOURCE, BRAIN_JARVIS_CONTEXT_SOURCE)), 'duplicate');
    }
    assert.equal(store.listEventSources().length, 1);
    assert.equal(store.getEventSource(JARVIS_CONTEXT_SOURCE_ID)?.lifecycleState, 'active');
  } finally { store.close(); f.cleanup(); }
});

test('retirement is blocked by an active scheduler lease even after the event is terminal', () => {
  const f = fixture();
  const store = new AgentModeSqliteStateStore(f.databasePath);
  try {
    const sourceId = 'source:jarvis:leased';
    const eventId = 'event:jarvis:leased';
    store.upsertEventSource(config(sourceId, BRAIN_JARVIS_CONTEXT_SOURCE, BRAIN_JARVIS_CONTEXT_SOURCE));
    settleEvent(store, sourceId, eventId);
    store.acquireLease({ resourceKey: `agent-mode-scheduler:event:${eventId}`, leaseId: 'lease:retention-test', ownerId: 'retention-test', expiresAt: '2026-09-21T00:03:00.000Z' });
    const assessment = store.assessEventSourceRetirement(sourceId, T1);
    assert.equal(assessment.eligible, false);
    assert.equal(assessment.reasonCode, 'SOURCE_HAS_ACTIVE_LEASE');
    assert.throws(() => store.retireEventSources([sourceId], T1), /not eligible/);
    assert.equal(store.getEventSource(sourceId)?.lifecycleState, 'active');
  } finally { store.close(); f.cleanup(); }
});
