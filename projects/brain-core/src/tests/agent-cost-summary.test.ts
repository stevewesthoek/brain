import assert from 'node:assert/strict';
import test from 'node:test';
import { readAgentCostSummary, saveAgentCostSummarySnapshot } from '../adapters/agent-cost-summary.js';
import { evaluateBudgetStatus, saveCostBudgetSummary } from '../adapters/cost-budgets.js';
import { describeRouteLineItem, selectModelRouteSnapshot } from '../adapters/model-routing-policy.js';

test('selectModelRouteSnapshot prefers the cheapest capable local surface first', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't1',
      taskType: 'metadata_generation',
      inputTokens: 8000,
      urgent: false,
      contextBreadth: 'medium',
      qualityPriority: 'balanced',
    },
    [
      { id: 'ai.ollama-m4pro', enabled: true, priority: 1, capabilities: ['text/small', 'text/medium', 'text/large'] },
      { id: 'ai.codex-cli', enabled: true, priority: 3, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
    ],
  );

  assert.equal(route.surface, 'ollama-m4pro');
  assert.equal(route.providerId, 'ollama-m4pro');
  assert.equal(route.estimatedCostUsd, 0);
  assert.ok(route.rationale.length > 0);
});

test('describeRouteLineItem preserves route metadata', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't2',
      taskType: 'description_quality_review',
      inputTokens: 4000,
      urgent: false,
      contextBreadth: 'narrow',
      qualityPriority: 'quality',
    },
    [
      { id: 'ai.ollama-m4pro', enabled: true, priority: 1, capabilities: ['text/small', 'text/medium', 'text/large'] },
      { id: 'ai.claude-bedrock', enabled: true, priority: 4, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
    ],
  );
  const item = describeRouteLineItem(route, {
    taskId: 't2',
    taskType: 'description_quality_review',
    inputTokens: 4000,
    urgent: false,
    contextBreadth: 'narrow',
    qualityPriority: 'quality',
  });

  assert.equal(item.taskId, 't2');
  assert.equal(item.surface, route.surface);
  assert.equal(item.routingReason, route.rationale);
});

test('selectModelRouteSnapshot prefers Bedrock value portfolio before Codex when local is unavailable', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't-bedrock',
      taskType: 'description_quality_review',
      inputTokens: 12000,
      urgent: true,
      contextBreadth: 'medium',
      qualityPriority: 'quality',
    },
    [
      { id: 'ai.ollama-m4pro', enabled: false, priority: 1, capabilities: ['text/small', 'text/medium', 'text/large'] },
      { id: 'ai.claude-bedrock', enabled: true, priority: 3, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
      { id: 'ai.codex-cli', enabled: true, priority: 4, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
    ],
  );

  assert.equal(route.surface, 'claude-bedrock');
  assert.equal(route.model, 'qwen.qwen3-coder-next');
  assert.match(route.rationale, /Bedrock value portfolio/);
});

test('selectModelRouteSnapshot uses Nemotron as the general Bedrock value model', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't-nemotron',
      taskType: 'transcript_summarization',
      inputTokens: 30000,
      urgent: true,
      contextBreadth: 'wide',
      qualityPriority: 'balanced',
    },
    [
      { id: 'ai.ollama-m4pro', enabled: false, priority: 1, capabilities: ['text/small', 'text/medium', 'text/large'] },
      { id: 'ai.claude-bedrock', enabled: true, priority: 3, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
      { id: 'ai.codex-cli', enabled: true, priority: 4, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] },
    ],
  );

  assert.equal(route.surface, 'claude-bedrock');
  assert.equal(route.model, 'nvidia.nemotron-super-3-120b');
});

test('budget helpers evaluate status from spend thresholds', () => {
  assert.equal(
    evaluateBudgetStatus({
      spentUsd: 2,
      warningAtUsd: 3,
      throttleAtUsd: 4,
      blockAtUsd: 5,
    }),
    'ok',
  );
  assert.equal(
    evaluateBudgetStatus({
      spentUsd: 3,
      warningAtUsd: 3,
      throttleAtUsd: 4,
      blockAtUsd: 5,
    }),
    'warning',
  );
  assert.equal(
    evaluateBudgetStatus({
      spentUsd: 4,
      warningAtUsd: 3,
      throttleAtUsd: 4,
      blockAtUsd: 5,
    }),
    'throttled',
  );
  assert.equal(
    evaluateBudgetStatus({
      spentUsd: 5,
      warningAtUsd: 3,
      throttleAtUsd: 4,
      blockAtUsd: 5,
    }),
    'blocked',
  );
});

test('agent cost summary can be read and persisted as a snapshot', () => {
  const summary = readAgentCostSummary();
  assert.equal(summary.id, 'agent-cost-summary');
  assert.ok(summary.routeHistory.length > 0);
  assert.ok(saveAgentCostSummarySnapshot(summary));
  assert.ok(saveCostBudgetSummary(summary.budget));
});
