import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyReflexPilotRecommendation,
  buildReflexDecisionRequest,
  evaluateShadowReplay,
  rankAdmittedModelCandidates,
  runSystemOnePostflight,
  runSystemOnePreflight,
  deriveReflexEligibility,
  shouldRunReflexPostflight,
  summarizeReflexReplay,
} from '../agent-mode/system-one-reflex.js';

const input = {
  userRequest: 'Read the bounded repository status and explain the next safe step.',
  sessionSummary: 'A small read-only maintenance turn.',
  candidateModels: [{ id: 'agent-mode/minimax-m2.5' }, { id: 'agent-mode/glm-5' }, { id: 'codex-cli' }],
  candidateSkills: [{ id: 'brain-jev' }, { id: 'review' }],
  candidateContexts: [{ id: 'repo-status' }, { id: 'roadmap' }],
  runtimeFacts: { available: ['agent-mode/minimax-m2.5', 'agent-mode/glm-5'], policyVersion: 'test-policy-v1' },
  actualRouteModelRef: 'agent-mode/glm-5',
  mode: 'SHADOW' as const,
};

function response() {
  const answers = {
    intent: { type: 'choice' as const, choice: 'task', confidence: 0.9, probabilities: { answer: 0.1, task: 0.9 } },
    interaction_mode: { type: 'choice' as const, choice: 'review', confidence: 0.9, probabilities: { direct: 0.1, task: 0.1, review: 0.8, clarify: 0 } },
    complexity: { type: 'choice' as const, choice: 'simple', confidence: 0.9, probabilities: { simple: 0.9, moderate: 0.1, complex: 0 } },
    clarification_need: { type: 'choice' as const, choice: 'none', confidence: 0.9, probabilities: { none: 0.9, possible: 0.1, required: 0 } },
    deep_reasoning_need: { type: 'choice' as const, choice: 'none', confidence: 0.9, probabilities: { none: 0.9, possible: 0.1, required: 0 } },
    expensive_model_need: { type: 'choice' as const, choice: 'none', confidence: 0.9, probabilities: { none: 0.9, possible: 0.1, required: 0 } },
    verification_need: { type: 'choice' as const, choice: 'recommended', confidence: 0.9, probabilities: { none: 0.1, recommended: 0.8, required: 0.1 } },
    model_candidate: { type: 'choice' as const, choice: 'agent-mode/minimax-m2.5', confidence: 0.9, probabilities: { 'agent-mode/minimax-m2.5': 0.8, 'agent-mode/glm-5': 0.2 } },
    skill_candidate: { type: 'choice' as const, choice: 'review', confidence: 0.9, probabilities: { review: 0.8, 'brain-jev': 0.2 } },
    context_candidate: { type: 'choice' as const, choice: 'repo-status', confidence: 0.9, probabilities: { 'repo-status': 0.9, roadmap: 0.1 } },
  };
  return { ok: true as const, model: 'jev-1.13.0', answers, usage: { input_tokens: 120, output_tokens: 40 }, cost: { amountUsd: 0.000005, basis: 'token_calculated' as const } };
}

test('OFF mode is a deterministic no-call fallback', async () => {
  let calls = 0;
  const result = await runSystemOnePreflight({ ...input, mode: 'OFF' }, async () => { calls += 1; return response(); });
  assert.equal(result.status, 'off');
  assert.equal(result.reasonCode, 'REFLEX_DISABLED');
  assert.equal(calls, 0);
  assert.equal(result.actualRouteModelRef, input.actualRouteModelRef);
});

test('eligibility skips a single-route moderate turn without a reduction signal', () => {
  const decision = deriveReflexEligibility({ userRequest: 'Explain the bounded result.', requestedModel: 'auto', candidateModels: [{ id: 'agent-mode/minimax-m2.5' }], candidateSkills: [], candidateContexts: [{ id: 'repo' }] });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reasonCode, 'REFLEX_SKIPPED_SINGLE_ROUTE');
});

