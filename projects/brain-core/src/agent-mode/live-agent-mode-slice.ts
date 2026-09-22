import { createHash } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { AGENT_MODE_MODEL_ROUTES, type AdmittedModelRef, type BedrockMessage, type BedrockToolDefinition, type ModelAccessEvidence, type ModelGateway, type NormalizedModelResult } from './model-gateway.js';
import { AGENT_MODE_TIER_POLICY_VERSION, estimateAgentModeCost, selectAgentModeModel, type RouteEvidence } from './model-tier-policy.js';
import { AgentModeSqliteStateStore, type AgentModeBudgetSettlement } from './sqlite-state-store.js';
import { readRuntimeProcessIdentity } from './runtime-process-identity.js';

const LIVE_MODEL: AdmittedModelRef = 'agent-mode/minimax-m2.5';
const FIXTURE_ACCOUNT_REF = 'fixture-account:k2-1';
const FIXTURE_EVIDENCE_VERSION = 'agent-mode-access-evidence-fixture-v1';
const FIXTURE_EVIDENCE_CHECKED_AT = '2026-09-09T00:00:00.000Z';
const FIXTURE_EVIDENCE_FRESH_UNTIL = '2026-09-10T00:00:00.000Z';
const FIXTURE_RELATIVE_PATH = 'agent-mode-k2-1-marker.txt';
const BRIDGE_TOOL: BedrockToolDefinition = {
  name: 'brain_read',
  description: 'Read the one exact read-only fixture path authorized by Brain.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { path: { type: 'string', enum: [FIXTURE_RELATIVE_PATH] } },
    required: ['path'],
  },
};

export type LiveAgentModeSliceOptions = {
  databasePath: string;
  fixtureRoot: string;
  harnessRoot: string;
  now?: string;
  taskText?: string;
  modelRef?: AdmittedModelRef;
  accountRef?: string;
  routeEvidence?: Readonly<Record<AdmittedModelRef, RouteEvidence>>;
  modelAccessEvidence?: ModelAccessEvidence;
  fixtureMode?: boolean;
  gateway?: ModelGateway;
  keepAttemptArtifacts?: boolean;
};

export type LiveAgentModeSliceResult = {
  status: 'completed' | 'failed';
  taskId: string;
  runId: string;
  attemptId: string;
  jarvisAgentId: string;
  workerAgentId: string;
  modelRef: AdmittedModelRef;
  modelId: string;
  routeId: string;
  runtimeRef: string;
  harnessCommit: string;
  harnessVersion: string;
  harnessProcessIsolation: 'separate-child';
  capability: 'repo.read';
  toolCalls: number;
  modelTurns: number;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  estimatedCostUsd: number | null;
  finalResponse: string;
  nodeReceipt?: BrainNodeReceipt;
  restartVerified: boolean;
  databasePath: string;
  attemptArtifacts?: string;
};

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

