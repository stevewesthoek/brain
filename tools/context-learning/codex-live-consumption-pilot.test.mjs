import test from 'node:test';
import assert from 'node:assert/strict';
import { runCodexLiveConsumptionPilot } from './codex-live-consumption-pilot.mjs';

const source = { repository: 'brain', worktree: 'brain-main', branch: 'main', head_revision: 'live-codex-revision', dirty_item_count: 3 };
const session = { session_id: 'codex-live-session', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: 'live-codex-revision', conflicts: [], confirmation_required: true };

test('consumes the real Codex path with bounded metrics and no external side effects', () => {
  const result = runCodexLiveConsumptionPilot({ source, session });
  assert.equal(result.live_consumed, true);
  assert.equal(result.activation_state, 'LIVE_BOUNDED_READ_ONLY');
  assert.equal(result.continuity.repository_bound, true);
  assert.equal(result.continuity.worktree_bound, true);
  assert.equal(result.continuity.revision_compatible, true);
  assert.equal(result.metrics.full_repository_loaded, false);
  assert.equal(result.metrics.transcripts_loaded, false);
  assert.equal(result.metrics.secrets_loaded, false);
  assert.equal(result.safety.writes_performed, 0);
  assert.equal(result.safety.providers_called, 0);
});

test('source identity and session conflicts fail closed', () => {
  const missing = runCodexLiveConsumptionPilot({ session });
  const mismatch = runCodexLiveConsumptionPilot({ source, session: { ...session, brain_revision: 'old' } });
  assert.equal(missing.activation_state, 'BLOCKED');
  assert.equal(missing.fail_closed, true);
  assert.equal(mismatch.activation_state, 'BLOCKED');
  assert.equal(mismatch.failure_behavior, 'fail_closed');
});

test('rollback disables live consumption without changing Codex state', () => {
  const result = runCodexLiveConsumptionPilot({ source, session, enabled: false });
  assert.equal(result.live_consumed, false);
  assert.equal(result.disabled, true);
  assert.equal(result.safety.codex_configuration_changed, false);
});
