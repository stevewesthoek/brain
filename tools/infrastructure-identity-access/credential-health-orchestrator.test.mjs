import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import fixture from '../../operations/fixtures/infrastructure-identity-access-alternate-v1.json' with { type: 'json' };
import { createSyntheticProviderAdapter } from './credential-verification-boundary.mjs';
import { runCredentialHealthEvaluation } from './credential-health-orchestrator.mjs';
import { materializeEvaluation } from './credential-health-policy.mjs';
import { readCredentialHealthState } from './credential-health-runtime.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'brain-credential-health-'));
}

function fakeSecretStore(mode, calls) {
  return {
    async invokeBoundedVerification({ reference, verifierArgs }) {
      calls.push({ reference, verifierArgs: [...verifierArgs] });
      const expected = verifierArgs[verifierArgs.indexOf('--expected-principal') + 1];
      const providerCredentialType = 'synthetic';
      if (mode === 'unavailable') return { boundaryState: 'provider_result', resultCode: 'provider_unavailable', providerId: 'provider-a', providerCredentialType };
      if (mode === 'revoked') return { boundaryState: 'provider_result', resultCode: 'revoked', providerId: 'provider-a', providerCredentialType };
      if (mode === 'reauthentication_required') return { boundaryState: 'provider_result', resultCode: 'reauthentication_required', providerId: 'provider-a', providerCredentialType };
      if (mode === 'wrong_account') return { boundaryState: 'provider_result', resultCode: 'accepted', providerId: 'provider-a', providerCredentialType, principal: 'principal:wrong-account', scopeEvidence: 'provider_observed', scopes: [] };
      return { boundaryState: 'provider_result', resultCode: 'accepted', providerId: 'provider-a', providerCredentialType, principal: expected, scopeEvidence: 'provider_observed', scopes: [], refreshAvailable: false };
    },
  };
}

function runHarness({ root, mode = 'normal', now, catalog = fixture, notify = false, calls = [], sent = [] }) {
  const effectiveCatalog = catalog === fixture
    ? { ...fixture, lifecyclePolicies: fixture.lifecyclePolicies.map((policy) => ({ ...policy, verificationCadenceSeconds: 3600 })) }
    : catalog;
  return runCredentialHealthEvaluation({
    root,
    catalog: effectiveCatalog,
    now,
    notify,
    providerAdapterFactory: () => createSyntheticProviderAdapter(),
    secretStoreAdapterFactory: () => fakeSecretStore(mode, calls),
    attentionSender: async (item) => { sent.push(item); return { channel: 'test' }; },
  });
}

