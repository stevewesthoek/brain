import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  BrainCoreAgentTaskGraphSummary,
  BrainCoreAgentTaskStateSummary,
  BrainCoreAgentTaskStatus,
} from '../types/api.js';

const DEFAULT_TASK_STATE_PATH = path.join(
  os.homedir(),
  '.local',
  'video-orchestrator',
  'state',
  'agent-task-state.json',
);

interface AgentTaskStateSnapshotFile {
  taskState?: BrainCoreAgentTaskStateSummary;
}

const DEFAULT_TASK_GRAPH_ID = 'agent-task-graph' as const;

export function readAgentTaskState(taskGraph: BrainCoreAgentTaskGraphSummary): BrainCoreAgentTaskStateSummary {
  const snapshot = readSnapshotFile<AgentTaskStateSnapshotFile>(DEFAULT_TASK_STATE_PATH)?.taskState;

  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_TASK_STATE_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const currentTask = taskGraph.tasks.find((task) => task.status === 'running')
    ?? taskGraph.tasks.find((task) => task.status === 'waiting_approval')
    ?? taskGraph.tasks.find((task) => task.status === 'blocked')
    ?? taskGraph.tasks.find((task) => task.status === 'pending')
    ?? taskGraph.tasks[0];

  const steps = taskGraph.tasks.map((task) => ({
    taskId: task.taskId,
    status: task.status as BrainCoreAgentTaskStatus,
    note: task.notes,
  }));

  return {
    id: 'agent-task-state',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    taskGraphId: DEFAULT_TASK_GRAPH_ID,
    ...(currentTask ? { currentTaskId: currentTask.taskId, resumedTaskId: currentTask.taskId } : {}),
    ...(findLastCompletedTask(taskGraph.tasks)
      ? { lastCompletedTaskId: findLastCompletedTask(taskGraph.tasks)!.taskId }
      : {}),
    stepCount: steps.length,
    steps,
    nextSafeStep: currentTask
      ? `Resume with task ${currentTask.taskId} (${currentTask.title}) after verifying executor selection and approval status.`
      : 'No tasks are currently available to resume.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_TASK_STATE_PATH),
      path: DEFAULT_TASK_STATE_PATH,
      loadedFromDisk: false,
    },
  };
}

export function saveAgentTaskStateSnapshot(taskState: BrainCoreAgentTaskStateSummary): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_TASK_STATE_PATH), { recursive: true });
    const payload = `${JSON.stringify(
      {
        taskState: {
          ...taskState,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_TASK_STATE_PATH,
            loadedFromDisk: true,
          },
        },
      } satisfies AgentTaskStateSnapshotFile,
      null,
      2,
    )}\n`;
    fs.writeFileSync(DEFAULT_TASK_STATE_PATH, payload);
    return true;
  } catch {
    return false;
  }
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

function findLastCompletedTask(tasks: BrainCoreAgentTaskGraphSummary['tasks']): BrainCoreAgentTaskGraphSummary['tasks'][number] | undefined {
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    const task = tasks[index];
    if (task?.status === 'completed') {
      return task;
    }
  }

  return undefined;
}
