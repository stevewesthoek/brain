import type { BrainCoreApprovalSummary } from '../types/api.js';

export function listApprovals(): BrainCoreApprovalSummary[] {
  return [
    {
      id: 'approval-store-placeholder',
      kind: 'not-connected',
      status: 'placeholder',
      source: 'placeholder',
    },
  ];
}
