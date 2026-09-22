import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { BRAIN_NODE_PROTOCOL_VERSION, BRAIN_NODE_READ_CAPABILITY, BrainNodeLocalPerimeter, brainNodeAuthProof, hashNodeReadScope, createHmacAuthenticator, type BrainNodeCommand, type BrainNodeDescriptor } from '../agent-mode/brain-node.js';
import { runBrainNodeRunner } from '../agent-mode/brain-node-runner.js';
import { descriptorFromNodeLocalConfig, type NodeLocalConfig, type SshNodeEnrollment } from '../agent-mode/node-enrollment.js';
import { LocalNodeTransport, NodeTransportError, SshNodeTransport, validateBrainNodeReceipt, type ProcessResult } from '../agent-mode/node-transport.js';
import { FileNodeDeduplicationStore } from '../agent-mode/node-deduplication-store.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-09T12:00:00.000Z';
const DEADLINE = '2026-09-09T12:05:00.000Z';
const SECRET = 'fixture-node-secret';
const MACBOOK_ENROLLMENT: SshNodeEnrollment = { resourceRef: 'host:macbook', nodeId: 'node-instance:host:macbook', transportRef: 'ssh:macbook', hostAlias: 'macbook', authRef: 'node-local-secret:brain-node' };

async function fixture(root: string, enrollment: SshNodeEnrollment = MACBOOK_ENROLLMENT, content = 'remote parity fixture\n'): Promise<{ store: AgentModeSqliteStateStore; descriptor: BrainNodeDescriptor; command: BrainNodeCommand; config: NodeLocalConfig }> {
  await writeFile(path.join(root, 'read.txt'), content);
  const store = new AgentModeSqliteStateStore(path.join(root, 'office-state.db'));
  const scopeHash = hashNodeReadScope(enrollment.resourceRef, undefined, 'read.txt');
  store.admitAttempt({
    task: { taskId: 'task:transport', taskType: 'transport.read', inputHash: 'input', createdAt: NOW },
    run: { runId: 'run:transport', taskId: 'task:transport', agentId: 'agent:worker', createdAt: NOW },
    attempt: { attemptId: 'attempt:transport', runId: 'run:transport', agentId: 'agent:worker', runtimeRef: 'runtime:fixture', routeRef: 'route:fixture', modelRef: 'model:fixture', policyVersion: 'policy:fixture', capabilityScopeHash: scopeHash, budgetScopeId: 'budget:transport', createdAt: NOW },
    budget: { budgetScopeId: 'budget:transport', maxSteps: 1, maxTokens: 0, maxDollars: 0 },
    estimate: { reservationId: 'reservation:transport', steps: 1, tokens: 0, dollars: 0 },
    lease: { leaseId: 'lease:transport', resourceKey: 'resource:transport', ownerId: 'agent:worker', expiresAt: DEADLINE },
    now: NOW,
  });
  store.prepareOperation({ operationId: 'operation:transport', attemptId: 'attempt:transport', effectKind: 'capability.read', capabilityId: BRAIN_NODE_READ_CAPABILITY, grantId: 'grant:transport', scopeHash, policyVersion: 'policy:fixture', leaseResourceKey: 'resource:transport', leaseId: 'lease:transport', leaseFence: 1, deadline: DEADLINE, preparedAt: NOW });
  const authInput = { protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, controllerRef: 'controller:fixture', nodeId: enrollment.nodeId, operationId: 'operation:transport', attemptId: 'attempt:transport', authProof: '' };
  const command: BrainNodeCommand = { ...authInput, taskId: 'task:transport', runId: 'run:transport', capabilityId: BRAIN_NODE_READ_CAPABILITY, resourceId: enrollment.resourceRef, relativePath: 'read.txt', scopeHash, grantId: 'grant:transport', policyVersion: 'policy:fixture', lease: { resourceKey: 'resource:transport', leaseId: 'lease:transport', fence: 1 }, deadline: DEADLINE, correlationId: 'correlation:transport', causationId: 'causation:transport', authProof: brainNodeAuthProof(authInput, SECRET) };
  const descriptor: BrainNodeDescriptor = { nodeId: enrollment.nodeId, resourceRef: enrollment.resourceRef, protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, runnerVersion: 'fixture-runner-v1', capabilities: [{ capabilityId: BRAIN_NODE_READ_CAPABILITY, maxBytes: 256, version: 'repo.read-v1' }], bindings: [{ resourceId: enrollment.resourceRef, rootPath: root }], platform: { os: 'Darwin', arch: 'arm64' }, health: { state: 'available', checkedAt: NOW } };
  const config: NodeLocalConfig = { nodeId: enrollment.nodeId, resourceRef: enrollment.resourceRef, protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, runnerVersion: 'fixture-runner-v1', authRef: enrollment.authRef, platform: descriptor.platform, capabilities: descriptor.capabilities, binding: descriptor.bindings[0]! };
  return { store, descriptor, command, config };
}

