import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeMaintenanceFindings } from './maintenance-prioritization-intelligence.mjs';

const finding = (overrides = {}) => ({ finding_id: 'finding-1', source_refs: ['source-1'], evidence: ['evidence-1'], authority_owner: 'brain', confidence: 0.8, freshness: 'stale', impact: 'operational', uncertainty: 'known_limits', mind_review_required: false, ...overrides });

test('produces explainable advisory priorities with provenance and factors', () => {
  const report = prioritizeMaintenanceFindings({ findings: [finding(), finding({ finding_id: 'finding-2', impact: 'safety', freshness: 'contradicted' })] });
  assert.equal(report.mode, 'REPORT_ONLY_MAINTENANCE_PRIORITIZATION');
  assert.equal(report.findings[0].source_finding_ref, 'finding-2');
  assert.ok(report.findings[0].advisory_score > 0);
  assert.ok(report.findings[0].source_refs.length > 0 && report.findings[0].evidence.length > 0);
  assert.equal(report.findings[0].action, 'report_only');
  assert.equal(report.safety.ranking_is_advisory, true);
});

test('Mind impact is review-only and unknown authority/freshness fail closed', () => {
  const report = prioritizeMaintenanceFindings({ findings: [finding({ finding_id: 'mind-1', authority_owner: 'mind', impact: 'mind', mind_review_required: true }), finding({ finding_id: 'unknown-1', authority_owner: 'other', freshness: 'unknown' })] });
  const mind = report.findings.find((item) => item.source_finding_ref === 'mind-1');
  const unknown = report.findings.find((item) => item.source_finding_ref === 'unknown-1');
  assert.equal(mind.mind_review_required, true);
  assert.equal(unknown.advisory_score, 0);
  assert.equal(unknown.uncertainty, 'authority_or_freshness_unknown');
  assert.equal(report.safety.human_priorities_changed, false);
});

test('repeated runs are stable and bounds are enforced', () => {
  const input = { findings: [finding(), finding({ finding_id: 'finding-2', freshness: 'fresh' })], maxFindings: 1 };
  const first = prioritizeMaintenanceFindings(input);
  const second = prioritizeMaintenanceFindings(input);
  assert.deepEqual(first.findings, second.findings);
  assert.equal(first.findings.length, 1);
  assert.throws(() => prioritizeMaintenanceFindings({ maxFindings: 0 }), /prioritization_inputs_invalid/);
});
