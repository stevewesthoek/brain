import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCredentialResolution,
  admitBrainCreatedCredential,
  buildRotationPlan,
  buildVaultDoctor,
  classifyRetirement,
  credentialIdFromKeychainAccount,
  inspectCredentialMetadata,
  keychainAccountForCredential,
  keychainReferenceForCredential,
  reconcileCredentialInventory,
} from './credential-vault-core.mjs';

const catalog = {
  accounts: [{ accountId: 'account:synthetic', lifecycleState: 'enrolled', runtimeProfileIds: ['runtime:synthetic'] }],
  credentials: [{ credentialId: 'credential:synthetic', accountId: 'account:synthetic', secretOwner: 'secret_store', secretStoreRef: 'keychain-ref://tools.prochat.brain/credential.synthetic', scopeSummary: ['synthetic'], verificationPolicyId: 'verification:synthetic', lifecyclePolicyId: 'lifecycle:synthetic', recoveryRunbookRef: 'runbook:recovery', lastKnownState: 'unknown' }],
};

test('opaque credential references map to the canonical host-local Keychain identity', () => {
  assert.equal(keychainAccountForCredential('credential:synthetic'), 'credential.synthetic');
  assert.equal(keychainReferenceForCredential('credential:synthetic'), 'keychain-ref://tools.prochat.brain/credential.synthetic');
  assert.equal(credentialIdFromKeychainAccount('credential.synthetic'), 'credential:synthetic');
  assert.throws(() => keychainAccountForCredential('credential:bad/value'), /invalid_credential_reference/);
});

test('inventory reconciliation detects missing, duplicate, and orphan records without data reads', () => {
  const result = reconcileCredentialInventory({ catalog, inventory: { items: [
    { service: 'tools.prochat.brain', account: 'credential.orphan', label: 'orphan' },
    { service: 'tools.prochat.brain', account: 'credential.synthetic', label: 'synthetic' },
    { service: 'tools.prochat.brain', account: 'credential.synthetic', label: 'duplicate' },
  ] } });
  assert.equal(result.orphanCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.missingCount, 0);
  assert.ok(result.items.every((item) => item.containsSecrets === false));
});

test('catalog credential absence is distinct from Keychain absence', () => {
  const metadata = inspectCredentialMetadata({ credentialId: 'credential:missing', catalog, inventoryItems: [] });
  assert.equal(metadata.catalogState, 'not_cataloged');
  assert.equal(metadata.keychainItemCount, 0);
  assert.equal(buildCredentialResolution({ credentialId: 'credential:missing', catalog }).reasonCode, 'credential_not_cataloged');
});

test('resolution exposes only an opaque reference and metadata', () => {
  const resolved = buildCredentialResolution({ credentialId: 'credential:synthetic', catalog });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.reference, 'keychain-ref://tools.prochat.brain/credential.synthetic');
  assert.equal(resolved.secretValueReturned, false);
  assert.equal(JSON.stringify(resolved).includes('synthetic-value'), false);
});

test('Brain-created credentials enter the native store from bounded memory and wipe the producer buffer', async () => {
  const brainCatalog = JSON.parse(JSON.stringify(catalog));
  brainCatalog.credentials[0].materialization = 'os_native_store';
  const observed = [];
  const secret = Buffer.from('synthetic-only-value');
  const result = await admitBrainCreatedCredential({
    credentialId: 'credential:synthetic',
    catalog: brainCatalog,
    producerAuthority: 'brain-owned-creation',
    secret,
    adapter: { create: async (reference, options) => { observed.push({ reference, secret: Buffer.from(options.secret), operatorConfirmed: options.operatorConfirmed }); return { ok: true, storageState: 'present' }; } },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(observed, [{ reference: 'keychain-ref://tools.prochat.brain/credential.synthetic', secret: Buffer.from('synthetic-only-value'), operatorConfirmed: true }]);
  assert.deepEqual(secret, Buffer.alloc(secret.length));
  assert.equal(result.containsSecrets, false);
});

test('retirement distinguishes local deletion from provider revocation', () => {
  const result = classifyRetirement({ localDelete: true, catalogRetire: true, providerRevoke: false });
  assert.equal(result.localKeychainDeletion, 'requested');
  assert.equal(result.catalogRetirement, 'requested');
  assert.equal(result.providerRevocation, 'not_requested');
  assert.equal(result.providerRevocationImpliedByLocalDelete, false);
});

test('rotation plans preserve lifecycle state and separate provider revocation', () => {
  const plan = buildRotationPlan({ credential: { credentialId: 'credential:synthetic', versionMetadata: { activeVersion: 'v2', versions: [{ version: 'v1', createdAt: '2026-01-01T00:00:00Z', lastVerifiedAt: null, state: 'retired' }, { version: 'v2', createdAt: '2026-02-01T00:00:00Z', lastVerifiedAt: null, state: 'active' }], rotationPolicy: 'approval_gated', replacementState: 'none', retirementState: 'active' } }, now: '2026-09-07T00:00:00Z' });
  assert.equal(plan.replacementVersion, 'v3');
  assert.equal(plan.preserveLifecycleState, true);
  assert.equal(plan.providerRevocation, 'separate_explicit_operation');
});

test('doctor reports orphan and duplicate findings as attention, never auto-repair', () => {
  const doctor = buildVaultDoctor({ snapshot: {
    availability: { ok: true, diagnosticCode: 'native_keychain_available' },
    reconciliation: { missingCount: 0, orphanCount: 1, duplicateCount: 1, retiredPresent: [{ account: 'credential.retired' }], multipleActiveVersions: [] },
  } });
  assert.equal(doctor.safeToProceed, true);
  assert.equal(doctor.checks.filter((check) => check.status === 'attention').length, 3);
});
