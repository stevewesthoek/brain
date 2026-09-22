import assert from 'node:assert/strict';
import test from 'node:test';
import { applyJarvisReflexRoute, persistedJarvisReflexRoute, routeFromK4Assignment } from '../agent-mode/jarvis-reflex-route.js';
import { resolveJarvisRuntimeRoute } from '../agent-mode/jarvis-runtime-routing.js';
import type { TurnDecisionEnvelopeV1 } from '../agent-mode/system-one-reflex.js';

const envelope = (overrides: Partial<TurnDecisionEnvelopeV1> = {}): TurnDecisionEnvelopeV1 => ({
  schemaVersion: 'brain.system-one.turn-decision.v1',
  mode: 'ACTIVE_PILOT',
  status: 'recommendation',
  originalRequestHash: 'a'.repeat(64),
  intent: 'task',
  interactionMode: 'task',
  complexity: 'simple',
  clarificationNeed: 'none',
  requiredCapabilities: [],
  likelySkills: [],
  contextNeeds: { candidateCount: 0, selectedIds: [] },
  deepReasoningNeed: 'none',
  expensiveModelNeed: 'none',
  candidateModelScores: [],
  riskSignals: [],
  verificationNeed: 'none',
  confidence: 0.9,
  provider: { providerId: 'typesafe', model: 'jev-1.13.0' },
  usage: { inputTokens: 10, outputTokens: 2 },
  latencyMs: 10,
  cost: { amountUsd: 0.000001, basis: 'token_calculated' },
  recommendation: { modelRef: 'agent-mode/glm-5', skillIds: [], contextIds: [] },
  actualRouteModelRef: 'agent-mode/minimax-m2.5',
  reasonCode: null,
  ...overrides,
});

function currentRoute() {
  const result = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'hello', fixtureRuntimeAvailable: true });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('fixture route unavailable');
  return result.route;
}

test('ACTIVE_PILOT applies only an admitted Jev model recommendation to Auto', () => {
  const route = applyJarvisReflexRoute({
    requestedModel: 'auto',
    requestText: 'hello',
    currentRoute: currentRoute(),
    envelope: envelope(),
    availableModels: new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5']),
    fixtureRuntimeAvailable: true,
  });
  assert.equal(route.modelRef, 'agent-mode/glm-5');
  assert.equal(route.runtimeRef, 'runtime:mock-k0-4');
  assert.equal(route.source, 'auto');
});

test('ACTIVE_PILOT can lower an adaptive quality-tier baseline through the same admitted route', () => {
  const baseline = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Inspect the repository and explain the implementation.', adaptiveRouting: true, fixtureRuntimeAvailable: true });
  assert.equal(baseline.ok, true);
  if (!baseline.ok) return;
  assert.equal(baseline.route.modelRef, 'agent-mode/glm-5');
  const route = applyJarvisReflexRoute({
    requestedModel: 'auto',
    requestText: 'Inspect the repository and explain the implementation.',
    currentRoute: baseline.route,
    envelope: envelope({ complexity: 'moderate', actualRouteModelRef: 'agent-mode/glm-5', recommendation: { modelRef: 'agent-mode/minimax-m2.5', skillIds: [], contextIds: [] } }),
    availableModels: new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5']),
    fixtureRuntimeAvailable: true,
  });
  assert.equal(route.modelRef, 'agent-mode/minimax-m2.5');
  assert.equal(route.selectionReason, 'jev-cost-saving');
});

test('explicit model requests and unavailable recommendations remain unchanged', () => {
  const current = currentRoute();
  assert.equal(applyJarvisReflexRoute({ requestedModel: 'agent-mode/minimax-m2.5', requestText: 'hello', currentRoute: current, envelope: envelope(), fixtureRuntimeAvailable: true }).modelRef, current.modelRef);
  assert.equal(applyJarvisReflexRoute({ requestedModel: 'auto', requestText: 'hello', currentRoute: current, envelope: envelope(), availableModels: new Set(['agent-mode/minimax-m2.5']), fixtureRuntimeAvailable: true }).modelRef, current.modelRef);
  assert.equal(applyJarvisReflexRoute({ requestedModel: 'auto', requestText: 'hello', currentRoute: current, envelope: { ...envelope(), mode: 'SHADOW' }, fixtureRuntimeAvailable: true }).modelRef, current.modelRef);
});

test('persisted and assigned routes are bounded and deterministic', () => {
  const persisted = persistedJarvisReflexRoute({ modelRef: 'agent-mode/glm-5', runtimeRef: 'runtime:mock-k0-4', runtimeProfileRef: 'runtime-profile:mock-k0-4', source: 'auto', selectionReason: 'admitted-order', unexpectedAuthority: 'ignore' });
  assert.deepEqual(persisted, { modelRef: 'agent-mode/glm-5', runtimeRef: 'runtime:mock-k0-4', runtimeProfileRef: 'runtime-profile:mock-k0-4', source: 'auto', selectionReason: 'admitted-order' });
  assert.equal(persistedJarvisReflexRoute({ modelRef: 'shell-command', runtimeRef: 'shell', runtimeProfileRef: 'unsafe', source: 'auto' }), undefined);
  assert.deepEqual(routeFromK4Assignment({ modelRef: 'agent-mode/glm-5', runtimeRef: 'runtime:mock-k0-4', runtimeProfileRef: 'runtime-profile:mock-k0-4' }), persisted);
});
