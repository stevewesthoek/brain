import fs from 'node:fs';
import path from 'node:path';
import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';

export const REQUIRED_RESOURCE_CLASSES = Object.freeze([
  'host', 'application', 'service', 'database', 'storage', 'backup_system', 'backup_job',
  'network', 'tunnel', 'domain', 'dns_record', 'provider_account', 'credential_reference',
  'scheduler', 'monitor', 'control_plane',
]);

export const REQUIRED_RELATION_CLASSES = Object.freeze([
  'runs_on', 'depends_on', 'connects_to', 'routes_to', 'monitored_by', 'backed_up_by',
  'authenticates_with', 'configured_by', 'owned_by', 'replaced_by', 'fails_over_to',
]);

export const REQUIRED_MAPPING_SOURCES = Object.freeze([
  'operations/infrastructure/infra.md',
  'operations/architecture/prochat-infrastructure-architecture.md',
  'operations/architecture/prochat-infrastructure-evidence-register.md',
  'operations/accounts/credentials-index.md',
  'operations/infrastructure/local-apps.json',
  'operations/infrastructure/scheduler-inventory.md',
  'operations/specs/infinite-brain-recovery-inventory.json',
  'operations/fixtures/context-learning-deployment-profiles-v1.json',
  'projects/brain-core/src/adapters/infra-new-relic.ts',
  'projects/brain-core/src/adapters/infra-cloudflare-tunnels.ts',
  'projects/brain-core/src/adapters/infra-dokploy.ts',
]);

export const FORBIDDEN_PUBLIC_COUPLING = Object.freeze([
  'steve', 'office', 'macbook', 'brain', 'mind', 'obsidian', 'new relic', 'newrelic',
  'cloudflare', 'tailscale', 'dokploy',
]);

const FORBIDDEN_RAW_ACCESS_KEYS = new Set([
  'value', 'token', 'password', 'secret', 'apikey', 'api_key', 'privatekey', 'private_key',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'client_secret', 'clientsecret',
]);

const SAFE_REFERENCE_PREFIXES = Object.freeze([
  '~/.config/', 'secret-ref://', 'keychain-ref://', 'vault-ref://', 'env-ref://', 'reference://',
]);

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function validateProvenance(provenance, label, errors, warnings, now) {
  if (!provenance || typeof provenance !== 'object') {
    pushUnique(errors, `${label}: missing provenance`);
    return;
  }
  const verified = Date.parse(provenance.verifiedAt ?? '');
  const deadline = Date.parse(provenance.freshnessDeadline ?? '');
  if (!Number.isFinite(verified)) pushUnique(errors, `${label}: invalid verifiedAt`);
  if (!Number.isFinite(deadline)) pushUnique(errors, `${label}: invalid freshnessDeadline`);
  if (Number.isFinite(verified) && Number.isFinite(deadline) && deadline < verified) {
    pushUnique(errors, `${label}: freshnessDeadline precedes verifiedAt`);
  }
  if (Number.isFinite(deadline) && deadline < now.getTime()) {
    pushUnique(warnings, `${label}: stale provenance since ${provenance.freshnessDeadline}`);
  }
}

