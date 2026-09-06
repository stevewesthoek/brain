import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadJson } from './context-learning/context-learning-core.mjs';
import { runPilot } from './codex-cli-pilot.mjs';
import { createCodexCliRuntimeProfileAdapter } from './runtime-profile-manager/codex-cli-adapter.mjs';
import {
  createRuntimeProfileConfigurationPlan,
  executeRuntimeProfileConfiguration,
} from './runtime-profile-manager/runtime-profile-manager-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'));
const selectedProfiles = catalog.runtimeProfiles.map((profile) => profile.runtimeProfileId).sort();

function makeContext(profilesRoot) {
  return {
    profilesRoot,
    routeOwnerRef: 'application:codex-web-gpt',
    routeMutationRequested: false,
    cwd: root,
  };
}

function provisionAuthenticatedRoots(adapter, profilesRoot, sourceCatalog = catalog) {
  for (const profile of sourceCatalog.runtimeProfiles.filter((entry) => entry.profileKind === 'cli')) {
    const profileRoot = adapter.resolveRuntimeRoot(profile, { profilesRoot });
    fs.mkdirSync(profileRoot, { recursive: true, mode: 0o700 });
    fs.chmodSync(profileRoot, 0o700);
    fs.writeFileSync(path.join(profileRoot, 'auth.json'), 'synthetic test marker only\n', { mode: 0o600 });
    fs.chmodSync(path.join(profileRoot, 'auth.json'), 0o600);
    const configPlan = createRuntimeProfileConfigurationPlan({
      catalog: sourceCatalog,
      profileId: profile.runtimeProfileId,
      adapter,
      context: makeContext(profilesRoot),
    });
    assert.equal(configPlan.status, 'READY');
    executeRuntimeProfileConfiguration({ plan: configPlan, catalog: sourceCatalog, adapter, context: makeContext(profilesRoot) });
  }
  return adapter;
}

