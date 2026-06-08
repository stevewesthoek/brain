/**
 * Infinite Brain Entity Metadata Writer
 * Updates YAML frontmatter and entity metadata
 * Phase AK: Planned operations generator (dry-run only, no writes)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';

const DEFAULT_DRY_RUN_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-writer-dry-run-latest.json';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface MetadataWriterPlannedOperation {
  operationId: string;
  manifestEntryId: string;
  proposalId: string;
  targetPathsPreview: string[];
  patchPreviewSummary: string;
  writeBlocked: true;
  applied: false;
  dryRunOnly: true;
}

export interface MetadataWriterDryRunReport {
  dryRunId: string;
  generatedAt: string;
  status: 'blocked' | 'dry-run-only';
  writerCategory: 'entity-metadata';
  dryRunOnly: true;
  writeEnabled: false;
  canWrite: false;
  canWriteToMind: false;
  wroteToMind: false;
  applied: false;
  plannedOperations: MetadataWriterPlannedOperation[];
  blockers: string[];
  preconditions: InfiniteBrainWriterPrecondition[];
  safety: {
    writesToMind: false;
    modifiesMind: false;
    appliesProposals: false;
    canWrite: false;
    canWriteToMind: false;
    dryRunOnly: true;
    globalExecutionDisabled: true;
    continuousRuntime: false;
    modelCalls: false;
    usesShell: false;
  };
}

function getDryRunPath(): string {
  const envPath = process.env.IBR_METADATA_WRITER_DRY_RUN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_DRY_RUN_RELATIVE_PATH);
}

function generateDryRunId(operationCount: number, operationIds: string[]): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      scope: 'metadata-writer-dry-run',
      operationCount,
      operationIds: [...operationIds].sort(),
    }))
    .digest('hex')
    .substring(0, 12);
  return `mdwr-${hash}`;
}

function generateOperationId(manifestEntryId: string, proposalId: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${manifestEntryId}|${proposalId}`)
    .digest('hex')
    .substring(0, 12);
  return `entry-${hash}`;
}

export function evaluateMetadataWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'frontmatterPatcherImplemented',
      status: 'pass',
      reason: 'Frontmatter patcher implemented and available in-memory',
      requiredForWrite: true,
    },
    {
      name: 'conflictDetectionAvailable',
      status: 'blocked',
      reason: 'Conflict detection for concurrent edits not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'yamlValidationAvailable',
      status: 'blocked',
      reason: 'YAML validation layer not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'postWriteVerificationAvailable',
      status: 'blocked',
      reason: 'Post-write verification not yet integrated with metadata writer',
      requiredForWrite: true,
    },
    {
      name: 'metadataWriterImplemented',
      status: 'blocked',
      reason: 'Metadata writer execution not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'iosSyncSafetyVerified',
      status: 'blocked',
      reason: 'iOS sync safety verification not yet confirmed',
      requiredForWrite: true,
    },
    {
      name: 'rollbackAvailable',
      status: 'blocked',
      reason: 'Rollback mechanism not yet implemented for metadata writes',
      requiredForWrite: true,
    },
    {
      name: 'operatorApprovalPresent',
      status: 'blocked',
      reason: 'Operator approval gate not yet verified',
      requiredForWrite: true,
    },
    {
      name: 'globalExecutionDisabled',
      status: 'blocked',
      reason: 'Global execution disabled by default. Future phases will enable controlled writes.',
      requiredForWrite: true,
    },
    {
      name: 'allowlistedWriterDeployment',
      status: 'blocked',
      reason: 'Writer deployment not yet allowlisted for production use',
      requiredForWrite: true,
    },
  ];
}

export function buildMetadataWriterExecutionPlan(
  manifestEntries: any[] = [],
  validationEntries: any[] = []
): MetadataWriterPlannedOperation[] {
  const operations: MetadataWriterPlannedOperation[] = [];

  for (const entry of manifestEntries) {
    if (entry.category !== 'entity-metadata' && entry.category?.toLowerCase() !== 'metadata') {
      continue;
    }

    const operationId = generateOperationId(entry.entryId, entry.proposalId);
    operations.push({
      operationId,
      manifestEntryId: entry.entryId,
      proposalId: entry.proposalId,
      targetPathsPreview: entry.targetPathsPreview || [],
      patchPreviewSummary: entry.patchPreviewSummary || 'Metadata patch planned',
      writeBlocked: true,
      applied: false,
      dryRunOnly: true,
    });
  }

  return operations;
}

export function runMetadataWriterDryRunOnly(): MetadataWriterDryRunReport {
  const preconditions = evaluateMetadataWriterPreconditions();
  const blockedPreconditions = preconditions.filter(p => p.status === 'blocked' && p.requiredForWrite);
  const blockers = [
    'globalExecutionDisabled',
    ...blockedPreconditions.map(p => p.name),
  ];

  const plannedOperations = buildMetadataWriterExecutionPlan();

  const dryRunId = generateDryRunId(plannedOperations.length, plannedOperations.map(op => op.operationId));

  const report: MetadataWriterDryRunReport = {
    dryRunId,
    generatedAt: new Date().toISOString(),
    status: 'dry-run-only',
    writerCategory: 'entity-metadata',
    dryRunOnly: true,
    writeEnabled: false,
    canWrite: false,
    canWriteToMind: false,
    wroteToMind: false,
    applied: false,
    plannedOperations,
    blockers,
    preconditions,
    safety: {
      writesToMind: false,
      modifiesMind: false,
      appliesProposals: false,
      canWrite: false,
      canWriteToMind: false,
      dryRunOnly: true,
      globalExecutionDisabled: true,
      continuousRuntime: false,
      modelCalls: false,
      usesShell: false,
    },
  };

  return report;
}

export function writeMetadataWriterDryRunReport(report: MetadataWriterDryRunReport): boolean {
  try {
    const reportPath = getDryRunPath();
    const reportDir = path.dirname(reportPath);
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readMetadataWriterDryRunReport(): MetadataWriterDryRunReport | null {
  try {
    const reportPath = getDryRunPath();
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as MetadataWriterDryRunReport;
  } catch {
    return null;
  }
}

export async function runMetadataWriterDisabled(
  _input: InfiniteBrainWriterInput
): Promise<InfiniteBrainWriterResult> {
  const preconditions = evaluateMetadataWriterPreconditions();
  const blockers = preconditions
    .filter(p => p.status === 'blocked' && p.requiredForWrite)
    .map(p => p.reason);

  const result = createBlockedWriterResult('entity-metadata', blockers);
  result.preconditions = preconditions;

  return result;
}
