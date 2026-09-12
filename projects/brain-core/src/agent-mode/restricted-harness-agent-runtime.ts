import { createHash } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BRAIN_RESTRICTED_PROFILE, DEEPSEEK_HARNESS_PIN, verifyRestrictedTopology } from './deepseek-harness-restricted-profile.js';
import { RESTRICTED_HARNESS_PROFILE_REF, RESTRICTED_HARNESS_RUNTIME_REF } from './child-assignment.js';
import type { AgentRuntime, AgentRuntimeExecutionContext, AgentRuntimeResult } from './runtime-dispatch.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { readRuntimeProcessIdentity, type RuntimeProcessIdentity } from './runtime-process-identity.js';
import { ModelGatewayError, type NormalizedModelResult } from './model-gateway.js';

export const RESTRICTED_HARNESS_FIXTURE_RESPONSE = 'BRAIN_K4_2_D2_HARNESS_PROCESS_PASS';
export const K43A_LIVE_EXPECTED_RESPONSE = 'BRAIN_K4_3_A_LIVE_MINIMAX_PASS';
export const K43A_LIVE_MODEL_PROMPT = 'Return exactly the following token and no other text: BRAIN_K4_3_A_LIVE_MINIMAX_PASS';
export const K43A_MAX_TOKENS = 1024 as const;
export const RESTRICTED_HARNESS_FIXTURE_TIMEOUT_MS = 10_000;
export const RESTRICTED_HARNESS_LIVE_MODEL_TIMEOUT_MS = 90_000;
const MAX_PROTOCOL_BYTES = 16 * 1024;
const MAX_DIAGNOSTIC_CHARS = 512;
const PROCESS_COMMAND_IDENTITY = 'deepseek-harness:' + DEEPSEEK_HARNESS_PIN.commit;
const CHILD_PATH_MARKER = '--profile';

export type RestrictedHarnessFixtureOutcome = 'success' | 'failure' | 'wait' | 'crash';

export type RestrictedHarnessAgentRuntimeOptions = {
  store: AgentModeSqliteStateStore;
  harnessRoot: string;
  evidenceRoot?: string;
  fixtureOutcome?: RestrictedHarnessFixtureOutcome;
  fixtureFailureCode?: string;
  fixtureStarted?: () => void;
  fixtureEnvironmentObserved?: (sentinelPresent: boolean) => void;
  modelPromptObserved?: (prompt: string) => void;
  modelFailureObserved?: (failureCode: string) => void;
  fixtureCheckpoint?: Promise<void>;
  fixtureProtocol?: 'malformed' | 'oversized';
  simulateLostResponse?: boolean;
  startupTimeoutMs?: number;
  executionTimeoutMs?: number;
  shutdownGraceMs?: number;
  /** Brain-owned bridge; the child never receives provider credentials or SDK access. */
  modelBridge?: (input: { context: AgentRuntimeExecutionContext; turn: number; maxTokens: number; prompt: string; signal: AbortSignal; isCancellationRequested: () => boolean }) => Promise<NormalizedModelResult>;
};

type FixtureRequest = { kind: 'fixture'; operationId: string; attemptId: string; environmentHasSentinel?: boolean };
type ModelRequest = { kind: 'model'; operationId: string; attemptId: string; turn: number; maxTokens: number; prompt: string; awsEnvironmentPresent: boolean };
type FixtureResponse = { ok: boolean; outcome?: RestrictedHarnessFixtureOutcome; failureCode?: string; error?: string };
type ModelResponse = { ok: boolean; text?: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number }; error?: string };
type HarnessChild = { pid?: number };
type HarnessClient = { child?: HarnessChild };
type HarnessInstance = {
  client: HarnessClient;
  start(): Promise<void>;
  run(input: string, options?: { sessionId?: string }): Promise<{ finalResponse: string }>;
  close(): Promise<void>;
};
type DurableHarnessEvidence = {
  schemaVersion: 1;
  operationId: string;
  dispatchId: string;
  attemptId: string;
  runId: string;
  childAgentId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  processIdentity: RuntimeProcessIdentity;
  result: AgentRuntimeResult;
};

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function boundedDiagnostic(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value);
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MAX_DIAGNOSTIC_CHARS);
}
function protocolLine(value: unknown): string {
  const line = JSON.stringify(value);
  if (Buffer.byteLength(line, 'utf8') > MAX_PROTOCOL_BYTES) throw new Error('fixture bridge response exceeds protocol limit');
  return line + '\n';
}

