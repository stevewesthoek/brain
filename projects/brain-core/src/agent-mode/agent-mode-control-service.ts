import { createHash } from 'node:crypto';
import {
  AgentModeSqliteStateStore,
  type AgentModeReviewDecision,
} from './sqlite-state-store.js';
import { verifyRuntimeProcessIdentity, type RuntimeProcessIdentity } from './runtime-process-identity.js';

export const AGENT_MODE_CONTROL_SCHEMA_VERSION = 'agent-mode-control-v1' as const;
export const AGENT_MODE_CONTROL_MAX_OPERATION_ID_LENGTH = 128;
export const AGENT_MODE_CONTROL_MAX_TARGET_ID_LENGTH = 256;
export const AGENT_MODE_CONTROL_MAX_REASON_LENGTH = 512;
export const AGENT_MODE_CONTROL_MAX_EVIDENCE_HASH_LENGTH = 256;

export const AGENT_MODE_CONTROL_ACTIONS = ['pause', 'resume', 'cancel', 'kill'] as const;
export type AgentModeLifecycleControlAction = typeof AGENT_MODE_CONTROL_ACTIONS[number];

export const AGENT_MODE_REVIEW_DECISIONS = ['approved', 'rejected'] as const;
export type AgentModeReviewDecisionValue = typeof AGENT_MODE_REVIEW_DECISIONS[number];

export const AGENT_MODE_CONTROL_OUTCOMES = [
  'completed',
  'already_applied',
  'conflict',
  'stale',
  're_admission_required',
  'runtime_identity_unverified',
  'not_found',
  'forbidden',
  'unavailable',
  'uncertain',
] as const;
export type AgentModeControlOutcome = typeof AGENT_MODE_CONTROL_OUTCOMES[number];

export type AgentModeTrustedActor = {
  source: 'cli' | 'operator' | 'service';
  actorId: string;
};

export type AgentModeLifecycleControlCommandV1 = {
  schemaVersion: typeof AGENT_MODE_CONTROL_SCHEMA_VERSION;
  operationId: string;
  action: AgentModeLifecycleControlAction;
  runId: string;
  actor: AgentModeTrustedActor;
  expectedState?: string;
  requestedAt: string;
  reason: string;
};

export type AgentModeReviewDecisionCommandV1 = {
  schemaVersion: typeof AGENT_MODE_CONTROL_SCHEMA_VERSION;
  operationId: string;
  reviewId: string;
  decision: AgentModeReviewDecisionValue;
  actor: AgentModeTrustedActor;
  decidedAt: string;
  reason: string;
  evidenceHash: string;
};

export type AgentModeControlSignalState = 'not_attempted' | 'pending' | 'sent' | 'not_sent';

export type AgentModeControlReceiptV1 = {
  schemaVersion: typeof AGENT_MODE_CONTROL_SCHEMA_VERSION;
  operationId: string;
  action: AgentModeLifecycleControlAction | 'review_decision';
  targetId: string;
  actor: string;
  status: AgentModeControlOutcome;
  previousState: string | null;
  resultingState: string | null;
  occurredAt: string;
  reasonCode: string;
  recoveryCode: string | null;
  signalState: AgentModeControlSignalState | null;
};

export type AgentModeControlResult = {
  outcome: AgentModeControlOutcome;
  receipt?: AgentModeControlReceiptV1;
  reasonCode: string;
  signal?: { sent: boolean; reasonCode: string };
};

export type AgentModeControlServiceOptions = {
  verifyRuntimeIdentity?: (pid: number | undefined, runId: string, identity: RuntimeProcessIdentity | undefined) => boolean;
  signalRuntime?: (pid: number, runId: string, identity: RuntimeProcessIdentity) => { sent: boolean; reasonCode: string };
};

type StoredControl = {
  commandHash: string;
  receipt: AgentModeControlReceiptV1;
  signalState: AgentModeControlSignalState | null;
  signalReasonCode: string | null;
};

class AgentModeControlValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: string, label: string, maxLength: number, required = true): void {
  if (typeof value !== 'string' || (required && value.length === 0) || value.length > maxLength) {
    throw new AgentModeControlValidationError(`${label}_invalid`);
  }
}

