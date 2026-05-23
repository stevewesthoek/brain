import { listAgentAiSurfaceCapabilities } from './agent-ai-surface-capability-manifest.js';
import { evaluateBudgetStatus, readCostBudgetSummary } from './cost-budgets.js';
import type {
  BrainCoreAgentCostLineItem,
  BrainCoreBudgetStatus,
  BrainCoreRouteSurface,
} from '../types/api.js';

export interface ModelRoutingPolicyInput {
  taskId: string;
  taskType: string;
  inputTokens: number;
  urgent?: boolean;
  contextBreadth?: 'narrow' | 'medium' | 'wide';
  qualityPriority?: 'speed' | 'balanced' | 'quality';
}

export interface ModelRoutingPolicyResult {
  surface: BrainCoreRouteSurface;
  providerId: string;
  model?: string;
  rationale: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
  budgetStatus: BrainCoreBudgetStatus;
  escalationReason?: string;
}

const SURFACE_PRIORITY: BrainCoreRouteSurface[] = ['ollama-m4pro', 'ollama-m1', 'claude-bedrock', 'codex-cli'];

const TASK_SURFACE_CAPABILITIES: Record<string, BrainCoreRouteSurface[]> = {
  metadata_generation: ['ollama-m4pro', 'ollama-m1', 'codex-cli', 'claude-bedrock'],
  thumbnail_headline: ['ollama-m4pro', 'ollama-m1', 'codex-cli', 'claude-bedrock'],
  seo_keyword_expansion: ['ollama-m4pro', 'ollama-m1', 'codex-cli', 'claude-bedrock'],
  transcript_summarization: ['ollama-m4pro', 'ollama-m1', 'codex-cli', 'claude-bedrock'],
  subtitle_generation: ['ollama-m4pro', 'ollama-m1', 'codex-cli', 'claude-bedrock'],
  background_image: ['ollama-m4pro', 'ollama-m1', 'claude-bedrock'],
  description_quality_review: ['ollama-m4pro', 'codex-cli', 'claude-bedrock'],
  orchestration: ['ollama-m4pro', 'codex-cli', 'claude-bedrock'],
};

export async function selectModelRoute(input: ModelRoutingPolicyInput): Promise<ModelRoutingPolicyResult> {
  const budget = readCostBudgetSummary();
  const aiSurfaceManifest = await listAgentAiSurfaceCapabilities();
  const budgetStatus = evaluateBudgetStatus(budget);
  const selected = selectModelRouteSnapshot(input, aiSurfaceManifest.capabilities as Array<{ id: string; enabled: boolean; priority: number; capabilities?: string[] }>);

  return {
    ...selected,
    budgetStatus,
  };
}

export function selectModelRouteSnapshot(
  input: ModelRoutingPolicyInput,
  capabilities: Array<{ id: string; enabled: boolean; priority: number; capabilities?: string[] }>,
): Omit<ModelRoutingPolicyResult, 'budgetStatus'> {
  const allowedSurfaces = TASK_SURFACE_CAPABILITIES[input.taskType] ?? SURFACE_PRIORITY;
  const orderedSurfaces = capabilities
    .filter((capability) => capability.enabled)
    .map((capability) => capability.id.replace(/^ai\./, '') as BrainCoreRouteSurface)
    .filter((surface) => allowedSurfaces.includes(surface))
    .sort((left, right) => SURFACE_PRIORITY.indexOf(left) - SURFACE_PRIORITY.indexOf(right));

  const surface = orderedSurfaces[0] ?? allowedSurfaces[0] ?? 'claude-bedrock';
  const providerId = surface;
  const model = surface === 'ollama-m4pro'
    ? input.inputTokens > 12000 ? 'qwen2.5:32b' : 'qwen2.5:14b'
    : surface === 'ollama-m1'
      ? input.inputTokens > 6000 ? 'qwen2.5:14b' : 'llama3.1:8b'
      : surface === 'codex-cli'
        ? input.qualityPriority === 'quality' ? 'gpt-5.5' : 'gpt-5.4-mini'
        : input.taskType === 'description_quality_review' || input.taskType === 'orchestration'
          ? 'qwen.qwen3-coder-next'
          : 'nvidia.nemotron-super-3-120b';

  const estimatedTokens = estimateTokens(input);
  const estimatedCostUsd = estimateCost(surface, estimatedTokens);
  const escalationReason = surface !== allowedSurfaces[0]
    ? `Escalated from ${allowedSurfaces[0]} to ${surface} based on capability and health ordering.`
    : undefined;
  const rationale = surface === 'ollama-m4pro'
    ? 'Cheapest capable local route selected first.'
    : surface === 'ollama-m1'
      ? 'Secondary local route selected for batch-friendly work.'
    : surface === 'codex-cli'
      ? 'Subscription-backed CLI used after local and Bedrock value routes.'
      : 'Paid Bedrock value portfolio selected after local routes, before premium fallbacks.';

  const result: Omit<ModelRoutingPolicyResult, 'budgetStatus'> = {
    surface,
    providerId,
    model,
    rationale,
    estimatedTokens,
    estimatedCostUsd,
  };

  if (escalationReason) {
    result.escalationReason = escalationReason;
  }

  return result;
}

export function describeRouteLineItem(
  result: Pick<ModelRoutingPolicyResult, 'surface' | 'providerId' | 'model' | 'rationale' | 'estimatedTokens' | 'estimatedCostUsd' | 'escalationReason'>,
  input: ModelRoutingPolicyInput,
): BrainCoreAgentCostLineItem {
  const item: BrainCoreAgentCostLineItem = {
    taskId: input.taskId,
    taskType: input.taskType,
    surface: result.surface,
    providerId: result.providerId,
    estimatedTokens: result.estimatedTokens,
    estimatedCostUsd: result.estimatedCostUsd,
    routingReason: result.rationale,
  };

  if (result.model) {
    item.model = result.model;
  }
  if (result.escalationReason) {
    item.escalationReason = result.escalationReason;
  }

  return item;
}

function estimateTokens(input: ModelRoutingPolicyInput): number {
  const contextMultiplier = input.contextBreadth === 'wide' ? 1.8 : input.contextBreadth === 'medium' ? 1.2 : 1;
  const urgencyMultiplier = input.urgent ? 0.9 : 1;
  const qualityMultiplier = input.qualityPriority === 'quality' ? 1.3 : input.qualityPriority === 'speed' ? 0.85 : 1;
  return Math.max(500, Math.round(input.inputTokens * 0.45 * contextMultiplier * urgencyMultiplier * qualityMultiplier));
}

function estimateCost(surface: BrainCoreRouteSurface, estimatedTokens: number): number {
  if (surface === 'ollama-m4pro' || surface === 'ollama-m1') {
    return 0;
  }
  if (surface === 'codex-cli') {
    return Number((estimatedTokens / 1000 * 0.002).toFixed(4));
  }
  return Number((estimatedTokens / 1_000_000 * 0.65).toFixed(4));
}
