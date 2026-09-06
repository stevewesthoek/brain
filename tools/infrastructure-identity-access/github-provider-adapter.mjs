#!/usr/bin/env node

import path from 'node:path';

export const GITHUB_PROVIDER_ID = 'github';
export const GITHUB_VERIFIER_ID = 'provider:github-readonly';
export const GITHUB_VERIFIER_SCRIPT = path.join(import.meta.dirname, 'github-provider-verifier.mjs');
export const GITHUB_CREDENTIAL_TYPES = Object.freeze([
  'fine_grained_pat',
  'classic_pat',
  'oauth_access_token',
  'github_app_user_token',
  'other',
  'unknown',
]);

export function createGitHubProviderAdapter({ credentialType = 'unknown' } = {}) {
  if (!GITHUB_CREDENTIAL_TYPES.includes(credentialType)) {
    throw new TypeError('unsupported GitHub credential type');
  }
  return Object.freeze({
    adapterId: GITHUB_PROVIDER_ID,
    verifierId: GITHUB_VERIFIER_ID,
    credentialType,
    buildVerificationInvocation() {
      return Object.freeze({
        verifierId: GITHUB_VERIFIER_ID,
        executable: process.execPath,
        args: [GITHUB_VERIFIER_SCRIPT, '--credential-type', credentialType],
      });
    },
  });
}
