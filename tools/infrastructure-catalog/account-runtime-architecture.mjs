import { createCandidate, planCandidateAdmission } from './observation-core.mjs';

export const ACCOUNT_RUNTIME_ARCHITECTURE_VERSION = '1.1.0';

const SAFE_ID = /^[a-z][a-z0-9._-]*$/;
const ACCOUNT_ID = /^account:([a-z0-9][a-z0-9._-]*)$/;
const PROFILE_ID = /^runtime_profile:([a-z0-9][a-z0-9._-]*)$/;
const HOST_ID = /^host:([a-z0-9][a-z0-9._-]*)$/;
const REFERENCE_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._/-]*$/;
const OPAQUE_IDENTITY_REF = /^(?:opaque-ref|provider-subject):\/\/[^\s@]+$/;

export const CODEX_SURFACES = Object.freeze({
  'codex-cli': Object.freeze({
    surfaceId: 'codex-cli',
    profileSuffix: 'cli',
    profileKind: 'cli',
    runtimeAdapterRef: 'runtime_adapter:codex-cli',
    namespaceBoundary: 'codex_home',
    storageMode: 'file',
    storageLocation: 'codex_home_auth_file',
    storageScope: 'codex_home',
    stateOwner: 'application',
    requiresRuntime: true,
  }),
  'codex-ide': Object.freeze({
    surfaceId: 'codex-ide',
    profileSuffix: 'ide',
    profileKind: 'ide',
    runtimeAdapterRef: 'runtime_adapter:codex-ide',
    namespaceBoundary: 'application_instance',
    storageMode: 'application_native',
    storageLocation: 'application_native_state',
    storageScope: 'application_instance',
    stateOwner: 'application',
    requiresRuntime: true,
  }),
  'codex-app-server': Object.freeze({
    surfaceId: 'codex-app-server',
    profileSuffix: 'app-server',
    profileKind: 'service',
    runtimeAdapterRef: 'runtime_adapter:codex-app-server',
    namespaceBoundary: 'process',
    storageMode: 'application_native',
    storageLocation: 'application_native_state',
    storageScope: 'process',
    stateOwner: 'application',
    requiresRuntime: true,
  }),
  'codex-desktop': Object.freeze({
    surfaceId: 'codex-desktop',
    profileSuffix: 'desktop',
    profileKind: 'desktop',
    runtimeAdapterRef: 'runtime_adapter:codex-desktop',
    namespaceBoundary: 'application_instance',
    storageMode: 'application_native',
    storageLocation: 'application_native_state',
    storageScope: 'application_instance',
    stateOwner: 'application',
    requiresRuntime: true,
  }),
  'codex-webgpt': Object.freeze({
    surfaceId: 'codex-webgpt',
    profileSuffix: 'webgpt',
    profileKind: 'webgpt_production',
    runtimeAdapterRef: 'runtime_adapter:codex-web-gpt',
    namespaceBoundary: 'application_instance',
    storageMode: 'browser_profile',
    storageLocation: 'application_browser_profile',
    storageScope: 'browser_profile',
    stateOwner: 'application',
    requiresRuntime: true,
  }),
  'codex-mcp': Object.freeze({
    surfaceId: 'codex-mcp',
    profileSuffix: 'mcp',
    profileKind: 'mcp_client',
    runtimeAdapterRef: 'runtime_adapter:codex-mcp',
    namespaceBoundary: 'application_instance',
    storageMode: 'browser_profile',
    storageLocation: 'application_browser_profile',
    storageScope: 'browser_profile',
    stateOwner: 'application',
    requiresRuntime: false,
  }),
});

