/**
 * Infinite Brain Source Routing Writer
 * Moves one explicitly approved existing Markdown file to one exact path under sources/.
 * No overwrite, folder move, glob, symlink, or autonomous destination selection.
 */

import fs, { lstatSync, realpathSync, renameSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  MIND_RESOURCE_WRITE_PREFIXES,
  normalizeExactMindMarkdownPathForPrefixes,
} from '../../mind-paths.js';
import { createWriterAuditRecord, persistWriterAuditRecord } from './writer-audit-log.js';
import type {
  InfiniteBrainSourceRoutingMoveInput,
  InfiniteBrainSourceRoutingMoveReport,
} from './types.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_ROLLBACK_DIR = 'runtime/local/infinite-brain/source-routing-rollbacks';
const DEFAULT_REPORT_PATH = 'runtime/local/infinite-brain/source-routing-latest.json';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function configuredPath(envName: string, fallback: string): string {
  const configured = process.env[envName];
  return configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured))
    : path.resolve(BRAIN_ROOT, fallback);
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

function normalizeExactMarkdownPath(value: string, prefixes?: readonly string[]): string | null {
  return normalizeExactMindMarkdownPathForPrefixes(value, prefixes ?? ['']);
}

function resolveRoot(mindRoot: string): string | null {
  try {
    const root = realpathSync(mindRoot);
    return fs.statSync(root).isDirectory() ? root : null;
  } catch {
    return null;
  }
}

function resolveExistingSource(root: string, sourcePath: string): string | null {
  try {
    const candidate = path.resolve(root, ...sourcePath.split('/'));
    const candidateStat = lstatSync(candidate);
    if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) return null;
    const resolved = realpathSync(candidate);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return resolved;
  } catch {
    return null;
  }
}

function resolveDestination(root: string, destinationPath: string): string | null {
  try {
    const destination = path.resolve(root, ...destinationPath.split('/'));
    const relative = path.relative(root, destination);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    if (fs.existsSync(destination)) return null;
    const parent = path.dirname(destination);
    const parentStat = lstatSync(parent);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) return null;
    const resolvedParent = realpathSync(parent);
    const parentRelative = path.relative(root, resolvedParent);
    if (!parentRelative || parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) return null;
    return destination;
  } catch {
    return null;
  }
}

function makeId(prefix: string, input: InfiniteBrainSourceRoutingMoveInput, hash: string): string {
  const digest = crypto.createHash('sha256').update(JSON.stringify({
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
    hash,
  })).digest('hex').slice(0, 12);
  return `${prefix}-${digest}`;
}

