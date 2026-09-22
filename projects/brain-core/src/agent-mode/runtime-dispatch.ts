import { createHash } from 'node:crypto';
import type { AgentModePreparedChildDispatch } from './child-assignment.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { validateExecutionTelemetry, type AgentModeExecutionTelemetry } from './execution-telemetry.js';

export const RUNTIME_DISPATCH_SCHEMA_VERSION = 1 as const;
export const RUNTIME_DISPATCH_EFFECT_KIND = 'runtime.dispatch' as const;
export const RUNTIME_DISPATCH_RESOURCE_PREFIX = 'runtime-dispatch:' as const;

export type AgentModeRuntimeDispatchRequest = {
  schemaVersion: typeof RUNTIME_DISPATCH_SCHEMA_VERSION;
  dispatchId: string;
  operationId: string;
  assignmentIntentKey: string;
  childAgentId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  controllerRef: string;
  requestedAt: string;
};

export type AgentModeRuntimeUsage = {
  steps: number;
  tokens: number;
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cachedOutputTokens?: number;
  reasoningTokens?: number;
};

export type AgentRuntimeExecutionContext = AgentModePreparedChildDispatch & {
  operationId: string;
  dispatchId: string;
  controllerRef: string;
  leaseId: string;
  fence: number;
  correlationId: string;
  causationId: string;
};

export type AgentRuntimeResult = {
  status: 'succeeded' | 'failed' | 'cancelled';
  runtimeReceiptId: string;
  resultHash: string;
  evidenceRef: string | null;
  usage: AgentModeRuntimeUsage;
  failureCode?: string;
  traceSummary: readonly string[];
  resultText?: string;
  cancellationObserved?: boolean;
  telemetry?: AgentModeExecutionTelemetry;
};

export type AgentRuntime = {
  run(input: {
    context: AgentRuntimeExecutionContext;
    signal: AbortSignal;
    isCancellationRequested: () => boolean;
  }): Promise<AgentRuntimeResult>;
  reconcile?(input: { context: AgentRuntimeExecutionContext }): Promise<AgentRuntimeReconciliation>;
};

export type AgentRuntimeReconciliation =
  | { status: 'resolved'; result: AgentRuntimeResult }
  | { status: 'unsupported' }
  | { status: 'uncertain' };

export type AgentModeRuntimeReceipt = {
  receiptId: string;
  operationId: string;
  dispatchId: string;
  assignmentIntentKey: string;
  childAgentId: string;
  attemptId: string;
  runtimeRef: string;
  runtimeProfileRef: string;
  leaseId: string;
  fence: number;
  resultHash: string;
  evidenceRef: string | null;
  status: AgentRuntimeResult['status'];
  usage: AgentModeRuntimeUsage;
  failureCode?: string;
  traceSummary: readonly string[];
  resultText?: string;
  cancellationObserved?: boolean;
  telemetry?: AgentModeExecutionTelemetry;
  effectHash: string;
  recordedAt: string;
};

export type AgentModeRuntimeDispatchPrepared = {
  request: AgentModeRuntimeDispatchRequest;
  assignment: AgentModePreparedChildDispatch;
  operationId: string;
  dispatchId: string;
  resourceKey: string;
  leaseId: string;
  fence: number;
  leaseExpiresAt: string;
  preparedAt: string;
  phase: 'dispatchable' | 'dispatched' | 'receipt_recorded' | 'verified';
  receipt?: AgentModeRuntimeReceipt;
};

export type AgentModeRuntimeDispatchStorePreparation =
  | { result: 'ready'; prepared: AgentModeRuntimeDispatchPrepared }
  | { result: 'terminal'; receipt: AgentModeRuntimeReceipt }
  | { result: 'uncertain'; reasonCode: string; receipt?: AgentModeRuntimeReceipt }
  | { result: 'denied'; reasonCode: string };

export type AgentModeRuntimeDispatchMutation =
  | { result: 'created' | 'duplicate' }
  | { result: 'denied'; reasonCode: string };

export type AgentModeRuntimeReceiptMutation =
  | { result: 'recorded' | 'duplicate' }
  | { result: 'stale' | 'conflict' | 'denied'; reasonCode: string };

export type AgentModeRuntimeVerification =
  | { result: 'verified' | 'duplicate' }
  | { result: 'denied' | 'uncertain'; reasonCode: string };

