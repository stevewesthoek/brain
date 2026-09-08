import type { BrainNodeCommand, BrainNodeLocalPerimeter, BrainNodeReceipt } from './brain-node.js';
import { hashNodeReadScope } from './brain-node.js';
import type {
  AgentModeAttempt,
  AgentModeBudgetSettlement,
  AgentModeEvent,
  AgentModeSqliteStateStore,
} from './sqlite-state-store.js';

export type MockAgentRuntimeControls = {
  cancellationObservation: true;
  boundedTrace: true;
  typedCapabilityRequests: true;
  modelRouteFixed: true;
};

export type MockRuntimeIntent =
  | { kind: 'repo.read'; relativePath: string }
  | { kind: 'ungranted-capability'; capabilityId: string; relativePath: string }
  | { kind: 'route-override'; routeRef: string }
  | { kind: 'auxiliary-model'; routeRef: string }
  | { kind: 'second-operation'; relativePath: string }
  | { kind: 'shell'; command: string }
  | { kind: 'absolute-path'; path: string }
  | { kind: 'no-outbox'; relativePath: string };

export type MockRuntimeModelResult = {
  kind: 'typed-fixture-result';
  traceId: string;
  intent: MockRuntimeIntent;
};

export type MockAgentRuntimeFixture = {
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  controls?: MockAgentRuntimeControls;
  modelResult: MockRuntimeModelResult;
  crashAfterDurableOperation?: boolean;
};

export type MockAgentRuntimeRunResult = {
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  controls: MockAgentRuntimeControls;
  modelResult: MockRuntimeModelResult;
  trace: string[];
  crashAfterDurableOperation: boolean;
};

export class MockAgentRuntime {
  constructor(private readonly fixture: MockAgentRuntimeFixture) {}

  async run(input: { attempt: AgentModeAttempt }): Promise<MockAgentRuntimeRunResult> {
    if (input.attempt.runtimeRef !== this.fixture.runtimeRef) {
      throw new Error('runtime_identity_mismatch');
    }
    if (input.attempt.cancellationStatus !== 'running') {
      throw new Error('cancellation_requested');
    }
    return {
      runtimeRef: this.fixture.runtimeRef,
      routeRef: this.fixture.routeRef,
      modelRef: this.fixture.modelRef,
      controls: this.fixture.controls ?? {
        cancellationObservation: true,
        boundedTrace: true,
        typedCapabilityRequests: true,
        modelRouteFixed: true,
      },
      modelResult: this.fixture.modelResult,
      trace: [`runtime:${this.fixture.runtimeRef}`, `attempt:${input.attempt.attemptId}`, `trace:${this.fixture.modelResult.traceId}`],
      crashAfterDurableOperation: this.fixture.crashAfterDurableOperation ?? false,
    };
  }
}

export type MockAgentAttemptInput = {
  store: AgentModeSqliteStateStore;
  node: BrainNodeLocalPerimeter;
  runtime: MockAgentRuntime;
  attemptId: string;
  operationId: string;
  resourceId: string;
  worktreeId?: string;
  grantId: string;
  controllerRef: string;
  authProof: string;
  deadline: string;
  lease: BrainNodeCommand['lease'];
  correlationId: string;
  causationId: string;
  now: string;
};

export type MockAgentAttemptResult = {
  status: 'succeeded' | 'rejected' | 'failed' | 'crashed';
  receipt?: BrainNodeReceipt;
  denialCode?: string;
  recovery?: string;
  trace: string[];
};

function event(eventId: string, entityId: string, eventType: string, occurredAt: string, payload: Record<string, unknown>): AgentModeEvent {
  return { eventId, entityType: 'attempt', entityId, eventType, occurredAt, payload };
}

