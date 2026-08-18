import path from 'node:path';
import process from 'node:process';
import { loadAndValidateReferenceCatalog } from './infrastructure-catalog/catalog-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const result = loadAndValidateReferenceCatalog(root, new Date('2026-08-18T13:57:00+01:00'));
const errors = [...result.errors];
const warnings = [...result.warnings];
const { resources, relations, healthPolicies, safetyPolicies } = result.bundle;
const resourceById = new Map(resources.map((resource) => [resource.resourceId, resource]));
const safetyByResourceId = new Map(safetyPolicies.map((policy) => [policy.resourceId, policy]));

function pushError(message) {
  if (!errors.includes(message)) errors.push(message);
}

function requireResource(resourceId) {
  const resource = resourceById.get(resourceId);
  if (!resource) pushError(`reference-resource-missing: ${resourceId}`);
  return resource;
}

const dokployAws = requireResource('host:dokploy-aws');
if (dokployAws) {
  if (dokployAws.lifecycleState !== 'active') pushError('reference-dokploy-state-invalid: host:dokploy-aws must be active');
  if (dokployAws.attributes?.authorityState !== 'authoritative') pushError('reference-dokploy-authority-invalid: host:dokploy-aws must be authoritative');
  if (dokployAws.attributes?.productionRole !== 'authoritative-production') pushError('reference-dokploy-role-invalid: host:dokploy-aws must be authoritative-production');
  if (dokployAws.attributes?.instanceState !== 'running') pushError('reference-dokploy-runtime-invalid: host:dokploy-aws must be running');
}

const cloudpanelAws = requireResource('host:cloudpanel-aws');
if (cloudpanelAws) {
  if (cloudpanelAws.lifecycleState !== 'active') pushError('reference-cloudpanel-state-invalid: host:cloudpanel-aws must be active');
  if (cloudpanelAws.attributes?.authorityState !== 'authoritative') pushError('reference-cloudpanel-authority-invalid: host:cloudpanel-aws must be authoritative');
  if (cloudpanelAws.attributes?.instanceState !== 'running') pushError('reference-cloudpanel-runtime-invalid: host:cloudpanel-aws must be running');
}

requireResource('host:supabase');
requireResource('provider_account:azure-prochat-data');

const forbiddenCurrentResourceIds = [
  'host:dokploy-azure',
  'provider_account:azure-prochat-apps',
  'credential_reference:azure-apps-provisioner',
  'host:cloudpanel-hetzner',
  'provider_account:hetzner-primary',
  'credential_reference:hetzner-control',
  'tunnel:cloudflare-cloudpanel-legacy',
];
for (const resourceId of forbiddenCurrentResourceIds) {
  if (resourceById.has(resourceId)) pushError(`reference-decommissioned-resource-present: ${resourceId}`);
  if (relations.some((relation) => relation.sourceId === resourceId || relation.targetId === resourceId)) {
    pushError(`reference-decommissioned-relation-present: ${resourceId}`);
  }
  if (healthPolicies.some((policy) => policy.resourceId === resourceId)) {
    pushError(`reference-decommissioned-health-policy-present: ${resourceId}`);
  }
  if (safetyPolicies.some((policy) => policy.resourceId === resourceId)) {
    pushError(`reference-decommissioned-safety-policy-present: ${resourceId}`);
  }
}

const productionTunnel = requireResource('tunnel:cloudflare-production');
if (productionTunnel) {
  if (productionTunnel.attributes?.currentConnector !== 'host:dokploy-aws') {
    pushError(`reference-production-tunnel-invalid: currentConnector=${productionTunnel.attributes?.currentConnector ?? '<none>'}, expected host:dokploy-aws`);
  }
  for (const staleField of ['targetConnector', 'previousConnector']) {
    if (staleField in (productionTunnel.attributes ?? {})) {
      pushError(`reference-stale-precutover-semantics: production tunnel still contains ${staleField}`);
    }
  }
}

const activeProductionRoutes = relations.filter(
  (relation) => relation.relationClass === 'routes_to' && relation.sourceId === 'tunnel:cloudflare-production' && relation.state === 'active',
);
if (activeProductionRoutes.length !== 1 || activeProductionRoutes[0]?.targetId !== 'host:dokploy-aws') {
  pushError(`reference-production-route-invalid: expected one active production tunnel route to host:dokploy-aws, found ${activeProductionRoutes.map((relation) => relation.targetId).join(',') || '<none>'}`);
}

const requiredProviderResources = [
  'provider_account:aws-primary',
  'provider_account:azure-prochat-data',
  'provider_account:tailscale-primary',
  'provider_account:cloudflare-prochat',
  'provider_account:newrelic-primary',
  'provider_account:dokploy-primary',
];
for (const resourceId of requiredProviderResources) requireResource(resourceId);

const requiredSafetyResources = [
  'host:dokploy-aws',
  'host:supabase',
  'host:cloudpanel-aws',
  'network:tailnet-infrastructure',
  'tunnel:cloudflare-production',
  'tunnel:cloudflare-cloudpanel-aws',
  ...requiredProviderResources,
  'credential_reference:cloudflare-provisioner',
  'credential_reference:newrelic-query',
  'credential_reference:dokploy-management',
  'credential_reference:aws-provisioner',
  'credential_reference:azure-data-provisioner',
  'credential_reference:tailscale-control',
  'domain:prochat-tools',
  'dns_record:prochat-tools-root',
  'backup_system:office-nightly-maintenance',
  'backup_job:n8n-backup',
  'backup_system:dokploy-aws-recovery',
  'backup_job:dokploy-aws-recovery',
  'backup_system:supabase-recovery',
  'backup_job:supabase-recovery',
  'backup_system:cloudpanel-aws-recovery',
  'backup_job:cloudpanel-aws-recovery',
  'scheduler:office-nightly',
];
for (const resourceId of requiredSafetyResources) {
  if (!resourceById.has(resourceId)) {
    pushError(`reference-protected-resource-missing: ${resourceId}`);
    continue;
  }
  if (!safetyByResourceId.has(resourceId)) pushError(`reference-safety-policy-missing: ${resourceId}`);
}

const forbiddenPacket2Operations = new Set(['mutate', 'delete', 'restore']);
for (const policy of safetyPolicies) {
  const enabledForbiddenOperations = (policy.allowedOperations ?? []).filter((operation) => forbiddenPacket2Operations.has(operation));
  if (enabledForbiddenOperations.length > 0) {
    pushError(`reference-packet2-mutation-authority-forbidden: ${policy.safetyPolicyId} enables ${enabledForbiddenOperations.join(',')}`);
  }
}

for (const policy of healthPolicies) {
  if (policy.unknownIsHealthy !== false) pushError(`reference-health-fail-open: ${policy.healthPolicyId} must set unknownIsHealthy=false`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}
const c = result.counts;
console.log(`infrastructure-catalog-valid schema=${result.schemaId} resources=${c.resources} relations=${c.relations} bindings=${c.serviceBindings} accessRefs=${c.accessReferences} backupPolicies=${c.backupPolicies} healthPolicies=${c.healthPolicies} safetyPolicies=${c.safetyPolicies} resourceClasses=${c.resourceClasses} mappingSources=${result.mappingSources} staleWarnings=${c.staleWarnings} authorityGuards=pass`);
