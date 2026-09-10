import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile, symlink } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { GitCliWorkcellAdapter, WorkcellManager } from '../agent-mode/workcell.js';
import { WorkcellWriterManager } from '../agent-mode/workcell-writer.js';
import { MAX_WORKCELL_TEXT_FILE_BYTES, WorkcellFileMutationManager, type WorkcellFilePatchRequest, type WorkcellMutationFailurePoint } from '../agent-mode/workcell-file-mutation.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T10:00:00.000Z';

async function git(repo: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixtureRepo(): Promise<{ root: string; workcellsRoot: string; cleanup: () => Promise<void> }> {
  const parent = await mkdtemp(path.join(tmpdir(), 'brain-file-patch-'));
  const root = path.join(parent, 'repo');
  const workcellsRoot = path.join(parent, 'workcells');
  await mkdir(root, { recursive: true });
  await git(root, ['init', '--initial-branch=main', '--quiet']);
  await git(root, ['config', 'user.email', 'file-patch-fixture@example.invalid']);
  await git(root, ['config', 'user.name', 'File Patch Fixture']);
  await writeFile(path.join(root, 'notes.txt'), 'alpha\nbeta\n');
  await git(root, ['add', 'notes.txt']);
  await git(root, ['commit', '--quiet', '-m', 'fixture']);
  return { root, workcellsRoot, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

async function readyFixture(databasePath = ':memory:'): Promise<{
  fixture: Awaited<ReturnType<typeof fixtureRepo>>;
  store: AgentModeSqliteStateStore;
  workcell: Awaited<ReturnType<WorkcellManager['create']>>;
  writer: WorkcellWriterManager;
  patcher: WorkcellFileMutationManager;
  baseRequest: WorkcellFilePatchRequest;
}> {
  const fixture = await fixtureRepo();
  const store = new AgentModeSqliteStateStore(databasePath);
  const workcells = new WorkcellManager({ store, git: new GitCliWorkcellAdapter() });
  const workcell = await workcells.create({ taskId: 'task:file', runId: 'run:file', attemptId: 'attempt:file', repositoryRef: 'fixture:repo', repositoryRoot: fixture.root, workcellsRoot: fixture.workcellsRoot, ownerAgent: 'agent:file', createdAt: NOW });
  const prepared = await workcells.prepare(workcell.workcellId, workcell.ownerAgent, '2026-09-09T10:00:01.000Z');
  const writer = new WorkcellWriterManager({ store, git: new GitCliWorkcellAdapter() });
  const lease = writer.grantLease({ workcellId: prepared.workcellId, leaseId: 'lease:file', ownerAgent: 'writer:file', ownerAttempt: 'attempt:writer', createdAt: NOW, expiresAt: '2026-09-09T10:05:00.000Z' });
  assert.equal(lease.result, 'granted');
  const source = 'alpha\nbeta\n';
  const baseRequest: WorkcellFilePatchRequest = {
    operationId: 'op:file:one', workcellId: prepared.workcellId, repositoryRef: 'fixture:repo', repositoryRoot: fixture.root, worktreePath: prepared.worktreePath,
    relativePath: 'notes.txt', ownerAgent: 'writer:file', ownerAttempt: 'attempt:writer', leaseId: lease.lease!.leaseId, fenceToken: lease.lease!.fenceToken,
    expectedPreimageHash: await hash(source), oldText: 'beta', replacementText: 'gamma', now: '2026-09-09T10:01:00.000Z',
  };
  return { fixture, store, workcell: prepared, writer, patcher: new WorkcellFileMutationManager({ store, writer }), baseRequest };
}

async function hash(value: string | Uint8Array): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(value).digest('hex');
}

function closeFixture(fixture: Awaited<ReturnType<typeof readyFixture>>): Promise<void> {
  fixture.store.close();
  return fixture.fixture.cleanup();
}

test('applies exactly one bounded text patch and records pre/post evidence', async () => {
  const f = await readyFixture();
  try {
    const result = await f.patcher.applyPatch(f.baseRequest);
    assert.equal(result.result, 'applied');
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\ngamma\n');
    assert.equal(result.receipt?.receiptType, 'WorkcellWriteAppliedReceipt');
    assert.equal(result.receipt?.preimageHash, f.baseRequest.expectedPreimageHash);
    assert.equal(result.receipt?.postimageHash, await hash('alpha\ngamma\n'));
    assert.equal(f.store.getWorkcellMutation(f.baseRequest.operationId)?.status, 'receipt_recorded');
    const diff = await f.writer.captureDiff({ ...f.baseRequest, capability: 'repo.write(workcell)' });
    assert.deepEqual(diff.changedFiles, ['notes.txt']);
  } finally { await closeFixture(f); }
});

test('preimage mismatch rejects without overwriting a legitimate concurrent change', async () => {
  const f = await readyFixture();
  try {
    await writeFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'alpha\nchanged\n');
    const result = await f.patcher.applyPatch(f.baseRequest);
    assert.equal(result.result, 'rejected');
    assert.equal(result.reason, 'preimage_conflict');
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\nchanged\n');
    assert.equal(result.receipt?.receiptType, 'WorkcellWriteRejectedReceipt');
  } finally { await closeFixture(f); }
});

test('old text must identify exactly one bounded mutation', async () => {
  const f = await readyFixture();
  try {
    const result = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:anchor', oldText: 'missing' });
    assert.equal(result.result, 'rejected');
    assert.equal(result.reason, 'old_text_anchor_mismatch');
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\nbeta\n');
  } finally { await closeFixture(f); }
});

test('empty anchors are rejected rather than treated as whole-file edits', async () => {
  const f = await readyFixture();
  try {
    const result = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:empty-anchor', oldText: '' });
    assert.equal(result.result, 'rejected');
    assert.equal(result.reason, 'old_text_anchor_mismatch');
  } finally { await closeFixture(f); }
});

test('an existing untracked text file can be modified inside the Workcell', async () => {
  const f = await readyFixture();
  try {
    const untracked = path.join(f.workcell.worktreePath, 'untracked.txt');
    await writeFile(untracked, 'before\n');
    const result = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:untracked', relativePath: 'untracked.txt', expectedPreimageHash: await hash('before\n'), oldText: 'before', replacementText: 'after' });
    assert.equal(result.result, 'applied');
    assert.equal(await readFile(untracked, 'utf8'), 'after\n');
  } finally { await closeFixture(f); }
});

test('same operation replay is idempotent and does not rewrite', async () => {
  const f = await readyFixture();
  try {
    const first = await f.patcher.applyPatch(f.baseRequest);
    const second = await f.patcher.applyPatch(f.baseRequest);
    assert.equal(first.result, 'applied');
    assert.equal(second.result, 'duplicate');
    assert.deepEqual(second.receipt, first.receipt);
    assert.equal(f.store.listWorkcellWriteReceipts(f.workcell.workcellId).length, 1);
  } finally { await closeFixture(f); }
});

test('write receipts retain complete lineage and only hashes, never patch content', async () => {
  const f = await readyFixture();
  try {
    await f.patcher.applyPatch(f.baseRequest);
    const mutation = f.store.getWorkcellMutation(f.baseRequest.operationId)!;
    const receipt = f.store.getWorkcellWriteReceipt(f.baseRequest.operationId)!;
    assert.deepEqual({ taskId: receipt.taskId, runId: receipt.runId, attemptId: receipt.attemptId, workcellId: receipt.workcellId, operationId: receipt.operationId, leaseId: receipt.leaseId, fenceToken: receipt.fenceToken, repositoryRef: receipt.repositoryRef, relativePath: receipt.relativePath }, { taskId: f.workcell.taskId, runId: f.workcell.runId, attemptId: f.workcell.attemptId, workcellId: f.workcell.workcellId, operationId: f.baseRequest.operationId, leaseId: f.baseRequest.leaseId, fenceToken: f.baseRequest.fenceToken, repositoryRef: f.workcell.repositoryRef, relativePath: 'notes.txt' });
    assert.equal(JSON.stringify(mutation).includes('beta'), false);
    assert.equal(JSON.stringify(receipt).includes('gamma'), false);
  } finally { await closeFixture(f); }
});

test('durable mutation stores the verified preimage and postimage hashes', async () => {
  const f = await readyFixture();
  try {
    await f.patcher.applyPatch(f.baseRequest);
    const mutation = f.store.getWorkcellMutation(f.baseRequest.operationId)!;
    assert.equal(mutation.preimageState, 'present');
    assert.equal(mutation.preimageHash, await hash('alpha\nbeta\n'));
    assert.equal(mutation.postimageHash, await hash('alpha\ngamma\n'));
    assert.equal(mutation.replacementHash, await hash('gamma'));
  } finally { await closeFixture(f); }
});

test('same operation id with a different immutable mutation is rejected', async () => {
  const f = await readyFixture();
  try {
    await f.patcher.applyPatch(f.baseRequest);
    const result = await f.patcher.applyPatch({ ...f.baseRequest, replacementText: 'delta' });
    assert.equal(result.result, 'rejected');
    assert.equal(result.reason, 'operation_id_reused_for_different_mutation');
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\ngamma\n');
  } finally { await closeFixture(f); }
});

test('unsafe, metadata, main-checkout, and wrong-worktree paths cannot be patched', async () => {
  const f = await readyFixture();
  try {
    for (const relativePath of ['/tmp/escape.txt', '../escape.txt', '.git/config', 'workcells/file.txt']) {
      await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: `op:${relativePath}`, relativePath }));
    }
    const main = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:main', worktreePath: f.fixture.root });
    assert.equal(main.result, 'rejected');
    const other = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:other', worktreePath: path.dirname(f.workcell.worktreePath) });
    assert.equal(other.result, 'rejected');
  } finally { await closeFixture(f); }
});

