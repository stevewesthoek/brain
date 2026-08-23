import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDecisionContext } from './decision-context.mjs';

function review(overrides = {}) {
  return { review_id: 'review-001', pattern_id: 'pattern-001', pattern_identity: 'category:stale', evidence: { signal_ids: ['signal-001'], evidence_refs: ['finding-001'], occurrence_count: 2 }, analysis: { decision_outcomes: { approved: 1 }, usefulness: { supported: 1 }, confidence: { mean: 0.8 }, freshness: ['stale'] }, interpretation: { uncertainty: true, possible_interpretations: ['May recur.'] }, affected_authority_domain: 'brain_operational', mind_impact: ['none'], review_recommendations: ['Review sources.'], decision: { made: false, authority: 'human_review_required' }, action: 'review_only', ...overrides };
}

function signal() { return { signal_id: 'signal-001', proposal_id: 'prop-001', transaction_id: 'tx-001', evidence_refs: ['finding-001'] }; }

test('creates evidence/analysis/decision-separated context with history and alternatives', () => {
  const report = buildDecisionContext({ reviews: [review()], signals: [signal()], historicalDecisions: [{ decision_id: 'decision-previous', pattern_id: 'pattern-001', evidence_refs: ['old-validation'] }] });
  const context = report.contexts[0];
  assert.equal(context.decision.made, false);
  assert.ok(context.evidence.evidence_refs.includes('old-validation'));
  assert.equal(context.analysis.historical_outcomes.length, 1);
  assert.equal(context.alternatives_considered.length, 3);
  assert.equal(report.summary.approvals_created, 0);
});

test('preserves Mind impact and uncertainty without deciding', () => {
  const context = buildDecisionContext({ reviews: [review({ affected_authority_domain: 'mind_and_brain_boundary', mind_impact: ['requires_review'] })], signals: [signal()] }).contexts[0];
  assert.deepEqual(context.authority.mind_impact, ['requires_review']);
  assert.equal(context.uncertainty.present, true);
  assert.equal(context.decision.owner, 'human_review_required');
});

test('is deterministic, non-mutating, and fails closed on missing references or decided reviews', () => {
  const input = { reviews: [review()], signals: [signal()] };
  const before = JSON.stringify(input);
  assert.deepEqual(buildDecisionContext(input), buildDecisionContext(input));
  assert.equal(JSON.stringify(input), before);
  assert.throws(() => buildDecisionContext({ reviews: [review()], signals: [] }), /signal_reference_missing/);
  assert.throws(() => buildDecisionContext({ reviews: [review({ decision: { made: true } })], signals: [signal()] }), /review_not_unmade/);
});
