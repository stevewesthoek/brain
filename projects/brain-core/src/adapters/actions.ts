import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRequestedKind } from './action-allowlist.js';
import { getExecutionPlanPreview } from './execution-plans.js';
import {
  getApprovalStorePath,
  persistApprovalStore,
  readApprovalStore,
} from './approval-store.js';
import type {
  BrainCoreActionRequestResult,
  BrainCoreApprovalAuditEvent,
  BrainCoreApprovalDecisionResult,
  BrainCoreApprovalPreview,
  BrainCoreApprovalRecord,
  BrainCoreApprovalSummary,
  BrainCoreExecutionGatePolicy,
  BrainCoreApprovalStoreSummary,
} from '../types/api.js';

const approvals = new Map<string, BrainCoreApprovalRecord>();
const auditEvents: BrainCoreApprovalAuditEvent[] = [];
let nextApprovalNumber = 1;
let nextAuditNumber = 1;

const APPROVAL_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export function requestAction(kind = 'manual-request'): BrainCoreActionRequestResult {
  syncApprovalStoreFromDisk();
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

  const now = new Date();
  const approval = createApprovalRecord({
    id: `approval-${nextApprovalNumber++}`,
    kind: classified.normalizedKind,
    status: 'pending',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    requestedBy: 'local-user',
    message: 'Action request recorded. Brain Core creates approval records and audit events only; it does not execute actions yet.',
  });

  approvals.set(approval.id, approval);
  persistIfConfigured();
  recordAuditEvent(toAuditApprovalSummary(approval), 'requested');

  return {
    approval: toApprovalSummary(approval),
    preview: approval.preview,
    policy: approval.policy,
    accepted: true,
    executed: false,
    message: approval.message ?? '',
  };
}

export function listApprovalRecords(): BrainCoreApprovalSummary[] {
  syncApprovalStoreFromDisk();
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

  return [...approvals.values()]
    .map(normalizeApprovalForRead)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(toApprovalSummary);
}

export function getApprovalStoreSummary(): BrainCoreApprovalStoreSummary {
  const store = readApprovalStore();
  return {
    enabled: store.enabled,
    status: store.status,
    path: store.path,
    recordCount: store.enabled || store.status !== 'memory' ? store.recordCount : approvals.size,
    writesToMind: false,
    executableActions: false,
  };
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
  syncApprovalStoreFromDisk();
  const approval = approvals.get(approvalId);

  if (!approval) {
    const missing = createApprovalRecord({
      id: approvalId,
      kind: 'unknown',
      status: 'expired',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requestedBy: 'memory',
      reason: 'Missing approval record',
      message: `Approval ${approvalId} was not found. No action was executed.`,
    });
    recordAuditEvent(toAuditApprovalSummary(missing), 'missing');

    return {
      approval: toApprovalSummary(missing),
      preview: missing.preview,
      policy: missing.policy,
      accepted: true,
      executed: false,
    message: missing.message ?? '',
    };
  }

  const normalized = normalizeApprovalForRead(approval);
  if (normalized.status === 'expired') {
    recordAuditEvent(toAuditApprovalSummary(normalized), 'missing');
    return {
      approval: toApprovalSummary(normalized),
      preview: normalized.preview,
      policy: normalized.policy,
      accepted: true,
      executed: false,
      message: `Approval ${approvalId} is expired. No action was executed.`,
    };
  }

  const updated = createApprovalRecord({
    ...normalized,
    status: decision === 'approve' ? 'approved' : 'rejected',
    updatedAt: new Date().toISOString(),
    message: `Approval ${approvalId} marked ${decision === 'approve' ? 'approved' : 'rejected'}. Brain Core does not execute approved actions yet.`,
  });
  approvals.set(approvalId, updated);
  persistIfConfigured();
  recordAuditEvent(toAuditApprovalSummary(updated), decision === 'approve' ? 'approved' : 'rejected');

  return {
    approval: toApprovalSummary(updated),
    preview: updated.preview,
    policy: updated.policy,
    accepted: true,
    executed: false,
    message: updated.message ?? '',
  };
}

