/**
 * VO Studio Approval Store — Phase 1W
 *
 * Persists write-endpoint approval records to
 * ~/.local/video-orchestrator/state/approvals.json
 *
 * This store is separate from the general brain-core approval store and
 * is purpose-built for Video Orchestrator Studio operator review flows.
 *
 * Phase 2W will migrate this to a proper database with timeout logic,
 * notifications, and role-based approvals.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'video-orchestrator', 'state');

/** Returns the approvals file path. Reads env at call time so tests can override. */
function getApprovalsPath(): string {
  return process.env['VO_APPROVALS_PATH'] ?? path.join(DEFAULT_STATE_DIR, 'approvals.json');
}

/** Returns the state dir for the current approvals path. */
function getStateDir(): string {
  return path.dirname(getApprovalsPath());
}

const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export type VOApprovalType = 'content' | 'metadata' | 'thumbnail' | 'package';
export type VOApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface VOApprovalRecord {
  id: string;
  type: VOApprovalType;
  projectId: string;
  actor: string;
  requestedAt: string;
  expiresAt: string;
  status: VOApprovalStatus;
  requestPayload: Record<string, unknown>;
  decidedAt?: string;
  decisionNote?: string;
}

export interface VOApprovalSummary {
  id: string;
  status: VOApprovalStatus;
}

function ensureStateDir(): void {
  fs.mkdirSync(getStateDir(), { recursive: true });
}

function readAllApprovals(): VOApprovalRecord[] {
  const approvalsPath = getApprovalsPath();
  if (!fs.existsSync(approvalsPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(approvalsPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as VOApprovalRecord[];
    }
    return [];
  } catch {
    return [];
  }
}

function writeAllApprovals(records: VOApprovalRecord[]): void {
  ensureStateDir();
  fs.writeFileSync(getApprovalsPath(), JSON.stringify(records, null, 2));
}

/**
 * Create a new pending approval record and persist it.
 * Returns a summary with id + status.
 */
export function createVOApproval(
  type: VOApprovalType,
  projectId: string,
  payload: Record<string, unknown>,
  actor = 'browser-user',
): VOApprovalSummary {
  const now = Date.now();
  const approval: VOApprovalRecord = {
    id: `approval-${type}-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    projectId,
    actor,
    requestedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEFAULT_EXPIRY_MS).toISOString(),
    status: 'pending',
    requestPayload: payload,
  };

  const existing = readAllApprovals();
  existing.push(approval);
  writeAllApprovals(existing);

  return { id: approval.id, status: approval.status };
}

/**
 * Read all pending approval records (not expired, not decided).
 * Optionally filtered by projectId.
 */
export function readPendingVOApprovals(projectId?: string): VOApprovalRecord[] {
  const now = new Date().toISOString();
  return readAllApprovals().filter((record) => {
    if (record.status !== 'pending') return false;
    if (record.expiresAt && record.expiresAt < now) return false;
    if (projectId && record.projectId !== projectId) return false;
    return true;
  });
}

/**
 * Read all approval records, including decided and expired.
 * Optionally filtered by projectId.
 */
export function readAllVOApprovals(projectId?: string): VOApprovalRecord[] {
  return readAllApprovals().filter((record) => {
    if (projectId && record.projectId !== projectId) return false;
    return true;
  });
}

/**
 * Apply a decision (approve or reject) to an approval record.
 */
export function decideVOApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  note?: string,
): { ok: boolean; error?: string } {
  const records = readAllApprovals();
  const idx = records.findIndex((r) => r.id === approvalId);

  if (idx === -1) {
    return { ok: false, error: `Approval ${approvalId} not found` };
  }

  const record = records[idx];
  if (!record) {
    return { ok: false, error: `Approval ${approvalId} not found` };
  }

  if (record.status !== 'pending') {
    return { ok: false, error: `Approval ${approvalId} is already ${record.status}` };
  }

  const now = new Date().toISOString();
  if (record.expiresAt && record.expiresAt < now) {
    records[idx] = { ...record, status: 'expired', decidedAt: now };
    writeAllApprovals(records);
    return { ok: false, error: `Approval ${approvalId} has expired` };
  }

  records[idx] = {
    ...record,
    status: decision,
    decidedAt: now,
    ...(note ? { decisionNote: note } : {}),
  };

  writeAllApprovals(records);
  return { ok: true };
}

/**
 * Get the path to the approvals file (for diagnostics).
 */
export function getVOApprovalsPath(): string {
  return getApprovalsPath();
}

export interface CheckExpiryResult {
  escalated: string[];
  failed: string[];
}

/**
 * Check for expired pending approvals and auto-reject them.
 * Returns escalated IDs (near expiry) and failed IDs (auto-rejected).
 *
 * Phase 2W: timeout + escalation support.
 * Writes directly to avoid the expiry guard in decideVOApproval.
 */
export function checkAndEscalateExpiredApprovals(): CheckExpiryResult {
  const records = readAllApprovals();
  const now = new Date();
  const escalated: string[] = [];
  const failed: string[] = [];
  let dirty = false;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record || record.status !== 'pending' || !record.expiresAt) continue;

    const expiresAt = new Date(record.expiresAt);
    if (now > expiresAt) {
      // Auto-reject — write directly so status stays 'rejected', not 'expired'
      records[i] = {
        ...record,
        status: 'rejected',
        decidedAt: now.toISOString(),
        decisionNote: 'auto_rejected_timeout',
      };
      failed.push(record.id);
      dirty = true;
    } else if (now.getTime() > expiresAt.getTime() - 5 * 60 * 1000) {
      // Within 5 minutes of expiry — flag for escalation notification
      escalated.push(record.id);
    }
  }

  if (dirty) {
    writeAllApprovals(records);
  }

  return { escalated, failed };
}
