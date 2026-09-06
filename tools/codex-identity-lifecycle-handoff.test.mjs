import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildProfileScopedPlan,
  deriveAttemptEvidencePath,
  runIdentityLifecycleHandoff,
} from './codex-identity-lifecycle-handoff.mjs';

function packetFor(root, overrides = {}) {
  const profilesRoot = path.join(root, 'profiles');
  return {
    schemaVersion: '1.0.0',
    kind: 'brain.codex.identity.lifecycle-handoff',
    handoffId: 'test-handoff',
    profilesRoot,
    canonicalCheckout: path.join(root, 'legacy-checkout'),
    candidateCatalog: path.resolve('operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'),
    configOwnership: {
      configWriter: 'brain:runtime-profile-config-materializer',
      configurationCustody: 'brain',
      authenticationCustody: 'codex_application',
      route: 'direct_native_openai',
      allowedMutation: 'profile_config_only',
      sharedDefaultRoot: 'application_owned_observe_only',
      webGpt: 'separate_application_owned_surface',
    },
    processAbsencePredicates: [
      'native_chatgpt_application',
      'native_codex_application',
      'native_codex_app_server',
      'native_computer_use_service',
    ],
    profiles: [
      {
        accountId: 'account:openai.personal.01',
        runtimeProfileId: 'runtime_profile:openai.personal.01.cli',
        role: 'primary',
        preferred: true,
        root: path.join(profilesRoot, 'openai.personal.01.cli'),
      },
      {
        accountId: 'account:openai.personal.02',
        runtimeProfileId: 'runtime_profile:openai.personal.02.cli',
        role: 'secondary',
        preferred: false,
        root: path.join(profilesRoot, 'openai.personal.02.cli'),
      },
    ],
    continuationEvidencePath: path.join(root, 'handoff.evidence.json'),
    ...overrides,
  };
}

test('profile-local plan does not promote legacy global process predicates into blockers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-handoff-plan-'));
  const packet = packetFor(root);
  const plan = buildProfileScopedPlan(packet);

  assert.equal(plan.policy.lifecycleScope, 'profile_scoped');
  assert.equal(plan.policy.globalProcessQuiescenceRequired, false);
  assert.equal(plan.policy.targetProfileLeaseRequired, true);
  assert.equal(plan.policy.sharedDefaultRootMutation, false);
  assert.equal(plan.policy.webGptMutation, false);
  assert.deepEqual(plan.ignoredLegacyGlobalPredicates, packet.processAbsencePredicates);
  assert.equal(plan.deferredMaintenance.canonicalCheckoutRelocation, 'separate_git_maintenance_not_profile_prerequisite');
  assert.ok(plan.profiles.every((profile) => profile.root.startsWith(packet.profilesRoot)));
});

test('retry evidence never overwrites the original blocked evidence artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-handoff-evidence-'));
  const packet = packetFor(root);
  fs.writeFileSync(packet.continuationEvidencePath, '{"terminal":"HANDOFF_BLOCKED"}\n', { mode: 0o600 });

  const first = deriveAttemptEvidencePath(packet);
  assert.notEqual(first, packet.continuationEvidencePath);
  assert.equal(path.dirname(first), path.dirname(packet.continuationEvidencePath));
  assert.match(path.basename(first), /attempt-/);
});

test('shared default Codex root is rejected as a profile namespace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-handoff-shared-'));
  const shared = path.join(os.homedir(), '.codex');
  const packet = packetFor(root, {
    profilesRoot: shared,
    profiles: [{
      accountId: 'account:openai.personal.01',
      runtimeProfileId: 'runtime_profile:openai.personal.01.cli',
      role: 'primary',
      preferred: true,
      root: shared,
    }],
  });

  assert.throws(() => buildProfileScopedPlan(packet), /shared ~\/\.codex/);
});

test('execute creates/materializes isolated profiles even when legacy global predicates are present', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-handoff-execute-'));
  const packet = packetFor(root);
  const packetPath = path.join(root, 'packet.json');
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });

  const result = await runIdentityLifecycleHandoff(['execute', '--packet', packetPath, '--confirm']);

  assert.equal(result.status, 'OK');
  assert.equal(result.terminal, 'HANDOFF_OK');
  assert.equal(result.evidence.policy.globalProcessQuiescenceRequired, false);
  assert.equal(result.evidence.policy.sharedDefaultRootMutation, false);
  assert.equal(result.evidence.policy.webGptMutation, false);
  assert.equal(result.evidence.results.length, 2);
  assert.ok(result.evidence.results.every((profile) => profile.status === 'READY'));
  assert.ok(result.evidence.results.every((profile) => profile.doctor.process.state !== 'active'));
  assert.ok(fs.existsSync(result.attemptEvidencePath));
  assert.ok(fs.existsSync(path.join(packet.profiles[0].root, 'config.toml')));
  assert.ok(fs.existsSync(path.join(packet.profiles[1].root, 'config.toml')));
});
