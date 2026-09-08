import { executeManagedBedrockConverse } from './managed-provider-executor.mjs';
import {
  AGENT_MODE_MODEL_ROUTES,
  ModelGatewayError,
  type AdmittedModelRequest,
  type BedrockRouteKind,
  type ModelGateway,
  type NormalizedModelResult,
} from '../agent-mode/model-gateway.js';

const ADMITTED_REGION = 'us-east-1';

interface BedrockConverseTransportRequest {
  modelId: string;
  region: string;
  messages: readonly [{ role: 'user'; content: readonly [{ text: string }] }];
  maxTokens: number;
  deadline: string;
}

export interface BedrockConverseTransportResponse {
  output?: { message?: { content?: readonly BedrockContentBlock[] } };
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  stopReason?: string;
  '$metadata'?: { requestId?: string };
  requestId?: string;
}

export interface BedrockConverseTransport {
  converse(request: BedrockConverseTransportRequest): Promise<BedrockConverseTransportResponse>;
}

export interface AmazonBedrockModelGatewayOptions {
  accountRef: string;
  region?: string;
  transport?: BedrockConverseTransport;
  now?: () => Date;
}

interface BedrockContentBlock {
  text?: unknown;
  reasoningContent?: unknown;
  [key: string]: unknown;
}

const defaultTransport: BedrockConverseTransport = {
  converse: (request) => executeManagedBedrockConverse(request),
};

export class AmazonBedrockModelGateway implements ModelGateway {
  private readonly accountRef: string;
  private readonly region: string;
  private readonly transport: BedrockConverseTransport;
  private readonly now: () => Date;

  constructor(options: AmazonBedrockModelGatewayOptions) {
    this.accountRef = options.accountRef;
    this.region = options.region ?? ADMITTED_REGION;
    this.transport = options.transport ?? defaultTransport;
    this.now = options.now ?? (() => new Date());
    if (!this.accountRef.trim()) throw new Error('ModelGateway requires an account reference');
    if (this.region !== ADMITTED_REGION) {
      throw new Error(`Agent Mode Bedrock is restricted to ${ADMITTED_REGION}`);
    }
  }

