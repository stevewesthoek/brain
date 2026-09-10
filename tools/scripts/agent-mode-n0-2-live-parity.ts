import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brainNodeAuthProof, hashNodeReadScope, BrainNodeLocalPerimeter, createHmacAuthenticator, type BrainNodeCommand, type BrainNodeDescriptor } from '../../projects/brain-core/src/agent-mode/brain-node.js';
import { createSshNodeTransport, LocalNodeTransport } from '../../projects/brain-core/src/agent-mode/node-transport.js';
import type { NodeLocalConfig, SshNodeEnrollment } from '../../projects/brain-core/src/agent-mode/node-enrollment.js';
import { AgentModeSqliteStateStore } from '../../projects/brain-core/src/agent-mode/sqlite-state-store.js';

const MARKER = 'N0_2_MULTI_NODE_PASS\n';
const OFFICE_SECRET = 'office-local-parity-fixture-secret';

type NodeFixture = NodeLocalConfig & { transportRef: string; hostAlias: string };

function makeCommand(resourceRef: string, nodeId: string, operationId: string, attemptId: string, secret: string, now: string, deadline: string): BrainNodeCommand {
  const scopeHash = hashNodeReadScope(resourceRef, undefined, 'n0-2-marker.txt');
  const authInput = { protocolVersion: 'brain-node-v1', controllerRef: 'controller:office', nodeId, operationId, attemptId, authProof: '' };
  return {
    ...authInput,
    taskId: `task:${operationId}`,
    runId: `run:${operationId}`,
    capabilityId: 'repo.read',
    resourceId: resourceRef,
    relativePath: 'n0-2-marker.txt',
    scopeHash,
    grantId: `grant:${operationId}`,
    policyVersion: 'agent-mode-n0-2',
    lease: { resourceKey: `resource:${operationId}`, leaseId: `lease:${operationId}`, fence: 1 },
    deadline,
    correlationId: `correlation:${operationId}`,
    causationId: `causation:${operationId}`,
    authProof: brainNodeAuthProof(authInput, secret),
  };
}

function admit(store: AgentModeSqliteStateStore, command: BrainNodeCommand, now: string): void {
  store.admitAttempt({
    task: { taskId: command.taskId, taskType: 'agent-mode.n0-2.remote-read', inputHash: 'n0-2-parity-fixture', createdAt: now },
    run: { runId: command.runId, taskId: command.taskId, agentId: `agent:${command.nodeId}`, createdAt: now },
    attempt: { attemptId: command.attemptId, runId: command.runId, agentId: `agent:${command.nodeId}`, runtimeRef: 'runtime:node-transport', routeRef: 'route:n0-2', modelRef: 'none', policyVersion: command.policyVersion, capabilityScopeHash: command.scopeHash, budgetScopeId: `budget:${command.operationId}`, createdAt: now },
    budget: { budgetScopeId: `budget:${command.operationId}`, maxSteps: 1, maxTokens: 0, maxDollars: 0 },
    estimate: { reservationId: `reservation:${command.operationId}`, steps: 1, tokens: 0, dollars: 0 },
    lease: { leaseId: command.lease.leaseId, resourceKey: command.lease.resourceKey, ownerId: `agent:${command.nodeId}`, expiresAt: command.deadline },
    now,
  });
  store.prepareOperation({ operationId: command.operationId, attemptId: command.attemptId, effectKind: 'capability.read', capabilityId: command.capabilityId, grantId: command.grantId, scopeHash: command.scopeHash, policyVersion: command.policyVersion, leaseResourceKey: command.lease.resourceKey, leaseId: command.lease.leaseId, leaseFence: command.lease.fence, deadline: command.deadline, preparedAt: now });
}

