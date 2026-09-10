import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { admitWorkcellCapability, GitCliWorkcellAdapter, WORKCELL_VALIDATION_CAPABILITY, WorkcellManager } from '../agent-mode/workcell.js';
import { WorkcellWriterManager } from '../agent-mode/workcell-writer.js';
import { GIT_DIFF_INTEGRITY_VALIDATOR, WorkcellValidatorRegistry, WorkcellValidationManager, type ValidatorProfile, type WorkcellValidationRequest } from '../agent-mode/workcell-validation.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T10:00:00.000Z';

async function git(repo: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixtureRepo(): Promise<{ root: string; workcellsRoot: string; cleanup: () => Promise<void> }> {
  const parent = await mkdtemp(path.join(tmpdir(), 'brain-validation-'));
  const root = path.join(parent, 'repo');
  const workcellsRoot = path.join(parent, 'workcells');
  await mkdir(root, { recursive: true });
  await git(root, ['init', '--initial-branch=main', '--quiet']);
  await git(root, ['config', 'user.email', 'validation-fixture@example.invalid']);
  await git(root, ['config', 'user.name', 'Validation Fixture']);
  await writeFile(path.join(root, 'notes.txt'), 'base\n');
  await git(root, ['add', 'notes.txt']);
  await git(root, ['commit', '--quiet', '-m', 'fixture']);
  return { root, workcellsRoot, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

async function readyFixture(databasePath = ':memory:'): Promise<{
  fixture: Awaited<ReturnType<typeof fixtureRepo>>;
  store: AgentModeSqliteStateStore;
  workcells: WorkcellManager;
  writer: WorkcellWriterManager;
  workcell: Awaited<ReturnType<WorkcellManager['create']>>;
  request: WorkcellValidationRequest;
}> {
  const fixture = await fixtureRepo();
  const store = new AgentModeSqliteStateStore(databasePath);
  const workcells = new WorkcellManager({ store, git: new GitCliWorkcellAdapter() });
  const created = await workcells.create({ taskId: 'task:validation', runId: 'run:validation', attemptId: 'attempt:validation', repositoryRef: 'fixture:repo', repositoryRoot: fixture.root, workcellsRoot: fixture.workcellsRoot, ownerAgent: 'agent:validation', createdAt: NOW });
  const workcell = await workcells.prepare(created.workcellId, created.ownerAgent, '2026-09-09T10:00:01.000Z');
  const writer = new WorkcellWriterManager({ store, git: new GitCliWorkcellAdapter() });
  const lease = writer.grantLease({ workcellId: workcell.workcellId, leaseId: 'lease:validation', ownerAgent: 'writer:validation', ownerAttempt: 'attempt:writer', createdAt: NOW, expiresAt: '2026-09-09T10:05:00.000Z' });
  assert.equal(lease.result, 'granted');
  const request: WorkcellValidationRequest = { workcellId: workcell.workcellId, validationProfile: GIT_DIFF_INTEGRITY_VALIDATOR, capability: 'validation.run(workcell)', ownerAgent: 'writer:validation', ownerAttempt: 'attempt:writer', leaseId: lease.lease!.leaseId, fenceToken: lease.lease!.fenceToken, repositoryRoot: fixture.root, worktreePath: workcell.worktreePath, now: '2026-09-09T10:01:00.000Z' };
  return { fixture, store, workcells, writer, workcell, request };
}

async function withDiff(f: Awaited<ReturnType<typeof readyFixture>>): Promise<void> {
  await writeFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'changed\n');
  await f.writer.captureDiff({ ...f.request, capability: 'repo.write(workcell)', now: f.request.now });
}

async function closeFixture(f: Awaited<ReturnType<typeof readyFixture>>): Promise<void> {
  f.store.close();
  await f.fixture.cleanup();
}

test('known git diff integrity validator succeeds and persists evidence/receipts', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    const result = await new WorkcellValidationManager({ store: f.store }).run(f.request);
    assert.equal(result.result, 'passed');
    assert.equal(result.receipt?.receiptType, 'ValidationCompletedReceipt');
    assert.equal(f.store.getWorkcellValidationRun(result.validation!.validationId)?.result, 'passed');
    assert.equal(f.store.listWorkcellValidationReceipts(f.workcell.workcellId).map((receipt) => receipt.receiptType).join(','), 'ValidationStartedReceipt,ValidationCompletedReceipt');
    assert.ok(result.validation?.evidenceHash);
  } finally { await closeFixture(f); }
});