test('synthetic lifecycle covers healthy, wrong-account incident, deduplication, and recovery', async () => {
  const root = tempRoot();
  const calls = [];
  const sent = [];
  try {
    const healthy = await runHarness({ root, now: '2030-01-01T00:00:00Z', calls });
    assert.equal(healthy.summary.evaluations.filter((entry) => entry.status === 'healthy').length, 2);
    assert.equal(healthy.incidents.length, 0);
    assert.equal(calls.length, 2);
    assert.equal(JSON.stringify(healthy).includes('secret-ref://'), false);

    const wrong = await runHarness({ root, mode: 'wrong_account', now: '2030-01-01T01:00:01Z', notify: true, calls, sent });
    assert.equal(wrong.incidents.filter((entry) => entry.status === 'open').length, 2);
    assert.equal(wrong.summary.attention.immediate, 2);
    assert.equal(sent.length, 2);
    const repeated = await runHarness({ root, mode: 'wrong_account', now: '2030-01-01T01:00:02Z', notify: true, calls, sent });
    assert.equal(repeated.summary.attention.immediate, 0);
    assert.equal(sent.length, 2);
    assert.equal(calls.length, 4);

    const recovered = await runHarness({ root, now: '2030-01-01T02:00:02Z', notify: true, calls, sent });
    assert.equal(recovered.incidents.filter((entry) => entry.status === 'open').length, 0);
    assert.equal(recovered.incidents.filter((entry) => entry.status === 'recovered').length, 2);
    assert.equal(recovered.summary.attention.immediate, 2);
    assert.equal(sent.length, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('provider outage uses exponential backoff and does not create a revoked state', async () => {
  const root = tempRoot();
  const calls = [];
  try {
    await runHarness({ root, now: '2030-01-01T00:00:00Z', calls });
    const outage = await runHarness({ root, mode: 'unavailable', now: '2030-01-01T01:00:01Z', calls });
    const first = outage.evaluations[0];
    assert.equal(first.detailedState, 'provider_unavailable');
    assert.equal(first.consecutiveTransientFailures, 1);
    assert.equal(Date.parse(first.nextDueAt) - Date.parse('2030-01-01T01:00:01Z'), 30 * 1000);
    assert.equal(outage.incidents.some((entry) => entry.conditionCode === 'identity_provider_revoked'), false);
    const beforeRetry = await runHarness({ root, mode: 'unavailable', now: '2030-01-01T01:00:15Z', calls });
    assert.equal(beforeRetry.evaluations[0].evaluationStatus, 'not_due');
    assert.equal(calls.length, 4);
    const retry = await runHarness({ root, mode: 'unavailable', now: first.nextDueAt, calls });
    assert.equal(retry.evaluations[0].consecutiveTransientFailures, 2);
    assert.equal(Date.parse(retry.evaluations[0].nextDueAt) - Date.parse(first.nextDueAt), 60 * 1000);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('declared expiry becomes an evidence-backed warning and then a critical condition', async () => {
  const root = tempRoot();
  const catalog = JSON.parse(JSON.stringify(fixture));
  catalog.accounts = [catalog.accounts[0]];
  catalog.credentials = [{ ...catalog.credentials[0], expiresAt: '2030-01-01T00:30:00Z', expiryState: 'known' }];
  try {
    const warning = await runHarness({ root, catalog, now: '2030-01-01T00:00:00Z' });
    assert.equal(warning.evaluations[0].detailedState, 'credential_expiring');
    assert.equal(warning.evaluations[0].expiryMetadataSource, 'user_declared');
    assert.equal(warning.incidents[0].severity, 'medium');
    // The first cadence is one hour; this run is deliberately overdue so the
    // scheduler performs a fresh probe rather than reusing the warning.
    const expired = await runHarness({ root, catalog, now: '2030-01-01T01:00:01Z' });
    assert.equal(expired.evaluations[0].detailedState, 'credential_expired');
    assert.equal(expired.incidents.some((entry) => entry.severity === 'critical'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missed scheduler interval materializes stale evidence without claiming healthy', () => {
  const previous = {
    credentialId: 'credential:provider-a.01.refresh', accountId: 'account:provider-a.01', providerId: 'provider-a', providerCredentialType: null,
    status: 'healthy', freshness: 'fresh', detailedState: 'verified_healthy', observedAt: '2030-01-01T00:00:00Z', freshnessDeadline: '2030-01-01T01:00:00Z',
    evaluationStatus: 'verified', conditionCodes: [], cadenceSeconds: 3600, backoffSeconds: 30, consecutiveTransientFailures: 0, missedIntervals: 0,
    lastAttemptAt: '2030-01-01T00:00:00Z', nextDueAt: '2030-01-01T01:00:00Z', expectedPrincipalMatch: 'verified', observedPrincipalLabel: null,
    observedScopeSummary: [], scopeEvidence: 'provider_observed', observedExpiresAt: null, expiryMetadataSource: 'unknown', refreshAvailable: false,
    providerReasonCode: null, rateLimit: null, checks: [], provenance: { source: 'test', readOnly: true, authority: 'derived-runtime' },
  };
  const stale = materializeEvaluation({
    credential: fixture.credentials[0], account: fixture.accounts[0], verificationPolicy: fixture.verificationPolicies[0], lifecyclePolicy: fixture.lifecyclePolicies[0], previous, now: '2030-01-01T04:00:00Z',
  });
  assert.equal(stale.freshness, 'stale');
  assert.equal(stale.status, 'unknown');
  assert.equal(stale.conditionCodes.includes('identity_verification_stale'), true);
  assert.equal(stale.missedIntervals, 3);
});

test('runtime state is owner-readable, bounded, and contains no secret references', async () => {
  const root = tempRoot();
  try {
    await runHarness({ root, now: '2030-01-01T00:00:00Z' });
    const state = readCredentialHealthState({ root, now: '2030-01-01T00:00:01Z' }).state;
    assert.equal(state.containsSecrets, false);
    assert.equal(JSON.stringify(state).includes('secret-ref://'), false);
    const file = path.join(root, 'runtime/local/infrastructure/credential-health-state.json');
    assert.equal((fs.statSync(file).mode & 0o777), 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