function denied(input: { store: AgentModeSqliteStateStore; attempt: AgentModeAttempt; now: string; code: string; trace: string[] }): MockAgentAttemptResult {
  input.store.recordEvent(event(`runtime-denied:${input.attempt.attemptId}:${input.code}`, input.attempt.attemptId, 'runtime_denied', input.now, { code: input.code }));
  return { status: 'rejected', denialCode: input.code, trace: input.trace };
}

export async function runMockAgentAttempt(input: MockAgentAttemptInput): Promise<MockAgentAttemptResult> {
  const attemptRecord = input.store.getAttempt(input.attemptId);
  if (!attemptRecord) return { status: 'rejected', denialCode: 'attempt_missing', trace: [] };

  input.store.recordEvent(event(`runtime-started:${attemptRecord.attemptId}`, attemptRecord.attemptId, 'runtime_started', input.now, {
    runtimeRef: attemptRecord.runtimeRef,
    routeRef: attemptRecord.routeRef,
    modelRef: attemptRecord.modelRef,
  }));
  let runtimeResult: MockAgentRuntimeRunResult;
  try {
    runtimeResult = await input.runtime.run({ attempt: attemptRecord });
  } catch (error) {
    return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: error instanceof Error && error.message === 'cancellation_requested' ? 'cancellation_requested' : 'runtime_identity_mismatch', trace: [] });
  }
  const trace = runtimeResult.trace.slice(0, 8);

  if (runtimeResult.routeRef !== attemptRecord.routeRef || runtimeResult.modelRef !== attemptRecord.modelRef || !runtimeResult.controls.modelRouteFixed) {
    return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: 'route_not_admitted', trace });
  }
  if (!runtimeResult.controls.typedCapabilityRequests || !runtimeResult.controls.boundedTrace || !runtimeResult.controls.cancellationObservation) {
    return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: 'runtime_controls_not_admitted', trace });
  }

  const intent = runtimeResult.modelResult.intent;
  const skipPreparation = intent.kind === 'no-outbox';
  if (intent.kind !== 'repo.read' && !skipPreparation) {
    const code = intent.kind === 'ungranted-capability' ? 'capability_not_granted'
      : intent.kind === 'route-override' ? 'route_not_admitted'
        : intent.kind === 'auxiliary-model' ? 'auxiliary_model_not_admitted'
          : intent.kind === 'second-operation' ? 'operation_limit_exceeded'
            : intent.kind === 'shell' ? 'shell_not_admitted'
              : intent.kind === 'absolute-path' ? 'absolute_path_not_admitted'
                : 'outbox_required';
    return denied({ store: input.store, attempt: attemptRecord, now: input.now, code, trace });
  }

  const relativePath = intent.relativePath;
  const scopeHash = hashNodeReadScope(input.resourceId, input.worktreeId, relativePath);
  if (scopeHash !== attemptRecord.capabilityScopeHash) {
    return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: 'scope_not_admitted', trace });
  }

  if (skipPreparation) {
    input.store.recordEvent(event(`runtime-denied:${attemptRecord.attemptId}:outbox_required`, attemptRecord.attemptId, 'runtime_denied', input.now, { code: 'outbox_required' }));
  } else if (runtimeResult.crashAfterDurableOperation) {
    let prepared: ReturnType<AgentModeSqliteStateStore['prepareOperation']>;
    try {
      prepared = input.store.prepareOperation({
        operationId: input.operationId,
        attemptId: attemptRecord.attemptId,
        effectKind: 'capability.read',
        capabilityId: 'repo.read',
        grantId: input.grantId,
        scopeHash,
        policyVersion: attemptRecord.policyVersion,
        leaseResourceKey: input.lease.resourceKey,
        leaseId: input.lease.leaseId,
        leaseFence: input.lease.fence,
        deadline: input.deadline,
        preparedAt: input.now,
      });
    } catch (error) {
      return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: error instanceof Error && error.message.includes('cancellation') ? 'cancellation_requested' : 'stale_lease_fence', trace });
    }
    if (prepared === 'conflict') return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: 'operation_conflict', trace });
    input.store.recordEvent(event(`runtime-crashed:${attemptRecord.attemptId}`, attemptRecord.attemptId, 'runtime_crashed', input.now, { operationId: input.operationId }));
    return { status: 'crashed', recovery: input.store.classifyRecovery(attemptRecord.attemptId, input.now), trace };
  }

  if (!skipPreparation) {
    let prepared: ReturnType<AgentModeSqliteStateStore['prepareOperation']>;
    try {
      prepared = input.store.prepareOperation({
        operationId: input.operationId,
        attemptId: attemptRecord.attemptId,
        effectKind: 'capability.read',
        capabilityId: 'repo.read',
        grantId: input.grantId,
        scopeHash,
        policyVersion: attemptRecord.policyVersion,
        leaseResourceKey: input.lease.resourceKey,
        leaseId: input.lease.leaseId,
        leaseFence: input.lease.fence,
        deadline: input.deadline,
        preparedAt: input.now,
      });
    } catch (error) {
      return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: error instanceof Error && error.message.includes('cancellation') ? 'cancellation_requested' : 'stale_lease_fence', trace });
    }
    if (prepared === 'conflict') return denied({ store: input.store, attempt: attemptRecord, now: input.now, code: 'operation_conflict', trace });
  }

  const command: BrainNodeCommand = {
    protocolVersion: input.node.descriptor.protocolVersion,
    controllerRef: input.controllerRef,
    nodeId: input.node.descriptor.nodeId,
    taskId: input.store.getRun(attemptRecord.runId)?.taskId ?? 'unknown',
    runId: attemptRecord.runId,
    attemptId: attemptRecord.attemptId,
    operationId: input.operationId,
    capabilityId: 'repo.read',
    resourceId: input.resourceId,
    ...(input.worktreeId === undefined ? {} : { worktreeId: input.worktreeId }),
    relativePath: intent.relativePath,
    scopeHash,
    grantId: input.grantId,
    policyVersion: attemptRecord.policyVersion,
    lease: input.lease,
    deadline: input.deadline,
    correlationId: input.correlationId,
    causationId: input.causationId,
    authProof: input.authProof,
  };
  const reservation = attemptRecord.reservationId ? input.store.getReservation(attemptRecord.reservationId) : undefined;
  const settlement: AgentModeBudgetSettlement | undefined = reservation ? {
    reservationId: reservation.reservationId,
    steps: 1,
    tokens: 10,
    dollars: 0.01,
    settledAt: input.now,
  } : undefined;
  const receipt = await input.node.execute(command, input.now, settlement);
  if (receipt.status !== 'succeeded' && receipt.status !== 'duplicate') {
    input.store.recordEvent(event(`runtime-failed:${attemptRecord.attemptId}`, attemptRecord.attemptId, 'runtime_failed', input.now, { errorCode: receipt.errorCode ?? 'node_rejected' }));
    return {
      status: receipt.status === 'failed' ? 'failed' : 'rejected',
      receipt,
      ...(receipt.errorCode === undefined ? {} : { denialCode: receipt.errorCode }),
      trace,
    };
  }
  if (receipt.status === 'succeeded' && receipt.resultHash && receipt.evidenceRef) {
    input.store.markOperationVerified(input.operationId, { resultHash: receipt.resultHash, evidenceRef: receipt.evidenceRef, verifiedAt: input.now });
    input.store.recordEvent(event(`runtime-completed:${attemptRecord.attemptId}`, attemptRecord.attemptId, 'runtime_completed', input.now, {
      operationId: input.operationId,
      resultHash: receipt.resultHash,
      evidenceRef: receipt.evidenceRef,
    }));
    input.store.finishAttempt(attemptRecord.attemptId, 'completed', input.now);
  }
  return { status: receipt.status === 'duplicate' ? 'succeeded' : 'succeeded', receipt, trace };
}
