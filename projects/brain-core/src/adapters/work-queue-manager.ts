import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Task, TaskStatus, WorkQueue, QueueStats } from '../types/work-queue.js';

const DEFAULT_QUEUE_PATH = path.resolve(
  process.env.HOME || '/root',
  '.local/brain-queues/work-queue.jsonl',
);

export interface EnqueueOptions {
  id: string;
  title: string;
  description: string;
  prompt: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout_seconds?: number;
  max_retries?: number;
}

function generateTaskId(): string {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `task_${timestamp}_${random}`;
}

export async function enqueueTask(options: EnqueueOptions): Promise<Task> {
  fs.mkdirSync(path.dirname(DEFAULT_QUEUE_PATH), { recursive: true });

  const task: Task = {
    id: options.id || generateTaskId(),
    title: options.title,
    description: options.description,
    type: 'custom',
    prompt: options.prompt,
    priority: options.priority || 'normal',
    timeout_seconds: options.timeout_seconds || 300,
    retry_count: 0,
    max_retries: options.max_retries || 3,
    status: 'pending',
  };

  const line = `${JSON.stringify(task)}\n`;
  fs.appendFileSync(DEFAULT_QUEUE_PATH, line, { flag: 'a' });

  return task;
}

export async function getNextTask(agent_id: string): Promise<Task | null> {
  if (!fs.existsSync(DEFAULT_QUEUE_PATH)) {
    return null;
  }

  const lines = fs.readFileSync(DEFAULT_QUEUE_PATH, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const task = JSON.parse(line) as Task;
      if (task.status === 'pending') {
        return task;
      }
    } catch {
      // Skip malformed lines
    }
  }

  return null;
}

export async function updateTaskStatus(task_id: string, status: TaskStatus): Promise<boolean> {
  try {
    if (!fs.existsSync(DEFAULT_QUEUE_PATH)) {
      return false;
    }

    const lines = fs.readFileSync(DEFAULT_QUEUE_PATH, 'utf-8').split('\n').filter(Boolean);
    const updated: string[] = [];

    for (const line of lines) {
      try {
        const task = JSON.parse(line) as Task;
        if (task.id === task_id) {
          task.status = status;
          if (status === 'in_progress') {
            task.started_at = new Date().toISOString();
          } else if (status === 'completed' || status === 'failed') {
            task.completed_at = new Date().toISOString();
          }
          updated.push(JSON.stringify(task));
        } else {
          updated.push(line);
        }
      } catch {
        updated.push(line);
      }
    }

    fs.writeFileSync(DEFAULT_QUEUE_PATH, updated.join('\n') + '\n');
    return true;
  } catch {
    return false;
  }
}

export async function getQueueStats(): Promise<QueueStats> {
  if (!fs.existsSync(DEFAULT_QUEUE_PATH)) {
    return {
      total_tasks: 0,
      pending_count: 0,
      in_progress_count: 0,
      completed_count: 0,
      failed_count: 0,
      average_completion_time: 0,
      total_cost: 0,
    };
  }

  const lines = fs.readFileSync(DEFAULT_QUEUE_PATH, 'utf-8').split('\n').filter(Boolean);
  const tasks: Task[] = lines.map(line => {
    try {
      return JSON.parse(line) as Task;
    } catch {
      return null;
    }
  }).filter((t) => t !== null) as Task[];

  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const totalCost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);

  return {
    total_tasks: tasks.length,
    pending_count: pending,
    in_progress_count: inProgress,
    completed_count: completed,
    failed_count: failed,
    average_completion_time: 0,
    total_cost: totalCost,
  };
}

export function getQueuePath(): string {
  return DEFAULT_QUEUE_PATH;
}
