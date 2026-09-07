import crypto from 'node:crypto';

const MAX_ITEMS = 100;
const MAX_EVIDENCE_REFS = 100;
const DEFAULT_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const ACTORS = new Set(['human', 'assistant', 'tool', 'system']);
const POLARITIES = new Set(['positive', 'negative', 'neutral']);
const REVIEW_STATES = new Set(['observed', 'candidate', 'strengthened', 'conflicted', 'stale', 'review_ready', 'accepted', 'rejected', 'deferred', 'superseded']);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const unique = (items) => [...new Set(items.filter((item) => item != null && String(item) !== ''))];
const bounded = (items, limit = MAX_EVIDENCE_REFS) => unique(items).slice(0, limit);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function timestamp(value, fallback) {
  const parsed = new Date(value ?? fallback);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function sourceClass(event) {
  if (event.actor === 'tool' || event.claim_type === 'tool_observation' || event.claim_type === 'repository_evidence' || event.claim_type === 'runtime_observation') return 'verified_observation';
  if (event.actor === 'human' || event.claim_type === 'user_statement' || event.claim_type === 'decision') return 'human_statement';
  if (event.actor === 'assistant') return 'assistant_statement';
  return 'inference';
}

function candidateCategory(event) {
  if (event.category === 'decision' || event.claim_type === 'decision') return 'explicit_decision';
  if (event.category === 'recurring_problem') return 'failure_episode';
  if (event.category === 'lesson' || event.category === 'improvement') return 'workflow_or_preference';
  return event.category ?? 'observation';
}

function identityFor(event) {
  const explicit = event.candidate_key ?? event.claim_key ?? null;
  const subject = event.subject_ref ?? event.subject ?? event.concept ?? event.canonical_target ?? null;
  const proposition = explicit ?? `${candidateCategory(event)}|${subject ?? ''}|${event.statement ?? ''}`;
  return normalizeText(proposition);
}

function candidateId(identity) {
  return `lc-${sha256(identity).slice(0, 24)}`;
}

function evidenceRef(event) {
  return event.event_id ?? event.evidence_id ?? event.content_hash ?? null;
}

function sourceRef(event) {
  return event.provenance?.source_session ?? event.source_session_id ?? event.source_system ?? 'unknown';
}

function normalizeEvent(event, asOf) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('learning_evidence_must_be_object');
  const ref = evidenceRef(event);
  if (!ref) throw new Error('learning_evidence_reference_required');
  const polarity = POLARITIES.has(event.polarity) ? event.polarity : 'neutral';
  const observedAt = timestamp(event.observed_at, asOf);
  return { event, ref, identity: identityFor(event), polarity, observedAt, sourceRef: sourceRef(event), sourceClass: sourceClass(event) };
}

function isRetracted(item, sourceState, deletedEvidence) {
  const state = sourceState[item.ref] ?? sourceState[item.sourceRef];
  return deletedEvidence.has(item.ref) || state === 'deleted' || state === 'retracted' || (state && typeof state === 'object' && ['deleted', 'retracted'].includes(state.state));
}

function freshness(observedAt, event, asOf, staleAfterMs) {
  if (event.freshness === 'stale') return 'stale';
  const age = new Date(asOf).getTime() - new Date(observedAt).getTime();
  return Number.isFinite(age) && age > staleAfterMs ? 'stale' : (event.freshness ?? 'fresh');
}

function lifecycle({ supportCount, contradictionCount, staleState, sourceClasses, canonicalState }) {
  if (canonicalState === 'contradicts_existing') return 'review_ready';
  if (contradictionCount > 0 && supportCount > 0) return 'conflicted';
  if (staleState === 'stale') return 'stale';
  if (supportCount > 1 || sourceClasses.size > 1) return 'strengthened';
  return 'candidate';
}

function canonicalComparison(candidate, canonicalKnowledge) {
  const matches = canonicalKnowledge.filter((item) => {
    const identity = normalizeText(item.candidate_key ?? item.claim_key ?? item.canonical_target ?? item.statement ?? item.summary ?? '');
    return identity && (identity === candidate.identity || item.candidate_id === candidate.candidate_id);
  });
  if (!matches.length) return 'new_candidate';
  const polarity = matches.some((item) => item.polarity === 'negative') ? 'negative' : 'positive';
  if (candidate.contradiction_count > 0 || polarity === 'negative') return 'contradicts_existing';
  return 'supports_existing';
}

function relationKey(item) {
  return normalizeText(`${item.relation_type}|${item.subject_ref}|${item.object_ref}`);
}