function createFixtureBridge(context: AgentRuntimeExecutionContext, options: RestrictedHarnessAgentRuntimeOptions, signal: AbortSignal, isCancellationRequested: () => boolean): Promise<{ server: Server; socketPath: string; sockets: Set<Socket> }> {
  return new Promise((resolve, reject) => {
    const socketPath = path.join(tmpdir(), 'brain-k42-d2-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.sock');
    const sockets = new Set<Socket>();
    let modelRequestCount = 0;
    const server = createServer((socket: Socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
      let buffer = '';
      let handled = false;
      const rejectProtocol = (message: string) => {
        if (handled) return;
        handled = true;
        socket.end(protocolLine({ ok: false, error: message }));
      };
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        if (handled) return;
        buffer += chunk;
        if (Buffer.byteLength(buffer, 'utf8') > MAX_PROTOCOL_BYTES) {
          rejectProtocol('fixture bridge request exceeds protocol limit');
          return;
        }
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        const line = buffer.slice(0, newline);
        handled = true;
        let request: FixtureRequest | ModelRequest;
        try {
          const parsed = JSON.parse(line) as Partial<{ kind: string; operationId: string; attemptId: string; environmentHasSentinel: boolean; turn: number; maxTokens: number; prompt: string; awsEnvironmentPresent: boolean }>;
          if ((parsed.kind !== 'fixture' && parsed.kind !== 'model') || parsed.operationId !== context.operationId || parsed.attemptId !== context.attemptId) throw new Error('fixture bridge identity mismatch');
          if (parsed.kind === 'model') {
            if (modelRequestCount !== 0) throw new Error('second model turn denied');
            modelRequestCount += 1;
            if (!options.modelBridge || parsed.turn !== 1 || parsed.maxTokens !== K43A_MAX_TOKENS || parsed.prompt !== K43A_LIVE_MODEL_PROMPT || parsed.awsEnvironmentPresent !== false) throw new Error('model bridge request is outside the bounded K4.3-A contract');
            options.fixtureEnvironmentObserved?.(false);
            options.modelPromptObserved?.(parsed.prompt);
            request = { kind: 'model', operationId: parsed.operationId, attemptId: parsed.attemptId, turn: parsed.turn, maxTokens: parsed.maxTokens, prompt: parsed.prompt, awsEnvironmentPresent: false };
          } else {
            request = { kind: 'fixture', operationId: parsed.operationId, attemptId: parsed.attemptId, ...(parsed.environmentHasSentinel === undefined ? {} : { environmentHasSentinel: parsed.environmentHasSentinel }) };
          }
        } catch (error) {
          socket.end(protocolLine({ ok: false, error: boundedDiagnostic(error) }));
          return;
        }
        if (request.kind === 'fixture') {
          options.fixtureEnvironmentObserved?.(request.environmentHasSentinel === true);
          options.fixtureStarted?.();
        }
        if (options.fixtureProtocol === 'malformed') {
          socket.end('{malformed fixture response}\n');
          return;
        }
        if (options.fixtureProtocol === 'oversized') {
          socket.end('x'.repeat(MAX_PROTOCOL_BYTES + 1) + '\n');
          return;
        }
        if (request.kind === 'model') {
          void options.modelBridge!({ context, turn: request.turn, maxTokens: request.maxTokens, prompt: request.prompt, signal, isCancellationRequested }).then(
            (value) => socket.end(protocolLine({ ok: true, text: value.text.slice(0, 4096), usage: value.usage } satisfies ModelResponse)),
            (error) => {
              const failureCode = (boundedDiagnostic(error).split(':', 1)[0] ?? 'MODEL_FAILURE').slice(0, 128);
              options.modelFailureObserved?.(failureCode);
              socket.end(protocolLine({ ok: false, error: failureCode } satisfies ModelResponse));
            },
          );
          return;
        }
        const outcome = options.fixtureOutcome ?? 'success';
        const response = async (): Promise<FixtureResponse> => {
          if (outcome === 'wait' && options.fixtureCheckpoint) await options.fixtureCheckpoint;
          if (outcome === 'failure' || outcome === 'crash') return { ok: true, outcome, failureCode: options.fixtureFailureCode ?? 'D2_FIXTURE_FAILURE' };
          return { ok: true, outcome: 'success' };
        };
        void response().then(
          (value) => socket.end(protocolLine({ ...value, operationId: request.operationId, attemptId: request.attemptId })),
          (error) => socket.end(protocolLine({ ok: false, error: boundedDiagnostic(error) })),
        );
      });
      socket.on('error', () => undefined);
    });
    server.once('error', reject);
    server.listen(socketPath, () => resolve({ server, socketPath, sockets }));
  });
}

