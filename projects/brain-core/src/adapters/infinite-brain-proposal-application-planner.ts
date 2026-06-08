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

const DEFAULT_PLAN_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-application-plan-latest.json';
const PROPOSALS_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposals-latest.json';
const APPROVALS_STORE_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-approvals.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface ProposalApplicationPlanStep {
  stepId: string;
  proposalId: string;
  category: string;
  proposedAction: string;
  sourcePaths: string[];
  targetPathsPreview: string[];
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
  [key: string]: unknown;
}

export interface ProposalApprovalRecord {
  proposalId: string;
  decision: 'approved' | 'rejected' | 'needs-review';
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

function createApplicationPlanStep(
  proposal: ProposalRecord,
  approvalRecord: ProposalApprovalRecord,
  index: number
): ProposalApplicationPlanStep {
  const sourcePaths = proposal.sourcePaths || [];
  const targetPaths = createCategoryPreviewPaths(proposal.category, proposal);
  const wouldWriteToMind = proposal.writesToMindIfApproved === true;

  return {
    stepId: generateStepId(proposal.proposalId, index),
    proposalId: proposal.proposalId,
    category: proposal.category,
    proposedAction: proposal.proposedAction || proposal.title || '',
    sourcePaths,
    targetPathsPreview: targetPaths,
    wouldWriteToMind,
    requiresApproval: true,
    executionBlocked: true,
    applied: false,
    rollbackRequired: targetPaths.length > 0 || wouldWriteToMind,
    rollbackPlanPreview: createRollbackPreview(proposal.category, targetPaths),
    riskLevel: (proposal.riskLevel as 'low' | 'medium' | 'high') || 'low',
    confidence: proposal.confidence as number || 0.5,
    reason: `Proposal approved: ${proposal.category}`,
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