function validTimestamp(value: string, label: string): void {
  boundedText(value, label, 64);
  if (!Number.isFinite(Date.parse(value))) throw new AgentModeControlValidationError(`${label}_invalid`);
}

function actorRef(actor: AgentModeTrustedActor): string {
  boundedText(actor.actorId, 'actor_id', AGENT_MODE_CONTROL_MAX_TARGET_ID_LENGTH);
  if (!['cli', 'operator', 'service'].includes(actor.source)) throw new AgentModeControlValidationError('actor_source_invalid');
  if (actor.actorId.startsWith('model:')) throw new AgentModeControlValidationError('model_actor_forbidden');
  return actor.actorId;
}

function canonicalCommand(value: AgentModeLifecycleControlCommandV1 | AgentModeReviewDecisionCommandV1): string {
  if ('runId' in value) {
    return JSON.stringify({ schemaVersion: value.schemaVersion, operationId: value.operationId, action: value.action, runId: value.runId, actor: value.actor, expectedState: value.expectedState ?? null, requestedAt: value.requestedAt, reason: value.reason });
  }
  return JSON.stringify({ schemaVersion: value.schemaVersion, operationId: value.operationId, reviewId: value.reviewId, decision: value.decision, actor: value.actor, decidedAt: value.decidedAt, reason: value.reason, evidenceHash: value.evidenceHash });
}

function commandHash(value: AgentModeLifecycleControlCommandV1 | AgentModeReviewDecisionCommandV1): string {
  return createHash('sha256').update(canonicalCommand(value)).digest('hex');
}

export function deriveAgentModeControlOperationId(command: Omit<AgentModeLifecycleControlCommandV1, 'operationId'> | Omit<AgentModeReviewDecisionCommandV1, 'operationId'>): string {
  const material = 'runId' in command
    ? { schemaVersion: command.schemaVersion, action: command.action, runId: command.runId, actor: command.actor, expectedState: command.expectedState ?? null, requestedAt: command.requestedAt, reason: command.reason }
    : { schemaVersion: command.schemaVersion, action: 'review_decision', reviewId: command.reviewId, decision: command.decision, actor: command.actor, decidedAt: command.decidedAt, reason: command.reason, evidenceHash: command.evidenceHash };
  return `agent-mode-control:${createHash('sha256').update(JSON.stringify(material)).digest('hex')}`;
}

function receiptEventId(operationId: string): string {
  return `agent-mode-control-receipt:${operationId}`;
}

function signalEventId(operationId: string): string {
  return `agent-mode-control-signal:${operationId}`;
}

function readStoredControl(store: AgentModeSqliteStateStore, operationId: string): StoredControl | undefined {
  const events = store.listEvents(operationId);
  const receiptEvent = events.find((event) => event.eventId === receiptEventId(operationId));
  if (!receiptEvent || !isRecord(receiptEvent.payload)) return undefined;
  const receipt = isRecord(receiptEvent.payload.receipt) ? receiptEvent.payload.receipt as AgentModeControlReceiptV1 : undefined;
  const storedCommandHash = typeof receiptEvent.payload.commandHash === 'string' ? receiptEvent.payload.commandHash : undefined;
  if (!receipt || !storedCommandHash) return undefined;
  const signalEvent = events.find((event) => event.eventId === signalEventId(operationId));
  const signalPayload = signalEvent && isRecord(signalEvent.payload) ? signalEvent.payload : undefined;
  return {
    commandHash: storedCommandHash,
    receipt,
    signalState: typeof signalPayload?.signalState === 'string' ? signalPayload.signalState as AgentModeControlSignalState : receipt.signalState,
    signalReasonCode: typeof signalPayload?.reasonCode === 'string' ? signalPayload.reasonCode : null,
  };
}

function validateCommon(operationId: string, actor: AgentModeTrustedActor, reason: string): string {
  boundedText(operationId, 'operation_id', AGENT_MODE_CONTROL_MAX_OPERATION_ID_LENGTH);
  boundedText(reason, 'reason', AGENT_MODE_CONTROL_MAX_REASON_LENGTH);
  return actorRef(actor);
}

