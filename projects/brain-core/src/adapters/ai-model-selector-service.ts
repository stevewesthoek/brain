import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const SELECTOR_URL = process.env.AI_SELECTOR_URL ?? 'http://127.0.0.1:4890';
const LAUNCHD_LABEL = 'com.office.ai-model-selector';
const PLIST_PATH = `${process.env.HOME ?? '/Users/Office'}/Library/LaunchAgents/com.office.ai-model-selector.plist`;
const HEALTH_TIMEOUT_MS = 3000;
const REPO_ROOT = process.env.BRAIN_REPO_ROOT ?? '/Users/Office/Repos/stevewesthoek/brain';
const BEDROCK_MODEL_CACHE_PATH = `${REPO_ROOT}/ai/models/bedrock-models.generated.json`;
const BEDROCK_MODEL_EXPORT_PATH = `${REPO_ROOT}/tools/scripts/bedrock-models.generated.sh`;

export interface AiModelSelectorStatus {
  running: boolean;
  healthy: boolean;
  uptime?: string | undefined;
  providers?: AiModelSelectorProvider[] | undefined;
  bedrockClaudeCode?: AiModelSelectorBedrockClaudeCode | undefined;
  error?: string | undefined;
  lastChecked: string;
}

export interface AiModelSelectorProvider {
  id: string;
  type: string;
  healthy: boolean;
  circuitState: string;
  costPer1kTokens: number;
  bedrockModels?: AiModelSelectorBedrockPortfolioModel[] | undefined;
}

export interface AiModelSelectorBedrockPortfolioModel {
  id?: string | undefined;
  label?: string | undefined;
  modelId?: string | undefined;
  region?: string | undefined;
  enabled: boolean;
  roles: string[];
  priceInputPer1m?: number | undefined;
  priceOutputPer1m?: number | undefined;
  access?: {
    available?: boolean | undefined;
    checkedAt?: number | undefined;
    error?: unknown;
  } | undefined;
  outcome?: {
    successes?: number | undefined;
    failures?: number | undefined;
    lastOutcome?: string | undefined;
    lastUpdated?: number | undefined;
  } | undefined;
}

export interface AiModelSelectorControlResult {
  success: boolean;
  action: 'start' | 'stop';
  message: string;
}

export interface AiModelSelectorHealthMatrixModel {
  provider_id: string;
  provider_type: string;
  model_id: string;
  model_key: string;
  label: string;
  enabled: boolean;
  selectable: boolean;
  status: 'ok' | 'unavailable' | 'disabled' | 'not_loaded' | string;
  capabilities: string[];
  roles: string[];
  region?: string | null | undefined;
  last_checked_at?: number | null | undefined;
  probe: {
    status: 'ok' | 'failed' | 'not_run' | string;
    checked_at?: number | null | undefined;
    error?: unknown;
    response_preview?: string | undefined;
  };
  outcome: Record<string, unknown>;
  cost: {
    input_per_1m?: number | null | undefined;
    output_per_1m?: number | null | undefined;
  };
  provider_healthy?: boolean | undefined;
  rate_limited?: boolean | undefined;
  loaded?: boolean | undefined;
}

export interface AiModelSelectorHealthMatrix {
  id: 'ai-model-selector-health-matrix';
  generated_at: string;
  status: 'ok' | 'unavailable' | string;
  probe_mode: 'cached' | 'live' | string;
  selector: {
    service: 'ai-model-selector' | string;
    port: number;
    provider_count: number;
    model_count: number;
    selectable_model_count: number;
  };
  policy: {
    selection_endpoint: 'POST /select' | string;
    health_matrix_endpoint: 'GET /health/matrix' | string;
    consumers_use_selector: boolean;
    consumer_provider_probes_allowed: boolean;
  };
  providers: unknown[];
  models: AiModelSelectorHealthMatrixModel[];
}

export interface AiModelSelectorBedrockClaudeCode {
  enabled: boolean;
  region: string;
  cachePath: string;
  exportPath: string;
  cacheExists: boolean;
  exportExists: boolean;
  generatedAt?: string | undefined;
  models?: AiModelSelectorBedrockModelMap | undefined;
  currentEnv: AiModelSelectorBedrockModelMap;
  claudeCodeVersion?: string | undefined;
  warnings: string[];
}

