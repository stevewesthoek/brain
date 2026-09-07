import assert from 'node:assert/strict';
import test from 'node:test';

import { createSyntheticProviderAdapter } from './credential-verification-boundary.mjs';
import { resolveCredentialForConsumer } from './credential-consumer-resolver.mjs';

function admittedCatalog(providerId) {
  return {
    credentials: [{ credentialId: 'credential:shared', accountId: `account:${providerId}`, credentialKind: 'api_key', secretOwner: 'secret_store', secretStoreRef: 'keychain-ref://tools.prochat.brain/credential.shared', secretStoreAdapterId: 'secret-store:macos-keychain', scopeSummary: [], expiryState: 'unknown', expiresAt: null, lifecyclePolicyId: 'life', verificationPolicyId: 'verify', lastVerifiedAt: null, lastKnownState: 'unknown', recoveryRunbookRef: 'runbook://recover', provenance: {} }],
    accounts: [{ accountId: `account:${providerId}`, providerId, expectedPrincipal: { principalRef: `principal:${providerId}` } }],
  };
}

function policy() {
  return { readOnlyOnly: true, probeMode: 'read_only', requiredScopes: [], freshnessSeconds: 3600, backoffSeconds: 30 };
}

function boundedStore() {
  return { invokeBoundedVerification: async ({ verifierArgs }) => ({ boundaryState: 'provider_result', resultCode: 'accepted', providerId: 'synthetic', providerCredentialType: verifierArgs.includes('--expected-principal') ? 'bounded' : 'unknown', principal: verifierArgs[verifierArgs.indexOf('--expected-principal') + 1], scopeEvidence: 'provider_observed', scopes: [] }) };
}

for (const providerId of ['anthropic', 'github']) {
  test(`provider-neutral consumer resolution for ${providerId}`, async () => {
    const catalog = admittedCatalog(providerId);
    const account = catalog.accounts[0];
    const credential = catalog.credentials[0];
    const result = await resolveCredentialForConsumer({ credentialId: credential.credentialId, catalog, account, credential, verificationPolicy: policy(), providerAdapter: createSyntheticProviderAdapter(), secretStoreAdapter: boundedStore(), now: '2030-01-01T00:00:00Z' });
    assert.equal(result.ok, true);
    assert.equal(result.credentialId, 'credential:shared');
    assert.equal(result.secretValueReturned, false);
    assert.equal(result.containsSecrets, false);
  });
}
