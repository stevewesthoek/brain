import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const portfolioPath = path.resolve(
  new URL('../../../../operations/system-configs/model-selector/config/agent-mode-model-portfolio.json', import.meta.url).pathname,
);

test('Agent Mode portfolio records the verified K1.1 Bedrock ladder without enabling K1.2 selection', () => {
  const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8')) as {
    provider_id: string;
    live_enabled: boolean;
    access_state: string;
    access_evidence_version: string;
    models: Array<{
      registry_model_id: string;
      model_id: string;
      role: string;
      rank: number;
      selection_enabled: boolean;
      max_context_tokens: number;
      max_output_tokens: number;
      access: {
        region: string;
        route_kind: string;
        route_id: string;
        catalog_visible: boolean;
        callable: boolean;
      };
    }>;
  };

  assert.equal(portfolio.provider_id, 'amazon-bedrock');
  assert.equal(portfolio.live_enabled, true);
  assert.equal(portfolio.access_state, 'verified');
  assert.equal(portfolio.access_evidence_version, 'agent-mode-access-evidence-v1');
  assert.deepEqual(
    portfolio.models.map((model) => [model.registry_model_id, model.model_id, model.role, model.rank, model.selection_enabled, model.max_context_tokens, model.max_output_tokens, model.access.route_kind, model.access.route_id, model.access.catalog_visible, model.access.callable]),
    [
      ['agent-mode/minimax-m2.5', 'minimax.minimax-m2.5', 'worker', 10, false, 196000, 8000, 'direct', 'minimax.minimax-m2.5', true, true],
      ['agent-mode/glm-5', 'zai.glm-5', 'senior', 20, false, 200000, 128000, 'direct', 'zai.glm-5', true, true],
      ['agent-mode/claude-opus-4.6', 'us.anthropic.claude-opus-4-6-v1', 'principal', 30, false, 1000000, 128000, 'inference-profile', 'us.anthropic.claude-opus-4-6-v1', true, true],
    ],
  );
});
