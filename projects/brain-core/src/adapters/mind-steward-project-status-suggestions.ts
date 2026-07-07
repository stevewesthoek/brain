/**
 * Mind Steward project status review suggestions.
 * Produces read-only review suggestions for live project pages whose status
 * metadata is due or stale.
 */

import crypto from 'node:crypto';
import {
  MIND_PROJECT_PAGE_PREFIXES,
  normalizeExactMindMarkdownPathForPrefixes,
} from '../mind-paths.js';

export interface MindStewardProjectStatusFile {
  path: string;
  content: string;
}

export interface MindStewardProjectStatusReviewSuggestion {
  suggestionId: string;
  projectPath: string;
  currentStatus: string | null;
  lastReviewed: string | null;
  reviewAfter: string | null;
  reason: 'review-after-due' | 'last-reviewed-stale' | 'missing-status';
  evidence: string[];
  recommendation: 'review-and-confirm-current';
  requiresApproval: true;
}

export interface MindStewardProjectStatusReviewReport {
  status: 'ready' | 'blocked';
  reportDate: string;
  suggestions: MindStewardProjectStatusReviewSuggestion[];
  blockers: string[];
  safety: {
    writesToMind: false;
    writesLiveProjects: false;
    writesKanban: false;
    movesFiles: false;
    suggestionOnly: true;
  };
}

interface ParsedMetadata {
  status: string | null;
  lastReviewed: string | null;
  reviewAfter: string | null;
}

export interface GenerateProjectStatusReviewSuggestionsOptions {
  files: MindStewardProjectStatusFile[];
  reportDate: string;
  staleAfterDays?: number;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000);
}

function isSafeProjectPath(value: string): boolean {
  return normalizeExactMindMarkdownPathForPrefixes(value, MIND_PROJECT_PAGE_PREFIXES) !== null;
}

function parseMetadata(content: string): ParsedMetadata {
  const metadata: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  const startsWithFrontmatter = lines[0]?.trim() === '---';
  let frontmatterClosed = !startsWithFrontmatter;
  for (let index = startsWithFrontmatter ? 1 : 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    if (startsWithFrontmatter && !frontmatterClosed && line.trim() === '---') {
      frontmatterClosed = true;
      continue;
    }
    if (startsWithFrontmatter && frontmatterClosed) break;
    if (!startsWithFrontmatter && index > 40) break;
    const match = line.match(/^\s*([A-Za-z][A-Za-z _-]*):\s*(.*?)\s*$/);
    if (!match) continue;
    metadata[(match[1] ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')] = (match[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
  }
  return {
    status: metadata.status ?? metadata.project_status ?? null,
    lastReviewed: metadata.last_reviewed ?? null,
    reviewAfter: metadata.review_after ?? null,
  };
}

function createSuggestion(
  file: MindStewardProjectStatusFile,
  reportDate: string,
  metadata: ParsedMetadata,
  reason: MindStewardProjectStatusReviewSuggestion['reason'],
  evidence: string[],
): MindStewardProjectStatusReviewSuggestion {
  return {
    suggestionId: `project-status-review-${sha256(JSON.stringify({
      path: file.path,
      reportDate,
      reason,
      evidence,
    })).slice(0, 16)}`,
    projectPath: file.path,
    currentStatus: metadata.status,
    lastReviewed: metadata.lastReviewed,
    reviewAfter: metadata.reviewAfter,
    reason,
    evidence,
    recommendation: 'review-and-confirm-current',
    requiresApproval: true,
  };
}

export function generateProjectStatusReviewSuggestions(
  options: GenerateProjectStatusReviewSuggestionsOptions,
): MindStewardProjectStatusReviewReport {
  const blockers: string[] = [];
  if (!isIsoDate(options.reportDate)) blockers.push('validIsoReportDateRequired');
  const staleAfterDays = options.staleAfterDays ?? 30;
  if (!Number.isFinite(staleAfterDays) || staleAfterDays < 1) blockers.push('validStaleAfterDaysRequired');
  if (blockers.length > 0) {
    return {
      status: 'blocked',
      reportDate: options.reportDate,
      suggestions: [],
      blockers,
      safety: {
        writesToMind: false,
        writesLiveProjects: false,
        writesKanban: false,
        movesFiles: false,
        suggestionOnly: true,
      },
    };
  }

  const suggestions: MindStewardProjectStatusReviewSuggestion[] = [];
  for (const file of options.files) {
    if (!isSafeProjectPath(file.path)) continue;
    const metadata = parseMetadata(file.content);
    if (!metadata.status) {
      suggestions.push(createSuggestion(file, options.reportDate, metadata, 'missing-status', [
        'Project page has no status/project_status metadata.',
      ]));
      continue;
    }
    if (metadata.reviewAfter && isIsoDate(metadata.reviewAfter) && metadata.reviewAfter <= options.reportDate) {
      suggestions.push(createSuggestion(file, options.reportDate, metadata, 'review-after-due', [
        `review_after ${metadata.reviewAfter} is due by report date ${options.reportDate}.`,
      ]));
      continue;
    }
    if (metadata.lastReviewed && isIsoDate(metadata.lastReviewed) && daysBetween(metadata.lastReviewed, options.reportDate) > staleAfterDays) {
      suggestions.push(createSuggestion(file, options.reportDate, metadata, 'last-reviewed-stale', [
        `last_reviewed ${metadata.lastReviewed} is older than ${staleAfterDays} days.`,
      ]));
    }
  }

  return {
    status: 'ready',
    reportDate: options.reportDate,
    suggestions,
    blockers: [],
    safety: {
      writesToMind: false,
      writesLiveProjects: false,
      writesKanban: false,
      movesFiles: false,
      suggestionOnly: true,
    },
  };
}