export interface AiModelSelectorBedrockModelMap {
  opus?: string | undefined;
  sonnet?: string | undefined;
  haiku?: string | undefined;
}

export async function getAiModelSelectorStatus(): Promise<AiModelSelectorStatus> {
  const now = new Date().toISOString();
  const bedrockClaudeCode = readBedrockClaudeCodeStatus();

  const running = isLaunchdJobRunning();

  if (!running) {
    return {
      running: false,
      healthy: false,
      bedrockClaudeCode,
      lastChecked: now,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const response = await fetch(`${SELECTOR_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        running: true,
        healthy: false,
        error: `Health endpoint returned ${response.status}`,
        bedrockClaudeCode,
        lastChecked: now,
      };
    }

    const data = await response.json() as {
      uptime?: string;
      providers?: Array<{
        id: string;
        type: string;
        healthy: boolean;
        circuit_state?: { status: string } | string;
        cost_per_1k_tokens: number;
        bedrock_models?: Array<{
          id?: string;
          label?: string;
          model_id?: string;
          region?: string;
          enabled?: boolean;
          roles?: string[];
          price_input_per_1m?: number;
          price_output_per_1m?: number;
          access?: {
            available?: boolean;
            checked_at?: number;
            error?: unknown;
          };
          outcome?: {
            successes?: number;
            failures?: number;
            last_outcome?: string;
            last_updated?: number;
          };
        }>;
      }>;
    };

    const providers: AiModelSelectorProvider[] = (data.providers ?? []).map((p) => ({
      id: p.id,
      type: p.type,
      healthy: p.healthy,
      circuitState: typeof p.circuit_state === 'object' && p.circuit_state !== null
        ? (p.circuit_state as { status: string }).status
        : String(p.circuit_state ?? 'unknown'),
      costPer1kTokens: p.cost_per_1k_tokens,
      bedrockModels: p.bedrock_models?.map((model) => ({
        id: model.id,
        label: model.label,
        modelId: model.model_id,
        region: model.region,
        enabled: Boolean(model.enabled),
        roles: model.roles ?? [],
        priceInputPer1m: model.price_input_per_1m,
        priceOutputPer1m: model.price_output_per_1m,
        access: model.access
          ? {
              available: model.access.available,
              checkedAt: model.access.checked_at,
              error: model.access.error,
            }
          : undefined,
        outcome: model.outcome
          ? {
              successes: model.outcome.successes,
              failures: model.outcome.failures,
              lastOutcome: model.outcome.last_outcome,
              lastUpdated: model.outcome.last_updated,
            }
          : undefined,
      })),
    }));

    return {
      running: true,
      healthy: true,
      uptime: data.uptime,
      providers,
      bedrockClaudeCode,
      lastChecked: now,
    };
  } catch (err) {
    return {
      running: true,
      healthy: false,
      error: err instanceof Error ? err.message : 'Unknown health check error',
      bedrockClaudeCode,
      lastChecked: now,
    };
  }
}

export async function getAiModelSelectorHealthMatrix(runProbe = false): Promise<AiModelSelectorHealthMatrix> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runProbe ? 30000 : HEALTH_TIMEOUT_MS);
  const url = `${SELECTOR_URL}/health/matrix${runProbe ? '?probe=1' : ''}`;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Health matrix endpoint returned ${response.status}`);
    }
    return await response.json() as AiModelSelectorHealthMatrix;
  } finally {
    clearTimeout(timeout);
  }
}

export function controlAiModelSelector(action: 'start' | 'stop'): AiModelSelectorControlResult {
  try {
    if (action === 'start') {
      execSync(`launchctl load -w "${PLIST_PATH}" 2>/dev/null; launchctl start "${LAUNCHD_LABEL}"`, { timeout: 5000 });
      return { success: true, action, message: 'AI Model Selector service started.' };
    } else {
      execSync(`launchctl stop "${LAUNCHD_LABEL}" 2>/dev/null; launchctl unload "${PLIST_PATH}" 2>/dev/null`, { timeout: 5000 });
      return { success: true, action, message: 'AI Model Selector service stopped.' };
    }
  } catch (err) {
    return {
      success: false,
      action,
      message: err instanceof Error ? err.message : 'Control command failed.',
    };
  }
}

