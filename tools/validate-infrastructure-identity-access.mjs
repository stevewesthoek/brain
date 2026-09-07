#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';
import { validateMultiHostTopology } from './infrastructure-catalog/account-runtime-architecture.mjs';

export const SCHEMA_PATH = 'operations/specs/infrastructure-identity-access-v1.schema.json';
export const CATALOG_PATH = 'operations/infrastructure/catalog/identity-access.v1.json';
export const ALTERNATE_FIXTURE_PATH = 'operations/fixtures/infrastructure-identity-access-alternate-v1.json';
export const OBSERVATION_FIXTURE_PATH = 'operations/fixtures/infrastructure-identity-access-observations-v1.json';
export const INFRASTRUCTURE_CATALOG_PATH = 'operations/infrastructure/catalog/assets.v1.json';

const RAW_ACCESS_KEYS = new Set([
  'value', 'token', 'password', 'apikey', 'api_key', 'privatekey', 'private_key',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'client_secret', 'clientsecret',
]);
const SAFE_REFERENCE_PREFIXES = Object.freeze([
  'secret-ref://', 'vault-ref://', 'keychain-ref://', 'opaque-ref://',
]);
const EXPECTED_PRINCIPAL_CHECK = 'expected_principal_matches';
const FRESHNESS_CHECK = 'evidence_fresh';

function pushUnique(errors, message) {
  if (!errors.includes(message)) errors.push(message);
}

