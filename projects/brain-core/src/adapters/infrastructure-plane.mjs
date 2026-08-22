import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INFRASTRUCTURE_PLANE_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_INFRASTRUCTURE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const CATALOG = Object.freeze({
  manifest: 'operations/infrastructure/catalog/manifest.v1.json',
  assets: 'operations/infrastructure/catalog/assets.v1.json',
  relations: 'operations/infrastructure/catalog/relations.v1.json',
  serviceBindings: 'operations/infrastructure/catalog/service-bindings.v1.json',
  credentials: 'operations/infrastructure/catalog/access-references.v1.json',
  backups: 'operations/infrastructure/catalog/backup-policies.v1.json',
  healthPolicies: 'operations/infrastructure/catalog/health-policies.v1.json',
  safetyPolicies: 'operations/infrastructure/catalog/safety-policies.v1.json',
});

const RUNTIME = Object.freeze({
  health: 'runtime/local/infrastructure/health-state.json',
  incidents: 'runtime/local/infrastructure/incident-state.json',
  actionReceipts: 'runtime/local/infrastructure/action-receipts.json',
});

function readJsonState(root, relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { status: 'missing', path: relativePath, data: null, error: null };
  }
  try {
    return { status: 'ok', path: relativePath, data: JSON.parse(fs.readFileSync(absolutePath, 'utf8')), error: null };
  } catch (error) {
    return {
      status: 'invalid',
      path: relativePath,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function requireCatalogState(state, label) {
  if (state.status !== 'ok' || !state.data || typeof state.data !== 'object') {
    throw new Error(`Infrastructure ${label} unavailable: ${state.status}${state.error ? ` (${state.error})` : ''}`);
  }
  return state.data;
}

export function provenanceFreshness(provenance, now = new Date()) {
  const deadline = Date.parse(provenance?.freshnessDeadline ?? '');
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(deadline) || !Number.isFinite(nowMs)) return 'unknown';
  return deadline >= nowMs ? 'fresh' : 'stale';
}

function withFreshness(value, now) {
  return { ...value, freshness: provenanceFreshness(value?.provenance, now) };
}

function sanitizeCredential(reference, now) {
  return {
    credentialRefId: reference.credentialRefId,
    providerRef: reference.providerRef ?? null,
    purpose: reference.purpose ?? null,
    variableNames: Array.isArray(reference.variableNames) ? [...reference.variableNames] : [],
    scopes: Array.isArray(reference.scopes) ? [...reference.scopes] : [],
    expiryKnown: reference.expiryKnown === true,
    expiresAt: reference.expiresAt ?? null,
    rotateBeforeDays: Number.isFinite(reference.rotateBeforeDays) ? reference.rotateBeforeDays : null,
    lastVerifiedAt: reference.lastVerifiedAt ?? null,
    verificationAdapterRef: reference.verificationAdapterRef ?? null,
    regenerationRunbookRef: reference.regenerationRunbookRef ?? null,
    provenance: reference.provenance ?? null,
    freshness: provenanceFreshness(reference.provenance, now),
  };
}

function runtimeEnvelope(state, arrayKey) {
  const values = state.status === 'ok' && Array.isArray(state.data?.[arrayKey]) ? state.data[arrayKey] : [];
  return {
    runtimeState: state.status,
    sourcePath: state.path,
    generatedAt: state.status === 'ok' ? state.data?.generatedAt ?? null : null,
    error: state.error,
    [arrayKey]: values,
  };
}

function loadPlane(root, now) {
  const manifestState = readJsonState(root, CATALOG.manifest);
  const assetsState = readJsonState(root, CATALOG.assets);
  const relationsState = readJsonState(root, CATALOG.relations);
  const bindingsState = readJsonState(root, CATALOG.serviceBindings);
  const credentialsState = readJsonState(root, CATALOG.credentials);
  const backupsState = readJsonState(root, CATALOG.backups);
  const healthPoliciesState = readJsonState(root, CATALOG.healthPolicies);
  const safetyPoliciesState = readJsonState(root, CATALOG.safetyPolicies);

  const manifest = requireCatalogState(manifestState, 'manifest');
  const assets = requireCatalogState(assetsState, 'assets');
  const relations = requireCatalogState(relationsState, 'relations');
  const serviceBindings = requireCatalogState(bindingsState, 'service bindings');
  const credentials = requireCatalogState(credentialsState, 'credential references');
  const backups = requireCatalogState(backupsState, 'backup policies');
  const healthPolicies = requireCatalogState(healthPoliciesState, 'health policies');
  const safetyPolicies = requireCatalogState(safetyPoliciesState, 'safety policies');

  const resources = (assets.resources ?? []).map((resource) => withFreshness(resource, now));
  const relationItems = (relations.relations ?? []).map((relation) => withFreshness(relation, now));
  const bindingItems = (serviceBindings.serviceBindings ?? []).map((binding) => withFreshness(binding, now));
  const backupItems = (backups.backupPolicies ?? []).map((policy) => withFreshness(policy, now));
  const healthPolicyItems = (healthPolicies.healthPolicies ?? []).map((policy) => withFreshness(policy, now));
  const safetyPolicyItems = (safetyPolicies.safetyPolicies ?? []).map((policy) => withFreshness(policy, now));
  const credentialItems = (credentials.credentialReferences ?? []).map((reference) => sanitizeCredential(reference, now));

  return {
    schemaVersion: INFRASTRUCTURE_PLANE_SCHEMA_VERSION,
    catalogVersion: manifest.catalogVersion ?? assets.catalogVersion ?? null,
    catalogId: manifest.catalogId ?? null,
    manifest,
    resources,
    relations: relationItems,
    serviceBindings: bindingItems,
    backups: backupItems,
    credentials: credentialItems,
    healthPolicies: healthPolicyItems,
    safetyPolicies: safetyPolicyItems,
    runtime: {
      health: readJsonState(root, RUNTIME.health),
      incidents: readJsonState(root, RUNTIME.incidents),
      actionReceipts: readJsonState(root, RUNTIME.actionReceipts),
    },
  };
}

function opts(options = {}) {
  return {
    root: options.root ? path.resolve(options.root) : DEFAULT_INFRASTRUCTURE_ROOT,
    now: options.now instanceof Date ? options.now : new Date(options.now ?? Date.now()),
  };
}

export function readInfrastructureCatalog(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    catalogId: plane.catalogId,
    manifest: plane.manifest,
    resources: plane.resources,
    serviceBindings: plane.serviceBindings,
  };
}

