import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperatingLoopView } from './operating-loop.mjs';

function input() {
  const signal = { signal_id: 'signal-001', evidence_refs: ['finding-001'] };
  const pattern = { pattern_id: 'pattern-001', signal_ids: ['signal-001'], evidence_refs: ['finding-001'], confidence: { mean: 0.8 } };
  const review = { review_id: 'review-001', pattern_id: 'pattern-001', affected_authority_domain: 'brain_operational', evidence: { evidence_refs: ['finding-001'] }, interpretation: { uncertainty: true }, review_recommendations: ['Review evidence.'] };
  const context = { context_id: 'context-001', decision_reference: 'review-001', evidence: { evidence_refs: ['finding-001'] }, decision: { made: false }, authority: { affected_domain: 'brain_operational', required_review_boundary: ['Review evidence.'] } };
  return { observations: [{ observation_id: 'obs-001', evidence_refs: ['finding-001'], freshness: 'stale' }], continuity: { conflicts: [], selection: { status: 'none_valid', resume_allowed: false } }, lifecycle: { findings: [{ finding_id: 'finding-001' }] }, calibration: { signals: [signal] }, patterns: { patterns: [pattern] }, reviews: { reviews: [review] }, decisionContexts: { contexts: [context] }, evolutions: [{ transaction: { transactionId: 'tx-001' }, learning_receipt: { state: 'prepared', evidenceRefs: ['finding-001'] } }] };
}

test('integrates current, intelligence, decision, evolution, and authority state', () => {
  const view = buildOperatingLoopView(input());
  assert.equal(view.mode, 'REPORT_ONLY_INFINITE_BRAIN_OPERATING_VIEW');
  assert.equal(view.current_state.observations.count, 1);
  assert.equal(view.intelligence_state.patterns.length, 1);
  assert.equal(view.decision_state.pending_contexts.length, 1);
  assert.equal(view.evolution_state.prepared_transactions.length, 1);
  assert.ok(view.provenance.evidence_refs.includes('finding-001'));
  assert.equal(view.interpretation_boundary.decisions_made, 0);
});

test('preserves uncertainty, continuity safety, and deterministic no-write output', () => {
  const value = input();
  const before = JSON.stringify(value);
  assert.deepEqual(buildOperatingLoopView(value), buildOperatingLoopView(value));
  assert.equal(JSON.stringify(value), before);
  assert.equal(buildOperatingLoopView(value).current_state.active_continuity.resume_allowed, false);
  assert.equal(buildOperatingLoopView(value).intelligence_state.uncertainty[0], true);
});

test('fails closed on broken stage references or decided contexts', () => {
  assert.throws(() => buildOperatingLoopView({ ...input(), patterns: { patterns: [{ pattern_id: 'pattern-x', signal_ids: ['missing'] }] } }), /pattern_signal_reference_missing/);
  assert.throws(() => buildOperatingLoopView({ ...input(), decisionContexts: { contexts: [{ context_id: 'x', decision_reference: 'missing', decision: { made: false } }] } }), /decision_context_reference_invalid/);
  assert.throws(() => buildOperatingLoopView({ ...input(), decisionContexts: { contexts: [{ context_id: 'x', decision_reference: 'review-001', decision: { made: true } }] } }), /decision_context_reference_invalid/);
});
