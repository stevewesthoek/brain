import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationalReadiness, renderOperationalReadiness } from './mind-steward-operational-readiness.mjs';

const item = (state, id, freshness = 'fresh') => ({ review_id: id, state, source: { source_reference: `${id}.md`, source_hash: `hash:${id}`, evidence_references: [`evidence:${id}`], freshness, uncertainty: [], confidence: 0.8 } });

test('reports capability, data, workflow, and operator readiness', () => {
  const workflow = { generated_at: 'fixed', items: [item('new', 'new'), item('deferred', 'deferred'), item('accepted', 'accepted'), item('reviewing', 'stale', 'stale')] };
  const calibration = { signals: { failed_ingestion_items: 0 } };
  const promotions = [{ promotion_id: 'promotion:one', state: 'promotion_candidate', source: { source_reference: 'accepted.md' } }];
  const report = buildOperationalReadiness({ repoRoot: process.cwd(), workflow, calibration, promotions, generatedAt: 'fixed' });
  assert.equal(report.status, 'ready_with_attention');
  assert.equal(report.usable_for_daily_review, true);
  assert.equal(report.workflow_health.pending_reviews, 2);
  assert.equal(report.workflow_health.deferred_items, 1);
  assert.equal(report.workflow_health.promotion_candidates, 1);
  assert.equal(report.data_health.stale_artifacts, 1);
  assert.ok(report.operator_guidance.commands.length >= 2);
  assert.equal(renderOperationalReadiness(report), renderOperationalReadiness(buildOperationalReadiness({ repoRoot: process.cwd(), workflow, calibration, promotions, generatedAt: 'fixed' })));
});

test('handles empty state without claiming missing capabilities', () => {
  const report = buildOperationalReadiness({ repoRoot: '/tmp/nonexistent-brain', generatedAt: 'fixed' });
  assert.equal(report.status, 'not_ready');
  assert.equal(report.usable_for_daily_review, false);
  assert.equal(report.workflow_health.pending_reviews, 0);
  assert.equal(report.invariants.automatic_repair, false);
});
