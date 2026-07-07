import type { LoadedMindMaintenancePilotFile } from './pilot-file-loader.js';
import type { MaintenanceFinding, MaintenanceRisk } from './types.js';

export const sourceGapClaimKinds = [
  'external-factual',
  'strategic-choice',
  'personal-belief',
  'product-principle',
  'creative-language',
  'self-authored-definition',
  'ambiguous',
] as const;

export type SourceGapClaimKind = (typeof sourceGapClaimKinds)[number];

export const sourceGapImpactLevels = ['low', 'medium', 'high'] as const;
export type SourceGapImpact = (typeof sourceGapImpactLevels)[number];

export interface SourceGapCandidate {
  path: LoadedMindMaintenancePilotFile['path'];
  location: string;
  claim: string;
  kind: SourceGapClaimKind;
  impact: SourceGapImpact;
  presentedAsCurrentTruth: boolean;
  provenance: string[];
}

export interface SourceGapDetectionInput {
  file: LoadedMindMaintenancePilotFile;
  reportDate: string;
  candidates: readonly SourceGapCandidate[];
}

export interface SourceGapDetectionResult {
  findings: MaintenanceFinding[];
  ambiguousCandidates: SourceGapCandidate[];
  excludedCandidates: SourceGapCandidate[];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function hasUsableProvenance(candidate: SourceGapCandidate): boolean {
  return candidate.provenance.some((reference) => isNonEmptyString(reference));
}

function riskForCandidate(candidate: SourceGapCandidate): MaintenanceRisk {
  if (candidate.impact === 'high') return 'medium';
  return 'low';
}

function slugForFinding(candidate: SourceGapCandidate, index: number): string {
  const pathSlug = candidate.path
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const claimSlug = candidate.claim
    .slice(0, 48)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `finding-source-gap-${pathSlug}-${claimSlug || index + 1}-001`;
}

function claimFingerprint(candidate: SourceGapCandidate): string {
  return candidate.claim
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function validateCandidate(candidate: SourceGapCandidate, file: LoadedMindMaintenancePilotFile): void {
  if (candidate.path !== file.path) {
    throw new Error(
      `Source-gap candidate path must match the loaded pilot file: ${candidate.path} !== ${file.path}`,
    );
  }
  if (!isNonEmptyString(candidate.location)) {
    throw new Error('Source-gap candidate requires an exact location.');
  }
  if (!isNonEmptyString(candidate.claim)) {
    throw new Error('Source-gap candidate requires an exact claim.');
  }
}

function shouldCreateFinding(candidate: SourceGapCandidate): boolean {
  return candidate.kind === 'external-factual'
    && candidate.impact === 'high'
    && candidate.presentedAsCurrentTruth
    && !hasUsableProvenance(candidate);
}

function isExcludedByPolicy(candidate: SourceGapCandidate): boolean {
  return [
    'strategic-choice',
    'personal-belief',
    'product-principle',
    'creative-language',
    'self-authored-definition',
  ].includes(candidate.kind);
}

export function detectSourceGapFindings(input: SourceGapDetectionInput): SourceGapDetectionResult {
  if (!isIsoDate(input.reportDate)) {
    throw new Error(`Source-gap detector requires an ISO report date: ${input.reportDate}`);
  }

  const findings: MaintenanceFinding[] = [];
  const ambiguousCandidates: SourceGapCandidate[] = [];
  const excludedCandidates: SourceGapCandidate[] = [];

  input.candidates.forEach((candidate, index) => {
    validateCandidate(candidate, input.file);

    if (candidate.kind === 'ambiguous') {
      ambiguousCandidates.push(candidate);
      return;
    }

    if (isExcludedByPolicy(candidate) || !shouldCreateFinding(candidate)) {
      excludedCandidates.push(candidate);
      return;
    }

    findings.push({
      id: slugForFinding(candidate, index),
      type: 'source-gap',
      status: 'open',
      created: input.reportDate,
      sourceRepo: 'mind',
      scope: input.file.path.startsWith('knowledge/') || input.file.path.startsWith('wiki/') ? 'durable-knowledge' : 'page',
      paths: [input.file.path],
      trigger: 'high-impact externally factual current claim lacks provenance',
      matchedEvidence: [
        {
          path: input.file.path,
          location: candidate.location,
          summary: candidate.claim.trim(),
        },
      ],
      comparisonEvidence: [],
      uncertainty:
        'The claim appears externally factual and high impact, but human review must confirm whether it is an observed fact, a strategic judgment, or a self-authored position before provenance is added.',
      confidence: 0.8,
      risk: riskForCandidate(candidate),
      recommendedAction:
        'Review the exact claim and add a source or decision reference only if provenance would materially improve trust; otherwise dismiss the finding as an intentional strategic or self-authored statement.',
      requiresApproval: true,
      noWritePerformed: true,
      deduplicationKey: `source-gap:${input.file.path}:${claimFingerprint(candidate)}`,
      suppressionUntil: null,
      review: null,
    });
  });

  return {
    findings,
    ambiguousCandidates,
    excludedCandidates,
  };
}
