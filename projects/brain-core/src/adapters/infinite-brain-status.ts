/**
 * Infinite Brain Runtime — Status Adapter
 * Exposes runtime status summary (read-only)
 */

import fs from 'fs/promises';
import path from 'path';
import { summarizeInfiniteBrainProposalApprovals } from './infinite-brain-proposal-approval-store.js';
import { readApplicationPlanSummary } from './infinite-brain-proposal-application-planner.js';
import { readExecutionReadinessSummary } from './infinite-brain-proposal-execution-readiness.js';
import { readExecutorDryRunSummary } from './infinite-brain-proposal-executor-dry-run.js';
import { readIosSyncSafetySummary } from './infinite-brain-ios-sync-safety.js';
import { readOperatorApprovalSummary } from './infinite-brain-operator-approval.js';
import { readPostWriteVerificationSummary } from './infinite-brain-post-write-verification.js';
import { readWriteManifestSummary } from './infinite-brain-write-manifest.js';
import { readMetadataValidationSummary } from './infinite-brain-metadata-writer-validation.js';
import { readMetadataPatchPreviewSummary } from './infinite-brain-metadata-patch-preview.js';
import { readMetadataWriterEnablementSummary } from './infinite-brain-metadata-writer-enablement.js';

const RUNTIME_DIR = path.resolve(process.cwd(), '../..', 'runtime/local/infinite-brain');

interface AtomizerReport {
  timestamp: string;
  summary: {
    totalFilesAnalyzed: number;
    keepAtomic: number;
    considerSplit: number;
  };
  candidates?: Array<{ path: string; totalLines: number }>;
}

interface ClassifierReport {
  timestamp: string;
  summary: {
    totalFilesAnalyzed: number;
    withExistingType: number;
    inferred: number;
    needsAtomization: number;
    avgConfidence: number;
  };
}

interface EdgeInferenceReport {
  timestamp: string;
  summary: {
    totalEntities: number;
    totalInferredEdges: number;
    highConfidenceEdges: number;
    candidates: number;
  };
}

interface RelationshipAuditReport {
  timestamp: string;
  totalInferredEdges: number;
  totalReviewCandidates: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  orphanSources: Array<{ edgeId: string; entityId: string; confidence: number }>;
  orphanTargets: Array<{ edgeId: string; entityId: string; confidence: number }>;
  duplicateEdgePairs: Array<{ edgeA: string; edgeB: string }>;
  bidirectionalIssues: Array<{ sourceEntity: string; targetEntity: string }>;
  missingEvidenceFields: Array<{ edgeId: string; reason: string }>;
  suspiciousPatterns: Array<{ edgeId: string; pattern: string }>;
  healthScore: number;
  recommendations: Array<{ priority: string; category: string; count: number }>;
}

interface InsightReport {
  timestamp: string;
  status: string;
  summary: {
    insightCount: number;
    hypothesisCount: number;
    recommendationCount: number;
  };
  safety: {
    writesToMind: boolean;
    continuousRuntime: boolean;
    modelCalls: boolean;
  };
}

interface ProposalReport {
  timestamp: string;
  status: string;
  totalProposals: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  proposalsRequireApproval: number;
  highPriorityProposals: number;
  mediumPriorityProposals: number;
  lowPriorityProposals: number;
  safety: {
    writesToMind: boolean;
    continuousRuntime: boolean;
    modelCalls: boolean;
    deterministic: boolean;
    reportOnly: boolean;
  };
}

interface ChangelogStats {
  totalMutations: number;
  byAction: Record<string, number>;
  byAuthor: Record<string, number>;
  byEntityType: Record<string, number>;
}

interface EvidenceStats {
  totalRecords: number;
  evidenceCount: number;
  edgeCount: number;
  bySourceRepo: Record<string, number>;
  bySourceKind: Record<string, number>;
}

/**
 * Load JSON report safely
 */
async function loadReport<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Get atomizer status
 */
async function getAtomizerStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      filesAnalyzed: number;
      keepAtomic: number;
      considerSplit: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<AtomizerReport>(
    path.join(RUNTIME_DIR, 'atomizer-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Atomizer report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    filesAnalyzed: report.summary.totalFilesAnalyzed,
    keepAtomic: report.summary.keepAtomic,
    considerSplit: report.summary.considerSplit,
  };
}

/**
 * Get classifier status
 */
