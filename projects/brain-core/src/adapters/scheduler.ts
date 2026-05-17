import type { BrainCoreSchedulerStatus } from '../types/api.js';

export function getSchedulerStatus(): BrainCoreSchedulerStatus {
  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Scheduler adapter is not connected in Brain Core Phase 1. This endpoint is read-only scaffolding for the future Office Nightly Scheduler integration.',
  };
}
