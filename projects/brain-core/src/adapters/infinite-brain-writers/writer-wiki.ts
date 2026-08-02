/**
 * Infinite Brain Wiki Writer
 * Single-file exact-path wiki update executor.
 *
 * Safety:
 * - one existing Markdown file only;
 * - target must be an exact repository-relative path under canonical knowledge/, faith/, or organizations/;
 * - approved before-state SHA-256 must match immediately before writing;
 * - rollback snapshot is persisted before the Mind file changes;
 * - write uses a temporary sibling file and atomic rename;
 * - broad, multi-file, create, delete, move, and autonomous writes are rejected.
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
  MIND_FAITH_WRITE_PREFIXES,
  MIND_KNOWLEDGE_WRITE_PREFIXES,
  MIND_ORGANIZATION_WRITE_PREFIXES,
  normalizeExactMindMarkdownPathForPrefixes,
} from '../../mind-paths.js';
import { createWriterAuditRecord, persistWriterAuditRecord } from './writer-audit-log.js';
import {
  type InfiniteBrainWikiSingleFileWriteInput,
  type InfiniteBrainWikiSingleFileWriteReport,
  type InfiniteBrainWriterInput,
  type InfiniteBrainWriterPrecondition,
  type InfiniteBrainWriterResult,
  createBlockedWriterResult,
} from './types.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_ROLLBACK_DIR = 'runtime/local/infinite-brain/wiki-writer-rollbacks';
const DEFAULT_WRITE_REPORT_PATH = 'runtime/local/infinite-brain/wiki-writer-write-latest.json';

interface WikiRollbackSnapshot {
  rollbackId: string;
  generatedAt: string;
  approvalId: string;
  proposalId: string;
  targetPath: string;
  beforeContentHash: string;
  beforeContent: string;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getRollbackDir(): string {
  const configured = process.env.IBR_WIKI_WRITER_ROLLBACK_DIR;
  if (!configured) return path.resolve(BRAIN_ROOT, DEFAULT_ROLLBACK_DIR);
  return path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured);
}

function getWriteReportPath(): string {
  const configured = process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH;
  if (!configured) return path.resolve(BRAIN_ROOT, DEFAULT_WRITE_REPORT_PATH);
  return path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured);
}

function writeJsonAtomically(filePath: string, value: unknown): boolean {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    renameSync(tempPath, filePath);
    return true;
  } catch {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Best-effort cleanup only.
    }
    return false;
  }
}

function createWriteId(input: InfiniteBrainWikiSingleFileWriteInput, beforeHash: string, afterHash: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      approvalId: input.approvalId,
      proposalId: input.proposalId,
      targetPath: input.targetPath,
      beforeHash,
      afterHash,
    }))
    .digest('hex')
    .slice(0, 12);
  return `wiki-write-${digest}`;
}

function createRollbackId(input: InfiniteBrainWikiSingleFileWriteInput, beforeHash: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      approvalId: input.approvalId,
      proposalId: input.proposalId,
      targetPath: input.targetPath,
      beforeHash,
    }))
    .digest('hex')
    .slice(0, 12);
  return `wiki-rollback-${digest}`;
}

function validateExactWikiPath(targetPath: string): string | null {
  return normalizeExactMindMarkdownPathForPrefixes(targetPath, [
    ...MIND_KNOWLEDGE_WRITE_PREFIXES,
    ...MIND_ORGANIZATION_WRITE_PREFIXES,
    ...MIND_FAITH_WRITE_PREFIXES,
  ]);
}

function resolveExistingTarget(mindRoot: string, targetPath: string): { root: string; target: string } | null {
  try {
    const root = realpathSync(mindRoot);
    if (!fs.statSync(root).isDirectory()) return null;

    const candidate = path.resolve(root, ...targetPath.split('/'));
    const candidateStat = lstatSync(candidate);
    if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) return null;

    const target = realpathSync(candidate);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;

    const stat = lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;

    return { root, target };
  } catch {
    return null;
  }
}

function persistReport(report: InfiniteBrainWikiSingleFileWriteReport): InfiniteBrainWikiSingleFileWriteReport {
  const auditLogPath = persistWriterAuditRecord(createWriterAuditRecord({
    operationType: 'wiki-update',
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
  const reportPath = getWriteReportPath();
  const persisted = writeJsonAtomically(reportPath, { ...reportWithAudit, writeReportPath: reportPath });
  return { ...reportWithAudit, writeReportPath: persisted ? reportPath : null };
}

function blockedReport(
  input: InfiniteBrainWikiSingleFileWriteInput,
  blockers: string[],
  beforeContentHash: string | null = null,
  rollbackId: string | null = null,
  rollbackSnapshotPath: string | null = null,
): InfiniteBrainWikiSingleFileWriteReport {
  return persistReport({
    writeId: createWriteId(input, beforeContentHash ?? 'blocked', 'blocked'),
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    targetPath: input.targetPath,
    changedPaths: [],
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    sourceReportId: input.sourceReportId,
    sourceCommit: input.sourceCommit,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    expiresAt: input.expiresAt,
    beforeContentHash,
    afterContentHash: null,
    rollbackId,
    rollbackSnapshotPath,
    writeReportPath: null,
    blockers,
    singleFileOnly: true,
    exactPathOnly: true,
    atomicWrite: false,
    wroteToMind: false,
    applied: false,
  });
}

export function evaluateWikiWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'exactPathPolicyImplemented',
      status: 'pass',
      reason: 'Exact repository-relative wiki path validation is implemented.',
      requiredForWrite: true,
    },
    {
      name: 'beforeHashValidationImplemented',
      status: 'pass',
      reason: 'Full SHA-256 before-state validation is implemented.',
      requiredForWrite: true,
    },
    {
      name: 'rollbackSnapshotImplemented',
      status: 'pass',
      reason: 'Rollback snapshots are persisted before writes.',
      requiredForWrite: true,
    },
    {
      name: 'atomicSingleFileWriterImplemented',
      status: 'pass',
      reason: 'Single-file sibling-temp atomic rename is implemented.',
      requiredForWrite: true,
    },
    {
      name: 'explicitApprovedPayloadRequired',
      status: 'blocked',
      reason: 'A complete human-approved wikiWrite payload is required for execution.',
      requiredForWrite: true,
    },
  ];
}

export function runWikiWriterSingleFileWrite(
  input: InfiniteBrainWikiSingleFileWriteInput,
): InfiniteBrainWikiSingleFileWriteReport {
  const blockers: string[] = [];
  const normalizedTargetPath = validateExactWikiPath(input.targetPath);

  if (!input.manualSingleWriteConfirm) blockers.push('manualSingleWriteConfirmNotProvided');
  if (!input.approvalId?.trim()) blockers.push('approvalIdRequired');
  if (!input.proposalId?.trim()) blockers.push('proposalIdRequired');
  if (!/^[a-f0-9]{40}$/i.test(input.sourceCommit)) blockers.push('fullSourceCommitRequired');
  if (!input.approvedBy?.trim()) blockers.push('approvedByRequired');
  if (!input.operator?.trim()) blockers.push('operatorRequired');
  if (!input.reason?.trim()) blockers.push('reasonRequired');
  if (!input.contentIntent?.trim()) blockers.push('contentIntentRequired');
  if (!input.newContent || input.newContent.trim().length === 0) blockers.push('newContentRequired');
  if (!/^[a-f0-9]{64}$/i.test(input.expectedBeforeHash)) blockers.push('fullExpectedBeforeHashRequired');
  if (!input.approvedAt || Number.isNaN(Date.parse(input.approvedAt))) blockers.push('validApprovedAtRequired');
  if (!input.expiresAt || Number.isNaN(Date.parse(input.expiresAt))) blockers.push('validExpiresAtRequired');
  else if (Date.parse(input.expiresAt) <= Date.now()) blockers.push('approvalExpired');
  if (!normalizedTargetPath) blockers.push('invalidExactWikiTargetPath');

  const resolved = normalizedTargetPath ? resolveExistingTarget(input.mindRoot, normalizedTargetPath) : null;
  if (!resolved) blockers.push('existingTargetFileRequired');

  if (blockers.length > 0 || !resolved || !normalizedTargetPath) {
    return blockedReport(input, blockers);
  }

  let beforeContent: string;
  let beforeContentHash: string;
  try {
    beforeContent = fs.readFileSync(resolved.target, 'utf8');
    beforeContentHash = sha256(beforeContent);
  } catch {
    return blockedReport(input, ['targetReadFailed']);
  }

  if (beforeContentHash !== input.expectedBeforeHash.toLowerCase()) {
    return blockedReport(input, ['beforeHashMismatch'], beforeContentHash);
  }

  const rollbackId = createRollbackId(input, beforeContentHash);
  const rollbackSnapshotPath = path.join(getRollbackDir(), `${rollbackId}.json`);
  const rollbackSnapshot: WikiRollbackSnapshot = {
    rollbackId,
    generatedAt: new Date().toISOString(),
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    targetPath: normalizedTargetPath,
    beforeContentHash,
    beforeContent,
  };

  if (!writeJsonAtomically(rollbackSnapshotPath, rollbackSnapshot)) {
    return blockedReport(input, ['rollbackSnapshotWriteFailed'], beforeContentHash);
  }

  const afterContentHash = sha256(input.newContent);
  const writeId = createWriteId(input, beforeContentHash, afterContentHash);
  const tempPath = path.join(path.dirname(resolved.target), `.${path.basename(resolved.target)}.${writeId}.tmp`);
  let atomicWrite = false;

  try {
    const mode = fs.statSync(resolved.target).mode;
    const descriptor = openSync(tempPath, 'wx', mode);
    try {
      fs.writeFileSync(descriptor, input.newContent, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(tempPath, resolved.target);
    atomicWrite = true;
  } catch {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Best-effort cleanup only.
    }

    return persistReport({
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'failed',
      targetPath: normalizedTargetPath,
      changedPaths: [],
      approvalId: input.approvalId,
      proposalId: input.proposalId,
      sourceReportId: input.sourceReportId,
      sourceCommit: input.sourceCommit,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt,
      expiresAt: input.expiresAt,
      beforeContentHash,
      afterContentHash: null,
      rollbackId,
      rollbackSnapshotPath,
      writeReportPath: null,
      blockers: ['atomicWriteFailed'],
      singleFileOnly: true,
      exactPathOnly: true,
      atomicWrite: false,
      wroteToMind: false,
      applied: false,
    });
  }

  let verifiedAfterHash: string;
  try {
    verifiedAfterHash = sha256(fs.readFileSync(resolved.target, 'utf8'));
  } catch {
    verifiedAfterHash = '';
  }

  const verified = verifiedAfterHash === afterContentHash;
  return persistReport({
    writeId,
    generatedAt: new Date().toISOString(),
    status: verified ? 'applied' : 'failed',
    targetPath: normalizedTargetPath,
    changedPaths: verified ? [normalizedTargetPath] : [],
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    sourceReportId: input.sourceReportId,
    sourceCommit: input.sourceCommit,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    expiresAt: input.expiresAt,
    beforeContentHash,
    afterContentHash: verifiedAfterHash || null,
    rollbackId,
    rollbackSnapshotPath,
    writeReportPath: null,
    blockers: verified ? [] : ['postWriteHashMismatch'],
    singleFileOnly: true,
    exactPathOnly: true,
    atomicWrite,
    wroteToMind: atomicWrite,
    applied: verified,
  });
}

export async function runWikiWriter(
  input: InfiniteBrainWriterInput,
): Promise<InfiniteBrainWikiSingleFileWriteReport | InfiniteBrainWriterResult> {
  if (input.category !== 'wiki-writing' || !input.wikiWrite) {
    const result = createBlockedWriterResult('wiki-writing', [
      'A single explicit wikiWrite payload is required.',
    ]);
    result.preconditions = evaluateWikiWriterPreconditions();
    return result;
  }

  return runWikiWriterSingleFileWrite(input.wikiWrite);
}

/**
 * Backward-compatible disabled entry point used by the global executor while
 * repository-wide execution remains blocked.
 */
export async function runWikiWriterDisabled(
  _input: InfiniteBrainWriterInput,
): Promise<InfiniteBrainWriterResult> {
  const result = createBlockedWriterResult('wiki-writing', [
    'Global proposal execution remains disabled; use the explicit single-file wiki writer entry point.',
  ]);
  result.preconditions = evaluateWikiWriterPreconditions();
  return result;
}