function validateLifecycleCommand(command: AgentModeLifecycleControlCommandV1): string {
  if (command.schemaVersion !== AGENT_MODE_CONTROL_SCHEMA_VERSION) throw new AgentModeControlValidationError('schema_version_invalid');
  if (!AGENT_MODE_CONTROL_ACTIONS.includes(command.action)) throw new AgentModeControlValidationError('action_invalid');
  const actor = validateCommon(command.operationId, command.actor, command.reason);
  boundedText(command.runId, 'run_id', AGENT_MODE_CONTROL_MAX_TARGET_ID_LENGTH);
  validTimestamp(command.requestedAt, 'requested_at');
  if (command.expectedState !== undefined) boundedText(command.expectedState, 'expected_state', 64);
  return actor;
}

function validateReviewCommand(command: AgentModeReviewDecisionCommandV1): string {
  if (command.schemaVersion !== AGENT_MODE_CONTROL_SCHEMA_VERSION) throw new AgentModeControlValidationError('schema_version_invalid');
  if (!AGENT_MODE_REVIEW_DECISIONS.includes(command.decision)) throw new AgentModeControlValidationError('decision_invalid');
  const actor = validateCommon(command.operationId, command.actor, command.reason);
  boundedText(command.reviewId, 'review_id', AGENT_MODE_CONTROL_MAX_TARGET_ID_LENGTH);
  boundedText(command.evidenceHash, 'evidence_hash', AGENT_MODE_CONTROL_MAX_EVIDENCE_HASH_LENGTH);
  validTimestamp(command.decidedAt, 'decided_at');
  return actor;
}

function outcomeForOperation(result: 'created' | 'duplicate' | 'conflict'): AgentModeControlOutcome {
  return result === 'created' ? 'completed' : result === 'duplicate' ? 'already_applied' : 'conflict';
}

function operationReason(action: AgentModeLifecycleControlAction, result: 'created' | 'duplicate' | 'conflict'): string {
  return `${action.toUpperCase()}_${result === 'created' ? 'APPLIED' : result === 'duplicate' ? 'ALREADY_APPLIED' : 'CONFLICT'}`;
}

function reviewReason(result: 'created' | 'duplicate' | 'conflict'): string {
  return `REVIEW_${result === 'created' ? 'DECISION_RECORDED' : result === 'duplicate' ? 'DECISION_ALREADY_RECORDED' : 'DECISION_CONFLICT'}`;
}

function errorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/not found/i.test(message)) return 'TARGET_NOT_FOUND';
  if (/cannot|forbidden|worker|model|coding/i.test(message)) return 'CONTROL_FORBIDDEN';
  if (/expired|stale|not pending|already decided/i.test(message)) return 'REVIEW_STALE';
  if (/conflict|replay/i.test(message)) return 'CONTROL_CONFLICT';
  return 'CONTROL_REJECTED';
}

function resultingRunState(store: AgentModeSqliteStateStore, runId: string): string | null {
  return store.getRun(runId)?.status ?? null;
}

function makeReceipt(input: {
  command: AgentModeLifecycleControlCommandV1 | AgentModeReviewDecisionCommandV1;
  action: AgentModeControlReceiptV1['action'];
  targetId: string;
  actor: string;
  status: AgentModeControlOutcome;
  previousState: string | null;
  resultingState: string | null;
  reasonCode: string;
  recoveryCode?: string | null;
  signalState?: AgentModeControlSignalState | null;
}): AgentModeControlReceiptV1 {
  return {
    schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION,
    operationId: input.command.operationId,
    action: input.action,
    targetId: input.targetId,
    actor: input.actor,
    status: input.status,
    previousState: input.previousState,
    resultingState: input.resultingState,
    occurredAt: 'requestedAt' in input.command ? input.command.requestedAt : input.command.decidedAt,
    reasonCode: input.reasonCode,
    recoveryCode: input.recoveryCode ?? null,
    signalState: input.signalState ?? null,
  };
}

