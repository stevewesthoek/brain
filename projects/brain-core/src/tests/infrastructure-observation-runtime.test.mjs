import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  computeFreshness,
  createObservation,
  pruneObservations,
  writeObservationSnapshot,
} from '../adapters/infrastructure-observation-runtime.mjs';
import {
  normalizeAccessHealth,
  normalizeBackupHealth,
  normalizeCloudflare,
  normalizeCloudflareDomains,
  normalizeDokploy,
  normalizeNewRelic,
  normalizeTailscale,
} from '../adapters/infrastructure-provider-normalizers.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-health-provider-fixtures-v1.json'), 'utf8'));
const bindings = JSON.parse(fs.readFileSync(path.join(root, 'operations/infrastructure/health/provider-bindings.v1.json'), 'utf8')).bindings;
const backupPolicies = JSON.parse(fs.readFileSync(path.join(root, 'operations/infrastructure/catalog/backup-policies.v1.json'), 'utf8')).backupPolicies;
const now = new Date(fixtures.observedAt);

const clone = (value) => JSON.parse(JSON.stringify(value));

test('freshness boundary is exact and stale healthy observations cannot remain healthy', () => {
  assert.deepEqual(computeFreshness({ observedAt: '2026-08-16T19:55:00Z', now, freshnessSeconds: 300 }), { freshness: 'fresh', ageSeconds: 300 });
  assert.deepEqual(computeFreshness({ observedAt: '2026-08-16T19:54:59Z', now, freshnessSeconds: 300 }), { freshness: 'stale', ageSeconds: 301 });

  const stale = createObservation({
    resourceId: 'host:example',
    providerId: 'fixture',
    observedAt: '2026-08-16T19:54:59Z',
    freshnessSeconds: 300,
    status: 'healthy',
    provenanceSource: 'fixture',
    now,
  });
  assert.equal(stale.freshness, 'stale');
  assert.equal(stale.status, 'unknown');
  assert.ok(stale.conditionCodes.includes('observation_stale'));
});

test('New Relic maps every configured resource and surfaces disk/reporting failures plus missing entities', () => {
  const observations = normalizeNewRelic(fixtures.newrelic, bindings, { now });
  assert.equal(observations.length, 3);

  const aws = observations.find((entry) => entry.resourceId === 'host:dokploy-aws');
  assert.equal(aws.status, 'healthy');
  assert.equal(aws.metricsSummary.cpuPercent, 27.5);
  assert.equal(aws.metricsSummary.memoryPercent, 61.2);
  assert.equal(aws.metricsSummary.diskUsedPercent, 72.3);
  assert.equal(aws.metricsSummary.apmReporting, 1);
  assert.equal(aws.metricsSummary.openIssues, 1);

  const supabase = observations.find((entry) => entry.resourceId === 'host:vm-supabase');
  assert.equal(supabase.status, 'unhealthy');
  assert.equal(supabase.freshness, 'stale');
  assert.ok(supabase.conditionCodes.includes('host_not_reporting'));
  assert.ok(supabase.conditionCodes.includes('disk_capacity_critical'));

  const cloudpanel = observations.find((entry) => entry.resourceId === 'host:cloudpanel-aws');
  assert.equal(cloudpanel.status, 'unknown');

});

test('provider errors produce explicit stale or unknown observations, never healthy', () => {
  const observations = normalizeNewRelic({ status: 'error', hosts: [], synthetics: [], apm: [], issues: { open: 0, critical: 0 } }, bindings, { now });
  assert.equal(observations.length, 3);
  assert.ok(observations.every((entry) => entry.status !== 'healthy'));
  assert.ok(observations.every((entry) => entry.conditionCodes.includes('provider_error')));
});

test('Cloudflare connector policy and origin reachability normalize read-only tunnel state', () => {
  const healthy = normalizeCloudflare(fixtures.cloudflare, bindings, { now });
  assert.equal(healthy.length, 1);
  assert.equal(healthy[0].resourceId, 'tunnel:cloudflare-production');
  assert.equal(healthy[0].status, 'healthy');
  assert.equal(healthy[0].metricsSummary.connectionCount, 1);

  const conflictFixture = clone(fixtures.cloudflare);
  conflictFixture.tunnels[0].connectionCount = 2;
  const conflict = normalizeCloudflare(conflictFixture, bindings, { now });
  assert.equal(conflict[0].status, 'unhealthy');
  assert.ok(conflict[0].conditionCodes.includes('tunnel_connector_conflict'));
});

test('Cloudflare domain and DNS observations preserve unknown drift without false healthy state', () => {
  const observations = normalizeCloudflareDomains(fixtures.cloudflareDomains, bindings, { now });
  assert.equal(observations.length, 2);

  const domain = observations.find((entry) => entry.resourceId === 'domain:prochat-tools');
  assert.equal(domain.status, 'healthy');
  assert.equal(domain.metricsSummary.domainStatus, 'active');

  const dns = observations.find((entry) => entry.resourceId === 'dns_record:prochat-tools-root');
  assert.equal(dns.status, 'unknown');
  assert.equal(dns.metricsSummary.driftStatus, 'unknown');
  assert.equal(dns.metricsSummary.expectedStateKnown, false);
  assert.ok(dns.conditionCodes.includes('dns_expected_state_unknown'));
});

