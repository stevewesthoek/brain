import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  MACOS_KEYCHAIN_ADAPTER_ID,
  SYNTHETIC_PILOT_REFERENCE,
  createMacOSKeychainAdapter,
  createMacOSKeychainAdapterForTesting,
  parseMacOSKeychainReference,
  redactMacOSKeychainResult,
} from './macos-keychain-adapter.mjs';

function fakeProbeFor(token, calls) {
  return async (args) => {
    calls.push([...args]);
    if (args[0] === '--availability') return { status: 0, token: 'available' };
    return { status: 0, token, stdout: 'synthetic-secret-must-never-escape' };
  };
}

test('Keychain references are opaque, namespace-bound, and shell-safe', () => {
  const parsed = parseMacOSKeychainReference(SYNTHETIC_PILOT_REFERENCE);
  assert.deepEqual(parsed, {
    ok: true,
    reference: SYNTHETIC_PILOT_REFERENCE,
    service: 'com.brain.identity-access.synthetic.pilot',
    account: 'brain-synthetic-pilot',
  });
  assert.equal(parseMacOSKeychainReference('keychain-ref://com.other/service/account').ok, false);
  assert.equal(parseMacOSKeychainReference('keychain-ref://com.brain.test/a%2Fb').ok, false);
  assert.equal(parseMacOSKeychainReference('keychain-ref://com.brain.test/a;rm').ok, false);
});

test('adapter reports only redacted metadata and keeps resolution/mutation unadmitted', async () => {
  const calls = [];
  const adapter = createMacOSKeychainAdapterForTesting({ runProbe: fakeProbeFor('present', calls) });
  const result = await adapter.inspectReference(SYNTHETIC_PILOT_REFERENCE);

  assert.equal(result.ok, true);
  assert.equal(result.storageState, 'present');
  assert.equal(result.providerState, 'unknown');
  assert.equal(result.containsSecrets, false);
  assert.equal(result.secretValueReturned, false);
  assert.equal(JSON.stringify(result).includes('synthetic-secret-must-never-escape'), false);
  assert.deepEqual(adapter.capabilities(), ['metadata_read', 'bounded_consume']);
  assert.equal(typeof adapter.write, 'undefined');
  assert.equal(typeof adapter.delete, 'undefined');
  assert.equal((await adapter.resolveForBoundProcess()).reasonCode, 'resolution_not_admitted_in_pilot');
  assert.deepEqual(calls, [['--availability'], ['com.brain.identity-access.synthetic.pilot', 'brain-synthetic-pilot']]);
});

test('bounded verification accepts only a normalized provider result from the native boundary', async () => {
  const calls = [];
  const adapter = createMacOSKeychainAdapterForTesting({
    runProbe: fakeProbeFor('present', []),
    runBoundary: async (args) => {
      calls.push(args);
      return {
        status: 0,
        output: JSON.stringify({
          boundaryState: 'provider_result',
          resultCode: 'accepted',
          principal: 'fixture.account.02',
          scopes: ['fixture.read'],
          expiresAt: '2099-01-01T00:00:00Z',
          refreshAvailable: false,
          transportCheck: 'stdin_only',
          secret: 'synthetic-secret-must-never-escape',
        }),
      };
    },
  });
  const result = await adapter.invokeBoundedVerification({
    reference: SYNTHETIC_PILOT_REFERENCE,
    verifierId: 'provider:synthetic-local',
    verifierExecutable: process.execPath,
    verifierArgs: [path.join(import.meta.dirname, 'synthetic-provider-verifier.mjs'), '--expected-principal', 'fixture.account.02'],
  });
  assert.equal(result.boundaryState, 'provider_result');
  assert.equal(result.principal, 'fixture.account.02');
  assert.equal(result.secret, undefined);
  assert.equal(JSON.stringify(result).includes('synthetic-secret-must-never-escape'), false);
  assert.deepEqual(calls, [[
    'com.brain.identity-access.synthetic.pilot',
    'brain-synthetic-pilot',
    process.execPath,
    `["${path.join(import.meta.dirname, 'synthetic-provider-verifier.mjs')}","--expected-principal","fixture.account.02"]`,
  ]]);
});

