import type { BrainCoreSchedulerJobSummary, BrainCoreSchedulerStatus } from '../types/api.js';

export function getSchedulerStatus(): BrainCoreSchedulerStatus {
  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Scheduler adapter is not connected in Brain Core Phase 1. This endpoint is read-only scaffolding for the future Office Nightly Scheduler integration.',
  };
}

export function getSchedulerLatestRun(): BrainCoreSchedulerStatus {
  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Latest scheduler run metadata is not connected yet. Brain Core Phase 1 does not inspect logs or runtime reports.',
  };
}

export function listSchedulerJobs(): BrainCoreSchedulerJobSummary[] {
  return [
    {
      id: 'mind-compile-loop',
      name: 'Mind compile loop',
      status: 'placeholder',
      mutationRequired: true,
    },
    {
      id: 'mind-memory-loop',
      name: 'Mind memory loop',
      status: 'placeholder',
      mutationRequired: true,
    },
    {
      id: 'mind-hygiene-loop',
      name: 'Mind hygiene loop',
      status: 'placeholder',
      mutationRequired: true,
    },
    {
      id: 'mind-drift-error-loop',
      name: 'Mind drift/error loop',
      status: 'placeholder',
      mutationRequired: false,
    },
  ];
}
