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
  prompt: string;
  maxTokens: number;
  operationId: string;
  attemptId: string;
  now: string;
  deadline: string;
  accessEvidence: ModelAccessEvidence;
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
  | 'model_unavailable'
  | 'route_invalid'
  | 'throttled'
  | 'timeout'
  | 'provider_error'
  | 'invalid_request'
  | 'unknown';

export interface ModelGateway {
  invoke(request: AdmittedModelRequest): Promise<NormalizedModelResult>;
}

export class ModelGatewayError extends Error {
  readonly code: ModelGatewayFailureCode;

  constructor(code: ModelGatewayFailureCode, message: string) {
    super(message);
    this.name = 'ModelGatewayError';
    this.code = code;
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
