import assert from 'node:assert/strict';

import { createContextBroker } from './context-learning/context-broker.mjs';
import {
  createInfrastructureContextProvider,
  createInfrastructureMcpCapabilityProvider,
} from './context-learning/infrastructure-context-provider.mjs';
import { runProchatCli } from './prochat.mjs';
import {
  getInfrastructureMcpCapabilities,
  readInfrastructureCatalog,
  readInfrastructureCredentialStatus,
  readInfrastructureDoctor,
  readInfrastructureSafety,
} from '../projects/brain-core/src/adapters/infrastructure-plane.mjs';

const now = new Date('2026-08-19T17:00:00.000Z');
const catalog = readInfrastructureCatalog({ now });
const canonicalIds = catalog.resources.map((resource) => resource.resourceId).sort();
assert.ok(canonicalIds.length > 0, 'canonical catalog must expose resources');
assert.equal(new Set(canonicalIds).size, canonicalIds.length, 'canonical resource IDs must be unique');

const cli = runProchatCli(['infra', 'status']);
assert.deepEqual(cli.catalog.resources.map((resource) => resource.resourceId).sort(), canonicalIds, 'CLI must consume the canonical resource ID set');

const contextProvider = createInfrastructureContextProvider({ clock: () => now });
const capabilityProvider = createInfrastructureMcpCapabilityProvider({ clock: () => now });
const broker = createContextBroker({ contextProviders: [contextProvider], capabilityProviders: [capabilityProvider], clock: () => now });
const context = broker.call('resolve', { query: 'supabase', maxItems: 5, maxTokens: 1200 });
assert.ok(context.items.some((item) => item.itemId === 'host:vm-supabase'), 'Context Broker must resolve canonical resource IDs');
assert.ok(context.items.every((item) => item.citation && item.freshness), 'Context Broker items require citations and freshness');
assert.ok(context.budget.usedTokens <= context.budget.maxTokens, 'Context Broker must remain within token budget');

const mcp = getInfrastructureMcpCapabilities({ now });
assert.equal(mcp.sourceNeutral, true, 'MCP descriptors must be source-neutral');
assert.equal(mcp.readOnly, true, 'MCP descriptors must be read-only');
assert.equal(mcp.executionExposed, false, 'MCP descriptors cannot expose execution');
assert.ok(mcp.capabilities.every((capability) => capability.riskClass === 'read-only'), 'all infrastructure MCP capabilities must remain read-only');

const safety = readInfrastructureSafety({ now });
assert.equal(safety.executionEnabled, false, 'IKHP4 executionEnabled invariant must remain false');
assert.equal(safety.executionPerformed, false, 'IKHP4 executionPerformed invariant must remain false');
assert.deepEqual(safety.actualEffects, [], 'IKHP4 actualEffects invariant must remain empty');

const credentials = readInfrastructureCredentialStatus({ now });
assert.equal(credentials.containsSecrets, false, 'credential surface must explicitly contain no secrets');
const serializedCredentials = JSON.stringify(credentials);
for (const forbidden of ['secretStoreRef', 'clientSecret', 'privateKey', 'passwordValue']) {
  assert.equal(serializedCredentials.includes(forbidden), false, `credential surface cannot expose ${forbidden}`);
}

const doctor = readInfrastructureDoctor({ now });
assert.equal(doctor.readOnly, true, 'doctor must be read-only');
assert.equal(doctor.executionEnabled, false, 'doctor cannot enable execution');
assert.ok(['ok', 'missing', 'invalid'].includes(doctor.runtime.health), 'health runtime state must remain explicit');
assert.ok(['ok', 'missing', 'invalid'].includes(doctor.runtime.incidents), 'incident runtime state must remain explicit');
assert.ok(['ok', 'missing', 'invalid'].includes(doctor.runtime.actionReceipts), 'receipt runtime state must remain explicit');

console.log(`infrastructure-consumers-valid catalogVersion=${catalog.catalogVersion} resources=${canonicalIds.length} contextItems=${context.items.length} mcpCapabilities=${mcp.capabilities.length} executionEnabled=false containsSecrets=false`);
