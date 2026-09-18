import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AgentRuntime, AgentRuntimeExecutionContext, AgentRuntimeResult } from './runtime-dispatch.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { CODEX_CLI_RUNTIME_REF } from './child-assignment.js';

const MAX_RESULT_TEXT = 12_000;
const MAX_STDERR = 2_000;
const ALLOWED_MODELS = new Set(['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5']);

function digest(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }

function bounded(value: string, max: number): string { return value.slice(0, max); }

function safeModel(value: string | null | undefined): string | undefined {
  if (!value || value === 'auto') return undefined;
  return ALLOWED_MODELS.has(value) ? value : undefined;
}

function runCodex(command: string, args: string[], cwd: string, input: string, signal: AbortSignal): Promise<{ code: number | null; signal: string | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const commandDirectory = path.dirname(command);
    const inheritedPath = process.env.PATH ?? '';
    const childPath = [commandDirectory === '.' ? null : commandDirectory, inheritedPath, '/usr/bin:/bin:/usr/sbin:/sbin'].filter((entry): entry is string => Boolean(entry)).join(':');
    const child = spawn(command, args, { cwd, env: { ...process.env, PATH: childPath }, shell: false, stdio: ['pipe', 'ignore', 'pipe'], signal });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr = bounded(`${stderr}${chunk}`, MAX_STDERR); });
    child.once('error', (error) => reject(error));
    child.once('close', (code, terminationSignal) => resolve({ code, signal: terminationSignal, stderr }));
    child.stdin.end(input);
  });
}

/** K4 AgentRuntime adapter for an explicitly admitted, read-only Codex CLI resource. */
export class CodexCliAgentRuntime implements AgentRuntime {
  constructor(private readonly store: AgentModeSqliteStateStore, private readonly command = process.env.BRAIN_CODEX_BIN ?? 'codex') {}

  async run(input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }): Promise<AgentRuntimeResult> {
    const task = this.store.getTask(input.context.rootGoalId);
    const taskInput = this.store.getJarvisTaskInput(input.context.rootGoalId);
    const repositoryRoot = task?.repositoryRoot;
    const prompt = taskInput?.text;
    if (!repositoryRoot || !prompt) {
      const resultHash = digest('terminal-intake-context-unavailable');
      return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 1, tokens: 0, cost: 0 }, failureCode: 'TERMINAL_CONTEXT_UNAVAILABLE', traceSummary: ['core-owned repository context was unavailable'] };
    }
    if (input.isCancellationRequested()) {
      const resultHash = digest('terminal-intake-cancelled-before-start');
      return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'CANCELLED_BEFORE_START', traceSummary: ['K4 cancellation authority denied dispatch'], cancellationObserved: true };
    }
    const temporaryRoot = path.join(tmpdir(), 'brain-agent-mode-codex-');
    const directory = await mkdtemp(temporaryRoot);
    const outputPath = path.join(directory, 'last-message.txt');
    const model = safeModel(task?.requestedModel);
    const args = ['exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--sandbox', 'read-only', '-C', repositoryRoot, '--output-last-message', outputPath];
    if (model) args.push('--model', model);
    args.push('-');
    try {
      const outcome = await runCodex(this.command, args, repositoryRoot, prompt, input.signal);
      if (input.isCancellationRequested() || outcome.signal === 'SIGTERM' || outcome.signal === 'SIGINT') {
        const resultHash = digest('terminal-intake-cancelled');
        return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 1, tokens: 0, cost: 0 }, failureCode: 'CANCELLED', traceSummary: ['K4 cancellation authority observed'], cancellationObserved: true };
      }
      let resultText = '';
      try { resultText = bounded(await readFile(outputPath, 'utf8'), MAX_RESULT_TEXT).trim(); } catch { resultText = ''; }
      if (outcome.code !== 0 || !resultText) {
        const failureCode = outcome.code === null ? 'CODEX_PROCESS_SIGNAL' : outcome.code === 127 ? 'CODEX_NOT_FOUND' : 'CODEX_EXEC_FAILED';
        const detail = bounded(outcome.stderr, MAX_STDERR);
        const resultHash = digest(`${failureCode}:${detail}`);
        return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 1, tokens: 0, cost: 0 }, failureCode, traceSummary: [failureCode, ...(detail ? [detail] : [])] };
      }
      const resultHash = digest(resultText);
      return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: `evidence:codex:${resultHash.slice(0, 48)}`, usage: { steps: 1, tokens: 0, cost: 0 }, traceSummary: ['codex-cli', 'sandbox:read-only'], resultText };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async reconcile(): Promise<{ status: 'unsupported' }> { return { status: 'unsupported' }; }
}

export const CODEX_CLI_RUNTIME_IDENTITY = CODEX_CLI_RUNTIME_REF;
