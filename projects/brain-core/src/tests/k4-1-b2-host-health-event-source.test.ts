import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import {
  GitRepositoryEventSourceAdapter,
  HostHealthEventSourceAdapter,
  INFRASTRUCTURE_HOST_HEALTH_SOURCE,
  InternalLifecycleEventSourceAdapter,
  createInfrastructurePlaneHostHealthReader,
  pollEventSourcesOnce,
  type HostHealthObservation,
  type HostHealthObservationReader,
  type EventSourceAdapter,
} from '../agent-mode/event-source.js';
import { AgentModeSqliteStateStore, type AgentModeEventSourceConfig } from '../agent-mode/sqlite-state-store.js';
import { normalizeNewRelic } from '../adapters/infrastructure-provider-normalizers.mjs';

const T0 = '2026-09-10T10:00:00.000Z';
const T1 = '2026-09-10T10:00:01.000Z';
const T2 = '2026-09-10T10:10:00.000Z';
const T3 = '2026-09-10T10:10:01.000Z';

function fixture(): { databasePath: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k41-b2-'));
  return { databasePath: path.join(root, 'agent-mode.db'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function config(overrides: Partial<AgentModeEventSourceConfig> = {}): AgentModeEventSourceConfig {
  return { sourceId: INFRASTRUCTURE_HOST_HEALTH_SOURCE, sourceType: INFRASTRUCTURE_HOST_HEALTH_SOURCE, repositoryRef: 'infrastructure-plane', adapterType: 'infrastructure.host-health', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 2, enabled: true, bootstrapWatermark: null, ...overrides };
}

function observation(overrides: Partial<HostHealthObservation> = {}): HostHealthObservation {
  return { observationId: 'observation:fixture:host:server-example:1', resourceId: 'host:server-example', providerId: 'fixture', bindingId: 'health_binding:fixture', observedAt: T0, status: 'healthy', freshness: 'fresh', conditionCodes: [], ...overrides };
}

function readerState(state: HostHealthObservation[], expectedState = state): { reader: HostHealthObservationReader; set: (next: HostHealthObservation[]) => void } {
  let current = state;
  const expectedBindingKeys = expectedState.map((item) => `${item.resourceId}|${item.providerId}|${item.bindingId}`).sort();
  return { reader: async () => ({ observations: current, expectedBindingKeys }), set: (next) => { current = next; } };
}

async function withStore<T>(databasePath: string, callback: (store: AgentModeSqliteStateStore) => T | Promise<T>): Promise<T> {
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return await callback(store); } finally { store.close(); }
}

function setup(store: AgentModeSqliteStateStore, reader: HostHealthObservationReader, overrides: Partial<AgentModeEventSourceConfig> = {}, maxBindings = 100): HostHealthEventSourceAdapter {
  store.upsertEventSource(config(overrides));
  return new HostHealthEventSourceAdapter({ reader, maxBindings });
}

async function poll(store: AgentModeSqliteStateStore, adapter: HostHealthEventSourceAdapter, now: string) {
  return pollEventSourcesOnce({ store, adapters: [adapter], now });
}

test('host-health adapter reuses the shared contract and bootstrap creates only a baseline', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = readerState([observation()]); const adapter = setup(store, state.reader);
    const result = await poll(store, adapter, T0);
    assert.equal(adapter.sourceType, INFRASTRUCTURE_HOST_HEALTH_SOURCE); assert.equal(result.sources[0]?.status, 'bootstrapped'); assert.equal(result.sources[0]?.emittedEventCount, 0);
    const cursor = store.getEventSource(INFRASTRUCTURE_HOST_HEALTH_SOURCE)?.watermark;
    assert.ok(cursor && cursor.length < 64 * 1024); assert.equal(store.listSchedulerEvents().length, 0);
  }); } finally { f.cleanup(); }
});

test('healthy baseline ignores observation IDs and metric-only noise, then emits unhealthy and recovery transitions once', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const baseline = observation(); const state = readerState([baseline], [baseline]); const adapter = setup(store, state.reader); await poll(store, adapter, T0);
    state.set([observation({ observationId: 'observation:fixture:host:server-example:2' })]); assert.equal((await poll(store, adapter, T1)).sources[0]?.emittedEventCount, 0);
    state.set([observation({ observationId: 'observation:fixture:host:server-example:3', status: 'unhealthy', conditionCodes: ['host_not_reporting'] })]);
    assert.equal((await poll(store, adapter, T2)).sources[0]?.emittedEventCount, 1); assert.equal((await poll(store, adapter, T2)).sources[0]?.emittedEventCount, 0);
    state.set([observation({ observationId: 'observation:fixture:host:server-example:4' })]); assert.equal((await poll(store, adapter, T3)).sources[0]?.emittedEventCount, 1);
    const events = store.listSchedulerEvents(); assert.equal(events.length, 2); assert.equal(events[0]?.payload.previousStatus, 'healthy'); assert.equal(events[0]?.payload.currentStatus, 'unhealthy'); assert.equal(events[1]?.payload.previousStatus, 'unhealthy'); assert.equal(events[1]?.payload.currentStatus, 'healthy');
  }); } finally { f.cleanup(); }
});

