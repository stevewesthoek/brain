import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runLiveAgentModeSlice } from '../agent-mode/live-agent-mode-slice.js';
import type { ModelGateway, NormalizedModelResult } from '../agent-mode/model-gateway.js';

const NOW = '2026-09-09T12:00:00.000Z';
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
const FIXTURE_ROOT = path.resolve(new URL('../../fixtures', import.meta.url).pathname);

function result(request: Parameters<ModelGateway['invoke']>[0], response: Partial<NormalizedModelResult>): NormalizedModelResult {
  return {
    text: '', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId,
    routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1',
    usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.00001, pricingSource: 'fixture' },
    latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version,
    operationId: request.operationId, attemptId: request.attemptId, ...response,
  };
}

test('K2.1 child Harness delegates model and one BrainNode read, then persists result across reopen', async () => {
  const root = await mkdtemp('/tmp/brain-k2-1-e2e-');
  const calls: Array<{ kind: string; messages: unknown }> = [];
  const gateway: ModelGateway = {
    invoke: async (request) => {
      calls.push({ kind: request.messages?.some((message) => message.content.some((block) => 'toolResult' in block)) ? 'follow-up' : 'initial', messages: request.messages });
      if (calls.length === 1) return result(request, { toolUses: [{ toolUseId: 'mock-read', name: 'brain_read', input: { path: 'agent-mode-k2-1-marker.txt' } }] });
      return result(request, { text: 'BRAIN_K2_1_MARKER=READ_ONLY_LIVE_SLICE_PASS' });
    },
  };
  try {
    const output = await runLiveAgentModeSlice({ databasePath: path.join(root, 'agent-mode.db'), fixtureRoot: FIXTURE_ROOT, harnessRoot: HARNESS_ROOT, now: NOW, gateway, fixtureMode: true });
    assert.equal(output.status, 'completed');
    assert.equal(output.toolCalls, 1);
    assert.equal(output.modelTurns, 2);
    assert.equal(output.finalResponse, 'BRAIN_K2_1_MARKER=READ_ONLY_LIVE_SLICE_PASS');
    assert.equal(output.restartVerified, true);
    assert.deepEqual(calls.map((call) => call.kind), ['initial', 'follow-up'], JSON.stringify(calls));
    assert.equal(output.nodeReceipt?.status, 'succeeded');
    assert.equal(output.usage.totalTokens, 40);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
