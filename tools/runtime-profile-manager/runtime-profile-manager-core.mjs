import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  buildRuntimeProfileConfigurationArtifact,
  buildRuntimeProfileConfigurationPlan,
  inspectRuntimeProfileConfiguration,
  materializeRuntimeProfileConfiguration,
} from './runtime-profile-configuration.mjs';

export const RUNTIME_PROFILE_MANAGER_VERSION = '1.1.0';

const PROFILE_ID_PATTERN = /^runtime_profile:[a-z0-9][a-z0-9._-]*$/;
const VERIFIED_BINDINGS = new Set(['provider_verified', 'user_attested']);

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function profileIdSuffix(profileId) {
  if (typeof profileId !== 'string' || !PROFILE_ID_PATTERN.test(profileId)) {
    throw new Error(`invalid runtime profile id: ${profileId ?? 'missing'}`);
  }
  return profileId.slice('runtime_profile:'.length);
}

function assertAdapter(adapter) {
  const required = [
    'resolveRuntimeRoot',
    'inspectRootSecurity',
    'inspectAuthentication',
    'inspectAccountObservation',
    'buildLaunchCommand',
    'buildLoginHandoff',
    'profileConfigPath',
    'compileProfileConfig',
    'isDefaultRuntimeRoot',
    'runtimePaths',
    'createRuntimeRoot',
    'inspectProcessOwnership',
    'writeProcessLease',
    'removeProcessLease',
    'clearStaleProcessLease',
  ];
  for (const method of required) {
    if (typeof adapter?.[method] !== 'function') throw new Error(`runtime profile adapter missing ${method}()`);
  }
}

function indexCatalog(catalog) {
  return {
    accounts: new Map((catalog.accounts ?? []).map((entry) => [entry.accountId, entry])),
    sessions: new Map((catalog.sessions ?? []).map((entry) => [entry.sessionId, entry])),
    profiles: new Map((catalog.runtimeProfiles ?? []).map((entry) => [entry.runtimeProfileId, entry])),
  };
}

function selectProfile(catalog, profileId) {
  const id = profileIdSuffix(profileId);
  const indexes = indexCatalog(catalog);
  const profile = indexes.profiles.get(profileId);
  if (!profile) throw new Error(`runtime profile not found: ${profileId}`);
  return { id, profile, ...indexes };
}

function accountSummary(profile, accounts) {
  const account = profile.accountId ? accounts.get(profile.accountId) : null;
  return {
    accountId: profile.accountId ?? null,
    providerId: account?.providerId ?? null,
    expectedPrincipalConfigured: account?.expectedPrincipal?.matchStrategy !== 'not_configured',
    expectedPrincipalMatchStrategy: account?.expectedPrincipal?.matchStrategy ?? null,
    bindingState: profile.binding?.state ?? 'unknown',
  };
}

function sessionSummaries(profile, sessions) {
  return (profile.runtimeProfileId ? [...sessions.values()].filter((session) => session.runtimeProfileId === profile.runtimeProfileId) : [])
    .map((session) => ({
      sessionId: session.sessionId,
      surfaceBindingId: session.surfaceBindingId ?? null,
      sessionKind: session.sessionKind,
      applicationRef: session.applicationRef ?? null,
      stateOwner: session.stateOwner,
      lastKnownState: session.lastKnownState ?? 'unknown',
      storageMode: session.authenticationStorage?.mode ?? 'unknown',
      bindingState: session.binding?.state ?? 'unknown',
    }))
    .sort((left, right) => left.sessionId.localeCompare(right.sessionId));
}

function bindingReadiness(profile) {
  const state = profile.binding?.state ?? 'unknown';
  if (state === 'conflicted') return { state: 'blocked', reason: 'conflicted_profile_binding' };
  if (VERIFIED_BINDINGS.has(state)) return { state: 'verified_or_attested', reason: null };
  return { state: 'pending', reason: 'human_or_provider_binding_required' };
}

