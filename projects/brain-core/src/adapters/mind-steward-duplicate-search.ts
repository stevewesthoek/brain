/**
 * Mind Steward duplicate search gate.
 * Read-only duplicate search for capture classifications before any durable
 * page proposal is allowed.
 */

import fs, { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { NormalizedCaptureClassification } from './mind-steward-capture-classification.js';

export interface MindStewardDuplicateSearchCandidate {
  path: string;
  score: number;
  reason: string;
}

export interface MindStewardDuplicateSearchResult {
  searchId: string;
  searchedAt: string;
  classificationId: string;
  capturePath: string | null;
  query: string;
  searchedRoots: string[];
  candidates: MindStewardDuplicateSearchCandidate[];
  matched: boolean;
  summary: string;
  safety: {
    readOnly: true;
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
  };
}

export interface MindStewardDurableProposalGate {
  status: 'ready' | 'blocked';
  canProposeDurablePage: boolean;
  classificationId: string;
  duplicateSearchRequired: true;
  duplicateSearch: MindStewardDuplicateSearchResult | null;
  blockers: string[];
  safety: {
    writesToMind: false;
    createsDurablePage: false;
    proposalOnly: true;
  };
}

export interface RunMindStewardDuplicateSearchOptions {
  mindRoot: string;
  classification: NormalizedCaptureClassification;
  now?: Date;
  searchedRoots?: string[];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeTokens(value: string): Set<string> {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'capture']);
  return new Set(value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !stop.has(token)));
}

function collectQuery(classification: NormalizedCaptureClassification): string {
  const evidence = classification.evidence
    .map(item => item.value)
    .join('\n');
  return [
    classification.captureName,
    classification.proposedSummary ?? '',
    evidence.slice(0, 1000),
  ].join('\n').trim();
}

function resolveRoot(mindRoot: string): string | null {
  try {
    const root = realpathSync(mindRoot);
    return fs.statSync(root).isDirectory() ? root : null;
  } catch {
    return null;
  }
}

function isSafeMarkdownFile(root: string, candidate: string): boolean {
  try {
    const stat = lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink() || !candidate.endsWith('.md')) return false;
    const resolved = realpathSync(candidate);
    const relative = path.relative(root, resolved);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function normalizeSearchedRoot(searchRoot: string): string | null {
  const normalized = path.normalize(searchRoot).replace(/\\/g, '/');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized === '..' || path.isAbsolute(normalized)) {
    return null;
  }
  return normalized;
}

function walkMarkdown(root: string, dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(root, absolute, files);
    } else if (entry.isFile() && isSafeMarkdownFile(root, absolute)) {
      files.push(absolute);
    }
  }
}

function scoreDocument(queryTokens: Set<string>, relativePath: string, content: string): MindStewardDuplicateSearchCandidate | null {
  const documentTokens = normalizeTokens(`${relativePath}\n${content.slice(0, 4000)}`);
  const overlap = [...queryTokens].filter(token => documentTokens.has(token));
  if (overlap.length === 0) return null;
  const score = overlap.length / Math.max(1, queryTokens.size);
  if (score < 0.2 && overlap.length < 2) return null;
  return {
    path: relativePath,
    score: Number(score.toFixed(3)),
    reason: `Shared terms: ${overlap.slice(0, 8).join(', ')}`,
  };
}

export function runMindStewardDuplicateSearch(
  options: RunMindStewardDuplicateSearchOptions,
): MindStewardDuplicateSearchResult {
  const now = options.now ?? new Date();
  const searchedRoots = (options.searchedRoots ?? ['live', 'wiki', 'sources'])
    .map(normalizeSearchedRoot)
    .filter((searchRoot): searchRoot is string => Boolean(searchRoot));
  const root = resolveRoot(options.mindRoot);
  const query = collectQuery(options.classification);
  const queryTokens = normalizeTokens(query);
  const candidates: MindStewardDuplicateSearchCandidate[] = [];

  if (root && queryTokens.size > 0) {
    const files: string[] = [];
    for (const searchRoot of searchedRoots) {
      walkMarkdown(root, path.join(root, searchRoot), files);
    }
    for (const filePath of files) {
      const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
      const scored = scoreDocument(queryTokens, relativePath, fs.readFileSync(filePath, 'utf8'));
      if (scored) candidates.push(scored);
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const limited = candidates.slice(0, 5);
  const matched = limited.length > 0;

  return {
    searchId: `duplicate-search-${sha256(JSON.stringify({
      classificationId: options.classification.classificationId,
      query,
      searchedRoots,
      at: now.toISOString(),
    })).slice(0, 16)}`,
    searchedAt: now.toISOString(),
    classificationId: options.classification.classificationId,
    capturePath: options.classification.capturePath,
    query,
    searchedRoots,
    candidates: limited,
    matched,
    summary: matched
      ? `Possible durable duplicate or update target found: ${limited[0]?.path}.`
      : 'No candidate durable duplicate found in searched roots.',
    safety: {
      readOnly: true,
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
    },
  };
}

export function createDurablePageProposalGate(
  classification: NormalizedCaptureClassification,
  duplicateSearch: MindStewardDuplicateSearchResult | null,
): MindStewardDurableProposalGate {
  const blockers: string[] = [];
  if (!duplicateSearch) {
    blockers.push('duplicateSearchRequired');
  } else {
    if (duplicateSearch.classificationId !== classification.classificationId) {
      blockers.push('duplicateSearchClassificationMismatch');
    }
    if (duplicateSearch.capturePath !== classification.capturePath) {
      blockers.push('duplicateSearchCapturePathMismatch');
    }
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    canProposeDurablePage: blockers.length === 0,
    classificationId: classification.classificationId,
    duplicateSearchRequired: true,
    duplicateSearch,
    blockers,
    safety: {
      writesToMind: false,
      createsDurablePage: false,
      proposalOnly: true,
    },
  };
}
