import type { AgentModeExecutionContext, AgentModeExecutionTelemetry, AgentModeExecutionUsage } from './execution-telemetry.js';
import type { JarvisAttemptExecutionScopeV1 } from './jarvis-local-context.js';

export const BRAIN_HARNESS_SPI_SCHEMA_VERSION = 'brain-harness-spi.v1' as const;

export const HARNESS_CAPABILITY_KEYS = [
  'structuredEvents',
  'streamingResult',
  'tokenUsage',
  'contextUsage',
  'costUsage',
  'toolEvents',
  'resume',
  'cancel',
  'inspect',
  'filesystem',
  'shell',
  'browser',
  'MCP',
  'subagents',
] as const;

export type HarnessCapabilityKey = typeof HARNESS_CAPABILITY_KEYS[number];
export type HarnessCapabilityState = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
export type HarnessCapabilities = Readonly<Record<HarnessCapabilityKey, HarnessCapabilityState>>;
export type HarnessInstallationClass = 'VENDOR_OR_USER_MANAGED' | 'BRAIN_MANAGED_OPTIONAL';

export type BrainHarnessDescriptor = {
  schemaVersion: typeof BRAIN_HARNESS_SPI_SCHEMA_VERSION;
  adapterId: string;
  adapterVersion: string;
  installationClass: HarnessInstallationClass;
  protocol: 'direct-process' | 'structured-stdio' | 'jsonl' | 'json-rpc' | 'ACP';
  capabilities: HarnessCapabilities;
};

export type BrainHarnessStartInput = {
  schemaVersion: typeof BRAIN_HARNESS_SPI_SCHEMA_VERSION;
  brainAttemptId: string;
  /** Canonical Brain-admitted Attempt scope. It may contain zero, one, or many roots. */
  executionScope?: JarvisAttemptExecutionScopeV1;
  /** V1 compatibility input only. New callers must use executionScope. */
  workspace?: {
    repositoryRoot: string;
    repositoryRef: string;
    access: 'read-only';
  };
  executionProfile: string;
  requestedModel: string | null;
  taskText: string;
  deadline: string;
  correlation: {
    rootGoalId: string;
    taskId: string;
    runId: string;
    attemptId: string;
    dispatchId: string;
  };
};

/** Numeric fields required by K4's admitted/settled envelope. These are not provider observations. */
export type BrainHarnessSettlementUsage = {
  steps: number;
  tokens: number;
  cost: number;
};

/** Provider observations remain nullable when the harness did not report them. */
export type BrainHarnessObservedUsage = AgentModeExecutionUsage;

export type BrainHarnessResult = {
  status: 'succeeded' | 'failed' | 'cancelled';
  runtimeReceiptId: string;
  resultHash: string;
  evidenceRef: string | null;
  settlement: BrainHarnessSettlementUsage;
  failureCode?: string;
  traceSummary: readonly string[];
  resultText?: string;
  cancellationObserved?: boolean;
  telemetry?: AgentModeExecutionTelemetry;
};

type BrainHarnessEventBase = {
  occurredAt: string;
  telemetry?: AgentModeExecutionTelemetry;
};

export type BrainHarnessEvent =
  | (BrainHarnessEventBase & { type: 'started'; executionId: string; externalSessionId?: string })
  | (BrainHarnessEventBase & { type: 'activity'; safeActivity: string; status?: string; externalSessionId?: string; modelRef?: string; provider?: string })
  | (BrainHarnessEventBase & { type: 'usage'; usage: Partial<BrainHarnessObservedUsage>; context?: AgentModeExecutionContext })
  | (BrainHarnessEventBase & { type: 'warning'; reasonCode: string })
  | (BrainHarnessEventBase & { type: 'result'; resultRef: string | null; evidenceRef: string | null })
  | (BrainHarnessEventBase & { type: 'failure'; reasonCode: string })
  | (BrainHarnessEventBase & { type: 'cancelled'; reasonCode: string })
  | (BrainHarnessEventBase & { type: 'completed'; status: BrainHarnessResult['status'] })
  | (BrainHarnessEventBase & { type: 'unknown'; sourceType: string; safeActivity: string });