const DEFAULT_SURFACE = Object.freeze({
  surfaceId: 'other',
  profileSuffix: 'other',
  profileKind: 'other',
  runtimeAdapterRef: 'runtime_adapter:unknown',
  namespaceBoundary: 'unknown',
  storageMode: 'unknown',
  storageLocation: 'unknown',
  storageScope: 'unknown',
  stateOwner: 'application',
  requiresRuntime: true,
});

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function iso(value, label) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${label}`);
  return new Date(timestamp).toISOString();
}

function safeSlug(value, label) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new Error(`${label} is invalid`);
  return value.toLowerCase();
}

function providerSlug(providerId) {
  return safeSlug(providerId, 'providerId');
}

function accountSuffix(accountId) {
  const match = ACCOUNT_ID.exec(accountId ?? '');
  if (!match) throw new Error(`invalid account id: ${accountId ?? 'missing'}`);
  return match[1];
}

function profileSuffix(profileId) {
  const match = PROFILE_ID.exec(profileId ?? '');
  if (!match) throw new Error(`invalid runtime profile id: ${profileId ?? 'missing'}`);
  return match[1];
}

function hostSuffix(hostId) {
  const match = HOST_ID.exec(hostId ?? '');
  if (!match) throw new Error(`invalid host id: ${hostId ?? 'missing'}`);
  return match[1];
}

function safeOpaqueIdentityRef(value) {
  return typeof value === 'string' && value.length <= 512 && OPAQUE_IDENTITY_REF.test(value) ? value : null;
}

function provenance({ sourceRef, classification = 'OBSERVED-VERIFIED', observedAt, owner = 'brain:identity-access' }) {
  const observedIso = iso(observedAt ?? new Date(), 'observedAt');
  return {
    sourceRef,
    classification,
    verifiedAt: observedIso,
    freshnessDeadline: new Date(Date.parse(observedIso) + 3600 * 1000).toISOString(),
    owner,
    evidenceRefs: [],
  };
}

function bindingEvidence({ state = 'declared', observedAt, sourceRef, classification = 'USER-PROPOSED', owner = 'brain:identity-access' } = {}) {
  return {
    state,
    expiresAt: null,
    provenance: provenance({ sourceRef, classification, observedAt, owner }),
  };
}

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nextAccountOrdinal(accounts, providerId) {
  const provider = escapedRegex(providerId);
  const canonicalPattern = new RegExp(`^account:${provider}\\.(\\d+)$`);
  const legacyPattern = new RegExp(`^account:${provider}\\.(?:personal|work|business|primary|secondary)(?:\\.(\\d+))?$`);
  const ordinals = [];
  for (const account of accounts) {
    const accountId = account?.accountId;
    const canonical = canonicalPattern.exec(accountId ?? '');
    if (canonical) {
      ordinals.push(Number(canonical[1]));
      continue;
    }
    const legacy = legacyPattern.exec(accountId ?? '');
    if (legacy) ordinals.push(Number(legacy[1] ?? 1));
  }
  return (ordinals.length ? Math.max(...ordinals) : 0) + 1;
}

function accountRoleFor({ providerId, accounts, preferred = false, purpose = 'overflow_capacity' }) {
  if (purpose === 'primary' && preferred !== true) {
    throw new Error('purpose primary requires preferred=true');
  }
  const providerAccounts = accounts.filter((account) => account.providerId === providerId && account.lifecycleState !== 'retired');
  const rank = providerAccounts.reduce((maximum, account) => Math.max(maximum, account.accountRole?.rank ?? 0), 0) + 1;
  const isPreferred = preferred === true;
  return {
    class: isPreferred ? 'primary' : 'secondary',
    isPreferred,
    rank: isPreferred ? 1 : rank,
  };
}

function existingAccountForIdentity({ catalog, providerId, identityRef }) {
  if (!identityRef) return null;
  return (catalog.accounts ?? []).find((account) =>
    account.providerId === providerId && account.expectedPrincipal?.principalRef === identityRef) ?? null;
}

function existingAccountById({ catalog, providerId, accountId }) {
  if (typeof accountId !== 'string' || !ACCOUNT_ID.test(accountId)) return null;
  const account = (catalog.accounts ?? []).find((entry) => entry.accountId === accountId) ?? null;
  return account?.providerId === providerId ? account : null;
}

export function getSurfaceDefinition(surfaceId) {
  const normalized = safeSlug(surfaceId, 'surfaceId');
  return CODEX_SURFACES[normalized] ?? { ...DEFAULT_SURFACE, surfaceId: normalized, profileSuffix: normalized };
}

export function surfaceBindingIdFor(accountId, surfaceId) {
  return `surface_binding:${accountSuffix(accountId)}.${getSurfaceDefinition(surfaceId).surfaceId}`;
}

export function runtimeProfileIdFor(accountId, surfaceId) {
  const definition = getSurfaceDefinition(surfaceId);
  return `runtime_profile:${accountSuffix(accountId)}.${definition.profileSuffix}`;
}

export function runtimeInstanceIdFor(runtimeProfileId, hostId) {
  return `runtime_instance:${hostSuffix(hostId)}.${profileSuffix(runtimeProfileId)}`;
}

export function accessPathIdFor(sourceHostId, destinationHostId, transport) {
  const normalizedTransport = safeSlug(transport, 'transport');
  return `access_path:${hostSuffix(sourceHostId)}.${hostSuffix(destinationHostId)}.${normalizedTransport}`;
}

export function executionConnectionIdFor(sourceRuntimeInstanceId, targetHostId, protocol, networkPathId = null) {
  const sourceSuffix = String(sourceRuntimeInstanceId ?? '').split(':')[1];
  const pathSuffix = networkPathId ? String(networkPathId).split(':')[1] : 'local';
  return `execution_connection:${safeSlug(sourceSuffix, 'sourceRuntimeInstanceId')}.${hostSuffix(targetHostId)}.${safeSlug(protocol, 'protocol')}.${safeSlug(pathSuffix, 'networkPathId')}`;
}

export function matchKnownAccount({ catalog = {}, providerId, identityRef } = {}) {
  const normalizedProvider = providerSlug(providerId);
  const safeRef = safeOpaqueIdentityRef(identityRef);
  if (!safeRef) return { state: 'unknown', accountId: null, reason: 'stable_opaque_identity_evidence_missing' };
  const account = existingAccountForIdentity({ catalog, providerId: normalizedProvider, identityRef: safeRef });
  return account
    ? { state: 'known', accountId: account.accountId, identityRef: safeRef, match: 'provider_opaque_identity_ref' }
    : { state: 'unknown', accountId: null, identityRef: safeRef, match: 'no_existing_account' };
}

export function allocateAccountIdentity({
  catalog = {},
  providerId,
  identityRef,
  purpose = 'overflow_capacity',
  preferred = false,
  sourceRef = 'brain:identity-access/account-allocator',
  observedAt = new Date(),
} = {}) {
  const normalizedProvider = providerSlug(providerId);
  const safeRef = safeOpaqueIdentityRef(identityRef);
  const known = matchKnownAccount({ catalog, providerId: normalizedProvider, identityRef: safeRef });
  if (known.accountId) return { ...known, created: false, role: (catalog.accounts ?? []).find((entry) => entry.accountId === known.accountId)?.accountRole ?? null };
  if (!safeRef) {
    return {
      state: 'candidate',
      created: false,
      accountId: null,
      identityRef: null,
      role: null,
      reason: 'stable_opaque_identity_evidence_missing',
    };
  }
  const accounts = catalog.accounts ?? [];
  if (preferred === true && accounts.some((account) => account.providerId === normalizedProvider && account.accountRole?.isPreferred === true && account.lifecycleState !== 'retired')) {
    throw new Error(`preferred account already exists for provider ${normalizedProvider}`);
  }
  const number = nextAccountOrdinal(accounts, normalizedProvider);
  const role = accountRoleFor({ providerId: normalizedProvider, accounts, preferred, purpose });
  const accountId = `account:${normalizedProvider}.${String(number).padStart(2, '0')}`;
  const verificationPolicyId = (catalog.verificationPolicies ?? []).find((policy) => policy.adapterRef?.includes(normalizedProvider))?.verificationPolicyId
    ?? (catalog.verificationPolicies ?? [])[0]?.verificationPolicyId
    ?? `verification_policy:${normalizedProvider}-read-only`;
  const account = {
    accountId,
    providerId: normalizedProvider,
    accountKind: 'human_account',
    displayName: `${normalizedProvider} ${role.class} account ${String(number).padStart(2, '0')}`,
    lifecycleState: 'candidate',
    accountRole: role,
    expectedPrincipal: {
      principalType: 'provider_account',
      principalRef: safeRef,
      displayLabel: null,
      matchStrategy: 'provider_asserted_subject',
    },
    credentialIds: [],
    sessionIds: [],
    surfaceBindingIds: [],
    runtimeProfileIds: [],
    verificationPolicyId,
    recoveryRunbookRef: `runbook://${normalizedProvider}/interactive-reauthentication`,
    provenance: provenance({ sourceRef, classification: 'OBSERVED-VERIFIED', observedAt }),
  };
  return { state: 'allocated', created: true, accountId, identityRef: safeRef, role, account };
}

