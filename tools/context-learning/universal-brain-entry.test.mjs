import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';

function input() { return { brainRevision: 'brain-rev-001', authorityRegistry: { registryId: 'clr-authority-registry', entries: [] }, capabilities: ['context-broker', 'operating-loop'], operatingView: { view_id: 'operating-view-001', current_state: { observations: { count: 2, ids: ['obs-1', 'obs-2'], freshness: ['fresh', 'stale'] }, conflicts: ['conflict-1'], active_continuity: { status: 'none_valid', resume_allowed: false } }, decision_state: { pending_contexts: ['context-1'], review_boundaries: ['human review'] }, evolution_state: { prepared_transactions: ['tx-1'], validation_status: ['prepared'], learning_receipts: ['receipt-1'] } }, continuity: { selection: { status: 'none_valid', resume_allowed: false }, candidates: ['candidate-1'], conflicts: [] } }; }

test('creates provider-neutral bounded entry with navigation and state discovery', () => {
  const entry = buildUniversalBrainEntry(input());
  assert.equal(entry.identity.provider_neutral, true);
  assert.ok(entry.navigation.brain_authority.includes('AGENTS.md'));
  assert.ok(entry.navigation.mind_authority.length > 0);
  assert.equal(entry.current_state.observations.count, 2);
  assert.equal(entry.decision_awareness.pending_contexts.length, 1);
  assert.equal(entry.safety.execution_authority, false);
});

test('bounds output and preserves no-takeover/no-write safety', () => {
  const entry = buildUniversalBrainEntry({ ...input(), capabilities: Array.from({ length: 50 }, (_, i) => `cap-${i}`), maxItems: 2 });
  assert.equal(entry.navigation.capabilities.length, 2);
  assert.equal(entry.session_state.automatic_takeover, false);
  assert.equal(entry.safety.writes_performed, 0);
  assert.equal(entry.safety.providers_called, 0);
});

test('is deterministic, non-mutating, and fails closed without authority registry', () => {
  const value = input(); const before = JSON.stringify(value);
  assert.deepEqual(buildUniversalBrainEntry(value), buildUniversalBrainEntry(value));
  assert.equal(JSON.stringify(value), before);
  assert.throws(() => buildUniversalBrainEntry({ operatingView: {} }), /authority_registry_required/);
  assert.throws(() => buildUniversalBrainEntry({ ...input(), maxItems: 0 }), /invalid_bound/);
});
