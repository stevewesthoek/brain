import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BRAIN_RESTRICTED_PROFILE,
  DEEPSEEK_HARNESS_PIN,
  verifyRestrictedTopology,
  type HarnessTopologyObservation,
} from '../agent-mode/deepseek-harness-restricted-profile.js';

const valid: HarnessTopologyObservation = {
  profile: BRAIN_RESTRICTED_PROFILE.name,
  serviceRows: BRAIN_RESTRICTED_PROFILE.allowedServiceRows,
  toolNames: ['brain_read'],
  providerIds: ['mock'],
  processIsolation: 'separate-child',
  environmentPolicy: 'explicit-complete-env',
};

test('pins the evaluated Harness source and accepts only a proven restricted topology', () => {
  assert.equal(DEEPSEEK_HARNESS_PIN.commit, 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8');
  assert.deepEqual(verifyRestrictedTopology(valid), { ok: true, reasons: [] });
});

test('rejects upstream shell/filesystem rows, undeclared tools, inherited env, and same-process execution', () => {
  const result = verifyRestrictedTopology({
    ...valid,
    serviceRows: [...valid.serviceRows, 'persistent-bash', 'fs-local'],
    toolNames: ['brain_read', 'bash'],
    processIsolation: 'same-process',
    environmentPolicy: 'inherited-parent-env',
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, [
    'denied service row is active: persistent-bash',
    'denied service row is active: fs-local',
    'tool is not explicitly allowlisted: bash',
    'runtime is not proven to run in a separate child process',
    'runtime environment is not an explicit complete credential policy',
  ]);
});

test('refuses an unknown service row instead of widening the profile implicitly', () => {
  const result = verifyRestrictedTopology({ ...valid, serviceRows: [...valid.serviceRows, 'future-plugin'] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ['service row is not explicitly allowlisted: future-plugin']);
});

test('refuses auxiliary provider routes instead of allowing an indirect model call', () => {
  const result = verifyRestrictedTopology({ ...valid, providerIds: ['mock', 'auxiliary'] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ['runtime must expose exactly one admitted provider route']);
});