export function validateAgentModeLifecycleControlCommand(command: AgentModeLifecycleControlCommandV1): void {
  validateLifecycleCommand(command);
}

export function validateAgentModeReviewDecisionCommand(command: AgentModeReviewDecisionCommandV1): void {
  validateReviewCommand(command);
}

export class AgentModeControlService {
  private readonly verifyIdentity: NonNullable<AgentModeControlServiceOptions['verifyRuntimeIdentity']>;
  private readonly signal: NonNullable<AgentModeControlServiceOptions['signalRuntime']>;

  constructor(private readonly store: AgentModeSqliteStateStore, options: AgentModeControlServiceOptions = {}) {
    this.verifyIdentity = options.verifyRuntimeIdentity ?? verifyRuntimeProcessIdentity;
    this.signal = options.signalRuntime ?? ((pid, runId, identity) => {
      if (!this.verifyIdentity(pid, runId, identity)) return { sent: false, reasonCode: 'RUNTIME_IDENTITY_UNVERIFIED' };
      try {
        process.kill(pid, 'SIGTERM');
        return { sent: true, reasonCode: 'RUNTIME_SIGNAL_SENT' };
      } catch {
        return { sent: false, reasonCode: 'RUNTIME_SIGNAL_FAILED' };
      }
    });
  }

  pauseRun(command: AgentModeLifecycleControlCommandV1): AgentModeControlResult {
    return this.controlRun(command, 'pause');
  }

  resumeRun(command: AgentModeLifecycleControlCommandV1): AgentModeControlResult {
    return this.controlRun(command, 'resume');
  }

  cancelRun(command: AgentModeLifecycleControlCommandV1): AgentModeControlResult {
    return this.controlRun(command, 'cancel');
  }

  killRun(command: AgentModeLifecycleControlCommandV1): AgentModeControlResult {
    return this.controlRun(command, 'kill');
  }

  decideReview(command: AgentModeReviewDecisionCommandV1): AgentModeControlResult {
    let actor: string;
    try {
      actor = validateReviewCommand(command);
    } catch (error) {
      return { outcome: 'conflict', reasonCode: error instanceof AgentModeControlValidationError ? error.message.toUpperCase() : 'COMMAND_INVALID' };
    }
    const hash = commandHash(command);
    const prepared = this.store.withTransaction(() => {
      const existing = readStoredControl(this.store, command.operationId);
      if (existing) {
        if (existing.commandHash !== hash) return { kind: 'conflict' as const, result: { outcome: 'conflict' as const, reasonCode: 'OPERATION_ID_CONFLICT' } };
        return { kind: 'existing' as const, result: existingResult(existing) };
      }
      const request = this.store.getReviewRequest(command.reviewId);
      const previousState = request?.status ?? null;
      let status: AgentModeControlOutcome = 'completed';
      let reasonCode = reviewReason('created');
      let result: 'created' | 'duplicate' | 'conflict' = 'created';
      try {
        const decision: AgentModeReviewDecision = {
          decisionId: command.operationId,
          reviewId: command.reviewId,
          decision: command.decision,
          reviewer: actor,
          decidedAt: command.decidedAt,
          reason: command.reason,
          evidenceHash: command.evidenceHash,
        };
        result = this.store.recordReviewDecision(decision);
        status = outcomeForOperation(result);
        reasonCode = reviewReason(result);
      } catch (error) {
        status = errorReason(error) === 'TARGET_NOT_FOUND' ? 'not_found' : errorReason(error) === 'CONTROL_FORBIDDEN' ? 'forbidden' : 'stale';
        reasonCode = errorReason(error);
      }
      const receipt = makeReceipt({ command, action: 'review_decision', targetId: command.reviewId, actor, status, previousState, resultingState: this.store.getReviewRequest(command.reviewId)?.status ?? null, reasonCode });
      this.persistReceipt(command, hash, receipt);
      return { kind: 'new' as const, result: { outcome: status, reasonCode, receipt } };
    });
    return prepared.result;
  }

