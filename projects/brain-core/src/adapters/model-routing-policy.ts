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

export type ModelRoutingProfile = 'fast' | 'standard' | 'deep';

export interface ModelRoutingPolicyResult {
  surface: BrainCoreRouteSurface;
  providerId: string;
  profile: ModelRoutingProfile;
  model?: string;
  rationale: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
  budgetStatus: BrainCoreBudgetStatus;
  escalationReason?: string;
}

const SURFACE_PRIORITY: BrainCoreRouteSurface[] = ['claude-bedrock', 'codex-cli'];

const TASK_SURFACE_CAPABILITIES: Record<string, BrainCoreRouteSurface[]> = {
  metadata_generation: ['claude-bedrock', 'codex-cli'],
  thumbnail_headline: ['claude-bedrock', 'codex-cli'],
  seo_keyword_expansion: ['claude-bedrock', 'codex-cli'],
  transcript_summarization: ['claude-bedrock', 'codex-cli'],
  subtitle_generation: ['claude-bedrock', 'codex-cli'],
  background_image: ['claude-bedrock', 'codex-cli'],
  description_quality_review: ['claude-bedrock', 'codex-cli'],
  orchestration: ['claude-bedrock', 'codex-cli'],
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
  const profile: ModelRoutingProfile = input.qualityPriority === 'quality'
    ? 'deep'
    : input.qualityPriority === 'speed'
      ? 'fast'
      : 'standard';

  const estimatedTokens = estimateTokens(input);
  const estimatedCostUsd = estimateCost(surface, estimatedTokens);
  const escalationReason = surface !== allowedSurfaces[0]
    ? `Escalated from ${allowedSurfaces[0]} to ${surface} based on capability and health ordering.`
    : undefined;
  const rationale = surface === 'claude-bedrock'
    ? 'Bedrock-backed Claude selected as the default Brain-managed text surface; the admitted registry resolves the model for the requested profile.'
    : 'Codex CLI selected as the secondary managed surface; the admitted registry resolves the model for the requested profile.';

  const result: Omit<ModelRoutingPolicyResult, 'budgetStatus'> = {
    surface,
    providerId,
    profile,
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
  result: Pick<ModelRoutingPolicyResult, 'surface' | 'providerId' | 'profile' | 'model' | 'rationale' | 'estimatedTokens' | 'estimatedCostUsd' | 'escalationReason'>,
  input: ModelRoutingPolicyInput,
): BrainCoreAgentCostLineItem {
  const item: BrainCoreAgentCostLineItem = {
    taskId: input.taskId,
    taskType: input.taskType,
    surface: result.surface,
    providerId: result.providerId,
    profile: result.profile,
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
  if (surface === 'codex-cli') {
    return 0;
  }
  return Number((estimatedTokens / 1_000_000 * 0.65).toFixed(4));
}
