import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createContextBroker, BROKER_OPERATIONS } from './context-broker.mjs';
import { loadJson, validateJsonSchema } from './context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const schema = loadJson(path.join(repoRoot, 'operations/specs/context-learning/broker-contracts-v1.schema.json'));
const fixtures = loadJson(path.join(repoRoot, 'operations/fixtures/context-learning-broker-fixtures-v1.json'));
const FIXED_NOW = new Date('2026-08-15T22:00:00Z');

function buildHarness(profile, { humanFreshness = 'fresh', humanHealth = 'healthy', machineFreshness = 'fresh', alignmentMode = 'aligned', retrievalStates = null, capabilityHealth = 'healthy', duplicateCapability = false } = {}) {
  let executeCalls = 0;
  const contextProviders = profile.contextProviders.map((descriptor) => {
    const isHuman = descriptor.contextRole === 'human_authority';
    const isMachine = descriptor.contextRole === 'machine_capability';
    const provider = {
      ...descriptor,
      freshness: isHuman ? humanFreshness : (isMachine ? machineFreshness : descriptor.freshness),
      health: isHuman ? humanHealth : descriptor.health,
      resolve({ query }) {
        if (isHuman) {
          return {
            items: [{
              itemId: `${descriptor.providerId}:strategy`,
              summary: `Human-authority context relevant to ${query}.`,
              citation: `${descriptor.providerId}/strategy#L1-L4`,
              authority: 'canonical',
              freshness: this.freshness
            }],
            conflicts: query.includes('conflict') ? [{ field: 'strategy', left: 'current', right: 'proposal' }] : [],
            unknowns: query.includes('unknown') ? ['human-context-gap'] : []
          };
        }
        return {
          items: [{
            itemId: `${descriptor.providerId}:operation`,
            summary: `Machine-capability context relevant to ${query}.`,
            citation: `${descriptor.providerId}/operations#L10-L15`,
            authority: 'canonical',
            freshness: this.freshness
          }]
        };
      },
      align() {
        if (!isHuman) return [];
        if (alignmentMode === 'conflicting') return [{ relation: 'conflicts', strength: 0.95, citation: `${descriptor.providerId}/strategy#L1`, freshness: 'fresh', summary: 'Proposal conflicts with current strategy.' }];
        if (alignmentMode === 'potentially_conflicting') return [{ relation: 'conflicts', strength: 0.55, citation: `${descriptor.providerId}/strategy#L1`, freshness: 'fresh', summary: 'Proposal may conflict with current strategy.' }];
        if (alignmentMode === 'strategy_stale') return [{ relation: 'stale', strength: 1, citation: `${descriptor.providerId}/strategy#L1`, freshness: 'review_due', summary: 'Strategy requires review before strong alignment advice.' }];
        if (alignmentMode === 'insufficient_context') return [];
        return [{ relation: 'aligns', strength: 0.9, citation: `${descriptor.providerId}/strategy#L1`, freshness: 'fresh', summary: 'Proposal aligns with current strategy.' }];
      }
    };
    return provider;
  });

  const retrievalProviders = profile.retrievalProviders.map((descriptor, index) => ({
    ...descriptor,
    ...(retrievalStates?.[index] ?? {}),
    search() {
      return [{ summary: `Optional ${this.mode} navigation hint.`, citation: `${this.providerId}/hint#1`, freshness: this.freshness }];
    }
  }));

  const capabilityProviders = profile.capabilityProviders.map((descriptor) => {
    const catalog = [
      {
        capabilityId: 'deploy-check',
        capabilityKind: 'validator',
        summary: 'Validate deployment readiness without deployment.',
        sourceRevision: descriptor.sourceRevision,
        requiredContextScopes: ['operations'],
        riskClass: 'read-only',
        confirmationClass: 'none',
        transportRef: 'local:validator:deploy-check',
        health: capabilityHealth,
        freshness: descriptor.freshness,
        instructionsRef: 'catalog://deploy-check',
        instructions: 'Run the bounded readiness checks and report evidence.',
        execute() { executeCalls += 1; }
      },
      {
        capabilityId: 'repo-review',
        capabilityKind: 'skill',
        summary: 'Review repository changes with bounded source context.',
        sourceRevision: descriptor.sourceRevision,
        requiredContextScopes: ['repository'],
        riskClass: 'read-only',
        confirmationClass: 'none',
        transportRef: 'local:skill:repo-review',
        health: capabilityHealth,
        freshness: descriptor.freshness,
        instructionsRef: 'catalog://repo-review',
        instructions: 'Read exact changed paths, validate, and report findings.',
        execute() { executeCalls += 1; }
      },
      {
        capabilityId: 'ops-cli',
        capabilityKind: 'named_cli',
        summary: 'Named operational CLI capability exposed through policy metadata.',
        sourceRevision: descriptor.sourceRevision,
        requiredContextScopes: ['operations'],
        riskClass: 'medium',
        confirmationClass: 'policy',
        transportRef: 'cli://ops-cli',
        health: capabilityHealth,
        freshness: descriptor.freshness,
        instructionsRef: 'catalog://ops-cli',
        instructions: 'Use only through the consuming runtime policy boundary.',
        execute() { executeCalls += 1; }
      },
      {
        capabilityId: 'repo-mcp',
        capabilityKind: 'mcp_tool',
        summary: 'Repository MCP tool descriptor.',
        sourceRevision: descriptor.sourceRevision,
        requiredContextScopes: ['repository'],
        riskClass: 'high',
        confirmationClass: 'user',
        transportRef: 'mcp://repo/read',
        health: capabilityHealth,
        freshness: descriptor.freshness,
        instructionsRef: 'catalog://repo-mcp',
        instructions: 'Execution remains subject to the consumer MCP policy.',
        execute() { executeCalls += 1; }
      }
    ];
    if (duplicateCapability) catalog.push({ ...catalog[1] });
    return {
      ...descriptor,
      health: capabilityHealth,
      list() { return catalog; },
      inspect({ capabilityId }) { return catalog.find((item) => item.capabilityId === capabilityId) ?? null; }
    };
  });

  const broker = createContextBroker({
    contextProviders,
    retrievalProviders,
    capabilityProviders,
    decisionStatusProvider: () => ({ available: true, pendingCount: 2, sourceRevision: 'decisions-1' }),
    learnStatusProvider: () => ({ available: true, state: 'report-only', sourceRevision: 'learn-1' }),
    clock: () => FIXED_NOW
  });

  return { broker, getExecuteCalls: () => executeCalls };
}