export type AgentModeRuntimeSettlement =
  | { result: 'settled' | 'duplicate'; receipt: AgentModeRuntimeReceipt }
  | { result: 'denied' | 'uncertain'; reasonCode: string };

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const SAFE_INTENT = /^assignment-intent:sha256:[a-f0-9]{64}$/;

export function validateRuntimeDispatchRequest(request: AgentModeRuntimeDispatchRequest): boolean {
  return request.schemaVersion === RUNTIME_DISPATCH_SCHEMA_VERSION
    && SAFE_ID.test(request.dispatchId)
    && SAFE_ID.test(request.operationId)
    && SAFE_INTENT.test(request.assignmentIntentKey)
    && SAFE_ID.test(request.childAgentId)
    && SAFE_ID.test(request.taskId)
    && SAFE_ID.test(request.runId)
    && SAFE_ID.test(request.attemptId)
    && SAFE_REF.test(request.runtimeRef)
    && SAFE_REF.test(request.runtimeProfileRef)
    && SAFE_ID.test(request.controllerRef)
    && Number.isFinite(Date.parse(request.requestedAt));
}

function boundedText(value: string | null | undefined, max: number): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.length <= max);
}

export function validateRuntimeResult(result: AgentRuntimeResult): boolean {
  return ['succeeded', 'failed', 'cancelled'].includes(result.status)
    && SAFE_ID.test(result.runtimeReceiptId)
    && /^[a-f0-9]{64}$/.test(result.resultHash)
    && boundedText(result.evidenceRef, 256)
    && Number.isSafeInteger(result.usage.steps) && result.usage.steps >= 0
    && Number.isSafeInteger(result.usage.tokens) && result.usage.tokens >= 0
    && Number.isFinite(result.usage.cost) && result.usage.cost >= 0
    && Object.entries(result.usage).filter(([key]) => !['steps', 'tokens', 'cost'].includes(key)).every(([, value]) => Number.isSafeInteger(value) && Number(value) >= 0)
    && boundedText(result.failureCode, 128)
    && result.traceSummary.length <= 8
    && result.traceSummary.every((entry) => typeof entry === 'string' && entry.length <= 128)
    && (result.resultText === undefined || (typeof result.resultText === 'string' && result.resultText.length <= 12_000))
    && (result.status !== 'cancelled' || result.cancellationObserved === true)
    && (result.telemetry === undefined || validateExecutionTelemetry(result.telemetry));
}

export function runtimeDispatchResourceKey(attemptId: string): string {
  return `${RUNTIME_DISPATCH_RESOURCE_PREFIX}${attemptId}`;
}

export function runtimeReceiptEffectHash(receipt: Omit<AgentModeRuntimeReceipt, 'effectHash'>): string {
  return createHash('sha256').update(JSON.stringify({
    operationId: receipt.operationId,
    dispatchId: receipt.dispatchId,
    assignmentIntentKey: receipt.assignmentIntentKey,
    childAgentId: receipt.childAgentId,
    attemptId: receipt.attemptId,
    runtimeRef: receipt.runtimeRef,
    runtimeProfileRef: receipt.runtimeProfileRef,
    leaseId: receipt.leaseId,
    fence: receipt.fence,
    resultHash: receipt.resultHash,
    evidenceRef: receipt.evidenceRef,
    status: receipt.status,
    usage: receipt.usage,
    failureCode: receipt.failureCode ?? null,
    resultText: receipt.resultText ?? null,
    cancellationObserved: receipt.cancellationObserved ?? false,
    telemetry: receipt.telemetry ?? null,
  })).digest('hex');
}

export type AgentModeRuntimeDispatchResult =
  | { result: 'succeeded' | 'failed' | 'cancelled' | 'duplicate'; receipt: AgentModeRuntimeReceipt }
  | { result: 'denied' | 'uncertain'; reasonCode: string; receipt?: AgentModeRuntimeReceipt };

export class AgentModeRuntimeDispatcher {
  private readonly cancellationControllers = new Map<string, AbortController>();

  constructor(
    private readonly store: AgentModeSqliteStateStore,
    private readonly runtime: AgentRuntime,
  ) {}