test('eligibility admits a complex turn with multiple model tiers', () => {
  const decision = deriveReflexEligibility({ userRequest: 'Architect a migration and investigate the failure modes.', requestedModel: 'auto', candidateModels: [{ id: 'agent-mode/minimax-m2.5' }, { id: 'agent-mode/glm-5' }], candidateSkills: [], candidateContexts: [] });
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.signals, ['multiple-admitted-models', 'complexity']);
});

test('eligibility skips a moderate turn when extra admitted tiers are more expensive than the current route', () => {
  const decision = deriveReflexEligibility({ userRequest: 'Explain the bounded result.', requestedModel: 'auto', candidateModels: [{ id: 'agent-mode/minimax-m2.5' }, { id: 'agent-mode/glm-5' }], candidateSkills: [], candidateContexts: [], actualRouteModelRef: 'agent-mode/minimax-m2.5' });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reasonCode, 'REFLEX_SKIPPED_NO_VALUE_SIGNAL');
});

test('eligibility skips complex turns with no cheaper route or reduction opportunity', () => {
  const decision = deriveReflexEligibility({ userRequest: 'Design a bounded read-only migration plan.', requestedModel: 'auto', candidateModels: [{ id: 'agent-mode/minimax-m2.5' }, { id: 'agent-mode/glm-5' }], candidateSkills: [], candidateContexts: [], actualRouteModelRef: 'agent-mode/minimax-m2.5' });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reasonCode, 'REFLEX_SKIPPED_NO_VALUE_SIGNAL');
});

test('eligibility skips context-comparison turns when all contexts are required', () => {
  const decision = deriveReflexEligibility({ userRequest: 'Compare the Brain and Mind repositories and explain the differences.', requestedModel: 'auto', candidateModels: [{ id: 'agent-mode/minimax-m2.5' }, { id: 'agent-mode/glm-5' }], candidateSkills: [], candidateContexts: [{ id: 'brain' }, { id: 'mind' }], actualRouteModelRef: 'agent-mode/minimax-m2.5' });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reasonCode, 'REFLEX_SKIPPED_NO_VALUE_SIGNAL');
});

test('compact reflex requests omit unavailable selection dimensions and bound text', () => {
  const request = buildReflexDecisionRequest({
    userRequest: 'x'.repeat(2_000),
    sessionSummary: 'y'.repeat(2_000),
    candidateModels: [{ id: 'agent-mode/minimax-m2.5' }],
    candidateSkills: [{ id: 'review' }],
    candidateContexts: [{ id: 'repo-status' }],
    runtimeFacts: { available: ['agent-mode/minimax-m2.5'], policyVersion: 'test-policy-v1' },
    mode: 'SHADOW',
  });
  assert.equal((request.state.task as string).length, 1_200);
  assert.equal((request.state.sessionSummary as string).length, 480);
  assert.equal('model_candidate' in request.questions, false);
  assert.equal('skill_candidate' in request.questions, false);
  assert.equal('context_candidate' in request.questions, false);
});

test('routine postflight is skipped while complex or verification-worthy turns are checked', () => {
  assert.equal(shouldRunReflexPostflight({ mode: 'ACTIVE_PILOT', status: 'recommendation', complexity: 'moderate', verificationNeed: 'none', reasonCode: null }), false);
  assert.equal(shouldRunReflexPostflight({ mode: 'ACTIVE_PILOT', status: 'recommendation', complexity: 'complex', verificationNeed: 'none', reasonCode: null }), true);
  assert.equal(shouldRunReflexPostflight({ mode: 'ACTIVE_PILOT', status: 'recommendation', complexity: 'moderate', verificationNeed: 'recommended', reasonCode: null }), true);
});

