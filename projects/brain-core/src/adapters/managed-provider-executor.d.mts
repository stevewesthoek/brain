import type { AISelection } from './ai-model-selector.js';

export interface ManagedProviderCommands {
  aws?: string;
  codex?: string;
  env?: NodeJS.ProcessEnv;
}

export function executeManagedProvider(
  selection: AISelection,
  prompt: string,
  commands?: ManagedProviderCommands,
): Promise<string>;
