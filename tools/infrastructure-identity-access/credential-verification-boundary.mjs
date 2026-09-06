#!/usr/bin/env node

import path from 'node:path';
import { createMacOSKeychainAdapter } from './macos-keychain-adapter.mjs';

const IDENTIFIER_RE = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._-]*$/;
const PRINCIPAL_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/;
const SYNTHETIC_VERIFIER_SCRIPT = path.join(import.meta.dirname, 'synthetic-provider-verifier.mjs');
const SYNTHETIC_PROVIDER_ADAPTER_ID = 'provider:synthetic-local';
const FALLBACK_CREDENTIAL_ID = 'credential:verification-boundary';
const DEFAULT_EXPIRING_WINDOW_SECONDS = 86400;
const RESULT_CODES = new Set(['accepted', 'rejected', 'revoked', 'provider_unavailable', 'reauthentication_required', 'refresh_available', 'unknown']);
const SCOPE_EVIDENCE = new Set(['provider_observed', 'declared_only', 'not_observable', 'unknown']);
const METADATA_SOURCES = new Set(['user_declared', 'provider_observed', 'policy_derived', 'unknown']);
const SAFE_METADATA_RE = /^[a-z][a-z0-9._-]{0,127}$/;

function isSafePrincipal(value) {
  return typeof value === 'string' && PRINCIPAL_RE.test(value);
}