function safeProfileView({ profile, accounts, sessions, root, process }) {
  const binding = bindingReadiness(profile);
  const storage = profile.authenticationStorage ?? {};
  return {
    runtimeProfileId: profile.runtimeProfileId,
    surfaceBindingId: profile.surfaceBindingId ?? null,
    profileKind: profile.profileKind,
    runtimeAdapterRef: profile.runtimeAdapterRef,
    account: accountSummary(profile, accounts),
    binding: {
      state: profile.binding?.state ?? 'unknown',
      readiness: binding.state,
      provenance: profile.binding?.provenance?.classification ?? 'UNKNOWN',
      freshnessDeadline: profile.binding?.provenance?.freshnessDeadline ?? null,
    },
    authenticationStorage: {
      mode: storage.mode ?? 'unknown',
      owner: storage.owner ?? 'unknown',
      isolationScope: storage.isolationScope ?? 'unknown',
      isolationState: storage.isolationState ?? 'unknown',
      profileIsolationProven: storage.profileIsolationProven ?? null,
      healthState: storage.healthState ?? 'unknown',
    },
    runtimeRoot: root,
    processOwnership: profile.switchPolicy?.processOwnership ?? 'unknown',
    concurrency: {
      declared: profile.switchPolicy?.concurrencySupport ?? 'unknown',
      maxConcurrentProfiles: profile.switchPolicy?.maxConcurrentProfiles ?? null,
      proven: storage.profileIsolationProven === true && profile.switchPolicy?.processOwnership === 'profile_scoped',
    },
    process,
    sessions: sessionSummaries(profile, sessions),
  };
}

function resolveRoots(profiles, adapter, context) {
  const roots = new Map();
  const owners = new Map();
  const errors = [];
  for (const profile of profiles) {
    try {
      const root = adapter.resolveRuntimeRoot(profile, context);
      const prior = owners.get(root);
      if (prior) errors.push(`duplicate_runtime_root:${prior}:${profile.runtimeProfileId}`);
      else owners.set(root, profile.runtimeProfileId);
      roots.set(profile.runtimeProfileId, root);
    } catch (error) {
      errors.push(`${profile.runtimeProfileId}:root_resolution_failed`);
    }
  }
  return { roots, errors: unique(errors) };
}

export function listRuntimeProfiles({ catalog, adapter, context = {} } = {}) {
  assertAdapter(adapter);
  const profiles = [...(catalog.runtimeProfiles ?? [])].sort((left, right) => left.runtimeProfileId.localeCompare(right.runtimeProfileId));
  const { roots, errors } = resolveRoots(profiles, adapter, context);
  const indexes = indexCatalog(catalog);
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'list',
    status: errors.length === 0 ? 'OK' : 'NOT_OK',
    profileCount: profiles.length,
    errors,
    profiles: profiles.map((profile) => safeProfileView({
      profile,
      accounts: indexes.accounts,
      sessions: indexes.sessions,
      root: roots.get(profile.runtimeProfileId) ?? null,
      process: adapter.inspectProcessOwnership({ profile, root: roots.get(profile.runtimeProfileId) ?? null, context }),
    })),
    redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
  };
}

async function inspectProfile({ selected, adapter, context, probeAuthentication = true }) {
  const { profile } = selected;
  const root = adapter.resolveRuntimeRoot(profile, context);
  const security = adapter.inspectRootSecurity({ profile, root, context });
  const configurationArtifact = buildRuntimeProfileConfigurationArtifact({
    profile,
    root,
    configPath: adapter.profileConfigPath({ profile, root, context }),
    context,
  });
  const configuration = inspectRuntimeProfileConfiguration({ artifact: configurationArtifact });
  const expectedPrincipal = profile.accountId ? selected.accounts.get(profile.accountId)?.expectedPrincipal : null;
  const observationContext = { ...context, expectedPrincipal };
  // Adapters may use either a bounded synchronous status probe or an
  // asynchronous supported account observer. Always await the adapter result
  // so callers cannot accidentally serialize a Promise as `{}` and lose the
  // authentication evidence at a higher-level acceptance gate.
  const authentication = probeAuthentication && security.rootExists && security.safe
    ? await adapter.inspectAccountObservation({ profile, root, context: observationContext })
    : { state: 'unknown', status: security.rootExists ? 'not_probed' : 'not_provisioned' };
  const process = adapter.inspectProcessOwnership({ profile, root, context });
  const binding = bindingReadiness(profile);
  const storageMode = profile.authenticationStorage?.mode ?? 'unknown';
  const hardReasons = [
    ...(security.reasons ?? []),
    ...(!security.rootExists ? ['runtime_root_not_provisioned'] : []),
    ...(storageMode !== 'file' ? ['unsupported_storage_mode_for_deterministic_cli_isolation'] : []),
    ...(profile.switchPolicy?.processOwnership !== 'profile_scoped' ? ['profile_scoped_process_ownership_required'] : []),
    ...(process.state === 'stale' ? ['profile_process_lease_stale'] : []),
    ...(process.state === 'conflicted' || process.state === 'unknown' ? ['profile_process_ownership_unresolved'] : []),
    ...(configuration.reasons ?? []),
    ...(configuration.state === 'unowned' ? ['existing_config_writer_unresolved'] : []),
    ...(binding.state === 'blocked' ? [binding.reason] : []),
    ...(context.routeMutationRequested ? ['route_mutation_forbidden'] : []),
  ];
  const readiness = hardReasons.length > 0
    ? 'blocked'
    : profile.authenticationStorage?.profileIsolationProven === true && binding.state === 'verified_or_attested' && authentication.status === 'authenticated'
      ? 'ready_for_account_use'
      : 'bootstrap_only';
  return {
    profile,
    root,
    security,
    authentication,
    accountObservation: authentication,
    configuration: {
      ...configuration,
      artifact: configurationArtifact,
    },
    process,
    route: {
      state: 'preserved',
      ownerRef: profile.routeBinding?.ownerRef ?? context.routeOwnerRef ?? 'unknown',
      mutation: 'forbidden',
      reason: 'manager_does_not_write_routes',
    },
    binding,
    readiness,
    reasons: unique(hardReasons),
  };
}

