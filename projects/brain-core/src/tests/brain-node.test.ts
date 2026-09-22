import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  BRAIN_NODE_PROTOCOL_VERSION,
  BRAIN_NODE_READ_CAPABILITY,
  BrainNodeLocalPerimeter,
  createFixtureAuthenticator,
  hashNodeReadScope,
  type BrainNodeCommand,
  type BrainNodeDescriptor,
} from '../agent-mode/brain-node.js';
import { AgentModeSqliteStateStore, type AgentModeAdmission } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-08T00:01:00.000Z';
const LATER = '2026-09-08T00:02:00.000Z';
const EXPIRY = '2099-09-09T00:00:00.000Z';
const DEADLINE = '2099-09-10T00:00:00.000Z';
const CONTROLLER = 'controller:fixture';
const WORKTREE = 'worktree:fixture';
const RESOURCE = 'repo:fixture';
const GRANT = 'grant:repo-read';

type Fixture = {
  root: string;
  outside: string;
  store: AgentModeSqliteStateStore;
  node: BrainNodeLocalPerimeter;
  command: BrainNodeCommand;
  admission: AgentModeAdmission;
  reads: { count: number; paths: string[] };
};

async function withFixture(callback: (fixture: Fixture) => Promise<void> | void, options: {
  suffix?: string;
  relativePath?: string;
  operationCapability?: string;
  deadline?: string;
  maxBytes?: number;
  platform?: string;
} = {}): Promise<void> {
  const suffix = options.suffix ?? 'fixture';
  const root = mkdtempSync(path.join('/tmp', `brain-node-${suffix}-`));
  const outside = mkdtempSync(path.join('/tmp', `brain-node-outside-${suffix}-`));
  const relativePath = options.relativePath ?? 'nested/readme.txt';
  const operationCapability = options.operationCapability ?? BRAIN_NODE_READ_CAPABILITY;
  const deadline = options.deadline ?? DEADLINE;
  const reads = { count: 0, paths: [] as string[] };
  const store = new AgentModeSqliteStateStore(path.join(root, 'state', 'agent-mode.db'));
  const scopeHash = hashNodeReadScope(RESOURCE, WORKTREE, relativePath);
  const admission: AgentModeAdmission = {
    task: { taskId: `task:${suffix}`, taskType: 'fixture.read', inputHash: `input:${suffix}`, createdAt: '2026-09-08T00:00:00.000Z' },
    run: { runId: `run:${suffix}`, taskId: `task:${suffix}`, agentId: 'agent:worker', createdAt: '2026-09-08T00:00:00.000Z' },
    attempt: {
      attemptId: `attempt:${suffix}`,
      runId: `run:${suffix}`,
      agentId: 'agent:worker',
      runtimeRef: 'runtime:fixture',
      routeRef: 'amazon-bedrock/agent-mode/glm-5',
      modelRef: 'agent-mode/glm-5',
      policyVersion: 'agent-mode-policy-v1',
      capabilityScopeHash: scopeHash,
      budgetScopeId: `budget:${suffix}`,
      createdAt: '2026-09-08T00:00:00.000Z',
    },
    budget: { budgetScopeId: `budget:${suffix}`, maxSteps: 5, maxTokens: 100, maxDollars: 1 },
    estimate: { reservationId: `reservation:${suffix}`, steps: 1, tokens: 10, dollars: 0.01 },
    lease: { leaseId: `lease:${suffix}`, resourceKey: `resource:${suffix}`, ownerId: 'node:fixture', expiresAt: EXPIRY },
    now: '2026-09-08T00:00:00.000Z',
  };
  store.admitAttempt(admission);
  const operationId = `operation:${suffix}`;
  store.prepareOperation({
    operationId,
    attemptId: admission.attempt.attemptId,
    effectKind: 'capability.read',
    capabilityId: operationCapability,
    grantId: GRANT,
    scopeHash,
    policyVersion: admission.attempt.policyVersion,
    leaseResourceKey: admission.lease.resourceKey,
    leaseId: admission.lease.leaseId,
    leaseFence: 1,
    deadline,
    preparedAt: NOW,
  });
  mkdirSync(path.join(root, 'nested'), { recursive: true });
  writeFileSync(path.join(root, 'nested', 'readme.txt'), 'bounded fixture read\n');
  const descriptor: BrainNodeDescriptor = {
    nodeId: `node:${suffix}`,
    resourceRef: `host:${suffix}`,
    protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
    capabilities: [{ capabilityId: BRAIN_NODE_READ_CAPABILITY, maxBytes: options.maxBytes ?? 256 }],
    bindings: [{ resourceId: RESOURCE, rootPath: root, worktreeId: WORKTREE }],
    platform: { os: options.platform ?? 'synthetic', arch: 'x64' },
    health: { state: 'available', checkedAt: NOW },
  };
  const command: BrainNodeCommand = {
    protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
    controllerRef: CONTROLLER,
    nodeId: descriptor.nodeId,
    taskId: admission.task.taskId,
    runId: admission.run.runId,
    attemptId: admission.attempt.attemptId,
    operationId,
    capabilityId: BRAIN_NODE_READ_CAPABILITY,
    resourceId: RESOURCE,
    worktreeId: WORKTREE,
    relativePath,
    scopeHash,
    grantId: GRANT,
    policyVersion: admission.attempt.policyVersion,
    lease: { resourceKey: admission.lease.resourceKey, leaseId: admission.lease.leaseId, fence: 1 },
    deadline,
    correlationId: `correlation:${suffix}`,
    causationId: `causation:${suffix}`,
    authProof: 'fixture-proof',
  };
  const node = new BrainNodeLocalPerimeter(
    descriptor,
    store,
    createFixtureAuthenticator({ controllerRef: CONTROLLER, nodeId: descriptor.nodeId, proof: 'fixture-proof' }),
    {
      readFile: async (filePath) => {
        reads.count += 1;
        reads.paths.push(filePath);
        return readFile(filePath);
      },
    },
  );
  try {
    await callback({ root, outside, store, node, command, admission, reads });
  } finally {
    try { store.close(); } catch { /* fixture may have closed/reopened it */ }
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}

test('happy path uses the portable envelope, canonical binding and durable K0.2 reconciliation', async () => {
  await withFixture(async ({ node, command, store, reads }) => {
    const first = await node.execute(command, NOW);
    assert.equal(first.status, 'succeeded');
    assert.equal(first.protocolVersion, BRAIN_NODE_PROTOCOL_VERSION);
    assert.equal(first.resultText, 'bounded fixture read\n');
    assert.equal(first.evidenceRef, `evidence:${first.resultHash}`);
    assert.equal(store.getReceipt(command.operationId)?.status, 'succeeded');
    assert.equal(store.getOutbox(command.operationId)?.state, 'receipt_recorded');
    assert.equal(reads.count, 1);
    const replay = await node.execute(command, LATER);
    assert.equal(replay.status, 'duplicate');
    assert.equal(replay.reconciliation, 'duplicate');
    assert.equal(reads.count, 1);
  });
});

test('the same perimeter works with synthetic macOS-shaped and Linux-shaped installations', async () => {
  const outputs: string[] = [];
  await withFixture(async ({ node, command }) => { outputs.push((await node.execute(command, NOW)).resultText ?? ''); }, { suffix: 'macos', platform: 'darwin' });
  await withFixture(async ({ node, command }) => { outputs.push((await node.execute(command, NOW)).resultText ?? ''); }, { suffix: 'linux', platform: 'linux' });
  assert.deepEqual(outputs, ['bounded fixture read\n', 'bounded fixture read\n']);
});

async function assertRejected(
  mutate: (command: BrainNodeCommand, fixture: Fixture) => void,
  expectedCode: string,
  options: Parameters<typeof withFixture>[1] = {},
): Promise<void> {
  await withFixture(async (fixture) => {
    const command = { ...fixture.command, lease: { ...fixture.command.lease } };
    mutate(command, fixture);
    const receipt = await fixture.node.execute(command, NOW);
    assert.equal(receipt.status, 'rejected');
    assert.equal(receipt.errorCode, expectedCode);
    assert.equal(fixture.reads.count, 0);
  }, options);
}

test('rejects malformed, unauthenticated, wrong-node and undeclared commands before capability reads', async () => {
  await assertRejected((command) => { command.protocolVersion = 'brain-node-v0'; }, 'unsupported_protocol', { suffix: 'bad-protocol' });
  await assertRejected((command) => { command.authProof = 'wrong'; }, 'invalid_provenance', { suffix: 'bad-auth' });
  await assertRejected((command) => { command.nodeId = 'node:other'; }, 'wrong_node', { suffix: 'wrong-node' });
  await assertRejected((command) => { command.capabilityId = 'repo.write'; }, 'capability_not_advertised', { suffix: 'undeclared' });
  await assertRejected((command) => { delete (command as Partial<BrainNodeCommand>).correlationId; }, 'invalid_command', { suffix: 'incomplete' });
});

test('rejects missing grants, resources, worktrees, scope and policy before reading', async () => {
  await assertRejected((command) => { command.capabilityId = 'repo.read'; }, 'capability_not_granted', { suffix: 'ungranted', operationCapability: 'repo.other' });
  await assertRejected((command) => { command.resourceId = 'repo:unknown'; }, 'unknown_resource', { suffix: 'unknown-resource' });
  await assertRejected((command) => { command.worktreeId = 'worktree:other'; }, 'resource_worktree_mismatch', { suffix: 'wrong-worktree' });
  await assertRejected((command) => { command.scopeHash = 'scope:wrong'; }, 'scope_mismatch', { suffix: 'wrong-scope' });
  await assertRejected((command) => { command.grantId = 'grant:stale'; }, 'grant_mismatch', { suffix: 'stale-grant' });
  await assertRejected((command) => { command.policyVersion = 'agent-mode-policy-old'; }, 'policy_mismatch', { suffix: 'stale-policy' });
});

test('rejects traversal and absolute path injection without lexical-prefix trust', async () => {
  await assertRejected((command) => { command.relativePath = '../secret.txt'; }, 'invalid_relative_path', { suffix: 'traversal' });
  await assertRejected((command) => { command.relativePath = '/tmp/secret.txt'; }, 'invalid_relative_path', { suffix: 'absolute' });
});

test('rejects symlink and nested symlink escapes after canonical realpath resolution', async () => {
  await withFixture(async (fixture) => {
    const outsideFile = path.join(fixture.outside, 'secret.txt');
    writeFileSync(outsideFile, 'secret');
    symlinkSync(outsideFile, path.join(fixture.root, 'nested', 'escape.txt'));
    const command = {
      ...fixture.command,
      relativePath: 'nested/escape.txt',
      scopeHash: hashNodeReadScope(RESOURCE, WORKTREE, 'nested/escape.txt'),
    };
    const receipt = await fixture.node.execute(command, NOW);
    assert.equal(receipt.errorCode, 'symlink_escape');
    assert.equal(fixture.reads.count, 0);
  }, { suffix: 'symlink', relativePath: 'nested/escape.txt' });

  await withFixture(async (fixture) => {
    const outsideDirectory = path.join(fixture.outside, 'nested-target');
    mkdirSync(outsideDirectory, { recursive: true });
    writeFileSync(path.join(outsideDirectory, 'secret.txt'), 'secret');
    symlinkSync(outsideDirectory, path.join(fixture.root, 'nested', 'linkdir'));
    const command = {
      ...fixture.command,
      relativePath: 'nested/linkdir/secret.txt',
      scopeHash: hashNodeReadScope(RESOURCE, WORKTREE, 'nested/linkdir/secret.txt'),
    };
    const receipt = await fixture.node.execute(command, NOW);
    assert.equal(receipt.errorCode, 'symlink_escape');
    assert.equal(fixture.reads.count, 0);
  }, { suffix: 'nested-symlink', relativePath: 'nested/linkdir/secret.txt' });
});

test('rejects expired deadlines and stale fences at the node itself', async () => {
  await assertRejected(() => {}, 'deadline_expired', { suffix: 'expired-deadline', deadline: '2026-09-08T00:01:00.000Z' });
  await withFixture(async (fixture) => {
    assert.equal(fixture.store.releaseLease(fixture.command.lease.resourceKey, fixture.command.lease.leaseId, 1), true);
    assert.equal(fixture.store.acquireLease({ leaseId: 'lease:new', resourceKey: fixture.command.lease.resourceKey, ownerId: 'node:new', expiresAt: EXPIRY })?.fence, 2);
    const receipt = await fixture.node.execute(fixture.command, NOW);
    assert.equal(receipt.errorCode, 'stale_lease_fence');
    assert.equal(receipt.observedFence, 1);
    assert.equal(fixture.reads.count, 0);
  }, { suffix: 'stale-fence' });
});

test('cancellation blocks preparation at the node and does not claim process termination', async () => {
  await withFixture(async (fixture) => {
    assert.equal(fixture.store.requestCancellation({ requestId: 'cancel:node', attemptId: fixture.command.attemptId, requestedAt: NOW }), 'created');
    const receipt = await fixture.node.execute(fixture.command, NOW);
    assert.equal(receipt.errorCode, 'cancellation_requested');
    assert.equal(fixture.store.getAttempt(fixture.command.attemptId)?.cancellationStatus, 'requested');
    assert.equal(fixture.reads.count, 0);
  }, { suffix: 'cancelled' });
});

test('conflicting duplicate commands and non-dispatchable outbox states fail closed', async () => {
  await assertRejected((command) => { command.relativePath = 'nested/other.txt'; }, 'scope_mismatch', { suffix: 'command-conflict' });
  await withFixture(async (fixture) => {
    fixture.store.markDispatched(fixture.command.operationId, NOW);
    fixture.store.markEffectObserved(fixture.command.operationId, NOW);
    const receipt = await fixture.node.execute(fixture.command, LATER);
    assert.equal(receipt.errorCode, 'outbox_not_dispatchable');
    assert.equal(fixture.reads.count, 0);
  }, { suffix: 'outbox-closed' });
});

test('bounded result size produces a failed durable receipt without writes or subprocesses', async () => {
  await withFixture(async (fixture) => {
    const receipt = await fixture.node.execute(fixture.command, NOW);
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.errorCode, 'result_too_large');
    assert.equal(fixture.store.getReceipt(fixture.command.operationId)?.status, 'failed');
    assert.equal(fixture.reads.count, 1);
  }, { suffix: 'bounded-output', maxBytes: 4 });
});