test('SHADOW mode emits a typed recommendation without changing the actual route', async () => {
  let calls = 0;
  const result = await runSystemOnePreflight(input, async (request) => {
    calls += 1;
    assert.equal(Object.keys(request.questions).length, 12);
    const candidates = request.state.candidates as { models: readonly string[] };
    assert.equal(candidates.models.includes('codex-cli'), false);
    return response();
  });
  assert.equal(result.status, 'recommendation');
  assert.equal(result.recommendation?.modelRef, 'agent-mode/minimax-m2.5');
  assert.deepEqual(result.recommendation?.skillIds, ['review']);
  assert.deepEqual(result.recommendation?.contextIds, ['repo-status']);
  assert.equal(result.actualRouteModelRef, 'agent-mode/glm-5');
  assert.equal(calls, 1);
});

test('reflex state exposes bounded candidate labels without exposing context paths', () => {
  const request = buildReflexDecisionRequest({
    ...input,
    candidateContexts: [{ id: 'context:opaque-brain', label: 'brain' }, { id: 'context:opaque-mind', label: 'mind' }],
  });
  const state = request.state as { candidates: { contexts: readonly string[] }; candidateLabels: { contexts: Readonly<Record<string, string>> } };
  assert.deepEqual(state.candidates.contexts, ['context:opaque-brain', 'context:opaque-mind']);
  assert.deepEqual(state.candidateLabels.contexts, { 'context:opaque-brain': 'brain', 'context:opaque-mind': 'mind' });
  assert.equal(JSON.stringify(request.state).includes('/Users/'), false);
});

test('ACTIVE_PILOT recommendation remains bounded by Brain-admitted candidates', async () => {
  const result = await runSystemOnePreflight({ ...input, mode: 'ACTIVE_PILOT' }, async () => response());
  assert.deepEqual(applyReflexPilotRecommendation(result, ['agent-mode/minimax-m2.5']), { modelRef: 'agent-mode/minimax-m2.5', skillIds: ['review'], contextIds: ['repo-status'] });
  assert.deepEqual(applyReflexPilotRecommendation(result, ['codex-cli']), { modelRef: null, skillIds: ['review'], contextIds: ['repo-status'] });
  assert.deepEqual(rankAdmittedModelCandidates(result, ['agent-mode/glm-5', 'agent-mode/minimax-m2.5', 'codex-cli']), ['agent-mode/minimax-m2.5', 'agent-mode/glm-5']);
});

test('provider failure falls back to the existing route without throwing', async () => {
  const result = await runSystemOnePreflight(input, async () => ({ ok: false, reasonCode: 'provider_unavailable' }));
  assert.equal(result.status, 'fallback');
  assert.equal(result.reasonCode, 'provider_unavailable');
  assert.equal(result.recommendation, null);
  assert.equal(result.actualRouteModelRef, 'agent-mode/glm-5');
});

