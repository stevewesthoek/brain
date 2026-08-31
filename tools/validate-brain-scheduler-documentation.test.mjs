import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrainSchedulerDocumentation } from './validate-brain-scheduler-documentation.mjs';

test('Brain Scheduler current documentation is internally consistent', () => {
  assert.deepEqual(validateBrainSchedulerDocumentation(), []);
});