test('bounded verification rejects an unregistered executable or verifier identity', async () => {
  const adapter = createMacOSKeychainAdapterForTesting({
    runProbe: fakeProbeFor('present', []),
    runBoundary: async () => ({ status: 0, output: JSON.stringify({ boundaryState: 'provider_result', resultCode: 'accepted', transportCheck: 'stdin_only' }) }),
  });
  const result = await adapter.invokeBoundedVerification({
    reference: SYNTHETIC_PILOT_REFERENCE,
    verifierId: 'provider:unregistered',
    verifierExecutable: '/bin/sh',
    verifierArgs: ['-c', 'cat'],
  });
  assert.equal(result.boundaryState, 'unknown');
  assert.equal(result.reasonCode, 'invalid_verifier_command');
});

test('missing and denied Keychain states remain distinct from provider health', async () => {
  const missing = createMacOSKeychainAdapterForTesting({ runProbe: fakeProbeFor('missing', []) });
  const missingResult = await missing.inspectReference(SYNTHETIC_PILOT_REFERENCE);
  assert.equal(missingResult.storageState, 'missing');
  assert.equal(missingResult.detailedState, 'credential_missing');
  assert.equal(missingResult.providerState, 'unknown');

  const denied = createMacOSKeychainAdapterForTesting({ runProbe: fakeProbeFor('permission_denied', []) });
  const deniedResult = await denied.inspectReference(SYNTHETIC_PILOT_REFERENCE);
  assert.equal(deniedResult.storageState, 'permission_denied');
  assert.equal(deniedResult.detailedState, 'vault_unavailable');
  assert.equal(deniedResult.providerState, 'unknown');
});

test('probe failures fail closed without returning child-process diagnostics', async () => {
  const adapter = createMacOSKeychainAdapterForTesting({
    runProbe: async () => ({ status: 1, token: '', stderr: 'synthetic-secret-must-never-escape' }),
  });
  const result = await adapter.inspectReference(SYNTHETIC_PILOT_REFERENCE);
  assert.equal(result.storageState, 'unavailable');
  assert.equal(result.diagnosticCode, 'native_probe_unavailable');
  assert.equal(JSON.stringify(result).includes('synthetic-secret-must-never-escape'), false);
});

test('redaction projects only safe health fields', () => {
  const safe = redactMacOSKeychainResult({
    ok: true,
    operation: 'reference_exists',
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    storageState: 'present',
    providerState: 'unknown',
    detailedState: 'credential_present',
    diagnosticCode: 'keychain_item_present',
    secret: 'synthetic-secret-must-never-escape',
  });
  assert.deepEqual(safe, {
    ok: true,
    operation: 'reference_exists',
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    storageState: 'present',
    providerState: 'unknown',
    detailedState: 'credential_present',
    diagnosticCode: 'keychain_item_present',
    containsSecrets: false,
    secretValueReturned: false,
  });
});

test('native helper is metadata-only and has no Keychain mutation or data-return path', () => {
  const source = fs.readFileSync(new URL('./macos-keychain-probe.swift', import.meta.url), 'utf8');
  assert.match(source, /SecItemCopyMatching/);
  assert.match(source, /kSecReturnAttributes/);
  assert.doesNotMatch(source, /kSecReturnData|SecItemAdd|SecItemUpdate|SecItemDelete/);
});

test('native bounded boundary keeps data inside the registered verifier transport', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, 'macos-keychain-verification-boundary.swift'), 'utf8');
  assert.match(source, /kSecReturnData/);
  assert.match(source, /standardInput = inputPipe/);
  assert.match(source, /standardError = FileHandle\.nullDevice/);
  assert.match(source, /verifier_output_rejected/);
  assert.match(source, /result = nil/);
  assert.match(source, /wipe\(&verifierOutput\)/);
  assert.match(fs.readFileSync(new URL('./macos-keychain-adapter.mjs', import.meta.url), 'utf8'), /detached: true/);
  assert.match(fs.readFileSync(new URL('./macos-keychain-adapter.mjs', import.meta.url), 'utf8'), /process\.kill\(-child\.pid, 'SIGKILL'\)/);
  assert.doesNotMatch(source, /getSecret|process\.env|FileHandle\.standardError/);
});

test('native Security.framework probe is fixed to the synthetic pilot reference', { skip: process.platform !== 'darwin' }, async () => {
  const adapter = createMacOSKeychainAdapter();
  const result = await adapter.inspectReference(SYNTHETIC_PILOT_REFERENCE);
  assert.ok(['present', 'missing', 'permission_denied', 'unavailable', 'unknown'].includes(result.storageState));
  assert.equal(result.providerState, 'unknown');
  assert.equal(result.containsSecrets, false);
  assert.equal(result.secretValueReturned, false);
});