  private settlementResult(settlement: AgentModeRuntimeSettlement): AgentModeRuntimeDispatchResult {
    if (settlement.result === 'settled') return { result: settlement.receipt.status, receipt: settlement.receipt };
    if (settlement.result === 'duplicate') return { result: 'duplicate', receipt: settlement.receipt };
    if (settlement.result === 'denied' || settlement.result === 'uncertain') return settlement;
    throw new Error('unreachable runtime settlement state');
  }

  private runtimeContext(request: AgentModeRuntimeDispatchRequest, prepared: AgentModeRuntimeDispatchPrepared): AgentRuntimeExecutionContext {
    return {
      ...prepared.assignment,
      operationId: request.operationId,
      dispatchId: request.dispatchId,
      controllerRef: request.controllerRef,
      leaseId: prepared.leaseId,
      fence: prepared.fence,
      correlationId: request.assignmentIntentKey,
      causationId: request.assignmentIntentKey,
    };
  }

  private runtimeReceipt(request: AgentModeRuntimeDispatchRequest, prepared: AgentModeRuntimeDispatchPrepared, result: AgentRuntimeResult): AgentModeRuntimeReceipt {
    const receiptWithoutHash = {
      receiptId: `runtime-receipt:${createHash('sha256').update(`${result.runtimeReceiptId}:${request.operationId}`).digest('hex').slice(0, 48)}`,
      operationId: request.operationId, dispatchId: request.dispatchId, assignmentIntentKey: request.assignmentIntentKey,
      childAgentId: request.childAgentId, attemptId: request.attemptId, runtimeRef: request.runtimeRef, runtimeProfileRef: request.runtimeProfileRef,
      leaseId: prepared.leaseId, fence: prepared.fence, resultHash: result.resultHash, evidenceRef: result.evidenceRef,
      status: result.status, usage: result.usage,
      ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
      traceSummary: [...result.traceSummary].slice(0, 8),
      ...(result.resultText === undefined ? {} : { resultText: result.resultText.slice(0, 12_000) }),
      ...(result.cancellationObserved === undefined ? {} : { cancellationObserved: result.cancellationObserved }),
      ...(result.telemetry === undefined ? {} : { telemetry: result.telemetry }),
      recordedAt: request.requestedAt,
    } satisfies Omit<AgentModeRuntimeReceipt, 'effectHash'>;
    return { ...receiptWithoutHash, effectHash: runtimeReceiptEffectHash(receiptWithoutHash) };
  }

  async dispatch(request: AgentModeRuntimeDispatchRequest): Promise<AgentModeRuntimeDispatchResult> {
    if (!validateRuntimeDispatchRequest(request)) return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    const prepared = this.store.prepareRuntimeDispatch(request);
    if (prepared.result === 'denied') return prepared;
    if (prepared.result === 'uncertain') return prepared;
    if (prepared.result === 'terminal') return { result: 'duplicate', receipt: prepared.receipt };

    let activePrepared = prepared.prepared;
    if (activePrepared.phase === 'dispatchable') {
      const started = this.store.markRuntimeDispatchStarted(request.operationId, request.controllerRef, activePrepared.leaseId, activePrepared.fence, request.requestedAt);
      if (started.result === 'denied') return started;
      activePrepared = { ...activePrepared, phase: 'dispatched' };
    }
    if (activePrepared.phase === 'receipt_recorded') {
      const verified = this.store.verifyRuntimeDispatch(request.operationId, request.requestedAt);
      if (verified.result === 'denied' || verified.result === 'uncertain') return verified;
      activePrepared = { ...activePrepared, phase: 'verified' };
    }
    if (activePrepared.phase === 'verified') {
      return this.settlementResult(this.store.settleRuntimeDispatch(request.operationId, request.controllerRef, activePrepared.leaseId, activePrepared.fence, request.requestedAt));
    }
    if (activePrepared.phase !== 'dispatched') return { result: 'uncertain', reasonCode: 'DISPATCH_STATE_UNEXPECTED' };

    const controller = new AbortController();
    this.cancellationControllers.set(request.operationId, controller);
    try {
      const runtimeResult = await this.runtime.run({
        context: this.runtimeContext(request, activePrepared),
        signal: controller.signal,
        isCancellationRequested: () => this.store.isRuntimeCancellationRequested(request.operationId, request.requestedAt),
      });
      if (!validateRuntimeResult(runtimeResult)) {
        this.store.markRuntimeDispatchUncertain(request.operationId, request.requestedAt, 'RUNTIME_RESULT_INVALID');
        return { result: 'uncertain', reasonCode: 'RUNTIME_RESULT_INVALID' };
      }
      const receipt = this.runtimeReceipt(request, activePrepared, runtimeResult);
      const recorded = this.store.recordRuntimeDispatchReceipt(receipt);
      if (recorded.result === 'denied') return { result: 'denied', reasonCode: recorded.reasonCode };
      if (recorded.result === 'conflict') return { result: 'uncertain', reasonCode: recorded.reasonCode };
      if (recorded.result === 'stale') {
        this.store.markRuntimeDispatchUncertain(request.operationId, request.requestedAt, 'STALE_FENCE');
        return { result: 'uncertain', reasonCode: 'STALE_FENCE', receipt };
      }
      const verified = this.store.verifyRuntimeDispatch(request.operationId, request.requestedAt);
      if (verified.result === 'denied' || verified.result === 'uncertain') return verified;
      return this.settlementResult(this.store.settleRuntimeDispatch(request.operationId, request.controllerRef, activePrepared.leaseId, activePrepared.fence, request.requestedAt));
    } catch (error) {
      const reasonCode = error instanceof Error && error.message === 'runtime_outcome_uncertain' ? 'RUNTIME_UNCERTAIN' : 'RUNTIME_UNCERTAIN';
      this.store.markRuntimeDispatchUncertain(request.operationId, request.requestedAt, reasonCode);
      return { result: 'uncertain', reasonCode };
    } finally {
      this.cancellationControllers.delete(request.operationId);
    }
  }