function mockProcess(config: NodeLocalConfig, options: { secret?: string; tamper?: (envelope: Record<string, unknown>) => Record<string, unknown>; disconnect?: boolean } = {}): { calls: Array<{ args: readonly string[]; input: string }>; run: (file: string, args: readonly string[], input: string, timeoutMs: number) => Promise<ProcessResult> } {
  const calls: Array<{ args: readonly string[]; input: string }> = [];
  return { calls, run: async (_file, args, input) => {
    calls.push({ args, input });
    if (options.disconnect) return { code: null, stdout: '', stderr: 'connection closed' };
    if (args.includes('--handshake')) return { code: 0, stdout: `${JSON.stringify(await runBrainNodeRunner('--handshake', config, options.secret ?? SECRET, NOW))}\n`, stderr: '' };
    const envelope = await runBrainNodeRunner('--execute', config, options.secret ?? SECRET, NOW, input);
    return { code: 0, stdout: `${JSON.stringify(options.tamper ? options.tamper(envelope) : envelope)}\n`, stderr: 'diagnostic only\n' };
  } };
}

test('LocalNodeTransport and SshNodeTransport execute the same BrainNode read contract', async () => {
  const root = await mkdtemp('/tmp/brain-node-transport-');
  const { store, descriptor, command, config } = await fixture(root);
  try {
    const local = new LocalNodeTransport(new BrainNodeLocalPerimeter(descriptor, store, createHmacAuthenticator(SECRET)), { clock: () => NOW });
    const localReceipt = await local.execute(command);
    assert.equal(localReceipt.status, 'succeeded');
    const mocked = mockProcess(config);
    const remote = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: mocked.run });
    const negotiated = await remote.negotiate();
    const remoteReceipt = await remote.execute(command);
    assert.equal(negotiated.resourceRef, 'host:macbook');
    assert.equal(remoteReceipt.status, 'succeeded');
    assert.equal(remoteReceipt.resultHash, localReceipt.resultHash);
    assert.equal(mocked.calls.length, 3);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('SSH transport uses fixed argv, stdin protocol bytes, and no shell interpolation', async () => {
  const root = await mkdtemp('/tmp/brain-node-transport-injection-');
  const { store, command, config } = await fixture(root);
  try {
    const mocked = mockProcess(config);
    const transport = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: mocked.run });
    const hostile = { ...command, relativePath: '$(touch /tmp/pwned);read.txt' };
    const result = await transport.execute(hostile);
    assert.equal(result.status, 'rejected');
    assert.equal(mocked.calls.some((call) => call.args.some((arg) => arg.includes('$') || arg.includes('touch'))), false);
    assert.equal(mocked.calls[1]!.input.includes('$(touch /tmp/pwned)'), true);
    assert.deepEqual(mocked.calls[1]!.args.slice(-2), ['~/.local/brain/node/brain-node-runner', '--execute']);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('SSH command authentication fails closed while SSH success alone is insufficient', async () => {
  const root = await mkdtemp('/tmp/brain-node-transport-auth-');
  const { store, command, config } = await fixture(root);
  try {
    const mocked = mockProcess(config, { secret: 'different-secret' });
    const transport = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: mocked.run });
    const receipt = await transport.execute(command);
    assert.equal(receipt.status, 'rejected');
    assert.equal(receipt.errorCode, 'invalid_provenance');
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('negotiation rejects wrong host, protocol/capability mismatch, stale health, malformed receipt, timeout, and disconnect', async () => {
  const root = await mkdtemp('/tmp/brain-node-transport-negative-');
  const { store, command, config, descriptor } = await fixture(root);
  try {
    const cases: Array<{ name: string; process: (file: string, args: readonly string[], input: string, timeoutMs: number) => Promise<ProcessResult>; kind: string }> = [
      { name: 'wrong node', process: async (_f, args) => ({ code: 0, stdout: `${JSON.stringify({ kind: 'brain-node-handshake', descriptor: { ...descriptor, nodeId: 'node-instance:wrong' } })}\n`, stderr: '' }), kind: 'protocol_rejected' },
      { name: 'protocol mismatch', process: async () => ({ code: 0, stdout: `${JSON.stringify({ kind: 'brain-node-handshake', protocolVersion: 'brain-node-v1', descriptor: { ...descriptor, protocolVersion: 'brain-node-v0' } })}\n`, stderr: '' }), kind: 'protocol_rejected' },
      { name: 'capability mismatch', process: async () => ({ code: 0, stdout: `${JSON.stringify({ kind: 'brain-node-handshake', protocolVersion: 'brain-node-v1', descriptor: { ...descriptor, capabilities: [] } })}\n`, stderr: '' }), kind: 'protocol_rejected' },
      { name: 'stale health', process: async () => ({ code: 0, stdout: `${JSON.stringify({ kind: 'brain-node-handshake', protocolVersion: 'brain-node-v1', descriptor: { ...descriptor, health: { state: 'available', checkedAt: '2026-09-09T11:00:00.000Z' } } })}\n`, stderr: '' }), kind: 'protocol_rejected' },
      { name: 'malformed handshake', process: async () => ({ code: 0, stdout: '{bad}\n', stderr: '' }), kind: 'invalid_receipt' },
      { name: 'timeout', process: async () => ({ code: null, stdout: '', stderr: 'transport timeout' }), kind: 'transport_disconnected' },
      { name: 'disconnect', process: async () => ({ code: null, stdout: '', stderr: '' }), kind: 'transport_disconnected' },
    ];
    for (const fixtureCase of cases) {
      const transport = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: fixtureCase.process });
      await assert.rejects(() => transport.negotiate(), (error: unknown) => error instanceof NodeTransportError && error.kind === fixtureCase.kind, fixtureCase.name);
    }
    assert.throws(() => new SshNodeTransport({ enrollment: { ...MACBOOK_ENROLLMENT, resourceRef: 'host:other' }, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: async () => ({ code: 0, stdout: '', stderr: '' }) }), /unknown infrastructure/);
    const malformedReceipt = mockProcess(config, { tamper: (envelope) => ({ ...envelope, receipt: { ...(envelope.receipt as object), operationId: 'operation:wrong' } }) });
    const transport = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: malformedReceipt.run });
    await assert.rejects(() => transport.execute(command), (error: unknown) => error instanceof NodeTransportError && error.kind === 'invalid_receipt');
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('unavailable node requires fresh negotiation and recovers when health becomes available', async () => {
  const root = await mkdtemp('/tmp/brain-node-health-recovery-');
  const { store, config, descriptor } = await fixture(root);
  let available = false;
  let handshakes = 0;
  try {
    const transport = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: async (_file, args) => {
      assert.equal(args.includes('--handshake'), true);
      handshakes += 1;
      const health = available ? descriptor.health : { state: 'unavailable' as const, checkedAt: NOW };
      return { code: 0, stdout: `${JSON.stringify({ kind: 'brain-node-handshake', protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, descriptor: { ...descriptor, health } })}\n`, stderr: '', sent: false };
    } });
    await assert.rejects(() => transport.negotiate(), (error: unknown) => error instanceof NodeTransportError && error.kind === 'protocol_rejected');
    available = true;
    const recovered = await transport.reconnect();
    assert.equal(recovered.nodeId, descriptor.nodeId);
    assert.equal(handshakes, 2);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('duplicate and stale receipts remain StateStore concerns, while transport disconnect stays nonterminal', async () => {
  const root = await mkdtemp('/tmp/brain-node-transport-receipts-');
  const { store, command, config } = await fixture(root);
  try {
    const mocked = mockProcess(config);
    const transport = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: mocked.run });
    const receipt = await transport.execute(command);
    const durable = { operationId: receipt.operationId, attemptId: receipt.attemptId, scopeHash: receipt.scopeHash, effectHash: receipt.effectHash!, status: 'succeeded' as const, recordedAt: receipt.endedAt };
    assert.equal(store.recordReceipt(durable), 'recorded');
    assert.equal(store.recordReceipt(durable), 'duplicate');
    assert.throws(() => validateBrainNodeReceipt({ ...command, operationId: 'operation:other' }, receipt, descriptorFromNodeLocalConfig(config, new Set(['host:macbook', 'host:office'])).nodeId), /lineage/);
    const disconnected = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:office', 'host:macbook']), authSecret: SECRET, clock: () => NOW, runProcess: mockProcess(config, { disconnect: true }).run });
    await assert.rejects(() => disconnected.execute(command), (error: unknown) => error instanceof NodeTransportError && error.kind === 'transport_disconnected');
    assert.equal(store.getReceipt(command.operationId)?.operationId, command.operationId);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('delivery states distinguish before-send failure from sent-but-unreconciled work', async () => {
  const root = await mkdtemp('/tmp/brain-node-delivery-state-');
  const { store, command, config } = await fixture(root);
  try {
    const handshake = `${JSON.stringify(await runBrainNodeRunner('--handshake', config, SECRET, NOW))}\n`;
    const beforeSend = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:macbook']), authSecret: SECRET, clock: () => NOW, stateStore: store, runProcess: async (_file, args) => {
      if (args.includes('--handshake')) return { code: 0, stdout: handshake, stderr: '', sent: false };
      throw new Error('SSH process did not start');
    } });
    await assert.rejects(() => beforeSend.execute(command), (error: unknown) => error instanceof NodeTransportError && error.kind === 'transport_disconnected' && error.deliveryState === 'not_sent');
    assert.equal(store.getOutbox(command.operationId)?.state, 'dispatchable');

    let remoteExecuted = false;
    const afterSend = new SshNodeTransport({ enrollment: MACBOOK_ENROLLMENT, knownResourceRefs: new Set(['host:macbook']), authSecret: SECRET, clock: () => NOW, stateStore: store, runProcess: async (_file, args) => {
      if (args.includes('--handshake')) return { code: 0, stdout: handshake, stderr: '', sent: false };
      remoteExecuted = true;
      return { code: null, stdout: '', stderr: 'connection closed', sent: true };
    } });
    await assert.rejects(() => afterSend.execute(command), (error: unknown) => error instanceof NodeTransportError && error.kind === 'transport_disconnected' && error.deliveryState === 'sent_receipt_unknown');
    assert.equal(store.getEffect(command.operationId)?.status, 'effect_applied');
    assert.equal(store.getOutbox(command.operationId)?.state, 'effect_applied');
    assert.equal(remoteExecuted, true);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('node enrollment reuses canonical infrastructure resources and exactly repo.read', async () => {
  const root = await mkdtemp('/tmp/brain-node-enrollment-');
  const { store, config } = await fixture(root);
  try {
    const descriptor = descriptorFromNodeLocalConfig(config, new Set(['host:office', 'host:macbook']));
    assert.equal(descriptor.resourceRef, 'host:macbook');
    assert.equal(descriptor.capabilities.map((capability) => capability.capabilityId).join(','), 'repo.read');
    assert.throws(() => descriptorFromNodeLocalConfig({ ...config, resourceRef: 'host:unknown' }, new Set(['host:office', 'host:macbook'])), /unknown infrastructure/);
    assert.throws(() => descriptorFromNodeLocalConfig({ ...config, capabilities: [{ capabilityId: 'repo.read', maxBytes: 1 }, { capabilityId: 'repo.read', maxBytes: 1 }] }, new Set(['host:macbook'])), /exactly repo.read/);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('generic synthetic macOS and Linux enrollments use the same transport and node code', async () => {
  const enrollments: Array<{ enrollment: SshNodeEnrollment; platform: { os: string; arch: string } }> = [
    { enrollment: { resourceRef: 'host:laptop-example', nodeId: 'node-instance:laptop-example', transportRef: 'ssh:laptop-example', hostAlias: 'laptop-example', authRef: 'credential-ref:laptop-example' }, platform: { os: 'Darwin', arch: 'arm64' } },
    { enrollment: { resourceRef: 'host:server-example', nodeId: 'node-instance:server-example', transportRef: 'ssh:server-example', hostAlias: 'server-example', authRef: 'credential-ref:server-example' }, platform: { os: 'Linux', arch: 'x64' } },
  ];
  for (const [index, entry] of enrollments.entries()) {
    const root = await mkdtemp(`/tmp/brain-node-portable-${index}-`);
    const { store, descriptor, command, config } = await fixture(root, entry.enrollment, 'N0_2_MULTI_NODE_PASS\n');
    const portableDescriptor = { ...descriptor, platform: entry.platform };
    try {
      const local = new LocalNodeTransport(new BrainNodeLocalPerimeter(portableDescriptor, store, createHmacAuthenticator(SECRET)), { clock: () => NOW });
      const localReceipt = await local.execute(command);
      const mocked = mockProcess({ ...config, platform: entry.platform });
      const remote = new SshNodeTransport({ enrollment: entry.enrollment, knownResourceRefs: new Set([entry.enrollment.resourceRef]), authSecret: SECRET, clock: () => NOW, runProcess: mocked.run });
      const remoteReceipt = await remote.execute(command);
      assert.equal(localReceipt.resultText, 'N0_2_MULTI_NODE_PASS\n');
      assert.equal(remoteReceipt.resultText, localReceipt.resultText);
      assert.equal(remoteReceipt.nodeId, entry.enrollment.nodeId);
      assert.equal(remote.transportRef, entry.enrollment.transportRef);
    } finally { store.close(); await rm(root, { recursive: true, force: true }); }
  }
});

test('SSH transport requires explicit enrollment and never assumes a personal host', () => {
  assert.throws(() => new SshNodeTransport({ knownResourceRefs: new Set(['host:macbook']), authSecret: SECRET } as never), /explicit enrollment/);
});

function spawnRunnerProcess(configPath: string, command: BrainNodeCommand): Promise<Record<string, unknown>> {
  const runnerPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../dist/agent-mode/brain-node-runner.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath, '--execute'], { env: { ...process.env, BRAIN_NODE_CONFIG: configPath, BRAIN_NODE_AUTH_SECRET: SECRET }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error(`runner process failed: ${stderr}`));
      try { resolve(JSON.parse(stdout.trim()) as Record<string, unknown>); } catch (error) { reject(error); }
    });
    child.stdin.end(`${JSON.stringify(command)}\n`);
  });
}

test('separate short-lived runner processes deduplicate identical delivery and reject conflicts', async () => {
  const root = await mkdtemp('/tmp/brain-node-cross-process-');
  const { store, command, config } = await fixture(root, MACBOOK_ENROLLMENT, 'N0_2_MULTI_NODE_PASS\n');
  const configPath = path.join(root, 'node.json');
  const dedupPath = path.join(root, 'dedup.json');
  await writeFile(configPath, JSON.stringify({ ...config, dedupPath }));
  try {
    const runtimeCommand = { ...command, deadline: new Date(Date.now() + 120_000).toISOString() };
    const first = await spawnRunnerProcess(configPath, runtimeCommand);
    const persistedDedupState = await readFile(dedupPath, 'utf8');
    assert.match(persistedDedupState, /operation:transport/);
    const second = await spawnRunnerProcess(configPath, runtimeCommand);
    assert.equal((first.receipt as Record<string, unknown>).status, 'succeeded');
    assert.equal((second.receipt as Record<string, unknown>).status, 'duplicate', `persisted=${persistedDedupState} second=${JSON.stringify(second)}`);
    const conflicting = { ...runtimeCommand, relativePath: 'other.txt', scopeHash: hashNodeReadScope(command.resourceId, command.worktreeId, 'other.txt') };
    const conflict = await spawnRunnerProcess(configPath, conflicting);
    assert.equal((conflict.receipt as Record<string, unknown>).status, 'rejected');
    assert.equal((conflict.receipt as Record<string, unknown>).errorCode, 'operation_conflict');
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('node-local deduplication corruption fails closed and retention is bounded', async () => {
  const root = await mkdtemp('/tmp/brain-node-dedup-corruption-');
  const dedupPath = path.join(root, 'dedup.json');
  try {
    await writeFile(dedupPath, '{not-json}\n');
    const deduplication = new FileNodeDeduplicationStore(dedupPath);
    await assert.rejects(() => deduplication.lookup('operation:corrupt', NOW), /corrupt/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
