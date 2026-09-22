import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runK35ConcurrentWorkers } from '../agent-mode/k3-5-concurrency.js';
import { WorkcellPromotionManager, WorkcellPromotionRejectedError } from '../agent-mode/workcell-promotion.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';
import { AgentModeSqliteStateStore, type AgentModeReviewDecision, type AgentModeReviewRequest } from '../agent-mode/sqlite-state-store.js';

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
  const root = await mkdtemp('/tmp/brain-k3-5-b-');
  const repositoryRoot = path.join(root, 'repo');
  const workcellsRoot = path.join(root, 'workcells');
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'export const workerA = "BEFORE";\n');
  await writeFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'export const workerB = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-5-b@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.5-B Fixture']);
  await git(repositoryRoot, ['add', 'src/worker-a.ts', 'src/worker-b.ts']);
  await git(repositoryRoot, ['commit', '-m', 'K3.5-B fixture']);
  return { root, repositoryRoot, workcellsRoot, baseRef: await git(repositoryRoot, ['rev-parse', 'HEAD']) };
}

function gateway(worker: 'A' | 'B'): ModelGateway {
  let turn = 0;
  return { invoke: async (request) => {
    turn += 1;
    const relativePath = worker === 'A' ? 'src/worker-a.ts' : 'src/worker-b.ts';
    const replacementText = worker === 'A' ? 'K3_5_B_REVIEW_A' : 'K3_5_B_REVIEW_B';
    const result: Partial<NormalizedModelResult> = turn === 1
      ? { toolUses: [{ toolUseId: `${worker}-read`, name: 'brain_read', input: { path: relativePath } }] }
      : turn === 2
        ? { toolUses: [{ toolUseId: `${worker}-patch`, name: 'brain_workcell_patch', input: { path: relativePath, oldText: 'BEFORE', replacementText } }] }
        : { text: `${worker} completed the deterministic candidate.` };
    return {
      text: '', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1',
      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 }, cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.00001, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId, ...result,
    };
  } };
}

async function runFixture(f: { repositoryRoot: string; workcellsRoot: string; baseRef: string; root: string }): Promise<{ store: AgentModeSqliteStateStore; databasePath: string; workers: Awaited<ReturnType<typeof runK35ConcurrentWorkers>>['workers'] }> {
  const databasePath = path.join(f.root, 'agent-mode.db');
  const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: (worker) => gateway(worker.label) });
  assert.equal(concurrent.status, 'completed');
  return { store: new AgentModeSqliteStateStore(databasePath), databasePath, workers: concurrent.workers };
}