function authenticationStorage(definition, sourceRef, observedAt) {
  return {
    mode: definition.storageMode,
    owner: 'application',
    locationKind: definition.storageLocation,
    isolationScope: definition.storageScope,
    isolationState: 'candidate',
    profileIsolationProven: null,
    healthState: 'unknown',
    materialExposure: 'never_observed',
    mutationMode: 'application_only',
    provenance: provenance({ sourceRef, classification: 'USER-PROPOSED', observedAt }),
  };
}

export function allocateSurfaceBinding({
  catalog = {},
  account,
  surfaceId,
  sourceRef = 'brain:identity-access/surface-allocator',
  observedAt = new Date(),
  createRuntimeInstance = true,
} = {}) {
  if (!account?.accountId) throw new Error('account is required');
  const definition = getSurfaceDefinition(surfaceId);
  const bindingId = surfaceBindingIdFor(account.accountId, definition.surfaceId);
  const existingBinding = (catalog.surfaceBindings ?? []).find((binding) => binding.surfaceBindingId === bindingId);
  const runtimeProfileId = definition.requiresRuntime && createRuntimeInstance
    ? runtimeProfileIdFor(account.accountId, definition.surfaceId)
    : null;
  const existingProfile = runtimeProfileId
    ? (catalog.runtimeProfiles ?? []).find((profile) => profile.runtimeProfileId === runtimeProfileId)
    : null;
  const accountSuffixValue = accountSuffix(account.accountId);
  const proposedBinding = {
    surfaceBindingId: bindingId,
    accountId: account.accountId,
    surfaceId: definition.surfaceId,
    lifecycleState: 'candidate',
    binding: bindingEvidence({ observedAt, sourceRef }),
    sessionIds: [],
    runtimeProfileIds: runtimeProfileId ? [runtimeProfileId] : [],
    capabilityEvidence: {
      nAccountModel: 'supported',
      isolatedRuntime: definition.requiresRuntime ? 'unknown' : 'unsupported',
      authIsolation: 'unknown',
      concurrentProfiles: 'unknown',
      programmaticSelection: definition.requiresRuntime ? 'unknown' : 'unsupported',
    },
    provenance: provenance({ sourceRef, classification: 'USER-PROPOSED', observedAt }),
  };
  const proposedRuntimeProfile = runtimeProfileId ? {
    runtimeProfileId,
    accountId: account.accountId,
    surfaceBindingId: bindingId,
    binding: bindingEvidence({ observedAt, sourceRef }),
    profileKind: definition.profileKind,
    runtimeAdapterRef: definition.runtimeAdapterRef,
    isolationRef: `runtime-ref://profiles/${accountSuffixValue}/${definition.profileSuffix}`,
    stateOwnership: definition.stateOwner,
    authenticationStorage: authenticationStorage(definition, sourceRef, observedAt),
    runtimeInstanceIds: [],
    lifecyclePolicyId: (catalog.lifecyclePolicies ?? []).find((policy) => policy.lifecyclePolicyId.includes(definition.profileSuffix))?.lifecyclePolicyId
      ?? (catalog.lifecyclePolicies ?? [])[0]?.lifecyclePolicyId
      ?? `lifecycle_policy:${definition.profileSuffix}-application-managed`,
    recoveryRunbookRef: account.recoveryRunbookRef,
    switchPolicy: {
      requiresQuiescence: false,
      allowsConcurrentProfiles: false,
      processOwnership: definition.namespaceBoundary === 'codex_home' ? 'profile_scoped' : 'application_scoped',
      concurrencySupport: 'unknown',
      maxConcurrentProfiles: null,
      isolationRequired: true,
    },
    ...(definition.surfaceId === 'codex-cli' ? { configurationOwnership: {
      artifactKind: 'codex_config',
      pathRelativeToRoot: 'config.toml',
      writerOwnerRef: 'brain:runtime-profile-config-materializer',
      custody: 'brain',
      mutationAuthority: 'owner-only',
      sourceIntentRef: 'brain:codex-profile-defaults',
    } } : {}),
    routeBinding: {
      mode: definition.surfaceId === 'codex-cli' ? 'direct_native' : 'unknown',
      providerRef: definition.surfaceId === 'codex-cli' ? account.providerId : null,
      ownerRef: definition.surfaceId === 'codex-cli' ? 'brain:runtime-profile-route-intent' : 'application',
      optional: definition.surfaceId !== 'codex-cli',
    },
    runtimeNamespace: {
      boundary: definition.namespaceBoundary,
      processOwnership: definition.namespaceBoundary === 'codex_home' ? 'profile_scoped' : 'application_scoped',
      stateOwner: definition.stateOwner,
      noSharedStateWith: [],
    },
    provenance: provenance({ sourceRef, classification: 'USER-PROPOSED', observedAt }),
  } : null;
  const binding = existingBinding ?? proposedBinding;
  const bindingNeedsProfileLink = runtimeProfileId && !binding.runtimeProfileIds?.includes(runtimeProfileId);
  const effectiveBinding = bindingNeedsProfileLink
    ? { ...binding, runtimeProfileIds: [...(binding.runtimeProfileIds ?? []), runtimeProfileId].sort() }
    : binding;
  const runtimeProfile = existingProfile ?? proposedRuntimeProfile;
  const bindingCreated = !existingBinding || bindingNeedsProfileLink;
  const profileCreated = Boolean(runtimeProfileId && !existingProfile);
  return {
    created: bindingCreated || profileCreated,
    surfaceBinding: effectiveBinding,
    runtimeProfile,
    surfaceBindingId: bindingId,
    runtimeProfileId,
    bindingCreated,
    profileCreated,
  };
}

