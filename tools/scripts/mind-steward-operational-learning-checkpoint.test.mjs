import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationalLearningCheckpoint, renderOperationalLearningCheckpoint } from './mind-steward-operational-learning-checkpoint.mjs';

test('builds deterministic learning observations from existing artifacts', () => {
  const artifacts = { workflow: { generated_at: 'fixed', items: [{ review_id: 'r1', state: 'accepted' }, { review_id: 'r2', state: 'deferred' }] }, calibration: { generated_at: 'fixed', signals: { failed_ingestion_items: 1, missing_context_items: 2, stale_items: 1 }, findings: [{ finding_type: 'workflow_friction', evidence: ['r2'], affected_capability: 'provenance validation', confidence: 1, uncertainty: [], possible_improvement_area: 'repair provenance', report_only: true }, { finding_type: 'information_quality', evidence: ['r1'], affected_capability: 'freshness tracking', confidence: 1, uncertainty: ['source context'], possible_improvement_area: 'refresh', report_only: true }] }, readiness: { status: 'ready_with_attention' }, daily_loop: { generated_at: 'fixed' } };
  const report = buildOperationalLearningCheckpoint({ artifacts, sourcePaths: ['workflow.json', 'calibration.json'], generatedAt: 'fixed' });
  assert.deepEqual(report.usage_observations.capabilities_used, ['calibration', 'daily_loop', 'readiness', 'workflow']);
  assert.equal(report.usage_observations.review_volume, 2);
  assert.equal(report.usage_observations.successful_workflows, 1);
  assert.equal(report.usage_observations.failed_workflows, 1);
  assert.equal(report.roadmap_guidance.immediate_fixes.length, 1);
  assert.equal(report.roadmap_guidance.future_capabilities.length, 1);
  assert.equal(report.roadmap_guidance.experimental_ideas.length, 1);
  assert.equal(renderOperationalLearningCheckpoint(report), renderOperationalLearningCheckpoint(buildOperationalLearningCheckpoint({ artifacts, sourcePaths: ['workflow.json', 'calibration.json'], generatedAt: 'fixed' })));
});

test('does not make synthetic usage claims without artifacts', () => {
  const report = buildOperationalLearningCheckpoint({ generatedAt: 'fixed' });
  assert.equal(report.real_inputs_present, false);
  assert.equal(report.usage_observations.review_volume, 0);
  assert.equal(report.improvement_candidates.length, 0);
  assert.equal(report.invariants.automatic_changes, false);
});
