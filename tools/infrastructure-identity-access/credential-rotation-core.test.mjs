import assert from 'node:assert/strict';
import test from 'node:test';

import { executeAutomaticRotation, rotationDisposition } from './credential-rotation-core.mjs';

const credential = { credentialId: 'credential:provider.test', secretOwner: 'secret_store' };

test('provider-managed Brain credentials use the safe replacement transaction', async () => {
  const calls = [];
  const operations = Object.fromEntries(['createReplacement', 'storeReplacement', 'verifyReplacement', 'cutoverConsumers', 'verifyConsumers', 'retireOld', 'revokeOld', 'finalHealth'].map((name) => [name, async () => { calls.push(name); return { ok: true, version: 'v2' }; }]));
  const result = await executeAutomaticRotation({ credential, lifecyclePolicy: { rotationMode: 'provider_managed' }, operations, now: '2030-01-01T00:00:00Z' });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['createReplacement', 'storeReplacement', 'verifyReplacement', 'cutoverConsumers', 'verifyConsumers', 'retireOld', 'revokeOld', 'finalHealth']);
  assert.equal(result.containsSecrets, false);
});

test('rotation rolls back consumer cutover and never retires old credentials on failure', async () => {
  const calls = [];
  const operations = {
    createReplacement: async () => ({ ok: true, version: 'v2' }),
    storeReplacement: async () => ({ ok: true }),
    verifyReplacement: async () => ({ ok: true }),
    cutoverConsumers: async () => { calls.push('cutover'); return { ok: true }; },
    verifyConsumers: async () => { throw new Error('consumer_verification_failed'); },
    rollbackConsumers: async () => { calls.push('rollback'); return { ok: true }; },
    deleteReplacement: async () => { calls.push('delete'); return { ok: true }; },
    retireOld: async () => { calls.push('retire'); return { ok: true }; },
    finalHealth: async () => ({ ok: true }),
  };
  const result = await executeAutomaticRotation({ credential, lifecyclePolicy: { rotationMode: 'provider_managed' }, operations });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ['cutover', 'rollback', 'delete']);
  assert.equal(result.oldCredentialRetired, false);
});

test('application-owned and approval-gated credentials never auto-rotate', () => {
  assert.deepEqual(rotationDisposition({ credential: { ...credential, secretOwner: 'application' }, lifecyclePolicy: { rotationMode: 'provider_managed' } }), { mode: 'blocked', reasonCode: 'application_or_provider_owned' });
  assert.deepEqual(rotationDisposition({ credential, lifecyclePolicy: { rotationMode: 'approval_gated' } }), { mode: 'human_required', reasonCode: 'provider_rotation_requires_human' });
});
