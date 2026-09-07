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
    service: 'tools.prochat.brain.synthetic.pilot',
    account: 'brain-synthetic-pilot',
  });
  assert.equal(parseMacOSKeychainReference('keychain-ref://com.other/service/account').ok, false);
  assert.equal(parseMacOSKeychainReference('keychain-ref://tools.prochat.brainx/a%2Fb').ok, false);
  assert.equal(parseMacOSKeychainReference('keychain-ref://tools.prochat.brain.test/a;rm').ok, false);
});

test('adapter reports redacted metadata and keeps raw resolution unadmitted', async () => {
  const calls = [];
  const adapter = createMacOSKeychainAdapterForTesting({ runProbe: fakeProbeFor('present', calls) });
  assert.deepEqual(adapter.describe(), {
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    adapterKind: 'os_native_store',
    platform: 'darwin',
    referenceScheme: 'keychain-ref',
    serviceNamespace: 'tools.prochat.brain',
    physicalStore: 'login',
    hostScope: 'host_local',
    synchronization: 'disabled',
    accessibility: 'when_unlocked_this_device_only',
    accessControlModel: 'native_security_framework_with_user_approval',
    capabilities: ['metadata_read', 'metadata_inventory', 'bounded_consume', 'secret_create', 'secret_update', 'secret_delete'],
    unadmittedCapabilities: ['resolve_for_bound_process', 'version_metadata', 'lease_metadata', 'lease_renewal', 'revocation_metadata', 'audit_metadata', 'offline_recovery'],
    mutationMode: 'approval_gated',
    containsSecrets: false,
    secretValueReturned: false,
  });
  const result = await adapter.inspectReference(SYNTHETIC_PILOT_REFERENCE);

  assert.equal(result.ok, true);
  assert.equal(result.storageState, 'present');
  assert.equal(result.providerState, 'unknown');
  assert.equal(result.containsSecrets, false);
  assert.equal(result.secretValueReturned, false);
  assert.equal(JSON.stringify(result).includes('synthetic-secret-must-never-escape'), false);
  assert.deepEqual(adapter.capabilities(), ['metadata_read', 'metadata_inventory', 'bounded_consume', 'secret_create', 'secret_update', 'secret_delete']);
  assert.equal((await adapter.resolveForBoundProcess()).reasonCode, 'resolution_not_admitted_in_pilot');
  assert.deepEqual(calls, [['--availability'], ['tools.prochat.brain.synthetic.pilot', 'brain-synthetic-pilot']]);
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
    'tools.prochat.brain.synthetic.pilot',
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

test('approval-gated lifecycle never exposes secret material and keeps metadata separate', async () => {
  const reference = 'keychain-ref://tools.prochat.brain.synthetic.lifecycle/brain-synthetic-lifecycle';
  const items = new Map();
  const storeCalls = [];
  const runProbe = async (args) => {
    if (args[0] === '--availability') return { status: 0, token: 'available' };
    return { status: 0, token: items.has(String(args[0]) + '/' + String(args[1])) ? 'present' : 'missing' };
  };
  const runStoreCommand = async (args, input = null) => {
    const [operation, service, account, label] = args;
    const key = String(service) + '/' + String(account);
    storeCalls.push({ args: [...args], inputBytes: input?.length ?? 0 });
    if (operation === 'create') {
      if (items.has(key)) return { status: 1, output: JSON.stringify({ operation, ok: false, reasonCode: 'duplicate_item' }) };
      items.set(key, Buffer.from(input));
      return { status: 0, output: JSON.stringify({ operation, ok: true, storageState: 'present', overwrote: false }) };
    }
    if (operation === 'update') {
      if (!items.has(key)) return { status: 1, output: JSON.stringify({ operation, ok: false, reasonCode: 'keychain_item_missing' }) };
      items.set(key, Buffer.from(input));
      return { status: 0, output: JSON.stringify({ operation, ok: true, storageState: 'present', overwrote: true }) };
    }
    if (operation === 'delete') {
      items.delete(key);
      return { status: 0, output: JSON.stringify({ operation, ok: true, storageState: 'missing' }) };
    }
    if (operation === 'inventory') {
      return { status: 0, output: JSON.stringify({ operation, ok: true, storageState: 'available', count: items.size, items: [...items.keys()].map((entry) => { const [serviceName, accountName] = entry.split('/'); return { service: serviceName, account: accountName, label: 'Brain synthetic lifecycle' }; }) }) };
    }
    return { status: 1, output: '' };
  };
  const adapter = createMacOSKeychainAdapterForTesting({
    runProbe,
    runStoreCommand,
    runBoundary: async () => ({
      status: 0,
      output: JSON.stringify({ boundaryState: 'provider_result', resultCode: 'accepted', transportCheck: 'stdin_only' }),
    }),
  });
  const firstSecret = Buffer.from('synthetic-first-secret');
  const secondSecret = Buffer.from('synthetic-second-secret');

  assert.equal((await adapter.create(reference, { secret: firstSecret, operatorConfirmed: false })).reasonCode, 'mutation_approval_required');
  const created = await adapter.create(reference, { secret: firstSecret, label: 'Brain synthetic lifecycle', operatorConfirmed: true });
  assert.equal(created.ok, true);
  assert.equal(created.secretValueReturned, false);
  assert.equal(JSON.stringify(created).includes('synthetic-first-secret'), false);
  assert.deepEqual((await adapter.inspectNamespace()).items, [{
    service: 'tools.prochat.brain.synthetic.lifecycle',
    account: 'brain-synthetic-lifecycle',
    label: 'Brain synthetic lifecycle',
  }]);
  assert.equal((await adapter.inspectReference(reference)).detailedState, 'credential_present');
  const verified = await adapter.read({
    reference,
    verifierId: 'provider:synthetic-local',
    verifierExecutable: process.execPath,
    verifierArgs: [path.join(import.meta.dirname, 'synthetic-provider-verifier.mjs'), '--expected-principal', 'fixture.account.02'],
  });
  assert.equal(verified.boundaryState, 'provider_result');
  const updated = await adapter.update(reference, { secret: secondSecret, operatorConfirmed: true });
  assert.equal(updated.ok, true);
  assert.equal(updated.secretValueReturned, false);
  assert.equal(JSON.stringify(updated).includes('synthetic-second-secret'), false);
  const deleted = await adapter.delete(reference, { operatorConfirmed: true });
  assert.equal(deleted.ok, true);
  assert.equal((await adapter.inspectReference(reference)).detailedState, 'credential_missing');
  assert.equal((await adapter.delete(reference, { operatorConfirmed: false })).reasonCode, 'mutation_approval_required');
  assert.equal(storeCalls.every(({ args }) => args.every((arg) => !['synthetic-first-secret', 'synthetic-second-secret'].includes(String(arg)))), true);
  firstSecret.fill(0);
  secondSecret.fill(0);
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
  assert.equal(deniedResult.detailedState, 'secret_store_locked');
  assert.equal(deniedResult.providerState, 'unknown');
});

test('locked or unavailable Keychain mutations fail closed with a distinct storage state', async () => {
  const denied = createMacOSKeychainAdapterForTesting({
    runProbe: fakeProbeFor('present', []),
    runStoreCommand: async () => ({
      status: 1,
      output: JSON.stringify({ operation: 'update', ok: false, storageState: 'permission_denied', reasonCode: 'keychain_access_denied' }),
    }),
  });
  const deniedResult = await denied.update(SYNTHETIC_PILOT_REFERENCE, { secret: 'synthetic-secret', operatorConfirmed: true });
  assert.equal(deniedResult.ok, false);
  assert.equal(deniedResult.storageState, 'permission_denied');
  assert.equal(deniedResult.secretValueReturned, false);

  const unavailable = createMacOSKeychainAdapterForTesting({
    runProbe: async () => ({ status: 0, token: 'unavailable' }),
  });
  const unavailableResult = await unavailable.create(SYNTHETIC_PILOT_REFERENCE, { secret: 'synthetic-secret', operatorConfirmed: true });
  assert.equal(unavailableResult.ok, false);
  assert.equal(unavailableResult.storageState, 'unavailable');
  assert.equal(unavailableResult.secretValueReturned, false);
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

test('native metadata probe is read-only and has no Keychain mutation or data-return path', () => {
  const source = fs.readFileSync(new URL('./macos-keychain-probe.swift', import.meta.url), 'utf8');
  assert.match(source, /SecItemCopyMatching/);
  assert.match(source, /kSecReturnAttributes/);
  assert.match(source, /kSecUseAuthenticationUIFail/);
  assert.doesNotMatch(source, /kSecReturnData|SecItemAdd|SecItemUpdate|SecItemDelete/);
});

test('native store uses the login Keychain boundary and never uses security CLI secret arguments', () => {
  const source = fs.readFileSync(new URL('./macos-keychain-store.swift', import.meta.url), 'utf8');
  assert.match(source, /SecItemAdd/);
  assert.match(source, /SecItemUpdate/);
  assert.match(source, /SecItemDelete/);
  assert.match(source, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.match(source, /kSecAttrSynchronizable/);
  assert.match(source, /FileHandle\.standardInput\.readDataToEndOfFile/);
  assert.doesNotMatch(source, /Process\(|security\\s/);
  assert.doesNotMatch(source, /kSecReturnData/);
});

test('native synthetic lifecycle stores, verifies, updates, and deletes without secret output', { skip: process.platform !== 'darwin' }, async () => {
  const service = 'tools.prochat.brain.synthetic.e2e';
  const account = 'brain-adapter-e2e';
  const reference = `keychain-ref://${service}/${account}`;
  const firstSecret = Buffer.from('brain-synthetic:v1:fixture.adapter.01:fixture.read:2099-01-01T00:00:00Z:adapter-first');
  const secondSecret = Buffer.from('brain-synthetic:v1:fixture.adapter.02:fixture.read:2099-01-01T00:00:00Z:adapter-second');
  const adapter = createMacOSKeychainAdapter();
  const verifierArgs = (principal) => [
    path.join(import.meta.dirname, 'synthetic-provider-verifier.mjs'),
    '--expected-principal',
    principal,
  ];
  try {
    await adapter.delete(reference, { operatorConfirmed: true });
    const created = await adapter.create(reference, { secret: firstSecret, label: 'Brain synthetic adapter lifecycle', operatorConfirmed: true });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.equal(created.secretValueReturned, false);
    assert.equal((await adapter.inspectReference(reference)).detailedState, 'credential_present');
    const firstRead = await adapter.read({
      reference,
      verifierId: 'provider:synthetic-local',
      verifierExecutable: process.execPath,
      verifierArgs: verifierArgs('fixture.adapter.01'),
    });
    assert.equal(firstRead.resultCode, 'accepted', JSON.stringify(firstRead));
    assert.equal(firstRead.principal, 'fixture.adapter.01');
    assert.equal(JSON.stringify(firstRead).includes(firstSecret.toString()), false);
    const updated = await adapter.update(reference, { secret: secondSecret, operatorConfirmed: true });
    assert.equal(updated.ok, true, JSON.stringify(updated));
    const secondRead = await adapter.read({
      reference,
      verifierId: 'provider:synthetic-local',
      verifierExecutable: process.execPath,
      verifierArgs: verifierArgs('fixture.adapter.02'),
    });
    assert.equal(secondRead.resultCode, 'accepted', JSON.stringify(secondRead));
    assert.equal(secondRead.principal, 'fixture.adapter.02');
    const deleted = await adapter.delete(reference, { operatorConfirmed: true });
    assert.equal(deleted.ok, true, JSON.stringify(deleted));
    assert.equal((await adapter.inspectReference(reference)).detailedState, 'credential_missing');
    const inventory = await adapter.inspectNamespace();
    assert.equal(inventory.containsSecrets, false);
    assert.equal(inventory.items?.some((item) => item.account === account), false);
  } finally {
    await adapter.delete(reference, { operatorConfirmed: true });
    firstSecret.fill(0);
    secondSecret.fill(0);
  }
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
