import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLearningCandidates, buildLearningCandidateReport, compactLearningCandidates } from './learning-candidate-engine.mjs';

const asOf = '2026-09-07T12:00:00.000Z';
let sequence = 0;
function event(statement, overrides = {}) {
  sequence += 1;
  return {
    event_id: `event:test-${sequence}`,
    category: 'lesson',
    statement,
    actor: 'human',
    claim_type: 'user_statement',
    polarity: 'positive',
    observed_at: asOf,
    provenance: { source_system: overrides.source_system ?? 'codex', source_session: `session:${overrides.source_system ?? 'codex'}:${sequence}`, adapter: 'test-adapter' },
    ...overrides,
  };
}

test('repeated independent support strengthens one candidate', () => {
  const result = aggregateLearningCandidates({ events: [event('Use bounded reports', { source_system: 'codex' }), event('Use bounded reports', { source_system: 'claude' })], asOf });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].support_count, 2);
  assert.equal(result.candidates[0].independent_source_count, 2);
  assert.equal(result.candidates[0].lifecycle_state, 'strengthened');
});

test('duplicate replay is idempotent', () => {
  const first = event('Keep evidence report-only');
  const one = aggregateLearningCandidates({ events: [first], asOf });
  const two = aggregateLearningCandidates({ events: [first], existingCandidates: one.candidates, asOf });
  assert.deepEqual(two.candidates, one.candidates);
});

test('contradictions remain visible', () => {
  const result = aggregateLearningCandidates({ events: [event('Cache is enabled'), event('Cache is disabled', { polarity: 'negative', claim_key: 'cache-state' })], asOf });
  assert.equal(result.candidates.length, 2);
  const conflict = aggregateLearningCandidates({ events: [event('Cache is enabled', { claim_key: 'cache-state' }), event('Cache is disabled', { polarity: 'negative', claim_key: 'cache-state' })], asOf });
  assert.equal(conflict.candidates[0].contradiction_count, 1);
  assert.equal(conflict.candidates[0].lifecycle_state, 'conflicted');
});

test('newer verified contradiction is review-ready', () => {
  const result = aggregateLearningCandidates({ events: [event('Service works', { claim_key: 'service-health', observed_at: '2026-09-01T00:00:00Z' }), event('Service failed', { claim_key: 'service-health', polarity: 'negative', actor: 'tool', claim_type: 'runtime_observation', observed_at: '2026-09-07T11:00:00Z' })], canonicalKnowledge: [{ claim_key: 'service-health', statement: 'Service works' }], asOf });
  assert.equal(result.candidates[0].canonical_comparison, 'contradicts_existing');
  assert.equal(result.candidates[0].review_ready, true);
});

test('explicit relations strengthen with independent sources', () => {
  const result = aggregateLearningCandidates({ events: [event('A uses B', { subject_ref: 'A', object_ref: 'B', relation_type: 'uses', source_system: 'codex' }), event('A uses B', { subject_ref: 'A', object_ref: 'B', relation_type: 'uses', source_system: 'claude' })], asOf });
  assert.equal(result.relations[0].relation_type, 'uses');
  assert.equal(result.relations[0].independent_source_count, 2);
  assert.equal(result.relations[0].strength_class, 'strengthened');
});

test('co-occurrence remains weak and is not promoted to a strong relation', () => {
  const result = aggregateLearningCandidates({ events: [event('A and B appeared together', { related_entities: ['A', 'B'] }), event('A and B appeared together', { related_entities: ['A', 'B'] })], asOf });
  assert.equal(result.relations[0].inference_level, 'cooccurrence');
  assert.equal(result.relations[0].strength_class, 'weak');
});

test('infrastructure evidence routes to IKHP evidence candidates only', () => {
  const result = aggregateLearningCandidates({ events: [event('The host is healthy', { routing_classification: 'infrastructure', claim_key: 'host-health' })], asOf });
  assert.equal(result.candidates[0].infrastructure_routing, 'ikhp:evidence-candidate');
  assert.equal(result.report.invariants.ikhp_canonical_mutation, false);
});

test('existing canonical knowledge produces a no-op support comparison', () => {
  const result = aggregateLearningCandidates({ events: [event('Use the approved workflow', { claim_key: 'approved-workflow' })], canonicalKnowledge: [{ claim_key: 'approved-workflow', statement: 'Use the approved workflow' }], asOf });
  assert.equal(result.candidates[0].canonical_comparison, 'supports_existing');
});

test('canonical contradiction remains a review candidate', () => {
  const result = aggregateLearningCandidates({ events: [event('Use the old workflow', { claim_key: 'workflow', polarity: 'negative' })], canonicalKnowledge: [{ claim_key: 'workflow', statement: 'Use the approved workflow' }], asOf });
  assert.equal(result.candidates[0].canonical_comparison, 'contradicts_existing');
  assert.equal(result.report.review_ready_count, 1);
});

test('user corrections are retained as human evidence', () => {
  const result = aggregateLearningCandidates({ events: [event('Preference is concise output', { category: 'improvement', claim_type: 'user_statement' })], asOf });
  assert.ok(result.candidates[0].evidence_strength.includes('human_statement'));
});

test('secret-bearing evidence is represented only by a redacted upstream statement', () => {
  const result = aggregateLearningCandidates({ events: [event('credential was [REDACTED_SECRET]', { redactions: 1 })], asOf });
  assert.doesNotMatch(result.candidates[0].proposed_content, /credential\s*[:=]\s*\S+/i);
});

test('bounded compaction preserves provenance and counts', () => {
  const result = aggregateLearningCandidates({ events: [event('Bound this candidate')], asOf });
  const compacted = compactLearningCandidates(result);
  assert.equal(compacted.candidates[0].compaction.provenance_preserved, true);
  assert.equal(compacted.candidates[0].support_count, result.candidates[0].support_count);
});

test('source deletion retracts active support without deleting history reference', () => {
  const source = event('Source may be withdrawn');
  const result = aggregateLearningCandidates({ events: [source], deletedEvidenceRefs: [source.event_id], asOf });
  assert.equal(result.candidates[0].support_count, 0);
  assert.deepEqual(result.candidates[0].retracted_evidence_refs, [source.event_id]);
});

test('provider-neutral adapters produce the same candidate identity', () => {
  const result = aggregateLearningCandidates({ events: [event('Same proposition', { source_system: 'codex' }), event('Same proposition', { source_system: 'claude' })], asOf });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].independent_source_count, 2);
});

test('restart replay and report generation remain write-free', () => {
  const source = event('Restart safely');
  const result = aggregateLearningCandidates({ events: [source], asOf });
  const replay = aggregateLearningCandidates({ events: [source], existingCandidates: result.candidates, asOf });
  const report = buildLearningCandidateReport(replay);
  assert.equal(report.invariants.writes_to_mind, false);
  assert.deepEqual(replay.candidates, result.candidates);
});
