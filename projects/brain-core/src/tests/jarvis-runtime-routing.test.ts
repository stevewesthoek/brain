import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_MODE_PRICING } from '../agent-mode/model-tier-policy.js';
import { classifyJarvisCapabilityTier, classifyJarvisTurn, deriveJarvisModelAdmissions, resolveJarvisRuntimeRoute, JARVIS_AUTO_MODEL_CANDIDATES } from '../agent-mode/jarvis-runtime-routing.js';

test('Jarvis Auto is closed to the permitted candidate set and never falls back to Codex', () => {
  assert.deepEqual(JARVIS_AUTO_MODEL_CANDIDATES, ['agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6']);
  assert.deepEqual(resolveJarvisRuntimeRoute({ requestedModel: 'auto' }), { ok: false, reasonCode: 'AUTO_RUNTIME_UNAVAILABLE' });
  const fixture = resolveJarvisRuntimeRoute({ requestedModel: 'auto', fixtureRuntimeAvailable: true });
  assert.equal(fixture.ok, true);
  if (fixture.ok) {
    assert.equal(fixture.route.modelRef, 'agent-mode/minimax-m2.5');
    assert.equal(fixture.route.runtimeRef, 'runtime:mock-k0-4');
    assert.notEqual(fixture.route.runtimeRef, 'runtime:codex-cli');
  }
  assert.deepEqual(resolveJarvisRuntimeRoute({ requestedModel: 'agent-mode/claude-opus-4.6' }), { ok: false, reasonCode: 'AUTO_RUNTIME_UNAVAILABLE' });
});

test('Codex requires an explicit bounded escalation and is not mislabeled as a cloud model', () => {
  assert.deepEqual(resolveJarvisRuntimeRoute({ requestedModel: 'codex', fixtureRuntimeAvailable: true }), { ok: false, reasonCode: 'CODEX_ESCALATION_REQUIRED' });
  const result = resolveJarvisRuntimeRoute({ requestedModel: 'codex', codexEscalation: { runtime: 'codex-cli', reason: 'bounded review', requestedCapability: 'read-only repository inspection', approvalId: 'approval:test', approvedBy: 'operator:test' } });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.route.source, 'codex-escalation');
    assert.equal(result.route.runtimeRef, 'runtime:codex-cli');
    assert.equal(result.route.modelRef, undefined);
  }
});

test('production Auto routes only to explicitly available permitted runtimes', () => {
  const available = new Set(['agent-mode/glm-5'] as const);
  const result = resolveJarvisRuntimeRoute({ requestedModel: 'auto', productionRuntimeAvailable: available });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.route.modelRef, 'agent-mode/glm-5');
    assert.equal(result.route.runtimeRef, 'runtime:model-gateway');
  }
  const opus = resolveJarvisRuntimeRoute({ requestedModel: 'agent-mode/claude-opus-4.6', productionRuntimeAvailable: new Set(['agent-mode/claude-opus-4.6']) });
  assert.deepEqual(opus, { ok: false, reasonCode: 'MODEL_COST_UNKNOWN' });
  assert.deepEqual(resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Implement a complex feature', productionRuntimeAvailable: new Set(['agent-mode/claude-opus-4.6']) }), { ok: false, reasonCode: 'AUTO_COST_ADMISSION_DENIED' });
  assert.deepEqual(resolveJarvisRuntimeRoute({ requestedModel: 'auto', productionRuntimeAvailable: new Set() }), { ok: false, reasonCode: 'AUTO_RUNTIME_UNAVAILABLE' });
});

