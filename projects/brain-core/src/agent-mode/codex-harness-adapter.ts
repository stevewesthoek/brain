import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { CODEX_CLI_RUNTIME_PROFILE_REF, CODEX_CLI_RUNTIME_REF } from './child-assignment.js';
import { applyCodexTelemetry, emptyExecutionTelemetry, finishExecutionTelemetry, parseCodexTelemetryLine, type AgentModeExecutionTelemetry, type ParsedCodexTelemetry } from './execution-telemetry.js';
import { BrainHarnessEventBuffer, type BrainHarnessAdapter, type BrainHarnessDescriptor, type BrainHarnessEvent, type BrainHarnessHandle, type BrainHarnessInspection, type BrainHarnessObservedUsage, type BrainHarnessResult, type BrainHarnessSettlementUsage, type BrainHarnessStartInput, type BrainHarnessStopResult, type HarnessCompatibilityProbe, validateBrainHarnessStartInput } from './harness-spi.js';
import type { JarvisAttemptExecutionScopeV1 } from './jarvis-local-context.js';

const MAX_RESULT_TEXT = 12_000;
const MAX_STDERR = 2_000;
const CODEX_ADAPTER_ID = 'brain.harness.codex-cli';
const CODEX_REQUIRED_HELP_FLAGS = ['--json', '--output-last-message', '--sandbox', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check'] as const;

type CodexSession = {
  handle: BrainHarnessHandle;
  input: BrainHarnessStartInput;
  controller: AbortController;
  events: BrainHarnessEventBuffer;
  child?: ChildProcess;
  telemetry: AgentModeExecutionTelemetry;
  startedAt: string;
  updatedAt: string;
  status: BrainHarnessInspection['status'];
};

function digest(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function bounded(value: string, max: number): string { return value.slice(0, max); }

/**
 * Zero-context execution is isolated by default. A separately configured
 * host-managed auth mode may retain the host HOME solely for vendor CLI
 * authentication; the execution cwd and admitted filesystem contexts remain
 * independently bounded.
 */
export function shouldIsolateCodexHome(contextCount: number): boolean {
  return contextCount === 0 && process.env.BRAIN_CODEX_AUTH_MODE !== 'host-managed';
}

type ProbeProcessResult = { spawned: boolean; exitCode: number | null; stdout: string; stderr: string };

function runProbeProcess(command: string, args: readonly string[]): Promise<ProbeProcessResult> {
  return new Promise((resolve) => {
    execFile(command, [...args], { env: buildCodexEnvironment(command), shell: false, timeout: 2_000, maxBuffer: 32_768 }, (error, stdout, stderr) => {
      const code = error && typeof error.code === 'number' ? error.code : error ? null : 0;
      const spawned = !(error && (error as NodeJS.ErrnoException).code === 'ENOENT');
      resolve({ spawned, exitCode: code, stdout: bounded(String(stdout ?? ''), 32_768), stderr: bounded(String(stderr ?? ''), 4_000) });
    });
  });
}

function observedVendorVersion(output: string): string | null {
  const version = output.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/u)?.[0];
  return version ?? (output.trim().split(/\r?\n/u)[0]?.slice(0, 128) || null);
}

/** Keep executable lookup and harmless locale/terminal metadata; omit credential-bearing variables. */
export function buildCodexEnvironment(command: string, isolatedHome?: string): NodeJS.ProcessEnv {
  const commandDirectory = path.dirname(command);
  const inheritedPath = process.env.PATH ?? '';
  const childPath = [commandDirectory === '.' ? null : commandDirectory, inheritedPath, '/usr/bin:/bin:/usr/sbin:/sbin'].filter((entry): entry is string => Boolean(entry)).join(':');
  const environment: NodeJS.ProcessEnv = { PATH: childPath };
  for (const key of ['HOME', 'TMPDIR', 'TMP', 'LANG', 'LC_ALL', 'TERM', 'NO_COLOR']) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  if (isolatedHome) environment.HOME = isolatedHome;
  return environment;
}

function mapTelemetryEvent(session: CodexSession, parsed: ParsedCodexTelemetry): void {
  session.telemetry = applyCodexTelemetry(session.telemetry, parsed);
  session.updatedAt = parsed.event.occurredAt;
  if (parsed.sessionId) session.handle.externalSessionId = parsed.sessionId;
  const base = { occurredAt: parsed.event.occurredAt, telemetry: session.telemetry };
  if (parsed.usage || parsed.context) {
    const usage = Object.fromEntries(Object.entries(parsed.usage ?? {}).filter(([, value]) => typeof value === 'number')) as Partial<BrainHarnessObservedUsage>;
    session.events.push({ type: 'usage', ...base, usage, ...(parsed.context ? { context: { usedTokens: parsed.context.usedTokens ?? null, maximumTokens: parsed.context.maximumTokens ?? null, percentage: parsed.context.percentage ?? null } } : {}) });
  } else {
    session.events.push({ type: 'activity', ...base, safeActivity: parsed.event.safeActivity, ...(parsed.event.status ? { status: parsed.event.status } : {}), ...(parsed.sessionId ? { externalSessionId: parsed.sessionId } : {}), ...(parsed.modelRef ? { modelRef: parsed.modelRef } : {}), ...(parsed.provider ? { provider: parsed.provider } : {}) });
  }
}

function settlementUsage(telemetry: AgentModeExecutionTelemetry): BrainHarnessSettlementUsage {
  return {
    steps: 1,
    // These numeric fields are K4's admitted settlement envelope. They are
    // intentionally separate from nullable provider observations below.
    tokens: 0,
    // A null provider estimate is not an observed $0.00. K4's numeric field
    // remains zero because this Codex profile has no admitted pricing ledger.
    cost: telemetry.cost.estimatedUsd ?? 0,
  };
}

function runCodexProcess(session: CodexSession, command: string, args: string[], cwd: string, input: string, onLine: (line: string, index: number) => void, isolatedHome?: string): Promise<{ code: number | null; signal: string | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: buildCodexEnvironment(command, isolatedHome), shell: false, stdio: ['pipe', 'pipe', 'pipe'], signal: session.controller.signal });
    session.child = child;
    let stderr = '';
    let stdoutBuffer = '';
    let lineIndex = 0;
    const consume = (chunk: string): void => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/u);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        onLine(line, lineIndex);
        lineIndex += 1;
      }
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => consume(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr = bounded(`${stderr}${chunk}`, MAX_STDERR); });
    child.once('error', (error) => reject(error));
    child.once('close', (code, terminationSignal) => {
      if (stdoutBuffer.length > 0) onLine(stdoutBuffer, lineIndex);
      resolve({ code, signal: terminationSignal, stderr });
    });
    child.stdin.end(input);
  });
}

