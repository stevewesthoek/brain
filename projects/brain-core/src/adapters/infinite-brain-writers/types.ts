/**
 * Infinite Brain Writer Types
 * Shared type definitions for all category-specific writers
 * Phase Z: All writers disabled, return blocked status only
 */

export type InfiniteBrainWriterCategory =
  | 'atomization'
  | 'entity-metadata'
  | 'edge-review'
  | 'wiki-writing'
  | 'task-extraction'
  | 'cleanup';

export interface InfiniteBrainWikiSingleFileWriteInput {
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  targetPath: string;
  expectedBeforeHash: string;
  newContent: string;
  allowedSections: string[];
  contentIntent: string;
  operator: string;
  reason: string;
  manualSingleWriteConfirm: boolean;
  mindRoot: string;
}

export interface InfiniteBrainWikiSingleFileWriteReport {
  writeId: string;
  generatedAt: string;
  status: 'blocked' | 'applied' | 'failed';
  targetPath: string;
  changedPaths: string[];
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  beforeContentHash: string | null;
  afterContentHash: string | null;
  rollbackId: string | null;
  rollbackSnapshotPath: string | null;
  writeReportPath: string | null;
  blockers: string[];
  singleFileOnly: true;
  exactPathOnly: true;
  atomicWrite: boolean;
  wroteToMind: boolean;
  applied: boolean;
}

export interface InfiniteBrainLiveStatusSingleFileWriteInput {
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  targetPath: string;
  expectedBeforeHash: string;
  newContent: string;
  allowedSections: string[];
  contentIntent: string;
  operator: string;
  reason: string;
  manualSingleWriteConfirm: boolean;
  mindRoot: string;
}

export interface InfiniteBrainLiveStatusSingleFileWriteReport {
  writeId: string;
  generatedAt: string;
  status: 'blocked' | 'applied' | 'failed';
  targetPath: string;
  changedPaths: string[];
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  beforeContentHash: string | null;
  afterContentHash: string | null;
  rollbackId: string | null;
  rollbackSnapshotPath: string | null;
  writeReportPath: string | null;
  blockers: string[];
  singleFileOnly: true;
  exactPathOnly: true;
  atomicWrite: boolean;
  wroteToMind: boolean;
  applied: boolean;
}

export interface InfiniteBrainSupersedeArchiveMoveInput {
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  sourcePath: string;
  destinationPath: string;
  expectedSourceHash: string;
  contradictionSummary: string;
  supersessionReason: string;
  operator: string;
  manualSingleMoveConfirm: boolean;
  mindRoot: string;
}

export interface InfiniteBrainSupersedeArchiveMoveReport {
  moveId: string;
  generatedAt: string;
  status: 'blocked' | 'applied' | 'failed';
  sourcePath: string;
  destinationPath: string;
  changedPaths: string[];
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  sourceContentHash: string | null;
  destinationContentHash: string | null;
  rollbackId: string | null;
  rollbackMetadataPath: string | null;
  moveReportPath: string | null;
  blockers: string[];
  exactPathsOnly: true;
  singleFileOnly: true;
  nonDeletingArchiveMove: true;
  wroteToMind: boolean;
  applied: boolean;
}

export interface InfiniteBrainSourceRoutingMoveInput {
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  sourcePath: string;
  destinationPath: string;
  expectedSourceHash: string;
  routingReason: string;
  sourceSummary: string;
  operator: string;
  manualSingleMoveConfirm: boolean;
  mindRoot: string;
}

export interface InfiniteBrainSourceRoutingMoveReport {
  moveId: string;
  generatedAt: string;
  status: 'blocked' | 'applied' | 'failed';
  sourcePath: string;
  destinationPath: string;
  changedPaths: string[];
  approvalId: string;
  proposalId: string;
  sourceReportId: string | null;
  sourceCommit: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  sourceContentHash: string | null;
  destinationContentHash: string | null;
  rollbackId: string | null;
  rollbackMetadataPath: string | null;
  moveReportPath: string | null;
  blockers: string[];
  exactPathsOnly: true;
  singleFileOnly: true;
  sourcesDestinationOnly: true;
  wroteToMind: boolean;
  applied: boolean;
}

export interface InfiniteBrainWriterInput {
  dryRunId: string;
  dryRunReportPath?: string;
  applicationPlanId: string;
  category: InfiniteBrainWriterCategory;
  targetSteps?: Array<{
    stepId: string;
    proposalId: string;
    targetPathsPreview: string[];
  }>;
  wikiWrite?: InfiniteBrainWikiSingleFileWriteInput;
  liveStatusWrite?: InfiniteBrainLiveStatusSingleFileWriteInput;
  supersedeArchiveMove?: InfiniteBrainSupersedeArchiveMoveInput;
  sourceRoutingMove?: InfiniteBrainSourceRoutingMoveInput;
}

export interface InfiniteBrainWriterPrecondition {
  name: string;
  status: 'pass' | 'blocked' | 'uncertain';
  reason: string;
  requiredForWrite: boolean;
}

export interface InfiniteBrainWriterRollbackPreview {
  available: boolean;
  strategy: string;
  estimatedTimeMs?: number;
}

export interface InfiniteBrainWriterSafety {
  writesToMind: boolean;
  deletesFiles: boolean;
  movesFiles: boolean;
  appliesProposal: boolean;
  callsModels: boolean;
  usesShell: boolean;
  continuousRuntime: boolean;
  canWrite: boolean;
  wroteToMind: boolean;
  executionBlocked: boolean;
}

export interface InfiniteBrainWriterResult {
  ok: false; // Always false in Phase Z (blocked)
  status: 'blocked';
  category: InfiniteBrainWriterCategory;
  canWrite: false; // Always false
  wroteToMind: false; // Always false
  applied: false; // Always false
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  rollbackAvailable: false;
  executionBlocked: true;
  blockers: string[];
  preconditions: InfiniteBrainWriterPrecondition[];
  rollback: InfiniteBrainWriterRollbackPreview;
  safety: InfiniteBrainWriterSafety;
  generatedAt: string;
}

export function createBlockedWriterResult(
  category: InfiniteBrainWriterCategory,
  blockers: string[]
): InfiniteBrainWriterResult {
  return {
    ok: false,
    status: 'blocked',
    category,
    canWrite: false,
    wroteToMind: false,
    applied: false,
    filesCreated: [],
    filesModified: [],
    filesDeleted: [],
    rollbackAvailable: false,
    executionBlocked: true,
    blockers,
    preconditions: [],
    rollback: {
      available: false,
      strategy: 'Rollback not available in disabled phase',
    },
    safety: {
      writesToMind: false,
      deletesFiles: false,
      movesFiles: false,
      appliesProposal: false,
      callsModels: false,
      usesShell: false,
      continuousRuntime: false,
      canWrite: false,
      wroteToMind: false,
      executionBlocked: true,
    },
    generatedAt: new Date().toISOString(),
  };
}




export interface InfiniteBrainWikiSingleFileWriteReport {
  auditLogPath?: string | null;
}

export interface InfiniteBrainLiveStatusSingleFileWriteReport {
  auditLogPath?: string | null;
}

export interface InfiniteBrainSupersedeArchiveMoveReport {
  auditLogPath?: string | null;
}

export interface InfiniteBrainSourceRoutingMoveReport {
  auditLogPath?: string | null;
}
