import assert from 'node:assert/strict';
import test from 'node:test';
import { ClaudeCodeAgentRuntime } from '../agent-mode/claude-code-agent-runtime.js';
import type { BrainHarnessAdapter, BrainHarnessDescriptor, BrainHarnessEvent, BrainHarnessHandle, BrainHarnessInspection, BrainHarnessResult, BrainHarnessStartInput, BrainHarnessStopResult, HarnessCompatibilityProbe } from '../agent-mode/harness-spi.js';
import type { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

class CapturingAdapter implements BrainHarnessAdapter {
  public readonly inputs: BrainHarnessStartInput[] = [];
  describe(): BrainHarnessDescriptor { return { schemaVersion: 'brain-harness-spi.v1', adapterId: 'brain.test.claude-capture', adapterVersion: '1', installationClass: 'BRAIN_MANAGED_OPTIONAL', protocol: 'direct-process', capabilities: { structuredEvents: 'SUPPORTED', streamingResult: 'SUPPORTED', tokenUsage: 'UNKNOWN', contextUsage: 'UNKNOWN', costUsage: 'UNKNOWN', toolEvents: 'UNKNOWN', resume: 'UNSUPPORTED', cancel: 'SUPPORTED', inspect: 'SUPPORTED', filesystem: 'UNSUPPORTED', shell: 'UNSUPPORTED', browser: 'UNSUPPORTED', MCP: 'UNSUPPORTED', subagents: 'UNSUPPORTED' } }; }
  async probeCompatibility(): Promise<HarnessCompatibilityProbe> { return { schemaVersion: 'brain-harness-spi.v1', adapterId: 'brain.test.claude-capture', checkedAt: '2026-09-21T00:00:00.000Z', binaryDiscoverable: true, observedVendorVersion: 'fixture', structuredProtocol: 'COMPATIBLE', mandatoryContractCompatible: true, optionalCapabilities: this.describe().capabilities, reasonCode: 'COMPATIBLE' }; }
  async start(input: BrainHarnessStartInput): Promise<BrainHarnessHandle> {
    this.inputs.push(input);
    const result: BrainHarnessResult = { status: 'succeeded', runtimeReceiptId: 'runtime-receipt:fixture', resultHash: 'a'.repeat(64), evidenceRef: 'evidence:fixture', settlement: { steps: 1, tokens: 0, cost: 0 }, traceSummary: ['fixture'], resultText: 'bounded fixture result' };
    return { executionId: 'harness-execution:fixture', externalSessionId: null, result: Promise.resolve(result) };
  }
  async *events(_handle: BrainHarnessHandle): AsyncIterable<BrainHarnessEvent> { /* no provider events in this unit test */ }
  async stop(_handle: BrainHarnessHandle, _reason: string): Promise<BrainHarnessStopResult> { return { status: 'already-terminal' }; }
  async inspect(_handle: BrainHarnessHandle): Promise<BrainHarnessInspection> { return { executionId: 'harness-execution:fixture', externalSessionId: null, status: 'succeeded', startedAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z' }; }
  async close(_handle: BrainHarnessHandle): Promise<void> {}
}

test('Claude Code runtime hands durable Jarvis conversation history to the non-persistent harness', async () => {
  const adapter = new CapturingAdapter();
  const store = {
    getJarvisTaskInput: () => ({ text: 'third request', rootGoalId: 'goal:fixture', taskId: 'goal:fixture', jarvisAgentId: 'agent:jarvis', source: 'terminal', contentHash: 'hash' }),
    getJarvisConversationIdForRoot: () => 'conversation:fixture',
    listJarvisConversationTurns: () => [
      { speakerRole: 'user', text: 'first request' },
      { speakerRole: 'jarvis', text: 'first response' },
      { speakerRole: 'user', text: 'third request' },
    ],
    listJarvisContexts: () => [],
    recordJarvisAttemptExecutionScope: () => undefined,
  } as unknown as AgentModeSqliteStateStore;
  const runtime = new ClaudeCodeAgentRuntime(store, 'claude-fixture', adapter);
  await runtime.run({
    context: {
      assignmentIntentKey: 'assignment-intent:sha256:' + 'b'.repeat(64), childAgentId: 'agent:child', taskId: 'task:fixture', runId: 'run:fixture', attemptId: 'attempt:fixture', runtimeRef: 'runtime:claude-code', runtimeProfileRef: 'runtime-profile:claude-code-read-only-v1', modelRef: 'agent-mode/claude-opus-4.6', roleTemplateId: 'agent-mode.role.read-only.v1', roleTemplateVersion: 1, policyId: 'policy:fixture', policyVersion: 1, capabilitySetHash: 'capability-set:fixture', capabilities: ['repo.read'], repositoryScope: null, resourceScope: null, rootGoalId: 'goal:fixture', sourceEventId: 'event:fixture', stepCeiling: 1, costCeiling: 1, tokenCeiling: 1, remainingTokens: 1, remainingSteps: 1, remainingCost: 1, deadline: '2099-01-01T00:00:00.000Z', status: 'dispatch_ready', operationId: 'operation:fixture', dispatchId: 'dispatch:fixture', controllerRef: 'controller:fixture', leaseId: 'lease:fixture', fence: 1, correlationId: 'goal:fixture', causationId: 'event:fixture',
    },
    signal: new AbortController().signal,
    isCancellationRequested: () => false,
  });
  assert.equal(adapter.inputs.length, 1);
  assert.equal(adapter.inputs[0]?.taskText, 'User: first request\n\nJarvis: first response\n\nUser: third request');
});