export class CodexHarnessAdapter implements BrainHarnessAdapter {
  private readonly sessions = new Map<string, CodexSession>();

  constructor(private readonly command = process.env.BRAIN_CODEX_BIN ?? 'codex') {}

  describe(): BrainHarnessDescriptor {
    return {
      schemaVersion: 'brain-harness-spi.v1',
      adapterId: CODEX_ADAPTER_ID,
      adapterVersion: '1',
      installationClass: 'VENDOR_OR_USER_MANAGED',
      protocol: 'jsonl',
      capabilities: {
        structuredEvents: 'SUPPORTED', streamingResult: 'UNSUPPORTED', tokenUsage: 'SUPPORTED', contextUsage: 'SUPPORTED', costUsage: 'UNKNOWN', toolEvents: 'UNKNOWN', resume: 'UNSUPPORTED', cancel: 'SUPPORTED', inspect: 'SUPPORTED', filesystem: 'SUPPORTED', shell: 'UNKNOWN', browser: 'UNSUPPORTED', MCP: 'UNKNOWN', subagents: 'UNKNOWN',
      },
    };
  }

  async probeCompatibility(): Promise<HarnessCompatibilityProbe> {
    const checkedAt = new Date().toISOString();
    const versionProbe = await runProbeProcess(this.command, ['--version']);
    const staticCapabilities = this.describe().capabilities;
    if (!versionProbe.spawned) {
      return { schemaVersion: 'brain-harness-spi.v1', adapterId: CODEX_ADAPTER_ID, checkedAt, binaryDiscoverable: false, observedVendorVersion: null, structuredProtocol: 'INCOMPATIBLE', mandatoryContractCompatible: false, optionalCapabilities: staticCapabilities, reasonCode: 'BINARY_NOT_FOUND' };
    }
    const helpProbe = await runProbeProcess(this.command, ['exec', '--help']);
    const help = `${helpProbe.stdout}\n${helpProbe.stderr}`;
    const protocolCompatible = helpProbe.exitCode === 0 && CODEX_REQUIRED_HELP_FLAGS.every((flag) => help.includes(flag));
    return {
      schemaVersion: 'brain-harness-spi.v1',
      adapterId: CODEX_ADAPTER_ID,
      checkedAt,
      binaryDiscoverable: true,
      observedVendorVersion: observedVendorVersion(versionProbe.stdout),
      structuredProtocol: protocolCompatible ? 'COMPATIBLE' : 'INCOMPATIBLE',
      mandatoryContractCompatible: protocolCompatible,
      optionalCapabilities: staticCapabilities,
      reasonCode: protocolCompatible ? 'COMPATIBLE' : 'PROTOCOL_UNSUPPORTED',
    };
  }

