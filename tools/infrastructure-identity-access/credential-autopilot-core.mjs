import fs from 'node:fs';
import path from 'node:path';

import { readIdentityAccessCatalog } from './credential-vault-core.mjs';

export const AUTOPILOT_SCHEMA_VERSION = '1.0.0';
export const AUTOPILOT_STATE_PATH = path.join('runtime', 'local', 'infrastructure', 'credential-autopilot-state.json');
export const HOST_CATALOG_PATH = path.join('operations', 'infrastructure', 'catalog', 'assets.v1.json');
export const ACCESS_REFERENCE_PATH = path.join('operations', 'infrastructure', 'catalog', 'access-references.v1.json');

function readJson(root, relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function safeText(value, max = 512) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function iso(value, label = 'timestamp') {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return new Date(parsed).toISOString();
}

function hostIds(root, hostCatalog = readJson(root, HOST_CATALOG_PATH, { resources: [] })) {
  return (hostCatalog.resources ?? [])
    .filter((resource) => resource.resourceClass === 'host' && resource.lifecycleState === 'active' && resource.attributes?.platform === 'macos')
    .map((resource) => resource.resourceId)
    .filter((resourceId) => /^host:[a-z0-9][a-z0-9._-]*$/.test(resourceId))
    .sort();
}

function classifyAccessReference(reference) {
  const adapter = String(reference.secretStoreAdapter ?? '').toLowerCase();
  const provenance = JSON.stringify(reference.provenance ?? {}).toLowerCase();
  if (adapter.includes('application') || provenance.includes('application-owned')) return 'application_managed';
  if (adapter.includes('provider') || provenance.includes('provider-owned')) return 'provider_managed';
  if (adapter.includes('host') || provenance.includes('host-owned')) return 'host_managed';
  if (adapter === 'secret-store:macos-keychain' || adapter === 'macos-keychain') return 'brain_managed';
  if (reference.provenance?.classification === 'DEPRECATED') return 'deprecated';
  return 'unknown';
}

function metadataCandidate({ id, provider, purpose, classification, source, scopes = [], variableNames = [], expiryKnown = false, expiresAt = null }) {
  return {
    candidateId: id,
    providerRef: safeText(provider, 256),
    purpose: safeText(purpose, 512),
    ownershipClass: classification,
    source,
    scopes: [...new Set(variableNames.length > 0 ? [...scopes, ...variableNames.map(() => 'configured_reference')] : scopes)].slice(0, 64),
    requiredEnvironmentNames: [...new Set(variableNames)].filter((name) => /^[A-Z][A-Z0-9_]{1,127}$/.test(name)).slice(0, 64),
    expiry: {
      state: expiryKnown === true && expiresAt ? 'known' : expiryKnown === true ? 'unknown' : 'not_observed',
      expiresAt: expiryKnown === true && expiresAt ? iso(expiresAt, 'expiresAt') : null,
    },
    hasSecretStoreReference: typeof source === 'string',
    containsSecrets: false,
  };
}

export function discoverCredentialCandidates({ root = process.cwd(), catalog = readIdentityAccessCatalog(root), accessReferences = readJson(root, ACCESS_REFERENCE_PATH, { credentialReferences: [] }) } = {}) {
  const candidates = [];
  for (const credential of catalog.credentials ?? []) {
    candidates.push(metadataCandidate({
      id: credential.credentialId,
      provider: credential.accountId,
      purpose: `admitted Brain credential (${credential.credentialKind})`,
      classification: credential.secretOwner === 'secret_store' ? 'brain_managed' : `${credential.secretOwner ?? 'unknown'}_managed`,
      source: 'identity-access-catalog',
      scopes: credential.scopeSummary,
      expiryKnown: credential.expiryState === 'known',
      expiresAt: credential.expiresAt,
    }));
  }
  for (const reference of accessReferences.credentialReferences ?? []) {
    const id = safeText(reference.credentialRefId, 256);
    if (!id || candidates.some((candidate) => candidate.candidateId === id)) continue;
    candidates.push(metadataCandidate({
      id,
      provider: reference.providerRef,
      purpose: reference.purpose,
      classification: classifyAccessReference(reference),
      source: 'access-reference-catalog',
      scopes: reference.scopes,
      variableNames: reference.variableNames,
      expiryKnown: reference.expiryKnown,
      expiresAt: reference.expiresAt,
    }));
  }
  return candidates.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

function expiryWindow({ expiresAt, now, rotateBeforeSeconds = null, expiringWithinSeconds = 86400 }) {
  if (!expiresAt) return { state: 'unknown', expiresAt: null, provenance: 'unknown', secondsRemaining: null };
  const expiryMs = Date.parse(expiresAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(expiryMs) || !Number.isFinite(nowMs)) return { state: 'unknown', expiresAt: null, provenance: 'unknown', secondsRemaining: null };
  const secondsRemaining = Math.floor((expiryMs - nowMs) / 1000);
  if (secondsRemaining <= 0) return { state: 'expired', expiresAt: new Date(expiryMs).toISOString(), provenance: 'provider_or_catalog', secondsRemaining };
  if (Number.isInteger(rotateBeforeSeconds) && secondsRemaining <= rotateBeforeSeconds) return { state: 'renewal_window', expiresAt: new Date(expiryMs).toISOString(), provenance: 'provider_or_catalog', secondsRemaining };
  if (secondsRemaining <= expiringWithinSeconds) return { state: 'urgent', expiresAt: new Date(expiryMs).toISOString(), provenance: 'provider_or_catalog', secondsRemaining };
  return { state: 'normal', expiresAt: new Date(expiryMs).toISOString(), provenance: 'provider_or_catalog', secondsRemaining };
}

export function buildHostCoverage({ catalog, hosts = [], hostObservations = {} } = {}) {
  const normalizedHosts = [...new Set(hosts)].sort();
  return (catalog.credentials ?? []).map((credential) => {
    const requiredHosts = Array.isArray(credential.requiredHosts) ? credential.requiredHosts.filter((host) => normalizedHosts.includes(host)).sort() : [];
    const perHost = Object.fromEntries(normalizedHosts.map((host) => {
      const observation = hostObservations[host]?.[credential.credentialId] ?? null;
      return [host, {
        required: requiredHosts.includes(host),
        state: observation?.state ?? (requiredHosts.includes(host) ? 'not_observed' : 'not_required'),
        lastVerifiedAt: observation?.lastVerifiedAt ?? null,
      }];
    }));
    return {
      credentialId: credential.credentialId,
      requiredHosts,
      provisionedHosts: Object.entries(perHost).filter(([, state]) => state.state === 'healthy' || state.state === 'present').map(([host]) => host),
      healthyHosts: Object.entries(perHost).filter(([, state]) => state.state === 'healthy').map(([host]) => host),
      missingHosts: Object.entries(perHost).filter(([, state]) => state.required && state.state === 'missing').map(([host]) => host),
      lastVerifiedByHost: Object.fromEntries(Object.entries(perHost).filter(([, state]) => state.lastVerifiedAt).map(([host, state]) => [host, state.lastVerifiedAt])),
      perHost,
      containsSecrets: false,
    };
  });
}

export function buildExpiryState({ catalog, now = new Date().toISOString(), health = null } = {}) {
  const policies = new Map((catalog.lifecyclePolicies ?? []).map((policy) => [policy.lifecyclePolicyId, policy]));
  const verificationPolicies = new Map((catalog.verificationPolicies ?? []).map((policy) => [policy.verificationPolicyId, policy]));
  const evaluations = new Map((health?.summary?.evaluations ?? []).map((evaluation) => [evaluation.credentialId, evaluation]));
  return (catalog.credentials ?? []).map((credential) => {
    const lifecycle = policies.get(credential.lifecyclePolicyId);
    const verification = verificationPolicies.get(credential.verificationPolicyId);
    return {
      credentialId: credential.credentialId,
      expiresAt: credential.expiresAt ?? null,
      expiryProvenance: credential.expiryState === 'known' ? 'catalog_declared' : 'unknown',
      lastVerifiedAt: credential.lastVerifiedAt ?? null,
      nextVerificationAt: evaluations.get(credential.credentialId)?.nextDueAt ?? null,
      window: expiryWindow({ expiresAt: credential.expiresAt, now, rotateBeforeSeconds: lifecycle?.rotateBeforeSeconds, expiringWithinSeconds: verification?.expiringWithinSeconds }),
      containsSecrets: false,
    };
  });
}

export function buildRotationReadiness({ catalog } = {}) {
  const lifecyclePolicies = new Map((catalog.lifecyclePolicies ?? []).map((policy) => [policy.lifecyclePolicyId, policy]));
  return (catalog.credentials ?? []).map((credential) => {
    const lifecycle = lifecyclePolicies.get(credential.lifecyclePolicyId);
    const mode = lifecycle?.rotationMode ?? 'forbidden';
    const automatic = credential.secretOwner === 'secret_store' && mode === 'provider_managed';
    return {
      credentialId: credential.credentialId,
      mode,
      automatic,
      action: automatic ? 'automatic_bounded_rotation' : mode === 'approval_gated' ? 'notify_human_for_rotation' : 'no_rotation',
      rollbackRequired: automatic,
      containsSecrets: false,
    };
  });
}

export function observeApplicationAuth({ catalog } = {}) {
  return (catalog.sessions ?? []).filter((session) => session.authenticationStorage?.owner === 'application' || session.stateOwner === 'application').map((session) => ({
    sessionId: session.sessionId,
    applicationRef: session.applicationRef ?? null,
    hostId: session.runtimeInstanceId?.match(/^runtime_instance:([^.]+)/)?.[1] ? `host:${session.runtimeInstanceId.match(/^runtime_instance:([^.]+)/)[1]}` : null,
    state: session.lastKnownState ?? session.authenticationStorage?.healthState ?? 'unknown',
    recoveryRunbookRef: session.recoveryRunbookRef ?? null,
    source: 'application-owned-observation',
    containsSecrets: false,
  }));
}

export function buildAutopilotSnapshot({ root = process.cwd(), catalog = readIdentityAccessCatalog(root), now = new Date().toISOString(), health = null, hostObservations = {}, hostCatalog = null, accessReferences = null } = {}) {
  const hosts = hostIds(root, hostCatalog ?? readJson(root, HOST_CATALOG_PATH, { resources: [] }));
  const candidates = discoverCredentialCandidates({ root, catalog, accessReferences: accessReferences ?? readJson(root, ACCESS_REFERENCE_PATH, { credentialReferences: [] }) });
  const hostCoverage = buildHostCoverage({ catalog, hosts, hostObservations });
  const expiry = buildExpiryState({ catalog, now, health });
  const rotation = buildRotationReadiness({ catalog });
  const applicationAuth = observeApplicationAuth({ catalog });
  return {
    schemaVersion: AUTOPILOT_SCHEMA_VERSION,
    generatedAt: iso(now, 'now'),
    activation: { mode: 'existing-brain-scheduler', cadence: 'daily at 03:00 Europe/Lisbon', noStandaloneDaemon: true },
    discovery: { candidates, counts: Object.fromEntries(['brain_managed', 'application_managed', 'provider_managed', 'host_managed', 'unknown', 'deprecated'].map((classification) => [classification, candidates.filter((candidate) => candidate.ownershipClass === classification).length])), containsSecrets: false },
    health: health ? { summary: health.summary, containsSecrets: false } : { summary: null, containsSecrets: false },
    expiry,
    rotation,
    hostCoverage,
    hosts: hosts.map((hostId) => ({ hostId, state: hostId === 'host:office' ? 'local_authority_host' : 'remote_observation_required', containsSecrets: false })),
    applicationAuth,
    noNotificationHealthy: !health || (health.summary?.incidents?.length ?? 0) === 0,
    containsSecrets: false,
  };
}

export function writeAutopilotSnapshot({ root = process.cwd(), snapshot, outputPath = AUTOPILOT_STATE_PATH } = {}) {
  if (!snapshot || snapshot.containsSecrets !== false) throw new Error('autopilot_snapshot_must_be_non_secret');
  const absolute = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true, mode: 0o700 });
  const temporary = `${absolute}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
  try { fs.chmodSync(absolute, 0o600); } catch { /* best effort */ }
  return absolute;
}
