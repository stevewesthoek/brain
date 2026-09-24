import type { AISelection } from './ai-model-selector.js';
import type { ManagedProviderLifecycleEvent } from '../agent-mode/model-gateway.js';

export interface ManagedProviderCommands {
  aws?: string;
  codex?: string;
  env?: NodeJS.ProcessEnv;
  onLifecycleEvent?: (event: ManagedProviderLifecycleEvent) => void;
}

export interface ManagedBedrockConverseRequest {
  modelId: string;
  region: string;
  messages: readonly unknown[];
  maxTokens: number;
  temperature?: number;
  deadline?: string;
  timeoutMs?: number;
}

export function executeManagedBedrockConverse(
  request: ManagedBedrockConverseRequest,
  commands?: ManagedProviderCommands,
): Promise<Record<string, unknown>>;

export function executeManagedProvider(
  selection: AISelection,
  prompt: string,
  commands?: ManagedProviderCommands,
): Promise<string>;
