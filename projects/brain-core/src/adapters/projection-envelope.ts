import {
  PROJECTION_CONTRACT,
  ProjectionContractError,
  type ProjectionAuthorityOwner,
  type ProjectionAvailability,
  type ProjectionConfidence,
  type ProjectionEnvelope,
  type ProjectionFreshness,
  type ProjectionPrivacy,
  type ProjectionProvenance,
  type ProjectionSourceReference,
  type ProjectionValidationResult,
} from '../types/projection.js';

const AUTHORITY_OWNERS: readonly ProjectionAuthorityOwner[] = ['brain', 'mind-reference', 'evidence', 'derived-runtime'];
const FRESHNESS_VALUES: readonly ProjectionFreshness[] = ['fresh', 'stale', 'unknown', 'unavailable', 'not_instrumented'];
const AVAILABILITY_VALUES: readonly ProjectionAvailability[] = ['available', 'empty', 'unavailable', 'invalid', 'not_instrumented'];
const CONFIDENCE_VALUES: readonly ProjectionConfidence[] = ['verified', 'high', 'medium', 'low', 'unknown'];
const PRIVACY_VALUES: readonly ProjectionPrivacy[] = ['public-local', 'private-local', 'sensitive-reference'];

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ProjectionContractError(`${field} is not an admitted projection value`);
  }
}

function validateSourceReferences(value: unknown): ProjectionSourceReference[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ProjectionContractError('provenance.sourceReferences must contain at least one reference');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new ProjectionContractError('source reference must be an object');
    const candidate = item as Record<string, unknown>;
    if (!isString(candidate.ref) || !['file', 'report', 'route', 'contract', 'revision'].includes(String(candidate.kind))) {
      throw new ProjectionContractError('source reference must contain an admitted ref and kind');
    }
    return { ref: candidate.ref, kind: candidate.kind as ProjectionSourceReference['kind'] };
  });
}

function validateProvenance(value: unknown): ProjectionProvenance {
  if (!value || typeof value !== 'object') throw new ProjectionContractError('provenance is required');
  const candidate = value as Record<string, unknown>;
  if (!isString(candidate.adapter) || !isString(candidate.capturedAt)) {
    throw new ProjectionContractError('provenance.adapter and provenance.capturedAt are required');
  }
  if (candidate.sourceRevision !== null && !isString(candidate.sourceRevision)) {
    throw new ProjectionContractError('provenance.sourceRevision must be a string or null');
  }
  return {
    sourceReferences: validateSourceReferences(candidate.sourceReferences),
    adapter: candidate.adapter,
    capturedAt: candidate.capturedAt,
    sourceRevision: candidate.sourceRevision as string | null,
  };
}

export function createProjectionEnvelope<TData>(input: {
  projection: string;
  authorityOwner: ProjectionAuthorityOwner;
  provenance: ProjectionProvenance;
  freshness: ProjectionFreshness;
  confidence: ProjectionConfidence;
  uncertainty?: string[];
  privacyClassification: ProjectionPrivacy;
  generatedAt: string;
  revision?: string | null;
  availability: ProjectionAvailability;
  failure?: { code: string; message: string } | null;
  data: TData;
}): ProjectionEnvelope<TData> {
  const envelope: ProjectionEnvelope<TData> = {
    contract: PROJECTION_CONTRACT,
    projection: input.projection,
    version: 1,
    authorityOwner: input.authorityOwner,
    provenance: input.provenance,
    freshness: input.freshness,
    confidence: input.confidence,
    uncertainty: input.uncertainty ?? [],
    privacyClassification: input.privacyClassification,
    generatedAt: input.generatedAt,
    revision: input.revision ?? input.provenance.sourceRevision,
    availability: input.availability,
    failure: input.failure ?? null,
    safety: { readOnly: true, writesToMind: false, executionEnabled: false },
    data: input.data,
  };
  return validateProjectionEnvelope<TData>(envelope).envelope;
}

export function validateProjectionEnvelope<TData>(value: unknown): ProjectionValidationResult<TData> {
  if (!value || typeof value !== 'object') throw new ProjectionContractError('projection envelope must be an object');
  const candidate = value as Record<string, unknown>;
  if (candidate.contract !== PROJECTION_CONTRACT || candidate.version !== 1 || !isString(candidate.projection)) {
    throw new ProjectionContractError('projection contract identity is invalid');
  }
  assertEnum(candidate.authorityOwner, AUTHORITY_OWNERS, 'authorityOwner');
  assertEnum(candidate.freshness, FRESHNESS_VALUES, 'freshness');
  assertEnum(candidate.availability, AVAILABILITY_VALUES, 'availability');
  assertEnum(candidate.confidence, CONFIDENCE_VALUES, 'confidence');
  assertEnum(candidate.privacyClassification, PRIVACY_VALUES, 'privacyClassification');
  if (!isString(candidate.generatedAt)) throw new ProjectionContractError('generatedAt is required');
  if (candidate.revision !== null && !isString(candidate.revision)) throw new ProjectionContractError('revision must be a string or null');
  if (!Array.isArray(candidate.uncertainty) || candidate.uncertainty.some((item) => !isString(item))) {
    throw new ProjectionContractError('uncertainty must be an array of strings');
  }
  const provenance = validateProvenance(candidate.provenance);
  const safety = candidate.safety;
  if (!safety || typeof safety !== 'object' || (safety as Record<string, unknown>).readOnly !== true || (safety as Record<string, unknown>).writesToMind !== false || (safety as Record<string, unknown>).executionEnabled !== false) {
    throw new ProjectionContractError('projection safety must remain read-only and non-executing');
  }
  if (candidate.failure !== null && (!candidate.failure || typeof candidate.failure !== 'object' || !isString((candidate.failure as Record<string, unknown>).code) || !isString((candidate.failure as Record<string, unknown>).message))) {
    throw new ProjectionContractError('failure must be null or a structured code/message object');
  }
  const envelope: ProjectionEnvelope<TData> = {
    ...(candidate as Omit<ProjectionEnvelope<TData>, 'provenance' | 'safety'>),
    authorityOwner: candidate.authorityOwner,
    freshness: candidate.freshness,
    availability: candidate.availability,
    confidence: candidate.confidence,
    privacyClassification: candidate.privacyClassification,
    provenance,
    safety: { readOnly: true, writesToMind: false, executionEnabled: false },
    data: candidate.data as TData,
  };
  return { ok: true, envelope };
}
