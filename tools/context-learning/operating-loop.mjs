import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
function fail(code) { throw new Error(`operating_loop:${code}`); }
function strings(values = []) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))].sort(); }

export function buildOperatingLoopView({ observations = [], continuity = null, lifecycle = null, calibration = null, patterns = null, reviews = null, decisionContexts = null, evolutions = [] } = {}) {
  if (!Array.isArray(observations) || !Array.isArray(evolutions)) fail('invalid_inputs');
  const patternItems = patterns?.patterns ?? [];
  const reviewItems = reviews?.reviews ?? [];
  const contextItems = decisionContexts?.contexts ?? [];
  const signalIds = new Set(calibration?.signals?.map((signal) => signal.signal_id) ?? []);
  for (const pattern of patternItems) {
    if (!pattern?.pattern_id || !pattern.signal_ids?.every((id) => signalIds.has(id))) fail('pattern_signal_reference_missing');
  }
  const patternIds = new Set(patternItems.map((pattern) => pattern.pattern_id));
  for (const review of reviewItems) if (!patternIds.has(review.pattern_id)) fail('review_pattern_reference_missing');
  const reviewIds = new Set(reviewItems.map((review) => review.review_id));
  for (const context of contextItems) if (!reviewIds.has(context.decision_reference) || context.decision?.made !== false) fail('decision_context_reference_invalid');
  const freshness = strings(observations.map((observation) => observation.freshness));
  const authorityDomains = strings([...reviewItems.map((review) => review.affected_authority_domain), ...contextItems.map((context) => context.authority?.affected_domain)]);
  const evidenceRefs = strings([
    ...observations.flatMap((observation) => observation.evidence_refs ?? []),
    ...patternItems.flatMap((pattern) => pattern.evidence_refs ?? []),
    ...reviewItems.flatMap((review) => review.evidence?.evidence_refs ?? []),
    ...contextItems.flatMap((context) => context.evidence?.evidence_refs ?? []),
    ...evolutions.flatMap((evolution) => evolution.learning_receipt?.evidenceRefs ?? [])
  ]);
  const identity = { observation_count: observations.length, continuity: continuity?.selection ?? null, patterns: patternItems.map((item) => item.pattern_id), contexts: contextItems.map((item) => item.context_id), evidence_refs: evidenceRefs };
  return {
    schema_version: VERSION,
    mode: 'REPORT_ONLY_INFINITE_BRAIN_OPERATING_VIEW',
    view_id: `operating-view-${stableJsonHash(identity).slice(0, 24)}`,
    current_state: {
      observations: { count: observations.length, ids: observations.map((observation) => observation.observation_id).sort(), freshness },
      conflicts: continuity?.conflicts ?? [],
      active_continuity: continuity?.selection ?? { status: 'unknown', resume_allowed: false }
    },
    intelligence_state: {
      lifecycle_findings: lifecycle?.findings ?? [],
      calibration_signals: calibration?.signals ?? [],
      patterns: patternItems,
      confidence: patternItems.map((pattern) => pattern.confidence),
      uncertainty: reviews?.reviews?.map((review) => review.interpretation?.uncertainty ?? true) ?? []
    },
    decision_state: {
      pending_contexts: contextItems,
      unresolved_questions: reviewItems.flatMap((review) => review.review_recommendations ?? []),
      review_boundaries: contextItems.map((context) => context.authority?.required_review_boundary ?? [])
    },
    evolution_state: {
      prepared_transactions: evolutions.map((evolution) => evolution.transaction ?? null).filter(Boolean),
      validation_status: evolutions.map((evolution) => evolution.learning_receipt?.state ?? 'unknown'),
      learning_receipts: evolutions.map((evolution) => evolution.learning_receipt ?? null).filter(Boolean)
    },
    authority_state: { domains: authorityDomains, brain_impact: authorityDomains.filter((domain) => domain.includes('brain')), mind_impact: authorityDomains.filter((domain) => domain.includes('mind')), ownership_source: 'existing-authority-registry-and-review-artifacts' },
    provenance: { evidence_refs: evidenceRefs, source_sections: ['observation_projection', 'lifecycle_analysis', 'calibration', 'pattern_discovery', 'human_review', 'decision_context', 'evolution_preparation'] },
    interpretation_boundary: { evidence: 'what exists', analysis: 'what patterns and relationships suggest', decision: 'belongs to the authorized owner', decisions_made: 0, proposals_created: 0, approvals_created: 0, canonical_updates: 0, writes_performed: 0, providers_called: 0 }
  };
}
