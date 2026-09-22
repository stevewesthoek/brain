import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { GitCliWorkcellAdapter, WorkcellManager } from '../agent-mode/workcell.js';
import { WorkcellWriteRejectedError, WorkcellWriterManager } from '../agent-mode/workcell-writer.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T10:00:00.000Z';

async function git(repo: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixtureRepo(): Promise<{ root: string; workcellsRoot: string; cleanup: () => Promise<void> }> {
  const parent = await mkdtemp(path.join(tmpdir(), 'brain-writer-'));
  const root = path.join(parent, 'repo');
  const workcellsRoot = path.join(parent, 'workcells');
  await mkdir(root, { recursive: true });
  await git(root, ['init', '--initial-branch=main', '--quiet']);
  await git(root, ['config', 'user.email', 'writer-fixture@example.invalid']);
  await git(root, ['config', 'user.name', 'Writer Fixture']);
  await writeFile(path.join(root, 'README.md'), 'fixture\n');
  await git(root, ['add', 'README.md']);
  await git(root, ['commit', '--quiet', '-m', 'fixture']);
  return { root, workcellsRoot, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

async function readyFixture(index = 1): Promise<{
  fixture: Awaited<ReturnType<typeof fixtureRepo>>;
  store: AgentModeSqliteStateStore;
  workcell: Awaited<ReturnType<WorkcellManager['create']>>;
  writer: WorkcellWriterManager;
}> {
  const fixture = await fixtureRepo();
  const store = new AgentModeSqliteStateStore(':memory:');
  const workcells = new WorkcellManager({ store, git: new GitCliWorkcellAdapter() });
  const workcell = await workcells.create({
    taskId: `task:${index}`, runId: `run:${index}`, attemptId: `attempt:${index}`,
    repositoryRef: 'fixture:repo', repositoryRoot: fixture.root,
    workcellsRoot: fixture.workcellsRoot, ownerAgent: `agent:${index}`, createdAt: NOW,
  });
  const prepared = await workcells.prepare(workcell.workcellId, workcell.ownerAgent, '2026-09-09T10:00:01.000Z');
  return { fixture, store, workcell: prepared, writer: new WorkcellWriterManager({ store, git: new GitCliWorkcellAdapter() }) };
}

function leaseRequest(workcellId: string, suffix: string, ownerAgent = 'writer:one', ownerAttempt = 'attempt:writer'): {
  workcellId: string; leaseId: string; ownerAgent: string; ownerAttempt: string; createdAt: string; expiresAt: string;
} {
  return { workcellId, leaseId: `lease:${suffix}`, ownerAgent, ownerAttempt, createdAt: NOW, expiresAt: '2026-09-09T10:05:00.000Z' };
}

function writeRequest(
  fixture: Awaited<ReturnType<typeof fixtureRepo>>,
  workcell: Awaited<ReturnType<WorkcellManager['create']>>,
  lease: { leaseId: string; fenceToken: number },
  now = '2026-09-09T10:01:00.000Z',
) {
  return {
    workcellId: workcell.workcellId,
    capability: 'repo.write(workcell)',
    ownerAgent: 'writer:one',
    ownerAttempt: 'attempt:writer',
    leaseId: lease.leaseId,
    fenceToken: lease.fenceToken,
    repositoryRoot: fixture.root,
    worktreePath: workcell.worktreePath,
    now,
  };
}

test('one Workcell has exactly one active writer lease', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const first = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    const second = writer.grantLease(leaseRequest(workcell.workcellId, 'two', 'writer:two', 'attempt:two'));
    assert.equal(first.result, 'granted');
    assert.equal(second.result, 'rejected');
    assert.equal(store.listWorkcellWriterLeases(workcell.workcellId).filter((lease) => lease.status === 'active').length, 1);
    assert.equal(second.receipt.receiptType, 'WriteRejectedReceipt');
  } finally { store.close(); await fixture.cleanup(); }
});

test('expired lease recovery replaces an abandoned writer deterministically', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const first = writer.grantLease({ ...leaseRequest(workcell.workcellId, 'one'), expiresAt: '2026-09-09T10:01:00.000Z' });
    assert.equal(first.lease?.fenceToken, 1);
    const second = writer.grantLease({ ...leaseRequest(workcell.workcellId, 'two', 'writer:two', 'attempt:two'), createdAt: '2026-09-09T10:02:00.000Z' });
    assert.equal(second.result, 'granted');
    assert.equal(second.lease?.fenceToken, 2);
    assert.equal(store.getWorkcellWriterLease('lease:one')?.status, 'expired');
  } finally { store.close(); await fixture.cleanup(); }
});

