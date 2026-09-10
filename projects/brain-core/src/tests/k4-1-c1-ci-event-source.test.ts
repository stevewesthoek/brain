import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import {
  CI_WORKFLOW_COMPLETED_EVENT,
  CI_WORKFLOW_RUN_SOURCE,
  CI_WORKFLOW_STARTED_EVENT,
  CiWorkflowRunEventSourceAdapter,
  GitRepositoryEventSourceAdapter,
  GitHubActionsCiObservationReader,
  HostHealthEventSourceAdapter,
  InternalLifecycleEventSourceAdapter,
  normalizeGitHubActionsWorkflowRun,
  pollEventSourcesOnce,
  type CiWorkflowRunObservation,
  type CiWorkflowRunReader,
  type GitHubActionsWorkflowRunPageReader,
  type EventSourceAdapter,
} from '../agent-mode/event-source.js';
import { AgentModeSqliteStateStore, type AgentModeEventSourceConfig } from '../agent-mode/sqlite-state-store.js';

const T0 = '2026-09-10T10:00:00.000Z';
const T1 = '2026-09-10T10:01:00.000Z';
const T2 = '2026-09-10T10:02:00.000Z';
const T3 = '2026-09-10T10:03:00.000Z';
const REPOSITORY = 'github:stevewesthoek/brain';

function fixture(): { databasePath: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-k41-c1-'));
  return { databasePath: path.join(root, 'agent-mode.db'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function config(overrides: Partial<AgentModeEventSourceConfig> = {}): AgentModeEventSourceConfig {
  return { sourceId: CI_WORKFLOW_RUN_SOURCE, sourceType: CI_WORKFLOW_RUN_SOURCE, repositoryRef: REPOSITORY, adapterType: 'ci.workflow-run', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 2, enabled: true, bootstrapWatermark: null, ...overrides };
}

function run(overrides: Partial<CiWorkflowRunObservation> = {}): CiWorkflowRunObservation {
  return {
    providerId: 'fixture-ci', repositoryRef: REPOSITORY, workflowId: 'build.yml', workflowName: 'Build', runId: '92', attempt: 1, headSha: 'a'.repeat(40), status: 'queued', conclusion: null,
    queuedAt: T0, startedAt: null, completedAt: null, updatedAt: T0, observedAt: T0, ...overrides,
  };
}

function mutableReader(initial: CiWorkflowRunObservation[]): { reader: CiWorkflowRunReader; set: (runs: CiWorkflowRunObservation[]) => void } {
  let current = initial;
  return {
    reader: { read: async (input) => ({ providerId: 'fixture-ci', repositoryRef: input.repositoryRef, runs: current, nextProviderCursor: null, hasMore: false }) },
    set: (runs) => { current = runs; },
  };
}

async function withStore<T>(databasePath: string, callback: (store: AgentModeSqliteStateStore) => T | Promise<T>): Promise<T> {
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return await callback(store); } finally { store.close(); }
}

function adapter(reader: CiWorkflowRunReader, overrides: Partial<ConstructorParameters<typeof CiWorkflowRunEventSourceAdapter>[0]> = {}): CiWorkflowRunEventSourceAdapter {
  return new CiWorkflowRunEventSourceAdapter({ sourceId: CI_WORKFLOW_RUN_SOURCE, repositoryRef: REPOSITORY, reader, ...overrides });
}

async function poll(store: AgentModeSqliteStateStore, source: CiWorkflowRunEventSourceAdapter, now: string) {
  return pollEventSourcesOnce({ store, adapters: [source], now });
}

test('GitHub Actions normalizer returns only the provider-neutral CI contract', () => {
  const normalized = normalizeGitHubActionsWorkflowRun({ id: 92, workflow_id: 17, name: 'Build', run_attempt: 2, head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'timed-out', created_at: T0, run_started_at: T1, updated_at: T2, completed_at: T2, malicious: 'ignored' } as never, REPOSITORY, T2);
  assert.deepEqual(normalized, { providerId: 'github-actions', repositoryRef: REPOSITORY, workflowId: '17', workflowName: 'Build', runId: '92', attempt: 2, headSha: 'b'.repeat(40), status: 'completed', conclusion: 'timed_out', queuedAt: T0, startedAt: T1, completedAt: T2, updatedAt: T2, observedAt: T2 });
  assert.equal(Object.hasOwn(normalized, 'malicious'), false);
});

test('GitHub Actions page reader is injected, oldest-first consumers stay bounded, and pagination is truthful', async () => {
  const calls: Array<{ cursor: string | null; perPage: number }> = [];
  const pageReader: GitHubActionsWorkflowRunPageReader = { readPage: async (input) => {
    calls.push({ cursor: input.providerCursor, perPage: input.perPage });
    if (!input.providerCursor) return { repositoryRef: REPOSITORY, runs: [{ id: 91, workflow_id: 'build.yml', status: 'completed', conclusion: 'success', created_at: T0 }], nextProviderCursor: 'page-2', hasMore: true };
    return { repositoryRef: REPOSITORY, runs: [{ id: 92, workflow_id: 'build.yml', status: 'completed', conclusion: 'failure', created_at: T1 }], nextProviderCursor: null, hasMore: false };
  } };
  const reader = new GitHubActionsCiObservationReader(pageReader);
  const first = await reader.read({ repositoryRef: REPOSITORY, providerCursor: null, maxItems: 1, maxPages: 8, observedAt: T2 });
  assert.equal(first.runs.length, 1); assert.equal(first.hasMore, true); assert.equal(first.nextProviderCursor, 'page-2'); assert.deepEqual(calls, [{ cursor: null, perPage: 1 }]);
  const second = await reader.read({ repositoryRef: REPOSITORY, providerCursor: first.nextProviderCursor, maxItems: 1, maxPages: 1, observedAt: T2 });
  assert.equal(second.runs[0]?.runId, '92'); assert.equal(second.hasMore, false); assert.ok(calls.every((call) => call.perPage >= 1 && call.perPage <= 100));
});

test('CI source bootstraps historical runs 90 and 91 without a history flood', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' }), run({ runId: '91', status: 'completed', conclusion: 'failure' })]);
    store.upsertEventSource(config());
    const result = await poll(store, adapter(state.reader), T0);
    assert.equal(result.sources[0]?.status, 'bootstrapped'); assert.equal(result.sources[0]?.emittedEventCount, 0); assert.equal(store.listSchedulerEvents().length, 0);
    const cursor = store.getEventSource(CI_WORKFLOW_RUN_SOURCE)?.watermark; assert.ok(cursor && cursor.length < 64 * 1024);
  }); } finally { f.cleanup(); }
});