function isSafeScope(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeMetadataIdentifier(value) {
  return typeof value === 'string' && SAFE_METADATA_RE.test(value);
}

function safeCredentialId(value) {
  return typeof value === 'string' && IDENTIFIER_RE.test(value) ? value : FALLBACK_CREDENTIAL_ID;
}

function observationId(credentialId) {
  return `observation:${credentialId}.bounded-verification`;
}

function normalizedStatus(detailedState) {
  if (detailedState === 'verified_healthy') return 'healthy';
  if (['wrong_account', 'credential_missing', 'credential_expired', 'provider_rejected', 'provider_revoked', 'insufficient_scope'].includes(detailedState)) return 'unhealthy';
  if (['vault_unavailable', 'provider_unavailable', 'interactive_reauthentication_required', 'credential_expiring', 'refresh_available'].includes(detailedState)) return 'degraded';
  return 'unknown';
}

function conditionCode(detailedState) {
  const codes = {
    verified_healthy: [],
    credential_missing: ['identity_credential_missing'],
    vault_unavailable: ['identity_secret_store_unavailable'],
    provider_rejected: ['identity_provider_rejected'],
    provider_revoked: ['identity_provider_revoked'],
    wrong_account: ['identity_wrong_account'],
    insufficient_scope: ['identity_insufficient_scope'],
    credential_expiring: ['identity_credential_expiring'],
    credential_expired: ['identity_credential_expired'],
    provider_unavailable: ['identity_provider_unavailable'],
    interactive_reauthentication_required: ['identity_interactive_reauthentication_required'],
    refresh_available: ['identity_refresh_available'],
    unknown: ['identity_verification_unknown'],
  };
  return codes[detailedState] ?? ['identity_verification_unknown'];
}

function check(checkCode, outcome, evidenceSummary) {
  return { checkCode, outcome, evidenceSummary };
}

function timestampOrNow(value) {
  const candidate = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(candidate.getTime()) ? candidate : new Date();
}

function safeExpiry(value) {
  if (typeof value !== 'string' || value.length > 128) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeBoundaryResult({ credentialId, expectedPrincipal, verificationPolicy, boundaryResult, observedAt }) {
  const boundaryState = boundaryResult?.boundaryState;
  const providerResult = boundaryState === 'provider_result' && RESULT_CODES.has(boundaryResult.resultCode) ? boundaryResult : null;
  const providerId = providerResult && isSafeMetadataIdentifier(providerResult.providerId) ? providerResult.providerId : null;
  const providerCredentialType = providerResult && isSafeMetadataIdentifier(providerResult.providerCredentialType) ? providerResult.providerCredentialType : null;
  const observedPrincipalRef = providerResult && isSafePrincipal(providerResult.principal) ? providerResult.principal : null;
  const observedPrincipalLabel = providerResult && typeof providerResult.principalLabel === 'string' && providerResult.principalLabel.length <= 256 && !/[\u0000-\u001f\u007f]/.test(providerResult.principalLabel)
    ? providerResult.principalLabel
    : null;
  const observedScopeSummary = providerResult && Array.isArray(providerResult.scopes) && providerResult.scopes.every(isSafeScope)
    ? [...new Set(providerResult.scopes)]
    : [];
  const scopeEvidence = providerResult && SCOPE_EVIDENCE.has(providerResult.scopeEvidence)
    ? providerResult.scopeEvidence
    : providerResult && Array.isArray(providerResult.scopes)
      ? 'provider_observed'
      : 'unknown';
  const observedExpiresAt = providerResult ? safeExpiry(providerResult.expiresAt) : null;
  const expiryMetadataSource = providerResult && METADATA_SOURCES.has(providerResult.expiryMetadataSource)
    ? providerResult.expiryMetadataSource
    : observedExpiresAt
      ? 'provider_observed'
      : 'unknown';
  const refreshAvailable = providerResult && typeof providerResult.refreshAvailable === 'boolean' ? providerResult.refreshAvailable : null;
  const providerReasonCode = providerResult && isSafeMetadataIdentifier(providerResult.reasonCode) ? providerResult.reasonCode : null;
  const rateLimit = providerResult && providerResult.rateLimit && typeof providerResult.rateLimit === 'object' && !Array.isArray(providerResult.rateLimit)
    ? Object.freeze({
      ...(Number.isInteger(providerResult.rateLimit.limit) && providerResult.rateLimit.limit >= 0 ? { limit: providerResult.rateLimit.limit } : {}),
      ...(Number.isInteger(providerResult.rateLimit.remaining) && providerResult.rateLimit.remaining >= 0 ? { remaining: providerResult.rateLimit.remaining } : {}),
      ...(safeExpiry(providerResult.rateLimit.resetAt) ? { resetAt: safeExpiry(providerResult.rateLimit.resetAt) } : {}),
      ...(Number.isInteger(providerResult.rateLimit.retryAfterSeconds) && providerResult.rateLimit.retryAfterSeconds >= 0 && providerResult.rateLimit.retryAfterSeconds <= 31536000
        ? { retryAfterSeconds: providerResult.rateLimit.retryAfterSeconds }
        : {}),
    })
    : null;
  const requiredScopes = Array.isArray(verificationPolicy.requiredScopes) ? verificationPolicy.requiredScopes : [];
  const expectedPrincipalRef = expectedPrincipal?.principalRef;
  const principalObserved = observedPrincipalRef !== null;
  const principalMatches = principalObserved && observedPrincipalRef === expectedPrincipalRef;
  const scopesMatch = requiredScopes.every((scope) => observedScopeSummary.includes(scope));
  const expiryDate = observedExpiresAt ? new Date(observedExpiresAt) : null;
  const expiryWindow = Number.isInteger(verificationPolicy.expiringWithinSeconds) ? verificationPolicy.expiringWithinSeconds : DEFAULT_EXPIRING_WINDOW_SECONDS;

  let detailedState = 'unknown';
  if (boundaryState === 'credential_missing') detailedState = 'credential_missing';
  else if (boundaryState === 'permission_denied' || boundaryState === 'vault_unavailable') detailedState = 'vault_unavailable';
  else if (boundaryState === 'provider_result') {
    if (providerResult.resultCode === 'rejected') detailedState = 'provider_rejected';
    else if (providerResult.resultCode === 'revoked') detailedState = 'provider_revoked';
    else if (providerResult.resultCode === 'provider_unavailable') detailedState = 'provider_unavailable';
    else if (providerResult.resultCode === 'reauthentication_required') detailedState = 'interactive_reauthentication_required';
    else if (providerResult.resultCode === 'refresh_available') detailedState = 'refresh_available';
    else if (providerResult.resultCode === 'accepted' && !principalMatches) detailedState = principalObserved ? 'wrong_account' : 'unknown';
    else if (providerResult.resultCode === 'accepted' && requiredScopes.length > 0 && scopeEvidence === 'provider_observed' && !scopesMatch) detailedState = 'insufficient_scope';
    else if (providerResult.resultCode === 'accepted' && requiredScopes.length > 0 && scopeEvidence !== 'provider_observed') detailedState = 'unknown';
    else if (providerResult.resultCode === 'accepted' && expiryDate && expiryDate.getTime() <= observedAt.getTime()) detailedState = 'credential_expired';
    else if (providerResult.resultCode === 'accepted' && expiryDate && expiryDate.getTime() <= observedAt.getTime() + expiryWindow * 1000) detailedState = 'credential_expiring';
    else if (providerResult.resultCode === 'accepted') detailedState = 'verified_healthy';
  } else if (boundaryResult?.reasonCode === 'verifier_output_rejected') detailedState = 'unknown';

  const expectedPrincipalMatch = detailedState === 'wrong_account' ? 'mismatched' : principalMatches ? 'verified' : 'unknown';
  const secretReferenceOutcome = boundaryState === 'credential_missing' ? 'fail' : ['vault_unavailable', 'permission_denied', 'unknown'].includes(boundaryState) ? 'unknown' : 'pass';
  const authenticationOutcome = ['accepted', 'refresh_available'].includes(providerResult?.resultCode) ? 'pass' : ['rejected', 'revoked'].includes(providerResult?.resultCode) ? 'fail' : 'unknown';
  const principalOutcome = principalObserved ? 'pass' : 'unknown';
  const expectedOutcome = expectedPrincipalMatch === 'verified' ? 'pass' : expectedPrincipalMatch === 'mismatched' ? 'fail' : 'unknown';
  const scopeOutcome = providerResult?.resultCode === 'accepted'
    ? requiredScopes.length === 0
      ? scopeEvidence === 'provider_observed' ? 'pass' : 'unknown'
      : scopeEvidence === 'provider_observed' ? (scopesMatch ? 'pass' : 'fail') : 'unknown'
    : 'unknown';
  const capabilityOutcome = providerResult?.resultCode === 'accepted' ? 'pass' : providerResult?.resultCode === 'rejected' || providerResult?.resultCode === 'revoked' ? 'fail' : 'unknown';

  const observation = {
    observationId: observationId(credentialId),
    subjectId: credentialId,
    subjectKind: 'credential',
    observedAt: observedAt.toISOString(),
    freshness: 'fresh',
    normalizedStatus: normalizedStatus(detailedState),
    detailedState,
    providerId,
    providerCredentialType,
    observedPrincipalLabel,
    expectedPrincipalMatch,
    observedPrincipalRef,
    observedScopeSummary,
    scopeEvidence,
    observedExpiresAt,
    expiryMetadataSource,
    refreshAvailable,
    providerReasonCode,
    rateLimit,
    checks: [
      check('secret_reference_available', secretReferenceOutcome, 'Secret reference was evaluated inside the bounded verification boundary.'),
      check('authentication_accepted', authenticationOutcome, 'Provider verifier returned a normalized authentication outcome.'),
      check('principal_identity_observed', principalOutcome, 'Provider verifier returned a normalized principal result.'),
      check('expected_principal_matches', expectedOutcome, 'Expected-principal comparison was performed without exposing the secret.'),
      check('scope_capability_matches', scopeOutcome, 'Required scope comparison was performed against normalized verifier metadata.'),
      check('minimal_provider_capability', capabilityOutcome, 'Provider verifier capability result was normalized.'),
      check('evidence_fresh', 'pass', 'Observation was generated during this verification request.'),
    ],
    conditionCodes: conditionCode(detailedState),
    provenance: {
      source: 'ikhp-identity-access-verifier',
      readOnly: true,
      authority: 'derived-runtime',
    },
  };
  return Object.freeze(observation);
}

export function createSyntheticProviderAdapter({ mode = 'normal' } = {}) {
  if (!['normal', 'unavailable', 'revoked', 'reauthentication_required', 'refresh_available', 'leak'].includes(mode)) throw new TypeError('unsupported synthetic provider mode');
  return Object.freeze({
    adapterId: SYNTHETIC_PROVIDER_ADAPTER_ID,
    verifierId: SYNTHETIC_PROVIDER_ADAPTER_ID,
    buildVerificationInvocation({ expectedPrincipalRef, requiredScopes }) {
      return Object.freeze({
        verifierId: SYNTHETIC_PROVIDER_ADAPTER_ID,
        executable: process.execPath,
        args: [
          SYNTHETIC_VERIFIER_SCRIPT,
          '--mode', mode,
          '--expected-principal', expectedPrincipalRef,
          '--required-scopes-json', JSON.stringify(requiredScopes),
        ],
      });
    },
  });
}

function invalidVerification({ credentialId, verificationPolicy, expectedPrincipal, observedAt, reason }) {
  return normalizeBoundaryResult({
    credentialId,
    expectedPrincipal,
    verificationPolicy,
    boundaryResult: { boundaryState: 'unknown', reasonCode: reason },
    observedAt,
  });
}

export async function verifyCredential({
  credentialId,
  credentialRef,
  expectedPrincipal,
  verificationPolicy,
  providerAdapter,
  secretStoreAdapter,
  now,
} = {}) {
  const safeId = safeCredentialId(credentialId);
  const observedAt = timestampOrNow(now);
  const policy = verificationPolicy && typeof verificationPolicy === 'object' ? verificationPolicy : {};
  const principal = expectedPrincipal && typeof expectedPrincipal === 'object' ? expectedPrincipal : {};
  if (policy.readOnlyOnly !== true || policy.probeMode !== 'read_only' || !isSafePrincipal(principal.principalRef)) {
    return invalidVerification({ credentialId: safeId, verificationPolicy: policy, expectedPrincipal: principal, observedAt, reason: 'invalid_verification_policy' });
  }
  const requiredScopes = policy.requiredScopes ?? [];
  if (!Array.isArray(requiredScopes) || requiredScopes.length > 64 || !requiredScopes.every(isSafeScope)) {
    return invalidVerification({ credentialId: safeId, verificationPolicy: policy, expectedPrincipal: principal, observedAt, reason: 'invalid_verification_policy' });
  }
  if (!providerAdapter || typeof providerAdapter.buildVerificationInvocation !== 'function' || !secretStoreAdapter || typeof secretStoreAdapter.invokeBoundedVerification !== 'function') {
    return invalidVerification({ credentialId: safeId, verificationPolicy: policy, expectedPrincipal: principal, observedAt, reason: 'verification_adapter_unavailable' });
  }

  let invocation;
  try {
    invocation = providerAdapter.buildVerificationInvocation({ expectedPrincipalRef: principal.principalRef, requiredScopes: [...requiredScopes] });
  } catch {
    return invalidVerification({ credentialId: safeId, verificationPolicy: policy, expectedPrincipal: principal, observedAt, reason: 'verification_adapter_unavailable' });
  }
  if (!invocation || typeof invocation.verifierId !== 'string' || typeof invocation.executable !== 'string' || !Array.isArray(invocation.args)) {
    return invalidVerification({ credentialId: safeId, verificationPolicy: policy, expectedPrincipal: principal, observedAt, reason: 'verification_adapter_unavailable' });
  }

  let boundaryResult;
  try {
    boundaryResult = await secretStoreAdapter.invokeBoundedVerification({
      reference: credentialRef,
      verifierId: invocation.verifierId,
      verifierExecutable: invocation.executable,
      verifierArgs: invocation.args,
    });
  } catch {
    boundaryResult = { boundaryState: 'unknown', reasonCode: 'verification_boundary_failed' };
  }
  return normalizeBoundaryResult({ credentialId: safeId, expectedPrincipal: principal, verificationPolicy: policy, boundaryResult, observedAt });
}

export function createDefaultSyntheticVerification() {
  return Object.freeze({
    secretStoreAdapter: createMacOSKeychainAdapter(),
    providerAdapter: createSyntheticProviderAdapter(),
  });
}
