/**
 * Mind Steward single-destination proposal gate.
 * Chooses one reviewable destination only when the evidence is clear; otherwise
 * it blocks as material ambiguity without writing or executing outcomes.
 */

import path from 'node:path';
import crypto from 'node:crypto';
import type { NormalizedCaptureClassification } from './mind-steward-capture-classification.js';
import type { MindStewardDuplicateSearchResult } from './mind-steward-duplicate-search.js';
import type { MindStewardCaptureSourceRecord } from './mind-steward-capture-source-preservation.js';

export type MindStewardDestinationKind = 'live' | 'wiki' | 'sources' | 'archive';

export interface MindStewardDestinationCandidate {
  kind: MindStewardDestinationKind;
  destinationPath: string;
  confidence: number;
  rationale: string;
  evidence: string[];
}

export interface MindStewardSelectedDestination {
  kind: MindStewardDestinationKind;
  destinationPath: string;
  confidence: number;
  rationale: string;
  evidence: string[];
}

export interface MindStewardDestinationProposal {
  proposalId: string;
  status: 'ready' | 'blocked' | 'ambiguous';
  classificationId: string;
  capturePath: string | null;
  sourceRecordId: string | null;
  duplicateSearchId: string | null;
  selectedDestination: MindStewardSelectedDestination | null;
  materialAmbiguity: boolean;
  ambiguousCandidates: MindStewardDestinationCandidate[];
  blockers: string[];
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    executesOutcome: false;
    proposalOnly: true;
  };
}

export interface CreateDestinationProposalOptions {
  classification: NormalizedCaptureClassification;
  sourceRecord: MindStewardCaptureSourceRecord | null;
  duplicateSearch: MindStewardDuplicateSearchResult | null;
  candidates?: MindStewardDestinationCandidate[];
  ambiguityDelta?: number;
}

const KIND_PREFIXES: Record<MindStewardDestinationKind, string> = {
  live: 'live/',
  wiki: 'wiki/',
  sources: 'sources/',
  archive: 'archive/',
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeDestinationPath(kind: MindStewardDestinationKind, destinationPath: string): string | null {
  const normalized = path.posix.normalize(destinationPath);
  const prefix = KIND_PREFIXES[kind];
  if (normalized !== destinationPath) return null;
  if (!normalized.startsWith(prefix) || normalized.length <= prefix.length) return null;
  if (!normalized.endsWith('.md')) return null;
  if (normalized.includes('\0') || normalized.includes('*') || normalized.includes('?') || normalized.includes('[') || normalized.includes(']')) return null;
  if (normalized.endsWith('/')) return null;
  if (path.posix.isAbsolute(normalized)) return null;
  return normalized;
}

function normalizeConfidence(value: number): number | null {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? Number(value.toFixed(3)) : null;
}

function candidateKey(candidate: MindStewardDestinationCandidate): string {
  return `${candidate.kind}:${candidate.destinationPath}`;
}

function normalizeCandidate(candidate: MindStewardDestinationCandidate): MindStewardDestinationCandidate | null {
  const destinationPath = normalizeDestinationPath(candidate.kind, candidate.destinationPath);
  const confidence = normalizeConfidence(candidate.confidence);
  if (!destinationPath || confidence === null || candidate.rationale.trim().length === 0) return null;
  return {
    kind: candidate.kind,
    destinationPath,
    confidence,
    rationale: candidate.rationale,
    evidence: candidate.evidence.filter(item => item.trim().length > 0),
  };
}

function candidatesFromDuplicateSearch(duplicateSearch: MindStewardDuplicateSearchResult | null): MindStewardDestinationCandidate[] {
  if (!duplicateSearch?.matched) return [];
  return duplicateSearch.candidates
    .filter(candidate => candidate.path.startsWith('live/')
      || candidate.path.startsWith('wiki/')
      || candidate.path.startsWith('sources/')
      || candidate.path.startsWith('archive/'))
    .map(candidate => {
      const kind = candidate.path.split('/')[0] as MindStewardDestinationKind;
      return {
        kind,
        destinationPath: candidate.path,
        confidence: Math.min(1, candidate.score),
        rationale: 'Update existing durable page found by duplicate search.',
        evidence: [candidate.reason],
      };
    });
}

function dedupeAndSortCandidates(candidates: MindStewardDestinationCandidate[]): MindStewardDestinationCandidate[] {
  const byKey = new Map<string, MindStewardDestinationCandidate>();
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) continue;
    const existing = byKey.get(candidateKey(normalized));
    if (!existing || normalized.confidence > existing.confidence) {
      byKey.set(candidateKey(normalized), normalized);
    }
  }
  return [...byKey.values()].sort((a, b) => b.confidence - a.confidence || a.destinationPath.localeCompare(b.destinationPath));
}

