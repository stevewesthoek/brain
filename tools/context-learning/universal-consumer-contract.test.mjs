import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { routeShadowRequest } from '../orchestration/shadow-intent-router.mjs';
import {
  CAPABILITY_OUTCOMES,
  UNIVERSAL_CONTRACT_VERSION,
  consumerAdapterMatrix,
  createBrainRequest,
  createReferenceEnvironmentAdapter,
  negotiateCapabilities,
  normalizeEnvironment,
  orchestrateBrainRequest,
  semanticProjection,
  universalContractSummary,
  validateConsumerIndependence,
  validateUniversalConsumerContract
} from './universal-consumer-contract.mjs';
import { loadJson } from './context-learning-core.mjs';
import { buildUniversalConformanceCorpus, UNIVERSAL_CONFORMANCE_SCENARIO_COUNT } from './universal-consumer-corpus.mjs';

const repoRoot = new URL('../..', import.meta.url).pathname;
const adapters = consumerAdapterMatrix().map((entry) => [entry.consumer, createReferenceEnvironmentAdapter({ environmentId: entry.consumer })]);

test('universal contract is versioned, Brain-owned, and schema-valid', () => {
  const summary = universalContractSummary();
  assert.equal(summary.contractId, 'infinite-brain-universal-consumer.v1');
  assert.deepEqual(validateUniversalConsumerContract(), []);
  assert.deepEqual(summary.stages, ['BrainRequest', 'BrainRoute', 'TaskPacket', 'CompositionGraph', 'ContextRequest[]', 'CapabilitySelection[]', 'GateSelection[]', 'EvidencePacket[]', 'BrainResult', 'Continuation']);
  assert.deepEqual(summary.capabilityOutcomes, CAPABILITY_OUTCOMES);
  assert.equal(summary.adapters.length, 7);
  assert(summary.adapters.every((item) => item.canConsume && item.routingOwner === 'brain'));
  const matrix = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json'));
  assert.equal(matrix.adapters.length, 7);
  assert(matrix.onboardingChecklist.length >= 8);
  const duplicateStages = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-contract.v1.json'));
  duplicateStages.stages = [...duplicateStages.stages.slice(0, -1), duplicateStages.stages[0]];
  assert(validateUniversalConsumerContract(duplicateStages).some((error) => error.includes('array items must be unique')));
});

test('thin adapters preserve the same semantic Brain route across 200+ scenarios and consumers', () => {
  const corpus = buildUniversalConformanceCorpus();
  assert(UNIVERSAL_CONFORMANCE_SCENARIO_COUNT >= 200);
  const catalog = createCapabilityCatalog({ repoRoot });
  let routeComparisons = 0;
  for (const scenario of corpus) {
    const requests = adapters.map(([, adapter]) => adapter.translate(scenario.nativeInput, { session: scenario.surface === 'session-bound' ? { id: scenario.scenarioId, resumable: true } : null }));
    assert(requests.every((request) => request.schemaVersion === UNIVERSAL_CONTRACT_VERSION));
    assert.equal(new Set(requests.map((request) => request.intent)).size, 1, scenario.scenarioId);
    const route = routeShadowRequest(requests[0].intent, { catalog, generatedAt: '2026-09-02T00:00:00Z' });
    assert.equal(route.primaryRouteFamily, scenario.expectedRoute, scenario.scenarioId);
    const semantic = JSON.stringify({ family: route.primaryRouteFamily, owner: route.primaryDescriptorId, specialists: [...route.selectedSpecialistDescriptorIds].sort(), qualification: route.qualification.required, risk: route.riskClass, confirmation: route.confirmationClass });
    for (const request of requests) {
      const equivalentRoute = routeShadowRequest(request.intent, { catalog, generatedAt: '2026-09-02T00:00:00Z' });
      assert.equal(JSON.stringify({ family: equivalentRoute.primaryRouteFamily, owner: equivalentRoute.primaryDescriptorId, specialists: [...equivalentRoute.selectedSpecialistDescriptorIds].sort(), qualification: equivalentRoute.qualification.required, risk: equivalentRoute.riskClass, confirmation: equivalentRoute.confirmationClass }), semantic, scenario.scenarioId);
      routeComparisons += 1;
    }
  }
  assert.equal(routeComparisons, UNIVERSAL_CONFORMANCE_SCENARIO_COUNT * 7);
});

