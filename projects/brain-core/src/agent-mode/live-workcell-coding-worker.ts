import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BrainNodeLocalPerimeter,
  BRAIN_NODE_PROTOCOL_VERSION,
  BRAIN_NODE_READ_CAPABILITY,
  createFixtureAuthenticator,
  hashNodeReadScope,
  type BrainNodeReceipt,
} from './brain-node.js';
import {
  BRAIN_RESTRICTED_PROFILE,
  DEEPSEEK_HARNESS_PIN,
  verifyRestrictedTopology,
} from './deepseek-harness-restricted-profile.js';
import {
  AGENT_MODE_MODEL_ROUTES,
  type AdmittedModelRef,
  type BedrockMessage,
  type BedrockToolDefinition,
  type ModelAccessEvidence,
  type ModelGateway,
  type NormalizedModelResult,
} from './model-gateway.js';
import { AGENT_MODE_TIER_POLICY_VERSION, estimateAgentModeCost, selectAgentModeModel, type RouteEvidence } from './model-tier-policy.js';
import { AgentModeSqliteStateStore, type AgentModeBudgetSettlement } from './sqlite-state-store.js';
import { readRuntimeProcessIdentity } from './runtime-process-identity.js';
import { WorkcellFileMutationManager, type WorkcellFilePatchResult } from './workcell-file-mutation.js';
import { WorkcellManager, WORKCELL_READ_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY } from './workcell.js';
import { WorkcellValidationManager, GIT_DIFF_INTEGRITY_VALIDATOR } from './workcell-validation.js';
import { WorkcellWriterManager } from './workcell-writer.js';

const LIVE_MODEL: AdmittedModelRef = 'agent-mode/minimax-m2.5';
const FIXTURE_ACCOUNT_REF = 'fixture-account:k3-4';
const FIXTURE_EVIDENCE_VERSION = 'agent-mode-access-evidence-fixture-v1';
const FIXTURE_EVIDENCE_CHECKED_AT = '2026-09-09T00:00:00.000Z';
const FIXTURE_EVIDENCE_FRESH_UNTIL = '2026-09-10T00:00:00.000Z';
const DEFAULT_RELATIVE_PATH = 'src/message.ts';
const MAX_MODEL_TURNS = 3;
const MAX_MODEL_TOKENS = 768;

const BRIDGE_TOOLS: readonly BedrockToolDefinition[] = [
  {
    name: 'brain_read',
    description: 'Read one exact relative path from the Brain-authorized Workcell.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { path: { type: 'string', enum: [DEFAULT_RELATIVE_PATH] } }, required: ['path'] },
  },
  {
    name: 'brain_workcell_patch',
    description: 'Apply one exact old-text to replacement-text patch to the Brain-authorized Workcell file.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      path: { type: 'string', enum: [DEFAULT_RELATIVE_PATH] },
      oldText: { type: 'string' }, replacementText: { type: 'string' },
    }, required: ['path', 'oldText', 'replacementText'] },
  },
];

type ParentBridgeRequest = {
  kind: 'model' | 'tool';
  messages?: unknown;
  system?: unknown;
  tools?: unknown;
  maxTokens?: unknown;
  name?: unknown;
  args?: unknown;
};

type ParentBridgeResponse = {
  kind?: 'tool_use' | 'text';
  ok?: boolean;
  toolUseId?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
};

export type LiveWorkcellCodingWorkerOptions = {
  databasePath: string;
  repositoryRoot: string;
  workcellsRoot: string;
  harnessRoot: string;
  now?: string;
  relativePath?: string;
  taskText?: string;
  accountRef?: string;
  routeEvidence?: Readonly<Record<AdmittedModelRef, RouteEvidence>>;
  modelAccessEvidence?: ModelAccessEvidence;
  fixtureMode?: boolean;
  gateway?: ModelGateway;
  keepAttemptArtifacts?: boolean;
  /** Test-only hook; it models drift after the Brain-owned diff capture. */
  beforeValidation?: () => Promise<void> | void;
  taskId?: string;
  runId?: string;
  attemptId?: string;
  workerAgentId?: string;
  jarvisAgentId?: string;
  budgetScopeId?: string;
  reservationId?: string;
  resourceKey?: string;
  leaseId?: string;
  nodeId?: string;
  controllerRef?: string;
  repositoryRef?: string;
  baseRef?: string;
  onExecutionWindowStart?: (input: { workerAgentId: string; workcellId: string }) => Promise<void> | void;
  onExecutionWindowEnd?: (input: { workerAgentId: string; workcellId: string }) => Promise<void> | void;
};

