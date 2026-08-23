/**
 * Infinite Brain Proposal Approval Store / CLR Decision Core ledger
 *
 * One logical queue: proposal state is derived from proposals-latest.json plus the
 * current decision records in proposal-approvals.json. Decision history is kept in
 * the same store; no second decision authority is introduced.
 *
 * Safety: decisions remain records only. They never apply proposals or write Mind.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeProposalHash, evaluateDecisionWriteGuard } from './infinite-brain-decision-runtime.mjs';

const DEFAULT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-approvals.json';
const PROPOSALS_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposals-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export type InfiniteBrainProposalDecision = 'approved' | 'rejected' | 'needs-review' | 'deferred';

export interface InfiniteBrainProposalApprovalRecord {
  proposalId: string;
  category: string;
  decision: InfiniteBrainProposalDecision;
  decidedAt: string;
  decidedBy: string;
  reason: string | undefined;
  sourceReport: string;
  proposalHash: string;
  writesToMindIfApproved: boolean;
  executionBlocked: true;
  applied: false;
  deferUntil?: string | undefined;
}

export interface InfiniteBrainProposalApprovalSummary {
  available: boolean;
  path: string;
  totalDecisions: number;
  approved: number;
  rejected: number;
  needsReview: number;
  deferred: number;
  historyEvents: number;
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

interface InfiniteBrainProposalDecisionStore {
  schemaVersion: '1.0.0';
  records: InfiniteBrainProposalApprovalRecord[];
  history?: InfiniteBrainProposalApprovalRecord[];
}

export interface InfiniteBrainProposalDecisionResult {
  ok: boolean;
  code: 'decision_recorded' | 'decision_idempotent' | 'stale_proposal_hash' | 'write_failed';
  currentProposalHash: string;
  record?: InfiniteBrainProposalApprovalRecord;
}

function getDefaultStorePath(): string {
  const envPath = process.env.IBR_PROPOSAL_APPROVALS_PATH;
  if (envPath) return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  return path.resolve(BRAIN_ROOT, DEFAULT_RELATIVE_PATH);
}

function getProposalsReportPath(): string {
  const envPath = process.env.IBR_PROPOSALS_REPORT_PATH;
  if (envPath) return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
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
    const tmpPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  }
}

function readDecisionStore(): InfiniteBrainProposalDecisionStore {
  const data = readJsonSafely<Partial<InfiniteBrainProposalDecisionStore>>(getDefaultStorePath());
  return {
    schemaVersion: '1.0.0',
    records: Array.isArray(data?.records) ? data.records : [],
    history: Array.isArray(data?.history) ? data.history : [],
  };
}

export function computeInfiniteBrainProposalHash(proposal: InfiniteBrainProposalRecord): string {
  return computeProposalHash(proposal);
}

export function readInfiniteBrainProposalReport(): InfiniteBrainProposalReport | null {
  return readJsonSafely<InfiniteBrainProposalReport>(getProposalsReportPath());
}

export function findInfiniteBrainProposal(proposalId: string): InfiniteBrainProposalRecord | undefined {
  return readInfiniteBrainProposalReport()?.proposals?.find((proposal) => proposal.proposalId === proposalId);
}

export function readInfiniteBrainProposalApprovals(): InfiniteBrainProposalApprovalRecord[] {
  return readDecisionStore().records;
}

export function readInfiniteBrainProposalDecisionHistory(): InfiniteBrainProposalApprovalRecord[] {
  return readDecisionStore().history ?? [];
}

/** Legacy-compatible writer used by older report-only callers. */
export function writeInfiniteBrainProposalApproval(record: InfiniteBrainProposalApprovalRecord): boolean {
  if (record.executionBlocked !== true || record.applied !== false) return false;

  const store = readDecisionStore();
  const existingIndex = store.records.findIndex((candidate) => candidate.proposalId === record.proposalId);
  if (existingIndex >= 0) store.records[existingIndex] = record;
  else store.records.push(record);
  store.history = [...(store.history ?? []), record];
  return writeJsonSafely(getDefaultStorePath(), store);
}