async function getClassifierStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      totalFiles: number;
      withExistingType: number;
      inferred: number;
      needsAtomization: number;
      avgConfidence: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<ClassifierReport>(
    path.join(RUNTIME_DIR, 'entity-classifier-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Classifier report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    totalFiles: report.summary.totalFilesAnalyzed,
    withExistingType: report.summary.withExistingType,
    inferred: report.summary.inferred,
    needsAtomization: report.summary.needsAtomization,
    avgConfidence: report.summary.avgConfidence,
  };
}

/**
 * Get edge inference status
 */
async function getEdgeInferenceStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      totalEntities: number;
      totalInferredEdges: number;
      highConfidenceEdges: number;
      candidates: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<EdgeInferenceReport>(
    path.join(RUNTIME_DIR, 'edge-inference-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Edge inference report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    totalEntities: report.summary.totalEntities,
    totalInferredEdges: report.summary.totalInferredEdges,
    highConfidenceEdges: report.summary.highConfidenceEdges,
    candidates: report.summary.candidates,
  };
}

/**
 * Get relationship audit status
 */
async function getRelationshipAuditStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      totalEdges: number;
      duplicateEdges: number;
      orphanReferences: number;
      suspiciousPatterns: number;
      healthScore: number;
      recommendationsCount: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<RelationshipAuditReport>(
    path.join(RUNTIME_DIR, 'relationship-audit-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Relationship audit report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    totalEdges: report.totalInferredEdges,
    duplicateEdges: report.duplicateEdgePairs.length,
    orphanReferences: report.orphanSources.length + report.orphanTargets.length,
    suspiciousPatterns: report.suspiciousPatterns.length,
    healthScore: report.healthScore,
    recommendationsCount: report.recommendations.length,
  };
}

/**
 * Get insight generation status
 */
async function getInsightStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      insightCount: number;
      hypothesisCount: number;
      recommendationCount: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<InsightReport>(
    path.join(RUNTIME_DIR, 'insights-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Insight report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    insightCount: report.summary.insightCount,
    hypothesisCount: report.summary.hypothesisCount,
    recommendationCount: report.summary.recommendationCount,
  };
}

/**
 * Get proposal generation status
 */
async function getProposalStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      totalProposals: number;
      byCategory: Record<string, number>;
      highPriorityProposals: number;
      mediumPriorityProposals: number;
      lowPriorityProposals: number;
      proposalsRequireApproval: number;
      reportOnly: boolean;
      writesToMind: boolean;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<ProposalReport>(
    path.join(RUNTIME_DIR, 'proposals-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Proposal report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    totalProposals: report.totalProposals,
    byCategory: report.byCategory,
    highPriorityProposals: report.highPriorityProposals,
    mediumPriorityProposals: report.mediumPriorityProposals,
    lowPriorityProposals: report.lowPriorityProposals,
    proposalsRequireApproval: report.proposalsRequireApproval,
    reportOnly: report.safety.reportOnly,
    writesToMind: report.safety.writesToMind,
  };
}

/**
 * Get proposal approval status
 */
async function getProposalApprovalStatus() {
  try {
    const summary = summarizeInfiniteBrainProposalApprovals();
    return summary;
  } catch {
    return {
      available: false,
      path: 'runtime/local/infinite-brain/proposal-approvals.json',
      totalDecisions: 0,
      approved: 0,
      rejected: 0,
      needsReview: 0,
      applied: 0,
      executionBlocked: true as const,
      latestDecisionAt: undefined,
    };
  }
}

/**
 * Get pipeline status
 */
async function getPipelineStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      status: string;
      stepCount: number;
      failedStepCount: number;
      durationMs: number;
      lastCompletedStep: string;
      reportOnly: boolean;
      writesToMind: boolean;
      continuousRuntime: boolean;
    }
  | { available: false; reason: string }