export type BrainHarnessHandle = {
  executionId: string;
  externalSessionId: string | null;
  result: Promise<BrainHarnessResult>;
};

export type BrainHarnessStopResult =
  | { status: 'requested' }
  | { status: 'already-terminal' }
  | { status: 'unsupported'; reasonCode: string };

export type BrainHarnessInspection = {
  executionId: string;
  externalSessionId: string | null;
  status: 'starting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain';
  startedAt: string;
  updatedAt: string;
};

export interface BrainHarnessAdapter {
  describe(): BrainHarnessDescriptor;
  probeCompatibility?(): Promise<HarnessCompatibilityProbe>;
  start(input: BrainHarnessStartInput): Promise<BrainHarnessHandle>;
  events(handle: BrainHarnessHandle): AsyncIterable<BrainHarnessEvent>;
  stop(handle: BrainHarnessHandle, reason: string): Promise<BrainHarnessStopResult>;
  inspect(handle: BrainHarnessHandle): Promise<BrainHarnessInspection>;
  close(handle: BrainHarnessHandle): Promise<void>;
}

export type HarnessCompatibility =
  | { compatible: true; reasonCode: 'CAPABILITIES_ADMITTED' }
  | { compatible: false; reasonCode: 'SPI_VERSION_UNSUPPORTED' | 'CAPABILITY_UNSUPPORTED' | 'CAPABILITY_UNKNOWN'; missing: readonly HarnessCapabilityKey[] };

/** Compatibility is based on required capabilities, never on one vendor version. */
export function assessHarnessCompatibility(descriptor: BrainHarnessDescriptor, required: readonly HarnessCapabilityKey[]): HarnessCompatibility {
  if (descriptor.schemaVersion !== BRAIN_HARNESS_SPI_SCHEMA_VERSION) return { compatible: false, reasonCode: 'SPI_VERSION_UNSUPPORTED', missing: required };
  const unknown = required.filter((key) => descriptor.capabilities[key] === 'UNKNOWN');
  if (unknown.length > 0) return { compatible: false, reasonCode: 'CAPABILITY_UNKNOWN', missing: unknown };
  const unsupported = required.filter((key) => descriptor.capabilities[key] === 'UNSUPPORTED');
  if (unsupported.length > 0) return { compatible: false, reasonCode: 'CAPABILITY_UNSUPPORTED', missing: unsupported };
  return { compatible: true, reasonCode: 'CAPABILITIES_ADMITTED' };
}

export type HarnessProtocolCompatibility = 'COMPATIBLE' | 'INCOMPATIBLE' | 'UNKNOWN';