test('diff drift produces a completed failed validation, never a false pass', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    const diff = f.store.getLatestWorkcellDiff(f.workcell.workcellId)!;
    await writeFile(path.join(f.workcell.worktreePath, 'notes.txt'), 'drifted-after-capture\n');
    const result = await new WorkcellValidationManager({ store: f.store }).run(f.request);
    assert.equal(result.result, 'failed');
    assert.equal(result.validation?.diffId, diff.diffId);
    assert.equal(result.receipt?.receiptType, 'ValidationCompletedReceipt');
  } finally { await closeFixture(f); }
});

test('unknown validator profile is rejected by the registry and never executed', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    const result = await new WorkcellValidationManager({ store: f.store }).run({ ...f.request, validationProfile: 'run:anything' });
    assert.equal(result.result, 'rejected');
    assert.equal(result.reason, 'unknown_validator_profile');
    assert.equal(result.receipt?.receiptType, 'ValidationRejectedReceipt');
  } finally { await closeFixture(f); }
});

test('main checkout and wrong Workcell bindings are rejected', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    const main = await new WorkcellValidationManager({ store: f.store }).run({ ...f.request, validationId: 'validation:main', worktreePath: f.fixture.root });
    assert.equal(main.result, 'rejected');
    assert.equal(main.reason, 'resource_binding_mismatch');
    await assert.rejects(() => new WorkcellValidationManager({ store: f.store }).run({ ...f.request, validationId: 'validation:wrong-workcell', workcellId: 'workcell:other' }));
  } finally { await closeFixture(f); }
});

test('invalid capability and missing diff evidence are rejected durably', async () => {
  const f = await readyFixture();
  try {
    const missingDiff = await new WorkcellValidationManager({ store: f.store }).run(f.request);
    assert.equal(missingDiff.result, 'rejected');
    assert.equal(missingDiff.reason, 'diff_evidence_missing');
    const invalidCapability = await new WorkcellValidationManager({ store: f.store }).run({ ...f.request, validationId: 'validation:capability', capability: 'validation.run(main)' });
    assert.equal(invalidCapability.result, 'rejected');
    assert.equal(invalidCapability.reason, 'capability_not_admitted');
  } finally { await closeFixture(f); }
});

test('validation timeout produces a rejected receipt and no ambiguous success', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    class FastRegistry extends WorkcellValidatorRegistry {
      override get(profileId: string): ValidatorProfile | undefined {
        const profile = super.get(profileId);
        return profile ? { ...profile, timeoutMs: 5 } : undefined;
      }
    }
    const result = await new WorkcellValidationManager({ store: f.store, registry: new FastRegistry(), executor: async () => new Promise(() => undefined) }).run(f.request);
    assert.equal(result.result, 'timed_out');
    assert.equal(result.receipt?.receiptType, 'ValidationRejectedReceipt');
    assert.equal(f.store.getWorkcellValidationRun(result.validation!.validationId)?.status, 'rejected');
  } finally { await closeFixture(f); }
});

test('expired lease context is rejected before validator execution', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    let executed = false;
    const result = await new WorkcellValidationManager({ store: f.store, executor: async () => { executed = true; return { result: 'passed', evidenceHash: 'never', evidenceJson: '{}' }; } }).run({ ...f.request, validationId: 'validation:expired', now: '2026-09-09T10:06:00.000Z' });
    assert.equal(result.result, 'rejected');
    assert.equal(result.reason, 'lease_expired');
    assert.equal(executed, false);
  } finally { await closeFixture(f); }
});

test('worker interruption is durably classified and reconciliation is idempotent', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    const manager = new WorkcellValidationManager({ store: f.store });
    const started = f.store.startWorkcellValidation({ validationId: 'validation:crash', workcellId: f.workcell.workcellId, capability: 'validation.run(workcell)', ownerAgent: f.request.ownerAgent, ownerAttempt: f.request.ownerAttempt, leaseId: f.request.leaseId, fenceToken: f.request.fenceToken, repositoryRoot: f.workcell.repositoryRoot, worktreePath: f.workcell.worktreePath, resourceValid: true, validatorAllowed: true, validatorProfile: GIT_DIFF_INTEGRITY_VALIDATOR, diffId: f.store.getLatestWorkcellDiff(f.workcell.workcellId)!.diffId, operationHash: 'operation:crash', startedAt: f.request.now });
    assert.equal(started.result, 'started');
    const reconciled = manager.reconcile('validation:crash', '2026-09-09T10:02:00.000Z');
    assert.equal(reconciled.result, 'interrupted');
    assert.equal(manager.reconcile('validation:crash', '2026-09-09T10:03:00.000Z').result, 'rejected');
  } finally { await closeFixture(f); }
});

