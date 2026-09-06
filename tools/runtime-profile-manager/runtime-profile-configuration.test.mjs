import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadJson } from '../context-learning/context-learning-core.mjs';
import { createCodexCliRuntimeProfileAdapter } from './codex-cli-adapter.mjs';
import {
  createRuntimeProfilePlan,
  createRuntimeProfileConfigurationPlan,
  executeRuntimeProfileConfiguration,
} from './runtime-profile-manager-core.mjs';
import {
  configurationOwnershipPath,
  inspectRuntimeProfileConfiguration,
} from './runtime-profile-configuration.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
const profileA = 'runtime_profile:provider-a.01.cli';
const profileB = 'runtime_profile:provider-a.02.cli';

function context(profilesRoot, extra = {}) {
  return { profilesRoot, routeOwnerRef: 'native-direct', ...extra };
}

function createProfile(adapter, profilesRoot, profileId) {
  const runtimeRoot = adapter.resolveRuntimeRoot(catalog.runtimeProfiles.find((profile) => profile.runtimeProfileId === profileId), { profilesRoot });
  adapter.createRuntimeRoot({ root: runtimeRoot });
  return runtimeRoot;
}

test('materializes one owner-only non-secret config per profile root', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-config-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const rootA = createProfile(adapter, profilesRoot, profileA);
    const rootB = createProfile(adapter, profilesRoot, profileB);
    const planA = createRuntimeProfileConfigurationPlan({ catalog, profileId: profileA, adapter, context: context(profilesRoot) });
    const planB = createRuntimeProfileConfigurationPlan({ catalog, profileId: profileB, adapter, context: context(profilesRoot) });
    assert.equal(planA.status, 'READY');
    assert.equal(planB.status, 'READY');
    const resultA = executeRuntimeProfileConfiguration({ plan: planA, catalog, adapter, context: context(profilesRoot) });
    const resultB = executeRuntimeProfileConfiguration({ plan: planB, catalog, adapter, context: context(profilesRoot) });
    assert.equal(resultA.status, 'OK');
    assert.equal(resultB.status, 'OK');
    assert.notEqual(planA.artifact.path, planB.artifact.path);
    assert.equal(fs.statSync(planA.artifact.path).mode & 0o777, 0o600);
    assert.equal(fs.statSync(planA.artifact.ownershipMetadataPath).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(planA.artifact.path, 'utf8'), /provider-a\.01\.cli/);
    assert.doesNotMatch(fs.readFileSync(planA.artifact.path, 'utf8'), /access[_-]?token|refresh[_-]?token|password/i);
    assert.equal(fs.existsSync(path.join(rootA, 'auth.json')), false);
    assert.equal(fs.existsSync(path.join(rootB, 'auth.json')), false);
    const owned = inspectRuntimeProfileConfiguration({ artifact: planA.artifact });
    assert.equal(owned.state, 'owned');
    assert.equal(owned.configContentsRead, false);
    assert.equal(configurationOwnershipPath(planA.artifact.path), planA.artifact.ownershipMetadataPath);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('ownership sidecar revision turns post-materialization drift into a conflict', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-config-drift-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const runtimeRoot = createProfile(adapter, profilesRoot, profileA);
    const contextValue = context(profilesRoot);
    const plan = createRuntimeProfileConfigurationPlan({ catalog, profileId: profileA, adapter, context: contextValue });
    const result = executeRuntimeProfileConfiguration({ plan, catalog, adapter, context: contextValue });
    fs.appendFileSync(result.artifact.path, '# external drift\n');
    const inspected = inspectRuntimeProfileConfiguration({ artifact: result.artifact });
    assert.equal(inspected.state, 'conflicted');
    assert.ok(inspected.reasons.includes('config_semantic_state_drifted'));
    const replanned = createRuntimeProfileConfigurationPlan({ catalog, profileId: profileA, adapter, context: contextValue });
    assert.equal(replanned.status, 'BLOCKED');
    assert.ok(replanned.reasons.includes('config_semantic_state_drifted'));
    assert.equal(fs.existsSync(path.join(runtimeRoot, 'auth.json')), false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('existing unowned config and default shared root are blocked', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-config-conflict-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const rootA = createProfile(adapter, profilesRoot, profileA);
    const configPath = path.join(rootA, 'config.toml');
    fs.writeFileSync(configPath, 'cli_auth_credentials_store = "file"\n', { mode: 0o600 });
    const conflict = createRuntimeProfileConfigurationPlan({ catalog, profileId: profileA, adapter, context: context(profilesRoot) });
    assert.equal(conflict.status, 'BLOCKED');
    assert.ok(conflict.reasons.includes('existing_config_has_no_brain_ownership_metadata'));

    const defaultRoot = path.join(os.homedir(), '.codex');
    const defaultProfile = { ...catalog.runtimeProfiles.find((profile) => profile.runtimeProfileId === profileA), runtimeProfileId: profileA };
    const defaultPlan = createRuntimeProfileConfigurationPlan({
      catalog: { ...catalog, runtimeProfiles: [defaultProfile] },
      profileId: profileA,
      adapter: Object.freeze({ ...adapter, resolveRuntimeRoot: () => defaultRoot }),
      context: context(profilesRoot),
    });
    assert.equal(defaultPlan.status, 'BLOCKED');
    assert.ok(defaultPlan.reasons.includes('shared_default_root_is_legacy_maintenance_only'));
    const defaultCreatePlan = createRuntimeProfilePlan({
      catalog: { ...catalog, runtimeProfiles: [defaultProfile] },
      profileId: profileA,
      adapter: Object.freeze({ ...adapter, resolveRuntimeRoot: () => defaultRoot }),
      context: context(profilesRoot),
    });
    assert.equal(defaultCreatePlan.status, 'BLOCKED');
    assert.ok(defaultCreatePlan.reasons.includes('shared_default_root_is_legacy_maintenance_only'));
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('resource ownership probe is limited to the selected profile paths', () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-runtime-resource-scope-'));
  try {
    const observed = [];
    const adapter = createCodexCliRuntimeProfileAdapter({
      run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }),
      resourceOwnerProbe: (paths) => {
        observed.push(paths);
        return { state: 'none', owners: [], inspectedPaths: paths };
      },
    });
    const rootA = createProfile(adapter, profilesRoot, profileA);
    adapter.inspectProcessOwnership({
      profile: catalog.runtimeProfiles.find((profile) => profile.runtimeProfileId === profileA),
      root: rootA,
      context: context(profilesRoot),
    });
    assert.equal(observed.length, 1);
    assert.ok(observed[0].every((file) => file.startsWith(rootA)));
    assert.equal(observed[0].some((file) => file === path.join(os.homedir(), '.codex')), false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});