test('full contract consumption works through every thin adapter without activation', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  for (const [consumer, adapter] of adapters) {
    const result = adapter.consume('Review the current diff for correctness', {}, { catalog, repoRoot, generatedAt: '2026-09-02T00:00:00Z' });
    assert.equal(result.status, 'READY', consumer);
    assert.equal(result.receipt.rawPromptStored, false, consumer);
    assert.equal(result.receipt.transcriptCanonical, false, consumer);
    assert.equal(result.safety.providerCalls, 0, consumer);
    assert.equal(result.safety.writesPerformed, 0, consumer);
    assert.equal(result.safety.executionReady, false, consumer);
    assert.equal(result.continuation.automaticResumeAllowed, false, consumer);
    assert.equal(adapter.render(result).receiptId, result.receipt.receiptId, consumer);
  }
});

test('capability negotiation is explicit for alternatives, external requirements, missing capabilities, and blocks', () => {
  const required = ['brain.route', 'brain.packet'];
  const supported = negotiateCapabilities({ required, reported: [{ capabilityId: 'brain.route', available: true }, { capabilityId: 'brain.packet', available: true }] });
  assert.equal(supported.status, 'SUPPORTED');
  assert(supported.selections.every((item) => item.outcome === 'SUPPORTED'));

  const alternative = negotiateCapabilities({ required: ['workspace.resolve'], reported: [{ capabilityId: 'workspace.resolve.v2', alternativeFor: 'workspace.resolve', available: true }] });
  assert.equal(alternative.selections[0].outcome, 'SUPPORTED_WITH_ALTERNATIVE');
  assert.equal(alternative.selections[0].selectedCapabilityId, 'workspace.resolve.v2');
  const unavailableAlternative = negotiateCapabilities({ required: ['workspace.resolve'], reported: [{ capabilityId: 'workspace.resolve.v2', alternativeFor: 'workspace.resolve', available: true, outcome: 'UNAVAILABLE' }] });
  assert.equal(unavailableAlternative.selections[0].outcome, 'UNAVAILABLE');

  const external = negotiateCapabilities({ required: ['browser'], reported: [{ capabilityId: 'browser', outcome: 'REQUIRES_EXTERNAL_CAPABILITY' }] });
  assert.equal(external.status, 'BLOCKED');
  assert.equal(external.selections[0].outcome, 'REQUIRES_EXTERNAL_CAPABILITY');

  const missing = negotiateCapabilities({ required: ['missing.required'], optional: ['missing.optional'], reported: [] });
  assert.equal(missing.status, 'BLOCKED');
  assert.deepEqual(missing.blocking, ['missing.required']);
  assert.equal(missing.selections.at(-1).outcome, 'DEGRADED');
  assert.equal(missing.noSilentOmission, true);

  const blocked = negotiateCapabilities({ required: ['brain.route'], reported: [{ capabilityId: 'brain.route', outcome: 'BLOCKED' }] });
  assert.equal(blocked.selections[0].outcome, 'BLOCKED');
  assert(CAPABILITY_OUTCOMES.includes(blocked.selections[0].outcome));
});

