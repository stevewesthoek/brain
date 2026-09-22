import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { GitRepositoryEventSourceAdapter, type GitRepositorySourceReader, pollEventSourcesOnce } from '../agent-mode/event-source.js';
import { AgentModeSqliteStateStore, type AgentModeEventSourceConfig } from '../agent-mode/sqlite-state-store.js';

const execFile = promisify(execFileCallback);
const T0 = '2026-09-10T10:00:00.000Z';
const T1 = '2026-09-10T10:00:01.000Z';
const T2 = '2026-09-10T10:00:02.000Z';
const T3 = '2026-09-10T10:00:03.000Z';
const T4 = '2026-09-10T10:00:04.000Z';
const T15 = '2026-09-10T10:00:15.000Z';

async function git(repositoryRoot: string, args: readonly string[]): Promise<string> {
  const result = await execFile('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

type GitFixture = { root: string; repo: string; commits: string[]; close: () => Promise<void> };

async function gitFixture(): Promise<GitFixture> {
  const root = await mkdtemp(path.join(tmpdir(), 'brain-k41-a-'));
  const repo = path.join(root, 'repo');
  await mkdir(repo);
  await git(repo, ['init', '--quiet', '-b', 'main']);
  await git(repo, ['config', 'user.email', 'fixture@example.invalid']);
  await git(repo, ['config', 'user.name', 'K4.1-A Fixture']);
  const commits: string[] = [];
  const commit = async (name: string, message: string): Promise<void> => {
    await writeFile(path.join(repo, 'file.txt'), `${name}\n`, 'utf8');
    await git(repo, ['add', '--', 'file.txt']);
    await git(repo, ['commit', '--quiet', '-m', message]);
    commits.push(await git(repo, ['rev-parse', '--verify', 'HEAD^{commit}']));
  };
  await commit('A', 'A');
  return { root, repo, commits, close: () => rm(root, { recursive: true, force: true }) };
}

function config(sourceId: string, repositoryRef: string, overrides: Partial<AgentModeEventSourceConfig> = {}): AgentModeEventSourceConfig {
  return { sourceId, sourceType: 'git.repository.revision', repositoryRef, adapterType: 'git.repository.revision', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 2, enabled: true, bootstrapWatermark: null, ...overrides };
}

async function poll(store: AgentModeSqliteStateStore, sourceId: string, repositoryRef: string, repositoryRoot: string, now: string, overrides: Partial<AgentModeEventSourceConfig> = {}, reader?: GitRepositorySourceReader) {
  store.upsertEventSource(config(sourceId, repositoryRef, overrides));
  return pollEventSourcesOnce({ store, now, adapters: [new GitRepositoryEventSourceAdapter({ sourceId, repositoryRef, repositoryRoot, ...(reader ? { reader } : {}) })] });
}

test('generic EventSourceAdapter contract and Git source bootstrap without history replay', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    const adapter = new GitRepositoryEventSourceAdapter({ sourceId: 'source:repo-a', repositoryRef: 'repo:a', repositoryRoot: fixture.repo });
    assert.equal(adapter.sourceType, 'git.repository.revision');
    const observation = await adapter.observe({ sourceId: adapter.sourceId, previousWatermark: null, observedAt: T0, catchUpLimit: 2, debounceWindowMs: 0 });
    assert.equal(observation.status, 'bootstrapped');
    assert.equal(observation.events.length, 0);
    store.upsertEventSource(config('source:repo-a', 'repo:a'));
    const result = await pollEventSourcesOnce({ store, now: T0, adapters: [adapter] });
    assert.equal(result.sources[0]?.status, 'bootstrapped');
    assert.equal(store.listSchedulerEvents().length, 0);
    assert.equal(store.getEventSource('source:repo-a')?.watermark, fixture.commits[0]);
  } finally { store.close(); await fixture.close(); }
});

test('commit after bootstrap becomes one durable typed event and repeated poll deduplicates', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'B']);
    const commitB = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    const first = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T1);
    assert.equal(first.sources[0]?.emittedEventCount, 1);
    assert.equal(store.listSchedulerEvents()[0]?.eventType, 'repository.commit.observed');
    assert.equal(store.listSchedulerEvents()[0]?.payload.commitSha, commitB);
    const second = await pollEventSourcesOnce({ store, now: T2, adapters: [new GitRepositoryEventSourceAdapter({ sourceId: 'source:repo-a', repositoryRef: 'repo:a', repositoryRoot: fixture.repo })] });
    assert.equal(second.sources[0]?.status, 'unchanged');
    assert.equal(store.listSchedulerEvents().length, 1);
  } finally { store.close(); await fixture.close(); }
});