export function allocateRuntimeInstance({
  catalog = {},
  profile,
  hostId,
  runtimeRoot,
  sourceRef = 'brain:identity-access/runtime-instance-allocator',
  observedAt = new Date(),
} = {}) {
  if (!profile?.runtimeProfileId || !profile.accountId) throw new Error('profile with account is required');
  if (typeof runtimeRoot !== 'string' || runtimeRoot.length === 0) throw new Error('runtimeRoot is required');
  const normalizedHostId = `host:${hostSuffix(hostId)}`;
  const runtimeInstanceId = runtimeInstanceIdFor(profile.runtimeProfileId, normalizedHostId);
  const existing = (catalog.runtimeInstances ?? []).find((entry) => entry.runtimeInstanceId === runtimeInstanceId);
  if (existing) return { created: false, runtimeInstance: existing, runtimeInstanceId };
  const runtimeInstance = {
    runtimeInstanceId,
    accountId: profile.accountId,
    runtimeProfileId: profile.runtimeProfileId,
    runtimeHostId: normalizedHostId,
    lifecycleState: 'candidate',
    runtimeRoot,
    stateOwnership: profile.stateOwnership,
    processOwnership: profile.runtimeNamespace?.processOwnership ?? profile.switchPolicy?.processOwnership ?? 'unknown',
    configWriterRef: profile.configurationOwnership?.writerOwnerRef ?? 'brain:runtime-profile-config-materializer',
    leasePath: '.brain-runtime-profile-lease.json',
    binding: bindingEvidence({ observedAt, sourceRef }),
    authenticationStorage: structuredClone(profile.authenticationStorage),
    runtimeNamespace: {
      boundary: profile.runtimeNamespace?.boundary ?? profile.authenticationStorage?.isolationScope ?? 'unknown',
      stateOwner: profile.runtimeNamespace?.stateOwner ?? profile.stateOwnership,
      noSharedStateWith: sortedUnique([
        ...(profile.runtimeNamespace?.noSharedStateWith ?? []),
        `host-local-auth:${normalizedHostId}`,
      ]),
    },
    provenance: provenance({ sourceRef, classification: 'USER-PROPOSED', observedAt }),
  };
  return { created: true, runtimeInstance, runtimeInstanceId };
}

export function allocateAccessPath({
  catalog = {},
  sourceHostId,
  destinationHostId,
  transport,
  accessMode = 'remote',
  availability = 'unknown',
  trustState = 'unknown',
  healthState = 'unknown',
  routeAliases = [],
  sourceRef = 'brain:identity-access/access-path-observer',
  observedAt = new Date(),
} = {}) {
  const normalizedSource = `host:${hostSuffix(sourceHostId)}`;
  const normalizedDestination = `host:${hostSuffix(destinationHostId)}`;
  const normalizedTransport = safeSlug(transport, 'transport');
  const accessPathId = accessPathIdFor(normalizedSource, normalizedDestination, normalizedTransport);
  const existing = (catalog.accessPaths ?? []).find((entry) => entry.accessPathId === accessPathId);
  if (existing) return { created: false, accessPath: existing, accessPathId };
  const accessPath = {
    accessPathId,
    sourceHostId: normalizedSource,
    destinationHostId: normalizedDestination,
    transport: normalizedTransport,
    accessMode,
    availability,
    trustState,
    healthState,
    lastObservedAt: iso(observedAt, 'observedAt'),
    routeAliases: sortedUnique(routeAliases),
    provenance: provenance({ sourceRef, classification: trustState === 'verified' ? 'OBSERVED-VERIFIED' : 'USER-PROPOSED', observedAt }),
  };
  return { created: true, accessPath, accessPathId };
}

