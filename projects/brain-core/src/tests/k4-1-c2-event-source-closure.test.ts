import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runAgentModeSchedulerTick } from '../agent-mode/scheduler.js';
import {
  BRAIN_TASK_LIFECYCLE_SOURCE,
  CI_WORKFLOW_COMPLETED_EVENT,
  CI_WORKFLOW_RUN_SOURCE,
  GIT_REPOSITORY_REVISION_SOURCE,
  INFRASTRUCTURE_HOST_HEALTH_SOURCE,
  CiWorkflowRunEventSourceAdapter,
  GitRepositoryEventSourceAdapter,
  HostHealthEventSourceAdapter,
  InternalLifecycleEventSourceAdapter,
  pollEventSourcesOnce,
  type BrainTaskLifecycleEvent,
  type CiWorkflowRunObservation,
  type CiWorkflowRunReader,
  type CiWorkflowSemanticEvent,
  type EventSourceAdapter,
  type GitRepositoryCommitEvent,
  type HostHealthObservation,
  type HostHealthTransitionEvent,
} from '../agent-mode/event-source.js';
import { AgentModeSqliteStateStore, type AgentModeEventSourceConfig } from '../agent-mode/sqlite-state-store.js';

const T0 = '2026-09-10T11:00:00.000Z';
const T1 = '2026-09-10T11:01:00.000Z';
const T2 = '2026-09-10T11:02:00.000Z';
const REPOSITORY = 'repo:brain';
type AnyAdapter = EventSourceAdapter<GitRepositoryCommitEvent | BrainTaskLifecycleEvent | HostHealthTransitionEvent | CiWorkflowSemanticEvent>;

function fixture(): { databasePath: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k41-c2-'));
  return { databasePath: path.join(root, 'agent-mode.db'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function config(sourceId: string, sourceType: string, repositoryRef: string, overrides: Partial<AgentModeEventSourceConfig> = {}): AgentModeEventSourceConfig {
  return { sourceId, sourceType, repositoryRef, adapterType: sourceType as AgentModeEventSourceConfig['adapterType'], debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 2, enabled: true, bootstrapWatermark: null, ...overrides };
}

function ciRun(runId: string, overrides: Partial<CiWorkflowRunObservation> = {}): CiWorkflowRunObservation {
  return { providerId: 'fixture-ci', repositoryRef: REPOSITORY, workflowId: 'build.yml', workflowName: 'Build', runId, attempt: 1, headSha: 'a'.repeat(40), status: 'completed', conclusion: 'success', queuedAt: T0, startedAt: T0, completedAt: T1, updatedAt: T1, observedAt: T1, ...overrides };
}

function host(status: HostHealthObservation['status'] = 'healthy'): HostHealthObservation {
  return { observationId: `observation:${status}`, resourceId: 'host:fixture', providerId: 'fixture', bindingId: 'binding:fixture', observedAt: T0, status, freshness: 'fresh', conditionCodes: status === 'healthy' ? [] : ['down'] };
}

async function withStore<T>(databasePath: string, callback: (store: AgentModeSqliteStateStore) => T | Promise<T>): Promise<T> {
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return await callback(store); } finally { store.close(); }
}

test('all four adapters conform to one finite contract with source-specific cursor authority', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const git = new GitRepositoryEventSourceAdapter({ sourceId: 'git:closure', repositoryRef: REPOSITORY, repositoryRoot: '/fixture', reader: {
      inspect: async () => ({ root: '/fixture', head: 'a'.repeat(40), ref: 'main' }), isAncestor: async () => true, listCommitShas: async () => [], readCommit: async () => ({ commitSha: 'a'.repeat(40), parentSha: null, author: 'fixture', subject: 'fixture', committedAt: T0 }),
    } });
    const lifecycle = new InternalLifecycleEventSourceAdapter({ store });
    const hostHealth = new HostHealthEventSourceAdapter({ reader: async () => ({ observations: [], expectedBindingKeys: [] }) });
    const ciReader: CiWorkflowRunReader = { read: async (input) => ({ providerId: 'fixture-ci', repositoryRef: input.repositoryRef, runs: [], nextProviderCursor: null, hasMore: false }) };
    const ci = new CiWorkflowRunEventSourceAdapter({ sourceId: 'ci:closure', repositoryRef: REPOSITORY, reader: ciReader });
    const adapters: AnyAdapter[] = [git, lifecycle, hostHealth, ci];
    for (const adapter of adapters) {
      const observation = await adapter.observe({ sourceId: adapter.sourceId, previousWatermark: null, observedAt: T0, catchUpLimit: 2, scanLimit: 4, debounceWindowMs: 0 });
      assert.equal(observation.sourceId, adapter.sourceId); assert.equal(observation.sourceType, adapter.sourceType); assert.deepEqual(observation.events, []); assert.equal(observation.hasMore, false); assert.equal(observation.status, 'bootstrapped');
    }
  }); } finally { f.cleanup(); }
});

