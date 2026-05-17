import { listApprovalRecords } from './actions.js';
import type { BrainCoreApprovalSummary } from '../types/api.js';

export function listApprovals(): BrainCoreApprovalSummary[] {
  return listApprovalRecords();
}
