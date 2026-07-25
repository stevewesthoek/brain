import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  BrainCoreAgentExecutorPlanStepSummary,
  BrainCoreAgentExecutorPlanSummary,
  BrainCoreAgentTaskGraphSummary,
  BrainCoreAgentTaskStateSummary,
} from '../types/api.js';

const DEFAULT_EXECUTOR_PLAN_PATH = path.join(
  os.homedir(),
  '.local',
  'video-orchestrator',
  'state',
  'agent-executor-plan.json',
);

interface AgentExecutorPlanSnapshotFile {
  executorPlan?: BrainCoreAgentExecutorPlanSummary;
}

export function readAgentExecutorPlan(
  taskGraph: BrainCoreAgentTaskGraphSummary,
  taskState: BrainCoreAgentTaskStateSummary,
): BrainCoreAgentExecutorPlanSummary {
  const snapshot = readSnapshotFile<AgentExecutorPlanSnapshotFile>(DEFAULT_EXECUTOR_PLAN_PATH)?.executorPlan;

  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_EXECUTOR_PLAN_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const steps = taskState.steps.map((step) => {
    const task = taskGraph.tasks.find((candidate) => candidate.taskId === step.taskId);
    const selection = selectExecutorForTask(task);

    return {
      taskId: step.taskId,
      executorId: selection.executorId,
      providerId: selection.providerId,
      reason: selection.reason,
      source: 'derived' as const,
      ...(selection.model ? { model: selection.model } : {}),
    } satisfies BrainCoreAgentExecutorPlanStepSummary;
  });

  return {
    id: 'agent-executor-plan',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    taskGraphId: 'agent-task-graph',
    taskStateId: 'agent-task-state',
    stepCount: steps.length,
    steps,
    nextSafeStep: 'Use these recorded executor selections as intent only; do not execute without approval gates.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_EXECUTOR_PLAN_PATH),
      path: DEFAULT_EXECUTOR_PLAN_PATH,
      loadedFromDisk: false,
    },
  };
}

export function saveAgentExecutorPlanSnapshot(executorPlan: BrainCoreAgentExecutorPlanSummary): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_EXECUTOR_PLAN_PATH), { recursive: true });
    const payload = `${JSON.stringify(
      {
        executorPlan: {
          ...executorPlan,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_EXECUTOR_PLAN_PATH,
            loadedFromDisk: true,
          },
        },
      } satisfies AgentExecutorPlanSnapshotFile,
      null,
      2,
    )}\n`;
    fs.writeFileSync(DEFAULT_EXECUTOR_PLAN_PATH, payload);
    return true;
  } catch {
    return false;
  }
}

function selectExecutorForTask(task: BrainCoreAgentTaskGraphSummary['tasks'][number] | undefined): {
  executorId: string;
  providerId: string;
  model?: string;
  reason: string;
} {
  if (!task) {
    return {
      executorId: 'local-ollama-m4pro',
      providerId: 'ollama-m4pro',
      model: 'qwen2.5:32b',
      reason: 'No matching task found; defaulting to the primary local executor.',
    };
  }

  if (task.capabilityIds.some((id) => id.startsWith('skill.'))) {
    return {
      executorId: 'local-ollama-m4pro',
      providerId: 'ollama-m4pro',
      model: 'qwen2.5:32b',
      reason: 'Skill-first task; use the strongest local M4 executor before paid fallbacks.',
    };
  }

  if (task.aiTaskType === 'executor_selection' || task.aiTaskType === 'orchestration') {
    return {
      executorId: 'codex-cli',
      providerId: 'codex-cli',
      model: 'gpt-5.4',
      reason: 'Orchestration or executor-selection work should prefer Codex CLI after local intent is recorded.',
    };
  }

  if (task.approvalRequired) {
    return {
      executorId: 'claude-bedrock',
      providerId: 'claude-bedrock',
      model: 'claude-sonnet',
      reason: 'Approval-sensitive coordination is assigned to the paid fallback surface for reliability.',
    };
  }

  return {
    executorId: 'local-ollama-m1',
    providerId: 'ollama-m1',
    model: 'qwen2.5:14b',
    reason: 'Default to the secondary local node for routine non-sensitive work.',
  };
}

function readSnapshotFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}
