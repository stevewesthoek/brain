import { createHash } from 'node:crypto';
import { emptyExecutionTelemetry, finishExecutionTelemetry, type AgentModeExecutionTelemetry } from './execution-telemetry.js';
import { CodexHarnessAdapter } from './codex-harness-adapter.js';
import { codexModelArgument } from './codex-model-policy.js';
import { admitBrainRequestedModel } from './model-admission-policy.js';
import type { BrainHarnessAdapter, BrainHarnessEvent } from './harness-spi.js';
import type { AgentRuntime, AgentRuntimeExecutionContext, AgentRuntimeResult } from './runtime-dispatch.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { CODEX_CLI_RUNTIME_PROFILE_REF, CODEX_CLI_RUNTIME_REF } from './child-assignment.js';
import { createAttemptExecutionScope } from './jarvis-local-context.js';

function digest(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }

/** K4 compatibility facade over the provider-neutral Brain Harness SPI. */
export class CodexCliAgentRuntime implements AgentRuntime {
  private readonly adapter: BrainHarnessAdapter;

  constructor(private readonly store: AgentModeSqliteStateStore, command = process.env.BRAIN_CODEX_BIN ?? 'codex', adapter?: BrainHarnessAdapter) {
    this.adapter = adapter ?? new CodexHarnessAdapter(command);
  }

  async run(input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }): Promise<AgentRuntimeResult> {
    const task = this.store.getTask(input.context.rootGoalId);
    const taskInput = this.store.getJarvisTaskInput(input.context.rootGoalId);
    const rootContexts = this.store.listJarvisContexts(input.context.rootGoalId);
    const sourceEvent = this.store.getSchedulerEvent(input.context.sourceEventId);
    const requestedContextIds = sourceEvent?.payload.contextIds;
    const selectedContextIds = Array.isArray(requestedContextIds) && requestedContextIds.every((value) => typeof value === 'string') ? new Set(requestedContextIds) : null;
    const executionContexts = selectedContextIds ? rootContexts.filter((context) => selectedContextIds.has(context.contextId)) : rootContexts;
    if (selectedContextIds && executionContexts.length !== selectedContextIds.size) {
      const resultHash = digest('jarvis-context-selection-unavailable');
      const telemetry = finishExecutionTelemetry(emptyExecutionTelemetry({ runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF }), 'failed', new Date().toISOString());
      return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'CONTEXT_SELECTION_UNAVAILABLE', traceSummary: ['durable Attempt context selection was unavailable'], telemetry };
    }
    const contextScope = createAttemptExecutionScope(input.context.rootGoalId, input.context.attemptId, executionContexts);
    this.store.recordJarvisAttemptExecutionScope(contextScope);
    const conversationId = this.store.getJarvisConversationIdForRoot(input.context.rootGoalId);
    const conversationTurns = conversationId ? this.store.listJarvisConversationTurns(conversationId) : [];
    const prompt = taskInput?.text ? conversationTurns.length > 1
      ? conversationTurns.map((turn) => `${turn.speakerRole === 'user' ? 'User' : 'Jarvis'}: ${turn.text}`).join('\n\n')
      : taskInput.text
      : undefined;
    if (!prompt) {
      const resultHash = digest('jarvis-context-task-unavailable');
      const telemetry = finishExecutionTelemetry(emptyExecutionTelemetry({ runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF }), 'failed', new Date().toISOString());
      return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 1, tokens: 0, cost: 0 }, failureCode: 'JARVIS_TASK_UNAVAILABLE', traceSummary: ['Brain-owned task input was unavailable'], telemetry };
    }
    if (input.isCancellationRequested()) {
      const resultHash = digest('terminal-intake-cancelled-before-start');
      const telemetry = finishExecutionTelemetry(emptyExecutionTelemetry({ runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF }), 'cancelled', new Date().toISOString());
      return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'CANCELLED_BEFORE_START', traceSummary: ['K4 cancellation authority denied dispatch'], cancellationObserved: true, telemetry };
    }

    // `codex` is an explicit, already-approved runtime escalation. It is not
    // an Auto model candidate and therefore has no provider model to admit.
    // Keep the existing Codex model-policy default for the harness argument.
    const admittedModel = task?.requestedModel === 'codex' || task?.requestedModel === 'codex-cli'
      ? admitBrainRequestedModel('gpt-5.6-luna')
      : admitBrainRequestedModel(task?.requestedModel ?? 'auto');
    if (!admittedModel) {
      const resultHash = digest('terminal-intake-model-not-admitted');
      const telemetry = finishExecutionTelemetry(emptyExecutionTelemetry({ runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF }), 'failed', new Date().toISOString());
      return { status: 'failed', runtimeReceiptId: `runtime-receipt:codex:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'MODEL_NOT_ADMITTED', traceSummary: ['Brain/K4 model admission denied dispatch'], telemetry };
    }
    const modelArgument = codexModelArgument(admittedModel);

    const handle = await this.adapter.start({
      schemaVersion: 'brain-harness-spi.v1',
      brainAttemptId: input.context.attemptId,
      executionScope: contextScope,
      executionProfile: CODEX_CLI_RUNTIME_PROFILE_REF,
      requestedModel: modelArgument,
      taskText: prompt,
      deadline: input.context.deadline,
      correlation: { rootGoalId: input.context.rootGoalId, taskId: input.context.taskId, runId: input.context.runId, attemptId: input.context.attemptId, dispatchId: input.context.dispatchId },
    });

    let telemetry: AgentModeExecutionTelemetry = emptyExecutionTelemetry({ runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF, modelRef: modelArgument });
    let telemetrySequence = 0;
    const recordTelemetry = (event: BrainHarnessEvent): void => {
      if (event.telemetry) telemetry = event.telemetry;
      if (event.telemetry) {
        try {
          this.store.recordEvent({ eventId: `runtime-telemetry:${input.context.attemptId}:${telemetrySequence++}:${event.occurredAt}:${event.type}`, entityType: 'attempt', entityId: input.context.attemptId, eventType: 'runtime_telemetry', occurredAt: event.occurredAt, payload: { telemetry: event.telemetry, type: event.type } });
        } catch { /* telemetry must never change K4 execution authority */ }
      }
    };
    const abortListener = (): void => { void this.adapter.stop(handle, 'brain-cancellation'); };
    input.signal.addEventListener('abort', abortListener, { once: true });
    const eventTask = (async (): Promise<void> => {
      for await (const event of this.adapter.events(handle)) {
        recordTelemetry(event);
        if (input.signal.aborted || input.isCancellationRequested()) await this.adapter.stop(handle, 'brain-cancellation');
      }
    })();
    try {
      const result = await handle.result;
      await eventTask;
      const { settlement, ...harnessResult } = result;
      return { ...harnessResult, usage: settlement, telemetry: result.telemetry ?? telemetry };
    } finally {
      input.signal.removeEventListener('abort', abortListener);
      await eventTask.catch(() => undefined);
    }
  }

  async reconcile(): Promise<{ status: 'unsupported' }> { return { status: 'unsupported' }; }
}

export const CODEX_CLI_RUNTIME_IDENTITY = CODEX_CLI_RUNTIME_REF;
