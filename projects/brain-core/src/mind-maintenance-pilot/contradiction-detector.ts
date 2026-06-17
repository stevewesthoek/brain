import type { LoadedMindMaintenancePilotDataset } from './pilot-file-loader.js';
import type { MaintenanceFinding, MaintenanceRisk } from './types.js';

export interface ContradictionClaim {
  path: LoadedMindMaintenancePilotDataset['files'][number]['path'];
  location: string;
  statement: string;
  authority: string;
  scope: string;
  sourceReferences: string[];
}

export interface ContradictionCandidate {
  left: ContradictionClaim;
  right: ContradictionClaim;
  mutuallyExclusive: boolean;
  explanation: string;
}

export interface ContradictionDetectionInput {
  dataset: LoadedMindMaintenancePilotDataset;
  reportDate: string;
  candidates: readonly ContradictionCandidate[];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`Contradiction candidate requires ${field}.`);
}

function normalizeStatement(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function riskFor(candidate: ContradictionCandidate): MaintenanceRisk {
  const canonicalAuthority = `${candidate.left.authority} ${candidate.right.authority}`.toLowerCase();
  return canonicalAuthority.includes('canonical') ? 'medium' : 'low';
}

function validateCandidate(
  candidate: ContradictionCandidate,
  allowedPaths: ReadonlySet<string>,
): void {
  for (const [side, claim] of [['left', candidate.left], ['right', candidate.right]] as const) {
    if (!allowedPaths.has(claim.path)) {
      throw new Error(`Contradiction ${side} path is outside the bounded pilot dataset: ${claim.path}`);
    }
    requireText(claim.location, `${side} exact location`);
    requireText(claim.statement, `${side} exact statement`);
    requireText(claim.authority, `${side} authority`);
    requireText(claim.scope, `${side} scope`);
  }
  requireText(candidate.explanation, 'an exclusivity explanation');
}

export function detectContradictionFindings(
  input: ContradictionDetectionInput,
): MaintenanceFinding[] {
  if (!isIsoDate(input.reportDate)) {
    throw new Error(`Contradiction detector requires an ISO report date: ${input.reportDate}`);
  }

  const allowedPaths = new Set(input.dataset.files.map((file) => file.path));
  const findings: MaintenanceFinding[] = [];

  input.candidates.forEach((candidate, index) => {
    validateCandidate(candidate, allowedPaths);
    if (!candidate.mutuallyExclusive) return;

    const paths = [candidate.left.path, candidate.right.path].sort();
    const statements = [
      normalizeStatement(candidate.left.statement),
      normalizeStatement(candidate.right.statement),
    ].sort();
    const fingerprint = slug(`${paths.join('|')}|${statements.join('|')}`) || String(index + 1);

    findings.push({
      id: `finding-contradiction-candidate-${fingerprint}`,
      type: 'contradiction-candidate',
      status: 'open',
      created: input.reportDate,
      sourceRepo: 'mind',
      scope: 'bounded five-file maintenance pilot',
      paths,
      trigger: 'Two exact claims were explicitly classified as mutually exclusive within the same bounded review.',
      matchedEvidence: [candidate.left, candidate.right].map((claim) => ({
        path: claim.path,
        location: claim.location,
        summary: `Exact claim: ${claim.statement}`,
      })),
      comparisonEvidence: [candidate.left, candidate.right].map((claim) => ({
        path: claim.path,
        location: claim.location,
        summary: `Authority: ${claim.authority}; scope: ${claim.scope}; sources: ${claim.sourceReferences.join(', ') || 'none recorded'}.`,
      })),
      uncertainty: candidate.explanation,
      confidence: 0.95,
      risk: riskFor(candidate),
      recommendedAction: 'Review both claims, their dates, scopes, authority, and evidence; then approve a correction, supersession, scope clarification, or keep-both resolution.',
      requiresApproval: true,
      noWritePerformed: true,
      deduplicationKey: `contradiction:${paths.join('|')}:${fingerprint}`,
      suppressionUntil: null,
      review: null,
    });
  });

  return findings;
}