/** Live facts about the installed external harness, deliberately separate from adapter ability. */
export type HarnessCompatibilityProbe = {
  schemaVersion: typeof BRAIN_HARNESS_SPI_SCHEMA_VERSION;
  adapterId: string;
  checkedAt: string;
  binaryDiscoverable: boolean;
  observedVendorVersion: string | null;
  structuredProtocol: HarnessProtocolCompatibility;
  mandatoryContractCompatible: boolean;
  optionalCapabilities: Partial<HarnessCapabilities>;
  reasonCode: 'COMPATIBLE' | 'BINARY_NOT_FOUND' | 'PROTOCOL_UNSUPPORTED' | 'PROBE_FAILED';
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Runtime validation rejects authority-shaped extensions instead of ignoring them. */
export function validateBrainHarnessStartInput(value: unknown): value is BrainHarnessStartInput {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'brainAttemptId', 'executionScope', 'workspace', 'executionProfile', 'requestedModel', 'taskText', 'deadline', 'correlation'])) return false;
  if (value.schemaVersion !== BRAIN_HARNESS_SPI_SCHEMA_VERSION || typeof value.brainAttemptId !== 'string' || !SAFE_ID.test(value.brainAttemptId) || typeof value.executionProfile !== 'string' || !SAFE_REF.test(value.executionProfile) || (value.requestedModel !== null && typeof value.requestedModel !== 'string') || typeof value.taskText !== 'string' || value.taskText.length === 0 || value.taskText.length > 12_000 || !validDate(value.deadline)) return false;
  const scope = value.executionScope;
  if (scope === undefined && value.workspace === undefined) return false;
  if (scope !== undefined) {
    if (!record(scope) || scope.schemaVersion !== 'agent-mode.attempt-execution-scope.v1' || typeof scope.scopeId !== 'string' || !SAFE_ID.test(scope.scopeId) || typeof scope.rootGoalId !== 'string' || !SAFE_ID.test(scope.rootGoalId) || typeof scope.attemptId !== 'string' || !SAFE_ID.test(scope.attemptId) || typeof scope.scopeDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(scope.scopeDigest) || !Array.isArray(scope.contexts) || scope.contexts.length > 32) return false;
    const contexts = scope.contexts as unknown[];
    if (!contexts.every((context) => record(context) && Object.keys(context).every((key) => ['contextId', 'kind', 'canonicalPath', 'repositoryRef', 'admittedAccess', 'recursive'].includes(key)) && typeof context.contextId === 'string' && SAFE_ID.test(context.contextId) && (context.kind === 'repository' || context.kind === 'filesystem') && typeof context.canonicalPath === 'string' && context.canonicalPath.length > 0 && (context.repositoryRef === null || typeof context.repositoryRef === 'string') && (context.admittedAccess === 'read' || context.admittedAccess === 'write') && typeof context.recursive === 'boolean')) return false;
  }
  if (value.workspace !== undefined) {
    if (!record(value.workspace) || !exactKeys(value.workspace, ['repositoryRoot', 'repositoryRef', 'access']) || typeof value.workspace.repositoryRoot !== 'string' || value.workspace.repositoryRoot.length === 0 || typeof value.workspace.repositoryRef !== 'string' || !SAFE_REF.test(value.workspace.repositoryRef) || value.workspace.access !== 'read-only') return false;
    if (scope && (!Array.isArray(scope.contexts) || scope.contexts.length !== 1 || !record(scope.contexts[0]) || scope.contexts[0].canonicalPath !== value.workspace.repositoryRoot || scope.contexts[0].repositoryRef !== value.workspace.repositoryRef)) return false;
  }
  const correlation = value.correlation;
  if (!record(correlation) || !exactKeys(correlation, ['rootGoalId', 'taskId', 'runId', 'attemptId', 'dispatchId'])) return false;
  return ['rootGoalId', 'taskId', 'runId', 'attemptId', 'dispatchId'].every((key) => typeof correlation[key] === 'string' && SAFE_ID.test(correlation[key] as string));
}

export class BrainHarnessEventBuffer implements AsyncIterable<BrainHarnessEvent> {
  private readonly queue: BrainHarnessEvent[] = [];
  private readonly waiters: Array<(result: IteratorResult<BrainHarnessEvent>) => void> = [];
  private ended = false;

  push(event: BrainHarnessEvent): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter({ done: false, value: event });
    else if (!this.ended) this.queue.push(event);
  }

  end(): void {
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) waiter({ done: true, value: undefined });
  }

  async *[Symbol.asyncIterator](): AsyncIterator<BrainHarnessEvent> {
    while (true) {
      if (this.queue.length > 0) {
        const event = this.queue.shift();
        if (event) yield event;
        continue;
      }
      if (this.ended) return;
      const next = await new Promise<IteratorResult<BrainHarnessEvent>>((resolve) => this.waiters.push(resolve));
      if (next.done) return;
      yield next.value;
    }
  }
}