  async start(input: BrainHarnessStartInput): Promise<BrainHarnessHandle> {
    if (!validateBrainHarnessStartInput(input)) throw new Error('HARNESS_START_INPUT_INVALID');
    const executionId = `harness-execution:codex:${digest(`${input.brainAttemptId}:${input.correlation.dispatchId}`).slice(0, 48)}`;
    const startedAt = new Date().toISOString();
    const handle = { executionId, externalSessionId: null, result: Promise.resolve(undefined as unknown as BrainHarnessResult) };
    const session: CodexSession = {
      handle,
      input,
      controller: new AbortController(),
      events: new BrainHarnessEventBuffer(),
      telemetry: emptyExecutionTelemetry({ runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF, startedAt, modelRef: input.requestedModel }),
      startedAt,
      updatedAt: startedAt,
      status: 'starting',
    };
    const result = this.execute(session);
    handle.result = result;
    this.sessions.set(executionId, session);
    void result.catch(() => undefined);
    return handle;
  }

  events(handle: BrainHarnessHandle): AsyncIterable<BrainHarnessEvent> {
    const session = this.sessions.get(handle.executionId);
    if (!session) throw new Error('HARNESS_HANDLE_UNKNOWN');
    return session.events;
  }

  async stop(handle: BrainHarnessHandle, _reason: string): Promise<BrainHarnessStopResult> {
    const session = this.sessions.get(handle.executionId);
    if (!session) return { status: 'unsupported', reasonCode: 'HARNESS_HANDLE_UNKNOWN' };
    if (['succeeded', 'failed', 'cancelled', 'uncertain'].includes(session.status)) return { status: 'already-terminal' };
    session.controller.abort();
    return { status: 'requested' };
  }

  async inspect(handle: BrainHarnessHandle): Promise<BrainHarnessInspection> {
    const session = this.sessions.get(handle.executionId);
    if (!session) throw new Error('HARNESS_HANDLE_UNKNOWN');
    return { executionId: session.handle.executionId, externalSessionId: session.handle.externalSessionId, status: session.status, startedAt: session.startedAt, updatedAt: session.updatedAt };
  }

  async close(handle: BrainHarnessHandle): Promise<void> {
    const session = this.sessions.get(handle.executionId);
    if (!session) return;
    if (!['succeeded', 'failed', 'cancelled', 'uncertain'].includes(session.status)) session.controller.abort();
    await handle.result.catch(() => undefined);
    this.sessions.delete(handle.executionId);
  }

