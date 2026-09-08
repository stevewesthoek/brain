import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_MODE_MODEL_ROUTES,
  ModelGatewayError,
  type AdmittedModelRef,
  type AdmittedModelRequest,
} from '../agent-mode/model-gateway.js';
import {
  AmazonBedrockModelGateway,
  type BedrockConverseTransport,
} from '../adapters/amazon-bedrock-model-gateway.js';

const NOW = '2026-09-08T12:00:00.000Z';
const EVIDENCE_VERSION = 'agent-mode-access-evidence-v1:2026-09-08T11:30:00.000Z';

function request(modelRef: AdmittedModelRef, overrides: Partial<AdmittedModelRequest> = {}): AdmittedModelRequest {
  const route = AGENT_MODE_MODEL_ROUTES[modelRef].routes[0];
  return {
    providerId: 'amazon-bedrock',
    modelRef,
    modelId: route.id,
    routeKind: route.kind,
    routeId: route.id,
    prompt: 'Reply with exactly: OK',
    maxTokens: 16,
    operationId: 'operation-k1-1',
    attemptId: 'attempt-k1-1',
    now: NOW,
    deadline: '2026-09-08T12:00:30.000Z',
    accessEvidence: {
      version: EVIDENCE_VERSION,
      accountRef: 'aws-account:9094••••2876',
      region: 'us-east-1',
      modelRef,
      modelId: route.id,
      routeKind: route.kind,
      routeId: route.id,
      state: 'verified',
      catalogVisible: true,
      callable: true,
      checkedAt: '2026-09-08T11:30:00.000Z',
      freshUntil: '2026-09-09T11:30:00.000Z',
      source: 'aws-cli-converse-probe',
    },
    ...overrides,
  };
}

function gateway(transport: BedrockConverseTransport) {
  return new AmazonBedrockModelGateway({
    accountRef: 'aws-account:9094••••2876',
    now: () => new Date(NOW),
    transport,
  });
}

test('uses the exact direct routes for MiniMax M2.5 and GLM-5', async () => {
  const calls: unknown[] = [];
  const result = await gateway({ converse: async (input) => {
    calls.push(input);
    return { output: { message: { content: [{ reasoningContent: { reasoningText: 'hidden' } }, { text: 'OK' }] } }, usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 }, stopReason: 'end_turn' };
  } }).invoke(request('agent-mode/minimax-m2.5'));
  await gateway({ converse: async (input) => {
    calls.push(input);
    return { output: { message: { content: [{ text: 'OK' }] } } };
  } }).invoke(request('agent-mode/glm-5'));
  assert.deepEqual(calls.map((call) => (call as { modelId: string; region: string }).modelId), ['minimax.minimax-m2.5', 'zai.glm-5']);
  assert.equal((calls[0] as { region: string }).region, 'us-east-1');
  assert.equal(result.text, 'OK');
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 2, totalTokens: 12 });
});

test('prefers the US Opus inference profile and permits its exact direct route', async () => {
  const seen: string[] = [];
  const transport: BedrockConverseTransport = { converse: async (input) => {
    seen.push(input.modelId);
    return { output: { message: { content: [{ text: 'OK' }] } } };
  } };
  const profile = request('agent-mode/claude-opus-4.6');
  const direct = request('agent-mode/claude-opus-4.6', {
    modelId: 'anthropic.claude-opus-4-6-v1',
    routeKind: 'direct',
    routeId: 'anthropic.claude-opus-4-6-v1',
    accessEvidence: {
      ...profile.accessEvidence,
      modelId: 'anthropic.claude-opus-4-6-v1',
      routeKind: 'direct',
      routeId: 'anthropic.claude-opus-4-6-v1',
    },
  });
  await gateway(transport).invoke(profile);
  await gateway(transport).invoke(direct);
  assert.deepEqual(seen, ['us.anthropic.claude-opus-4-6-v1', 'anthropic.claude-opus-4-6-v1']);
});

test('rejects arbitrary model overrides and wrong account or region evidence', async () => {
  const transport: BedrockConverseTransport = { converse: async () => ({}) };
  await assert.rejects(gateway(transport).invoke(request('agent-mode/glm-5', { modelId: 'some.other.model', routeId: 'some.other.model' })), (error: unknown) => error instanceof ModelGatewayError && error.code === 'route_invalid');
  await assert.rejects(gateway(transport).invoke(request('agent-mode/glm-5', { accessEvidence: { ...request('agent-mode/glm-5').accessEvidence, accountRef: 'aws-account:other' } })), (error: unknown) => error instanceof ModelGatewayError && error.code === 'access_denied');
  await assert.rejects(gateway(transport).invoke(request('agent-mode/glm-5', { accessEvidence: { ...request('agent-mode/glm-5').accessEvidence, region: 'eu-west-1' } })), (error: unknown) => error instanceof ModelGatewayError && error.code === 'access_denied');
});

test('rejects stale or unverified evidence before touching the transport', async () => {
  let calls = 0;
  const transport: BedrockConverseTransport = { converse: async () => { calls += 1; return {}; } };
  await assert.rejects(gateway(transport).invoke(request('agent-mode/glm-5', { accessEvidence: { ...request('agent-mode/glm-5').accessEvidence, freshUntil: NOW } })), (error: unknown) => error instanceof ModelGatewayError && error.code === 'access_denied');
  await assert.rejects(gateway(transport).invoke(request('agent-mode/glm-5', { accessEvidence: { ...request('agent-mode/glm-5').accessEvidence, state: 'unverified' } })), (error: unknown) => error instanceof ModelGatewayError && error.code === 'access_denied');
  await assert.rejects(gateway(transport).invoke(request('agent-mode/glm-5', { accessEvidence: { ...request('agent-mode/glm-5').accessEvidence, callable: false } })), (error: unknown) => error instanceof ModelGatewayError && error.code === 'access_denied');
  assert.equal(calls, 0);
});

test('normalizes final text without leaking MiniMax reasoning blocks', async () => {
  const result = await gateway({ converse: async () => ({
    output: { message: { content: [
      { reasoningContent: { reasoningText: 'private reasoning must not be final output' } },
      { text: '  final ' },
      { text: 'answer  ' },
    ] } },
    usage: { inputTokens: 4, outputTokens: 7 },
    '$metadata': { requestId: 'req-123' },
  }) }).invoke(request('agent-mode/minimax-m2.5'));
  assert.equal(result.text, 'final answer');
  assert.equal(result.requestId, 'req-123');
  assert.deepEqual(result.usage, { inputTokens: 4, outputTokens: 7, totalTokens: 11 });
});

test('classifies timeout, throttling, unavailable, and provider failures', async () => {
  const failures = [
    [{ name: 'TimeoutError' }, 'timeout'],
    [{ name: 'ThrottlingException' }, 'throttled'],
    [{ name: 'ModelNotReadyException' }, 'model_unavailable'],
    [{ name: 'InternalServerException' }, 'provider_error'],
  ] as const;
  for (const [failure, code] of failures) {
    const gatewayInstance = gateway({ converse: async () => { throw failure; } });
    await assert.rejects(gatewayInstance.invoke(request('agent-mode/glm-5')), (error: unknown) => error instanceof ModelGatewayError && error.code === code);
  }
});
