#!/usr/bin/env node

import fs from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const NATIVE_SWIFT = '/usr/bin/swift';
const PROBE_SCRIPT = path.join(import.meta.dirname, 'macos-keychain-probe.swift');
const STORE_SCRIPT = path.join(import.meta.dirname, 'macos-keychain-store.swift');
const BOUNDARY_SCRIPT = path.join(import.meta.dirname, 'macos-keychain-verification-boundary.swift');
const DEFAULT_SERVICE_PREFIX = 'tools.prochat.brain';
const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALLOWED_PROBE_RESULTS = new Set(['available', 'present', 'missing', 'permission_denied', 'unavailable', 'unknown']);
const ALLOWED_STORE_OPERATIONS = new Set(['create', 'update', 'delete', 'inventory']);
const ALLOWED_STORE_STATES = new Set(['available', 'present', 'missing', 'permission_denied', 'unavailable', 'unknown']);
const ALLOWED_BOUNDARY_STATES = new Set(['credential_missing', 'permission_denied', 'vault_unavailable', 'provider_result', 'unknown']);
const ALLOWED_RESULT_CODES = new Set(['accepted', 'rejected', 'revoked', 'provider_unavailable', 'reauthentication_required', 'refresh_available', 'unknown']);
const ALLOWED_REASON_CODES = new Set([
  'keychain_item_missing', 'keychain_access_denied', 'keychain_unavailable', 'keychain_probe_unknown',
  'keychain_data_unavailable', 'verifier_input_failed', 'verifier_output_rejected', 'invalid_invocation',
  'invalid_verifier_command', 'provider_success', 'provider_authentication_failed', 'provider_forbidden',
  'provider_rate_limited', 'provider_policy_required', 'provider_response_malformed', 'provider_response_oversized',
  'provider_redirect_rejected', 'provider_timeout', 'provider_tls_failed', 'provider_network_failed',
  'provider_proxy_blocked', 'provider_scope_unavailable', 'provider_credential_type_unknown',
  'provider_response_unexpected', 'provider_input_invalid',
  'mutation_approval_required', 'invalid_mutation_input', 'invalid_label',
  'invalid_secret_input', 'duplicate_item', 'keychain_add_failed',
  'keychain_update_failed', 'keychain_delete_failed', 'keychain_inventory_failed',
  'native_store_result_rejected', 'unadmitted_namespace',
]);
const ALLOWED_SCOPE_EVIDENCE = new Set(['provider_observed', 'declared_only', 'not_observable', 'unknown']);
const ALLOWED_METADATA_SOURCES = new Set(['user_declared', 'provider_observed', 'policy_derived', 'unknown']);
const VERIFIER_ID_RE = /^[a-z][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/;
const SYNTHETIC_VERIFIER_ID = 'provider:synthetic-local';
const GITHUB_VERIFIER_ID = 'provider:github-readonly';

export const MACOS_KEYCHAIN_ADAPTER_ID = 'secret-store:macos-keychain';
export const MACOS_KEYCHAIN_REFERENCE_SCHEME = 'keychain-ref';
export const MACOS_KEYCHAIN_CAPABILITIES = Object.freeze([
  'metadata_read',
  'metadata_inventory',
  'bounded_consume',
  'secret_create',
  'secret_update',
  'secret_delete',
]);
export const MACOS_KEYCHAIN_UNADMITTED_CAPABILITIES = Object.freeze([
  'resolve_for_bound_process',
  'version_metadata',
  'lease_metadata',
  'lease_renewal',
  'revocation_metadata',
  'audit_metadata',
  'offline_recovery',
]);

export const MACOS_KEYCHAIN_SERVICE_NAMESPACE = DEFAULT_SERVICE_PREFIX;
export const MACOS_KEYCHAIN_PHYSICAL_STORE = 'login';
export const SYNTHETIC_PILOT_REFERENCE = 'keychain-ref://tools.prochat.brain.synthetic.pilot/brain-synthetic-pilot';

function defaultVerifierRegistry() {
  return new Map([
    [SYNTHETIC_VERIFIER_ID, Object.freeze({
      executable: process.execPath,
      argsPrefix: [path.join(import.meta.dirname, 'synthetic-provider-verifier.mjs')],
    })],
    [GITHUB_VERIFIER_ID, Object.freeze({
      executable: process.execPath,
      argsPrefix: [path.join(import.meta.dirname, 'github-provider-verifier.mjs')],
    })],
  ]);
}

function normalizeVerifierRegistry(value) {
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value ?? {});
  const registry = new Map();
  for (const [verifierId, registration] of entries) {
    if (!VERIFIER_ID_RE.test(verifierId)
      || !registration
      || typeof registration.executable !== 'string'
      || !registration.executable.startsWith('/')
      || registration.executable.includes('\0')
      || !Array.isArray(registration.argsPrefix)
      || registration.argsPrefix.length > 8
      || registration.argsPrefix.some((arg) => typeof arg !== 'string' || arg.includes('\0') || arg.length > 2048)) {
      throw new TypeError('verifierRegistry contains an invalid registration');
    }
    registry.set(verifierId, Object.freeze({ executable: registration.executable, argsPrefix: [...registration.argsPrefix] }));
  }
  return registry;
}

