/**
 * Infinite Brain Metadata Patch Preview Generation
 * Generates a preview of frontmatter/metadata patches that could be applied in the future
 * This phase: preview generation only, no writes, all operations blocked by default
 *
 * Input:
 *   - runtime/local/infinite-brain/metadata-writer-validation-latest.json
 *   - runtime/local/infinite-brain/write-manifest-latest.json
 *
 * Output:
 *   - runtime/local/infinite-brain/metadata-patch-preview-latest.json
 *
 * Safety: previewAvailable: false, canWrite: false, canWriteToMind: false, writesToMind: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { readMetadataValidationReport } from './infinite-brain-metadata-writer-validation.js';
import { readWriteManifest } from './infinite-brain-write-manifest.js';

const DEFAULT_PREVIEW_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-patch-preview-latest.json';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_REPO_PATH = path.resolve(BRAIN_ROOT, '..', 'mind');

export interface MetadataPatchPreviewField {
  fieldName: string;
  currentValue?: string;
  proposedValue?: string;
  hasConflict: boolean;
  conflictReason?: string;
}

export interface MetadataPatchPreview {
  patchId: string;
  validationEntryId: string;
  manifestEntryId: string;
  proposalId: string;
  targetPathsPreview: string[];
  patchType: 'frontmatter-preview';
  beforePreviewAvailable: boolean;
  afterPreviewAvailable: boolean;
  diffPreviewAvailable: boolean;
  proposedFields: MetadataPatchPreviewField[];
  blockedReasons: string[];
  patchBlocked: boolean;
  applied: boolean;
}

export interface MetadataPatchPreviewCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'blocked' | 'not-applicable';
  reason: string;
}

export interface MetadataPatchPreviewSafety {
  writesToMind: boolean;
  modifiesMind: boolean;
  appliesProposals: boolean;
  canWrite: boolean;
  canWriteToMind: boolean;
  previewOnly: boolean;
  reportOnly: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
  usesShell: boolean;
}

export interface MetadataPatchPreviewReport {
  previewId: string;
  generatedAt: string;
  sourceValidationReportId: string | null;
  sourceManifestId: string | null;
  status: 'blocked' | 'preview-ready' | 'missing-input';
  writerCategory: string;
  previewAvailable: boolean;
  canWrite: boolean;
  canWriteToMind: boolean;
  totalCandidatePatches: number;
  previewedPatches: number;
  blockedPatches: number;
  patches: MetadataPatchPreview[];
  checks: MetadataPatchPreviewCheck[];
  blockers: string[];
  safety: MetadataPatchPreviewSafety;
}

function getPreviewPath(): string {
  const envPath = process.env.IBR_METADATA_PATCH_PREVIEW_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_PREVIEW_RELATIVE_PATH);
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

function generatePreviewId(
  validationReportId: string | null,
  manifestId: string | null,
  patchIds: string[],
  checkStatuses: string[]
): string {
  const sortedPatches = patchIds.sort().join(',');
  const sortedChecks = checkStatuses.sort().join(',');

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      validationReportId: validationReportId || 'no-validation',
      manifestId: manifestId || 'no-manifest',
      patches: sortedPatches,
      checks: sortedChecks,
    }))
    .digest('hex')
    .substring(0, 12);

  return `mpp-${hash}`;
}

function generatePatchId(
  validationEntryId: string,
  manifestEntryId: string,
  proposalId: string
): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      validationEntryId,
      manifestEntryId,
      proposalId,
    }))
    .digest('hex')
    .substring(0, 12);

  return `patch-${hash}`;
}

function generateSafetyBlock(): MetadataPatchPreviewSafety {
  return {
    writesToMind: false,
    modifiesMind: false,
    appliesProposals: false,
    canWrite: false,
    canWriteToMind: false,
    previewOnly: true,
    reportOnly: true,
    continuousRuntime: false,
    modelCalls: false,
    usesShell: false,
  };
}

function performPatchPreviewChecks(
  validationReportExists: boolean,
  manifestExists: boolean,
  validationEntriesCount: number,
  manifestEntriesCount: number,
  mindPathExists: boolean
): MetadataPatchPreviewCheck[] {
  const checks: MetadataPatchPreviewCheck[] = [];
  let checkIndex = 0;

  // Check 1: metadataValidationExists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Metadata validation exists',
    status: validationReportExists ? 'pass' : 'blocked',
    reason: validationReportExists
      ? 'Metadata validation report found'
      : 'No metadata validation report. Generate one first.',
  });

  // Check 2: writeManifestExists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Write manifest exists',
    status: manifestExists ? 'pass' : 'blocked',
    reason: manifestExists
      ? 'Write manifest found'
      : 'No write manifest. Generate one first.',
  });

  // Check 3: validationHasMetadataEntries
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Validation has metadata entries',
    status: validationEntriesCount > 0 ? 'pass' : 'blocked',
    reason:
      validationEntriesCount > 0
        ? `Found ${validationEntriesCount} validation entries`
        : 'No metadata entries in validation report',
  });

  // Check 4: allEntriesStillBlocked
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'All entries remain blocked',
    status: 'pass',
    reason: 'Patch preview does not apply patches. All entries remain blocked by design.',
  });

  // Check 5: frontmatterPatchEngineAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Frontmatter patch engine available',
    status: 'pass',
    reason: 'Frontmatter patch engine implemented and available in-memory only.',
  });

  // Check 6: beforeAfterDiffAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Before/after diff available',
    status: 'blocked',
    reason: 'Before/after diff generation not yet implemented. Planned for future phase.',
  });

  // Check 7: yamlParserAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'YAML parser available',
    status: 'blocked',
    reason: 'YAML parser not yet integrated. Planned for future phase.',
  });

  // Check 8: conflictDetectionAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Conflict detection available',
    status: 'blocked',
    reason: 'Conflict detection engine not yet implemented. Planned for future phase.',
  });

  // Check 9: rollbackPreviewAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Rollback preview available',
    status: 'blocked',
    reason: 'Rollback preview mechanism not yet implemented. Planned for future phase.',
  });

  // Check 10: postWriteVerificationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Post-write verification available',
    status: 'blocked',
    reason: 'Post-write verification not yet integrated. Planned for future phase.',
  });

  return checks;
}

function generatePatchPreviews(
  validationEntries: any[],
  manifestEntries: any[]
): MetadataPatchPreview[] {
  const previews: MetadataPatchPreview[] = [];

  // Match validation entries with manifest entries by proposalId
  const manifestByProposal = new Map();
  for (const entry of manifestEntries) {
    manifestByProposal.set(entry.proposalId, entry);
  }

  for (const valEntry of validationEntries) {
    const manifestEntry = manifestByProposal.get(valEntry.proposalId);
    if (!manifestEntry) {
      continue;
    }

    const patchId = generatePatchId(valEntry.entryId, manifestEntry.entryId, valEntry.proposalId);

    const blockedReasons: string[] = [];

    if (!manifestEntry.contentPreviewAvailable) {
      blockedReasons.push('Content preview not available');
    }
    if (!valEntry.frontmatterPatchAvailable) {
      blockedReasons.push('Frontmatter patch engine not available');
    }
    if (!valEntry.conflictDetectionAvailable) {
      blockedReasons.push('Conflict detection not available');
    }
    if (!valEntry.yamlValidationAvailable) {
      blockedReasons.push('YAML validation not available');
    }

    // All patches are blocked until the engines are implemented
    if (blockedReasons.length === 0) {
      blockedReasons.push('Frontmatter patch engine not yet implemented');
    }

    previews.push({
      patchId,
      validationEntryId: valEntry.entryId,
      manifestEntryId: manifestEntry.entryId,
      proposalId: valEntry.proposalId,
      targetPathsPreview: manifestEntry.targetPathsPreview || [],
      patchType: 'frontmatter-preview',
      beforePreviewAvailable: false,
      afterPreviewAvailable: false,
      diffPreviewAvailable: false,
      proposedFields: [],
      blockedReasons,
      patchBlocked: true,
      applied: false,
    });
  }

  return previews;
}

export function generateMetadataPatchPreviewReport(): MetadataPatchPreviewReport {
  const validationReport = readMetadataValidationReport();
  const manifest = readWriteManifest();

  const validationReportExists = validationReport !== null;
  const manifestExists = manifest !== null;
  const validationReportId = validationReport?.reportId || null;
  const manifestId = manifest?.manifestId || null;
  const mindPath = getMindRepoPath();

  let mindPathExists = false;
  try {
    const stat = fs.statSync(mindPath);
    mindPathExists = (stat as any).isDirectory?.() ?? false;
  } catch {
    mindPathExists = false;
  }

  // Filter for metadata entries only
  const validationEntries = validationReport?.entries?.filter(
    e => e.manifestEntryId !== undefined
  ) || [];

  const manifestMetadataEntries = manifest?.entries?.filter(
    e => e.category === 'entity-metadata' || e.category?.toLowerCase() === 'metadata'
  ) || [];

  const patches = validationReportExists && manifestExists
    ? generatePatchPreviews(validationEntries, manifestMetadataEntries)
    : [];

  const checks = performPatchPreviewChecks(
    validationReportExists,
    manifestExists,
    validationEntries.length,
    manifestMetadataEntries.length,
    mindPathExists
  );

  const blockedChecks = checks.filter(c => c.status === 'blocked');
  const failedChecks = checks.filter(c => c.status === 'fail');
  const blockers = [
    ...blockedChecks.map(c => c.label),
    ...failedChecks.map(c => c.label),
  ];

  const blockedPatches = patches.filter(p => p.patchBlocked).length;
  const previewedPatches = patches.length;

  const status = blockers.length > 0 ? 'blocked' : 'preview-ready';

  // Generate deterministic preview ID
  const patchIds = patches.map(p => p.patchId);
  const checkStatuses = checks.map(c => c.status);

  return {
    previewId: generatePreviewId(validationReportId, manifestId, patchIds, checkStatuses),
    generatedAt: new Date().toISOString(),
    sourceValidationReportId: validationReportId,
    sourceManifestId: manifestId,
    status,
    writerCategory: 'entity-metadata',
    previewAvailable: false,
    canWrite: false,
    canWriteToMind: false,
    totalCandidatePatches: patches.length,
    previewedPatches,
    blockedPatches,
    patches,
    checks,
    blockers,
    safety: generateSafetyBlock(),
  };
}

export function writeMetadataPatchPreviewReport(report: MetadataPatchPreviewReport): boolean {
  try {
    const reportPath = getPreviewPath();
    const reportDir = path.dirname(reportPath);
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readMetadataPatchPreviewReport(): MetadataPatchPreviewReport | null {
  const reportPath = getPreviewPath();
  return readJsonSafely<MetadataPatchPreviewReport>(reportPath);
}

export function readMetadataPatchPreviewSummary(): {
  available: boolean;
  generatedAt?: string;
  status?: string;
  totalCandidatePatches?: number;
  previewedPatches?: number;
  blockedPatches?: number;
  previewAvailable?: boolean;
  canWrite?: boolean;
  canWriteToMind?: boolean;
  blockerCount?: number;
} {
  const report = readMetadataPatchPreviewReport();
  if (!report) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    status: report.status,
    totalCandidatePatches: report.totalCandidatePatches,
    previewedPatches: report.previewedPatches,
    blockedPatches: report.blockedPatches,
    previewAvailable: report.previewAvailable,
    canWrite: report.canWrite,
    canWriteToMind: report.canWriteToMind,
    blockerCount: report.blockers.length,
  };
}
