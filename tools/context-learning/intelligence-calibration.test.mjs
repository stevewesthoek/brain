import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeIntelligenceCalibration } from './intelligence-calibration.mjs';

function record(overrides = {}) {
  return {
    proposal: { proposalId: 'prop-001', confidence: 0.9, evidenceRefs: ['finding-001'], mindImpact: 'none' },
    decision: { proposalId: 'prop-001', decision: 'approved', evidenceRefs: ['decision:001'] },
    transaction: { transactionId: 'tx-001', proposalIds: ['prop-001'], rollbackRefs: ['rollback:001'] },
    validation: { transactionId: 'tx-001', result: 'passed', evidenceRefs: ['validation:001'] },
    outcome: { expectedImprovement: true, falsePositive: false },
    ...overrides
  };
}

test('links proposal, decision, transaction, validation, and produces a useful learning signal', () => {
  const report = analyzeIntelligenceCalibration({ records: [record()] });
  const signal = report.signals[0];
  assert.equal(signal.decision, 'approved');
  assert.equal(signal.validation_result, 'passed');
  assert.equal(signal.usefulness, 'supported');
  assert.equal(signal.confidence_bucket, 'high');
  assert.ok(signal.provenance.rollback_refs.includes('rollback:001'));
  assert.equal(report.summary.calibration_accuracy, 1);
  assert.equal(report.summary.learning_promotions, 0);
});

test('measures rejection, deferral, failed validation, false positives, and unknown outcomes without inventing certainty', () => {
  const report = analyzeIntelligenceCalibration({ records: [
    record({ proposal: { proposalId: 'prop-002', confidence: 0.4, evidenceRefs: [], mindImpact: 'requires_review' }, decision: { proposalId: 'prop-002', decision: 'rejected' }, transaction: { transactionId: 'tx-002', proposalIds: ['prop-002'], rollbackRefs: [] }, validation: { transactionId: 'tx-002', result: 'failed', evidenceRefs: [] }, outcome: { expectedImprovement: false, falsePositive: true } }),
    record({ proposal: { proposalId: 'prop-003', confidence: 0.7 }, decision: { proposalId: 'prop-003', decision: 'deferred' }, transaction: { transactionId: 'tx-003', proposalIds: ['prop-003'], rollbackRefs: [] }, validation: { transactionId: 'tx-003', result: 'not_run', evidenceRefs: [] }, outcome: {} })
  ] });
  assert.equal(report.summary.decisions.rejected, 1);
  assert.equal(report.summary.decisions.deferred, 1);
  assert.equal(report.summary.false_positives_explicit, 1);
  assert.equal(report.signals.find((signal) => signal.proposal_id === 'prop-003').usefulness, 'unknown');
  assert.equal(report.summary.canonical_updates, 0);
});

test('calibration output is deterministic, non-mutating, and fails closed on broken links', () => {
  const records = [record()];
  const before = JSON.stringify(records);
  assert.deepEqual(analyzeIntelligenceCalibration({ records }), analyzeIntelligenceCalibration({ records }));
  assert.equal(JSON.stringify(records), before);
  assert.throws(() => analyzeIntelligenceCalibration({ records: [record({ decision: { proposalId: 'other', decision: 'approved' } })] }), /decision_link_invalid/);
  assert.throws(() => analyzeIntelligenceCalibration({ records: [record({ validation: { transactionId: 'other', result: 'passed' } })] }), /validation_link_invalid/);
});
