import type { BrainCoreLocalAppSummary } from '../types/api.js';

const PLACEHOLDER_APPS: BrainCoreLocalAppSummary[] = [
  {
    id: 'probot',
    name: 'ProBot legacy dashboard/client service',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
  {
    id: 'office-scheduler',
    name: 'Office Nightly Scheduler',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
];

export function listLocalApps(): BrainCoreLocalAppSummary[] {
  return PLACEHOLDER_APPS;
}
