import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  applyAtomicTextConfiguration,
  planConfigurationMutations,
  readFileRevision,
  semanticFingerprint,
} from './configuration-ownership.mjs';

test('ownership planner allows an explicitly authorized Brain create', () => {
  const plan = planConfigurationMutations({
    operation: 'profile-config',
    resources: [{
      resourceId: 'config:profile-a',
      path: '/tmp/profile-a/config.toml',
      currentOwner: 'brain:runtime-profile-config-materializer',
      desiredOwner: 'brain:runtime-profile-config-materializer',
      authorityRef: 'brain:runtime-profile-config-materializer',
      currentState: 'absent',
      desiredState: 'present',
      action: 'create',
      currentSemanticState: 'absent',
      desiredSemanticState: 'non_secret_profile_policy',
      actualRevision: { exists: false, type: 'missing' },
      expectedRevision: { exists: false, type: 'missing' },
    }],
  });
  assert.equal(plan.status, 'READY');
  assert.equal(plan.resources[0].action, 'create');
});

test('unknown or external ownership fails closed before mutation', () => {
  const plan = planConfigurationMutations({
    resources: [{
      resourceId: 'config:shared-codex-root',
      path: '/Users/Office/.codex/config.toml',
      currentOwner: 'application',
      desiredOwner: 'brain:runtime-profile-config-materializer',
      authorityRef: 'brain:runtime-profile-config-materializer',
      currentState: 'present',
      action: 'update',
      externalOwner: true,
      currentSemanticState: 'present',
      desiredSemanticState: 'brain_policy',
      actualRevision: { digest: 'new' },
      expectedRevision: { digest: 'old' },
    }, {
      resourceId: 'config:unknown',
      currentOwner: 'unknown',
      desiredOwner: 'brain:owner',
      authorityRef: 'brain:owner',
      currentState: 'present',
      action: 'update',
    }],
  });
  assert.equal(plan.status, 'BLOCKED');
  assert.equal(plan.executable, false);
  assert.equal(plan.resources[0].action, 'conflict');
  assert.equal(plan.resources[1].action, 'unknown');
});

test('atomic write detects post-plan drift and validates before publication', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-config-ownership-'));
  try {
    const file = path.join(root, 'config.toml');
    const before = readFileRevision(file);
    const plan = planConfigurationMutations({ resources: [{
      resourceId: 'config:profile-a',
      path: file,
      currentOwner: 'brain:owner',
      desiredOwner: 'brain:owner',
      authorityRef: 'brain:owner',
      currentState: 'absent',
      desiredState: 'present',
      action: 'create',
      actualRevision: before,
      expectedRevision: before,
    }] });
    fs.writeFileSync(file, 'external = true\n', { mode: 0o600 });
    assert.throws(
      () => applyAtomicTextConfiguration({ plan, resourceId: 'config:profile-a', file, contents: 'managed = true\n' }),
      /drift detected/,
    );
    assert.equal(fs.readFileSync(file, 'utf8'), 'external = true\n');

    const fresh = readFileRevision(file);
    const update = planConfigurationMutations({ resources: [{
      resourceId: 'config:profile-a',
      path: file,
      currentOwner: 'brain:owner',
      desiredOwner: 'brain:owner',
      authorityRef: 'brain:owner',
      currentState: 'present',
      desiredState: 'present',
      action: 'update',
      actualRevision: fresh,
      expectedRevision: fresh,
    }] });
    const result = applyAtomicTextConfiguration({
      plan: update,
      resourceId: 'config:profile-a',
      file,
      contents: 'managed = true\n',
      validate: (text) => assert.match(text, /managed/),
      verify: (destination) => assert.equal(fs.readFileSync(destination, 'utf8'), 'managed = true\n'),
    });
    assert.equal(result.status, 'OK');
    assert.equal(fs.readFileSync(file, 'utf8'), 'managed = true\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unresolved physical resources fail closed before a mutation plan can execute', () => {
  const plan = planConfigurationMutations({
    resources: [{
      resourceId: 'config:symlink',
      path: '/tmp/opaque-config',
      currentOwner: 'brain:writer',
      desiredOwner: 'brain:writer',
      authorityRef: 'brain:writer',
      currentState: 'present',
      action: 'update',
      actualRevision: { exists: true, type: 'symlink' },
    }],
  });
  assert.equal(plan.status, 'BLOCKED');
  assert.ok(plan.blockers.includes('config:symlink:current_resource_type_unresolved'));
});

test('semantic fingerprints are deterministic without returning source values', () => {
  assert.equal(semanticFingerprint({ b: 2, a: 1 }), semanticFingerprint({ a: 1, b: 2 }));
  const plan = planConfigurationMutations({ resources: [{ resourceId: 'config:test', action: 'preserve', currentOwner: 'application', currentState: 'present' }] });
  assert.equal(plan.redaction.rawValuesReturned, false);
  assert.equal(plan.redaction.secretsRead, false);
});