test('combined source polling is finite, fair across all four sources, and scheduler heartbeat stays bounded', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    let gitHead = 'a'.repeat(40); const gitNext = 'b'.repeat(40);
    const gitReader = { inspect: async () => ({ root: '/fixture', head: gitHead, ref: 'main' }), isAncestor: async () => true, listCommitShas: async () => gitHead === gitNext ? [gitNext] : [], readCommit: async () => ({ commitSha: gitNext, parentSha: 'a'.repeat(40), author: 'fixture', subject: '$(ignored)', committedAt: T1 }) };
    let health = host(); const healthReader = async () => ({ observations: [health], expectedBindingKeys: ['host:fixture|fixture|binding:fixture'] });
    let ciRuns = [ciRun('90')]; const ciReader: CiWorkflowRunReader = { read: async (input) => ({ providerId: 'fixture-ci', repositoryRef: input.repositoryRef, runs: ciRuns, nextProviderCursor: null, hasMore: false }) };
    const configs = [
      config('source:git', GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY),
      config(BRAIN_TASK_LIFECYCLE_SOURCE, BRAIN_TASK_LIFECYCLE_SOURCE, 'internal'),
      config(INFRASTRUCTURE_HOST_HEALTH_SOURCE, INFRASTRUCTURE_HOST_HEALTH_SOURCE, 'infrastructure-plane'),
      config(CI_WORKFLOW_RUN_SOURCE, CI_WORKFLOW_RUN_SOURCE, REPOSITORY, { catchUpLimit: 2 }),
    ];
    configs.forEach((item) => store.upsertEventSource(item));
    const adapters: AnyAdapter[] = [
      new GitRepositoryEventSourceAdapter({ sourceId: 'source:git', repositoryRef: REPOSITORY, repositoryRoot: '/fixture', reader: gitReader }),
      new InternalLifecycleEventSourceAdapter({ store }),
      new HostHealthEventSourceAdapter({ reader: healthReader }),
      new CiWorkflowRunEventSourceAdapter({ sourceId: CI_WORKFLOW_RUN_SOURCE, repositoryRef: REPOSITORY, reader: ciReader }),
    ];
    const baseline = await pollEventSourcesOnce({ store, adapters, now: T0 });
    assert.equal(baseline.considered, 4); assert.equal(store.listSchedulerEvents().length, 0); assert.ok(baseline.sources.every((source) => source.status === 'bootstrapped'));
    gitHead = gitNext; store.recordEvent({ eventId: 'lifecycle:1', entityType: 'run', entityId: 'run:1', eventType: 'run_paused', occurredAt: T1, payload: { taskId: 'task:1' } }); health = host('unhealthy'); ciRuns = [ciRun('90'), ciRun('92', { conclusion: 'failure', completedAt: T1, updatedAt: T1 })];
    const active = await pollEventSourcesOnce({ store, adapters, now: T1 });
    assert.equal(active.considered, 4); assert.ok(active.sources.every((source) => ['advanced', 'unchanged'].includes(source.status))); assert.equal(store.listSchedulerEvents().length, 4);
    const origins = new Set(store.listSchedulerEvents().map((event) => event.source)); assert.deepEqual(origins, new Set(['source:git', BRAIN_TASK_LIFECYCLE_SOURCE, INFRASTRUCTURE_HOST_HEALTH_SOURCE, CI_WORKFLOW_RUN_SOURCE]));
    const tick = runAgentModeSchedulerTick({ store, now: T2, maxItems: 16 }); assert.equal(tick.claimed, 4); assert.equal(tick.completed, 0); assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 0);
    const quiet = await pollEventSourcesOnce({ store, adapters, now: T2 }); assert.equal(quiet.considered, 4); assert.equal(quiet.sources.filter((source) => source.emittedEventCount > 0).length, 0);
    const heartbeat = runAgentModeSchedulerTick({ store, now: T2, maxItems: 16 }); assert.equal(heartbeat.outcome, 'NO_ACTION'); assert.equal(heartbeat.claimed, 0); assert.equal(heartbeat.noOp, true);
  }); } finally { f.cleanup(); }
});

