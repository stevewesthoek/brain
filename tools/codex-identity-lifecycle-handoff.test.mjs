import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

import {
  EVIDENCE_KIND,
  HANDOFF_KIND,
  PROFILE_SPECS,
  SCHEMA_VERSION,
  buildPacket,
  deriveAttemptEvidencePath,
  loadPacket,
  profileRoot,
} from './codex-identity-lifecycle-handoff.mjs';

function temporaryRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function packetFor(root, overrides = {}) {
  const profilesRoot = path.join(root, 'profiles');
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: HANDOFF_KIND,
    handoffId: 'codex-profile-test',
    sourceCheckout: root,
    canonicalCheckout: path.join(root, 'canonical'),
    profilesRoot,
    candidateCatalog: path.join(root, 'candidates.json'),
    canonicalCatalog: path.join(root, 'catalog.json'),
    profiles: PROFILE_SPECS.map((profile) => ({ ...profile, root: profileRoot(profilesRoot, profile.runtimeProfileId) })),
    policy: {
      lifecycleScope: 'profile_scoped',
      globalProcessQuiescenceRequired: false,
      targetProfileLeaseRequired: true,
      sharedDefaultRootMutation: false,
      webGptMutation: false,
      oauthReadOrCopy: false,
      canonicalCatalogMutation: false,
      canonicalCheckoutRelocation: 'deferred_separate_maintenance',
      nAccountModel: 'dynamic_collection',
    },
    preparationEvidence: { secretsExcluded: true },
    continuationEvidencePath: path.join(root, 'codex-profile-test.evidence.json'),
    containsSecrets: false,
    ...overrides,
  };
}

test('the new packet declares profile-local lifecycle semantics', () => {
  const root = temporaryRoot('brain-profile-handoff-plan-');
  const packet = packetFor(root);
  assert.equal(packet.policy.globalProcessQuiescenceRequired, false);
  assert.equal(packet.policy.sharedDefaultRootMutation, false);
  assert.equal(packet.policy.webGptMutation, false);
  assert.equal(packet.policy.nAccountModel, 'dynamic_collection');
  assert.equal(packet.profiles.length, 2);
  assert.notEqual(packet.profiles[0].root, packet.profiles[1].root);
});

test('attempt evidence gets a new immutable path instead of overwriting history', () => {
  const root = temporaryRoot('brain-profile-handoff-evidence-');
  const packet = packetFor(root);
  fs.writeFileSync(packet.continuationEvidencePath, '{"terminal":"BLOCKED"}\n', { mode: 0o600 });
  const attempt = deriveAttemptEvidencePath(packet);

  assert.notEqual(attempt, packet.continuationEvidencePath);
  assert.equal(path.dirname(attempt), path.dirname(packet.continuationEvidencePath));
  assert.match(path.basename(attempt), /\.attempt-.*\.evidence\.json$/);
});

test('retired v1 packets are rejected before execution', () => {
  const root = temporaryRoot('brain-profile-handoff-retired-');
  const packetPath = path.join(root, 'old.packet.json');
  fs.writeFileSync(packetPath, JSON.stringify({
    schemaVersion: '1.0.0',
    kind: 'brain.codex.identity.lifecycle-handoff',
    containsSecrets: false,
  }) + '\n', { mode: 0o600 });

  assert.throws(() => loadPacket(packetPath), /retired|unsupported/);
});

test('profile roots cannot be the shared default CODEX_HOME', () => {
  const shared = path.join(os.homedir(), '.codex');
  assert.throws(() => profileRoot(shared, 'runtime_profile:openai.personal.01.cli'), /shared/);
});

test('evidence kind is distinct from the handoff packet kind', () => {
  assert.equal(SCHEMA_VERSION, '2.0.0');
  assert.notEqual(EVIDENCE_KIND, HANDOFF_KIND);
  assert.equal(EVIDENCE_KIND, 'brain.codex.identity.profile-lifecycle-evidence');
});

test('v2 schema enforces the no-global-shutdown safety contract', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../operations/specs/codex-identity-profile-lifecycle-handoff-v2.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION);
  assert.equal(schema.properties.kind.const, HANDOFF_KIND);
  assert.equal(schema.properties.containsSecrets.const, false);
  assert.equal(schema.properties.policy.properties.globalProcessQuiescenceRequired.const, false);
  assert.equal(schema.properties.policy.properties.sharedDefaultRootMutation.const, false);
  assert.equal(schema.properties.policy.properties.webGptMutation.const, false);
});

test('prepare writes a v2 packet only from a clean main checkout', () => {
  const root = temporaryRoot('brain-profile-handoff-packet-');
  const source = path.join(root, 'source');
  fs.mkdirSync(source, { recursive: true });
  execFileSync('git', ['-C', source, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', source, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', source, 'config', 'user.name', 'test']);
  fs.writeFileSync(path.join(source, 'README.md'), 'test\n');
  execFileSync('git', ['-C', source, 'add', 'README.md']);
  execFileSync('git', ['-C', source, 'commit', '-qm', 'test']);
  execFileSync('git', ['-C', source, 'update-ref', 'refs/remotes/origin/main', 'HEAD']);
  const result = buildPacket({
    sourceCheckout: source,
    canonicalCheckout: root,
    profilesRoot: path.join(root, 'profiles'),
    handoffRoot: path.join(root, 'handoff'),
  });
  assert.equal(result.packet.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.packet.kind, HANDOFF_KIND);
  assert.equal(result.packet.containsSecrets, false);
  assert.equal(result.packet.policy.globalProcessQuiescenceRequired, false);
  assert.equal(result.packet.preparationEvidence.secretsExcluded, true);
  assert.ok(result.packetPath.endsWith('.packet.json'));
});
