import { createHash } from 'node:crypto';
import type { OperationReceipt } from './agent-mode-contracts.js';
import { AGENT_MODE_MODEL_ROUTES, type ModelAccessEvidence, type ModelGateway, type NormalizedModelResult } from './model-gateway.js';
import { AGENT_MODE_TIER_POLICY_VERSION, AGENT_MODE_PRICING } from './model-tier-policy.js';
import { runtimeDispatchResourceKey } from './runtime-dispatch.js';
import type { AgentRuntimeExecutionContext } from './runtime-dispatch.js';
import { K43A_LIVE_EXPECTED_RESPONSE, K43A_LIVE_MODEL_PROMPT } from './restricted-harness-agent-runtime.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';

export const K43A_MODEL_REF = 'agent-mode/minimax-m2.5' as const;
export const K43A_MODEL_ID = 'minimax.minimax-m2.5' as const;
export const K43A_ROUTE_KIND = 'direct' as const;
export const K43A_ROUTE_ID = 'minimax.minimax-m2.5' as const;
export const K43A_REGION = 'us-east-1' as const;
export const K43A_MAX_TOKENS = 256 as const;
export const K43A_MODEL_OPERATION_PREFIX = 'model-op:sha256:' as const;

export type K43AModelReceipt = OperationReceipt & {
  providerId: 'amazon-bedrock';
  modelRef: typeof K43A_MODEL_REF;
  modelId: typeof K43A_MODEL_ID;
  route: { kind: typeof K43A_ROUTE_KIND; id: typeof K43A_ROUTE_ID };
  region: typeof K43A_REGION;
  requestId: string | null;
  usage: NormalizedModelResult['usage'];
  cost: NormalizedModelResult['cost'];
  stopReason: string | null;
  latencyMs: number;
  completedAt: string;
  accessEvidenceVersion: string;
};

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function boundedResponse(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 4096);
}

function isFreshVerified(evidence: ModelAccessEvidence, now: string): boolean {
  return evidence.modelRef === K43A_MODEL_REF
    && evidence.modelId === K43A_MODEL_ID
    && evidence.routeKind === K43A_ROUTE_KIND
    && evidence.routeId === K43A_ROUTE_ID
    && evidence.region === K43A_REGION
    && evidence.state === 'verified'
    && evidence.catalogVisible
    && evidence.callable
    && Number.isFinite(Date.parse(evidence.checkedAt))
    && Number.isFinite(Date.parse(evidence.freshUntil))
    && Date.parse(evidence.checkedAt) <= Date.parse(now)
    && Date.parse(now) < Date.parse(evidence.freshUntil);
}

function costFor(result: NormalizedModelResult): number {
  const pricing = AGENT_MODE_PRICING[K43A_MODEL_REF];
  if (pricing.inputPerMillionUsd === null || pricing.outputPerMillionUsd === null) throw new Error('K43A_PRICING_UNVERIFIED');
  return Math.round(((result.usage.inputTokens * pricing.inputPerMillionUsd + result.usage.outputTokens * pricing.outputPerMillionUsd) / 1_000_000) * 1_000_000) / 1_000_000;
}

export function deterministicK43AProviderOperationId(context: AgentRuntimeExecutionContext, turn = 1): string {
  return K43A_MODEL_OPERATION_PREFIX + digest({ rootGoalId: context.rootGoalId, childAgentId: context.childAgentId, attemptId: context.attemptId, runtimeDispatchId: context.dispatchId, turn, modelRef: K43A_MODEL_REF, route: K43A_ROUTE_ID });
}

