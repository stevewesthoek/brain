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
  reason: string;
} {
  if (!task) {
    return {
      executorId: 'claude-bedrock',
      providerId: 'claude-bedrock',
      reason: 'No matching task found; default to the Bedrock-backed Claude surface and let the registry resolve the model.',
    };
  }

  if (task.approvalRequired) {
    return {
      executorId: 'claude-bedrock',
      providerId: 'claude-bedrock',
      reason: 'Approval-sensitive coordination uses the primary Bedrock-backed Claude surface; the registry resolves the model.',
    };
  }

  if (task.aiTaskType === 'executor_selection' || task.aiTaskType === 'orchestration') {
    return {
      executorId: 'claude-bedrock',
      providerId: 'claude-bedrock',
      reason: 'Orchestration and executor-selection work use Bedrock-backed Claude by default; the registry resolves the model.',
    };
  }

  return {
    executorId: 'claude-bedrock',
    providerId: 'claude-bedrock',
    reason: task.capabilityIds.some((id) => id.startsWith('skill.'))
      ? 'Skill-first work uses Bedrock-backed Claude; the registry resolves the model and no Brain-managed always-on local text executor is admitted.'
      : 'Routine text work uses Bedrock-backed Claude; the registry resolves the model and Codex CLI remains the secondary managed surface.',
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
