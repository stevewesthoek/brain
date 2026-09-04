import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeploymentIdentity } from '../adapters/deployment-identity.js';

const base = {
  canonicalSourcePath: '/repo/brain',
  sourceRevision: 'source-1',
  runtimePath: '/deploy/brain-runtime',
  deploymentRevision: 'source-1',
  buildMode: 'production' as const,
  buildTimestamp: '2026-09-04T08:00:00.000Z',
};

test('matching pinned revisions are explicitly current', () => {
  const identity = createDeploymentIdentity(base);
  assert.equal(identity.identityState, 'matching');
  assert.equal(identity.canonicalSource.revision, 'source-1');
  assert.equal(identity.deployment.revision, 'source-1');
  assert.equal(identity.deployment.buildMode, 'production');
  assert.equal(identity.runtime.serviceState, 'unknown');
  assert.equal(identity.runtime.launchMechanism, 'unknown');
  assert.equal(identity.safety.exposesSecrets, false);
});
test('different source and deployed revisions are explicitly stale', () => {
  const identity = createDeploymentIdentity({ ...base, deploymentRevision: 'old-1' });
  assert.equal(identity.identityState, 'stale');
});

test('missing revision metadata is explicitly unknown', () => {
  const identity = createDeploymentIdentity({ ...base, sourceRevision: null, deploymentRevision: null });
  assert.equal(identity.identityState, 'unknown');
});

test('unavailable runtime metadata is fail-closed', () => {
  const identity = createDeploymentIdentity({ ...base, metadataAvailable: false });
  assert.equal(identity.identityState, 'unavailable');
  assert.equal(identity.metadataAvailable, false);
});

test('development mode remains explicit without pretending to be pinned', () => {
  const identity = createDeploymentIdentity({ ...base, sourceRevision: 'working-tree', deploymentRevision: null, buildMode: 'development' });
  assert.equal(identity.identityState, 'development');
  assert.equal(identity.deployment.buildMode, 'development');
});

test('runtime startup metadata is bounded and explicit', () => {
  const identity = createDeploymentIdentity({ ...base, serviceState: 'running', launchMechanism: 'launchagent' });
  assert.equal(identity.runtime.serviceState, 'running');
  assert.equal(identity.runtime.launchMechanism, 'launchagent');
});
