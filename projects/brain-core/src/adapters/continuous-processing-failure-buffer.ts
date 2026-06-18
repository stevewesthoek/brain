import {
  readMindStewardInboxQueueState,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';
import type { BrainCoreContinuousProcessingFailureBufferView } from '../types/api.js';

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
  clearsFailureBuffer: false,
} as const;

const FAILURE_BUFFER_PAUSE_THRESHOLD = 5;

export interface ContinuousProcessingFailureBufferOptions {
  state?: MindStewardInboxQueueState | null;
  failureBufferPauseThreshold?: number;
}

export function getContinuousProcessingFailureBufferView(
  options: ContinuousProcessingFailureBufferOptions = {},
): BrainCoreContinuousProcessingFailureBufferView {
  const queueState = options.state === undefined ? readMindStewardInboxQueueState() : options.state;
  const pauseThreshold = options.failureBufferPauseThreshold ?? FAILURE_BUFFER_PAUSE_THRESHOLD;

  if (!queueState) {
    return {
      id: 'continuous-processing-failure-buffer-view',
      status: 'missing',
      source: 'brain-runtime-queue-state',
      maxRetries: null,
      failureBufferPauseThreshold: pauseThreshold,
      exhaustedCount: 0,
      retryPendingCount: 0,
      totalFailureBufferCount: 0,
      shouldPauseContinuousProcessing: false,
      items: [],
      blockers: ['queueStateUnavailable'],
      safety: SAFETY,
    };
  }

  const exhaustedItems = queueState.items.filter(
    item => item.status === 'failed' && item.failureRoute === 'brain-runtime-queue-status',
  );
  const retryPendingItems = queueState.items.filter(
    item => item.status === 'pending' && item.nextRetryAfter !== null,
  );
  const totalFailureBufferCount = exhaustedItems.length + retryPendingItems.length;
  const shouldPause = exhaustedItems.length >= pauseThreshold;

  const items = [
    ...exhaustedItems.map(item => ({
      id: item.id,
      path: item.path,
      attemptCount: item.attemptCount,
      maxRetries: queueState.settings.maxRetries,
      retriesExhausted: true,
      lastError: item.lastError,
      nextRetryAfter: item.nextRetryAfter,
      failureRoute: item.failureRoute,
    })),
    ...retryPendingItems.map(item => ({
      id: item.id,
      path: item.path,
      attemptCount: item.attemptCount,
      maxRetries: queueState.settings.maxRetries,
      retriesExhausted: false,
      lastError: item.lastError,
      nextRetryAfter: item.nextRetryAfter,
      failureRoute: item.failureRoute,
    })),
  ];

  return {
    id: 'continuous-processing-failure-buffer-view',
    status: 'available',
    source: 'brain-runtime-queue-state',
    maxRetries: queueState.settings.maxRetries,
    failureBufferPauseThreshold: pauseThreshold,
    exhaustedCount: exhaustedItems.length,
    retryPendingCount: retryPendingItems.length,
    totalFailureBufferCount,
    shouldPauseContinuousProcessing: shouldPause,
    items,
    blockers: shouldPause ? ['failureBufferExceedsPauseThreshold'] : [],
    safety: SAFETY,
  };
}