export function recordInfiniteBrainProposalDecision(input: {
  proposal: InfiniteBrainProposalRecord;
  decision: InfiniteBrainProposalDecision;
  decidedBy: string;
  reason?: string;
  expectedProposalHash: string;
  deferUntil?: string;
  now?: Date;
}): InfiniteBrainProposalDecisionResult {
  const record = createInfiniteBrainProposalApprovalRecord(
    input.proposal,
    input.decision,
    input.decidedBy,
    input.reason,
    input.deferUntil,
    input.now,
  );
  const store = readDecisionStore();
  const existingIndex = store.records.findIndex((candidate) => candidate.proposalId === record.proposalId);
  const existing = existingIndex >= 0 ? store.records[existingIndex] : undefined;
  const guard = evaluateDecisionWriteGuard({
    proposal: input.proposal,
    expectedProposalHash: input.expectedProposalHash,
    existingRecord: existing,
    nextRecord: record,
  }) as {
    ok: boolean;
    code: 'stale_proposal_hash' | 'decision_idempotent' | 'decision_recorded';
    currentProposalHash: string;
  };
  const { currentProposalHash } = guard;

  if (guard.code === 'stale_proposal_hash') {
    return { ok: false, code: guard.code, currentProposalHash };
  }
  if (guard.code === 'decision_idempotent') {
    return { ok: true, code: guard.code, currentProposalHash };
  }

  if (existingIndex >= 0) store.records[existingIndex] = record;
  else store.records.push(record);
  store.history = [...(store.history ?? []), record];

  if (!writeJsonSafely(getDefaultStorePath(), store)) {
    return { ok: false, code: 'write_failed', currentProposalHash };
  }
  return { ok: true, code: 'decision_recorded', currentProposalHash, record };
}

export function listInfiniteBrainProposalApprovals(): InfiniteBrainProposalApprovalRecord[] {
  return readInfiniteBrainProposalApprovals();
}

export function summarizeInfiniteBrainProposalApprovals(): InfiniteBrainProposalApprovalSummary {
  const records = readInfiniteBrainProposalApprovals();
  const history = readInfiniteBrainProposalDecisionHistory();
  return {
    available: records.length > 0,
    path: path.relative(BRAIN_ROOT, getDefaultStorePath()) || DEFAULT_RELATIVE_PATH,
    totalDecisions: records.length,
    approved: records.filter((record) => record.decision === 'approved').length,
    rejected: records.filter((record) => record.decision === 'rejected').length,
    needsReview: records.filter((record) => record.decision === 'needs-review').length,
    deferred: records.filter((record) => record.decision === 'deferred').length,
    historyEvents: history.length,
    applied: records.filter((record) => record.applied).length,
    executionBlocked: true,
    latestDecisionAt: history.length > 0
      ? history[history.length - 1]?.decidedAt
      : records[records.length - 1]?.decidedAt,
  };
}

export function findInfiniteBrainProposalApproval(
  proposalId: string,
): InfiniteBrainProposalApprovalRecord | undefined {
  return readInfiniteBrainProposalApprovals().find((record) => record.proposalId === proposalId);
}

export function createInfiniteBrainProposalApprovalRecord(
  proposal: InfiniteBrainProposalRecord,
  decision: InfiniteBrainProposalDecision,
  decidedBy: string,
  reason?: string,
  deferUntil?: string,
  now: Date = new Date(),
): InfiniteBrainProposalApprovalRecord {
  return {
    proposalId: proposal.proposalId,
    category: proposal.category,
    decision,
    decidedAt: now.toISOString(),
    decidedBy,
    reason,
    sourceReport: 'proposals-latest.json',
    proposalHash: computeInfiniteBrainProposalHash(proposal),
    writesToMindIfApproved: proposal.writesToMindIfApproved === true,
    executionBlocked: true,
    applied: false,
    ...(deferUntil ? { deferUntil } : {}),
  };
}