async function main(): Promise<void> {
  const secret = process.env.BRAIN_N0_NODE_SECRET;
  if (!secret) throw new Error('BRAIN_N0_NODE_SECRET is required');
  const now = new Date();
  const nowIso = now.toISOString();
  const deadline = new Date(now.getTime() + 120_000).toISOString();
  const proofId = String(now.getTime());
  const catalogPath = fileURLToPath(new URL('../../operations/infrastructure/catalog/assets.v1.json', import.meta.url));
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as { resources?: Array<{ resourceId?: string }> };
  const knownResourceRefs = new Set((catalog.resources ?? []).flatMap((resource) => resource.resourceId ? [resource.resourceId] : []));
  const configPath = fileURLToPath(new URL('../../operations/fixtures/agent-mode-n0-2-macbook-node.json', import.meta.url));
  const macbookConfig = JSON.parse(await readFile(configPath, 'utf8')) as NodeFixture;
  const enrollment: SshNodeEnrollment = { resourceRef: macbookConfig.resourceRef, nodeId: macbookConfig.nodeId, transportRef: macbookConfig.transportRef, hostAlias: macbookConfig.hostAlias, authRef: macbookConfig.authRef };
  const root = await mkdtemp(path.join(tmpdir(), 'brain-agent-n0-2-office-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  try {
    await writeFile(path.join(root, 'n0-2-marker.txt'), MARKER);
    const officeDescriptor: BrainNodeDescriptor = { nodeId: 'node-instance:host:office', resourceRef: 'host:office', protocolVersion: 'brain-node-v1', runnerVersion: 'brain-node-runner-n0.2', capabilities: [{ capabilityId: 'repo.read', version: 'repo.read-v1', maxBytes: 4096 }], bindings: [{ resourceId: 'host:office', rootPath: root }], platform: { os: 'Darwin', arch: 'arm64' }, health: { state: 'available', checkedAt: nowIso } };
    const officeCommand = makeCommand('host:office', officeDescriptor.nodeId, `operation:n0-2-office-read:${proofId}`, `attempt:n0-2-office-read:${proofId}`, OFFICE_SECRET, nowIso, deadline);
    const macbookCommand = makeCommand(enrollment.resourceRef, enrollment.nodeId, `operation:n0-2-macbook-read:${proofId}`, `attempt:n0-2-macbook-read:${proofId}`, secret, nowIso, deadline);
    admit(store, officeCommand, nowIso);
    admit(store, macbookCommand, nowIso);
    const office = new LocalNodeTransport(new BrainNodeLocalPerimeter(officeDescriptor, store, createHmacAuthenticator(OFFICE_SECRET)), { clock: () => nowIso });
    const macbook = createSshNodeTransport({ enrollment, knownResourceRefs, authSecret: secret, clock: () => nowIso, stateStore: store });
    const startedAt = Date.now();
    const officeReceipt = await office.execute(officeCommand);
    const macbookReceipt = await macbook.execute(macbookCommand);
    const latencyMs = Date.now() - startedAt;
    if (officeReceipt.status !== 'succeeded' || macbookReceipt.status !== 'succeeded' || officeReceipt.resultText !== MARKER || macbookReceipt.resultText !== officeReceipt.resultText) throw new Error('N0.2 parity result mismatch');
    store.recordReceipt({ operationId: officeReceipt.operationId, attemptId: officeReceipt.attemptId, scopeHash: officeReceipt.scopeHash, effectHash: officeReceipt.effectHash!, status: 'succeeded', recordedAt: officeReceipt.endedAt });
    store.recordReceipt({ operationId: macbookReceipt.operationId, attemptId: macbookReceipt.attemptId, scopeHash: macbookReceipt.scopeHash, effectHash: macbookReceipt.effectHash!, status: 'succeeded', recordedAt: macbookReceipt.endedAt });
    if (!store.getReceipt(officeCommand.operationId) || !store.getReceipt(macbookCommand.operationId)) throw new Error('Office parity receipts were not reconciled');
    process.stdout.write(`${JSON.stringify({ status: 'PASS', semanticResult: MARKER.trim(), latencyMs, office: { nodeId: officeReceipt.nodeId, transport: office.transportRef, operationId: officeReceipt.operationId, attemptId: officeReceipt.attemptId, receiptStatus: officeReceipt.status }, macbook: { nodeId: macbookReceipt.nodeId, transport: macbook.transportRef, operationId: macbookReceipt.operationId, attemptId: macbookReceipt.attemptId, receiptStatus: macbookReceipt.status }, identicalSemanticResult: true, officeStateStoreReconciled: true }, null, 2)}\n`);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
