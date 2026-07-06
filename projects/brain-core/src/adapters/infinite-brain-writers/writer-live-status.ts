/**
 * Infinite Brain Live Status Writer
 * Guarded single-file status updates for existing Markdown pages under live/.
 */

import fs, {
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  renameSync,
} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  MIND_PROJECT_WRITE_PREFIXES,
  normalizeExactMindMarkdownPathForPrefixes,
} from '../../mind-paths.js';
import { createWriterAuditRecord, persistWriterAuditRecord } from './writer-audit-log.js';
import type {
  InfiniteBrainLiveStatusSingleFileWriteInput,
  InfiniteBrainLiveStatusSingleFileWriteReport,
} from './types.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_ROLLBACK_DIR = 'runtime/local/infinite-brain/live-status-writer-rollbacks';
const DEFAULT_REPORT_PATH = 'runtime/local/infinite-brain/live-status-writer-write-latest.json';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getRollbackDir(): string {
  const configured = process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR;
  return configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured))
    : path.resolve(BRAIN_ROOT, DEFAULT_ROLLBACK_DIR);
}

function getReportPath(): string {
  const configured = process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH;
  return configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured))
    : path.resolve(BRAIN_ROOT, DEFAULT_REPORT_PATH);
}

function writeJsonAtomically(filePath: string, value: unknown): boolean {
  const directory = path.dirname(filePath);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporary, filePath);
    return true;
  } catch {
    try { fs.rmSync(temporary, { force: true }); } catch { /* best effort */ }
    return false;
  }
}

function normalizeExactLivePath(targetPath: string): string | null {
  return normalizeExactMindMarkdownPathForPrefixes(targetPath, MIND_PROJECT_WRITE_PREFIXES);
}

function resolveExistingTarget(mindRoot: string, targetPath: string): string | null {
  try {
    const root = realpathSync(mindRoot);
    if (!fs.statSync(root).isDirectory()) return null;
    const candidate = path.resolve(root, ...targetPath.split('/'));
    const candidateStat = lstatSync(candidate);
    if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) return null;
    const target = realpathSync(candidate);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const targetStat = lstatSync(target);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) return null;
    return target;
  } catch {
    return null;
  }
}

function makeId(prefix: string, input: InfiniteBrainLiveStatusSingleFileWriteInput, before: string, after = ''): string {
  const digest = crypto.createHash('sha256').update(JSON.stringify({
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    targetPath: input.targetPath,
    before,
    after,
  })).digest('hex').slice(0, 12);
  return `${prefix}-${digest}`;
}

function persist(report: InfiniteBrainLiveStatusSingleFileWriteReport): InfiniteBrainLiveStatusSingleFileWriteReport {
  const auditLogPath = persistWriterAuditRecord(createWriterAuditRecord({
    operationType: 'live-status-update',
    operationId: report.writeId,
    changedPaths: report.changedPaths,
    beforeState: { [report.targetPath]: report.beforeContentHash },
    afterState: { [report.targetPath]: report.afterContentHash },
    approval: {
      approvalId: report.approvalId,
      proposalId: report.proposalId,
      sourceReportId: report.sourceReportId,
      sourceCommit: report.sourceCommit,
      approvedBy: report.approvedBy,
      approvedAt: report.approvedAt,
      expiresAt: report.expiresAt,
    },
    result: {
      status: report.status,
      applied: report.applied,
      wroteToMind: report.wroteToMind,
      blockers: report.blockers,
    },
  }));
  const reportWithAudit = { ...report, auditLogPath };
  const reportPath = getReportPath();
  const ok = writeJsonAtomically(reportPath, { ...reportWithAudit, writeReportPath: reportPath });
  return { ...reportWithAudit, writeReportPath: ok ? reportPath : null };
}

function report(
  input: InfiniteBrainLiveStatusSingleFileWriteInput,
  status: 'blocked' | 'applied' | 'failed',
  blockers: string[],
  beforeContentHash: string | null,
  afterContentHash: string | null,
  rollbackId: string | null,
  rollbackSnapshotPath: string | null,
  changedPaths: string[],
  atomicWrite: boolean,
): InfiniteBrainLiveStatusSingleFileWriteReport {
  return persist({
    writeId: makeId('live-status-write', input, beforeContentHash ?? status, afterContentHash ?? status),
    generatedAt: new Date().toISOString(),
    status,
    targetPath: input.targetPath,
    changedPaths,
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    sourceReportId: input.sourceReportId,
    sourceCommit: input.sourceCommit,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    expiresAt: input.expiresAt,
    beforeContentHash,
    afterContentHash,
    rollbackId,
    rollbackSnapshotPath,
    writeReportPath: null,
    blockers,
    singleFileOnly: true,
    exactPathOnly: true,
    atomicWrite,
    wroteToMind: status === 'applied',
    applied: status === 'applied',
  });
}

