import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrainCoreApprovalRecord, BrainCoreApprovalStoreSummary } from '../types/api.js';

const DEFAULT_RELATIVE_PATH = 'runtime/local/brain-core/approvals.json';
const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'mind'];
const MIND_STEWARD_INBOX_DRY_RUN_KIND = 'scheduler-run-mind-steward-inbox-dry-run';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');

export function getDefaultApprovalStorePath(): string {
  return path.resolve(PACKAGE_ROOT, DEFAULT_RELATIVE_PATH);
}

export function getApprovalStorePath(): string | undefined {
  const configuredPath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  return configuredPath ? resolveSafeStorePath(configuredPath) : undefined;
}

export function readApprovalStore(): BrainCoreApprovalStoreSummary & { records: BrainCoreApprovalRecord[] } {
  const configuredPath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  if (!configuredPath) {
    return {
      enabled: false,
      status: 'memory',
      path: DEFAULT_RELATIVE_PATH,
      recordCount: 0,
      writesToMind: false,
      executableActions: false,
      records: [],
    };
  }

  const resolvedPath = resolveSafeStorePath(configuredPath);
  if (!resolvedPath) {
    return {
      enabled: false,
      status: 'unsafe',
      path: DEFAULT_RELATIVE_PATH,
      recordCount: 0,
      writesToMind: false,
      executableActions: false,
      records: [],
    };
  }

  if (!fs.existsSync(resolvedPath)) {
    return {
      enabled: true,
      status: 'memory',
      path: relativeStorePath(resolvedPath),
      recordCount: 0,
      writesToMind: false,
      executableActions: false,
      records: [],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as Partial<{ records: BrainCoreApprovalRecord[] }>;
    const records = Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord) : [];
    return {
      enabled: true,
      status: 'available',
      path: relativeStorePath(resolvedPath),
      recordCount: records.length,
      writesToMind: false,
      executableActions: false,
      records,
    };
  } catch {
    return {
      enabled: true,
      status: 'invalid',
      path: relativeStorePath(resolvedPath),
      recordCount: 0,
      writesToMind: false,
      executableActions: false,
      records: [],
    };
  }
}

export function persistApprovalStore(records: BrainCoreApprovalRecord[]): boolean {
  const resolvedPath = getApprovalStorePath();
  if (!resolvedPath) {
    return false;
  }

  try {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, `${JSON.stringify({ records: records.map(normalizeRecord) }, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

function normalizeRecord(record: BrainCoreApprovalRecord): BrainCoreApprovalRecord {
  const executed = record.execution?.status === 'ok';
  const executionGate =
    executed && record.kind === MIND_STEWARD_INBOX_DRY_RUN_KIND
      ? 'enabled-for-mind-steward-inbox-dry-run'
      : executed
        ? 'enabled-for-mind-steward-dry-run'
        : 'disabled-until-explicit-enable';

  return {
    ...record,
    status: normalizeStatus(record.status),
    source: record.source === 'json' ? 'json' : 'memory',
    executed,
    ...(executed ? { execution: record.execution } : {}),
    preview: {
      ...record.preview,
      wouldExecute: executed,
      requiresApproval: true,
      writesToMind: false,
      externalSideEffects: false,
      commands: executed && record.execution?.command ? [record.execution.command] : [],
    },
    policy: {
      executionEnabled: executed,
      executionGate,
      requiresDurableAudit: true,
      requiresRollbackPlan: true,
    },
  };
}

function normalizeStatus(status: BrainCoreApprovalRecord['status']): BrainCoreApprovalRecord['status'] {
  return status === 'pending' || status === 'approved' || status === 'rejected' || status === 'expired'
    ? status
    : 'pending';
}

function resolveSafeStorePath(rawPath: string): string | undefined {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (segments.some((segment) => DISALLOWED_SEGMENTS.includes(segment))) {
    return undefined;
  }
  return path.resolve(rawPath);
}

function relativeStorePath(resolvedPath: string): string {
  const root = path.resolve(PACKAGE_ROOT);
  const relative = path.relative(root, resolvedPath);
  return relative || path.basename(resolvedPath);
}
