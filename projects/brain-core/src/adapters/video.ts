import type { BrainCoreVideoQueueItem, BrainCoreVideoStatus } from '../types/api.js';

export function getVideoStatus(): BrainCoreVideoStatus {
  return {
    status: 'placeholder',
    enabled: false,
    queueDepth: 0,
    source: 'placeholder',
    message: 'Video Orchestrator status adapter is not connected in Brain Core Phase 1. This endpoint is read-only scaffolding for future integration.',
  };
}

export function listVideoQueue(): BrainCoreVideoQueueItem[] {
  return [];
}