test('symlinks, directories, binary data, and oversized text are rejected', async () => {
  const f = await readyFixture();
  try {
    await symlink('notes.txt', path.join(f.workcell.worktreePath, 'link.txt'));
    await mkdir(path.join(f.workcell.worktreePath, 'dir'));
    await writeFile(path.join(f.workcell.worktreePath, 'binary.bin'), Buffer.from([0, 1, 2]));
    await writeFile(path.join(f.workcell.worktreePath, 'large.txt'), Buffer.alloc(MAX_WORKCELL_TEXT_FILE_BYTES + 1, 65));
    for (const relativePath of ['link.txt', 'dir', 'binary.bin', 'large.txt']) {
      await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: `op:${relativePath}`, relativePath }));
    }
  } finally { await closeFixture(f); }
});

test('stale writer fence is rejected before any filesystem mutation', async () => {
  const f = await readyFixture();
  try {
    const replacement = { ...f.baseRequest, fenceToken: f.baseRequest.fenceToken - 1 };
    const result = await f.patcher.applyPatch(replacement);
    assert.equal(result.result, 'rejected');
    assert.match(String(result.reason), /stale_fence_token|lease_missing/);
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\nbeta\n');
  } finally { await closeFixture(f); }
});

test('missing, expired, wrong-owner, and wrong-Workcell leases fail closed', async () => {
  const f = await readyFixture();
  try {
    const missing = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:missing-lease', leaseId: 'lease:missing' });
    assert.equal(missing.result, 'rejected');
    const expired = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:expired-lease', now: '2026-09-09T10:06:00.000Z' });
    assert.equal(expired.result, 'rejected');
    const wrongOwner = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:wrong-owner', ownerAgent: 'writer:other' });
    assert.equal(wrongOwner.result, 'rejected');
    await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:wrong-workcell', workcellId: 'workcell:missing' }));
  } finally { await closeFixture(f); }
});

