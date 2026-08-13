import type { AgentCapabilitySummary } from './agent-capabilities.js';

const SELECTOR_URL = process.env.AI_SELECTOR_URL ?? 'http://localhost:4890';

export interface AgentAiSurfaceCapabilityManifest {
  capabilities: AgentCapabilitySummary[];
  warning?: string;
}

const FALLBACK_AI_SURFACES: AgentCapabilitySummary[] = [
  {
    id: 'ai.claude-bedrock',
    kind: 'ai_surface',
    label: 'Claude via Amazon Bedrock',
    source: 'projects/brain-core/docs/ai-model-selector-architecture.md',
    description: 'Primary Brain-managed text execution surface. Claude Code is configured to use Bedrock in the managed shell environment.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['reasoning', 'large_context_batch', 'code_review', 'code_generation'],
    verification: ['aws sts get-caller-identity'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'ai.codex-cli',
    kind: 'ai_surface',
    label: 'Codex CLI',
    source: 'projects/brain-core/docs/ai-model-selector-architecture.md',
    description: 'Secondary ChatGPT-subscription text surface used as fallback or when explicitly preferred.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['code_generation', 'code_review', 'reasoning'],
    verification: ['codex --help'],
    enabled: true,
    priority: 2,
  },
];

export async function listAgentAiSurfaceCapabilities(
  timeoutMs = 1500,
  selectorUrl = SELECTOR_URL,
): Promise<AgentAiSurfaceCapabilityManifest> {
  try {
    const response = await fetch(`${selectorUrl}/providers`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`selector returned ${response.status}`);
    }

    const data = (await response.json()) as {
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

    const capabilities = data.providers
      .slice()
      .sort((left, right) => left.priority - right.priority)
      .map<AgentCapabilitySummary>((provider) => ({
      id: `ai.${provider.id}`,
      kind: 'ai_surface',
      label: provider.id,
      source: 'localhost:4890/providers',
      description: `Live selector provider ${provider.id} of type ${provider.type}.`,
      safetyClass: 'read_only',
      requiresApprovalFor: [],
      preferredAiTaskTypes: provider.capabilities.length > 0 ? [...provider.capabilities] : ['text/small'],
      verification: ['GET /providers'],
      enabled: provider.healthy !== false,
      priority: provider.priority,
    }));

    return { capabilities };
  } catch (error) {
    const warning =
      `AI Model Selector unavailable at ${selectorUrl}/providers; using static fallback provider registry.`;
    return {
      warning,
      capabilities: FALLBACK_AI_SURFACES.map((capability) => ({
        ...capability,
        requiresApprovalFor: [...capability.requiresApprovalFor],
        preferredAiTaskTypes: [...capability.preferredAiTaskTypes],
        verification: [...capability.verification],
      })),
    };
  }
}
