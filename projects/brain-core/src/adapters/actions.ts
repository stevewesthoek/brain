import type {
  BrainCoreActionRequestResult,
  BrainCoreApprovalDecisionResult,
  BrainCoreApprovalSummary,
} from '../types/api.js';

const approvals = new Map<string, BrainCoreApprovalSummary>();
let nextApprovalNumber = 1;

export function requestAction(kind = 'manual-request'): BrainCoreActionRequestResult {
  const approval: BrainCoreApprovalSummary = {
    id: `approval-${nextApprovalNumber++}`,
    kind: normalizeKind(kind),
    status: 'pending',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    source: 'memory',
  };

  approvals.set(approval.id, approval);

  return {
    approval,
    executed: false,
    message: 'Action request recorded. Brain Core Phase 4 creates approval records only; it does not execute actions yet.',
  };
}

export function listApprovalRecords(): BrainCoreApprovalSummary[] {
  if (approvals.size === 0) {
    return [
      {
        id: 'approval-store-placeholder',
        kind: 'not-connected',
        status: 'placeholder',
        source: 'placeholder',
      },
    ];
  }

  return [...approvals.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function decideApproval(
  approvalId: string,
  decision: 'approve' | 'reject',
): BrainCoreApprovalDecisionResult {
  const approval = approvals.get(approvalId);

  if (!approval) {
    const missing: BrainCoreApprovalSummary = {
      id: approvalId,
      kind: 'unknown',
      status: 'expired',
      source: 'memory',
    };

    return {
      approval: missing,
      executed: false,
      message: `Approval ${approvalId} was not found. No action was executed.`,
    };
  }

  const updated: BrainCoreApprovalSummary = {
    ...approval,
    status: decision === 'approve' ? 'approved' : 'rejected',
  };
  approvals.set(approvalId, updated);

  return {
    approval: updated,
    executed: false,
    message: `Approval ${approvalId} marked ${updated.status}. Brain Core Phase 4 does not execute approved actions yet.`,
  };
}

function normalizeKind(kind: string): string {
  return kind
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'manual-request';
}