export function runLiveStatusSingleFileWrite(
  input: InfiniteBrainLiveStatusSingleFileWriteInput,
): InfiniteBrainLiveStatusSingleFileWriteReport {
  const blockers: string[] = [];
  const targetPath = normalizeExactLivePath(input.targetPath);

  if (!input.manualSingleWriteConfirm) blockers.push('manualSingleWriteConfirmRequired');
  if (!input.approvalId?.trim()) blockers.push('approvalIdRequired');
  if (!input.proposalId?.trim()) blockers.push('proposalIdRequired');
  if (!/^[a-f0-9]{40}$/i.test(input.sourceCommit)) blockers.push('fullSourceCommitRequired');
  if (!input.approvedBy?.trim()) blockers.push('approvedByRequired');
  if (!input.operator?.trim()) blockers.push('operatorRequired');
  if (!input.reason?.trim()) blockers.push('reasonRequired');
  if (!input.contentIntent?.trim()) blockers.push('contentIntentRequired');
  if (!input.newContent?.trim()) blockers.push('newContentRequired');
  if (!/^[a-f0-9]{64}$/i.test(input.expectedBeforeHash)) blockers.push('fullExpectedBeforeHashRequired');
  if (!input.approvedAt || Number.isNaN(Date.parse(input.approvedAt))) blockers.push('validApprovedAtRequired');
  if (!input.expiresAt || Number.isNaN(Date.parse(input.expiresAt))) blockers.push('validExpiresAtRequired');
  else if (Date.parse(input.expiresAt) <= Date.now()) blockers.push('approvalExpired');
  if (!targetPath) blockers.push('invalidExactLiveTargetPath');

  const target = targetPath ? resolveExistingTarget(input.mindRoot, targetPath) : null;
  if (!target) blockers.push('existingTargetFileRequired');
  if (blockers.length > 0 || !target || !targetPath) {
    return report(input, 'blocked', blockers, null, null, null, null, [], false);
  }

  let beforeContent: string;
  try {
    beforeContent = fs.readFileSync(target, 'utf8');
  } catch {
    return report(input, 'blocked', ['targetReadFailed'], null, null, null, null, [], false);
  }

  const beforeHash = sha256(beforeContent);
  if (beforeHash !== input.expectedBeforeHash.toLowerCase()) {
    return report(input, 'blocked', ['beforeHashMismatch'], beforeHash, null, null, null, [], false);
  }

  const afterHash = sha256(input.newContent);
  const rollbackId = makeId('live-status-rollback', input, beforeHash);
  const rollbackPath = path.join(getRollbackDir(), `${rollbackId}.json`);
  const rollbackSaved = writeJsonAtomically(rollbackPath, {
    rollbackId,
    generatedAt: new Date().toISOString(),
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    targetPath,
    beforeContentHash: beforeHash,
    beforeContent,
  });
  if (!rollbackSaved) {
    return report(input, 'failed', ['rollbackSnapshotPersistFailed'], beforeHash, null, rollbackId, null, [], false);
  }

  const mode = fs.statSync(target).mode;
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  try {
    const descriptor = openSync(temporary, 'wx', mode);
    try {
      fs.writeFileSync(descriptor, input.newContent, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, target);
  } catch {
    try { fs.rmSync(temporary, { force: true }); } catch { /* best effort */ }
    return report(input, 'failed', ['atomicWriteFailed'], beforeHash, null, rollbackId, rollbackPath, [], false);
  }

  const persistedHash = sha256(fs.readFileSync(target, 'utf8'));
  if (persistedHash !== afterHash) {
    return report(input, 'failed', ['postWriteHashMismatch'], beforeHash, persistedHash, rollbackId, rollbackPath, [targetPath], true);
  }

  return report(input, 'applied', [], beforeHash, afterHash, rollbackId, rollbackPath, [targetPath], true);
}
