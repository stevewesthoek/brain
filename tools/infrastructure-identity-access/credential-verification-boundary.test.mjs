import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';
import { verifyCredential } from './credential-verification-boundary.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
const baseInput = {
  credentialId: 'credential:fixture.account.02',
  credentialRef: 'keychain-ref://com.brain.identity-access.synthetic.e2e/brain-verification-e2e',
  expectedPrincipal: {
    principalType: 'provider_account',
    principalRef: 'fixture.account.02',
    displayLabel: 'synthetic-secondary',
    matchStrategy: 'provider_asserted_subject',
  },
  verificationPolicy: {
    probeMode: 'read_only',
    readOnlyOnly: true,
    requiredScopes: ['fixture.read'],
    expiringWithinSeconds: 3600,
  },
  now: '2030-01-01T00:00:00Z',
};

function providerAdapter(mode = 'normal') {
  return {
    adapterId: 'provider:synthetic-local',
      buildVerificationInvocation({ expectedPrincipalRef, requiredScopes }) {
        return {
          verifierId: 'provider:test-verifier',
          executable: '/usr/bin/node',
        args: ['synthetic-provider-verifier.mjs', '--mode', mode, '--expected-principal', expectedPrincipalRef, '--required-scopes-json', JSON.stringify(requiredScopes)],
      };
    },
  };
}

function secretStoreAdapter(boundaryResult, calls = []) {
  return {
    async invokeBoundedVerification(invocation) {
      calls.push(invocation);
      return boundaryResult;
    },
  };
}

function assertObservation(observation, detailedState, normalizedStatus) {
  assert.equal(observation.detailedState, detailedState);
  assert.equal(observation.normalizedStatus, normalizedStatus);
  assert.equal(validateJsonSchema(schema.$defs.verificationObservation, observation, schema).length, 0);
  assert.equal(JSON.stringify(observation).includes('synthetic-canary-secret'), false);
}

test('provider-neutral verification normalizes a healthy result without exposing provider payload extras', async () => {
  const calls = [];
  const observation = await verifyCredential({
    ...baseInput,
    providerAdapter: providerAdapter(),
    secretStoreAdapter: secretStoreAdapter({
      boundaryState: 'provider_result',
      resultCode: 'accepted',
      principal: 'fixture.account.02',
      scopes: ['fixture.read'],
      expiresAt: '2030-12-31T00:00:00Z',
      refreshAvailable: false,
      secret: 'synthetic-canary-secret',
    }, calls),
  });
  assertObservation(observation, 'verified_healthy', 'healthy');
  assert.equal(observation.expectedPrincipalMatch, 'verified');
  assert.equal(observation.observedPrincipalRef, 'fixture.account.02');
  assert.deepEqual(observation.observedScopeSummary, ['fixture.read']);
  assert.equal(observation.refreshAvailable, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].verifierArgs.some((value) => value.includes('synthetic-canary-secret')), false);
});

test('expected-principal mismatch fails closed as wrong_account', async () => {
  const observation = await verifyCredential({
    ...baseInput,
    expectedPrincipal: { ...baseInput.expectedPrincipal, principalRef: 'fixture.account.01' },
    providerAdapter: providerAdapter(),
    secretStoreAdapter: secretStoreAdapter({ boundaryState: 'provider_result', resultCode: 'accepted', principal: 'fixture.account.02', scopes: ['fixture.read'] }),
  });
  assertObservation(observation, 'wrong_account', 'unhealthy');
  assert.equal(observation.expectedPrincipalMatch, 'mismatched');
});

test('credential, provider, scope, expiry, refresh, and reauthentication states remain canonical', async () => {
  const cases = [
    [{ boundaryState: 'credential_missing' }, 'credential_missing', 'unhealthy'],
    [{ boundaryState: 'vault_unavailable' }, 'vault_unavailable', 'degraded'],
    [{ boundaryState: 'provider_result', resultCode: 'rejected' }, 'provider_rejected', 'unhealthy'],
    [{ boundaryState: 'provider_result', resultCode: 'revoked' }, 'provider_revoked', 'unhealthy'],
    [{ boundaryState: 'provider_result', resultCode: 'provider_unavailable' }, 'provider_unavailable', 'degraded'],
    [{ boundaryState: 'provider_result', resultCode: 'reauthentication_required' }, 'interactive_reauthentication_required', 'degraded'],
    [{ boundaryState: 'provider_result', resultCode: 'refresh_available' }, 'refresh_available', 'degraded'],
    [{ boundaryState: 'provider_result', resultCode: 'accepted', principal: 'fixture.account.02', scopes: [] }, 'insufficient_scope', 'unhealthy'],
    [{ boundaryState: 'provider_result', resultCode: 'accepted', principal: 'fixture.account.02', scopes: ['fixture.read'], expiresAt: '2029-12-31T00:00:00Z' }, 'credential_expired', 'unhealthy'],
    [{ boundaryState: 'provider_result', resultCode: 'accepted', principal: 'fixture.account.02', scopes: ['fixture.read'], expiresAt: '2030-01-01T00:30:00Z' }, 'credential_expiring', 'degraded'],
  ];
  for (const [boundaryResult, detailedState, status] of cases) {
    const observation = await verifyCredential({
      ...baseInput,
      providerAdapter: providerAdapter(),
      secretStoreAdapter: secretStoreAdapter(boundaryResult),
    });
    assertObservation(observation, detailedState, status);
  }
});

test('locked or denied Keychain and invalid boundary states never become healthy', async () => {
  for (const boundaryResult of [
    { boundaryState: 'permission_denied', reasonCode: 'keychain_access_denied' },
    { boundaryState: 'unknown', reasonCode: 'verifier_output_rejected' },
  ]) {
    const observation = await verifyCredential({
      ...baseInput,
      providerAdapter: providerAdapter(),
      secretStoreAdapter: secretStoreAdapter(boundaryResult),
    });
    assertObservation(observation, boundaryResult.boundaryState === 'permission_denied' ? 'vault_unavailable' : 'unknown', boundaryResult.boundaryState === 'permission_denied' ? 'degraded' : 'unknown');
  }
});

test('invalid policy or missing adapters returns a redacted unknown observation without invoking anything', async () => {
  const observation = await verifyCredential({
    ...baseInput,
    verificationPolicy: { ...baseInput.verificationPolicy, readOnlyOnly: false },
    providerAdapter: providerAdapter(),
    secretStoreAdapter: secretStoreAdapter({ boundaryState: 'provider_result', resultCode: 'accepted', principal: 'fixture.account.02', scopes: ['fixture.read'] }),
  });
  assertObservation(observation, 'unknown', 'unknown');
  assert.deepEqual(observation.conditionCodes, ['identity_verification_unknown']);
});
