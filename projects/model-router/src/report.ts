import type { MindContractDryRunResult, MindContractSnapshot, MindRouterLoopPlan, MindRouterPlanActionKind } from './contracts.js';
import { createMindContractDryRunResult } from './jobs.js';
import { createMindRouterLoopPlan } from './plans.js';
import { createMindWikiHealthResultFromRoot, type MindWikiHealthResult } from './wiki-health.js';
import { createMindMaintenancePreviewQueueFromFindings } from './maintenance-preview.js';
import fs from 'node:fs';

export interface ModelRouterDryRunReport {
  generatedAt: string;
  mode: 'dry-run-report-only';
  writesToMind: false;
  executableActions: false;
  validationStatus: 'ok' | 'blocked' | 'failed';
  contractSummary: {
    ok: boolean;
    missingRequiredPathCount: number;
    missingRouterContractFileCount: number;
    missingLiveFileCount: number;
    missingIndexFileCount: number;
    failureBufferStatus: MindContractDryRunResult['failureBufferStatus'];
    failureBufferReadyForArchivePhase: boolean;
  };
  loopPlans: MindRouterLoopPlan[];
  actionCountsByKind: Record<string, number>;
  blockersByLoop: Record<string, string[]>;
  warningsByLoop: Record<string, string[]>;
  snapshotStats: {
    pathCount: number;
    existingPathCount: number;
    missingPathCount: number;
    failedCaptureCount: number;
    captureInboxCount: number;
    oldestCaptureInboxAgeDays?: number;
  };
  wikiHealth: ModelRouterWikiHealthReport;
  maintenancePreview: ModelRouterMaintenancePreviewMetadata;
}

export interface ModelRouterWikiHealthReport {
  status: 'available' | 'unavailable';
  checkedAt?: string;
  ok: boolean;
  summary: MindWikiHealthResult['summary'];
  findings: Array<Pick<MindWikiHealthResult['findings'][number], 'id' | 'severity' | 'path' | 'message' | 'recommendation'>>;
}

export interface ModelRouterMaintenancePreviewMetadata {
  status: 'available' | 'unavailable';
  actionCount: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  approvalRequiredCount: number;
  topActions: Array<{ kind: string; title: string; risk: string }>;
  writesToMind: false;
  externalSideEffects: false;
}

export function createModelRouterDryRunReport(
  snapshot: MindContractSnapshot,
  now = new Date(),
): ModelRouterDryRunReport {
  const contract = createMindContractDryRunResult(snapshot);
  const loopPlans = [
    createMindRouterLoopPlan('mind-drift-error-loop', snapshot, now),
    createMindRouterLoopPlan('mind-compile-loop', snapshot, now),
    createMindRouterLoopPlan('mind-memory-loop', snapshot, now),
    createMindRouterLoopPlan('mind-hygiene-loop', snapshot, now),
  ];

  const actionCountsByKind: Record<string, number> = {};
  for (const plan of loopPlans) {
    for (const action of plan.actions) {
      actionCountsByKind[action.kind] = (actionCountsByKind[action.kind] ?? 0) + 1;
    }
  }

  const pathStats = snapshot.paths.reduce<ModelRouterDryRunReport['snapshotStats']>(
    (acc, item) => {
      acc.pathCount += 1;
      if (item.exists) acc.existingPathCount += 1;
      else acc.missingPathCount += 1;
      if (item.path.startsWith('capture/failed/') && item.exists) acc.failedCaptureCount += 1;
      if (item.path.startsWith('capture/inbox/') && item.exists) {
        acc.captureInboxCount += 1;
        const ageDays = calculateAgeDays(item.modifiedAt, now);
        if (typeof ageDays === 'number') {
          acc.oldestCaptureInboxAgeDays =
            typeof acc.oldestCaptureInboxAgeDays === 'number'
              ? Math.max(acc.oldestCaptureInboxAgeDays, ageDays)
              : ageDays;
        }
      }
      return acc;
    },
    {
      pathCount: 0,
      existingPathCount: 0,
      missingPathCount: 0,
      failedCaptureCount: 0,
      captureInboxCount: 0,
    } as ModelRouterDryRunReport['snapshotStats'],
  );

  const wikiHealth = createWikiHealthReport(now);
  const maintenancePreview = createMaintenancePreviewMetadata(wikiHealth);

  return {
    generatedAt: now.toISOString(),
    mode: 'dry-run-report-only',
    writesToMind: false,
    executableActions: false,
    validationStatus: contract.ok ? 'ok' : 'blocked',
    contractSummary: {
      ok: contract.ok,
      missingRequiredPathCount: contract.missingRequiredPaths.length,
      missingRouterContractFileCount: contract.missingRouterContractFiles.length,
      missingLiveFileCount: contract.missingLiveFiles.length,
      missingIndexFileCount: contract.missingIndexFiles.length,
      failureBufferStatus: contract.failureBufferStatus,
      failureBufferReadyForArchivePhase: contract.failureBufferReadyForArchivePhase,
    },
    loopPlans,
    actionCountsByKind,
    blockersByLoop: Object.fromEntries(loopPlans.map((plan) => [plan.jobId, plan.blockedBy])),
    warningsByLoop: Object.fromEntries(loopPlans.map((plan) => [plan.jobId, plan.warnings])),
    snapshotStats: pathStats,
    wikiHealth,
    maintenancePreview,
  };
}

