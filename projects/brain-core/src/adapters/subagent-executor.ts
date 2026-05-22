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
}

const processes: Map<string, SubagentProcess> = new Map();

function generateProcessId(): string {
  return `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function spawnSubagent(options: SubagentOptions): Promise<SubagentProcess> {
  const processId = generateProcessId();
  const process: SubagentProcess = {
    id: processId,
    model: options.model,
    task_id: options.task.id,
    started_at: new Date().toISOString(),
    status: 'running',
  };

  processes.set(processId, process);

  return process;
}

export function getProcessStatus(process_id: string): SubagentProcess | null {
  return processes.get(process_id) || null;
}

export function getAllProcesses(): SubagentProcess[] {
  return Array.from(processes.values());
}

export function killProcess(process_id: string): boolean {
  const proc = processes.get(process_id);
  if (proc) {
    proc.status = 'failed';
    processes.delete(process_id);
    return true;
  }
  return false;
}