  async reconcile(request: AgentModeRuntimeDispatchRequest): Promise<AgentModeRuntimeDispatchResult> {
    if (!validateRuntimeDispatchRequest(request)) return { result: 'denied', reasonCode: 'INVALID_REQUEST' };
    if (!this.runtime.reconcile) return { result: 'uncertain', reasonCode: 'RECONCILIATION_UNSUPPORTED' };
    const prepared = this.store.prepareRuntimeDispatchReconciliation(request);
    if (prepared.result === 'denied') return prepared;
    if (prepared.result === 'terminal') return { result: 'duplicate', receipt: prepared.receipt };
    if (prepared.result === 'uncertain') return prepared;
    try {
      const outcome = await this.runtime.reconcile({ context: this.runtimeContext(request, prepared.prepared) });
      if (outcome.status === 'unsupported') return { result: 'uncertain', reasonCode: 'RECONCILIATION_UNSUPPORTED' };
      if (outcome.status === 'uncertain' || !validateRuntimeResult(outcome.result)) return { result: 'uncertain', reasonCode: 'RECONCILIATION_UNCERTAIN' };
      const receipt = this.runtimeReceipt(request, prepared.prepared, outcome.result);
      const recorded = this.store.recordRuntimeDispatchReceipt(receipt);
      if (recorded.result === 'stale' || recorded.result === 'conflict') return { result: 'uncertain', reasonCode: recorded.reasonCode, receipt };
      const verified = this.store.verifyRuntimeDispatch(request.operationId, request.requestedAt);
      if (verified.result === 'denied' || verified.result === 'uncertain') return verified;
      return this.settlementResult(this.store.settleRuntimeDispatch(request.operationId, request.controllerRef, prepared.prepared.leaseId, prepared.prepared.fence, request.requestedAt));
    } catch {
      return { result: 'uncertain', reasonCode: 'RECONCILIATION_UNCERTAIN' };
    }
  }

  requestCancellation(input: { requestId: string; attemptId: string; operationId: string; requestedAt: string }): string {
    const result = this.store.requestCancellation({ requestId: input.requestId, attemptId: input.attemptId, requestedAt: input.requestedAt });
    if (result === 'created' || result === 'duplicate') this.cancellationControllers.get(input.operationId)?.abort();
    return result;
  }

  observeCancellation(operationId: string, now: string): boolean {
    const cancelled = this.store.isRuntimeCancellationRequested(operationId, now);
    if (cancelled) this.cancellationControllers.get(operationId)?.abort();
    return cancelled;
  }
}
