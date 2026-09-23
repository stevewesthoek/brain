import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyJarvisTurn, deriveJarvisModelAdmissions, resolveJarvisRuntimeRoute, JARVIS_AUTO_MODEL_CANDIDATES } from '../agent-mode/jarvis-runtime-routing.js';

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

test('candidate adaptive routing creates a bounded quality-tier baseline without making Auto permanently Opus', () => {
  const moderate = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Inspect the repository and explain the relevant implementation.', adaptiveRouting: true, productionRuntimeAvailable: new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6']) });
  assert.equal(moderate.ok, true);
  if (moderate.ok) {
    assert.equal(moderate.route.modelRef, 'agent-mode/glm-5');
    assert.equal(moderate.route.selectionReason, 'adaptive-quality-tier');
  }
  const complex = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'Design and implement a durable migration plan.', adaptiveRouting: true, productionRuntimeAvailable: new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6']) });
  assert.equal(complex.ok, true);
  if (complex.ok) assert.equal(complex.route.modelRef, 'agent-mode/glm-5');
  const simple = resolveJarvisRuntimeRoute({ requestedModel: 'auto', requestText: 'hello', adaptiveRouting: true, productionRuntimeAvailable: new Set(['agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6']) });
  assert.equal(simple.ok, true);
  if (simple.ok) assert.equal(simple.route.modelRef, 'agent-mode/minimax-m2.5');
});
