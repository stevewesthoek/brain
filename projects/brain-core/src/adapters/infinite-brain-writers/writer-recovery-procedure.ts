/**
 * Infinite Brain Writer Recovery Procedure
 * Builds read-only, exact-path recovery instructions from writer reports and
 * rollback snapshots. This does not mutate Mind.
 */

import fs, { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  InfiniteBrainLiveStatusSingleFileWriteReport,
  InfiniteBrainSourceRoutingMoveReport,
  InfiniteBrainSupersedeArchiveMoveReport,
  InfiniteBrainWikiSingleFileWriteReport,
} from './types.js';

export type InfiniteBrainRecoveryOperationType =
  | 'wiki-update'
  | 'live-status-update'
  | 'supersede-archive'
  | 'source-routing';

export interface InfiniteBrainWriterRecoveryProcedureInput {
  operationType: InfiniteBrainRecoveryOperationType;
  mindRoot: string;
  report:
    | InfiniteBrainWikiSingleFileWriteReport
    | InfiniteBrainLiveStatusSingleFileWriteReport
    | InfiniteBrainSupersedeArchiveMoveReport
    | InfiniteBrainSourceRoutingMoveReport;
}

export interface InfiniteBrainWriterRecoveryProcedure {
  status: 'ready' | 'blocked';
  canRecover: boolean;
  operationType: InfiniteBrainRecoveryOperationType;
  rollbackId: string | null;
  rollbackArtifactPath: string | null;
  approvalId: string;
  proposalId: string;
  changedPaths: string[];
  recoveryPaths: string[];
  expectedCurrentState: Record<string, string | null>;
  restoreState: Record<string, string | null>;
  procedure: string[];
  blockers: string[];
  safety: {
    writesToMind: false;
    modifiesMind: false;
    deletesFiles: false;
    movesFiles: false;
    appliesRecovery: false;
    exactPathsOnly: true;
    humanApprovalRequired: true;
  };
}

interface FileRollbackSnapshot {
  rollbackId: string;
  approvalId: string;
  proposalId: string;
  targetPath: string;
  beforeContentHash: string;
  beforeContent: string;
}