test('new leases receive a strictly higher fence token after release', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const first = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    assert.equal(first.lease?.fenceToken, 1);
    assert.equal(writer.releaseLease({ leaseId: 'lease:one', ownerAgent: 'writer:one', ownerAttempt: 'attempt:writer', releasedAt: '2026-09-09T10:01:00.000Z' }).result, 'released');
    const second = writer.grantLease({ ...leaseRequest(workcell.workcellId, 'two'), createdAt: '2026-09-09T10:02:00.000Z' });
    assert.equal(second.lease?.fenceToken, 2);
    assert.deepEqual(store.listWorkcellWriterLeases(workcell.workcellId).map((lease) => lease.fenceToken), [1, 2]);
  } finally { store.close(); await fixture.cleanup(); }
});

test('stale fence and crashed writer cannot pass write admission', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const first = writer.grantLease({ ...leaseRequest(workcell.workcellId, 'one'), expiresAt: '2026-09-09T10:01:00.000Z' });
    const second = writer.grantLease({ ...leaseRequest(workcell.workcellId, 'two', 'writer:two', 'attempt:two'), createdAt: '2026-09-09T10:02:00.000Z' });
    const stale = await writer.admitWrite({ ...writeRequest(fixture, workcell, { leaseId: first.lease!.leaseId, fenceToken: first.lease!.fenceToken }, '2026-09-09T10:03:00.000Z'), ownerAgent: 'writer:one', ownerAttempt: 'attempt:writer' });
    const current = await writer.admitWrite({ ...writeRequest(fixture, workcell, { leaseId: second.lease!.leaseId, fenceToken: second.lease!.fenceToken }, '2026-09-09T10:03:00.000Z'), ownerAgent: 'writer:two', ownerAttempt: 'attempt:two' });
    const staleFence = await writer.admitWrite({ ...writeRequest(fixture, workcell, { leaseId: second.lease!.leaseId, fenceToken: second.lease!.fenceToken - 1 }, '2026-09-09T10:03:00.000Z'), ownerAgent: 'writer:two', ownerAttempt: 'attempt:two' });
    assert.equal(stale.ok, false);
    assert.match(stale.reason, /lease_expired|stale_fence_token/);
    assert.equal(current.ok, true);
    assert.equal(staleFence.ok, false);
    assert.equal(staleFence.reason, 'stale_fence_token');
    assert.equal(store.listWorkcellWriterReceipts(workcell.workcellId).some((receipt) => receipt.receiptType === 'WriteRejectedReceipt'), true);
  } finally { store.close(); await fixture.cleanup(); }
});

test('wrong owner is rejected and cannot release the active lease', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const lease = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    const result = writer.releaseLease({ leaseId: lease.lease!.leaseId, ownerAgent: 'writer:two', ownerAttempt: 'attempt:two', releasedAt: '2026-09-09T10:01:00.000Z' });
    assert.equal(result.result, 'rejected');
    assert.equal(store.getWorkcellWriterLease(lease.lease!.leaseId)?.status, 'active');
  } finally { store.close(); await fixture.cleanup(); }
});

test('wrong Workcell and main checkout bindings are rejected', async () => {
  const first = await readyFixture(1);
  const secondWorkcells = new WorkcellManager({ store: first.store, git: new GitCliWorkcellAdapter() });
  const second = await secondWorkcells.create({ taskId: 'task:2', runId: 'run:2', attemptId: 'attempt:2', repositoryRef: 'fixture:repo', repositoryRoot: first.fixture.root, workcellsRoot: first.fixture.workcellsRoot, ownerAgent: 'agent:2', createdAt: NOW });
  await secondWorkcells.prepare(second.workcellId, 'agent:2', '2026-09-09T10:00:01.000Z');
  try {
    const lease = first.writer.grantLease(leaseRequest(first.workcell.workcellId, 'one'));
    const wrongWorkcell = await first.writer.admitWrite({ ...writeRequest(first.fixture, second, lease.lease!, '2026-09-09T10:01:00.000Z'), workcellId: second.workcellId });
    const main = await first.writer.admitWrite({ ...writeRequest(first.fixture, first.workcell, lease.lease!, '2026-09-09T10:01:00.000Z'), worktreePath: first.fixture.root });
    assert.equal(wrongWorkcell.ok, false);
    assert.equal(main.ok, false);
    assert.match(main.reason, /resource_binding_mismatch/);
  } finally { first.store.close(); await first.fixture.cleanup(); }
});

test('only an admitted Workcell-scoped capability can pass the write boundary', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const lease = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    const denied = await writer.admitWrite({ ...writeRequest(fixture, workcell, lease.lease!), capability: 'repo.write(main)' });
    const shell = await writer.admitWrite({ ...writeRequest(fixture, workcell, lease.lease!), capability: 'shell' });
    assert.equal(denied.ok, false);
    assert.equal(shell.ok, false);
    assert.equal(store.listWorkcellWriterReceipts(workcell.workcellId).filter((receipt) => receipt.receiptType === 'WriteRejectedReceipt').length, 2);
  } finally { store.close(); await fixture.cleanup(); }
});

