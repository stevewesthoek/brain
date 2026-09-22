import assert from 'node:assert/strict';
import test from 'node:test';
import { BRAIN_RESTRICTED_PROFILE } from '../agent-mode/deepseek-harness-restricted-profile.js';
import {
  H0_D_AUTHORIZATION_PACKETS,
  H0_D_GATE_READINESS,
  H0_D_HARNESS_PIN,
  H0_D_SCHEMA_VERSION,
  inspectPinnedHarnessAvailability,
} from './fixtures/agent-mode-h0-d-live-boundary.js';

test('H0-D records the exact pinned Harness as locally available', () => {
  assert.equal(H0_D_SCHEMA_VERSION, 'agent-mode.h0-d-live-boundary.v1');
  assert.equal(inspectPinnedHarnessAvailability(), 'SUPPORTED_LOCAL');
  assert.equal(H0_D_HARNESS_PIN.commit, 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8');
  assert.equal(H0_D_HARNESS_PIN.version, '0.1.3-alpha.2');
});

test('H0-D keeps local child-process proof separate from unsupported denial acceptance', () => {
  assert.equal(BRAIN_RESTRICTED_PROFILE.deniedServiceRows.includes('sandbox'), true);
  assert.equal(BRAIN_RESTRICTED_PROFILE.allowedToolNames.length, 1);
  assert.deepEqual(
    H0_D_GATE_READINESS.map((entry) => [entry.faultClass, entry.classification, entry.liveStatus]),
    [
      ['provider_outage', 'EXTERNAL_SENSITIVE', 'blocked'],
      ['host_loss_reconnect', 'EXTERNAL_SENSITIVE', 'blocked'],
      ['sandbox_denial', 'UNSUPPORTED', 'not_run'],
      ['tool_denial', 'UNSUPPORTED', 'not_run'],
    ],
  );
});

test('H0-D authorization packets are bounded and prohibit production effects', () => {
  assert.equal(H0_D_AUTHORIZATION_PACKETS.providerOutage.bounds.maxRequests, 1);
  assert.equal(H0_D_AUTHORIZATION_PACKETS.providerOutage.bounds.maxRetries, 0);
  assert.equal(H0_D_AUTHORIZATION_PACKETS.hostLossReconnect.bounds.maxRepositoryWrites, 0);
  assert.match(H0_D_AUTHORIZATION_PACKETS.providerOutage.productionScope, /no production/);
  assert.match(H0_D_AUTHORIZATION_PACKETS.hostLossReconnect.productionScope, /no Office host/);
});
