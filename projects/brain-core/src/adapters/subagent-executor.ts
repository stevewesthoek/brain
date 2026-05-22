import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Task, TaskResult, TaskError } from '../types/work-queue.js';

export interface SubagentOptions {
  model: 'haiku' | 'sonnet' | 'codex-low' | 'gemini-flash';
  task: Task;
  context?: Record<string, unknown>;
  timeout_ms?: number;
}

export interface SubagentProcess {
  id: string;
  model: string;
  task_id: string;
  started_at: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'timeout';
  pid?: number | undefined;
  stdout?: string | undefined;
  stderr?: string | undefined;
  exit_code?: number | null | undefined;
}

const OUTPUT_DIR = path.resolve(
  process.env.HOME || '/root',
  '.local/brain-queues/subagent-output',
);

const processes: Map<string, SubagentProcess> = new Map();
const childProcesses: Map<string, ChildProcess> = new Map();

function generateProcessId(): string {
  return `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildCommand(options: SubagentOptions): { cmd: string; args: string[] } {
  const promptText = options.task.prompt;

  switch (options.model) {
    case 'haiku':
    case 'sonnet':
      return {
        cmd: 'claude',
        args: [
          '--print',
          '--model', options.model === 'haiku' ? 'haiku' : 'sonnet',
          promptText,
        ],
      };
    case 'codex-low':
      return {
        cmd: 'codex',
        args: [
          '--approval-mode', 'full-auto',
          '--model', 'gpt-5.4-mini',
          promptText,
        ],
      };
    case 'gemini-flash':
      return {
        cmd: 'gemini',
        args: [
          '--model', 'gemini-2.5-flash',
          promptText,
        ],
      };
  }
}

export async function spawnSubagent(options: SubagentOptions): Promise<SubagentProcess> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const processId = generateProcessId();
  const record: SubagentProcess = {
    id: processId,
    model: options.model,
    task_id: options.task.id,
    started_at: new Date().toISOString(),
    status: 'starting',
  };

  processes.set(processId, record);

  const { cmd, args } = buildCommand(options);
  const timeoutMs = options.timeout_ms ?? 300_000;

  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    timeout: timeoutMs,
  });

  childProcesses.set(processId, child);
  record.pid = child.pid;
  record.status = 'running';

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    record.stdout = stdout;
    record.stderr = stderr;
    record.exit_code = code;
    record.status = code === 0 ? 'completed' : 'failed';
    childProcesses.delete(processId);

    const outputPath = path.join(OUTPUT_DIR, `${processId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(record, null, 2));
  });

  child.on('error', (err) => {
    record.status = 'failed';
    record.stderr = err.message;
    childProcesses.delete(processId);
  });

  return record;
}

export function getProcessStatus(process_id: string): SubagentProcess | null {
  const live = processes.get(process_id);
  if (live) return live;

  const outputPath = path.join(OUTPUT_DIR, `${process_id}.json`);
  if (fs.existsSync(outputPath)) {
    return JSON.parse(fs.readFileSync(outputPath, 'utf8')) as SubagentProcess;
  }

  return null;
}

export function getAllProcesses(): SubagentProcess[] {
  return Array.from(processes.values());
}

export function killProcess(process_id: string): boolean {
  const child = childProcesses.get(process_id);
  if (child) {
    child.kill('SIGTERM');
    childProcesses.delete(process_id);
  }

  const proc = processes.get(process_id);
  if (proc) {
    proc.status = 'failed';
    return true;
  }
  return false;
}

export function getProcessOutput(process_id: string): string | null {
  const proc = processes.get(process_id);
  if (proc?.stdout) return proc.stdout;

  const outputPath = path.join(OUTPUT_DIR, `${process_id}.json`);
  if (fs.existsSync(outputPath)) {
    const record = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as SubagentProcess;
    return record.stdout ?? null;
  }

  return null;
}