function scanAccessMetadata(value, label, errors, keyPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanAccessMetadata(entry, label, errors, `${keyPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_RAW_ACCESS_KEYS.has(normalized)) {
      pushUnique(errors, `${label}: forbidden raw-access field ${keyPath}.${key}`);
    }
    if (key === 'secretStoreRef' && typeof child === 'string' && !SAFE_REFERENCE_PREFIXES.some((prefix) => child.startsWith(prefix))) {
      pushUnique(errors, `${label}: secretStoreRef must be an opaque reference/path, not inline material`);
    }
    scanAccessMetadata(child, label, errors, `${keyPath}.${key}`);
  }
}

function validateResourceIds(resources, errors) {
  const byId = new Map();
  const providerEntities = new Map();
  for (const resource of resources) {
    const existing = byId.get(resource.resourceId);
    if (existing) {
      pushUnique(errors, `duplicate-resource-id: ${resource.resourceId}`);
      if ((existing.canonicalOwnerRef ?? null) !== (resource.canonicalOwnerRef ?? null)) {
        pushUnique(errors, `competing-canonical-owner: ${resource.resourceId}`);
      }
    } else {
      byId.set(resource.resourceId, resource);
    }
    const expectedPrefix = `${resource.resourceClass}:`;
    if (!String(resource.resourceId ?? '').startsWith(expectedPrefix)) {
      pushUnique(errors, `resource-id-class-mismatch: ${resource.resourceId} expected prefix ${expectedPrefix}`);
    }
    if (resource.providerEntityRef) {
      const owner = providerEntities.get(resource.providerEntityRef);
      if (owner && owner !== resource.resourceId && resource.lifecycleState === 'active') {
        pushUnique(errors, `competing-provider-entity: ${resource.providerEntityRef} => ${owner}, ${resource.resourceId}`);
      } else {
        providerEntities.set(resource.providerEntityRef, resource.resourceId);
      }
    }
  }
  return byId;
}

function validateRelations(relations, resourcesById, errors) {
  const ids = new Set();
  const facts = new Map();
  for (const relation of relations) {
    if (ids.has(relation.relationId)) pushUnique(errors, `duplicate-relation-id: ${relation.relationId}`);
    ids.add(relation.relationId);
    if (!resourcesById.has(relation.sourceId)) pushUnique(errors, `unresolved-relation-source: ${relation.relationId} -> ${relation.sourceId}`);
    if (!resourcesById.has(relation.targetId)) pushUnique(errors, `unresolved-relation-target: ${relation.relationId} -> ${relation.targetId}`);
    const factKey = `${relation.relationClass}|${relation.sourceId}|${relation.targetId}`;
    const prior = facts.get(factKey);
    if (prior) {
      if (prior.state !== relation.state || JSON.stringify(prior.attributes ?? {}) !== JSON.stringify(relation.attributes ?? {})) {
        pushUnique(errors, `contradictory-topology-fact: ${factKey}`);
      } else {
        pushUnique(errors, `duplicate-relation-fact: ${factKey}`);
      }
    } else {
      facts.set(factKey, relation);
    }
  }
}

function validateReferences(bundle, resourcesById, errors) {
  const bindingIds = new Set();
  for (const binding of bundle.serviceBindings ?? []) {
    if (bindingIds.has(binding.bindingId)) pushUnique(errors, `duplicate-binding-id: ${binding.bindingId}`);
    bindingIds.add(binding.bindingId);
    if (!resourcesById.has(binding.serviceId)) pushUnique(errors, `binding-missing-service: ${binding.bindingId} -> ${binding.serviceId}`);
    if (!resourcesById.has(binding.resourceId)) pushUnique(errors, `binding-missing-resource: ${binding.bindingId} -> ${binding.resourceId}`);
  }

  const accessIds = new Set();
  for (const ref of bundle.credentialReferences ?? []) {
    if (accessIds.has(ref.credentialRefId)) pushUnique(errors, `duplicate-access-reference: ${ref.credentialRefId}`);
    accessIds.add(ref.credentialRefId);
    const resource = resourcesById.get(ref.credentialRefId);
    if (!resource || resource.resourceClass !== 'credential_reference') pushUnique(errors, `access-reference-resource-missing: ${ref.credentialRefId}`);
    if (!resourcesById.has(ref.providerRef)) pushUnique(errors, `access-reference-provider-missing: ${ref.credentialRefId} -> ${ref.providerRef}`);
    scanAccessMetadata(ref, `access-reference ${ref.credentialRefId}`, errors);
  }

  for (const policy of bundle.backupPolicies ?? []) {
    for (const [field, id] of [['resourceId', policy.resourceId], ['backupSystemId', policy.backupSystemId], ['backupJobId', policy.backupJobId]]) {
      if (!resourcesById.has(id)) pushUnique(errors, `backup-policy-missing-${field}: ${policy.backupPolicyId} -> ${id}`);
    }
  }
  for (const policy of bundle.healthPolicies ?? []) {
    if (!resourcesById.has(policy.resourceId)) pushUnique(errors, `health-policy-resource-missing: ${policy.healthPolicyId} -> ${policy.resourceId}`);
  }
  for (const policy of bundle.safetyPolicies ?? []) {
    if (!resourcesById.has(policy.resourceId)) pushUnique(errors, `safety-policy-resource-missing: ${policy.safetyPolicyId} -> ${policy.resourceId}`);
  }
}

function validateAllProvenance(bundle, errors, warnings, now) {
  const collections = [
    ['resource', bundle.resources ?? [], 'resourceId'],
    ['relation', bundle.relations ?? [], 'relationId'],
    ['binding', bundle.serviceBindings ?? [], 'bindingId'],
    ['access-reference', bundle.credentialReferences ?? [], 'credentialRefId'],
    ['backup-policy', bundle.backupPolicies ?? [], 'backupPolicyId'],
    ['health-policy', bundle.healthPolicies ?? [], 'healthPolicyId'],
    ['safety-policy', bundle.safetyPolicies ?? [], 'safetyPolicyId'],
  ];
  for (const [kind, entries, idField] of collections) {
    for (const entry of entries) validateProvenance(entry.provenance, `${kind} ${entry[idField]}`, errors, warnings, now);
  }
}

export function validateCatalogBundle({ schema, bundle, now = new Date(), label = 'catalog' }) {
  const errors = [];
  const warnings = [];
  errors.push(...validateJsonSchema(schema.$defs.catalogBundle, bundle, schema, `$${label}`));
  const resourcesById = validateResourceIds(bundle.resources ?? [], errors);
  validateRelations(bundle.relations ?? [], resourcesById, errors);
  validateReferences(bundle, resourcesById, errors);
  validateAllProvenance(bundle, errors, warnings, now);
  scanAccessMetadata(bundle.credentialReferences ?? [], `${label} access metadata`, errors);

  const resourceClasses = new Set((bundle.resources ?? []).map((resource) => resource.resourceClass));
  const relationClasses = new Set((bundle.relations ?? []).map((relation) => relation.relationClass));
  return {
    errors,
    warnings,
    counts: {
      resources: bundle.resources?.length ?? 0,
      relations: bundle.relations?.length ?? 0,
      serviceBindings: bundle.serviceBindings?.length ?? 0,
      accessReferences: bundle.credentialReferences?.length ?? 0,
      backupPolicies: bundle.backupPolicies?.length ?? 0,
      healthPolicies: bundle.healthPolicies?.length ?? 0,
      safetyPolicies: bundle.safetyPolicies?.length ?? 0,
      resourceClasses: resourceClasses.size,
      relationClasses: relationClasses.size,
      staleWarnings: warnings.filter((warning) => warning.includes('stale provenance')).length,
    },
  };
}

function assertExactEnum(actual, required, label, errors) {
  const actualSorted = [...actual].sort();
  const requiredSorted = [...required].sort();
  if (JSON.stringify(actualSorted) !== JSON.stringify(requiredSorted)) {
    pushUnique(errors, `${label}: expected ${requiredSorted.join(', ')} got ${actualSorted.join(', ')}`);
  }
}

function validatePublicPortability(schema, alternate, errors) {
  const schemaText = JSON.stringify(schema).toLowerCase();
  const alternateText = JSON.stringify(alternate).toLowerCase();
  for (const term of FORBIDDEN_PUBLIC_COUPLING) {
    if (schemaText.includes(term)) pushUnique(errors, `public-schema-coupling: ${term}`);
    if (alternateText.includes(term)) pushUnique(errors, `alternate-fixture-coupling: ${term}`);
  }
  assertExactEnum(schema.$defs.resourceClass?.enum ?? [], REQUIRED_RESOURCE_CLASSES, 'resource-class-contract', errors);
  assertExactEnum(schema.$defs.relationClass?.enum ?? [], REQUIRED_RELATION_CLASSES, 'relation-class-contract', errors);
  const alternateResourceClasses = new Set((alternate.resources ?? []).map((resource) => resource.resourceClass));
  const alternateRelationClasses = new Set((alternate.relations ?? []).map((relation) => relation.relationClass));
  for (const resourceClass of REQUIRED_RESOURCE_CLASSES) if (!alternateResourceClasses.has(resourceClass)) pushUnique(errors, `alternate-fixture-missing-resource-class: ${resourceClass}`);
  for (const relationClass of REQUIRED_RELATION_CLASSES) if (!alternateRelationClasses.has(relationClass)) pushUnique(errors, `alternate-fixture-missing-relation-class: ${relationClass}`);
}

export function loadAndValidateReferenceCatalog(root, now = new Date()) {
  const errors = [];
  const warnings = [];
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-catalog-v1.schema.json'));
  const manifest = loadJson(path.join(root, 'operations/infrastructure/catalog/manifest.v1.json'));
  const alternate = loadJson(path.join(root, 'operations/fixtures/infrastructure-catalog-alternate-v1.json'));
  errors.push(...validateJsonSchema(schema.$defs.manifest, manifest, schema, '$.manifest'));
  validateProvenance(manifest.provenance, 'manifest', errors, warnings, now);

  const loaded = {};
  for (const [key, relativePath] of Object.entries(manifest.files ?? {})) {
    if (!relativePath.startsWith('operations/infrastructure/catalog/')) pushUnique(errors, `manifest-path-outside-catalog: ${key} -> ${relativePath}`);
    const absolute = path.join(root, relativePath);
    if (!fs.existsSync(absolute)) {
      pushUnique(errors, `manifest-path-missing: ${key} -> ${relativePath}`);
      continue;
    }
    loaded[key] = loadJson(absolute);
  }

  const wrapperDefs = {
    assets: 'assetCatalog', relations: 'relationCatalog', serviceBindings: 'serviceBindingCatalog',
    credentialReferences: 'credentialReferenceCatalog', backupPolicies: 'backupPolicyCatalog',
    healthPolicies: 'healthPolicyCatalog', safetyPolicies: 'safetyPolicyCatalog',
  };
  for (const [key, defName] of Object.entries(wrapperDefs)) {
    if (loaded[key]) errors.push(...validateJsonSchema(schema.$defs[defName], loaded[key], schema, `$.${key}`));
  }

  const bundle = {
    schemaVersion: manifest.schemaVersion,
    catalogVersion: manifest.catalogVersion,
    resources: loaded.assets?.resources ?? [],
    relations: loaded.relations?.relations ?? [],
    serviceBindings: loaded.serviceBindings?.serviceBindings ?? [],
    credentialReferences: loaded.credentialReferences?.credentialReferences ?? [],
    backupPolicies: loaded.backupPolicies?.backupPolicies ?? [],
    healthPolicies: loaded.healthPolicies?.healthPolicies ?? [],
    safetyPolicies: loaded.safetyPolicies?.safetyPolicies ?? [],
  };
  const referenceResult = validateCatalogBundle({ schema, bundle, now, label: '.reference' });
  referenceResult.errors.forEach((error) => pushUnique(errors, error));
  referenceResult.warnings.forEach((warning) => pushUnique(warnings, warning));

  const alternateResult = validateCatalogBundle({ schema, bundle: alternate, now, label: '.alternate' });
  alternateResult.errors.forEach((error) => pushUnique(errors, error));
  alternateResult.warnings.forEach((warning) => pushUnique(warnings, warning));
  validatePublicPortability(schema, alternate, errors);

  const mappingPath = path.join(root, manifest.mappingReportRef ?? '');
  if (!manifest.mappingReportRef || !fs.existsSync(mappingPath)) {
    pushUnique(errors, `mapping-report-missing: ${manifest.mappingReportRef ?? '<none>'}`);
  } else {
    const mappingText = fs.readFileSync(mappingPath, 'utf8');
    for (const requiredSource of REQUIRED_MAPPING_SOURCES) {
      if (!mappingText.includes(requiredSource)) pushUnique(errors, `mapping-source-missing: ${requiredSource}`);
    }
  }

  return {
    errors,
    warnings,
    counts: referenceResult.counts,
    alternateCounts: alternateResult.counts,
    mappingSources: REQUIRED_MAPPING_SOURCES.length,
    schemaId: schema.$id,
    manifest,
    bundle,
    alternate,
  };
}