export async function doctorRuntimeProfile({ catalog, profileId, adapter, context = {}, probeAuthentication = true } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, profileId);
  const inspected = await inspectProfile({ selected, adapter, context, probeAuthentication });
  const status = inspected.reasons.length === 0 ? 'OK' : 'NOT_OK';
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'doctor',
    status,
    runtimeProfileId: selected.profile.runtimeProfileId,
    runtimeRoot: inspected.root,
    readiness: inspected.readiness,
    binding: inspected.binding,
    storage: {
      configuredMode: selected.profile.authenticationStorage?.mode ?? 'unknown',
      supportedMode: 'file',
      profileIsolationProven: selected.profile.authenticationStorage?.profileIsolationProven ?? null,
    },
    security: inspected.security,
    authentication: inspected.authentication,
    accountObservation: inspected.accountObservation,
    configuration: inspected.configuration,
    process: inspected.process,
    route: inspected.route,
    sessions: sessionSummaries(selected.profile, selected.sessions),
    reasons: inspected.reasons,
    warnings: unique([
      ...(inspected.readiness === 'bootstrap_only' ? ['account_use_blocked_until_identity_and_isolation_are_proven'] : []),
      ...(inspected.authentication.status === 'unknown' ? ['authentication_status_unresolved'] : []),
      ...(inspected.configuration.state === 'absent' ? ['profile_configuration_not_materialized'] : []),
      ...(selected.profile.switchPolicy?.concurrencySupport === 'supported' && selected.profile.authenticationStorage?.profileIsolationProven !== true ? ['concurrency_declared_but_not_proven'] : []),
    ]),
    redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
  };
}

export function createRuntimeProfilePlan({ catalog, profileId, adapter, context = {} } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, profileId);
  const root = adapter.resolveRuntimeRoot(selected.profile, context);
  const security = adapter.inspectRootSecurity({ profile: selected.profile, root, context });
  const storageMode = selected.profile.authenticationStorage?.mode ?? 'unknown';
  const storageBlocked = storageMode !== 'file';
  const defaultRootBlocked = adapter.isDefaultRuntimeRoot(root);
  const securityBlocked = defaultRootBlocked
    || security.reasons?.some((reason) => reason !== 'runtime_root_parent_owner_unresolved')
    || (security.parent?.exists === true && security.parent.ownerMatches !== true);
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'create',
    status: storageBlocked || securityBlocked ? 'BLOCKED' : security.rootExists && security.safe ? 'NOT_NEEDED' : 'READY',
    runtimeProfileId: selected.profile.runtimeProfileId,
    runtimeRoot: root,
    createsOnly: ['empty_runtime_root', 'owner_only_permissions'],
    neverCreates: ['auth.json', 'oauth_tokens', 'cookies', 'keychain_items', 'catalog_records'],
    security,
    reasons: [
      ...(storageBlocked ? ['unsupported_storage_mode_for_deterministic_cli_isolation'] : []),
      ...(securityBlocked ? (security.reasons ?? []).filter((reason) => reason !== 'runtime_root_parent_owner_unresolved') : []),
      ...(securityBlocked && security.parent?.exists === true && security.parent.ownerMatches !== true ? ['runtime_root_parent_owner_unresolved'] : []),
      ...(defaultRootBlocked ? ['shared_default_root_is_legacy_maintenance_only'] : []),
    ],
    confirmationRequired: true,
    redaction: { secretsExcluded: true, authContentsRead: false },
  };
}

