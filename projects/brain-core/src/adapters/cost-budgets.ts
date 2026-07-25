import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrainCoreAgentCostBudgetSummary, BrainCoreBudgetStatus } from '../types/api.js';

const DEFAULT_BUDGET_PATH = path.join(
  os.homedir(),
  '.local',
  'video-orchestrator',
  'state',
  'cost-budgets.json',
);

interface CostBudgetSnapshotFile {
  budget?: BrainCoreAgentCostBudgetSummary;
}

export function readCostBudgetSummary(): BrainCoreAgentCostBudgetSummary {
  const snapshot = readSnapshotFile<CostBudgetSnapshotFile>(DEFAULT_BUDGET_PATH)?.budget;
  if (snapshot) {
    return snapshot;
  }

  return {
    status: 'ok',
    currency: 'USD',
    window: 'day',
    thresholdUsd: 20,
    spentUsd: 0,
    remainingUsd: 20,
    warningAtUsd: 12,
    throttleAtUsd: 16,
    blockAtUsd: 20,
  };
}

export function evaluateBudgetStatus(summary: Pick<BrainCoreAgentCostBudgetSummary, 'spentUsd' | 'warningAtUsd' | 'throttleAtUsd' | 'blockAtUsd'>): BrainCoreBudgetStatus {
  if (summary.spentUsd >= summary.blockAtUsd) {
    return 'blocked';
  }
  if (summary.spentUsd >= summary.throttleAtUsd) {
    return 'throttled';
  }
  if (summary.spentUsd >= summary.warningAtUsd) {
    return 'warning';
  }
  return 'ok';
}

export function saveCostBudgetSummary(budget: BrainCoreAgentCostBudgetSummary): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_BUDGET_PATH), { recursive: true });
    fs.writeFileSync(
      DEFAULT_BUDGET_PATH,
      `${JSON.stringify({ budget: { ...budget, status: evaluateBudgetStatus(budget) } satisfies BrainCoreAgentCostBudgetSummary }, null, 2)}\n`,
    );
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