export function allocateExecutionConnection({
  catalog = {},
  sourceRuntimeInstanceId,
  sourceHostId,
  targetHostId,
  executionTargetRef,
  protocol = 'ssh',
  networkPathId = null,
  targetRuntimeInstanceId = null,
  workspaceRef = null,
  healthState = 'unknown',
  credentialCustodyRef = 'custody:transport-credential',
  sourceRef = 'brain:identity-access/execution-connection-allocator',
  observedAt = new Date(),
} = {}) {
  if (typeof sourceRuntimeInstanceId !== 'string' || typeof executionTargetRef !== 'string') throw new Error('sourceRuntimeInstanceId and executionTargetRef are required');
  const normalizedSourceHost = `host:${hostSuffix(sourceHostId)}`;
  const normalizedTargetHost = `host:${hostSuffix(targetHostId)}`;
  const normalizedProtocol = safeSlug(protocol, 'protocol');
  if (!REFERENCE_ID.test(executionTargetRef)) throw new Error('executionTargetRef is invalid');
  if (workspaceRef !== null && (typeof workspaceRef !== 'string' || !REFERENCE_ID.test(workspaceRef))) throw new Error('workspaceRef is invalid');
  if (typeof credentialCustodyRef !== 'string' || !REFERENCE_ID.test(credentialCustodyRef)) throw new Error('credentialCustodyRef is invalid');
  const sourceInstance = (catalog.runtimeInstances ?? []).find((instance) => instance.runtimeInstanceId === sourceRuntimeInstanceId);
  if (sourceInstance && sourceInstance.runtimeHostId !== normalizedSourceHost) throw new Error('source runtime instance does not belong to source host');
  if (networkPathId) {
    const networkPath = (catalog.accessPaths ?? []).find((accessPath) => accessPath.accessPathId === networkPathId);
    if (networkPath && (networkPath.sourceHostId !== normalizedSourceHost || networkPath.destinationHostId !== normalizedTargetHost)) throw new Error('network path does not connect source and target hosts');
  }
  if (targetRuntimeInstanceId) {
    const targetInstance = (catalog.runtimeInstances ?? []).find((instance) => instance.runtimeInstanceId === targetRuntimeInstanceId);
    if (targetInstance && targetInstance.runtimeHostId !== normalizedTargetHost) throw new Error('target runtime instance does not belong to target host');
  }
  const executionConnectionId = executionConnectionIdFor(sourceRuntimeInstanceId, normalizedTargetHost, normalizedProtocol, networkPathId);
  const existing = (catalog.executionConnections ?? []).find((entry) => entry.executionConnectionId === executionConnectionId);
  if (existing) return { created: false, executionConnection: existing, executionConnectionId };
  const executionConnection = {
    executionConnectionId,
    sourceRuntimeInstanceId,
    sourceHostId: normalizedSourceHost,
    targetHostId: normalizedTargetHost,
    executionTargetRef,
    protocol: normalizedProtocol,
    networkPathId,
    targetRuntimeInstanceId,
    workspaceRef,
    healthState,
    lastObservedAt: iso(observedAt, 'observedAt'),
    credentialCustodyRef,
    provenance: provenance({ sourceRef, classification: healthState === 'healthy' ? 'OBSERVED-VERIFIED' : 'USER-PROPOSED', observedAt }),
  };
  return { created: true, executionConnection, executionConnectionId };
}