function createWikiHealthReport(now: Date): ModelRouterWikiHealthReport {
  const configuredRoot = process.env.MODEL_ROUTER_MIND_ROOT;
  const root = configuredRoot;
  try {
    if (!root || !fs.existsSync(root)) {
      return {
        status: 'unavailable',
        ok: false,
        summary: emptyWikiHealthSummary(),
        findings: [],
      };
    }

    const health = createMindWikiHealthResultFromRoot(root, now);
    return {
      status: 'available',
      checkedAt: health.checkedAt,
      ok: health.ok,
      summary: health.summary,
      findings: health.findings.slice(0, 5).map(({ id, severity, path, message, recommendation }) => ({
        id,
        severity,
        path,
        message,
        recommendation,
      })),
    };
  } catch {
    return {
      status: 'unavailable',
      ok: false,
      summary: emptyWikiHealthSummary(),
      findings: [],
    };
  }
}

function emptyWikiHealthSummary(): MindWikiHealthResult['summary'] {
  return {
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    staleCaptureCount: 0,
    failedCaptureCount: 0,
    oversizedWikiPageCount: 0,
    missingSourceTraceCount: 0,
  };
}

function createMaintenancePreviewMetadata(wikiHealth: ModelRouterWikiHealthReport): ModelRouterMaintenancePreviewMetadata {
  if (wikiHealth.status === 'unavailable') {
    return {
      status: 'unavailable',
      actionCount: 0,
      lowRiskCount: 0,
      mediumRiskCount: 0,
      highRiskCount: 0,
      approvalRequiredCount: 0,
      topActions: [],
      writesToMind: false,
      externalSideEffects: false,
    };
  }

  try {
    const queue = createMindMaintenancePreviewQueueFromFindings(
      wikiHealth.findings as any, // findings are already filtered
    );

    return {
      status: 'available',
      actionCount: queue.summary.total,
      lowRiskCount: queue.summary.lowRiskCount,
      mediumRiskCount: queue.summary.mediumRiskCount,
      highRiskCount: queue.summary.highRiskCount,
      approvalRequiredCount: queue.summary.approvalRequiredCount,
      topActions: queue.actions.slice(0, 3).map((action) => ({
        kind: action.kind,
        title: action.title,
        risk: action.risk,
      })),
      writesToMind: false,
      externalSideEffects: false,
    };
  } catch {
    return {
      status: 'unavailable',
      actionCount: 0,
      lowRiskCount: 0,
      mediumRiskCount: 0,
      highRiskCount: 0,
      approvalRequiredCount: 0,
      topActions: [],
      writesToMind: false,
      externalSideEffects: false,
    };
  }
}

function calculateAgeDays(modifiedAt: string | undefined, now: Date): number | undefined {
  if (!modifiedAt) return undefined;
  const value = new Date(modifiedAt).getTime();
  if (!Number.isFinite(value)) return undefined;
  const diffDays = Math.floor((now.getTime() - value) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? diffDays : undefined;
}
