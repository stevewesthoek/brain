import {
  readMindStewardInboxQueueState,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';
import type { BrainCoreContinuousProcessingStabilityView } from '../types/api.js';

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
} as const;

export function getContinuousProcessingStabilityView(state?: MindStewardInboxQueueState | null): BrainCoreContinuousProcessingStabilityView {
  const queueState = state === undefined ? readMindStewardInboxQueueState() : state;

  if (!queueState) {
    return {
      id: 'continuous-processing-stability-view',
      status: 'missing',
      source: 'brain-runtime-queue-state',
      queueStatePath: null,
      generatedAt: null,
      debounceSeconds: null,
      totalCount: 0,
      stableCount: 0,
      debouncingCount: 0,
      selectedStableCount: 0,
      items: [],
      blockers: ['queueStateUnavailable'],
      safety: SAFETY,
    };
  }

  const items = queueState.items.map(item => ({
    id: item.id,
    path: item.path,
    status: item.status,
    sizeBytes: item.sizeBytes,
    modifiedAt: item.modifiedAt,
    stableFile: item.stableFile,
    stableAt: item.stableAt,
    debounceSeconds: item.debounceSeconds,
    debounceUntil: item.debounceUntil,
    selectedForSample: item.selectedForSample,
    largeFile: item.largeFile,
    lastError: item.lastError,
  }));

  return {
    id: 'continuous-processing-stability-view',
    status: 'available',
    source: 'brain-runtime-queue-state',
    queueStatePath: queueState.safety.statePath,
    generatedAt: queueState.generatedAt,
    debounceSeconds: queueState.settings.debounceSeconds,
    totalCount: items.length,
    stableCount: items.filter(item => item.stableFile).length,
    debouncingCount: items.filter(item => item.debounceUntil !== null).length,
    selectedStableCount: items.filter(item => item.selectedForSample && item.stableFile && item.debounceUntil === null).length,
    items,
    blockers: queueState.status === 'ready' ? [] : queueState.blockers,
    safety: SAFETY,
  };
}