test('missing writer lease is rejected without consulting or modifying the Workcell', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const result = await writer.admitWrite({
      ...writeRequest(fixture, workcell, { leaseId: 'lease:missing', fenceToken: 1 }),
      leaseId: null,
      fenceToken: null,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'lease_missing');
    assert.equal(store.getWorkcell(workcell.workcellId)?.status, 'prepared');
  } finally { store.close(); await fixture.cleanup(); }
});

test('diff capture is read-only, complete, and deterministic', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const lease = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    await writeFile(path.join(workcell.worktreePath, 'change.txt'), 'change\n');
    const request = writeRequest(fixture, workcell, lease.lease!);
    const first = await writer.captureDiff(request);
    const second = await writer.captureDiff(request);
    assert.equal(first.diffHash, second.diffHash);
    assert.deepEqual(first.changedFiles, ['change.txt']);
    assert.equal(first.baseRevision.length, 40);
    assert.equal(first.currentRevision.length, 40);
    assert.equal(store.getWorkcellDiff(first.diffId)?.diffHash, first.diffHash);
    assert.equal((await readFile(path.join(workcell.worktreePath, 'change.txt'), 'utf8')), 'change\n');
  } finally { store.close(); await fixture.cleanup(); }
});

test('diff capture rejects stale writers before consulting Git', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const lease = writer.grantLease({ ...leaseRequest(workcell.workcellId, 'one'), expiresAt: '2026-09-09T10:01:00.000Z' });
    await assert.rejects(() => writer.captureDiff(writeRequest(fixture, workcell, lease.lease!, '2026-09-09T10:02:00.000Z')), WorkcellWriteRejectedError);
    assert.equal(store.getWorkcellDiff('diff:missing'), undefined);
  } finally { store.close(); await fixture.cleanup(); }
});

test('validation becomes validation_ready only after diff and stored result', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const lease = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    const diff = await writer.captureDiff(writeRequest(fixture, workcell, lease.lease!));
    const validation = writer.requestValidation({ diffId: diff.diffId, actor: 'reviewer:one', requestedAt: '2026-09-09T10:02:00.000Z', result: 'passed' });
    assert.equal(validation.state, 'validation_ready');
    assert.equal(store.getWorkcellValidation(validation.validationId)?.state, 'validation_ready');
    assert.equal(store.listWorkcellWriterReceipts(workcell.workcellId).some((receipt) => receipt.receiptType === 'ValidationAdmissionReceipt'), true);
  } finally { store.close(); await fixture.cleanup(); }
});

test('failed validation is stored but cannot become validation_ready', async () => {
  const { fixture, store, workcell, writer } = await readyFixture();
  try {
    const lease = writer.grantLease(leaseRequest(workcell.workcellId, 'one'));
    const diff = await writer.captureDiff(writeRequest(fixture, workcell, lease.lease!));
    const validation = writer.requestValidation({ diffId: diff.diffId, actor: 'reviewer:one', requestedAt: '2026-09-09T10:02:00.000Z', result: 'failed' });
    assert.equal(validation.state, 'rejected');
    assert.equal(store.getWorkcellValidation(validation.validationId)?.result, 'failed');
  } finally { store.close(); await fixture.cleanup(); }
});

test('writer leases, decisions, diff, and validation receipts survive StateStore restart', async () => {
  const fixture = await fixtureRepo();
  const db = path.join(path.dirname(fixture.root), 'state.db');
  const firstStore = new AgentModeSqliteStateStore(db);
  const workcells = new WorkcellManager({ store: firstStore, git: new GitCliWorkcellAdapter() });
  const workcell = await workcells.create({ taskId: 'task:restart', runId: 'run:restart', attemptId: 'attempt:restart', repositoryRef: 'fixture:repo', repositoryRoot: fixture.root, workcellsRoot: fixture.workcellsRoot, ownerAgent: 'agent:restart', createdAt: NOW });
  await workcells.prepare(workcell.workcellId, 'agent:restart', '2026-09-09T10:00:01.000Z');
  const writer = new WorkcellWriterManager({ store: firstStore, git: new GitCliWorkcellAdapter() });
  const lease = writer.grantLease(leaseRequest(workcell.workcellId, 'restart'));
  const diff = await writer.captureDiff(writeRequest(fixture, workcell, lease.lease!));
  const validation = writer.requestValidation({ diffId: diff.diffId, actor: 'reviewer:restart', requestedAt: '2026-09-09T10:02:00.000Z', result: 'passed' });
  firstStore.close();
  try {
    const reopened = new AgentModeSqliteStateStore(db);
    assert.equal(reopened.getWorkcellWriterLease(lease.lease!.leaseId)?.fenceToken, 1);
    assert.equal(reopened.getWorkcellDiff(diff.diffId)?.diffHash, diff.diffHash);
    assert.equal(reopened.getWorkcellValidation(validation.validationId)?.state, 'validation_ready');
    assert.equal(reopened.listWorkcellWriterReceipts(workcell.workcellId).length >= 3, true);
    reopened.close();
  } finally { await fixture.cleanup(); }
});
