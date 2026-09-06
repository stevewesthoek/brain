import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadJson } from './context-learning/context-learning-core.mjs';
import { runRuntimeProfileManager } from './runtime-profile-manager.mjs';
import {
  buildLaunchPlan,
  buildLoginHandoff,
  clearStaleRuntimeProfileLease,
  createRuntimeProfileConfigurationPlan,
  createRuntimeProfilePlan,
  doctorRuntimeProfile,
  executeLaunchPlan,
  executeRuntimeProfileConfiguration,
  executeRuntimeProfileCreation,
  listRuntimeProfiles,
} from './runtime-profile-manager/runtime-profile-manager-core.mjs';
import { createCodexCliRuntimeProfileAdapter } from './runtime-profile-manager/codex-cli-adapter.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
const primaryId = 'runtime_profile:provider-a.primary.cli';
const secondaryId = 'runtime_profile:provider-a.secondary.cli';

function makeContext(profilesRoot, extra = {}) {
  return {
    profilesRoot,
    routeOwnerRef: 'brain:runtime-profile-route-intent',
    // Unit tests that are not specifically testing process-owner discovery must
    // not depend on host lsof availability. Production keeps the adapter's
    // fail-closed defaultResourceOwnerProbe; tests inject an observed-empty
    // owner set unless a case explicitly overrides it.
    resourceOwnerProbe: () => ({ state: 'observed', owners: [], source: 'synthetic_test_probe' }),
    ...extra,
  };
}