test('pilot plan selects a dynamic collection and keeps the canonical catalog separate', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-cli-pilot-plan-'));
  try {
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const report = await runPilot(['plan', '--profiles', selectedProfiles.join(','), '--output', path.join(profilesRoot, 'plan.json')], { catalog, adapter, context: makeContext(profilesRoot) });
    assert.equal(report.status, 'OK');
    assert.equal(report.catalog.candidateOnly, true);
    assert.equal(report.catalog.canonicalCatalogMutated, false);
    assert.equal(report.evidence.rootsDistinct, true);
    assert.equal(report.evidence.targetScope, 'profile_scoped');
    assert.equal(report.evidence.sharedDefaultRootPolicy.mutation, 'forbidden');
    assert.equal(report.controls.globalProcessProbeUsed, false);
    assert.equal(report.controls.authContentsRead, false);
    assert.deepEqual(report.identity.selectedProfiles, selectedProfiles);
    assert.deepEqual(report.accountMapping.preferredAccountIds, ['account:openai.personal.01']);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('unrelated global process context does not block an isolated collection plan', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-cli-pilot-plan-context-'));
  try {
    const context = {
      ...makeContext(profilesRoot),
      protectedProcessProbe: () => ({ state: 'not_quiescent', protectedProcessClasses: ['codex'], protectedProcessClassCount: 1 }),
    };
    const adapter = createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 1, stdout: 'not logged in', stderr: '' }) });
    const report = await runPilot(['plan', '--profiles', selectedProfiles.join(',')], { catalog, adapter, context });
    assert.equal(report.status, 'OK');
    assert.equal(report.controls.globalProcessProbeUsed, false);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('collection acceptance remains NOT_OK until every selected profile is attested', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-cli-pilot-acceptance-'));
  try {
    const adapter = provisionAuthenticatedRoots(
      createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 0, stdout: 'Logged in', stderr: '' }) }),
      profilesRoot,
    );
    const context = makeContext(profilesRoot);
    const pending = await runPilot(['acceptance', '--profiles', selectedProfiles.join(',')], { catalog, adapter, context });
    assert.equal(pending.status, 'NOT_OK');
    assert.ok(pending.reasons.includes('operator_attestation_required_for_each_selected_profile'));
    assert.equal(pending.evidence.profileIsolationProven, false);
    assert.equal(pending.evidence.persistence.complexity, 'O(N)');
    assert.deepEqual(pending.evidence.sequence.map((entry) => entry.runtimeProfileId), selectedProfiles);

    const accepted = await runPilot([
      'acceptance',
      '--profiles', selectedProfiles.join(','),
      ...selectedProfiles.flatMap((profileId) => ['--attest-profile', profileId]),
    ], { catalog, adapter, context });
    assert.equal(accepted.status, 'OK');
    assert.equal(accepted.evidence.profileIsolationProven, true);
    assert.equal(accepted.evidence.persistence.checkCount, selectedProfiles.length);
    assert.deepEqual(accepted.identity.attestedProfiles, selectedProfiles);
    assert.equal(accepted.controls.loginExecuted, false);
    assert.equal(accepted.controls.authCopied, false);
    assert.deepEqual(accepted.accountMapping.preferredAccountIds, ['account:openai.personal.01']);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('incremental new-account acceptance uses existing/new/existing linear verification', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-cli-pilot-incremental-'));
  try {
    const adapter = provisionAuthenticatedRoots(
      createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 0, stdout: 'Logged in', stderr: '' }) }),
      profilesRoot,
    );
    const context = makeContext(profilesRoot);
    const report = await runPilot([
      'acceptance',
      '--profiles', selectedProfiles.join(','),
      '--new-account-profile', selectedProfiles[1],
      ...selectedProfiles.flatMap((profileId) => ['--attest-profile', profileId]),
    ], { catalog, adapter, context });
    assert.equal(report.status, 'OK');
    assert.equal(report.evidence.persistence.strategy, 'incremental-new-account');
    assert.equal(report.evidence.persistence.checkCount, 3);
    assert.deepEqual(report.evidence.sequence.map((entry) => entry.phase), [
      'verify_existing_profiles_before_new_account',
      'verify_new_account_profile',
      'recheck_existing_profiles_after_new_account',
    ]);
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});

test('collection launch and finalize consume profile-keyed reports without fixed pair arguments', async () => {
  const profilesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-cli-pilot-finalize-'));
  const acceptancePath = path.join(profilesRoot, 'acceptance.json');
  const launchPaths = [];
  try {
    const adapter = provisionAuthenticatedRoots(
      createCodexCliRuntimeProfileAdapter({ run: () => ({ status: 0, stdout: 'Logged in', stderr: '' }) }),
      profilesRoot,
    );
    const context = makeContext(profilesRoot);
    await runPilot([
      'acceptance',
      '--profiles', selectedProfiles.join(','),
      ...selectedProfiles.flatMap((profileId) => ['--attest-profile', profileId]),
      '--output', acceptancePath,
    ], { catalog, adapter, context });
    for (const profileId of selectedProfiles) {
      const launchPath = path.join(profilesRoot, `${profileId.replaceAll(':', '_')}.json`);
      launchPaths.push(launchPath);
      const launch = await runPilot(['launch-check', '--profile', profileId, '--acceptance', acceptancePath, '--output', launchPath], { catalog, adapter, context });
      assert.equal(launch.status, 'OK');
      assert.equal(launch.evidence.launchCheck.runtimeProfileId, profileId);
    }
    const final = await runPilot([
      'finalize',
      '--acceptance', acceptancePath,
      ...launchPaths.flatMap((launchPath) => ['--launch-check', launchPath]),
    ], { catalog, adapter, context });
    assert.equal(final.status, 'OK');
    assert.equal(final.evidence.sequentialLaunch.profiles.length, selectedProfiles.length);
    assert.equal(final.evidence.concurrency, 'not_tested_and_not_authorized');
  } finally {
    fs.rmSync(profilesRoot, { recursive: true, force: true });
  }
});