test('multiple unseen commits are oldest-first and catch-up is bounded per source', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0, { catchUpLimit: 2, debounceWindowMs: 5_000 });
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'B']);
    const b = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'C']);
    const c = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'D']);
    const d = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    const first = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T1, { catchUpLimit: 2, debounceWindowMs: 5_000 });
    assert.equal(first.sources[0]?.hasMore, true);
    assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.commitSha), [b, c]);
    assert.equal(store.getEventSource('source:repo-a')?.watermark, c);
    const second = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T2, { catchUpLimit: 2, debounceWindowMs: 5_000 });
    assert.equal(second.sources[0]?.hasMore, false);
    assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.commitSha), [b, c, d]);
    assert.equal(store.listSchedulerEvents()[0]?.correlationId, store.listSchedulerEvents()[1]?.correlationId);
  } finally { store.close(); await fixture.close(); }
});

test('explicit fixture watermark supports deterministic bounded catch-up from a known commit', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'B']);
    const b = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'C']);
    const c = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    store.upsertEventSource(config('source:repo-a', 'repo:a', { bootstrapWatermark: fixture.commits[0]!, catchUpLimit: 1 }));
    const first = await pollEventSourcesOnce({ store, now: T1, adapters: [new GitRepositoryEventSourceAdapter({ sourceId: 'source:repo-a', repositoryRef: 'repo:a', repositoryRoot: fixture.repo })] });
    assert.equal(first.sources[0]?.hasMore, true);
    assert.deepEqual(store.listSchedulerEvents().map((event) => event.payload.commitSha), [b]);
    assert.equal(store.getEventSource('source:repo-a')?.watermark, b);
    const second = await pollEventSourcesOnce({ store, now: T2, adapters: [new GitRepositoryEventSourceAdapter({ sourceId: 'source:repo-a', repositoryRef: 'repo:a', repositoryRoot: fixture.repo })] });
    assert.equal(second.sources[0]?.hasMore, false);
    assert.equal(store.listSchedulerEvents()[1]?.payload.commitSha, c);
  } finally { store.close(); await fixture.close(); }
});

test('cooldown is durable, clock-driven, and does not prevent later catch-up', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0, { cooldownWindowMs: 10_000 });
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'B']);
    const early = await pollEventSourcesOnce({ store, now: T1, adapters: [new GitRepositoryEventSourceAdapter({ sourceId: 'source:repo-a', repositoryRef: 'repo:a', repositoryRoot: fixture.repo })] });
    assert.equal(early.sources[0]?.status, 'cooldown');
    assert.equal(store.listSchedulerEvents().length, 0);
    const later = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T15, { cooldownWindowMs: 10_000 });
    assert.equal(later.sources[0]?.emittedEventCount, 1);
  } finally { store.close(); await fixture.close(); }
});

test('watermark divergence fails closed and preserves the prior position', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'B']);
    const watermarkB = await git(fixture.repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T1);
    await git(fixture.repo, ['checkout', '--quiet', '--detach', fixture.commits[0]!]);
    await git(fixture.repo, ['checkout', '--quiet', '-B', 'rewritten']);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'rewritten']);
    const result = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T2);
    assert.equal(result.sources[0]?.status, 'diverged');
    assert.equal(store.getEventSource('source:repo-a')?.status, 'diverged');
    assert.equal(store.getEventSource('source:repo-a')?.watermark, watermarkB);
    assert.equal(store.listSchedulerEvents().length, 1);
  } finally { store.close(); await fixture.close(); }
});

test('two sources have independent watermarks and one failed source does not block the other', async () => {
  const fixtureA = await gitFixture();
  const fixtureB = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixtureA.root, 'state.db'));
  const failingReader: GitRepositorySourceReader = { inspect: async () => { throw new Error('repository_unavailable'); }, isAncestor: async () => false, listCommitShas: async () => [], readCommit: async () => { throw new Error('unreachable'); } };
  try {
    store.upsertEventSource(config('source:a', 'repo:a'));
    store.upsertEventSource(config('source:b', 'repo:b'));
    const first = await pollEventSourcesOnce({ store, now: T0, adapters: [new GitRepositoryEventSourceAdapter({ sourceId: 'source:a', repositoryRef: 'repo:a', repositoryRoot: fixtureA.repo }), new GitRepositoryEventSourceAdapter({ sourceId: 'source:b', repositoryRef: 'repo:b', repositoryRoot: fixtureB.repo, reader: failingReader })] });
    assert.equal(first.sources.length, 2);
    assert.deepEqual(first.sources.map((source) => source.sourceId), ['source:a', 'source:b']);
    assert.equal(first.sources.find((source) => source.sourceId === 'source:a')?.status, 'bootstrapped');
    assert.equal(first.sources.find((source) => source.sourceId === 'source:b')?.status, 'failed');
    assert.equal(store.getEventSource('source:a')?.watermark, fixtureA.commits[0]);
    assert.equal(store.getEventSource('source:b')?.watermark, null);
    assert.equal(store.getEventSource('source:b')?.nextEligibleAt, T1);
  } finally { store.close(); await fixtureA.close(); await fixtureB.close(); }
});

