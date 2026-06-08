/**
 * Infinite Brain Proposal Approval Store
 * Records approval decisions for Infinite Brain proposals
 * Report-only phase: records decisions but does not apply proposals
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-approvals.json';
const PROPOSALS_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposals-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface InfiniteBrainProposalApprovalRecord {
  proposalId: string;
  category: string;
  decision: 'approved' | 'rejected' | 'needs-review';
  decidedAt: string;
  decidedBy: string;
  reason: string | undefined;
  sourceReport: string;
  proposalHash: string;
  writesToMindIfApproved: boolean;
  executionBlocked: true;
  applied: false;
}

export interface InfiniteBrainProposalApprovalSummary {
  available: boolean;
  path: string;
  totalDecisions: number;
  approved: number;
  rejected: number;
  needsReview: number;
  applied: number;
  executionBlocked: true;
  latestDecisionAt: string | undefined;
}

export interface InfiniteBrainProposalRecord {
  proposalId: string;
  category: string;
  writesToMindIfApproved?: boolean;
  [key: string]: unknown;
}

export interface InfiniteBrainProposalReport {
  timestamp?: string;
  totalProposals?: number;
  proposals?: InfiniteBrainProposalRecord[];
}

function getDefaultStorePath(): string {
  return path.resolve(BRAIN_ROOT, DEFAULT_RELATIVE_PATH);
}

function getProposalsReportPath(): string {
  return path.resolve(BRAIN_ROOT, PROPOSALS_REPORT_RELATIVE_PATH);
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonSafely(filePath: string, data: unknown): boolean {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

function computeProposalHash(proposalId: string, proposalContent: string): string {
  return crypto
    .createHash('sha256')
    .update(`${proposalId}:${proposalContent}`)
    .digest('hex')
    .substring(0, 16);
}

export function readInfiniteBrainProposalReport(): InfiniteBrainProposalReport | null {
  return readJsonSafely<InfiniteBrainProposalReport>(getProposalsReportPath());
}

export function findInfiniteBrainProposal(proposalId: string): InfiniteBrainProposalRecord | undefined {
  const report = readInfiniteBrainProposalReport();
  return report?.proposals?.find((proposal) => proposal.proposalId === proposalId);
}

/**
 * Read all approval records
 */
export function readInfiniteBrainProposalApprovals(): InfiniteBrainProposalApprovalRecord[] {
  const filePath = getDefaultStorePath();
  const data = readJsonSafely<{ records: InfiniteBrainProposalApprovalRecord[] }>(filePath);
  return Array.isArray(data?.records) ? data.records : [];
}

/**
 * Write/append an approval record
 */
export function writeInfiniteBrainProposalApproval(record: InfiniteBrainProposalApprovalRecord): boolean {
  // Validate safety constraints
  if (record.executionBlocked !== true) {
    return false;
  }
  if (record.applied !== false) {
    return false;
  }

  const filePath = getDefaultStorePath();
  const existing = readInfiniteBrainProposalApprovals();

  // Check if we already have a decision for this proposal
  const existingIndex = existing.findIndex((r) => r.proposalId === record.proposalId);
  if (existingIndex >= 0) {
    // Update existing record (preserve history by overwriting same proposal)
    existing[existingIndex] = record;
  } else {
    // Add new record
    existing.push(record);
  }

  return writeJsonSafely(filePath, { records: existing });
}

/**
 * List all approval records
 */
export function listInfiniteBrainProposalApprovals(): InfiniteBrainProposalApprovalRecord[] {
  return readInfiniteBrainProposalApprovals();
}

/**
 * Summarize approval records
 */
export function summarizeInfiniteBrainProposalApprovals(): InfiniteBrainProposalApprovalSummary {
  const filePath = getDefaultStorePath();
  const records = readInfiniteBrainProposalApprovals();

  const approved = records.filter((r) => r.decision === 'approved').length;
  const rejected = records.filter((r) => r.decision === 'rejected').length;
  const needsReview = records.filter((r) => r.decision === 'needs-review').length;

  // All records should have applied: false and executionBlocked: true
  const appliedCount = records.filter((r) => r.applied).length;

  // Find latest decision
  const latestDecision = records.length > 0 ? records[records.length - 1]?.decidedAt : undefined;

  return {
    available: records.length > 0,
    path: path.relative(BRAIN_ROOT, filePath) || DEFAULT_RELATIVE_PATH,
    totalDecisions: records.length,
    approved,
    rejected,
    needsReview,
    applied: appliedCount,
    executionBlocked: true,
    latestDecisionAt: latestDecision,
  };
}

/**
 * Find approval record by proposal ID
 */
export function findInfiniteBrainProposalApproval(
  proposalId: string
): InfiniteBrainProposalApprovalRecord | undefined {
  const records = readInfiniteBrainProposalApprovals();
  return records.find((r) => r.proposalId === proposalId);
}

/**
 * Create an approval record from a proposal ID and decision
 */
export function createInfiniteBrainProposalApprovalRecord(
  proposal: InfiniteBrainProposalRecord,
  decision: 'approved' | 'rejected' | 'needs-review',
  decidedBy: string,
  reason?: string
): InfiniteBrainProposalApprovalRecord {
  return {
    proposalId: proposal.proposalId,
    category: proposal.category,
    decision,
    decidedAt: new Date().toISOString(),
    decidedBy,
    reason,
    sourceReport: 'proposals-latest.json',
    proposalHash: computeProposalHash(proposal.proposalId, JSON.stringify(proposal)),
    writesToMindIfApproved: proposal.writesToMindIfApproved === true,
    executionBlocked: true,
    applied: false,
  };
}
