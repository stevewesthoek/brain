import crypto from 'node:crypto';

export function computeProposalHash(proposal) {
  return crypto
    .createHash('sha256')
    .update(`${proposal.proposalId}:${JSON.stringify(proposal)}`)
    .digest('hex')
    .substring(0, 16);
}

export function decisionRecordsEquivalent(existing, next) {
  return Boolean(
    existing
    && existing.proposalHash === next.proposalHash
    && existing.decision === next.decision
    && existing.decidedBy === next.decidedBy
    && existing.reason === next.reason
    && existing.deferUntil === next.deferUntil,
  );
}

export function evaluateDecisionWriteGuard({ proposal, expectedProposalHash, existingRecord, nextRecord }) {
  const currentProposalHash = computeProposalHash(proposal);
  if (expectedProposalHash !== currentProposalHash) {
    return { ok: false, code: 'stale_proposal_hash', currentProposalHash };
  }
  if (decisionRecordsEquivalent(existingRecord, nextRecord)) {
    return { ok: true, code: 'decision_idempotent', currentProposalHash };
  }
  return { ok: true, code: 'decision_recorded', currentProposalHash };
}

export function projectDecisionStatus(approval, currentHash, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (!approval) return { status: 'pending', pending: true, deferUntil: null };
  if (!approval.proposalHash || approval.proposalHash !== currentHash) {
    return { status: 'superseded', pending: true, deferUntil: approval.deferUntil ?? null };
  }
  if (approval.decision === 'approved') return { status: 'approved', pending: false, deferUntil: null };
  if (approval.decision === 'rejected') return { status: 'rejected', pending: false, deferUntil: null };
  if (approval.decision === 'deferred') {
    const deferUntil = approval.deferUntil ?? null;
    if (deferUntil) {
      const parsed = Date.parse(deferUntil);
      if (Number.isFinite(parsed) && parsed > now.getTime()) return { status: 'deferred', pending: false, deferUntil };
    }
    return { status: 'pending', pending: true, deferUntil };
  }
  return { status: 'pending', pending: true, deferUntil: approval.deferUntil ?? null };
}

function localDateKey(now) {
  return `${now.getFullYear().toString().padStart(4, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

export function computeDecisionNotificationPlan(queue, previousState, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const notifications = [];
  const pendingItems = (queue.items ?? []).filter((item) => item.pending === true);
  const highPending = pendingItems.filter((item) => item.priority === 'high' || item.priority === 'critical');
  const alreadyNotified = new Set(previousState.notifiedHighDecisionIds ?? []);
  const newHighIds = highPending.map((item) => item.decisionId).filter((id) => !alreadyNotified.has(id));
  const zeroToPending = Number(previousState.lastPendingCount ?? 0) === 0 && Number(queue.counts?.pending ?? 0) > 0;

  if (newHighIds.length > 0 || zeroToPending) {
    const reasons = [];
    if (newHighIds.length > 0) reasons.push('high-priority');
    if (zeroToPending) reasons.push('zero-to-pending');
    notifications.push({
      id: `decision-attention:${now.getTime()}`,
      kind: 'attention',
      generatedAt: now.toISOString(),
      reasons,
      pendingCount: Number(queue.counts?.pending ?? 0),
      highPriorityPendingCount: Number(queue.counts?.highPriorityPending ?? 0),
      decisionIds: newHighIds,
      message: `Decision Center: ${Number(queue.counts?.pending ?? 0)} item${Number(queue.counts?.pending ?? 0) === 1 ? '' : 's'} need attention.`,
      sensitiveSourceTextIncluded: false,
    });
  }

  const dateKey = localDateKey(now);
  const normalPending = pendingItems.filter((item) => item.priority === 'normal' || item.priority === 'low');
  if (normalPending.length > 0 && previousState.lastDigestDate !== dateKey) {
    notifications.push({
      id: `decision-digest:${dateKey}`,
      kind: 'daily-digest',
      generatedAt: now.toISOString(),
      reasons: ['daily-digest'],
      pendingCount: Number(queue.counts?.pending ?? 0),
      highPriorityPendingCount: Number(queue.counts?.highPriorityPending ?? 0),
      decisionIds: normalPending.map((item) => item.decisionId),
      message: `Decision Center daily digest: ${Number(queue.counts?.pending ?? 0)} pending item${Number(queue.counts?.pending ?? 0) === 1 ? '' : 's'}.`,
      sensitiveSourceTextIncluded: false,
    });
  }

  const nextState = {
    schemaVersion: '1.0.0',
    lastPendingCount: Number(queue.counts?.pending ?? 0),
    notifiedHighDecisionIds: [...new Set([
      ...(previousState.notifiedHighDecisionIds ?? []).filter((id) => highPending.some((item) => item.decisionId === id)),
      ...newHighIds,
    ])],
    lastDigestDate: normalPending.length > 0 ? dateKey : (previousState.lastDigestDate ?? null),
    updatedAt: now.toISOString(),
  };

  return { notifications, nextState };
}