> {
  interface PipelineReport {
    timestamp: string;
    status: string;
    durationMs: number;
    steps: Array<{ displayName: string }>;
    failedSteps: Array<{ displayName: string }>;
    safety: {
      writesToMind: boolean;
      continuousRuntime: boolean;
    };
  }

  const report = await loadReport<PipelineReport>(
    path.join(RUNTIME_DIR, 'pipeline-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Pipeline report not found' };
  }

  const steps = report.steps || [];
  const failedSteps = report.failedSteps || [];
  const lastCompletedStep = steps.length > 0
    ? steps[steps.length - 1]?.displayName || '(unknown)'
    : '(none)';

  return {
    available: true,
    timestamp: report.timestamp,
    status: report.status,
    stepCount: steps.length,
    failedStepCount: failedSteps.length,
    durationMs: report.durationMs,
    lastCompletedStep,
    reportOnly: true,
    writesToMind: report.safety.writesToMind,
    continuousRuntime: report.safety.continuousRuntime,
  };
}

/**
 * Get changelog statistics (stub)
 */
async function getChangelogStats(): Promise<ChangelogStats> {
  return {
    totalMutations: 0,
    byAction: { created: 0, updated: 0, deleted: 0 },
    byAuthor: { system: 0, steve: 0 },
    byEntityType: {},
  };
}

/**
 * Get evidence store statistics (stub)
 */
async function getEvidenceStats(): Promise<EvidenceStats> {
  return {
    totalRecords: 0,
    evidenceCount: 0,
    edgeCount: 0,
    bySourceRepo: {},
    bySourceKind: {},
  };
}

/**
 * Get application plan status
 */
function getApplicationPlanStatus() {
  const summary = readApplicationPlanSummary();
  if (!summary) {
    return {
      available: false,
      reason: 'Application plan not found. Run /generate endpoint first.',
    };
  }

  return {
    available: true,
    path: summary.path,
    totalApprovedProposals: summary.totalApprovedProposals,
    totalPlannedSteps: summary.totalPlannedSteps,
    executionBlocked: true,
    previewOnly: true,
    safety: summary.safety,
  };
}

/**
 * Get execution readiness status
 */
function getExecutionReadinessStatus() {
  const summary = readExecutionReadinessSummary();
  if (!summary) {
    return {
      available: false,
      reason: 'Execution readiness report not found. Run /generate endpoint first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    canExecute: summary.canExecute,
    totalSteps: summary.totalSteps,
    blockedSteps: summary.blockedSteps,
    blockerCount: summary.blockerCount,
    executionBlocked: true,
    safety: summary.safety,
  };
}

/**
 * Get executor dry-run status
 */
function getExecutorDryRunStatus() {
  const summary = readExecutorDryRunSummary();
  if (!summary) {
    return {
      available: false,
      reason: 'Executor dry-run report not found. Run /generate endpoint first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    status: summary.status,
    canExecute: summary.canExecute,
    wouldExecuteSteps: summary.wouldExecuteSteps,
    blockedSteps: summary.blockedSteps,
    operationCount: summary.operationCount,
    blockerCount: summary.blockerCount,
    dryRunOnly: true,
    executionBlocked: true,
    safety: summary.safety,
  };
}

/**
 * Get iOS/Obsidian sync safety status
 */
function getIosSyncSafetyStatus() {
  const summary = readIosSyncSafetySummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'iOS sync safety report not found. Run /generate endpoint first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    status: summary.status,
    syncSafe: summary.syncSafe,
    canWriteToMind: summary.canWriteToMind,
    blockerCount: summary.blockerCount,
    reportOnly: true,
  };
}

/**
 * Get operator approval intent status
 */
function getOperatorApprovalStatus() {
  const summary = readOperatorApprovalSummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'Operator approval record not found. Record approval intent first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    operator: summary.operator,
    decision: summary.decision,
    executionEnabled: summary.executionEnabled,
    canExecute: summary.canExecute,
    applied: summary.applied,
    writesToMind: summary.writesToMind,
    approvalRecordOnly: summary.approvalRecordOnly,
  };
}

function getPostWriteVerificationStatus() {
  const summary = readPostWriteVerificationSummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'Post-write verification report not found. Generate one first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    status: summary.status,
    verificationAvailable: summary.verificationAvailable,
    canVerifyWrites: summary.canVerifyWrites,
    canExecute: summary.canExecute,
    blockerCount: summary.blockerCount,
  };
}

function getWriteManifestStatus() {
  const summary = readWriteManifestSummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'Write manifest not found. Generate one first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    status: summary.status,
    totalManifestEntries: summary.totalManifestEntries,
    writeEnabled: summary.writeEnabled,
    canWriteToMind: summary.canWriteToMind,
    blockerCount: summary.blockerCount,
  };
}

