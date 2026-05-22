import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRequestedKind } from './action-allowlist.js';
import {
  getExecutionPlanPreview,
  getMindStewardDryRunExecutionFlagName,
  isMindStewardDryRunExecutionFlagEnabled,
} from './execution-plans.js';
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
  BrainCoreApprovalExecutionSummary,
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

export function getApprovalRecord(
  approvalId: string,
): BrainCoreApprovalRecord | undefined {
  syncApprovalStoreFromDisk();
  const approval = approvals.get(approvalId);
  if (!approval) {
    return undefined;
  }

  const normalized = normalizeApprovalForRead(approval);
  const now = new Date();
  const createdTime = new Date(normalized.createdAt).getTime();
  const ageMinutes = Math.floor((now.getTime() - createdTime) / 60000);
  const expiresAt = normalized.expiresAt ?? new Date().toISOString();
  const expiresTime = new Date(expiresAt).getTime();
  const expired = now.getTime() >= expiresTime && normalized.status === 'pending';

  return {
    ...normalized,
    ageMinutes,
    expired,
  };
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

export function getApprovalAuditEvents(approvalId: string): BrainCoreApprovalAuditEvent[] {
  const allEvents = listApprovalAuditEvents();
  return allEvents.filter(event => event.approvalId === approvalId);
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

  const execution = decision === 'approve' ? executeApprovedActionIfReady(normalized) : undefined;
  const updated = createApprovalRecord({
    ...normalized,
    status: decision === 'approve' ? 'approved' : 'rejected',
    updatedAt: new Date().toISOString(),
    message:
      execution?.status === 'ok'
        ? `Approval ${approvalId} marked approved and executed report-only mind-steward dry-run.`
        : `Approval ${approvalId} marked ${decision === 'approve' ? 'approved' : 'rejected'}. ${execution?.message ?? 'No action was executed.'}`,
    ...(execution ? { execution } : {}),
  });
  approvals.set(approvalId, updated);
  persistIfConfigured();
  recordAuditEvent(toAuditApprovalSummary(updated), decision === 'approve' ? 'approved' : 'rejected', execution);

  return {
    approval: toApprovalSummary(updated),
    preview: updated.preview,
    policy: updated.policy,
    ...(execution ? { execution } : {}),
    accepted: true,
    executed: execution?.status === 'ok',
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
  execution?: BrainCoreApprovalExecutionSummary;
}): BrainCoreApprovalRecord {
  const preview = createPreview(input.kind, input.execution?.status === 'ok');
  const policy = createPolicy(input.execution?.status === 'ok');
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
    ...(input.execution ? { execution: input.execution } : {}),
    executed: input.execution?.status === 'ok',
    preview,
    policy,
    source: getApprovalStorePath() ? 'json' : 'memory',
  };
}

