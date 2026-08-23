import {
  buildAuthorityMap,
  evaluateFreshness,
  stableJsonHash
} from './context-learning-core.mjs';

const OBSERVATION_SCHEMA_VERSION = '1.0.0';
const FRESHNESS_STATES = new Set(['fresh', 'review_due', 'stale', 'superseded', 'contradicted', 'unknown']);
const PRIVACY_CLASSES = new Set(['public', 'internal', 'sensitive', 'restricted']);
const MIND_IMPACT_STATES = new Set(['none', 'possible', 'requires_review']);
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'content',
  'raw',
  'rawcontent',
  'transcript',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'password',
  'credential'
]);

function requireString(value, field, maxLength = 500) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`invalid_${field}`);
  }
  return value.trim();
}

function requireTimestamp(value, field) {
  const timestamp = requireString(value, field, 80);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`invalid_${field}`);
  return timestamp;
}

function requireConfidence(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('invalid_confidence');
  return value;
}

function normalizeRefs(value, field, pattern = null) {
  if (!Array.isArray(value)) throw new Error(`invalid_${field}`);
  const refs = [...new Set(value.map((item) => requireString(item, field)))].sort();
  if (pattern && refs.some((ref) => !pattern.test(ref))) throw new Error(`invalid_${field}`);
  return refs;
}

function assertNoRawPayload(value, location = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawPayload(item, `${location}[${index}]`));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key.toLowerCase())) {
      throw new Error(`raw_or_secret_payload:${location}.${key}`);
    }
    assertNoRawPayload(child, `${location}.${key}`);
  }
}

function deriveFreshness(source, now) {
  if (source.freshnessInput && typeof source.freshnessInput === 'object') {
    return evaluateFreshness({
      freshnessClass: source.freshnessInput.freshnessClass ?? 'unknown',
      validTo: source.freshnessInput.validTo ?? null,
      reviewAfter: source.freshnessInput.reviewAfter ?? null,
      supersededBy: source.freshnessInput.supersededBy ?? [],
      contradicts: source.freshnessInput.contradicts ?? []
    }, now);
  }

  if (FRESHNESS_STATES.has(source.freshness)) return source.freshness;
  return 'unknown';
}

function classifyMindImpact(source, authority) {
  if (MIND_IMPACT_STATES.has(source.mindImpact)) return source.mindImpact;
  if (authority.owner === 'mind') return 'requires_review';
  if (source.sourceKind.startsWith('mind.') || source.sourceKind === 'mind_context') return 'requires_review';
  if (source.affectsMind === true) return 'requires_review';
  if (source.affectsMind === 'possible') return 'possible';
  return 'none';
}

function buildFingerprintInput(source, authority, freshness, mindImpact, evidenceRefs, relationshipRefs) {
  return {
    source_kind: source.sourceKind,
    source_ref: source.sourceRef,
    authority_kind: source.authorityKind,
    authority_owner: authority.owner,
    canonical: authority.canonical,
    observed_at: source.observedAt,
    source_revision: source.sourceRevision,
    evidence_refs: evidenceRefs,
    relationship_refs: relationshipRefs,
    freshness,
    confidence: source.confidence,
    privacy_class: source.privacyClass,
    mind_impact: mindImpact
  };
}

export function projectObservation(source, { authorityRegistry, now = new Date() } = {}) {
  if (!authorityRegistry || !Array.isArray(authorityRegistry.entries)) throw new Error('authority_registry_required');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('valid_now_required');
  assertNoRawPayload(source);

  const sourceKind = requireString(source?.sourceKind, 'source_kind', 120);
  const sourceRef = requireString(source?.sourceRef, 'source_ref');
  const authorityKind = requireString(source?.authorityKind, 'authority_kind', 120);
  const authority = buildAuthorityMap(authorityRegistry).get(authorityKind);
  if (!authority) throw new Error(`unknown_authority_kind:${authorityKind}`);

  const observedAt = requireTimestamp(source?.observedAt, 'observed_at');
  const sourceRevision = requireString(source?.sourceRevision, 'source_revision', 160);
  const evidenceRefs = normalizeRefs(source?.evidenceRefs, 'evidence_refs');
  const relationshipRefs = normalizeRefs(source?.relationshipRefs ?? [], 'relationship_refs', /^rel-[a-z0-9][a-z0-9._-]*$/);
  const confidence = requireConfidence(source?.confidence);
  if (!PRIVACY_CLASSES.has(source?.privacyClass)) throw new Error('invalid_privacy_class');

  const freshness = deriveFreshness(source, now);
  const mindImpact = classifyMindImpact(source, authority);
  const fingerprint = stableJsonHash(buildFingerprintInput(
    { ...source, sourceKind, sourceRef, authorityKind, observedAt, sourceRevision, confidence },
    authority,
    freshness,
    mindImpact,
    evidenceRefs,
    relationshipRefs
  ));

  return {
    schema_version: OBSERVATION_SCHEMA_VERSION,
    observation_id: `obs-${fingerprint.slice(0, 24)}`,
    source_kind: sourceKind,
    source_ref: sourceRef,
    authority_kind: authorityKind,
    authority_owner: authority.owner,
    canonical: authority.canonical === true,
    observed_at: observedAt,
    source_revision: sourceRevision,
    evidence_refs: evidenceRefs,
    relationship_refs: relationshipRefs,
    freshness,
    confidence,
    privacy_class: source.privacyClass,
    mind_impact: mindImpact,
    fingerprint
  };
}

export function projectObservations(sources, options = {}) {
  if (!Array.isArray(sources)) throw new Error('sources_array_required');
  return sources
    .map((source) => projectObservation(source, options))
    .sort((left, right) => left.observation_id.localeCompare(right.observation_id));
}