function safeProbeEnvironment() {
  const environment = {
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  };
  for (const key of ['HOME', 'USER', 'LOGNAME', 'TMPDIR']) {
    if (typeof process.env[key] === 'string' && process.env[key].length > 0) environment[key] = process.env[key];
  }
  return environment;
}

async function runNativeProbe(args) {
  try {
    const result = await execFileAsync(NATIVE_SWIFT, [PROBE_SCRIPT, ...args], {
      cwd: '/',
      env: safeProbeEnvironment(),
      encoding: 'utf8',
      maxBuffer: 1024,
      timeout: 30000,
      windowsHide: true,
    });
    return { status: 0, token: String(result.stdout ?? '').trim() };
  } catch (error) {
    return { status: typeof error?.status === 'number' ? error.status : null, token: '' };
  }
}

async function runNativeStore(args, secretInput = null) {
  return new Promise((resolve) => {
    let settled = false;
    let output = '';
    let outputTooLarge = false;
    const child = spawn(NATIVE_SWIFT, [STORE_SCRIPT, ...args], {
      cwd: '/',
      env: safeProbeEnvironment(),
      shell: false,
      detached: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const wipeInput = () => {
      if (Buffer.isBuffer(secretInput)) secretInput.fill(0);
    };
    const finish = (status, safeOutput = '') => {
      if (settled) return;
      settled = true;
      wipeInput();
      resolve({ status, output: safeOutput });
    };
    const terminateProcessTree = () => {
      if (typeof child.pid !== 'number') return;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch { /* already exited */ }
      }
    };
    const timer = setTimeout(() => {
      terminateProcessTree();
      finish(null);
    }, 30000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (outputTooLarge) return;
      if (output.length + chunk.length > 16 * 1024) {
        outputTooLarge = true;
        output = '';
        return;
      }
      output += chunk;
    });
    child.once('error', () => {
      clearTimeout(timer);
      finish(null);
    });
    child.once('close', (status) => {
      clearTimeout(timer);
      finish(typeof status === 'number' && !outputTooLarge ? status : null, outputTooLarge ? '' : output);
    });
    if (Buffer.isBuffer(secretInput) && secretInput.length > 0) {
      child.stdin.write(secretInput, () => {
        wipeInput();
        child.stdin.end();
      });
    } else {
      child.stdin.end();
    }
  });
}

async function runNativeBoundary(args) {
  return new Promise((resolve) => {
    let settled = false;
    let output = '';
    let outputTooLarge = false;
    const child = spawn(NATIVE_SWIFT, [BOUNDARY_SCRIPT, ...args], {
      cwd: '/',
      env: safeProbeEnvironment(),
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const finish = (status, safeOutput = '') => {
      if (settled) return;
      settled = true;
      resolve({ status, output: safeOutput });
    };
    const terminateProcessTree = () => {
      if (typeof child.pid !== 'number') return;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch { /* already exited */ }
      }
    };
    const timer = setTimeout(() => {
      terminateProcessTree();
      finish(null);
    }, 30000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (outputTooLarge) return;
      if (output.length + chunk.length > 64 * 1024) {
        outputTooLarge = true;
        output = '';
        return;
      }
      output += chunk;
    });
    child.once('error', () => {
      clearTimeout(timer);
      finish(null);
    });
    child.once('close', (status) => {
      clearTimeout(timer);
      finish(typeof status === 'number' && !outputTooLarge ? status : null, outputTooLarge ? '' : output);
    });
  });
}

function invalid(code, message) {
  return Object.freeze({ ok: false, code, message });
}