test('duplicate validation request returns durable result without executing twice', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    let executions = 0;
    const manager = new WorkcellValidationManager({ store: f.store, executor: async ({ profile, workcell, diff }) => {
      executions += 1;
      return { result: 'passed', evidenceJson: JSON.stringify({ format: profile.evidenceFormat, workcellId: workcell.workcellId, diffId: diff.diffId }), evidenceHash: `evidence:${executions}` };
    } });
    const first = await manager.run(f.request);
    const second = await manager.run(f.request);
    assert.equal(first.result, 'passed');
    assert.equal(second.result, 'passed');
    assert.equal(executions, 1);
    assert.equal(f.store.listWorkcellValidationReceipts(f.workcell.workcellId).filter((receipt) => receipt.receiptType === 'ValidationCompletedReceipt').length, 1);
  } finally { await closeFixture(f); }
});

test('crash after completion receipt replays as a completed duplicate', async () => {
  const f = await readyFixture();
  try {
    await withDiff(f);
    const crashing = new WorkcellValidationManager({ store: f.store, failureInjector: (point) => { if (point === 'after-completion') throw new Error('injected:after-completion'); } });
    await assert.rejects(() => crashing.run(f.request), /injected:after-completion/);
    assert.equal(f.store.listWorkcellValidationReceipts(f.workcell.workcellId).some((receipt) => receipt.receiptType === 'ValidationCompletedReceipt'), true);
    const replay = await new WorkcellValidationManager({ store: f.store }).run(f.request);
    assert.equal(replay.result, 'passed');
    assert.equal(replay.validation?.status, 'completed');
  } finally { await closeFixture(f); }
});

test('destroyed Workcell is rejected and stale lease context cannot validate', async () => {
  const f = await readyFixture();
  try {
    await f.workcells.destroy(f.workcell.workcellId, f.workcell.ownerAgent, '2026-09-09T10:01:30.000Z');
    const destroyed = await new WorkcellValidationManager({ store: f.store }).run({ ...f.request, validationId: 'validation:destroyed' });
    assert.equal(destroyed.result, 'rejected');
    assert.equal(destroyed.reason, 'workcell_state_does_not_allow_validation');
  } finally { await closeFixture(f); }
});

test('validation lifecycle and evidence survive StateStore close/reopen', async () => {
  const stateRoot = await mkdtemp(path.join(tmpdir(), 'brain-validation-state-'));
  const databasePath = path.join(stateRoot, 'agent-mode.db');
  const f = await readyFixture(databasePath);
  try {
    await withDiff(f);
    const first = await new WorkcellValidationManager({ store: f.store }).run(f.request);
    f.store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      const validation = reopened.getWorkcellValidationRun(first.validation!.validationId);
      const receipt = reopened.getWorkcellValidationRunReceipt(first.validation!.validationId);
      assert.equal(validation?.result, 'passed');
      assert.equal(receipt?.receiptType, 'ValidationCompletedReceipt');
      assert.ok(validation?.evidenceHash);
    } finally { reopened.close(); }
  } finally { await f.fixture.cleanup(); await rm(stateRoot, { recursive: true, force: true }); }
});

test('built-in validation module has no arbitrary command execution surface', () => {
  const source = readFileSync(path.resolve(process.cwd(), 'src/agent-mode/workcell-validation.ts'), 'utf8');
  assert.equal(/execFile|execSync|spawn|shell\s*:/u.test(source), false);
  const profiles = new WorkcellValidatorRegistry().list();
  assert.deepEqual(profiles.map((profile) => profile.id), [GIT_DIFF_INTEGRITY_VALIDATOR]);
  assert.equal(profiles[0]?.allowedOperation, 'fixed-git-diff-integrity');
  assert.equal(admitWorkcellCapability(WORKCELL_VALIDATION_CAPABILITY, 'workcell:12345678-1234-1234-1234-123456789012').ok, true);
});