test('a failing or backlogged source cannot starve other eligible sources within the bounded registration set', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const sourceIds = ['source:a', 'source:b', 'source:c', 'source:d']; sourceIds.forEach((sourceId) => store.upsertEventSource(config(sourceId, GIT_REPOSITORY_REVISION_SOURCE, sourceId)));
    const calls = new Map<string, number>();
    const adapters: AnyAdapter[] = sourceIds.map((sourceId, index) => ({ sourceId, sourceType: GIT_REPOSITORY_REVISION_SOURCE, observe: async (context) => { calls.set(sourceId, (calls.get(sourceId) ?? 0) + 1); if (index === 0 && context.previousWatermark !== null) throw new Error('backlogged source unavailable'); return { sourceId, sourceType: GIT_REPOSITORY_REVISION_SOURCE, previousWatermark: context.previousWatermark, observedWatermark: context.previousWatermark ?? 'cursor:1', events: [], hasMore: index === 1, observedAt: context.observedAt, status: context.previousWatermark === null ? 'bootstrapped' : 'unchanged' }; } }));
    await pollEventSourcesOnce({ store, adapters, now: T0 }); const result = await pollEventSourcesOnce({ store, adapters, now: T1 });
    assert.equal(result.considered, 4); assert.deepEqual([...calls.values()], [2, 2, 2, 2]); assert.equal(result.sources.find((source) => source.sourceId === 'source:a')?.status, 'failed'); assert.notEqual(result.sources.find((source) => source.sourceId === 'source:b')?.status, 'failed'); assert.equal(store.getEventSource('source:a')?.watermark, 'cursor:1'); assert.equal(store.getEventSource('source:b')?.watermark, 'cursor:1');
  }); } finally { f.cleanup(); }
});

test('combined observation timeout is bounded and preserves source cursor truth', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    store.upsertEventSource(config('source:hang', GIT_REPOSITORY_REVISION_SOURCE, 'repo:hang'));
    const hanging: AnyAdapter = { sourceId: 'source:hang', sourceType: GIT_REPOSITORY_REVISION_SOURCE, observe: async () => new Promise(() => undefined) };
    const result = await pollEventSourcesOnce({ store, adapters: [hanging], now: T0, observationTimeoutMs: 2 });
    assert.equal(result.sources[0]?.status, 'failed'); assert.match(result.sources[0]?.errorReason ?? '', /timed out/); assert.equal(store.getEventSource('source:hang')?.watermark, null);
    store.upsertEventSource(config('source:a-oversized', GIT_REPOSITORY_REVISION_SOURCE, 'repo:oversized'));
    const oversized: AnyAdapter = { sourceId: 'source:a-oversized', sourceType: GIT_REPOSITORY_REVISION_SOURCE, observe: async (context) => ({ sourceId: context.sourceId, sourceType: GIT_REPOSITORY_REVISION_SOURCE, previousWatermark: context.previousWatermark, observedWatermark: 'cursor:oversized', events: [{}, {}, {}] as never, hasMore: true, observedAt: context.observedAt, status: 'advanced' }) };
    const bounded = await pollEventSourcesOnce({ store, adapters: [oversized], now: T1 }); assert.equal(bounded.sources[0]?.status, 'failed'); assert.match(bounded.sources[0]?.errorReason ?? '', /exceeds configured bound/); assert.equal(store.getEventSource('source:a-oversized')?.watermark, null);
  }); } finally { f.cleanup(); }
});

