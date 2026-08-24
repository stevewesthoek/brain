import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAgentLedger } from './agent-ledger.js';
import { readAgentTaskState } from './agent-task-state.js';
import { describeRouteLineItem, selectModelRouteSnapshot } from './model-routing-policy.js';
import { evaluateBudgetStatus, readCostBudgetSummary } from './cost-budgets.js';
import type {
  BrainCoreAgentCostLineItem,
  BrainCoreAgentCostSummary,
  BrainCoreRouteSurface,
} from '../types/api.js';

const DEFAULT_COST_SUMMARY_PATH = path.join(
  os.homedir(),
  '.local',
  'video-orchestrator',
  'state',
  'agent-cost-summary.json',
);

interface CostSummarySnapshotFile {
  costSummary?: BrainCoreAgentCostSummary;
}

const DEFAULT_TASK_SPECS: Array<{ taskId: string; taskType: string; inputTokens: number; contextBreadth: 'narrow' | 'medium' | 'wide'; qualityPriority: 'speed' | 'balanced' | 'quality'; urgent: boolean }> = [
  { taskId: '8.1.1', taskType: 'metadata_generation', inputTokens: 8000, contextBreadth: 'medium', qualityPriority: 'balanced', urgent: false },
  { taskId: '8.2.1', taskType: 'description_quality_review', inputTokens: 4000, contextBreadth: 'narrow', qualityPriority: 'quality', urgent: false },
  { taskId: '8.3.1', taskType: 'orchestration', inputTokens: 6000, contextBreadth: 'wide', qualityPriority: 'balanced', urgent: false },
  { taskId: '8.4.1', taskType: 'seo_keyword_expansion', inputTokens: 5000, contextBreadth: 'medium', qualityPriority: 'speed', urgent: true },
  { taskId: '8.4.2', taskType: 'transcript_summarization', inputTokens: 10000, contextBreadth: 'wide', qualityPriority: 'balanced', urgent: false },
];

export function readAgentCostSummary(): BrainCoreAgentCostSummary {
  const snapshot = readSnapshotFile<CostSummarySnapshotFile>(DEFAULT_COST_SUMMARY_PATH)?.costSummary;
  if (snapshot && isCompatibleSnapshot(snapshot)) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_COST_SUMMARY_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const ledger = readAgentLedger();
  const taskState = readAgentTaskState(ledger.taskGraph);
  void taskState;
  const budget = readCostBudgetSummary();
  const routeHistory = buildRouteHistory();
  const routeTotals = routeHistory.reduce(
    (acc, item) => {
      acc.totalEstimatedUsd += item.estimatedCostUsd;
      acc.perSurface[item.surface] += 1;
      if (item.surface === 'codex-cli') {
        acc.subscriptionRouteCount += 1;
      } else {
        acc.paidRouteCount += 1;
      }
      return acc;
    },
    {
      totalEstimatedUsd: 0,
      localRouteCount: 0,
      subscriptionRouteCount: 0,
      paidRouteCount: 0,
      perSurface: {
        'codex-cli': 0,
        'claude-bedrock': 0,
      } as Record<BrainCoreRouteSurface, number>,
    },
  );

  const todayEstimatedUsd = routeHistory
    .slice(0, 3)
    .reduce((sum, item) => sum + item.estimatedCostUsd, 0);
  const weekEstimatedUsd = routeTotals.totalEstimatedUsd;
  const monthEstimatedUsd = routeTotals.totalEstimatedUsd;
  const budgetStatus = evaluateBudgetStatus({ ...budget, spentUsd: routeTotals.totalEstimatedUsd });

  return {
    id: 'agent-cost-summary',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    totalEstimatedUsd: routeTotals.totalEstimatedUsd,
    todayEstimatedUsd,
    weekEstimatedUsd,
    monthEstimatedUsd,
    cheapestRouteCount: routeTotals.perSurface['codex-cli'],
    escalatedRouteCount: routeTotals.perSurface['claude-bedrock'],
    localRouteCount: routeTotals.localRouteCount,
    subscriptionRouteCount: routeTotals.subscriptionRouteCount,
    paidRouteCount: routeTotals.paidRouteCount,
    budget: {
      ...budget,
      status: budgetStatus,
      spentUsd: routeTotals.totalEstimatedUsd,
      remainingUsd: Math.max(0, budget.thresholdUsd - routeTotals.totalEstimatedUsd),
    },
    topExpensiveTasks: routeHistory
      .slice()
      .sort((left, right) => right.estimatedCostUsd - left.estimatedCostUsd)
      .slice(0, 10),
    routeHistory,
    nextSafeStep: 'Add runtime cost event emission once the read-only routing summary is stable.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_COST_SUMMARY_PATH),
      path: DEFAULT_COST_SUMMARY_PATH,
      loadedFromDisk: false,
    },
  };
}

function isCompatibleSnapshot(snapshot: BrainCoreAgentCostSummary): boolean {
  const supportedSurfaces = new Set<BrainCoreRouteSurface>(['codex-cli', 'claude-bedrock']);
  return snapshot.localRouteCount === 0
    && snapshot.cheapestRouteCount === snapshot.subscriptionRouteCount
    && snapshot.escalatedRouteCount === snapshot.paidRouteCount
    && snapshot.routeHistory.every((item) => supportedSurfaces.has(item.surface));
}

export function saveAgentCostSummarySnapshot(costSummary: BrainCoreAgentCostSummary): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_COST_SUMMARY_PATH), { recursive: true });
    const payload = `${JSON.stringify(
      {
        costSummary: {
          ...costSummary,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_COST_SUMMARY_PATH,
            loadedFromDisk: true,
          },
        },
      } satisfies CostSummarySnapshotFile,
      null,
      2,
    )}\n`;
    fs.writeFileSync(DEFAULT_COST_SUMMARY_PATH, payload);
    return true;
  } catch {
    return false;
  }
}

function buildRouteHistory(): BrainCoreAgentCostLineItem[] {
  return DEFAULT_TASK_SPECS.map((task) => {
    const input = {
      taskId: task.taskId,
      taskType: task.taskType,
      inputTokens: task.inputTokens,
      urgent: task.urgent,
      contextBreadth: task.contextBreadth,
      qualityPriority: task.qualityPriority,
    };
    const selected = selectModelRouteSnapshot(input, [
      { id: 'ai.claude-bedrock', enabled: true, priority: 1, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review', 'text/large-context-batch'] },
      { id: 'ai.codex-cli', enabled: true, priority: 2, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
    ]);
    return describeRouteLineItem(selected, input);
  });
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
