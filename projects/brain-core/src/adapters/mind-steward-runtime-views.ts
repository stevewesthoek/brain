import { getMindStewardSchedulerStatus } from './scheduler.js';
import {
  readMindStewardInboxQueueState,
  type MindStewardInboxQueueItem,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';
import type {
  BrainCoreMindStewardFailedItemView,
  BrainCoreMindStewardFailedItemsView,
  BrainCoreMindStewardLatestRunReportView,
  BrainCoreMindStewardLatestRunView,
  BrainCoreMindStewardRecoveryItemView,
  BrainCoreMindStewardRecoveryView,
} from '../types/api.js';

type MindStewardSchedulerStatus = ReturnType<typeof getMindStewardSchedulerStatus>;
type MindStewardSchedulerReportKey = BrainCoreMindStewardLatestRunReportView['key'];
type MindStewardSchedulerReport = MindStewardSchedulerStatus['reports'][MindStewardSchedulerReportKey];
const MIND_STEWARD_SOURCE = 'runtime/local/mind-steward' as const;

const READ_ONLY_SAFETY = {
  readOnly: true,
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  startsBackgroundDaemon: false,
  createsSchedulerJob: false,
} as const;

export function getMindStewardLatestRunView(): BrainCoreMindStewardLatestRunView {
  const schedulerStatus = getMindStewardSchedulerStatus();
  const reports = (Object.entries(schedulerStatus.reports) as Array<[MindStewardSchedulerReportKey, MindStewardSchedulerReport]>)
    .map(([key, report]) => normalizeReport(key as MindStewardSchedulerReportKey, report))
    .sort((a, b) => compareReportFreshness(b, a));
  const latestRun = reports.find(report => report.available && report.latestRunStatus !== 'unknown') ?? null;

  return {
    id: 'mind-steward-latest-run-view',
    status: latestRun ? 'available' : 'missing',
    source: MIND_STEWARD_SOURCE,
    reportCount: schedulerStatus.reportCount,
    availableCount: schedulerStatus.availableCount,
    latestRun,
    reports,
    safety: READ_ONLY_SAFETY,
  };
}

export function listMindStewardFailedItemViews(statePath?: string): BrainCoreMindStewardFailedItemsView {
  const state = readMindStewardInboxQueueState(statePath);
  const failedItems = state
    ? state.items
      .filter(item => item.status === 'failed')
      .map(item => toFailedItemView(item, state))
      .sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt) || a.path.localeCompare(b.path))
    : [];

  return {
    id: 'mind-steward-failed-items-view',
    status: state ? 'available' : 'missing',
    source: 'brain-runtime-queue-state',
    queueStatePath: state?.safety.statePath ?? null,
    generatedAt: state?.generatedAt ?? null,
    failedItemCount: failedItems.length,
    items: failedItems,
    blockers: state ? [] : ['mindStewardInboxQueueStateMissing'],
    safety: READ_ONLY_SAFETY,
  };
}

export function listMindStewardRecoveryViews(statePath?: string): BrainCoreMindStewardRecoveryView {
  const failedItemsView = listMindStewardFailedItemViews(statePath);
  const items: BrainCoreMindStewardRecoveryItemView[] = failedItemsView.items.map(item => ({
    id: `mind-steward-recovery-${item.id}`,
    failedItemId: item.id,
    path: item.path,
    severity: item.attemptCount > item.maxRetries ? 'error' : 'warning',
    failureRoute: item.failureRoute,
    blocker: item.lastError ?? 'mindStewardQueueItemFailed',
    nextSafeStep: item.failureRoute === 'brain-runtime-queue-status'
      ? 'Review the capture and queue error, then request an approved on-demand queue dry-run after the source material is safe to retry.'
      : 'Review the failed capture and create a separate approved recovery proposal before any capture move.',
    controls: [
      {
        id: 'review-source-capture',
        label: 'Review source capture',
        mode: 'manual-review',
        requiresApproval: false,
        writesToMind: false,
        endpoint: null,
      },
      {
        id: 'request-approved-on-demand-queue-run',
        label: 'Request approved on-demand queue run',
        mode: 'approval-request',
        requiresApproval: true,
        writesToMind: false,
        endpoint: '/execution/on-demand-runs/scheduler-run-mind-steward-inbox-queue-dry-run/request',
      },
      {
        id: 'capture-failed-move-proposal',
        label: 'Prepare capture failed move proposal',
        mode: 'proposal-only',
        requiresApproval: true,
        writesToMind: false,
        endpoint: null,
      },
    ],
    safety: {
      ...READ_ONLY_SAFETY,
      canAutoFix: false,
      requiresApprovalForRetry: true,
      proposalOnlyForCaptureMoves: true,
    },
  }));

  return {
    id: 'mind-steward-recovery-view',
    status: failedItemsView.status === 'missing' ? 'missing' : items.length > 0 ? 'available' : 'empty',
    source: 'brain-runtime-queue-state',
    queueStatePath: failedItemsView.queueStatePath,
    generatedAt: failedItemsView.generatedAt,
    recoveryItemCount: items.length,
    items,
    blockers: failedItemsView.blockers,
    safety: {
      ...READ_ONLY_SAFETY,
      canAutoFix: false,
      requiresApprovalForRetry: true,
      proposalOnlyForCaptureMoves: true,
    },
  };
}

function normalizeReport(
  key: MindStewardSchedulerReportKey,
  report: MindStewardSchedulerReport,
): BrainCoreMindStewardLatestRunView['reports'][number] {
  return {
    key,
    fileName: report.fileName,
    available: report.available,
    latestRunStatus: toLatestRunStatus(report.status),
    status: report.status,
    message: report.message,
    mode: report.mode,
    writesToMind: report.writesToMind === true,
    executableActions: report.executableActions === true,
    endedAtLisbon: report.endedAtLisbon,
    durationSeconds: report.durationSeconds,
  };
}

function compareReportFreshness(
  left: BrainCoreMindStewardLatestRunView['reports'][number],
  right: BrainCoreMindStewardLatestRunView['reports'][number],
): number {
  const leftTime = left.endedAtLisbon ? Date.parse(left.endedAtLisbon) : Number.NaN;
  const rightTime = right.endedAtLisbon ? Date.parse(right.endedAtLisbon) : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  if (Number.isFinite(leftTime)) return 1;
  if (Number.isFinite(rightTime)) return -1;
  return left.key.localeCompare(right.key);
}

function toLatestRunStatus(status: string): 'ok' | 'failed' | 'unknown' {
  if (status === 'success' || status === 'ok' || status === 'execution-blocked') return 'ok';
  if (status === 'failed') return 'failed';
  return 'unknown';
}

function toFailedItemView(
  item: MindStewardInboxQueueItem,
  state: MindStewardInboxQueueState,
): BrainCoreMindStewardFailedItemView {
  return {
    id: item.id,
    path: item.path,
    status: 'failed',
    sizeBytes: item.sizeBytes,
    contentSha256: item.contentSha256,
    modifiedAt: item.modifiedAt,
    firstSeenAt: item.firstSeenAt,
    lastCheckedAt: item.lastCheckedAt,
    attemptCount: item.attemptCount,
    maxRetries: state.settings.maxRetries,
    lastError: item.lastError,
    nextRetryAfter: item.nextRetryAfter,
    failureRoute: item.failureRoute,
    largeFile: item.largeFile,
    selectorStatus: item.selectorStatus,
    recoveryRequired: true,
  };
}