test('low confidence falls back without altering the actual route', async () => {
  const result = await runSystemOnePreflight(input, async () => ({ ok: true, model: 'jev-1.13.0', answer: { type: 'choice', choice: 'task', confidence: 0.1, probabilities: { task: 0.1, answer: 0.9 } }, usage: { input_tokens: 10, output_tokens: 2 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' } }));
  assert.equal(result.status, 'fallback');
  assert.equal(result.reasonCode, 'REFLEX_LOW_CONFIDENCE');
  assert.equal(result.recommendation, null);
  assert.equal(result.actualRouteModelRef, 'agent-mode/glm-5');
});

test('high-confidence context selection survives unrelated low-confidence model answers', async () => {
  const result = await runSystemOnePreflight({ ...input, mode: 'ACTIVE_PILOT', actualRouteModelRef: 'agent-mode/minimax-m2.5' }, async () => {
    const answers = response().answers;
    return { ok: true, model: 'jev-1.13.0', answers: {
      ...answers,
      model_candidate: { ...answers.model_candidate, confidence: 0.3 },
      context_candidate: { ...answers.context_candidate, choice: 'repo-status', confidence: 0.8 },
      verification_need: { ...answers.verification_need, confidence: 0.2 },
    }, usage: { input_tokens: 20, output_tokens: 8 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' } };
  });
  assert.equal(result.status, 'recommendation');
  assert.equal(result.recommendation?.modelRef, null);
  assert.deepEqual(result.recommendation?.contextIds, ['repo-status']);
  assert.deepEqual(applyReflexPilotRecommendation(result, ['agent-mode/minimax-m2.5']).contextIds, ['repo-status']);
});

test('postflight is advisory and does not authorize escalation', async () => {
  const result = await runSystemOnePostflight({ originalRequestHash: 'a'.repeat(64), resultFacts: { status: 'completed', evidenceCount: 1 }, mode: 'ACTIVE_PILOT' }, async (request) => {
    assert.equal(Object.keys(request.questions).length, 1);
    return { ok: true, model: 'jev-1.13.0', answer: { type: 'choice', choice: 'escalate', confidence: 0.8, probabilities: { sufficient: 0.2, escalate: 0.8 } }, usage: { input_tokens: 20, output_tokens: 5 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' } };
  });
  assert.equal(result.status, 'escalation_advised');
  assert.equal(result.reasonCode, null);
});

test('replay summary reports routing, context, latency, tokens, and spend', () => {
  const summary = summarizeReflexReplay([
    { actualModelRef: 'a', recommendedModelRef: 'a', actualContextCount: 4, selectedContextCount: 2, baselineDownstreamInputTokens: 100, pilotDownstreamInputTokens: 60, baselineDownstreamCostUsd: 0.001, downstreamCostUsd: 0.0006, baselineSkillTokens: 80, pilotSkillTokens: 40, jevTokens: 20, jevSpendUsd: 0.000001, latencyMs: 10 },
    { actualModelRef: 'b', recommendedModelRef: 'a', actualContextCount: 2, selectedContextCount: 1, baselineDownstreamInputTokens: 80, pilotDownstreamInputTokens: 40, baselineDownstreamCostUsd: 0.0008, downstreamCostUsd: 0.0004, baselineSkillTokens: 40, pilotSkillTokens: 20, jevTokens: 24, jevSpendUsd: 0.000002, latencyMs: 20 },
  ]);
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.routingAgreement, 0.5);
  assert.equal(summary.contextReduction, 0.5);
  assert.equal(summary.downstreamTokenReductionPercent, 44.44);
  assert.equal(summary.jevTokens, 44);
  assert.equal(summary.p50LatencyMs, 10);
  assert.equal(summary.p95LatencyMs, 10);
  assert.equal(summary.baselineDownstreamCostUsd, 0.0018);
  assert.equal(summary.pilotDownstreamCostUsd, 0.001);
  assert.equal(summary.netValueUsd, 0.000797);
  assert.equal(summary.netValuePositive, true);
  assert.equal(summary.baselineSkillTokens, 120);
  assert.equal(summary.pilotSkillTokens, 60);
  assert.equal(summary.skillTokenReductionPercent, 50);
});

test('bounded shadow replay evaluates representative turns without changing routing', async () => {
  const summary = await evaluateShadowReplay([
    { input, actualModelRef: 'agent-mode/glm-5', actualContextCount: 2, downstreamInputTokens: 40, baselineDownstreamInputTokens: 80 },
    { input: { ...input, userRequest: 'Return a deterministic status.', actualRouteModelRef: 'agent-mode/minimax-m2.5' }, actualModelRef: 'agent-mode/minimax-m2.5', actualContextCount: 1, downstreamInputTokens: 30, baselineDownstreamInputTokens: 60 },
  ], async () => response());
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.routingAgreement, 0.5);
  assert.equal(summary.baselineDownstreamTokens, 140);
  assert.equal(summary.pilotDownstreamTokens, 70);
  assert.equal(summary.jevTokens, 320);
});
