import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCodexRuntimeObserver,
  safeBundleMetadata,
  safeCodexConfigMetadata,
  safeDevStatusResult,
  safeDoctorResult,
  safeNativeLoginResult,
} from './codex-runtime-adapter.mjs';
import { runObservationAdapter } from './observation-core.mjs';

const observationSchema = {
  $defs: {
    observation: {
      type: 'object',
      required: [],
    },
  },
};

function doctorFixture() {
  return safeDoctorResult({
    ok: true,
    status: 0,
    stdout: JSON.stringify({ ok: true, mode: 'full', checks: [
      'config', 'browser-host', 'codex', 'service', 'proxy', 'tunnel-binary', 'tunnel-key', 'tunnel-service', 'tunnel-runtime',
    ].map((id) => ({ id, status: 'ok' })).concat([{ id: 'connector', status: 'warning' }]) }),
  });
}

test('Codex provider adapter normalizes supported status without account or credential material', async () => {
  const adapter = createCodexRuntimeObserver();
  const result = await runObservationAdapter(adapter, {
    now: '2026-09-05T00:00:00Z',
    doctor: doctorFixture(),
    dev: safeDevStatusResult({ ok: true, status: 0, stdout: JSON.stringify({ config: { configured: true, mode: 'full', purpose: 'dev-harness' }, launcher: { running: false, profile: 'development' }, mcpRuntime: { required: true, ready: false }, features: { biggerContext: false } }) }),
    nativeLogin: safeNativeLoginResult({ ok: true, status: 0, stdout: 'Authenticated for a user\n', stderr: '' }),
    bundle: safeBundleMetadata({ ok: true, stdout: '5.0.2\ncom.openai.codexwebgpt\n' }),
    nativeBundle: safeBundleMetadata({ ok: true, stdout: '26.901.31953\ncom.openai.codex\n' }),
    codexConfig: safeCodexConfigMetadata({ configPath: '/synthetic/config.toml', readFile: () => 'cli_auth_credentials_store = "keyring"\n' }),
    localRuntime: {
      processes: [
        { pid: 101, parentPid: 1, commandIdentity: 'codex-web-gpt', state: 'S' },
        { pid: 102, parentPid: 1, commandIdentity: 'tunnel-client', state: 'S' },
        { pid: 103, parentPid: 101, commandIdentity: 'bun', state: 'S' },
        { pid: 104, parentPid: 1, commandIdentity: 'codex', state: 'S' },
      ],
      listeners: [{ ownerProcessId: 103, commandIdentity: 'bun', protocol: 'tcp', hostClass: 'loopback', port: 17841, reachability: 'listening' }],
    },
  });
  assert.equal(result.observations.length, 5);
  assert.equal(result.observations[0].status, 'degraded');
  assert.equal(result.observations[4].status, 'unknown');
  assert.equal(result.observations[3].identityBindingEvidence.accountRefs.length, 0);
  assert.equal(result.observations[3].metricsSummary.configuredCredentialStore, 'keyring');
  assert.equal(result.observations[3].runtimeIdentity.profileRef, 'runtime_profile:native-codex-current');
  assert.equal(result.containsSecrets, false);
});

test('safe parsers classify unavailable or unauthenticated state without returning raw output', () => {
  assert.deepEqual(safeNativeLoginResult({ ok: false, status: 1, stderr: 'not authenticated for account@example.invalid', stdout: '' }), { state: 'confirmed', status: 'not_authenticated' });
  assert.deepEqual(safeBundleMetadata({ ok: false, stdout: '' }), { state: 'unknown', bundleId: null, version: null });
  assert.equal(safeDoctorResult({ ok: false, status: 1, errorCode: 'ENOENT', stdout: '' }).state, 'unknown');
  assert.deepEqual(safeCodexConfigMetadata({ configPath: '/synthetic/config.toml', readFile: () => 'cli_auth_credentials_store = "file"\n' }), {
    state: 'confirmed',
    configPresent: true,
    configuredCredentialStore: 'file',
    storageSelection: 'file',
    pathBasis: 'default_CODEX_HOME',
  });
  assert.equal(safeCodexConfigMetadata({ configPath: '/synthetic/config.toml', readFile: () => '# no storage override\n' }).storageSelection, 'unspecified');
});