test('broker operation surface is exact, read-only, and execution-free', () => {
  const { broker } = buildHarness(fixtures.referenceProfile);
  const health = broker.health();
  assert.deepEqual(health.operations, BROKER_OPERATIONS);
  assert.equal(health.readOnly, true);
  assert.equal(health.executionExposed, false);
  assert.deepEqual(validateJsonSchema(schema.$defs.healthResponse, health, schema), []);
  assert.equal(health.contextProviders[0].contextRole, 'human_authority');
  assert.equal(health.contextProviders[1].contextRole, 'machine_capability');
});

test('bootstrap is bounded and orders human authority before machine capability', () => {
  const { broker } = buildHarness(fixtures.referenceProfile);
  const bootstrap = broker.bootstrap({ maxTokens: 800 });
  assert.equal(bootstrap.layers[0].contextRole, 'human_authority');
  assert.equal(bootstrap.layers[1].contextRole, 'machine_capability');
  assert.ok(bootstrap.budget.usedTokens <= 800);
  assert.ok(bootstrap.budget.usedTokens > 0);
  assert.deepEqual(validateJsonSchema(schema.$defs.bootstrapEnvelope, bootstrap, schema), []);
  assert.throws(() => broker.bootstrap({ maxTokens: 10 }), /bootstrap_budget_exceeded/);
});

test('resolve is bounded, progressive, cited, ordered, and explainable', () => {
  const { broker } = buildHarness(fixtures.referenceProfile);
  const pack = broker.resolve({ query: 'review current strategy and operating rules', maxItems: 2, maxTokens: 400 });
  assert.equal(pack.items.length, 2);
  assert.equal(pack.items[0].contextRole, 'human_authority');
  assert.equal(pack.items[1].contextRole, 'machine_capability');
  assert.ok(pack.items.every((item) => item.citation.length > 0));
  assert.ok(pack.budget.usedTokens <= pack.budget.maxTokens);
  assert.ok(pack.navigationHints.every((hint) => hint.nonAuthoritative === true && hint.authority === 'derived'));
  assert.deepEqual(validateJsonSchema(schema.$defs.contextPack, pack, schema), []);

  const explanation = broker.explain({ packId: pack.packId });
  assert.deepEqual(validateJsonSchema(schema.$defs.explainResponse, explanation, schema), []);
  assert.equal(explanation.included.length, 2);
  assert.ok(explanation.included.every((item) => item.reason.includes('priority')));
  assert.ok(explanation.included.every((item) => item.citation));
});

test('freshness, conflict, unknown, and budget exclusions propagate deterministically', () => {
  const { broker } = buildHarness(fixtures.referenceProfile, { humanFreshness: 'stale' });
  const pack = broker.resolve({ query: 'conflict unknown', maxItems: 1, maxTokens: 200 });
  assert.equal(pack.freshness, 'stale');
  assert.equal(pack.items.length, 1);
  assert.equal(pack.conflicts.length, 1);
  assert.ok(pack.unknowns.includes('human-context-gap'));
  assert.ok(pack.excluded.some((entry) => entry.reason === 'item-limit'));
});

test('alignment returns all five required signals from structured human-authority evidence', () => {
  const modes = new Map([
    ['aligned', 'aligned'],
    ['potentially_conflicting', 'potentially_conflicting'],
    ['conflicting', 'conflicting'],
    ['strategy_stale', 'strategy_stale'],
    ['insufficient_context', 'insufficient_context']
  ]);
  for (const [mode, expected] of modes) {
    const { broker } = buildHarness(fixtures.referenceProfile, { alignmentMode: mode });
    const result = broker.align({ query: 'should we change direction?' });
    assert.equal(result.signal, expected);
    assert.deepEqual(validateJsonSchema(schema.$defs.alignmentResult, result, schema), []);
  }
});

