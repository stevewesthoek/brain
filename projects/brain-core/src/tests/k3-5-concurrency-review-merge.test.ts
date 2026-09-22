import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runK35ConcurrentWorkers, K35_WORKERS } from '../agent-mode/k3-5-concurrency.js';
import { WorkcellPromotionManager, WorkcellPromotionRejectedError } from '../agent-mode/workcell-promotion.js';
import { GitCliWorkcellAdapter } from '../agent-mode/workcell.js';
import { AgentModeSqliteStateStore, type AgentModeCommitOperation } from '../agent-mode/sqlite-state-store.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T12:00:00.000Z';
const EXPIRES = '2026-09-09T13:00:00.000Z';
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixture(): Promise<{ root: string; repositoryRoot: string; workcellsRoot: string; baseRef: string }> {
  const root = await mkdtemp('/tmp/brain-k3-5-');
  const repositoryRoot = path.join(root, 'repo');
  const workcellsRoot = path.join(root, 'workcells');
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'export const workerA = "BEFORE";\n');
  await writeFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'export const workerB = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-5@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.5 Fixture']);
  await git(repositoryRoot, ['add', 'src/worker-a.ts', 'src/worker-b.ts']);
  await git(repositoryRoot, ['commit', '-m', 'fixture']);
  return { root, repositoryRoot, workcellsRoot, baseRef: await git(repositoryRoot, ['rev-parse', 'HEAD']) };
}

function modelResult(request: Parameters<ModelGateway['invoke']>[0], response: Partial<NormalizedModelResult>): NormalizedModelResult {
  return {
    text: '', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1',
    usage: { inputTokens: 20, outputTokens: 12, totalTokens: 32 }, cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.00002, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId, ...response,
  };
}

function gatewayFor(worker: typeof K35_WORKERS[number]): ModelGateway {
  let turns = 0;
  return { invoke: async (request) => {
    turns += 1;
    if (turns === 1) return modelResult(request, { toolUses: [{ toolUseId: `${worker.label}-read`, name: 'brain_read', input: { path: worker.relativePath } }] });
    if (turns === 2) return modelResult(request, { toolUses: [{ toolUseId: `${worker.label}-patch`, name: 'brain_workcell_patch', input: { path: worker.relativePath, oldText: 'BEFORE', replacementText: worker.replacementText } }] });
    return modelResult(request, { text: `${worker.label} candidate is ready for review.` });
  } };
}

