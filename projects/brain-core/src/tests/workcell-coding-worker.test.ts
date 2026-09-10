import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { runLiveWorkcellCodingWorker } from '../agent-mode/live-workcell-coding-worker.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const execFile = promisify(execFileCallback);
const NOW = '2026-09-09T12:00:00.000Z';
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return String(result.stdout).trim();
}

async function fixture(): Promise<{ root: string; repositoryRoot: string; workcellsRoot: string; mainFile: string }> {
  const root = await mkdtemp('/tmp/brain-k3-4-worker-');
  const repositoryRoot = path.join(root, 'repo');
  const workcellsRoot = path.join(root, 'workcells');
  await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
  await writeFile(path.join(repositoryRoot, 'src/message.ts'), 'export const message = "BEFORE";\n');
  await git(repositoryRoot, ['init', '-b', 'main']);
  await git(repositoryRoot, ['config', 'user.email', 'k3-4@example.invalid']);
  await git(repositoryRoot, ['config', 'user.name', 'K3.4 Fixture']);
  await git(repositoryRoot, ['add', 'src/message.ts']);
  await git(repositoryRoot, ['commit', '-m', 'fixture']);
  return { root, repositoryRoot, workcellsRoot, mainFile: path.join(repositoryRoot, 'src/message.ts') };
}

function modelResult(request: Parameters<ModelGateway['invoke']>[0], response: Partial<NormalizedModelResult>): NormalizedModelResult {
  return {
    text: '', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1',
    usage: { inputTokens: 20, outputTokens: 12, totalTokens: 32 }, cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.00002, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId, ...response,
  };
}

async function removeFixture(fixtureRoot: string, databasePath: string): Promise<void> {
  const store = AgentModeSqliteStateStore.openExisting(databasePath);
  const workcell = store?.listWorkcells()[0];
  store?.close();
  if (workcell) await execFile('git', ['-C', workcell.repositoryRoot, 'worktree', 'remove', '--force', workcell.worktreePath]).catch(() => undefined);
  await rm(fixtureRoot, { recursive: true, force: true });
}

test('K3.4 bounded worker reads, patches, validates, and returns awaiting_review without touching main', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  let calls = 0;
  const gateway: ModelGateway = {
    invoke: async (request) => {
      calls += 1;
      if (calls === 1) return modelResult(request, { toolUses: [{ toolUseId: 'read-1', name: 'brain_read', input: { path: 'src/message.ts' } }] });
      if (calls === 2) return modelResult(request, { toolUses: [{ toolUseId: 'patch-1', name: 'brain_workcell_patch', input: { path: 'src/message.ts', oldText: 'BEFORE', replacementText: 'K3_4_PASS' } }] });
      return modelResult(request, { text: 'Patched the Workcell and left it awaiting review.' });
    },
  };
  try {
    const output = await runLiveWorkcellCodingWorker({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, now: NOW, fixtureMode: true, gateway });
    assert.equal(output.status, 'completed');
    assert.equal(output.modelRef, 'agent-mode/minimax-m2.5');
    assert.equal(output.toolCalls, 2);
    assert.equal(output.modelTurns, 3);
    assert.equal(output.validationResult, 'passed');
    assert.equal(output.workcellStatus, 'awaiting_review');
    assert.equal(output.restartVerified, true);
    assert.equal(await readFile(f.mainFile, 'utf8'), 'export const message = "BEFORE";\n');
    const store = AgentModeSqliteStateStore.openExisting(databasePath);
    assert.ok(store);
    const workcell = store.getWorkcell(output.workcellId);
    assert.ok(workcell);
    assert.equal(await readFile(path.join(workcell!.worktreePath, 'src/message.ts'), 'utf8'), 'export const message = "K3_4_PASS";\n');
    assert.equal(store.getAttempt(output.attemptId)?.status, 'completed');
    assert.equal(store.getLatestWorkcellDiff(output.workcellId)?.changedFiles[0], 'src/message.ts');
    assert.equal(store.getWorkcellValidationRun(output.validationId!)?.result, 'passed');
    store.close();
  } finally {
    await removeFixture(f.root, databasePath);
  }
});
test('K3.4 worker uses at most three model turns and never escalates from MiniMax', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  const refs: string[] = [];
  const gateway: ModelGateway = { invoke: async (request) => { refs.push(request.modelRef); return modelResult(request, refs.length === 1 ? { toolUses: [{ toolUseId: 'read-1', name: 'brain_read', input: { path: 'src/message.ts' } }] } : refs.length === 2 ? { toolUses: [{ toolUseId: 'patch-1', name: 'brain_workcell_patch', input: { path: 'src/message.ts', oldText: 'BEFORE', replacementText: 'K3_4_PASS' } }] } : { text: 'done' }); } };
  try {
    const output = await runLiveWorkcellCodingWorker({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, now: NOW, fixtureMode: true, gateway });
    assert.equal(output.status, 'completed');
    assert.deepEqual(refs, ['agent-mode/minimax-m2.5', 'agent-mode/minimax-m2.5', 'agent-mode/minimax-m2.5']);
    assert.ok(output.modelTurns <= 3);
  } finally { await removeFixture(f.root, databasePath); }
});