async function cleanup(f: { root: string; repositoryRoot: string }, databasePath: string): Promise<void> {
  const store = AgentModeSqliteStateStore.openExisting(databasePath);
  const workcells = store?.listWorkcells() ?? [];
  store?.close();
  for (const workcell of workcells) await execFile('git', ['-C', f.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
  await rm(f.root, { recursive: true, force: true });
}

test('K3.5-B persists exact review requests, explicit decisions, receipts, and independent reviews', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const { store, workers } = await runFixture(f);
    const manager = new WorkcellPromotionManager({ store });
    const reviews: Array<{ review: AgentModeReviewRequest; worker: typeof workers[number] }> = [];
    await assert.rejects(() => manager.requestReview({ reviewId: 'review:model-request', workcellId: workers[0]!.workcellId, requestingActor: 'model:coding-worker', createdAt: NOW, expiresAt: EXPIRES }), WorkcellPromotionRejectedError);
    for (const worker of workers) {
      const review = await manager.requestReview({ reviewId: `review:k3-5-b:${worker.workerAgentId}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
      assert.equal(review.status, 'pending');
      assert.equal(review.workerAgentId, worker.workerAgentId);
      assert.equal(review.diffHash, store.getWorkcellDiff(review.diffId)?.diffHash);
      assert.equal(review.validationEvidenceHash, store.getWorkcellValidationRun(review.validationId)?.evidenceHash);
      assert.equal(store.listReviewReceipts(review.reviewId).length, 1);
      reviews.push({ review, worker });
    }
    await assert.rejects(() => manager.decideReview({ reviewId: reviews[0]!.review.reviewId, decisionId: 'decision:self', decision: 'approved', reviewer: reviews[0]!.worker.workerAgentId, decidedAt: NOW }), WorkcellPromotionRejectedError);
    await assert.rejects(() => manager.decideReview({ reviewId: reviews[0]!.review.reviewId, decisionId: 'decision:model', decision: 'approved', reviewer: 'model:reviewer', decidedAt: NOW }), WorkcellPromotionRejectedError);
    const decisions: AgentModeReviewDecision[] = [];
    for (const item of reviews) {
      const decision = await manager.decideReview({ reviewId: item.review.reviewId, decisionId: `decision:k3-5-b:${item.worker.workerAgentId}`, decision: 'approved', reviewer: 'human:k3-5-b-reviewer', decidedAt: NOW, reason: 'exact candidate verified' });
      assert.equal(decision.decision, 'approved');
      assert.equal((await manager.decideReview({ reviewId: item.review.reviewId, decisionId: decision.decisionId, decision: 'approved', reviewer: decision.reviewer, decidedAt: decision.decidedAt, reason: decision.reason })).decisionId, decision.decisionId);
      decisions.push(decision);
    }
    await assert.rejects(() => manager.decideReview({ reviewId: reviews[0]!.review.reviewId, decisionId: 'decision:conflict', decision: 'rejected', reviewer: 'human:other-reviewer', decidedAt: NOW, reason: 'conflict' }), WorkcellPromotionRejectedError);
    assert.equal(new Set(reviews.map((item) => item.review.workcellId)).size, 2);
    assert.equal(new Set(decisions.map((item) => item.evidenceHash)).size, 2);
    assert.equal(store.listReviewReceipts().filter((receipt) => receipt.receiptType === 'ReviewRequestedReceipt').length, 2);
    assert.equal(store.listReviewReceipts().filter((receipt) => receipt.receiptType === 'ReviewApprovedReceipt').length, 2);
    store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(databasePath)!;
    assert.equal(reopened.listReviewRequests().filter((request) => request.status === 'approved').length, 2);
    assert.equal(reopened.listReviewDecisions().length, 2);
    assert.equal(reopened.listReviewReceipts().length, 4);
    reopened.close();
    const observer = readAgentModeObserver(NOW, databasePath);
    assert.equal(observer.summary.reviewRequestCount, 2);
    assert.equal(observer.summary.reviewDecisionCount, 2);
    assert.equal(observer.reviewRequests.filter((request) => request.status === 'approved').length, 2);
  } finally {
    await cleanup(f, databasePath);
  }
});

test('K3.5-B rejects unvalidated and failed-validation candidates before approval', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const { store, workers } = await runFixture(f);
    const manager = new WorkcellPromotionManager({ store });
    const worker = workers[0]!;
    const diff = store.getLatestWorkcellDiff(worker.workcellId)!;
    const validation = store.getWorkcellValidationRun(worker.validationId!)!;
    assert.throws(() => store.createReviewRequest({ reviewId: 'review:unvalidated', workcellId: worker.workcellId, taskId: worker.taskId, runId: worker.runId, attemptId: worker.attemptId, workerAgentId: store.getWorkcell(worker.workcellId)!.ownerAgent, repositoryRef: 'disposable-k3-5-fixture', branch: store.getWorkcell(worker.workcellId)!.branch, baseRevision: diff.baseRevision, currentRevision: diff.currentRevision, diffId: diff.diffId, diffHash: diff.diffHash, validationId: 'validation:missing', validationEvidenceHash: 'missing', requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES, status: 'pending' }), /validation binding is invalid/);
    const review = await manager.requestReview({ reviewId: 'review:failed-validation', workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
    const lease = store.listWorkcellWriterLeases(worker.workcellId)[0]!;
    const failed = store.startWorkcellValidation({ validationId: 'validation:failed-later', workcellId: worker.workcellId, capability: 'validation.run(workcell)', ownerAgent: store.getWorkcell(worker.workcellId)!.ownerAgent, ownerAttempt: worker.attemptId, leaseId: lease.leaseId, fenceToken: lease.fenceToken, repositoryRoot: store.getWorkcell(worker.workcellId)!.repositoryRoot, worktreePath: store.getWorkcell(worker.workcellId)!.worktreePath, resourceValid: false, validatorAllowed: true, validatorProfile: 'git.diff.integrity', diffId: validation.diffId, operationHash: 'operation:failed-later', startedAt: LATER });
    assert.equal(failed.result, 'rejected');
    await assert.rejects(() => manager.decideReview({ reviewId: review.reviewId, decisionId: 'decision:failed', decision: 'approved', reviewer: 'human:k3-5-b-reviewer', decidedAt: LATER }), WorkcellPromotionRejectedError);
    assert.equal(store.getReviewRequest(review.reviewId)!.status, 'stale');
    store.close();
  } finally {
    await cleanup(f, databasePath);
  }
});

test('K3.5-B marks approval stale after candidate mutation or validation drift', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const { store, workers } = await runFixture(f);
    const manager = new WorkcellPromotionManager({ store });
    const [workerA, workerB] = workers;
    const reviewA = await manager.requestReview({ reviewId: 'review:stale-file', workcellId: workerA!.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
    await manager.decideReview({ reviewId: reviewA.reviewId, decisionId: 'decision:stale-file', decision: 'approved', reviewer: 'human:k3-5-b-reviewer', decidedAt: NOW });
    const workcellA = store.getWorkcell(workerA!.workcellId)!;
    await writeFile(path.join(workcellA.worktreePath, 'src/worker-a.ts'), 'export const workerA = "DRIFT";\n');
    assert.equal((await manager.refreshReview(reviewA.reviewId, LATER)).status, 'stale');
    const reviewB = await manager.requestReview({ reviewId: 'review:stale-validation', workcellId: workerB!.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
    await manager.decideReview({ reviewId: reviewB.reviewId, decisionId: 'decision:stale-validation', decision: 'approved', reviewer: 'human:k3-5-b-reviewer', decidedAt: NOW });
    const workcellB = store.getWorkcell(workerB!.workcellId)!;
    const leaseB = store.listWorkcellWriterLeases(workerB!.workcellId)[0]!;
    const driftedValidation = store.startWorkcellValidation({ validationId: 'validation:evidence-drift', workcellId: workerB!.workcellId, capability: 'validation.run(workcell)', ownerAgent: workcellB.ownerAgent, ownerAttempt: workerB!.attemptId, leaseId: leaseB.leaseId, fenceToken: leaseB.fenceToken, repositoryRoot: workcellB.repositoryRoot, worktreePath: workcellB.worktreePath, resourceValid: false, validatorAllowed: true, validatorProfile: 'git.diff.integrity', diffId: store.getLatestWorkcellDiff(workerB!.workcellId)!.diffId, operationHash: 'operation:evidence-drift', startedAt: LATER });
    assert.equal(driftedValidation.result, 'rejected');
    assert.equal((await manager.refreshReview(reviewB.reviewId, LATER)).status, 'stale');
    assert.equal(store.getReviewRequest(reviewA.reviewId)!.status, 'stale');
    assert.equal(store.getReviewRequest(reviewB.reviewId)!.status, 'stale');
    store.close();
    const observer = readAgentModeObserver(LATER, databasePath);
    assert.equal(observer.reviewRequests.filter((request) => request.status === 'stale').length, 2);
  } finally {
    await cleanup(f, databasePath);
  }
});

test('K3.5-B rejects candidate drift between request and approval without reapproval', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const { store, workers } = await runFixture(f);
    const manager = new WorkcellPromotionManager({ store });
    const worker = workers[0]!;
    const review = await manager.requestReview({ reviewId: 'review:between-request-and-approval', workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: NOW, expiresAt: EXPIRES });
    const workcell = store.getWorkcell(worker.workcellId)!;
    await writeFile(path.join(workcell.worktreePath, 'src/worker-a.ts'), 'export const workerA = "CHANGED_AFTER_REQUEST";\n');
    await assert.rejects(() => manager.decideReview({ reviewId: review.reviewId, decisionId: 'decision:drifted', decision: 'approved', reviewer: 'human:k3-5-b-reviewer', decidedAt: LATER }), WorkcellPromotionRejectedError);
    assert.equal(store.getReviewRequest(review.reviewId)!.status, 'stale');
    assert.equal(store.getReviewDecision(review.reviewId), undefined);
    store.close();
  } finally {
    await cleanup(f, databasePath);
  }
});