export function readInfrastructureTopology(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    resourceIds: plane.resources.map((resource) => resource.resourceId),
    relations: plane.relations,
  };
}

export function readInfrastructureHealth(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    policies: plane.healthPolicies,
    ...runtimeEnvelope(plane.runtime.health, 'observations'),
  };
}

export function readInfrastructureIncidents(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    ...runtimeEnvelope(plane.runtime.incidents, 'incidents'),
  };
}

export function readInfrastructureBackups(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    backupPolicies: plane.backups,
  };
}

export function readInfrastructureCredentialStatus(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    credentialReferences: plane.credentials,
    containsSecrets: false,
  };
}

export function readInfrastructureSafety(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    safetyPolicies: plane.safetyPolicies,
    executionEnabled: false,
    executionPerformed: false,
    actualEffects: [],
  };
}

export function readInfrastructureActionReceipts(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    ...runtimeEnvelope(plane.runtime.actionReceipts, 'receipts'),
    executionEnabled: false,
  };
}

export function readInfrastructureResource(resourceId, options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  const resource = plane.resources.find((entry) => entry.resourceId === resourceId) ?? null;
  if (!resource) return null;
  const relations = plane.relations.filter((relation) => relation.sourceId === resourceId || relation.targetId === resourceId);
  const health = runtimeEnvelope(plane.runtime.health, 'observations').observations.filter((observation) => observation.resourceId === resourceId);
  const backups = plane.backups.filter((policy) => policy.resourceId === resourceId || policy.backupSystemId === resourceId || policy.backupJobId === resourceId);
  const safetyPolicies = plane.safetyPolicies.filter((policy) => policy.resourceId === resourceId || policy.resourceClass === resource.resourceClass || policy.protectedResourceClass === resource.resourceClass);
  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    resource,
    relations,
    observations: health,
    backupPolicies: backups,
    safetyPolicies,
  };
}