interface MoveRollbackMetadata {
  rollbackId: string;
  approvalId: string;
  proposalId: string;
  sourcePath: string;
  destinationPath: string;
  sourceContentHash: string;
  rollbackAction: {
    moveFrom: string;
    moveTo: string;
  };
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function normalizeExactMarkdownPath(value: string): string | null {
  if (!value || value.includes('\\') || value.includes('\0')) return null;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return null;
  if (value.endsWith('/') || !value.endsWith('.md')) return null;
  if (value.includes('*') || value.includes('?') || value.includes('[') || value.includes(']')) return null;
  const segments = value.split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

function resolveRoot(mindRoot: string): string | null {
  try {
    const root = realpathSync(mindRoot);
    return fs.statSync(root).isDirectory() ? root : null;
  } catch {
    return null;
  }
}

function resolveExactExistingFile(root: string, relativePath: string): string | null {
  try {
    const candidate = path.resolve(root, ...relativePath.split('/'));
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

function resolveExactParentForRestore(root: string, relativePath: string): string | null {
  try {
    const candidate = path.resolve(root, ...relativePath.split('/'));
    const relative = path.relative(root, candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const parent = path.dirname(candidate);
    const parentStat = lstatSync(parent);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) return null;
    const resolvedParent = realpathSync(parent);
    const parentRelative = path.relative(root, resolvedParent);
    if (!parentRelative || parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) return null;
    return candidate;
  } catch {
    return null;
  }
}

function baseProcedure(
  input: InfiniteBrainWriterRecoveryProcedureInput,
  rollbackId: string | null,
  rollbackArtifactPath: string | null,
  changedPaths: string[],
  recoveryPaths: string[],
  expectedCurrentState: Record<string, string | null>,
  restoreState: Record<string, string | null>,
  procedure: string[],
  blockers: string[],
): InfiniteBrainWriterRecoveryProcedure {
  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    canRecover: blockers.length === 0,
    operationType: input.operationType,
    rollbackId,
    rollbackArtifactPath,
    approvalId: input.report.approvalId,
    proposalId: input.report.proposalId,
    changedPaths,
    recoveryPaths,
    expectedCurrentState,
    restoreState,
    procedure,
    blockers,
    safety: {
      writesToMind: false,
      modifiesMind: false,
      deletesFiles: false,
      movesFiles: false,
      appliesRecovery: false,
      exactPathsOnly: true,
      humanApprovalRequired: true,
    },
  };
}

function isFileReport(
  report: InfiniteBrainWriterRecoveryProcedureInput['report'],
): report is InfiniteBrainWikiSingleFileWriteReport | InfiniteBrainLiveStatusSingleFileWriteReport {
  return 'targetPath' in report;
}

function isMoveReport(
  report: InfiniteBrainWriterRecoveryProcedureInput['report'],
): report is InfiniteBrainSupersedeArchiveMoveReport | InfiniteBrainSourceRoutingMoveReport {
  return 'sourcePath' in report && 'destinationPath' in report;
}

function buildFileRecoveryProcedure(
  input: InfiniteBrainWriterRecoveryProcedureInput,
  root: string,
): InfiniteBrainWriterRecoveryProcedure {
  const report = input.report;
  if (!isFileReport(report)) {
    return baseProcedure(input, null, null, [], [], {}, {}, [], ['fileWriteReportRequired']);
  }

  const blockers: string[] = [];
  const targetPath = normalizeExactMarkdownPath(report.targetPath);
  if (!targetPath) blockers.push('invalidExactRecoveryTargetPath');
  if (!report.rollbackSnapshotPath) blockers.push('rollbackSnapshotPathRequired');

  const snapshot = report.rollbackSnapshotPath
    ? readJson<FileRollbackSnapshot>(report.rollbackSnapshotPath)
    : null;
  if (!snapshot) blockers.push('rollbackSnapshotReadableRequired');
  if (snapshot && snapshot.rollbackId !== report.rollbackId) blockers.push('rollbackIdMismatch');
  if (snapshot && snapshot.approvalId !== report.approvalId) blockers.push('approvalIdMismatch');
  if (snapshot && snapshot.proposalId !== report.proposalId) blockers.push('proposalIdMismatch');
  if (snapshot && targetPath && snapshot.targetPath !== targetPath) blockers.push('rollbackTargetPathMismatch');
  if (snapshot && sha256(snapshot.beforeContent) !== snapshot.beforeContentHash) {
    blockers.push('rollbackBeforeContentHashMismatch');
  }
  if (snapshot && report.beforeContentHash !== snapshot.beforeContentHash) {
    blockers.push('reportBeforeHashMismatch');
  }

  const target = targetPath ? resolveExactExistingFile(root, targetPath) : null;
  if (!target) blockers.push('currentTargetFileRequired');
  if (target && report.afterContentHash) {
    const currentHash = sha256(fs.readFileSync(target, 'utf8'));
    if (currentHash !== report.afterContentHash) blockers.push('currentStateHashMismatch');
  }

  return baseProcedure(
    input,
    report.rollbackId,
    report.rollbackSnapshotPath,
    targetPath ? [targetPath] : [],
    targetPath ? [targetPath] : [],
    targetPath ? { [targetPath]: report.afterContentHash } : {},
    targetPath && snapshot ? { [targetPath]: snapshot.beforeContentHash } : {},
    targetPath && snapshot ? [
      `Confirm human approval to recover proposal ${report.proposalId} from rollback ${snapshot.rollbackId}.`,
      `Verify ${targetPath} currently matches ${report.afterContentHash}.`,
      `Restore exactly ${targetPath} to rollback beforeContentHash ${snapshot.beforeContentHash}.`,
      `Verify ${targetPath} now hashes to ${snapshot.beforeContentHash}.`,
      'Append the recovery result to the writer audit trail before considering the incident closed.',
    ] : [],
    blockers,
  );
}

function buildMoveRecoveryProcedure(
  input: InfiniteBrainWriterRecoveryProcedureInput,
  root: string,
): InfiniteBrainWriterRecoveryProcedure {
  const report = input.report;
  if (!isMoveReport(report)) {
    return baseProcedure(input, null, null, [], [], {}, {}, [], ['moveReportRequired']);
  }

  const blockers: string[] = [];
  const sourcePath = normalizeExactMarkdownPath(report.sourcePath);
  const destinationPath = normalizeExactMarkdownPath(report.destinationPath);
  if (!sourcePath) blockers.push('invalidExactRecoverySourcePath');
  if (!destinationPath) blockers.push('invalidExactRecoveryDestinationPath');
  if (!report.rollbackMetadataPath) blockers.push('rollbackMetadataPathRequired');

  const metadata = report.rollbackMetadataPath
    ? readJson<MoveRollbackMetadata>(report.rollbackMetadataPath)
    : null;
  if (!metadata) blockers.push('rollbackMetadataReadableRequired');
  if (metadata && metadata.rollbackId !== report.rollbackId) blockers.push('rollbackIdMismatch');
  if (metadata && metadata.approvalId !== report.approvalId) blockers.push('approvalIdMismatch');
  if (metadata && metadata.proposalId !== report.proposalId) blockers.push('proposalIdMismatch');
  if (metadata && sourcePath && metadata.sourcePath !== sourcePath) blockers.push('rollbackSourcePathMismatch');
  if (metadata && destinationPath && metadata.destinationPath !== destinationPath) blockers.push('rollbackDestinationPathMismatch');
  if (metadata && destinationPath && metadata.rollbackAction.moveFrom !== destinationPath) blockers.push('rollbackMoveFromMismatch');
  if (metadata && sourcePath && metadata.rollbackAction.moveTo !== sourcePath) blockers.push('rollbackMoveToMismatch');
  if (metadata && metadata.sourceContentHash !== report.sourceContentHash) blockers.push('rollbackSourceHashMismatch');

  const destination = destinationPath ? resolveExactExistingFile(root, destinationPath) : null;
  if (!destination) blockers.push('currentDestinationFileRequired');
  if (destination && report.destinationContentHash) {
    const currentDestinationHash = sha256(fs.readFileSync(destination, 'utf8'));
    if (currentDestinationHash !== report.destinationContentHash) blockers.push('currentDestinationHashMismatch');
  }

  const sourceRestoreTarget = sourcePath ? resolveExactParentForRestore(root, sourcePath) : null;
  if (!sourceRestoreTarget) blockers.push('sourceRestoreParentRequired');
  if (sourceRestoreTarget && fs.existsSync(sourceRestoreTarget)) blockers.push('sourceRestorePathAlreadyExists');

  return baseProcedure(
    input,
    report.rollbackId,
    report.rollbackMetadataPath,
    sourcePath && destinationPath ? [sourcePath, destinationPath] : [],
    sourcePath && destinationPath ? [destinationPath, sourcePath] : [],
    sourcePath && destinationPath ? {
      [sourcePath]: null,
      [destinationPath]: report.destinationContentHash,
    } : {},
    sourcePath && destinationPath ? {
      [sourcePath]: report.sourceContentHash,
      [destinationPath]: null,
    } : {},
    sourcePath && destinationPath && metadata ? [
      `Confirm human approval to recover proposal ${report.proposalId} from rollback ${metadata.rollbackId}.`,
      `Verify ${destinationPath} currently hashes to ${report.destinationContentHash}.`,
      `Verify ${sourcePath} does not already exist.`,
      `Move exactly ${destinationPath} back to ${sourcePath}.`,
      `Verify ${sourcePath} now hashes to ${report.sourceContentHash} and ${destinationPath} is absent.`,
      'Append the recovery result to the writer audit trail before considering the incident closed.',
    ] : [],
    blockers,
  );
}

export function createWriterRecoveryProcedure(
  input: InfiniteBrainWriterRecoveryProcedureInput,
): InfiniteBrainWriterRecoveryProcedure {
  const root = resolveRoot(input.mindRoot);
  if (!root) {
    return baseProcedure(
      input,
      null,
      null,
      [],
      [],
      {},
      {},
      [],
      ['mindRootUnavailable'],
    );
  }

  if (input.operationType === 'wiki-update' || input.operationType === 'live-status-update') {
    return buildFileRecoveryProcedure(input, root);
  }
  return buildMoveRecoveryProcedure(input, root);
}
