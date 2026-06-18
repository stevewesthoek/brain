import {
  readMindStewardInboxQueueState,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';
import {
  getExecutionKillSwitch,
  getWorkflowFeatureFlagForKind,
  isExecutionKillSwitchEnabled,
} from './execution-plans.js';
import { listSchedulerJobs } from './scheduler.js';
import type {
  BrainCoreContinuousProcessingLargeFileFallbackView,
  BrainCoreLargeFileNightlyFallbackPlan,
  BrainCoreLargeFileNightlyFallbackPlanItem,
} from '../types/api.js';

const VIEW_SAFETY = {
  readOnly: true,
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  runsWorkflowNow: false,
  watcherEnabled: false,
  schedulesNightlyJob: false,
} as const;

const PLAN_SAFETY = {
  planOnly: true,
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  runsWorkflowNow: false,
  watcherEnabled: false,
  requiresFeatureFlag: true,
  requiresManualSuccessBeforeScheduling: true,
  honorsKillSwitch: true,
} as const;

const WORKFLOW_KIND = 'scheduler-run-mind-steward-large-file-nightly-fallback';
const MAX_FILES_PER_NIGHTLY_RUN = 5;
const NIGHTLY_WINDOW = '02:00-05:00 Europe/Lisbon';

export interface ContinuousProcessingLargeFileFallbackOptions {
  state?: MindStewardInboxQueueState | null;
}

export interface LargeFileNightlyFallbackPlanOptions {
  state?: MindStewardInboxQueueState | null;
  now?: Date;
}

export function getContinuousProcessingLargeFileFallbackView(
  options: ContinuousProcessingLargeFileFallbackOptions = {},
): BrainCoreContinuousProcessingLargeFileFallbackView {
  const queueState = options.state === undefined ? readMindStewardInboxQueueState() : options.state;

  if (!queueState) {
    return {
      id: 'continuous-processing-large-file-fallback-view',
      status: 'missing',
      source: 'brain-runtime-queue-state',
      largeFileThresholdMb: null,
      largeFileCount: 0,
      blockedLargeFiles: [],
      nightlyFallbackEnabled: false,
      nightlyFallbackScheduled: false,
      blockers: ['queueStateUnavailable'],
      safety: VIEW_SAFETY,
    };
  }

  const largeFileThresholdMb = queueState.settings.largeFileThresholdMb;
  const largeFiles = queueState.items.filter(item => item.largeFile);
  const featureFlag = getWorkflowFeatureFlagForKind(WORKFLOW_KIND);

  return {
    id: 'continuous-processing-large-file-fallback-view',
    status: 'available',
    source: 'brain-runtime-queue-state',
    largeFileThresholdMb,
    largeFileCount: largeFiles.length,
    blockedLargeFiles: largeFiles.map(item => ({
      id: item.id,
      path: item.path,
      sizeBytes: item.sizeBytes,
      status: item.status,
      lastError: item.lastError,
      firstSeenAt: item.firstSeenAt,
    })),
    nightlyFallbackEnabled: featureFlag?.enabled === true,
    nightlyFallbackScheduled: false,
    blockers: largeFiles.length > 0
      ? ['largeFilesAwaitNightlyFallback']
      : [],
    safety: VIEW_SAFETY,
  };
}

export function getLargeFileNightlyFallbackPlan(
  options: LargeFileNightlyFallbackPlanOptions = {},
): BrainCoreLargeFileNightlyFallbackPlan {
  const now = options.now ?? new Date();
  const queueState = options.state === undefined ? readMindStewardInboxQueueState() : options.state;
  const featureFlag = getWorkflowFeatureFlagForKind(WORKFLOW_KIND);
  const featureFlagEnabled = featureFlag?.enabled === true;
  const featureFlagName = featureFlag?.flagName ?? 'BRAIN_CORE_ENABLE_LARGE_FILE_NIGHTLY_FALLBACK_EXECUTION';
  const killSwitchEnabled = isExecutionKillSwitchEnabled();
  const jobs = listSchedulerJobs();
  const job = jobs.find(j => j.id === 'mind-steward-large-file-nightly-fallback') ?? null;
  const manualSuccessProven = job?.manualSuccessProven === true;
  const blockers: string[] = [];

  if (!queueState || queueState.status !== 'ready') {
    blockers.push('queueStateUnavailable');
    return {
      id: 'large-file-nightly-fallback-plan',
      status: 'blocked',
      source: 'brain-core-scheduler-plan',
      generatedAt: now.toISOString(),
      largeFileThresholdMb: null,
      maxFilesPerNightlyRun: MAX_FILES_PER_NIGHTLY_RUN,
      nightlyWindow: NIGHTLY_WINDOW,
      featureFlagName,
      featureFlagEnabled,
      killSwitchEnabled,
      manualSuccessRequired: true,
      manualSuccessProven,
      schedulerEnabled: false,
      eligibleCount: 0,
      eligibleFiles: [],
      blockers,
      safety: PLAN_SAFETY,
    };
  }

  if (killSwitchEnabled) blockers.push('executionKillSwitchEnabled');
  if (!featureFlagEnabled) blockers.push('featureFlagDisabled');
  if (!manualSuccessProven) blockers.push('manualOnDemandSuccessRequiredBeforeScheduling');

  const largeFileThresholdMb = queueState.settings.largeFileThresholdMb;
  const largeFiles = queueState.items.filter(item => item.largeFile);
  const eligibleFiles: BrainCoreLargeFileNightlyFallbackPlanItem[] = largeFiles
    .filter(item => item.status === 'blocked' && item.lastError === 'blocked_large_file')
    .slice(0, MAX_FILES_PER_NIGHTLY_RUN)
    .map(item => ({
      id: item.id,
      path: item.path,
      sizeBytes: item.sizeBytes,
      firstSeenAt: item.firstSeenAt,
      eligible: true,
      reason: 'blocked_large_file_within_nightly_bound',
    }));

  if (eligibleFiles.length === 0 && blockers.length === 0) {
    return {
      id: 'large-file-nightly-fallback-plan',
      status: 'no-eligible-files',
      source: 'brain-core-scheduler-plan',
      generatedAt: now.toISOString(),
      largeFileThresholdMb,
      maxFilesPerNightlyRun: MAX_FILES_PER_NIGHTLY_RUN,
      nightlyWindow: NIGHTLY_WINDOW,
      featureFlagName,
      featureFlagEnabled,
      killSwitchEnabled,
      manualSuccessRequired: true,
      manualSuccessProven,
      schedulerEnabled: false,
      eligibleCount: 0,
      eligibleFiles: [],
      blockers: [],
      safety: PLAN_SAFETY,
    };
  }

  return {
    id: 'large-file-nightly-fallback-plan',
    status: blockers.length > 0 ? 'blocked' : 'plan-available',
    source: 'brain-core-scheduler-plan',
    generatedAt: now.toISOString(),
    largeFileThresholdMb,
    maxFilesPerNightlyRun: MAX_FILES_PER_NIGHTLY_RUN,
    nightlyWindow: NIGHTLY_WINDOW,
    featureFlagName,
    featureFlagEnabled,
    killSwitchEnabled,
    manualSuccessRequired: true,
    manualSuccessProven,
    schedulerEnabled: false,
    eligibleCount: eligibleFiles.length,
    eligibleFiles,
    blockers,
    safety: PLAN_SAFETY,
  };
}