export function createK43AModelBridge(options: {
  store: AgentModeSqliteStateStore;
  gateway: ModelGateway;
  accessEvidence: ModelAccessEvidence;
  now?: () => string;
}): (input: { context: AgentRuntimeExecutionContext; turn: number; maxTokens: number; prompt: string; signal: AbortSignal; isCancellationRequested: () => boolean }) => Promise<NormalizedModelResult> {
  const clock = options.now ?? (() => new Date().toISOString());
  let invocationCount = 0;
  return async (input) => {
    const now = clock();
    if (input.turn !== 1 || input.maxTokens !== K43A_MAX_TOKENS || input.prompt !== K43A_LIVE_MODEL_PROMPT) throw new Error('K43A_MODEL_REQUEST_INVALID');
    if (input.signal.aborted || input.isCancellationRequested()) throw new Error('K43A_MODEL_CANCELLED_BEFORE_PROVIDER');
    if (!isFreshVerified(options.accessEvidence, now)) throw new Error('K43A_ACCESS_EVIDENCE_INVALID');
    if (invocationCount !== 0) throw new Error('K43A_SECOND_MODEL_TURN_DENIED');
    invocationCount += 1;
    const operationId = deterministicK43AProviderOperationId(input.context);
    const scopeHash = input.context.capabilitySetHash;
    const prepared = options.store.prepareOperation({
      operationId,
      attemptId: input.context.attemptId,
      effectKind: 'model.invoke',
      capabilityId: 'model.invoke',
      scopeHash,
      policyVersion: AGENT_MODE_TIER_POLICY_VERSION,
      leaseResourceKey: runtimeDispatchResourceKey(input.context.attemptId),
      leaseId: input.context.leaseId,
      leaseFence: input.context.fence,
      deadline: input.context.deadline,
      preparedAt: now,
    });
    if (prepared === 'conflict') throw new Error('K43A_MODEL_OPERATION_CONFLICT');
    if (prepared === 'duplicate') throw new Error('K43A_MODEL_OPERATION_ALREADY_USED');
    options.store.markDispatched(operationId, now);
    let result: NormalizedModelResult;
    try {
      result = await options.gateway.invoke({
        providerId: 'amazon-bedrock', modelRef: K43A_MODEL_REF, modelId: K43A_MODEL_ID,
        routeKind: K43A_ROUTE_KIND, routeId: K43A_ROUTE_ID,
        messages: [{ role: 'user', content: [{ text: input.prompt }] }],
        maxTokens: K43A_MAX_TOKENS, operationId, attemptId: input.context.attemptId,
        now, deadline: input.context.deadline, accessEvidence: options.accessEvidence,
      });
    } catch (error) {
      options.store.markEffectObserved(operationId, clock());
      throw error;
    }
    const calculatedCost = costFor(result);
    const normalizedText = boundedResponse(result.text);
    if (result.providerId !== 'amazon-bedrock' || result.modelRef !== K43A_MODEL_REF || result.modelId !== K43A_MODEL_ID || result.routeKind !== K43A_ROUTE_KIND || result.routeId !== K43A_ROUTE_ID || result.region !== K43A_REGION || result.operationId !== operationId || result.attemptId !== input.context.attemptId || result.toolUses?.length || result.usage.totalTokens > input.context.tokenCeiling || calculatedCost > input.context.costCeiling || !Number.isFinite(result.cost.estimatedUsd) || result.cost.estimatedUsd !== calculatedCost || !boundedResponse(result.text)) {
      options.store.markEffectObserved(operationId, clock());
      throw new Error('K43A_MODEL_RESULT_INVALID');
    }
    if (normalizedText !== K43A_LIVE_EXPECTED_RESPONSE) {
      options.store.markEffectObserved(operationId, clock());
      throw new Error('K43A_MODEL_RESPONSE_MISMATCH');
    }
    const recordedAt = clock();
    const safeTextHash = digest(normalizedText);
    const receiptWithoutHash = {
      operationId,
      attemptId: input.context.attemptId,
      scopeHash,
      effectHash: digest({ operationId, attemptId: input.context.attemptId, modelRef: K43A_MODEL_REF, modelId: K43A_MODEL_ID, route: K43A_ROUTE_ID, usage: result.usage, cost: result.cost, textHash: safeTextHash, requestId: result.requestId ?? null }),
      status: 'succeeded' as const,
      recordedAt,
      providerId: 'amazon-bedrock' as const,
      modelRef: K43A_MODEL_REF,
      modelId: K43A_MODEL_ID,
      route: { kind: K43A_ROUTE_KIND, id: K43A_ROUTE_ID },
      region: K43A_REGION,
      requestId: result.requestId ?? null,
      usage: result.usage,
      cost: result.cost,
      stopReason: result.stopReason ?? null,
      latencyMs: result.latencyMs,
      completedAt: result.completedAt,
      accessEvidenceVersion: result.accessEvidenceVersion,
    } satisfies K43AModelReceipt;
    const recorded = options.store.recordReceipt(receiptWithoutHash);
    if (recorded === 'conflict' || recorded === 'stale') throw new Error('K43A_MODEL_RECEIPT_NOT_ACCEPTED');
    options.store.markOperationVerified(operationId, { resultHash: digest({ operationId, textHash: safeTextHash }), evidenceRef: 'evidence:model:' + operationId, verifiedAt: recordedAt });
    return normalizedText === result.text ? result : { ...result, text: normalizedText };
  };
}
