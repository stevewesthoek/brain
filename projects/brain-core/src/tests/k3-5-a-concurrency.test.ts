import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { runK35ConcurrentWorkers, K35_ROOT_BUDGET, K35_CHILD_BUDGET } from '../agent-mode/k3-5-concurrency.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { WorkcellFileMutationManager } from '../agent-mode/workcell-file-mutation.js';
import { WorkcellWriterManager } from '../agent-mode/workcell-writer.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T12:00:00.000Z';
const EXPIRES = '2026-09-09T13:00:00.000Z';
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function makeFixture(): Promise<{ root: string; repositoryRoot: string; workcellsRoot: string; baseRef: string; mainA: string; mainB: string }> {
  const root = await mkdtemp('/tmp/brain-k3-5-a-');
  const repositoryRoot = path.join(root, 'repo');
  const workcellsRoot = path.join(root, 'workcells');
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/worker-a.ts'), 'export const workerA = "BEFORE";\n');
  await writeFile(path.join(repositoryRoot, 'src/worker-b.ts'), 'export const workerB = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-5-a@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.5-A Fixture']);
  await git(repositoryRoot, ['add', 'src/worker-a.ts', 'src/worker-b.ts']);
  await git(repositoryRoot, ['commit', '-m', 'K3.5-A fixture']);
  return { root, repositoryRoot, workcellsRoot, baseRef: await git(repositoryRoot, ['rev-parse', 'HEAD']), mainA: path.join(repositoryRoot, 'src/worker-a.ts'), mainB: path.join(repositoryRoot, 'src/worker-b.ts') };
}

function gateway(worker: 'A' | 'B', relativePath: string, replacementText: string): ModelGateway {
  let turn = 0;
  return { invoke: async (request) => {
    turn += 1;
    const result: Partial<NormalizedModelResult> = turn === 1
      ? { toolUses: [{ toolUseId: `${worker}-read`, name: 'brain_read', input: { path: relativePath } }] }
      : turn === 2
        ? { toolUses: [{ toolUseId: `${worker}-patch`, name: 'brain_workcell_patch', input: { path: relativePath, oldText: 'BEFORE', replacementText } }] }
        : { text: `${worker} finished the bounded Workcell candidate.` };
    return {
      text: '', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1',
      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 }, cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.00001, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId, ...result,
    };
  } };
}

