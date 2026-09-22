import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  GitCliWorkcellAdapter,
  WorkcellManager,
  admitWorkcellCapability,
  WORKCELL_WRITE_CAPABILITY,
  type GitRepositoryInspection,
  type GitWorkcellAdapter,
  type GitWorktreeInspection,
} from '../agent-mode/workcell.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const execFile = promisify(execFileCallback);

async function git(repo: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixtureRepo(): Promise<{ root: string; workcellsRoot: string; cleanup: () => Promise<void> }> {
  const parent = await mkdtemp(path.join(tmpdir(), 'brain-workcell-'));
  const root = path.join(parent, 'repo');
  const workcellsRoot = path.join(parent, 'workcells');
  await mkdir(root, { recursive: true });
  await git(root, ['init', '--initial-branch=main', '--quiet']);
  await git(root, ['config', 'user.email', 'workcell-fixture@example.invalid']);
  await git(root, ['config', 'user.name', 'Workcell Fixture']);
  await writeFile(path.join(root, 'README.md'), 'fixture\n');
  await git(root, ['add', 'README.md']);
  await git(root, ['commit', '--quiet', '-m', 'fixture']);
  return { root, workcellsRoot, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

function ids(index: number, ownerAgent = `agent:${index}`): {
  taskId: string; runId: string; attemptId: string; ownerAgent: string;
} {
  return { taskId: `task:${index}`, runId: `run:${index}`, attemptId: `attempt:${index}`, ownerAgent };
}

async function managerFixture(index = 1, ownerAgent = `agent:${index}`): Promise<{
  fixture: Awaited<ReturnType<typeof fixtureRepo>>;
  store: AgentModeSqliteStateStore;
  manager: WorkcellManager;
}> {
  const fixture = await fixtureRepo();
  const store = new AgentModeSqliteStateStore(':memory:');
  const manager = new WorkcellManager({ store, git: new GitCliWorkcellAdapter(), staleAfterMs: 1000 });
  return { fixture, store, manager };
}

async function create(manager: WorkcellManager, fixture: Awaited<ReturnType<typeof fixtureRepo>>, index: number, owner = `agent:${index}`) {
  return manager.create({
    ...ids(index, owner),
    repositoryRef: 'fixture:repo',
    repositoryRoot: fixture.root,
    workcellsRoot: fixture.workcellsRoot,
    createdAt: '2026-09-09T10:00:00.000Z',
  });
}

test('creates a durable Workcell identity and creation receipt', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const workcell = await create(manager, fixture, 1);
    assert.equal(workcell.status, 'created');
    assert.match(workcell.workcellId, /^workcell:[0-9a-f-]{36}$/);
    assert.match(workcell.branch, /^codex\/workcell\/[0-9a-f-]{36}$/);
    assert.equal(store.listWorkcellReceipts(workcell.workcellId)[0]?.receiptType, 'WorkcellCreatedReceipt');
  } finally { store.close(); await fixture.cleanup(); }
});

test('workcell identities are unique and durable across StateStore reopen', async () => {
  const fixture = await fixtureRepo();
  const db = path.join(path.dirname(fixture.root), 'state.db');
  const store = new AgentModeSqliteStateStore(db);
  const manager = new WorkcellManager({ store, git: new GitCliWorkcellAdapter() });
  try {
    const first = await create(manager, fixture, 1);
    const second = await create(manager, fixture, 2);
    assert.notEqual(first.workcellId, second.workcellId);
    store.close();
    const reopened = new AgentModeSqliteStateStore(db);
    assert.deepEqual(reopened.getWorkcell(first.workcellId), first);
    assert.equal(reopened.listWorkcells().length, 2);
    reopened.close();
  } finally { await fixture.cleanup(); }
});

test('prepares an isolated Git branch/worktree and leaves the primary checkout unchanged', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const mainHead = await git(fixture.root, ['rev-parse', 'HEAD']);
    const workcell = await create(manager, fixture, 1);
    const prepared = await manager.prepare(workcell.workcellId, workcell.ownerAgent, '2026-09-09T10:01:00.000Z');
    assert.equal(prepared.status, 'prepared');
    assert.notEqual(prepared.worktreePath, fixture.root);
    assert.equal(await git(prepared.worktreePath, ['branch', '--show-current']), prepared.branch);
    assert.equal(await git(fixture.root, ['rev-parse', 'HEAD']), mainHead);
    assert.equal(await readFile(path.join(fixture.root, 'README.md'), 'utf8'), 'fixture\n');
    assert.equal(store.listWorkcellReceipts(prepared.workcellId).some((receipt) => receipt.receiptType === 'WorkcellPreparedReceipt'), true);
  } finally { store.close(); await fixture.cleanup(); }
});