export function createRuntimeProfileConfigurationPlan({ catalog, profileId, adapter, context = {} } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, profileId);
  const root = adapter.resolveRuntimeRoot(selected.profile, context);
  return buildRuntimeProfileConfigurationPlan({ profile: selected.profile, root, adapter, context });
}

export function executeRuntimeProfileConfiguration({ plan, catalog, adapter, context = {}, settings = {} } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, plan?.runtimeProfileId);
  return materializeRuntimeProfileConfiguration({ plan, profile: selected.profile, adapter, context, settings });
}

export function executeRuntimeProfileCreation({ plan, adapter, context = {} } = {}) {
  if (!plan || !['READY', 'NOT_NEEDED'].includes(plan.status)) throw new Error('runtime profile creation plan is not executable');
  if (plan.status === 'NOT_NEEDED') return { ...plan, executed: false, executionReason: 'root_already_exists' };
  adapter.createRuntimeRoot({ root: plan.runtimeRoot, context });
  const security = adapter.inspectRootSecurity({ root: plan.runtimeRoot, context });
  if (!security.rootExists || !security.safe) throw new Error('created runtime root did not pass security inspection');
  return { ...plan, status: 'OK', executed: true, security };
}

export function clearStaleRuntimeProfileLease({ catalog, profileId, adapter, context = {}, execute = false } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, profileId);
  const root = adapter.resolveRuntimeRoot(selected.profile, context);
  const process = adapter.inspectProcessOwnership({ profile: selected.profile, root, context });
  if (process.state !== 'stale') {
    return {
      managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
      operation: 'clear-stale',
      status: process.state === 'active' ? 'BLOCKED' : 'NOT_NEEDED',
      runtimeProfileId: selected.profile.runtimeProfileId,
      runtimeRoot: root,
      process,
      reasons: process.state === 'active' ? ['profile_process_still_active'] : ['no_stale_profile_lease'],
      mutation: 'lease_metadata_only',
    };
  }
  if (!execute) {
    return {
      managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
      operation: 'clear-stale',
      status: 'READY',
      runtimeProfileId: selected.profile.runtimeProfileId,
      runtimeRoot: root,
      process,
      reasons: [],
      mutation: 'lease_metadata_only',
      confirmationRequired: true,
    };
  }
  const cleared = adapter.clearStaleProcessLease({ root, profileId: selected.profile.runtimeProfileId, context });
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'clear-stale',
    status: cleared.removed ? 'OK' : 'NOT_OK',
    runtimeProfileId: selected.profile.runtimeProfileId,
    runtimeRoot: root,
    process,
    cleared,
    mutation: 'lease_metadata_only',
    redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
  };
}

export async function buildLoginHandoff({ catalog, profileId, adapter, context = {} } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, profileId);
  const root = adapter.resolveRuntimeRoot(selected.profile, context);
  const security = adapter.inspectRootSecurity({ profile: selected.profile, root, context });
  const configurationArtifact = buildRuntimeProfileConfigurationArtifact({
    profile: selected.profile,
    root,
    configPath: adapter.profileConfigPath({ profile: selected.profile, root, context }),
    context,
  });
  const configuration = inspectRuntimeProfileConfiguration({ artifact: configurationArtifact });
  const process = adapter.inspectProcessOwnership({ profile: selected.profile, root, context });
  const storageMode = selected.profile.authenticationStorage?.mode ?? 'unknown';
  if (storageMode !== 'file') {
    return {
      managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
      operation: 'login',
      status: 'NOT_OK',
      runtimeProfileId: selected.profile.runtimeProfileId,
      runtimeRoot: root,
      security,
      configuration: { ...configuration, artifact: configurationArtifact },
      handoff: null,
      mutation: 'blocked',
      reasons: ['unsupported_storage_mode_for_deterministic_cli_isolation'],
      redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
    };
  }
  const handoff = adapter.buildLoginHandoff({ profile: selected.profile, root, context });
  if (process.state === 'active') {
    return {
      managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
      operation: 'login',
      status: 'NOT_OK',
      runtimeProfileId: selected.profile.runtimeProfileId,
      runtimeRoot: root,
      security,
      configuration: { ...configuration, artifact: configurationArtifact },
      process,
      handoff: null,
      mutation: 'blocked',
      reasons: ['target_profile_process_active'],
      redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
    };
  }
  if (configuration.state !== 'owned') {
    return {
      managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
      operation: 'login',
      status: 'NOT_OK',
      runtimeProfileId: selected.profile.runtimeProfileId,
      runtimeRoot: root,
      security,
      configuration: { ...configuration, artifact: configurationArtifact },
      process,
      handoff: null,
      mutation: 'blocked',
      reasons: ['profile_configuration_not_materialized', ...(configuration.reasons ?? [])],
      redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
    };
  }
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'login',
    status: security.reasons?.length ? 'NOT_OK' : 'READY',
    runtimeProfileId: selected.profile.runtimeProfileId,
    runtimeRoot: root,
    security,
    configuration: { ...configuration, artifact: configurationArtifact },
    process,
    handoff,
    mutation: 'human_interactive_only',
    managerActions: ['no_login_call', 'no_logout_call', 'no_auth_read', 'no_auth_copy', 'no_route_write'],
    redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
  };
}