function isoNow(value?: string): string { return value ?? new Date().toISOString(); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function deadlineFrom(now: string): string { return new Date(Date.parse(now) + 120_000).toISOString(); }

function accessEvidence(modelRef: AdmittedModelRef, accountRef: string): ModelAccessEvidence {
  const model = AGENT_MODE_MODEL_ROUTES[modelRef];
  const route = model.routes[0]!;
  return {
    version: FIXTURE_EVIDENCE_VERSION,
    accountRef,
    region: 'us-east-1',
    modelRef,
    modelId: model.modelId,
    routeKind: route.kind,
    routeId: route.id,
    state: 'verified',
    catalogVisible: true,
    callable: true,
    checkedAt: FIXTURE_EVIDENCE_CHECKED_AT,
    freshUntil: FIXTURE_EVIDENCE_FRESH_UNTIL,
    source: 'explicit-agent-mode-access-evidence',
  };
}

function routeEvidence(): Readonly<Record<AdmittedModelRef, RouteEvidence>> {
  const base = {
    state: 'healthy' as const,
    accessState: 'verified' as const,
    checkedAt: FIXTURE_EVIDENCE_CHECKED_AT,
    freshUntil: FIXTURE_EVIDENCE_FRESH_UNTIL,
    evidenceVersion: FIXTURE_EVIDENCE_VERSION,
  };
  return {
    'agent-mode/minimax-m2.5': { ...base, modelRef: 'agent-mode/minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5' },
    'agent-mode/glm-5': { ...base, modelRef: 'agent-mode/glm-5', routeKind: 'direct', routeId: 'zai.glm-5' },
    'agent-mode/claude-opus-4.6': { ...base, modelRef: 'agent-mode/claude-opus-4.6', routeKind: 'inference-profile', routeId: 'us.anthropic.claude-opus-4-6-v1' },
  };
}

function textFromUnknown(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const content = Array.isArray(record.content) ? record.content : [];
  return content.flatMap((block) => {
    if (!block || typeof block !== 'object') return [];
    const candidate = block as Record<string, unknown>;
    if (typeof candidate.text === 'string') return [candidate.text];
    if (candidate.type === 'tool-result' && Array.isArray(candidate.content)) return candidate.content.flatMap((item) => typeof (item as Record<string, unknown>)?.text === 'string' ? [(item as Record<string, unknown>).text as string] : []);
    return [];
  }).join('');
}

function latestToolResult(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  for (const message of [...messages].reverse()) {
    if (!message || typeof message !== 'object') continue;
    const content: unknown[] = Array.isArray((message as Record<string, unknown>).content) ? (message as Record<string, unknown>).content as unknown[] : [];
    const toolResult = content.find((block) => block && typeof block === 'object' && (block as Record<string, unknown>).type === 'tool-result') as Record<string, unknown> | undefined;
    if (!toolResult || !Array.isArray(toolResult.content)) continue;
    return toolResult.content.flatMap((block) => block && typeof block === 'object' && typeof (block as Record<string, unknown>).text === 'string' ? [(block as Record<string, unknown>).text as string] : []).join('');
  }
  return '';
}

function firstPrompt(messages: unknown, fallback: string): string {
  if (!Array.isArray(messages)) return fallback;
  for (const message of messages) {
    const text = textFromUnknown(message);
    if (text) return text;
  }
  return fallback;
}

function createLineServer(handler: (request: ParentBridgeRequest) => Promise<ParentBridgeResponse>): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve, reject) => {
    const socketPath = path.join(tmpdir(), `brain-agent-k21-${process.pid}-${Date.now()}.sock`);
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

async function writeHarnessFiles(attemptRoot: string, harnessRoot: string): Promise<{ patchPath: string; pluginPath: string }> {
  const { createBridgePluginSource } = await import(new URL('../../../../tools/scripts/agent-mode-k21-harness-bridge-plugin.mjs', import.meta.url).href);
  const llmRuntime = pathToFileURL(path.join(harnessRoot, 'packages/llm/llm/lib/index.js')).href;
  const toolsRuntime = pathToFileURL(path.join(harnessRoot, 'packages/core/tools/lib/index.js')).href;
  const pluginPath = path.join(attemptRoot, 'brain-k21-bridge.mjs');
  const patchPath = path.join(attemptRoot, 'brain-k21-restricted.patch.yml');
  await writeFile(pluginPath, createBridgePluginSource({ llmRuntime, toolsRuntime }), { mode: 0o600, flag: 'wx' });
  const disabled = ['llm-deepseek', 'sandbox', 'sandbox-policy', 'subprocess', 'pty', 'terminal-bash', 'terminal-pwsh', 'fs-local', 'persistent-bash', 'persistent-pwsh', 'str-replace-editor', 'jobs', 'subagents', 'sessions'];
  const rows = disabled.map((id) => `- id: ${id}\n  disabled: true`).join('\n');
  await writeFile(patchPath, `${rows}\n- insert:\n    - id: brain-k21-bridge\n      name: ${pluginPath}\n      inject: [llm, tools]\n`, { mode: 0o600, flag: 'wx' });
  return { patchPath, pluginPath };
}

export async function runLiveAgentModeSlice(options: LiveAgentModeSliceOptions): Promise<LiveAgentModeSliceResult> {
  const now = isoNow(options.now);
  const deadline = deadlineFrom(now);
  const taskText = options.taskText ?? `Read ${FIXTURE_RELATIVE_PATH} using the brain_read tool. Return only the marker value, not the file path.`;
  const taskId = 'task:k2-1-live-read';
  const runId = 'run:k2-1-live-read';
  const attemptId = 'attempt:k2-1-live-read';
  const jarvisAgentId = 'agent:jarvis';
  const workerAgentId = 'agent:worker-k2-1';
  const operationId = 'operation:k2-1-repo-read';
  const budgetScopeId = 'budget:k2-1-root';
  const reservationId = 'reservation:k2-1-live-read';
  const resourceKey = 'resource:k2-1-brain-node';
  const leaseId = 'lease:k2-1-live-read';
  const nodeId = 'node:brain-local-k2-1';
  const controllerRef = 'controller:brain-agent-k2-1';
  const policyVersion = AGENT_MODE_TIER_POLICY_VERSION;
  const scopeHash = hashNodeReadScope('fixture:k2-1', 'brain-core', FIXTURE_RELATIVE_PATH);
  const authProof = hash(`${controllerRef}:${nodeId}:${attemptId}`);
  const selectedModel = options.modelRef ?? LIVE_MODEL;
  const accountRef = options.accountRef ?? (options.fixtureMode ? FIXTURE_ACCOUNT_REF : process.env.BRAIN_AGENT_MODE_ACCOUNT_REF);
  if (!accountRef) throw new Error('BRAIN_AGENT_MODE_ACCOUNT_REF or accountRef is required; refusing implicit provider identity');
  const selectedRouteEvidence = options.routeEvidence ?? (options.fixtureMode ? routeEvidence() : undefined);
  if (!selectedRouteEvidence) throw new Error('explicit route evidence is required; refusing implicit access evidence');
  const selectedAccessEvidence = options.modelAccessEvidence ?? (options.fixtureMode ? accessEvidence(selectedModel, accountRef) : undefined);
  if (!selectedAccessEvidence) throw new Error('explicit model access evidence is required; refusing fixture evidence outside fixture mode');
  const store = new AgentModeSqliteStateStore(options.databasePath);
  const model = AGENT_MODE_MODEL_ROUTES[selectedModel];
  const selectedRoute = model.routes[0]!;
  const routeId = selectedRoute.id;
  const runtimeRef = `runtime:deepseek-harness:${DEEPSEEK_HARNESS_PIN.commit}`;
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let modelTurns = 0;
  let toolCalls = 0;
  let toolReceipt: BrainNodeReceipt | undefined;
  let server: Server | undefined;
  let socketPath: string | undefined;
  let attemptRoot: string | undefined;
  let finalResponse = '';

  const gateway: ModelGateway = options.gateway ?? (await import('../adapters/amazon-bedrock-model-gateway.js').then(({ AmazonBedrockModelGateway }) => new AmazonBedrockModelGateway({ accountRef })));
  const policy = selectAgentModeModel({
    taskClass: 'worker', requiredContextTokens: 2_000, requiredOutputTokens: 512,
    requiredCapability: BRAIN_NODE_READ_CAPABILITY, budgetScopeId, rootBudgetScopeId: budgetScopeId,
    maxDollars: 0.01, inputTokens: 1_000, outputTokens: 512, now, routeEvidence: selectedRouteEvidence, selectionMode: options.modelRef ? 'manual' : 'auto', phase: 'root', ...(options.modelRef ? { manualModelRef: options.modelRef } : {}),
  });
  if (!policy.ok || policy.modelRef !== selectedModel || policy.route?.routeId !== routeId) { store.close(); throw new Error(`K2.1 policy admission failed: ${policy.reason}`); }

  store.upsertAgent({ agentId: jarvisAgentId, agentKind: 'jarvis', role: 'persistent-orchestrator', displayName: 'Jarvis', policyId: policyVersion, status: 'active' });
  store.upsertAgent({ agentId: workerAgentId, agentKind: 'worker', role: 'read-only-repository-worker', displayName: 'Agent Mode Worker', policyId: policyVersion, status: 'active' });
  store.recordEvent({ eventId: `jarvis-delegated:${taskId}`, entityType: 'agent', entityId: jarvisAgentId, eventType: 'jarvis_delegated_worker', occurredAt: now, payload: { workerAgentId, taskId, taskClass: 'worker' } });
  store.admitAttempt({
    task: { taskId, taskType: 'agent-mode.k2-1.read-only-marker', inputHash: hash(taskText), createdAt: now },
    run: { runId, taskId, agentId: workerAgentId, createdAt: now },
    attempt: { attemptId, runId, agentId: workerAgentId, runtimeRef, routeRef: routeId, modelRef: selectedModel, policyVersion, capabilityScopeHash: scopeHash, budgetScopeId, createdAt: now },
    budget: { budgetScopeId, maxSteps: 4, maxTokens: 5_000, maxDollars: 0.01 },
    estimate: { reservationId, steps: 3, tokens: 5_000, dollars: 0.01 },
    lease: { leaseId, resourceKey, ownerId: workerAgentId, expiresAt: deadline },
    now,
  });
  const runtimeIdentity = options.fixtureMode
    ? { startedAt: 'fixture', command: 'brain-agent fixture', token: hash(`fixture:${runId}:${process.pid}`) }
    : readRuntimeProcessIdentity(process.pid, runId);
  if (!runtimeIdentity) { store.close(); throw new Error('owned brain-agent runtime identity could not be established'); }
  store.setRunRuntimePid(runId, process.pid, runtimeIdentity);
  store.recordEvent({ eventId: `policy-admitted:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'policy_admitted_model', occurredAt: now, payload: { modelRef: selectedModel, modelId: model.modelId, routeId, capability: BRAIN_NODE_READ_CAPABILITY, policyVersion, evidenceVersion: options.modelAccessEvidence?.version ?? FIXTURE_EVIDENCE_VERSION } });

  const node = new BrainNodeLocalPerimeter({
    nodeId, resourceRef: 'resource:brain-core-fixture', protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
    capabilities: [{ capabilityId: BRAIN_NODE_READ_CAPABILITY, maxBytes: 4_096 }],
    bindings: [{ resourceId: 'fixture:k2-1', rootPath: options.fixtureRoot, worktreeId: 'brain-core' }],
    platform: { os: process.platform, arch: process.arch }, health: { state: 'available', checkedAt: now },
  }, store, createFixtureAuthenticator({ controllerRef, nodeId, proof: authProof }));

  const respondToParent = async (request: ParentBridgeRequest): Promise<ParentBridgeResponse> => {
    // A control command from another terminal may pause between model/tool
    // turns. Wait for an explicit resume; cancellation/kill remains terminal.
    while (store.getAttempt(attemptId)?.status === 'paused') {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const controlledAttempt = store.getAttempt(attemptId);
    if (!controlledAttempt || ['cancelled', 'failed'].includes(controlledAttempt.status)) {
      return { ok: false, error: 'run_cancelled' };
    }
    if (controlledAttempt.cancellationStatus !== 'running') {
      if (controlledAttempt.cancellationStatus === 'requested') store.acknowledgeCancellation(attemptId, new Date().toISOString());
      if (store.getAttempt(attemptId)?.status && !['completed', 'failed', 'cancelled'].includes(store.getAttempt(attemptId)!.status)) store.finishAttempt(attemptId, 'cancelled', new Date().toISOString());
      store.clearRunRuntimePid(runId);
      return { ok: false, error: 'run_cancelled' };
    }
    if (request.kind === 'tool') {
      if (request.name !== 'brain_read' || !request.args || typeof request.args !== 'object') return { ok: false, error: 'only brain_read is admitted' };
      const relativePath = (request.args as Record<string, unknown>).path;
      if (relativePath !== FIXTURE_RELATIVE_PATH || toolCalls !== 0) return { ok: false, error: 'read path or one-call limit rejected' };
      toolCalls += 1;
      const admittedAttempt = store.getAttempt(attemptId);
      if (admittedAttempt?.leaseFence === undefined) return { ok: false, error: 'admitted lease fence is missing' };
      store.prepareOperation({ operationId, attemptId, effectKind: 'capability.read', capabilityId: BRAIN_NODE_READ_CAPABILITY, grantId: 'grant:k2-1-repo-read', scopeHash, policyVersion, leaseResourceKey: resourceKey, leaseId, leaseFence: admittedAttempt.leaseFence, deadline, preparedAt: now });
      toolReceipt = await node.execute({ protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, controllerRef, nodeId, taskId, runId, attemptId, operationId, capabilityId: BRAIN_NODE_READ_CAPABILITY, resourceId: 'fixture:k2-1', worktreeId: 'brain-core', relativePath: FIXTURE_RELATIVE_PATH, scopeHash, grantId: 'grant:k2-1-repo-read', policyVersion, lease: { resourceKey, leaseId, fence: admittedAttempt.leaseFence }, deadline, correlationId: `corr:${operationId}`, causationId: `cause:tool:${toolCalls}`, authProof }, now);
      if (toolReceipt.status !== 'succeeded' || !toolReceipt.resultText) return { ok: false, error: toolReceipt.errorCode ?? 'BrainNode read failed' };
      store.markOperationVerified(operationId, { resultHash: toolReceipt.resultHash!, evidenceRef: toolReceipt.evidenceRef!, verifiedAt: now });
      return { ok: true, text: toolReceipt.resultText };
    }
    if (request.kind !== 'model') return { ok: false, error: 'unknown bridge request' };
    if (modelTurns >= 3) return { ok: false, error: 'model turn budget exhausted' };
    modelTurns += 1;
    const toolResult = latestToolResult(request.messages);
    const prompt = firstPrompt(request.messages, taskText);
    const messages: BedrockMessage[] = toolResult
      ? [
        { role: 'user', content: [{ text: prompt }] },
        { role: 'assistant', content: [{ toolUse: { toolUseId: 'brain-read-1', name: 'brain_read', input: { path: FIXTURE_RELATIVE_PATH } } }] },
        { role: 'user', content: [{ toolResult: { toolUseId: 'brain-read-1', content: [{ text: toolResult }], status: 'success' } }] },
      ]
      : [{ role: 'user', content: [{ text: `${prompt}\nYou must call the allowlisted brain_read tool exactly once before answering.` }] }];
    let result: NormalizedModelResult;
    try {
      result = await gateway.invoke({
        providerId: 'amazon-bedrock', modelRef: selectedModel, modelId: model.modelId, routeKind: selectedRoute.kind, routeId,
        messages, tools: [BRIDGE_TOOL], maxTokens: 512, operationId: `model:${attemptId}:${modelTurns}`, attemptId, now,
        deadline, accessEvidence: selectedAccessEvidence,
      });
    } catch (error) {
      store.recordEvent({ eventId: `model-error:${attemptId}:${modelTurns}`, entityType: 'attempt', entityId: attemptId, eventType: 'model_bridge_rejected', occurredAt: new Date().toISOString(), payload: { turn: modelTurns, errorCode: error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : 'unknown', reason: error instanceof Error ? error.message : String(error) } });
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    usage.totalTokens += result.usage.totalTokens;
    if (result.toolUses?.length) {
      const toolUse = result.toolUses[0]!;
      if (toolUse.name !== 'brain_read') return { ok: false, error: 'model requested a non-allowlisted tool' };
      return { kind: 'tool_use', toolUseId: toolUse.toolUseId, name: toolUse.name, input: toolUse.input, usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens } };
    }
    if (!result.text) return { ok: false, error: 'model returned neither an allowlisted tool call nor final text' };
    return { kind: 'text', text: result.text, usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens } };
  };

  try {
    attemptRoot = await mkdtemp(path.join(tmpdir(), 'brain-agent-mode-k21-'));
    const isolatedCwd = await mkdtemp(path.join(tmpdir(), 'brain-agent-mode-k21-cwd-'));
    const { patchPath } = await writeHarnessFiles(attemptRoot, options.harnessRoot);
    const topology = verifyRestrictedTopology({ serviceRows: BRAIN_RESTRICTED_PROFILE.allowedServiceRows, toolNames: ['brain_read'], providerIds: ['brain-bedrock'], processIsolation: 'separate-child', environmentPolicy: 'explicit-complete-env', profile: BRAIN_RESTRICTED_PROFILE.name });
    if (!topology.ok) throw new Error(`restricted Harness topology rejected: ${topology.reasons.join('; ')}`);
    store.recordEvent({ eventId: `harness-topology:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'restricted_harness_topology_verified', occurredAt: now, payload: { profile: BRAIN_RESTRICTED_PROFILE.name, commit: DEEPSEEK_HARNESS_PIN.commit, version: DEEPSEEK_HARNESS_PIN.version, processIsolation: 'separate-child', environmentPolicy: 'explicit-complete-env', providerId: 'brain-bedrock', tool: BRAIN_NODE_READ_CAPABILITY } });
    const bridge = await createLineServer(respondToParent);
    server = bridge.server;
    socketPath = bridge.socketPath;
    const sdkPath = path.join(options.harnessRoot, 'packages/sdk/client/lib/index.js');
    const { DeepSeekHarness } = await import(pathToFileURL(sdkPath).href);
    const childHome = path.join(attemptRoot, 'home');
    const childTmp = path.join(attemptRoot, 'tmp');
    const harness = new DeepSeekHarness({
      profile: 'sdk-minimal', patches: [patchPath], dshHome: childHome, processCwd: options.harnessRoot,
      cwd: isolatedCwd,
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: childHome, TMPDIR: childTmp, LANG: 'C', BRAIN_AGENT_BRIDGE_SOCKET: socketPath },
      provider: 'brain-bedrock', model: model.modelId, maxTokens: 512,
      initializeTimeoutMs: 15_000, requestTimeoutMs: 90_000, disposeEofGraceMs: 200, disposeGraceMs: 3_000,
    });
    const runResult = await harness.run(taskText, { sessionId: 'brain-k2-1-live-read' });
    finalResponse = runResult.finalResponse.trim();
    await harness.close();
    if (toolCalls !== 1 || !toolReceipt || toolReceipt.status !== 'succeeded' || !finalResponse) throw new Error('K2.1 Harness run did not produce exactly one verified read and final response');
    const actualDollars = estimateAgentModeCost(selectedModel, usage.inputTokens, usage.outputTokens);
    const settlement: AgentModeBudgetSettlement = { reservationId, steps: modelTurns + toolCalls, tokens: usage.totalTokens, dollars: actualDollars ?? 0, settledAt: new Date().toISOString() };
    store.settleBudget(settlement);
    store.recordEvent({ eventId: `result:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'jarvis_result_returned', occurredAt: settlement.settledAt, payload: { runId, taskId, finalResponse, resultHash: hash(finalResponse), evidenceRef: toolReceipt.evidenceRef, modelTurns, toolCalls, usage, actualCostUsd: actualDollars, capability: BRAIN_NODE_READ_CAPABILITY } });
    store.finishAttempt(attemptId, 'completed', settlement.settledAt);
    store.clearRunRuntimePid(runId);
    const observed = store.getAttempt(attemptId);
    if (!observed || observed.status !== 'completed') throw new Error('durable attempt did not finish completed');
    store.close();
    const reopened = AgentModeSqliteStateStore.openExisting(options.databasePath);
    const restartVerified = Boolean(reopened?.getAttempt(attemptId)?.status === 'completed' && reopened?.listRecentEvents(500).some((event) => event.eventId === `result:${attemptId}`));
    reopened?.close();
    if (!restartVerified) throw new Error('StateStore close/reopen did not preserve the durable result');
    return { status: 'completed', taskId, runId, attemptId, jarvisAgentId, workerAgentId, modelRef: selectedModel, modelId: model.modelId, routeId, runtimeRef, harnessCommit: DEEPSEEK_HARNESS_PIN.commit, harnessVersion: DEEPSEEK_HARNESS_PIN.version, harnessProcessIsolation: 'separate-child', capability: BRAIN_NODE_READ_CAPABILITY, toolCalls, modelTurns, usage, estimatedCostUsd: actualDollars, finalResponse, nodeReceipt: toolReceipt, restartVerified, databasePath: options.databasePath, ...(options.keepAttemptArtifacts && attemptRoot ? { attemptArtifacts: attemptRoot } : {}) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (store.getAttempt(attemptId)?.status && !['completed', 'failed', 'cancelled'].includes(store.getAttempt(attemptId)!.status)) {
      store.recordEvent({ eventId: `failure:${attemptId}`, entityType: 'attempt', entityId: attemptId, eventType: 'live_slice_failed', occurredAt: new Date().toISOString(), payload: { reason, modelTurns, toolCalls, usage } });
      store.finishAttempt(attemptId, 'failed', new Date().toISOString());
    }
    try { store.clearRunRuntimePid(runId); } catch { /* store may already be closed */ }
    store.close();
    throw error;
  } finally {
    const activeServer = server;
    if (activeServer) await new Promise<void>((resolve) => activeServer.close(() => resolve()));
    if (socketPath) await rm(socketPath, { force: true }).catch(() => {});
    if (attemptRoot && !options.keepAttemptArtifacts) await rm(attemptRoot, { recursive: true, force: true });
  }
}
