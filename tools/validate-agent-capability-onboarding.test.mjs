import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOnboarding } from './validate-agent-capability-onboarding.mjs';

test('Brain capability onboarding inputs satisfy the shared contract', () => {
  const result = validateOnboarding();
  assert.deepEqual(result.failures, []);
});
