/**
 * Mind Steward reviewed capture outcomes.
 * Represents approved-for-review outcome intent without executing writes,
 * moving captures, or mutating Kanban.
 */

import crypto from 'node:crypto';
import type { NormalizedCaptureClassification } from './mind-steward-capture-classification.js';
import type { MindStewardCaptureSourceRecord } from './mind-steward-capture-source-preservation.js';
import type { MindStewardDestinationProposal, MindStewardDestinationKind } from './mind-steward-destination-proposal.js';

export type MindStewardReviewedOutcomeType =
  | 'promote-live'
  | 'compile-wiki'
  | 'route-sources'
  | 'create-task-proposal'
  | 'archive'
  | 'reject-leave-in-inbox';

export interface MindStewardReviewedOutcomeReview {
  reviewedBy: string;
  reviewedAt: string;
  reason: string;
}

export interface MindStewardTaskProposalDraft {
  title: string;
  summary: string;
}

export interface MindStewardReviewedOutcome {
  outcomeId: string;
  status: 'ready' | 'blocked';
  outcome: MindStewardReviewedOutcomeType;
  classificationId: string;
  capturePath: string | null;
  sourceRecordId: string | null;
  destinationPath: string | null;
  reviewSurface: 'wiki/log.md' | 'capture/inbox';
  approvedDestination: 'live' | 'wiki' | 'sources' | 'archive' | 'task-proposal' | 'inbox';
  taskProposal: MindStewardTaskProposalDraft | null;
  review: MindStewardReviewedOutcomeReview;
  sourceAfterApproval: 'not-decided-by-this-outcome-proposal' | 'leave-in-inbox';
  blockers: string[];
  safety: {
    writesToMind: false;
    writesKanban: false;
    movesCaptures: false;
    deletesCaptures: false;
    executesOutcome: false;
    requiresHumanApprovalForExecution: true;
  };
}

export interface CreateReviewedOutcomeOptions {
  classification: NormalizedCaptureClassification;
  sourceRecord: MindStewardCaptureSourceRecord | null;
  destinationProposal?: MindStewardDestinationProposal | null;
  outcome: MindStewardReviewedOutcomeType;
  review: MindStewardReviewedOutcomeReview;
  taskProposal?: MindStewardTaskProposalDraft | null;
}

const DESTINATION_KIND_BY_OUTCOME: Partial<Record<MindStewardReviewedOutcomeType, MindStewardDestinationKind>> = {
  'promote-live': 'live',
  'compile-wiki': 'wiki',
  'route-sources': 'sources',
  archive: 'archive',
};

const APPROVED_DESTINATION_BY_OUTCOME: Record<MindStewardReviewedOutcomeType, MindStewardReviewedOutcome['approvedDestination']> = {
  'promote-live': 'live',
  'compile-wiki': 'wiki',
  'route-sources': 'sources',
  'create-task-proposal': 'task-proposal',
  archive: 'archive',
  'reject-leave-in-inbox': 'inbox',
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function reviewBlockers(review: MindStewardReviewedOutcomeReview): string[] {
  const blockers: string[] = [];
  if (!nonEmpty(review.reviewedBy)) blockers.push('reviewerRequired');
  if (!nonEmpty(review.reviewedAt)) blockers.push('reviewedAtRequired');
  if (!nonEmpty(review.reason)) blockers.push('reviewReasonRequired');
  return blockers;
}

function sourceBlockers(
  classification: NormalizedCaptureClassification,
  sourceRecord: MindStewardCaptureSourceRecord | null,
): string[] {
  const blockers: string[] = [];
  if (!sourceRecord) {
    blockers.push('captureSourcePreservationRequired');
    return blockers;
  }
  if (sourceRecord.status !== 'preserved') blockers.push('captureSourceNotPreserved');
  if (sourceRecord.classificationId !== classification.classificationId) blockers.push('captureSourceClassificationMismatch');
  if (sourceRecord.originalCapture.path !== classification.capturePath) blockers.push('captureSourcePathMismatch');
  if (!sourceRecord.originalCapture.contentSha256) blockers.push('captureSourceHashMissing');
  return blockers;
}

function destinationBlockers(
  outcome: MindStewardReviewedOutcomeType,
  destinationProposal: MindStewardDestinationProposal | null | undefined,
): string[] {
  const expectedKind = DESTINATION_KIND_BY_OUTCOME[outcome];
  if (!expectedKind) return [];
  const blockers: string[] = [];
  if (!destinationProposal) {
    blockers.push('destinationProposalRequired');
    return blockers;
  }
  if (destinationProposal.status !== 'ready') blockers.push('destinationProposalNotReady');
  if (!destinationProposal.selectedDestination) {
    blockers.push('selectedDestinationRequired');
    return blockers;
  }
  if (destinationProposal.selectedDestination.kind !== expectedKind) {
    blockers.push('destinationKindMismatch');
  }
  return blockers;
}

function taskProposalBlockers(
  outcome: MindStewardReviewedOutcomeType,
  taskProposal: MindStewardTaskProposalDraft | null | undefined,
): string[] {
  if (outcome !== 'create-task-proposal') return [];
  const blockers: string[] = [];
  if (!taskProposal) {
    blockers.push('taskProposalRequired');
    return blockers;
  }
  if (!nonEmpty(taskProposal.title)) blockers.push('taskProposalTitleRequired');
  if (!nonEmpty(taskProposal.summary)) blockers.push('taskProposalSummaryRequired');
  return blockers;
}

export function createReviewedCaptureOutcome(
  options: CreateReviewedOutcomeOptions,
): MindStewardReviewedOutcome {
  const destinationKind = DESTINATION_KIND_BY_OUTCOME[options.outcome];
  const destinationPath = destinationKind && options.destinationProposal?.status === 'ready'
    ? options.destinationProposal.selectedDestination?.destinationPath ?? null
    : null;
  const blockers = [
    ...sourceBlockers(options.classification, options.sourceRecord),
    ...reviewBlockers(options.review),
    ...destinationBlockers(options.outcome, options.destinationProposal),
    ...taskProposalBlockers(options.outcome, options.taskProposal),
  ];

  return {
    outcomeId: `capture-outcome-${sha256(JSON.stringify({
      outcome: options.outcome,
      classificationId: options.classification.classificationId,
      capturePath: options.classification.capturePath,
      destinationPath,
      reviewedBy: options.review.reviewedBy,
      reviewedAt: options.review.reviewedAt,
    })).slice(0, 16)}`,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    outcome: options.outcome,
    classificationId: options.classification.classificationId,
    capturePath: options.classification.capturePath,
    sourceRecordId: options.sourceRecord?.recordId ?? null,
    destinationPath,
    reviewSurface: options.outcome === 'reject-leave-in-inbox' ? 'capture/inbox' : 'wiki/log.md',
    approvedDestination: APPROVED_DESTINATION_BY_OUTCOME[options.outcome],
    taskProposal: options.outcome === 'create-task-proposal' ? options.taskProposal ?? null : null,
    review: options.review,
    sourceAfterApproval: options.outcome === 'reject-leave-in-inbox'
      ? 'leave-in-inbox'
      : 'not-decided-by-this-outcome-proposal',
    blockers,
    safety: {
      writesToMind: false,
      writesKanban: false,
      movesCaptures: false,
      deletesCaptures: false,
      executesOutcome: false,
      requiresHumanApprovalForExecution: true,
    },
  };
}
