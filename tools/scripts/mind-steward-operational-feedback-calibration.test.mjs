import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationalFeedbackCalibration, renderOperationalFeedbackCalibration } from './mind-steward-operational-feedback-calibration.mjs';

const item = (state, id, freshness = 'fresh', uncertainty = []) => ({ review_id: id, state, source: { source_reference: `${id}.md`, source_hash: state === 'missing' ? null : `hash:${id}`, evidence_references: state === 'missing' ? [] : [`evidence:${id}`], freshness, uncertainty, confidence: 0.8 }, history: state === 'repeated' ? [{ state: 'deferred' }, { state: 'deferred' }] : [] });

test('reports usage, quality, and friction signals deterministically', () => {
  const briefing = { generated_at: 'fixed', attention_queue: [{ review_id: 'failed', source_hash: 'same', source_type: 'ingestion_failure', extracted_information: 'failed extraction' }, { review_id: 'dup', source_hash: 'same', source_type: 'document' }] };
  const workflow = { generated_at: 'fixed', items: [item('accepted', 'accepted'), item('rejected', 'rejected'), item('deferred', 'deferred'), item('repeated', 'repeated'), item('missing', 'missing', 'fresh', ['missing context']), item('stale', 'stale', 'stale')] };
  const report = buildOperationalFeedbackCalibration({ briefing, workflow, generatedAt: 'fixed' });
  assert.deepEqual(report.signals, { reviewed_items: 6, accepted_items: 1, rejected_items: 1, deferred_items: 1, repeated_review_items: 1, noisy_or_rejected_items: 1, missing_context_items: 1, stale_items: 1, duplicate_findings: 1, missing_provenance_items: 1, failed_ingestion_items: 1 });
  assert.equal(report.invariants.report_only, true);
  assert.equal(renderOperationalFeedbackCalibration(report), renderOperationalFeedbackCalibration(buildOperationalFeedbackCalibration({ briefing, workflow, generatedAt: 'fixed' })));
});

test('does not manufacture findings without runtime inputs', () => {
  const report = buildOperationalFeedbackCalibration({ generatedAt: 'fixed' });
  assert.equal(report.real_inputs_present, false);
  assert.deepEqual(report.signals, { reviewed_items: 0, accepted_items: 0, rejected_items: 0, deferred_items: 0, repeated_review_items: 0, noisy_or_rejected_items: 0, missing_context_items: 0, stale_items: 0, duplicate_findings: 0, missing_provenance_items: 0, failed_ingestion_items: 0 });
  assert.equal(report.findings.length, 0);
});
