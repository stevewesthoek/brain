/**
 * Original capture handling after reviewed approval.
 * Defines the post-approval source policy without moving, deleting, or writing
 * capture files.
 */

import crypto from 'node:crypto';
import type { MindStewardReviewedOutcome } from './mind-steward-reviewed-outcome.js';
import type { MindStewardCaptureSourceRecord } from './mind-steward-capture-source-preservation.js';

export type MindStewardOriginalCaptureAction =
  | 'retain-in-inbox-as-source-evidence'
  | 'route-original-to-sources-after-separate-exact-path-approval'
  | 'archive-original-after-separate-exact-path-approval'
  | 'leave-rejected-capture-in-inbox';

export interface MindStewardOriginalCaptureAfterApprovalPlan {
  planId: string;
  status: 'ready' | 'blocked';
  outcomeId: string;
  capturePath: string | null;
  sourceRecordId: string | null;
  originalCaptureAction: MindStewardOriginalCaptureAction | null;
  visibleCaptureState:
    | 'approved-retained'
    | 'approved-source-routing-pending'
    | 'approved-archive-routing-pending'
    | 'rejected-left-in-inbox'
    | null;
  allowedMoveOperation: 'source-routing' | 'supersede-archive' | null;
  destinationPath: string | null;
  sourceContentSha256: string | null;
  blockers: string[];
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    overwritesCaptures: false;
    requiresSeparateExactPathApprovalForMove: boolean;
  };
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function actionForOutcome(
  outcome: MindStewardReviewedOutcome,
): Pick<MindStewardOriginalCaptureAfterApprovalPlan,
  'originalCaptureAction' | 'visibleCaptureState' | 'allowedMoveOperation' | 'destinationPath'
> {
  if (outcome.outcome === 'route-sources') {
    return {
      originalCaptureAction: 'route-original-to-sources-after-separate-exact-path-approval',
      visibleCaptureState: 'approved-source-routing-pending',
      allowedMoveOperation: 'source-routing',
      destinationPath: outcome.destinationPath,
    };
  }
  if (outcome.outcome === 'archive') {
    return {
      originalCaptureAction: 'archive-original-after-separate-exact-path-approval',
      visibleCaptureState: 'approved-archive-routing-pending',
      allowedMoveOperation: 'supersede-archive',
      destinationPath: outcome.destinationPath,
    };
  }
  if (outcome.outcome === 'reject-leave-in-inbox') {
    return {
      originalCaptureAction: 'leave-rejected-capture-in-inbox',
      visibleCaptureState: 'rejected-left-in-inbox',
      allowedMoveOperation: null,
      destinationPath: null,
    };
  }
  return {
    originalCaptureAction: 'retain-in-inbox-as-source-evidence',
    visibleCaptureState: 'approved-retained',
    allowedMoveOperation: null,
    destinationPath: outcome.destinationPath,
  };
}

export function createOriginalCaptureAfterApprovalPlan(
  outcome: MindStewardReviewedOutcome,
  sourceRecord: MindStewardCaptureSourceRecord | null,
): MindStewardOriginalCaptureAfterApprovalPlan {
  const blockers: string[] = [];
  if (outcome.status !== 'ready') blockers.push('reviewedOutcomeMustBeReady');
  if (!outcome.capturePath) blockers.push('capturePathRequired');
  if (!outcome.sourceRecordId) blockers.push('sourceRecordRequired');
  if (!sourceRecord) {
    blockers.push('sourceRecordRequired');
  } else {
    if (sourceRecord.recordId !== outcome.sourceRecordId) blockers.push('sourceRecordIdMismatch');
    if (sourceRecord.status !== 'preserved') blockers.push('sourceRecordMustBePreserved');
    if (sourceRecord.originalCapture.path !== outcome.capturePath) blockers.push('sourceRecordCapturePathMismatch');
    if (!sourceRecord.originalCapture.contentSha256) blockers.push('sourceContentHashRequired');
  }
  if ((outcome.outcome === 'route-sources' || outcome.outcome === 'archive') && !outcome.destinationPath) {
    blockers.push('destinationPathRequiredForCaptureMovePlan');
  }

  const planned = blockers.length === 0
    ? actionForOutcome(outcome)
    : {
      originalCaptureAction: null,
      visibleCaptureState: null,
      allowedMoveOperation: null,
      destinationPath: outcome.destinationPath,
    };

  return {
    planId: `original-capture-after-approval-${sha256(JSON.stringify({
      outcomeId: outcome.outcomeId,
      capturePath: outcome.capturePath,
      destinationPath: outcome.destinationPath,
      blockers,
    })).slice(0, 16)}`,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    outcomeId: outcome.outcomeId,
    capturePath: outcome.capturePath,
    sourceRecordId: outcome.sourceRecordId,
    originalCaptureAction: planned.originalCaptureAction,
    visibleCaptureState: planned.visibleCaptureState,
    allowedMoveOperation: planned.allowedMoveOperation,
    destinationPath: planned.destinationPath,
    sourceContentSha256: blockers.length === 0 ? sourceRecord?.originalCapture.contentSha256 ?? null : null,
    blockers,
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      overwritesCaptures: false,
      requiresSeparateExactPathApprovalForMove: planned.allowedMoveOperation !== null,
    },
  };
}
