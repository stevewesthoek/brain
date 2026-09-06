#!/usr/bin/env node

import { createDefaultSyntheticVerification, verifyCredential } from './credential-verification-boundary.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
}

const credentialRef = argument('--credential-ref');
const expectedPrincipal = argument('--expected-principal');
const credentialId = argument('--credential-id') || 'credential:synthetic.e2e';
const requiredScopes = ['fixture.read'];
const { secretStoreAdapter, providerAdapter } = createDefaultSyntheticVerification();

const observation = await verifyCredential({
  credentialId,
  credentialRef,
  expectedPrincipal: {
    principalType: 'provider_account',
    principalRef: expectedPrincipal,
    displayLabel: 'synthetic',
    matchStrategy: 'provider_asserted_subject',
  },
  verificationPolicy: {
    probeMode: 'read_only',
    readOnlyOnly: true,
    requiredScopes,
  },
  providerAdapter,
  secretStoreAdapter,
});

process.stdout.write(`${JSON.stringify(observation)}\n`);