function priorEvidenceBlockers(
  classification: NormalizedCaptureClassification,
  sourceRecord: MindStewardCaptureSourceRecord | null,
  duplicateSearch: MindStewardDuplicateSearchResult | null,
): string[] {
  const blockers: string[] = [];
  if (classification.status !== 'ready-for-review') blockers.push('classificationNotReadyForReview');
  if (!sourceRecord) {
    blockers.push('captureSourcePreservationRequired');
  } else {
    if (sourceRecord.status !== 'preserved') blockers.push('captureSourceNotPreserved');
    if (sourceRecord.classificationId !== classification.classificationId) blockers.push('captureSourceClassificationMismatch');
    if (sourceRecord.originalCapture.path !== classification.capturePath) blockers.push('captureSourcePathMismatch');
    if (!sourceRecord.originalCapture.contentSha256) blockers.push('captureSourceHashMissing');
  }
  if (!duplicateSearch) {
    blockers.push('duplicateSearchRequired');
  } else {
    if (duplicateSearch.classificationId !== classification.classificationId) blockers.push('duplicateSearchClassificationMismatch');
    if (duplicateSearch.capturePath !== classification.capturePath) blockers.push('duplicateSearchCapturePathMismatch');
  }
  return blockers;
}

export function createSingleDestinationProposal(
  options: CreateDestinationProposalOptions,
): MindStewardDestinationProposal {
  const ambiguityDelta = options.ambiguityDelta ?? 0.1;
  const priorBlockers = priorEvidenceBlockers(options.classification, options.sourceRecord, options.duplicateSearch);
  const candidates = dedupeAndSortCandidates([
    ...(options.candidates ?? []),
    ...candidatesFromDuplicateSearch(options.duplicateSearch),
  ]);

  const blockers = [...priorBlockers];
  if (candidates.length === 0) blockers.push('destinationCandidateRequired');

  const top = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const materialAmbiguity = Boolean(top && second && top.confidence - second.confidence <= ambiguityDelta);
  if (materialAmbiguity) blockers.push('materialDestinationAmbiguity');

  const selectedDestination = blockers.length === 0 && top
    ? {
      kind: top.kind,
      destinationPath: top.destinationPath,
      confidence: top.confidence,
      rationale: top.rationale,
      evidence: top.evidence,
    }
    : null;

  const status = materialAmbiguity
    ? 'ambiguous'
    : blockers.length === 0
      ? 'ready'
      : 'blocked';

  return {
    proposalId: `capture-destination-${sha256(JSON.stringify({
      classificationId: options.classification.classificationId,
      capturePath: options.classification.capturePath,
      selectedDestination,
      blockers,
    })).slice(0, 16)}`,
    status,
    classificationId: options.classification.classificationId,
    capturePath: options.classification.capturePath,
    sourceRecordId: options.sourceRecord?.recordId ?? null,
    duplicateSearchId: options.duplicateSearch?.searchId ?? null,
    selectedDestination,
    materialAmbiguity,
    ambiguousCandidates: materialAmbiguity ? candidates : [],
    blockers,
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      executesOutcome: false,
      proposalOnly: true,
    },
  };
}