function deriveRelations(items, asOf) {
  const relations = new Map();
  for (const item of items) {
    const event = item.event;
    const explicit = event.relation_type && (event.subject_ref || event.subject) && (event.object_ref || event.object);
    const entities = Array.isArray(event.related_entities) ? event.related_entities.filter(Boolean) : [];
    const rows = explicit
      ? [{ relation_type: event.relation_type, subject_ref: event.subject_ref ?? event.subject, object_ref: event.object_ref ?? event.object, inference_level: event.inference_level ?? 'explicit' }]
      : (entities.length >= 2 ? [{ relation_type: 'cooccurrence', subject_ref: entities[0], object_ref: entities[1], inference_level: 'cooccurrence' }] : []);
    for (const row of rows) {
      const key = relationKey(row);
      const relation = relations.get(key) ?? { relation_id: `rel-${sha256(key).slice(0, 24)}`, relation_type: row.relation_type, subject_ref: String(row.subject_ref), object_ref: String(row.object_ref), inference_level: row.inference_level, evidence_refs: [], source_refs: [], contradiction_count: 0, support_count: 0, first_observed: item.observedAt, last_observed: item.observedAt, provenance_classes: [] };
      relation.evidence_refs.push(item.ref);
      relation.source_refs.push(item.sourceRef);
      relation.provenance_classes.push(item.sourceClass);
      if (item.polarity === 'negative') relation.contradiction_count += 1;
      else if (item.polarity === 'positive' || row.inference_level === 'cooccurrence') relation.support_count += 1;
      relation.first_observed = relation.first_observed < item.observedAt ? relation.first_observed : item.observedAt;
      relation.last_observed = relation.last_observed > item.observedAt ? relation.last_observed : item.observedAt;
      relations.set(key, relation);
    }
  }
  return [...relations.values()].map((relation) => {
    const independentSourceCount = unique(relation.source_refs).length;
    return ({
    ...relation,
    evidence_refs: bounded(relation.evidence_refs),
    source_refs: unique(relation.source_refs),
    independent_source_count: independentSourceCount,
    provenance_classes: unique(relation.provenance_classes),
    strength_class: relation.inference_level === 'cooccurrence' ? 'weak' : relation.support_count > 1 && independentSourceCount > 1 ? 'strengthened' : 'observed',
    routed_to: 'ikhp:evidence-candidate' === relation.relation_type ? 'ikhp:evidence-candidate' : 'mind-steward:review-only',
    observed_at: asOf,
    });
  });
}

export function aggregateLearningCandidates({ events = [], existingCandidates = [], canonicalKnowledge = [], sourceState = {}, deletedEvidenceRefs = [], asOf = new Date().toISOString(), staleAfterMs = DEFAULT_STALE_AFTER_MS, maxItems = MAX_ITEMS } = {}) {
  if (!Array.isArray(events) || events.length > maxItems) throw new Error('learning_evidence_limit_exceeded');
  if (!Array.isArray(existingCandidates) || existingCandidates.length > maxItems) throw new Error('learning_candidate_limit_exceeded');
  const deletedEvidence = new Set(deletedEvidenceRefs);
  const normalized = [...new Map(events.map((event) => {
    const item = normalizeEvent(event, asOf);
    return [item.ref, item];
  })).values()];
  const groups = new Map();
  for (const item of normalized) {
    const group = groups.get(item.identity) ?? { identity: item.identity, items: [] };
    group.items.push(item);
    groups.set(item.identity, group);
  }
  for (const prior of existingCandidates) {
    if (!prior.candidate_id) continue;
    const identity = prior.identity ?? normalizeText(prior.candidate_key ?? prior.claim_key ?? prior.proposed_content ?? prior.content ?? prior.candidate_id);
    const group = groups.get(identity) ?? { identity, items: [], prior };
    group.prior = prior;
    groups.set(identity, group);
  }
  const candidates = [...groups.values()].slice(0, maxItems).map((group) => {
    const active = group.items.filter((item) => !isRetracted(item, sourceState, deletedEvidence));
    const support = active.filter((item) => item.polarity !== 'negative');
    const contradictions = active.filter((item) => item.polarity === 'negative');
    const priorSupportRefs = (group.prior?.support_evidence_refs ?? []).filter((ref) => !deletedEvidence.has(ref));
    const priorContradictionRefs = (group.prior?.contradicting_evidence_refs ?? []).filter((ref) => !deletedEvidence.has(ref));
    const supportRefs = bounded([...support.map((item) => item.ref), ...priorSupportRefs]);
    const contradictionRefs = bounded([...contradictions.map((item) => item.ref), ...priorContradictionRefs]);
    const sourceRefs = unique([...active.map((item) => item.sourceRef), ...(group.prior?.provenance?.source_refs ?? [])]);
    const sourceClasses = new Set([...active.map((item) => item.sourceClass), ...(group.prior?.provenance?.source_classes ?? [])]);
    const dates = [...active.map((item) => item.observedAt), ...(group.prior ? [group.prior.first_observed, group.prior.last_observed] : [])].filter(Boolean).sort();
    const first = dates[0] ?? asOf;
    const last = dates.at(-1) ?? asOf;
    const representative = active[0]?.event ?? group.prior ?? {};
    const candidate = {
      schema_version: '1.0.0',
      candidate_id: candidateId(group.identity),
      candidate_type: candidateCategory(representative),
      identity: group.identity,
      normalized_subject: representative.subject_ref ?? representative.subject ?? representative.concept ?? null,
      proposed_content: String(representative.statement ?? representative.proposed_content ?? group.prior?.proposed_content ?? '').slice(0, 1000),
      support_evidence_refs: supportRefs,
      contradicting_evidence_refs: contradictionRefs,
      retracted_evidence_refs: bounded([...deletedEvidence].filter((ref) => group.items.some((item) => item.ref === ref) || group.prior?.support_evidence_refs?.includes(ref) || group.prior?.contradicting_evidence_refs?.includes(ref))),
      provenance: { source_refs: sourceRefs, source_classes: [...sourceClasses], adapters: unique(active.map((item) => item.event.provenance?.adapter)) },
      first_observed: first,
      last_observed: last,
      freshness: freshness(last, representative, asOf, staleAfterMs),
      support_count: supportRefs.length,
      independent_source_count: sourceRefs.length,
      contradiction_count: contradictionRefs.length,
      evidence_strength: [...sourceClasses].sort(),
      inference_level: representative.inference_level ?? 'explicit',
      lifecycle_state: 'candidate',
      review_state: 'review_required',
      canonical_target_hint: representative.canonical_target ?? null,
      infrastructure_routing: representative.routing_classification === 'infrastructure' ? 'ikhp:evidence-candidate' : 'mind-steward:review-only',
      source_deletions: { active: true, retraction_refs: bounded([...deletedEvidence]) },
    };
    candidate.canonical_comparison = canonicalComparison(candidate, canonicalKnowledge);
    candidate.lifecycle_state = lifecycle({ supportCount: candidate.support_count, contradictionCount: candidate.contradiction_count, staleState: candidate.freshness, sourceClasses, canonicalState: candidate.canonical_comparison });
    candidate.review_ready = candidate.lifecycle_state === 'review_ready' || candidate.lifecycle_state === 'strengthened' || candidate.lifecycle_state === 'conflicted';
    return candidate;
  });
  const relations = deriveRelations(normalized.filter((item) => !isRetracted(item, sourceState, deletedEvidence)), asOf);
  const report = buildLearningCandidateReport({ candidates, relations, generatedAt: asOf, deletedEvidenceRefs: [...deletedEvidence] });
  return { candidates, relations, report };
}

