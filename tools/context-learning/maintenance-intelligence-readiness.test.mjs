import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMaintenanceIntelligence } from './maintenance-intelligence-readiness.mjs';

test('reports bounded knowledge, context, continuity, and evolution health signals', () => {
  const report = analyzeMaintenanceIntelligence({
    observations: [{ source_ref: 'source:stale', evidence_refs: ['evidence:1'], freshness: 'stale', authority_owner: 'brain', confidence: 0.9, mind_impact: 'none' }, { source_ref: 'source:nav', evidence_refs: ['evidence:2'], freshness: 'fresh' }],
    knowledgeFindings: [{ finding_id: 'finding:duplicate', category: 'duplicate_information', source_refs: ['source:a'], reason: 'duplicate', confidence: 0.8, freshness: 'review_due', impact_classification: 'operational', mind_impact: 'none', evidence: ['evidence:3'] }],
    continuity: [{ status: 'BLOCKED', fail_closed: true, reason: 'source_revision_stale', details: ['session:1'] }],
    calibration: { summary: { false_positives_explicit: 1, decisions: { deferred: 1 } }, signals: [{ signal_id: 'signal:1', evidence_refs: ['evidence:4'] }] },
    patterns: { patterns: [{ pattern_id: 'pattern:1', evidence_refs: ['signal:1'] }] }
  });
  assert.equal(report.mode, 'REPORT_ONLY_MAINTENANCE_INTELLIGENCE');
  assert.deepEqual(report.summary.domains, ['context_health', 'evolution_loop_health', 'knowledge_health', 'session_continuity_health']);
  assert.ok(report.findings.every((item) => item.source_refs.length > 0 && item.evidence.length > 0 && item.action === 'report_only'));
  assert.equal(report.safety.writes_performed, 0);
  assert.equal(report.safety.automatic_actions, 0);
});

test('preserves Mind review boundary and deterministic bounded output shape', () => {
  const input = { observations: [{ source_ref: 'mind:priority', navigation_ref: 'mind:navigation', evidence_refs: ['mind:evidence'], freshness: 'fresh', authority_owner: 'mind', confidence: 0.95, mind_impact: 'requires_review' }] };
  const first = analyzeMaintenanceIntelligence({ ...input, maxFindings: 1 });
  const second = analyzeMaintenanceIntelligence({ ...input, maxFindings: 1 });
  assert.equal(first.findings.length, 1);
  assert.equal(first.findings[0].mind_review_required, true);
  assert.equal(first.findings[0].authority_owner, 'mind');
  assert.deepEqual(first.findings.map(({ finding_id, domain, category }) => ({ finding_id, domain, category })), second.findings.map(({ finding_id, domain, category }) => ({ finding_id, domain, category })));
  assert.equal(first.summary.canonical_promotions, 0);
});

test('rejects invalid bounds without creating maintenance state', () => {
  assert.throws(() => analyzeMaintenanceIntelligence({ maxFindings: 0 }), /maintenance_inputs_invalid/);
  assert.throws(() => analyzeMaintenanceIntelligence({ observations: {}, maxFindings: 1 }), /maintenance_inputs_invalid/);
});
