/**
 * Infinite Brain Writer Audit Log
 * Persists one immutable JSON audit record per guarded Mind write attempt.
 */

import fs, { renameSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_AUDIT_DIR = 'runtime/local/infinite-brain/writer-audit-log';

export interface InfiniteBrainWriterAuditRecord {
  auditId: string;
  generatedAt: string;
  operationType: 'wiki-update' | 'live-status-update' | 'supersede-archive' | 'source-routing';
  operationId: string;
  changedPaths: string[];
  beforeState: Record<string, string | null>;
  afterState: Record<string, string | null>;
  approval: {
    approvalId: string;
    proposalId: string;
    sourceReportId: string | null;
    sourceCommit: string;
    approvedBy: string;
    approvedAt: string;
    expiresAt: string;
  };
  result: {
    status: 'blocked' | 'applied' | 'failed';
    applied: boolean;
    wroteToMind: boolean;
    blockers: string[];
  };
}

function getAuditDir(): string {
  const configured = process.env.IBR_WRITER_AUDIT_LOG_DIR;
  if (!configured) return path.resolve(BRAIN_ROOT, DEFAULT_AUDIT_DIR);
  return path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured);
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96) || 'operation';
}

export function createWriterAuditRecord(
  input: Omit<InfiniteBrainWriterAuditRecord, 'auditId' | 'generatedAt'>,
): InfiniteBrainWriterAuditRecord {
  const generatedAt = new Date().toISOString();
  const digest = crypto.createHash('sha256').update(JSON.stringify({ input, generatedAt })).digest('hex').slice(0, 16);
  return {
    auditId: `writer-audit-${digest}`,
    generatedAt,
    ...input,
  };
}

export function persistWriterAuditRecord(record: InfiniteBrainWriterAuditRecord): string | null {
  const auditDir = getAuditDir();
  const fileName = `${safeSegment(record.generatedAt)}-${safeSegment(record.operationType)}-${safeSegment(record.operationId)}-${record.auditId}.json`;
  const targetPath = path.join(auditDir, fileName);
  const temporaryPath = path.join(auditDir, `.${fileName}.${process.pid}.tmp`);

  try {
    fs.mkdirSync(auditDir, { recursive: true });
    fs.writeFileSync(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporaryPath, targetPath);
    return targetPath;
  } catch {
    try { fs.rmSync(temporaryPath, { force: true }); } catch { /* best effort */ }
    return null;
  }
}