export function compactLearningCandidates({ candidates = [], relations = [], asOf = new Date().toISOString(), maxEvidenceRefs = MAX_EVIDENCE_REFS } = {}) {
  if (!Array.isArray(candidates) || candidates.length > MAX_ITEMS) throw new Error('learning_candidate_limit_exceeded');
  const compacted = candidates.map((candidate) => ({
    ...candidate,
    support_evidence_refs: bounded(candidate.support_evidence_refs ?? [], maxEvidenceRefs),
    contradicting_evidence_refs: bounded(candidate.contradicting_evidence_refs ?? [], maxEvidenceRefs),
    retracted_evidence_refs: bounded(candidate.retracted_evidence_refs ?? [], maxEvidenceRefs),
    compaction: { operation: 'clr6-bounded-candidate-compaction', compacted_at: asOf, provenance_preserved: true, support_count: candidate.support_count ?? 0, contradiction_count: candidate.contradiction_count ?? 0 },
  }));
  const compactedRelations = relations.map((relation) => ({ ...relation, evidence_refs: bounded(relation.evidence_refs ?? [], maxEvidenceRefs), compaction: { operation: 'clr6-bounded-relation-compaction', compacted_at: asOf, provenance_preserved: true } }));
  return { candidates: compacted, relations: compactedRelations, report: { compacted_candidates: compacted.length, compacted_relations: compactedRelations.length, evidence_refs_bounded: true, canonical_mutations: 0 } };
}

export function buildLearningCandidateReport({ candidates = [], relations = [], generatedAt = new Date().toISOString(), deletedEvidenceRefs = [] } = {}) {
  return {
    schema_version: '1.0.0',
    report_type: 'learning-candidate-report-only',
    generated_at: generatedAt,
    candidate_count: candidates.length,
    new_count: candidates.filter((item) => item.canonical_comparison === 'new_candidate').length,
    strengthened_count: candidates.filter((item) => item.lifecycle_state === 'strengthened').length,
    conflicted_count: candidates.filter((item) => item.lifecycle_state === 'conflicted' || item.canonical_comparison === 'contradicts_existing').length,
    stale_count: candidates.filter((item) => item.freshness === 'stale').length,
    review_ready_count: candidates.filter((item) => item.review_ready).length,
    relation_candidate_count: relations.length,
    infrastructure_routed_count: candidates.filter((item) => item.infrastructure_routing === 'ikhp:evidence-candidate').length,
    source_diversity: unique(candidates.flatMap((item) => item.provenance.source_refs)).length,
    retracted_evidence_count: deletedEvidenceRefs.length,
    compaction: { performed: false, compacted_candidates: 0, compacted_relations: 0 },
    candidates,
    relations,
    invariants: { report_only: true, writes_to_mind: false, writes_to_brain_canonical: false, ikhp_canonical_mutation: false, provider_calls: false, raw_transcripts_stored: false, new_authority_store: false, automatic_promotion: false },
  };
}

export { normalizeText };