async function writeHarnessFixtureFiles(attemptRoot: string, harnessRoot: string, liveModel: boolean): Promise<{ patchPath: string }> {
  const llmRuntime = pathToFileURL(path.join(harnessRoot, 'packages/llm/llm/lib/index.js')).href;
  const pluginPath = path.join(attemptRoot, 'brain-k42-d2-fixture.mjs');
  const patchPath = path.join(attemptRoot, 'brain-k42-d2-restricted.patch.yml');
  const parentRequest = liveModel
    ? `JSON.stringify({ kind: "model", operationId, attemptId, turn: 1, maxTokens: ${K43A_MAX_TOKENS}, prompt: ${JSON.stringify(K43A_LIVE_MODEL_PROMPT)}, awsEnvironmentPresent: Object.keys(process.env).some(key => key.startsWith("AWS_")) })`
    : 'JSON.stringify({ kind: "fixture", operationId, attemptId, environmentHasSentinel: Object.prototype.hasOwnProperty.call(process.env, "BRAIN_D2_PARENT_SENTINEL") })';
  const responseText = liveModel ? 'response.text' : '"BRAIN_K4_2_D2_HARNESS_PROCESS_PASS"';
  const responseUsage = liveModel ? 'response.usage' : '{ inputTokens: 0, outputTokens: 0 }';
  const plugin = [
    'import net from "node:net"',
    'import { LlmAdapter, ReasoningEffortId } from ' + JSON.stringify(llmRuntime),
    'const socketPath = process.env.BRAIN_K42_D2_BRIDGE_SOCKET',
    'const operationId = process.env.BRAIN_K42_D2_OPERATION_ID',
    'const attemptId = process.env.BRAIN_K42_D2_ATTEMPT_ID',
    'if (!socketPath || !operationId || !attemptId) throw new Error("Brain D2 fixture bridge identity is incomplete")',
    `function callParent() { return new Promise((resolve, reject) => { const socket = net.createConnection(socketPath); let buffer = ""; let settled = false; const finish = (fn, value) => { if (settled) return; settled = true; socket.destroy(); fn(value) }; socket.once("error", error => finish(reject, error)); socket.on("data", chunk => { buffer += chunk.toString("utf8"); if (Buffer.byteLength(buffer, "utf8") > 16384) return finish(reject, new Error("fixture bridge response too large")); const newline = buffer.indexOf("\\n"); if (newline < 0) return; try { finish(resolve, JSON.parse(buffer.slice(0, newline))) } catch (error) { finish(reject, error) } }); socket.once("connect", () => socket.write(${parentRequest} + "\\n")) }) }`,
    `class BrainFixtureAdapter extends LlmAdapter { resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model, reasoning: { efforts: [{ id: ReasoningEffortId("default"), name: "Default" }] } }) } async *stream() { const response = await callParent(); if (!response || response.ok !== true) throw new Error(typeof response?.error === "string" ? response.error : "Brain fixture bridge rejected"); if (response.outcome === "failure") throw new Error(typeof response.failureCode === "string" ? response.failureCode : "D2_FIXTURE_FAILURE"); if (response.outcome === "crash") process.exit(17); const text = ${responseText}; if (typeof text !== "string" || text.length === 0) throw new Error("model response text missing"); yield { type: "block-start", index: 0, blockType: "text" }; yield { type: "text-delta", index: 0, text }; yield { type: "block-end", index: 0, block: { type: "text", text } }; yield { type: "usage", usage: ${responseUsage} }; yield { type: "finish", reason: { kind: "stop" } } } }`,
    'export const name = ' + JSON.stringify(liveModel ? 'brain-k43-a-live-minimax' : 'brain-k42-d2-fixture'),
    'export const inject = ["llm"]',
    'export function apply(ctx) { ctx.llm.registerAdapter(["brain-k42-d2-fixture"], new BrainFixtureAdapter()) }',
  ].join('\n');
  await writeFile(pluginPath, plugin, { mode: 0o600, flag: 'wx' });
  const disabled = ['llm-deepseek', 'sandbox', 'sandbox-policy', 'subprocess', 'pty', 'terminal-bash', 'terminal-pwsh', 'fs-local', 'persistent-bash', 'persistent-pwsh', 'str-replace-editor', 'jobs', 'subagents'];
  const rows = disabled.map((id) => '- id: ' + id + '\n  disabled: true').join('\n');
  await writeFile(patchPath, rows + '\n- insert:\n    - id: brain-k42-d2-fixture\n      name: ' + pluginPath + '\n      inject: [llm]\n', { mode: 0o600, flag: 'wx' });
  return { patchPath };
}