test('repository reference mismatch and absent-file creation are rejected', async () => {
  const f = await readyFixture();
  try {
    const wrongRepository = await f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:wrong-repo', repositoryRef: 'other:repo' });
    assert.equal(wrongRepository.result, 'rejected');
    await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:create', relativePath: 'new.txt' }));
  } finally { await closeFixture(f); }
});

test('noncanonical, Windows, and NUL-containing paths are rejected', async () => {
  const f = await readyFixture();
  try {
    for (const relativePath of ['notes.txt/../notes.txt', 'notes.txt//other', './notes.txt', 'C:/notes.txt', '\\\\server\\share\\notes.txt', `notes${String.fromCharCode(0)}.txt`]) {
      await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: `op:path:${relativePath}`, relativePath }));
    }
  } finally { await closeFixture(f); }
});

test('nested symlink escape is rejected even when the link points at a file', async () => {
  const f = await readyFixture();
  try {
    const outside = await mkdtemp(path.join(tmpdir(), 'brain-file-patch-outside-'));
    try {
      await symlink(outside, path.join(f.workcell.worktreePath, 'nested-link'));
      await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:nested-link', relativePath: 'nested-link/escape.txt' }));
    } finally { await rm(outside, { recursive: true, force: true }); }
  } finally { await closeFixture(f); }
});