test('K3.4 failed diff-integrity validation is durable and does not promote a result', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  const gateway: ModelGateway = { invoke: async (request) => modelResult(request, request.operationId.endsWith(':1') ? { toolUses: [{ toolUseId: 'read-1', name: 'brain_read', input: { path: 'src/message.ts' } }] } : request.operationId.endsWith(':2') ? { toolUses: [{ toolUseId: 'patch-1', name: 'brain_workcell_patch', input: { path: 'src/message.ts', oldText: 'BEFORE', replacementText: 'K3_4_PASS' } }] } : { text: 'validation did not pass' }) };
  try {
    const output = await runLiveWorkcellCodingWorker({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, now: NOW, fixtureMode: true, gateway, beforeValidation: async () => { const store = AgentModeSqliteStateStore.openExisting(databasePath); const workcell = store?.listWorkcells()[0]; if (workcell) await writeFile(path.join(workcell.worktreePath, 'src/message.ts'), 'export const message = "DRIFT";\n'); store?.close(); } });
    assert.equal(output.status, 'failed');
    assert.equal(output.validationResult, 'failed');
    assert.notEqual(output.workcellStatus, 'awaiting_review');
    const store = AgentModeSqliteStateStore.openExisting(databasePath);
    assert.ok(store);
    assert.equal(store.getAttempt(output.attemptId)?.status, 'failed');
    assert.equal(store.getWorkcellValidationRun(output.validationId!)?.result, 'failed');
    assert.equal(store.listRecentEvents(100).some((event) => event.eventType === 'jarvis_result_returned'), false);
    store.close();
  } finally { await removeFixture(f.root, databasePath); }
});

test('K3.4 worker rejects a model absolute-path patch before any mutation', async () => {
  const f = await fixture();
  const databasePath = path.join(f.root, 'agent-mode.db');
  let calls = 0;
  const gateway: ModelGateway = { invoke: async (request) => { calls += 1; return modelResult(request, calls === 1 ? { toolUses: [{ toolUseId: 'read-1', name: 'brain_read', input: { path: 'src/message.ts' } }] } : { toolUses: [{ toolUseId: 'patch-1', name: 'brain_workcell_patch', input: { path: '/etc/passwd', oldText: 'BEFORE', replacementText: 'K3_4_PASS' } }] }); } };
  try {
    const output = await runLiveWorkcellCodingWorker({ databasePath, repositoryRoot: f.repositoryRoot, workcellsRoot: f.workcellsRoot, harnessRoot: HARNESS_ROOT, now: NOW, fixtureMode: true, gateway });
    assert.equal(output.status, 'failed');
    assert.match(output.failureReason ?? '', /patch requires|validation|Workcell patch/i);
    assert.equal(await readFile(f.mainFile, 'utf8'), 'export const message = "BEFORE";\n');
  } finally { await removeFixture(f.root, databasePath); }
});
