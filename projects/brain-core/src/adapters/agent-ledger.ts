import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listAgentEvents, listAgentRuns } from './agent-runs.js';
import { listApprovals } from './approvals.js';
import type {
  BrainCoreAgentEventSummary,
  BrainCoreAgentLedgerSummary,
  BrainCoreAgentRunSummary,
  BrainCoreAgentTaskGraphSummary,
  BrainCoreAgentTaskSummary,
} from '../types/api.js';

const DEFAULT_LEDGER_PATH = path.join(
  os.homedir(),
  '.local',
  'video-orchestrator',
  'state',
  'agent-ledger.json',
);

const TASK_GRAPH: BrainCoreAgentTaskSummary[] = [
  {
    taskId: '0C-C',
    title: 'Run ledger and task graph',
    status: 'running',
    dependsOn: [],
    role: 'Coordinator',
    capabilityIds: ['skill.code'],
    aiTaskType: 'orchestration',
    approvalRequired: false,
    notes: 'Read-only ledger and task graph snapshot surface.',
  },
  {
    taskId: '0C-D',
    title: 'Selector-aware executor adapter',
    status: 'pending',
    dependsOn: ['0C-C'],
    role: 'Coordinator',
    capabilityIds: ['ai.codex-cli', 'ai.claude-bedrock'],
    aiTaskType: 'executor_selection',
    approvalRequired: false,
    notes: 'Map selected executors without performing execution.',
  },
  {
    taskId: '0C-E',
    title: 'Approval gates',
    status: 'pending',
    dependsOn: ['0C-C'],
    role: 'Coordinator',
    capabilityIds: ['cli.github'],
    aiTaskType: 'approval_policy',
    approvalRequired: true,
    notes: 'Approval policy surface only; no mutation logic yet.',
  },
  {
    taskId: '0C-F',
    title: 'Brain Console Agent View',
    status: 'pending',
    dependsOn: ['0C-C', '0C-D', '0C-E'],
    role: 'Dashboard',
    capabilityIds: ['skill.code', 'skill.web', 'skill.video'],
    aiTaskType: 'ui_planning',
    approvalRequired: false,
    notes: 'UI visibility for future agent plans and ledger snapshots.',
  },
];

interface AgentLedgerSnapshotFile {
  ledger?: BrainCoreAgentLedgerSummary;
  taskGraph?: BrainCoreAgentTaskGraphSummary;
}

export function readAgentTaskGraph(): BrainCoreAgentTaskGraphSummary {
  const snapshot = readSnapshotFile<AgentLedgerSnapshotFile>(DEFAULT_LEDGER_PATH)?.taskGraph;

  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_LEDGER_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const completedCount = TASK_GRAPH.filter((task) => task.status === 'completed').length;
  const blockedCount = TASK_GRAPH.filter((task) => task.status === 'blocked').length;
  const pendingCount = TASK_GRAPH.filter((task) => task.status === 'pending' || task.status === 'planned').length;

  return {
    id: 'agent-task-graph',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    taskCount: TASK_GRAPH.length,
    completedCount,
    blockedCount,
    pendingCount,
    tasks: TASK_GRAPH.map((task) => ({
      ...task,
      dependsOn: [...task.dependsOn],
      capabilityIds: [...task.capabilityIds],
    })),
    nextSafeStep: 'Extend the ledger with a persisted snapshot schema after the read-only graph is stable.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_LEDGER_PATH),
      path: DEFAULT_LEDGER_PATH,
      loadedFromDisk: false,
    },
  };
}

export function readAgentLedger(): BrainCoreAgentLedgerSummary {
  const snapshot = readSnapshotFile<AgentLedgerSnapshotFile>(DEFAULT_LEDGER_PATH)?.ledger;

  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_LEDGER_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const runs = listAgentRuns();
  const events = listAgentEvents();
  const approvals = listApprovals();
  const taskGraph = readAgentTaskGraph();
  const approvalIds = approvals.map((approval) => approval.id);

  return {
    id: 'agent-ledger',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    runCount: runs.length,
    eventCount: events.length,
    taskCount: taskGraph.taskCount,
    approvalCount: approvals.length,
    runs,
    events,
    taskGraph,
    approvalIds,
    nextSafeStep: 'Add append-only persistence only after the read-only snapshot contract is stable.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_LEDGER_PATH),
      path: DEFAULT_LEDGER_PATH,
      loadedFromDisk: false,
    },
  };
}

export function saveAgentLedgerSnapshot(snapshot: {
  ledger: BrainCoreAgentLedgerSummary;
  taskGraph: BrainCoreAgentTaskGraphSummary;
}): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_LEDGER_PATH), { recursive: true });
    const payload = `${JSON.stringify(
      {
        ledger: {
          ...snapshot.ledger,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_LEDGER_PATH,
            loadedFromDisk: true,
          },
        },
        taskGraph: {
          ...snapshot.taskGraph,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_LEDGER_PATH,
            loadedFromDisk: true,
          },
        },
      } satisfies AgentLedgerSnapshotFile,
      null,
      2,
    )}\n`;
    fs.writeFileSync(DEFAULT_LEDGER_PATH, payload);
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