function persist(report: InfiniteBrainSourceRoutingMoveReport): InfiniteBrainSourceRoutingMoveReport {
  const auditLogPath = persistWriterAuditRecord(createWriterAuditRecord({
    operationType: 'source-routing',
    operationId: report.moveId,
    changedPaths: report.changedPaths,
    beforeState: {
      [report.sourcePath]: report.sourceContentHash,
      [report.destinationPath]: null,
    },
    afterState: {
      [report.sourcePath]: report.applied ? null : report.sourceContentHash,
      [report.destinationPath]: report.destinationContentHash,
    },
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
  const reportPath = configuredPath('IBR_SOURCE_ROUTING_REPORT_PATH', DEFAULT_REPORT_PATH);
  const ok = writeJsonAtomically(reportPath, { ...reportWithAudit, moveReportPath: reportPath });
  return { ...reportWithAudit, moveReportPath: ok ? reportPath : null };
}

function createReport(
  input: InfiniteBrainSourceRoutingMoveInput,
  status: 'blocked' | 'applied' | 'failed',
  blockers: string[],
  sourceHash: string | null,
  destinationHash: string | null,
  rollbackId: string | null,
  rollbackMetadataPath: string | null,
  changedPaths: string[],
): InfiniteBrainSourceRoutingMoveReport {
  return persist({
    moveId: makeId('source-routing-move', input, sourceHash ?? status),
    generatedAt: new Date().toISOString(),
    status,
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
    changedPaths,
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    sourceReportId: input.sourceReportId,
    sourceCommit: input.sourceCommit,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    expiresAt: input.expiresAt,
    sourceContentHash: sourceHash,
    destinationContentHash: destinationHash,
    rollbackId,
    rollbackMetadataPath,
    moveReportPath: null,
    blockers,
    exactPathsOnly: true,
    singleFileOnly: true,
    sourcesDestinationOnly: true,
    wroteToMind: status === 'applied',
    applied: status === 'applied',
  });
}

export function runSourceRoutingMove(
  input: InfiniteBrainSourceRoutingMoveInput,
): InfiniteBrainSourceRoutingMoveReport {
  const blockers: string[] = [];
  const sourcePath = normalizeExactMarkdownPath(input.sourcePath);
  const destinationPath = normalizeExactMarkdownPath(input.destinationPath, MIND_RESOURCE_WRITE_PREFIXES);

  if (!input.manualSingleMoveConfirm) blockers.push('manualSingleMoveConfirmRequired');
  if (!input.approvalId?.trim()) blockers.push('approvalIdRequired');
  if (!input.proposalId?.trim()) blockers.push('proposalIdRequired');
  if (!/^[a-f0-9]{40}$/i.test(input.sourceCommit)) blockers.push('fullSourceCommitRequired');
  if (!input.approvedBy?.trim()) blockers.push('approvedByRequired');
  if (!input.operator?.trim()) blockers.push('operatorRequired');
  if (!input.routingReason?.trim()) blockers.push('routingReasonRequired');
  if (!input.sourceSummary?.trim()) blockers.push('sourceSummaryRequired');
  if (!/^[a-f0-9]{64}$/i.test(input.expectedSourceHash)) blockers.push('fullExpectedSourceHashRequired');
  if (!input.approvedAt || Number.isNaN(Date.parse(input.approvedAt))) blockers.push('validApprovedAtRequired');
  if (!input.expiresAt || Number.isNaN(Date.parse(input.expiresAt))) blockers.push('validExpiresAtRequired');
  else if (Date.parse(input.expiresAt) <= Date.now()) blockers.push('approvalExpired');
  if (!sourcePath || MIND_RESOURCE_WRITE_PREFIXES.some(prefix => sourcePath.startsWith(prefix))) blockers.push('invalidExactSourcePath');
  if (!destinationPath) blockers.push('invalidExactSourcesDestinationPath');
  if (sourcePath && destinationPath && sourcePath === destinationPath) blockers.push('sourceDestinationMustDiffer');

  const root = resolveRoot(input.mindRoot);
  if (!root) blockers.push('mindRootUnavailable');
  const source = root && sourcePath ? resolveExistingSource(root, sourcePath) : null;
  if (!source) blockers.push('existingSourceFileRequired');
  const destination = root && destinationPath ? resolveDestination(root, destinationPath) : null;
  if (!destination) blockers.push('availableSourcesDestinationRequired');
  if (blockers.length > 0 || !source || !destination || !sourcePath || !destinationPath) {
    return createReport(input, 'blocked', blockers, null, null, null, null, []);
  }

  let sourceContent: string;
  try {
    sourceContent = fs.readFileSync(source, 'utf8');
  } catch {
    return createReport(input, 'blocked', ['sourceReadFailed'], null, null, null, null, []);
  }

  const sourceHash = sha256(sourceContent);
  if (sourceHash !== input.expectedSourceHash.toLowerCase()) {
    return createReport(input, 'blocked', ['sourceHashMismatch'], sourceHash, null, null, null, []);
  }

  const rollbackId = makeId('source-routing-rollback', input, sourceHash);
  const rollbackPath = path.join(
    configuredPath('IBR_SOURCE_ROUTING_ROLLBACK_DIR', DEFAULT_ROLLBACK_DIR),
    `${rollbackId}.json`,
  );
  const rollbackSaved = writeJsonAtomically(rollbackPath, {
    rollbackId,
    generatedAt: new Date().toISOString(),
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    sourcePath,
    destinationPath,
    sourceContentHash: sourceHash,
    rollbackAction: { moveFrom: destinationPath, moveTo: sourcePath },
    routingReason: input.routingReason,
    sourceSummary: input.sourceSummary,
  });
  if (!rollbackSaved) {
    return createReport(input, 'failed', ['rollbackMetadataPersistFailed'], sourceHash, null, rollbackId, null, []);
  }

  try {
    renameSync(source, destination);
  } catch {
    return createReport(input, 'failed', ['sourceRoutingMoveFailed'], sourceHash, null, rollbackId, rollbackPath, []);
  }

  let destinationHash: string;
  try {
    destinationHash = sha256(fs.readFileSync(destination, 'utf8'));
  } catch {
    return createReport(input, 'failed', ['sourceRoutingVerificationReadFailed'], sourceHash, null, rollbackId, rollbackPath, [sourcePath, destinationPath]);
  }
  if (destinationHash !== sourceHash || fs.existsSync(source)) {
    return createReport(input, 'failed', ['sourceRoutingVerificationFailed'], sourceHash, destinationHash, rollbackId, rollbackPath, [sourcePath, destinationPath]);
  }

  return createReport(input, 'applied', [], sourceHash, destinationHash, rollbackId, rollbackPath, [sourcePath, destinationPath]);
}