export function validateMultiHostTopology({ catalog = {}, hostIds = [] } = {}) {
  const errors = [];
  const profiles = new Map((catalog.runtimeProfiles ?? []).map((entry) => [entry.runtimeProfileId, entry]));
  const instances = new Map((catalog.runtimeInstances ?? []).map((entry) => [entry.runtimeInstanceId, entry]));
  const paths = new Map((catalog.accessPaths ?? []).map((entry) => [entry.accessPathId, entry]));
  const knownHosts = new Set(hostIds);
  const profileHostPairs = new Set();

  const checkHost = (hostId, label) => {
    if (!HOST_ID.test(hostId ?? '')) errors.push(`${label}:invalid_host_id:${hostId ?? 'missing'}`);
    if (knownHosts.size > 0 && !knownHosts.has(hostId)) errors.push(`${label}:unknown_host:${hostId}`);
  };

  for (const instance of instances.values()) {
    checkHost(instance.runtimeHostId, `runtime_instance:${instance.runtimeInstanceId}`);
    const profile = profiles.get(instance.runtimeProfileId);
    if (!profile) {
      errors.push(`runtime_instance_missing_profile:${instance.runtimeInstanceId}:${instance.runtimeProfileId}`);
      continue;
    }
    if (profile.accountId !== instance.accountId) errors.push(`runtime_instance_account_mismatch:${instance.runtimeInstanceId}`);
    if (!profile.runtimeInstanceIds?.includes(instance.runtimeInstanceId)) errors.push(`runtime_profile_missing_runtime_instance:${instance.runtimeProfileId}:${instance.runtimeInstanceId}`);
    try {
      const expectedId = runtimeInstanceIdFor(instance.runtimeProfileId, instance.runtimeHostId);
      if (expectedId !== instance.runtimeInstanceId) errors.push(`runtime_instance_id_mismatch:${instance.runtimeInstanceId}:${expectedId}`);
    } catch {
      // The schema/host check above provides the actionable error.
    }
    const pair = `${instance.runtimeProfileId}|${instance.runtimeHostId}`;
    if (profileHostPairs.has(pair)) errors.push(`duplicate_runtime_profile_host_pair:${pair}`);
    profileHostPairs.add(pair);
    if (typeof instance.runtimeRoot !== 'string' || instance.runtimeRoot.length === 0) errors.push(`runtime_instance_missing_root:${instance.runtimeInstanceId}`);
    if (instance.authenticationStorage?.owner !== profile.authenticationStorage?.owner) errors.push(`runtime_instance_storage_owner_mismatch:${instance.runtimeInstanceId}`);
  }

  for (const profile of profiles.values()) {
    for (const instanceId of profile.runtimeInstanceIds ?? []) {
      const instance = instances.get(instanceId);
      if (!instance) errors.push(`runtime_profile_missing_instance:${profile.runtimeProfileId}:${instanceId}`);
      else if (instance.runtimeProfileId !== profile.runtimeProfileId) errors.push(`runtime_profile_instance_link_mismatch:${profile.runtimeProfileId}:${instanceId}`);
    }
  }

  for (const accessPath of paths.values()) {
    checkHost(accessPath.sourceHostId, `access_path:${accessPath.accessPathId}:source`);
    checkHost(accessPath.destinationHostId, `access_path:${accessPath.accessPathId}:destination`);
    if (accessPath.accessMode === 'remote' && accessPath.sourceHostId === accessPath.destinationHostId) errors.push(`remote_access_path_must_cross_hosts:${accessPath.accessPathId}`);
    if (accessPath.accessMode === 'local' && accessPath.sourceHostId !== accessPath.destinationHostId) errors.push(`local_access_path_must_be_host_local:${accessPath.accessPathId}`);
    try {
      const expectedId = accessPathIdFor(accessPath.sourceHostId, accessPath.destinationHostId, accessPath.transport);
      if (expectedId !== accessPath.accessPathId) errors.push(`access_path_id_mismatch:${accessPath.accessPathId}:${expectedId}`);
    } catch {
      // The schema/host check above provides the actionable error.
    }
  }

  for (const connection of catalog.executionConnections ?? []) {
    checkHost(connection.sourceHostId, `execution_connection:${connection.executionConnectionId}:source`);
    checkHost(connection.targetHostId, `execution_connection:${connection.executionConnectionId}:target`);
    const sourceInstance = instances.get(connection.sourceRuntimeInstanceId);
    if (!sourceInstance) errors.push(`execution_connection_missing_source_instance:${connection.executionConnectionId}:${connection.sourceRuntimeInstanceId}`);
    else if (sourceInstance.runtimeHostId !== connection.sourceHostId) errors.push(`execution_connection_source_host_mismatch:${connection.executionConnectionId}`);
    if (connection.targetRuntimeInstanceId) {
      const targetInstance = instances.get(connection.targetRuntimeInstanceId);
      if (!targetInstance) errors.push(`execution_connection_missing_target_instance:${connection.executionConnectionId}:${connection.targetRuntimeInstanceId}`);
      else if (targetInstance.runtimeHostId !== connection.targetHostId) errors.push(`execution_connection_target_host_mismatch:${connection.executionConnectionId}`);
    }
    if (connection.networkPathId) {
      const networkPath = paths.get(connection.networkPathId);
      if (!networkPath) errors.push(`execution_connection_missing_network_path:${connection.executionConnectionId}:${connection.networkPathId}`);
      else if (networkPath.sourceHostId !== connection.sourceHostId || networkPath.destinationHostId !== connection.targetHostId) errors.push(`execution_connection_network_path_mismatch:${connection.executionConnectionId}`);
    }
    if (connection.executionTargetRef?.startsWith('host:') && connection.executionTargetRef !== connection.targetHostId) {
      errors.push(`execution_connection_target_ref_host_mismatch:${connection.executionConnectionId}`);
    }
    if (connection.protocol === 'ssh' && connection.sourceHostId === connection.targetHostId) errors.push(`ssh_execution_connection_must_cross_hosts:${connection.executionConnectionId}`);
    try {
      const expectedId = executionConnectionIdFor(connection.sourceRuntimeInstanceId, connection.targetHostId, connection.protocol, connection.networkPathId);
      if (expectedId !== connection.executionConnectionId) errors.push(`execution_connection_id_mismatch:${connection.executionConnectionId}:${expectedId}`);
    } catch {
      // The schema/host checks above provide the actionable error.
    }
  }

  return sortedUnique(errors);
}

