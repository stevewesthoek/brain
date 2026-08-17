import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { validateJsonSchema } from './context-learning/context-learning-core.mjs';
import {
  normalizeAccessHealth,
  normalizeBackupHealth,
  normalizeCloudflare,
  normalizeCloudflareDomains,
  normalizeDokploy,
  normalizeNewRelic,
  normalizeTailscale,
} from '../projects/brain-core/src/adapters/infrastructure-provider-normalizers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const schema = readJson('operations/specs/infrastructure-observation-v1.schema.json');
const assets = readJson('operations/infrastructure/catalog/assets.v1.json');
const bindingsDoc = readJson('operations/infrastructure/health/provider-bindings.v1.json');
const fixtures = readJson('operations/fixtures/infrastructure-health-provider-fixtures-v1.json');
const backupPolicies = readJson('operations/infrastructure/catalog/backup-policies.v1.json').backupPolicies;
const now = new Date(fixtures.observedAt);
const errors = [];
const warnings = [];
const allowedSelectorKinds = new Set(['entity-name', 'hostname', 'domain-name', 'dns-name', 'network-address', 'provider-summary', 'job-key', 'provider-status']);
const resourceIds = new Set(assets.resources.map((resource) => resource.resourceId));
const bindingIds = new Set();

for (const binding of bindingsDoc.bindings ?? []) {
  if (!binding.bindingId || typeof binding.bindingId !== 'string') errors.push('binding missing bindingId');
  else if (bindingIds.has(binding.bindingId)) errors.push(`duplicate bindingId: ${binding.bindingId}`);
  else bindingIds.add(binding.bindingId);

  if (!resourceIds.has(binding.resourceId)) errors.push(`binding target missing from IKHP1 catalog: ${binding.bindingId} -> ${binding.resourceId}`);
  if (!binding.providerId || typeof binding.providerId !== 'string') errors.push(`binding missing providerId: ${binding.bindingId}`);
  if (!allowedSelectorKinds.has(binding.selector?.kind)) errors.push(`non-portable selector kind: ${binding.bindingId} -> ${binding.selector?.kind}`);
  if (!Array.isArray(binding.selector?.names) || binding.selector.names.length === 0 || binding.selector.names.some((name) => typeof name !== 'string' || name.length === 0)) {
    errors.push(`invalid selector names: ${binding.bindingId}`);
  }
  if (!Number.isInteger(binding.freshnessSeconds) || binding.freshnessSeconds <= 0) errors.push(`invalid freshnessSeconds: ${binding.bindingId}`);
}

const observations = [
  ...normalizeNewRelic(fixtures.newrelic, bindingsDoc.bindings, { now }),
  ...normalizeCloudflare(fixtures.cloudflare, bindingsDoc.bindings, { now }),
  ...normalizeCloudflareDomains(fixtures.cloudflareDomains, bindingsDoc.bindings, { now }),
  ...normalizeTailscale(fixtures.tailscale, bindingsDoc.bindings, { now }),
  ...normalizeDokploy(fixtures.dokploy, bindingsDoc.bindings, { now }),
  ...normalizeBackupHealth(fixtures.scheduler, backupPolicies, bindingsDoc.bindings, { now }),
  ...normalizeAccessHealth(fixtures.accessHealth, bindingsDoc.bindings, { now }),
];

for (const observation of observations) {
  const validationErrors = validateJsonSchema(schema.$defs.observation, observation, schema, `$.observation[${observation.observationId}]`);
  errors.push(...validationErrors);
  if (!resourceIds.has(observation.resourceId)) errors.push(`observation target missing from IKHP1 catalog: ${observation.resourceId}`);
  if (observation.freshness !== 'fresh' && observation.status === 'healthy') errors.push(`stale/unknown observation marked healthy: ${observation.observationId}`);
  if (observation.provenance?.readOnly !== true) errors.push(`observation is not read-only: ${observation.observationId}`);
}

const expectedObservationCount = bindingsDoc.bindings.length;
if (observations.length !== expectedObservationCount) {
  errors.push(`binding/observation coverage mismatch: bindings=${expectedObservationCount} observations=${observations.length}`);
}

const newRelicObservations = observations.filter((entry) => entry.providerId === 'newrelic');
if (!newRelicObservations.some((entry) => Object.hasOwn(entry.metricsSummary, 'cpuPercent') && Object.hasOwn(entry.metricsSummary, 'diskUsedPercent'))) {
  errors.push('New Relic fixture projection missing host CPU/disk metrics');
}
if (!newRelicObservations.some((entry) => Object.hasOwn(entry.metricsSummary, 'apmReporting') && Object.hasOwn(entry.metricsSummary, 'syntheticFailures') && Object.hasOwn(entry.metricsSummary, 'openIssues'))) {
  errors.push('New Relic fixture projection missing APM/synthetic/alert summary');
}

