import { createHash } from 'node:crypto';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { BrainHarnessEventBuffer, type BrainHarnessAdapter, type BrainHarnessDescriptor, type BrainHarnessEvent, type BrainHarnessHandle, type BrainHarnessInspection, type BrainHarnessResult, type BrainHarnessStartInput, type BrainHarnessStopResult, type HarnessCompatibilityProbe, validateBrainHarnessStartInput } from './harness-spi.js';

const ADAPTER_ID = 'brain.harness.claude-code';
const REQUIRED_FLAGS = ['--print', '--output-format', 'stream-json', '--no-session-persistence'] as const;
const MAX_RESULT = 12_000;
const MAX_STDERR = 2_000;

type ClaudeSession = {
  handle: BrainHarnessHandle;
  input: BrainHarnessStartInput;
  events: BrainHarnessEventBuffer;
  controller: AbortController;
  child?: ChildProcess;
  resultText: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; cost: number };
  startedAt: string;
  updatedAt: string;
  status: BrainHarnessInspection['status'];
};

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
function bounded(value: string, max: number): string { return value.slice(0, max); }
function env(command: string): NodeJS.ProcessEnv {
  const directory = command.includes('/') ? command.slice(0, command.lastIndexOf('/')) : '';
  const environment: NodeJS.ProcessEnv = { PATH: [directory, process.env.PATH ?? '', '/usr/bin:/bin:/usr/sbin:/sbin'].filter(Boolean).join(':') };
  for (const key of ['HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'NO_COLOR', 'CLAUDE_CODE_USE_BEDROCK', 'AWS_PROFILE', 'AWS_REGION', 'AWS_DEFAULT_REGION']) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return environment;
}
function probe(command: string, args: readonly string[]): Promise<{ spawned: boolean; code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => execFile(command, [...args], { env: env(command), shell: false, timeout: 2_000, maxBuffer: 32_768 }, (error, stdout, stderr) => resolve({ spawned: !(error && (error as NodeJS.ErrnoException).code === 'ENOENT'), code: error && typeof error.code === 'number' ? error.code : error ? null : 0, stdout: bounded(String(stdout ?? ''), 32_768), stderr: bounded(String(stderr ?? ''), 4_000) })));
}
function version(output: string): string | null { return output.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/u)?.[0] ?? (output.trim().split(/\r?\n/u)[0]?.slice(0, 128) || null); }

export class ClaudeCodeHarnessAdapter implements BrainHarnessAdapter {
  private readonly sessions = new Map<string, ClaudeSession>();
  constructor(private readonly command = process.env.BRAIN_CLAUDE_CODE_BIN ?? 'claude') {}

  describe(): BrainHarnessDescriptor {
    return { schemaVersion: 'brain-harness-spi.v1', adapterId: ADAPTER_ID, adapterVersion: '1', installationClass: 'VENDOR_OR_USER_MANAGED', protocol: 'jsonl', capabilities: { structuredEvents: 'SUPPORTED', streamingResult: 'SUPPORTED', tokenUsage: 'SUPPORTED', contextUsage: 'UNKNOWN', costUsage: 'SUPPORTED', toolEvents: 'UNSUPPORTED', resume: 'UNSUPPORTED', cancel: 'SUPPORTED', inspect: 'SUPPORTED', filesystem: 'UNSUPPORTED', shell: 'UNSUPPORTED', browser: 'UNSUPPORTED', MCP: 'UNSUPPORTED', subagents: 'UNSUPPORTED' } };
  }

  async probeCompatibility(): Promise<HarnessCompatibilityProbe> {
    const checkedAt = new Date().toISOString();
    const versionProbe = await probe(this.command, ['--version']);
    const base = { schemaVersion: 'brain-harness-spi.v1' as const, adapterId: ADAPTER_ID, checkedAt, binaryDiscoverable: versionProbe.spawned, observedVendorVersion: version(versionProbe.stdout), structuredProtocol: 'INCOMPATIBLE' as const, mandatoryContractCompatible: false, optionalCapabilities: this.describe().capabilities };
    if (!versionProbe.spawned) return { ...base, reasonCode: 'BINARY_NOT_FOUND' };
    const help = await probe(this.command, ['--help']);
    const compatible = help.code === 0 && REQUIRED_FLAGS.every((flag) => help.stdout.includes(flag));
    return { ...base, structuredProtocol: compatible ? 'COMPATIBLE' : 'INCOMPATIBLE', mandatoryContractCompatible: compatible, reasonCode: compatible ? 'COMPATIBLE' : 'PROTOCOL_UNSUPPORTED' };
  }

