#!/usr/bin/env node

import { createGitHubProviderAdapter, GITHUB_CREDENTIAL_TYPES } from './github-provider-adapter.mjs';
import { createMacOSKeychainAdapter, parseMacOSKeychainReference } from './macos-keychain-adapter.mjs';
import { verifyCredential } from './credential-verification-boundary.mjs';

const SAFE_ID_RE = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._-]*$/;
const GITHUB_PRINCIPAL_RE = /^[1-9][0-9]{0,19}$/;
const SAFE_SCOPE_RE = /^[^\u0000-\u001f\u007f]{1,256}$/;

function output(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function invalid(reasonCode) {
  output({ ok: false, operation: 'github_credential_verification', reasonCode, containsSecrets: false, secretValueReturned: false });
  process.exitCode = 64;
}

function parseArguments(args) {
  const values = { requiredScopes: [] };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === '--required-scope') {
      const value = args[++index];
      if (typeof value !== 'string' || !SAFE_SCOPE_RE.test(value) || values.requiredScopes.length >= 64) return null;
      values.requiredScopes.push(value);
    } else if (['--credential-id', '--credential-ref', '--expected-principal', '--credential-type'].includes(name)) {
      const value = args[++index];
      if (typeof value !== 'string' || value.length === 0 || values[name.slice(2)] !== undefined) return null;
      values[name.slice(2)] = value;
    } else {
      return null;
    }
  }
  return values;
}

const values = parseArguments(process.argv.slice(2));
if (!values
  || !SAFE_ID_RE.test(values.credentialId ?? '')
  || !parseMacOSKeychainReference(values.credentialRef ?? '').ok
  || !GITHUB_PRINCIPAL_RE.test(values.expectedPrincipal ?? '')
  || !GITHUB_CREDENTIAL_TYPES.includes(values.credentialType)) {
  invalid('invalid_cli_arguments');
} else {
  const observation = await verifyCredential({
    credentialId: values.credentialId,
    credentialRef: values.credentialRef,
    expectedPrincipal: {
      principalType: 'provider_account',
      principalRef: values.expectedPrincipal,
      displayLabel: null,
      matchStrategy: 'provider_asserted_id',
    },
    verificationPolicy: {
      probeMode: 'read_only',
      readOnlyOnly: true,
      requiredScopes: [...new Set(values.requiredScopes)],
    },
    providerAdapter: createGitHubProviderAdapter({ credentialType: values.credentialType }),
    secretStoreAdapter: createMacOSKeychainAdapter(),
  });
  output(observation);
}