export function parseMacOSKeychainReference(reference) {
  if (typeof reference !== 'string' || reference.length === 0 || /\s/.test(reference)) {
    return invalid('invalid_reference', 'Keychain reference is missing or contains whitespace.');
  }
  const match = /^keychain-ref:\/\/([^/?#:\\]+)\/([^/?#:\\]+)$/.exec(reference);
  if (!match || !SEGMENT_RE.test(match[1]) || !SEGMENT_RE.test(match[2])) {
    return invalid('invalid_reference', 'Keychain reference must match keychain-ref://<service>/<account>.');
  }
  const service = match[1];
  const account = match[2];
  if (!(service === DEFAULT_SERVICE_PREFIX || service.startsWith(`${DEFAULT_SERVICE_PREFIX}.`))) {
    return invalid('unadmitted_namespace', 'Keychain service is outside the Brain-admitted namespace.');
  }
  return Object.freeze({
    ok: true,
    reference: `keychain-ref://${service}/${account}`,
    service,
    account,
  });
}

function resultForState({ reference, service, account, storageState, diagnosticCode }) {
  const present = storageState === 'present';
  return Object.freeze({
    ok: present,
    operation: 'reference_exists',
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    adapterKind: 'os_native_store',
    reference,
    service,
    account,
    storageState,
    providerState: 'unknown',
    detailedState: present ? 'credential_present'
      : storageState === 'missing' ? 'credential_missing'
        : storageState === 'permission_denied' ? 'secret_store_locked'
          : storageState === 'unavailable' ? 'secret_store_unavailable'
            : 'unknown',
    diagnosticCode,
    containsSecrets: false,
    secretValueReturned: false,
    secretResolutionAdmitted: false,
  });
}

function classifyProbeToken(token) {
  return ALLOWED_PROBE_RESULTS.has(token) ? token : 'unknown';
}

function secretInput(value) {
  if (Buffer.isBuffer(value)) return value.length > 0 && value.length <= 64 * 1024 ? Buffer.from(value) : null;
  if (value instanceof Uint8Array) return value.length > 0 && value.length <= 64 * 1024 ? Buffer.from(value) : null;
  if (typeof value === 'string') {
    const encoded = Buffer.from(value, 'utf8');
    return encoded.length > 0 && encoded.length <= 64 * 1024 ? encoded : null;
  }
  return null;
}

function safeBoundaryString(value, maxLength) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function parseBoundaryOutput(output) {
  if (typeof output !== 'string' || output.length === 0 || output.length > 64 * 1024) return null;
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !ALLOWED_BOUNDARY_STATES.has(parsed.boundaryState)) return null;
  const safe = { boundaryState: parsed.boundaryState };
  if (ALLOWED_REASON_CODES.has(parsed.reasonCode)) safe.reasonCode = parsed.reasonCode;
  if (ALLOWED_RESULT_CODES.has(parsed.resultCode)) safe.resultCode = parsed.resultCode;
  const principal = safeBoundaryString(parsed.principal, 512);
  if (principal) safe.principal = principal;
  const principalLabel = safeBoundaryString(parsed.principalLabel, 256);
  if (principalLabel) safe.principalLabel = principalLabel;
  const providerId = safeBoundaryString(parsed.providerId, 128);
  if (providerId) safe.providerId = providerId;
  const providerCredentialType = safeBoundaryString(parsed.providerCredentialType, 128);
  if (providerCredentialType) safe.providerCredentialType = providerCredentialType;
  if (Array.isArray(parsed.scopes) && parsed.scopes.length <= 64 && parsed.scopes.every((scope) => safeBoundaryString(scope, 256))) {
    safe.scopes = [...parsed.scopes];
  }
  if (ALLOWED_SCOPE_EVIDENCE.has(parsed.scopeEvidence)) safe.scopeEvidence = parsed.scopeEvidence;
  const expiresAt = safeBoundaryString(parsed.expiresAt, 128);
  if (expiresAt) safe.expiresAt = expiresAt;
  if (ALLOWED_METADATA_SOURCES.has(parsed.expiryMetadataSource)) safe.expiryMetadataSource = parsed.expiryMetadataSource;
  if (typeof parsed.refreshAvailable === 'boolean') safe.refreshAvailable = parsed.refreshAvailable;
  if (parsed.rateLimit && typeof parsed.rateLimit === 'object' && !Array.isArray(parsed.rateLimit)) {
    const rateLimit = {};
    if (Number.isInteger(parsed.rateLimit.limit) && parsed.rateLimit.limit >= 0) rateLimit.limit = parsed.rateLimit.limit;
    if (Number.isInteger(parsed.rateLimit.remaining) && parsed.rateLimit.remaining >= 0) rateLimit.remaining = parsed.rateLimit.remaining;
    const resetAt = safeBoundaryString(parsed.rateLimit.resetAt, 128);
    if (resetAt) rateLimit.resetAt = resetAt;
    if (Number.isInteger(parsed.rateLimit.retryAfterSeconds) && parsed.rateLimit.retryAfterSeconds >= 0 && parsed.rateLimit.retryAfterSeconds <= 31536000) {
      rateLimit.retryAfterSeconds = parsed.rateLimit.retryAfterSeconds;
    }
    if (Object.keys(rateLimit).length > 0) safe.rateLimit = rateLimit;
  }
  if (parsed.transportCheck === 'stdin_only') safe.transportCheck = 'stdin_only';
  return Object.freeze(safe);
}

function parseStoreOutput(output) {
  if (typeof output !== 'string' || output.length === 0 || output.length > 16 * 1024) return null;
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !ALLOWED_STORE_OPERATIONS.has(parsed.operation)) return null;
  const safe = { operation: parsed.operation };
  if (typeof parsed.ok === 'boolean') safe.ok = parsed.ok;
  if (ALLOWED_STORE_STATES.has(parsed.storageState)) safe.storageState = parsed.storageState;
  if (ALLOWED_REASON_CODES.has(parsed.reasonCode)) safe.reasonCode = parsed.reasonCode;
  if (typeof parsed.overwrote === 'boolean') safe.overwrote = parsed.overwrote;
  if (Number.isInteger(parsed.count) && parsed.count >= 0 && parsed.count <= 1000) safe.count = parsed.count;
  if (Array.isArray(parsed.items) && parsed.items.length <= 1000) {
    safe.items = parsed.items.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const service = safeBoundaryString(item.service, 128);
      const account = safeBoundaryString(item.account, 128);
      const label = safeBoundaryString(item.label, 256);
      if (!service || !account) return [];
      return [{ service, account, ...(label ? { label } : {}) }];
    });
  }
  return Object.freeze(safe);
}