const cloudflareObservation = observations.find((entry) => entry.providerId === 'cloudflare');
if (!cloudflareObservation || cloudflareObservation.metricsSummary.connectionCount !== 1) errors.push('Cloudflare connector-count projection missing');
const cloudflareDomainObservation = observations.find((entry) => entry.providerId === 'cloudflare-domain');
if (!cloudflareDomainObservation || cloudflareDomainObservation.metricsSummary.domainStatus !== 'active') errors.push('Cloudflare domain-state projection missing');
const cloudflareDnsObservation = observations.find((entry) => entry.providerId === 'cloudflare-dns');
if (!cloudflareDnsObservation || cloudflareDnsObservation.metricsSummary.driftStatus !== 'unknown' || cloudflareDnsObservation.status === 'healthy') errors.push('Cloudflare DNS drift must remain explicit unknown without canonical expected content');

const backupObservation = observations.find((entry) => entry.providerId === 'scheduler');
if (!backupObservation || backupObservation.metricsSummary.lastSuccess !== '2026-08-16T03:20:00Z') errors.push('backup last-success projection missing');
if (!backupObservation || backupObservation.metricsSummary.restoreLastVerified !== null) errors.push('unknown restore verification must remain null');

const accessObservations = observations.filter((entry) => entry.providerId === 'access-health');
if (accessObservations.length !== 3) errors.push(`expected 3 cataloged access-health observations, got ${accessObservations.length}`);
for (const observation of accessObservations) {
  const serialized = JSON.stringify(observation);
  for (const variableName of ['NEW_RELIC_USER_API_KEY', 'CLOUDFLARE_API_TOKEN', 'DOKPLOY_API_KEY']) {
    if (serialized.includes(variableName)) errors.push(`access observation leaked credential variable metadata: ${observation.resourceId}`);
  }
}

const errorFallbacks = normalizeNewRelic({ status: 'error', hosts: [], synthetics: [], apm: [], issues: { open: 0, critical: 0 } }, bindingsDoc.bindings, { now });
if (errorFallbacks.some((entry) => entry.status === 'healthy')) errors.push('provider error fallback produced healthy observation');
if (errorFallbacks.some((entry) => !['stale', 'unknown'].includes(entry.freshness))) errors.push('provider error fallback did not produce stale/unknown freshness');

const publicSchemaText = JSON.stringify(schema).toLowerCase();
for (const forbidden of ['newrelic', 'cloudflare', 'tailscale', 'dokploy', 'obsidian', 'brain', 'mind', 'office', 'macbook', 'steve']) {
  if (publicSchemaText.includes(forbidden)) errors.push(`public observation schema contains implementation-specific coupling: ${forbidden}`);
}

const tailscaleSource = readText('projects/brain-core/src/adapters/infra-tailscale.ts');
if (!tailscaleSource.includes("execFile(\n      'tailscale',\n      ['status', '--json']")) errors.push('Tailscale adapter is not pinned to named status --json invocation');
if (/\bexec\s*\(/.test(tailscaleSource) || /shell\s*:\s*true/.test(tailscaleSource)) errors.push('Tailscale adapter enables arbitrary shell execution');
if (tailscaleSource.includes("['ssh'") || tailscaleSource.includes('privateKey')) errors.push('Tailscale adapter attempts SSH execution or private-key handling');

const newRelicSource = readText('projects/brain-core/src/adapters/infra-new-relic.ts');
if (/\bmutation\b/i.test(newRelicSource)) errors.push('New Relic adapter contains GraphQL mutation text');

const cloudflareSource = readText('projects/brain-core/src/adapters/infra-cloudflare-tunnels.ts');
if (/method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/i.test(cloudflareSource)) errors.push('Cloudflare tunnel adapter contains mutating HTTP method');
const cloudflareDomainSource = readText('projects/brain-core/src/adapters/infra-cloudflare-domains.ts');
if (/method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/i.test(cloudflareDomainSource)) errors.push('Cloudflare domain/DNS adapter contains mutating HTTP method');

const collectorSource = readText('projects/brain-core/src/adapters/infra-health-collector.ts');
for (const required of ['canonicalCatalogMutated: false', 'providerMutationPerformed: false']) {
  if (!collectorSource.includes(required)) warnings.push(`collector source marker not found directly: ${required}`);
}
const runtimeSource = readText('projects/brain-core/src/adapters/infrastructure-observation-runtime.mjs');
if (!runtimeSource.includes("runtime', 'local', 'infrastructure'")) errors.push('bounded runtime/local/infrastructure path marker missing');

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  process.exit(1);
}
for (const warning of warnings) console.warn(`WARN ${warning}`);
console.log(`infrastructure-health-valid bindings=${bindingsDoc.bindings.length} observations=${observations.length} resourcesMapped=${new Set(observations.map((entry) => entry.resourceId)).size} newrelic=${newRelicObservations.length} cloudflareTunnels=${observations.filter((entry) => entry.providerId === 'cloudflare').length} cloudflareDomains=${observations.filter((entry) => entry.providerId === 'cloudflare-domain').length} cloudflareDns=${observations.filter((entry) => entry.providerId === 'cloudflare-dns').length} tailscale=${observations.filter((entry) => entry.providerId === 'tailscale').length} dokploy=${observations.filter((entry) => entry.providerId === 'dokploy').length} backups=${observations.filter((entry) => entry.providerId === 'scheduler').length} access=${accessObservations.length}`);
