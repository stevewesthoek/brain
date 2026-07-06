/**
 * Infinite Brain Proposal Application Planner
 * Converts approved proposals into application plans (preview-only, no execution)
 *
 * Input:
 *   - runtime/local/infinite-brain/proposals-latest.json
 *   - runtime/local/infinite-brain/proposal-approvals.json
 *
 * Output:
 *   - runtime/local/infinite-brain/proposal-application-plan-latest.json
 *
 * Safety: executionBlocked: true, previewOnly: true, no Mind writes
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  MIND_FAITH_WRITE_PREFIXES,
  MIND_KNOWLEDGE_WRITE_PREFIXES,
  MIND_ORGANIZATION_WRITE_PREFIXES,
  MIND_RESOURCE_WRITE_PREFIXES,
  normalizeExactMindMarkdownPathForPrefixes,
} from '../mind-paths.js';

const DEFAULT_PLAN_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-application-plan-latest.json';
const PROPOSALS_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposals-latest.json';
const APPROVALS_STORE_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-approvals.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const APPROVED_CONTENT_TARGET_PREFIXES = [
  ...MIND_KNOWLEDGE_WRITE_PREFIXES,
  ...MIND_ORGANIZATION_WRITE_PREFIXES,
  ...MIND_FAITH_WRITE_PREFIXES,
] as const;
const APPROVED_SOURCE_REFERENCE_PREFIXES = [
  ...MIND_RESOURCE_WRITE_PREFIXES,
  ...MIND_FAITH_WRITE_PREFIXES,
] as const;

export interface ProposalSourceReference {
  path: string;
  location: string;
  summary: string;
}

export interface ProposalApplicationPlanStep {
  stepId: string;
  proposalId: string;
  category: string;
  proposedAction: string;
  sourcePaths: string[];
  targetPathsPreview: string[];
  approvalId: string | null;
  sourceReportId: string | null;
  sourceCommit: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  expectedBeforeHashes: Record<string, string | null>;
  allowedSections: Record<string, string[]>;
  contentIntent: string | null;
  sourceReferences: ProposalSourceReference[];
  replaceSourceReferences: boolean;
  sourceReferencesPreserved: boolean;
  exactPathApprovalValid: boolean;
  exactPathApprovalErrors: string[];
  wouldWriteToMind: boolean;
  requiresApproval: boolean;
  executionBlocked: boolean;
  applied: boolean;
  rollbackRequired: boolean;
  rollbackPlanPreview: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  reason: string;
}

export interface ProposalApplicationPlanSafety {
  writesToMind: boolean;
  appliesProposals: boolean;
  deletesFiles: boolean;
  movesFiles: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
  executionBlocked: boolean;
  previewOnly: boolean;
}

export interface ProposalApplicationPlan {
  planId: string;
  generatedAt: string;
  sourceProposalReport: string;
  sourceApprovalStore: string;
  status: 'preview-only';
  totalApprovedProposals: number;
  totalPlannedSteps: number;
  steps: ProposalApplicationPlanStep[];
  safety: ProposalApplicationPlanSafety;
}

export interface ProposalRecord {
  proposalId: string;
  category: string;
  title: string;
  summary: string;
  sourcePaths: string[];
  proposedAction: string;
  confidence: number;
  riskLevel: string;
  writesToMindIfApproved?: boolean;
  sourceReferences?: ProposalSourceReference[];
  [key: string]: unknown;
}

export interface ProposalApprovalTarget {
  path: string;
  expectedBeforeHash: string | null;
  destinationPath: string | null;
  allowedSections: string[];
  contentIntent: string;
}

export interface ProposalApprovalRecord {
  proposalId: string;
  decision: 'approved' | 'rejected' | 'needs-review';
  approvalId?: string;
  sourceReportId?: string | null;
  sourceRepo?: 'mind';
  sourceCommit?: string;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  action?: 'create' | 'update' | 'move' | 'archive' | 'supersede' | 'add-source-reference';
  targets?: ProposalApprovalTarget[];
  sourceReferences?: ProposalSourceReference[];
  replaceSourceReferences?: boolean;
  reason?: string;
  [key: string]: unknown;
}

function getDefaultPlanPath(): string {
  const envPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_PLAN_RELATIVE_PATH);
}

function getProposalsReportPath(): string {
  const envPath = process.env.IBR_PROPOSALS_REPORT_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, PROPOSALS_REPORT_RELATIVE_PATH);
}

function getApprovalsStorePath(): string {
  const envPath = process.env.IBR_PROPOSAL_APPROVALS_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, APPROVALS_STORE_RELATIVE_PATH);
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function generatePlanId(approvedProposalIds: string[], steps: ProposalApplicationPlanStep[]): string {
  // Deterministic plan ID based on approved proposals and steps
  const sortedIds = [...approvedProposalIds].sort();
  const stepIds = steps.map(s => s.stepId).sort();
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      approvedProposalIds: sortedIds,
      stepIds,
    }))
    .digest('hex')
    .substring(0, 12);
  return `plan-${hash}`;
}

function generateStepId(proposalId: string, index: number): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${proposalId}-${index}`)
    .digest('hex')
    .substring(0, 8);
  return `step-${hash}`;
}

function createCategoryPreviewPaths(
  category: string,
  proposal: ProposalRecord
): string[] {
  const sourcePaths = proposal.sourcePaths || [];

  switch (category) {
    case 'atomization': {
      // Preview: would split source paths into multiple files
      return sourcePaths.map(p => `${p.replace(/\.md$/, '')}-split-[1-N].md`);
    }
    case 'entity-metadata': {
      // Preview: would modify frontmatter of source paths
      return sourcePaths;
    }
    case 'edge-review': {
      // Preview: would modify edge store (no new files)
      return [];
    }
    case 'cleanup': {
      // Preview: would delete/merge entities (no new files, source path removal)
      return [];
    }
    case 'wiki-writing': {
      // Preview: would create new wiki page
      const title = (proposal.title || 'wiki').toLowerCase().replace(/\s+/g, '-');
      return sourcePaths.map(p => `${path.dirname(p)}/wiki/${title}.md`);
    }
    case 'task-extraction': {
      // Preview: would create task records (no file changes)
      return [];
    }
    default:
      return [];
  }
}

function createRollbackPreview(category: string, targetPaths: string[]): string {
  switch (category) {
    case 'atomization':
      return `Merge split files back into original: ${targetPaths[0] || 'original.md'}`;
    case 'entity-metadata':
      return `Remove or restore original frontmatter metadata`;
    case 'edge-review':
      return `Restore removed/modified edges from evidence store`;
    case 'cleanup':
      return `Restore cleaned-up entities/edges from backup`;
    case 'wiki-writing':
      return `Delete created wiki page: ${targetPaths[0] || 'wiki/page.md'}`;
    case 'task-extraction':
      return `Remove extracted task records`;
    default:
      return 'Manual rollback required';
  }
}

function sourceReferenceKey(reference: ProposalSourceReference): string {
  return `${reference.path}\u0000${reference.location}\u0000${reference.summary}`;
}

function validateSourceReference(reference: ProposalSourceReference): string[] {
  const errors: string[] = [];
  if (!normalizeExactMindMarkdownPathForPrefixes(reference.path, APPROVED_SOURCE_REFERENCE_PREFIXES)) {
    errors.push(`invalid-source-reference-path:${reference.path}`);
  }
  if (!reference.location?.trim()) errors.push(`source-reference-location-required:${reference.path}`);
  if (!reference.summary?.trim()) errors.push(`source-reference-summary-required:${reference.path}`);
  return errors;
}

export function validateExactPathWikiApproval(
  proposal: ProposalRecord,
  approvalRecord: ProposalApprovalRecord,
  now: Date = new Date(),
): string[] {
  const errors: string[] = [];
  const targets = approvalRecord.targets ?? [];

  if (proposal.category !== 'wiki-writing') errors.push('proposal-category-must-be-wiki-writing');
  if (approvalRecord.decision !== 'approved') errors.push('approval-decision-must-be-approved');
  if (!approvalRecord.approvalId?.trim()) errors.push('approval-id-required');
  if (approvalRecord.sourceRepo !== 'mind') errors.push('source-repo-must-be-mind');
  if (!approvalRecord.sourceCommit?.trim()) errors.push('source-commit-required');
  if (!approvalRecord.approvedBy?.trim()) errors.push('approved-by-required');
  if (!approvalRecord.approvedAt || Number.isNaN(Date.parse(approvalRecord.approvedAt))) errors.push('valid-approved-at-required');
  if (!approvalRecord.expiresAt || Number.isNaN(Date.parse(approvalRecord.expiresAt))) {
    errors.push('valid-expires-at-required');
  } else if (Date.parse(approvalRecord.expiresAt) <= now.getTime()) {
    errors.push('approval-expired');
  }
  if (!['create', 'update', 'add-source-reference'].includes(approvalRecord.action ?? '')) {
    errors.push('wiki-action-must-be-create-update-or-add-source-reference');
  }
  if (targets.length === 0) errors.push('at-least-one-target-required');

  for (const target of targets) {
    if (!normalizeExactMindMarkdownPathForPrefixes(target.path, APPROVED_CONTENT_TARGET_PREFIXES)) {
      errors.push(`invalid-wiki-target:${target.path}`);
    }
    if (approvalRecord.action !== 'create' && !target.expectedBeforeHash?.trim()) {
      errors.push(`expected-before-hash-required:${target.path}`);
    }
    if (approvalRecord.action === 'create' && target.expectedBeforeHash !== null) {
      errors.push(`create-target-before-hash-must-be-null:${target.path}`);
    }
    if (target.destinationPath !== null) errors.push(`destination-path-not-allowed-for-wiki-update:${target.path}`);
    if (!target.contentIntent?.trim()) errors.push(`content-intent-required:${target.path}`);
  }

  const proposalReferences = proposal.sourceReferences ?? [];
  const approvedReferences = approvalRecord.sourceReferences ?? [];
  for (const reference of approvedReferences) errors.push(...validateSourceReference(reference));

  if (!approvalRecord.replaceSourceReferences) {
    const approvedReferenceKeys = new Set(approvedReferences.map(sourceReferenceKey));
    for (const existingReference of proposalReferences) {
      errors.push(...validateSourceReference(existingReference));
      if (!approvedReferenceKeys.has(sourceReferenceKey(existingReference))) {
        errors.push(`existing-source-reference-must-be-preserved:${existingReference.path}`);
      }
    }
  } else if (approvedReferences.length === 0 && proposalReferences.length > 0) {
    errors.push('replacement-source-references-required');
  }

  return errors;
}

function createApplicationPlanStep(
  proposal: ProposalRecord,
  approvalRecord: ProposalApprovalRecord,
  index: number
): ProposalApplicationPlanStep {
  const sourcePaths = proposal.sourcePaths || [];
  const approvalTargets = approvalRecord.targets ?? [];
  const targetPaths = approvalTargets.map(target => target.path);
  const exactPathApprovalErrors = validateExactPathWikiApproval(proposal, approvalRecord);
  const exactPathApprovalValid = exactPathApprovalErrors.length === 0;
  const expectedBeforeHashes = Object.fromEntries(
    approvalTargets.map(target => [target.path, target.expectedBeforeHash]),
  );
  const allowedSections = Object.fromEntries(
    approvalTargets.map(target => [target.path, target.allowedSections]),
  );
  const sourceReferences = approvalRecord.sourceReferences ?? [];
  const replaceSourceReferences = approvalRecord.replaceSourceReferences === true;
  const sourceReferencesPreserved = !exactPathApprovalErrors.some(error =>
    error.startsWith('invalid-source-reference-path:') ||
    error.startsWith('source-reference-location-required:') ||
    error.startsWith('source-reference-summary-required:') ||
    error.startsWith('existing-source-reference-must-be-preserved:') ||
    error === 'replacement-source-references-required'
  );
  const wouldWriteToMind = proposal.writesToMindIfApproved === true;

  return {
    stepId: generateStepId(proposal.proposalId, index),
    proposalId: proposal.proposalId,
    category: proposal.category,
    proposedAction: proposal.proposedAction || proposal.title || '',
    sourcePaths,
    targetPathsPreview: targetPaths,
    approvalId: approvalRecord.approvalId ?? null,
    sourceReportId: approvalRecord.sourceReportId ?? null,
    sourceCommit: approvalRecord.sourceCommit ?? null,
    approvedBy: approvalRecord.approvedBy ?? null,
    approvedAt: approvalRecord.approvedAt ?? null,
    expiresAt: approvalRecord.expiresAt ?? null,
    expectedBeforeHashes,
    allowedSections,
    contentIntent: approvalTargets.length === 1 ? approvalTargets[0]?.contentIntent ?? null : null,
    sourceReferences,
    replaceSourceReferences,
    sourceReferencesPreserved,
    exactPathApprovalValid,
    exactPathApprovalErrors,
    wouldWriteToMind,
    requiresApproval: true,
    executionBlocked: true,
    applied: false,
    rollbackRequired: targetPaths.length > 0 || wouldWriteToMind,
    rollbackPlanPreview: createRollbackPreview(proposal.category, targetPaths),
    riskLevel: (proposal.riskLevel as 'low' | 'medium' | 'high') || 'low',
    confidence: proposal.confidence as number || 0.5,
    reason: exactPathApprovalValid
      ? 'Exact-path wiki approval validated; execution remains blocked pending manifest and verification gates.'
      : `Exact-path wiki approval invalid: ${exactPathApprovalErrors.join(', ')}`,
  };
}

function generateSafetyBlock(): ProposalApplicationPlanSafety {
  return {
    writesToMind: false,
    appliesProposals: false,
    deletesFiles: false,
    movesFiles: false,
    continuousRuntime: false,
    modelCalls: false,
    executionBlocked: true,
    previewOnly: true,
  };
}

interface ProposalsReport {
  proposals?: ProposalRecord[];
  [key: string]: unknown;
}

interface ApprovalsStoreFile {
  records?: ProposalApprovalRecord[];
  [key: string]: unknown;
}

export function generateApplicationPlan(): ProposalApplicationPlan {
  // Load proposals report
  const proposalsPath = getProposalsReportPath();
  const proposalsReport = readJsonSafely<ProposalsReport>(proposalsPath);

  if (!proposalsReport?.proposals) {
    return {
      planId: generatePlanId([], []),
      generatedAt: new Date().toISOString(),
      sourceProposalReport: PROPOSALS_REPORT_RELATIVE_PATH,
      sourceApprovalStore: APPROVALS_STORE_RELATIVE_PATH,
      status: 'preview-only',
      totalApprovedProposals: 0,
      totalPlannedSteps: 0,
      steps: [],
      safety: generateSafetyBlock(),
    };
  }

  // Load approval records
  const approvalsPath = getApprovalsStorePath();
  const approvalsStore = readJsonSafely<ApprovalsStoreFile>(approvalsPath);
  const approvals = approvalsStore?.records || [];

  // Build approval map for fast lookup
  const approvalMap = new Map<string, ProposalApprovalRecord>();
  approvals.forEach(record => {
    if (record.proposalId) {
      approvalMap.set(record.proposalId, record);
    }
  });

  // Process each proposal
  const steps: ProposalApplicationPlanStep[] = [];
  const approvedProposalIds: string[] = [];
  let approvedCount = 0;

  proposalsReport.proposals.forEach((proposal, index) => {
    const approval = approvalMap.get(proposal.proposalId);

    // Only include proposals with "approved" decision
    if (approval?.decision === 'approved') {
      approvedCount++;
      approvedProposalIds.push(proposal.proposalId);
      const step = createApplicationPlanStep(proposal, approval, steps.length);
      steps.push(step);
    }
  });

  return {
    planId: generatePlanId(approvedProposalIds, steps),
    generatedAt: new Date().toISOString(),
    sourceProposalReport: PROPOSALS_REPORT_RELATIVE_PATH,
    sourceApprovalStore: APPROVALS_STORE_RELATIVE_PATH,
    status: 'preview-only',
    totalApprovedProposals: approvedCount,
    totalPlannedSteps: steps.length,
    steps,
    safety: generateSafetyBlock(),
  };
}

export function writeApplicationPlan(plan: ProposalApplicationPlan): boolean {
  try {
    const planPath = getDefaultPlanPath();
    const planDir = path.dirname(planPath);
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readApplicationPlan(): ProposalApplicationPlan | null {
  const planPath = getDefaultPlanPath();
  return readJsonSafely<ProposalApplicationPlan>(planPath);
}

export function readApplicationPlanSummary(): {
  available: boolean;
  path: string;
  totalApprovedProposals: number;
  totalPlannedSteps: number;
  executionBlocked: boolean;
  previewOnly: boolean;
  safety: ProposalApplicationPlanSafety;
} | null {
  const plan = readApplicationPlan();
  if (!plan) {
    return null;
  }

  return {
    available: true,
    path: path.relative(BRAIN_ROOT, getDefaultPlanPath()) || DEFAULT_PLAN_RELATIVE_PATH,
    totalApprovedProposals: plan.totalApprovedProposals,
    totalPlannedSteps: plan.totalPlannedSteps,
    executionBlocked: true,
    previewOnly: true,
    safety: plan.safety,
  };
}
