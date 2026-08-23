import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntelligenceFeedback } from './intelligence-feedback-learning.mjs';

const event = (overrides = {}) => ({ capability_id: 'universal-entry-consumption', type: 'successful_retrieval', evidence_refs: ['evidence:1'], timeframe: '2026-08-23', confidence: 0.9, ...overrides });

test('analyzes context, continuity, usefulness, and friction feedback', () => {
  const report = analyzeIntelligenceFeedback({ events: [event(), event({ type: 'failed_retrieval', evidence_refs: ['evidence:2'] }), event({ capability_id: 'session-continuity-inspection', type: 'continuity_failure' }), event({ capability_id: 'maintenance-intelligence', type: 'false_positive', mind_review_required: true })] });
  assert.equal(report.mode, 'REPORT_ONLY_INTELLIGENCE_FEEDBACK_LEARNING');
  assert.deepEqual(report.summary.categories, ['context_effectiveness', 'continuity_effectiveness', 'intelligence_usefulness']);
  assert.ok(report.signals.every((signal) => signal.source_evidence.length > 0 && signal.action === 'report_only'));
  assert.equal(report.summary.mind_review_required, 1);
  assert.equal(report.safety.model_training, false);
});

test('preserves uncertainty and produces stable bounded signals', () => {
  const input = { maxSignals: 1, events: [event({ evidence_complete: false, uncertainty: 'unknown' })] };
  const first = analyzeIntelligenceFeedback(input);
  const second = analyzeIntelligenceFeedback(input);
  assert.deepEqual(first, second);
  assert.equal(first.signals.length, 1);
  assert.equal(first.signals[0].uncertainty, 'evidence_incomplete');
  assert.equal(first.safety.writes_performed, 0);
});

test('ignores unknown event types and rejects invalid bounds', () => {
  const report = analyzeIntelligenceFeedback({ events: [{ capability_id: 'x', type: 'unknown' }] });
  assert.equal(report.signals.length, 0);
  assert.throws(() => analyzeIntelligenceFeedback({ maxSignals: 0 }), /learning_feedback_inputs_invalid/);
});
