/**
 * Work Queue — Task distribution system for multi-agent coordination
 * Version: 1.0 (2026-06-08)
 */

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  type: 'code_review' | 'analysis' | 'refactor' | 'test' | 'custom';
  prompt: string;
  context?: Record<string, unknown>;
  priority: TaskPriority;
  timeout_seconds: number;
  retry_count: number;
  max_retries: number;
}

export interface Task extends TaskDefinition {
  status: TaskStatus;
  assigned_to?: string;
  started_at?: string;
  completed_at?: string;
  result?: TaskResult;
  error?: TaskError;
  cost?: number;
}

export interface TaskResult {
  task_id: string;
  agent_id: string;
  output: string;
  metadata?: Record<string, unknown>;
  completion_time_seconds: number;
  cost: number;
}

export interface TaskError {
  task_id: string;
  agent_id: string;
  error_type: string;
  message: string;
  stack_trace?: string;
  recovery_step?: string;
}

export interface WorkQueue {
  id: string;
  created_at: string;
  tasks: Task[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  coordinator_id: string;
  subagent_ids: string[];
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_cost: number;
}

export interface QueueStats {
  total_tasks: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  failed_count: number;
  average_completion_time: number;
  total_cost: number;
}