test('disabled sources retain state, re-enable safely, and identity drift cannot inherit a watermark', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    let calls = 0; const reader: CiWorkflowRunReader = { read: async (input) => { calls += 1; return { providerId: 'fixture-ci', repositoryRef: input.repositoryRef, runs: [ciRun('90')], nextProviderCursor: null, hasMore: false }; } };
    store.upsertEventSource(config('ci:disabled', CI_WORKFLOW_RUN_SOURCE, REPOSITORY)); const source = new CiWorkflowRunEventSourceAdapter({ sourceId: 'ci:disabled', repositoryRef: REPOSITORY, reader }); await pollEventSourcesOnce({ store, adapters: [source], now: T0 }); const watermark = store.getEventSource('ci:disabled')?.watermark;
    store.upsertEventSource(config('ci:disabled', CI_WORKFLOW_RUN_SOURCE, REPOSITORY, { enabled: false })); const disabled = await pollEventSourcesOnce({ store, adapters: [source], now: T1 }); assert.equal(disabled.considered, 0); assert.equal(calls, 1); assert.equal(store.getEventSource('ci:disabled')?.watermark, watermark);
    store.upsertEventSource(config('ci:disabled', CI_WORKFLOW_RUN_SOURCE, REPOSITORY, { enabled: true })); await pollEventSourcesOnce({ store, adapters: [source], now: T2 }); assert.equal(calls, 2); assert.equal(store.getEventSource('ci:disabled')?.watermark, watermark);
    assert.equal(store.upsertEventSource(config('ci:disabled', CI_WORKFLOW_RUN_SOURCE, 'repo:changed')), 'conflict'); assert.equal(store.getEventSource('ci:disabled')?.watermark, watermark);
    store.upsertEventSource(config('ci:new-identity', CI_WORKFLOW_RUN_SOURCE, 'repo:changed')); assert.equal(store.getEventSource('ci:new-identity')?.watermark, null);
  }); } finally { f.cleanup(); }
});

test('all source cursor classes survive one combined StateStore restart without duplicate events or feedback routing', async () => {
  const f = fixture();
  try {
    let gitHead = 'a'.repeat(40); const gitNext = 'b'.repeat(40); let health = host(); let ciRuns = [ciRun('90')];
    const gitReader = { inspect: async () => ({ root: '/fixture', head: gitHead, ref: 'main' }), isAncestor: async () => true, listCommitShas: async () => gitHead === gitNext ? [gitNext] : [], readCommit: async () => ({ commitSha: gitNext, parentSha: 'a'.repeat(40), author: 'fixture', subject: 'fixture', committedAt: T1 }) };
    const healthReader = async () => ({ observations: [health], expectedBindingKeys: ['host:fixture|fixture|binding:fixture'] });
    const ciReader: CiWorkflowRunReader = { read: async (input) => ({ providerId: 'fixture-ci', repositoryRef: input.repositoryRef, runs: ciRuns, nextProviderCursor: null, hasMore: false }) };
    const createAdapters = (store: AgentModeSqliteStateStore): AnyAdapter[] => [
      new GitRepositoryEventSourceAdapter({ sourceId: 'restart:git', repositoryRef: REPOSITORY, repositoryRoot: '/fixture', reader: gitReader }),
      new InternalLifecycleEventSourceAdapter({ store, sourceId: 'restart:lifecycle' }),
      new HostHealthEventSourceAdapter({ sourceId: 'restart:host', reader: healthReader }),
      new CiWorkflowRunEventSourceAdapter({ sourceId: 'restart:ci', repositoryRef: REPOSITORY, reader: ciReader }),
    ];
    await withStore(f.databasePath, async (store) => {
      store.upsertEventSource(config('restart:git', GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY)); store.upsertEventSource(config('restart:lifecycle', BRAIN_TASK_LIFECYCLE_SOURCE, 'internal')); store.upsertEventSource(config('restart:host', INFRASTRUCTURE_HOST_HEALTH_SOURCE, 'infrastructure-plane')); store.upsertEventSource(config('restart:ci', CI_WORKFLOW_RUN_SOURCE, REPOSITORY));
      await pollEventSourcesOnce({ store, adapters: createAdapters(store), now: T0 });
      gitHead = gitNext; store.recordEvent({ eventId: 'restart:lifecycle:1', entityType: 'run', entityId: 'run:restart', eventType: 'run_resumed', occurredAt: T1, payload: {} }); health = host('degraded'); ciRuns = [ciRun('90'), ciRun('94', { conclusion: 'failure', completedAt: T1, updatedAt: T1 })];
      const active = await pollEventSourcesOnce({ store, adapters: createAdapters(store), now: T1 }); assert.equal(active.sources.filter((source) => source.emittedEventCount > 0).length, 4); assert.equal(store.listSchedulerEvents().length, 4);
    });
    await withStore(f.databasePath, async (store) => {
      const repeated = await pollEventSourcesOnce({ store, adapters: createAdapters(store), now: T2 }); assert.equal(repeated.sources.filter((source) => source.emittedEventCount > 0).length, 0); assert.equal(store.listSchedulerEvents().length, 4);
      const observer = readAgentModeObserver(T2, f.databasePath); assert.equal(observer.eventSources.length, 4); assert.equal(observer.hostHealthStates.length, 1); assert.equal(observer.ciWorkflowStates.some((state) => state.runId === '94'), true); assert.equal(observer.schedulerEvents.every((event) => String(event.source).startsWith('restart:')), true);
    });
  } finally { f.cleanup(); }
});