test('list is account-agnostic, exposes distinct roots, and keeps MCP sessions separate', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-list-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const result = listRuntimeProfiles({ catalog: fixture, adapter, context: makeContext(profilesRoot) });
    assert.equal(result.status, 'OK');
    assert.equal(result.profileCount, 2);
    assert.notEqual(result.profiles[0].runtimeRoot, result.profiles[1].runtimeRoot);
    assert.equal(result.profiles[0].account.accountId, 'account:provider-a.primary');
    assert.equal(result.profiles[0].sessions.some((session) => session.sessionKind === 'mcp_oauth_authorization'), true);
    assert.equal(result.redaction.authContentsRead, false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('create only provisions an owner-only empty root and never auth state', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-create-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter();
    const context = makeContext(profilesRoot);
    const plan = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(plan.status, 'READY');
    const result = executeRuntimeProfileCreation({ plan, adapter, context });
    assert.equal(result.status, 'OK');
    const rootPath = result.runtimeRoot;
    assert.equal(fs.statSync(rootPath).mode & 0o777, 0o700);
    assert.equal(fs.existsSync(path.join(rootPath, 'auth.json')), false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('doctor allows a safe file-mode bootstrap but blocks keyring and unproven account use', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-doctor-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 0, stdout: 'Logged in', stderr: '' }) });
    const context = makeContext(profilesRoot);
    const create = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileCreation({ plan: create, adapter, context });
    const primary = await doctorRuntimeProfile({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(primary.status, 'OK');
    assert.equal(primary.readiness, 'bootstrap_only');
    assert.ok(primary.warnings.includes('account_use_blocked_until_identity_and_isolation_are_proven'));

    const secondaryCreate = createRuntimeProfilePlan({ catalog: fixture, profileId: secondaryId, adapter, context });
    assert.equal(secondaryCreate.status, 'BLOCKED');
    adapter.createRuntimeRoot({ root: secondaryCreate.runtimeRoot, context });
    const secondary = await doctorRuntimeProfile({ catalog: fixture, profileId: secondaryId, adapter, context });
    assert.equal(secondary.status, 'NOT_OK');
    assert.ok(secondary.reasons.includes('unsupported_storage_mode_for_deterministic_cli_isolation'));
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('login is a human handoff and does not execute or copy auth', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-login-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const context = makeContext(profilesRoot);
    const create = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileCreation({ plan: create, adapter, context });
    const config = createRuntimeProfileConfigurationPlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileConfiguration({ plan: config, catalog: fixture, adapter, context });
    const result = await buildLoginHandoff({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(result.status, 'READY');
    assert.equal(result.mutation, 'human_interactive_only');
    assert.equal(result.handoff.managerDoesNotExecute, true);
    assert.equal(result.managerActions.includes('no_auth_copy'), true);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('launch uses child-only CODEX_HOME and requires explicit bootstrap confirmation', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-launch-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const context = makeContext(profilesRoot);
    const create = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileCreation({ plan: create, adapter, context });
    const configPlan = createRuntimeProfileConfigurationPlan({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(configPlan.status, 'READY');
    executeRuntimeProfileConfiguration({ plan: configPlan, catalog: fixture, adapter, context });
    const blocked = await buildLaunchPlan({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(blocked.status, 'BLOCKED');
    assert.ok(blocked.reasons.includes('bootstrap_flag_required_before_identity_proof'));
    const plan = await buildLaunchPlan({ catalog: fixture, profileId: primaryId, adapter, context, bootstrap: true });
    assert.equal(plan.status, 'READY');
    let captured;
    const child = { pid: 42424, once: () => {} };
    const started = executeLaunchPlan({ plan, adapter, context, spawnProcess: (executable, args, options) => { captured = { executable, args, options }; return child; } });
    assert.equal(started.status, 'STARTED');
    assert.equal(captured.options.env.CODEX_HOME, plan.runtimeRoot);
    assert.equal(captured.options.env.BRAIN_RUNTIME_PROFILE_ID, primaryId);
    assert.equal(captured.options.env.CODEX_HOME !== process.env.CODEX_HOME, true);
    assert.equal(captured.options.shell, false);
    assert.equal(started.redaction.authContentsRead, false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('duplicate runtime roots and route mutation fail closed', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-gates-'));
  try {
    const base = createCodexCliRuntimeProfileAdapter();
    const adapter = Object.freeze({
      ...base,
      resolveRuntimeRoot: () => path.join(profilesRoot, 'same-root'),
    });
    const result = listRuntimeProfiles({ catalog: fixture, adapter, context: makeContext(profilesRoot) });
    assert.equal(result.status, 'NOT_OK');
    assert.ok(result.errors.some((error) => error.startsWith('duplicate_runtime_root:')));

    const routed = await doctorRuntimeProfile({ catalog: fixture, profileId: primaryId, adapter: base, context: makeContext(profilesRoot, { routeMutationRequested: true }) });
    assert.equal(routed.status, 'NOT_OK');
    assert.ok(routed.reasons.includes('route_mutation_forbidden'));
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('doctor rejects open runtime-root or auth-file permissions', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-security-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const context = makeContext(profilesRoot);
    const create = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileCreation({ plan: create, adapter, context });
    fs.chmodSync(create.runtimeRoot, 0o755);
    const openRoot = await doctorRuntimeProfile({ catalog: fixture, profileId: primaryId, adapter, context, probeAuthentication: false });
    assert.equal(openRoot.status, 'NOT_OK');
    assert.ok(openRoot.reasons.includes('runtime_root_directory_permissions_too_open'));

    fs.chmodSync(create.runtimeRoot, 0o700);
    fs.writeFileSync(path.join(create.runtimeRoot, 'auth.json'), '{ synthetic test marker only }\n', { mode: 0o644 });
    fs.chmodSync(path.join(create.runtimeRoot, 'auth.json'), 0o644);
    const openAuth = await doctorRuntimeProfile({ catalog: fixture, profileId: primaryId, adapter, context, probeAuthentication: false });
    assert.equal(openAuth.status, 'NOT_OK');
    assert.ok(openAuth.reasons.includes('auth_file_permissions_or_owner_invalid'));
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('CLI surface consumes the shared catalog and returns a machine-checkable status', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-cli-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const result = await runRuntimeProfileManager([
      'list',
      '--catalog', path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'),
      '--profiles-root', profilesRoot,
    ], { catalog: fixture, adapter });
    assert.equal(result.status, 'OK');
    assert.equal(result.profileCount, 2);
    assert.equal(typeof result.redaction.authContentsRead, 'boolean');
    const created = await runRuntimeProfileManager([
      'create',
      '--catalog', path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'),
      '--profiles-root', profilesRoot,
      '--profile', primaryId,
      '--execute',
      '--confirm',
    ], { catalog: fixture, adapter });
    assert.equal(created.status, 'OK');
    const materialized = await runRuntimeProfileManager([
      'materialize-config',
      '--catalog', path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'),
      '--profiles-root', profilesRoot,
      '--profile', primaryId,
      '--execute',
      '--confirm',
    ], { catalog: fixture, adapter });
    assert.equal(materialized.status, 'OK');
    assert.equal(materialized.verification.state, 'owned');
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('CLI enrollment and capability commands are account-agnostic and non-mutating', async () => {
  const before = JSON.stringify(fixture);
  const capabilities = await runRuntimeProfileManager([
    'capabilities',
    '--catalog', path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'),
  ], { catalog: fixture, adapter: createCodexCliRuntimeProfileAdapter() });
  assert.equal(capabilities.evidenceOnly, true);
  assert.equal(capabilities.liveOAuthPerformed, false);
  assert.ok(capabilities.rows.some((row) => row.surfaceId === 'codex-cli'));

  const enrollment = await runRuntimeProfileManager([
    'prepare-account',
    '--catalog', path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'),
    '--surface', 'codex-cli',
    '--provider', 'provider-a',
    '--identity-ref', 'opaque-ref://provider-a/new-account',
  ], { catalog: fixture, adapter: createCodexCliRuntimeProfileAdapter() });
  assert.equal(enrollment.status, 'candidate_prepared');
  assert.equal(enrollment.catalogMutation.performed, false);
  assert.equal(enrollment.officialLogin.managerExecutes, false);
  assert.equal(enrollment.redaction.rawIdentityValueReturned, false);
  assert.equal(JSON.stringify(fixture), before);
  assert.doesNotMatch(JSON.stringify(enrollment), /@/);
});

test('stale lease recovery removes only exact dead-process metadata', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-lease-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter();
    const context = makeContext(profilesRoot);
    const create = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileCreation({ plan: create, adapter, context });
    adapter.writeProcessLease({ root: create.runtimeRoot, profileId: primaryId, pid: 2147483647, startedAt: new Date().toISOString() });
    const plan = clearStaleRuntimeProfileLease({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(plan.status, 'READY');
    assert.equal(fs.existsSync(adapter.processLeasePath({ root: create.runtimeRoot })), true);
    const result = clearStaleRuntimeProfileLease({ catalog: fixture, profileId: primaryId, adapter, context, execute: true });
    assert.equal(result.status, 'OK');
    assert.equal(result.cleared.reason, 'stale_process_lease_removed');
    assert.equal(fs.existsSync(adapter.processLeasePath({ root: create.runtimeRoot })), false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('another selected profile remains operable while one profile owns its exact runtime lease', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-concurrency-'));
  try {
    const concurrencyCatalog = structuredClone(fixture);
    for (const profile of concurrencyCatalog.runtimeProfiles) {
      profile.authenticationStorage = {
        ...profile.authenticationStorage,
        mode: 'file',
        locationKind: 'codex_home_auth_file',
      };
    }
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 0, stdout: 'Logged in', stderr: '' }) });
    const context = makeContext(profilesRoot);
    for (const profileId of [primaryId, secondaryId]) {
      const create = createRuntimeProfilePlan({ catalog: concurrencyCatalog, profileId, adapter, context });
      executeRuntimeProfileCreation({ plan: create, adapter, context });
      const config = createRuntimeProfileConfigurationPlan({ catalog: concurrencyCatalog, profileId, adapter, context });
      executeRuntimeProfileConfiguration({ plan: config, catalog: concurrencyCatalog, adapter, context });
    }
    const profileA = concurrencyCatalog.runtimeProfiles.find((profile) => profile.runtimeProfileId === primaryId);
    const rootA = adapter.resolveRuntimeRoot(profileA, context);
    adapter.writeProcessLease({ root: rootA, profileId: primaryId, pid: process.pid, startedAt: new Date().toISOString() });
    const profileBDoctor = await doctorRuntimeProfile({ catalog: concurrencyCatalog, profileId: secondaryId, adapter, context });
    assert.equal(profileBDoctor.status, 'OK');
    assert.equal(profileBDoctor.process.state, 'none');
    assert.equal(profileBDoctor.configuration.state, 'owned');
    assert.equal(profileBDoctor.route.mutation, 'forbidden');
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('native profile route remains preserved when the optional WebGPT bridge is unavailable', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-profile-route-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 0, stdout: 'Logged in', stderr: '' }) });
    const context = makeContext(profilesRoot, { webGptBridgeStatus: 'unavailable' });
    const create = createRuntimeProfilePlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileCreation({ plan: create, adapter, context });
    const config = createRuntimeProfileConfigurationPlan({ catalog: fixture, profileId: primaryId, adapter, context });
    executeRuntimeProfileConfiguration({ plan: config, catalog: fixture, adapter, context });
    const doctor = await doctorRuntimeProfile({ catalog: fixture, profileId: primaryId, adapter, context });
    assert.equal(doctor.status, 'OK');
    assert.equal(doctor.route.state, 'preserved');
    assert.equal(doctor.route.mutation, 'forbidden');
    assert.equal(doctor.configuration.artifact.routeBinding.mode, 'direct_native');
    assert.equal(doctor.configuration.artifact.routeBinding.providerRef, 'openai');
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});