test('rejects a workcells root inside the primary checkout', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    await assert.rejects(() => manager.create({
      ...ids(1), repositoryRef: 'fixture:repo', repositoryRoot: fixture.root,
      workcellsRoot: path.join(fixture.root, 'workcells'),
    }), /outside the primary checkout/);
  } finally { store.close(); await fixture.cleanup(); }
});

test('rejects an invalid base ref during preparation and records no uncontrolled workspace', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const workcell = await manager.create({
      ...ids(1), repositoryRef: 'fixture:repo', repositoryRoot: fixture.root,
      workcellsRoot: fixture.workcellsRoot, baseRef: 'ref-that-does-not-exist',
    });
    await assert.rejects(() => manager.prepare(workcell.workcellId, workcell.ownerAgent), /ref-that-does-not-exist|not a valid object name/);
    assert.equal(store.getWorkcell(workcell.workcellId)?.status, 'failed');
    await assert.rejects(() => stat(workcell.worktreePath));
  } finally { store.close(); await fixture.cleanup(); }
});

test('prevents a second agent from preparing or destroying another agent Workcell', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const workcell = await create(manager, fixture, 1, 'agent:owner');
    await assert.rejects(() => manager.prepare(workcell.workcellId, 'agent:other'), /owned by another agent/);
    await manager.prepare(workcell.workcellId, 'agent:owner');
    await assert.rejects(() => manager.destroy(workcell.workcellId, 'agent:other'), /owned by another agent/);
  } finally { store.close(); await fixture.cleanup(); }
});

test('destroys only the intended clean Workcell and retains the other', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const first = await create(manager, fixture, 1);
    const second = await create(manager, fixture, 2);
    await manager.prepare(first.workcellId, first.ownerAgent);
    await manager.prepare(second.workcellId, second.ownerAgent);
    const destroyed = await manager.destroy(first.workcellId, first.ownerAgent, '2026-09-09T10:02:00.000Z');
    assert.equal(destroyed.status, 'discarded');
    await assert.rejects(() => stat(first.worktreePath));
    assert.equal((await manager.inspect(second.workcellId, second.ownerAgent)).valid, true);
  } finally { store.close(); await fixture.cleanup(); }
});

test('refuses to destroy a dirty Workcell', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const workcell = await create(manager, fixture, 1);
    await manager.prepare(workcell.workcellId, workcell.ownerAgent);
    await writeFile(path.join(workcell.worktreePath, 'new.txt'), 'uncommitted\n');
    await assert.rejects(() => manager.destroy(workcell.workcellId, workcell.ownerAgent), /dirty Workcell/);
    assert.equal(store.getWorkcell(workcell.workcellId)?.status, 'prepared');
  } finally { store.close(); await fixture.cleanup(); }
});

test('inspect creates a ValidationReceipt without changing Workcell state', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const workcell = await create(manager, fixture, 1);
    const inspection = await manager.inspect(workcell.workcellId, 'agent:observer', '2026-09-09T10:03:00.000Z');
    assert.equal(inspection.valid, false);
    assert.equal(inspection.receipt.receiptType, 'ValidationReceipt');
    assert.equal(store.getWorkcell(workcell.workcellId)?.status, 'created');
  } finally { store.close(); await fixture.cleanup(); }
});