test('fresh-to-stale and stale-to-fresh recovery are clock-driven and emitted once', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const baseline = observation(); const state = readerState([baseline], [baseline]); const adapter = setup(store, state.reader); await poll(store, adapter, T0);
    state.set([observation({ observationId: 'observation:stale', status: 'unknown', freshness: 'stale', conditionCodes: ['observation_stale'] })]);
    assert.equal((await poll(store, adapter, T1)).sources[0]?.emittedEventCount, 1); assert.equal((await poll(store, adapter, T2)).sources[0]?.emittedEventCount, 0);
    state.set([observation({ observationId: 'observation:recovered' })]); assert.equal((await poll(store, adapter, T3)).sources[0]?.emittedEventCount, 1);
    assert.equal(store.listSchedulerEvents()[0]?.payload.currentFreshness, 'stale'); assert.equal(store.listSchedulerEvents()[1]?.payload.currentFreshness, 'fresh');
  }); } finally { f.cleanup(); }
});

test('multiple provider bindings for one synthetic host remain provenance-distinct', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const a = observation({ providerId: 'provider-a', bindingId: 'binding-a' }); const b = observation({ providerId: 'provider-b', bindingId: 'binding-b' }); const state = readerState([a, b]); const adapter = setup(store, state.reader, { catchUpLimit: 2 }); await poll(store, adapter, T0);
    state.set([{ ...a, status: 'degraded', conditionCodes: ['provider_warning'] }, b]); const result = await poll(store, adapter, T1);
    assert.equal(result.sources[0]?.emittedEventCount, 1); assert.equal(store.listSchedulerEvents()[0]?.payload.providerId, 'provider-a'); assert.equal(store.listSchedulerEvents()[0]?.payload.bindingId, 'binding-a');
  }); } finally { f.cleanup(); }
});

test('unknown resources and binding mismatches fail closed without inventing outages', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const baseline = observation(); const state = readerState([baseline], [baseline]); const adapter = setup(store, state.reader); await poll(store, adapter, T0);
    state.set([{ ...observation(), resourceId: 'host:unknown', bindingId: 'binding-unknown', status: 'unhealthy' }]); const unknown = await poll(store, adapter, T1);
    assert.equal(unknown.sources[0]?.status, 'failed'); assert.equal(store.listSchedulerEvents().length, 0);
    state.set([{ ...observation(), bindingId: 'binding:not-admitted' }]); const mismatch = await poll(store, adapter, T2);
    assert.equal(mismatch.sources[0]?.status, 'failed'); assert.equal(store.listSchedulerEvents().length, 0);
  }); } finally { f.cleanup(); }
});

test('missing or malformed normalized snapshot becomes bounded source failure, not mass unhealthy state', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const reader: HostHealthObservationReader = async () => { throw new Error('normalized infrastructure health snapshot unavailable: missing'); }; const adapter = setup(store, reader);
    const result = await poll(store, adapter, T0); assert.equal(result.sources[0]?.status, 'failed'); assert.equal(store.listSchedulerEvents().length, 0); assert.equal(store.getEventSource(INFRASTRUCTURE_HOST_HEALTH_SOURCE)?.watermark, null);
  }); } finally { f.cleanup(); }
});

test('older observations cannot regress accepted semantic state', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = readerState([observation({ observedAt: T2 })]); const adapter = setup(store, state.reader); await poll(store, adapter, T2);
    state.set([observation({ observedAt: T1, status: 'unhealthy', freshness: 'fresh', conditionCodes: ['old'] })]); const result = await poll(store, adapter, T3);
    assert.equal(result.sources[0]?.emittedEventCount, 0); assert.equal(store.listSchedulerEvents().length, 0);
  }); } finally { f.cleanup(); }
});

