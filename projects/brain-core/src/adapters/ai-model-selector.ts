// AI Model Selector client — TypeScript adapter for localhost:4890
//
// Usage:
//   import { selectAI, reportAIFailure, TASK_TYPES } from '../adapters/ai-model-selector.js';
//
//   const routing = await selectAI(TASK_TYPES.METADATA_GENERATION, { inputTokens: 8000 });
//   const client = new OpenAI({ baseURL: routing.baseUrl, apiKey: routing.apiKey ?? 'local' });
//   try {
//     const result = await client.chat.completions.create({ model: routing.model, ... });
//   } catch (err) {
//     await reportAIFailure(routing.providerId, 'error', String(err));
//     throw err;
//   }

const SELECTOR_URL = process.env.AI_SELECTOR_URL ?? 'http://localhost:4890';

export const TASK_TYPES = {
  METADATA_GENERATION: 'metadata_generation',
  THUMBNAIL_HEADLINE: 'thumbnail_headline',
  SEO_KEYWORD_EXPANSION: 'seo_keyword_expansion',
  TRANSCRIPT_SUMMARIZATION: 'transcript_summarization',
  SUBTITLE_GENERATION: 'subtitle_generation',
  BACKGROUND_IMAGE: 'background_image',
  DESCRIPTION_QUALITY_REVIEW: 'description_quality_review',
} as const;

export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES];

export interface AISelection {
  providerId: string;
  model: string;
  baseUrl: string;
  apiKey: string | null;
  reason: string;
  costEstimate: number;
}

export interface SelectorHealth {
  status: string;
  lmstudio: { healthy: boolean; loadedModels: string[] };
  providerCount: number;
}

export interface AIProvider {
  id: string;
  type: string;
  capabilities: string[];
  healthy: boolean | undefined;
  rateLimited: boolean | undefined;
  costPer1kTokens: number;
  priority: number;
}

export async function selectAI(
  taskType: string,
  options: {
    inputTokens?: number;
    urgent?: boolean;
    previousFailures?: string[];
    timeoutMs?: number;
  } = {},
): Promise<AISelection> {
  const { inputTokens = 0, urgent = false, previousFailures = [], timeoutMs = 5000 } = options;

  let resp: Response;
  try {
    resp = await fetch(`${SELECTOR_URL}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_type: taskType,
        input_token_count: inputTokens,
        urgent,
        previous_failures: previousFailures,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error(
      `AI Model Selector unreachable at ${SELECTOR_URL} — is com.office.ai-model-selector LaunchAgent running?`,
    );
  }

  if (resp.status === 503) {
    throw new Error(`No AI provider available for task=${taskType}`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`AI Model Selector error ${resp.status}: ${body}`);
  }

  const data = (await resp.json()) as {
    provider_id: string;
    model: string;
    base_url: string;
    api_key: string | null;
    reason: string;
    cost_estimate: number;
  };

  return {
    providerId: data.provider_id,
    model: data.model,
    baseUrl: data.base_url,
    apiKey: data.api_key,
    reason: data.reason,
    costEstimate: data.cost_estimate,
  };
}

export async function reportAIFailure(
  providerId: string,
  errorType: 'rate_limit' | 'timeout' | 'error',
  message = '',
): Promise<void> {
  try {
    await fetch(`${SELECTOR_URL}/report-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: providerId, error_type: errorType, error_message: message }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // best-effort — never throw
  }
}

export async function selectorHealth(): Promise<SelectorHealth> {
  const resp = await fetch(`${SELECTOR_URL}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  const data = (await resp.json()) as {
    status: string;
    lmstudio: { healthy: boolean; loaded_models: string[] };
    provider_count: number;
  };
  return {
    status: data.status,
    lmstudio: { healthy: data.lmstudio.healthy, loadedModels: data.lmstudio.loaded_models },
    providerCount: data.provider_count,
  };
}

export async function listProviders(): Promise<AIProvider[]> {
  const resp = await fetch(`${SELECTOR_URL}/providers`, {
    signal: AbortSignal.timeout(3000),
  });
  const data = (await resp.json()) as {
    providers: Array<{
      id: string;
      type: string;
      capabilities: string[];
      healthy?: boolean;
      rate_limited?: boolean;
      cost_per_1k_tokens: number;
      priority: number;
    }>;
  };
  return data.providers.map((p) => ({
    id: p.id,
    type: p.type,
    capabilities: p.capabilities,
    healthy: p.healthy,
    rateLimited: p.rate_limited,
    costPer1kTokens: p.cost_per_1k_tokens,
    priority: p.priority,
  }));
}
