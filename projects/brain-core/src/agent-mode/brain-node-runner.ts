import { homedir } from 'node:os';
import path from 'node:path';
import { BrainNodeLocalPerimeter, createHmacAuthenticator, type BrainNodeCommand, type BrainNodeDescriptor, type BrainNodeReceipt } from './brain-node.js';
import { descriptorFromNodeLocalConfig, type NodeLocalConfig } from './node-enrollment.js';
import { FileNodeDeduplicationStore } from './node-deduplication-store.js';
import { AgentModeSqliteStateStore } from './sqlite-state-store.js';

const MAX_INPUT_BYTES = 1_048_576;

function fallbackReceipt(descriptor: BrainNodeDescriptor, now: string): BrainNodeReceipt {
  return { protocolVersion: descriptor.protocolVersion, nodeId: descriptor.nodeId, operationId: 'unknown', attemptId: 'unknown', capabilityId: 'unknown', scopeHash: 'unknown', observedFence: null, status: 'rejected', startedAt: now, endedAt: now, errorCode: 'invalid_command' };
}

async function readStdin(): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (Buffer.byteLength(input) > MAX_INPUT_BYTES) throw new Error('protocol input too large');
  }
  return input;
}

function parseOneCommand(input: string): BrainNodeCommand | undefined {
  const lines = input.trim().split('\n').filter(Boolean);
  if (lines.length !== 1) return undefined;
  try {
    const value = JSON.parse(lines[0]!) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as BrainNodeCommand : undefined;
  } catch { return undefined; }
}

function seedCommandContext(store: AgentModeSqliteStateStore, command: BrainNodeCommand, descriptor: BrainNodeDescriptor, now: string): void {
  store.admitAttempt({
    task: { taskId: command.taskId, taskType: 'remote-node.ephemeral', inputHash: 'remote-command', createdAt: now },
    run: { runId: command.runId, taskId: command.taskId, agentId: descriptor.nodeId, createdAt: now },
    attempt: { attemptId: command.attemptId, runId: command.runId, agentId: descriptor.nodeId, runtimeRef: 'runtime:remote-node-runner', routeRef: 'node-transport', modelRef: 'node-transport', policyVersion: command.policyVersion, capabilityScopeHash: command.scopeHash, budgetScopeId: `ephemeral:${command.attemptId}`, createdAt: now },
    budget: { budgetScopeId: `ephemeral:${command.attemptId}`, maxSteps: 1, maxTokens: 0, maxDollars: 0 },
    estimate: { reservationId: `ephemeral:${command.attemptId}`, steps: 1, tokens: 0, dollars: 0 },
    lease: { leaseId: command.lease.leaseId, resourceKey: command.lease.resourceKey, ownerId: descriptor.nodeId, expiresAt: command.deadline },
    now,
  });
  store.prepareOperation({ operationId: command.operationId, attemptId: command.attemptId, effectKind: 'capability.read', capabilityId: command.capabilityId, grantId: command.grantId, scopeHash: command.scopeHash, policyVersion: command.policyVersion, leaseResourceKey: command.lease.resourceKey, leaseId: command.lease.leaseId, leaseFence: command.lease.fence, deadline: command.deadline, preparedAt: now });
}

export async function executeBrainNodeCommand(command: BrainNodeCommand, descriptor: BrainNodeDescriptor, authSecret: string, now = new Date().toISOString(), deduplication?: FileNodeDeduplicationStore): Promise<BrainNodeReceipt> {
  const store = new AgentModeSqliteStateStore(':memory:');
  try {
    const node = new BrainNodeLocalPerimeter(descriptor, store, createHmacAuthenticator(authSecret), undefined, deduplication);
    if (!command || typeof command !== 'object' || !command.taskId || !command.runId || !command.attemptId || !command.operationId || !command.lease) return node.execute(command, now);
    try {
      seedCommandContext(store, command, descriptor, now);
    } catch {
      return await node.execute(command, now);
    }
    return await node.execute(command, now);
  } finally {
    store.close();
  }
}

export async function runBrainNodeRunner(mode: '--handshake' | '--execute', config: NodeLocalConfig, authSecret: string | undefined, now = new Date().toISOString(), input?: string): Promise<Record<string, unknown>> {
  const trustedLocalResourceRefs = new Set([config.resourceRef]);
  const descriptor = descriptorFromNodeLocalConfig(config, trustedLocalResourceRefs, now);
  const executionConfig = { ...config, binding: { ...config.binding, rootPath: config.binding.rootPath.startsWith('~/') ? path.join(homedir(), config.binding.rootPath.slice(2)) : config.binding.rootPath }, ...(config.dedupPath ? { dedupPath: config.dedupPath.startsWith('~/') ? path.join(homedir(), config.dedupPath.slice(2)) : config.dedupPath } : {}) };
  const executionDescriptor = descriptorFromNodeLocalConfig(executionConfig, trustedLocalResourceRefs, now);
  if (mode === '--handshake') return { kind: 'brain-node-handshake', protocolVersion: descriptor.protocolVersion, descriptor };
  const command = parseOneCommand(input ?? await readStdin());
  const deduplication = executionConfig.dedupPath ? new FileNodeDeduplicationStore(executionConfig.dedupPath) : undefined;
  const receipt = command && authSecret ? await executeBrainNodeCommand(command, executionDescriptor, authSecret, now, deduplication) : fallbackReceipt(descriptor, now);
  return { kind: 'brain-node-receipt', protocolVersion: descriptor.protocolVersion, receipt };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--handshake', '--execute'].includes(args[0]!)) { process.stderr.write('invalid BrainNode runner mode\n'); process.exitCode = 2; return; }
  const configPath = process.env.BRAIN_NODE_CONFIG ?? path.join(homedir(), '.local', 'brain', 'node', 'node.json');
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(configPath, 'utf8')) as NodeLocalConfig;
  const output = await runBrainNodeRunner(args[0] as '--handshake' | '--execute', config, process.env.BRAIN_NODE_AUTH_SECRET);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
