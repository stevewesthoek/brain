import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runK35ConcurrentWorkers, K35_WORKERS } from '../agent-mode/k3-5-concurrency.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';
import { WorkcellPromotionManager, WorkcellPromotionRejectedError } from '../agent-mode/workcell-promotion.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T12:00:00.000Z';
const LATER = '2026-09-09T12:01:00.000Z';
const EXPIRES = '2026-09-09T13:00:00.000Z';
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixture(): Promise<{ root: string; repositoryRoot: string; workcellsRoot: string; baseRef: string }> {
  const root = await mkdtemp('/tmp/brain-k3-5-d-');
  const repositoryRoot = path.join(root, 'repo');
  const workcellsRoot = path.join(root, 'workcells');
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'export const workerA = "BEFORE";\n');
  await writeFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'export const workerB = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-5-d@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.5-D Fixture']);
  await git(repositoryRoot, ['add', 'src/worker-a.ts', 'src/worker-b.ts']);
  await git(repositoryRoot, ['commit', '-m', 'fixture']);
  return { root, repositoryRoot, workcellsRoot, baseRef: await git(repositoryRoot, ['rev-parse', 'HEAD']) };
}

function gatewayFor(worker: typeof K35_WORKERS[number]): ModelGateway {
  let turns = 0;
  return { invoke: async (request) => {
    turns += 1;
    const tool = turns === 1
      ? { toolUseId: `${worker.label}-read`, name: 'brain_read', input: { path: worker.relativePath } }
      : turns === 2
        ? { toolUseId: `${worker.label}-patch`, name: 'brain_workcell_patch', input: { path: worker.relativePath, oldText: 'BEFORE', replacementText: worker.replacementText } }
        : undefined;
    const result: Partial<NormalizedModelResult> = tool ? { toolUses: [tool] } : { text: `${worker.label} candidate is ready.` };
    return { text: '', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1', usage: { inputTokens: 20, outputTokens: 12, totalTokens: 32 }, cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.00002, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId, ...result };
  } };
}

type Setup = {
  fixture: Awaited<ReturnType<typeof fixture>>;
  databasePath: string;
  store: AgentModeSqliteStateStore;
  promotion: WorkcellPromotionManager;
  workers: Awaited<ReturnType<typeof runK35ConcurrentWorkers>>['workers'];
  leases: Array<{ leaseId: string; fenceToken: number }>;
};

async function setup(): Promise<Setup> {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
  assert.equal(concurrent.status, 'completed', JSON.stringify(concurrent));
  const store = new AgentModeSqliteStateStore(databasePath);
  const promotion = new WorkcellPromotionManager({ store });
  const leases: Array<{ leaseId: string; fenceToken: number }> = [];
  for (const [index, worker] of concurrent.workers.entries()) {
    const review = await promotion.requestReview({ reviewId: `review:d:${index}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-d-root', createdAt: NOW, expiresAt: EXPIRES });
    await promotion.decideReview({ reviewId: review.reviewId, decisionId: `decision:d:${index}`, decision: 'approved', reviewer: 'human:k3-5-d-reviewer', decidedAt: NOW });
    const lease = store.listWorkcellWriterLeases(worker.workcellId)[0]!;
    leases.push({ leaseId: lease.leaseId, fenceToken: lease.fenceToken });
    await promotion.commitWorkcell({ operationId: `commit:d:${index}`, workcellId: worker.workcellId, leaseId: lease.leaseId, fenceToken: lease.fenceToken, now: NOW });
  }
  return { fixture: f, databasePath, store, promotion, workers: concurrent.workers, leases };
}

async function cleanup(s: Setup): Promise<void> {
  let workcells;
  try {
    workcells = s.store.listWorkcells();
  } catch {
    const reopened = AgentModeSqliteStateStore.openExisting(s.databasePath);
    workcells = reopened?.listWorkcells() ?? [];
    reopened?.close();
  }
  try { s.store.close(); } catch { /* already closed after restart check */ }
  for (const workcell of workcells) await execFile('git', ['-C', s.fixture.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
  await rm(s.fixture.root, { recursive: true, force: true });
}

async function approval(s: Setup, index: number, operationId: string, expectedTargetHead: string) {
  return s.promotion.createMergeApproval({ approvalId: `merge-approval:d:${operationId}`, operationId, commitOperationId: `commit:d:${index}`, workcellId: s.workers[index]!.workcellId, targetRef: 'main', expectedTargetHead, approver: 'human:k3-5-d-reviewer', createdAt: NOW, expiresAt: EXPIRES });
}

test('K3.5-D merges only exact approved commits, persists receipts, survives restart, and is observable', async () => {
  const s = await setup();
  try {
    const targetBefore = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    const mergeApproval = await approval(s, 0, 'merge:d:valid', targetBefore);
    const merged = await s.promotion.mergeWorkcell({ operationId: mergeApproval.operationId, approvalId: mergeApproval.approvalId, workcellId: s.workers[0]!.workcellId, now: NOW });
    assert.equal(merged.status, 'merged');
    assert.equal(merged.expectedTargetHead, targetBefore);
    assert.ok(merged.resultingTargetHead);
    assert.equal(await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']), merged.resultingTargetHead);
    assert.equal((await s.store.getWorkcell(s.workers[0]!.workcellId))?.status, 'merged');
    assert.deepEqual(s.store.listMergeReceipts(merged.operationId).map((receipt) => receipt.receiptType).sort(), ['MergeCompletedReceipt', 'MergeRequestedReceipt']);
    s.store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(s.databasePath)!;
    assert.equal(reopened.getMergeOperation(merged.operationId)?.resultingTargetHead, merged.resultingTargetHead);
    assert.equal(reopened.listMergeReceipts(merged.operationId).length, 2);
    reopened.close();
    const observed = readAgentModeObserver(NOW, s.databasePath);
    assert.equal(observed.mergeOperations.find((item) => item.operationId === merged.operationId)?.status, 'merged');
    assert.equal(observed.mergeReceipts.find((item) => item.operationId === merged.operationId)?.targetAfter, merged.resultingTargetHead);
    assert.equal(observed.mergeReceipts.find((item) => item.operationId === merged.operationId)?.sourceCommit, merged.sourceCommit);
  } finally {
    await cleanup(s);
  }
});

test('K3.5-D rejects missing/invalid approval and source or target drift without mutating target', async () => {
  const s = await setup();
  try {
    const before = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    await assert.rejects(() => s.promotion.mergeWorkcell({ operationId: 'merge:d:missing', approvalId: 'missing', workcellId: s.workers[0]!.workcellId, now: NOW }), WorkcellPromotionRejectedError);
    assert.throws(() => s.promotion.createMergeApproval({ approvalId: 'merge-approval:d:invalid', operationId: 'merge:d:invalid', commitOperationId: 'commit:d:missing', workcellId: s.workers[0]!.workcellId, targetRef: 'main', expectedTargetHead: before, approver: 'human:k3-5-d-reviewer', createdAt: NOW, expiresAt: EXPIRES }), WorkcellPromotionRejectedError);
    const sourceApproval = await approval(s, 0, 'merge:d:source-drift', before);
    await git(s.store.getWorkcell(s.workers[0]!.workcellId)!.worktreePath, ['commit', '--allow-empty', '-m', 'source drift']);
    await assert.rejects(() => s.promotion.mergeWorkcell({ operationId: sourceApproval.operationId, approvalId: sourceApproval.approvalId, workcellId: s.workers[0]!.workcellId, now: NOW }), WorkcellPromotionRejectedError);
    assert.equal((await s.store.getMergeApproval(sourceApproval.approvalId))?.status, 'rejected');
    const targetApproval = await approval(s, 1, 'merge:d:target-drift', before);
    await git(s.fixture.repositoryRoot, ['commit', '--allow-empty', '-m', 'target drift']);
    const targetDriftHead = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    await assert.rejects(() => s.promotion.mergeWorkcell({ operationId: targetApproval.operationId, approvalId: targetApproval.approvalId, workcellId: s.workers[1]!.workcellId, now: NOW }), WorkcellPromotionRejectedError);
    assert.equal((await s.store.getMergeApproval(targetApproval.approvalId))?.status, 'stale');
    assert.equal(await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']), targetDriftHead);
    assert.notEqual(targetDriftHead, before);
    assert.ok(s.store.listMergeReceipts('merge:d:missing').some((receipt) => receipt.result === 'rejected'));
    assert.ok(s.store.listMergeReceipts(sourceApproval.operationId).some((receipt) => receipt.result === 'rejected'));
  } finally {
    await cleanup(s);
  }
});

test('K3.5-D fences concurrent target mutation and keeps independent source Workcells intact', async () => {
  const s = await setup();
  try {
    const targetBefore = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    const firstApproval = await approval(s, 0, 'merge:d:concurrent-a', targetBefore);
    const secondApproval = await approval(s, 1, 'merge:d:concurrent-b', targetBefore);
    const results = await Promise.allSettled([
      s.promotion.mergeWorkcell({ operationId: firstApproval.operationId, approvalId: firstApproval.approvalId, workcellId: s.workers[0]!.workcellId, now: NOW }),
      s.promotion.mergeWorkcell({ operationId: secondApproval.operationId, approvalId: secondApproval.approvalId, workcellId: s.workers[1]!.workcellId, now: NOW }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(s.store.listMergeOperations().filter((operation) => operation.status === 'merged').length, 1);
    assert.equal((await git(s.fixture.repositoryRoot, ['log', '-1', '--format=%P'])).split(' ').length, 2);
    assert.equal(await readFile(path.join(s.store.getWorkcell(s.workers[0]!.workcellId)!.worktreePath, 'src/worker-a.ts'), 'utf8'), 'export const workerA = "K3_5_A_PASS";\n');
    assert.equal(await readFile(path.join(s.store.getWorkcell(s.workers[1]!.workcellId)!.worktreePath, 'src/worker-b.ts'), 'utf8'), 'export const workerB = "K3_5_B_PASS";\n');
    assert.ok(s.store.listTargetRefLeases().some((lease) => lease.fenceToken > 0));
  } finally {
    await cleanup(s);
  }
});

test('K3.5-D reconciles pre-merge and post-merge crashes, and duplicate replay is idempotent', async () => {
  const s = await setup();
  try {
    const targetBefore = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    const beforeApproval = await approval(s, 0, 'merge:d:before-crash', targetBefore);
    const crashingBefore = new WorkcellPromotionManager({ store: s.store, failureInjector: (point) => { if (point === 'before-merge-effect') throw new Error('simulated pre-merge crash'); } });
    await assert.rejects(() => crashingBefore.mergeWorkcell({ operationId: beforeApproval.operationId, approvalId: beforeApproval.approvalId, workcellId: s.workers[0]!.workcellId, now: NOW }), /simulated pre-merge crash/);
    assert.equal(await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']), targetBefore);
    assert.equal(s.store.getMergeOperation(beforeApproval.operationId)?.status, 'prepared');
    const beforeMerged = await s.promotion.mergeWorkcell({ operationId: beforeApproval.operationId, approvalId: beforeApproval.approvalId, workcellId: s.workers[0]!.workcellId, now: NOW });
    assert.equal(beforeMerged.status, 'merged');

    const targetAfterFirst = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    const afterApproval = await approval(s, 1, 'merge:d:after-crash', targetAfterFirst);
    const crashingAfter = new WorkcellPromotionManager({ store: s.store, failureInjector: (point) => { if (point === 'after-merge-effect-before-receipt') throw new Error('simulated post-merge crash'); } });
    await assert.rejects(() => crashingAfter.mergeWorkcell({ operationId: afterApproval.operationId, approvalId: afterApproval.approvalId, workcellId: s.workers[1]!.workcellId, now: NOW }), /simulated post-merge crash/);
    const postEffectHead = await git(s.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    assert.notEqual(postEffectHead, targetAfterFirst);
    assert.equal(s.store.getMergeOperation(afterApproval.operationId)?.status, 'prepared');
    const reconciled = await s.promotion.mergeWorkcell({ operationId: afterApproval.operationId, approvalId: afterApproval.approvalId, workcellId: s.workers[1]!.workcellId, now: NOW });
    assert.equal(reconciled.status, 'reconciled');
    assert.equal(reconciled.resultingTargetHead, postEffectHead);
    const duplicate = await s.promotion.mergeWorkcell({ operationId: afterApproval.operationId, approvalId: afterApproval.approvalId, workcellId: s.workers[1]!.workcellId, now: LATER });
    assert.deepEqual(duplicate, reconciled);
    assert.equal(s.store.listMergeReceipts(afterApproval.operationId).filter((receipt) => receipt.result === 'reconciled').length, 1);
  } finally {
    await cleanup(s);
  }
});
