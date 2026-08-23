import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';
import { validateUniversalEntryConformance } from './universal-entry-conformance.mjs';
import { evaluateUniversalActivationGates } from './universal-activation-gates.mjs';

const authority = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }] };
function fixture(client = 'future-agent', overrides = {}) {
  const entry = buildUniversalBrainEntry({ brainRevision: 'gate-revision', authorityRegistry: authority, ...overrides });
  const consumption = consumeUniversalBrainEntry({ entry, environment: client });
  const conformance = validateUniversalEntryConformance({ consumption, client });
  const session = { session_id: 'session-gate-1', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: 'gate-revision', conflicts: [], confirmation_required: true };
  return { entry, consumption, conformance, session };
}

test('all client profiles pass readiness gates without authorization', () => {
  for (const client of ['claude', 'codex', 'workbench', 'future-agent']) {
    const result = evaluateUniversalActivationGates({ ...fixture(client), client });
    assert.equal(result.status, 'ready_for_separate_authorization');
    assert.equal(result.activation_authorized, false);
    assert.equal(result.safety.activation_performed, false);
    assert.equal(result.safety.providers_called, 0);
  }
});

test('stale context, session conflict, and revision mismatch fail closed', () => {
  const stale = fixture('future-agent', { operatingView: { current_state: { observations: { freshness: ['stale'] } } } });
  assert.equal(evaluateUniversalActivationGates({ ...stale, client: 'future-agent' }).status, 'blocked');
  const conflict = fixture();
  assert.equal(evaluateUniversalActivationGates({ ...conflict, session: { ...conflict.session, conflicts: ['other-session'] } }).status, 'blocked');
  const mismatch = fixture();
  assert.equal(evaluateUniversalActivationGates({ ...mismatch, session: { ...mismatch.session, brain_revision: 'different' } }).status, 'blocked');
});

test('missing entry or confirmation never becomes activatable', () => {
  const result = evaluateUniversalActivationGates({ client: 'future-agent', session: { confirmation_required: false } });
  assert.equal(result.status, 'blocked');
  assert.equal(result.activation_authorized, false);
  assert.equal(result.safety.mutation_authority, false);
});
