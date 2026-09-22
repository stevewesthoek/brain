import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfiguredJarvisSystemOneReflexService, JarvisSystemOneReflexService } from '../agent-mode/jarvis-system-one-reflex.js';

test('Jarvis reflex preserves original text and remains OFF by default', async () => {
  const service = new JarvisSystemOneReflexService({ mode: 'OFF' });
  const result = await service.preflight({ text: 'Please inspect this bounded request.' });
  assert.equal(result.status, 'off');
  assert.equal(result.actualRouteModelRef, null);
  assert.equal(result.originalRequestHash.length, 64);
});

test('Jarvis reflex uses only the closed Auto candidate set and keeps postflight advisory', async () => {
  const service = new JarvisSystemOneReflexService({
    mode: 'ACTIVE_PILOT',
    runtimeFacts: { available: ['agent-mode/minimax-m2.5', 'agent-mode/glm-5'], policyVersion: 'test-policy-v1' },
    client: async (request) => {
      if (request.questions.result_quality) return { ok: true, model: 'jev-1.13.0', answer: { type: 'choice', choice: 'sufficient', confidence: 0.9, probabilities: { sufficient: 0.9, escalate: 0.1 } }, usage: { input_tokens: 10, output_tokens: 2 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' } };
      const answers = Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: 'choice' as const, choice: id === 'model_candidate' ? 'agent-mode/minimax-m2.5' : id === 'skill_candidate' ? 'none' : id === 'context_candidate' ? 'none' : id === 'capability_hint' || id === 'risk_signal' ? 'none' : id === 'intent' ? 'task' : id === 'interaction_mode' ? 'task' : id === 'complexity' ? 'simple' : id === 'clarification_need' ? 'none' : id === 'deep_reasoning_need' ? 'none' : id === 'expensive_model_need' ? 'none' : 'recommended', confidence: 0.9, probabilities: { none: 0.9, task: 0.9, simple: 0.9, 'agent-mode/minimax-m2.5': 0.9, recommended: 0.9 } }]));
      return { ok: true, model: 'jev-1.13.0', answers, usage: { input_tokens: 30, output_tokens: 10 }, cost: { amountUsd: 0.000002, basis: 'token_calculated' } };
    },
  });
  const preflight = await service.preflight({ text: 'Do the bounded task.', candidateSkills: [{ id: 'review' }], candidateContexts: [{ id: 'repo-status' }, { id: 'roadmap' }], actualRouteModelRef: 'agent-mode/minimax-m2.5' });
  assert.equal(preflight.originalRequestHash.length, 64);
  assert.equal(preflight.recommendation?.modelRef, 'agent-mode/minimax-m2.5');
  const postflight = await service.postflight({ originalRequestHash: preflight.originalRequestHash, resultFacts: { status: 'completed', evidenceCount: 1 } });
  assert.equal(postflight.status, 'verified');
});

test('Jarvis reflex only presents currently admitted runtime models to Jev', async () => {
  let candidateModels: readonly string[] = [];
  const service = new JarvisSystemOneReflexService({
    mode: 'ACTIVE_PILOT',
    runtimeFacts: { available: ['agent-mode/minimax-m2.5', 'agent-mode/glm-5'], policyVersion: 'test-policy-v1' },
    client: async (request) => {
      const state = request.state as { candidates?: { models?: readonly string[] } };
      candidateModels = state.candidates?.models ?? [];
      return { ok: false, reasonCode: 'test-stop' };
    },
  });
  await service.preflight({ text: 'Choose the best admitted route.' });
  assert.deepEqual(candidateModels, ['agent-mode/minimax-m2.5', 'agent-mode/glm-5']);
});

test('simple turns bypass Jev and expose a deterministic skip reason', async () => {
  let calls = 0;
  const service = new JarvisSystemOneReflexService({
    mode: 'ACTIVE_PILOT',
    runtimeFacts: { available: ['agent-mode/minimax-m2.5', 'agent-mode/glm-5'], policyVersion: 'test-policy-v1' },
    client: async () => { calls += 1; return { ok: false, reasonCode: 'must-not-call' }; },
  });
  const result = await service.preflight({ text: 'hello', requestedModel: 'auto' });
  assert.equal(result.reasonCode, 'REFLEX_SKIPPED_SIMPLE_TURN');
  assert.equal(result.status, 'fallback');
  assert.equal(calls, 0);
});

test('configured foreground seam remains absent unless an explicit mode and bridge are present', () => {
  const previousMode = process.env.BRAIN_JEV_REFLEX_MODE;
  const previousBridge = process.env.BRAIN_JEV_BRIDGE_PATH;
  try {
    delete process.env.BRAIN_JEV_REFLEX_MODE;
    delete process.env.BRAIN_JEV_BRIDGE_PATH;
    assert.equal(createConfiguredJarvisSystemOneReflexService(), undefined);
    process.env.BRAIN_JEV_REFLEX_MODE = 'SHADOW';
    process.env.BRAIN_JEV_BRIDGE_PATH = '/definitely/missing/brain-jev.mjs';
    assert.equal(createConfiguredJarvisSystemOneReflexService(), undefined);
  } finally {
    if (previousMode === undefined) delete process.env.BRAIN_JEV_REFLEX_MODE; else process.env.BRAIN_JEV_REFLEX_MODE = previousMode;
    if (previousBridge === undefined) delete process.env.BRAIN_JEV_BRIDGE_PATH; else process.env.BRAIN_JEV_BRIDGE_PATH = previousBridge;
  }
});
