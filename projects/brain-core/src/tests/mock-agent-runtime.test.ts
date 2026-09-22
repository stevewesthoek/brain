import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  BRAIN_NODE_PROTOCOL_VERSION,
  BRAIN_NODE_READ_CAPABILITY,
  BrainNodeLocalPerimeter,
  createFixtureAuthenticator,
  hashNodeReadScope,
} from '../agent-mode/brain-node.js';
import { MockAgentRuntime, runMockAgentAttempt, type MockRuntimeIntent } from '../agent-mode/mock-agent-runtime.js';
import { AgentModeSqliteStateStore, type AgentModeAdmission } from '../agent-mode/sqlite-state-store.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';

const NOW = '2026-09-08T00:01:00.000Z';
const EXPIRY = '2099-09-09T00:00:00.000Z';
const DEADLINE = '2099-09-10T00:00:00.000Z';

async function withRuntimeFixture(
  callback: (input: {
    root: string;
    dbPath: string;
    store: AgentModeSqliteStateStore;
    run: (runtime: MockAgentRuntime, overrides?: Partial<Parameters<typeof runMockAgentAttempt>[0]>) => ReturnType<typeof runMockAgentAttempt>;
    reads: { count: number };
    attemptId: string;
  }) => Promise<void>,
  intent: MockRuntimeIntent = { kind: 'repo.read', relativePath: 'nested/readme.txt' },
  runtimeOverrides: Partial<ConstructorParameters<typeof MockAgentRuntime>[0]> = {},
): Promise<void> {
  const root = mkdtempSync(path.join('/tmp', 'brain-k0-4-runtime-'));
  const dbPath = path.join(root, 'state', 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(dbPath);
  const attemptId = 'attempt:k0-4';
  const scopeHash = hashNodeReadScope('repo:fixture', 'worktree:fixture', 'nested/readme.txt');
  const admission: AgentModeAdmission = {
    task: { taskId: 'task:k0-4', taskType: 'fixture.read', inputHash: 'input:k0-4', createdAt: '2026-09-08T00:00:00.000Z' },
    run: { runId: 'run:k0-4', taskId: 'task:k0-4', agentId: 'agent:worker', createdAt: '2026-09-08T00:00:00.000Z' },
    attempt: {
      attemptId,
      runId: 'run:k0-4',
      agentId: 'agent:worker',
      runtimeRef: 'runtime:mock-k0-4',
      routeRef: 'route:fixture',
      modelRef: 'model:fixture',
      policyVersion: 'policy:k0-4',
      capabilityScopeHash: scopeHash,
      budgetScopeId: 'budget:k0-4',
      createdAt: '2026-09-08T00:00:00.000Z',
    },
    budget: { budgetScopeId: 'budget:k0-4', maxSteps: 5, maxTokens: 100, maxDollars: 1 },
    estimate: { reservationId: 'reservation:k0-4', steps: 1, tokens: 10, dollars: 0.01 },
    lease: { leaseId: 'lease:k0-4', resourceKey: 'resource:k0-4', ownerId: 'node:k0-4', expiresAt: EXPIRY },
    now: '2026-09-08T00:00:00.000Z',
  };
  store.upsertAgent({ agentId: 'agent:worker', agentKind: 'worker', role: 'fixture-worker', displayName: 'K0.4 Worker', policyId: 'policy:k0-4', status: 'active' });
  store.upsertAgent({ agentId: 'agent:jarvis', agentKind: 'jarvis', role: 'fixture-executive', displayName: 'K0.4 Jarvis', policyId: 'policy:k0-4', status: 'active' });
  store.admitAttempt(admission);
  mkdirSync(path.join(root, 'nested'), { recursive: true });
  writeFileSync(path.join(root, 'nested', 'readme.txt'), 'K0.4 durable fixture\n');
  const reads = { count: 0 };
  const node = new BrainNodeLocalPerimeter(
    {
      nodeId: 'node:k0-4', resourceRef: 'host:k0-4', protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
      capabilities: [{ capabilityId: BRAIN_NODE_READ_CAPABILITY, maxBytes: 256 }],
      bindings: [{ resourceId: 'repo:fixture', rootPath: root, worktreeId: 'worktree:fixture' }],
      platform: { os: 'synthetic', arch: 'x64' }, health: { state: 'available', checkedAt: NOW },
    },
    store,
    createFixtureAuthenticator({ controllerRef: 'controller:k0-4', nodeId: 'node:k0-4', proof: 'proof:k0-4' }),
    { readFile: async (filePath) => { reads.count += 1; return readFile(filePath); } },
  );
  const run = (runtime: MockAgentRuntime, overrides: Partial<Parameters<typeof runMockAgentAttempt>[0]> = {}) => runMockAgentAttempt({
    store, node, runtime, attemptId, operationId: 'operation:k0-4', resourceId: 'repo:fixture', worktreeId: 'worktree:fixture',
    grantId: 'grant:repo-read', controllerRef: 'controller:k0-4', authProof: 'proof:k0-4', deadline: DEADLINE,
    lease: { resourceKey: 'resource:k0-4', leaseId: 'lease:k0-4', fence: 1 }, correlationId: 'correlation:k0-4', causationId: 'causation:k0-4', now: NOW,
    ...overrides,
  });
  try {
    await callback({ root, dbPath, store, run, reads, attemptId });
  } finally {
    try { store.close(); } catch { /* closed by a reopen fixture */ }
    rmSync(root, { recursive: true, force: true });
  }
}

test('mock runtime completes one admitted attempt through Node and durable observer state', async () => {
  await withRuntimeFixture(async ({ store, run, dbPath, attemptId, reads }) => {
    const result = await run(new MockAgentRuntime({
      runtimeRef: 'runtime:mock-k0-4', routeRef: 'route:fixture', modelRef: 'model:fixture',
      modelResult: { kind: 'typed-fixture-result', traceId: 'trace:k0-4', intent: { kind: 'repo.read', relativePath: 'nested/readme.txt' } },
    }));
    assert.equal(result.status, 'succeeded');
    assert.equal(result.receipt?.status, 'succeeded');
    assert.equal(reads.count, 1);
    assert.equal(store.getAttempt(attemptId)?.status, 'completed');
    assert.equal(store.getOutbox('operation:k0-4')?.state, 'verified');
    store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(dbPath);
    assert.ok(reopened);
    assert.equal(reopened.getAttempt(attemptId)?.status, 'completed');
    reopened.close();
    const projection = readAgentModeObserver(NOW, dbPath);
    assert.equal(projection.availability, 'available');
    assert.equal(projection.summary.executionSource, 'agent-mode-state-store');
    assert.equal(projection.summary.agentCount, 2);
    assert.equal(projection.attempts[0]?.attemptId, attemptId);
    assert.equal(projection.attempts[0]?.status, 'completed');
    assert.equal(projection.operations[0]?.state, 'verified');
    assert.equal(projection.operations[0]?.evidenceRef, 'evidence:'.concat(String(result.receipt?.resultHash)));
    assert.equal(projection.events.filter((event) => event.eventType === 'operation_verified').length, 1);
  });
});

test('runtime bypass intents fail closed before Node or durable capability preparation', async () => {
  const cases: Array<[string, MockRuntimeIntent]> = [
    ['ungranted', { kind: 'ungranted-capability', capabilityId: 'repo.write', relativePath: 'nested/readme.txt' }],
    ['auxiliary', { kind: 'auxiliary-model', routeRef: 'route:other' }],
    ['second-operation', { kind: 'second-operation', relativePath: 'nested/readme.txt' }],
    ['shell', { kind: 'shell', command: 'cat /etc/passwd' }],
    ['absolute-path', { kind: 'absolute-path', path: '/etc/passwd' }],
    ['no-outbox', { kind: 'no-outbox', relativePath: 'nested/readme.txt' }],
  ];
  for (const [suffix, bypassIntent] of cases) {
    await withRuntimeFixture(async ({ store, run, reads }) => {
      const result = await run(new MockAgentRuntime({
        runtimeRef: 'runtime:mock-k0-4', routeRef: 'route:fixture', modelRef: 'model:fixture',
        modelResult: { kind: 'typed-fixture-result', traceId: `trace:${suffix}`, intent: bypassIntent },
      }));
      assert.equal(result.status, 'rejected');
      assert.equal(reads.count, 0);
      assert.equal(store.getOutbox('operation:k0-4'), undefined);
    });
  }
  await withRuntimeFixture(async ({ run, reads }) => {
    const result = await run(new MockAgentRuntime({
      runtimeRef: 'runtime:mock-k0-4', routeRef: 'route:other', modelRef: 'model:fixture',
      modelResult: { kind: 'typed-fixture-result', traceId: 'trace:route', intent: { kind: 'repo.read', relativePath: 'nested/readme.txt' } },
    }));
    assert.equal(result.denialCode, 'route_not_admitted');
    assert.equal(reads.count, 0);
  });
});

test('stale fence and cancellation are enforced at the integration boundary', async () => {
  await withRuntimeFixture(async ({ store, run, reads }) => {
    assert.equal(store.releaseLease('resource:k0-4', 'lease:k0-4', 1), true);
    assert.equal(store.acquireLease({ leaseId: 'lease:new', resourceKey: 'resource:k0-4', ownerId: 'node:new', expiresAt: EXPIRY })?.fence, 2);
    const result = await run(new MockAgentRuntime({ runtimeRef: 'runtime:mock-k0-4', routeRef: 'route:fixture', modelRef: 'model:fixture', modelResult: { kind: 'typed-fixture-result', traceId: 'trace:stale', intent: { kind: 'repo.read', relativePath: 'nested/readme.txt' } } }));
    assert.equal(result.denialCode, 'stale_lease_fence');
    assert.equal(reads.count, 0);
  });
  await withRuntimeFixture(async ({ store, run, reads, attemptId }) => {
    store.requestCancellation({ requestId: 'cancel:k0-4', attemptId, requestedAt: NOW });
    const result = await run(new MockAgentRuntime({ runtimeRef: 'runtime:mock-k0-4', routeRef: 'route:fixture', modelRef: 'model:fixture', modelResult: { kind: 'typed-fixture-result', traceId: 'trace:cancel', intent: { kind: 'repo.read', relativePath: 'nested/readme.txt' } } }));
    assert.equal(result.denialCode, 'cancellation_requested');
    assert.equal(reads.count, 0);
  });
});

test('runtime crash after durable preparation recovers from StateStore after reopen', async () => {
  await withRuntimeFixture(async ({ run, store, dbPath, attemptId }) => {
    const result = await run(new MockAgentRuntime({
      runtimeRef: 'runtime:mock-k0-4', routeRef: 'route:fixture', modelRef: 'model:fixture', crashAfterDurableOperation: true,
      modelResult: { kind: 'typed-fixture-result', traceId: 'trace:crash', intent: { kind: 'repo.read', relativePath: 'nested/readme.txt' } },
    }));
    assert.equal(result.status, 'crashed');
    assert.equal(result.recovery, 'safe_to_resume');
    assert.equal(store.getOutbox('operation:k0-4')?.state, 'dispatchable');
    store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(dbPath);
    assert.ok(reopened);
    assert.equal(reopened.classifyRecovery(attemptId, NOW), 'safe_to_resume');
    reopened.close();
  });
});
