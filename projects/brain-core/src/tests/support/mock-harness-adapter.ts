import { createHash } from 'node:crypto';
import { BrainHarnessEventBuffer, type BrainHarnessAdapter, type BrainHarnessDescriptor, type BrainHarnessHandle, type BrainHarnessInspection, type BrainHarnessResult, type BrainHarnessStartInput, type BrainHarnessStopResult, type HarnessCompatibilityProbe } from '../../agent-mode/harness-spi.js';

export type MockHarnessOutcome = 'success' | 'failure' | 'cancel' | 'uncertainty';

export type MockHarnessFixture = {
  outcome?: MockHarnessOutcome;
  emitUnknownEvent?: boolean;
  tokenUsage?: { inputTokens: number; outputTokens: number };
  contextSupported?: boolean;
  costSupported?: boolean;
};

type Session = {
  handle: BrainHarnessHandle;
  events: BrainHarnessEventBuffer;
  controller: AbortController;
  status: BrainHarnessInspection['status'];
  startedAt: string;
  updatedAt: string;
};

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export class MockBrainHarnessAdapter implements BrainHarnessAdapter {
  public readonly starts: string[] = [];
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly fixture: MockHarnessFixture = {}) {}

  describe(): BrainHarnessDescriptor {
    return {
      schemaVersion: 'brain-harness-spi.v1',
      adapterId: 'brain.test.mock-harness',
      adapterVersion: '1',
      installationClass: 'BRAIN_MANAGED_OPTIONAL',
      protocol: 'direct-process',
      capabilities: {
        structuredEvents: 'SUPPORTED', streamingResult: 'SUPPORTED', tokenUsage: this.fixture.tokenUsage ? 'SUPPORTED' : 'UNKNOWN', contextUsage: this.fixture.contextSupported === false ? 'UNSUPPORTED' : 'UNKNOWN', costUsage: this.fixture.costSupported === true ? 'SUPPORTED' : 'UNSUPPORTED', toolEvents: 'UNKNOWN', resume: 'UNSUPPORTED', cancel: 'SUPPORTED', inspect: 'SUPPORTED', filesystem: 'UNSUPPORTED', shell: 'UNSUPPORTED', browser: 'UNSUPPORTED', MCP: 'UNSUPPORTED', subagents: 'UNSUPPORTED',
      },
    };
  }

  async probeCompatibility(): Promise<HarnessCompatibilityProbe> {
    return { schemaVersion: 'brain-harness-spi.v1', adapterId: 'brain.test.mock-harness', checkedAt: new Date().toISOString(), binaryDiscoverable: true, observedVendorVersion: 'mock-1.0.0', structuredProtocol: 'COMPATIBLE', mandatoryContractCompatible: true, optionalCapabilities: this.describe().capabilities, reasonCode: 'COMPATIBLE' };
  }

  async start(input: BrainHarnessStartInput): Promise<BrainHarnessHandle> {
    const executionId = `harness-execution:mock:${hash(input.brainAttemptId).slice(0, 48)}`;
    const handle = { executionId, externalSessionId: null, result: Promise.resolve(undefined as unknown as BrainHarnessResult) };
    const now = new Date().toISOString();
    const session: Session = { handle, events: new BrainHarnessEventBuffer(), controller: new AbortController(), status: 'starting', startedAt: now, updatedAt: now };
    this.sessions.set(executionId, session);
    this.starts.push(input.brainAttemptId);
    const result = this.execute(session, input);
    handle.result = result;
    void result.catch(() => undefined);
    return handle;
  }

  events(handle: BrainHarnessHandle): AsyncIterable<import('../../agent-mode/harness-spi.js').BrainHarnessEvent> {
    const session = this.sessions.get(handle.executionId);
    if (!session) throw new Error('HARNESS_HANDLE_UNKNOWN');
    return session.events;
  }

  async stop(handle: BrainHarnessHandle, _reason: string): Promise<BrainHarnessStopResult> {
    const session = this.sessions.get(handle.executionId);
    if (!session) return { status: 'unsupported', reasonCode: 'HARNESS_HANDLE_UNKNOWN' };
    if (['succeeded', 'failed', 'cancelled', 'uncertain'].includes(session.status)) return { status: 'already-terminal' };
    session.controller.abort();
    return { status: 'requested' };
  }

  async inspect(handle: BrainHarnessHandle): Promise<BrainHarnessInspection> {
    const session = this.sessions.get(handle.executionId);
    if (!session) throw new Error('HARNESS_HANDLE_UNKNOWN');
    return { executionId: session.handle.executionId, externalSessionId: session.handle.externalSessionId, status: session.status, startedAt: session.startedAt, updatedAt: session.updatedAt };
  }

  async close(handle: BrainHarnessHandle): Promise<void> {
    const session = this.sessions.get(handle.executionId);
    if (!session) return;
    session.controller.abort();
    await handle.result.catch(() => undefined);
    this.sessions.delete(handle.executionId);
  }

  private async execute(session: Session, input: BrainHarnessStartInput): Promise<BrainHarnessResult> {
    session.status = 'running';
    session.events.push({ type: 'started', occurredAt: session.startedAt, executionId: session.handle.executionId, externalSessionId: `mock-session:${hash(input.brainAttemptId).slice(0, 16)}` });
    session.handle.externalSessionId = `mock-session:${hash(input.brainAttemptId).slice(0, 16)}`;
    if (this.fixture.emitUnknownEvent) session.events.push({ type: 'unknown', occurredAt: new Date().toISOString(), sourceType: 'mock.future.event', safeActivity: 'Unknown harness event ignored' });
    if (session.controller.signal.aborted || this.fixture.outcome === 'cancel') {
      session.status = 'cancelled';
      const resultHash = hash(`${input.brainAttemptId}:cancelled`);
      const result: BrainHarnessResult = { status: 'cancelled', runtimeReceiptId: `runtime-receipt:mock:${resultHash.slice(0, 48)}`, resultHash, evidenceRef: null, settlement: { steps: 1, tokens: 0, cost: 0 }, failureCode: 'MOCK_CANCELLED', traceSummary: ['mock-cancelled'], cancellationObserved: true };
      session.events.push({ type: 'cancelled', occurredAt: new Date().toISOString(), reasonCode: 'MOCK_CANCELLED' });
      session.events.push({ type: 'completed', occurredAt: new Date().toISOString(), status: 'cancelled' });
      session.events.end();
      return result;
    }
    const observedUsage = this.fixture.tokenUsage ? { inputTokens: this.fixture.tokenUsage.inputTokens, outputTokens: this.fixture.tokenUsage.outputTokens, cachedInputTokens: null, cachedOutputTokens: null, reasoningTokens: null, totalTokens: this.fixture.tokenUsage.inputTokens + this.fixture.tokenUsage.outputTokens } : undefined;
    session.events.push({ type: 'activity', occurredAt: new Date().toISOString(), safeActivity: 'Mock harness working', status: 'running' });
    if (observedUsage) session.events.push({ type: 'usage', occurredAt: new Date().toISOString(), usage: observedUsage });
    if (this.fixture.outcome === 'uncertainty') {
      session.status = 'uncertain';
      session.events.push({ type: 'warning', occurredAt: new Date().toISOString(), reasonCode: 'MOCK_UNCERTAIN' });
      session.events.end();
      throw new Error('runtime_outcome_uncertain');
    }
    const resultHash = hash(`${input.brainAttemptId}:${this.fixture.outcome ?? 'success'}`);
    const status = this.fixture.outcome === 'failure' ? 'failed' : 'succeeded';
    session.status = status;
    const settlement = { steps: 1, tokens: 0, cost: 0 };
    const result: BrainHarnessResult = {
      status,
      runtimeReceiptId: `runtime-receipt:mock:${resultHash.slice(0, 48)}`,
      resultHash,
      evidenceRef: status === 'succeeded' ? `evidence:mock:${resultHash.slice(0, 48)}` : null,
      settlement,
      ...(status === 'failed' ? { failureCode: 'MOCK_FAILED' } : {}),
      traceSummary: [`mock-${status}`],
      ...(status === 'succeeded' ? { resultText: 'bounded mock result' } : {}),
    };
    session.events.push(status === 'succeeded' ? { type: 'result', occurredAt: new Date().toISOString(), resultRef: `result:mock:${resultHash.slice(0, 48)}`, evidenceRef: result.evidenceRef } : { type: 'failure', occurredAt: new Date().toISOString(), reasonCode: 'MOCK_FAILED' });
    session.events.push({ type: 'completed', occurredAt: new Date().toISOString(), status });
    session.events.end();
    return result;
  }
}
