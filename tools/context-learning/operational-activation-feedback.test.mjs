import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOperationalActivation } from './operational-activation-feedback.mjs';

test('reports active capabilities and aggregate feedback without mutation', () => {
  const report = projectOperationalActivation({ events: [
    { capability_id: 'universal-entry-consumption', type: 'invocation', useful: true },
    { capability_id: 'universal-entry-consumption', type: 'invocation', useful: false },
    { capability_id: 'maintenance-intelligence', type: 'false_positive_finding', mind_review_required: true },
    { capability_id: 'session-continuity-inspection', type: 'continuity_failure' }
  ] });
  assert.equal(report.mode, 'REPORT_ONLY_OPERATIONAL_ACTIVATION');
  assert.equal(report.capabilities.find((item) => item.capability_id === 'universal-entry-consumption').state, 'activated');
  assert.equal(report.feedback.by_capability['universal-entry-consumption'].invocations, 2);
  assert.equal(report.feedback.by_capability['universal-entry-consumption'].usefulness_rate, 0.5);
  assert.equal(report.feedback.by_capability['maintenance-intelligence'].mind_review_required, true);
  assert.equal(report.safety.writes_performed, 0);
  assert.equal(report.safety.automatic_actions, 0);
});

test('preserves state vocabulary, bounds events, and remains deterministic', () => {
  const capabilities = [{ capability_id: 'test-capability', state: 'review_required', clients: ['codex'] }];
  const input = { capabilities, events: [{ capability_id: 'test-capability', type: 'stale_context' }], maxItems: 1 };
  const first = projectOperationalActivation(input);
  const second = projectOperationalActivation(input);
  assert.deepEqual(first, second);
  assert.equal(first.capabilities[0].reversible, true);
  assert.equal(first.capabilities[0].autonomous, false);
  assert.throws(() => projectOperationalActivation({ capabilities: [{ capability_id: 'bad', state: 'unknown' }] }), /operational_capability_state_invalid/);
});

test('disable path does not retain or write feedback state', () => {
  const report = projectOperationalActivation({ enabled: false, events: [{ capability_id: 'x', type: 'invocation' }] });
  assert.equal(report.enabled, false);
  assert.deepEqual(report.capabilities, []);
  assert.equal(report.feedback.event_count, 0);
  assert.equal(report.safety.authority_changed, false);
});
