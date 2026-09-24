import type { ModelRouteBinding } from './agent-mode-contracts.js';

export const AGENT_MODE_MODEL_ROUTES = {
  'agent-mode/minimax-m2.5': {
    vendor: 'minimax',
    modelId: 'minimax.minimax-m2.5',
    maxContextTokens: 196_000,
    maxOutputTokens: 8_000,
    routes: [{ kind: 'direct', id: 'minimax.minimax-m2.5' }],
  },
  'agent-mode/glm-5': {
    vendor: 'zai',
    modelId: 'zai.glm-5',
    maxContextTokens: 200_000,
    maxOutputTokens: 128_000,
    routes: [{ kind: 'direct', id: 'zai.glm-5' }],
  },
  'agent-mode/claude-opus-4.6': {
    vendor: 'anthropic',
    modelId: 'anthropic.claude-opus-4-6-v1',
    maxContextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    routes: [
      { kind: 'inference-profile', id: 'us.anthropic.claude-opus-4-6-v1' },
      { kind: 'direct', id: 'anthropic.claude-opus-4-6-v1' },
    ],
  },
} as const;

export type AdmittedModelRef = keyof typeof AGENT_MODE_MODEL_ROUTES;
export type BedrockRouteKind = 'direct' | 'inference-profile';

export interface ModelAccessEvidence {
  version: string;
  accountRef: string;
  region: string;
  modelRef: AdmittedModelRef;
  modelId: string;
  routeKind: BedrockRouteKind;
  routeId: string;
  state: 'verified' | 'denied' | 'unverified';
  catalogVisible: boolean;
  callable: boolean;
  checkedAt: string;
  freshUntil: string;
  source: string;
}

export interface AdmittedModelRequest {
  providerId: 'amazon-bedrock';
  modelRef: AdmittedModelRef;
  modelId: string;
  routeKind: BedrockRouteKind;
  routeId: string;
  /** Legacy one-shot prompt. Structured messages are preferred for tool turns. */
  prompt?: string;
  messages?: readonly BedrockMessage[];
  tools?: readonly BedrockToolDefinition[];
  maxTokens: number;
  operationId: string;
  attemptId: string;
  now: string;
  deadline: string;
  accessEvidence: ModelAccessEvidence;
}

export type BedrockMessageRole = 'user' | 'assistant';

export interface BedrockToolUse {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface BedrockToolResult {
  toolUseId: string;
  content: readonly { text: string }[];
  status?: 'success' | 'error';
}

export interface BedrockContentBlock {
  text?: string;
  toolUse?: BedrockToolUse;
  toolResult?: BedrockToolResult;
  reasoningContent?: unknown;
}

export interface BedrockMessage {
  role: BedrockMessageRole;
  content: readonly BedrockContentBlock[];
}

export interface BedrockToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelCostReceipt {
  inputPerMillionUsd: number | null;
  outputPerMillionUsd: number | null;
  estimatedUsd: number | null;
  pricingSource: string;
}

export interface NormalizedModelResult {
  text: string;
  toolUses?: readonly BedrockToolUse[];
  providerId: 'amazon-bedrock';
  modelRef: AdmittedModelRef;
  modelId: string;
  routeKind: BedrockRouteKind;
  routeId: string;
  region: string;
  usage: ModelUsage;
  cost: ModelCostReceipt;
  stopReason?: string;
  requestId?: string;
  latencyMs: number;
  completedAt: string;
  accessEvidenceVersion: string;
  operationId: string;
  attemptId: string;
}

export type ModelGatewayFailureCode =
  | 'access_denied'
  | 'account_access_unavailable'
  | 'model_unavailable'
  | 'route_invalid'
  | 'throttled'
  | 'timeout'
  | 'provider_error'
  | 'invalid_request'
  | 'unknown';

export interface ModelGatewayProviderFailureDiagnostic {
  providerCode: string;
  providerMessage: string;
  requestId?: string;
  httpStatus?: number;
}

export type ManagedProviderLifecycleStage =
  | 'provider_command_prepare'
  | 'provider_command_spawn_start'
  | 'provider_command_spawn_success'
  | 'provider_command_spawn_failure'
  | 'provider_process_exit'
  | 'provider_process_signal'
  | 'provider_stderr_present'
  | 'provider_error_parse_start'
  | 'provider_error_parse_success'
  | 'provider_error_parse_failure'
  | 'provider_diagnostic_persist_start'
  | 'provider_diagnostic_persist_success'
  | 'provider_diagnostic_persist_failure'
  | 'model_gateway_normalize_error';

export interface ManagedProviderLifecycleEvent {
  stage: ManagedProviderLifecycleStage;
  elapsedMs: number;
  exitCode?: number;
  signal?: 'SIGABRT' | 'SIGALRM' | 'SIGBUS' | 'SIGFPE' | 'SIGHUP' | 'SIGILL' | 'SIGINT' | 'SIGKILL' | 'SIGPIPE' | 'SIGQUIT' | 'SIGSEGV' | 'SIGTERM' | 'SIGTRAP';
  stderrPresent?: boolean;
  parserOutcome?: 'success' | 'failure' | 'skipped';
  errorKind?: 'spawn_error' | 'timeout' | 'output_limit' | 'lifecycle_persistence_failure' | 'malformed_error_output' | 'empty_stderr' | 'parser_failure' | 'diagnostic_unavailable';
  publicErrorClass?: ModelGatewayFailureCode;
}

/** Runtime-owned sink for sanitized provider lifecycle facts and diagnostics. */
export interface ModelGatewayExecutionObserver {
  recordLifecycle?(event: ManagedProviderLifecycleEvent): void;
  persistProviderDiagnostic(
    failureCode: ModelGatewayFailureCode,
    diagnostic: ModelGatewayProviderFailureDiagnostic | undefined,
  ): void;
}

export interface ModelGateway {
  invoke(request: AdmittedModelRequest, observer?: ModelGatewayExecutionObserver): Promise<NormalizedModelResult>;
}

export class ModelGatewayError extends Error {
  readonly code: ModelGatewayFailureCode;
  readonly providerDiagnostic: ModelGatewayProviderFailureDiagnostic | undefined;

  constructor(code: ModelGatewayFailureCode, message: string, providerDiagnostic?: ModelGatewayProviderFailureDiagnostic) {
    super(message);
    this.name = 'ModelGatewayError';
    this.code = code;
    this.providerDiagnostic = providerDiagnostic;
  }
}

export function routeBindingForRequest(request: AdmittedModelRequest): ModelRouteBinding {
  const route = AGENT_MODE_MODEL_ROUTES[request.modelRef];
  return {
    routeKind: 'amazon-bedrock',
    vendor: route.vendor,
    modelRef: request.modelRef,
    invocationRef: request.routeId,
    accountRef: request.accessEvidence.accountRef,
    region: request.accessEvidence.region,
    access: {
      state: request.accessEvidence.state,
      checkedAt: request.accessEvidence.checkedAt,
      freshUntil: request.accessEvidence.freshUntil,
      source: request.accessEvidence.source,
    },
  };
}