test('Tailscale normalizes expected devices and never silently drops missing peers', () => {
  const observations = normalizeTailscale(fixtures.tailscale, bindings, { now });
  assert.equal(observations.length, 4);

  const office = observations.find((entry) => entry.resourceId === 'host:office');
  assert.equal(office.status, 'healthy');
  assert.equal(office.metricsSummary.sshReachable, true);

  const supabase = observations.find((entry) => entry.resourceId === 'host:vm-supabase');
  assert.equal(supabase.status, 'unhealthy');
  assert.ok(supabase.conditionCodes.includes('tailscale_device_offline'));

  const macbook = observations.find((entry) => entry.resourceId === 'host:macbook');
  assert.equal(macbook.status, 'unhealthy');
  assert.ok(macbook.conditionCodes.includes('tailscale_device_missing'));
});

test('Dokploy keeps unmapped provider entities as evidence instead of inventing catalog assets', () => {
  const observations = normalizeDokploy(fixtures.dokploy, bindings, { now });
  assert.equal(observations.length, 1);
  assert.equal(observations[0].resourceId, 'provider_account:dokploy-primary');
  assert.equal(observations[0].status, 'degraded');
  assert.deepEqual(observations[0].metricsSummary.unmappedProviderEntities, ['Unknown/production/worker']);
});

test('backup health is separate from policy and preserves unknown restore evidence', () => {
  const observations = normalizeBackupHealth(fixtures.scheduler, backupPolicies, bindings, { now });
  assert.equal(observations.length, 1);
  const backup = observations[0];
  assert.equal(backup.resourceId, 'backup_job:n8n-backup');
  assert.equal(backup.metricsSummary.lastSuccess, '2026-08-16T03:20:00Z');
  assert.equal(backup.metricsSummary.ageSeconds, 60000);
  assert.equal(backup.metricsSummary.restoreLastVerified, null);
  assert.equal(backup.metricsSummary.restoreVerificationAgeSeconds, null);
  assert.ok(backup.conditionCodes.includes('restore_verification_unknown'));
});

test('access health exposes metadata only and supports OAuth-style expiry semantics', () => {
  const current = normalizeAccessHealth(fixtures.accessHealth, bindings, { now });
  assert.equal(current.length, 3);

  const cloudflare = current.find((entry) => entry.resourceId === 'credential_reference:cloudflare-provisioner');
  assert.equal(cloudflare.status, 'unhealthy');
  assert.equal(cloudflare.metricsSummary.connected, false);
  assert.ok(cloudflare.conditionCodes.includes('credential_probe_failed'));

  const oauthBinding = {
    bindingId: 'health_binding:oauth-example',
    providerId: 'access-health',
    resourceId: 'credential_reference:oauth-example',
    selector: { kind: 'provider-status', names: ['oauth-example'] },
    freshnessSeconds: 86400,
  };
  const oauthEntry = fixtures.accessHealth.find((entry) => entry.resourceId === 'credential_reference:oauth-example');
  const oauth = normalizeAccessHealth([oauthEntry], [...bindings, oauthBinding], { now: new Date('2026-08-19T21:00:00Z') });
  assert.equal(oauth.length, 1);
  assert.equal(oauth[0].status, 'degraded');
  assert.ok(oauth[0].conditionCodes.includes('credential_expiring'));
  assert.deepEqual(Object.keys(oauth[0].metricsSummary).sort(), ['ageSeconds','configured','connected','expiresAt','expiryKnown','lastVerifiedAt','rotationDueAt','scopeSummary','verificationStatus'].sort());
});

test('bounded runtime retention prunes by age/count and writes atomically with restrictive permissions', () => {
  const observations = [
    createObservation({ resourceId: 'host:a', providerId: 'fixture', observedAt: '2026-08-16T19:59:00Z', freshnessSeconds: 300, status: 'healthy', provenanceSource: 'fixture', now }),
    createObservation({ resourceId: 'host:b', providerId: 'fixture', observedAt: '2026-08-16T19:58:00Z', freshnessSeconds: 300, status: 'healthy', provenanceSource: 'fixture', now }),
    createObservation({ resourceId: 'host:c', providerId: 'fixture', observedAt: '2026-08-16T18:00:00Z', freshnessSeconds: 300, status: 'healthy', provenanceSource: 'fixture', now }),
  ];
  const retained = pruneObservations(observations, { now, maxObservations: 2, maxAgeSeconds: 3600 });
  assert.deepEqual(retained.map((entry) => entry.resourceId), ['host:a', 'host:b']);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp2-observations-'));
  try {
    const result = writeObservationSnapshot(observations, { root: tempRoot, now, maxObservations: 2, maxAgeSeconds: 3600 });
    assert.equal(result.snapshot.observations.length, 2);
    assert.ok(result.path.endsWith(path.join('runtime', 'local', 'infrastructure', 'health-state.json')));
    const mode = fs.statSync(result.path).mode & 0o777;
    assert.equal(mode, 0o600);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
