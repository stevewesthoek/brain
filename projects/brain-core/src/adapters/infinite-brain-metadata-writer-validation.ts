/**
 * Infinite Brain Metadata Writer Validation
 * Validates whether manifest entries for entity-metadata could be safely written
 * This phase: validation-only, no writes, all operations blocked
 *
 * Input:
 *   - runtime/local/infinite-brain/write-manifest-latest.json
 *
 * Output:
 *   - runtime/local/infinite-brain/metadata-writer-validation-latest.json
 *
 * Safety: validationAvailable: false, canWrite: false, canWriteToMind: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { readWriteManifest } from './infinite-brain-write-manifest.js';

const DEFAULT_VALIDATION_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-writer-validation-latest.json';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_REPO_PATH = path.resolve(BRAIN_ROOT, '..', 'mind');

export interface MetadataValidationCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'blocked' | 'not-applicable';
  reason: string;
}

export interface MetadataValidationEntry {
  entryId: string;
  manifestEntryId: string;
  proposalId: string;
  targetPathsPreview: string[];
  validationStatus: 'blocked' | 'pass' | 'fail' | 'not-applicable';
  reasons: string[];
  frontmatterPatchAvailable: boolean;
  targetPathSafe: boolean;
  conflictDetectionAvailable: boolean;
  yamlValidationAvailable: boolean;
  writeBlocked: boolean;
  applied: boolean;
}

export interface MetadataWriterValidationSafety {
  writesToMind: boolean;
  modifiesMind: boolean;
  appliesProposals: boolean;
  canWrite: boolean;
  canWriteToMind: boolean;
  validationOnly: boolean;
  reportOnly: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
  usesShell: boolean;
}

export interface MetadataWriterValidationReport {
  reportId: string;
  generatedAt: string;
  sourceManifestId: string | null;
  status: 'blocked' | 'validation-ready' | 'missing-input';
  writerCategory: string;
  validationAvailable: boolean;
  canWrite: boolean;
  canWriteToMind: boolean;
  totalMetadataEntries: number;
  validatedEntries: number;
  blockedEntries: number;
  entries: MetadataValidationEntry[];
  checks: MetadataValidationCheck[];
  blockers: string[];
  safety: MetadataWriterValidationSafety;
}

function getValidationPath(): string {
  const envPath = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_VALIDATION_RELATIVE_PATH);
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

function generateReportId(manifestId: string | null, metadataEntryIds: string[], checkStatuses: string[]): string {
  const sortedEntries = metadataEntryIds.sort().join(',');
  const sortedChecks = checkStatuses.sort().join(',');

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      manifestId: manifestId || 'no-manifest',
      entries: sortedEntries,
      checks: sortedChecks,
    }))
    .digest('hex')
    .substring(0, 12);

  return `mvv-${hash}`;
}

function generateSafetyBlock(): MetadataWriterValidationSafety {
  return {
    writesToMind: false,
    modifiesMind: false,
    appliesProposals: false,
    canWrite: false,
    canWriteToMind: false,
    validationOnly: true,
    reportOnly: true,
    continuousRuntime: false,
    modelCalls: false,
    usesShell: false,
  };
}

function performMetadataValidationChecks(
  manifestExists: boolean,
  metadataEntriesCount: number,
  mindPathExists: boolean
): MetadataValidationCheck[] {
  const checks: MetadataValidationCheck[] = [];
  let checkIndex = 0;

  // Check 1: writeManifestExists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Write manifest exists',
    status: manifestExists ? 'pass' : 'blocked',
    reason: manifestExists
      ? 'Write manifest found'
      : 'No write manifest. Generate one first.',
  });

  // Check 2: metadataEntriesPresent
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Metadata entries present',
    status: metadataEntriesCount > 0 ? 'pass' : 'blocked',
    reason: metadataEntriesCount > 0
      ? `Found ${metadataEntriesCount} metadata entries`
      : 'No metadata entries in manifest',
  });

  // Check 3: targetPathsAreMarkdown
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Target paths are markdown',
    status: 'blocked',
    reason: 'Path validation not yet implemented. Planned for future phase.',
  });

  // Check 4: targetPathsStayInsideMind
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Target paths stay inside Mind',
    status: mindPathExists ? 'blocked' : 'blocked',
    reason: 'Path validation and Mind boundary checks not yet implemented. Blocked until enabled.',
  });

  // Check 5: frontmatterPatchAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Frontmatter patcher available',
    status: 'pass',
    reason: 'Frontmatter patcher implemented and available in-memory only.',
  });

  // Check 6: conflictDetectionAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Conflict detection available',
    status: 'blocked',
    reason: 'Conflict detection engine not yet implemented. Planned for future phase.',
  });

  // Check 7: yamlValidationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'YAML validation available',
    status: 'blocked',
    reason: 'YAML validation layer not yet implemented. Planned for future phase.',
  });

  // Check 8: postWriteVerificationAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Post-write verification available',
    status: 'blocked',
    reason: 'Post-write verification not yet integrated with metadata validation. Blocked until enabled.',
  });

  // Check 9: rollbackAvailable
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Rollback available',
    status: 'blocked',
    reason: 'Rollback mechanism not yet implemented. Blocked until enabled.',
  });

  // Check 10: operatorApprovalPresent
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Operator approval present',
    status: 'blocked',
    reason: 'Operator approval gate not yet verified. Execution blocked until approval checked.',
  });

  return checks;
}

function validateManifestEntries(
  manifestEntries: any[]
): MetadataValidationEntry[] {
  const validatedEntries: MetadataValidationEntry[] = [];

  for (const entry of manifestEntries) {
    // Filter for entity-metadata category entries only
    if (entry.category !== 'entity-metadata' && entry.category?.toLowerCase() !== 'metadata') {
      continue;
    }

    const reasons: string[] = [];
    let targetPathSafe = false;

    // Check if paths look reasonable (basic validation)
    const allPathsMarkdown = entry.targetPathsPreview?.every((p: string) => p.endsWith('.md')) ?? false;
    if (!allPathsMarkdown) {
      reasons.push('Not all target paths are markdown files');
    }

    // Check if paths appear to be within Mind directory
    const allPathsInMind = entry.targetPathsPreview?.every((p: string) => !p.includes('..') && !p.startsWith('/')) ?? false;
    if (allPathsInMind) {
      targetPathSafe = true;
    } else {
      reasons.push('Some target paths may be outside Mind directory or use unsafe path traversal');
    }

    // Status is blocked until all validation checks pass
    const validationStatus = reasons.length === 0 ? 'blocked' : 'blocked';

    validatedEntries.push({
      entryId: `mventry-${entry.entryId.substring(0, 8)}`,
      manifestEntryId: entry.entryId,
      proposalId: entry.proposalId,
      targetPathsPreview: entry.targetPathsPreview || [],
      validationStatus,
      reasons,
      frontmatterPatchAvailable: true,
      targetPathSafe,
      conflictDetectionAvailable: false,
      yamlValidationAvailable: false,
      writeBlocked: true,
      applied: false,
    });
  }

  return validatedEntries;
}

export function generateMetadataValidationReport(): MetadataWriterValidationReport {
  const manifest = readWriteManifest();
  const manifestExists = manifest !== null;
  const manifestId = manifest?.manifestId || null;
  const mindPath = getMindRepoPath();

  let mindPathExists = false;
  try {
    const stat = fs.statSync(mindPath);
    mindPathExists = (stat as any).isDirectory?.() ?? false;
  } catch {
    mindPathExists = false;
  }

  // Filter manifest entries for metadata category
  const metadataEntries = manifest?.entries?.filter(
    e => e.category === 'entity-metadata' || e.category?.toLowerCase() === 'metadata'
  ) || [];

  const validatedEntries = manifestExists ? validateManifestEntries(metadataEntries) : [];
  const checks = performMetadataValidationChecks(manifestExists, metadataEntries.length, mindPathExists);

  const blockedChecks = checks.filter(c => c.status === 'blocked');
  const failedChecks = checks.filter(c => c.status === 'fail');
  const blockers = [
    ...blockedChecks.map(c => c.label),
    ...failedChecks.map(c => c.label),
  ];

  // Count validated vs blocked entries
  const blockedEntries = validatedEntries.filter(e => e.validationStatus === 'blocked').length;
  const passedEntries = validatedEntries.filter(e => e.validationStatus === 'pass').length;

  const status = blockers.length > 0 ? 'blocked' : 'validation-ready';

  // Generate deterministic report ID
  const metadataEntryIds = validatedEntries.map(e => e.manifestEntryId);
  const checkStatuses = checks.map(c => c.status);

  return {
    reportId: generateReportId(manifestId, metadataEntryIds, checkStatuses),
    generatedAt: new Date().toISOString(),
    sourceManifestId: manifestId,
    status,
    writerCategory: 'entity-metadata',
    validationAvailable: false,
    canWrite: false,
    canWriteToMind: false,
    totalMetadataEntries: metadataEntries.length,
    validatedEntries: passedEntries,
    blockedEntries,
    entries: validatedEntries,
    checks,
    blockers,
    safety: generateSafetyBlock(),
  };
}

export function writeMetadataValidationReport(report: MetadataWriterValidationReport): boolean {
  try {
    const reportPath = getValidationPath();
    const reportDir = path.dirname(reportPath);
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readMetadataValidationReport(): MetadataWriterValidationReport | null {
  const reportPath = getValidationPath();
  return readJsonSafely<MetadataWriterValidationReport>(reportPath);
}

export function readMetadataValidationSummary(): {
  available: boolean;
  generatedAt?: string;
  status?: string;
  totalMetadataEntries?: number;
  validatedEntries?: number;
  blockedEntries?: number;
  validationAvailable?: boolean;
  canWrite?: boolean;
  canWriteToMind?: boolean;
  blockerCount?: number;
} {
  const report = readMetadataValidationReport();
  if (!report) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    status: report.status,
    totalMetadataEntries: report.totalMetadataEntries,
    validatedEntries: report.validatedEntries,
    blockedEntries: report.blockedEntries,
    validationAvailable: report.validationAvailable,
    canWrite: report.canWrite,
    canWriteToMind: report.canWriteToMind,
    blockerCount: report.blockers.length,
  };
}
