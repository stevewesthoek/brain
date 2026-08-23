import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedIntelligenceBriefing, renderUnifiedIntelligenceBriefing, writeUnifiedIntelligenceBriefing } from './mind-steward-unified-intelligence-briefing.mjs';

const base = (overrides = {}) => ({ review_id: `review:${overrides.source_type ?? 'x'}:1`, source_type: overrides.source_type ?? 'source', source_reference: overrides.source_reference ?? 'source.md', source_hash: null, provenance: { evidence_references: ['evidence.md'] }, confidence: 0.8, uncertainty: [], freshness: 'fresh', mind_impact: 'none', brain_impact: 'none', requires_human_decision: true, review_state: 'needs_review', ...overrides });

test('groups explicit evidence signals without inferring human importance', () => {
  const briefing = buildUnifiedIntelligenceBriefing({ generated_at: '2026-08-23T00:00:00Z', items: [
    base({ source_type: 'stale', freshness: 'stale' }),
    base({ source_type: 'material', mind_impact: 'material' }),
    base({ source_type: 'plain', extracted_information: 'important but unclassified' }),
    base({ source_type: 'deferred', review_state: 'deferred' }),
    base({ source_type: 'archive', review_state: 'archived' }),
  ] });
  assert.equal(briefing.counts.urgent_review, 1);
  assert.equal(briefing.counts.important_review, 1);
  assert.equal(briefing.counts.informational, 1);
  assert.equal(briefing.counts.deferred, 1);
  assert.equal(briefing.counts.historical, 1);
  assert.equal(briefing.groups.informational[0].source_type, 'plain');
});

test('preserves provenance, human actions, and safety invariants', () => {
  const briefing = buildUnifiedIntelligenceBriefing({ generated_at: 'fixed', items: [base({ source_hash: 'sha256:x' })] });
  const item = briefing.attention_queue[0];
  assert.deepEqual(item.briefing.supporting_evidence, ['source.md', 'sha256:x', 'evidence.md']);
  assert.deepEqual(item.briefing.available_actions, ['review', 'accept', 'reject', 'defer', 'archive']);
  assert.equal(item.requires_human_decision, true);
  assert.equal(briefing.invariants.automatic_decisions, false);
  assert.equal(briefing.invariants.automatic_prioritization_of_human_meaning, false);
});

test('rendering is deterministic and output remains runtime-local', () => {
  const projection = { generated_at: 'fixed', items: [base({ source_reference: 'b.md' }), base({ source_reference: 'a.md' })] };
  const first = buildUnifiedIntelligenceBriefing(projection);
  const second = buildUnifiedIntelligenceBriefing(projection);
  assert.equal(renderUnifiedIntelligenceBriefing(first), renderUnifiedIntelligenceBriefing(second));
  assert.throws(() => writeUnifiedIntelligenceBriefing({ briefing: first, repoRoot: '/tmp/brain', outputRoot: '/tmp/out' }), /unsafe_unified_briefing_output/);
});