  private async execute(session: CodexSession): Promise<BrainHarnessResult> {
    session.status = 'running';
    session.events.push({ type: 'started', occurredAt: session.startedAt, executionId: session.handle.executionId });
    const compatibility = await this.probeCompatibility();
    if (!compatibility.mandatoryContractCompatible) {
      const resultHash = digest(`codex-harness-incompatible:${compatibility.reasonCode}:${compatibility.observedVendorVersion ?? 'unknown'}`);
      const updatedAt = new Date().toISOString();
      session.status = 'failed';
      session.telemetry = finishExecutionTelemetry(session.telemetry, 'failed', updatedAt);
      session.events.push({ type: 'failure', occurredAt: updatedAt, reasonCode: compatibility.reasonCode, telemetry: session.telemetry });
      session.events.push({ type: 'completed', occurredAt: updatedAt, status: 'failed', telemetry: session.telemetry });
      session.events.end();
      return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, settlement: { steps: 0, tokens: 0, cost: 0 }, failureCode: `CODEX_${compatibility.reasonCode}`, traceSummary: ['Codex compatibility probe denied execution'], telemetry: session.telemetry };
    }
    const temporaryRoot = path.join(tmpdir(), 'brain-agent-mode-codex-');
    const directory = await mkdtemp(temporaryRoot);
    const outputPath = path.join(directory, 'last-message.txt');
    const executionScope = legacyOrCanonicalScope(session.input);
    if (executionScope.contexts.some((context) => context.admittedAccess !== 'read')) {
      const resultHash = digest('codex-write-scope-denied');
      session.status = 'failed';
      session.telemetry = finishExecutionTelemetry(session.telemetry, 'failed', new Date().toISOString());
      session.events.push({ type: 'failure', occurredAt: session.telemetry.updatedAt, reasonCode: 'WRITE_SCOPE_UNSUPPORTED', telemetry: session.telemetry });
      session.events.push({ type: 'completed', occurredAt: session.telemetry.updatedAt, status: 'failed', telemetry: session.telemetry });
      session.events.end();
      await rm(directory, { recursive: true, force: true });
      return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, settlement: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'WRITE_SCOPE_UNSUPPORTED', traceSummary: ['Codex adapter accepts read-only Attempt scopes only'], telemetry: session.telemetry };
    }
    const emptyWorkspace = executionScope.contexts.length === 0 ? await mkdtemp(path.join(tmpdir(), 'brain-agent-mode-codex-empty-')) : null;
    const primaryRoot = executionScope.contexts[0]?.canonicalPath ?? emptyWorkspace!;
    const isolatedHome = shouldIsolateCodexHome(executionScope.contexts.length) ? await mkdtemp(path.join(tmpdir(), 'brain-agent-mode-codex-home-')) : undefined;
    const args = ['exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '-C', primaryRoot, '--output-last-message', outputPath];
    for (const context of executionScope.contexts.slice(1)) args.push('--add-dir', context.canonicalPath);
    if (session.input.requestedModel) args.push('--model', session.input.requestedModel);
    args.push('-');
    const parseLine = (line: string, index: number): void => {
      const parsed = parseCodexTelemetryLine(line, index);
      if (parsed) mapTelemetryEvent(session, parsed);
      else if (line.trim().length > 0) session.events.push({ type: 'unknown', occurredAt: new Date().toISOString(), sourceType: 'unrecognized', safeActivity: 'Unrecognized harness event' });
    };
    try {
      const outcome = await runCodexProcess(session, this.command, args, primaryRoot, session.input.taskText, parseLine, isolatedHome);
      if (session.controller.signal.aborted || outcome.signal === 'SIGTERM' || outcome.signal === 'SIGINT') {
        const resultHash = digest('terminal-intake-cancelled');
        session.status = 'cancelled';
        session.telemetry = finishExecutionTelemetry(session.telemetry, 'cancelled', new Date().toISOString());
        session.events.push({ type: 'cancelled', occurredAt: session.telemetry.updatedAt, reasonCode: 'CANCELLED', telemetry: session.telemetry });
        session.events.push({ type: 'completed', occurredAt: session.telemetry.updatedAt, status: 'cancelled', telemetry: session.telemetry });
        return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, settlement: settlementUsage(session.telemetry), failureCode: 'CANCELLED', traceSummary: ['Brain cancellation authority observed'], cancellationObserved: true, telemetry: session.telemetry };
      }
      let resultText = '';
      try { resultText = bounded(await readFile(outputPath, 'utf8'), MAX_RESULT_TEXT).trim(); } catch { resultText = ''; }
      if (outcome.code !== 0 || !resultText) {
        const failureCode = outcome.code === null ? 'CODEX_PROCESS_SIGNAL' : outcome.code === 127 ? 'CODEX_NOT_FOUND' : 'CODEX_EXEC_FAILED';
        // K4 owns the runtime result contract.  Do not copy provider stderr
        // into the bounded trace summary: it may be arbitrarily verbose (and
        // may contain provider-specific diagnostics), while the Brain result
        // contract permits only short structured trace entries.  The complete
        // stderr remains intentionally unpersisted; the failure code is the
        // durable control-plane fact.
        const detail = bounded(outcome.stderr, MAX_STDERR);
        const resultHash = digest(`${failureCode}:${detail}`);
        session.status = 'failed';
        session.telemetry = finishExecutionTelemetry(session.telemetry, 'failed', new Date().toISOString());
        session.events.push({ type: 'failure', occurredAt: session.telemetry.updatedAt, reasonCode: failureCode, telemetry: session.telemetry });
        session.events.push({ type: 'completed', occurredAt: session.telemetry.updatedAt, status: 'failed', telemetry: session.telemetry });
        return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, settlement: settlementUsage(session.telemetry), failureCode, traceSummary: [failureCode], telemetry: session.telemetry };
      }
      const resultHash = digest(resultText);
      session.status = 'succeeded';
      session.telemetry = finishExecutionTelemetry(session.telemetry, 'succeeded', new Date().toISOString());
      const evidenceRef = `evidence:codex:${resultHash.slice(0, 48)}`;
      session.events.push({ type: 'result', occurredAt: session.telemetry.updatedAt, resultRef: `result:codex:${resultHash.slice(0, 48)}`, evidenceRef, telemetry: session.telemetry });
      session.events.push({ type: 'completed', occurredAt: session.telemetry.updatedAt, status: 'succeeded', telemetry: session.telemetry });
      return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef, settlement: settlementUsage(session.telemetry), traceSummary: ['codex-cli', 'sandbox:read-only'], resultText, telemetry: session.telemetry };
    } finally {
      session.updatedAt = session.telemetry.updatedAt;
      session.events.end();
      await rm(directory, { recursive: true, force: true });
      if (emptyWorkspace) await rm(emptyWorkspace, { recursive: true, force: true });
      if (isolatedHome) await rm(isolatedHome, { recursive: true, force: true });
    }
  }
}

