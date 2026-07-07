/**
 * Mind Steward task proposal-only gate.
 * Keeps generated tasks as reviewable proposals and prevents Kanban mutation
 * until lossless task sync and explicit approval are implemented.
 */

import crypto from 'node:crypto';
import {
  MIND_REVIEW_SURFACE_CANDIDATES,
  MIND_TARGET_PATHS,
  MIND_TASK_FILE_CANDIDATES,
  isMindDecisionSourcePath,
  isSafeMindInboxCapturePath,
} from '../mind-paths.js';
import type { MindStewardReviewedOutcome } from './mind-steward-reviewed-outcome.js';

export interface MindStewardTaskProposalSourceLink {
  type: 'capture' | 'decision';
  path: string;
  summary: string;
}

export interface MindStewardTaskProposalOnlyRecord {
  proposalId: string;
  status: 'ready' | 'blocked';
  outcomeId: string;
  capturePath: string | null;
  title: string | null;
  summary: string | null;
  sourceLinks: MindStewardTaskProposalSourceLink[];
  reviewSurface: typeof MIND_REVIEW_SURFACE_CANDIDATES[number];
  protectedKanbanPath: typeof MIND_TASK_FILE_CANDIDATES[number];
  proposalOnly: true;
  executionAllowed: false;
  blockers: string[];
  safety: {
    writesToMind: false;
    writesKanban: false;
    createsTaskRecord: false;
    mutatesExistingTask: false;
    requiresLosslessSyncBeforeWrite: true;
    requiresExplicitApprovalBeforeWrite: true;
  };
}

export interface CreateTaskProposalOnlyRecordOptions {
  outcome: MindStewardReviewedOutcome;
  sourceLinks?: MindStewardTaskProposalSourceLink[];
  requestKanbanWrite?: boolean;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSafeCaptureSource(path: string): boolean {
  return isSafeMindInboxCapturePath(path) && path.endsWith('.md');
}

function isSafeDecisionSource(path: string): boolean {
  return isMindDecisionSourcePath(path);
}

function normalizeSourceLinks(
  outcome: MindStewardReviewedOutcome,
  sourceLinks: MindStewardTaskProposalSourceLink[] | undefined,
): { links: MindStewardTaskProposalSourceLink[]; blockers: string[] } {
  const blockers: string[] = [];
  const links: MindStewardTaskProposalSourceLink[] = [];
  if (outcome.capturePath) {
    links.push({
      type: 'capture',
      path: outcome.capturePath,
      summary: 'Source capture for task proposal.',
    });
  }
  for (const link of sourceLinks ?? []) {
    const summary = link.summary.trim();
    const validPath = link.type === 'capture'
      ? isSafeCaptureSource(link.path)
      : isSafeDecisionSource(link.path);
    if (!validPath) {
      blockers.push(`invalidTaskSourceLink:${link.path}`);
      continue;
    }
    if (!summary) {
      blockers.push(`taskSourceLinkSummaryRequired:${link.path}`);
      continue;
    }
    links.push({ type: link.type, path: link.path, summary });
  }
  const deduped = [...new Map(links.map(link => [`${link.type}:${link.path}`, link])).values()];
  if (deduped.length === 0) blockers.push('taskSourceLinkRequired');
  return { links: deduped, blockers };
}

export function createTaskProposalOnlyRecord(
  options: CreateTaskProposalOnlyRecordOptions,
): MindStewardTaskProposalOnlyRecord {
  const blockers: string[] = [];
  const sourceLinkResult = normalizeSourceLinks(options.outcome, options.sourceLinks);
  if (options.outcome.status !== 'ready') blockers.push('reviewedTaskOutcomeMustBeReady');
  if (options.outcome.outcome !== 'create-task-proposal') blockers.push('createTaskProposalOutcomeRequired');
  if (!options.outcome.taskProposal) blockers.push('taskProposalDraftRequired');
  if (options.requestKanbanWrite) blockers.push('kanbanWritesDisabledUntilLosslessSync');
  blockers.push(...sourceLinkResult.blockers);

  const title = options.outcome.taskProposal?.title ?? null;
  const summary = options.outcome.taskProposal?.summary ?? null;

  return {
    proposalId: `task-proposal-only-${sha256(JSON.stringify({
      outcomeId: options.outcome.outcomeId,
      capturePath: options.outcome.capturePath,
      title,
      summary,
      sourceLinks: sourceLinkResult.links,
      blockers,
    })).slice(0, 16)}`,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    outcomeId: options.outcome.outcomeId,
    capturePath: options.outcome.capturePath,
    title,
    summary,
    sourceLinks: sourceLinkResult.links,
    reviewSurface: MIND_TARGET_PATHS.inboxProcessed,
    protectedKanbanPath: MIND_TARGET_PATHS.tasks,
    proposalOnly: true,
    executionAllowed: false,
    blockers,
    safety: {
      writesToMind: false,
      writesKanban: false,
      createsTaskRecord: false,
      mutatesExistingTask: false,
      requiresLosslessSyncBeforeWrite: true,
      requiresExplicitApprovalBeforeWrite: true,
    },
  };
}
