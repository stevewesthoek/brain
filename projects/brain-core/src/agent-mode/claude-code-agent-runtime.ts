import { emptyExecutionTelemetry, finishExecutionTelemetry } from './execution-telemetry.js';
import { CLAUDE_CODE_RUNTIME_PROFILE_REF, CLAUDE_CODE_RUNTIME_REF } from './child-assignment.js';
import { ClaudeCodeHarnessAdapter } from './claude-code-harness-adapter.js';
import type { BrainHarnessAdapter, BrainHarnessEvent } from './harness-spi.js';
import type { AgentRuntime, AgentRuntimeExecutionContext, AgentRuntimeResult } from './runtime-dispatch.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { createAttemptExecutionScope } from './jarvis-local-context.js';
import { canonicalJarvisConversationText } from './jarvis-conversation.js';
import { createHash } from 'node:crypto';

const MAX_PROMPT = 12_000;

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
function bounded(value: string, max: number): string { return value.length <= max ? value : value.slice(0, max); }

/** K4 runtime facade for the externally managed Claude Code Opus process. */
export class ClaudeCodeAgentRuntime implements AgentRuntime {
  private readonly adapter: BrainHarnessAdapter;
  constructor(private readonly store: AgentModeSqliteStateStore, command = process.env.BRAIN_CLAUDE_CODE_BIN ?? 'claude', adapter?: BrainHarnessAdapter) { this.adapter = adapter ?? new ClaudeCodeHarnessAdapter(command); }

  async run(input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }): Promise<AgentRuntimeResult> {
    const context = input.context;
    const taskInput = this.store.getJarvisTaskInput(context.rootGoalId);
    const conversationId = this.store.getJarvisConversationIdForRoot(context.rootGoalId);
    const conversationTurns = conversationId ? this.store.listJarvisConversationTurns(conversationId) : [];
    const taskText = taskInput?.text
      ? bounded(conversationTurns.length > 1
        ? conversationTurns.map((turn) => `${turn.speakerRole === 'user' ? 'User' : 'Jarvis'}: ${canonicalJarvisConversationText(turn.text)}`).join('\n\n')
        : taskInput.text, MAX_PROMPT)
      : undefined;
    const startedAt = new Date().toISOString();
    let telemetry = emptyExecutionTelemetry({ runtimeRef: CLAUDE_CODE_RUNTIME_REF, runtimeProfileRef: CLAUDE_CODE_RUNTIME_PROFILE_REF, startedAt, modelRef: context.modelRef });
    const fail = (code: string): AgentRuntimeResult => ({ status: 'failed', runtimeReceiptId: `runtime-receipt:claude-code:${digest({ attempt: context.attemptId, code }).slice(0, 48)}`, resultHash: digest({ attempt: context.attemptId, code }), evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: code, traceSummary: ['Claude Code admission failed'], telemetry: finishExecutionTelemetry(telemetry, 'failed', new Date().toISOString()) });
    if (!taskText) return fail('JARVIS_TASK_UNAVAILABLE');
    if (input.signal.aborted || input.isCancellationRequested()) {
      telemetry = finishExecutionTelemetry(telemetry, 'cancelled', new Date().toISOString());
      return { status: 'cancelled', runtimeReceiptId: `runtime-receipt:claude-code:${digest(context.attemptId).slice(0, 48)}`, resultHash: digest(`cancelled:${context.attemptId}`), evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'CANCELLED_BEFORE_START', cancellationObserved: true, traceSummary: ['K4 cancellation authority observed'], telemetry };
    }
    const compatibility = this.adapter.probeCompatibility ? await this.adapter.probeCompatibility() : null;
    if (!compatibility?.mandatoryContractCompatible) return fail(compatibility?.reasonCode === 'BINARY_NOT_FOUND' ? 'CLAUDE_CODE_NOT_FOUND' : 'CLAUDE_CODE_PROTOCOL_UNSUPPORTED');
    const contexts = this.store.listJarvisContexts(context.rootGoalId);
    const executionScope = createAttemptExecutionScope(context.rootGoalId, context.attemptId, contexts);
    this.store.recordJarvisAttemptExecutionScope(executionScope);
    const handle = await this.adapter.start({ schemaVersion: 'brain-harness-spi.v1', brainAttemptId: context.attemptId, executionScope, executionProfile: CLAUDE_CODE_RUNTIME_PROFILE_REF, requestedModel: 'opus', taskText, deadline: context.deadline, correlation: { rootGoalId: context.rootGoalId, taskId: context.taskId, runId: context.runId, attemptId: context.attemptId, dispatchId: context.dispatchId } });
    const eventTask = (async (): Promise<void> => { for await (const event of this.adapter.events(handle)) { this.recordTelemetry(context, event); if (input.signal.aborted || input.isCancellationRequested()) await this.adapter.stop(handle, 'brain-cancellation'); } })();
    const abort = (): void => { void this.adapter.stop(handle, 'brain-cancellation'); };
    input.signal.addEventListener('abort', abort, { once: true });
    try {
      const result = await handle.result;
      await eventTask;
      telemetry = result.telemetry ?? telemetry;
      if (result.status === 'succeeded') telemetry = finishExecutionTelemetry(telemetry, 'succeeded', new Date().toISOString());
      else if (result.status === 'cancelled') telemetry = finishExecutionTelemetry(telemetry, 'cancelled', new Date().toISOString());
      else telemetry = finishExecutionTelemetry(telemetry, 'failed', new Date().toISOString());
      return { ...result, usage: result.settlement, telemetry };
    } finally {
      input.signal.removeEventListener('abort', abort);
      await eventTask.catch(() => undefined);
      await this.adapter.close(handle).catch(() => undefined);
    }
  }

  private recordTelemetry(context: AgentRuntimeExecutionContext, event: BrainHarnessEvent): void {
    if (!event.telemetry) return;
    try { this.store.recordEvent({ eventId: `runtime-telemetry:${context.attemptId}:${event.occurredAt}:${event.type}`, entityType: 'attempt', entityId: context.attemptId, eventType: 'runtime_telemetry', occurredAt: event.occurredAt, payload: { telemetry: event.telemetry, type: event.type } }); } catch { /* telemetry is observational */ }
  }

  async reconcile(): Promise<{ status: 'unsupported' }> { return { status: 'unsupported' }; }
}