export async function buildLaunchPlan({ catalog, profileId, adapter, context = {}, bootstrap = false, extraArgs = [] } = {}) {
  assertAdapter(adapter);
  const selected = selectProfile(catalog, profileId);
  const doctor = await inspectProfile({ selected, adapter, context, probeAuthentication: true });
  const command = doctor.reasons.length === 0
    && doctor.configuration.state === 'owned'
    ? adapter.buildLaunchCommand({ profile: selected.profile, root: doctor.root, context, extraArgs })
    : null;
  const canBootstrap = bootstrap && doctor.readiness === 'bootstrap_only' && doctor.reasons.length === 0;
  const launchReasons = [
    ...doctor.reasons,
    ...(doctor.process.state === 'active' ? ['target_profile_process_active'] : []),
    ...(doctor.configuration.state !== 'owned' ? ['profile_configuration_not_materialized'] : []),
    ...(doctor.readiness === 'bootstrap_only' && !bootstrap ? ['bootstrap_flag_required_before_identity_proof'] : []),
  ];
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'launch',
    status: launchReasons.length === 0 && (doctor.readiness === 'ready_for_account_use' || canBootstrap) ? 'READY' : 'BLOCKED',
    runtimeProfileId: selected.profile.runtimeProfileId,
    runtimeRoot: doctor.root,
    executionMode: doctor.readiness,
    command,
    processPolicy: {
      ownership: 'profile_scoped',
      globalKillAllowed: false,
      parentEnvironmentMutation: false,
      leasePath: adapter.processLeasePath({ root: doctor.root }),
    },
    route: doctor.route,
    reasons: unique(launchReasons),
    warnings: unique([
      ...(doctor.readiness === 'bootstrap_only' ? ['bootstrap_launch_is_not_authorized_for_account_use'] : []),
      ...(doctor.warnings ?? []),
    ]),
    redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
  };
}

export function executeLaunchPlan({ plan, adapter, context = {}, spawnProcess = spawn, now = new Date() } = {}) {
  if (plan?.status !== 'READY') throw new Error(`launch blocked: ${(plan?.reasons ?? ['unknown']).join(',')}`);
  const childEnvironment = { ...process.env, ...plan.command.envOverlay };
  const child = spawnProcess(plan.command.executable, plan.command.args, {
    cwd: context.cwd,
    env: childEnvironment,
    stdio: 'inherit',
    shell: false,
  });
  const startedAt = new Date(now).toISOString();
  let lease;
  try {
    lease = adapter.writeProcessLease({
      root: plan.runtimeRoot,
      profileId: plan.runtimeProfileId,
      pid: child.pid,
      startedAt,
      context,
    });
  } catch (error) {
    if (typeof child.kill === 'function') child.kill('SIGTERM');
    throw new Error(`profile-scoped process lease could not be established: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof child.once === 'function') {
    child.once('close', () => adapter.removeProcessLease({ root: plan.runtimeRoot, pid: child.pid, context }));
  }
  return {
    managerVersion: RUNTIME_PROFILE_MANAGER_VERSION,
    operation: 'launch',
    status: 'STARTED',
    runtimeProfileId: plan.runtimeProfileId,
    pid: child.pid,
    startedAt,
    lease,
    environmentBoundary: { CODEX_HOME: plan.command.envOverlay.CODEX_HOME, parentEnvironmentMutated: false },
    redaction: { secretsExcluded: true, authContentsRead: false, rawOutputCaptured: false },
  };
}

export function isPathWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function writeJsonFileOwnerOnly(file, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const descriptor = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, serialized, 'utf8');
    fs.fchmodSync(descriptor, 0o600);
  } finally {
    fs.closeSync(descriptor);
  }
}