  async invoke(request: AdmittedModelRequest): Promise<NormalizedModelResult> {
    const startedAt = this.now();
    const route = AGENT_MODE_MODEL_ROUTES[request.modelRef];
    if (!route || request.providerId !== 'amazon-bedrock') {
      throw new ModelGatewayError('invalid_request', 'request is outside the admitted Agent Mode Bedrock portfolio');
    }
    if ([request.modelId, request.routeId, request.prompt, request.operationId, request.attemptId].some((value) => !value.trim())) {
      throw new ModelGatewayError('invalid_request', 'model, prompt, operation, and attempt fields are required');
    }
    if (!Number.isInteger(request.maxTokens) || request.maxTokens < 1 || request.maxTokens > route.maxOutputTokens) {
      throw new ModelGatewayError('invalid_request', 'maxTokens exceeds the admitted model output bound');
    }
    if (request.routeKind !== 'direct' && request.routeKind !== 'inference-profile') {
      throw new ModelGatewayError('route_invalid', 'route kind is not admitted');
    }
    if (!route.routes.some((candidate) => candidate.kind === request.routeKind && candidate.id === request.routeId)
      || request.modelId !== request.routeId) {
      throw new ModelGatewayError('route_invalid', 'model route is not an exact admitted Bedrock route');
    }
    const nowMs = startedAt.getTime();
    const deadlineMs = Date.parse(request.deadline);
    if (!Number.isFinite(deadlineMs) || deadlineMs <= nowMs) {
      throw new ModelGatewayError('timeout', 'model request deadline has expired');
    }
    if (request.accessEvidence.accountRef !== this.accountRef
      || request.accessEvidence.region !== this.region
      || request.accessEvidence.modelRef !== request.modelRef
      || request.accessEvidence.modelId !== request.modelId
      || request.accessEvidence.routeKind !== request.routeKind
      || request.accessEvidence.routeId !== request.routeId) {
      throw new ModelGatewayError('access_denied', 'access evidence does not match the admitted account, region, or route');
    }
    if (request.accessEvidence.state !== 'verified' || !request.accessEvidence.catalogVisible || !request.accessEvidence.callable) {
      throw new ModelGatewayError('access_denied', 'access evidence does not verify callable model access');
    }
    const checkedAtMs = Date.parse(request.accessEvidence.checkedAt);
    const freshUntilMs = Date.parse(request.accessEvidence.freshUntil);
    if (!Number.isFinite(checkedAtMs) || !Number.isFinite(freshUntilMs) || checkedAtMs > nowMs || nowMs >= freshUntilMs) {
      throw new ModelGatewayError('access_denied', 'access evidence is stale or invalid');
    }

    try {
      const response = await this.transport.converse({
        modelId: request.modelId,
        region: this.region,
        messages: [{ role: 'user', content: [{ text: request.prompt }] }],
        maxTokens: request.maxTokens,
        deadline: request.deadline,
      });
      const completedAt = this.now();
      return {
        text: normalizeFinalText(response),
        providerId: 'amazon-bedrock',
        modelRef: request.modelRef,
        modelId: request.modelId,
        routeKind: request.routeKind,
        routeId: request.routeId,
        region: this.region,
        usage: normalizeUsage(response.usage),
        cost: {
          inputPerMillionUsd: null,
          outputPerMillionUsd: null,
          estimatedUsd: null,
          pricingSource: 'not-configured-in-k1-1',
        },
        ...(response.stopReason ? { stopReason: response.stopReason } : {}),
        ...(response['$metadata']?.requestId || response.requestId
          ? { requestId: response['$metadata']?.requestId ?? response.requestId } : {}),
        latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        completedAt: completedAt.toISOString(),
        accessEvidenceVersion: request.accessEvidence.version,
        operationId: request.operationId,
        attemptId: request.attemptId,
      };
    } catch (error) {
      if (error instanceof ModelGatewayError) throw error;
      throw new ModelGatewayError(classifyProviderError(error), 'Bedrock Converse invocation failed');
    }
  }
}

function normalizeFinalText(response: BedrockConverseTransportResponse): string {
  return (response.output?.message?.content ?? [])
    .flatMap((block) => typeof block.text === 'string' ? [block.text] : [])
    .join('')
    .trim();
}

function normalizeUsage(usage: BedrockConverseTransportResponse['usage']): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const inputTokens = nonNegativeInteger(usage?.inputTokens);
  const outputTokens = nonNegativeInteger(usage?.outputTokens);
  const totalTokens = nonNegativeInteger(usage?.totalTokens) || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function classifyProviderError(error: unknown): 'access_denied' | 'model_unavailable' | 'route_invalid' | 'throttled' | 'timeout' | 'provider_error' | 'invalid_request' | 'unknown' {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown; '$metadata'?: { httpStatusCode?: unknown } };
  const code = `${candidate?.name ?? ''} ${candidate?.code ?? ''}`.toLowerCase();
  const message = String(candidate?.message ?? error ?? '').toLowerCase();
  if (code.includes('accessdenied') || code.includes('expiredtoken') || code.includes('unrecognizedclient') || code.includes('unauthorized')) return 'access_denied';
  if (code.includes('throttl') || message.includes('rate exceeded')) return 'throttled';
  if (code.includes('modelnotready') || code.includes('serviceunavailable') || code.includes('modelunavailable')) return 'model_unavailable';
  if (code.includes('resourcenotfound') || message.includes('inference profile') || message.includes('model identifier')) return 'route_invalid';
  if (code.includes('validation') || code.includes('invalidrequest')) return 'invalid_request';
  if (code.includes('timeout') || message.includes('timed out')) return 'timeout';
  const status = candidate?.['$metadata']?.httpStatusCode;
  if (status === 408 || status === 504) return 'timeout';
  if (code.includes('internalserver') || code.includes('serviceexception')
    || (typeof status === 'number' && status >= 500)) return 'provider_error';
  return 'unknown';
}

export function isAdmittedRouteKind(value: string): value is BedrockRouteKind {
  return value === 'direct' || value === 'inference-profile';
}
