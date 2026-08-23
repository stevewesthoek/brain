export const PROJECTION_CONTRACT = 'brain-core-projection-v1' as const;

export type ProjectionAuthorityOwner = 'brain' | 'mind-reference' | 'evidence' | 'derived-runtime';
export type ProjectionFreshness = 'fresh' | 'stale' | 'unknown' | 'unavailable' | 'not_instrumented';
export type ProjectionAvailability = 'available' | 'empty' | 'unavailable' | 'invalid' | 'not_instrumented';
export type ProjectionPrivacy = 'public-local' | 'private-local' | 'sensitive-reference';
export type ProjectionConfidence = 'verified' | 'high' | 'medium' | 'low' | 'unknown';

export interface ProjectionSourceReference {
  ref: string;
  kind: 'file' | 'report' | 'route' | 'contract' | 'revision';
}

export interface ProjectionProvenance {
  sourceReferences: ProjectionSourceReference[];
  adapter: string;
  capturedAt: string;
  sourceRevision: string | null;
}

export interface ProjectionSafety {
  readOnly: true;
  writesToMind: false;
  executionEnabled: false;
}

export interface ProjectionEnvelope<TData> {
  contract: typeof PROJECTION_CONTRACT;
  projection: string;
  version: 1;
  authorityOwner: ProjectionAuthorityOwner;
  provenance: ProjectionProvenance;
  freshness: ProjectionFreshness;
  confidence: ProjectionConfidence;
  uncertainty: string[];
  privacyClassification: ProjectionPrivacy;
  generatedAt: string;
  revision: string | null;
  availability: ProjectionAvailability;
  failure: { code: string; message: string } | null;
  safety: ProjectionSafety;
  data: TData;
}

export interface ProjectionValidationResult<TData> {
  ok: true;
  envelope: ProjectionEnvelope<TData>;
}

export class ProjectionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionContractError';
  }
}