test('invalid UTF-8 and oversized replacement text are rejected without mutation', async () => {
  const f = await readyFixture();
  try {
    await writeFile(path.join(f.workcell.worktreePath, 'invalid.txt'), Buffer.from([0xc3, 0x28]));
    const invalidHash = await hash(Buffer.from([0xc3, 0x28]));
    await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:invalid-utf8', relativePath: 'invalid.txt', expectedPreimageHash: invalidHash, oldText: 'x' }));
    await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:oversized-replacement', replacementText: 'x'.repeat(MAX_WORKCELL_TEXT_FILE_BYTES + 1) }));
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\nbeta\n');
  } finally { await closeFixture(f); }
});

test('expected preimage hash and operation identity are validated before mutation', async () => {
  const f = await readyFixture();
  try {
    await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: '', expectedPreimageHash: 'not-a-hash' }));
    await assert.rejects(() => f.patcher.applyPatch({ ...f.baseRequest, operationId: 'op:invalid-hash', expectedPreimageHash: 'not-a-hash' }));
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\nbeta\n');
  } finally { await closeFixture(f); }
});

test('atomic replacement preserves existing permission mode', async () => {
  const f = await readyFixture();
  try {
    await chmod(path.join(f.workcell.worktreePath, 'notes.txt'), 0o600);
    const result = await f.patcher.applyPatch(f.baseRequest);
    assert.equal(result.result, 'applied');
    assert.equal((await stat(path.join(f.workcell.worktreePath, 'notes.txt'))).mode & 0o777, 0o600);
  } finally { await closeFixture(f); }
});

test('lease replacement during temporary preparation fences the late writer before rename', async () => {
  const f = await readyFixture();
  try {
    const late = new WorkcellFileMutationManager({ store: f.store, writer: f.writer, failureInjector: (actual) => {
      if (actual === 'during-temp-preparation') {
        assert.equal(f.writer.releaseLease({ leaseId: f.baseRequest.leaseId, ownerAgent: 'writer:file', ownerAttempt: 'attempt:writer', releasedAt: '2026-09-09T10:02:00.000Z' }).result, 'released');
        const replacement = f.writer.grantLease({ workcellId: f.workcell.workcellId, leaseId: 'lease:file:replacement', ownerAgent: 'writer:replacement', ownerAttempt: 'attempt:replacement', createdAt: '2026-09-09T10:02:00.000Z', expiresAt: '2026-09-09T10:05:00.000Z' });
        assert.equal(replacement.result, 'granted');
      }
    } });
    const result = await late.applyPatch(f.baseRequest);
    assert.equal(result.result, 'rejected');
    assert.match(String(result.reason), /stale_fence_token|lease_released/);
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'alpha\nbeta\n');
  } finally { await closeFixture(f); }
});

async function crashCase(point: WorkcellMutationFailurePoint): Promise<void> {
  const f = await readyFixture();
  try {
    const crashing = new WorkcellFileMutationManager({ store: f.store, writer: new WorkcellWriterManager({ store: f.store, git: new GitCliWorkcellAdapter() }), failureInjector: (actual) => { if (actual === point) throw new Error(`injected:${point}`); } });
    await assert.rejects(() => crashing.applyPatch(f.baseRequest), new RegExp(`injected:${point}`));
    const content = await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8');
    if (point === 'after-atomic-mutation-before-receipt') assert.equal(content, 'alpha\ngamma\n');
    else assert.equal(content, 'alpha\nbeta\n');
  } finally { await closeFixture(f); }
}