export function prepareAccountEnrollment({
  catalog = {},
  observation,
  surfaceId = 'codex-app-server',
  identityRef,
  preferred = false,
  purpose = 'overflow_capacity',
  sourceRef = 'brain:identity-access/account-discovery',
  now = new Date(),
  matchedAccountId = null,
  boundAccountId = null,
  surfaceBindingId = null,
} = {}) {
  if (!observation || typeof observation !== 'object') throw new Error('account observation is required');
  const providerId = providerSlug(observation.providerId ?? 'openai');
  const observedIdentityRef = safeOpaqueIdentityRef(identityRef ?? observation.providerPrincipalRef ?? observation.observedPrincipalRef);
  const canonicalAccountId = matchedAccountId ?? observation.canonicalAccountId ?? null;
  if (canonicalAccountId !== null && (typeof canonicalAccountId !== 'string' || !ACCOUNT_ID.test(canonicalAccountId))) {
    throw new Error('matchedAccountId must be an opaque account ID');
  }
  const matchedAccount = canonicalAccountId
    ? existingAccountById({ catalog, providerId, accountId: canonicalAccountId })
    : null;
  const allocation = matchedAccount
    ? {
      state: 'known',
      created: false,
      accountId: matchedAccount.accountId,
      identityRef: observedIdentityRef,
      role: matchedAccount.accountRole ?? null,
    }
    : allocateAccountIdentity({ catalog, providerId, identityRef: observedIdentityRef, preferred, purpose, sourceRef, observedAt: now });
  const knownAccount = allocation.accountId
    ? (catalog.accounts ?? []).find((account) => account.accountId === allocation.accountId)
    : null;
  const accountBase = knownAccount ?? allocation.account ?? null;
  const surface = accountBase ? allocateSurfaceBinding({ catalog, account: accountBase, surfaceId, sourceRef, observedAt: now }) : null;
  const account = accountBase ? {
    ...accountBase,
    surfaceBindingIds: sortedUnique([
      ...(accountBase.surfaceBindingIds ?? []),
      ...(surface?.surfaceBindingId ? [surface.surfaceBindingId] : []),
    ]),
    runtimeProfileIds: sortedUnique([
      ...(accountBase.runtimeProfileIds ?? []),
      ...(surface?.runtimeProfileId ? [surface.runtimeProfileId] : []),
    ]),
  } : null;
  const accountChanged = Boolean(account && (
    JSON.stringify(account.surfaceBindingIds) !== JSON.stringify(accountBase.surfaceBindingIds ?? [])
    || JSON.stringify(account.runtimeProfileIds) !== JSON.stringify(accountBase.runtimeProfileIds ?? [])
  ));
  const candidateKey = account ? `${providerId}.${accountSuffix(account.accountId)}.${getSurfaceDefinition(surfaceId).surfaceId}` : `${providerId}.${getSurfaceDefinition(surfaceId).surfaceId}.unresolved`;
  const candidate = createCandidate({
    candidateId: `candidate:${candidateKey}`,
    proposedResourceId: account?.accountId ?? null,
    resourceClass: 'account',
    resourceKind: 'provider-account',
    identityStability: account ? 'stable' : 'unknown',
    freshness: 'fresh',
    observationIds: observation.observationId ? [observation.observationId] : [],
    evidence: {
      identity: account ? 'confirmed' : 'candidate',
      environment: 'confirmed',
      ownership: 'candidate',
      dependencies: 'not_applicable',
      health: observation.status === 'authenticated' ? 'confirmed' : 'unknown',
      lifecycle: 'confirmed',
      isolation: surface?.runtimeProfile ? 'candidate' : 'not_applicable',
      credentialCustody: 'not_applicable',
      routeOwnership: 'not_applicable',
      conflicts: [],
    },
    observedAt: observation.observedAt ?? now,
    provenanceSource: sourceRef,
    provenanceClassification: 'OBSERVED-VERIFIED',
    provenanceOwner: 'brain:identity-access',
  });
  const admissionPlan = planCandidateAdmission({ candidate, now });
  const existingBinding = surfaceBindingId
    ? (catalog.surfaceBindings ?? []).find((binding) => binding.surfaceBindingId === surfaceBindingId)
    : boundAccountId
      ? (catalog.surfaceBindings ?? []).find((binding) => binding.accountId === boundAccountId && binding.surfaceId === getSurfaceDefinition(surfaceId).surfaceId)
      : null;
  const observedAccountId = account?.accountId ?? canonicalAccountId ?? allocation.accountId ?? null;
  const bindingChange = existingBinding && (boundAccountId ?? existingBinding.accountId) && observedAccountId
    && (boundAccountId ?? existingBinding.accountId) !== observedAccountId
    ? {
      event: 'account_binding_changed',
      surfaceBindingId: existingBinding.surfaceBindingId,
      previousAccountId: boundAccountId ?? existingBinding.accountId,
      observedAccountId,
      action: 'create_candidate_relationship_require_admission',
    }
    : null;
  return {
    architectureVersion: ACCOUNT_RUNTIME_ARCHITECTURE_VERSION,
    stage: account ? (knownAccount ? 'known' : 'candidate') : 'candidate',
    status: account ? (knownAccount ? 'known_account' : 'candidate_prepared') : 'candidate_requires_stable_identity',
    providerId,
    accountId: account?.accountId ?? null,
    identityMatch: allocation.state === 'known' ? 'known' : observedIdentityRef ? 'new_opaque_identity' : 'unknown',
    rolePolicy: account?.accountRole ?? { class: 'secondary', isPreferred: false, rank: null },
    account,
    surfaceBinding: surface?.surfaceBinding ?? null,
    runtimeProfile: surface?.runtimeProfile ?? null,
    candidate,
    admissionPlan,
    bindingChange,
    officialLogin: {
      required: true,
      owner: 'provider/application',
      mode: 'official_application_handoff',
      managerExecutes: false,
      authCopied: false,
      tokensObserved: false,
    },
    catalogMutation: {
      performed: false,
      proposedRecords: [
        ...(allocation.created || accountChanged ? [account] : []),
        ...(surface?.created ? [surface.surfaceBinding, surface.runtimeProfile] : []),
      ].filter(Boolean),
      requiresOperatorAdmission: true,
    },
    redaction: {
      secretsExcluded: true,
      rawIdentityValueReturned: false,
      rawIdentityValuePersisted: false,
    },
  };
}

export function buildIncrementalProfileVerificationPlan(profileIds = [], { newProfileId = null } = {}) {
  const selected = sortedUnique(profileIds);
  if (selected.length === 0) return { strategy: 'empty', selectedProfiles: [], phases: [], checkCount: 0, complexity: 'O(1)' };
  if (newProfileId && !selected.includes(newProfileId)) throw new Error('newProfileId must be selected');
  if (!newProfileId) {
    return {
      strategy: 'collection-independent',
      selectedProfiles: selected,
      phases: [{ phase: 'verify_selected_profiles', profileIds: selected }],
      checkCount: selected.length,
      complexity: 'O(N)',
    };
  }
  const existing = selected.filter((profileId) => profileId !== newProfileId);
  return {
    strategy: 'incremental-new-account',
    selectedProfiles: selected,
    newProfileId,
    phases: [
      { phase: 'verify_existing_profiles_before_new_account', profileIds: existing },
      { phase: 'verify_new_account_profile', profileIds: [newProfileId] },
      { phase: 'recheck_existing_profiles_after_new_account', profileIds: existing },
    ],
    checkCount: existing.length * 2 + 1,
    complexity: 'O(N)',
  };
}