test('queued to in-progress to completed produces one started and one completed event', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' })]); store.upsertEventSource(config()); const source = adapter(state.reader); await poll(store, source, T0);
    state.set([run({ runId: '90', status: 'completed', conclusion: 'success' }), run({ status: 'queued', updatedAt: T1 })]);
    assert.equal((await poll(store, source, T1)).sources[0]?.emittedEventCount, 1);
    state.set([run({ runId: '90', status: 'completed', conclusion: 'success' }), run({ status: 'in_progress', startedAt: T2, updatedAt: T2 })]); assert.equal((await poll(store, source, T2)).sources[0]?.emittedEventCount, 0);
    state.set([run({ runId: '90', status: 'completed', conclusion: 'success' }), run({ status: 'completed', conclusion: 'success', startedAt: T2, completedAt: T3, updatedAt: T3 })]); assert.equal((await poll(store, source, T3)).sources[0]?.emittedEventCount, 1);
    assert.deepEqual(store.listSchedulerEvents().map((event) => event.eventType), [CI_WORKFLOW_STARTED_EVENT, CI_WORKFLOW_COMPLETED_EVENT]);
  }); } finally { f.cleanup(); }
});

test('completed failure, cancelled, timed-out, and rerun attempts remain typed and identity-distinct', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' })]); store.upsertEventSource(config({ catchUpLimit: 10 })); const source = adapter(state.reader); await poll(store, source, T0);
    state.set(['93', '94'].flatMap((runId) => [run({ runId, status: 'completed', conclusion: runId === '93' ? 'failure' : 'failure', completedAt: T1, updatedAt: T1 }), ...(runId === '94' ? [run({ runId, attempt: 2, status: 'completed', conclusion: 'success', completedAt: T2, updatedAt: T2 })] : [])]));
    assert.equal((await poll(store, source, T2)).sources[0]?.emittedEventCount, 3);
    assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.conclusion), ['failure', 'failure', 'success']);
    assert.notEqual(store.listSchedulerEvents()[1]?.deduplicationKey, store.listSchedulerEvents()[2]?.deduplicationKey);
    state.set([run({ runId: '93', status: 'completed', conclusion: 'cancelled', completedAt: T3, updatedAt: T3 }), run({ runId: '94', attempt: 2, status: 'completed', conclusion: 'timed_out', completedAt: T3, updatedAt: T3 })]);
    assert.equal((await poll(store, source, T3)).sources[0]?.emittedEventCount, 2);
  }); } finally { f.cleanup(); }
});

test('catch-up is oldest-first and bounded by emitted events while preserving continuation', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' })]); store.upsertEventSource(config()); const source = adapter(state.reader); await poll(store, source, T0);
    state.set(['92', '93', '94'].map((runId, index) => run({ runId, status: 'completed', conclusion: 'failure', queuedAt: `2026-09-10T10:0${index + 1}:00.000Z`, completedAt: T1, updatedAt: T1 })));
    const first = await poll(store, source, T1); assert.equal(first.sources[0]?.emittedEventCount, 2); assert.equal(first.sources[0]?.hasMore, true); assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.runId), ['92', '93']);
    const second = await poll(store, source, T2); assert.equal(second.sources[0]?.emittedEventCount, 1); assert.equal(second.sources[0]?.hasMore, false); assert.equal(store.listSchedulerEvents()[2]?.payload.runId, '94');
  }); } finally { f.cleanup(); }
});