async function validateHarnessRoot(input: string): Promise<string> {
  if (!path.isAbsolute(input) || input.split(path.sep).includes('..')) throw new Error('HARNESS_ROOT_INVALID');
  const root = await realpath(input);
  if (path.basename(root) !== DEEPSEEK_HARNESS_PIN.commit) throw new Error('HARNESS_PIN_MISMATCH');
  const clientManifestPath = path.join(root, 'packages/sdk/client/package.json');
  const rootManifestPath = path.join(root, 'package.json');
  const clientPath = path.join(root, 'packages/sdk/client/lib/index.js');
  const llmPath = path.join(root, 'packages/llm/llm/lib/index.js');
  const manifests = [rootManifestPath, clientManifestPath].map((manifestPath) => JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown });
  if (manifests.some((manifest) => manifest.version !== DEEPSEEK_HARNESS_PIN.version)) throw new Error('HARNESS_VERSION_MISMATCH');
  await Promise.all([stat(clientPath), stat(llmPath)]);
  return root;
}

function resultFor(context: AgentRuntimeExecutionContext, status: AgentRuntimeResult['status'], failureCode?: string, modelResult?: NormalizedModelResult): AgentRuntimeResult {
  const response = status === 'succeeded' ? RESTRICTED_HARNESS_FIXTURE_RESPONSE : status === 'cancelled' ? 'cancelled' : failureCode ?? 'failed';
  return {
    status,
    runtimeReceiptId: 'runtime-receipt:harness:' + context.attemptId,
    resultHash: hash(context.operationId + ':' + status + ':' + response),
    evidenceRef: 'evidence:harness:' + context.attemptId,
    usage: { steps: status === 'cancelled' ? 0 : 1, tokens: status === 'succeeded' ? (modelResult?.usage.totalTokens ?? 0) : 0, cost: status === 'succeeded' ? (modelResult?.cost.estimatedUsd ?? 0) : 0 },
    ...(status === 'failed' ? { failureCode: failureCode ?? 'HARNESS_RUNTIME_FAILED' } : {}),
    traceSummary: ['harness:' + DEEPSEEK_HARNESS_PIN.version, 'profile:' + RESTRICTED_HARNESS_PROFILE_REF, 'process:' + status],
    ...(status === 'cancelled' ? { cancellationObserved: true } : {}),
  };
}

function evidencePath(root: string, operationId: string): string { return path.join(root, 'runtime-' + hash(operationId) + '.json'); }

export class RestrictedHarnessAgentRuntime implements AgentRuntime {
  public invocationCount = 0;
  public processLaunchCount = 0;
  public processReapedCount = 0;
  public lastProcessIdentity: RuntimeProcessIdentity | undefined;

  constructor(private readonly options: RestrictedHarnessAgentRuntimeOptions) {}

