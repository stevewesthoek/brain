import type { MaintenanceFinding, MaintenanceRisk } from './types.js';

export type CapturePromotionClassification = 'decision' | 'lesson' | 'rule' | 'insight' | 'temporary' | 'personal';
export type CapturePromotionRecommendation = 'update-existing' | 'create-new';

export interface CapturePromotionCandidate {
  capturePath: string;
  location: string;
  summary: string;
  reusableInsight: string;
  classification: CapturePromotionClassification;
  confidence: number;
  captureAgeDays: number;
  priorReferenceCount: number;
  repeatedConceptCount: number;
  duplicateCheck: {
    matched: boolean;
    paths: string[];
    summary: string;
  };
  recommendedDestination: string;
  recommendation: CapturePromotionRecommendation;
}

export interface CapturePromotionDetectionInput {
  reportDate: string;
  candidates: readonly CapturePromotionCandidate[];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`Capture-promotion candidate requires ${field}.`);
}

function validateCandidate(candidate: CapturePromotionCandidate): void {
  if (!candidate.capturePath.startsWith('capture/')) {
    throw new Error(`Capture-promotion path must be inside capture/: ${candidate.capturePath}`);
  }
  requireText(candidate.location, 'an exact location');
  requireText(candidate.summary, 'a capture summary');
  requireText(candidate.reusableInsight, 'a concise reusable insight');
  requireText(candidate.duplicateCheck.summary, 'a duplicate-check summary');
  requireText(candidate.recommendedDestination, 'a recommended destination');
  if (!['live/', 'wiki/', 'sources/'].some((prefix) => candidate.recommendedDestination.startsWith(prefix))) {
    throw new Error(`Capture-promotion destination must be in live/, wiki/, or sources/: ${candidate.recommendedDestination}`);
  }
  if (candidate.confidence < 0 || candidate.confidence > 1) {
    throw new Error('Capture-promotion confidence must be between 0 and 1.');
  }
  if ([candidate.captureAgeDays, candidate.priorReferenceCount, candidate.repeatedConceptCount].some((value) => value < 0)) {
    throw new Error('Capture-promotion signal counts cannot be negative.');
  }
}

function isDurableClassification(candidate: CapturePromotionCandidate): boolean {
  return ['decision', 'lesson', 'rule', 'insight'].includes(candidate.classification);
}

function hasPromotionSignal(candidate: CapturePromotionCandidate): boolean {
  return candidate.priorReferenceCount >= 2
    || candidate.repeatedConceptCount >= 2
    || (candidate.captureAgeDays >= 30 && candidate.confidence >= 0.8);
}

function riskFor(candidate: CapturePromotionCandidate): MaintenanceRisk {
  return candidate.recommendedDestination.startsWith('wiki/') ? 'medium' : 'low';
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export function detectCapturePromotionFindings(
  input: CapturePromotionDetectionInput,
): MaintenanceFinding[] {
  if (!isIsoDate(input.reportDate)) {
    throw new Error(`Capture-promotion detector requires an ISO report date: ${input.reportDate}`);
  }

  return input.candidates.flatMap((candidate, index) => {
    validateCandidate(candidate);
    if (!isDurableClassification(candidate) || !hasPromotionSignal(candidate)) return [];

    const fingerprint = slug(`${candidate.capturePath}|${candidate.recommendedDestination}`) || String(index + 1);
    const paths = [candidate.capturePath, ...candidate.duplicateCheck.paths].filter(
      (path, pathIndex, all) => all.indexOf(path) === pathIndex,
    );

    return [{
      id: `finding-capture-promotion-${fingerprint}`,
      type: 'capture-promotion',
      status: 'open',
      created: input.reportDate,
      sourceRepo: 'mind',
      scope: 'bounded capture-promotion review',
      paths,
      trigger: 'A capture classified as a durable decision, lesson, rule, or insight has repeated-use, repeated-concept, or aged high-confidence signals.',
      matchedEvidence: [{
        path: candidate.capturePath,
        location: candidate.location,
        summary: `Reusable insight: ${candidate.reusableInsight}`,
      }],
      comparisonEvidence: [{
        path: candidate.capturePath,
        location: 'duplicate check',
        summary: `${candidate.duplicateCheck.matched ? 'Matching durable content found' : 'No matching durable content found'}: ${candidate.duplicateCheck.summary}`,
      }],
      uncertainty: 'Durability and destination scope still require human review; temporary or personal material must not be promoted automatically.',
      confidence: candidate.confidence,
      risk: riskFor(candidate),
      recommendedAction: `${candidate.recommendation === 'update-existing' ? 'Update the reviewed existing page' : 'Create a reviewed durable page'} at ${candidate.recommendedDestination}; do not write until explicitly approved.`,
      requiresApproval: true,
      noWritePerformed: true,
      deduplicationKey: `capture-promotion:${candidate.capturePath}:${candidate.recommendedDestination}`,
      suppressionUntil: null,
      review: null,
    } satisfies MaintenanceFinding];
  });
}
