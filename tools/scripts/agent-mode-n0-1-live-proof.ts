import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brainNodeAuthProof, hashNodeReadScope } from '../../projects/brain-core/src/agent-mode/brain-node.js';
import { createSshNodeTransport } from '../../projects/brain-core/src/agent-mode/node-transport.js';
import { AgentModeSqliteStateStore } from '../../projects/brain-core/src/agent-mode/sqlite-state-store.js';

async function main(): Promise<void> {
const secret = process.env.BRAIN_N0_NODE_SECRET;
if (!secret) throw new Error('BRAIN_N0_NODE_SECRET is required');

const catalogPath = fileURLToPath(new URL('../../operations/infrastructure/catalog/assets.v1.json', import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as { resources?: Array<{ resourceId?: string }> };
const knownResourceRefs = new Set((catalog.resources ?? []).flatMap((resource) => resource.resourceId ? [resource.resourceId] : []));
const nodeConfigPath = fileURLToPath(new URL('../../operations/fixtures/agent-mode-n0-1-macbook-node.json', import.meta.url));
const nodeConfig = JSON.parse(await readFile(nodeConfigPath, 'utf8')) as { resourceRef: string; nodeId: string; transportRef: string; hostAlias: string; authRef: string };
const enrollment = { resourceRef: nodeConfig.resourceRef, nodeId: nodeConfig.nodeId, transportRef: nodeConfig.transportRef, hostAlias: nodeConfig.hostAlias, authRef: nodeConfig.authRef };

const now = new Date();
const nowIso = now.toISOString();
const deadline = new Date(now.getTime() + 120_000).toISOString();
const root = await mkdtemp(path.join(tmpdir(), 'brain-agent-n0-1-office-'));
const databasePath = path.join(root, 'agent-mode.db');
const store = new AgentModeSqliteStateStore(databasePath);
const relativePath = 'n0-1-marker.txt';
const scopeHash = hashNodeReadScope('host:macbook', undefined, relativePath);
const authInput = { protocolVersion: 'brain-node-v1', controllerRef: 'controller:office', nodeId: 'node-instance:host:macbook', operationId: 'operation:n0-1-live-read', attemptId: 'attempt:n0-1-live-read', authProof: '' };
const command = {
  ...authInput,
  taskId: 'task:n0-1-live-read',
  runId: 'run:n0-1-live-read',
  capabilityId: 'repo.read',
  resourceId: 'host:macbook',
  relativePath,
  scopeHash,
  grantId: 'grant:n0-1-live-read',
  policyVersion: 'agent-mode-n0-1',
  lease: { resourceKey: 'resource:n0-1-live-read', leaseId: 'lease:n0-1-live-read', fence: 1 },
  deadline,
  correlationId: 'correlation:n0-1-live-read',
  causationId: 'causation:n0-1-live-read',
  authProof: brainNodeAuthProof(authInput, secret),
};

store.admitAttempt({
  task: { taskId: command.taskId, taskType: 'agent-mode.n0-1.remote-read', inputHash: 'n0-1-fixture', createdAt: nowIso },
  run: { runId: command.runId, taskId: command.taskId, agentId: 'agent:worker-n0-1', createdAt: nowIso },
  attempt: { attemptId: command.attemptId, runId: command.runId, agentId: 'agent:worker-n0-1', runtimeRef: 'runtime:ssh-node-transport', routeRef: 'node:ssh:macbook', modelRef: 'none', policyVersion: command.policyVersion, capabilityScopeHash: scopeHash, budgetScopeId: 'budget:n0-1', createdAt: nowIso },
  budget: { budgetScopeId: 'budget:n0-1', maxSteps: 1, maxTokens: 0, maxDollars: 0 },
  estimate: { reservationId: 'reservation:n0-1', steps: 1, tokens: 0, dollars: 0 },
  lease: { leaseId: command.lease.leaseId, resourceKey: command.lease.resourceKey, ownerId: 'agent:worker-n0-1', expiresAt: deadline },
  now: nowIso,
});
store.prepareOperation({ operationId: command.operationId, attemptId: command.attemptId, effectKind: 'capability.read', capabilityId: command.capabilityId, grantId: command.grantId, scopeHash, policyVersion: command.policyVersion, leaseResourceKey: command.lease.resourceKey, leaseId: command.lease.leaseId, leaseFence: command.lease.fence, deadline, preparedAt: nowIso });

const transport = createSshNodeTransport({ enrollment, knownResourceRefs, authSecret: secret });
const started = Date.now();
const descriptor = await transport.negotiate();
const receipt = await transport.execute(command);
const latencyMs = Date.now() - started;
if (receipt.status !== 'succeeded' || receipt.resultText !== 'N0_1_REMOTE_READ_PASS\n') throw new Error(`unexpected remote receipt: ${receipt.status}/${receipt.errorCode ?? 'no-error'}`);
store.recordReceipt({ operationId: receipt.operationId, attemptId: receipt.attemptId, scopeHash: receipt.scopeHash, effectHash: receipt.effectHash!, status: 'succeeded', recordedAt: receipt.endedAt });
const durable = store.getReceipt(command.operationId);
if (!durable) throw new Error('Office StateStore did not reconcile remote receipt');
process.stdout.write(`${JSON.stringify({ status: 'PASS', nodeResourceRef: descriptor.resourceRef, nodeId: descriptor.nodeId, protocolVersion: descriptor.protocolVersion, runnerVersion: descriptor.runnerVersion, transport: transport.transportRef, capability: command.capabilityId, operationId: receipt.operationId, attemptId: receipt.attemptId, receiptStatus: receipt.status, resultHash: receipt.resultHash, latencyMs, officeStateStoreReconciled: true, reconnectCleanup: 'short-lived-runner-exited' }, null, 2)}\n`);
store.close();
await rm(root, { recursive: true, force: true });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
