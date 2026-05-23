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