  async run(input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }): Promise<AgentRuntimeResult> {
    this.invocationCount += 1;
    const context = input.context;
    if (context.runtimeRef !== RESTRICTED_HARNESS_RUNTIME_REF || context.runtimeProfileRef !== RESTRICTED_HARNESS_PROFILE_REF) throw new Error('runtime_profile_not_admitted');
    let harnessRoot: string;
    try {
      harnessRoot = await validateHarnessRoot(this.options.harnessRoot);
    } catch (error) {
      const reason = boundedDiagnostic(error);
      return resultFor(context, 'failed', reason.split(':', 1)[0] || 'HARNESS_START_FAILURE');
    }
    const attemptRoot = await mkdtemp(path.join(tmpdir(), 'brain-k42-d2-attempt-'));
    const isolatedCwd = await mkdtemp(path.join(tmpdir(), 'brain-k42-d2-cwd-'));
    const childHome = path.join(attemptRoot, 'home');
    const childTmp = path.join(attemptRoot, 'tmp');
    await Promise.all([mkdir(childHome), mkdir(childTmp)]);
    await Promise.all([writeFile(path.join(childHome, '.keep'), '', { mode: 0o600 }), writeFile(path.join(childTmp, '.keep'), '', { mode: 0o600 })]);
    const liveModel = Boolean(this.options.modelBridge);
    const executionTimeoutMs = this.options.executionTimeoutMs
      ?? (liveModel ? RESTRICTED_HARNESS_LIVE_MODEL_TIMEOUT_MS : RESTRICTED_HARNESS_FIXTURE_TIMEOUT_MS);
    const files = await writeHarnessFixtureFiles(attemptRoot, harnessRoot, liveModel);
    let modelResult: NormalizedModelResult | undefined;
    let modelFailureCode: string | undefined;
    const bridgeOptions: RestrictedHarnessAgentRuntimeOptions = { ...this.options };
    bridgeOptions.modelFailureObserved = (failureCode) => {
      modelFailureCode = failureCode;
      this.options.modelFailureObserved?.(failureCode);
    };
    if (this.options.modelBridge) bridgeOptions.modelBridge = async (request) => {
        const value = await this.options.modelBridge!(request);
        modelResult = value;
        return value;
      };
    const bridge = await createFixtureBridge(context, bridgeOptions, input.signal, input.isCancellationRequested);
    let harness: HarnessInstance | undefined;
    let persistedIdentity: RuntimeProcessIdentity | undefined;
    let runtimePid: number | undefined;
    let admittedToHarness = false;
    let terminalResult: AgentRuntimeResult | undefined;
    let closeTask: Promise<void> | undefined;
    let processCounted = false;
    const countChildIfPresent = () => {
      if (!processCounted && harness?.client.child?.pid) {
        processCounted = true;
        this.processLaunchCount += 1;
      }
    };
    const closeHarness = async (): Promise<void> => {
      if (!harness) return;
      if (!closeTask) closeTask = harness.close();
      await closeTask;
    };
    const abortHandler = () => { void closeHarness(); };
    input.signal.addEventListener('abort', abortHandler, { once: true });
    try {
      const topology = verifyRestrictedTopology({
        serviceRows: BRAIN_RESTRICTED_PROFILE.allowedServiceRows,
        toolNames: [],
        providerIds: ['brain-k42-d2-fixture'],
        processIsolation: 'separate-child',
        environmentPolicy: 'explicit-complete-env',
        profile: BRAIN_RESTRICTED_PROFILE.name,
      }, { allowedToolNames: [] });
      if (!topology.ok) throw new Error('HARNESS_TOPOLOGY_INVALID:' + topology.reasons.join('|'));
      const sdkPath = path.join(harnessRoot, 'packages/sdk/client/lib/index.js');
      const harnessModule = await import(pathToFileURL(sdkPath).href) as { DeepSeekHarness: new (options: Record<string, unknown>) => HarnessInstance };
      const childEnv: Record<string, string> = {
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
        HOME: childHome,
        TMPDIR: childTmp,
        LANG: 'C',
        BRAIN_K42_D2_BRIDGE_SOCKET: bridge.socketPath,
        BRAIN_K42_D2_OPERATION_ID: context.operationId,
        BRAIN_K42_D2_ATTEMPT_ID: context.attemptId,
      };
      harness = new harnessModule.DeepSeekHarness({
        profile: 'sdk-minimal',
        patches: [files.patchPath],
        dshHome: childHome,
        processCwd: harnessRoot,
        cwd: isolatedCwd,
        env: childEnv,
        provider: 'brain-k42-d2-fixture',
        model: 'brain-k42-d2-fixture',
        maxTokens: 64,
        initializeTimeoutMs: this.options.startupTimeoutMs ?? 5_000,
        requestTimeoutMs: executionTimeoutMs,
        shutdownTimeoutMs: this.options.shutdownGraceMs ?? 500,
        disposeEofGraceMs: this.options.shutdownGraceMs ?? 500,
        disposeGraceMs: this.options.shutdownGraceMs ?? 1_000,
      });
      await harness.start();
      countChildIfPresent();
      const child = harness.client.child;
      if (!child?.pid) throw new Error('HARNESS_PROCESS_ID_MISSING');
      runtimePid = child.pid;
      const identity = readRuntimeProcessIdentity(child.pid, context.runId, { commandMarker: CHILD_PATH_MARKER, commandIdentity: PROCESS_COMMAND_IDENTITY });
      if (!identity) throw new Error('HARNESS_PROCESS_IDENTITY_INVALID');
      if (DEEPSEEK_HARNESS_PIN.version.length === 0) throw new Error('HARNESS_HANDSHAKE_INVALID');
      persistedIdentity = identity;
      this.lastProcessIdentity = identity;
      this.options.store.setRunRuntimePid(context.runId, child.pid, identity);
      this.options.store.recordEvent({ eventId: 'runtime-process-started:' + context.operationId, entityType: 'run', entityId: context.runId, eventType: 'runtime_process_started', occurredAt: new Date().toISOString(), payload: { operationId: context.operationId, dispatchId: context.dispatchId, runtimeRef: context.runtimeRef, runtimeProfileRef: context.runtimeProfileRef, pid: runtimePid, processStartedAt: identity.startedAt, processState: 'running', processIdentityVerified: true } });
      admittedToHarness = true;
      const timer = setTimeout(() => { void closeHarness(); }, executionTimeoutMs);
      try {
        const runResult = await harness.run(liveModel ? K43A_LIVE_MODEL_PROMPT : 'Return the deterministic Brain fixture result.', { sessionId: 'brain-k42-d2-' + context.attemptId });
        if (input.signal.aborted || input.isCancellationRequested()) terminalResult = resultFor(context, 'cancelled');
        else if (Buffer.byteLength(runResult.finalResponse, 'utf8') > MAX_PROTOCOL_BYTES) terminalResult = resultFor(context, 'failed', 'HARNESS_RESULT_TOO_LARGE');
        else if (liveModel && modelFailureCode) terminalResult = resultFor(context, 'failed', modelFailureCode);
        else if (liveModel ? (!modelResult || runResult.finalResponse.trim() !== modelResult.text.trim()) : runResult.finalResponse.trim() !== RESTRICTED_HARNESS_FIXTURE_RESPONSE) terminalResult = resultFor(context, 'failed', 'HARNESS_RESULT_INVALID');
        else terminalResult = resultFor(context, 'succeeded', undefined, modelResult);
      } finally {
        clearTimeout(timer);
      }
      if (terminalResult?.status === 'succeeded' && this.options.evidenceRoot) await this.persistEvidence(context, persistedIdentity, terminalResult);
      if (this.options.simulateLostResponse) throw new Error('runtime_outcome_uncertain');
      if (!terminalResult) throw new Error('HARNESS_RESULT_MISSING');
      return terminalResult;
    } catch (error) {
      countChildIfPresent();
      try {
        this.options.store.recordEvent({ eventId: 'runtime-process-error:' + context.operationId, entityType: 'attempt', entityId: context.attemptId, eventType: 'runtime_process_error', occurredAt: new Date().toISOString(), payload: { errorCode: boundedDiagnostic(error) } });
      } catch { /* diagnostic persistence cannot widen the runtime outcome */ }
      if (input.signal.aborted || input.isCancellationRequested()) terminalResult = resultFor(context, 'cancelled');
      else if (admittedToHarness && this.options.fixtureOutcome === 'failure' && boundedDiagnostic(error).includes(this.options.fixtureFailureCode ?? 'D2_FIXTURE_FAILURE')) terminalResult = resultFor(context, 'failed', this.options.fixtureFailureCode ?? 'D2_FIXTURE_FAILURE');
      else if (admittedToHarness && liveModel && !boundedDiagnostic(error).startsWith('runtime_outcome_uncertain')) terminalResult = resultFor(context, 'failed', error instanceof ModelGatewayError ? `MODEL_${error.code.toUpperCase()}` : boundedDiagnostic(error).split(':', 1)[0] || 'MODEL_FAILURE');
      else if (!admittedToHarness) terminalResult = resultFor(context, 'failed', boundedDiagnostic(error).split(':', 1)[0] || 'HARNESS_START_FAILURE');
      else throw new Error('runtime_outcome_uncertain:' + boundedDiagnostic(error));
      if (terminalResult.status !== 'cancelled' && this.options.evidenceRoot) await this.persistEvidence(context, persistedIdentity, terminalResult);
      return terminalResult;
    } finally {
      input.signal.removeEventListener('abort', abortHandler);
      let closeError: unknown;
      try { await closeHarness(); } catch (error) { closeError = error; }
      if (persistedIdentity) {
        this.processReapedCount += 1;
        try {
          this.options.store.clearRunRuntimePid(context.runId);
          this.options.store.recordEvent({ eventId: 'runtime-process-reaped:' + context.operationId, entityType: 'run', entityId: context.runId, eventType: 'runtime_process_reaped', occurredAt: new Date().toISOString(), payload: { operationId: context.operationId, pid: runtimePid, processState: 'reaped', processIdentityVerified: true, exitClassification: terminalResult?.status === 'cancelled' ? 'cancelled' : terminalResult?.status === 'failed' ? 'known_failure' : terminalResult?.status === 'succeeded' ? 'valid_result' : 'uncertain' } });
        } catch (error) { closeError ??= error; }
      }
      for (const socket of bridge.sockets) socket.destroy();
      await Promise.all([new Promise<void>((resolve) => bridge.server.close(() => resolve())), rm(bridge.socketPath, { force: true }), rm(attemptRoot, { recursive: true, force: true }), rm(isolatedCwd, { recursive: true, force: true })]);
      if (closeError && terminalResult?.status !== 'cancelled') throw new Error('runtime_outcome_uncertain');
    }
  }

  async reconcile(input: { context: AgentRuntimeExecutionContext }): Promise<{ status: 'resolved'; result: AgentRuntimeResult } | { status: 'unsupported' } | { status: 'uncertain' }> {
    if (!this.options.evidenceRoot) return { status: 'unsupported' };
    try {
      const file = evidencePath(this.options.evidenceRoot, input.context.operationId);
      const metadata = await stat(file);
      if (metadata.size > MAX_PROTOCOL_BYTES) return { status: 'uncertain' };
      const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<DurableHarnessEvidence>;
      if (parsed.schemaVersion !== 1 || parsed.operationId !== input.context.operationId || parsed.dispatchId !== input.context.dispatchId || parsed.attemptId !== input.context.attemptId || parsed.runId !== input.context.runId || parsed.childAgentId !== input.context.childAgentId || parsed.runtimeRef !== RESTRICTED_HARNESS_RUNTIME_REF || parsed.runtimeProfileRef !== RESTRICTED_HARNESS_PROFILE_REF || !parsed.result || parsed.result.status === 'cancelled') return { status: 'uncertain' };
      return { status: 'resolved', result: parsed.result };
    } catch { return { status: 'uncertain' }; }
  }

  private async persistEvidence(context: AgentRuntimeExecutionContext, identity: RuntimeProcessIdentity | undefined, result: AgentRuntimeResult): Promise<void> {
    if (!identity || !this.options.evidenceRoot) return;
    await mkdir(this.options.evidenceRoot, { recursive: true });
    const evidence: DurableHarnessEvidence = { schemaVersion: 1, operationId: context.operationId, dispatchId: context.dispatchId, attemptId: context.attemptId, runId: context.runId, childAgentId: context.childAgentId, runtimeRef: context.runtimeRef, runtimeProfileRef: context.runtimeProfileRef, processIdentity: identity, result };
    await writeFile(evidencePath(this.options.evidenceRoot, context.operationId), JSON.stringify(evidence), { mode: 0o600, flag: 'wx' }).catch(async () => {
      const existing = await readFile(evidencePath(this.options.evidenceRoot!, context.operationId), 'utf8');
      if (existing !== JSON.stringify(evidence)) throw new Error('HARNESS_EVIDENCE_CONFLICT');
    });
  }
}
