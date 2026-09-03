import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createRemainingConsumerAdapter, REMAINING_CONSUMERS, REMAINING_CONSUMER_ADAPTER_ID } from './remaining-consumer-adapter.mjs';
import { WAVE3_ORDER, WAVE3_REPORT, WAVE3_SPEC, controller, activate, startCanary, accept, promote, rollback, restore } from './run-operational-rollout-wave3.mjs';

test('every remaining consumer uses the same thin Brain-owned adapter contract', () => {
  assert.deepEqual(WAVE3_ORDER, REMAINING_CONSUMERS.map((item) => item.id));
  for (const consumer of REMAINING_CONSUMERS) {
    const adapter = createRemainingConsumerAdapter(consumer.id);
    const result = adapter.consume({ message: 'Implement the code feature and validate it with QA.', workspace: { boundary: process.cwd(), resolved: true }, session: { id: `wave3-test-${consumer.id}`, resumable: true }, requiredCapabilities: ['workspace.read', 'workspace.write', 'tests.run', 'review.run'] });
    assert.equal(adapter.adapterId, REMAINING_CONSUMER_ADAPTER_ID);
    assert.equal(result.status, 'READY');
    assert.equal(result.route.primaryRouteFamily, 'code');
    assert.equal(result.receipt.consumer, consumer.id);
    assert.equal(result.receipt.rawPromptStored, false);
    assert.equal(result.safety.writesPerformed, 0);
  }
});

test('Wave 3 lifecycle includes readiness, canary, acceptance, default, rollback, and restore', () => {
  let value = promote(accept(activate(controller('cursor', 'design-web')), true), true);
  assert.equal(value.state, 'DEFAULT_ACTIVE');
  value = rollback(value);
  assert.equal(value.state, 'ROLLED_BACK');
  value = promote(accept(startCanary(restore(value)), true), true);
  assert.equal(value.state, 'DEFAULT_ACTIVE');
  assert.equal(value.rollback.passed, true);
});

test('Wave 3 machine report and spec are emitted after acceptance', () => {
  assert.equal(fs.existsSync(path.resolve(WAVE3_REPORT)), true);
  assert.equal(fs.existsSync(path.resolve(WAVE3_SPEC)), true);
  const spec = JSON.parse(fs.readFileSync(path.resolve(WAVE3_SPEC), 'utf8'));
  assert.equal(spec.status, 'UNIVERSAL_USER_TRANSPARENCY_COMPLETE');
  assert.deepEqual(spec.rolloutOrder, WAVE3_ORDER);
});