test('crash before mutation is durably safe to resume', async () => { await crashCase('after-admission'); });
test('crash after preimage verification is durably safe to resume', async () => { await crashCase('after-preimage-verification'); });
test('crash during temporary preparation leaves target unchanged', async () => { await crashCase('during-temp-preparation'); });

test('crash after atomic mutation reconciles from durable postimage evidence', async () => {
  const f = await readyFixture();
  try {
    const crashing = new WorkcellFileMutationManager({ store: f.store, writer: new WorkcellWriterManager({ store: f.store, git: new GitCliWorkcellAdapter() }), failureInjector: (actual) => { if (actual === 'after-atomic-mutation-before-receipt') throw new Error('injected:after-atomic-mutation-before-receipt'); } });
    await assert.rejects(() => crashing.applyPatch(f.baseRequest));
    assert.equal(f.store.getWorkcellMutation(f.baseRequest.operationId)?.status, 'effect_applied');
    const reconciled = await crashing.applyPatch(f.baseRequest);
    assert.equal(reconciled.result, 'reconciled');
    assert.equal(reconciled.receipt?.receiptType, 'WorkcellWriteReconciledReceipt');
  } finally { await closeFixture(f); }
});

test('close and reopen preserves mutation phase and reconciles exactly once', async () => {
  const stateRoot = await mkdtemp(path.join(tmpdir(), 'brain-file-patch-state-'));
  const databasePath = path.join(stateRoot, 'agent-mode.db');
  const f = await readyFixture(databasePath);
  try {
    const crashing = new WorkcellFileMutationManager({ store: f.store, writer: new WorkcellWriterManager({ store: f.store, git: new GitCliWorkcellAdapter() }), failureInjector: (actual) => { if (actual === 'after-atomic-mutation-before-receipt') throw new Error('injected:restart'); } });
    await assert.rejects(() => crashing.applyPatch(f.baseRequest));
    f.store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      const replay = new WorkcellFileMutationManager({ store: reopened, writer: new WorkcellWriterManager({ store: reopened, git: new GitCliWorkcellAdapter() }) });
      const result = await replay.applyPatch(f.baseRequest);
      assert.equal(result.result, 'reconciled');
      assert.equal(reopened.listWorkcellWriteReceipts(f.workcell.workcellId).length, 1);
      assert.equal((await replay.applyPatch(f.baseRequest)).result, 'duplicate');
    } finally { reopened.close(); }
  } finally { await f.fixture.cleanup(); await rm(stateRoot, { recursive: true, force: true }); }
});

test('crash after receipt is a duplicate on replay', async () => {
  const f = await readyFixture();
  try {
    const crashing = new WorkcellFileMutationManager({ store: f.store, writer: new WorkcellWriterManager({ store: f.store, git: new GitCliWorkcellAdapter() }), failureInjector: (actual) => { if (actual === 'after-receipt') throw new Error('injected:after-receipt'); } });
    await assert.rejects(() => crashing.applyPatch(f.baseRequest));
    const replay = await crashing.applyPatch(f.baseRequest);
    assert.equal(replay.result, 'duplicate');
  } finally { await closeFixture(f); }
});

test('changed postimage after filesystem effect is not overwritten during reconciliation', async () => {
  const f = await readyFixture();
  try {
    const crashing = new WorkcellFileMutationManager({ store: f.store, writer: new WorkcellWriterManager({ store: f.store, git: new GitCliWorkcellAdapter() }), failureInjector: (actual) => {
      if (actual === 'after-atomic-mutation-before-receipt') {
        writeFileSync(path.join(f.workcell.worktreePath, 'notes.txt'), 'external\n');
        throw new Error('injected:postimage-changed');
      }
    } });
    await assert.rejects(() => crashing.applyPatch(f.baseRequest));
    const result = await crashing.reconcile(f.baseRequest.operationId, '2026-09-09T10:02:00.000Z');
    assert.equal(result.result, 'rejected');
    assert.equal(await readFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'utf8'), 'external\n');
  } finally { await closeFixture(f); }
});