  private controlRun(command: AgentModeLifecycleControlCommandV1, expectedAction: AgentModeLifecycleControlAction): AgentModeControlResult {
    let actor: string;
    try {
      actor = validateLifecycleCommand(command);
    } catch (error) {
      return { outcome: 'conflict', reasonCode: error instanceof AgentModeControlValidationError ? error.message.toUpperCase() : 'COMMAND_INVALID' };
    }
    const hash = commandHash(command);
    if (command.action !== expectedAction) return { outcome: 'conflict', reasonCode: 'ACTION_METHOD_MISMATCH' };
    const observed = this.store.getRun(command.runId);
    const runtimeIdentityVerified = observed && command.action !== 'pause'
      ? this.verifyIdentity(observed.runtimePid, command.runId, observed.runtimeIdentity)
      : false;
    const prepared = this.store.withTransaction(() => {
      const existing = readStoredControl(this.store, command.operationId);
      if (existing) {
        if (existing.commandHash !== hash) return { result: { outcome: 'conflict' as const, reasonCode: 'OPERATION_ID_CONFLICT' } };
        return { result: existingResult(existing), shouldSignal: false, run: this.store.getRun(command.runId) };
      }
      const run = this.store.getRun(command.runId);
      if (!run) {
        const receipt = makeReceipt({ command, action: command.action, targetId: command.runId, actor, status: 'not_found', previousState: null, resultingState: null, reasonCode: 'RUN_NOT_FOUND' });
        this.persistReceipt(command, hash, receipt);
        return { result: { outcome: 'not_found' as const, reasonCode: 'RUN_NOT_FOUND', receipt }, shouldSignal: false, run: undefined };
      }
      const runtimeStillMatchesObserved = command.action === 'pause' || (
        run.runtimePid === observed?.runtimePid
        && JSON.stringify(run.runtimeIdentity ?? null) === JSON.stringify(observed?.runtimeIdentity ?? null)
      );
      const currentRuntimeIdentityVerified = command.action !== 'pause' && runtimeStillMatchesObserved
        ? runtimeIdentityVerified
        : false;
      const previousState = run.status ?? 'created';
      if (command.expectedState !== undefined && command.expectedState !== previousState) {
        const receipt = makeReceipt({ command, action: command.action, targetId: command.runId, actor, status: 'stale', previousState, resultingState: previousState, reasonCode: 'EXPECTED_STATE_MISMATCH' });
        this.persistReceipt(command, hash, receipt);
        return { result: { outcome: 'stale' as const, reasonCode: 'EXPECTED_STATE_MISMATCH', receipt }, shouldSignal: false, run };
      }
      if (command.action === 'resume' && !currentRuntimeIdentityVerified) {
        const receipt = makeReceipt({ command, action: command.action, targetId: command.runId, actor, status: 're_admission_required', previousState, resultingState: previousState, reasonCode: 'RE_ADMISSION_REQUIRED', recoveryCode: 'RE_ADMISSION_REQUIRED' });
        this.persistReceipt(command, hash, receipt);
        return { result: { outcome: 're_admission_required' as const, reasonCode: 'RE_ADMISSION_REQUIRED', receipt }, shouldSignal: false, run };
      }
      let operation: 'created' | 'duplicate' | 'conflict';
      let recoveryCode: string | null = null;
      if (command.action === 'pause') operation = this.store.pauseRun(command.runId, command.requestedAt);
      else if (command.action === 'resume') operation = this.store.resumeRun(command.runId, command.requestedAt);
      else operation = this.store.cancelRun(command.runId, command.requestedAt, command.action === 'kill' ? 'kill' : 'cancel');
      if (command.action === 'cancel' && !currentRuntimeIdentityVerified) {
        const attempt = this.store.listAttempts().find((candidate) => candidate.runId === command.runId && candidate.cancellationStatus === 'requested');
        if (attempt) {
          this.store.acknowledgeCancellation(attempt.attemptId, command.requestedAt);
          this.store.finishAttempt(attempt.attemptId, 'cancelled', command.requestedAt);
          recoveryCode = 'CONTROLLER_ABSENT_CANCEL_ACKNOWLEDGED';
          operation = 'created';
        }
      }
      const resultingState = resultingRunState(this.store, command.runId);
      const signalState: AgentModeControlSignalState | null = command.action === 'kill' && operation !== 'conflict' && operation !== 'duplicate'
        ? currentRuntimeIdentityVerified ? 'pending' : 'not_attempted' : null;
      const status = command.action === 'kill' && operation === 'created' && !currentRuntimeIdentityVerified
        ? 'runtime_identity_unverified' : outcomeForOperation(operation);
      const reasonCode = command.action === 'kill' && operation === 'created' && !currentRuntimeIdentityVerified
        ? 'RUNTIME_IDENTITY_UNVERIFIED' : operationReason(command.action, operation);
      const receipt = makeReceipt({ command, action: command.action, targetId: command.runId, actor, status, previousState, resultingState, reasonCode, recoveryCode, signalState });
      this.persistReceipt(command, hash, receipt);
      return { result: { outcome: status, reasonCode, receipt }, shouldSignal: command.action === 'kill' && operation === 'created' && currentRuntimeIdentityVerified, run };
    });
    if (!prepared.shouldSignal || !prepared.run?.runtimePid || !prepared.run.runtimeIdentity) return prepared.result;
    const signal = this.signal(prepared.run.runtimePid, command.runId, prepared.run.runtimeIdentity);
    this.store.recordEvent({ eventId: signalEventId(command.operationId), entityType: 'agent_mode_control', entityId: command.operationId, eventType: 'agent_mode_control_signal', occurredAt: command.requestedAt, payload: { schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION, commandHash: hash, signalState: signal.sent ? 'sent' : 'not_sent', reasonCode: signal.reasonCode } });
    const stored = readStoredControl(this.store, command.operationId);
    if (!stored) return { outcome: 'uncertain', reasonCode: 'CONTROL_RECEIPT_MISSING', signal };
    if (!signal.sent) return { outcome: 'uncertain', reasonCode: signal.reasonCode, receipt: { ...stored.receipt, status: 'uncertain', signalState: 'not_sent', reasonCode: signal.reasonCode }, signal };
    return { outcome: 'completed', reasonCode: 'RUNTIME_SIGNAL_SENT', receipt: { ...stored.receipt, signalState: 'sent', reasonCode: 'RUNTIME_SIGNAL_SENT' }, signal };
  }

