/**
 * Approval Analytics — Phase 1 implementation
 *
 * Computes approval statistics from the VO approval store
 * (file-based, ~/.local/video-orchestrator/state/approvals.json).
 *
 * No database required — aggregates directly from persisted JSON records.
 */

import { readAllVOApprovals } from './vo-studio-approval-store.js';
import type { VOApprovalRecord } from './vo-studio-approval-store.js';

export interface ApprovalStats {
  totalRequested: number;
  totalApproved: number;
  totalRejected: number;
  approvalRate: number;
  avgDecisionTimeMinutes: number;
  avgWaitTimeMinutes: number;
  rejectionReasons: Record<string, number>;
  byType: Record<string, { requested: number; approved: number; rejected: number }>;
  byProject: Record<string, { requested: number; approved: number; rejected: number }>;
  byOperator: Record<string, { decided: number; approvalRate: number }>;
}

export interface ApprovalStatsResponse {
  ok: boolean;
  stats?: ApprovalStats;
  since?: string;
  until?: string;
  error?: string;
}

/**
 * Parse a relative date param like "30d", "7d", "1d" or return an absolute date.
 */
export function parseDateParam(param: string): Date {
  const relativeMatch = /^(\d+)d$/.exec(param);
  if (relativeMatch) {
    const days = parseInt(relativeMatch[1] ?? '30', 10);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(param);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  // Default: 30 days ago
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Compute approval statistics for a given time window.
 * Reads from the VO approval file store.
 */
export function getApprovalStats(
  projectId?: string,
  since?: Date,
  until?: Date,
): ApprovalStatsResponse {
  const effectiveSince = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const effectiveUntil = until ?? new Date();

  let records: VOApprovalRecord[];
  try {
    records = readAllVOApprovals(projectId);
  } catch {
    return { ok: false, error: 'Failed to read approval store' };
  }

  // Filter by time window
  const filtered = records.filter((r) => {
    const createdAt = new Date(r.requestedAt);
    return createdAt >= effectiveSince && createdAt <= effectiveUntil;
  });

  const stats: ApprovalStats = {
    totalRequested: 0,
    totalApproved: 0,
    totalRejected: 0,
    approvalRate: 0,
    avgDecisionTimeMinutes: 0,
    avgWaitTimeMinutes: 0,
    rejectionReasons: {},
    byType: {},
    byProject: {},
    byOperator: {},
  };

  const decisionTimesMinutes: number[] = [];

  for (const record of filtered) {
    stats.totalRequested++;

    if (record.status === 'approved') {
      stats.totalApproved++;
    } else if (record.status === 'rejected') {
      stats.totalRejected++;
      // Track rejection reasons from decisionNote
      const reason = record.decisionNote ?? 'unspecified';
      stats.rejectionReasons[reason] = (stats.rejectionReasons[reason] ?? 0) + 1;
    }

    // Decision time
    if (record.decidedAt) {
      const requestedMs = new Date(record.requestedAt).getTime();
      const decidedMs = new Date(record.decidedAt).getTime();
      const minutes = (decidedMs - requestedMs) / 60_000;
      if (minutes >= 0) {
        decisionTimesMinutes.push(minutes);
      }
    }

    // By type
    const type = record.type;
    if (!stats.byType[type]) {
      stats.byType[type] = { requested: 0, approved: 0, rejected: 0 };
    }
    stats.byType[type].requested++;
    if (record.status === 'approved') stats.byType[type].approved++;
    if (record.status === 'rejected') stats.byType[type].rejected++;

    // By project
    const proj = record.projectId;
    if (!stats.byProject[proj]) {
      stats.byProject[proj] = { requested: 0, approved: 0, rejected: 0 };
    }
    stats.byProject[proj].requested++;
    if (record.status === 'approved') stats.byProject[proj].approved++;
    if (record.status === 'rejected') stats.byProject[proj].rejected++;

    // By operator (actor who made the decision)
    if (record.decidedAt && record.status !== 'pending' && record.status !== 'expired') {
      // Use actor as the operator identifier for Phase 1
      // (Phase 2 will have a separate decidedBy field)
      const operator = record.actor;
      if (!stats.byOperator[operator]) {
        stats.byOperator[operator] = { decided: 0, approvalRate: 0 };
      }
      stats.byOperator[operator].decided++;
    }
  }

  // Compute averages
  if (decisionTimesMinutes.length > 0) {
    const sum = decisionTimesMinutes.reduce((a, b) => a + b, 0);
    stats.avgDecisionTimeMinutes = sum / decisionTimesMinutes.length;
    stats.avgWaitTimeMinutes = stats.avgDecisionTimeMinutes;
  }

  // Compute approval rate
  stats.approvalRate = stats.totalRequested > 0
    ? stats.totalApproved / stats.totalRequested
    : 0;

  // Compute per-operator approval rates
  for (const [operator, opStats] of Object.entries(stats.byOperator)) {
    const opRecords = filtered.filter(
      (r) => r.actor === operator && (r.status === 'approved' || r.status === 'rejected'),
    );
    const opApproved = opRecords.filter((r) => r.status === 'approved').length;
    stats.byOperator[operator] = {
      decided: opStats.decided,
      approvalRate: opStats.decided > 0 ? opApproved / opStats.decided : 0,
    };
  }

  return {
    ok: true,
    stats,
    since: effectiveSince.toISOString(),
    until: effectiveUntil.toISOString(),
  };
}

export interface AuditLogEntry {
  id: string;
  approvalId: string;
  action: 'created' | 'approved' | 'rejected' | 'escalated' | 'expired';
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface AuditLogResponse {
  ok: boolean;
  entries: AuditLogEntry[];
  count: number;
  error?: string;
}

/**
 * Build an audit log for a specific projectId from the VO approval store.
 * Phase 1: derives log entries from the approval records themselves.
 * Phase 2: a dedicated audit_log table will replace this.
 */
export function getFullAuditLog(projectId?: string): AuditLogResponse {
  let records: VOApprovalRecord[];
  try {
    records = readAllVOApprovals(projectId);
  } catch {
    return { ok: false, entries: [], count: 0, error: 'Failed to read approval store' };
  }

  const entries: AuditLogEntry[] = [];

  for (const record of records) {
    // Entry: created
    entries.push({
      id: `${record.id}-created`,
      approvalId: record.id,
      action: 'created',
      actor: record.actor,
      timestamp: record.requestedAt,
      details: {
        type: record.type,
        projectId: record.projectId,
        expiresAt: record.expiresAt,
      },
    });

    // Entry: decision (if made)
    if (record.decidedAt) {
      const action = record.status === 'expired'
        ? 'expired'
        : record.status === 'approved'
          ? 'approved'
          : 'rejected';

      entries.push({
        id: `${record.id}-${action}`,
        approvalId: record.id,
        action,
        actor: record.actor,
        timestamp: record.decidedAt,
        details: {
          note: record.decisionNote ?? null,
          previousStatus: 'pending',
          newStatus: record.status,
        },
      });
    }
  }

  // Sort newest first
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return { ok: true, entries, count: entries.length };
}
