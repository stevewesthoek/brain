/**
 * Infinite Brain Entity Metadata Writer
 * Updates YAML frontmatter and entity metadata
 * Phase AK: Planned operations generator (dry-run only, no writes)
 * Phase AL: Single-file test write executor with allowlist and rollback
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';
import { isMetadataWritePathAllowlisted, validateSingleFileWriteScope } from '../infinite-brain-metadata-write-allowlist.js';
import { generateMetadataWriteRollbackSnapshotForAllowlistedFile, writeMetadataWriteRollbackSnapshot, readMetadataWriteRollbackSnapshot, metadataWriteRollbackSnapshotExists } from '../infinite-brain-metadata-write-rollback.js';
import { buildFrontmatterPatchPreview } from '../infinite-brain-frontmatter-patch-engine.js';
import { readOperatorApprovalSummary } from '../infinite-brain-operator-approval.js';
import { readIosSyncSafetySummary } from '../infinite-brain-ios-sync-safety.js';

const DEFAULT_DRY_RUN_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-writer-dry-run-latest.json';
const DEFAULT_WRITE_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-writer-write-latest.json';
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

// Single-file test write path (Phase AL)

export interface MetadataWriterSingleFileWriteReport {
  writeId: string;
  generatedAt: string;
  status: 'blocked' | 'test-write-applied';
  writerCategory: 'entity-metadata';
  targetPath: string;
  fieldName: string;
  beforeContentHash: string;
  afterContentHash: string;
  rollbackId: string | null;
  postWriteVerificationId: string | null;
  singleFileOnly: true;
  allowlistedOnly: true;
  manualSingleWriteConfirm: boolean | undefined;
  wroteToMind: boolean;
  modifiedMind: boolean;
  applied: false;
  testWriteApplied: boolean;
  autonomousExecution: false;
  blockers: string[];
  preconditions: Array<{
    name: string;
    status: 'pass' | 'blocked';
    reason: string;
  }>;
  safety: {
    writesToMind: boolean;
    modifiesMind: boolean;
    arbitraryWritesAllowed: false;
    singleFileOnly: true;
    allowlistedOnly: true;
    deletesFiles: false;
    movesFiles: false;
    appliesProposals: false;
    applied: false;
    autonomousExecution: false;
    continuousRuntime: false;
    modelCalls: false;
    usesShell: false;
  };
}

function getMetadataWriterWriteReportPath(): string {
  const envPath = process.env.IBR_METADATA_WRITER_WRITE_REPORT_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_WRITE_REPORT_RELATIVE_PATH);
}

function computeContentHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 12);
}

function generateWriteId(targetPath: string, fieldName: string, beforeHash: string, afterHash: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      scope: 'metadata-writer-single-file-write',
      targetPath,
      fieldName,
      beforeHash,
      afterHash,
    }))
    .digest('hex')
    .substring(0, 12);
  return `wrw-${hash}`;
}

export interface MetadataWriterSingleFileWriteInput {
  targetPath: string;
  fieldName: string;
  value: unknown;
  operator: string;
  reason: string;
  manualSingleWriteConfirm?: boolean;
}

export function evaluateMetadataWriterRealWritePreconditions(): Array<{
  name: string;
  status: 'pass' | 'blocked';
  reason: string;
}> {
  const preconditions: Array<{ name: string; status: 'pass' | 'blocked'; reason: string }> = [];

  // Check: target path allowlisted
  preconditions.push({
    name: 'targetPathAllowlisted',
    status: 'blocked' as const,
    reason: 'Single-file write validation will determine if target is allowlisted',
  });

  // Check: single file scope
  preconditions.push({
    name: 'singleFileScope',
    status: 'blocked' as const,
    reason: 'Single-file scope validation will confirm only one target',
  });

  // Check: frontmatter patch engine available
  preconditions.push({
    name: 'frontmatterPatchEngineAvailable',
    status: 'pass' as const,
    reason: 'Frontmatter patch engine is implemented and available in-memory',
  });

  // Check: global autonomous execution disabled
  preconditions.push({
    name: 'globalAutonomousExecutionDisabled',
    status: 'pass' as const,
    reason: 'Global autonomous execution is disabled by default',
  });

  // Check: manual single write mode requested
  preconditions.push({
    name: 'manualSingleWriteModeRequested',
    status: 'blocked' as const,
    reason: 'Manual single write confirmation not yet provided in request',
  });

  // Check: operator approval intent recorded
  const approvalSummary = readOperatorApprovalSummary();
  const approvalStatus: 'pass' | 'blocked' = approvalSummary.available ? 'pass' : 'blocked';
  preconditions.push({
    name: 'operatorApprovalIntentRecorded',
    status: approvalStatus,
    reason: approvalSummary.available
      ? `Operator approval recorded: ${approvalSummary.operator}`
      : 'No operator approval record found',
  });

  // Check: iOS sync safety report exists
  const iosSyncSummary = readIosSyncSafetySummary();
  const iosSyncStatus: 'pass' | 'blocked' = iosSyncSummary.available ? 'pass' : 'blocked';
  preconditions.push({
    name: 'iosSyncSafetyReportExists',
    status: iosSyncStatus,
    reason: iosSyncSummary.available
      ? 'iOS sync safety report available'
      : 'No iOS sync safety report found',
  });

  return preconditions;
}

export function runMetadataWriterSingleFileWrite(input: MetadataWriterSingleFileWriteInput): MetadataWriterSingleFileWriteReport {
  const preconditions = evaluateMetadataWriterRealWritePreconditions();
  const blockers: string[] = [];

  // Validate: manualSingleWriteConfirm
  if (!input.manualSingleWriteConfirm) {
    blockers.push('manualSingleWriteConfirmNotProvided');
  }

  // Validate: operator
  if (!input.operator || input.operator.trim().length === 0) {
    blockers.push('operatorNameRequired');
  }

  // Validate: reason
  if (!input.reason || input.reason.trim().length === 0) {
    blockers.push('reasonRequired');
  }

  // Validate: target path allowlisted
  const allowlistValidation = validateSingleFileWriteScope(input.targetPath);
  if (!allowlistValidation.allowed) {
    blockers.push(`targetPathNotAllowlisted: ${allowlistValidation.reason}`);
  }

  // Validate: target file exists
  let targetFileExists = false;
  let beforeContent = '';
  let beforeContentHash = '';
  if (allowlistValidation.normalizedPath) {
    try {
      beforeContent = fs.readFileSync(allowlistValidation.normalizedPath, 'utf8');
      targetFileExists = true;
      beforeContentHash = computeContentHash(beforeContent);
    } catch {
      blockers.push('targetFileNotFound');
    }
  }

  // Validate: fieldName is valid
  const validFieldNames = new Set([
    'id',
    'name',
    'description',
    'type',
    'tags',
    'category',
    'status',
    'priority',
    'created',
    'modified',
    'author',
    'version',
    'metadata',
    'source',
    'published',
    'archived',
  ]);
  if (!validFieldNames.has(input.fieldName)) {
    blockers.push('invalidFieldName');
  }

  // Validate: external gates must be satisfied before any single-file test write.
  for (const precondition of preconditions) {
    if (
      precondition.status === 'blocked' &&
      (precondition.name === 'operatorApprovalIntentRecorded' ||
        precondition.name === 'iosSyncSafetyReportExists')
    ) {
      blockers.push(precondition.name);
    }
  }

  // If any blockers, return blocked report
  if (blockers.length > 0) {
    const blockedPreconditions = preconditions.map(p => {
      const status: 'pass' | 'blocked' = p.status === 'pass' && !blockers.includes(p.name) ? 'pass' : 'blocked';
      return {
        name: p.name,
        status,
        reason: p.reason,
      };
    });

    const writeId = generateWriteId(input.targetPath, input.fieldName, 'blocked', 'blocked');

    return {
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      writerCategory: 'entity-metadata',
      targetPath: input.targetPath,
      fieldName: input.fieldName,
      beforeContentHash,
      afterContentHash: '',
      rollbackId: null,
      postWriteVerificationId: null,
      singleFileOnly: true,
      allowlistedOnly: true,
      manualSingleWriteConfirm: input.manualSingleWriteConfirm || false,
      wroteToMind: false,
      modifiedMind: false,
      applied: false,
      testWriteApplied: false,
      autonomousExecution: false,
      blockers,
      preconditions: blockedPreconditions,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };
  }

  // All gates passed, create rollback snapshot
  if (!allowlistValidation.normalizedPath) {
    blockers.push('pathNormalizationFailed');
    const writeId = generateWriteId(input.targetPath, input.fieldName, 'snapshot-failed', 'snapshot-failed');
    return {
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      writerCategory: 'entity-metadata',
      targetPath: input.targetPath,
      fieldName: input.fieldName,
      beforeContentHash,
      afterContentHash: '',
      rollbackId: null,
      postWriteVerificationId: null,
      singleFileOnly: true,
      allowlistedOnly: true,
      manualSingleWriteConfirm: input.manualSingleWriteConfirm,
      wroteToMind: false,
      modifiedMind: false,
      applied: false,
      testWriteApplied: false,
      autonomousExecution: false,
      blockers,
      preconditions,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };
  }

  const rollbackSnapshot = generateMetadataWriteRollbackSnapshotForAllowlistedFile(
    allowlistValidation.normalizedPath
  );

  if (!rollbackSnapshot) {
    blockers.push('rollbackSnapshotCreationFailed');
    const writeId = generateWriteId(input.targetPath, input.fieldName, beforeContentHash, 'snapshot-failed');
    return {
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      writerCategory: 'entity-metadata',
      targetPath: input.targetPath,
      fieldName: input.fieldName,
      beforeContentHash,
      afterContentHash: '',
      rollbackId: null,
      postWriteVerificationId: null,
      singleFileOnly: true,
      allowlistedOnly: true,
      manualSingleWriteConfirm: input.manualSingleWriteConfirm,
      wroteToMind: false,
      modifiedMind: false,
      applied: false,
      testWriteApplied: false,
      autonomousExecution: false,
      blockers,
      preconditions,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };
  }

  // Write rollback snapshot to Brain runtime
  if (!writeMetadataWriteRollbackSnapshot(rollbackSnapshot)) {
    blockers.push('rollbackSnapshotWriteFailed');
    const writeId = generateWriteId(input.targetPath, input.fieldName, beforeContentHash, 'snapshot-write-failed');
    return {
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      writerCategory: 'entity-metadata',
      targetPath: input.targetPath,
      fieldName: input.fieldName,
      beforeContentHash,
      afterContentHash: '',
      rollbackId: rollbackSnapshot.rollbackId,
      postWriteVerificationId: null,
      singleFileOnly: true,
      allowlistedOnly: true,
      manualSingleWriteConfirm: input.manualSingleWriteConfirm,
      wroteToMind: false,
      modifiedMind: false,
      applied: false,
      testWriteApplied: false,
      autonomousExecution: false,
      blockers,
      preconditions,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };
  }

  // Apply frontmatter patch in memory
  let patchedContent: string;
  try {
    // Convert value to acceptable types for frontmatter
    let frontmatterValue: string | number | boolean | Record<string, unknown> | unknown[] = String(input.value);
    if (typeof input.value === 'number' || typeof input.value === 'boolean') {
      frontmatterValue = input.value;
    } else if (typeof input.value === 'object' && input.value !== null) {
      frontmatterValue = input.value as Record<string, unknown> | unknown[];
    }

    const patchOp = {
      type: 'setField' as const,
      fieldName: input.fieldName,
      value: frontmatterValue,
    };

    const preview = buildFrontmatterPatchPreview(beforeContent, { operations: [patchOp] });

    if (preview.fieldChanges.length === 0 || preview.fieldChanges.some(fc => fc.blocked)) {
      blockers.push('frontmatterPatchFailed');
      const writeId = generateWriteId(input.targetPath, input.fieldName, beforeContentHash, 'patch-failed');
      return {
        writeId,
        generatedAt: new Date().toISOString(),
        status: 'blocked',
        writerCategory: 'entity-metadata',
        targetPath: input.targetPath,
        fieldName: input.fieldName,
        beforeContentHash,
        afterContentHash: '',
        rollbackId: rollbackSnapshot.rollbackId,
        postWriteVerificationId: null,
        singleFileOnly: true,
        allowlistedOnly: true,
        manualSingleWriteConfirm: input.manualSingleWriteConfirm,
        wroteToMind: false,
        modifiedMind: false,
        applied: false,
        testWriteApplied: false,
        autonomousExecution: false,
        blockers,
        preconditions,
        safety: {
          writesToMind: false,
          modifiesMind: false,
          arbitraryWritesAllowed: false,
          singleFileOnly: true,
          allowlistedOnly: true,
          deletesFiles: false,
          movesFiles: false,
          appliesProposals: false,
          applied: false,
          autonomousExecution: false,
          continuousRuntime: false,
          modelCalls: false,
          usesShell: false,
        },
      };
    }

    patchedContent = preview.markdown;
  } catch (err) {
    blockers.push('frontmatterPatchEngineError');
    const writeId = generateWriteId(input.targetPath, input.fieldName, beforeContentHash, 'patch-engine-error');
    return {
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      writerCategory: 'entity-metadata',
      targetPath: input.targetPath,
      fieldName: input.fieldName,
      beforeContentHash,
      afterContentHash: '',
      rollbackId: rollbackSnapshot.rollbackId,
      postWriteVerificationId: null,
      singleFileOnly: true,
      allowlistedOnly: true,
      manualSingleWriteConfirm: input.manualSingleWriteConfirm,
      wroteToMind: false,
      modifiedMind: false,
      applied: false,
      testWriteApplied: false,
      autonomousExecution: false,
      blockers,
      preconditions,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };
  }

  // Write exactly the allowlisted file with patched content
  try {
    fs.writeFileSync(allowlistValidation.normalizedPath, patchedContent);
  } catch {
    blockers.push('fileWriteFailed');
    const afterContentHash = computeContentHash(patchedContent);
    const writeId = generateWriteId(input.targetPath, input.fieldName, beforeContentHash, afterContentHash);
    return {
      writeId,
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      writerCategory: 'entity-metadata',
      targetPath: input.targetPath,
      fieldName: input.fieldName,
      beforeContentHash,
      afterContentHash,
      rollbackId: rollbackSnapshot.rollbackId,
      postWriteVerificationId: null,
      singleFileOnly: true,
      allowlistedOnly: true,
      manualSingleWriteConfirm: input.manualSingleWriteConfirm,
      wroteToMind: false,
      modifiedMind: false,
      applied: false,
      testWriteApplied: false,
      autonomousExecution: false,
      blockers,
      preconditions,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };
  }

  // Successful test write
  const afterContentHash = computeContentHash(patchedContent);
  const writeId = generateWriteId(input.targetPath, input.fieldName, beforeContentHash, afterContentHash);

  return {
    writeId,
    generatedAt: new Date().toISOString(),
    status: 'test-write-applied',
    writerCategory: 'entity-metadata',
    targetPath: input.targetPath,
    fieldName: input.fieldName,
    beforeContentHash,
    afterContentHash,
    rollbackId: rollbackSnapshot.rollbackId,
    postWriteVerificationId: null,
    singleFileOnly: true,
    allowlistedOnly: true,
    manualSingleWriteConfirm: input.manualSingleWriteConfirm,
    wroteToMind: true,
    modifiedMind: true,
    applied: false,
    testWriteApplied: true,
    autonomousExecution: false,
    blockers: [],
    preconditions,
    safety: {
      writesToMind: true,
      modifiesMind: true,
      arbitraryWritesAllowed: false,
      singleFileOnly: true,
      allowlistedOnly: true,
      deletesFiles: false,
      movesFiles: false,
      appliesProposals: false,
      applied: false,
      autonomousExecution: false,
      continuousRuntime: false,
      modelCalls: false,
      usesShell: false,
    },
  };
}

export function writeMetadataWriterWriteReport(report: MetadataWriterSingleFileWriteReport): boolean {
  try {
    const reportPath = getMetadataWriterWriteReportPath();
    const reportDir = path.dirname(reportPath);
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readMetadataWriterWriteReport(): MetadataWriterSingleFileWriteReport | null {
  try {
    const reportPath = getMetadataWriterWriteReportPath();
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as MetadataWriterSingleFileWriteReport;
  } catch {
    return null;
  }
}
