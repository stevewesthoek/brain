// Developer-only K3.5 acceptance fixture. Exactly two MiniMax workers are
// dispatched; this is not a general coding, approval, Git, or retry CLI.
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { runK35ConcurrentWorkers } from '../../projects/brain-core/dist/agent-mode/k3-5-concurrency.js';
import { WorkcellPromotionManager } from '../../projects/brain-core/dist/agent-mode/workcell-promotion.js';
import { AgentModeSqliteStateStore } from '../../projects/brain-core/dist/agent-mode/sqlite-state-store.js';
import { GitCliWorkcellAdapter } from '../../projects/brain-core/dist/agent-mode/workcell.js';
import { AmazonBedrockModelGateway } from '../../projects/brain-core/dist/adapters/amazon-bedrock-model-gateway.js';

process.title = 'brain-agent k3-5-live-acceptance';
const execFile = promisify(execFileCallback);
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
const region = process.env.AWS_REGION ?? 'us-east-1';

async function aws(args) {
  const result = await execFile('aws', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  return JSON.parse(String(result.stdout));
}

async function git(cwd, args) { await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' }); }

const root = await mkdtemp('/tmp/brain-agent-mode-k3-5-live-');
const repositoryRoot = path.join(root, 'repo');
const workcellsRoot = path.join(root, 'workcells');
const databasePath = path.join(root, 'agent-mode.db');
try {
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'export const workerA = "BEFORE";\n');
  await writeFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'export const workerB = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-5-live@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.5 Live Fixture']);
  await git(repositoryRoot, ['add', 'src/worker-a.ts', 'src/worker-b.ts']);
  await git(repositoryRoot, ['commit', '-m', 'K3.5 disposable acceptance fixture']);
  const baseRef = await (await execFile('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' })).stdout.trim();
  const identity = await aws(['sts', 'get-caller-identity', '--query', '{account:Account}', '--output', 'json']);
  const checkedAt = new Date().toISOString();
  const freshUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const details = await aws(['bedrock', 'get-foundation-model', '--model-identifier', 'minimax.minimax-m2.5', '--region', region, '--query', '{model:modelDetails.modelId,status:modelDetails.modelLifecycle.status}', '--output', 'json']);
  const availability = await aws(['bedrock', 'get-foundation-model-availability', '--model-id', 'minimax.minimax-m2.5', '--region', region, '--output', 'json']);
  if (details.status !== 'ACTIVE' || availability.authorizationStatus !== 'AUTHORIZED' || availability.agreementAvailability?.status !== 'AVAILABLE' || availability.entitlementAvailability !== 'AVAILABLE' || availability.regionAvailability !== 'AVAILABLE') throw new Error(`fresh MiniMax access evidence is not sufficient: ${JSON.stringify({ details, availability })}`);
  const evidenceVersion = `agent-mode-live-access:${checkedAt}`;
  const base = { state: 'healthy', accessState: 'verified', checkedAt, freshUntil, evidenceVersion };
  const routeEvidence = {
    'agent-mode/minimax-m2.5': { ...base, modelRef: 'agent-mode/minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5' },
    'agent-mode/glm-5': { ...base, modelRef: 'agent-mode/glm-5', routeKind: 'direct', routeId: 'zai.glm-5' },
    'agent-mode/claude-opus-4.6': { ...base, modelRef: 'agent-mode/claude-opus-4.6', routeKind: 'inference-profile', routeId: 'us.anthropic.claude-opus-4-6-v1' },
  };
  const accountRef = `aws-account:${identity.account}`;
  const modelAccessEvidence = { version: evidenceVersion, accountRef, region, modelRef: 'agent-mode/minimax-m2.5', modelId: 'minimax.minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5', state: 'verified', catalogVisible: true, callable: true, checkedAt, freshUntil, source: 'aws-bedrock-get-foundation-model-and-availability' };
  const concurrent = await runK35ConcurrentWorkers({ databasePath, repositoryRoot, workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef, now: checkedAt, accountRef, routeEvidence, modelAccessEvidence, gatewayFactory: () => new AmazonBedrockModelGateway({ accountRef }) });
  if (concurrent.status !== 'completed') throw new Error(`two-worker acceptance did not reach awaiting_review: ${JSON.stringify(concurrent)}`);
  const store = new AgentModeSqliteStateStore(databasePath);
  const promotion = new WorkcellPromotionManager({ store });
  const promoted = [];
  for (const worker of concurrent.workers) {
    const review = await promotion.requestReview({ reviewId: `review:${worker.workerAgentId}`, workcellId: worker.workcellId, requestingActor: 'agent:jarvis-k3-5-root', createdAt: checkedAt, expiresAt: freshUntil });
    promotion.decideReview({ reviewId: review.reviewId, decisionId: `decision:${worker.workerAgentId}`, decision: 'approved', reviewer: 'human:k3-5-live-reviewer', decidedAt: checkedAt, reason: 'exact disposable candidate verified' });
    const commit = await promotion.commitWorkcell({ operationId: `commit:${worker.workerAgentId}`, workcellId: worker.workcellId, now: checkedAt });
    promoted.push({ worker, commit });
  }
  const gitAdapter = new GitCliWorkcellAdapter();
  const targetBefore = (await gitAdapter.validateRepository(repositoryRoot)).headRevision;
  const firstApproval = promotion.createMergeApproval({ approvalId: 'merge-approval:a', operationId: 'merge:a', commitOperationId: promoted[0].commit.operationId, workcellId: promoted[0].worker.workcellId, targetRef: 'main', expectedTargetHead: targetBefore, approver: 'human:k3-5-live-reviewer', createdAt: checkedAt, expiresAt: freshUntil });
  const firstMerge = await promotion.mergeWorkcell({ operationId: 'merge:a', approvalId: firstApproval.approvalId, workcellId: promoted[0].worker.workcellId, now: checkedAt });
  const targetAfterFirst = (await gitAdapter.validateRepository(repositoryRoot)).headRevision;
  const staleApproval = promotion.createMergeApproval({ approvalId: 'merge-approval:b-stale', operationId: 'merge:b-stale', commitOperationId: promoted[1].commit.operationId, workcellId: promoted[1].worker.workcellId, targetRef: 'main', expectedTargetHead: targetBefore, approver: 'human:k3-5-live-reviewer', createdAt: checkedAt, expiresAt: freshUntil });
  let staleRejected = false;
  try { await promotion.mergeWorkcell({ operationId: 'merge:b-stale', approvalId: staleApproval.approvalId, workcellId: promoted[1].worker.workcellId, now: checkedAt }); } catch { staleRejected = true; }
  if (!staleRejected) throw new Error('stale merge approval was not rejected');
  const secondApproval = promotion.createMergeApproval({ approvalId: 'merge-approval:b', operationId: 'merge:b', commitOperationId: promoted[1].commit.operationId, workcellId: promoted[1].worker.workcellId, targetRef: 'main', expectedTargetHead: targetAfterFirst, approver: 'human:k3-5-live-reviewer', createdAt: checkedAt, expiresAt: freshUntil });
  const secondMerge = await promotion.mergeWorkcell({ operationId: 'merge:b', approvalId: secondApproval.approvalId, workcellId: promoted[1].worker.workcellId, now: checkedAt });
  const finalTargetHead = (await gitAdapter.validateRepository(repositoryRoot)).headRevision;
  const finalA = await readFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'utf8');
  const finalB = await readFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'utf8');
  const finalStore = AgentModeSqliteStateStore.openExisting(databasePath);
  const evidence = { status: firstMerge.status === 'merged' && secondMerge.status === 'merged' && finalA.includes('K3_5_A_PASS') && finalB.includes('K3_5_B_PASS') ? 'passed' : 'failed', root, databasePath, baseRef, targetBefore, targetAfterFirst, finalTargetHead, concurrent: { actualOverlap: concurrent.actualOverlap, maximumConcurrentWorkers: concurrent.maximumConcurrentWorkers, workers: concurrent.workers }, commits: promoted.map(({ worker, commit }) => ({ workerAgentId: worker.workerAgentId, workcellId: worker.workcellId, commitSha: commit.resultingCommit, model: worker.modelRef, turns: worker.modelTurns, tools: worker.toolCalls, tokens: worker.usage, costUsd: worker.estimatedCostUsd })), merges: [firstMerge, secondMerge], staleMergeApprovalRejected: staleRejected, observerState: { reviewRequests: finalStore?.listReviewRequests().length ?? 0, decisions: finalStore?.listReviewDecisions().length ?? 0, commits: finalStore?.listCommitOperations().length ?? 0, merges: finalStore?.listMergeOperations().length ?? 0 }, fixtureContent: { workerA: finalA, workerB: finalB } };
  finalStore?.close();
  console.log(JSON.stringify({ ...evidence, cleanup: 'pending-exact-fixture-cleanup' }, null, 2));
} finally {
  const cleanupStore = AgentModeSqliteStateStore.openExisting(databasePath);
  const paths = cleanupStore?.listWorkcells().map((workcell) => workcell.worktreePath) ?? [];
  cleanupStore?.close();
  for (const worktreePath of paths) await execFile('git', ['-C', repositoryRoot, 'worktree', 'remove', '--force', worktreePath], { encoding: 'utf8' }).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
}