test('older provider observations cannot regress a completed run', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' })]); store.upsertEventSource(config()); const source = adapter(state.reader); await poll(store, source, T0);
    state.set([run({ status: 'completed', conclusion: 'success', completedAt: T1, updatedAt: T1 })]); assert.equal((await poll(store, source, T1)).sources[0]?.emittedEventCount, 1);
    state.set([run({ status: 'in_progress', updatedAt: T0 })]); assert.equal((await poll(store, source, T2)).sources[0]?.emittedEventCount, 0); assert.equal(store.listSchedulerEvents().length, 1);
  }); } finally { f.cleanup(); }
});

test('provider failures and malformed cursors preserve the previous watermark and emit no fake CI event', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' })]); store.upsertEventSource(config()); const source = adapter(state.reader); await poll(store, source, T0); const before = store.getEventSource(CI_WORKFLOW_RUN_SOURCE)?.watermark;
    const failing: CiWorkflowRunReader = { read: async () => { throw new Error('provider rate limit'); } }; const failure = await poll(store, adapter(failing), T1);
    assert.equal(failure.sources[0]?.status, 'failed'); assert.equal(store.getEventSource(CI_WORKFLOW_RUN_SOURCE)?.watermark, before); assert.equal(store.listSchedulerEvents().length, 0);
    const malformedSourceId = 'ci:malformed'; store.upsertEventSource(config({ sourceId: malformedSourceId, bootstrapWatermark: '{malformed' })); const malformed = await poll(store, adapter(state.reader, { sourceId: malformedSourceId }), T2); assert.equal(malformed.sources[0]?.status, 'failed'); assert.equal(store.listSchedulerEvents().length, 0);
  }); } finally { f.cleanup(); }
});

test('repository mismatch and invalid provider pagination fail closed', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    store.upsertEventSource(config()); const mismatch: CiWorkflowRunReader = { read: async () => ({ providerId: 'fixture-ci', repositoryRef: 'github:other/repo', runs: [], nextProviderCursor: null, hasMore: false }) }; const result = await poll(store, adapter(mismatch), T0);
    assert.equal(result.sources[0]?.status, 'failed'); assert.equal(store.listSchedulerEvents().length, 0);
    const invalidPage: GitHubActionsWorkflowRunPageReader = { readPage: async () => ({ repositoryRef: REPOSITORY, runs: [], nextProviderCursor: null, hasMore: true }) }; await assert.rejects(() => new GitHubActionsCiObservationReader(invalidPage).read({ repositoryRef: REPOSITORY, providerCursor: null, maxItems: 10, maxPages: 1 }), /pagination/);
  }); } finally { f.cleanup(); }
});

test('restart reconstructs CI semantic state, observer exposes safe states, and repeated poll is a no-op', async () => {
  const f = fixture();
  try {
    const state = mutableReader([run({ runId: '90', status: 'completed', conclusion: 'success' })]);
    await withStore(f.databasePath, async (store) => { store.upsertEventSource(config()); const source = adapter(state.reader); await poll(store, source, T0); state.set([run({ status: 'completed', conclusion: 'success', completedAt: T1, updatedAt: T1 })]); await poll(store, source, T1); });
    await withStore(f.databasePath, async (store) => { const source = adapter(state.reader); assert.equal((await poll(store, source, T2)).sources[0]?.emittedEventCount, 0); const observer = readAgentModeObserver(T2, f.databasePath); const state92 = observer.ciWorkflowStates.find((item) => item.runId === '92'); assert.equal(state92?.runId, '92'); assert.equal(state92?.conclusion, 'success'); assert.equal(observer.schedulerEvents[0]?.eventType, CI_WORKFLOW_COMPLETED_EVENT); });
  } finally { f.cleanup(); }
});

test('one shared conformance probe applies to Git, lifecycle, host-health, and CI adapters', async () => {
  const f = fixture();
  try { await withStore(f.databasePath, async (store) => {
    const ci = adapter(mutableReader([]).reader);
    const git = new GitRepositoryEventSourceAdapter({ sourceId: 'git:conformance', repositoryRef: REPOSITORY, repositoryRoot: '/fixture', reader: {
      inspect: async () => ({ root: '/fixture', head: 'a'.repeat(40), ref: 'main' }), isAncestor: async () => true, listCommitShas: async () => [], readCommit: async () => ({ commitSha: 'a'.repeat(40), parentSha: null, author: 'fixture', subject: 'fixture', committedAt: T0 }),
    } });
    const lifecycle = new InternalLifecycleEventSourceAdapter({ store });
    const host = new HostHealthEventSourceAdapter({ reader: async () => ({ observations: [], expectedBindingKeys: [] }) });
    const adapters: EventSourceAdapter[] = [git, lifecycle, host, ci];
    for (const source of adapters) {
      const observation = await source.observe({ sourceId: source.sourceId, previousWatermark: null, observedAt: T0, catchUpLimit: 2, scanLimit: 4, debounceWindowMs: 0 });
      assert.equal(observation.sourceId, source.sourceId); assert.equal(observation.sourceType, source.sourceType); assert.deepEqual(observation.events, []); assert.equal(observation.hasMore, false); assert.equal(observation.status, 'bootstrapped');
    }
  }); } finally { f.cleanup(); }
});
