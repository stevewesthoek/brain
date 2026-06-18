/**
 * Mind Steward completed project archive suggestions.
 * Suggests exact archive destinations for completed project pages without
 * moving files or updating active navigation.
 */

import crypto from 'node:crypto';
import path from 'node:path';

export interface MindStewardCompletedProjectFile {
  path: string;
  content: string;
}

export interface MindStewardCompletedProjectArchiveSuggestion {
  suggestionId: string;
  status: 'ready' | 'blocked';
  activePath: string;
  proposedArchivePath: string | null;
  completionEvidence: string[];
  affectedSurface: 'live/projects';
  recommendation: 'archive-after-approval';
  requiresApproval: true;
  blockers: string[];
}

export interface MindStewardCompletedProjectArchiveReport {
  status: 'ready' | 'blocked';
  reportDate: string;
  suggestions: MindStewardCompletedProjectArchiveSuggestion[];
  blockers: string[];
  safety: {
    writesToMind: false;
    writesLiveProjects: false;
    writesArchive: false;
    movesFiles: false;
    deletesFiles: false;
    suggestionOnly: true;
  };
}

export interface GenerateCompletedProjectArchiveSuggestionsOptions {
  files: MindStewardCompletedProjectFile[];
  reportDate: string;
}

interface ParsedMetadataValue {
  key: string;
  value: string;
}

const ACTIVE_VALUES = new Set(['active', 'current', 'in-progress', 'in_progress', 'in progress', 'ongoing']);
const COMPLETED_VALUES = new Set(['complete', 'completed', 'done', 'closed', 'archived', 'superseded', 'replaced']);

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

function parseMetadata(content: string): ParsedMetadataValue[] {
  const lines = content.split(/\r?\n/);
  const startsWithFrontmatter = lines[0]?.trim() === '---';
  const values: ParsedMetadataValue[] = [];
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
    const match = /^\s*([A-Za-z][A-Za-z _-]*):\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const key = normalizeKey(match[1] ?? '');
    const value = normalizeValue(match[2] ?? '');
    if (key && value) values.push({ key, value });
  }
  return values;
}

function isTruthy(value: string): boolean {
  return ['true', 'yes', '1'].includes(value);
}

function isSafeProjectPath(value: string): boolean {
  const normalized = path.posix.normalize(value);
  return normalized === value
    && normalized.startsWith('live/projects/')
    && normalized.length > 'live/projects/'.length
    && normalized.endsWith('.md')
    && !normalized.includes('*')
    && !normalized.includes('?')
    && !path.posix.isAbsolute(normalized);
}

function isSafeArchivePath(value: string): boolean {
  const normalized = path.posix.normalize(value);
  return normalized === value
    && normalized.startsWith('archive/projects/')
    && normalized.length > 'archive/projects/'.length
    && normalized.endsWith('.md')
    && !normalized.includes('*')
    && !normalized.includes('?')
    && !path.posix.isAbsolute(normalized);
}

function isActive(metadata: ParsedMetadataValue[]): boolean {
  return metadata.some(entry => ['status', 'project_status', 'state'].includes(entry.key) && ACTIVE_VALUES.has(entry.value));
}

function completionEvidence(metadata: ParsedMetadataValue[]): string[] {
  return metadata.flatMap(entry => {
    if (['completion_status', 'final_status', 'resolution_status'].includes(entry.key) && COMPLETED_VALUES.has(entry.value)) {
      return [`${entry.key} is ${entry.value}`];
    }
    if (['completed', 'completed_on', 'completed_at', 'closed_on', 'archived_on'].includes(entry.key)
      && (isIsoDate(entry.value) || isTruthy(entry.value))) {
      return [`${entry.key} records ${entry.value}`];
    }
    if (['superseded_by', 'replaced_by'].includes(entry.key) && entry.value.length > 0) {
      return [`${entry.key} identifies ${entry.value}`];
    }
    return [];
  });
}

function explicitArchivePath(metadata: ParsedMetadataValue[]): string | null {
  return metadata.find(entry => entry.key === 'archive_path')?.value ?? null;
}

function defaultArchivePath(activePath: string): string {
  return `archive/projects/${activePath.slice('live/projects/'.length)}`;
}

function createSuggestion(
  file: MindStewardCompletedProjectFile,
  reportDate: string,
  proposedArchivePath: string | null,
  evidence: string[],
): MindStewardCompletedProjectArchiveSuggestion {
  const blockers = proposedArchivePath && isSafeArchivePath(proposedArchivePath)
    ? []
    : ['invalidArchiveDestination'];
  return {
    suggestionId: `completed-project-archive-${sha256(JSON.stringify({
      activePath: file.path,
      proposedArchivePath,
      reportDate,
      evidence,
    })).slice(0, 16)}`,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    activePath: file.path,
    proposedArchivePath,
    completionEvidence: evidence,
    affectedSurface: 'live/projects',
    recommendation: 'archive-after-approval',
    requiresApproval: true,
    blockers,
  };
}

export function generateCompletedProjectArchiveSuggestions(
  options: GenerateCompletedProjectArchiveSuggestionsOptions,
): MindStewardCompletedProjectArchiveReport {
  const blockers: string[] = [];
  if (!isIsoDate(options.reportDate)) blockers.push('validIsoReportDateRequired');
  if (blockers.length > 0) {
    return {
      status: 'blocked',
      reportDate: options.reportDate,
      suggestions: [],
      blockers,
      safety: {
        writesToMind: false,
        writesLiveProjects: false,
        writesArchive: false,
        movesFiles: false,
        deletesFiles: false,
        suggestionOnly: true,
      },
    };
  }

  const suggestions: MindStewardCompletedProjectArchiveSuggestion[] = [];
  for (const file of options.files) {
    if (!isSafeProjectPath(file.path)) continue;
    const metadata = parseMetadata(file.content);
    if (!isActive(metadata)) continue;
    const evidence = completionEvidence(metadata);
    if (evidence.length === 0) continue;
    suggestions.push(createSuggestion(
      file,
      options.reportDate,
      explicitArchivePath(metadata) ?? defaultArchivePath(file.path),
      evidence,
    ));
  }

  return {
    status: 'ready',
    reportDate: options.reportDate,
    suggestions,
    blockers: [],
    safety: {
      writesToMind: false,
      writesLiveProjects: false,
      writesArchive: false,
      movesFiles: false,
      deletesFiles: false,
      suggestionOnly: true,
    },
  };
}
