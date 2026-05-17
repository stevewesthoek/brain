import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRequestedKind } from './action-allowlist.js';
import type {
  BrainCoreActionRequestResult,
  BrainCoreApprovalAuditEvent,
  BrainCoreApprovalDecisionResult,
  BrainCoreApprovalSummary,
} from '../types/api.js';

const approvals = new Map<string, BrainCoreApprovalSummary>();
const auditEvents: BrainCoreApprovalAuditEvent[] = [];
let nextApprovalNumber = 1;
let nextAuditNumber = 1;

export function requestAction(kind = 'manual-request'): BrainCoreActionRequestResult {
  const classified = classifyRequestedKind(kind);

  if (!classified.supported) {
    const rejectedId = `request-${nextAuditNumber++}`;
    recordAdhocAuditEvent(rejectedId, classified.normalizedKind, 'rejected');
    return {
      accepted: false,
      executed: false,
      message: classified.rejectionReason || 'Unsupported approval request kind.',
    };
  }

  const approval: BrainCoreApprovalSummary = {
    id: `approval-${nextApprovalNumber++}`,
    kind: classified.normalizedKind,
    status: 'pending',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    source: 'memory',
  };

  approvals.set(approval.id, approval);
  recordAuditEvent(approval, 'requested');

  return {
    approval,
    accepted: true,
    executed: false,
    message: 'Action request recorded. Brain Core creates approval records and audit events only; it does not execute actions yet.',
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

export function listApprovalAuditEvents(): BrainCoreApprovalAuditEvent[] {
  const persistedEvents = readPersistedAuditEvents();
  const merged = [...persistedEvents, ...auditEvents];
  const byId = new Map(merged.map((event) => [event.id, event]));

  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
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
    recordAuditEvent(missing, 'missing');

    return {
      approval: missing,
      accepted: true,
      executed: false,
      message: `Approval ${approvalId} was not found. No action was executed.`,
    };
  }

  const updated: BrainCoreApprovalSummary = {
    ...approval,
    status: decision === 'approve' ? 'approved' : 'rejected',
  };
  approvals.set(approvalId, updated);
  recordAuditEvent(updated, decision === 'approve' ? 'approved' : 'rejected');

  return {
    approval: updated,
    accepted: true,
    executed: false,
    message: `Approval ${approvalId} marked ${updated.status}. Brain Core does not execute approved actions yet.`,
  };
}

function recordAuditEvent(
  approval: BrainCoreApprovalSummary,
  event: BrainCoreApprovalAuditEvent['event'],
): void {
  const auditEvent: BrainCoreApprovalAuditEvent = {
    id: `audit-${nextAuditNumber++}`,
    approvalId: approval.id,
    event,
    kind: approval.kind,
    createdAt: new Date().toISOString(),
    persisted: false,
    executed: false,
    source: 'memory',
  };

  const persisted = appendAuditEvent(auditEvent);
  auditEvents.push({
    ...auditEvent,
    persisted,
    source: persisted ? 'jsonl' : 'memory',
  });
}

function recordAdhocAuditEvent(
  approvalId: string,
  kind: string,
  event: BrainCoreApprovalAuditEvent['event'],
): void {
  const auditEvent: BrainCoreApprovalAuditEvent = {
    id: `audit-${nextAuditNumber++}`,
    approvalId,
    event,
    kind,
    createdAt: new Date().toISOString(),
    persisted: false,
    executed: false,
    source: 'memory',
  };

  const persisted = appendAuditEvent(auditEvent);
  auditEvents.push({
    ...auditEvent,
    persisted,
    source: persisted ? 'jsonl' : 'memory',
  });
}

function appendAuditEvent(event: BrainCoreApprovalAuditEvent): boolean {
  const auditPath = getAuditPath();
  if (!auditPath) {
    return false;
  }

  const dir = path.dirname(auditPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify({ ...event, persisted: true, executed: false, source: 'jsonl' })}\n`);
  return true;
}

function readPersistedAuditEvents(): BrainCoreApprovalAuditEvent[] {
  const auditPath = getAuditPath();
  if (!auditPath || !fs.existsSync(auditPath)) {
    return [];
  }

  return fs
    .readFileSync(auditPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseAuditEvent)
    .filter((event): event is BrainCoreApprovalAuditEvent => event !== undefined);
}

function parseAuditEvent(line: string): BrainCoreApprovalAuditEvent | undefined {
  try {
    const value = JSON.parse(line) as Partial<BrainCoreApprovalAuditEvent>;
    if (!value.id || !value.approvalId || !value.event || !value.kind || !value.createdAt) {
      return undefined;
    }

    return {
      id: value.id,
      approvalId: value.approvalId,
      event: value.event,
      kind: value.kind,
      createdAt: value.createdAt,
      persisted: value.persisted === true,
      executed: false,
      source: 'jsonl',
    };
  } catch {
    return undefined;
  }
}

function getAuditPath(): string | undefined {
  const rawPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const resolvedPath = rawPath ? path.resolve(rawPath) : getDefaultAuditPath();
  if (!isSafeAuditPath(resolvedPath)) {
    return undefined;
  }

  return resolvedPath;
}

function isSafeAuditPath(resolvedPath: string): boolean {
  const normalized = resolvedPath.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('..')) {
    return false;
  }

  const disallowedSegments = ['/mind/', '/.env', '/.git/', '/node_modules/', '/dist/', '/build/'];
  return !disallowedSegments.some((segment) => normalized.includes(segment));
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');

export function getDefaultAuditPath(): string {
  return path.resolve(PACKAGE_ROOT, 'runtime/local/brain-core/approval-audit.jsonl');
}