test('registration and scheduler payload boundaries reject arbitrary handlers and keep K4.2 input bounded', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    for (let index = 0; index < 16; index += 1) store.upsertEventSource(config(`source:${index}`, GIT_REPOSITORY_REVISION_SOURCE, `repo:${index}`));
    assert.throws(() => store.upsertEventSource(config('source:17', GIT_REPOSITORY_REVISION_SOURCE, 'repo:17')), /registration limit/);
    assert.throws(() => store.upsertEventSource({ ...config('bad', GIT_REPOSITORY_REVISION_SOURCE, 'repo:bad'), sourceType: 'untrusted-handler' }), /outside K4\.1 bounds/);
    assert.equal(store.createSchedulerEvent({ eventId: 'event:bounded', eventType: CI_WORKFLOW_COMPLETED_EVENT, source: CI_WORKFLOW_RUN_SOURCE, occurredAt: T0, receivedAt: T1, causationId: '92:1', correlationId: 'build.yml', deduplicationKey: 'dedup:bounded', payloadVersion: 'k4.0', payload: { runId: '92', attempt: 1, repositoryRef: REPOSITORY, workflowId: 'build.yml', conclusion: 'failure' }, nextEligibleAt: T1, deadline: null, maxAttempts: 3 }), 'created');
    assert.equal(store.createSchedulerEvent({ eventId: 'event:bounded-2', eventType: CI_WORKFLOW_COMPLETED_EVENT, source: CI_WORKFLOW_RUN_SOURCE, occurredAt: T0, receivedAt: T1, causationId: '92:1', correlationId: 'build.yml', deduplicationKey: 'dedup:bounded', payloadVersion: 'k4.0', payload: { runId: '92', attempt: 1, repositoryRef: REPOSITORY, workflowId: 'build.yml', conclusion: 'success' }, nextEligibleAt: T1, deadline: null, maxAttempts: 3 }), 'conflict');
    assert.equal(store.listSchedulerEvents()[0]?.source, CI_WORKFLOW_RUN_SOURCE); assert.equal(Object.hasOwn(store.listSchedulerEvents()[0]?.payload ?? {}, 'command'), false); assert.ok(JSON.stringify(store.listSchedulerEvents()[0]?.payload).length < 32 * 1024);
  }); } finally { f.cleanup(); }
});