test('canonical candidate admission separates runtime availability from cost policy', () => {
  const admissions = deriveJarvisModelAdmissions(new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6']));
  assert.deepEqual(admissions.map(({ modelRef, runtimeAvailable, autoAdmitted, reasonCode }) => ({ modelRef, runtimeAvailable, autoAdmitted, reasonCode })), [
    { modelRef: 'agent-mode/minimax-m2.5', runtimeAvailable: true, autoAdmitted: true, reasonCode: null },
    { modelRef: 'agent-mode/glm-5', runtimeAvailable: true, autoAdmitted: true, reasonCode: null },
    { modelRef: 'agent-mode/claude-opus-4.6', runtimeAvailable: true, autoAdmitted: false, reasonCode: 'cost_unknown' },
  ]);
  const unavailable = deriveJarvisModelAdmissions(new Set());
  assert.equal(unavailable.every((candidate) => !candidate.autoAdmitted && candidate.reasonCode === 'runtime_unavailable'), true);
});
test('simple Auto turns use the admitted fast path and never fall through to Opus', () => {
  assert.equal(classifyJarvisTurn('hi'), 'simple');
  assert.equal(classifyJarvisTurn('Inspect the repository at a high level; do not modify anything.'), 'moderate');
  assert.equal(classifyJarvisTurn('Design and implement a durable migration plan.'), 'complex');
  const simple = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'hello', productionRuntimeAvailable: new Set(['agent-mode/claude-opus-4.6']) });
  assert.deepEqual(simple, { ok: false, reasonCode: 'AUTO_COST_ADMISSION_DENIED' });
  const fast = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'hello', productionRuntimeAvailable: new Set(['agent-mode/glm-5', 'agent-mode/claude-opus-4.6']) });
  assert.equal(fast.ok, true);
  if (fast.ok) {
    assert.equal(fast.route.modelRef, 'agent-mode/glm-5');
    assert.equal(fast.route.selectionReason, 'fast-path');
  }
});

test('minimum-capable model tiers route trivial and normal to MiniMax, reasoning to GLM, and high work safely', () => {
  assert.equal(AGENT_MODE_PRICING['agent-mode/minimax-m2.5'].inputPerMillionUsd! <= AGENT_MODE_PRICING['agent-mode/glm-5'].inputPerMillionUsd!, true);
  assert.equal(AGENT_MODE_PRICING['agent-mode/minimax-m2.5'].outputPerMillionUsd! <= AGENT_MODE_PRICING['agent-mode/glm-5'].outputPerMillionUsd!, true);
  const all = new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6'] as const);
  assert.equal(classifyJarvisCapabilityTier('hi'), 'trivial');
  assert.equal(classifyJarvisCapabilityTier('thanks'), 'trivial');
  assert.equal(classifyJarvisCapabilityTier('Summarize this short paragraph.'), 'normal');
  assert.equal(classifyJarvisCapabilityTier('Compare these three modules and identify the likely race condition.'), 'reasoning');
  assert.equal(classifyJarvisCapabilityTier('Design and implement a durable migration plan.'), 'high');

  for (const requestText of ['hi', 'thanks', 'Summarize this short paragraph.']) {
    const result = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText, adaptiveRouting: true, productionRuntimeAvailable: all });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.route.modelRef, 'agent-mode/minimax-m2.5');
  }
  const reasoning = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Compare these three modules and identify the likely race condition.', productionRuntimeAvailable: all });
  assert.equal(reasoning.ok, true);
  if (reasoning.ok) assert.equal(reasoning.route.modelRef, 'agent-mode/glm-5');

  // Opus is runtime-present but cannot be admitted while canonical pricing is unknown.
  // High-tier routing therefore falls back only to the admitted GLM route.
  const high = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Design and implement a durable migration plan.', productionRuntimeAvailable: all });
  assert.equal(high.ok, true);
  if (high.ok) assert.equal(high.route.modelRef, 'agent-mode/glm-5');
  const noGlmForReasoning = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Compare these three modules and identify the likely race condition.', productionRuntimeAvailable: new Set(['agent-mode/minimax-m2.5']) });
  assert.deepEqual(noGlmForReasoning, { ok: false, reasonCode: 'AUTO_RUNTIME_UNAVAILABLE' });
  const trivialFallback = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'hi', productionRuntimeAvailable: new Set(['agent-mode/glm-5']) });
  assert.equal(trivialFallback.ok, true);
  if (trivialFallback.ok) assert.equal(trivialFallback.route.modelRef, 'agent-mode/glm-5');
});