function createApprovalRecord(input: {
  id: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  reason?: string;
  message?: string;
}): BrainCoreApprovalRecord {
  const preview = createPreview(input.kind);
  const policy = createPolicy();
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    expiresAt: new Date(Date.parse(input.createdAt) + APPROVAL_EXPIRATION_MS).toISOString(),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    requestedBy: input.requestedBy,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.message ? { message: input.message } : {}),
    executed: false,
    preview,
    policy,
    source: getApprovalStorePath() ? 'json' : 'memory',
  };
}

function normalizeApprovalForRead(record: BrainCoreApprovalRecord): BrainCoreApprovalRecord {
  const now = Date.now();
  const expired = typeof record.expiresAt === 'string' && Date.parse(record.expiresAt) <= now;
  return {
    ...record,
    status: expired && record.status === 'pending' ? 'expired' : record.status,
    executed: false,
    preview: {
      ...record.preview,
      wouldExecute: false,
      requiresApproval: true,
      writesToMind: false,
      externalSideEffects: false,
      commands: [],
    },
    policy: createPolicy(),
    source: record.source === 'json' ? 'json' : 'memory',
  };
}

function toApprovalSummary(record: BrainCoreApprovalRecord): BrainCoreApprovalSummary {
  const expiresAt = typeof record.expiresAt === 'string' && record.expiresAt.length > 0 ? record.expiresAt : undefined;
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    ...(expiresAt ? { expiresAt } : {}),
    source: 'memory',
  };
}

function toAuditApprovalSummary(record: BrainCoreApprovalRecord): BrainCoreApprovalSummary {
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    ...(typeof record.expiresAt === 'string' && record.expiresAt.length > 0 ? { expiresAt: record.expiresAt } : {}),
    source: 'memory',
  };
}

function createPreview(kind: string): BrainCoreApprovalPreview {
  const executionPlanPreview = kind === 'scheduler-run-model-router-dry-run' ? getExecutionPlanPreview(kind) : undefined;
  const summary =
    executionPlanPreview ??
    (kind.startsWith('scheduler-run-')
      ? `Queue scheduler dry-run request for ${kind.replace('scheduler-run-', '')}`
      : kind.startsWith('skill-profile-')
        ? `Select skill profile ${kind.replace('skill-profile-', '')}`
        : kind.startsWith('session-resume-')
          ? `Prepare session resume request for ${kind.replace('session-resume-', '')}`
          : kind.startsWith('local-app-')
            ? `Prepare local app lifecycle request for ${kind.replace('local-app-', '')}`
            : kind);

  return {
    kind,
    summary,
    wouldExecute: false,
    requiresApproval: true,
    writesToMind: false,
    externalSideEffects: false,
    commands: [],
  };
}

function createPolicy(): BrainCoreExecutionGatePolicy {
  return {
    executionEnabled: false,
    executionGate: 'disabled-until-explicit-enable',
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
  };
}

function syncApprovalStoreFromDisk(): void {
  const store = readApprovalStore();
  if (!store.enabled || store.status !== 'available') {
    return;
  }

  approvals.clear();
  for (const record of store.records) {
    approvals.set(record.id, normalizeApprovalForRead(record));
  }
}

function persistIfConfigured(): void {
  const records = [...approvals.values()].map(normalizeApprovalForRead);
  persistApprovalStore(records);
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

  try {
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.appendFileSync(auditPath, `${JSON.stringify({ ...event, persisted: true, executed: false, source: 'jsonl' })}\n`);
    return true;
  } catch {
    return false;
  }
}

function readPersistedAuditEvents(): BrainCoreApprovalAuditEvent[] {
  const auditPath = getAuditPath();
  if (!auditPath || !fs.existsSync(auditPath)) {
    return [];
  }

  try {
    return fs
      .readFileSync(auditPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map(parseAuditEvent)
      .filter((event): event is BrainCoreApprovalAuditEvent => event !== undefined);
  } catch {
    return [];
  }
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
