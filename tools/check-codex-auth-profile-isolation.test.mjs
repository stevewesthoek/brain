import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateCodexAuthProfileIsolation, exitCodeForStatus } from './check-codex-auth-profile-isolation.mjs';

const config = { state: 'confirmed', configuredCredentialStore: 'file', storageSelection: 'file' };
const cleanModes = ['file', 'keyring', 'auto'].map((mode) => ({
  mode,
  exitCode: 1,
  signal: null,
  timedOut: false,
  authFileCreated: false,
  profileLayerFiles: ['personal-01.config.toml', 'personal-02.config.toml'],
  profileLayers: [{ profileName: 'personal-01', exitCode: 1, timedOut: false }, { profileName: 'personal-02', exitCode: 1, timedOut: false }],
}));

test('auth profile check reports storage mechanics OK while keeping account guarantees unresolved', () => {
  const result = evaluateCodexAuthProfileIsolation({ config, syntheticModes: cleanModes });
  assert.equal(result.status, 'OK');
  assert.equal(result.multiAccountReadiness, 'not_proven');
  assert.ok(result.warnings.includes('active_account_attribution_unresolved'));
  assert.ok(result.warnings.includes('multi_account_concurrency_unproven'));
  assert.equal(result.rawSecrets, 'none');
});

test('auth profile check fails closed when storage mode or disposable probe is unsafe', () => {
  const result = evaluateCodexAuthProfileIsolation({
    config: { state: 'confirmed', configuredCredentialStore: null },
    syntheticModes: [{ mode: 'file', exitCode: 0, timedOut: false, authFileCreated: true }],
  });
  assert.equal(result.status, 'NOT_OK');
  assert.ok(result.reasons.includes('storage_mode_unspecified'));
  assert.ok(result.reasons.includes('synthetic_storage_probe_failed'));
});

test('CLI status contract makes NOT_OK machine-failing', () => {
  assert.equal(exitCodeForStatus('OK'), 0);
  assert.equal(exitCodeForStatus('NOT_OK'), 1);
  assert.equal(exitCodeForStatus('BLOCKED'), 1);
});
