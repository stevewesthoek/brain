import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_MODE_MODEL_ROUTES, type ModelGateway } from '../agent-mode/model-gateway.js';
import { loadJarvisProductionRuntimeConfiguration } from '../agent-mode/jarvis-production-runtime.js';

const ENV_KEYS = [
  'BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME',
  'BRAIN_AGENT_MODE_ENABLE_CLAUDE_CODE',
  'BRAIN_CLAUDE_CODE_BIN',
  'BRAIN_AGENT_MODE_ACCOUNT_REF',
  'BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON',
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => void): void {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('runtime availability cannot admit Opus while canonical cost is unknown', () => {
  withEnv({
    BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME: '1',
    BRAIN_AGENT_MODE_ENABLE_CLAUDE_CODE: '1',
    BRAIN_CLAUDE_CODE_BIN: '/usr/bin/env',
  }, () => {
    const config = loadJarvisProductionRuntimeConfiguration('2026-09-23T12:00:00.000Z');
    assert.ok(config);
    assert.equal(config.runtimeAvailableModels?.has('agent-mode/claude-opus-4.6'), true);
    assert.equal(config.availableModels.has('agent-mode/claude-opus-4.6'), false);
    assert.deepEqual(config.modelAdmissions?.find((entry) => entry.modelRef === 'agent-mode/claude-opus-4.6'), {
      modelRef: 'agent-mode/claude-opus-4.6', runtimeAvailable: true, autoAdmitted: false, reasonCode: 'cost_unknown',
    });
  });
});

test('verified runtime/evidence and known cost keep MiniMax and GLM in Auto', () => {
  const now = '2026-09-23T12:00:00.000Z';
  const evidence = Object.fromEntries((['agent-mode/minimax-m2.5', 'agent-mode/glm-5'] as const).map((modelRef) => {
    const route = AGENT_MODE_MODEL_ROUTES[modelRef].routes[0]!;
    return [modelRef, {
      version: 'test-evidence-v1', accountRef: 'account:test', region: 'us-east-1', modelRef,
      modelId: AGENT_MODE_MODEL_ROUTES[modelRef].modelId, routeKind: route.kind, routeId: route.id,
      state: 'verified', catalogVisible: true, callable: true, checkedAt: '2026-09-23T11:00:00.000Z',
      freshUntil: '2026-09-23T13:00:00.000Z', source: 'deterministic-test',
    }];
  }));
  const gateway = { invoke: async () => { throw new Error('gateway must not be invoked'); } } as ModelGateway;
  withEnv({
    BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME: '1',
    BRAIN_AGENT_MODE_ACCOUNT_REF: 'account:test',
    BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON: JSON.stringify(evidence),
  }, () => {
    const config = loadJarvisProductionRuntimeConfiguration(now, gateway);
    assert.ok(config);
    assert.deepEqual([...config.availableModels].sort(), ['agent-mode/glm-5', 'agent-mode/minimax-m2.5']);
    assert.equal(config.runtimeAvailableModels?.size, 2);
  });
});