export function readInfrastructureResourceRelations(resourceId, options = {}) {
  const topology = readInfrastructureTopology(options);
  const exists = topology.resourceIds.includes(resourceId);
  if (!exists) return null;
  return {
    schemaVersion: topology.schemaVersion,
    catalogVersion: topology.catalogVersion,
    resourceId,
    relations: topology.relations.filter((relation) => relation.sourceId === resourceId || relation.targetId === resourceId),
  };
}

function countFreshness(values) {
  return values.reduce((counts, value) => {
    const key = value.freshness === 'fresh' || value.freshness === 'stale' ? value.freshness : 'unknown';
    counts[key] += 1;
    return counts;
  }, { fresh: 0, stale: 0, unknown: 0 });
}

function hasUnknownBackup(policy) {
  return [policy.cadence, policy.retentionRef, policy.destinationRef, policy.recoveryClass].some((value) => value === null || String(value ?? '').toLowerCase().startsWith('unknown'));
}

export function readInfrastructureDoctor(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  const health = runtimeEnvelope(plane.runtime.health, 'observations');
  const incidents = runtimeEnvelope(plane.runtime.incidents, 'incidents');
  const receipts = runtimeEnvelope(plane.runtime.actionReceipts, 'receipts');
  const activeIncidents = incidents.incidents.filter((incident) => incident.status === 'open' || incident.status === 'suppressed');
  const resourceFreshness = countFreshness(plane.resources);
  const unknownBackups = plane.backups.filter(hasUnknownBackup).length;
  const unknownCredentialExpiry = plane.credentials.filter((credential) => credential.expiryKnown !== true).length;
  const runtimeUnknowns = [health, incidents, receipts]
    .filter((entry) => entry.runtimeState !== 'ok')
    .map((entry) => `${entry.sourcePath}:${entry.runtimeState}`);

  return {
    schemaVersion: plane.schemaVersion,
    catalogVersion: plane.catalogVersion,
    readOnly: true,
    executionEnabled: false,
    counts: {
      resources: plane.resources.length,
      relations: plane.relations.length,
      serviceBindings: plane.serviceBindings.length,
      healthPolicies: plane.healthPolicies.length,
      safetyPolicies: plane.safetyPolicies.length,
      backupPolicies: plane.backups.length,
      credentialReferences: plane.credentials.length,
      observations: health.observations.length,
      activeIncidents: activeIncidents.length,
      actionReceipts: receipts.receipts.length,
      unknownBackups,
      unknownCredentialExpiry,
    },
    freshness: resourceFreshness,
    runtime: {
      health: health.runtimeState,
      incidents: incidents.runtimeState,
      actionReceipts: receipts.runtimeState,
    },
    unknowns: runtimeUnknowns,
  };
}