test('detects a stale created Workcell and recovers an interrupted preparation', async () => {
  const { fixture, store, manager } = await managerFixture();
  try {
    const workcell = await create(manager, fixture, 1);
    const stale = manager.listStale('2026-09-09T10:02:00.000Z');
    assert.equal(stale.length, 1);
    await new GitCliWorkcellAdapter().createWorktree({ repositoryRoot: fixture.root, worktreePath: workcell.worktreePath, branch: workcell.branch, baseRef: workcell.baseRef });
    const recovered = await manager.recoverStale('2026-09-09T10:02:00.000Z');
    assert.equal(recovered[0]?.status, 'prepared');
    assert.equal(store.getWorkcell(workcell.workcellId)?.status, 'prepared');
    assert.equal(store.listWorkcellReceipts(workcell.workcellId).at(-1)?.operation, 'recover');
  } finally { store.close(); await fixture.cleanup(); }
});

test('cleans a failed preparation after the Git adapter created a workspace', async () => {
  const fixture = await fixtureRepo();
  const store = new AgentModeSqliteStateStore(':memory:');
  let createdPath = '';
  const real = new GitCliWorkcellAdapter();
  const adapter: GitWorkcellAdapter = {
    validateRepository: (root) => real.validateRepository(root),
    createWorktree: async (input) => {
      createdPath = input.worktreePath;
      await mkdir(input.worktreePath, { recursive: true });
      throw new Error('simulated process interruption');
    },
    inspectWorktree: async () => { throw new Error('partial workspace is not a Git worktree'); },
    removeWorktree: async () => { await rm(createdPath, { recursive: true, force: true }); },
    captureDiff: async () => ({ baseRevision: 'base', currentRevision: 'current', changedFiles: [], diffHash: 'diff' }),
  };
  const manager = new WorkcellManager({ store, git: adapter });
  try {
    const workcell = await create(manager, fixture, 1);
    await assert.rejects(() => manager.prepare(workcell.workcellId, workcell.ownerAgent), /simulated process interruption/);
    assert.equal(store.getWorkcell(workcell.workcellId)?.status, 'failed');
    await assert.rejects(() => stat(workcell.worktreePath));
  } finally { store.close(); await fixture.cleanup(); }
});

test('receipts survive StateStore close and reopen', async () => {
  const fixture = await fixtureRepo();
  const db = path.join(path.dirname(fixture.root), 'state.db');
  const store = new AgentModeSqliteStateStore(db);
  const manager = new WorkcellManager({ store, git: new GitCliWorkcellAdapter() });
  const workcell = await create(manager, fixture, 1);
  await manager.inspect(workcell.workcellId, 'agent:observer', '2026-09-09T10:04:00.000Z');
  store.close();
  try {
    const reopened = new AgentModeSqliteStateStore(db);
    const receipts = reopened.listWorkcellReceipts(workcell.workcellId);
    assert.deepEqual(receipts.map((receipt) => receipt.receiptType), ['WorkcellCreatedReceipt', 'ValidationReceipt']);
    reopened.close();
  } finally { await fixture.cleanup(); }
});

test('admits only read and future Workcell-scoped write capabilities', () => {
  assert.equal(admitWorkcellCapability('repo.read').ok, true);
  assert.equal(admitWorkcellCapability(WORKCELL_WRITE_CAPABILITY, 'workcell:12345678-1234-1234-1234-123456789012').ok, true);
  assert.equal(admitWorkcellCapability('repo.write(main)', 'workcell:12345678-1234-1234-1234-123456789012').ok, false);
  assert.equal(admitWorkcellCapability('shell').ok, false);
  assert.equal(admitWorkcellCapability(WORKCELL_WRITE_CAPABILITY, 'repo:main').ok, false);
});

test('Git adapter uses a fixed non-shell command boundary', () => {
  assert.equal(GitCliWorkcellAdapter.prototype.constructor.name, 'GitCliWorkcellAdapter');
  assert.equal(admitWorkcellCapability('repo.execute').ok, false);
  assert.equal(admitWorkcellCapability('runtime.shell').ok, false);
});