function legacyOrCanonicalScope(input: BrainHarnessStartInput): JarvisAttemptExecutionScopeV1 {
  if (input.executionScope) return input.executionScope;
  const workspace = input.workspace;
  if (!workspace) return { schemaVersion: 'agent-mode.attempt-execution-scope.v1', scopeId: `attempt-scope:empty:${digest(input.brainAttemptId).slice(0, 32)}`, rootGoalId: input.correlation.rootGoalId, attemptId: input.correlation.attemptId, contexts: [], scopeDigest: digest('empty') };
  const contextId = `context:legacy:${digest(`${workspace.repositoryRef}:${workspace.repositoryRoot}`).slice(0, 32)}`;
  const context = { contextId, kind: 'repository' as const, canonicalPath: workspace.repositoryRoot, repositoryRef: workspace.repositoryRef, admittedAccess: 'read' as const, recursive: true };
  return { schemaVersion: 'agent-mode.attempt-execution-scope.v1', scopeId: `attempt-scope:legacy:${digest(contextId).slice(0, 32)}`, rootGoalId: input.correlation.rootGoalId, attemptId: input.correlation.attemptId, contexts: [context], scopeDigest: digest(JSON.stringify({ rootGoalId: input.correlation.rootGoalId, attemptId: input.correlation.attemptId, contexts: [context] })) };
}
