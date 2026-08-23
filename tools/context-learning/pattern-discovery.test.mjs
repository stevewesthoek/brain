import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverPatterns } from './pattern-discovery.mjs';

function signal(overrides = {}) {
  return { signal_id: 'signal-001', proposal_id: 'prop-001', transaction_id: 'tx-001', category: 'knowledge-lifecycle-stale_information', decision: 'approved', usefulness: 'supported', confidence: 0.8, evidence_refs: ['finding-001'], provenance: { proposal_id: 'prop-001', validation_refs: ['validation-001'], rollback_refs: ['rollback-001'] }, mind_impact: 'none', ...overrides };
}

test('groups recurring signals with provenance and human-review conclusion', () => {
  const report = discoverPatterns({ signals: [signal(), signal({ signal_id: 'signal-002', proposal_id: 'prop-002', transaction_id: 'tx-002', evidence_refs: ['finding-002'], provenance: { proposal_id: 'prop-002', validation_refs: ['validation-002'], rollback_refs: ['rollback-002'] } })] });
  assert.equal(report.patterns.length, 3);
  const category = report.patterns.find((pattern) => pattern.pattern_key.includes('category:'));
  assert.equal(category.signal_count, 2);
  assert.ok(category.evidence_refs.includes('rollback-001'));
  assert.equal(category.conclusion, 'recurring_pattern_for_human_review');
  assert.equal(report.summary.proposals_created, 0);
});

test('preserves uncertainty and does not invent conclusions', () => {
  const report = discoverPatterns({ signals: [signal({ usefulness: 'unknown', confidence: undefined }), signal({ signal_id: 'signal-002', proposal_id: 'prop-002', transaction_id: 'tx-002', usefulness: 'unknown', confidence: undefined, provenance: { proposal_id: 'prop-002', validation_refs: [], rollback_refs: [] } })] });
  const pattern = report.patterns.find((item) => item.pattern_key === 'usefulness:unknown');
  assert.equal(pattern.usefulness.unknown, 2);
  assert.equal(pattern.confidence.mean, null);
  assert.equal(pattern.conclusion, 'recurring_pattern_for_human_review');
});

test('output is deterministic, non-mutating, and rejects broken provenance', () => {
  const signals = [signal(), signal({ signal_id: 'signal-002', proposal_id: 'prop-002', transaction_id: 'tx-002', provenance: { proposal_id: 'prop-002', validation_refs: [], rollback_refs: [] } })];
  const before = JSON.stringify(signals);
  assert.deepEqual(discoverPatterns({ signals }), discoverPatterns({ signals }));
  assert.equal(JSON.stringify(signals), before);
  assert.throws(() => discoverPatterns({ signals: [signal({ provenance: { proposal_id: 'other' } })] }), /signal_provenance_invalid/);
  assert.equal(discoverPatterns({ signals, minimumOccurrences: 3 }).patterns.length, 0);
});
