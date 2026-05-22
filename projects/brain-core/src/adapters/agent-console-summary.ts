import fs from 'node:fs';
import path from 'node:path';
import { readAgentApprovalGates } from './agent-approval-gates.js';
import { readAgentExecutorPlan } from './agent-executor-plan.js';
import { readAgentLedger, readAgentTaskGraph } from './agent-ledger.js';
import { readAgentTaskState } from './agent-task-state.js';
import type { BrainCoreAgentConsoleSummary } from '../types/api.js';

const DEFAULT_AGENT_CONSOLE_PATH = path.resolve(
  process.cwd(),
  '../../../../../.local/video-orchestrator/state/agent-console.json',
);

interface AgentConsoleSnapshotFile {
  agentConsole?: BrainCoreAgentConsoleSummary;
}

export function readAgentConsoleSummary(): BrainCoreAgentConsoleSummary {
  const snapshot = readSnapshotFile<AgentConsoleSnapshotFile>(DEFAULT_AGENT_CONSOLE_PATH)?.agentConsole;

  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_AGENT_CONSOLE_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const taskGraph = readAgentTaskGraph();
  const taskState = readAgentTaskState(taskGraph);
  const ledger = readAgentLedger();
  const executorPlan = readAgentExecutorPlan(taskGraph, taskState);
  const approvalGates = readAgentApprovalGates();

  return {
    id: 'agent-console',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    ledger,
    taskGraph,
    taskState,
    executorPlan,
    approvalGates,
    activeRunCount: ledger.runs.filter((run) => run.status === 'running').length,
    blockedRunCount: ledger.runs.filter((run) => run.status === 'blocked').length,
    plannedRunCount: ledger.runs.filter((run) => run.status === 'planned').length,
    approvalPendingCount: approvalGates.pendingCount,
    executorSelectionCount: executorPlan.stepCount,
    nextSafeStep: [
      ledger.nextSafeStep,
      taskState.nextSafeStep,
      executorPlan.nextSafeStep,
      approvalGates.nextSafeStep,
    ].find((value) => value.length > 0) ?? 'Review the read-only agent surfaces.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_AGENT_CONSOLE_PATH),
      path: DEFAULT_AGENT_CONSOLE_PATH,
      loadedFromDisk: false,
    },
  };
}

export function saveAgentConsoleSummarySnapshot(agentConsole: BrainCoreAgentConsoleSummary): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_AGENT_CONSOLE_PATH), { recursive: true });
    const payload = `${JSON.stringify(
      {
        agentConsole: {
          ...agentConsole,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_AGENT_CONSOLE_PATH,
            loadedFromDisk: true,
          },
        },
      } satisfies AgentConsoleSnapshotFile,
      null,
      2,
    )}\n`;
    fs.writeFileSync(DEFAULT_AGENT_CONSOLE_PATH, payload);
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