async function cleanup(f: { root: string; repositoryRoot: string }, databasePath: string): Promise<void> {
  const store = AgentModeSqliteStateStore.openExisting(databasePath);
  const workcells = store?.listWorkcells() ?? [];
  store?.close();
  for (const workcell of workcells) await execFile('git', ['-C', f.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
  await rm(f.root, { recursive: true, force: true });
}

test('K3.5-A: two bounded workers overlap without sharing Workcell write authority', async () => {
  const f = await makeFixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  try {
    const result = await runK35ConcurrentWorkers({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, baseRef: f.baseRef, now: NOW, fixtureMode: true, gatewayFactory: (worker) => gateway(worker.label, worker.relativePath, worker.replacementText) });
    assert.equal(result.status, 'completed');
    assert.equal(result.actualOverlap, true);
    assert.equal(result.maximumConcurrentWorkers, 2);
    assert.equal(result.sameBaseRevision, true);
    assert.equal(result.rootBudget.maxSteps, K35_ROOT_BUDGET.maxSteps);
    assert.equal(result.childBudget.maxTokens, K35_CHILD_BUDGET.maxTokens);
    const [a, b] = result.workers;
    assert.equal(a.workcellStatus, 'awaiting_review');
    assert.equal(b.workcellStatus, 'awaiting_review');
    assert.notEqual(a.workerAgentId, b.workerAgentId);
    assert.notEqual(a.attemptId, b.attemptId);
    assert.notEqual(a.workcellId, b.workcellId);
    assert.notEqual(a.leaseId, b.leaseId);
    assert.notEqual(a.fenceToken, 0);
    assert.notEqual(b.fenceToken, 0);
    assert.equal(await readFile(f.mainA, 'utf8'), 'export const workerA = "BEFORE";\n');
    assert.equal(await readFile(f.mainB, 'utf8'), 'export const workerB = "BEFORE";\n');

    const store = new AgentModeSqliteStateStore(databasePath);
    const workcellA = store.getWorkcell(a.workcellId)!;
    const workcellB = store.getWorkcell(b.workcellId)!;
    const leaseA = store.listWorkcellWriterLeases(workcellA.workcellId)[0]!;
    const leaseB = store.listWorkcellWriterLeases(workcellB.workcellId)[0]!;
    const writer = new WorkcellWriterManager({ store });
    const mutation = new WorkcellFileMutationManager({ store, writer });
    const beforeB = await readFile(path.join(workcellB.worktreePath, 'src/worker-b.ts'), 'utf8');
    const beforeBHash = createHash('sha256').update(beforeB).digest('hex');
    const crossWrite = await mutation.applyPatch({ operationId: 'operation:k3-5-a-cross-write', workcellId: workcellB.workcellId, repositoryRef: workcellB.repositoryRef, repositoryRoot: workcellB.repositoryRoot, worktreePath: workcellB.worktreePath, relativePath: 'src/worker-b.ts', ownerAgent: workcellA.ownerAgent, ownerAttempt: workcellA.attemptId, leaseId: leaseA.leaseId, fenceToken: leaseA.fenceToken, expectedPreimageHash: beforeBHash, oldText: 'BEFORE', replacementText: 'CROSS_WRITE', now: NOW });
    assert.equal(crossWrite.result, 'rejected');
    assert.match(crossWrite.reason ?? '', /lease|owner|workcell|resource/i);
    assert.equal(await readFile(path.join(workcellB.worktreePath, 'src/worker-b.ts'), 'utf8'), beforeB);
    const reverseCrossWrite = await mutation.applyPatch({ operationId: 'operation:k3-5-a-reverse-cross-write', workcellId: workcellA.workcellId, repositoryRef: workcellA.repositoryRef, repositoryRoot: workcellA.repositoryRoot, worktreePath: workcellA.worktreePath, relativePath: 'src/worker-a.ts', ownerAgent: workcellB.ownerAgent, ownerAttempt: workcellB.attemptId, leaseId: leaseB.leaseId, fenceToken: leaseB.fenceToken, expectedPreimageHash: createHash('sha256').update('export const workerA = "K3_5_A_PASS";\n').digest('hex'), oldText: 'K3_5_A_PASS', replacementText: 'REVERSE_CROSS_WRITE', now: NOW });
    assert.equal(reverseCrossWrite.result, 'rejected');
    assert.equal(await readFile(path.join(workcellA.worktreePath, 'src/worker-a.ts'), 'utf8'), 'export const workerA = "K3_5_A_PASS";\n');
    const oldFence = await mutation.applyPatch({ operationId: 'operation:k3-5-a-old-fence', workcellId: workcellA.workcellId, repositoryRef: workcellA.repositoryRef, repositoryRoot: workcellA.repositoryRoot, worktreePath: workcellA.worktreePath, relativePath: 'src/worker-a.ts', ownerAgent: workcellA.ownerAgent, ownerAttempt: workcellA.attemptId, leaseId: leaseA.leaseId, fenceToken: leaseA.fenceToken - 1, expectedPreimageHash: createHash('sha256').update('export const workerA = "K3_5_A_PASS";\n').digest('hex'), oldText: 'K3_5_A_PASS', replacementText: 'OLD_FENCE', now: NOW });
    assert.equal(oldFence.result, 'rejected');
    const sameWorkcellContention = store.grantWorkcellWriterLease({ workcellId: workcellA.workcellId, leaseId: 'lease:k3-5-a-contention', ownerAgent: 'agent:k3-5-a-competing', ownerAttempt: 'attempt:k3-5-a-competing', createdAt: NOW, expiresAt: EXPIRES });
    assert.equal(sameWorkcellContention.result, 'rejected');
    const steal = store.grantWorkcellWriterLease({ workcellId: workcellA.workcellId, leaseId: 'lease:k3-5-a-steal', ownerAgent: workcellB.ownerAgent, ownerAttempt: workcellB.attemptId, createdAt: NOW, expiresAt: EXPIRES });
    assert.equal(steal.result, 'rejected');
    assert.equal(leaseB.workcellId, workcellB.workcellId);
    const mutations = store.listWorkcellMutations();
    assert.equal(new Set(mutations.map((item) => item.operationId)).size, 2);
    assert.deepEqual(new Set(mutations.map((item) => item.workcellId)), new Set([workcellA.workcellId, workcellB.workcellId]));
    store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(databasePath)!;
    assert.equal(reopened.listWorkcells().length, 2);
    assert.equal(reopened.listWorkcellMutations().length, 2);
    assert.ok(reopened.listRecentEvents(100).some((event) => event.eventType === 'k3-5_root_result_recorded'));
    reopened.close();
    const observer = readAgentModeObserver(NOW, databasePath);
    assert.equal(observer.summary.workcellCount, 2);
    assert.equal(observer.summary.workcellWriteCount, 2);
    assert.equal(observer.summary.activeWorkcellWriterLeaseCount, 2);
    assert.equal(observer.summary.resultCount, 2);
  } finally {
    await cleanup(f, databasePath);
  }
});
