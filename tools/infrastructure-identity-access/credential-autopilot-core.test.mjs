import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import fixture from '../../operations/fixtures/infrastructure-identity-access-alternate-v1.json' with { type: 'json' };
import { buildAutopilotSnapshot, buildExpiryState, buildHostCoverage, discoverCredentialCandidates, observeApplicationAuth, writeAutopilotSnapshot } from './credential-autopilot-core.mjs';

test('metadata discovery classifies admitted credentials and legacy references without values', () => {
  const candidates = discoverCredentialCandidates({ catalog: { ...fixture, credentials: fixture.credentials.slice(0, 1) }, accessReferences: { credentialReferences: [{ credentialRefId: 'credential_reference:legacy', providerRef: 'provider:legacy', purpose: 'legacy', secretStoreAdapter: 'local-env-file', variableNames: ['LEGACY_TOKEN'], scopes: [], expiryKnown: false, expiresAt: null, provenance: { classification: 'AUTHORITATIVE-CONFIG' } }] } });
  assert.equal(candidates.some((candidate) => candidate.ownershipClass === 'brain_managed'), true);
  const legacy = candidates.find((candidate) => candidate.candidateId === 'credential_reference:legacy');
  assert.equal(legacy.ownershipClass, 'unknown');
  assert.equal(JSON.stringify(candidates).includes('secret-ref://'), false);
  assert.equal(JSON.stringify(candidates).includes('LEGACY_TOKEN'), true);
  assert.equal(JSON.stringify(candidates).includes('CLOUDFLARE_API_TOKEN'), false);
});

test('host coverage distinguishes required, healthy, missing, and not-required hosts', () => {
  const catalog = { credentials: [{ credentialId: 'credential:test', requiredHosts: ['host:office'] }] };
  const result = buildHostCoverage({ catalog, hosts: ['host:office', 'host:macbook'], hostObservations: { 'host:office': { 'credential:test': { state: 'healthy', lastVerifiedAt: '2030-01-01T00:00:00Z' } } } });
  assert.deepEqual(result[0].healthyHosts, ['host:office']);
  assert.deepEqual(result[0].missingHosts, []);
  assert.equal(result[0].perHost['host:macbook'].state, 'not_required');
});

test('synthetic multi-host coverage keeps local secret state independent', () => {
  const catalog = { credentials: [{ credentialId: 'credential:both', requiredHosts: ['host:office', 'host:macbook'] }] };
  const result = buildHostCoverage({
    catalog,
    hosts: ['host:office', 'host:macbook'],
    hostObservations: {
      'host:office': { 'credential:both': { state: 'healthy', lastVerifiedAt: '2030-01-01T00:00:00Z' } },
      'host:macbook': { 'credential:both': { state: 'missing', lastVerifiedAt: null } },
    },
  });
  assert.deepEqual(result[0].healthyHosts, ['host:office']);
  assert.deepEqual(result[0].missingHosts, ['host:macbook']);
  assert.equal(result[0].perHost['host:office'].state, 'healthy');
  assert.equal(result[0].perHost['host:macbook'].state, 'missing');
});

test('expiry windows use declared evidence and never invent dates', () => {
  const catalog = { credentials: [{ credentialId: 'credential:known', expiryState: 'known', expiresAt: '2030-01-02T00:00:00Z', lifecyclePolicyId: 'life', verificationPolicyId: 'verify' }, { credentialId: 'credential:unknown', expiryState: 'unknown', expiresAt: null, lifecyclePolicyId: 'life', verificationPolicyId: 'verify' }], lifecyclePolicies: [{ lifecyclePolicyId: 'life', rotateBeforeSeconds: 172800 }], verificationPolicies: [{ verificationPolicyId: 'verify', expiringWithinSeconds: 86400 }] };
  const result = buildExpiryState({ catalog, now: '2030-01-01T00:00:00Z' });
  assert.equal(result[0].window.state, 'renewal_window');
  assert.equal(result[0].window.provenance, 'provider_or_catalog');
  assert.equal(result[1].window.state, 'unknown');
  assert.equal(result[1].window.expiresAt, null);
});

test('autopilot state is non-secret, host-aware, and application-auth observation stays outside the vault', () => {
  const root = fs.mkdtempSync(path.join('/tmp', 'brain-autopilot-'));
  try {
    const catalog = { ...fixture, credentials: [], sessions: [{ sessionId: 'session:app', stateOwner: 'application', applicationRef: 'application:test', lastKnownState: 'unknown', recoveryRunbookRef: 'runbook://app/recover', runtimeInstanceId: 'runtime_instance:macbook.test' }] };
    const snapshot = buildAutopilotSnapshot({ root, catalog, now: '2030-01-01T00:00:00Z', hostCatalog: { resources: [{ resourceId: 'host:office', resourceClass: 'host', lifecycleState: 'active', attributes: { platform: 'macos' } }, { resourceId: 'host:macbook', resourceClass: 'host', lifecycleState: 'active', attributes: { platform: 'macos' } }] }, accessReferences: { credentialReferences: [] }, health: { summary: { incidents: [] } } });
    assert.deepEqual(snapshot.hosts.map((host) => host.hostId), ['host:macbook', 'host:office']);
    assert.equal(snapshot.applicationAuth[0].applicationRef, 'application:test');
    assert.equal(snapshot.noNotificationHealthy, true);
    const output = writeAutopilotSnapshot({ root, snapshot });
    assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).containsSecrets, false);
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