async function cleanup(f: { root: string; repositoryRoot: string }, databasePath: string): Promise<void> {
  const store = AgentModeSqliteStateStore.openExisting(databasePath);
  const workcells = store?.listWorkcells() ?? [];
  store?.close();
  for (const workcell of workcells) await execFile('git', ['-C', f.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
  await rm(f.root, { recursive: true, force: true });
}

test('K3.5 proves two static workers overlap, isolate Workcells, and promote only exact approved candidates', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
    assert.equal(concurrent.status, 'completed', JSON.stringify(concurrent));
    assert.equal(concurrent.actualOverlap, true);
    assert.equal(concurrent.maximumConcurrentWorkers, 2);
    assert.equal(concurrent.sameBaseRevision, true);
    assert.deepEqual(concurrent.workers.map((worker) => worker.status), ['completed', 'completed']);
    assert.notEqual(concurrent.workers[0].workcellId, concurrent.workers[1].workcellId);
    assert.notEqual(concurrent.workers[0].leaseId, concurrent.workers[1].leaseId);
    assert.notEqual(concurrent.workers[0].attemptId, concurrent.workers[1].attemptId);
    assert.equal(await readFile(path.join(f.repositoryRoot, 'src/worker-a.ts'), 'utf8'), 'export const workerA = "BEFORE";\n');
    assert.equal(await readFile(path.join(f.repositoryRoot, 'src/worker-b.ts'), 'utf8'), 'export const workerB = "BEFORE";\n');

    const store = new AgentModeSqliteStateStore(databasePath);
    const promotion = new WorkcellPromotionManager({ store });
    const reviews: Array<{ worker: typeof concurrent.workers[number]; commit: AgentModeCommitOperation }> = [];
    for (const worker of concurrent.workers) {
      const review = await promotion.requestReview({ reviewId: `review:${worker.workerAgentId}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
      const decision = await promotion.decideReview({ reviewId: review.reviewId, decisionId: `decision:${worker.workerAgentId}`, decision: 'approved', reviewer: 'human:k3-5-reviewer', decidedAt: NOW, reason: 'exact disposable fixture candidate verified' });
      assert.equal(decision.decision, 'approved');
      const lease = store.listWorkcellWriterLeases(worker.workcellId)[0]!;
      const commit = await promotion.commitWorkcell({ operationId: `commit:${worker.workerAgentId}`, workcellId: worker.workcellId, leaseId: lease.leaseId, fenceToken: lease.fenceToken, now: NOW });
      assert.ok(commit.resultingCommit);
      reviews.push({ worker, commit });
    }
    const targetBefore = (await new GitCliWorkcellAdapter().validateRepository(f.repositoryRoot)).headRevision;
    const first = reviews[0]!;
    const second = reviews[1]!;
    const firstApproval = promotion.createMergeApproval({ approvalId: 'merge-approval:a', operationId: 'merge:a', commitOperationId: first.commit.operationId, workcellId: first.worker.workcellId, targetRef: 'main', expectedTargetHead: targetBefore, approver: 'human:k3-5-reviewer', createdAt: NOW, expiresAt: EXPIRES });
    const firstMerge = await promotion.mergeWorkcell({ operationId: 'merge:a', approvalId: firstApproval.approvalId, workcellId: first.worker.workcellId, now: NOW });
    assert.equal(firstMerge.status, 'merged');
    const targetAfterFirst = (await new GitCliWorkcellAdapter().validateRepository(f.repositoryRoot)).headRevision;
    assert.notEqual(targetAfterFirst, targetBefore);
    const staleApproval = promotion.createMergeApproval({ approvalId: 'merge-approval:stale', operationId: 'merge:stale', commitOperationId: second.commit.operationId, workcellId: second.worker.workcellId, targetRef: 'main', expectedTargetHead: targetBefore, approver: 'human:k3-5-reviewer', createdAt: NOW, expiresAt: EXPIRES });
    await assert.rejects(() => promotion.mergeWorkcell({ operationId: 'merge:stale', approvalId: staleApproval.approvalId, workcellId: second.worker.workcellId, now: NOW }), WorkcellPromotionRejectedError);
    const secondApproval = promotion.createMergeApproval({ approvalId: 'merge-approval:b', operationId: 'merge:b', commitOperationId: second.commit.operationId, workcellId: second.worker.workcellId, targetRef: 'main', expectedTargetHead: targetAfterFirst, approver: 'human:k3-5-reviewer', createdAt: NOW, expiresAt: EXPIRES });
    const secondMerge = await promotion.mergeWorkcell({ operationId: 'merge:b', approvalId: secondApproval.approvalId, workcellId: second.worker.workcellId, now: NOW });
    assert.equal(secondMerge.status, 'merged');
    assert.equal(await readFile(path.join(f.repositoryRoot, 'src/worker-a.ts'), 'utf8'), 'export const workerA = "K3_5_A_PASS";\n');
    assert.equal(await readFile(path.join(f.repositoryRoot, 'src/worker-b.ts'), 'utf8'), 'export const workerB = "K3_5_B_PASS";\n');
    assert.equal(store.listWorkcells().filter((workcell) => workcell.status === 'merged').length, 2);
    store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(databasePath);
    assert.ok(reopened);
    assert.equal(reopened!.listReviewRequests().length, 2);
    assert.equal(reopened!.listReviewDecisions().length, 2);
    assert.equal(reopened!.listCommitOperations().filter((operation) => operation.status === 'committed').length, 2);
    assert.equal(reopened!.listMergeOperations().filter((operation) => operation.status === 'merged').length, 2);
    reopened!.close();
    const observer = readAgentModeObserver(NOW, databasePath);
    assert.equal(observer.summary.reviewRequestCount, 2);
    assert.equal(observer.summary.commitOperationCount, 2);
    assert.equal(observer.summary.mergeOperationCount, 2);
    assert.equal(observer.workcells.filter((workcell) => workcell.status === 'merged').length, 2);
  } finally {
    await cleanup(f, databasePath);
  }
});

test('K3.5 rejects failed validation, review rejection, drift, and same-Workcell contention', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
    const store = new AgentModeSqliteStateStore(databasePath);
    const workcell = store.getWorkcell(concurrent.workers[0].workcellId)!;
    const writer = store.listWorkcellWriterLeases(workcell.workcellId)[0]!;
    const competing = store.grantWorkcellWriterLease({ workcellId: workcell.workcellId, leaseId: 'lease:competing', ownerAgent: 'agent:worker-k3-5-b', ownerAttempt: 'attempt:competing', createdAt: NOW, expiresAt: EXPIRES });
    assert.equal(competing.result, 'rejected');
    const targetLease = store.acquireTargetRefLease({ leaseId: 'target-lease:first', repositoryRef: 'disposable-k3-5-fixture', targetRef: 'main', ownerOperation: 'merge:first', fenceToken: 0, expectedTargetHead: 'target-head', expiresAt: EXPIRES, status: 'active' }, NOW);
    assert.equal(targetLease.result, 'granted');
    const competingTargetLease = store.acquireTargetRefLease({ leaseId: 'target-lease:second', repositoryRef: 'disposable-k3-5-fixture', targetRef: 'main', ownerOperation: 'merge:second', fenceToken: 0, expectedTargetHead: 'target-head', expiresAt: EXPIRES, status: 'active' }, NOW);
    assert.equal(competingTargetLease.result, 'rejected');
    store.updateTargetRefLeaseStatus('target-lease:first', 'released');
    const promotion = new WorkcellPromotionManager({ store });
    const rejectedReview = await promotion.requestReview({ reviewId: 'review:reject', workcellId: workcell.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
    await promotion.decideReview({ reviewId: rejectedReview.reviewId, decisionId: 'decision:reject', decision: 'rejected', reviewer: 'human:k3-5-reviewer', decidedAt: NOW, reason: 'negative control' });
    await assert.rejects(() => promotion.commitWorkcell({ operationId: 'commit:rejected', workcellId: workcell.workcellId, leaseId: writer.leaseId, fenceToken: writer.fenceToken, now: NOW }), WorkcellPromotionRejectedError);
    await writeFile(path.join(workcell.worktreePath, 'src/worker-a.ts'), 'export const workerA = "DRIFT";\n');
    await assert.rejects(() => promotion.requestReview({ reviewId: 'review:drift-2', workcellId: workcell.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES }), WorkcellPromotionRejectedError);
    assert.equal(writer.workcellId, workcell.workcellId);
    store.close();
  } finally {
    await cleanup(f, databasePath);
  }
});

test('K3.5 reconciles commit/merge effects after a crash before the durable receipt', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
    const worker = concurrent.workers[0]!;
    const store = new AgentModeSqliteStateStore(databasePath);
    const reviewManager = new WorkcellPromotionManager({ store });
    const review = await reviewManager.requestReview({ reviewId: 'review:crash', workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
    await reviewManager.decideReview({ reviewId: review.reviewId, decisionId: 'decision:crash', decision: 'approved', reviewer: 'human:k3-5-reviewer', decidedAt: NOW });
    const lease = store.listWorkcellWriterLeases(worker.workcellId)[0]!;
    const crashingCommit = new WorkcellPromotionManager({ store, failureInjector: (point) => { if (point === 'after-commit-effect-before-receipt') throw new Error('simulated crash'); } });
    await assert.rejects(() => crashingCommit.commitWorkcell({ operationId: 'commit:crash', workcellId: worker.workcellId, leaseId: lease.leaseId, fenceToken: lease.fenceToken, now: NOW }), /simulated crash/);
    const reconciler = new WorkcellPromotionManager({ store });
    const commit = await reconciler.commitWorkcell({ operationId: 'commit:crash', workcellId: worker.workcellId, leaseId: lease.leaseId, fenceToken: lease.fenceToken, now: NOW });
    assert.equal(commit.status, 'reconciled');
    const targetHead = (await new GitCliWorkcellAdapter().validateRepository(f.repositoryRoot)).headRevision;
    const approval = reconciler.createMergeApproval({ approvalId: 'merge-approval:crash', operationId: 'merge:crash', commitOperationId: commit.operationId, workcellId: worker.workcellId, targetRef: 'main', expectedTargetHead: targetHead, approver: 'human:k3-5-reviewer', createdAt: NOW, expiresAt: EXPIRES });
    const crashingMerge = new WorkcellPromotionManager({ store, failureInjector: (point) => { if (point === 'after-merge-effect-before-receipt') throw new Error('simulated merge crash'); } });
    await assert.rejects(() => crashingMerge.mergeWorkcell({ operationId: 'merge:crash', approvalId: approval.approvalId, workcellId: worker.workcellId, now: NOW }), /simulated merge crash/);
    const merged = await reconciler.mergeWorkcell({ operationId: 'merge:crash', approvalId: approval.approvalId, workcellId: worker.workcellId, now: NOW });
    assert.equal(merged.status, 'reconciled');
    assert.equal(await readFile(path.join(f.repositoryRoot, 'src/worker-a.ts'), 'utf8'), 'export const workerA = "K3_5_A_PASS";\n');
    store.close();
  } finally {
    await cleanup(f, databasePath);
  }
});