test('model/provider swaps and session metadata do not change semantic routing', () => {
  const first = createBrainRequest({ intent: 'Research current market options with citations', environment: { environmentId: 'one', model: { family: 'model-a', revision: 'a' }, capabilities: [] } });
  const second = createBrainRequest({ intent: 'Research current market options with citations', environment: { environmentId: 'two', model: { family: 'model-b', revision: 'b' }, capabilities: [], session: { id: 'different-session', resumable: true } } });
  assert.equal(first.intent, second.intent);
  const catalog = createCapabilityCatalog({ repoRoot });
  const routeA = routeShadowRequest(first.intent, { catalog });
  const routeB = routeShadowRequest(second.intent, { catalog });
  assert.deepEqual({ family: routeA.primaryRouteFamily, owner: routeA.primaryDescriptorId, gates: routeA.predictedQualitySafetyGates.map((item) => item.ref) }, { family: routeB.primaryRouteFamily, owner: routeB.primaryDescriptorId, gates: routeB.predictedQualitySafetyGates.map((item) => item.ref) });
  assert.equal(normalizeEnvironment({ model: { family: 'model-a' } }).model.family, 'model-a');
  assert.equal(first.contractId, 'infinite-brain-universal-consumer.v1');
  assert.throws(() => createBrainRequest({ intent: 'Review the current diff for correctness', environment: { contractVersion: '99.0.0' } }), /unsupported_environment_contract/);
});

test('stale continuation and unavailable required capability fail closed without transcript replay', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const adapter = createReferenceEnvironmentAdapter({ capabilities: [{ capabilityId: 'brain.contract.v1', available: true }, { capabilityId: 'brain.route', available: true }, { capabilityId: 'brain.packet', available: true }, { capabilityId: 'brain.context', available: true }, { capabilityId: 'brain.receipt', available: true }, { capabilityId: 'brain.continuity', available: true }] });
  const stale = adapter.consume('Continue this task from the previous session', {}, { catalog, repoRoot, currentState: { contextFresh: false }, generatedAt: '2026-09-02T00:00:00Z' });
  assert.notEqual(stale.continuation.state, 'CURRENT');
  assert.equal(stale.continuation.automaticResumeAllowed, false);
  assert.equal(stale.receipt.transcriptCanonical, false);

  const unavailable = createReferenceEnvironmentAdapter({ capabilities: [{ capabilityId: 'brain.contract.v1', available: false, outcome: 'UNAVAILABLE' }] }).consume('Review the current diff for correctness', {}, { catalog, repoRoot });
  assert.equal(unavailable.status, 'BLOCKED');
  assert(unavailable.degradation.reasons.includes('brain.contract.v1'));
  assert.equal(unavailable.safety.writesPerformed, 0);
  const embedded = createReferenceEnvironmentAdapter().translate({ intent: 'Review the current diff for correctness', session: { id: 'embedded-session', resumable: true } });
  assert.equal(embedded.environment.session.sessionId, 'embedded-session');
});

test('canonical consumer code has no client-conditioned orchestration policy', () => {
  const sourcePath = new URL('./universal-consumer-contract.mjs', import.meta.url).pathname;
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.deepEqual(validateConsumerIndependence([{ path: sourcePath, text: source }]), []);
  assert(validateConsumerIndependence([{ path: 'fixture', text: "if (consumer === 'codex') route = 'code';" }]).length > 0);
});

test('semantic projection excludes consumer serialization details', () => {
  const a = createReferenceEnvironmentAdapter({ environmentId: 'alpha' });
  const b = createReferenceEnvironmentAdapter({ environmentId: 'beta' });
  const catalog = createCapabilityCatalog({ repoRoot });
  const first = orchestrateBrainRequest(a.translate({ message: 'Improve authentication security in the codebase' }), { catalog, repoRoot });
  const second = orchestrateBrainRequest(b.translate({ content: 'Improve authentication security in the codebase' }), { catalog, repoRoot });
  assert.deepEqual(semanticProjection(first), semanticProjection(second));
  assert.equal(first.receipt.requestHash, second.receipt.requestHash);
});

test('dormant specialists remain descriptor-discoverable and load only after semantic selection', () => {
  const adapter = createReferenceEnvironmentAdapter();
  const catalog = createCapabilityCatalog({ repoRoot });
  const result = adapter.consume('Fix the code root cause and plan the architecture', {}, { catalog, repoRoot });
  const selected = result.receipt.semantic.route.specialists;
  assert(selected.includes('skill.investigate') || selected.includes('skill.plan-eng-review'));
  assert.equal(result.validation.valid, true);
  assert.equal(result.receipt.rawPromptStored, false);
});