function isLaunchdJobRunning(): boolean {
  try {
    const output = execSync(`launchctl list "${LAUNCHD_LABEL}" 2>/dev/null`, { encoding: 'utf8', timeout: 3000 });
    return !output.includes('Could not find');
  } catch {
    return false;
  }
}

function readBedrockClaudeCodeStatus(): AiModelSelectorBedrockClaudeCode {
  const cacheExists = existsSync(BEDROCK_MODEL_CACHE_PATH);
  const exportExists = existsSync(BEDROCK_MODEL_EXPORT_PATH);
  const warnings: string[] = [];
  let generatedAt: string | undefined;
  let models: AiModelSelectorBedrockModelMap | undefined;

  if (cacheExists) {
    try {
      const cache = JSON.parse(readFileSync(BEDROCK_MODEL_CACHE_PATH, 'utf8')) as {
        generated_at?: string;
        models?: AiModelSelectorBedrockModelMap;
      };
      generatedAt = cache.generated_at;
      models = cache.models;
    } catch (err) {
      warnings.push(`Bedrock model cache is unreadable: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  } else {
    warnings.push('Bedrock model cache is missing. Run npm run models:sync:bedrock.');
  }

  if (!exportExists) {
    warnings.push('Claude Code Bedrock export file is missing. Run npm run models:sync:bedrock.');
  }

  const currentEnv: AiModelSelectorBedrockModelMap = {
    opus: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    sonnet: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    haiku: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  };

  for (const tier of ['opus', 'sonnet', 'haiku'] as const) {
    const expected = models?.[tier];
    const actual = currentEnv[tier];
    if (expected && actual && expected !== actual) {
      warnings.push(`Current process ${envNameForTier(tier)} is stale: ${actual}`);
    }
  }

  if (process.env.CLAUDE_CODE_USE_BEDROCK !== '1') {
    warnings.push('CLAUDE_CODE_USE_BEDROCK is not enabled in the current process.');
  }

  return {
    enabled: process.env.CLAUDE_CODE_USE_BEDROCK === '1',
    region: process.env.AWS_REGION ?? 'us-east-1',
    cachePath: BEDROCK_MODEL_CACHE_PATH,
    exportPath: BEDROCK_MODEL_EXPORT_PATH,
    cacheExists,
    exportExists,
    generatedAt,
    models,
    currentEnv,
    claudeCodeVersion: readClaudeCodeVersion(),
    warnings,
  };
}

function envNameForTier(tier: keyof AiModelSelectorBedrockModelMap): string {
  switch (tier) {
    case 'opus':
      return 'ANTHROPIC_DEFAULT_OPUS_MODEL';
    case 'sonnet':
      return 'ANTHROPIC_DEFAULT_SONNET_MODEL';
    case 'haiku':
      return 'ANTHROPIC_DEFAULT_HAIKU_MODEL';
  }
}

function readClaudeCodeVersion(): string | undefined {
  try {
    return execSync('claude --version 2>/dev/null', { encoding: 'utf8', timeout: 2000 }).trim() || undefined;
  } catch {
    return undefined;
  }
}




export interface AiModelSelectionRequest {
  /** Canonical selector field. */
  task_type?: string;
  /** Legacy alias; it is accepted only as an exact task_type-shaped identifier. */
  task?: string;
  capability?: string;
  complexity?: 'low' | 'medium' | 'high';
  sensitivity?: 'low' | 'medium' | 'high';
  maxLatencyMs?: number;
  taskMetadata?: Record<string, unknown>;
}

export type AiModelSelectionOutcome = 'selected' | 'deferred' | 'unavailable' | 'rejected';

export interface AiModelSelectionResult {
  outcome: AiModelSelectionOutcome;
  ok: boolean;
  selectedModel: string | null;
  provider: string | null;
  reason: string;
  scheduledAfter?: string;
}

type NormalizedAiModelSelectionRequest =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; result: AiModelSelectionResult };

const TASK_TYPE_IDENTIFIER = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function rejectedSelection(reason: string): AiModelSelectionResult {
  return {
    outcome: 'rejected',
    ok: false,
    selectedModel: null,
    provider: null,
    reason,
  };
}

export function normalizeAiModelSelectionRequest(
  request: AiModelSelectionRequest,
): NormalizedAiModelSelectionRequest {
  const canonicalTaskType = request.task_type?.trim();
  const legacyTask = request.task?.trim();

  if (canonicalTaskType && legacyTask && canonicalTaskType !== legacyTask) {
    return { ok: false, result: rejectedSelection('task_type and legacy task identify different tasks.') };
  }

  const taskType = canonicalTaskType || legacyTask;
  if (!taskType || !TASK_TYPE_IDENTIFIER.test(taskType)) {
    return {
      ok: false,
      result: rejectedSelection(
        'A registered task_type is required; capability, complexity, sensitivity, and free-form task text cannot infer one.',
      ),
    };
  }

  if (request.complexity !== undefined && !['low', 'medium', 'high'].includes(request.complexity)) {
    return { ok: false, result: rejectedSelection('complexity must be low, medium, or high.') };
  }
  if (request.sensitivity !== undefined && !['low', 'medium', 'high'].includes(request.sensitivity)) {
    return { ok: false, result: rejectedSelection('sensitivity must be low, medium, or high.') };
  }
  if (request.maxLatencyMs !== undefined && (!Number.isFinite(request.maxLatencyMs) || request.maxLatencyMs <= 0)) {
    return { ok: false, result: rejectedSelection('maxLatencyMs must be a positive finite number.') };
  }

  const taskMetadata: Record<string, unknown> = { ...(request.taskMetadata ?? {}) };
  // Preserve the only unambiguous legacy safety signal without inventing a task profile.
  if (request.sensitivity === 'high' && taskMetadata.sensitive === undefined) taskMetadata.sensitive = true;

  return {
    ok: true,
    body: {
      task_type: taskType,
      ...(Object.keys(taskMetadata).length > 0 ? { task_metadata: taskMetadata } : {}),
    },
  };
}

function outcomeFromPayload(payload: Record<string, unknown>, status: number): AiModelSelectionOutcome {
  if (payload.outcome === 'selected' || payload.outcome === 'deferred' || payload.outcome === 'unavailable' || payload.outcome === 'rejected') {
    return payload.outcome;
  }
  if (payload.deferred === true) return 'deferred';
  if (status === 503 || status >= 500) return 'unavailable';
  if (status >= 400) return 'rejected';
  return 'selected';
}

function resultFromPayload(payload: Record<string, unknown>, status: number): AiModelSelectionResult {
  const outcome = outcomeFromPayload(payload, status);
  const reason = typeof payload.reason === 'string'
    ? payload.reason
    : typeof payload.error === 'string'
      ? payload.error
      : `AI Model Selector returned HTTP ${status}.`;
  const selectedModel = typeof payload.model === 'string'
    ? payload.model
    : typeof payload.modelId === 'string'
      ? payload.modelId
      : null;
  const provider = typeof payload.provider === 'string'
    ? payload.provider
    : typeof payload.provider_id === 'string'
      ? payload.provider_id
      : typeof payload.providerId === 'string'
        ? payload.providerId
        : null;
  const scheduledAfter = typeof payload.scheduled_after === 'string'
    ? payload.scheduled_after
    : typeof payload.scheduledAfter === 'string'
      ? payload.scheduledAfter
      : undefined;

  if (outcome === 'selected' && (!selectedModel || !provider)) {
    return rejectedSelection('AI Model Selector selected outcome did not include provider and model.');
  }

  return {
    outcome,
    ok: outcome === 'selected',
    selectedModel,
    provider,
    reason,
    ...(scheduledAfter ? { scheduledAfter } : {}),
  };
}

export async function selectAiModel(
  request: AiModelSelectionRequest,
): Promise<AiModelSelectionResult> {
  const normalized = normalizeAiModelSelectionRequest(request);
  if (!normalized.ok) return normalized.result;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${SELECTOR_URL}/select`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(normalized.body),
      signal: controller.signal,
    });

    let payload: Record<string, unknown>;
    try {
      payload = await response.json() as Record<string, unknown>;
    } catch {
      return {
        ...rejectedSelection(`AI Model Selector returned non-JSON HTTP ${response.status}.`),
        ...(response.status === 503 || response.status >= 500 ? { outcome: 'unavailable' as const } : {}),
      };
    }
    return resultFromPayload(payload, response.status);
  } catch (error) {
    return {
      outcome: 'unavailable',
      ok: false,
      selectedModel: null,
      provider: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