  async start(input: BrainHarnessStartInput): Promise<BrainHarnessHandle> {
    if (!validateBrainHarnessStartInput(input)) throw new Error('HARNESS_START_INPUT_INVALID');
    const compatibility = await this.probeCompatibility();
    if (!compatibility.mandatoryContractCompatible) throw new Error(`CLAUDE_CODE_${compatibility.reasonCode}`);
    const executionId = `claude-code-execution:${digest({ attemptId: input.brainAttemptId, dispatch: input.correlation.dispatchId }).slice(0, 48)}`;
    const handle: BrainHarnessHandle = { executionId, externalSessionId: null, result: Promise.resolve(undefined as unknown as BrainHarnessResult) };
    const session: ClaudeSession = { handle, input, events: new BrainHarnessEventBuffer(), controller: new AbortController(), resultText: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'starting' };
    this.sessions.set(executionId, session);
    handle.result = this.execute(session);
    return handle;
  }

  events(handle: BrainHarnessHandle): AsyncIterable<BrainHarnessEvent> { return this.sessions.get(handle.executionId)?.events ?? (async function* () {})(); }

  async stop(handle: BrainHarnessHandle, reason: string): Promise<BrainHarnessStopResult> {
    const session = this.sessions.get(handle.executionId);
    if (!session || ['succeeded', 'failed', 'cancelled'].includes(session.status)) return { status: 'already-terminal' };
    session.controller.abort(reason);
    session.child?.kill('SIGTERM');
    return { status: 'requested' };
  }

  async inspect(handle: BrainHarnessHandle): Promise<BrainHarnessInspection> {
    const session = this.sessions.get(handle.executionId);
    if (!session) throw new Error('CLAUDE_CODE_SESSION_NOT_FOUND');
    return { executionId: handle.executionId, externalSessionId: handle.externalSessionId, status: session.status, startedAt: session.startedAt, updatedAt: session.updatedAt };
  }

  async close(handle: BrainHarnessHandle): Promise<void> { this.sessions.delete(handle.executionId); }

