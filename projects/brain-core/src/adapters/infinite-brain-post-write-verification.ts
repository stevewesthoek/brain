/**
 * Infinite Brain Post-Write Verification Framework
 * Read-only verification framework for expected write results
 * This phase: report-only, no writes, all gates blocked
 *
 * Input: executor dry-run report, optional expected write manifest
 * Output: runtime/local/infinite-brain/post-write-verification-latest.json
 *
 * Safety: verificationAvailable: false, canVerifyWrites: false, canExecute: false
 * writesToMind: false, modifiesMind: false, deletesFiles: false, movesFiles: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { readWriteManifest } from './infinite-brain-write-manifest.js';
import { readMetadataWriteRollbackSnapshot } from './infinite-brain-metadata-write-rollback.js';
import { readMetadataWriterWriteReport } from './infinite-brain-writers/writer-metadata.js';

const DEFAULT_POST_WRITE_VERIFICATION_RELATIVE_PATH = 'runtime/local/infinite-brain/post-write-verification-latest.json';
const DEFAULT_EXECUTOR_DRY_RUN_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-executor-dry-run-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_REPO_PATH = path.resolve(BRAIN_ROOT, '..', 'mind');

export interface PostWriteVerificationCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'blocked' | 'not-applicable';
  reason: string;
}

export interface PostWriteVerificationSafety {
  writesToMind: boolean;
  modifiesMind: boolean;
  deletesFiles: boolean;
  movesFiles: boolean;
  canExecute: boolean;
  verificationOnly: boolean;
  reportOnly: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
  usesShell: boolean;
}

export interface MetadataSingleFileWriteVerification {
  available: boolean;
  status: 'verified' | 'blocked' | 'mismatch';
  targetPath?: string;
  afterContentHashMatches?: boolean;
  rollbackSnapshotAvailable?: boolean;
  singleFileOnly?: boolean;
  allowlistedOnly?: boolean;
  verifiedAt?: string;
}

export interface PostWriteVerificationReport {
  reportId: string;
  generatedAt: string;
  status: 'blocked' | 'ready-for-future-write-verification' | 'missing-input';
  verificationAvailable: boolean;
  canVerifyWrites: boolean;
  canExecute: boolean;
  mindPath: string;
  dryRunReportId: string | null;
  checks: PostWriteVerificationCheck[];
  blockers: string[];
  recommendations: string[];
  metadataSingleFileWriteVerification?: MetadataSingleFileWriteVerification;
  safety: PostWriteVerificationSafety;
}

function getPostWriteVerificationPath(): string {
  const envPath = process.env.IBR_POST_WRITE_VERIFICATION_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_POST_WRITE_VERIFICATION_RELATIVE_PATH);
}

function getExecutorDryRunPath(): string {
  const envPath = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_EXECUTOR_DRY_RUN_RELATIVE_PATH);
}

function getMindRepoPath(): string {
  const envPath = process.env.IBR_MIND_REPO_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return DEFAULT_MIND_REPO_PATH;
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function generateReportId(dryRunId: string | null, checks: PostWriteVerificationCheck[], mindPath: string): string {
  const checkString = checks
    .map(c => `${c.checkId}:${c.status}`)
    .sort()
    .join(',');

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      dryRunId: dryRunId || 'no-dry-run',
      checks: checkString,
      mindPath,
    }))
    .digest('hex')
    .substring(0, 12);

  return `pwv-${hash}`;
}

function generateSafetyBlock(): PostWriteVerificationSafety {
  return {
    writesToMind: false,
    modifiesMind: false,
    deletesFiles: false,
    movesFiles: false,
    canExecute: false,
    verificationOnly: true,
    reportOnly: true,
    continuousRuntime: false,
    modelCalls: false,
    usesShell: false,
  };
}

function performPostWriteVerificationChecks(
  dryRunReportExists: boolean,
  mindPathExists: boolean
): PostWriteVerificationCheck[] {
  const checks: PostWriteVerificationCheck[] = [];
  let checkIndex = 0;

  // Check 1: dryRunReportExists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Dry-run report exists',
    status: dryRunReportExists ? 'pass' : 'blocked',
    reason: dryRunReportExists
      ? 'Executor dry-run report found'
      : 'No executor dry-run report. Generate one first.',
  });

  // Check 2: expectedWriteManifestExists
  const writeManifest = readWriteManifest();
  const manifestExists = writeManifest !== null;
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Expected write manifest exists',
    status: manifestExists ? 'pass' : 'blocked',
    reason: manifestExists
      ? 'Write manifest found'
      : 'No write manifest. Generate one first.',
  });

  // Check 3: mindPathExists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Mind path exists',
    status: mindPathExists ? 'pass' : 'blocked',
    reason: mindPathExists
      ? 'Mind repo path is accessible (read-only)'
      : 'Mind repo path not found or not accessible',
  });

  // Check 4+: exact-path wiki approval and manifest scope
  const wikiEntries = writeManifest?.entries.filter(entry => entry.category === 'wiki-writing') ?? [];
  if (!manifestExists) {
    checks.push({
      checkId: `check-${checkIndex++}`,
      label: 'source-reference-preserved',
      status: 'blocked',
      reason: 'Write manifest is unavailable, so source-reference preservation cannot be verified.',
    });
  } else if (wikiEntries.length === 0) {
    checks.push({
      checkId: `check-${checkIndex++}`,
      label: 'source-reference-preserved',
      status: 'blocked',
      reason: 'No relevant wiki manifest entries are available for source-reference verification.',
    });
  } else {
    for (const entry of wikiEntries) {
      const preservationEvidencePresent = entry.sourceReferencesPreserved === true
        && entry.validationRequired.includes('source-reference-preserved')
        && entry.exactPathApprovalValid === true;
      checks.push({
        checkId: `check-${checkIndex++}`,
        label: 'source-reference-preserved',
        status: preservationEvidencePresent ? 'pass' : 'fail',
        reason: preservationEvidencePresent
          ? `Manifest entry ${entry.entryId} preserves its approved source references.`
          : `Manifest entry ${entry.entryId} is missing valid source-reference preservation evidence.`,
      });
    }
  }

  const exactPathsValid = wikiEntries.length > 0 && wikiEntries.every(entry =>
    entry.exactPathApprovalValid === true
    && entry.targetPathsPreview.length > 0
    && entry.targetPathsPreview.every(targetPath =>
      targetPath.startsWith('wiki/')
      && !targetPath.endsWith('/')
      && !targetPath.includes('*')
      && !targetPath.includes('..')
    )
  );
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Exact approved wiki target paths are valid',
    status: exactPathsValid ? 'pass' : 'blocked',
    reason: exactPathsValid
      ? 'Every wiki manifest entry has a validated exact repository-relative file path.'
      : 'A wiki manifest entry is missing valid exact-path approval or contains a broad/invalid path.',
  });

  const beforeHashesPresent = wikiEntries.length > 0 && wikiEntries.every(entry =>
    entry.targetPathsPreview.every(targetPath =>
      entry.wouldCreateFiles
        ? Object.prototype.hasOwnProperty.call(entry.expectedBeforeHashes, targetPath)
          && entry.expectedBeforeHashes[targetPath] === null
        : typeof entry.expectedBeforeHashes[targetPath] === 'string'
          && entry.expectedBeforeHashes[targetPath]!.length > 0
    )
  );
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Expected before-state hashes are present',
    status: beforeHashesPresent ? 'pass' : 'blocked',
    reason: beforeHashesPresent
      ? 'Every approved wiki target has the required before-state expectation.'
      : 'An approved wiki target is missing its required before-state hash or create sentinel.',
  });

  const approvalsCurrent = wikiEntries.length > 0 && wikiEntries.every(entry =>
    typeof entry.approvalId === 'string'
    && entry.approvalId.length > 0
    && typeof entry.sourceCommit === 'string'
    && entry.sourceCommit.length > 0
    && typeof entry.approvedBy === 'string'
    && entry.approvedBy.length > 0
    && typeof entry.expiresAt === 'string'
    && !Number.isNaN(Date.parse(entry.expiresAt))
    && Date.parse(entry.expiresAt) > Date.now()
  );
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Approval provenance is complete and unexpired',
    status: approvalsCurrent ? 'pass' : 'blocked',
    reason: approvalsCurrent
      ? 'Approval ID, source commit, approver, and current expiry are present for every wiki entry.'
      : 'Approval provenance is incomplete or at least one approval has expired.',
  });

  const noUnapprovedPaths = wikiEntries.length > 0 && wikiEntries.every(entry => {
    const approvedPaths = new Set(Object.keys(entry.expectedBeforeHashes));
    return entry.targetPathsPreview.every(targetPath => approvedPaths.has(targetPath));
  });
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'No unapproved wiki paths are present',
    status: noUnapprovedPaths ? 'pass' : 'blocked',
    reason: noUnapprovedPaths
      ? 'Every intended wiki path is represented in the exact approval payload.'
      : 'The manifest contains a wiki target not represented in the exact approval payload.',
  });

  // Check 5: frontmatterValidationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Frontmatter validation available',
    status: 'blocked',
    reason: 'Frontmatter validation schema not yet implemented. Planned for future phase.',
  });

  // Check 6: referenceIntegrityValidationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Reference integrity validation available',
    status: 'blocked',
    reason: 'Reference integrity validation not yet implemented. Planned for future phase.',
  });

  // Check 7: duplicateDetectionAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Duplicate detection available',
    status: 'blocked',
    reason: 'Duplicate detection engine not yet implemented. Planned for future phase.',
  });

  // Check 8: rollbackVerificationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Rollback verification available',
    status: 'blocked',
    reason: 'Rollback verification not yet implemented. Blocked until enabled.',
  });

  // Check 9: changelogVerificationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Changelog verification available',
    status: 'blocked',
    reason: 'Changelog verification not yet implemented. Planned for future phase.',
  });

  // Check 10: operatorPostWriteReviewAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Operator post-write review available',
    status: 'blocked',
    reason: 'Operator post-write review gate not yet implemented. Blocked until enabled.',
  });

  return checks;
}

export function generatePostWriteVerificationReport(): PostWriteVerificationReport {
  const dryRunPath = getExecutorDryRunPath();
  const mindPath = getMindRepoPath();

  const dryRunReport = readJsonSafely<{ id?: string; reportId?: string }>(dryRunPath);
  const dryRunId = dryRunReport?.id || dryRunReport?.reportId || null;

  const dryRunReportExists = dryRunReport !== null;
  let mindPathExists = false;
  try {
    const stat = fs.statSync(mindPath);
    mindPathExists = (stat as any).isDirectory?.() ?? false;
  } catch {
    mindPathExists = false;
  }

  const checks = performPostWriteVerificationChecks(dryRunReportExists, mindPathExists);
  const blockedChecks = checks.filter(c => c.status === 'blocked');
  const failedChecks = checks.filter(c => c.status === 'fail');
  const blockers = [
    ...blockedChecks.map(c => c.label),
    ...failedChecks.map(c => c.label),
  ];

  // Recommendations
  const recommendations: string[] = [];
  if (!dryRunReportExists) {
    recommendations.push('Generate executor dry-run report first');
  }
  if (!mindPathExists) {
    recommendations.push('Ensure Mind repo path is accessible and readable');
  }
  if (blockers.length > 0) {
    recommendations.push('Implement missing verification checks before post-write verification can proceed');
  }

  const status = blockers.length > 0 ? 'blocked' : 'ready-for-future-write-verification';

  // Check for metadata single-file write verification
  const metadataSingleFileWriteReport = readMetadataWriterWriteReport();
  let metadataSingleFileWriteVerification: MetadataSingleFileWriteVerification | undefined;

  if (metadataSingleFileWriteReport && metadataSingleFileWriteReport.status === 'test-write-applied') {
    const rollbackSnapshot = readMetadataWriteRollbackSnapshot();
    const rollbackAvailable = rollbackSnapshot !== null;

    // Verify the written file matches expected hash
    let afterContentHashMatches = false;
    try {
      const fileContent = fs.readFileSync(metadataSingleFileWriteReport.targetPath, 'utf8');
      const actualHash = crypto
        .createHash('sha256')
        .update(fileContent)
        .digest('hex')
        .substring(0, 12);
      afterContentHashMatches = actualHash === metadataSingleFileWriteReport.afterContentHash;
    } catch {
      afterContentHashMatches = false;
    }

    metadataSingleFileWriteVerification = {
      available: true,
      status: afterContentHashMatches && rollbackAvailable ? 'verified' : 'mismatch',
      targetPath: metadataSingleFileWriteReport.targetPath,
      afterContentHashMatches,
      rollbackSnapshotAvailable: rollbackAvailable,
      singleFileOnly: metadataSingleFileWriteReport.singleFileOnly,
      allowlistedOnly: metadataSingleFileWriteReport.allowlistedOnly,
      verifiedAt: new Date().toISOString(),
    };
  } else {
    metadataSingleFileWriteVerification = {
      available: false,
      status: 'blocked',
    };
  }

  return {
    reportId: generateReportId(dryRunId, checks, mindPath),
    generatedAt: new Date().toISOString(),
    status,
    verificationAvailable: false,
    canVerifyWrites: false,
    canExecute: false,
    mindPath,
    dryRunReportId: dryRunId,
    checks,
    blockers,
    recommendations,
    metadataSingleFileWriteVerification,
    safety: generateSafetyBlock(),
  };
}

export function writePostWriteVerificationReport(report: PostWriteVerificationReport): boolean {
  try {
    const reportPath = getPostWriteVerificationPath();
    const reportDir = path.dirname(reportPath);
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readPostWriteVerificationReport(): PostWriteVerificationReport | null {
  const reportPath = getPostWriteVerificationPath();
  return readJsonSafely<PostWriteVerificationReport>(reportPath);
}

export function readPostWriteVerificationSummary(): {
  available: boolean;
  generatedAt?: string;
  status?: string;
  verificationAvailable?: boolean;
  canVerifyWrites?: boolean;
  canExecute?: boolean;
  blockerCount?: number;
} {
  const report = readPostWriteVerificationReport();
  if (!report) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    status: report.status,
    verificationAvailable: report.verificationAvailable,
    canVerifyWrites: report.canVerifyWrites,
    canExecute: report.canExecute,
    blockerCount: report.blockers.length,
  };
}
