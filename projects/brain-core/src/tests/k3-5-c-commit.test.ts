import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runK35ConcurrentWorkers, K35_WORKERS } from '../agent-mode/k3-5-concurrency.js';
import { AgentModeSqliteStateStore, type AgentModeCommitOperation } from '../agent-mode/sqlite-state-store.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';
import { WorkcellPromotionManager, WorkcellPromotionRejectedError } from '../agent-mode/workcell-promotion.js';
import { GitCliWorkcellAdapter } from '../agent-mode/workcell.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T12:00:00.000Z';
const EXPIRES = '2026-09-09T13:00:00.000Z';
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixture(): Promise<{ root: string; repositoryRoot: string; workcellsRoot: string; baseRef: string }> {
  const root = await mkdtemp('/tmp/brain-k3-5-c-');
  const repositoryRoot = path.join(root, 'repo');
  const workcellsRoot = path.join(root, 'workcells');
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'export const workerA = "BEFORE";\n');
  await writeFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'export const workerB = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-5-c@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.5-C Fixture']);
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

type Candidate = {
  fixture: Awaited<ReturnType<typeof fixture>>;
  store: AgentModeSqliteStateStore;
  promotion: WorkcellPromotionManager;
  worker: Awaited<ReturnType<typeof runK35ConcurrentWorkers>>['workers'][number];
  leaseId: string;
  fenceToken: number;
  reviewId: string;
};

