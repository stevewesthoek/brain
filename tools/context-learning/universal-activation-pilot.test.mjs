import test from 'node:test';
import assert from 'node:assert/strict';
import { runUniversalActivationPilot } from './universal-activation-pilot.mjs';

test('runs one bounded future-agent pilot with visible metrics and no external activation', () => {
  const result = runUniversalActivationPilot();
  assert.equal(result.pilot_environment, 'future-agent');
  assert.equal(result.pilot_activated, true);
  assert.equal(result.external_client_activated, false);
  assert.equal(result.activation_authorized, false);
  assert.ok(result.metrics.bootstrap_bytes > 0);
  assert.equal(result.metrics.secrets_loaded, true);
  assert.equal(result.metrics.freshness_visible, true);
  assert.equal(result.metrics.authority_visible, true);
  assert.equal(result.safety.writes_performed, 0);
  assert.equal(result.safety.providers_called, 0);
});

test('pilot fails closed on stale context and preserves rollback safety', () => {
  const result = runUniversalActivationPilot();
  assert.equal(result.gates.fail_closed, false);
  assert.match(result.rollback.action, /enabled=false/);
  assert.equal(result.safety.execution_authority, false);
});

test('disable path performs no consumption and is reversible', () => {
  const result = runUniversalActivationPilot({ enabled: false });
  assert.equal(result.pilot_activated, false);
  assert.equal(result.disabled, true);
  assert.equal(result.rollback.disabled, true);
  assert.equal(result.safety.writes_performed, 0);
});
