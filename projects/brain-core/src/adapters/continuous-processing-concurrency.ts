import {
  readMindStewardInboxQueueState,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';
import type { BrainCoreContinuousProcessingConcurrencyView } from '../types/api.js';

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
  modifiesConcurrencyAtRuntime: false,
} as const;

export interface ContinuousProcessingConcurrencyOptions {
  state?: MindStewardInboxQueueState | null;
  runningJobs?: number;
}

export function getContinuousProcessingConcurrencyView(
  options: ContinuousProcessingConcurrencyOptions = {},
): BrainCoreContinuousProcessingConcurrencyView {
  const queueState = options.state === undefined ? readMindStewardInboxQueueState() : options.state;
  const runningJobs = options.runningJobs ?? 0;

  if (!queueState) {
    return {
      id: 'continuous-processing-concurrency-view',
      status: 'missing',
      source: 'brain-runtime-queue-state',
      maxConcurrentJobs: null,
      runningJobs: 0,
      availableSlots: 0,
      capReached: false,
      capBlocking: false,
      blockers: ['queueStateUnavailable'],
      safety: SAFETY,
    };
  }

  const maxConcurrentJobs = queueState.settings.maxConcurrentJobs;
  const availableSlots = Math.max(0, maxConcurrentJobs - runningJobs);
  const capReached = runningJobs >= maxConcurrentJobs;

  return {
    id: 'continuous-processing-concurrency-view',
    status: 'available',
    source: 'brain-runtime-queue-state',
    maxConcurrentJobs,
    runningJobs,
    availableSlots,
    capReached,
    capBlocking: capReached,
    blockers: capReached ? ['maxConcurrentJobsReached'] : [],
    safety: SAFETY,
  };
}
