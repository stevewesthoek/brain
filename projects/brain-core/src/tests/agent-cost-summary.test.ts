import assert from 'node:assert/strict';
import test from 'node:test';
import { readAgentCostSummary, saveAgentCostSummarySnapshot } from '../adapters/agent-cost-summary.js';
import { evaluateBudgetStatus, saveCostBudgetSummary } from '../adapters/cost-budgets.js';
import { describeRouteLineItem, selectModelRouteSnapshot } from '../adapters/model-routing-policy.js';

const bedrock = { id: 'ai.claude-bedrock', enabled: true, priority: 1, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review', 'text/large-context-batch'] };
const codex = { id: 'ai.codex-cli', enabled: true, priority: 2, capabilities: ['text/small', 'text/medium', 'text/large', 'text/review'] };

test('selectModelRouteSnapshot prefers Bedrock-backed Claude by default', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't1',
      taskType: 'metadata_generation',
      inputTokens: 8000,
      urgent: false,
      contextBreadth: 'medium',
      qualityPriority: 'balanced',
    },
    [bedrock, codex],
  );

  assert.equal(route.surface, 'claude-bedrock');
  assert.equal(route.providerId, 'claude-bedrock');
  assert.equal(route.profile, 'standard');
  assert.equal(route.model, undefined);
  assert.ok(route.estimatedCostUsd > 0);
  assert.match(route.rationale, /default Brain-managed text surface/);
});

test('describeRouteLineItem preserves Bedrock route metadata', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't2',
      taskType: 'description_quality_review',
      inputTokens: 4000,
      urgent: false,
      contextBreadth: 'narrow',
      qualityPriority: 'quality',
    },
    [bedrock, codex],
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
  assert.equal(item.surface, 'claude-bedrock');
  assert.equal(item.routingReason, route.rationale);
});

test('selectModelRouteSnapshot falls back to Codex when Bedrock is unavailable', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't-codex',
      taskType: 'description_quality_review',
      inputTokens: 12000,
      urgent: true,
      contextBreadth: 'medium',
      qualityPriority: 'quality',
    },
    [
      { ...bedrock, enabled: false },
      codex,
    ],
  );

  assert.equal(route.surface, 'codex-cli');
  assert.equal(route.profile, 'deep');
  assert.equal(route.model, undefined);
  assert.match(route.rationale, /secondary managed surface/);
  assert.equal(route.estimatedCostUsd, 0);
});

test('background-image text planning remains Bedrock-first', () => {
  const route = selectModelRouteSnapshot(
    {
      taskId: 't-background',
      taskType: 'background_image',
      inputTokens: 30000,
      urgent: true,
      contextBreadth: 'wide',
      qualityPriority: 'balanced',
    },
    [bedrock, codex],
  );

  assert.equal(route.surface, 'claude-bedrock');
  assert.equal(route.profile, 'standard');
  assert.equal(route.model, undefined);
});

test('budget helpers evaluate status from spend thresholds', () => {
  assert.equal(evaluateBudgetStatus({ spentUsd: 2, warningAtUsd: 3, throttleAtUsd: 4, blockAtUsd: 5 }), 'ok');
  assert.equal(evaluateBudgetStatus({ spentUsd: 3, warningAtUsd: 3, throttleAtUsd: 4, blockAtUsd: 5 }), 'warning');
  assert.equal(evaluateBudgetStatus({ spentUsd: 4, warningAtUsd: 3, throttleAtUsd: 4, blockAtUsd: 5 }), 'throttled');
  assert.equal(evaluateBudgetStatus({ spentUsd: 5, warningAtUsd: 3, throttleAtUsd: 4, blockAtUsd: 5 }), 'blocked');
});

test('agent cost summary preserves compatibility counters with zero local routes', () => {
  const summary = readAgentCostSummary();
  assert.equal(summary.id, 'agent-cost-summary');
  assert.ok(summary.routeHistory.length > 0);
  assert.equal(summary.localRouteCount, 0);
  assert.equal(summary.cheapestRouteCount, summary.subscriptionRouteCount);
  assert.equal(summary.escalatedRouteCount, summary.paidRouteCount);
  assert.ok(saveAgentCostSummarySnapshot(summary));
  assert.ok(saveCostBudgetSummary(summary.budget));
});