const CAPABILITY_FIELDS = Object.freeze([
  ['nAccountModel', 'nAccountModel'],
  ['isolatedRuntime', 'isolatedRuntime'],
  ['authIsolation', 'authIsolation'],
  ['concurrentProfiles', 'concurrentProfiles'],
  ['programmaticSelection', 'programmaticSelection'],
]);

function capabilityValue(bindings, key) {
  const values = bindings.map((binding) => binding.capabilityEvidence?.[key]).filter(Boolean);
  if (values.length === 0) return null;
  if (values.includes('unsupported')) return 'unsupported';
  if (values.includes('unknown')) return 'unknown';
  return 'supported';
}

export function buildSurfaceCapabilityMatrix({ catalog = {}, evidenceBySurface = {} } = {}) {
  const surfaceIds = sortedUnique([
    ...Object.keys(CODEX_SURFACES),
    ...(catalog.surfaceBindings ?? []).map((binding) => binding.surfaceId),
    ...Object.keys(evidenceBySurface),
  ]);
  const rows = surfaceIds.map((surfaceId) => {
    const bindings = (catalog.surfaceBindings ?? []).filter((binding) => binding.surfaceId === surfaceId);
    const evidence = evidenceBySurface[surfaceId] ?? {};
    const row = { surfaceId, nAccountModel: 'supported', isolatedRuntime: 'unknown', authIsolation: 'unknown', concurrentProfiles: 'unknown', programmaticSelection: 'unknown' };
    for (const [field, key] of CAPABILITY_FIELDS) row[field] = evidence[key] ?? capabilityValue(bindings, key) ?? row[field];
    return row;
  });
  return {
    architectureVersion: ACCOUNT_RUNTIME_ARCHITECTURE_VERSION,
    rows,
    evidenceOnly: true,
    liveOAuthPerformed: false,
    unknownMeansNotProven: true,
  };
}

export function validateDynamicCatalogShape({ catalog = {}, expectedCounts = [], hostIds = [] } = {}) {
  const errors = [];
  const accounts = new Map((catalog.accounts ?? []).map((entry) => [entry.accountId, entry]));
  const bindings = new Map((catalog.surfaceBindings ?? []).map((entry) => [entry.surfaceBindingId, entry]));
  const profiles = new Map((catalog.runtimeProfiles ?? []).map((entry) => [entry.runtimeProfileId, entry]));
  const preferredByProvider = new Map();
  for (const account of accounts.values()) {
    if (account.accountRole?.isPreferred) {
      const list = preferredByProvider.get(account.providerId) ?? [];
      list.push(account.accountId);
      preferredByProvider.set(account.providerId, list);
    }
    for (const bindingId of account.surfaceBindingIds ?? []) {
      if (!bindings.has(bindingId)) errors.push(`account_missing_surface_binding:${account.accountId}:${bindingId}`);
    }
    for (const profileId of account.runtimeProfileIds ?? []) {
      if (!profiles.has(profileId)) errors.push(`account_missing_runtime_profile:${account.accountId}:${profileId}`);
    }
  }
  for (const [providerId, preferred] of preferredByProvider) if (preferred.length > 1) errors.push(`multiple_preferred_accounts:${providerId}`);
  for (const binding of bindings.values()) {
    const account = accounts.get(binding.accountId);
    if (!account) errors.push(`surface_binding_missing_account:${binding.surfaceBindingId}`);
    else if (!(account.surfaceBindingIds ?? []).includes(binding.surfaceBindingId)) errors.push(`account_missing_reverse_surface_binding:${binding.surfaceBindingId}`);
    for (const profileId of binding.runtimeProfileIds ?? []) {
      const profile = profiles.get(profileId);
      if (!profile) errors.push(`surface_binding_missing_profile:${binding.surfaceBindingId}:${profileId}`);
      else if (profile.surfaceBindingId !== binding.surfaceBindingId) errors.push(`surface_binding_profile_mismatch:${binding.surfaceBindingId}:${profileId}`);
    }
  }
  for (const profile of profiles.values()) {
    const account = accounts.get(profile.accountId);
    if (account && !(account.runtimeProfileIds ?? []).includes(profile.runtimeProfileId)) errors.push(`account_missing_reverse_runtime_profile:${profile.runtimeProfileId}`);
    if (profile.surfaceBindingId && !bindings.has(profile.surfaceBindingId)) errors.push(`runtime_profile_missing_surface_binding:${profile.runtimeProfileId}`);
    if (profile.surfaceBindingId && bindings.get(profile.surfaceBindingId)?.accountId !== profile.accountId) errors.push(`runtime_profile_account_surface_mismatch:${profile.runtimeProfileId}`);
  }
  for (const expected of expectedCounts) {
    const count = Number(expected.count);
    if (!Number.isInteger(count) || count < 1) continue;
    if (accounts.size !== count) errors.push(`expected_account_count:${count}:actual:${accounts.size}`);
  }
  errors.push(...validateMultiHostTopology({ catalog, hostIds }));
  return sortedUnique(errors);
}

export { accountSuffix, profileSuffix, safeOpaqueIdentityRef };
