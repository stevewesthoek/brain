import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCodexActivationReadiness } from './codex-activation-readiness.mjs';

const session = { session_id: 'codex-pilot-session', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: 'codex-revision', conflicts: [], confirmation_required: true };

test('prepares bounded Codex readiness and continuation context without activating Codex', () => {
  const result = prepareCodexActivationReadiness({ brainRevision: 'codex-revision', session });
  assert.equal(result.client, 'codex');
  assert.equal(result.activation_state, 'READY_NOT_ACTIVATED');
  assert.equal(result.entry_version, '1.0.0');
  assert.equal(result.conformance.conformant, true);
  assert.equal(result.continuation.confirmation_required, true);
  assert.ok(result.continuation.context_pointers.brain_authority.length > 0);
  assert.equal(result.safety.codex_configuration_changed, false);
  assert.equal(result.safety.writes_performed, 0);
  assert.equal(result.safety.providers_called, 0);
});

test('Codex readiness fails closed for revision mismatch and session conflict', () => {
  const mismatch = prepareCodexActivationReadiness({ brainRevision: 'codex-revision', session: { ...session, brain_revision: 'old-revision' } });
  const conflict = prepareCodexActivationReadiness({ brainRevision: 'codex-revision', session: { ...session, conflicts: ['other-session'] } });
  assert.equal(mismatch.activation_state, 'BLOCKED');
  assert.equal(conflict.activation_state, 'BLOCKED');
  assert.equal(mismatch.gates.fail_closed, true);
  assert.equal(conflict.safety.automatic_resume, false);
});

test('missing session cannot create a Codex continuation or authority', () => {
  const result = prepareCodexActivationReadiness({ brainRevision: 'codex-revision' });
  assert.equal(result.activation_state, 'BLOCKED');
  assert.equal(result.continuation, null);
  assert.equal(result.safety.execution_authority, false);
});