export function readInfrastructureStatus(options = {}) {
  return {
    schemaVersion: INFRASTRUCTURE_PLANE_SCHEMA_VERSION,
    catalog: readInfrastructureCatalog(options),
    topology: readInfrastructureTopology(options),
    health: readInfrastructureHealth(options),
    incidents: readInfrastructureIncidents(options),
    backups: readInfrastructureBackups(options),
    credentials: readInfrastructureCredentialStatus(options),
    safety: readInfrastructureSafety(options),
    actionReceipts: readInfrastructureActionReceipts(options),
    doctor: readInfrastructureDoctor(options),
  };
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

function resourceSearchText(resource) {
  return [resource.resourceId, resource.resourceClass, resource.name, resource.lifecycleState, resource.owner, JSON.stringify(resource.attributes ?? {})]
    .join(' ')
    .toLowerCase();
}

export function buildInfrastructureContextDescriptor(options = {}) {
  const { root, now } = opts(options);
  const plane = loadPlane(root, now);
  const doctor = readInfrastructureDoctor({ root, now });
  return {
    schemaVersion: plane.schemaVersion,
    providerId: 'infrastructure-plane',
    providerKind: 'infrastructure_context',
    contextRole: 'machine_capability',
    sourceRevision: `catalog:${plane.catalogVersion ?? 'unknown'}`,
    health: 'healthy',
    freshness: 'fresh',
    authoritative: true,
    summary: `Canonical infrastructure catalog ${plane.catalogVersion ?? 'unknown'}: ${plane.resources.length} resources, ${plane.relations.length} relations; ${doctor.freshness.stale} resource records are stale and remain explicitly visible; runtime health/incidents/receipts remain derived and may be unavailable.`,
    resourceCount: plane.resources.length,
    relationCount: plane.relations.length,
    readOnly: true,
  };
}

export function resolveInfrastructureContext(query, options = {}) {
  const { root, now } = opts(options);
  const maxItems = Number.isInteger(options.maxItems) ? Math.max(1, Math.min(options.maxItems, 20)) : 8;
  const maxTokens = Number.isInteger(options.maxTokens) ? Math.max(1, Math.min(options.maxTokens, 4000)) : 1200;
  const normalized = String(query ?? '').trim().toLowerCase();
  if (!normalized) throw new Error('invalid_query');
  const plane = loadPlane(root, now);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const candidates = plane.resources
    .map((resource) => ({ resource, text: resourceSearchText(resource) }))
    .filter(({ text }) => tokens.every((token) => text.includes(token)) || tokens.some((token) => text.includes(token)))
    .sort((left, right) => left.resource.resourceId.localeCompare(right.resource.resourceId));

  const items = [];
  let usedTokens = 0;
  for (const { resource } of candidates) {
    if (items.length >= maxItems) break;
    const relationCount = plane.relations.filter((relation) => relation.sourceId === resource.resourceId || relation.targetId === resource.resourceId).length;
    const item = {
      itemId: resource.resourceId,
      summary: `${resource.name} (${resource.resourceClass}, ${resource.lifecycleState}); freshness=${resource.freshness}; relations=${relationCount}.`,
      citation: resource.provenance?.sourceRef ?? CATALOG.assets,
      authority: resource.provenance?.classification ?? 'UNKNOWN',
      freshness: resource.freshness,
    };
    const tokenEstimate = estimateTokens(item);
    if (usedTokens + tokenEstimate > maxTokens) break;
    items.push(item);
    usedTokens += tokenEstimate;
  }

  const doctor = readInfrastructureDoctor({ root, now });
  return {
    items,
    unknowns: [...doctor.unknowns],
    conflicts: [],
    budget: { maxItems, maxTokens, usedTokens },
  };
}

export function getInfrastructureMcpCapabilities(options = {}) {
  const doctor = readInfrastructureDoctor(options);
  const descriptors = [
    ['infra.status', '/infra/status', 'Compact canonical infrastructure status'],
    ['infra.catalog', '/infra/catalog', 'Canonical infrastructure resources and bindings'],
    ['infra.topology', '/infra/topology', 'Canonical infrastructure relations'],
    ['infra.health', '/infra/health', 'Derived health observations plus canonical policies'],
    ['infra.incidents', '/infra/incidents', 'Derived infrastructure incident state'],
    ['infra.backups', '/infra/backups', 'Canonical backup and restore policy state'],
    ['infra.credentials', '/infra/credentials/status', 'Non-secret credential metadata and expiry status'],
    ['infra.inspect', '/infra/resources/:id', 'Exact canonical resource inspection'],
    ['infra.doctor', '/infra/doctor', 'Cross-plane freshness and runtime diagnostics'],
  ];
  return {
    schemaVersion: INFRASTRUCTURE_PLANE_SCHEMA_VERSION,
    catalogVersion: doctor.catalogVersion,
    sourceNeutral: true,
    readOnly: true,
    executionExposed: false,
    capabilities: descriptors.map(([capabilityId, endpoint, summary]) => ({
      capabilityId,
      capabilityKind: 'mcp_tool',
      summary,
      transportRef: `brain-core:${endpoint}`,
      riskClass: 'read-only',
      confirmationClass: 'none',
      canonicalModel: `ikhp-catalog:${doctor.catalogVersion}`,
    })),
  };
}
