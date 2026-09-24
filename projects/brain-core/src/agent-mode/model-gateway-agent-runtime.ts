import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { emptyExecutionTelemetry, finishExecutionTelemetry } from './execution-telemetry.js';
import { AGENT_MODE_MODEL_ROUTES, type AdmittedModelRef, type BedrockMessage, type ManagedProviderLifecycleEvent, type ModelAccessEvidence, type ModelGateway, type ModelGatewayFailureCode, type ModelGatewayProviderFailureDiagnostic, ModelGatewayError } from './model-gateway.js';
import { MODEL_GATEWAY_RUNTIME_PROFILE_REF, MODEL_GATEWAY_RUNTIME_REF } from './child-assignment.js';
import type { AgentRuntime, AgentRuntimeExecutionContext, AgentRuntimeResult } from './runtime-dispatch.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { canonicalJarvisConversationText } from './jarvis-conversation.js';
import { classifyJarvisTurn } from './jarvis-runtime-routing.js';
import { hasUnsupportedToolCallText } from './jarvis-routing-transparency.js';
import { buildJarvisReadOnlyContext } from './jarvis-read-only-context.js';
import { buildJarvisSkillContext, listJarvisSkillCandidates, selectJarvisSkillCandidates } from './jarvis-skill-context.js';

const MAX_RESULT_TEXT = 12_000;
const MAX_PROMPT = 12_000;
const MODEL_OUTPUT_TOKENS_BY_COMPLEXITY = Object.freeze({ simple: 512, moderate: 1_024, complex: 2_048, unknown: 1_024 });
const LIFECYCLE_STAGES = new Set<ManagedProviderLifecycleEvent['stage']>([
  'provider_command_prepare', 'provider_command_spawn_start', 'provider_command_spawn_success', 'provider_command_spawn_failure',
  'provider_process_exit', 'provider_process_signal', 'provider_stderr_present', 'provider_error_parse_start',
  'provider_error_parse_success', 'provider_error_parse_failure', 'provider_diagnostic_persist_start',
  'provider_diagnostic_persist_success', 'provider_diagnostic_persist_failure', 'model_gateway_normalize_error',
]);
const PROVIDER_SIGNALS = new Set<NonNullable<ManagedProviderLifecycleEvent['signal']>>([
  'SIGABRT', 'SIGALRM', 'SIGBUS', 'SIGFPE', 'SIGHUP', 'SIGILL', 'SIGINT', 'SIGKILL', 'SIGPIPE', 'SIGQUIT', 'SIGSEGV', 'SIGTERM', 'SIGTRAP',
]);
const PROVIDER_ERROR_KINDS = new Set<NonNullable<ManagedProviderLifecycleEvent['errorKind']>>([
  'spawn_error', 'timeout', 'output_limit', 'lifecycle_persistence_failure', 'malformed_error_output', 'empty_stderr', 'parser_failure', 'diagnostic_unavailable',
]);
const GATEWAY_FAILURE_CODES = new Set<ModelGatewayFailureCode>([
  'access_denied', 'account_access_unavailable', 'model_unavailable', 'route_invalid', 'throttled', 'timeout', 'provider_error', 'invalid_request', 'unknown',
]);

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
function bounded(value: string, max: number): string { return value.slice(0, max); }

function contextsForAttempt(store: AgentModeSqliteStateStore, rootGoalId: string) {
  const contexts = store.listJarvisContexts(rootGoalId);
  const preflight = [...store.listEvents(rootGoalId)].reverse().find((event) => event.eventType === 'jarvis_reflex_preflight');
  const payload = preflight?.payload as { selectedContextIds?: unknown } | undefined;
  if (!Array.isArray(payload?.selectedContextIds) || payload.selectedContextIds.length === 0) return contexts;
  const selected = new Set(payload.selectedContextIds.filter((value): value is string => typeof value === 'string'));
  return contexts.filter((context) => selected.has(context.contextId));
}