function getMetadataValidationStatus() {
  const summary = readMetadataValidationSummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'Metadata validation report not found. Generate one first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    status: summary.status,
    totalMetadataEntries: summary.totalMetadataEntries,
    validatedEntries: summary.validatedEntries,
    blockedEntries: summary.blockedEntries,
    validationAvailable: summary.validationAvailable,
    canWrite: summary.canWrite,
    canWriteToMind: summary.canWriteToMind,
    blockerCount: summary.blockerCount,
  };
}

function getMetadataPatchPreviewStatus() {
  const summary = readMetadataPatchPreviewSummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'Metadata patch preview report not found. Generate one first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    status: summary.status,
    totalCandidatePatches: summary.totalCandidatePatches,
    previewedPatches: summary.previewedPatches,
    blockedPatches: summary.blockedPatches,
    previewAvailable: summary.previewAvailable,
    canWrite: summary.canWrite,
    canWriteToMind: summary.canWriteToMind,
    blockerCount: summary.blockerCount,
  };
}

function getMetadataWriterEnablementStatus() {
  const summary = readMetadataWriterEnablementSummary();
  if (!summary.available) {
    return {
      available: false,
      reason: 'Metadata writer enablement gate not recorded yet. Record intent first.',
    };
  }

  return {
    available: true,
    generatedAt: summary.generatedAt,
    operator: summary.operator,
    decision: summary.decision,
    writeEnabled: summary.writeEnabled,
    canWrite: summary.canWrite,
    canWriteToMind: summary.canWriteToMind,
    executionEnabled: summary.executionEnabled,
    enablementRecordOnly: true,
  };
}

function getMetadataWriterDryRunStatus() {
  // Placeholder: will read dry-run report when writer-metadata exports are available
  return {
    available: false,
    reason: 'Metadata writer dry-run report not generated yet. Generate one first.',
  };
}

/**
 * Get full Infinite Brain status
 */
export async function getInfiniteBrainStatus() {
  const [atomizer, classifier, edges, relationshipAudit, insights, proposals, proposalApprovals, applicationPlan, executionReadiness, executorDryRun, iosSyncSafety, operatorApproval, postWriteVerification, writeManifest, metadataValidation, metadataPatchPreview, metadataWriterEnablement, metadataWriterDryRun, pipeline, changelogStats, evidenceStats] = await Promise.all([
    getAtomizerStatus(),
    getClassifierStatus(),
    getEdgeInferenceStatus(),
    getRelationshipAuditStatus(),
    getInsightStatus(),
    getProposalStatus(),
    getProposalApprovalStatus(),
    Promise.resolve(getApplicationPlanStatus()),
    Promise.resolve(getExecutionReadinessStatus()),
    Promise.resolve(getExecutorDryRunStatus()),
    Promise.resolve(getIosSyncSafetyStatus()),
    Promise.resolve(getOperatorApprovalStatus()),
    Promise.resolve(getPostWriteVerificationStatus()),
    Promise.resolve(getWriteManifestStatus()),
    Promise.resolve(getMetadataValidationStatus()),
    Promise.resolve(getMetadataPatchPreviewStatus()),
    Promise.resolve(getMetadataWriterEnablementStatus()),
    Promise.resolve(getMetadataWriterDryRunStatus()),
    getPipelineStatus(),
    getChangelogStats(),
    getEvidenceStats(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    runtime: {
      atomizer,
      classifier,
      edges,
      relationshipAudit,
      insights,
      proposals,
      proposalApprovals,
      applicationPlan,
      executionReadiness,
      executorDryRun,
      iosSyncSafety,
      operatorApproval,
      postWriteVerification,
      writeManifest,
      metadataValidation,
      metadataPatchPreview,
      metadataWriterEnablement,
      metadataWriterDryRun,
      pipeline,
    },
    infrastructure: {
      changelog: {
        available: changelogStats.totalMutations >= 0,
        stats: changelogStats,
      },
      evidenceStore: {
        available: evidenceStats.totalRecords >= 0,
        stats: evidenceStats,
      },
    },
    safety: {
      writesToMind: false,
      continuousRuntime: false,
      modelFallbackHardcoded: false,
      iosSyncCoordination: true,
    },
    readiness: {
      mindWriteReady: false,
      reason: 'Mind git status not checked by allowlisted Brain action; writes remain blocked.',
    },
  };
}