export type LiveWorkcellCodingWorkerResult = {
  status: 'completed' | 'failed';
  taskId: string;
  runId: string;
  attemptId: string;
  jarvisAgentId: string;
  workerAgentId: string;
  workcellId: string;
  leaseId: string;
  fenceToken: number;
  modelRef: AdmittedModelRef;
  modelId: string;
  routeId: string;
  runtimeRef: string;
  harnessCommit: string;
  harnessVersion: string;
  harnessProcessIsolation: 'separate-child';
  capabilities: readonly ['repo.read', 'repo.write(workcell)', 'validation.run(workcell)'];
  toolCalls: number;
  modelTurns: number;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  estimatedCostUsd: number | null;
  finalResponse: string;
  nodeReceipt?: BrainNodeReceipt;
  patchResult?: WorkcellFilePatchResult;
  diffId?: string;
  validationId?: string;
  validationResult?: 'passed' | 'failed' | 'rejected' | 'timed_out' | 'interrupted';
  workcellStatus: string;
  restartVerified: boolean;
  failureReason?: string;
  databasePath: string;
  attemptArtifacts?: string;
};

function isoNow(value?: string): string { return value ?? new Date().toISOString(); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function deadlineFrom(now: string): string { return new Date(Date.parse(now) + 120_000).toISOString(); }
function bytesHash(value: string): string { return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex'); }

function accessEvidence(modelRef: AdmittedModelRef, accountRef: string): ModelAccessEvidence {
  const model = AGENT_MODE_MODEL_ROUTES[modelRef];
  const route = model.routes[0]!;
  return { version: FIXTURE_EVIDENCE_VERSION, accountRef, region: 'us-east-1', modelRef, modelId: model.modelId, routeKind: route.kind, routeId: route.id, state: 'verified', catalogVisible: true, callable: true, checkedAt: FIXTURE_EVIDENCE_CHECKED_AT, freshUntil: FIXTURE_EVIDENCE_FRESH_UNTIL, source: 'explicit-agent-mode-access-evidence' };
}

function routeEvidence(): Readonly<Record<AdmittedModelRef, RouteEvidence>> {
  const base = { state: 'healthy' as const, accessState: 'verified' as const, checkedAt: FIXTURE_EVIDENCE_CHECKED_AT, freshUntil: FIXTURE_EVIDENCE_FRESH_UNTIL, evidenceVersion: FIXTURE_EVIDENCE_VERSION };
  return {
    'agent-mode/minimax-m2.5': { ...base, modelRef: 'agent-mode/minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5' },
    'agent-mode/glm-5': { ...base, modelRef: 'agent-mode/glm-5', routeKind: 'direct', routeId: 'zai.glm-5' },
    'agent-mode/claude-opus-4.6': { ...base, modelRef: 'agent-mode/claude-opus-4.6', routeKind: 'inference-profile', routeId: 'us.anthropic.claude-opus-4-6-v1' },
  };
}

function createLineServer(handler: (request: ParentBridgeRequest) => Promise<ParentBridgeResponse>): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve, reject) => {
  const socketPath = path.join(tmpdir(), `b34-${randomUUID().replaceAll('-', '').slice(0, 12)}.sock`);
    const server = createServer((socket: Socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        void Promise.resolve().then(() => handler(JSON.parse(line) as ParentBridgeRequest)).then(
          (response) => socket.end(`${JSON.stringify(response)}\n`),
          (error) => socket.end(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`),
        );
      });
    });
    server.once('error', reject);
    server.listen(socketPath, () => resolve({ server, socketPath }));
  });
}

async function writeHarnessFiles(attemptRoot: string, harnessRoot: string): Promise<{ patchPath: string }> {
  const llmRuntime = pathToFileURL(path.join(harnessRoot, 'packages/llm/llm/lib/index.js')).href;
  const toolsRuntime = pathToFileURL(path.join(harnessRoot, 'packages/core/tools/lib/index.js')).href;
  const pluginPath = path.join(attemptRoot, 'brain-k34-bridge.mjs');
  const plugin = `import net from 'node:net'\nimport { LlmAdapter, ReasoningEffortId, ToolCallId } from ${JSON.stringify(llmRuntime)}\nimport { defineContentToolFixture } from ${JSON.stringify(toolsRuntime)}\nconst socketPath = process.env.BRAIN_AGENT_BRIDGE_SOCKET\nif (!socketPath) throw new Error('Brain bridge socket is required')\nlet sequence = 0\nfunction callParent(message) { return new Promise((resolve, reject) => { const requestId = 'child-' + (++sequence); const socket = net.createConnection(socketPath); let buffer = ''; let settled = false; const finish = (fn, value) => { if (!settled) { settled = true; socket.destroy(); fn(value) } }; socket.once('error', error => finish(reject, error)); socket.on('data', chunk => { buffer += chunk.toString('utf8'); const newline = buffer.indexOf('\\n'); if (newline < 0) return; finish(resolve, JSON.parse(buffer.slice(0, newline))) }); socket.once('connect', () => socket.write(JSON.stringify({ ...message, requestId }) + '\\n')) }) }\nclass BrainBedrockAdapter extends LlmAdapter { resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model, reasoning: { efforts: [{ id: ReasoningEffortId('default'), name: 'Default' }] } }) } async *stream(options) { const response = await callParent({ kind: 'model', provider: options.provider, model: options.model, system: options.system, messages: options.messages, tools: options.tools, maxTokens: options.maxTokens }); if (response.ok === false) throw new Error(typeof response.error === 'string' ? response.error : 'Brain model bridge rejected'); if (response.kind === 'tool_use') { const args = JSON.stringify(response.input ?? {}); yield { type: 'block-start', index: 0, blockType: 'tool-call' }; yield { type: 'tool-call-delta', index: 0, id: ToolCallId(response.toolUseId), name: response.name, argumentsDelta: args }; yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(response.toolUseId), name: response.name, arguments: args } }; yield { type: 'usage', usage: response.usage ?? { inputTokens: 0, outputTokens: 0 } }; yield { type: 'finish', reason: { kind: 'tool-calls' } }; return } const text = typeof response.text === 'string' ? response.text : ''; yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text }; yield { type: 'block-end', index: 0, block: { type: 'text', text } }; yield { type: 'usage', usage: response.usage ?? { inputTokens: 0, outputTokens: 0 } }; yield { type: 'finish', reason: { kind: 'stop' } } } }\nfunction bridgeTool(name, description, parameters) { return defineContentToolFixture({ name, description, parameters, async execute(args) { const response = await callParent({ kind: 'tool', name, args }); if (!response.ok) throw new Error(typeof response.error === 'string' ? response.error : name + ' rejected'); return [{ type: 'text', text: typeof response.text === 'string' ? response.text : JSON.stringify(response.result ?? {}) }] } }) }\nexport const name = 'brain-k34-bridge'\nexport const inject = ['llm', 'tools']\nexport function apply(ctx) { ctx.llm.registerAdapter(['brain-bedrock'], new BrainBedrockAdapter()); ctx.tools.register(bridgeTool('brain_read', 'Read one Brain-authorized Workcell file.', { path: { type: 'string', required: true } })); ctx.tools.register(bridgeTool('brain_workcell_patch', 'Apply one Brain-authorized Workcell patch.', { path: { type: 'string', required: true }, oldText: { type: 'string', required: true }, replacementText: { type: 'string', required: true } })) }\n`;
  await writeFile(pluginPath, plugin, { mode: 0o600, flag: 'wx' });
  const disabled = ['llm-deepseek', 'sandbox', 'sandbox-policy', 'subprocess', 'pty', 'terminal-bash', 'terminal-pwsh', 'fs-local', 'persistent-bash', 'persistent-pwsh', 'str-replace-editor', 'jobs', 'subagents', 'sessions'];
  const rows = disabled.map((id) => `- id: ${id}\n  disabled: true`).join('\n');
  const patchPath = path.join(attemptRoot, 'brain-k34-restricted.patch.yml');
  await writeFile(patchPath, `${rows}\n- insert:\n    - id: brain-k34-bridge\n      name: ${pluginPath}\n      inject: [llm, tools]\n`, { mode: 0o600, flag: 'wx' });
  return { patchPath };
}

export async function runLiveWorkcellCodingWorker(options: LiveWorkcellCodingWorkerOptions): Promise<LiveWorkcellCodingWorkerResult> {
  const now = isoNow(options.now);
  const deadline = deadlineFrom(now);
  const relativePath = options.relativePath ?? DEFAULT_RELATIVE_PATH;
  const taskText = options.taskText ?? `In the Brain-authorized Workcell, read ${relativePath}, change the exact marker BEFORE to K3_4_PASS using brain_workcell_patch, then summarize the result.`;
  const taskId = options.taskId ?? 'task:k3-4-first-coding-worker';
  const runId = options.runId ?? 'run:k3-4-first-coding-worker';
  const attemptId = options.attemptId ?? 'attempt:k3-4-first-coding-worker';
  const jarvisAgentId = options.jarvisAgentId ?? 'agent:jarvis';
  const workerAgentId = options.workerAgentId ?? 'agent:worker-k3-4';
  const workerKey = taskId.replace(/^task:/, '');
  const budgetScopeId = options.budgetScopeId ?? `budget:${workerKey}`;
  const reservationId = options.reservationId ?? `reservation:${workerKey}`;
  const resourceKey = options.resourceKey ?? `resource:${workerKey}-runtime`;
  const leaseId = options.leaseId ?? `lease:${workerKey}`;
  const nodeId = options.nodeId ?? `node:brain-local-${workerKey}`;
  const controllerRef = options.controllerRef ?? `controller:brain-agent-${workerKey}`;
  const grantId = `grant:${workerKey}-workcell-read`;
  const policyVersion = AGENT_MODE_TIER_POLICY_VERSION;
  const accountRef = options.accountRef ?? (options.fixtureMode ? FIXTURE_ACCOUNT_REF : process.env.BRAIN_AGENT_MODE_ACCOUNT_REF);
  if (!accountRef) throw new Error('BRAIN_AGENT_MODE_ACCOUNT_REF or accountRef is required; refusing implicit provider identity');
  const selectedRouteEvidence = options.routeEvidence ?? (options.fixtureMode ? routeEvidence() : undefined);
  if (!selectedRouteEvidence) throw new Error('explicit route evidence is required; refusing implicit route evidence');
  const selectedAccessEvidence = options.modelAccessEvidence ?? (options.fixtureMode ? accessEvidence(LIVE_MODEL, accountRef) : undefined);
  if (!selectedAccessEvidence) throw new Error('explicit model access evidence is required');
  const store = new AgentModeSqliteStateStore(options.databasePath);
  const policy = selectAgentModeModel({ taskClass: 'worker', requiredContextTokens: 2_000, requiredOutputTokens: MAX_MODEL_TOKENS, requiredCapability: WORKCELL_READ_CAPABILITY, budgetScopeId, rootBudgetScopeId: budgetScopeId, maxDollars: 0.01, inputTokens: 1_500, outputTokens: MAX_MODEL_TOKENS, now, routeEvidence: selectedRouteEvidence, selectionMode: 'auto', phase: 'root' });
  if (!policy.ok || policy.modelRef !== LIVE_MODEL) { store.close(); throw new Error(`K3.4 policy admission failed: ${policy.ok ? 'auto did not select MiniMax' : policy.reason}`); }
  const model = AGENT_MODE_MODEL_ROUTES[LIVE_MODEL];
  const route = model.routes[0]!;
  const runtimeRef = `runtime:deepseek-harness:${DEEPSEEK_HARNESS_PIN.commit}`;
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let modelTurns = 0;
  let toolCalls = 0;
  let toolReceipt: BrainNodeReceipt | undefined;
  let patchResult: WorkcellFilePatchResult | undefined;
  let diffId: string | undefined;
  let validationId: string | undefined;
  let validationResult: LiveWorkcellCodingWorkerResult['validationResult'];
  let finalResponse = '';
  let workcellStatus = 'created';
  let attemptRoot: string | undefined;
  let isolatedCwd: string | undefined;
  let server: Server | undefined;
  let socketPath: string | undefined;
  let workcellId = 'unassigned';
  let fenceToken = 0;
  let executionWindowStarted = false;
  const startedAtMs = Date.now();

  try {
    const scopeHash = hashNodeReadScope('workcell:pending', undefined, relativePath);
    store.upsertAgent({ agentId: jarvisAgentId, agentKind: 'jarvis', role: 'persistent-orchestrator', displayName: 'Jarvis', policyId: policyVersion, status: 'active' });
    store.upsertAgent({ agentId: workerAgentId, agentKind: 'worker', role: 'bounded-workcell-coding-worker', displayName: 'Agent Mode Workcell Worker', policyId: policyVersion, status: 'active' });
    store.recordEvent({ eventId: `jarvis-delegated:${taskId}`, entityType: 'agent', entityId: jarvisAgentId, eventType: 'jarvis_delegated_worker', occurredAt: now, payload: { workerAgentId, taskId, taskClass: 'worker', bounded: true } });
    store.admitAttempt({
      task: { taskId, taskType: options.taskId ? 'agent-mode.k3-5.concurrent-coding-worker' : 'agent-mode.k3-4.first-coding-worker', inputHash: hash(taskText), createdAt: now },
      run: { runId, taskId, agentId: workerAgentId, createdAt: now },
      attempt: { attemptId, runId, agentId: workerAgentId, runtimeRef, routeRef: route.id, modelRef: LIVE_MODEL, policyVersion, capabilityScopeHash: scopeHash, budgetScopeId, createdAt: now },
      budget: { budgetScopeId, maxSteps: 8, maxTokens: 6_000, maxDollars: 0.01 },
      estimate: { reservationId, steps: 6, tokens: 6_000, dollars: 0.01 },
      lease: { leaseId: `lease:k3-4-runtime:${attemptId}`, resourceKey, ownerId: workerAgentId, expiresAt: deadline },
      now,
    });
    const runtimeIdentity = options.fixtureMode ? { startedAt: 'fixture', command: 'brain-agent fixture', token: hash(`fixture:${runId}:${process.pid}`) } : readRuntimeProcessIdentity(process.pid, runId);
    if (!runtimeIdentity) throw new Error('owned brain-agent runtime identity could not be established');
    store.setRunRuntimePid(runId, process.pid, runtimeIdentity);
    store.recordEvent({ eventId: `policy-admitted:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'policy_admitted_model', occurredAt: now, payload: { modelRef: LIVE_MODEL, modelId: model.modelId, routeId: route.id, capabilities: ['repo.read', 'repo.write(workcell)', 'validation.run(workcell)'], policyVersion, evidenceVersion: selectedAccessEvidence.version } });

    const workcells = new WorkcellManager({ store });
    const workcell = await workcells.create({ taskId, runId, attemptId, repositoryRef: options.repositoryRef ?? 'disposable-k3-4-fixture', repositoryRoot: options.repositoryRoot, workcellsRoot: options.workcellsRoot, ownerAgent: workerAgentId, createdAt: now, ...(options.baseRef ? { baseRef: options.baseRef } : {}) });
    workcellId = workcell.workcellId;
    const prepared = await workcells.prepare(workcellId, workerAgentId, now);
    workcellStatus = prepared.status;
    const lease = new WorkcellWriterManager({ store }).grantLease({ workcellId, leaseId, ownerAgent: workerAgentId, ownerAttempt: attemptId, createdAt: now, expiresAt: deadline });
    if (!lease.lease || !['granted', 'duplicate'].includes(lease.result)) throw new Error(lease.reason ?? 'Workcell writer lease was not granted');
    fenceToken = lease.lease.fenceToken;
    const writer = new WorkcellWriterManager({ store });
    const mutationManager = new WorkcellFileMutationManager({ store, writer });
    const validator = new WorkcellValidationManager({ store });
    const readScopeHash = hashNodeReadScope(workcellId, workcellId, relativePath);
    store.setAttemptCapabilityScopeHash(attemptId, readScopeHash, now);
    const authProof = hash(`${controllerRef}:${nodeId}:${attemptId}`);
    const node = new BrainNodeLocalPerimeter({ nodeId, resourceRef: `resource:${workcellId}`, protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, capabilities: [{ capabilityId: BRAIN_NODE_READ_CAPABILITY, maxBytes: 4_096 }], bindings: [{ resourceId: workcellId, rootPath: prepared.worktreePath, worktreeId: workcellId }], platform: { os: process.platform, arch: process.arch }, health: { state: 'available', checkedAt: now } }, store, createFixtureAuthenticator({ controllerRef, nodeId, proof: authProof }));
    await options.onExecutionWindowStart?.({ workerAgentId, workcellId });
    executionWindowStarted = true;
    const gateway: ModelGateway = options.gateway ?? (await import('../adapters/amazon-bedrock-model-gateway.js').then(({ AmazonBedrockModelGateway }) => new AmazonBedrockModelGateway({ accountRef })));
    const conversation: BedrockMessage[] = [{ role: 'user', content: [{ text: `${taskText}\nOnly Brain tools are available. Read before patching. Do not use shell, filesystem APIs, Git commands, or any other tool.` }] }];
    let pendingToolUseId: string | undefined;
    const respondToParent = async (request: ParentBridgeRequest): Promise<ParentBridgeResponse> => {
      const attempt = store.getAttempt(attemptId);
      if (!attempt || attempt.status === 'failed' || attempt.status === 'cancelled' || attempt.cancellationStatus !== 'running') return { ok: false, error: 'run_cancelled' };
      if (request.kind === 'tool') {
        if (typeof request.name !== 'string' || !request.args || typeof request.args !== 'object') return { ok: false, error: 'typed tool request is required' };
        const args = request.args as Record<string, unknown>;
        if (request.name === 'brain_read') {
          if (toolCalls !== 0 || args.path !== relativePath) return { ok: false, error: 'read path or one-read limit rejected' };
          toolCalls += 1;
          const operationId = `operation:k3-4-read:${attemptId}`;
          if (!attempt.leaseId || attempt.leaseFence === undefined) return { ok: false, error: 'runtime lease is missing' };
          store.prepareOperation({ operationId, attemptId, effectKind: 'capability.read', capabilityId: BRAIN_NODE_READ_CAPABILITY, grantId, scopeHash: readScopeHash, policyVersion, leaseResourceKey: resourceKey, leaseId: attempt.leaseId, leaseFence: attempt.leaseFence, deadline, preparedAt: now });
          toolReceipt = await node.execute({ protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, controllerRef, nodeId, taskId, runId, attemptId, operationId, capabilityId: BRAIN_NODE_READ_CAPABILITY, resourceId: workcellId, worktreeId: workcellId, relativePath, scopeHash: readScopeHash, grantId, policyVersion, lease: { resourceKey, leaseId: attempt.leaseId!, fence: attempt.leaseFence! }, deadline, correlationId: `corr:${operationId}`, causationId: `cause:tool:${toolCalls}`, authProof }, now);
          if (toolReceipt.status !== 'succeeded' || !toolReceipt.resultText) return { ok: false, error: toolReceipt.errorCode ?? 'Workcell read failed' };
          store.markOperationVerified(operationId, { resultHash: toolReceipt.resultHash!, evidenceRef: toolReceipt.evidenceRef!, verifiedAt: now });
          conversation.push({ role: 'user', content: [{ toolResult: { toolUseId: pendingToolUseId ?? 'brain-read-1', content: [{ text: toolReceipt.resultText }], status: 'success' } }] });
          return { ok: true, text: toolReceipt.resultText };
        }
        if (request.name === 'brain_workcell_patch') {
          if (toolCalls !== 1 || !toolReceipt?.resultHash || args.path !== relativePath || typeof args.oldText !== 'string' || typeof args.replacementText !== 'string') return { ok: false, error: 'patch requires the one prior Brain read and exact typed fields' };
          toolCalls += 1;
          const operationId = `operation:k3-4-patch:${attemptId}`;
          patchResult = await mutationManager.applyPatch({ operationId, workcellId, repositoryRef: prepared.repositoryRef, repositoryRoot: prepared.repositoryRoot, worktreePath: prepared.worktreePath, relativePath, ownerAgent: workerAgentId, ownerAttempt: attemptId, leaseId, fenceToken, expectedPreimageHash: toolReceipt.resultHash, oldText: args.oldText, replacementText: args.replacementText, now });
          if (patchResult.result !== 'applied' && patchResult.result !== 'duplicate' && patchResult.result !== 'reconciled') return { ok: false, error: patchResult.reason ?? 'Workcell patch rejected' };
          const diff = await writer.captureDiff({ workcellId, capability: 'repo.write(workcell)', ownerAgent: workerAgentId, ownerAttempt: attemptId, leaseId, fenceToken, repositoryRoot: prepared.repositoryRoot, worktreePath: prepared.worktreePath, now });
          diffId = diff.diffId;
          await options.beforeValidation?.();
          const validation = await validator.run({ workcellId, validationProfile: GIT_DIFF_INTEGRITY_VALIDATOR, capability: WORKCELL_VALIDATION_CAPABILITY, ownerAgent: workerAgentId, ownerAttempt: attemptId, leaseId, fenceToken, repositoryRoot: prepared.repositoryRoot, worktreePath: prepared.worktreePath, now });
          validationId = validation.validation?.validationId;
          validationResult = validation.result === 'duplicate'
            ? (validation.validation?.result === 'passed' || validation.validation?.result === 'failed' ? validation.validation.result : 'rejected')
            : validation.result;
          if (validation.result !== 'passed') return { ok: false, error: `validation_${validation.result}` };
          workcellStatus = 'testing';
          store.updateWorkcellStatus(workcellId, 'testing', now, 'prepared', { receiptId: `workcell-receipt:k3-4-testing:${workcellId}`, receiptType: 'ValidationReceipt', taskId, runId, attemptId, workcellId, repositoryRef: prepared.repositoryRef, actor: workerAgentId, timestamp: now, operationHash: hash(`testing:${workcellId}`), operation: 'inspect', resultState: 'testing' });
          store.updateWorkcellStatus(workcellId, 'awaiting_review', now, 'testing', { receiptId: `workcell-receipt:k3-4-awaiting-review:${workcellId}`, receiptType: 'ValidationReceipt', taskId, runId, attemptId, workcellId, repositoryRef: prepared.repositoryRef, actor: workerAgentId, timestamp: now, operationHash: hash(`awaiting_review:${workcellId}`), operation: 'inspect', resultState: 'awaiting_review' });
          workcellStatus = 'awaiting_review';
          conversation.push({ role: 'user', content: [{ toolResult: { toolUseId: pendingToolUseId ?? 'brain-patch-1', content: [{ text: JSON.stringify({ result: 'verified', diffId, validationId, validation: 'passed', workcell: 'awaiting_review' }) }], status: 'success' } }] });
          return { ok: true, text: JSON.stringify({ result: 'verified', diffId, validationId, validation: 'passed', workcell: 'awaiting_review' }) };
        }
        return { ok: false, error: 'tool is not allowlisted' };
      }
      if (request.kind !== 'model') return { ok: false, error: 'unknown bridge request' };
      if (modelTurns >= MAX_MODEL_TURNS) return { ok: false, error: 'model turn budget exhausted' };
      modelTurns += 1;
      let result: NormalizedModelResult;
      try {
        const tools = BRIDGE_TOOLS.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema, properties: { ...(tool.inputSchema.properties as Record<string, unknown>), path: { type: 'string', enum: [relativePath] } } } }));
        result = await gateway.invoke({ providerId: 'amazon-bedrock', modelRef: LIVE_MODEL, modelId: model.modelId, routeKind: route.kind, routeId: route.id, messages: conversation, tools, maxTokens: MAX_MODEL_TOKENS, operationId: `model:${attemptId}:${modelTurns}`, attemptId, now, deadline, accessEvidence: selectedAccessEvidence });
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      usage.totalTokens += result.usage.totalTokens;
      if (result.toolUses?.length) {
        const toolUse = result.toolUses[0]!;
        if (!['brain_read', 'brain_workcell_patch'].includes(toolUse.name)) return { ok: false, error: 'model requested a non-allowlisted tool' };
        pendingToolUseId = toolUse.toolUseId;
        conversation.push({ role: 'assistant', content: [{ toolUse }] });
        return { kind: 'tool_use', toolUseId: toolUse.toolUseId, name: toolUse.name, input: toolUse.input, usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens } };
      }
      if (!result.text) return { ok: false, error: 'model returned neither an allowlisted tool call nor final text' };
      finalResponse = result.text.trim();
      return { kind: 'text', text: finalResponse, usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens } };
    };

    attemptRoot = await mkdtemp(path.join(tmpdir(), `brain-agent-mode-${workerKey}-`));
    isolatedCwd = await mkdtemp(path.join(tmpdir(), `brain-agent-mode-${workerKey}-cwd-`));
    const { patchPath } = await writeHarnessFiles(attemptRoot, options.harnessRoot);
    const topology = verifyRestrictedTopology({ serviceRows: BRAIN_RESTRICTED_PROFILE.allowedServiceRows, toolNames: ['brain_read', 'brain_workcell_patch'], providerIds: ['brain-bedrock'], processIsolation: 'separate-child', environmentPolicy: 'explicit-complete-env', profile: BRAIN_RESTRICTED_PROFILE.name }, { allowedToolNames: ['brain_read', 'brain_workcell_patch'] });
    if (!topology.ok) throw new Error(`restricted Harness topology rejected: ${topology.reasons.join('; ')}`);
    store.recordEvent({ eventId: `harness-topology:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'restricted_harness_topology_verified', occurredAt: now, payload: { profile: BRAIN_RESTRICTED_PROFILE.name, commit: DEEPSEEK_HARNESS_PIN.commit, version: DEEPSEEK_HARNESS_PIN.version, processIsolation: 'separate-child', environmentPolicy: 'explicit-complete-env', providerId: 'brain-bedrock', tools: ['brain_read', 'brain_workcell_patch'], deniedEffects: ['capability.write', 'runtime.child', 'runtime.schedule', 'runtime.shell'] } });
    const bridge = await createLineServer(respondToParent);
    server = bridge.server;
    socketPath = bridge.socketPath;
    const sdkPath = path.join(options.harnessRoot, 'packages/sdk/client/lib/index.js');
    const { DeepSeekHarness } = await import(pathToFileURL(sdkPath).href);
    const childHome = path.join(attemptRoot, 'home');
    const childTmp = path.join(attemptRoot, 'tmp');
    const harness = new DeepSeekHarness({ profile: 'sdk-minimal', patches: [patchPath], dshHome: childHome, processCwd: options.harnessRoot, cwd: isolatedCwd, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: childHome, TMPDIR: childTmp, LANG: 'C', BRAIN_AGENT_BRIDGE_SOCKET: socketPath }, provider: 'brain-bedrock', model: model.modelId, maxTokens: MAX_MODEL_TOKENS, initializeTimeoutMs: 15_000, requestTimeoutMs: 90_000, disposeEofGraceMs: 200, disposeGraceMs: 3_000 });
    const runResult = await harness.run(taskText, { sessionId: `brain-${workerKey}` });
    finalResponse = runResult.finalResponse.trim();
    await harness.close();
    if (toolCalls !== 2 || !toolReceipt || toolReceipt.status !== 'succeeded' || patchResult?.result === undefined || validationResult !== 'passed' || workcellStatus !== 'awaiting_review' || !finalResponse) throw new Error('K3.4 worker did not produce read, patch, diff, validation, and final response');
    const actualDollars = estimateAgentModeCost(LIVE_MODEL, usage.inputTokens, usage.outputTokens);
    const settledAt = new Date().toISOString();
    const settlement: AgentModeBudgetSettlement = { reservationId, steps: modelTurns + toolCalls, tokens: usage.totalTokens, dollars: actualDollars ?? 0, settledAt };
    store.settleBudget(settlement);
    store.recordEvent({ eventId: `result:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'jarvis_result_returned', occurredAt: settledAt, payload: { runId, taskId, workcellId, finalResponse, resultHash: hash(finalResponse), diffId, validationId, validationResult, modelTurns, toolCalls, usage, actualCostUsd: actualDollars, durationMs: Date.now() - startedAtMs, capabilities: ['repo.read', 'repo.write(workcell)', 'validation.run(workcell)'] } });
    store.finishAttempt(attemptId, 'completed', settledAt);
    store.clearRunRuntimePid(runId);
    const observed = store.getAttempt(attemptId);
    const reopened = AgentModeSqliteStateStore.openExisting(options.databasePath);
    const restartVerified = Boolean(observed?.status === 'completed' && reopened?.getAttempt(attemptId)?.status === 'completed' && reopened?.listRecentEvents(500).some((event) => event.eventId === `result:${attemptId}`));
    reopened?.close();
    if (!restartVerified) throw new Error('StateStore close/reopen did not preserve the coding result');
    store.close();
    if (!diffId || !validationId || !validationResult || !patchResult) throw new Error('successful K3.4 result is missing durable evidence IDs');
    return { status: 'completed', taskId, runId, attemptId, jarvisAgentId, workerAgentId, workcellId, leaseId, fenceToken, modelRef: LIVE_MODEL, modelId: model.modelId, routeId: route.id, runtimeRef, harnessCommit: DEEPSEEK_HARNESS_PIN.commit, harnessVersion: DEEPSEEK_HARNESS_PIN.version, harnessProcessIsolation: 'separate-child', capabilities: ['repo.read', 'repo.write(workcell)', 'validation.run(workcell)'], toolCalls, modelTurns, usage, estimatedCostUsd: actualDollars, finalResponse, nodeReceipt: toolReceipt, patchResult, diffId, validationId, validationResult, workcellStatus, restartVerified, databasePath: options.databasePath, ...(options.keepAttemptArtifacts && attemptRoot ? { attemptArtifacts: attemptRoot } : {}) };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    const current = store.getAttempt(attemptId);
    if (current && !['completed', 'failed', 'cancelled'].includes(current.status)) {
      store.recordEvent({ eventId: `failure:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'live_workcell_coding_worker_failed', occurredAt: new Date().toISOString(), payload: { workcellId, failureReason, modelTurns, toolCalls, usage, durationMs: Date.now() - startedAtMs, diffId, validationId, validationResult } });
      store.finishAttempt(attemptId, 'failed', new Date().toISOString());
    }
    try { store.clearRunRuntimePid(runId); } catch { /* store may already be closed */ }
    const persisted = store.getWorkcell(workcellId);
    const failureResult: LiveWorkcellCodingWorkerResult = { status: 'failed', taskId, runId, attemptId, jarvisAgentId, workerAgentId, workcellId, leaseId, fenceToken, modelRef: LIVE_MODEL, modelId: AGENT_MODE_MODEL_ROUTES[LIVE_MODEL].modelId, routeId: AGENT_MODE_MODEL_ROUTES[LIVE_MODEL].routes[0]!.id, runtimeRef, harnessCommit: DEEPSEEK_HARNESS_PIN.commit, harnessVersion: DEEPSEEK_HARNESS_PIN.version, harnessProcessIsolation: 'separate-child', capabilities: ['repo.read', 'repo.write(workcell)', 'validation.run(workcell)'], toolCalls, modelTurns, usage, estimatedCostUsd: estimateAgentModeCost(LIVE_MODEL, usage.inputTokens, usage.outputTokens), finalResponse, ...(toolReceipt ? { nodeReceipt: toolReceipt } : {}), ...(patchResult ? { patchResult } : {}), ...(diffId ? { diffId } : {}), ...(validationId ? { validationId } : {}), ...(validationResult ? { validationResult } : {}), workcellStatus: persisted?.status ?? workcellStatus, restartVerified: false, failureReason, databasePath: options.databasePath, ...(options.keepAttemptArtifacts && attemptRoot ? { attemptArtifacts: attemptRoot } : {}) };
    store.close();
    return failureResult;
  } finally {
    if (executionWindowStarted) await options.onExecutionWindowEnd?.({ workerAgentId, workcellId });
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (socketPath) await rm(socketPath, { force: true }).catch(() => undefined);
    if (attemptRoot && !options.keepAttemptArtifacts) await rm(attemptRoot, { recursive: true, force: true });
    if (isolatedCwd) await rm(isolatedCwd, { recursive: true, force: true });
  }
}