async function skillsForAttempt(store: AgentModeSqliteStateStore, rootGoalId: string) {
  const candidates = await listJarvisSkillCandidates();
  const preflight = [...store.listEvents(rootGoalId)].reverse().find((event) => event.eventType === 'jarvis_reflex_preflight');
  const payload = preflight?.payload as { mode?: unknown; selectedSkillIds?: unknown } | undefined;
  const selectedSkillIds = payload?.mode === 'ACTIVE_PILOT' && Array.isArray(payload.selectedSkillIds)
    ? payload.selectedSkillIds.filter((value): value is string => typeof value === 'string')
    : undefined;
  return selectJarvisSkillCandidates(candidates, selectedSkillIds);
}
export type ModelGatewayAgentRuntimeOptions = {
  gateway: ModelGateway;
  accessEvidence: Readonly<Partial<Record<AdmittedModelRef, ModelAccessEvidence>>>;
  now?: () => string;
};

/**
 * K4 AgentRuntime facade for already-admitted Bedrock ModelGateway routes.
 * It owns no child/task/attempt authority; RuntimeDispatcher remains the only
 * caller that records receipts and settles allocation.
 */
export class ModelGatewayAgentRuntime implements AgentRuntime {
  private readonly now: () => string;

  constructor(private readonly store: AgentModeSqliteStateStore, private readonly options: ModelGatewayAgentRuntimeOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async run(input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }): Promise<AgentRuntimeResult> {
    const context = input.context;
    const modelRef = context.modelRef as AdmittedModelRef;
    const route = AGENT_MODE_MODEL_ROUTES[modelRef];
    const startedAt = this.now();
    const monotonicStartedAt = performance.now();
    let telemetry = emptyExecutionTelemetry({ runtimeRef: MODEL_GATEWAY_RUNTIME_REF, runtimeProfileRef: MODEL_GATEWAY_RUNTIME_PROFILE_REF, startedAt, modelRef });
    const fail = (code: string, trace: string): AgentRuntimeResult => ({
      status: 'failed',
      runtimeReceiptId: `runtime-receipt:model-gateway:${digest({ attemptId: context.attemptId, code }).slice(0, 48)}`,
      resultHash: digest({ attemptId: context.attemptId, code }),
      evidenceRef: null,
      usage: { steps: 0, tokens: 0, cost: 0 },
      failureCode: code,
      traceSummary: [trace].slice(0, 8),
      telemetry: finishExecutionTelemetry(telemetry, 'failed', this.now()),
    });
    if (!route || modelRef === 'agent-mode/claude-opus-4.6') return fail('MODEL_RUNTIME_NOT_SUPPORTED', 'ModelGateway runtime accepts only MiniMax and GLM routes');
    if (input.signal.aborted || input.isCancellationRequested()) {
      telemetry = finishExecutionTelemetry(telemetry, 'cancelled', this.now());
      return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:model-gateway:${digest(context.attemptId).slice(0, 48)}`, resultHash: digest(`cancelled:${context.operationId}`), evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'CANCELLED_BEFORE_START', cancellationObserved: true, traceSummary: ['K4 cancellation authority observed'], telemetry };
    }
    const evidence = this.options.accessEvidence[modelRef];
    if (!evidence || evidence.state !== 'verified' || !evidence.catalogVisible || !evidence.callable || Date.parse(evidence.checkedAt) > Date.parse(startedAt) || Date.parse(evidence.freshUntil) <= Date.parse(startedAt)) return fail('MODEL_ACCESS_UNAVAILABLE', 'fresh verified model access evidence is required');
    const taskInput = this.store.getJarvisTaskInput(context.rootGoalId);
    if (!taskInput?.text) return fail('JARVIS_TASK_UNAVAILABLE', 'Brain-owned task input was unavailable');
    const conversationId = this.store.getJarvisConversationIdForRoot(context.rootGoalId);
    const turns = conversationId ? this.store.listJarvisConversationTurns(conversationId) : [];
    const conversationText = turns.length > 1 ? turns.map((turn) => `${turn.speakerRole === 'user' ? 'User' : 'Jarvis'}: ${canonicalJarvisConversationText(turn.text)}`).join('\n\n') : taskInput.text;
    const readOnlyContext = buildJarvisReadOnlyContext(contextsForAttempt(this.store, context.rootGoalId));
    const skillContext = buildJarvisSkillContext(await skillsForAttempt(this.store, context.rootGoalId));
    const prompt = bounded([conversationText, skillContext, readOnlyContext].filter((part): part is string => typeof part === 'string' && part.length > 0).join('\n\n'), MAX_PROMPT);
    const selectedRoute = route.routes[0];
    const messages: readonly BedrockMessage[] = [{ role: 'user', content: [{ text: prompt }] }];
    this.store.recordEvent({ eventId: `policy-admitted-model:${context.attemptId}`, entityType: 'attempt', entityId: context.attemptId, eventType: 'policy_admitted_model', occurredAt: startedAt, payload: { modelRef, modelId: route.modelId, routeId: selectedRoute.id, runtimeRef: MODEL_GATEWAY_RUNTIME_REF, evidenceVersion: evidence.version } });
    let diagnosticPersisted = false;
    let normalizationRecorded = false;
    let parserOutcome: ManagedProviderLifecycleEvent['parserOutcome'];
    const elapsedMs = () => Math.min(600_000, Math.max(0, Math.round(performance.now() - monotonicStartedAt)));
    const recordLifecycle = (event: ManagedProviderLifecycleEvent) => {
      if (!LIFECYCLE_STAGES.has(event.stage)) throw new Error('provider lifecycle stage is not admitted');
      const safeElapsedMs = Number.isInteger(event.elapsedMs) ? Math.min(600_000, Math.max(0, event.elapsedMs)) : 0;
      if (event.stage === 'provider_error_parse_success' || event.stage === 'provider_error_parse_failure') parserOutcome = event.parserOutcome;
      this.store.recordEvent({
        eventId: `provider-lifecycle:${context.attemptId}:${event.stage}`,
        entityType: 'attempt',
        entityId: context.attemptId,
        eventType: event.stage,
        occurredAt: this.now(),
        payload: {
          schemaVersion: 'agent-mode.provider-lifecycle.v1',
          attemptId: context.attemptId,
          operationId: context.operationId,
          providerId: 'amazon-bedrock',
          modelRef,
          modelId: route.modelId,
          region: evidence.region,
          elapsedMs: safeElapsedMs,
          ...(Number.isInteger(event.exitCode) && event.exitCode! >= -255 && event.exitCode! <= 255 ? { exitCode: event.exitCode } : {}),
          ...(event.signal && PROVIDER_SIGNALS.has(event.signal) ? { signal: event.signal } : {}),
          ...(typeof event.stderrPresent === 'boolean' ? { stderrPresent: event.stderrPresent } : {}),
          ...(event.parserOutcome === 'success' || event.parserOutcome === 'failure' || event.parserOutcome === 'skipped' ? { parserOutcome: event.parserOutcome } : {}),
          ...(event.errorKind && PROVIDER_ERROR_KINDS.has(event.errorKind) ? { errorKind: event.errorKind } : {}),
          ...(event.publicErrorClass && GATEWAY_FAILURE_CODES.has(event.publicErrorClass) ? { publicErrorClass: event.publicErrorClass } : {}),
        },
      });
      if (event.stage === 'model_gateway_normalize_error') normalizationRecorded = true;
    };
    const persistProviderDiagnostic = (failureCode: ModelGatewayFailureCode, diagnostic: ModelGatewayProviderFailureDiagnostic) => {
      try {
        recordLifecycle({ stage: 'provider_diagnostic_persist_start', elapsedMs: elapsedMs() });
        if (!diagnostic) {
          recordLifecycle({ stage: 'provider_diagnostic_persist_failure', elapsedMs: elapsedMs(), parserOutcome: parserOutcome ?? 'failure', errorKind: 'diagnostic_unavailable' });
          return;
        }
        this.store.recordEvent({
          eventId: `model-gateway-provider-failure:${context.attemptId}`,
          entityType: 'attempt',
          entityId: context.attemptId,
          eventType: 'model_gateway_provider_failure_diagnostic',
          occurredAt: this.now(),
          payload: {
            schemaVersion: 'agent-mode.model-gateway-provider-failure.v1',
            gatewayFailureCode: failureCode,
            providerId: 'amazon-bedrock',
            modelRef,
            modelId: route.modelId,
            region: evidence.region,
            providerCode: diagnostic.providerCode,
            providerMessage: diagnostic.providerMessage,
            ...(diagnostic.requestId ? { requestId: diagnostic.requestId } : {}),
            ...(diagnostic.httpStatus ? { httpStatus: diagnostic.httpStatus } : {}),
          },
        });
        diagnosticPersisted = true;
        recordLifecycle({ stage: 'provider_diagnostic_persist_success', elapsedMs: elapsedMs() });
      } catch {
        try {
          recordLifecycle({ stage: 'provider_diagnostic_persist_failure', elapsedMs: elapsedMs(), errorKind: 'lifecycle_persistence_failure' });
        } catch { /* the control-plane event store itself may be unavailable */ }
        const error = new Error('provider diagnostic persistence failed');
        Object.assign(error, { code: 'BRAIN_PROVIDER_LIFECYCLE_PERSISTENCE_FAILED', providerEffectMayHaveStarted: true });
        throw error;
      }
    };
    try {
      const complexity = classifyJarvisTurn(taskInput.text);
      const maxTokens = Math.min(MODEL_OUTPUT_TOKENS_BY_COMPLEXITY[complexity], route.maxOutputTokens);
      const result = await this.options.gateway.invoke({ providerId: 'amazon-bedrock', modelRef, modelId: selectedRoute.id, routeKind: selectedRoute.kind, routeId: selectedRoute.id, messages, maxTokens, operationId: context.operationId, attemptId: context.attemptId, now: startedAt, deadline: context.deadline, accessEvidence: { ...evidence, modelId: selectedRoute.id, routeKind: selectedRoute.kind, routeId: selectedRoute.id } }, { recordLifecycle, persistProviderDiagnostic });
      if (input.signal.aborted || input.isCancellationRequested()) {
        telemetry = finishExecutionTelemetry(telemetry, 'cancelled', this.now());
        return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:model-gateway:${digest(result.operationId).slice(0, 48)}`, resultHash: digest(`cancelled:${result.operationId}`), evidenceRef: null, usage: { steps: 1, tokens: result.usage.totalTokens, cost: result.cost.estimatedUsd ?? 0 }, failureCode: 'CANCELLED_AFTER_PROVIDER_RESULT', cancellationObserved: true, traceSummary: ['K4 cancellation authority observed'], telemetry };
      }
      telemetry = { ...telemetry, provider: result.providerId, modelRef: result.modelRef, modelDisplayName: result.modelRef, usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cachedInputTokens: null, cachedOutputTokens: null, reasoningTokens: null, totalTokens: result.usage.totalTokens }, cost: { estimatedUsd: result.cost.estimatedUsd, source: result.cost.estimatedUsd === null ? 'unavailable' : 'brain-pricing', pricingVersion: result.cost.pricingSource, confidence: result.cost.estimatedUsd === null ? 'unavailable' : 'estimated' } };
      if ((result.toolUses?.length ?? 0) > 0 || hasUnsupportedToolCallText(result.text)) {
        telemetry = finishExecutionTelemetry(telemetry, 'failed', result.completedAt);
        const failureHash = digest({ attemptId: context.attemptId, operationId: context.operationId, code: 'UNSUPPORTED_TOOL_REQUEST' });
        return { status: 'failed', runtimeReceiptId: `runtime-receipt:model-gateway:${failureHash.slice(0, 48)}`, resultHash: failureHash, evidenceRef: null, usage: { steps: 1, tokens: result.usage.totalTokens, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cost: result.cost.estimatedUsd ?? 0 }, failureCode: 'UNSUPPORTED_TOOL_REQUEST', traceSummary: ['model output requested an unavailable tool; no tool was executed'], telemetry };
      }
      telemetry = finishExecutionTelemetry(telemetry, 'succeeded', result.completedAt);
      const resultHash = digest({ attemptId: context.attemptId, operationId: context.operationId, text: result.text });
      return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:model-gateway:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: `evidence:model-gateway:${resultHash.slice(0, 48)}`, usage: { steps: 1, tokens: result.usage.totalTokens, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cost: result.cost.estimatedUsd ?? 0 }, resultText: bounded(result.text, MAX_RESULT_TEXT), traceSummary: ['model-gateway', modelRef], telemetry };
    } catch (error) {
      if (error instanceof ModelGatewayError) {
        if (error.providerDiagnostic && !diagnosticPersisted) persistProviderDiagnostic(error.code, error.providerDiagnostic);
        if (!normalizationRecorded) recordLifecycle({ stage: 'model_gateway_normalize_error', elapsedMs: elapsedMs(), publicErrorClass: error.code });
        return fail(`MODEL_GATEWAY_${error.code.toUpperCase()}`, 'ModelGateway admission or provider request failed');
      }
      throw error;
    }
  }

  async reconcile(): Promise<{ status: 'unsupported' }> { return { status: 'unsupported' }; }
}
