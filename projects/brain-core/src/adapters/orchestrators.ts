import type { BrainCoreOrchestratorSummary } from '../types/api.js';

const ORCHESTRATORS: BrainCoreOrchestratorSummary[] = [
  {
    id: 'video-orchestrator',
    name: 'Video Orchestrator',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
  {
    id: 'mind-model-router',
    name: 'Mind Model Router',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
  {
    id: 'office-nightly-scheduler',
    name: 'Office Nightly Scheduler',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
];

export function listOrchestrators(): BrainCoreOrchestratorSummary[] {
  return ORCHESTRATORS;
}