test('disabled, stale, and unavailable optional accelerators fall back without affecting canonical context', () => {
  const profile = structuredClone(fixtures.referenceProfile);
  profile.retrievalProviders.push({
    ...profile.retrievalProviders[0],
    providerId: 'unavailable-navigation-reference'
  });
  const states = [
    { health: 'disabled', freshness: 'fresh' },
    { health: 'healthy', freshness: 'stale' },
    { health: 'unavailable', freshness: 'fresh' }
  ];
  const { broker } = buildHarness(profile, { retrievalStates: states });
  const pack = broker.resolve({ query: 'find current operating context', maxItems: 2, maxTokens: 400 });
  assert.equal(pack.items.length, 2);
  assert.equal(pack.navigationHints.length, 0);
  assert.equal(pack.providerFallbacks.filter((item) => item.reason === 'optional-accelerator-not-fresh-and-healthy').length, 3);
});

test('capability discovery is compact and progressive, and never invokes execution', () => {
  const harness = buildHarness(fixtures.referenceProfile);
  const listed = harness.broker.capabilitiesList({ maxItems: 10 });
  assert.equal(listed.capabilities.length, 4);
  assert.ok(listed.capabilities.every((capability) => !Object.hasOwn(capability, 'instructions')));
  assert.deepEqual(validateJsonSchema(schema.$defs.capabilityListResponse, listed, schema), []);
  assert.equal(harness.getExecuteCalls(), 0);

  const metadata = harness.broker.capabilitiesInspect({ providerId: 'brain-capability-reference', capabilityId: 'repo-review' });
  assert.equal(metadata.instructionsIncluded, false);
  assert.equal(metadata.instructions, null);
  assert.equal(metadata.executionExposed, false);
  assert.equal(harness.getExecuteCalls(), 0);

  assert.throws(
    () => harness.broker.capabilitiesInspect({ providerId: 'brain-capability-reference', capabilityId: 'repo-review', includeInstructions: true, relevance: 'metadata' }),
    /instructions_require_selected_relevance/
  );
  const selected = harness.broker.capabilitiesInspect({ providerId: 'brain-capability-reference', capabilityId: 'repo-review', includeInstructions: true, relevance: 'selected' });
  assert.equal(selected.instructionsIncluded, true);
  assert.match(selected.instructions, /exact changed paths/i);
  assert.equal(selected.executionExposed, false);
  assert.equal(harness.getExecuteCalls(), 0);
  assert.deepEqual(validateJsonSchema(schema.$defs.capabilityInspectResponse, selected, schema), []);
});

test('stale capability provider fails visibly instead of leaking stale catalog entries', () => {
  const { broker } = buildHarness(fixtures.referenceProfile, { capabilityHealth: 'degraded' });
  const result = broker.capabilitiesList({ maxItems: 10 });
  assert.equal(result.capabilities.length, 0);
  assert.equal(result.providerFallbacks.length, 1);
  assert.match(result.providerFallbacks[0].reason, /not-fresh-and-healthy/);
});

test('duplicate capability IDs within one provider are rejected visibly', () => {
  const { broker } = buildHarness(fixtures.referenceProfile, { duplicateCapability: true });
  const result = broker.capabilitiesList({ maxItems: 10 });
  assert.equal(result.capabilities.filter((item) => item.capabilityId === 'repo-review').length, 1);
  assert.ok(result.providerFallbacks.some((item) => item.reason === 'duplicate-capability-id' && item.capabilityId === 'repo-review'));
});

test('alternate provider profile proves broker has no Brain/Mind naming dependency', () => {
  const { broker } = buildHarness(fixtures.alternateProfile);
  const bootstrap = broker.bootstrap();
  assert.equal(bootstrap.layers[0].providerId, 'atlas-human-context');
  assert.equal(bootstrap.layers[1].providerId, 'ops-knowledge-service');
  assert.equal(JSON.stringify(bootstrap).includes('mind-reference'), false);
  assert.equal(JSON.stringify(bootstrap).includes('brain-reference'), false);

  const pack = broker.resolve({ query: 'customer operating priorities', maxItems: 2, maxTokens: 400 });
  assert.deepEqual(pack.items.map((item) => item.providerId), ['atlas-human-context', 'ops-knowledge-service']);

  const capabilities = broker.capabilitiesList({ maxItems: 10 });
  assert.equal(capabilities.capabilities[0].providerId, 'customer-automation-catalog');
});

test('status operations remain read-only snapshots and unsupported operations fail closed', () => {
  const { broker } = buildHarness(fixtures.referenceProfile);
  const decisions = broker.call('decisions_status');
  const learning = broker.call('learn_status');
  assert.equal(decisions.pendingCount, 2);
  assert.equal(learning.state, 'report-only');
  assert.deepEqual(validateJsonSchema(schema.$defs.decisionStatusResponse, decisions, schema), []);
  assert.deepEqual(validateJsonSchema(schema.$defs.learnStatusResponse, learning, schema), []);
  assert.throws(() => broker.call('execute_capability', {}), /unsupported_broker_operation/);
});
