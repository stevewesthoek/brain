import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const DECISIONS = new Set(['approved', 'rejected', 'deferred', 'needs-review']);
const VALIDATION_RESULTS = new Set(['passed', 'failed', 'not_run', 'unknown']);

function fail(code) { throw new Error(`calibration:${code}`); }
function strings(values = []) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))].sort(); }
function bucket(confidence) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return 'unknown';
  if (confidence < 0.5) return 'low';
  if (confidence < 0.8) return 'medium';
  return 'high';
}

function validateRecord(record) {
  if (!record?.proposal?.proposalId) fail('proposal_required');
  if (!Number.isFinite(record.proposal.confidence) || record.proposal.confidence < 0 || record.proposal.confidence > 1) fail('confidence_invalid');
  if (!record.decision || record.decision.proposalId !== record.proposal.proposalId || !DECISIONS.has(record.decision.decision)) fail('decision_link_invalid');
  if (!record.transaction || !record.transaction.transactionId || !record.transaction.proposalIds?.includes(record.proposal.proposalId)) fail('transaction_link_invalid');
  if (!record.validation || record.validation.transactionId !== record.transaction.transactionId || !VALIDATION_RESULTS.has(record.validation.result)) fail('validation_link_invalid');
  if (record.outcome && record.outcome.expectedImprovement !== undefined && ![true, false, null].includes(record.outcome.expectedImprovement)) fail('improvement_outcome_invalid');
  if (record.outcome && record.outcome.falsePositive !== undefined && ![true, false, null].includes(record.outcome.falsePositive)) fail('false_positive_invalid');
}

function buildSignal(record) {
  const proposal = record.proposal;
  const decision = record.decision;
  const validation = record.validation;
  const outcome = record.outcome ?? {};
  const expectedImprovement = outcome.expectedImprovement ?? null;
  const falsePositive = outcome.falsePositive ?? null;
  const validationPassed = validation.result === 'passed';
  const usefulness = expectedImprovement === true && validationPassed ? 'supported' : expectedImprovement === false || validation.result === 'failed' ? 'not_supported' : 'unknown';
  const evidenceRefs = strings([proposal.proposalId, ...(proposal.evidenceRefs ?? []), ...(record.decision.evidenceRefs ?? []), ...(validation.evidenceRefs ?? []), ...(record.transaction.rollbackRefs ?? [])]);
  const payload = {
    proposal_id: proposal.proposalId,
    category: proposal.category ?? 'unknown',
    transaction_id: record.transaction.transactionId,
    decision: decision.decision,
    validation_result: validation.result,
    expected_improvement: expectedImprovement,
    false_positive: falsePositive,
    confidence: proposal.confidence,
    usefulness,
    evidence_refs: evidenceRefs
  };
  return {
    signal_id: `signal-${stableJsonHash(payload).slice(0, 24)}`,
    ...payload,
    confidence_bucket: bucket(proposal.confidence),
    provenance: { proposal_id: proposal.proposalId, decision_ref: decision.proposalId, transaction_id: record.transaction.transactionId, validation_refs: strings(validation.evidenceRefs), rollback_refs: strings(record.transaction.rollbackRefs) },
    mind_impact: proposal.mindImpact ?? 'unknown',
    action: 'measurement_only'
  };
}

export function analyzeIntelligenceCalibration({ records = [] } = {}) {
  if (!Array.isArray(records)) fail('records_array_required');
  const signals = records.map((record) => { validateRecord(record); return buildSignal(record); }).sort((left, right) => left.signal_id.localeCompare(right.signal_id));
  const explicitFalsePositives = signals.filter((signal) => signal.false_positive === true).length;
  const measuredUsefulness = signals.filter((signal) => signal.usefulness !== 'unknown').length;
  const supported = signals.filter((signal) => signal.usefulness === 'supported').length;
  return {
    schema_version: VERSION,
    mode: 'REPORT_ONLY_CALIBRATION',
    signals,
    summary: {
      record_count: records.length,
      signal_count: signals.length,
      decisions: Object.fromEntries([...DECISIONS].sort().map((decision) => [decision, signals.filter((signal) => signal.decision === decision).length])),
      validation_results: Object.fromEntries([...VALIDATION_RESULTS].sort().map((result) => [result, signals.filter((signal) => signal.validation_result === result).length])),
      measured_usefulness: measuredUsefulness,
      supported_recommendations: supported,
      false_positives_explicit: explicitFalsePositives,
      calibration_accuracy: measuredUsefulness === 0 ? null : supported / measuredUsefulness,
      learning_promotions: 0,
      canonical_updates: 0,
      writes_performed: 0,
      providers_called: 0
    }
  };
}
