import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIntelligenceReview } from './intelligence-review.mjs';

function pattern(overrides = {}) {
  return { pattern_id: 'pattern-001', pattern_key: 'category:stale', signal_count: 2, signal_ids: ['signal-001', 'signal-002'], evidence_refs: ['finding-001', 'validation-001'], decision_outcomes: { approved: 2 }, usefulness: { supported: 1, not_supported: 0, unknown: 1 }, confidence: { min: 0.5, max: 0.9, mean: 0.7 }, freshness: ['stale'], mind_impact: ['none'], action: 'review_only', ...overrides };
}

test('creates evidence, analysis, interpretation, and decision-separated review context', () => {
  const report = buildIntelligenceReview({ patterns: [pattern()] });
  const review = report.reviews[0];
  assert.deepEqual(report.sections, ['evidence', 'analysis', 'interpretation', 'decision']);
  assert.equal(review.evidence.occurrence_count, 2);
  assert.ok(review.evidence.evidence_refs.includes('finding-001'));
  assert.equal(review.interpretation.uncertainty, true);
  assert.equal(review.interpretation.no_causal_conclusion, true);
  assert.equal(review.decision.made, false);
  assert.equal(report.summary.proposals_created, 0);
});

test('preserves Mind boundary and freshness/uncertainty', () => {
  const review = buildIntelligenceReview({ patterns: [pattern({ mind_impact: ['requires_review'], freshness: ['unknown'], confidence: { min: null, max: null, mean: null } })] }).reviews[0];
  assert.equal(review.affected_authority_domain, 'mind_and_brain_boundary');
  assert.deepEqual(review.mind_impact, ['requires_review']);
  assert.equal(review.interpretation.uncertainty, true);
  assert.equal(review.decision.authority, 'human_review_required');
});

test('review output is deterministic, non-mutating, and rejects non-review patterns', () => {
  const patterns = [pattern()];
  const before = JSON.stringify(patterns);
  assert.deepEqual(buildIntelligenceReview({ patterns }), buildIntelligenceReview({ patterns }));
  assert.equal(JSON.stringify(patterns), before);
  assert.throws(() => buildIntelligenceReview({ patterns: [pattern({ action: 'apply' })] }), /pattern_not_review_only/);
});