async function checkAvailability(runProbe) {
  if (process.platform !== 'darwin') {
    return Object.freeze({ ok: false, storageState: 'unavailable', diagnosticCode: 'unsupported_platform' });
  }
  if (!fs.existsSync(NATIVE_SWIFT) || !fs.existsSync(PROBE_SCRIPT) || !fs.existsSync(STORE_SCRIPT) || !fs.existsSync(BOUNDARY_SCRIPT)) {
    return Object.freeze({ ok: false, storageState: 'unavailable', diagnosticCode: 'native_probe_unavailable' });
  }
  const result = await runProbe(['--availability']);
  if (result.status !== 0 || classifyProbeToken(result.token) !== 'available') {
    return Object.freeze({ ok: false, storageState: 'unavailable', diagnosticCode: 'native_probe_unavailable' });
  }
  return Object.freeze({ ok: true, storageState: 'available', diagnosticCode: 'native_keychain_available' });
}

function createMacOSKeychainAdapterInternal({ runProbe, runBoundary, runStoreCommand = runNativeStore }) {
  if (typeof runProbe !== 'function') throw new TypeError('runProbe must be a function');
  if (typeof runBoundary !== 'function') throw new TypeError('runBoundary must be a function');
  if (typeof runStoreCommand !== 'function') throw new TypeError('runStoreCommand must be a function');
  const servicePrefix = DEFAULT_SERVICE_PREFIX;
  const registeredVerifiers = normalizeVerifierRegistry(defaultVerifierRegistry());

  const describe = () => Object.freeze({
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    adapterKind: 'os_native_store',
    platform: 'darwin',
    referenceScheme: MACOS_KEYCHAIN_REFERENCE_SCHEME,
    serviceNamespace: servicePrefix,
    physicalStore: MACOS_KEYCHAIN_PHYSICAL_STORE,
    hostScope: 'host_local',
    synchronization: 'disabled',
    accessibility: 'when_unlocked_this_device_only',
    accessControlModel: 'native_security_framework_with_user_approval',
    capabilities: [...MACOS_KEYCHAIN_CAPABILITIES],
    unadmittedCapabilities: [...MACOS_KEYCHAIN_UNADMITTED_CAPABILITIES],
    mutationMode: 'approval_gated',
    containsSecrets: false,
    secretValueReturned: false,
  });

  const inspectReference = async (reference) => {
    const parsed = parseMacOSKeychainReference(reference);
    if (!parsed.ok) return Object.freeze({ ...parsed, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, containsSecrets: false, secretValueReturned: false });

    const availability = await checkAvailability(runProbe);
    if (!availability.ok) return resultForState({ ...parsed, ...availability });

    const probe = await runProbe([parsed.service, parsed.account]);
    const storageState = classifyProbeToken(probe.status === 0 ? probe.token : 'unknown');
    if (storageState === 'present') return resultForState({ ...parsed, storageState, diagnosticCode: 'keychain_item_present' });
    if (storageState === 'missing') return resultForState({ ...parsed, storageState, diagnosticCode: 'keychain_item_missing' });
    if (storageState === 'permission_denied') return resultForState({ ...parsed, storageState, diagnosticCode: 'keychain_access_denied' });
    if (storageState === 'unavailable') return resultForState({ ...parsed, storageState, diagnosticCode: 'keychain_unavailable' });
    return resultForState({ ...parsed, storageState: 'unknown', diagnosticCode: 'keychain_probe_unknown' });
  };

  const invokeBoundedVerification = async ({ reference, verifierId, verifierExecutable, verifierArgs = [] }) => {
    const parsed = parseMacOSKeychainReference(reference);
    if (!parsed.ok) return Object.freeze({ ...parsed, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'unknown', containsSecrets: false, secretValueReturned: false });
    if (typeof verifierExecutable !== 'string' || !verifierExecutable.startsWith('/') || verifierExecutable.includes('\0') || verifierExecutable.length > 1024) {
      return Object.freeze({ ok: false, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'unknown', reasonCode: 'invalid_verifier_command', containsSecrets: false, secretValueReturned: false });
    }
    if (!Array.isArray(verifierArgs) || verifierArgs.length > 32 || verifierArgs.some((arg) => typeof arg !== 'string' || arg.includes('\0') || arg.length > 2048)) {
      return Object.freeze({ ok: false, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'unknown', reasonCode: 'invalid_verifier_command', containsSecrets: false, secretValueReturned: false });
    }
    const registration = registeredVerifiers.get(verifierId);
    if (!registration
      || registration.executable !== verifierExecutable
      || verifierArgs.length < registration.argsPrefix.length
      || registration.argsPrefix.some((arg, index) => verifierArgs[index] !== arg)) {
      return Object.freeze({ ok: false, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'unknown', reasonCode: 'invalid_verifier_command', containsSecrets: false, secretValueReturned: false });
    }
    const availability = await checkAvailability(runProbe);
    if (!availability.ok) return Object.freeze({ ...availability, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'vault_unavailable', containsSecrets: false, secretValueReturned: false });
    const result = await runBoundary([parsed.service, parsed.account, verifierExecutable, JSON.stringify(verifierArgs)]);
    if (result?.status !== 0) return Object.freeze({ ok: false, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'unknown', reasonCode: 'verifier_output_rejected', containsSecrets: false, secretValueReturned: false });
    const safeResult = parseBoundaryOutput(result?.output);
    if (!safeResult) return Object.freeze({ ok: false, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, boundaryState: 'unknown', reasonCode: 'verifier_output_rejected', containsSecrets: false, secretValueReturned: false });
    return Object.freeze({ ok: safeResult.boundaryState === 'provider_result', operation: 'bounded_consume', adapterId: MACOS_KEYCHAIN_ADAPTER_ID, ...safeResult, containsSecrets: false, secretValueReturned: false });
  };

  const mutationDenied = (operation, reasonCode = 'mutation_approval_required') => Object.freeze({
    ok: false,
    operation,
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    reasonCode,
    containsSecrets: false,
    secretValueReturned: false,
  });

  const approved = (options) => options?.operatorConfirmed === true;

  const runStore = async (operation, parsed, input = null) => {
    const availability = await checkAvailability(runProbe);
    if (!availability.ok) return Object.freeze({ ...availability, operation, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, containsSecrets: false, secretValueReturned: false });
    let result;
    try {
      result = await runStoreCommand([operation, parsed.service, parsed.account, ...(operation === 'create' ? [parsed.label] : [])], input);
    } finally {
      if (Buffer.isBuffer(input)) input.fill(0);
    }
    const safeResult = parseStoreOutput(result?.output);
    if (!safeResult) {
      return Object.freeze({ ok: false, operation, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, storageState: 'unknown', reasonCode: 'native_store_result_rejected', containsSecrets: false, secretValueReturned: false });
    }
    return Object.freeze({ ok: result?.status === 0 && safeResult.ok === true, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, ...safeResult, containsSecrets: false, secretValueReturned: false });
  };

  const create = async (reference, { secret, label = 'Brain credential', operatorConfirmed = false } = {}) => {
    const parsed = parseMacOSKeychainReference(reference);
    if (!parsed.ok) return Object.freeze({ ...parsed, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, containsSecrets: false, secretValueReturned: false });
    if (!approved({ operatorConfirmed })) return mutationDenied('create');
    const safeLabel = safeBoundaryString(label, 256);
    const input = secretInput(secret);
    if (!safeLabel || !input) return mutationDenied('create', 'invalid_mutation_input');
    return runStore('create', { ...parsed, label: safeLabel }, input);
  };

  const update = async (reference, { secret, operatorConfirmed = false } = {}) => {
    const parsed = parseMacOSKeychainReference(reference);
    if (!parsed.ok) return Object.freeze({ ...parsed, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, containsSecrets: false, secretValueReturned: false });
    if (!approved({ operatorConfirmed })) return mutationDenied('update');
    const input = secretInput(secret);
    if (!input) return mutationDenied('update', 'invalid_mutation_input');
    return runStore('update', parsed, input);
  };

  const remove = async (reference, { operatorConfirmed = false } = {}) => {
    const parsed = parseMacOSKeychainReference(reference);
    if (!parsed.ok) return Object.freeze({ ...parsed, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, containsSecrets: false, secretValueReturned: false });
    if (!approved({ operatorConfirmed })) return mutationDenied('delete');
    return runStore('delete', parsed);
  };

  const inspectNamespace = async () => {
    const availability = await checkAvailability(runProbe);
    if (!availability.ok) return Object.freeze({ ...availability, operation: 'inventory', adapterId: MACOS_KEYCHAIN_ADAPTER_ID, containsSecrets: false, secretValueReturned: false });
    const result = await runStoreCommand(['inventory', servicePrefix]);
    const safeResult = parseStoreOutput(result?.output);
    if (result?.status !== 0 || !safeResult) return Object.freeze({ ok: false, operation: 'inventory', adapterId: MACOS_KEYCHAIN_ADAPTER_ID, storageState: 'unknown', reasonCode: 'native_store_result_rejected', containsSecrets: false, secretValueReturned: false });
    return Object.freeze({ ok: safeResult.ok === true, adapterId: MACOS_KEYCHAIN_ADAPTER_ID, ...safeResult, containsSecrets: false, secretValueReturned: false });
  };

  const read = async (options) => invokeBoundedVerification(options);

  const checkAdapterAvailability = () => checkAvailability(runProbe);

  const resolveForBoundProcess = async () => Object.freeze({
    ok: false,
    operation: 'resolve_for_bound_process',
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    admitted: false,
    reasonCode: 'resolution_not_admitted_in_pilot',
    containsSecrets: false,
    secretValueReturned: false,
  });

  return Object.freeze({
    adapterId: MACOS_KEYCHAIN_ADAPTER_ID,
    capabilities: () => [...MACOS_KEYCHAIN_CAPABILITIES],
    describe,
    checkAvailability: checkAdapterAvailability,
    inspectReference,
    invokeBoundedVerification,
    read,
    inspectNamespace,
    create,
    update,
    delete: remove,
    resolveForBoundProcess,
  });
}

export function createMacOSKeychainAdapter() {
  return createMacOSKeychainAdapterInternal({ runProbe: runNativeProbe, runBoundary: runNativeBoundary });
}

export function createMacOSKeychainAdapterForTesting({ runProbe = runNativeProbe, runBoundary = runNativeBoundary, runStoreCommand = runNativeStore } = {}) {
  return createMacOSKeychainAdapterInternal({ runProbe, runBoundary, runStoreCommand });
}

export function redactMacOSKeychainResult(result) {
  if (!result || typeof result !== 'object') return Object.freeze({ ok: false, code: 'invalid_result' });
  return Object.freeze({
    ok: result.ok === true,
    operation: result.operation ?? 'unknown',
    adapterId: result.adapterId ?? MACOS_KEYCHAIN_ADAPTER_ID,
    storageState: result.storageState ?? 'unknown',
    providerState: result.providerState ?? 'unknown',
    detailedState: result.detailedState ?? 'unknown',
    diagnosticCode: result.diagnosticCode ?? result.reasonCode ?? 'unknown',
    containsSecrets: false,
    secretValueReturned: false,
  });
}