  private execute(session: ClaudeSession): Promise<BrainHarnessResult> {
    return new Promise((resolve, reject) => {
      const args = ['--print', '--verbose', '--output-format', 'stream-json', '--no-session-persistence', '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--tools', '', '--model', 'opus'];
      const child = spawn(this.command, args, { cwd: session.input.executionScope?.contexts[0]?.canonicalPath ?? process.cwd(), env: env(this.command), shell: false, stdio: ['pipe', 'pipe', 'pipe'], signal: session.controller.signal });
      session.child = child;
      session.status = 'running';
      session.events.push({ type: 'started', executionId: child.pid ? String(child.pid) : session.handle.executionId, occurredAt: session.startedAt });
      let stdout = '';
      let stderr = '';
      let index = 0;
      const consume = (chunk: string): void => {
        stdout += chunk;
        const lines = stdout.split(/\r?\n/u);
        stdout = lines.pop() ?? '';
        for (const line of lines) this.consumeLine(session, line, index++);
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => consume(chunk));
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => { stderr = bounded(`${stderr}${chunk}`, MAX_STDERR); });
      child.once('error', reject);
      child.once('close', (code, signal) => {
        if (stdout.trim()) this.consumeLine(session, stdout, index);
        const cancelled = session.controller.signal.aborted || signal === 'SIGTERM' || signal === 'SIGINT';
        if (cancelled) {
          session.status = 'cancelled'; session.events.push({ type: 'cancelled', occurredAt: new Date().toISOString(), reasonCode: 'BRAIN_CANCELLATION' }); session.events.push({ type: 'completed', occurredAt: new Date().toISOString(), status: 'cancelled' }); session.events.end();
          resolve({ status: 'cancelled', runtimeReceiptId: `runtime-receipt:claude-code:${digest(session.input.brainAttemptId).slice(0, 48)}`, resultHash: digest({ attempt: session.input.brainAttemptId, status: 'cancelled' }), evidenceRef: null, settlement: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'CANCELLED', cancellationObserved: true, traceSummary: ['Claude Code cancelled by Brain policy'] }); return;
        }
        if (code !== 0 || !session.resultText.trim()) {
          session.status = 'failed'; session.events.push({ type: 'failure', occurredAt: new Date().toISOString(), reasonCode: code === 127 ? 'CLAUDE_CODE_NOT_FOUND' : 'CLAUDE_CODE_EXEC_FAILED' }); session.events.push({ type: 'completed', occurredAt: new Date().toISOString(), status: 'failed' }); session.events.end();
          resolve({ status: 'failed', runtimeReceiptId: `runtime-receipt:claude-code:${digest({ attempt: session.input.brainAttemptId, stderr }).slice(0, 48)}`, resultHash: digest({ attempt: session.input.brainAttemptId, stderr }), evidenceRef: null, settlement: { steps: 1, tokens: session.usage.totalTokens, cost: session.usage.cost }, failureCode: code === 127 ? 'CLAUDE_CODE_NOT_FOUND' : 'CLAUDE_CODE_EXEC_FAILED', traceSummary: ['Claude Code execution failed'] }); return;
        }
        session.status = 'succeeded'; session.events.push({ type: 'result', occurredAt: new Date().toISOString(), resultRef: `result:claude-code:${digest(session.resultText).slice(0, 48)}`, evidenceRef: `evidence:claude-code:${digest(session.resultText).slice(0, 48)}` }); session.events.push({ type: 'completed', occurredAt: new Date().toISOString(), status: 'succeeded' }); session.events.end();
        const resultHash = digest({ attempt: session.input.brainAttemptId, text: session.resultText });
        resolve({ status: 'succeeded', runtimeReceiptId: `runtime-receipt:claude-code:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: `evidence:claude-code:${resultHash.slice(0, 48)}`, settlement: { steps: 1, tokens: session.usage.totalTokens, cost: session.usage.cost }, resultText: bounded(session.resultText, MAX_RESULT), traceSummary: ['claude-code', 'permission-mode:dontAsk'] });
      });
      child.stdin.end(session.input.taskText);
    });
  }

  private consumeLine(session: ClaudeSession, line: string, index: number): void {
    if (!line.trim()) return;
    let value: unknown;
    try { value = JSON.parse(line); } catch { session.events.push({ type: 'unknown', occurredAt: new Date().toISOString(), sourceType: 'non-json', safeActivity: 'Claude Code emitted an unrecognized event' }); return; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const event = value as Record<string, unknown>;
    const occurredAt = typeof event.timestamp === 'string' && Number.isFinite(Date.parse(event.timestamp)) ? event.timestamp : new Date().toISOString();
    if (typeof event.session_id === 'string') session.handle.externalSessionId = event.session_id;
    if (event.type === 'result') {
      if (typeof event.result === 'string') session.resultText = bounded(event.result, MAX_RESULT);
      const usage = event.usage as Record<string, unknown> | undefined;
      if (usage) {
        const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
        const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
        session.usage = { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost: typeof event.total_cost_usd === 'number' ? event.total_cost_usd : 0 };
      }
      session.events.push({ type: 'activity', occurredAt, safeActivity: 'Claude Code prepared a result', ...(session.handle.externalSessionId ? { externalSessionId: session.handle.externalSessionId } : {}) });
    } else {
      session.events.push({ type: 'activity', occurredAt, safeActivity: event.type === 'assistant' ? 'Claude Code generated a response' : 'Claude Code activity', ...(session.handle.externalSessionId ? { externalSessionId: session.handle.externalSessionId } : {}) });
    }
    session.updatedAt = occurredAt;
    void index;
  }
}
