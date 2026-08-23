import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
function fail(code) { throw new Error(`decision_context:${code}`); }
function strings(values = []) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))].sort(); }

function buildContext(review, signals, historicalDecisions) {
  if (!review?.review_id || !review.pattern_id || review.decision?.made !== false) fail('review_not_unmade');
  if (!Array.isArray(review.evidence?.evidence_refs)) fail('review_evidence_missing');
  const signalIds = new Set(review.evidence.signal_ids ?? []);
  const relatedSignals = signals.filter((signal) => signalIds.has(signal.signal_id));
  if (relatedSignals.length !== signalIds.size) fail('signal_reference_missing');
  const relatedHistory = historicalDecisions.filter((decision) => decision.pattern_id === review.pattern_id || decision.review_id === review.review_id);
  const evidenceRefs = strings([...review.evidence.evidence_refs, ...relatedSignals.flatMap((signal) => signal.evidence_refs), ...relatedHistory.flatMap((decision) => decision.evidence_refs ?? [])]);
  const mindImpact = Array.isArray(review.mind_impact) ? review.mind_impact : ['unknown'];
  const payload = { review_id: review.review_id, pattern_id: review.pattern_id, evidence_refs: evidenceRefs, history: relatedHistory.map((item) => item.decision_id ?? item.review_id) };
  return {
    context_id: `decision-context-${stableJsonHash(payload).slice(0, 24)}`,
    decision_reference: review.review_id,
    evidence: { pattern_id: review.pattern_id, signal_ids: review.evidence.signal_ids, evidence_refs: evidenceRefs, occurrence_count: review.evidence.occurrence_count },
    analysis: { pattern_identity: review.pattern_identity, pattern_analysis: review.analysis, related_pattern_reviews: [review.review_id], historical_outcomes: relatedHistory },
    alternatives_considered: [
      'Defer and gather additional evidence.',
      'Accept the interpretation for authorized follow-up review.',
      'Reject the interpretation and retain current canonical state.'
    ],
    risks: [
      'The observed pattern may be a sampling or classification artifact.',
      'Acting without authority could change canonical meaning or operational state.'
    ],
    uncertainty: { present: review.interpretation?.uncertainty !== false, possible_interpretations: review.interpretation?.possible_interpretations ?? [] },
    authority: { affected_domain: review.affected_authority_domain, brain_impact: review.affected_authority_domain.includes('brain'), mind_impact: mindImpact, required_review_boundary: review.review_recommendations },
    decision: { made: false, owner: review.decision.authority, approvals_created: 0 },
    action: 'review_only'
  };
}

export function buildDecisionContext({ reviews = [], signals = [], historicalDecisions = [], decisionReference } = {}) {
  if (!Array.isArray(reviews) || !Array.isArray(signals) || !Array.isArray(historicalDecisions)) fail('invalid_inputs');
  const selected = decisionReference ? reviews.filter((review) => review.review_id === decisionReference) : reviews;
  if (decisionReference && selected.length !== 1) fail('decision_reference_not_found');
  const contexts = selected.map((review) => buildContext(review, signals, historicalDecisions)).sort((left, right) => left.context_id.localeCompare(right.context_id));
  return {
    schema_version: VERSION,
    mode: 'REPORT_ONLY_DECISION_CONTEXT',
    sections: ['evidence', 'analysis', 'decision'],
    contexts,
    summary: { review_count: selected.length, context_count: contexts.length, decisions_made: 0, approvals_created: 0, proposals_created: 0, canonical_updates: 0, writes_performed: 0, providers_called: 0 }
  };
}