function normalizeApprovalForRead(record: BrainCoreApprovalRecord): BrainCoreApprovalRecord {
  const now = Date.now();
  const expired = typeof record.expiresAt === 'string' && Date.parse(record.expiresAt) <= now;
  const executed = record.execution?.status === 'ok';
  return {
    ...record,
    status: expired && record.status === 'pending' ? 'expired' : record.status,
    executed,
    preview: {
      ...record.preview,
      wouldExecute: executed,
      requiresApproval: true,
      writesToMind: false,
      externalSideEffects: false,
      commands: executed ? ['bash tools/scripts/mind-steward-dry-run-report.sh'] : [],
    },
    policy: createPolicy(executed),
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

function createPreview(kind: string, wouldExecute = false): BrainCoreApprovalPreview {
  const executionPlanPreview = kind === 'scheduler-run-mind-steward-dry-run' ? getExecutionPlanPreview(kind) : undefined;
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
    wouldExecute,
    requiresApproval: true,
    writesToMind: false,
    externalSideEffects: false,
    commands: wouldExecute ? ['bash tools/scripts/mind-steward-dry-run-report.sh'] : [],
  };
}

function createPolicy(executionEnabled = false): BrainCoreExecutionGatePolicy {
  return {
    executionEnabled,
    executionGate: executionEnabled ? 'enabled-for-mind-steward-dry-run' : 'disabled-until-explicit-enable',
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
  execution?: BrainCoreApprovalExecutionSummary,
): void {
  const auditEvent: BrainCoreApprovalAuditEvent = {
    id: `audit-${nextAuditNumber++}`,
    approvalId: approval.id,
    event,
    kind: approval.kind,
    createdAt: new Date().toISOString(),
    persisted: false,
    executed: execution?.status === 'ok',
    ...(execution?.status === 'ok' ? { execution } : {}),
    source: 'memory',
  };

  const persisted = appendAuditEvent(auditEvent);
  auditEvents.push({
    ...auditEvent,
    persisted,
    source: persisted ? 'jsonl' : 'memory',
  });

  if (execution?.status === 'ok') {
    const executedEvent: BrainCoreApprovalAuditEvent = {
      ...auditEvent,
      id: `audit-${nextAuditNumber++}`,
      event: 'executed',
      persisted: false,
    };
    const executedPersisted = appendAuditEvent(executedEvent);
    auditEvents.push({
      ...executedEvent,
      persisted: executedPersisted,
      source: executedPersisted ? 'jsonl' : 'memory',
    });
  }
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
    fs.appendFileSync(auditPath, `${JSON.stringify({ ...event, persisted: true, source: 'jsonl' })}\n`);
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

function executeApprovedActionIfReady(record: BrainCoreApprovalRecord): BrainCoreApprovalExecutionSummary | undefined {
  if (record.kind !== 'scheduler-run-mind-steward-dry-run') {
    return undefined;
  }

  if (!isMindStewardDryRunExecutionFlagEnabled()) {
    return createBlockedExecutionSummary(`${getMindStewardDryRunExecutionFlagName()} is not true.`);
  }

  const store = readApprovalStore();
  if (!store.enabled || store.status !== 'available') {
    return createBlockedExecutionSummary('Durable approval store is not available.');
  }

  if (!getAuditPath()) {
    return createBlockedExecutionSummary('Durable approval audit path is not available.');
  }

  if (record.status !== 'pending' && record.status !== 'approved') {
    return createBlockedExecutionSummary(`Approval status ${record.status} cannot execute.`);
  }

  const runtimeDir = getSafeMindStewardRuntimeDir();
  if (!runtimeDir) {
    return createBlockedExecutionSummary('Safe mind-steward runtime output path is not available.');
  }

  const repoRoot = getBrainRepoRoot();
  const scriptPath = path.join(repoRoot, 'tools/scripts/mind-steward-dry-run-report.sh');
  if (!fs.existsSync(scriptPath)) {
    return createBlockedExecutionSummary('Allowlisted mind-steward dry-run script is missing.');
  }

  const env: Record<string, string | undefined> = { ...process.env };
  delete env.MODEL_ROUTER_MIND_ROOT;
  env.MODEL_ROUTER_REPO_ROOT = repoRoot;
  env.MODEL_ROUTER_DIR = path.join(repoRoot, 'projects/mind-steward');
  env.MODEL_ROUTER_RUNTIME_DIR = runtimeDir;

  const result = spawnSync('bash', ['tools/scripts/mind-steward-dry-run-report.sh'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const outputPath = path.relative(repoRoot, path.join(runtimeDir, 'latest.json'));

  if (exitCode !== 0) {
    return {
      status: 'error',
      command: 'bash tools/scripts/mind-steward-dry-run-report.sh',
      outputPath,
      exitCode,
      message: result.stderr || result.error?.message || 'mind-steward dry-run report failed',
      writesToMind: false,
      externalSideEffects: false,
    };
  }

  return {
    status: 'ok',
    command: 'bash tools/scripts/mind-steward-dry-run-report.sh',
    outputPath,
    exitCode,
    message: 'mind-steward dry-run report completed under Brain runtime/local/ without Mind writes',
    writesToMind: false,
    externalSideEffects: false,
  };
}

function createBlockedExecutionSummary(message: string): BrainCoreApprovalExecutionSummary {
  return {
    status: 'blocked',
    command: 'bash tools/scripts/mind-steward-dry-run-report.sh',
    message,
    writesToMind: false,
    externalSideEffects: false,
  };
}

function getSafeMindStewardRuntimeDir(): string | undefined {
  const repoRoot = getBrainRepoRoot();
  const runtimeDir = path.resolve(repoRoot, 'runtime/local/mind-steward');
  const relative = path.relative(repoRoot, runtimeDir).replace(/\\/g, '/');
  if (!relative.startsWith('runtime/local/mind-steward')) {
    return undefined;
  }
  return runtimeDir;
}

function getBrainRepoRoot(): string {
  return path.resolve(PACKAGE_ROOT, '..', '..');
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
      executed: value.executed === true,
      ...(value.execution && typeof value.execution === 'object' ? { execution: value.execution as BrainCoreApprovalExecutionSummary } : {}),
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
