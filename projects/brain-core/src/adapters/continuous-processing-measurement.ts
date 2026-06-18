import {
  readMindStewardInboxQueueState,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';
import { readApprovalStore } from './approval-store.js';
import type { BrainCoreApprovalRecord, BrainCoreApprovalStoreSummary, BrainCoreContinuousProcessingMeasurementView } from '../types/api.js';

const SAFETY = {
  readOnly: true,
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  runsWorkflowNow: false,
  watcherEnabled: false,
  collectsMetricsAutomatically: false,
} as const;

export interface ApprovalEvidenceSnapshot {
  store: BrainCoreApprovalStoreSummary & { records: BrainCoreApprovalRecord[] };
}

export interface ProcessMemorySample {
  rssBytes: number;
  heapUsedBytes: number;
}

export interface ContinuousProcessingMeasurementOptions {
  state?: MindStewardInboxQueueState | null;
  now?: Date;
  approvalEvidence?: ApprovalEvidenceSnapshot | null;
  memorySample?: ProcessMemorySample;
}

export function sampleProcessMemory(now: Date, injected?: ProcessMemorySample): { rssBytes: number; heapUsedBytes: number; sampledAt: string } {
  const mem = injected ?? { rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed };
  return {
    rssBytes: mem.rssBytes,
    heapUsedBytes: mem.heapUsedBytes,
    sampledAt: now.toISOString(),
  };
}

export function getContinuousProcessingMeasurementView(
  options: ContinuousProcessingMeasurementOptions = {},
): BrainCoreContinuousProcessingMeasurementView {
  const now = options.now ?? new Date();
  const queueState = options.state === undefined ? readMindStewardInboxQueueState() : options.state;

  if (!queueState) {
    return {
      id: 'continuous-processing-measurement-view',
      status: 'missing',
      source: 'brain-runtime-queue-state',
      generatedAt: now.toISOString(),
      latency: null,
      machineLoad: null,
      reviewBurden: null,
      configuration: null,
      valueAssessment: {
        status: 'insufficient-evidence',
        evidence: [],
        blockers: ['queueStateUnavailable'],
      },
      blockers: ['queueStateUnavailable'],
      safety: SAFETY,
    };
  }

  const pendingItems = queueState.items.filter(i => i.status === 'pending');
  const stableItems = pendingItems.filter(i => i.stableFile);
  const reportedItems = queueState.items.filter(i => i.status === 'reported');
  const failedItems = queueState.items.filter(i => i.status === 'failed');

  // --- LATENCY: derived from real timestamps ---
  const latencyBlockers: string[] = [];
  let oldestPendingAgeSeconds: number | null = null;
  let latencySampleCount = 0;

  for (const item of stableItems) {
    if (!item.firstSeenAt) continue;
    const parsedTs = Date.parse(item.firstSeenAt);
    if (!Number.isFinite(parsedTs)) {
      latencyBlockers.push(`invalidTimestamp:${item.path}`);
      continue;
    }
    const age = Math.floor((now.getTime() - parsedTs) / 1000);
    if (age < 0) {
      latencyBlockers.push(`futureTimestamp:${item.path}`);
      continue;
    }
    latencySampleCount += 1;
    if (oldestPendingAgeSeconds === null || age > oldestPendingAgeSeconds) {
      oldestPendingAgeSeconds = age;
    }
  }

  const latency: BrainCoreContinuousProcessingMeasurementView['latency'] = latencySampleCount > 0
    ? {
        oldestPendingAgeSeconds: oldestPendingAgeSeconds!,
        sampleCount: latencySampleCount,
        source: 'queue-item-firstSeenAt-timestamps',
        blockers: latencyBlockers.length > 0 ? latencyBlockers : [],
      }
    : {
        oldestPendingAgeSeconds: null,
        sampleCount: 0,
        source: 'queue-item-firstSeenAt-timestamps',
        blockers: latencySampleCount === 0
          ? ['noStablePendingItemsWithTimestamps', ...latencyBlockers]
          : latencyBlockers,
      };

  // --- MACHINE LOAD: bounded one-time Brain Core process-memory sample ---
  const processSample = sampleProcessMemory(now, options.memorySample);
  const machineLoad: BrainCoreContinuousProcessingMeasurementView['machineLoad'] = {
    processRssBytes: processSample.rssBytes,
    processHeapUsedBytes: processSample.heapUsedBytes,
    sampledAt: processSample.sampledAt,
    source: 'process.memoryUsage-one-time-sample',
    blockers: [],
  };

  // --- REVIEW BURDEN: from queue reported-items and approval store ---
  const reviewBlockers: string[] = [];
  const pendingReviewCount = reportedItems.length;
  const failedNeedingReviewCount = failedItems.length;

  let approvedCount: number | null = null;
  let rejectedCount: number | null = null;
  let pendingApprovalCount: number | null = null;
  let approvalStoreSource: string | null = null;

  const approvalEvidence = options.approvalEvidence;
  if (approvalEvidence === null) {
    reviewBlockers.push('approvalEvidenceUnavailable');
  } else if (approvalEvidence !== undefined) {
    const store = approvalEvidence.store;
    if (!store || !store.enabled || store.status !== 'available' || !Array.isArray(store.records)) {
      reviewBlockers.push('approvalEvidenceMalformed');
    } else {
      approvedCount = store.records.filter(r => r.status === 'approved').length;
      rejectedCount = store.records.filter(r => r.status === 'rejected').length;
      pendingApprovalCount = store.records.filter(r => r.status === 'pending').length;
      approvalStoreSource = store.path;
    }
  } else {
    try {
      const store = readApprovalStore();
      if (store.enabled && store.status === 'available' && Array.isArray(store.records)) {
        approvedCount = store.records.filter(r => r.status === 'approved').length;
        rejectedCount = store.records.filter(r => r.status === 'rejected').length;
        pendingApprovalCount = store.records.filter(r => r.status === 'pending').length;
        approvalStoreSource = store.path;
      } else {
        reviewBlockers.push('approvalStoreUnavailableOrDisabled');
      }
    } catch {
      reviewBlockers.push('approvalStoreReadError');
    }
  }

  const reviewBurden: BrainCoreContinuousProcessingMeasurementView['reviewBurden'] = {
    pendingReviewCount,
    failedNeedingReviewCount,
    approvedCount,
    rejectedCount,
    pendingApprovalCount,
    approvalStoreSource,
    source: 'queue-status-reported-items-and-approval-store',
    blockers: reviewBlockers,
  };

  // --- CONFIGURATION: clearly separate from measurements ---
  const configuration: BrainCoreContinuousProcessingMeasurementView['configuration'] = {
    maxConcurrentJobs: queueState.settings.maxConcurrentJobs,
    maxFilesPerRun: queueState.settings.maxFilesPerRun,
    maxRetries: queueState.settings.maxRetries,
    debounceSeconds: queueState.settings.debounceSeconds,
    minimumSecondsBetweenRuns: queueState.settings.minimumSecondsBetweenRuns,
  };

  // --- VALUE ASSESSMENT: always not-proven without comparative evidence ---
  const valueAssessment: BrainCoreContinuousProcessingMeasurementView['valueAssessment'] = {
    status: 'not-proven',
    evidence: [
      latencySampleCount > 0 ? 'latency-timestamps-available' : null,
      'process-memory-sample-available',
      approvedCount !== null ? 'approval-store-readable' : null,
    ].filter(Boolean) as string[],
    blockers: [
      'noBaselineComparisonAvailable',
      'noBeforeAfterTimeSavingsEvidence',
    ],
  };

  return {
    id: 'continuous-processing-measurement-view',
    status: 'available',
    source: 'brain-runtime-queue-state',
    generatedAt: now.toISOString(),
    latency,
    machineLoad,
    reviewBurden,
    configuration,
    valueAssessment,
    blockers: [],
    safety: SAFETY,
  };
}
