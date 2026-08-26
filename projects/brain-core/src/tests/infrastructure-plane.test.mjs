import assert from 'node:assert/strict';
import test from 'node:test';

import { createContextBroker } from '../../../../tools/context-learning/context-broker.mjs';
import {
  createInfrastructureContextProvider,
  createInfrastructureMcpCapabilityProvider,
} from '../../../../tools/context-learning/infrastructure-context-provider.mjs';
import { runProchatCli } from '../../../../tools/prochat.mjs';
import {
  getInfrastructureMcpCapabilities,
  readInfrastructureCatalog,
  readInfrastructureDoctor,
  readInfrastructureResource,
  readInfrastructureStatus,
} from '../adapters/infrastructure-plane.mjs';

const now = new Date('2026-08-19T17:00:00.000Z');

function canonicalIds() {
  return readInfrastructureCatalog({ now }).resources.map((resource) => resource.resourceId).sort();
}

test('shared infrastructure projection preserves one stable canonical ID set', () => {
  const ids = canonicalIds();
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('host:dokploy-aws'));
  assert.ok(ids.includes('host:vm-supabase'));
});

test('CLI consumes the same canonical projection without execution authority', () => {
  const status = runProchatCli(['infra', 'status']);
  const ids = status.catalog.resources.map((resource) => resource.resourceId).sort();
  assert.deepEqual(ids, canonicalIds());
  assert.equal(status.safety.executionEnabled, false);
  assert.equal(status.safety.executionPerformed, false);
  assert.deepEqual(status.safety.actualEffects, []);
});

test('CLI inspect preserves the exact canonical resource identity', () => {
  const inspected = runProchatCli(['infra', 'inspect', 'host:vm-supabase']);
  assert.equal(inspected.resource.resourceId, 'host:vm-supabase');
  assert.deepEqual(inspected, readInfrastructureResource('host:vm-supabase'));
});

test('Context Broker provider resolves canonical IDs with citations and freshness', () => {
  const contextProvider = createInfrastructureContextProvider({ clock: () => now });
  const capabilityProvider = createInfrastructureMcpCapabilityProvider({ clock: () => now });
  const broker = createContextBroker({ contextProviders: [contextProvider], capabilityProviders: [capabilityProvider], clock: () => now });

  const pack = broker.call('resolve', { query: 'supabase', maxItems: 5, maxTokens: 1200 });
  assert.ok(pack.items.some((item) => item.itemId === 'host:vm-supabase'));
  const item = pack.items.find((entry) => entry.itemId === 'host:vm-supabase');
  assert.ok(item?.citation);
  assert.ok(['fresh', 'stale', 'unknown'].includes(item?.freshness));

  const capabilities = broker.call('capabilities_list', { maxItems: 20 });
  assert.ok(capabilities.capabilities.some((entry) => entry.capabilityId === 'infra.inspect'));
  assert.ok(capabilities.capabilities.every((entry) => entry.riskClass === 'read-only'));

  const inspected = broker.call('capabilities_inspect', {
    providerId: 'infrastructure-plane-mcp',
    capabilityId: 'infra.doctor',
  });
  assert.equal(inspected.capability.capabilityId, 'infra.doctor');
  assert.equal(inspected.executionExposed, false);
});

test('MCP capability descriptors use the same catalog revision and expose no execution', () => {
  const doctor = readInfrastructureDoctor({ now });
  const mcp = getInfrastructureMcpCapabilities({ now });
  assert.equal(mcp.catalogVersion, doctor.catalogVersion);
  assert.equal(mcp.sourceNeutral, true);
  assert.equal(mcp.readOnly, true);
  assert.equal(mcp.executionExposed, false);
  assert.ok(mcp.capabilities.every((capability) => capability.canonicalModel === `ikhp-catalog:${doctor.catalogVersion}`));
});

test('missing runtime state remains visible as UNKNOWN rather than synthesized health', () => {
  const status = readInfrastructureStatus({ now });
  for (const runtimeState of [status.health.runtimeState, status.incidents.runtimeState, status.actionReceipts.runtimeState]) {
    assert.ok(['ok', 'missing', 'invalid'].includes(runtimeState));
  }
  if (status.health.runtimeState !== 'ok') assert.deepEqual(status.health.observations, []);
  if (status.incidents.runtimeState !== 'ok') assert.deepEqual(status.incidents.incidents, []);
  if (status.actionReceipts.runtimeState !== 'ok') assert.deepEqual(status.actionReceipts.receipts, []);
});

test('credential surface is metadata only across shared status and CLI', () => {
  const status = readInfrastructureStatus({ now });
  const cli = runProchatCli(['infra', 'credentials']);
  assert.deepEqual(cli, status.credentials);
  assert.equal(status.credentials.containsSecrets, false);
  const serialized = JSON.stringify(status.credentials);
  assert.equal(serialized.includes('secretStoreRef'), false);
  assert.equal(serialized.includes('clientSecret'), false);
});
