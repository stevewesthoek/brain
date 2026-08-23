import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AISelectionOutcomeError,
  selectAI,
} from '../adapters/ai-model-selector.js';
import {
  normalizeAiModelSelectionRequest,
  selectAiModel,
} from '../adapters/ai-model-selector-service.js';

type FakeResponse = {
  status: number;
  body: Record<string, unknown>;
};

async function withFakeFetch<T>(
  response: FakeResponse,
  callback: (requests: Array<Record<string, unknown>>) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input, init) => {
    if (typeof init?.body === 'string') requests.push(JSON.parse(init.body) as Record<string, unknown>);
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    return await callback(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const SELECTED = {
  outcome: 'selected',
  provider_id: 'codex-cli',
  model: 'gpt-test',
  base_url: '',
  api_key: null,
  reason: 'test selection',
  cost_estimate: 0,
  timeout_inference_sec: 30,
} as const;

test('selectAI preserves selected compatibility fields and adds outcome', async () => {
  const result = await withFakeFetch({ status: 200, body: SELECTED }, async () => selectAI('metadata_generation'));
  assert.equal(result.outcome, 'selected');
  assert.equal(result.providerId, 'codex-cli');
  assert.equal(result.model, 'gpt-test');
});

test('selectAI raises a typed deferred outcome without exposing a provider/model', async () => {
  await withFakeFetch({
    status: 200,
    body: { outcome: 'deferred', deferred: true, scheduled_after: '2026-08-24T01:00:00Z', reason: 'batch window' },
  }, async () => {
    await assert.rejects(
      selectAI('metadata_generation'),
      (error: unknown) => error instanceof AISelectionOutcomeError
        && error.outcome === 'deferred'
        && error.details.scheduled_after === '2026-08-24T01:00:00Z',
    );
  });
});

test('selectAI distinguishes unavailable and rejected HTTP outcomes', async () => {
  await withFakeFetch({ status: 503, body: { outcome: 'unavailable', error: 'no eligible provider' } }, async () => {
    await assert.rejects(
      selectAI('metadata_generation'),
      (error: unknown) => error instanceof AISelectionOutcomeError && error.outcome === 'unavailable',
    );
  });
  await withFakeFetch({ status: 400, body: { outcome: 'rejected', error: 'unknown task_type' } }, async () => {
    await assert.rejects(
      selectAI('unknown_task'),
      (error: unknown) => error instanceof AISelectionOutcomeError && error.outcome === 'rejected',
    );
  });
});

test('legacy selector request maps only the task identifier to task_type', () => {
  const normalized = normalizeAiModelSelectionRequest({
    task: 'metadata_generation',
    capability: 'text/medium',
    complexity: 'medium',
    sensitivity: 'low',
  });
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.deepEqual(normalized.body, { task_type: 'metadata_generation' });
    assert.equal('task' in normalized.body, false);
    assert.equal('capability' in normalized.body, false);
  }
});

test('canonical private maintenance task preserves explicit Bedrock-only constraints', () => {
  const normalized = normalizeAiModelSelectionRequest({
    task_type: 'mind_maintenance_semantic_comparison',
    taskMetadata: {
      private: true,
      sensitive: true,
      allowed_providers: ['claude-bedrock'],
      allowed_models: ['us.anthropic.claude-sonnet-4-6'],
      preferred_providers: ['claude-bedrock'],
      preferred_models: ['us.anthropic.claude-sonnet-4-6'],
      fallback_policy: 'none',
    },
  });
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.equal(normalized.body.task_type, 'mind_maintenance_semantic_comparison');
    assert.deepEqual(normalized.body.task_metadata, {
      private: true,
      sensitive: true,
      allowed_providers: ['claude-bedrock'],
      allowed_models: ['us.anthropic.claude-sonnet-4-6'],
      preferred_providers: ['claude-bedrock'],
      preferred_models: ['us.anthropic.claude-sonnet-4-6'],
      fallback_policy: 'none',
    });
  }
});

test('ambiguous or free-form legacy requests are rejected before fetch', async () => {
  const ambiguous = normalizeAiModelSelectionRequest({
    task: 'mind-maintenance-semantic-comparison',
    capability: 'bounded-semantic-classification',
    complexity: 'medium',
    sensitivity: 'high',
  });
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) {
    assert.equal(ambiguous.result.outcome, 'rejected');
    assert.match(ambiguous.result.reason, /registered task_type|free-form/i);
  }

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch must not be called for an ambiguous request');
  }) as typeof fetch;
  try {
    const result = await selectAiModel({ capability: 'text/medium' });
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
});

test('legacy model aliases normalize through the admitted registry', () => {
  const normalized = normalizeAiModelSelectionRequest({
    task_type: 'description_quality_review',
    provider_id: 'claude-bedrock',
    preferred_model: 'claude-sonnet-4-6',
  });
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.deepEqual(normalized.body, {
      task_type: 'description_quality_review',
      task_metadata: {
        preferred_providers: ['claude-bedrock'],
        preferred_models: ['us.anthropic.claude-sonnet-4-6'],
      },
    });
  }
});

test('retired or evaluated model references fail closed', () => {
  const normalized = normalizeAiModelSelectionRequest({
    task_type: 'description_quality_review',
    provider_id: 'claude-bedrock',
    model_id: 'claude-opus-4-7',
  });
  assert.equal(normalized.ok, false);
  if (!normalized.ok) assert.match(normalized.result.reason, /lifecycle state "evaluated"/);
});

test('ambiguous model aliases fail closed without a provider constraint', () => {
  const normalized = normalizeAiModelSelectionRequest({
    task_type: 'subtitle_generation',
    model_id: 'large-v3',
  });
  assert.equal(normalized.ok, false);
  if (!normalized.ok) assert.match(normalized.result.reason, /ambiguous across providers/);
});

test('service client normalizes legacy requests and preserves all selector outcomes', async () => {
  const selected = await withFakeFetch({ status: 200, body: SELECTED }, async (requests) => {
    const result = await selectAiModel({ task: 'metadata_generation', sensitivity: 'low' });
    assert.deepEqual(requests[0], { task_type: 'metadata_generation' });
    return result;
  });
  assert.equal(selected.outcome, 'selected');
  assert.equal(selected.selectedModel, 'gpt-test');

  const deferred = await withFakeFetch({
    status: 200,
    body: { outcome: 'deferred', scheduled_after: '2026-08-24T01:00:00Z', reason: 'batch window' },
  }, async () => selectAiModel({ task_type: 'metadata_generation' }));
  assert.equal(deferred.outcome, 'deferred');
  assert.equal(deferred.selectedModel, null);

  const unavailable = await withFakeFetch({ status: 503, body: { outcome: 'unavailable', error: 'no provider' } }, async () => selectAiModel({ task_type: 'metadata_generation' }));
  assert.equal(unavailable.outcome, 'unavailable');
  assert.equal(unavailable.provider, null);

  const rejected = await withFakeFetch({ status: 400, body: { outcome: 'rejected', error: 'unknown task_type' } }, async () => selectAiModel({ task_type: 'unknown_task' }));
  assert.equal(rejected.outcome, 'rejected');
  assert.equal(rejected.ok, false);
});
