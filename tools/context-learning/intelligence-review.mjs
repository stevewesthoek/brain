import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
function fail(code) { throw new Error(`review:${code}`); }
function strings(values = []) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))].sort(); }

function reviewPattern(pattern) {
  if (!pattern?.pattern_id || !pattern.pattern_key || !Number.isInteger(pattern.signal_count)) fail('pattern_identity_invalid');
  if (!Array.isArray(pattern.evidence_refs) || !Array.isArray(pattern.signal_ids)) fail('pattern_provenance_missing');
  if (pattern.action && pattern.action !== 'review_only') fail('pattern_not_review_only');
  const mindImpact = Array.isArray(pattern.mind_impact) ? pattern.mind_impact : ['unknown'];
  const affectedDomain = mindImpact.includes('requires_review') || mindImpact.includes('possible') ? 'mind_and_brain_boundary' : 'brain_operational';
  const uncertainty = pattern.usefulness?.unknown > 0 || pattern.confidence?.mean === null || (pattern.freshness ?? ['unknown']).includes('unknown');
  const evidence = strings([...pattern.signal_ids, ...pattern.evidence_refs]);
  const payload = { pattern_id: pattern.pattern_id, evidence, signal_count: pattern.signal_count };
  return {
    review_id: `review-${stableJsonHash(payload).slice(0, 24)}`,
    pattern_id: pattern.pattern_id,
    pattern_identity: pattern.pattern_key,
    evidence: { signal_ids: pattern.signal_ids, evidence_refs: pattern.evidence_refs, occurrence_count: pattern.signal_count },
    analysis: { decision_outcomes: pattern.decision_outcomes, usefulness: pattern.usefulness, confidence: pattern.confidence, freshness: pattern.freshness ?? ['unknown'] },
    interpretation: {
      uncertainty,
      possible_interpretations: [
        'The repeated signal may reflect a recurring source or workflow condition.',
        'The apparent recurrence may be an artifact of the available sample or classification.'
      ],
      no_causal_conclusion: true
    },
    affected_authority_domain: affectedDomain,
    mind_impact: mindImpact,
    review_recommendations: [
      'Review the cited evidence and source freshness.',
      'Confirm whether the pattern is meaningful before considering any recommendation.'
    ],
    decision: { made: false, authority: 'human_review_required' },
    action: 'review_only'
  };
}

export function buildIntelligenceReview({ patterns = [] } = {}) {
  if (!Array.isArray(patterns)) fail('patterns_array_required');
  const reviews = patterns.map(reviewPattern).sort((left, right) => left.review_id.localeCompare(right.review_id));
  return {
    schema_version: VERSION,
    mode: 'REPORT_ONLY_HUMAN_INTELLIGENCE_REVIEW',
    sections: ['evidence', 'analysis', 'interpretation', 'decision'],
    reviews,
    summary: { pattern_count: patterns.length, review_count: reviews.length, decisions_made: 0, proposals_created: 0, canonical_updates: 0, writes_performed: 0, providers_called: 0 }
  };
}
