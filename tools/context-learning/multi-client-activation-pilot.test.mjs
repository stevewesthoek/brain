import test from 'node:test';
import assert from 'node:assert/strict';
import { runMultiClientActivationPilot } from './multi-client-activation-pilot.mjs';

test('all primary clients consume one shared bounded entry', () => {
  const result = runMultiClientActivationPilot({ brainRevision: 'multi-revision' });
  for (const client of ['claude', 'codex', 'workbench']) {
    assert.equal(result.clients[client].activation_state, 'LIVE_BOUNDED_READ_ONLY');
    assert.equal(result.clients[client].conformance, true);
    assert.equal(result.clients[client].bootstrap_bytes > 0, true);
    assert.equal(result.clients[client].freshness_visible, true);
    assert.equal(result.clients[client].authority_visible, true);
    assert.equal(result.clients[client].activation_authorized, false);
  }
  assert.equal(result.shared_contract.same_entry, true);
  assert.equal(result.shared_contract.provider_neutral, true);
  assert.equal(result.safety.writes_performed, 0);
  assert.equal(result.safety.providers_called, 0);
});

test('one client conflict blocks only that client and preserves shared safety', () => {
  const result = runMultiClientActivationPilot({ brainRevision: 'multi-revision', sessions: { codex: { session_id: 'codex-conflict', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: 'old', conflicts: ['claude-session'], confirmation_required: true } } });
  assert.equal(result.clients.claude.activation_state, 'LIVE_BOUNDED_READ_ONLY');
  assert.equal(result.clients.workbench.activation_state, 'LIVE_BOUNDED_READ_ONLY');
  assert.equal(result.clients.codex.activation_state, 'BLOCKED');
  assert.equal(result.clients.codex.safety.automatic_takeover, false);
});

test('disable path is reversible and does not touch client configuration', () => {
  const result = runMultiClientActivationPilot({ enabled: false });
  assert.equal(result.enabled, false);
  assert.deepEqual(result.clients, {});
  assert.equal(result.safety.execution_authority, false);
  assert.equal(result.rollback.disabled, true);
});
