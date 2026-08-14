import {
  reportAIFailure,
  reportAISuccess,
  selectAI,
} from './ai-model-selector.js';
import { executeManagedProvider } from './managed-provider-executor.mjs';

const ADMITTED_PROVIDERS = new Set(['claude-bedrock', 'codex-cli']);

export interface ManagedTextResult {
  text: string;
  providerId: string;
  model: string;
}

export async function executeManagedText(
  taskType: string,
  prompt: string,
  options: { urgent?: boolean; preferredProviders?: string[] } = {},
): Promise<ManagedTextResult> {
  const preferredProviders = options.preferredProviders ?? ['claude-bedrock', 'codex-cli'];
  if (preferredProviders.length === 0 || preferredProviders.some((provider) => !ADMITTED_PROVIDERS.has(provider))) {
    throw new Error('Managed text execution requires only admitted preferred providers');
  }

  const previousFailures: string[] = [];
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < preferredProviders.length; attempt += 1) {
    const selection = await selectAI(taskType, {
      inputTokens: Math.max(1, Math.ceil(prompt.length / 4)),
      urgent: options.urgent ?? false,
      previousFailures,
      timeoutMs: 5_000,
      taskMetadata: {
        preferred_providers: preferredProviders,
        fallback_policy: 'ordered_strict',
      },
    });
    try {
      const text = await executeManagedProvider(selection, prompt);
      if (!text) throw new Error('Managed provider returned an empty response');
      await reportAISuccess(selection.providerId, selection.model);
      return { text, providerId: selection.providerId, model: selection.model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await reportAIFailure(selection.providerId, 'error', 'managed text execution failed', selection.model);
      if (!previousFailures.includes(selection.providerId)) previousFailures.push(selection.providerId);
    }
  }

  throw lastError ?? new Error('No admitted managed text provider completed the request');
}