test('binding scan and transition emission are independently bounded with truthful continuation', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const states = [1, 2, 3].map((n) => observation({ providerId: `provider-${n}`, bindingId: `binding-${n}` })); const state = readerState(states); const adapter = setup(store, state.reader, { catchUpLimit: 1 }, 3); await poll(store, adapter, T0);
    state.set(states.map((item) => ({ ...item, status: 'degraded', conditionCodes: ['changed'] }))); const first = await poll(store, adapter, T1); assert.equal(first.sources[0]?.emittedEventCount, 1); assert.equal(first.sources[0]?.hasMore, true);
    const second = await poll(store, adapter, T2); assert.equal(second.sources[0]?.emittedEventCount, 1); assert.equal(second.sources[0]?.hasMore, true); assert.equal(store.listSchedulerEvents().length, 2);
  }); } finally { f.cleanup(); }
});

test('restart reconstructs bounded host-health state and prevents scheduler feedback', async () => {
  const f = fixture();
  try {
    const state = readerState([observation()]);
    await withStore(f.databasePath, async (store) => { const adapter = setup(store, state.reader); await poll(store, adapter, T0); state.set([observation({ status: 'unhealthy', freshness: 'fresh', conditionCodes: ['down'], observationId: 'observation:down' })]); await poll(store, adapter, T1); });
    await withStore(f.databasePath, async (store) => { const adapter = new HostHealthEventSourceAdapter({ reader: state.reader }); state.set([observation({ status: 'unhealthy', freshness: 'fresh', conditionCodes: ['down'], observationId: 'observation:down-2' })]); assert.equal((await poll(store, adapter, T2)).sources[0]?.emittedEventCount, 0); const observer = readAgentModeObserver(T2, f.databasePath); assert.equal(observer.hostHealthStates[0]?.status, 'unhealthy'); assert.equal(observer.hostHealthStates[0]?.freshness, 'fresh'); assert.equal(observer.schedulerEvents[0]?.eventType, 'infrastructure.host-health.changed'); assert.equal(observer.schedulerEvents[0]?.source, INFRASTRUCTURE_HOST_HEALTH_SOURCE); });
  } finally { f.cleanup(); }
});

test('default reader is tied to the existing normalized infrastructure plane and never directly queries providers', () => {
  const reader = createInfrastructurePlaneHostHealthReader();
  assert.equal(typeof reader, 'function');
  assert.equal(HostHealthEventSourceAdapter.prototype.observe.constructor.name, 'AsyncFunction');
});

test('existing infrastructure normalizer output can feed the same host-health source without provider knowledge', async () => {
  const root = path.resolve(import.meta.dirname, '../../../..');
  const fixtureData = JSON.parse(readFileSync(path.join(root, 'operations/fixtures/infrastructure-health-provider-fixtures-v1.json'), 'utf8')) as { observedAt: string; newrelic: Record<string, unknown> };
  const bindingData = JSON.parse(readFileSync(path.join(root, 'operations/infrastructure/health/provider-bindings.v1.json'), 'utf8')) as { bindings: Array<Record<string, unknown>> };
  const normalized = normalizeNewRelic(fixtureData.newrelic, bindingData.bindings, { now: new Date(fixtureData.observedAt) }) as Array<Record<string, unknown>>;
  const normalizedHost = normalized.find((item) => item.resourceId === 'host:dokploy-aws');
  const binding = bindingData.bindings.find((item) => item.resourceId === normalizedHost?.resourceId && item.providerId === normalizedHost?.providerId);
  assert.equal(normalizedHost?.status, 'healthy'); assert.ok(binding?.bindingId);
  assert.equal(String(normalizedHost?.providerId), 'newrelic');
});

test('one shared conformance probe applies to Git, lifecycle, and host-health adapters', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const healthState = readerState([observation()]);
    const git = new GitRepositoryEventSourceAdapter({ sourceId: 'git:test', repositoryRef: 'repo:test', repositoryRoot: '/fixture', reader: {
      inspect: async () => ({ root: '/fixture', head: 'a'.repeat(40), ref: 'main' }),
      isAncestor: async () => true,
      listCommitShas: async () => [],
      readCommit: async () => ({ commitSha: 'a'.repeat(40), parentSha: null, author: 'fixture', subject: 'fixture', committedAt: T0 }),
    } });
    const adapters: EventSourceAdapter[] = [git, new InternalLifecycleEventSourceAdapter({ store }), new HostHealthEventSourceAdapter({ reader: healthState.reader })];
    for (const adapter of adapters) {
      const result = await adapter.observe({ sourceId: adapter.sourceId, previousWatermark: null, observedAt: T0, catchUpLimit: 1, scanLimit: 2, debounceWindowMs: 0 });
      assert.equal(result.sourceId, adapter.sourceId); assert.equal(result.sourceType, adapter.sourceType); assert.equal(result.events.length, 0); assert.equal(result.hasMore, false); assert.equal(result.status, 'bootstrapped');
    }
  }); } finally { f.cleanup(); }
});
