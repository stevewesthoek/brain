// AI Model Selector client — TypeScript adapter for localhost:4890
//
// Active text consumers use managed-text-executor.ts. This lower-level client
// performs selection and outcome reporting only; it never executes a provider.

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

export type AISelectionOutcome = 'selected' | 'deferred' | 'unavailable' | 'rejected';

export interface AISelection {
  providerId: string;
  model: string;
  baseUrl: string;
  apiKey: string | null;
  reason: string;
  costEstimate: number;
  timeoutInferenceSec: number;
  outcome: 'selected';
}

export class AISelectionOutcomeError extends Error {
  readonly outcome: Exclude<AISelectionOutcome, 'selected'>;
  readonly details: Record<string, unknown>;

  constructor(
    outcome: Exclude<AISelectionOutcome, 'selected'>,
    reason: string,
    details: Record<string, unknown> = {},
  ) {
    super(`AI Model Selector outcome=${outcome}: ${reason}`);
    this.name = 'AISelectionOutcomeError';
    this.outcome = outcome;
    this.details = details;
  }
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
    taskMetadata?: Record<string, unknown>;
  } = {},
): Promise<AISelection> {
  const { inputTokens = 0, urgent = false, previousFailures = [], timeoutMs = 5000, taskMetadata } = options;

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
        ...(taskMetadata ? { task_metadata: taskMetadata } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error(
      `AI Model Selector unreachable at ${SELECTOR_URL} — is com.office.ai-model-selector LaunchAgent running?`,
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await resp.json() as Record<string, unknown>;
  } catch {
    throw new AISelectionOutcomeError(
      resp.status === 503 || resp.status >= 500 ? 'unavailable' : 'rejected',
      `AI Model Selector returned non-JSON HTTP ${resp.status}.`,
    );
  }

  const reportedOutcome = data.outcome;
  const outcome: AISelectionOutcome = reportedOutcome === 'deferred'
    || reportedOutcome === 'unavailable'
    || reportedOutcome === 'rejected'
    || reportedOutcome === 'selected'
    ? reportedOutcome
    : data.deferred === true
      ? 'deferred'
      : resp.status === 503 || resp.status >= 500
        ? 'unavailable'
        : resp.ok
          ? 'selected'
          : 'rejected';
  const reason = typeof data.reason === 'string'
    ? data.reason
    : typeof data.error === 'string'
      ? data.error
      : `AI Model Selector returned HTTP ${resp.status}.`;

  if (outcome !== 'selected' || !resp.ok) {
    throw new AISelectionOutcomeError(outcome === 'selected' ? 'rejected' : outcome, reason, data);
  }

  const providerId = typeof data.provider_id === 'string'
    ? data.provider_id
    : typeof data.providerId === 'string'
      ? data.providerId
      : '';
  const model = typeof data.model === 'string'
    ? data.model
    : typeof data.modelId === 'string'
      ? data.modelId
      : '';
  if (!providerId || !model) {
    throw new AISelectionOutcomeError(
      'rejected',
      'AI Model Selector selected outcome did not include provider_id and model.',
      data,
    );
  }

  return {
    providerId,
    model,
    baseUrl: typeof data.base_url === 'string' ? data.base_url : '',
    apiKey: typeof data.api_key === 'string' ? data.api_key : null,
    reason,
    costEstimate: typeof data.cost_estimate === 'number' ? data.cost_estimate : 0,
    timeoutInferenceSec: typeof data.timeout_inference_sec === 'number' ? data.timeout_inference_sec : 300,
    outcome: 'selected',
  };
}

export async function reportAIFailure(
  providerId: string,
  errorType: 'rate_limit' | 'timeout' | 'error',
  message = '',
  model?: string,
): Promise<void> {
  try {
    await fetch(`${SELECTOR_URL}/report-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: providerId, error_type: errorType, error_message: message, model }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // best-effort — never throw
  }
}

export async function reportAISuccess(providerId: string, model?: string): Promise<void> {
  try {
    await fetch(`${SELECTOR_URL}/report-success`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: providerId, model }),
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
