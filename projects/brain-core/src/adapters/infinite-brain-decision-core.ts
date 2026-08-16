import {
  computeInfiniteBrainProposalHash,
  findInfiniteBrainProposalApproval,
  readInfiniteBrainProposalReport,
  type InfiniteBrainProposalApprovalRecord,
  type InfiniteBrainProposalRecord,
} from './infinite-brain-proposal-approval-store.js';
import { projectDecisionStatus } from './infinite-brain-decision-runtime.mjs';

export type InfiniteBrainDecisionStatus = 'pending' | 'approved' | 'rejected' | 'deferred' | 'superseded';
export type InfiniteBrainDecisionPriority = 'low' | 'normal' | 'high' | 'critical';
export type InfiniteBrainDecisionRisk = 'low' | 'medium' | 'high' | 'critical';

export interface InfiniteBrainDecisionItem {
  decisionId: string;
  proposalId: string;
  proposalHash: string;
  category: string;
  title: string;
  summary: string;
  whyNow: string;
  recommendedAction: string;
  alternatives: string[];
  consequenceOfDelay: string;
  priority: InfiniteBrainDecisionPriority;
  risk: InfiniteBrainDecisionRisk;
  evidenceRefs: string[];
  writesToMindIfApproved: boolean;
  status: InfiniteBrainDecisionStatus;
  pending: boolean;
  deferUntil: string | null;
  freshnessDeadline: string | null;
  sourceTimestamp: string | null;
  lastDecision: InfiniteBrainProposalApprovalRecord | null;
}

export interface InfiniteBrainDecisionQueue {
  schemaVersion: '1.0.0';
  generatedAt: string;
  source: 'infinite-brain-proposals';
  sourceTimestamp: string | null;
  singleLogicalQueue: true;
  executionBlocked: true;
  items: InfiniteBrainDecisionItem[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    deferred: number;
    superseded: number;
    highPriorityPending: number;
  };
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function normalizePriority(value: unknown): InfiniteBrainDecisionPriority {
  switch (value) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'low': return 'low';
    default: return 'normal';
  }
}

function normalizeRisk(value: unknown): InfiniteBrainDecisionRisk {
  switch (value) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'low': return 'low';
    default: return 'medium';
  }
}

function evidenceRefs(proposal: InfiniteBrainProposalRecord): string[] {
  const direct = stringArray(proposal.sourcePaths);
  const sourceReferences = Array.isArray(proposal.sourceReferences)
    ? proposal.sourceReferences
        .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).path : null))
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
  return [...new Set([...direct, ...sourceReferences])].slice(0, 20);
}

export function readInfiniteBrainDecisionQueue(now: Date = new Date()): InfiniteBrainDecisionQueue {
  const report = readInfiniteBrainProposalReport();
  const sourceTimestamp = typeof report?.timestamp === 'string' ? report.timestamp : null;
  const proposals = report?.proposals ?? [];

  const items = proposals.map((proposal): InfiniteBrainDecisionItem => {
    const proposalHash = computeInfiniteBrainProposalHash(proposal);
    const lastDecision = findInfiniteBrainProposalApproval(proposal.proposalId);
    const projected = projectDecisionStatus(lastDecision, proposalHash, now) as {
      status: InfiniteBrainDecisionStatus;
      pending: boolean;
      deferUntil: string | null;
    };
    return {
      decisionId: `proposal:${proposal.proposalId}`,
      proposalId: proposal.proposalId,
      proposalHash,
      category: proposal.category,
      title: text(proposal.title, 'Untitled decision'),
      summary: text(proposal.summary),
      whyNow: text(proposal.whyNow, 'Current proposal evidence requires a human authority decision.'),
      recommendedAction: text(proposal.recommendedAction, text(proposal.proposedAction, 'Review and choose approve, reject, or defer.')),
      alternatives: stringArray(proposal.alternatives),
      consequenceOfDelay: text(proposal.consequenceOfDelay, 'The proposal remains unapplied while waiting for a decision.'),
      priority: normalizePriority(proposal.priority),
      risk: normalizeRisk(proposal.riskLevel ?? proposal.risk),
      evidenceRefs: evidenceRefs(proposal),
      writesToMindIfApproved: proposal.writesToMindIfApproved === true,
      status: projected.status,
      pending: projected.pending,
      deferUntil: projected.deferUntil,
      freshnessDeadline: text(proposal.freshnessDeadline ?? proposal.reviewAfter) || null,
      sourceTimestamp,
      lastDecision: lastDecision ?? null,
    };
  });

  return {
    schemaVersion: '1.0.0',
    generatedAt: now.toISOString(),
    source: 'infinite-brain-proposals',
    sourceTimestamp,
    singleLogicalQueue: true,
    executionBlocked: true,
    items,
    counts: {
      total: items.length,
      pending: items.filter((item) => item.pending).length,
      approved: items.filter((item) => item.status === 'approved').length,
      rejected: items.filter((item) => item.status === 'rejected').length,
      deferred: items.filter((item) => item.status === 'deferred').length,
      superseded: items.filter((item) => item.status === 'superseded').length,
      highPriorityPending: items.filter((item) => item.pending && (item.priority === 'high' || item.priority === 'critical')).length,
    },
  };
}