  private persistReceipt(command: AgentModeLifecycleControlCommandV1 | AgentModeReviewDecisionCommandV1, hash: string, receipt: AgentModeControlReceiptV1): void {
    this.store.recordEvent({ eventId: receiptEventId(command.operationId), entityType: 'agent_mode_control', entityId: command.operationId, eventType: 'agent_mode_control_receipt', occurredAt: receipt.occurredAt, payload: { schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION, commandHash: hash, receipt } });
  }
}

function existingResult(stored: StoredControl): AgentModeControlResult {
  if (stored.signalState === 'pending') return { outcome: 'uncertain', reasonCode: 'RUNTIME_SIGNAL_PENDING_RECONCILIATION', receipt: stored.receipt };
  if (stored.signalState === 'sent') return { outcome: 'completed', reasonCode: stored.signalReasonCode ?? 'RUNTIME_SIGNAL_SENT', receipt: { ...stored.receipt, signalState: 'sent', reasonCode: stored.signalReasonCode ?? 'RUNTIME_SIGNAL_SENT' } };
  if (stored.signalState === 'not_sent' && stored.receipt.action === 'kill') return { outcome: 'uncertain', reasonCode: stored.signalReasonCode ?? 'RUNTIME_SIGNAL_NOT_SENT', receipt: { ...stored.receipt, status: 'uncertain', signalState: 'not_sent', reasonCode: stored.signalReasonCode ?? 'RUNTIME_SIGNAL_NOT_SENT' } };
  if (stored.receipt.status === 'completed') return { outcome: 'already_applied', reasonCode: 'CONTROL_ALREADY_APPLIED', receipt: stored.receipt };
  return { outcome: stored.receipt.status, reasonCode: stored.receipt.reasonCode, receipt: stored.receipt };
}