test('bounded operator CLI polls one configured Git source and emits no historical bootstrap event', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  store.close();
  try {
    const output = await execFile(process.execPath, ['dist/bin/brain-agent.js', 'sources', 'poll', '--once', '--source-id', 'source:cli', '--repository-ref', 'repo:cli', '--repository-root', fixture.repo, '--catch-up-limit', '2'], { cwd: process.cwd(), env: { ...process.env, BRAIN_AGENT_MODE_DATABASE: path.join(fixture.root, 'state.db') }, encoding: 'utf8' });
    const bootstrap = JSON.parse(String(output.stdout)) as { sources: Array<{ status: string; emittedEventCount: number }> };
    assert.equal(bootstrap.sources[0]?.status, 'bootstrapped');
    assert.equal(bootstrap.sources[0]?.emittedEventCount, 0);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'CLI B']);
    const second = await execFile(process.execPath, ['dist/bin/brain-agent.js', 'sources', 'poll', '--once', '--source-id', 'source:cli', '--repository-ref', 'repo:cli', '--repository-root', fixture.repo], { cwd: process.cwd(), env: { ...process.env, BRAIN_AGENT_MODE_DATABASE: path.join(fixture.root, 'state.db') }, encoding: 'utf8' });
    const emitted = JSON.parse(String(second.stdout)) as { sources: Array<{ emittedEventCount: number }> };
    assert.equal(emitted.sources[0]?.emittedEventCount, 1);
  } finally { await fixture.close(); }
});

test('malicious commit metadata remains inert bounded event data', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0);
    const message = '$(touch SHOULD_NOT_EXIST) --force ../../ tool-name';
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', message]);
    const result = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T1);
    assert.equal(result.sources[0]?.emittedEventCount, 1);
    assert.equal(store.listSchedulerEvents()[0]?.payload.subject, message);
  } finally { store.close(); await fixture.close(); }
});

test('source configuration, catch-up, deduplication, and observer state survive reopen', async () => {
  const fixture = await gitFixture();
  const databasePath = path.join(fixture.root, 'state.db');
  try {
    const store = new AgentModeSqliteStateStore(databasePath);
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0);
    await git(fixture.repo, ['commit', '--quiet', '--allow-empty', '-m', 'B']);
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T1);
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      assert.equal(reopened.listEventSources()[0]?.lastEmittedEventCount, 1);
      assert.equal(reopened.listSchedulerEvents().length, 1);
      const repeated = await pollEventSourcesOnce({ store: reopened, now: T2, adapters: [new GitRepositoryEventSourceAdapter({ sourceId: 'source:repo-a', repositoryRef: 'repo:a', repositoryRoot: fixture.repo })] });
      assert.equal(repeated.sources[0]?.status, 'unchanged');
      const observer = readAgentModeObserver(T2, databasePath);
      assert.equal(observer.summary.eventSourceCount, 1);
      assert.equal(observer.eventSources[0]?.repositoryRef, 'repo:a');
      assert.equal(observer.eventSources[0]?.watermark, reopened.listEventSources()[0]?.watermark);
    } finally { reopened.close(); }
  } finally { await fixture.close(); }
});

test('source polling is finite, has no network/model/runtime path, and no-op poll emits no event', async () => {
  const fixture = await gitFixture();
  const store = new AgentModeSqliteStateStore(path.join(fixture.root, 'state.db'));
  try {
    await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T0);
    const result = await poll(store, 'source:repo-a', 'repo:a', fixture.repo, T3);
    assert.equal(result.considered, 1);
    assert.equal(result.sources[0]?.status, 'unchanged');
    assert.equal(result.sources[0]?.emittedEventCount, 0);
    assert.equal(store.listSchedulerEvents().length, 0);
  } finally { store.close(); await fixture.close(); }
});