function scanSecretSafety(value, label, errors, keyPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSecretSafety(entry, label, errors, `${keyPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (RAW_ACCESS_KEYS.has(normalized)) pushUnique(errors, `${label}: forbidden raw-access field ${keyPath}.${key}`);
    if (key === 'secretStoreRef' && child !== null && (typeof child !== 'string' || !SAFE_REFERENCE_PREFIXES.some((prefix) => child.startsWith(prefix)))) {
      pushUnique(errors, `${label}: secretStoreRef must be an opaque reference, not inline material`);
    }
    scanSecretSafety(child, label, errors, `${keyPath}.${key}`);
  }
}

function validateProvenance(provenance, label, errors) {
  if (!provenance) return;
  const verifiedAt = Date.parse(provenance.verifiedAt ?? '');
  const deadline = Date.parse(provenance.freshnessDeadline ?? '');
  if (Number.isFinite(verifiedAt) && Number.isFinite(deadline) && deadline < verifiedAt) {
    pushUnique(errors, `${label}: freshnessDeadline precedes verifiedAt`);
  }
}

function validateBinding(binding, accountId, label, errors) {
  if (!binding) return;
  validateProvenance(binding.provenance, `${label} binding`, errors);
  const observedAt = Date.parse(binding.provenance?.verifiedAt ?? '');
  const expiresAt = binding.expiresAt === null ? null : Date.parse(binding.expiresAt ?? '');
  if (expiresAt !== null && Number.isFinite(observedAt) && Number.isFinite(expiresAt) && expiresAt < observedAt) {
    pushUnique(errors, `${label}: binding expiresAt precedes provenance.verifiedAt`);
  }
  if (binding.state === 'provider_verified' && !['OBSERVED-VERIFIED', 'DERIVED-VERIFIED'].includes(binding.provenance?.classification)) {
    pushUnique(errors, `${label}: provider_verified binding requires observed or derived verification provenance`);
  }
  if (binding.state === 'user_attested' && binding.provenance?.classification !== 'USER-PROPOSED') {
    pushUnique(errors, `${label}: user_attested binding requires USER-PROPOSED provenance`);
  }
  if (binding.state === 'unknown' && accountId !== null) {
    pushUnique(errors, `${label}: unknown binding cannot claim a current account`);
  }
  if (binding.state === 'provider_verified' && accountId === null) {
    pushUnique(errors, `${label}: provider_verified binding requires an account reference`);
  }
}

function validateAuthenticationStorage(storage, label, errors) {
  if (!storage) return;
  validateProvenance(storage.provenance, `${label} authentication storage`, errors);
  const expectedLocation = {
    file: 'codex_home_auth_file',
    keyring: 'os_keyring',
    auto: 'auto_selected',
    browser_profile: 'application_browser_profile',
    application_native: 'application_native_state',
    ephemeral: 'process_memory',
  }[storage.mode];
  if (expectedLocation && storage.locationKind !== expectedLocation) {
    pushUnique(errors, `${label}: storage mode ${storage.mode} requires locationKind ${expectedLocation}`);
  }
  if (storage.materialExposure === 'never_observed' && storage.owner === 'orchestrator') {
    pushUnique(errors, `${label}: orchestrator cannot claim custody of unobserved application credential material`);
  }
  if (storage.profileIsolationProven === true && storage.isolationState !== 'confirmed') {
    pushUnique(errors, `${label}: profileIsolationProven=true requires confirmed isolation evidence`);
  }
  if (storage.profileIsolationProven === false && storage.isolationState === 'confirmed') {
    pushUnique(errors, `${label}: profileIsolationProven=false conflicts with confirmed isolation evidence`);
  }
}

function validateUniqueIds(collections, errors) {
  const seen = new Map();
  for (const [kind, entries, idField] of collections) {
    for (const entry of entries ?? []) {
      const id = entry?.[idField];
      if (!id) continue;
      const prior = seen.get(id);
      if (prior) pushUnique(errors, `duplicate-identity-access-id: ${id} (${prior} and ${kind})`);
      else seen.set(id, kind);
    }
  }
  return seen;
}

function validateCatalog({ schema, catalog, label, hostIds = [] }) {
  const errors = [...validateJsonSchema(schema.$defs.identityAccessCatalog, catalog, schema, `$${label}`)];
  scanSecretSafety(catalog, label, errors);
  validateProvenance(catalog.provenance, `${label} catalog`, errors);
  if (catalog.mutationEnabled !== false) pushUnique(errors, `${label}: mutationEnabled must be false in the read-only foundation`);

  const accounts = new Map((catalog.accounts ?? []).map((entry) => [entry.accountId, entry]));
  const credentials = new Map((catalog.credentials ?? []).map((entry) => [entry.credentialId, entry]));
  const sessions = new Map((catalog.sessions ?? []).map((entry) => [entry.sessionId, entry]));
  const surfaceBindings = new Map((catalog.surfaceBindings ?? []).map((entry) => [entry.surfaceBindingId, entry]));
  const profiles = new Map((catalog.runtimeProfiles ?? []).map((entry) => [entry.runtimeProfileId, entry]));
  const runtimeInstances = new Map((catalog.runtimeInstances ?? []).map((entry) => [entry.runtimeInstanceId, entry]));
  const accessPaths = new Map((catalog.accessPaths ?? []).map((entry) => [entry.accessPathId, entry]));
  const executionConnections = new Map((catalog.executionConnections ?? []).map((entry) => [entry.executionConnectionId, entry]));
  const secretStores = new Map((catalog.secretStoreAdapters ?? []).map((entry) => [entry.adapterId, entry]));
  const lifecycles = new Map((catalog.lifecyclePolicies ?? []).map((entry) => [entry.lifecyclePolicyId, entry]));
  const verifications = new Map((catalog.verificationPolicies ?? []).map((entry) => [entry.verificationPolicyId, entry]));

  validateUniqueIds([
    ['account', catalog.accounts, 'accountId'],
    ['credential', catalog.credentials, 'credentialId'],
    ['session', catalog.sessions, 'sessionId'],
    ['surface-binding', catalog.surfaceBindings, 'surfaceBindingId'],
    ['runtime-profile', catalog.runtimeProfiles, 'runtimeProfileId'],
    ['runtime-instance', catalog.runtimeInstances, 'runtimeInstanceId'],
    ['access-path', catalog.accessPaths, 'accessPathId'],
    ['execution-connection', catalog.executionConnections, 'executionConnectionId'],
    ['secret-store-adapter', catalog.secretStoreAdapters, 'adapterId'],
    ['lifecycle-policy', catalog.lifecyclePolicies, 'lifecyclePolicyId'],
    ['verification-policy', catalog.verificationPolicies, 'verificationPolicyId'],
  ], errors);

  for (const account of catalog.accounts ?? []) {
    validateProvenance(account.provenance, `account ${account.accountId}`, errors);
    if (account.accountRole?.class === 'primary' && account.accountRole.isPreferred !== true) {
      pushUnique(errors, `account ${account.accountId}: primary account must be marked preferred`);
    }
    if (account.accountRole?.class === 'secondary' && account.accountRole.isPreferred === true) {
      pushUnique(errors, `account ${account.accountId}: secondary account cannot be marked preferred`);
    }
    if (account.expectedPrincipal?.matchStrategy !== 'not_configured' && typeof account.expectedPrincipal?.principalRef !== 'string') {
      pushUnique(errors, `account ${account.accountId}: expected principal reference is required for configured matching`);
    }
    if (!verifications.has(account.verificationPolicyId)) pushUnique(errors, `account ${account.accountId}: missing verification policy ${account.verificationPolicyId}`);
    for (const id of account.credentialIds ?? []) if (!credentials.has(id)) pushUnique(errors, `account ${account.accountId}: missing credential ${id}`);
    for (const id of account.sessionIds ?? []) if (!sessions.has(id)) pushUnique(errors, `account ${account.accountId}: missing session ${id}`);
    for (const id of account.surfaceBindingIds ?? []) {
      const binding = surfaceBindings.get(id);
      if (!binding) pushUnique(errors, `account ${account.accountId}: missing surface binding ${id}`);
      else if (binding.accountId !== account.accountId) pushUnique(errors, `account ${account.accountId}: surface binding account mismatch ${id}`);
    }
    for (const id of account.runtimeProfileIds ?? []) if (!profiles.has(id)) pushUnique(errors, `account ${account.accountId}: missing runtime profile ${id}`);
  }

  const preferredByProvider = new Map();
  for (const account of catalog.accounts ?? []) {
    if (account.accountRole?.isPreferred !== true) continue;
    const preferred = preferredByProvider.get(account.providerId) ?? [];
    preferred.push(account.accountId);
    preferredByProvider.set(account.providerId, preferred);
  }
  for (const [providerId, preferredAccounts] of preferredByProvider) {
    if (preferredAccounts.length > 1) {
      pushUnique(errors, `catalog: multiple preferred accounts are not allowed for ${providerId} (${preferredAccounts.join(', ')})`);
    }
  }

  for (const sessionId of catalog.currentObservedSessionIds ?? []) {
    const session = sessions.get(sessionId);
    if (!session) {
      pushUnique(errors, `catalog: missing current observed session ${sessionId}`);
      continue;
    }
    if (session.stateOwner !== 'application') {
      pushUnique(errors, `catalog: current observed session ${sessionId} must be application-owned`);
    }
    if (session.accountId === null) {
      pushUnique(errors, `catalog: current observed session ${sessionId} requires an account reference or must not be marked current`);
    }
  }

  for (const credential of catalog.credentials ?? []) {
    validateProvenance(credential.provenance, `credential ${credential.credentialId}`, errors);
    if (!accounts.has(credential.accountId)) pushUnique(errors, `credential ${credential.credentialId}: missing account ${credential.accountId}`);
    if (!lifecycles.has(credential.lifecyclePolicyId)) pushUnique(errors, `credential ${credential.credentialId}: missing lifecycle policy ${credential.lifecyclePolicyId}`);
    if (!verifications.has(credential.verificationPolicyId)) pushUnique(errors, `credential ${credential.credentialId}: missing verification policy ${credential.verificationPolicyId}`);
    if (credential.secretOwner === 'secret_store') {
      if (!credential.secretStoreAdapterId || !secretStores.has(credential.secretStoreAdapterId)) pushUnique(errors, `credential ${credential.credentialId}: secret-store owner requires a registered adapter`);
      if (!credential.secretStoreRef) pushUnique(errors, `credential ${credential.credentialId}: secret-store owner requires an opaque reference`);
    } else if (credential.secretStoreAdapterId !== null || credential.secretStoreRef !== null) {
      pushUnique(errors, `credential ${credential.credentialId}: application/provider/human-owned material must not have a Brain secret-store reference`);
    }
    if (credential.expiryState === 'known' && !credential.expiresAt) pushUnique(errors, `credential ${credential.credentialId}: known expiry requires expiresAt`);
    if (credential.expiryState !== 'known' && credential.expiresAt !== null) pushUnique(errors, `credential ${credential.credentialId}: unknown/not-applicable expiry must not carry expiresAt`);
  }

  for (const session of catalog.sessions ?? []) {
    validateProvenance(session.provenance, `session ${session.sessionId}`, errors);
    validateBinding(session.binding, session.accountId, `session ${session.sessionId}`, errors);
    validateAuthenticationStorage(session.authenticationStorage, `session ${session.sessionId}`, errors);
    if (session.accountId !== null && !accounts.has(session.accountId)) pushUnique(errors, `session ${session.sessionId}: missing account ${session.accountId}`);
    if (session.surfaceBindingId !== null) {
      const binding = surfaceBindings.get(session.surfaceBindingId);
      if (!binding) pushUnique(errors, `session ${session.sessionId}: missing surface binding ${session.surfaceBindingId}`);
      else if (session.accountId !== null && binding.accountId !== session.accountId) pushUnique(errors, `session ${session.sessionId}: surface binding account mismatch`);
      else if (!binding.sessionIds.includes(session.sessionId)) pushUnique(errors, `session ${session.sessionId}: surface binding does not reference session`);
    } else if (session.accountId !== null) {
      pushUnique(errors, `session ${session.sessionId}: account-bound session requires a surface binding`);
    }
    if (session.runtimeProfileId !== null && !profiles.has(session.runtimeProfileId)) pushUnique(errors, `session ${session.sessionId}: missing runtime profile ${session.runtimeProfileId}`);
    if (session.runtimeInstanceId !== null) {
      const instance = runtimeInstances.get(session.runtimeInstanceId);
      if (!instance) pushUnique(errors, `session ${session.sessionId}: missing runtime instance ${session.runtimeInstanceId}`);
      else if (session.runtimeProfileId !== null && instance.runtimeProfileId !== session.runtimeProfileId) pushUnique(errors, `session ${session.sessionId}: runtime instance profile mismatch`);
    }
    if (session.executionConnectionId !== null) {
      const connection = executionConnections.get(session.executionConnectionId);
      if (!connection) pushUnique(errors, `session ${session.sessionId}: missing execution connection ${session.executionConnectionId}`);
      else {
        if (session.runtimeInstanceId !== null && connection.sourceRuntimeInstanceId !== session.runtimeInstanceId) pushUnique(errors, `session ${session.sessionId}: execution connection source mismatch`);
        if (session.executionTargetRef !== null && connection.executionTargetRef !== session.executionTargetRef) pushUnique(errors, `session ${session.sessionId}: execution target mismatch`);
      }
    }
    for (const id of session.credentialIds ?? []) if (!credentials.has(id)) pushUnique(errors, `session ${session.sessionId}: missing credential ${id}`);
    if (session.stateOwner === 'application' && (!session.applicationRef || !session.managedStateRef)) {
      pushUnique(errors, `session ${session.sessionId}: application-owned state requires applicationRef and managedStateRef`);
    }
    if (session.stateOwner !== 'application' && session.managedStateRef === null) {
      pushUnique(errors, `session ${session.sessionId}: non-application-owned state requires managedStateRef`);
    }
  }

  for (const binding of catalog.surfaceBindings ?? []) {
    validateProvenance(binding.provenance, `surface binding ${binding.surfaceBindingId}`, errors);
    validateBinding(binding.binding, binding.accountId, `surface binding ${binding.surfaceBindingId}`, errors);
    const account = accounts.get(binding.accountId);
    if (!account) pushUnique(errors, `surface binding ${binding.surfaceBindingId}: missing account ${binding.accountId}`);
    else if (!(account.surfaceBindingIds ?? []).includes(binding.surfaceBindingId)) pushUnique(errors, `surface binding ${binding.surfaceBindingId}: account reverse link missing`);
    for (const id of binding.sessionIds ?? []) {
      const session = sessions.get(id);
      if (!session) pushUnique(errors, `surface binding ${binding.surfaceBindingId}: missing session ${id}`);
      else if (session.surfaceBindingId !== binding.surfaceBindingId) pushUnique(errors, `surface binding ${binding.surfaceBindingId}: session link mismatch ${id}`);
    }
    for (const id of binding.runtimeProfileIds ?? []) {
      const profile = profiles.get(id);
      if (!profile) pushUnique(errors, `surface binding ${binding.surfaceBindingId}: missing runtime profile ${id}`);
      else if (profile.surfaceBindingId !== binding.surfaceBindingId) pushUnique(errors, `surface binding ${binding.surfaceBindingId}: runtime profile link mismatch ${id}`);
    }
  }

  for (const profile of catalog.runtimeProfiles ?? []) {
    validateProvenance(profile.provenance, `runtime profile ${profile.runtimeProfileId}`, errors);
    validateBinding(profile.binding, profile.accountId, `runtime profile ${profile.runtimeProfileId}`, errors);
    validateAuthenticationStorage(profile.authenticationStorage, `runtime profile ${profile.runtimeProfileId}`, errors);
    const account = profile.accountId === null ? null : accounts.get(profile.accountId);
    if (profile.accountId !== null && !account) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: missing account ${profile.accountId}`);
    else if (account && !(account.runtimeProfileIds ?? []).includes(profile.runtimeProfileId)) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: account reverse link missing`);
    if (profile.surfaceBindingId !== null) {
      const binding = surfaceBindings.get(profile.surfaceBindingId);
      if (!binding) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: missing surface binding ${profile.surfaceBindingId}`);
      else if (profile.accountId !== null && binding.accountId !== profile.accountId) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: surface binding account mismatch`);
      else if (!binding.runtimeProfileIds.includes(profile.runtimeProfileId)) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: surface binding does not reference profile`);
    } else if (profile.accountId !== null) {
      pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: account-bound profile requires a surface binding`);
    }
    if (profile.switchPolicy.allowsConcurrentProfiles && profile.switchPolicy.processOwnership !== 'profile_scoped') {
      pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: concurrent profiles require profile-scoped process ownership`);
    }
    if (profile.switchPolicy.allowsConcurrentProfiles && profile.switchPolicy.concurrencySupport !== 'supported') {
      pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: concurrent profiles require supported concurrency evidence`);
    }
    if (profile.switchPolicy.concurrencySupport === 'unsupported' && profile.switchPolicy.allowsConcurrentProfiles) {
      pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: unsupported concurrency cannot be enabled`);
    }
    for (const id of profile.runtimeInstanceIds ?? []) {
      const instance = runtimeInstances.get(id);
      if (!instance) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: missing runtime instance ${id}`);
      else if (instance.runtimeProfileId !== profile.runtimeProfileId) pushUnique(errors, `runtime profile ${profile.runtimeProfileId}: runtime instance link mismatch ${id}`);
    }
  }

  for (const instance of catalog.runtimeInstances ?? []) {
    validateProvenance(instance.provenance, `runtime instance ${instance.runtimeInstanceId}`, errors);
    validateBinding(instance.binding, instance.accountId, `runtime instance ${instance.runtimeInstanceId}`, errors);
    validateAuthenticationStorage(instance.authenticationStorage, `runtime instance ${instance.runtimeInstanceId}`, errors);
    if (!accounts.has(instance.accountId)) pushUnique(errors, `runtime instance ${instance.runtimeInstanceId}: missing account ${instance.accountId}`);
    const profile = profiles.get(instance.runtimeProfileId);
    if (!profile) pushUnique(errors, `runtime instance ${instance.runtimeInstanceId}: missing runtime profile ${instance.runtimeProfileId}`);
    else if (profile.accountId !== instance.accountId) pushUnique(errors, `runtime instance ${instance.runtimeInstanceId}: account mismatch`);
  }

  for (const accessPath of catalog.accessPaths ?? []) {
    validateProvenance(accessPath.provenance, `access path ${accessPath.accessPathId}`, errors);
  }
  for (const connection of catalog.executionConnections ?? []) {
    validateProvenance(connection.provenance, `execution connection ${connection.executionConnectionId}`, errors);
    const sourceInstance = runtimeInstances.get(connection.sourceRuntimeInstanceId);
    if (!sourceInstance) pushUnique(errors, `execution connection ${connection.executionConnectionId}: missing source runtime instance ${connection.sourceRuntimeInstanceId}`);
    if (connection.networkPathId !== null && !accessPaths.has(connection.networkPathId)) pushUnique(errors, `execution connection ${connection.executionConnectionId}: missing network path ${connection.networkPathId}`);
    if (connection.targetRuntimeInstanceId !== null && !runtimeInstances.has(connection.targetRuntimeInstanceId)) pushUnique(errors, `execution connection ${connection.executionConnectionId}: missing target runtime instance ${connection.targetRuntimeInstanceId}`);
  }
  errors.push(...validateMultiHostTopology({ catalog, hostIds }).map((error) => `${label}: ${error}`));

  for (const adapter of catalog.secretStoreAdapters ?? []) {
    validateProvenance(adapter.provenance, `secret-store adapter ${adapter.adapterId}`, errors);
    const isOperationalBrainKeychain = adapter.adapterId === 'secret-store:macos-keychain'
      && adapter.physicalStore === 'login'
      && adapter.serviceNamespace === 'tools.prochat.brain'
      && adapter.mutationMode === 'approval_gated'
      && adapter.capabilities?.includes('secret_create')
      && adapter.capabilities?.includes('secret_update')
      && adapter.capabilities?.includes('secret_delete');
    if (adapter.mutationMode !== 'disabled' && !isOperationalBrainKeychain) {
      pushUnique(errors, `secret-store adapter ${adapter.adapterId}: mutation is not approved for this catalog`);
    }
  }

  for (const policy of catalog.lifecyclePolicies ?? []) {
    validateProvenance(policy.provenance, `lifecycle policy ${policy.lifecyclePolicyId}`, errors);
    if (policy.artificialKeepaliveAllowed !== false) pushUnique(errors, `lifecycle policy ${policy.lifecyclePolicyId}: artificial keepalive must remain forbidden`);
  }

  for (const policy of catalog.verificationPolicies ?? []) {
    validateProvenance(policy.provenance, `verification policy ${policy.verificationPolicyId}`, errors);
    if (policy.readOnlyOnly !== true) pushUnique(errors, `verification policy ${policy.verificationPolicyId}: readOnlyOnly must be true`);
    if (policy.requiresExpectedPrincipal && !policy.checks.includes(EXPECTED_PRINCIPAL_CHECK)) {
      pushUnique(errors, `verification policy ${policy.verificationPolicyId}: expected-principal matching check is required`);
    }
    if (!policy.checks.includes(FRESHNESS_CHECK)) pushUnique(errors, `verification policy ${policy.verificationPolicyId}: freshness check is required`);
  }

  for (const account of catalog.accounts ?? []) {
    const policy = verifications.get(account.verificationPolicyId);
    if (policy?.requiresExpectedPrincipal && account.expectedPrincipal?.matchStrategy === 'not_configured') {
      pushUnique(errors, `account ${account.accountId}: verification requires an expected principal`);
    }
  }
  return { errors, counts: { accounts: accounts.size, credentials: credentials.size, sessions: sessions.size, runtimeProfiles: profiles.size, runtimeInstances: runtimeInstances.size, accessPaths: accessPaths.size, executionConnections: executionConnections.size } };
}

function validateObservations({ schema, snapshot, label }) {
  const errors = [...validateJsonSchema(schema.$defs.observationSnapshot, snapshot, schema, `$${label}`)];
  scanSecretSafety(snapshot, label, errors);
  const ids = new Set();
  for (const observation of snapshot.observations ?? []) {
    if (ids.has(observation.observationId)) pushUnique(errors, `${label}: duplicate observation ${observation.observationId}`);
    ids.add(observation.observationId);
    const outcomes = new Map((observation.checks ?? []).map((check) => [check.checkCode, check.outcome]));
    if (!outcomes.has(FRESHNESS_CHECK)) pushUnique(errors, `${observation.observationId}: freshness evidence is required`);
    if (observation.detailedState === 'wrong_account' && observation.expectedPrincipalMatch !== 'mismatched') {
      pushUnique(errors, `${observation.observationId}: wrong_account requires mismatched expected principal`);
    }
    if (observation.detailedState === 'verified_healthy' && observation.normalizedStatus !== 'healthy') {
      pushUnique(errors, `${observation.observationId}: verified_healthy requires healthy normalized status`);
    }
  }
  return { errors, count: snapshot.observations?.length ?? 0 };
}

export function loadAndValidateIdentityAccess({ root = path.resolve(import.meta.dirname, '..') } = {}) {
  const schema = loadJson(path.join(root, SCHEMA_PATH));
  const catalog = loadJson(path.join(root, CATALOG_PATH));
  const alternate = loadJson(path.join(root, ALTERNATE_FIXTURE_PATH));
  const observations = loadJson(path.join(root, OBSERVATION_FIXTURE_PATH));
  const infrastructure = loadJson(path.join(root, INFRASTRUCTURE_CATALOG_PATH));
  const hostIds = new Set((infrastructure.resources ?? []).filter((resource) => resource.resourceClass === 'host').map((resource) => resource.resourceId));
  const canonical = validateCatalog({ schema, catalog, label: '.canonical', hostIds });
  const portable = validateCatalog({ schema, catalog: alternate, label: '.alternate', hostIds });
  const observed = validateObservations({ schema, snapshot: observations, label: '.observations' });
  return {
    schema,
    errors: [...new Set([...canonical.errors, ...portable.errors, ...observed.errors])],
    counts: { canonical: canonical.counts, alternate: portable.counts, observations: observed.count },
  };
}

export function validateIdentityAccessCatalog({ schema, catalog, label = '.catalog' }) {
  return validateCatalog({ schema, catalog, label });
}

function main() {
  const result = loadAndValidateIdentityAccess();
  if (result.errors.length > 0) {
    console.error(`infrastructure-identity-access=fail errors=${result.errors.length}`);
    result.errors.forEach((error) => console.error(`ERROR ${error}`));
    process.exitCode = 1;
    return;
  }
  const { canonical, alternate, observations } = result.counts;
  console.log(`infrastructure-identity-access-valid canonicalAccounts=${canonical.accounts} canonicalInstances=${canonical.runtimeInstances} canonicalAccessPaths=${canonical.accessPaths} canonicalExecutionConnections=${canonical.executionConnections} alternateAccounts=${alternate.accounts} alternateCredentials=${alternate.credentials} alternateSessions=${alternate.sessions} alternateProfiles=${alternate.runtimeProfiles} observations=${observations} mutationEnabled=false rawSecrets=none`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