async function candidate(label = 'a'): Promise<Candidate> {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
  const worker = concurrent.workers[label === 'a' ? 0 : 1]!;
  const store = new AgentModeSqliteStateStore(databasePath);
  const promotion = new WorkcellPromotionManager({ store });
  const lease = store.listWorkcellWriterLeases(worker.workcellId)[0]!;
  const review = await promotion.requestReview({ reviewId: `review:c:${label}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-c-root', createdAt: NOW, expiresAt: EXPIRES });
  await promotion.decideReview({ reviewId: review.reviewId, decisionId: `decision:c:${label}`, decision: 'approved', reviewer: 'human:k3-5-c-reviewer', decidedAt: NOW, reason: 'deterministic fixture approved' });
  return { fixture: f, store, promotion, worker, leaseId: lease.leaseId, fenceToken: lease.fenceToken, reviewId: review.reviewId };
}

async function cleanup(candidateFixture: Candidate): Promise<void> {
  let workcells: ReturnType<AgentModeSqliteStateStore['listWorkcells']> = [];
  try {
    workcells = candidateFixture.store.listWorkcells();
  } catch {
    const reopened = AgentModeSqliteStateStore.openExisting(path.join(candidateFixture.fixture.root, 'agent-mode.db'));
    workcells = reopened?.listWorkcells() ?? [];
    reopened?.close();
  }
  const repositoryRoot = candidateFixture.fixture.repositoryRoot;
  const root = candidateFixture.fixture.root;
  try { candidateFixture.store.close(); } catch { /* already closed after an observer restart check */ }
  for (const workcell of workcells) await execFile('git', ['-C', repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
}

test('K3.5-C commits only an approved candidate, persists receipts, and exposes durable state', async () => {
  const c = await candidate();
  try {
    const before = await git(c.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    const commit = await c.promotion.commitWorkcell({ operationId: 'commit:c:approved', workcellId: c.worker.workcellId, leaseId: c.leaseId, fenceToken: c.fenceToken, message: 'K3.5-C approved fixture', now: NOW });
    assert.equal(commit.status, 'committed');
    assert.equal(commit.parentCommit, before);
    assert.ok(commit.resultingCommit);
    assert.ok(commit.resultingTreeRevision);
    assert.equal(await git(c.fixture.repositoryRoot, ['rev-parse', 'HEAD']), before);
    assert.equal((await c.store.getWorkcell(c.worker.workcellId))?.status, 'committed');
    assert.deepEqual(c.store.listCommitReceipts(commit.operationId).map((receipt) => receipt.receiptType).sort(), ['CommitCompletedReceipt', 'CommitRequestedReceipt']);
    c.store.close();
    const observed = readAgentModeObserver(NOW, path.join(c.fixture.root, 'agent-mode.db'));
    assert.equal(observed.commitOperations[0]?.status, 'committed');
    assert.equal(observed.workcells.find((item) => item.workcellId === c.worker.workcellId)?.status, 'committed');
    c.store = new AgentModeSqliteStateStore(path.join(c.fixture.root, 'agent-mode.db'));
    assert.equal((await c.store.getWorkcell(c.worker.workcellId))?.status, 'committed');
  } finally {
    await cleanup(c);
  }
});

test('K3.5-C rejects missing/current-invalid authority, drift, and unsafe commit input before Git mutation', async () => {
  const c = await candidate();
  try {
    const before = await git(c.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    await assert.rejects(() => c.promotion.commitWorkcell({ operationId: 'commit:c:bad-fence', workcellId: c.worker.workcellId, leaseId: c.leaseId, fenceToken: c.fenceToken + 1, now: NOW }), WorkcellPromotionRejectedError);
    await assert.rejects(() => c.promotion.commitWorkcell({ operationId: 'commit:c:bad-message', workcellId: c.worker.workcellId, leaseId: c.leaseId, fenceToken: c.fenceToken, message: 'ok --no-verify', now: NOW }), WorkcellPromotionRejectedError);
    await writeFile(path.join(c.store.getWorkcell(c.worker.workcellId)!.worktreePath, 'src/worker-a.ts'), 'export const workerA = "DRIFT";\n');
    await assert.rejects(() => c.promotion.commitWorkcell({ operationId: 'commit:c:drift', workcellId: c.worker.workcellId, leaseId: c.leaseId, fenceToken: c.fenceToken, now: NOW }), WorkcellPromotionRejectedError);
    assert.equal(await git(c.fixture.repositoryRoot, ['rev-parse', 'HEAD']), before);
    assert.equal(c.store.getCommitOperation('commit:c:bad-fence'), undefined);
    assert.equal(c.store.listCommitReceipts('commit:c:bad-fence')[0]?.result, 'rejected');
    assert.equal((await c.store.getReviewRequest(c.reviewId))?.status, 'stale');
  } finally {
    await cleanup(c);
  }
});

test('K3.5-C makes successful replay idempotent and rejects a same-ID different candidate', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  let store: AgentModeSqliteStateStore | undefined;
  try {
    const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
    store = new AgentModeSqliteStateStore(databasePath);
    const promotion = new WorkcellPromotionManager({ store });
    const leases = [] as Array<{ leaseId: string; fenceToken: number }>;
    assert.notEqual(concurrent.workers[0]!.workcellId, concurrent.workers[1]!.workcellId);
    const reviews = await Promise.all(concurrent.workers.map((worker, index) => promotion.requestReview({ reviewId: `review:c:replay:${index}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-c-root', createdAt: NOW, expiresAt: EXPIRES })));
    await Promise.all(reviews.map((review, index) => promotion.decideReview({ reviewId: review.reviewId, decisionId: `decision:c:replay:${index}`, decision: 'approved', reviewer: 'human:k3-5-c-reviewer', decidedAt: NOW })));
    for (const worker of concurrent.workers) {
      const lease = store.listWorkcellWriterLeases(worker.workcellId)[0]!;
      leases.push({ leaseId: lease.leaseId, fenceToken: lease.fenceToken });
    }
    const first = concurrent.workers[0]!;
    const second = concurrent.workers[1]!;
    const firstCommit = await promotion.commitWorkcell({ operationId: 'commit:c:replay', workcellId: first.workcellId, leaseId: leases[0]!.leaseId, fenceToken: leases[0]!.fenceToken, now: NOW });
    const replay = await promotion.commitWorkcell({ operationId: 'commit:c:replay', workcellId: first.workcellId, leaseId: 'expired-or-wrong', fenceToken: 999, now: NOW });
    assert.deepEqual(replay, firstCommit);
    assert.equal(store.listCommitReceipts('commit:c:replay').filter((receipt) => receipt.result === 'completed').length, 1);
    await assert.rejects(() => promotion.commitWorkcell({ operationId: 'commit:c:replay', workcellId: second.workcellId, leaseId: leases[1]!.leaseId, fenceToken: leases[1]!.fenceToken, now: NOW }), WorkcellPromotionRejectedError);
    assert.equal(store.getCommitOperation('commit:c:replay')?.workcellId, first.workcellId);
    assert.equal(store.listCommitReceipts('commit:c:replay').filter((receipt) => receipt.result === 'rejected').length, 1);
  } finally {
    const workcells = store?.listWorkcells() ?? [];
    store?.close();
    for (const workcell of workcells) await execFile('git', ['-C', f.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
    await rm(f.root, { recursive: true, force: true });
  }
});

test('K3.5-C preserves the prepared boundary on a pre-Git crash and reconciles a post-Git crash', async () => {
  const beforeGit = await candidate('a');
  let afterGit: Candidate | undefined;
  try {
    const crashingBefore = new WorkcellPromotionManager({ store: beforeGit.store, failureInjector: (point) => { if (point === 'before-commit-effect') throw new Error('simulated pre-Git crash'); } });
    const parent = await git(beforeGit.fixture.repositoryRoot, ['rev-parse', 'HEAD']);
    await assert.rejects(() => crashingBefore.commitWorkcell({ operationId: 'commit:c:before-git', workcellId: beforeGit.worker.workcellId, leaseId: beforeGit.leaseId, fenceToken: beforeGit.fenceToken, now: NOW }), /simulated pre-Git crash/);
    assert.equal(await git(beforeGit.store.getWorkcell(beforeGit.worker.workcellId)!.worktreePath, ['rev-parse', 'HEAD']), parent);
    assert.equal(beforeGit.store.getCommitOperation('commit:c:before-git')?.status, 'prepared');
    const completed = await beforeGit.promotion.commitWorkcell({ operationId: 'commit:c:before-git', workcellId: beforeGit.worker.workcellId, leaseId: beforeGit.leaseId, fenceToken: beforeGit.fenceToken, now: NOW });
    assert.equal(completed.status, 'committed');

    afterGit = await candidate('b');
    const crashingAfter = new WorkcellPromotionManager({ store: afterGit.store, failureInjector: (point) => { if (point === 'after-commit-effect-before-receipt') throw new Error('simulated post-Git crash'); } });
    await assert.rejects(() => crashingAfter.commitWorkcell({ operationId: 'commit:c:after-git', workcellId: afterGit!.worker.workcellId, leaseId: afterGit!.leaseId, fenceToken: afterGit!.fenceToken, now: NOW }), /simulated post-Git crash/);
    const effectCommit = await git(afterGit.store.getWorkcell(afterGit.worker.workcellId)!.worktreePath, ['rev-parse', 'HEAD']);
    assert.notEqual(effectCommit, afterGit.fixture.baseRef);
    assert.equal(afterGit.store.getCommitOperation('commit:c:after-git')?.status, 'prepared');
    const reconciled = await afterGit.promotion.commitWorkcell({ operationId: 'commit:c:after-git', workcellId: afterGit.worker.workcellId, leaseId: 'expired-or-wrong', fenceToken: 999, now: NOW });
    assert.equal(reconciled.status, 'reconciled');
    assert.equal(reconciled.resultingCommit, effectCommit);
    assert.equal(afterGit.store.listCommitReceipts('commit:c:after-git').filter((receipt) => receipt.result === 'reconciled').length, 1);
  } finally {
    await cleanup(beforeGit);
    if (afterGit) await cleanup(afterGit);
  }
});

test('K3.5-C commits two independent Workcells without mutating the target checkout', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  let store: AgentModeSqliteStateStore | undefined;
  try {
    const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: gatewayFor });
    store = new AgentModeSqliteStateStore(databasePath);
    const promotion = new WorkcellPromotionManager({ store });
    const reviews = await Promise.all(concurrent.workers.map((worker, index) => promotion.requestReview({ reviewId: `review:c:independent:${index}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-c-root', createdAt: NOW, expiresAt: EXPIRES })));
    await Promise.all(reviews.map((review, index) => promotion.decideReview({ reviewId: review.reviewId, decisionId: `decision:c:independent:${index}`, decision: 'approved', reviewer: 'human:k3-5-c-reviewer', decidedAt: NOW })));
    const leases = concurrent.workers.map((worker) => store!.listWorkcellWriterLeases(worker.workcellId)[0]!);
    const targetBefore = await git(f.repositoryRoot, ['rev-parse', 'HEAD']);
    const first = await promotion.commitWorkcell({ operationId: 'commit:c:one', workcellId: concurrent.workers[0]!.workcellId, leaseId: leases[0]!.leaseId, fenceToken: leases[0]!.fenceToken, now: NOW });
    const other = await promotion.commitWorkcell({ operationId: 'commit:c:two', workcellId: concurrent.workers[1]!.workcellId, leaseId: leases[1]!.leaseId, fenceToken: leases[1]!.fenceToken, now: NOW });
    assert.equal(first.status, 'committed');
    assert.equal(other.status, 'committed');
    assert.notEqual(first.resultingCommit, other.resultingCommit);
    assert.equal(await git(f.repositoryRoot, ['rev-parse', 'HEAD']), targetBefore);
    assert.equal(store.listCommitReceipts('commit:c:one').length, 2);
    assert.equal(store.listCommitReceipts('commit:c:two').length, 2);
  } finally {
    const workcells = store?.listWorkcells() ?? [];
    store?.close();
    for (const workcell of workcells) await execFile('git', ['-C', f.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
    await rm(f.root, { recursive: true, force: true });
  }
});
