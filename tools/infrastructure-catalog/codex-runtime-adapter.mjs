import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createObservationAdapter, candidateFromObservation } from './observation-core.mjs';

export const CODEX_RUNTIME_OBSERVER_ID = 'codex-runtime-observer';
export const CODEX_RUNTIME_OBSERVER_VERSION = '1.0.0';
export const DEFAULT_CODEX_WEB_GPT_SOURCE_ROOT = '/Users/Office/Repos/vendors/codex-chatgpt-web';

const SAFE_DOCTOR_CHECKS = new Set([
  'config', 'browser-host', 'codex', 'service', 'proxy', 'tunnel-binary', 'tunnel-key', 'tunnel-service', 'tunnel-runtime', 'connector',
]);

function defaultRun(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 30_000,
    maxBuffer: 512 * 1024,
    shell: false,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    errorCode: result.error?.code ?? null,
  };
}

function parseJsonResult(result) {
  if (!result.ok) return null;
  try {
    const value = JSON.parse(result.stdout);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function safeDoctorResult(result) {
  const payload = parseJsonResult(result);
  if (!payload) return { state: 'unknown', ok: false, checks: {}, reason: result.errorCode ?? 'doctor_unavailable' };
  const checks = Object.fromEntries((Array.isArray(payload.checks) ? payload.checks : [])
    .filter((entry) => SAFE_DOCTOR_CHECKS.has(entry?.id))
    .map((entry) => [entry.id, entry.status === 'ok' ? 'ok' : entry.status === 'warning' ? 'warning' : 'error']));
  const errorCount = Object.values(checks).filter((value) => value === 'error').length;
  return { state: 'confirmed', ok: payload.ok === true && errorCount === 0, mode: payload.mode ?? 'unknown', checks };
}

function safeDevStatusResult(result) {
  const payload = parseJsonResult(result);
  if (!payload) return { state: 'unknown', configured: false, launcherRunning: false, mcpRequired: false, mcpReady: false, reason: result.errorCode ?? 'dev_status_unavailable' };
  return {
    state: 'confirmed',
    configured: payload.config?.configured === true,
    mode: typeof payload.config?.mode === 'string' ? payload.config.mode : 'unknown',
    purpose: payload.config?.purpose === 'dev-harness' ? 'dev-harness' : 'unknown',
    launcherRunning: payload.launcher?.running === true,
    launcherProfile: payload.launcher?.profile === 'development' ? 'development' : 'unknown',
    mcpRequired: payload.mcpRuntime?.required === true,
    mcpReady: payload.mcpRuntime?.ready === true,
    biggerContext: payload.features?.biggerContext === true,
  };
}

function safeNativeLoginResult(result) {
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
  if (result.errorCode === 'ENOENT') return { state: 'unknown', status: 'unavailable' };
  if (/not logged|logged out|no active|unauthenticated|not authenticated/.test(text)) return { state: 'confirmed', status: 'not_authenticated' };
  if (result.status === 0 && /logged in|authenticated|active session|already logged/.test(text)) return { state: 'confirmed', status: 'authenticated' };
  return { state: 'unknown', status: result.status === 0 ? 'unknown' : 'error' };
}

function safeCodexConfigMetadata({ configPath = null, readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const resolvedPath = configPath ?? path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'config.toml');
  try {
    const contents = readFile(resolvedPath);
    const matches = String(contents).split(/\r?\n/)
      .map((line) => /^\s*cli_auth_credentials_store\s*=\s*"(file|keyring|auto)"\s*(?:#.*)?$/.exec(line))
      .filter(Boolean)
      .map((match) => match[1]);
    if (matches.length > 1) return { state: 'unknown', configuredCredentialStore: null, reason: 'duplicate_storage_setting' };
    return {
      state: 'confirmed',
      configPresent: true,
      configuredCredentialStore: matches[0] ?? null,
      storageSelection: matches[0] ?? 'unspecified',
      pathBasis: process.env.CODEX_HOME ? 'CODEX_HOME' : 'default_CODEX_HOME',
    };
  } catch (error) {
    return { state: error?.code === 'ENOENT' ? 'unknown' : 'unknown', configPresent: false, configuredCredentialStore: null, storageSelection: 'unknown', reason: error?.code ?? 'config_unavailable' };
  }
}

function safeBundleMetadata(result) {
  if (!result.ok) return { state: 'unknown', bundleId: null, version: null };
  // macOS mdls may delimit multiple -name results with NUL bytes.
  const lines = String(result.stdout ?? '').split(/\0|\r?\n/).map((line) => line.trim()).filter(Boolean);
  const version = lines.find((line) => /^\d+(?:\.\d+)+$/.test(line)) ?? null;
  const bundleId = lines.find((line) => /^[a-z][a-z0-9.-]+\.[a-z0-9.-]+$/.test(line)) ?? null;
  return { state: version || bundleId ? 'confirmed' : 'unknown', bundleId, version };
}

function processByIdentity(localRuntime, pattern) {
  return (localRuntime?.processes ?? []).filter((entry) => pattern.test(entry.commandIdentity));
}

function listenerForPort(localRuntime, port) {
  return (localRuntime?.listeners ?? []).find((entry) => entry.port === port && entry.hostClass === 'loopback') ?? null;
}

function processEvidence(processes, ownerRef, ownerState = 'confirmed') {
  const processIds = [...new Set(processes.map((entry) => entry.pid))];
  const parentProcessIds = [...new Set(processes.map((entry) => entry.parentPid))];
  return {
    state: processes.length > 0 ? 'confirmed' : 'unknown',
    processIds,
    parentProcessIds,
    ownerState: processes.length > 0 ? ownerState : 'unknown',
    ownerRef: processes.length > 0 ? ownerRef : null,
    commandIdentity: processes[0]?.commandIdentity ?? null,
  };
}

function makeObservation({
  resourceId,
  candidateId,
  status = 'unknown',
  conditionCodes = [],
  metricsSummary = {},
  environment,
  runtimeIdentity,
  process,
  endpoints,
  ownership,
  routeOwnership,
  dependencies,
  identity,
  health,
  lifecycle,
  isolation,
  now,
  provenanceClassification = 'OBSERVED-VERIFIED',
  confidence = 'medium',
  evidenceRefs = [],
}) {
  const observedAt = new Date(now).toISOString();
  return {
    schemaVersion: '1.0.0',
    observationId: `observation:codex-runtime:${resourceId}:${observedAt}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'),
    resourceId,
    providerId: 'codex-runtime',
    observedAt,
    status,
    freshness: 'fresh',
    sourceEntityId: resourceId,
    metricsSummary,
    conditionCodes: [...new Set(conditionCodes)],
    provenance: {
      source: 'codex-runtime-observer',
      readOnly: true,
      authority: 'local-observation',
      classification: provenanceClassification,
      confidence,
      evidenceRefs,
    },
    observationKind: 'runtime',
    observer: { observerId: CODEX_RUNTIME_OBSERVER_ID, adapterKind: 'codex-runtime', adapterVersion: CODEX_RUNTIME_OBSERVER_VERSION },
    candidateId,
    environment,
    runtimeIdentity,
    processEvidence: process,
    endpointEvidence: endpoints,
    ownershipEvidence: ownership,
    routeOwnershipEvidence: routeOwnership,
    dependencyEvidence: dependencies,
    identityBindingEvidence: identity,
    healthCapability: health,
    lifecycleCapability: lifecycle,
    isolationEvidence: isolation,
    redaction: {
      classification: 'non-secret-allowlisted',
      secretsExcluded: true,
      excludedClasses: ['auth_json', 'oauth_tokens', 'cookies', 'api_key_values', 'tunnel_credentials', 'browser_storage', 'process_arguments', 'environment_variables'],
    },
  };
}

function productionObservation({ doctor, bundle, localRuntime, now }) {
  const launcher = processByIdentity(localRuntime, /codex-web-gpt/);
  const bridge = listenerForPort(localRuntime, 17841);
  const tunnel = processByIdentity(localRuntime, /tunnel-client/);
  const browserOk = doctor.checks['browser-host'] === 'ok';
  const proxyOk = doctor.checks.proxy === 'ok';
  const tunnelOk = doctor.checks['tunnel-runtime'] === 'ok';
  const connectorUnknown = doctor.checks.connector === 'warning';
  const status = doctor.ok && browserOk && proxyOk && tunnelOk && launcher.length > 0 ? (connectorUnknown ? 'degraded' : 'healthy') : 'unknown';
  return makeObservation({
    resourceId: 'service:codex-web-gpt-production-runtime',
    candidateId: 'candidate:codex-web-gpt-production-runtime',
    status,
    conditionCodes: [
      ...(connectorUnknown ? ['connector_attachment_unknown'] : []),
      ...(launcher.length === 0 ? ['launcher_process_unknown'] : []),
      ...(bridge ? [] : ['loopback_bridge_listener_unknown']),
    ],
    metricsSummary: {
      applicationVersion: bundle.version,
      doctor: doctor.ok ? 'ok' : 'not_ok',
      browserHost: browserOk ? 'ok' : 'unknown',
      proxy: proxyOk ? 'ok' : 'unknown',
      tunnel: tunnelOk ? 'ok' : 'unknown',
      connector: connectorUnknown ? 'unknown' : doctor.checks.connector ?? 'unknown',
      route: doctor.checks.codex ?? 'unknown',
      bridgePort: bridge?.port ?? null,
      bridgeOwnerProcessId: bridge?.ownerProcessId ?? null,
      accountCapacity: 'unknown',
      profileConcurrency: 'unknown',
    },
    environment: { state: 'confirmed', environmentClass: 'production', environmentRef: 'environment:codex-web-production', basis: ['production-doctor', 'default-production-profile-semantics'] },
    runtimeIdentity: { state: launcher.length > 0 ? 'confirmed' : 'unknown', runtimeKind: 'desktop-launcher', runtimeRef: 'service:codex-web-gpt-production-runtime', version: bundle.version, profileRef: 'runtime_profile:codex-web-gpt-production', identityStability: 'profile-scoped' },
    process: processEvidence(launcher, 'application:codex-web-gpt'),
    endpoints: { state: bridge && proxyOk ? 'confirmed' : 'unknown', endpoints: bridge && proxyOk ? [{ protocol: 'http', hostClass: 'loopback', port: 17841, reachability: 'reachable', ownerProcessId: bridge.ownerProcessId }] : [] },
    ownership: { state: launcher.length > 0 && doctor.checks.service === 'ok' ? 'confirmed' : 'candidate', ownerRef: 'application:codex-web-gpt', ownerKind: 'application', custody: 'application', mutationAuthority: 'owner-only', writerRefs: ['application:codex-web-gpt'] },
    routeOwnership: { state: doctor.checks.codex === 'ok' ? 'confirmed' : 'unknown', ownerRef: doctor.checks.codex === 'ok' ? 'application:codex-web-gpt' : null, ownerKind: doctor.checks.codex === 'ok' ? 'application' : 'unknown', custody: doctor.checks.codex === 'ok' ? 'application' : 'unknown', mutationAuthority: doctor.checks.codex === 'ok' ? 'owner-only' : 'unknown', writerRefs: doctor.checks.codex === 'ok' ? ['application:codex-web-gpt'] : [] },
    dependencies: { state: proxyOk && tunnelOk ? 'confirmed' : 'unknown', dependencies: [
      { resourceRef: 'service:codex-web-gpt-bridge', class: 'required', availability: 'continuous', status: proxyOk ? 'healthy' : 'unknown' },
      { resourceRef: 'tunnel:codex-web-gpt-production', class: 'required', availability: 'continuous', status: tunnelOk ? 'healthy' : 'unknown' },
      { resourceRef: 'session:codex-web-gpt-production', class: 'required', availability: 'continuous', status: browserOk ? 'healthy' : 'unknown' },
    ] },
    identity: { state: 'candidate', accountRefs: [], sessionRefs: browserOk ? ['session:codex-web-gpt-production'] : [], runtimeProfileRefs: ['runtime_profile:codex-web-gpt-production'], custody: 'application', principalMatch: 'unknown' },
    health: { state: doctor.state === 'confirmed' ? 'confirmed' : 'unknown', adapterRef: 'adapter:codex-web-gpt-doctor', capabilities: ['observe', 'verify'] },
    lifecycle: { state: doctor.checks.service === 'ok' ? 'confirmed' : 'unknown', ownerManaged: 'application', launchAtLogin: 'unknown', keepRunningWhenWindowCloses: 'unknown', quiescenceState: 'not_observable', activeWorkloadCount: null },
    isolation: { state: 'candidate', environmentRef: 'environment:codex-web-production', boundaryRefs: ['boundary:codex-web-gpt-production'], dimensions: { runtime_profile: 'distinct', browser_partition: 'distinct', development_boundary: 'unknown' } },
    now,
    confidence: connectorUnknown ? 'medium' : 'high',
    evidenceRefs: ['codex-web-gpt-doctor', 'local-process-observation', 'local-listener-observation'],
  });
}

function bridgeObservation({ doctor, localRuntime, now }) {
  const bridge = listenerForPort(localRuntime, 17841);
  const process = bridge ? (localRuntime.processes ?? []).filter((entry) => entry.pid === bridge.ownerProcessId) : [];
  const proxyOk = doctor.checks.proxy === 'ok';
  return makeObservation({
    resourceId: 'service:codex-web-gpt-bridge',
    candidateId: 'candidate:codex-web-gpt-bridge',
    status: proxyOk && bridge ? 'healthy' : 'unknown',
    conditionCodes: proxyOk && bridge ? [] : ['bridge_unavailable_or_unverified'],
    metricsSummary: { port: bridge?.port ?? 17841, routeReachability: proxyOk ? 'reachable' : 'unknown' },
    environment: { state: 'confirmed', environmentClass: 'production', environmentRef: 'environment:codex-web-production', basis: ['production-doctor', 'loopback-listener-observation'] },
    runtimeIdentity: { state: process.length > 0 ? 'confirmed' : 'unknown', runtimeKind: 'local-bridge', runtimeRef: 'service:codex-web-gpt-bridge', version: null, profileRef: 'runtime_profile:codex-web-gpt-production', identityStability: 'endpoint-instance' },
    process: processEvidence(process, 'application:codex-web-gpt'),
    endpoints: { state: proxyOk && bridge ? 'confirmed' : 'unknown', endpoints: bridge ? [{ protocol: 'http', hostClass: 'loopback', port: bridge.port, reachability: proxyOk ? 'reachable' : 'unknown', ownerProcessId: bridge.ownerProcessId }] : [] },
    ownership: { state: process.length > 0 ? 'confirmed' : 'unknown', ownerRef: process.length > 0 ? 'application:codex-web-gpt' : null, ownerKind: process.length > 0 ? 'application' : 'unknown', custody: process.length > 0 ? 'application' : 'unknown', mutationAuthority: process.length > 0 ? 'owner-only' : 'unknown', writerRefs: process.length > 0 ? ['application:codex-web-gpt'] : [] },
    routeOwnership: { state: proxyOk ? 'confirmed' : 'unknown', ownerRef: proxyOk ? 'application:codex-web-gpt' : null, ownerKind: proxyOk ? 'application' : 'unknown', custody: proxyOk ? 'application' : 'unknown', mutationAuthority: proxyOk ? 'owner-only' : 'unknown', writerRefs: proxyOk ? ['application:codex-web-gpt'] : [] },
    dependencies: { state: doctor.checks['tunnel-runtime'] === 'ok' ? 'confirmed' : 'unknown', dependencies: [{ resourceRef: 'tunnel:codex-web-gpt-production', class: 'required', availability: 'continuous', status: doctor.checks['tunnel-runtime'] === 'ok' ? 'healthy' : 'unknown' }] },
    identity: { state: 'not_applicable', accountRefs: [], sessionRefs: [], runtimeProfileRefs: ['runtime_profile:codex-web-gpt-production'], custody: 'not_applicable', principalMatch: 'not_applicable' },
    health: { state: 'confirmed', adapterRef: 'adapter:codex-web-gpt-doctor', capabilities: ['observe', 'verify'] },
    lifecycle: { state: process.length > 0 ? 'confirmed' : 'unknown', ownerManaged: process.length > 0 ? 'application' : 'unknown', launchAtLogin: 'unknown', keepRunningWhenWindowCloses: 'unknown', quiescenceState: 'not_observable', activeWorkloadCount: null },
    isolation: { state: 'candidate', environmentRef: 'environment:codex-web-production', boundaryRefs: ['boundary:codex-web-gpt-production'], dimensions: { runtime_profile: 'distinct', network: 'unknown' } },
    now,
    evidenceRefs: ['codex-web-gpt-doctor', 'local-listener-observation'],
  });
}

function tunnelObservation({ doctor, localRuntime, now }) {
  const processes = processByIdentity(localRuntime, /tunnel-client/);
  const ready = doctor.checks['tunnel-runtime'] === 'ok';
  return makeObservation({
    resourceId: 'tunnel:codex-web-gpt-production',
    candidateId: 'candidate:codex-web-gpt-production-tunnel',
    status: ready && processes.length > 0 ? 'healthy' : 'unknown',
    conditionCodes: ready && processes.length > 0 ? [] : ['tunnel_runtime_unverified'],
    metricsSummary: { runtimeReady: ready, tunnelBinary: doctor.checks['tunnel-binary'] ?? 'unknown', tunnelKey: doctor.checks['tunnel-key'] ?? 'unknown' },
    environment: { state: 'confirmed', environmentClass: 'production', environmentRef: 'environment:codex-web-production', basis: ['production-doctor', 'local-process-observation'] },
    runtimeIdentity: { state: processes.length > 0 ? 'confirmed' : 'unknown', runtimeKind: 'outbound-tunnel', runtimeRef: 'tunnel:codex-web-gpt-production', version: null, profileRef: 'runtime_profile:codex-web-gpt-production', identityStability: 'profile-scoped' },
    process: processEvidence(processes, 'application:codex-web-gpt'),
    endpoints: { state: 'not_applicable', endpoints: [] },
    ownership: { state: processes.length > 0 ? 'confirmed' : 'unknown', ownerRef: processes.length > 0 ? 'application:codex-web-gpt' : null, ownerKind: processes.length > 0 ? 'application' : 'unknown', custody: processes.length > 0 ? 'application' : 'unknown', mutationAuthority: processes.length > 0 ? 'owner-only' : 'unknown', writerRefs: processes.length > 0 ? ['application:codex-web-gpt'] : [] },
    routeOwnership: { state: 'not_applicable', ownerRef: null, ownerKind: 'unknown', custody: 'unknown', mutationAuthority: 'none', writerRefs: [] },
    dependencies: { state: 'confirmed', dependencies: [] },
    identity: { state: 'unknown', accountRefs: [], sessionRefs: [], runtimeProfileRefs: ['runtime_profile:codex-web-gpt-production'], custody: 'unknown', principalMatch: 'unknown' },
    health: { state: doctor.state === 'confirmed' ? 'confirmed' : 'unknown', adapterRef: 'adapter:codex-web-gpt-doctor', capabilities: ['observe', 'verify'] },
    lifecycle: { state: processes.length > 0 ? 'confirmed' : 'unknown', ownerManaged: processes.length > 0 ? 'application' : 'unknown', launchAtLogin: 'unknown', keepRunningWhenWindowCloses: 'unknown', quiescenceState: 'not_required', activeWorkloadCount: null },
    isolation: { state: 'candidate', environmentRef: 'environment:codex-web-production', boundaryRefs: ['boundary:codex-web-gpt-production'], dimensions: { tunnel_profile: 'distinct', development_boundary: 'unknown' } },
    now,
    evidenceRefs: ['codex-web-gpt-doctor', 'local-process-observation'],
  });
}

function nativeCodexObservation({ localRuntime, nativeLogin, bundle, codexConfig, now }) {
  const processes = processByIdentity(localRuntime, /codex/).filter((entry) => !/web-gpt/.test(entry.commandIdentity));
  const authenticated = nativeLogin.status === 'authenticated';
  return makeObservation({
    resourceId: 'application:native-codex-runtime',
    candidateId: 'candidate:native-codex-runtime',
    status: authenticated && processes.length > 0 ? 'healthy' : 'unknown',
    conditionCodes: authenticated ? [] : ['native_codex_auth_status_unknown'],
    metricsSummary: { processCount: processes.length, authentication: nativeLogin.status, applicationVersion: bundle.version, configuredCredentialStore: codexConfig.configuredCredentialStore, storageSelection: codexConfig.storageSelection },
    environment: { state: 'confirmed', environmentClass: 'local', environmentRef: 'environment:native-codex-local', basis: ['local-process-observation', 'codex-login-status'] },
    runtimeIdentity: { state: processes.length > 0 ? 'confirmed' : 'unknown', runtimeKind: 'native-codex', runtimeRef: 'application:native-codex-runtime', version: bundle.version, profileRef: 'runtime_profile:native-codex-current', identityStability: 'profile-scoped' },
    process: processEvidence(processes, 'application:native-codex'),
    endpoints: { state: 'not_applicable', endpoints: [] },
    ownership: { state: processes.length > 0 ? 'confirmed' : 'unknown', ownerRef: processes.length > 0 ? 'application:native-codex' : null, ownerKind: processes.length > 0 ? 'application' : 'unknown', custody: processes.length > 0 ? 'application' : 'unknown', mutationAuthority: 'unknown', writerRefs: [] },
    routeOwnership: { state: 'unknown', ownerRef: null, ownerKind: 'unknown', custody: 'unknown', mutationAuthority: 'unknown', writerRefs: [] },
    dependencies: { state: 'unknown', dependencies: [{ resourceRef: 'service:codex-web-gpt-bridge', class: 'optional', availability: 'continuous', status: 'unknown' }] },
    identity: { state: authenticated ? 'candidate' : 'unknown', accountRefs: [], sessionRefs: authenticated ? ['session:native-codex-current'] : [], runtimeProfileRefs: ['runtime_profile:native-codex-current'], custody: authenticated ? 'application' : 'unknown', principalMatch: 'unknown' },
    health: { state: nativeLogin.state === 'confirmed' ? 'confirmed' : 'unknown', adapterRef: 'adapter:native-codex-login-status', capabilities: ['observe', 'verify'] },
    lifecycle: { state: processes.length > 0 ? 'confirmed' : 'unknown', ownerManaged: 'application', launchAtLogin: 'unknown', keepRunningWhenWindowCloses: 'unknown', quiescenceState: 'not_observable', activeWorkloadCount: null },
    isolation: { state: 'unknown', environmentRef: 'environment:native-codex-local', boundaryRefs: ['boundary:native-codex-current'], dimensions: { account_profile: 'unknown', runtime_home: 'unknown', authentication_storage: 'unknown', web_gpt_boundary: 'unknown' } },
    now,
    evidenceRefs: ['native-codex-login-status', 'local-process-observation'],
  });
}

function developmentObservation({ dev, localRuntime, now }) {
  const processes = processByIdentity(localRuntime, /codex-web-gpt/).filter((entry) => entry.commandIdentity.includes('dev'));
  const running = dev.launcherRunning && processes.length > 0;
  return makeObservation({
    resourceId: 'service:codex-web-gpt-development-runtime',
    candidateId: 'candidate:codex-web-gpt-development-runtime',
    status: running && dev.mcpReady ? 'healthy' : 'unknown',
    conditionCodes: [
      ...(dev.configured ? [] : ['dev_configuration_unknown']),
      ...(!dev.launcherRunning ? ['dev_launcher_not_running'] : []),
      ...(dev.mcpRequired && !dev.mcpReady ? ['dev_mcp_runtime_not_ready'] : []),
    ],
    metricsSummary: { configured: dev.configured, mode: dev.mode, purpose: dev.purpose, launcherRunning: dev.launcherRunning, mcpRequired: dev.mcpRequired, mcpReady: dev.mcpReady, accountCapacity: 'unknown', profileConcurrency: 'unknown' },
    environment: { state: dev.purpose === 'dev-harness' ? 'confirmed' : 'unknown', environmentClass: 'development', environmentRef: 'environment:codex-web-development', basis: ['dev-status-purpose'] },
    runtimeIdentity: { state: running ? 'confirmed' : 'candidate', runtimeKind: 'desktop-launcher', runtimeRef: 'service:codex-web-gpt-development-runtime', version: null, profileRef: 'runtime_profile:codex-web-gpt-development', identityStability: 'profile-scoped' },
    process: processEvidence(processes, 'application:codex-web-gpt'),
    endpoints: { state: 'unknown', endpoints: [] },
    ownership: { state: dev.configured ? 'candidate' : 'unknown', ownerRef: dev.configured ? 'application:codex-web-gpt' : null, ownerKind: dev.configured ? 'application' : 'unknown', custody: dev.configured ? 'application' : 'unknown', mutationAuthority: 'unknown', writerRefs: [] },
    routeOwnership: { state: 'not_applicable', ownerRef: null, ownerKind: 'unknown', custody: 'unknown', mutationAuthority: 'none', writerRefs: [] },
    dependencies: { state: 'unknown', dependencies: [{ resourceRef: 'tunnel:codex-web-gpt-development', class: 'required', availability: 'continuous', status: dev.mcpReady ? 'healthy' : 'unknown' }] },
    identity: { state: 'unknown', accountRefs: [], sessionRefs: [], runtimeProfileRefs: ['runtime_profile:codex-web-gpt-development'], custody: 'unknown', principalMatch: 'unknown' },
    health: { state: dev.configured ? 'candidate' : 'unknown', adapterRef: 'adapter:codex-web-gpt-dev-status', capabilities: ['observe', 'verify'] },
    lifecycle: { state: dev.configured ? 'candidate' : 'unknown', ownerManaged: dev.configured ? 'application' : 'unknown', launchAtLogin: 'unknown', keepRunningWhenWindowCloses: 'unknown', quiescenceState: 'not_observable', activeWorkloadCount: null },
    isolation: { state: 'unknown', environmentRef: 'environment:codex-web-development', boundaryRefs: [], dimensions: { runtime_home: 'unknown', browser_partition: 'unknown', tunnel_profile: 'unknown', production_boundary: 'unknown' } },
    now,
    provenanceClassification: dev.configured ? 'OBSERVED-VERIFIED' : 'UNKNOWN',
    evidenceRefs: ['codex-web-gpt-dev-status', 'local-process-observation'],
  });
}

export function createCodexRuntimeObserver({
  sourceRoot = DEFAULT_CODEX_WEB_GPT_SOURCE_ROOT,
  bunExecutable = 'bun',
  codexExecutable = 'codex',
  applicationPath = '/Applications/Codex Web GPT.app',
  nativeApplicationPath = '/Applications/ChatGPT.app',
  run = defaultRun,
  localRuntimeObserver,
  now = new Date(),
} = {}) {
  let latest = null;
  return createObservationAdapter({
    observerId: CODEX_RUNTIME_OBSERVER_ID,
    adapterKind: 'codex-runtime',
    adapterVersion: CODEX_RUNTIME_OBSERVER_VERSION,
    discover: async (context = {}) => {
      const observedAt = context.now ?? now;
      const localRuntime = context.localRuntime ?? localRuntimeObserver?.(observedAt) ?? { processes: [], listeners: [] };
      const doctor = context.doctor ?? safeDoctorResult(run(bunExecutable, ['run', 'src/cli.ts', 'doctor', '--json'], { cwd: sourceRoot, timeoutMs: 30_000 }));
      const dev = context.dev ?? safeDevStatusResult(run(bunExecutable, ['run', 'src/cli.ts', 'dev', 'status', '--json'], { cwd: sourceRoot, timeoutMs: 30_000 }));
      const nativeLogin = context.nativeLogin ?? safeNativeLoginResult(run(codexExecutable, ['login', 'status'], { timeoutMs: 15_000 }));
      const codexConfig = context.codexConfig ?? safeCodexConfigMetadata();
      const bundle = context.bundle ?? safeBundleMetadata(run('/usr/bin/mdls', ['-raw', '-name', 'kMDItemVersion', '-name', 'kMDItemCFBundleIdentifier', applicationPath], { timeoutMs: 5_000 }));
      const nativeBundle = context.nativeBundle ?? safeBundleMetadata(run('/usr/bin/mdls', ['-raw', '-name', 'kMDItemVersion', '-name', 'kMDItemCFBundleIdentifier', nativeApplicationPath], { timeoutMs: 5_000 }));
      const observations = [
        productionObservation({ doctor, bundle, localRuntime, now: observedAt }),
        bridgeObservation({ doctor, localRuntime, now: observedAt }),
        tunnelObservation({ doctor, localRuntime, now: observedAt }),
        nativeCodexObservation({ localRuntime, nativeLogin, bundle: nativeBundle, codexConfig, now: observedAt }),
        developmentObservation({ dev, localRuntime, now: observedAt }),
      ];
      latest = {
        observer: { observerId: CODEX_RUNTIME_OBSERVER_ID, adapterKind: 'codex-runtime', adapterVersion: CODEX_RUNTIME_OBSERVER_VERSION },
        observedAt: new Date(observedAt).toISOString(),
        sourceAvailability: { doctor: doctor.state, devStatus: dev.state, nativeLogin: nativeLogin.state, codexConfig: codexConfig.state, webGptBundle: bundle.state, nativeBundle: nativeBundle.state },
        observations,
        candidates: observations.map((observation) => candidateFromObservation(observation, { resourceKind: observation.runtimeIdentity?.runtimeKind ?? 'runtime' })),
        summary: {
          production: { status: observations[0].status, launcherRunning: observations[0].processEvidence.processIds.length > 0, connector: observations[0].metricsSummary.connector },
          bridge: { status: observations[1].status, port: observations[1].metricsSummary.port, reachable: observations[1].metricsSummary.routeReachability === 'reachable' },
          tunnel: { status: observations[2].status },
          nativeCodex: { status: observations[3].status, login: nativeLogin.status, processCount: observations[3].processEvidence.processIds.length, applicationVersion: nativeBundle.version, configuredCredentialStore: codexConfig.configuredCredentialStore, storageSelection: codexConfig.storageSelection, accountIdentity: 'unknown_by_design' },
          development: { status: observations[4].status, configured: dev.configured, launcherRunning: dev.launcherRunning, mcpReady: dev.mcpReady },
        },
      };
      return latest;
    },
    observe: async (candidate) => latest?.candidates?.find((entry) => entry.candidateId === candidate?.candidateId) ?? null,
    verifyRelationship: async ({ sourceId, targetId } = {}) => ({
      relationId: `relationship:${sourceId ?? 'unknown'}:${targetId ?? 'unknown'}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'),
      sourceId: sourceId ?? null,
      targetId: targetId ?? null,
      state: 'unknown',
      provenance: { source: 'codex-runtime-observer', readOnly: true, authority: 'local-observation' },
    }),
  });
}

export { safeDoctorResult, safeDevStatusResult, safeNativeLoginResult, safeCodexConfigMetadata, safeBundleMetadata };
