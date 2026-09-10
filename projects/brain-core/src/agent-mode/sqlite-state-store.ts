import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { EffectKind, OperationReceipt } from './agent-mode-contracts.js';
import type { RuntimeProcessIdentity } from './runtime-process-identity.js';

export type AgentModeAgent = {
  agentId: string;
  agentKind: 'jarvis' | 'worker' | 'reviewer' | 'system';
  role: string;
  displayName: string;
  policyId: string;
  status: 'active' | 'paused' | 'retired';
};

export type AgentModeEvent = {
  eventId: string;
  sequence?: number;
  entityType: string;
  entityId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type AgentModeSchedulerItemStatus = 'pending' | 'claimed' | 'completed' | 'failed' | 'dead_letter';

export type AgentModeSchedulerEvent = {
  eventId: string;
  eventType: string;
  source: string;
  occurredAt: string;
  receivedAt: string;
  causationId: string | null;
  correlationId: string | null;
  deduplicationKey: string;
  payloadVersion: string;
  payload: Record<string, unknown>;
  status: AgentModeSchedulerItemStatus;
  attemptCount: number;
  nextEligibleAt: string;
  deadline: string | null;
  maxAttempts: number;
  contentHash: string;
  claimOwner: string | null;
  claimFence: number | null;
  claimExpiresAt: string | null;
  lastFailure: string | null;
  lastFailureAt: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
};

export type AgentModeSchedulerSchedule = {
  scheduleId: string;
  kind: string;
  dueAt: string;
  createdAt: string;
  status: AgentModeSchedulerItemStatus;
  deduplicationKey: string;
  causationId: string | null;
  correlationId: string | null;
  payloadVersion: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  nextEligibleAt: string;
  deadline: string | null;
  maxAttempts: number;
  contentHash: string;
  claimOwner: string | null;
  claimFence: number | null;
  claimExpiresAt: string | null;
  lastFailure: string | null;
  lastFailureAt: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
};

export type AgentModeSourceWatermark = { sourceId: string; watermark: string; updatedAt: string };

export type AgentModeEventSourceStatus = 'ready' | 'cooldown' | 'failed' | 'diverged' | 'disabled';

export type AgentModeEventSourceConfig = {
  sourceId: string;
  sourceType: string;
  repositoryRef: string;
  adapterType: 'git.repository.revision' | 'brain.task.lifecycle';
  debounceWindowMs: number;
  cooldownWindowMs: number;
  catchUpLimit: number;
  enabled: boolean;
  bootstrapWatermark: string | null;
};

export type AgentModeEventSourceState = AgentModeEventSourceConfig & {
  status: AgentModeEventSourceStatus;
  watermark: string | null;
  lastObservedAt: string | null;
  lastSuccessfulObservation: string | null;
  lastErrorReason: string | null;
  cooldownNotBefore: string | null;
  nextEligibleAt: string | null;
  catchUpPending: boolean;
  lastEmittedEventCount: number;
  failureAttemptCount: number;
};

export type AgentModeEventSourceObservationResult = {
  sourceId: string;
  status: 'bootstrapped' | 'advanced' | 'unchanged' | 'cooldown' | 'diverged' | 'failed';
  previousWatermark: string | null;
  observedWatermark: string | null;
  emittedEventCount: number;
  duplicates: number;
  hasMore: boolean;
  observedAt: string;
  errorReason?: string;
};

export type AgentModeSchedulerTickSummary = {
  tickId: string;
  startedAt: string;
  completedAt: string;
  outcome: 'NO_ACTION' | 'PROCESSED' | 'BOUNDED';
  considered: number;
  claimed: number;
  completed: number;
  deferred: number;
  deadLettered: number;
  durationMs: number;
  noOp: boolean;
};

export type AgentModeQueueOperationResult = 'created' | 'duplicate' | 'conflict';

export type AgentModeSchedulerEventInput = Omit<AgentModeSchedulerEvent, 'status' | 'attemptCount' | 'contentHash' | 'claimOwner' | 'claimFence' | 'claimExpiresAt' | 'lastFailure' | 'lastFailureAt' | 'completedAt' | 'deadLetteredAt'>;
export type AgentModeSchedulerScheduleInput = Omit<AgentModeSchedulerSchedule, 'status' | 'attemptCount' | 'contentHash' | 'claimOwner' | 'claimFence' | 'claimExpiresAt' | 'lastFailure' | 'lastFailureAt' | 'completedAt' | 'deadLetteredAt'>;
export type AgentModeSchedulerClaim = { ownerId: string; fence: number; expiresAt: string };
export type AgentModeSchedulerSettlement = { itemType: 'event' | 'schedule'; itemId: string; ownerId: string; fence: number; now: string };
export type AgentModeSchedulerFailure = AgentModeSchedulerSettlement & { reason: string; forceDeadLetter?: boolean };

function schedulerStableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(schedulerStableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${schedulerStableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function schedulerPayloadJson(payload: Record<string, unknown>): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('scheduler payload must be an object');
  const json = schedulerStableJson(payload);
  if (json.length > 32_768) throw new Error('scheduler payload exceeds 32 KiB');
  const visit = (value: unknown, depth: number): void => {
    if (depth > 6) throw new Error('scheduler payload exceeds maximum depth');
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) value.forEach((entry) => visit(entry, depth + 1));
      else for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (/^(?:command|commands|exec|shell|spawn|script|handler|code|url|path)$/i.test(key)) throw new Error(`scheduler payload key is not permitted: ${key}`);
        visit(entry, depth + 1);
      }
    } else if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('scheduler payload contains a non-finite number');
    } else if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new Error('scheduler payload contains an executable value');
    }
  };
  visit(payload, 0);
  return json;
}

function schedulerContentHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(schedulerStableJson(input)).digest('hex');
}

function ensureSchedulerInput(input: { payloadVersion: string; payload: Record<string, unknown>; maxAttempts: number; nextEligibleAt: string; deadline: string | null }): string {
  if (input.payloadVersion !== 'k4.0') throw new Error('scheduler payloadVersion must be k4.0');
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10) throw new Error('scheduler maxAttempts must be between 1 and 10');
  if (!Number.isFinite(Date.parse(input.nextEligibleAt))) throw new Error('scheduler nextEligibleAt must be an ISO timestamp');
  if (input.deadline !== null && !Number.isFinite(Date.parse(input.deadline))) throw new Error('scheduler deadline must be an ISO timestamp');
  if (input.deadline !== null && input.deadline < input.nextEligibleAt) throw new Error('scheduler deadline must not precede nextEligibleAt');
  return schedulerPayloadJson(input.payload);
}

function ensureSchedulerText(value: string | null, label: string, required = false): void {
  if (required && !value) throw new Error(`scheduler ${label} is required`);
  if (value !== null && value.length > 256) throw new Error(`scheduler ${label} exceeds 256 characters`);
}

export type AgentModeTaskStatus = 'pending' | 'admitted' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type AgentModeRunStatus = 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type AgentModeAttemptStatus = 'created' | 'admitted' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'uncertain' | 'duplicate';

export type AgentModeTask = {
  taskId: string;
  taskType: string;
  inputHash: string;
  createdAt: string;
  status?: AgentModeTaskStatus;
};

export type AgentModeRun = {
  runId: string;
  taskId: string;
  agentId: string;
  createdAt: string;
  status?: AgentModeRunStatus;
  runtimePid?: number;
  runtimeIdentity?: RuntimeProcessIdentity;
};

export type AgentModeBudgetLimits = {
  budgetScopeId: string;
  maxSteps: number;
  maxTokens: number;
  maxDollars: number;
};

export type AgentModeBudgetState = AgentModeBudgetLimits & {
  usedSteps: number;
  reservedSteps: number;
  usedTokens: number;
  reservedTokens: number;
  usedDollars: number;
  reservedDollars: number;
};

export type AgentModeBudgetEstimate = {
  steps: number;
  tokens: number;
  dollars: number;
};

export type AgentModeBudgetReservation = AgentModeBudgetEstimate & {
  reservationId: string;
  budgetScopeId: string;
  attemptId: string;
  status: 'reserved' | 'settled';
  createdAt: string;
  settledAt?: string;
  settledSteps?: number;
  settledTokens?: number;
  settledDollars?: number;
};

export type AgentModeBudgetSettlement = AgentModeBudgetEstimate & {
  reservationId: string;
  settledAt: string;
};

export type AgentModeAttempt = {
  attemptId: string;
  runId: string;
  agentId: string;
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  policyVersion: string;
  capabilityScopeHash: string;
  budgetScopeId: string;
  reservationId?: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseOwnerId?: string;
  leaseFence?: number;
  status: AgentModeAttemptStatus;
  cancellationStatus: 'running' | 'requested' | 'acknowledged' | 'completed';
  cancellationRequestedAt?: string;
  cancellationAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentModeAttemptInput = {
  attemptId: string;
  runId: string;
  agentId: string;
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  policyVersion: string;
  capabilityScopeHash: string;
  budgetScopeId: string;
  createdAt: string;
  updatedAt?: string;
};

export type AgentModeLease = {
  leaseId: string;
  resourceKey: string;
  ownerId: string;
  fence: number;
  expiresAt: string;
};

export type AgentModeEffect = {
  operationId: string;
  attemptId: string;
  effectKind: string;
  scopeHash: string;
  status: 'reserved' | 'prepared' | 'dispatchable' | 'dispatched' | 'effect_applied' | 'receipt_recorded' | 'succeeded' | 'failed' | 'uncertain';
  receiptJson?: string;
  capabilityId?: string;
  grantId?: string;
  policyVersion?: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline?: string;
  preparedAt?: string;
  dispatchedAt?: string;
  observedAt?: string;
};

export type AgentModeDispatchState = 'dispatchable' | 'dispatched' | 'effect_applied' | 'receipt_recorded' | 'verified' | 'failed' | 'uncertain';

export type AgentModeDispatchOutbox = {
  operationId: string;
  attemptId: string;
  effectKind: EffectKind | string;
  capabilityId: string;
  grantId?: string;
  scopeHash: string;
  policyVersion: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline: string;
  state: AgentModeDispatchState;
  preparedAt: string;
  dispatchedAt?: string;
};

export type AgentModeReceiptState = 'accepted' | 'conflict' | 'stale';

export type AgentModeJournalReceipt = OperationReceipt & {
  receiptId: string;
  state: AgentModeReceiptState;
};

export type AgentModeAdmission = {
  task: AgentModeTask;
  run: AgentModeRun;
  attempt: AgentModeAttemptInput;
  budget: AgentModeBudgetLimits;
  estimate: AgentModeBudgetEstimate & { reservationId: string };
  lease: Omit<AgentModeLease, 'fence'>;
  now: string;
  eventId?: string;
};

export type AgentModePreparedOperation = {
  operationId: string;
  attemptId: string;
  effectKind: EffectKind | string;
  capabilityId: string;
  grantId?: string;
  scopeHash: string;
  policyVersion: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline: string;
  preparedAt: string;
};

export type AgentModeRecoveryClassification =
  | 'safe_to_resume'
  | 'already_completed'
  | 'duplicate'
  | 'stale_fenced_writer'
  | 'awaiting_receipt_reconciliation'
  | 'uncertain_non_idempotent_effect'
  | 'cancelled_ack_pending'
  | 'terminal_failure';

export type AgentModePersistenceFailurePoint = 'admission' | 'effect-preparation' | 'receipt' | 'budget-settlement';

export type AgentModeOperationResult = 'created' | 'duplicate' | 'conflict';

export type AgentModeReAdmission = {
  runtimePid: number;
  runtimeIdentity: RuntimeProcessIdentity;
  lease: Omit<AgentModeLease, 'fence'>;
  now: string;
  accessEvidenceValid: boolean;
};

export type AgentModeCancellationRequest = {
  requestId: string;
  attemptId: string;
  requestedAt: string;
};

export type AgentModeVerification = {
  resultHash: string;
  evidenceRef: string;
  verifiedAt: string;
};

export type AgentModeWorkcellStatus =
  | 'created'
  | 'prepared'
  | 'active'
  | 'testing'
  | 'awaiting_review'
  | 'approved'
  | 'committing'
  | 'committed'
  | 'merged'
  | 'discarded'
  | 'failed';

export type AgentModeWorkcell = {
  workcellId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  repositoryRef: string;
  repositoryRoot: string;
  worktreePath: string;
  branch: string;
  ownerAgent: string;
  baseRef: string;
  createdAt: string;
  updatedAt: string;
  status: AgentModeWorkcellStatus;
};

export type AgentModeWorkcellReceiptType =
  | 'WorkcellCreatedReceipt'
  | 'WorkcellPreparedReceipt'
  | 'WorkcellDestroyedReceipt'
  | 'ValidationReceipt'
  | 'WorkcellCommitReceipt';

export type AgentModeWorkcellReceipt = {
  receiptId: string;
  receiptType: AgentModeWorkcellReceiptType;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  actor: string;
  timestamp: string;
  operationHash: string;
  operation: 'create' | 'prepare' | 'inspect' | 'destroy' | 'recover' | 'commit';
  resultState: AgentModeWorkcellStatus | 'valid' | 'invalid' | 'stale';
};

export type AgentModeWriterLeaseStatus = 'active' | 'expired' | 'released' | 'revoked';

export type AgentModeWriterLease = {
  leaseId: string;
  workcellId: string;
  ownerAgent: string;
  ownerAttempt: string;
  createdAt: string;
  expiresAt: string;
  fenceToken: number;
  status: AgentModeWriterLeaseStatus;
};

export type AgentModeWriterReceiptType =
  | 'WriterLeaseGrantedReceipt'
  | 'WriterLeaseReleasedReceipt'
  | 'WriteRejectedReceipt'
  | 'DiffCapturedReceipt'
  | 'ValidationAdmissionReceipt';

export type AgentModeWriterReceipt = {
  receiptId: string;
  receiptType: AgentModeWriterReceiptType;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  leaseId: string | null;
  fenceToken: number | null;
  timestamp: string;
  operationHash: string;
  resultState: string;
};

export type AgentModeWorkcellDiffEvidence = {
  diffId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  branch: string;
  baseRevision: string;
  currentRevision: string;
  changedFiles: string[];
  diffHash: string;
  leaseId: string;
  fenceToken: number;
  capturedAt: string;
};

export type AgentModeWorkcellValidationEvidence = {
  validationId: string;
  diffId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  requestedAt: string;
  result: 'passed' | 'failed' | 'unknown';
  state: 'validation_ready' | 'rejected';
  recordedAt: string;
};

export type AgentModeWorkcellMutationStatus =
  | 'prepared'
  | 'preimage_verified'
  | 'temp_prepared'
  | 'effect_applied'
  | 'receipt_recorded'
  | 'reconciled'
  | 'rejected';

export type AgentModeWorkcellMutation = {
  operationId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  relativePath: string;
  leaseId: string;
  fenceToken: number;
  expectedPreimageHash: string;
  preimageState: 'present';
  preimageHash: string | undefined;
  replacementHash: string;
  postimageHash: string | undefined;
  operationHash: string;
  status: AgentModeWorkcellMutationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentModeWorkcellWriteReceiptType =
  | 'WorkcellWriteAppliedReceipt'
  | 'WorkcellWriteRejectedReceipt'
  | 'WorkcellWriteReconciledReceipt';

export type AgentModeWorkcellWriteReceipt = {
  receiptId: string;
  receiptType: AgentModeWorkcellWriteReceiptType;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  operationId: string;
  leaseId: string;
  fenceToken: number;
  repositoryRef: string;
  relativePath: string;
  preimageHash: string;
  postimageHash: string | null;
  timestamp: string;
  result: string;
  operationHash: string;
};

export type AgentModeWorkcellValidationStatus = 'started' | 'completed' | 'rejected';

export type AgentModeWorkcellValidationResult = 'started' | 'passed' | 'failed' | 'rejected' | 'timed_out' | 'interrupted';

export type AgentModeWorkcellValidation = {
  validationId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  repositoryRef: string;
  validatorProfile: string;
  diffId: string | null;
  leaseId: string;
  fenceToken: number;
  operationHash: string;
  status: AgentModeWorkcellValidationStatus;
  result: AgentModeWorkcellValidationResult;
  evidenceHash: string | undefined;
  evidenceJson: string | undefined;
  startedAt: string;
  completedAt: string | undefined;
  updatedAt: string;
};

export type AgentModeWorkcellValidationReceiptType =
  | 'ValidationStartedReceipt'
  | 'ValidationCompletedReceipt'
  | 'ValidationRejectedReceipt';

export type AgentModeWorkcellValidationReceipt = {
  receiptId: string;
  receiptType: AgentModeWorkcellValidationReceiptType;
  validationId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  validatorProfile: string;
  evidenceHash: string | null;
  timestamp: string;
  result: AgentModeWorkcellValidationResult;
  operationHash: string;
};

export type AgentModeReviewRequest = {
  reviewId: string;
  workcellId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workerAgentId: string;
  repositoryRef: string;
  branch: string;
  baseRevision: string;
  currentRevision: string;
  diffId: string;
  diffHash: string;
  validationId: string;
  validationEvidenceHash: string;
  requestingActor: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'stale';
};

export type AgentModeReviewDecision = {
  decisionId: string;
  reviewId: string;
  decision: 'approved' | 'rejected';
  reviewer: string;
  decidedAt: string;
  reason: string;
  evidenceHash: string;
};

export type AgentModeReviewReceiptType =
  | 'ReviewRequestedReceipt'
  | 'ReviewApprovedReceipt'
  | 'ReviewRejectedReceipt';

export type AgentModeReviewReceipt = {
  receiptId: string;
  receiptType: AgentModeReviewReceiptType;
  reviewId: string;
  decisionId?: string;
  taskId: string;
  runId: string;
  attemptId: string;
  workcellId: string;
  workerAgentId: string;
  diffHash: string;
  validationEvidenceHash: string;
  reviewer: string;
  timestamp: string;
  operationHash: string;
};

export type AgentModeTargetRefLease = {
  leaseId: string;
  repositoryRef: string;
  targetRef: string;
  ownerOperation: string;
  fenceToken: number;
  expectedTargetHead: string;
  expiresAt: string;
  status: 'active' | 'released' | 'consumed' | 'expired';
};

export type AgentModeCommitOperation = {
  operationId: string;
  workcellId: string;
  repositoryRef: string;
  branch: string;
  parentCommit: string;
  resultingCommit?: string;
  approvedDiffHash: string;
  validationEvidenceHash: string;
  reviewId: string;
  actor: string;
  message: string;
  createdAt: string;
  status: 'prepared' | 'committed' | 'reconciled' | 'rejected';
  resultingTreeRevision?: string;
  receiptHash?: string;
  reason?: string;
};

export type AgentModeCommitReceiptType =
  | 'CommitRequestedReceipt'
  | 'CommitCompletedReceipt'
  | 'CommitRejectedReceipt'
  | 'CommitReconciledReceipt';

export type AgentModeCommitReceipt = {
  receiptId: string;
  receiptType: AgentModeCommitReceiptType;
  operationId: string;
  workcellId: string;
  branch: string;
  parentCommit: string | null;
  resultingCommit: string | null;
  diffHash: string;
  validationEvidenceHash: string;
  reviewId: string;
  actor: string;
  timestamp: string;
  operationHash: string;
  result: 'requested' | 'completed' | 'rejected' | 'reconciled';
};

export type AgentModeMergeApproval = {
  approvalId: string;
  repositoryRef: string;
  sourceWorkcellId: string;
  sourceBranch: string;
  sourceCommit: string;
  reviewId: string;
  diffHash: string;
  validationId: string;
  validationEvidenceHash: string;
  targetRef: string;
  expectedTargetHead: string;
  approver: string;
  createdAt: string;
  expiresAt: string;
  operationId: string;
  status: 'pending' | 'consumed' | 'rejected' | 'expired' | 'stale';
};

export type AgentModeMergeOperation = {
  operationId: string;
  approvalId: string;
  repositoryRef: string;
  sourceWorkcellId: string;
  sourceBranch: string;
  sourceCommit: string;
  reviewId: string;
  validationId: string;
  targetRef: string;
  expectedTargetHead: string;
  targetFenceToken: number;
  resultingTargetHead?: string;
  actor: string;
  createdAt: string;
  status: 'prepared' | 'merged' | 'reconciled' | 'rejected';
  receiptHash?: string;
  reason?: string;
};

export type AgentModeMergeReceiptType =
  | 'MergeRequestedReceipt'
  | 'MergeCompletedReceipt'
  | 'MergeRejectedReceipt'
  | 'MergeReconciledReceipt';

export type AgentModeMergeReceipt = {
  receiptId: string;
  receiptType: AgentModeMergeReceiptType;
  operationId: string;
  approvalId: string;
  workcellId: string;
  sourceCommit: string | null;
  targetRef: string;
  targetBefore: string | null;
  targetAfter: string | null;
  reviewId: string;
  validationId: string;
  actor: string;
  timestamp: string;
  operationHash: string;
  result: 'requested' | 'completed' | 'rejected' | 'reconciled';
};

function receiptIdFor(receipt: OperationReceipt): string {
  return `receipt:${createHash('sha256').update(JSON.stringify({
    operationId: receipt.operationId,
    attemptId: receipt.attemptId,
    scopeHash: receipt.scopeHash,
    effectHash: receipt.effectHash,
    status: receipt.status,
  })).digest('hex')}`;
}

function writerOperationHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function makeWriterReceipt(
  workcell: AgentModeWorkcell,
  receiptType: AgentModeWriterReceiptType,
  operation: string,
  timestamp: string,
  resultState: string,
  leaseId: string | null,
  fenceToken: number | null,
  extra: Record<string, unknown> = {},
): AgentModeWriterReceipt {
  const operationHash = writerOperationHash({ receiptType, operation, workcellId: workcell.workcellId, leaseId, fenceToken, resultState, ...extra });
  return {
    receiptId: `workcell-writer-receipt:${operationHash}`,
    receiptType,
    taskId: workcell.taskId,
    runId: workcell.runId,
    attemptId: workcell.attemptId,
    workcellId: workcell.workcellId,
    leaseId,
    fenceToken,
    timestamp,
    operationHash,
    resultState,
  };
}

function makeWorkcellWriteReceipt(
  workcell: AgentModeWorkcell,
  input: Pick<AgentModeWorkcellWriteReceipt, 'operationId' | 'leaseId' | 'fenceToken' | 'relativePath' | 'preimageHash' | 'postimageHash' | 'timestamp' | 'result' | 'operationHash'>,
  receiptType: AgentModeWorkcellWriteReceiptType,
): AgentModeWorkcellWriteReceipt {
  return {
    receiptId: `workcell-write-receipt:${input.operationId}:${input.operationHash}:${receiptType}`,
    receiptType,
    taskId: workcell.taskId,
    runId: workcell.runId,
    attemptId: workcell.attemptId,
    workcellId: workcell.workcellId,
    operationId: input.operationId,
    leaseId: input.leaseId,
    fenceToken: input.fenceToken,
    repositoryRef: workcell.repositoryRef,
    relativePath: input.relativePath,
    preimageHash: input.preimageHash,
    postimageHash: input.postimageHash,
    timestamp: input.timestamp,
    result: input.result,
    operationHash: input.operationHash,
  };
}

function makeValidationReceipt(
  validation: AgentModeWorkcellValidation,
  receiptType: AgentModeWorkcellValidationReceiptType,
  timestamp: string,
  result: AgentModeWorkcellValidationResult,
): AgentModeWorkcellValidationReceipt {
  return {
    receiptId: `workcell-validation-receipt:${validation.validationId}:${receiptType}:${result}`,
    receiptType,
    validationId: validation.validationId,
    taskId: validation.taskId,
    runId: validation.runId,
    attemptId: validation.attemptId,
    workcellId: validation.workcellId,
    validatorProfile: validation.validatorProfile,
    evidenceHash: validation.evidenceHash ?? null,
    timestamp,
    result,
    operationHash: validation.operationHash,
  };
}

function makeReviewReceipt(
  request: AgentModeReviewRequest,
  receiptType: AgentModeReviewReceiptType,
  reviewer: string,
  timestamp: string,
  decisionId?: string,
): AgentModeReviewReceipt {
  const operationHash = writerOperationHash({
    receiptType,
    reviewId: request.reviewId,
    decisionId: decisionId ?? null,
    taskId: request.taskId,
    runId: request.runId,
    attemptId: request.attemptId,
    workcellId: request.workcellId,
    workerAgentId: request.workerAgentId,
    diffHash: request.diffHash,
    validationEvidenceHash: request.validationEvidenceHash,
    reviewer,
    timestamp,
  });
  return {
    receiptId: `agent-mode-review-receipt:${request.reviewId}:${receiptType}:${decisionId ?? 'request'}`,
    receiptType,
    reviewId: request.reviewId,
    ...(decisionId ? { decisionId } : {}),
    taskId: request.taskId,
    runId: request.runId,
    attemptId: request.attemptId,
    workcellId: request.workcellId,
    workerAgentId: request.workerAgentId,
    diffHash: request.diffHash,
    validationEvidenceHash: request.validationEvidenceHash,
    reviewer,
    timestamp,
    operationHash,
  };
}

function makeCommitReceipt(
  operation: AgentModeCommitOperation,
  receiptType: AgentModeCommitReceiptType,
  result: AgentModeCommitReceipt['result'],
  timestamp: string,
): AgentModeCommitReceipt {
  const operationHash = writerOperationHash({
    receiptType,
    operationId: operation.operationId,
    workcellId: operation.workcellId,
    branch: operation.branch,
    parentCommit: operation.parentCommit,
    resultingCommit: operation.resultingCommit ?? null,
    diffHash: operation.approvedDiffHash,
    validationEvidenceHash: operation.validationEvidenceHash,
    reviewId: operation.reviewId,
    actor: operation.actor,
    timestamp,
    result,
  });
  return {
    receiptId: `agent-mode-commit-receipt:${operation.operationId}:${receiptType}`,
    receiptType,
    operationId: operation.operationId,
    workcellId: operation.workcellId,
    branch: operation.branch,
    parentCommit: operation.parentCommit,
    resultingCommit: operation.resultingCommit ?? null,
    diffHash: operation.approvedDiffHash,
    validationEvidenceHash: operation.validationEvidenceHash,
    reviewId: operation.reviewId,
    actor: operation.actor,
    timestamp,
    operationHash,
    result,
  };
}

function makeMergeReceipt(
  operation: AgentModeMergeOperation,
  receiptType: AgentModeMergeReceiptType,
  result: AgentModeMergeReceipt['result'],
  timestamp: string,
): AgentModeMergeReceipt {
  const operationHash = writerOperationHash({
    receiptType,
    operationId: operation.operationId,
    approvalId: operation.approvalId,
    workcellId: operation.sourceWorkcellId,
    sourceCommit: operation.sourceCommit,
    targetRef: operation.targetRef,
    targetFenceToken: operation.targetFenceToken,
    targetBefore: operation.expectedTargetHead,
    targetAfter: operation.resultingTargetHead ?? null,
    reviewId: operation.reviewId,
    validationId: operation.validationId,
    actor: operation.actor,
    timestamp,
    result,
  });
  return {
    receiptId: `agent-mode-merge-receipt:${operation.operationId}:${receiptType}`,
    receiptType,
    operationId: operation.operationId,
    approvalId: operation.approvalId,
    workcellId: operation.sourceWorkcellId,
    sourceCommit: operation.sourceCommit,
    targetRef: operation.targetRef,
    targetBefore: operation.expectedTargetHead,
    targetAfter: operation.resultingTargetHead ?? null,
    reviewId: operation.reviewId,
    validationId: operation.validationId,
    actor: operation.actor,
    timestamp,
    operationHash,
    result,
  };
}

export function defaultAgentModeDatabasePath(): string {
  const stateRoot = process.env.BRAIN_AGENT_MODE_STATE_DIR
    ?? path.join(homedir(), '.local', 'brain', 'agent-mode');
  return path.join(stateRoot, 'agent-mode.db');
}

/**
 * SQLite StateStore for the fixture-backed K0 kernel.
 *
 * This is intentionally a domain-specific store, not a generic CRUD wrapper.
 * Transactions own event/effect/lease invariants; callers must not mutate the
 * SQLite file or use an ad-hoc lock as a second authority.
 */
export class AgentModeSqliteStateStore {
  readonly databasePath: string;
  private readonly database: DatabaseSync;
  private transactionDepth = 0;
  private readonly injectedFailures = new Set<AgentModePersistenceFailurePoint>();

  private readonly readOnly: boolean;
  private readonly hasRuntimePidColumn: boolean;
  private readonly hasRuntimeIdentityColumns: boolean;
  private readonly hasWorkcellTables: boolean;
  private readonly hasWriterTables: boolean;
  private readonly hasMutationTables: boolean;
  private readonly hasValidationTables: boolean;
  private readonly hasPromotionTables: boolean;
  private readonly hasReviewReceiptTables: boolean;
  private readonly hasCommitReceiptTables: boolean;
  private readonly hasMergeReceiptTables: boolean;
  private readonly hasSchedulerTables: boolean;
  private readonly hasEventSourceTables: boolean;

  constructor(databasePath = defaultAgentModeDatabasePath(), options: { readOnly?: boolean } = {}) {
    this.databasePath = databasePath;
    this.readOnly = options.readOnly ?? false;
    if (!this.readOnly && databasePath !== ':memory:') mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath, { readOnly: this.readOnly });
    if (this.readOnly) {
      this.hasRuntimePidColumn = this.tableHasColumn('runs', 'runtime_pid');
      this.hasRuntimeIdentityColumns = this.tableHasColumn('runs', 'runtime_started_at')
        && this.tableHasColumn('runs', 'runtime_command')
        && this.tableHasColumn('runs', 'runtime_identity');
      this.hasWorkcellTables = this.tableExists('workcells') && this.tableExists('workcell_receipts');
      this.hasWriterTables = this.tableExists('workcell_writer_leases')
        && this.tableExists('workcell_writer_receipts')
        && this.tableExists('workcell_diff_evidence')
        && this.tableExists('workcell_validation_evidence');
      this.hasMutationTables = this.tableExists('workcell_file_mutations')
        && this.tableExists('workcell_write_receipts');
      this.hasValidationTables = this.tableExists('workcell_validations')
        && this.tableExists('workcell_validation_receipts');
      this.hasPromotionTables = this.tableExists('agent_mode_review_requests')
        && this.tableExists('agent_mode_review_decisions')
        && this.tableExists('agent_mode_target_ref_leases')
        && this.tableExists('agent_mode_commit_operations')
        && this.tableExists('agent_mode_merge_approvals')
        && this.tableExists('agent_mode_merge_operations');
      this.hasReviewReceiptTables = this.tableExists('agent_mode_review_receipts');
      this.hasCommitReceiptTables = this.tableExists('agent_mode_commit_receipts');
      this.hasMergeReceiptTables = this.tableExists('agent_mode_merge_receipts');
      this.hasSchedulerTables = this.tableExists('agent_mode_scheduler_events')
        && this.tableExists('agent_mode_scheduler_schedules')
        && this.tableExists('agent_mode_source_watermarks')
        && this.tableExists('agent_mode_scheduler_observer');
      this.hasEventSourceTables = this.tableExists('agent_mode_event_sources');
      return;
    }
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec('PRAGMA synchronous = NORMAL;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS store_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agents (
        agent_id TEXT PRIMARY KEY,
        agent_kind TEXT NOT NULL,
        role TEXT NOT NULL,
        display_name TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        sequence INTEGER,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leases (
        resource_key TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        fence INTEGER NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS effects (
        operation_id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL,
        effect_kind TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        receipt_json TEXT,
        grant_id TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(task_id),
        agent_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        runtime_pid INTEGER,
        runtime_started_at TEXT,
        runtime_command TEXT,
        runtime_identity TEXT
      );
      CREATE TABLE IF NOT EXISTS attempts (
        attempt_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(run_id),
        agent_id TEXT NOT NULL,
        runtime_ref TEXT NOT NULL,
        route_ref TEXT NOT NULL,
        model_ref TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        capability_scope_hash TEXT NOT NULL,
        budget_scope_id TEXT NOT NULL,
        reservation_id TEXT,
        lease_resource_key TEXT,
        lease_id TEXT,
        lease_owner_id TEXT,
        lease_fence INTEGER,
        status TEXT NOT NULL,
        cancellation_status TEXT NOT NULL,
        cancellation_requested_at TEXT,
        cancellation_acknowledged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS budget_scopes (
        budget_scope_id TEXT PRIMARY KEY,
        max_steps INTEGER NOT NULL CHECK (max_steps >= 0),
        used_steps INTEGER NOT NULL DEFAULT 0 CHECK (used_steps >= 0),
        reserved_steps INTEGER NOT NULL DEFAULT 0 CHECK (reserved_steps >= 0),
        max_tokens INTEGER NOT NULL CHECK (max_tokens >= 0),
        used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
        reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
        max_dollars REAL NOT NULL CHECK (max_dollars >= 0),
        used_dollars REAL NOT NULL DEFAULT 0 CHECK (used_dollars >= 0),
        reserved_dollars REAL NOT NULL DEFAULT 0 CHECK (reserved_dollars >= 0)
      );
      CREATE TABLE IF NOT EXISTS budget_reservations (
        reservation_id TEXT PRIMARY KEY,
        budget_scope_id TEXT NOT NULL REFERENCES budget_scopes(budget_scope_id),
        attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
        steps INTEGER NOT NULL CHECK (steps >= 0),
        tokens INTEGER NOT NULL CHECK (tokens >= 0),
        dollars REAL NOT NULL CHECK (dollars >= 0),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        settled_at TEXT,
        settled_steps INTEGER,
        settled_tokens INTEGER,
        settled_dollars REAL
      );
      CREATE TABLE IF NOT EXISTS dispatch_outbox (
        operation_id TEXT PRIMARY KEY REFERENCES effects(operation_id),
        attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
        effect_kind TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        grant_id TEXT,
        scope_hash TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        lease_resource_key TEXT,
        lease_id TEXT,
        lease_fence INTEGER,
        deadline TEXT NOT NULL,
        state TEXT NOT NULL,
        prepared_at TEXT NOT NULL,
        dispatched_at TEXT
      );
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL REFERENCES effects(operation_id),
        attempt_id TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        effect_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cancellation_requests (
        request_id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
        requested_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcells (
        workcell_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        repository_ref TEXT NOT NULL,
        repository_root TEXT NOT NULL,
        worktree_path TEXT NOT NULL UNIQUE,
        branch TEXT NOT NULL UNIQUE,
        owner_agent TEXT NOT NULL,
        base_ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_receipts (
        receipt_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        receipt_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        repository_ref TEXT NOT NULL,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        operation TEXT NOT NULL,
        result_state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_writer_leases (
        lease_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        owner_agent TEXT NOT NULL,
        owner_attempt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        fence_token INTEGER NOT NULL CHECK (fence_token > 0),
        status TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS workcell_one_active_writer
        ON workcell_writer_leases (workcell_id) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS workcell_writer_receipts (
        receipt_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        receipt_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        lease_id TEXT,
        fence_token INTEGER,
        timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        result_state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_diff_evidence (
        diff_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL,
        branch TEXT NOT NULL,
        base_revision TEXT NOT NULL,
        current_revision TEXT NOT NULL,
        changed_files_json TEXT NOT NULL,
        diff_hash TEXT NOT NULL,
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        captured_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_validation_evidence (
        validation_id TEXT PRIMARY KEY,
        diff_id TEXT NOT NULL REFERENCES workcell_diff_evidence(diff_id),
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        requested_at TEXT NOT NULL,
        result TEXT NOT NULL,
        state TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_file_mutations (
        operation_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        expected_preimage_hash TEXT NOT NULL,
        preimage_state TEXT NOT NULL,
        preimage_hash TEXT,
        replacement_hash TEXT NOT NULL,
        postimage_hash TEXT,
        operation_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_write_receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL REFERENCES workcell_file_mutations(operation_id),
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        repository_ref TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        preimage_hash TEXT NOT NULL,
        postimage_hash TEXT,
        timestamp TEXT NOT NULL,
        result TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workcell_write_receipts_by_operation
        ON workcell_write_receipts (operation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS workcell_validations (
        validation_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL,
        validator_profile TEXT NOT NULL,
        diff_id TEXT,
        lease_id TEXT NOT NULL,
        fence_token INTEGER NOT NULL,
        operation_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        result TEXT NOT NULL,
        evidence_hash TEXT,
        evidence_json TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workcell_validation_receipts (
        receipt_id TEXT PRIMARY KEY,
        validation_id TEXT NOT NULL REFERENCES workcell_validations(validation_id),
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        validator_profile TEXT NOT NULL,
        evidence_hash TEXT,
        timestamp TEXT NOT NULL,
        result TEXT NOT NULL,
        operation_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workcell_validation_receipts_by_validation
        ON workcell_validation_receipts (validation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_review_requests (
        review_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        task_id TEXT NOT NULL, run_id TEXT NOT NULL, attempt_id TEXT NOT NULL, worker_agent_id TEXT NOT NULL,
        repository_ref TEXT NOT NULL, branch TEXT NOT NULL, base_revision TEXT NOT NULL,
        current_revision TEXT NOT NULL, diff_id TEXT NOT NULL, diff_hash TEXT NOT NULL,
        validation_id TEXT NOT NULL, validation_evidence_hash TEXT NOT NULL,
        requesting_actor TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        status TEXT NOT NULL, request_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_review_decisions (
        decision_id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES agent_mode_review_requests(review_id),
        decision TEXT NOT NULL, reviewer TEXT NOT NULL, decided_at TEXT NOT NULL,
        reason TEXT NOT NULL, evidence_hash TEXT NOT NULL, decision_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_one_review_decision
        ON agent_mode_review_decisions (review_id);
      CREATE TABLE IF NOT EXISTS agent_mode_review_receipts (
        receipt_id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES agent_mode_review_requests(review_id),
        decision_id TEXT,
        task_id TEXT NOT NULL, run_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id), worker_agent_id TEXT NOT NULL,
        diff_hash TEXT NOT NULL, validation_evidence_hash TEXT NOT NULL,
        reviewer TEXT NOT NULL, timestamp TEXT NOT NULL, operation_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_review_receipts_by_review
        ON agent_mode_review_receipts (review_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_target_ref_leases (
        lease_id TEXT PRIMARY KEY,
        repository_ref TEXT NOT NULL, target_ref TEXT NOT NULL,
        owner_operation TEXT NOT NULL, fence_token INTEGER NOT NULL CHECK (fence_token > 0),
        expected_target_head TEXT NOT NULL, expires_at TEXT NOT NULL,
        status TEXT NOT NULL, lease_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_one_active_target_ref_lease
        ON agent_mode_target_ref_leases (repository_ref, target_ref) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS agent_mode_commit_operations (
        operation_id TEXT PRIMARY KEY,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        repository_ref TEXT NOT NULL, branch TEXT NOT NULL, parent_commit TEXT NOT NULL,
        resulting_commit TEXT, approved_diff_hash TEXT NOT NULL,
        validation_evidence_hash TEXT NOT NULL, review_id TEXT NOT NULL,
        actor TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL,
        receipt_hash TEXT, reason TEXT, operation_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_merge_approvals (
        approval_id TEXT PRIMARY KEY,
        repository_ref TEXT NOT NULL, source_workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        source_branch TEXT NOT NULL, source_commit TEXT NOT NULL, diff_hash TEXT NOT NULL,
        validation_evidence_hash TEXT NOT NULL, target_ref TEXT NOT NULL,
        expected_target_head TEXT NOT NULL, approver TEXT NOT NULL, created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
        approval_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_merge_receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL, approval_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        source_commit TEXT, target_ref TEXT NOT NULL,
        target_before TEXT, target_after TEXT,
        review_id TEXT NOT NULL, validation_id TEXT NOT NULL,
        actor TEXT NOT NULL, timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL, result TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_merge_receipts_by_operation
        ON agent_mode_merge_receipts (operation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_commit_receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        workcell_id TEXT NOT NULL REFERENCES workcells(workcell_id),
        branch TEXT NOT NULL, parent_commit TEXT, resulting_commit TEXT,
        diff_hash TEXT NOT NULL, validation_evidence_hash TEXT NOT NULL,
        review_id TEXT NOT NULL, actor TEXT NOT NULL, timestamp TEXT NOT NULL,
        operation_hash TEXT NOT NULL, result TEXT NOT NULL, receipt_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS agent_mode_commit_receipts_by_operation
        ON agent_mode_commit_receipts (operation_id, timestamp, receipt_id);
      CREATE TABLE IF NOT EXISTS agent_mode_merge_operations (
        operation_id TEXT PRIMARY KEY,
        approval_id TEXT NOT NULL REFERENCES agent_mode_merge_approvals(approval_id),
        repository_ref TEXT NOT NULL, source_workcell_id TEXT NOT NULL,
        source_branch TEXT NOT NULL, source_commit TEXT NOT NULL, target_ref TEXT NOT NULL,
        expected_target_head TEXT NOT NULL, resulting_target_head TEXT, actor TEXT NOT NULL,
        created_at TEXT NOT NULL, status TEXT NOT NULL, receipt_hash TEXT, reason TEXT,
        operation_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_scheduler_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        causation_id TEXT,
        correlation_id TEXT,
        deduplication_key TEXT NOT NULL,
        payload_version TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        next_eligible_at TEXT NOT NULL,
        deadline TEXT,
        max_attempts INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        claim_owner TEXT,
        claim_fence INTEGER,
        claim_expires_at TEXT,
        last_failure TEXT,
        last_failure_at TEXT,
        completed_at TEXT,
        dead_lettered_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_scheduler_events_dedup
        ON agent_mode_scheduler_events (source, deduplication_key);
      CREATE INDEX IF NOT EXISTS agent_mode_scheduler_events_ready
        ON agent_mode_scheduler_events (status, next_eligible_at, event_id);
      CREATE TABLE IF NOT EXISTS agent_mode_scheduler_schedules (
        schedule_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        due_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        deduplication_key TEXT NOT NULL,
        causation_id TEXT,
        correlation_id TEXT,
        payload_version TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        next_eligible_at TEXT NOT NULL,
        deadline TEXT,
        max_attempts INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        claim_owner TEXT,
        claim_fence INTEGER,
        claim_expires_at TEXT,
        last_failure TEXT,
        last_failure_at TEXT,
        completed_at TEXT,
        dead_lettered_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS agent_mode_scheduler_schedules_dedup
        ON agent_mode_scheduler_schedules (kind, deduplication_key);
      CREATE INDEX IF NOT EXISTS agent_mode_scheduler_schedules_ready
        ON agent_mode_scheduler_schedules (status, next_eligible_at, schedule_id);
      CREATE TABLE IF NOT EXISTS agent_mode_source_watermarks (
        source_id TEXT PRIMARY KEY,
        watermark TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_mode_scheduler_observer (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        latest_tick_json TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_mode_event_sources (
        source_id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        repository_ref TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        debounce_window_ms INTEGER NOT NULL,
        cooldown_window_ms INTEGER NOT NULL,
        catch_up_limit INTEGER NOT NULL,
        enabled INTEGER NOT NULL,
        bootstrap_watermark TEXT,
        status TEXT NOT NULL,
        watermark TEXT,
        last_observed_at TEXT,
        last_successful_observation TEXT,
        last_error_reason TEXT,
        cooldown_not_before TEXT,
        next_eligible_at TEXT,
        catch_up_pending INTEGER NOT NULL,
        last_emitted_event_count INTEGER NOT NULL,
        failure_attempt_count INTEGER NOT NULL
      );
      INSERT INTO store_meta (key, value) VALUES ('schema_version', '7')
        ON CONFLICT(key) DO NOTHING;
    `);
    this.migrateEventsTable();
    this.migrateEffectsTable();
    this.migrateOutboxTable();
    this.migrateRunsTable();
    this.migrateReviewTables();
    this.hasRuntimePidColumn = true;
    this.hasRuntimeIdentityColumns = true;
    this.hasWorkcellTables = true;
    this.hasWriterTables = true;
    this.hasMutationTables = true;
    this.hasValidationTables = true;
    this.hasPromotionTables = true;
    this.hasReviewReceiptTables = true;
    this.hasCommitReceiptTables = true;
    this.hasMergeReceiptTables = true;
    this.database.prepare("UPDATE store_meta SET value = '7' WHERE key = 'schema_version' AND value IN ('1', '2', '3', '4', '5', '6')").run();
    this.hasSchedulerTables = true;
    this.hasEventSourceTables = true;
  }

  static openExisting(databasePath = defaultAgentModeDatabasePath()): AgentModeSqliteStateStore | undefined {
    if (!existsSync(databasePath)) return undefined;
    return new AgentModeSqliteStateStore(databasePath, { readOnly: true });
  }

  private migrateReviewTables(): void {
    const columns = this.database.prepare('PRAGMA table_info(agent_mode_review_requests)').all() as Array<{ name?: string }>;
    if (columns.some((column) => column.name === 'worker_agent_id')) return;
    this.database.exec('ALTER TABLE agent_mode_review_requests ADD COLUMN worker_agent_id TEXT');
    this.database.exec('UPDATE agent_mode_review_requests SET worker_agent_id = (SELECT owner_agent FROM workcells WHERE workcells.workcell_id = agent_mode_review_requests.workcell_id) WHERE worker_agent_id IS NULL');
  }

  private migrateEffectsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(effects)').all() as Array<{ name?: string }>;
    const existing = new Set(columns.map((column) => column.name));
    const additions: Record<string, string> = {
      capability_id: 'TEXT',
      grant_id: 'TEXT',
      policy_version: 'TEXT',
      lease_resource_key: 'TEXT',
      lease_id: 'TEXT',
      lease_fence: 'INTEGER',
      deadline: 'TEXT',
      prepared_at: 'TEXT',
      dispatched_at: 'TEXT',
      observed_at: 'TEXT',
    };
    for (const [name, type] of Object.entries(additions)) {
      if (!existing.has(name)) this.database.exec(`ALTER TABLE effects ADD COLUMN ${name} ${type}`);
    }
  }

  private migrateEventsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(events)').all() as Array<{ name?: string }>;
    if (columns.some((column) => column.name === 'sequence')) return;
    this.database.exec('ALTER TABLE events ADD COLUMN sequence INTEGER');
    this.database.exec('UPDATE events SET sequence = rowid WHERE sequence IS NULL');
  }

  private migrateOutboxTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(dispatch_outbox)').all() as Array<{ name?: string }>;
    if (!columns.some((column) => column.name === 'grant_id')) this.database.exec('ALTER TABLE dispatch_outbox ADD COLUMN grant_id TEXT');
  }

  private migrateRunsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(runs)').all() as Array<{ name?: string }>;
    if (!columns.some((column) => column.name === 'runtime_pid')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_pid INTEGER');
    if (!columns.some((column) => column.name === 'runtime_started_at')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_started_at TEXT');
    if (!columns.some((column) => column.name === 'runtime_command')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_command TEXT');
    if (!columns.some((column) => column.name === 'runtime_identity')) this.database.exec('ALTER TABLE runs ADD COLUMN runtime_identity TEXT');
  }

  private tableHasColumn(table: string, columnName: string): boolean {
    const columns = this.database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>;
    return columns.some((column) => column.name === columnName);
  }

  private tableExists(table: string): boolean {
    const row = this.database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { present?: number } | undefined;
    return row?.present === 1;
  }

  get schemaVersion(): number {
    const row = this.database.prepare('SELECT value FROM store_meta WHERE key = ?').get('schema_version') as { value?: string } | undefined;
    return Number(row?.value ?? 0);
  }

  withTransaction<T>(callback: () => T): T {
    if (this.transactionDepth > 0) return callback();
    this.database.exec('BEGIN IMMEDIATE;');
    this.transactionDepth = 1;
    try {
      const result = callback();
      this.database.exec('COMMIT;');
      this.transactionDepth = 0;
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK;');
      this.transactionDepth = 0;
      throw error;
    }
  }

  upsertAgent(agent: AgentModeAgent): void {
    this.database.prepare(`
      INSERT INTO agents (agent_id, agent_kind, role, display_name, policy_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        agent_kind = excluded.agent_kind,
        role = excluded.role,
        display_name = excluded.display_name,
        policy_id = excluded.policy_id,
        status = excluded.status
    `).run(agent.agentId, agent.agentKind, agent.role, agent.displayName, agent.policyId, agent.status);
  }

  getAgent(agentId: string): AgentModeAgent | undefined {
    const row = this.database.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      agentId: String(row.agent_id),
      agentKind: row.agent_kind as AgentModeAgent['agentKind'],
      role: String(row.role),
      displayName: String(row.display_name),
      policyId: String(row.policy_id),
      status: row.status as AgentModeAgent['status'],
    };
  }

  listAgents(): AgentModeAgent[] {
    const rows = this.database.prepare('SELECT * FROM agents ORDER BY agent_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      agentId: String(row.agent_id),
      agentKind: row.agent_kind as AgentModeAgent['agentKind'],
      role: String(row.role),
      displayName: String(row.display_name),
      policyId: String(row.policy_id),
      status: row.status as AgentModeAgent['status'],
    }));
  }

  injectPersistenceFailureOnce(point: AgentModePersistenceFailurePoint): void {
    this.injectedFailures.add(point);
  }

  private failIfInjected(point: AgentModePersistenceFailurePoint): void {
    if (!this.injectedFailures.delete(point)) return;
    throw new Error(`injected persistence failure at ${point}`);
  }

  createTask(task: AgentModeTask): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT task_type, input_hash, created_at FROM tasks WHERE task_id = ?').get(task.taskId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_type === task.taskType
          && existing.input_hash === task.inputHash
          && existing.created_at === task.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      this.database.prepare('INSERT INTO tasks (task_id, task_type, input_hash, created_at, status) VALUES (?, ?, ?, ?, ?)')
        .run(task.taskId, task.taskType, task.inputHash, task.createdAt, task.status ?? 'pending');
      return 'created';
    });
  }

  getTask(taskId: string): AgentModeTask | undefined {
    const row = this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      taskId: String(row.task_id),
      taskType: String(row.task_type),
      inputHash: String(row.input_hash),
      createdAt: String(row.created_at),
      status: row.status as AgentModeTaskStatus,
    };
  }

  listTasks(): AgentModeTask[] {
    const rows = this.database.prepare('SELECT * FROM tasks ORDER BY created_at, task_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      taskId: String(row.task_id),
      taskType: String(row.task_type),
      inputHash: String(row.input_hash),
      createdAt: String(row.created_at),
      status: row.status as AgentModeTaskStatus,
    }));
  }

  createRun(run: AgentModeRun): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT task_id, agent_id, created_at FROM runs WHERE run_id = ?').get(run.runId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_id === run.taskId
          && existing.agent_id === run.agentId
          && existing.created_at === run.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      if (!this.getTask(run.taskId)) throw new Error(`task not found: ${run.taskId}`);
      this.database.prepare('INSERT INTO runs (run_id, task_id, agent_id, created_at, status) VALUES (?, ?, ?, ?, ?)')
        .run(run.runId, run.taskId, run.agentId, run.createdAt, run.status ?? 'created');
      return 'created';
    });
  }

  getRun(runId: string): AgentModeRun | undefined {
    const columns = this.hasRuntimeIdentityColumns ? '*'
      : this.hasRuntimePidColumn ? 'run_id, task_id, agent_id, created_at, status, runtime_pid'
        : 'run_id, task_id, agent_id, created_at, status';
    const row = this.database.prepare(`SELECT ${columns} FROM runs WHERE run_id = ?`).get(runId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      runId: String(row.run_id),
      taskId: String(row.task_id),
      agentId: String(row.agent_id),
      createdAt: String(row.created_at),
      status: row.status as AgentModeRunStatus,
      ...(row.runtime_pid === null || row.runtime_pid === undefined ? {} : { runtimePid: Number(row.runtime_pid) }),
      ...(row.runtime_started_at && row.runtime_command && row.runtime_identity ? {
        runtimeIdentity: { startedAt: String(row.runtime_started_at), command: String(row.runtime_command), token: String(row.runtime_identity) },
      } : {}),
    };
  }

  listRuns(): AgentModeRun[] {
    const rows = this.database.prepare('SELECT * FROM runs ORDER BY created_at, run_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      runId: String(row.run_id),
      taskId: String(row.task_id),
      agentId: String(row.agent_id),
      createdAt: String(row.created_at),
      status: row.status as AgentModeRunStatus,
      ...(row.runtime_pid === null || row.runtime_pid === undefined ? {} : { runtimePid: Number(row.runtime_pid) }),
      ...(row.runtime_started_at && row.runtime_command && row.runtime_identity ? {
        runtimeIdentity: { startedAt: String(row.runtime_started_at), command: String(row.runtime_command), token: String(row.runtime_identity) },
      } : {}),
    }));
  }

  setRunRuntimePid(runId: string, runtimePid: number, runtimeIdentity: RuntimeProcessIdentity): void {
    if (!Number.isSafeInteger(runtimePid) || runtimePid <= 0) throw new Error(`invalid runtime pid: ${runtimePid}`);
    if (!runtimeIdentity.startedAt || !runtimeIdentity.command || !runtimeIdentity.token) throw new Error('runtime identity is incomplete');
    this.withTransaction(() => {
      const result = this.database.prepare('UPDATE runs SET runtime_pid = ?, runtime_started_at = ?, runtime_command = ?, runtime_identity = ? WHERE run_id = ?')
        .run(runtimePid, runtimeIdentity.startedAt, runtimeIdentity.command, runtimeIdentity.token, runId);
      if (result.changes !== 1) throw new Error(`run not found: ${runId}`);
    });
  }

  /** Brain may narrow an admitted attempt to the concrete Workcell scope once its ID exists. */
  setAttemptCapabilityScopeHash(attemptId: string, scopeHash: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.capabilityScopeHash === scopeHash) return 'duplicate';
      if (!scopeHash || ['completed', 'failed', 'cancelled'].includes(attempt.status)) return 'conflict';
      this.database.prepare('UPDATE attempts SET capability_scope_hash = ?, updated_at = ? WHERE attempt_id = ?').run(scopeHash, updatedAt, attemptId);
      this.appendEventIfAbsent({ eventId: `attempt-scope-narrowed:${attemptId}:${scopeHash}`, entityType: 'attempt', entityId: attemptId, eventType: 'attempt_scope_narrowed', occurredAt: updatedAt, payload: { scopeHash } });
      return 'created';
    });
  }

  clearRunRuntimePid(runId: string): void {
    this.withTransaction(() => {
      this.database.prepare('UPDATE runs SET runtime_pid = NULL, runtime_started_at = NULL, runtime_command = NULL, runtime_identity = NULL WHERE run_id = ?').run(runId);
    });
  }

  markControllerLost(runId: string, lostAt: string, reason = 'runtime_process_lost'): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (['completed', 'failed', 'cancelled'].includes(run.status ?? 'created')) return 'duplicate';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      this.clearRunRuntimePid(runId);
      if (attempt) {
        this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ?').run(lostAt, attempt.leaseResourceKey ?? '');
        this.database.prepare('UPDATE attempts SET lease_resource_key = NULL, lease_id = NULL, lease_owner_id = NULL, lease_fence = NULL, updated_at = ? WHERE attempt_id = ?').run(lostAt, attempt.attemptId);
      }
      this.appendEventIfAbsent({ eventId: `controller-lost:${runId}:${lostAt}`, entityType: 'run', entityId: runId, eventType: 'controller_lost', occurredAt: lostAt, payload: { attemptId: attempt?.attemptId ?? null, reason } });
      return 'created';
    });
  }

  reAdmitRun(runId: string, input: AgentModeReAdmission): AgentModeLease {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      if (!attempt) throw new Error(`no resumable attempt for run: ${runId}`);
      if (!input.accessEvidenceValid) throw new Error('re-admission requires fresh access evidence');
      if (this.classifyRecovery(attempt.attemptId, input.now) !== 'safe_to_resume') throw new Error(`run is not safe to resume: ${this.classifyRecovery(attempt.attemptId, input.now)}`);
      const reservation = attempt.reservationId ? this.getReservation(attempt.reservationId) : undefined;
      const budget = this.getBudget(attempt.budgetScopeId);
      if (!reservation || reservation.status !== 'reserved' || !budget
        || budget.usedSteps + budget.reservedSteps > budget.maxSteps
        || budget.usedTokens + budget.reservedTokens > budget.maxTokens
        || budget.usedDollars + budget.reservedDollars > budget.maxDollars) throw new Error('re-admission budget reservation is unavailable or exhausted');
      const lease = this.acquireLeaseAt(input.lease, input.now);
      if (!lease) throw new Error('fresh re-admission lease is unavailable');
      this.setRunRuntimePid(runId, input.runtimePid, input.runtimeIdentity);
      this.database.prepare('UPDATE attempts SET lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?, updated_at = ? WHERE attempt_id = ?')
        .run(input.lease.resourceKey, input.lease.leaseId, input.lease.ownerId, lease.fence, input.now, attempt.attemptId);
      if (run.status !== 'paused') {
        this.database.prepare("UPDATE runs SET status = 'active' WHERE run_id = ?").run(runId);
        this.database.prepare("UPDATE tasks SET status = 'running' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
        this.database.prepare("UPDATE attempts SET status = 'running' WHERE attempt_id = ?").run(attempt.attemptId);
      }
      this.appendEventIfAbsent({ eventId: `readmitted:${runId}:${input.lease.leaseId}`, entityType: 'run', entityId: runId, eventType: 'attempt_readmitted_after_process_loss', occurredAt: input.now, payload: { attemptId: attempt.attemptId, leaseId: input.lease.leaseId, leaseFence: lease.fence, sameLineage: true } });
      return lease;
    });
  }

  pauseRun(runId: string, pausedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (run.status === 'paused') return 'duplicate';
      if (['completed', 'failed', 'cancelled'].includes(run.status ?? 'created')) return 'conflict';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      this.database.prepare("UPDATE runs SET status = 'paused' WHERE run_id = ?").run(runId);
      this.database.prepare("UPDATE tasks SET status = 'paused' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
      if (attempt) this.database.prepare("UPDATE attempts SET status = 'paused', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(pausedAt, attempt.attemptId);
      this.appendEventIfAbsent({
        eventId: `run-paused:${runId}:${pausedAt}`,
        entityType: 'run',
        entityId: runId,
        eventType: 'run_paused',
        occurredAt: pausedAt,
        payload: { attemptId: attempt?.attemptId ?? null },
      });
      return 'created';
    });
  }

  resumeRun(runId: string, resumedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (run.status !== 'paused') return run.status === 'active' ? 'duplicate' : 'conflict';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && candidate.status === 'paused');
      this.database.prepare("UPDATE runs SET status = 'active' WHERE run_id = ?").run(runId);
      this.database.prepare("UPDATE tasks SET status = 'running' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
      if (attempt) this.database.prepare("UPDATE attempts SET status = 'running', updated_at = ? WHERE attempt_id = ? AND status = 'paused'").run(resumedAt, attempt.attemptId);
      this.appendEventIfAbsent({
        eventId: `run-resumed:${runId}:${resumedAt}`,
        entityType: 'run',
        entityId: runId,
        eventType: 'run_resumed',
        occurredAt: resumedAt,
        payload: { attemptId: attempt?.attemptId ?? null },
      });
      return 'created';
    });
  }

  cancelRun(runId: string, cancelledAt: string, action: 'cancel' | 'kill' = 'cancel'): AgentModeOperationResult {
    return this.withTransaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      if (['completed', 'failed', 'cancelled'].includes(run.status ?? 'created')) return 'duplicate';
      const attempt = this.listAttempts().find((candidate) => candidate.runId === runId && !['completed', 'failed', 'cancelled'].includes(candidate.status));
      if (attempt) {
        if (attempt.cancellationStatus === 'running') this.requestCancellation({ requestId: `${action}:${runId}:${cancelledAt}`, attemptId: attempt.attemptId, requestedAt: cancelledAt });
        // A normal cancel is a durable request. Only the active controller can
        // truthfully acknowledge that it stopped dispatch and reconciled work.
        // Kill is the explicit force path and may close the attempt here.
        if (action === 'kill') {
          if (this.getAttempt(attempt.attemptId)?.cancellationStatus === 'requested') this.acknowledgeCancellation(attempt.attemptId, cancelledAt);
          this.finishAttempt(attempt.attemptId, 'cancelled', cancelledAt);
        }
      } else {
        this.database.prepare("UPDATE runs SET status = 'cancelled' WHERE run_id = ?").run(runId);
        this.database.prepare("UPDATE tasks SET status = 'cancelled' WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)").run(runId);
      }
      if (action === 'kill') this.clearRunRuntimePid(runId);
      this.appendEventIfAbsent({
        eventId: `run-${action}:${runId}:${cancelledAt}`,
        entityType: 'run',
        entityId: runId,
        eventType: action === 'kill' ? 'run_killed' : attempt ? 'run_cancel_requested' : 'run_cancelled',
        occurredAt: cancelledAt,
        payload: { attemptId: attempt?.attemptId ?? null, acknowledged: action === 'kill' || !attempt },
      });
      return 'created';
    });
  }

  createAttempt(attempt: AgentModeAttemptInput): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(attempt.attemptId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.run_id === attempt.runId
          && existing.agent_id === attempt.agentId
          && existing.runtime_ref === attempt.runtimeRef
          && existing.route_ref === attempt.routeRef
          && existing.model_ref === attempt.modelRef
          && existing.policy_version === attempt.policyVersion
          && existing.capability_scope_hash === attempt.capabilityScopeHash
          && existing.budget_scope_id === attempt.budgetScopeId
          && existing.created_at === attempt.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      if (!this.getRun(attempt.runId)) throw new Error(`run not found: ${attempt.runId}`);
      const updatedAt = attempt.updatedAt ?? attempt.createdAt;
      this.database.prepare(`
        INSERT INTO attempts (
          attempt_id, run_id, agent_id, runtime_ref, route_ref, model_ref,
          policy_version, capability_scope_hash, budget_scope_id, status,
          cancellation_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 'running', ?, ?)
      `).run(
        attempt.attemptId,
        attempt.runId,
        attempt.agentId,
        attempt.runtimeRef,
        attempt.routeRef,
        attempt.modelRef,
        attempt.policyVersion,
        attempt.capabilityScopeHash,
        attempt.budgetScopeId,
        attempt.createdAt,
        updatedAt,
      );
      return 'created';
    });
  }

  getAttempt(attemptId: string): AgentModeAttempt | undefined {
    const row = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(attemptId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapAttempt(row);
  }

  listAttempts(): AgentModeAttempt[] {
    const rows = this.database.prepare('SELECT * FROM attempts ORDER BY created_at, attempt_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapAttempt(row));
  }

  getBudget(budgetScopeId: string): AgentModeBudgetState | undefined {
    const row = this.database.prepare('SELECT * FROM budget_scopes WHERE budget_scope_id = ?').get(budgetScopeId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      budgetScopeId: String(row.budget_scope_id),
      maxSteps: Number(row.max_steps),
      usedSteps: Number(row.used_steps),
      reservedSteps: Number(row.reserved_steps),
      maxTokens: Number(row.max_tokens),
      usedTokens: Number(row.used_tokens),
      reservedTokens: Number(row.reserved_tokens),
      maxDollars: Number(row.max_dollars),
      usedDollars: Number(row.used_dollars),
      reservedDollars: Number(row.reserved_dollars),
    };
  }

  getReservation(reservationId: string): AgentModeBudgetReservation | undefined {
    const row = this.database.prepare('SELECT * FROM budget_reservations WHERE reservation_id = ?').get(reservationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      reservationId: String(row.reservation_id),
      budgetScopeId: String(row.budget_scope_id),
      attemptId: String(row.attempt_id),
      steps: Number(row.steps),
      tokens: Number(row.tokens),
      dollars: Number(row.dollars),
      status: row.status as AgentModeBudgetReservation['status'],
      createdAt: String(row.created_at),
      ...(row.settled_at === null ? {} : { settledAt: String(row.settled_at) }),
      ...(row.settled_steps === null ? {} : { settledSteps: Number(row.settled_steps) }),
      ...(row.settled_tokens === null ? {} : { settledTokens: Number(row.settled_tokens) }),
      ...(row.settled_dollars === null ? {} : { settledDollars: Number(row.settled_dollars) }),
    };
  }

  private mapAttempt(row: Record<string, unknown>): AgentModeAttempt {
    return {
      attemptId: String(row.attempt_id),
      runId: String(row.run_id),
      agentId: String(row.agent_id),
      runtimeRef: String(row.runtime_ref),
      routeRef: String(row.route_ref),
      modelRef: String(row.model_ref),
      policyVersion: String(row.policy_version),
      capabilityScopeHash: String(row.capability_scope_hash),
      budgetScopeId: String(row.budget_scope_id),
      ...(row.reservation_id === null ? {} : { reservationId: String(row.reservation_id) }),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_owner_id === null ? {} : { leaseOwnerId: String(row.lease_owner_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      status: row.status as AgentModeAttemptStatus,
      cancellationStatus: row.cancellation_status as AgentModeAttempt['cancellationStatus'],
      ...(row.cancellation_requested_at === null ? {} : { cancellationRequestedAt: String(row.cancellation_requested_at) }),
      ...(row.cancellation_acknowledged_at === null ? {} : { cancellationAcknowledgedAt: String(row.cancellation_acknowledged_at) }),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  appendEvent(event: AgentModeEvent): void {
    const nextSequence = this.database.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM events').get() as { next_sequence?: number };
    this.database.prepare(`
      INSERT INTO events (event_id, sequence, entity_type, entity_id, event_type, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(event.eventId, nextSequence.next_sequence ?? 1, event.entityType, event.entityId, event.eventType, event.occurredAt, JSON.stringify(event.payload));
  }

  private appendEventIfAbsent(event: AgentModeEvent): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT entity_type, entity_id, event_type, occurred_at, payload_json FROM events WHERE event_id = ?').get(event.eventId) as Record<string, unknown> | undefined;
    if (existing) {
      const same = existing.entity_type === event.entityType
        && existing.entity_id === event.entityId
        && existing.event_type === event.eventType
        && existing.occurred_at === event.occurredAt
        && existing.payload_json === JSON.stringify(event.payload);
      if (!same) throw new Error(`event conflict: ${event.eventId}`);
      return 'duplicate';
    }
    this.appendEvent(event);
    return 'created';
  }

  listEvents(entityId: string): AgentModeEvent[] {
    const rows = this.database.prepare('SELECT * FROM events WHERE entity_id = ? ORDER BY sequence, event_id').all(entityId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  listEventsAfterSequence(afterSequence: number, limit = 101): AgentModeEvent[] {
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error('event sequence cursor is invalid');
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 501));
    const rows = this.database.prepare('SELECT * FROM events WHERE sequence > ? ORDER BY sequence ASC LIMIT ?').all(afterSequence, boundedLimit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  getHighestEventSequence(): number {
    const row = this.database.prepare('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM events').get() as { sequence?: number };
    const sequence = Number(row.sequence ?? 0);
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('event sequence state is invalid');
    return sequence;
  }

  listRecentEvents(limit = 100): AgentModeEvent[] {
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 500));
    const rows = this.database.prepare('SELECT * FROM events ORDER BY sequence DESC, event_id DESC LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>;
    return rows.reverse().map((row) => ({
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  recordEvent(event: AgentModeEvent): AgentModeOperationResult {
    return this.withTransaction(() => this.appendEventIfAbsent(event));
  }

  admitAttempt(admission: AgentModeAdmission): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(admission.attempt.attemptId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.run_id === admission.attempt.runId
          && existing.agent_id === admission.attempt.agentId
          && existing.runtime_ref === admission.attempt.runtimeRef
          && existing.route_ref === admission.attempt.routeRef
          && existing.model_ref === admission.attempt.modelRef
          && existing.policy_version === admission.attempt.policyVersion
          && existing.capability_scope_hash === admission.attempt.capabilityScopeHash
          && existing.budget_scope_id === admission.attempt.budgetScopeId
          && existing.reservation_id === admission.estimate.reservationId
          && existing.lease_id === admission.lease.leaseId;
        if (!same) return 'conflict';
        if (existing.status === 'admitted' || existing.status === 'running') return 'duplicate';
      }

      if (this.ensureTask(admission.task) === 'conflict') return 'conflict';
      if (this.ensureRun(admission.run) === 'conflict') return 'conflict';
      if (!existing) {
        this.database.prepare(`
          INSERT INTO attempts (
            attempt_id, run_id, agent_id, runtime_ref, route_ref, model_ref,
            policy_version, capability_scope_hash, budget_scope_id, status,
            cancellation_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 'running', ?, ?)
        `).run(
          admission.attempt.attemptId,
          admission.attempt.runId,
          admission.attempt.agentId,
          admission.attempt.runtimeRef,
          admission.attempt.routeRef,
          admission.attempt.modelRef,
          admission.attempt.policyVersion,
          admission.attempt.capabilityScopeHash,
          admission.attempt.budgetScopeId,
          admission.now,
          admission.now,
        );
      }

      this.ensureBudgetScope(admission.budget);
      const reservationResult = this.reserveBudgetInternal({
        reservationId: admission.estimate.reservationId,
        budgetScopeId: admission.budget.budgetScopeId,
        attemptId: admission.attempt.attemptId,
        steps: admission.estimate.steps,
        tokens: admission.estimate.tokens,
        dollars: admission.estimate.dollars,
        status: 'reserved',
        createdAt: admission.now,
      });
      if (reservationResult === 'conflict') return 'conflict';

      const lease = this.acquireLeaseAt(admission.lease, admission.now);
      if (!lease) throw new Error(`lease unavailable for ${admission.lease.resourceKey}`);
      this.database.prepare(`
        UPDATE attempts SET
            reservation_id = ?, lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?,
          status = 'admitted', updated_at = ?
        WHERE attempt_id = ?
      `).run(
        admission.estimate.reservationId,
        admission.lease.resourceKey,
        admission.lease.leaseId,
        admission.lease.ownerId,
        lease.fence,
        admission.now,
        admission.attempt.attemptId,
      );
      this.database.prepare('UPDATE tasks SET status = \'admitted\' WHERE task_id = ?').run(admission.task.taskId);
      this.database.prepare('UPDATE runs SET status = \'active\' WHERE run_id = ?').run(admission.run.runId);
      this.appendEventIfAbsent({
        eventId: admission.eventId ?? `admission:${admission.attempt.attemptId}`,
        entityType: 'attempt',
        entityId: admission.attempt.attemptId,
        eventType: 'attempt_admitted',
        occurredAt: admission.now,
        payload: {
          taskId: admission.task.taskId,
          runId: admission.run.runId,
          reservationId: admission.estimate.reservationId,
          leaseFence: lease.fence,
        },
      });
      this.failIfInjected('admission');
      return reservationResult === 'duplicate' ? 'duplicate' : 'created';
    });
  }

  private ensureTask(task: AgentModeTask): AgentModeOperationResult {
    return this.createTask(task);
  }

  private ensureRun(run: AgentModeRun): AgentModeOperationResult {
    return this.createRun(run);
  }

  private ensureBudgetScope(budget: AgentModeBudgetLimits): void {
    const existing = this.database.prepare('SELECT * FROM budget_scopes WHERE budget_scope_id = ?').get(budget.budgetScopeId) as Record<string, unknown> | undefined;
    if (existing) {
      if (Number(existing.max_steps) !== budget.maxSteps
        || Number(existing.max_tokens) !== budget.maxTokens
        || Number(existing.max_dollars) !== budget.maxDollars) {
        throw new Error(`budget scope conflict: ${budget.budgetScopeId}`);
      }
      return;
    }
    this.database.prepare(`
      INSERT INTO budget_scopes (
        budget_scope_id, max_steps, max_tokens, max_dollars
      ) VALUES (?, ?, ?, ?)
    `).run(budget.budgetScopeId, budget.maxSteps, budget.maxTokens, budget.maxDollars);
  }

  private reserveBudgetInternal(reservation: AgentModeBudgetReservation): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT * FROM budget_reservations WHERE reservation_id = ?').get(reservation.reservationId) as Record<string, unknown> | undefined;
    if (existing) {
      const same = existing.budget_scope_id === reservation.budgetScopeId
        && existing.attempt_id === reservation.attemptId
        && Number(existing.steps) === reservation.steps
        && Number(existing.tokens) === reservation.tokens
        && Number(existing.dollars) === reservation.dollars;
      return same ? 'duplicate' : 'conflict';
    }
    const result = this.database.prepare(`
      UPDATE budget_scopes SET
        reserved_steps = reserved_steps + ?,
        reserved_tokens = reserved_tokens + ?,
        reserved_dollars = reserved_dollars + ?
      WHERE budget_scope_id = ?
        AND used_steps + reserved_steps + ? <= max_steps
        AND used_tokens + reserved_tokens + ? <= max_tokens
        AND used_dollars + reserved_dollars + ? <= max_dollars
    `).run(
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      reservation.budgetScopeId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
    );
    if (result.changes !== 1) throw new Error(`budget exhausted for ${reservation.budgetScopeId}`);
    this.database.prepare(`
      INSERT INTO budget_reservations (
        reservation_id, budget_scope_id, attempt_id, steps, tokens, dollars,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)
    `).run(
      reservation.reservationId,
      reservation.budgetScopeId,
      reservation.attemptId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      reservation.createdAt,
    );
    return 'created';
  }

  reserveBudget(reservation: AgentModeBudgetReservation, budget: AgentModeBudgetLimits): AgentModeOperationResult {
    return this.withTransaction(() => {
      this.ensureBudgetScope(budget);
      const result = this.reserveBudgetInternal(reservation);
      return result;
    });
  }

  prepareOperation(operation: Omit<AgentModePreparedOperation, 'preparedAt'> & { preparedAt?: string }): AgentModeOperationResult {
    const preparedAt = operation.preparedAt ?? new Date().toISOString();
    return this.withTransaction(() => {
      const attempt = this.getAttempt(operation.attemptId);
      if (!attempt) throw new Error(`attempt not found: ${operation.attemptId}`);
      if (attempt.cancellationStatus !== 'running') throw new Error(`cancellation requested for attempt ${operation.attemptId}`);
      if (attempt.status === 'paused') throw new Error(`run paused for attempt ${operation.attemptId}`);
      const existing = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operation.operationId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.attempt_id === operation.attemptId
          && existing.effect_kind === operation.effectKind
          && existing.scope_hash === operation.scopeHash
          && existing.capability_id === operation.capabilityId
          && existing.grant_id === (operation.grantId ?? null)
          && existing.policy_version === operation.policyVersion
          && existing.deadline === operation.deadline
          && existing.lease_resource_key === (operation.leaseResourceKey ?? null)
          && existing.lease_id === (operation.leaseId ?? null)
          && existing.lease_fence === (operation.leaseFence ?? null);
        return same ? 'duplicate' : 'conflict';
      }
      if (operation.leaseFence !== undefined) {
        this.assertCurrentLease(operation.attemptId, operation.leaseResourceKey, operation.leaseId, operation.leaseFence, preparedAt);
      } else if (attempt.leaseId) {
        throw new Error('operation missing attempt lease fence');
      }
      this.database.prepare(`
        INSERT INTO effects (
          operation_id, attempt_id, effect_kind, scope_hash, status, receipt_json,
          capability_id, grant_id, policy_version, lease_resource_key, lease_id, lease_fence,
          deadline, prepared_at
        ) VALUES (?, ?, ?, ?, 'prepared', NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        operation.operationId,
        operation.attemptId,
        operation.effectKind,
        operation.scopeHash,
        operation.capabilityId,
        operation.grantId ?? null,
        operation.policyVersion,
        operation.leaseResourceKey ?? null,
        operation.leaseId ?? null,
        operation.leaseFence ?? null,
        operation.deadline,
        preparedAt,
      );
      this.database.prepare(`
        INSERT INTO dispatch_outbox (
          operation_id, attempt_id, effect_kind, capability_id, grant_id, scope_hash,
          policy_version, lease_resource_key, lease_id, lease_fence, deadline,
          state, prepared_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dispatchable', ?)
      `).run(
        operation.operationId,
        operation.attemptId,
        operation.effectKind,
        operation.capabilityId,
        operation.grantId ?? null,
        operation.scopeHash,
        operation.policyVersion,
        operation.leaseResourceKey ?? null,
        operation.leaseId ?? null,
        operation.leaseFence ?? null,
        operation.deadline,
        preparedAt,
      );
      this.appendEventIfAbsent({
        eventId: `operation-prepared:${operation.operationId}`,
        entityType: 'operation',
        entityId: operation.operationId,
        eventType: 'operation_prepared',
        occurredAt: preparedAt,
        payload: { attemptId: operation.attemptId, scopeHash: operation.scopeHash },
      });
      this.failIfInjected('effect-preparation');
      return 'created';
    });
  }

  getOutbox(operationId: string): AgentModeDispatchOutbox | undefined {
    const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      capabilityId: String(row.capability_id),
      ...(row.grant_id === null ? {} : { grantId: String(row.grant_id) }),
      scopeHash: String(row.scope_hash),
      policyVersion: String(row.policy_version),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      deadline: String(row.deadline),
      state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at),
      ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
    };
  }

  listOutbox(): AgentModeDispatchOutbox[] {
    const rows = this.database.prepare('SELECT * FROM dispatch_outbox ORDER BY prepared_at, operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      capabilityId: String(row.capability_id),
      ...(row.grant_id === null ? {} : { grantId: String(row.grant_id) }),
      scopeHash: String(row.scope_hash),
      policyVersion: String(row.policy_version),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      deadline: String(row.deadline),
      state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at),
      ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
    }));
  }

  markDispatched(operationId: string, now: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      if (row.state === 'dispatched' || row.state === 'effect_applied' || row.state === 'receipt_recorded' || row.state === 'verified' || row.state === 'failed' || row.state === 'uncertain') return 'duplicate';
      const attempt = this.getAttempt(String(row.attempt_id));
      if (attempt?.cancellationStatus !== 'running') throw new Error(`cancellation requested for attempt ${String(row.attempt_id)}`);
      if (attempt?.status === 'paused') throw new Error(`run paused for attempt ${String(row.attempt_id)}`);
      this.assertCurrentLease(
        String(row.attempt_id),
        row.lease_resource_key === null ? undefined : String(row.lease_resource_key),
        row.lease_id === null ? undefined : String(row.lease_id),
        row.lease_fence === null ? undefined : Number(row.lease_fence),
        now,
      );
      this.database.prepare("UPDATE dispatch_outbox SET state = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND state = 'dispatchable'").run(now, operationId);
      this.database.prepare("UPDATE effects SET status = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND status = 'prepared'").run(now, operationId);
      this.appendEventIfAbsent({
        eventId: `operation-dispatched:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'operation_dispatched',
        occurredAt: now,
        payload: { attemptId: String(row.attempt_id) },
      });
      return 'created';
    });
  }

  markEffectObserved(operationId: string, now: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT attempt_id, status FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      if (row.status === 'effect_applied' || row.status === 'receipt_recorded' || row.status === 'succeeded' || row.status === 'failed' || row.status === 'uncertain') return 'duplicate';
      this.database.prepare("UPDATE effects SET status = 'effect_applied', observed_at = ? WHERE operation_id = ?").run(now, operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'effect_applied' WHERE operation_id = ?").run(operationId);
      this.appendEventIfAbsent({
        eventId: `effect-observed:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'effect_observed_without_receipt',
        occurredAt: now,
        payload: { attemptId: String(row.attempt_id) },
      });
      return 'created';
    });
  }

  markOperationVerified(operationId: string, verification: AgentModeVerification): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT attempt_id, status FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      const outbox = this.database.prepare('SELECT state FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as { state?: string } | undefined;
      if (row.status !== 'receipt_recorded' && row.status !== 'succeeded') throw new Error(`operation is not receipt-recorded: ${operationId}`);
      if (row.status === 'succeeded' && outbox?.state === 'verified') return 'duplicate';
      this.database.prepare("UPDATE effects SET status = 'succeeded' WHERE operation_id = ?").run(operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'verified' WHERE operation_id = ?").run(operationId);
      this.appendEventIfAbsent({
        eventId: `operation-verified:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'operation_verified',
        occurredAt: verification.verifiedAt,
        payload: {
          attemptId: String(row.attempt_id),
          resultHash: verification.resultHash,
          evidenceRef: verification.evidenceRef,
        },
      });
      return 'created';
    });
  }

  private assertCurrentLease(attemptId: string, resourceKey: string | undefined, leaseId: string | undefined, fence: number | undefined, now: string): void {
    if (!resourceKey || !leaseId || fence === undefined) throw new Error('stale lease fence: incomplete lease identity');
    const attempt = this.getAttempt(attemptId);
    const lease = this.database.prepare('SELECT lease_id, owner_id, fence, expires_at FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
    if (!attempt || attempt.leaseResourceKey !== resourceKey || attempt.leaseId !== leaseId || attempt.leaseFence !== fence
      || !lease || lease.lease_id !== leaseId || Number(lease.fence) !== fence || lease.owner_id !== attempt.leaseOwnerId
      || String(lease.expires_at) <= now) {
      throw new Error(`stale lease fence for attempt ${attemptId}`);
    }
  }

  private isCurrentLeaseForAttempt(attemptId: string, now: string): boolean {
    const attempt = this.getAttempt(attemptId);
    if (!attempt?.leaseResourceKey || !attempt.leaseId || attempt.leaseFence === undefined) return true;
    const lease = this.database.prepare('SELECT lease_id, owner_id, fence, expires_at FROM leases WHERE resource_key = ?').get(attempt.leaseResourceKey) as Record<string, unknown> | undefined;
    return Boolean(lease)
      && lease?.lease_id === attempt.leaseId
      && lease?.owner_id === attempt.leaseOwnerId
      && Number(lease?.fence) === attempt.leaseFence
      && String(lease?.expires_at) > now;
  }

  isCurrentLease(attemptId: string, resourceKey: string, leaseId: string, fence: number, now: string): boolean {
    return this.isCurrentLeaseForAttempt(attemptId, now)
      && (() => {
        try {
          this.assertCurrentLease(attemptId, resourceKey, leaseId, fence, now);
          return true;
        } catch {
          return false;
        }
      })();
  }

  private settleBudgetInternal(settlement: AgentModeBudgetSettlement): AgentModeOperationResult {
    const reservation = this.getReservation(settlement.reservationId);
    if (!reservation) throw new Error(`reservation not found: ${settlement.reservationId}`);
    if (reservation.status === 'settled') {
      const same = reservation.settledSteps === settlement.steps
        && reservation.settledTokens === settlement.tokens
        && reservation.settledDollars === settlement.dollars;
      return same ? 'duplicate' : 'conflict';
    }
    if ([settlement.steps, settlement.tokens, settlement.dollars].some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error('invalid budget settlement');
    }
    const result = this.database.prepare(`
      UPDATE budget_scopes SET
        reserved_steps = reserved_steps - ?,
        used_steps = used_steps + ?,
        reserved_tokens = reserved_tokens - ?,
        used_tokens = used_tokens + ?,
        reserved_dollars = reserved_dollars - ?,
        used_dollars = used_dollars + ?
      WHERE budget_scope_id = ?
        AND reserved_steps >= ?
        AND reserved_tokens >= ?
        AND reserved_dollars >= ?
        AND used_steps + ? <= max_steps
        AND used_tokens + ? <= max_tokens
        AND used_dollars + ? <= max_dollars
    `).run(
      reservation.steps,
      settlement.steps,
      reservation.tokens,
      settlement.tokens,
      reservation.dollars,
      settlement.dollars,
      reservation.budgetScopeId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      settlement.steps,
      settlement.tokens,
      settlement.dollars,
    );
    if (result.changes !== 1) throw new Error(`invalid budget settlement for ${settlement.reservationId}`);
    this.database.prepare(`
      UPDATE budget_reservations SET
        status = 'settled', settled_at = ?, settled_steps = ?, settled_tokens = ?, settled_dollars = ?
      WHERE reservation_id = ? AND status = 'reserved'
    `).run(settlement.settledAt, settlement.steps, settlement.tokens, settlement.dollars, settlement.reservationId);
    this.appendEventIfAbsent({
      eventId: `budget-settled:${settlement.reservationId}`,
      entityType: 'budget_reservation',
      entityId: settlement.reservationId,
      eventType: 'budget_settled',
      occurredAt: settlement.settledAt,
      payload: {
        attemptId: reservation.attemptId,
        steps: settlement.steps,
        tokens: settlement.tokens,
        dollars: settlement.dollars,
      },
    });
    this.failIfInjected('budget-settlement');
    return 'created';
  }

  settleBudget(settlement: AgentModeBudgetSettlement): AgentModeOperationResult {
    return this.withTransaction(() => this.settleBudgetInternal(settlement));
  }

  createWorkcell(workcell: AgentModeWorkcell, receipt: AgentModeWorkcellReceipt): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM workcells WHERE workcell_id = ?').get(workcell.workcellId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_id === workcell.taskId
          && existing.run_id === workcell.runId
          && existing.attempt_id === workcell.attemptId
          && existing.repository_ref === workcell.repositoryRef
          && existing.repository_root === workcell.repositoryRoot
          && existing.worktree_path === workcell.worktreePath
          && existing.branch === workcell.branch
          && existing.owner_agent === workcell.ownerAgent
          && existing.base_ref === workcell.baseRef
          && existing.created_at === workcell.createdAt;
        if (!same) return 'conflict';
        this.recordWorkcellReceiptInternal(receipt);
        return 'duplicate';
      }
      this.database.prepare(`
        INSERT INTO workcells (
          workcell_id, task_id, run_id, attempt_id, repository_ref, repository_root,
          worktree_path, branch, owner_agent, base_ref, created_at, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        workcell.workcellId,
        workcell.taskId,
        workcell.runId,
        workcell.attemptId,
        workcell.repositoryRef,
        workcell.repositoryRoot,
        workcell.worktreePath,
        workcell.branch,
        workcell.ownerAgent,
        workcell.baseRef,
        workcell.createdAt,
        workcell.updatedAt,
        workcell.status,
      );
      this.recordWorkcellReceiptInternal(receipt);
      this.appendEventIfAbsent({
        eventId: `workcell-created:${workcell.workcellId}`,
        entityType: 'workcell',
        entityId: workcell.workcellId,
        eventType: 'workcell_created',
        occurredAt: workcell.createdAt,
        payload: { taskId: workcell.taskId, runId: workcell.runId, attemptId: workcell.attemptId, repositoryRef: workcell.repositoryRef, ownerAgent: workcell.ownerAgent },
      });
      return 'created';
    });
  }

  getWorkcell(workcellId: string): AgentModeWorkcell | undefined {
    if (!this.hasWorkcellTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcells WHERE workcell_id = ?').get(workcellId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapWorkcell(row);
  }

  listWorkcells(): AgentModeWorkcell[] {
    if (!this.hasWorkcellTables) return [];
    const rows = this.database.prepare('SELECT * FROM workcells ORDER BY created_at, workcell_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapWorkcell(row));
  }

  updateWorkcellStatus(
    workcellId: string,
    status: AgentModeWorkcellStatus,
    updatedAt: string,
    expectedStatus: AgentModeWorkcellStatus,
    receipt: AgentModeWorkcellReceipt,
  ): AgentModeOperationResult {
    return this.withTransaction(() => {
      const current = this.getWorkcell(workcellId);
      if (!current) throw new Error(`workcell not found: ${workcellId}`);
      if (current.status !== expectedStatus) return current.status === status ? 'duplicate' : 'conflict';
      this.database.prepare('UPDATE workcells SET status = ?, updated_at = ? WHERE workcell_id = ? AND status = ?')
        .run(status, updatedAt, workcellId, expectedStatus);
      this.recordWorkcellReceiptInternal(receipt);
      this.appendEventIfAbsent({
        eventId: `workcell-${receipt.operation}:${workcellId}:${receipt.operationHash}`,
        entityType: 'workcell',
        entityId: workcellId,
        eventType: `workcell_${receipt.operation}`,
        occurredAt: updatedAt,
        payload: { status, actor: receipt.actor, operationHash: receipt.operationHash },
      });
      return 'created';
    });
  }

  recordWorkcellReceipt(receipt: AgentModeWorkcellReceipt): AgentModeOperationResult {
    return this.withTransaction(() => this.recordWorkcellReceiptInternal(receipt));
  }

  private recordWorkcellReceiptInternal(receipt: AgentModeWorkcellReceipt): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    const serialized = JSON.stringify(receipt);
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`workcell receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    if (!this.getWorkcell(receipt.workcellId)) throw new Error(`workcell not found: ${receipt.workcellId}`);
    this.database.prepare(`
      INSERT INTO workcell_receipts (
        receipt_id, workcell_id, receipt_type, task_id, run_id, attempt_id,
        repository_ref, actor, timestamp, operation_hash, operation, result_state, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      receipt.receiptId,
      receipt.workcellId,
      receipt.receiptType,
      receipt.taskId,
      receipt.runId,
      receipt.attemptId,
      receipt.repositoryRef,
      receipt.actor,
      receipt.timestamp,
      receipt.operationHash,
      receipt.operation,
      receipt.resultState,
      serialized,
    );
    return 'created';
  }

  listWorkcellReceipts(workcellId: string): AgentModeWorkcellReceipt[] {
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_receipts WHERE workcell_id = ? ORDER BY timestamp, receipt_id').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWorkcellReceipt);
  }

  private mapWorkcell(row: Record<string, unknown>): AgentModeWorkcell {
    return {
      workcellId: String(row.workcell_id),
      taskId: String(row.task_id),
      runId: String(row.run_id),
      attemptId: String(row.attempt_id),
      repositoryRef: String(row.repository_ref),
      repositoryRoot: String(row.repository_root),
      worktreePath: String(row.worktree_path),
      branch: String(row.branch),
      ownerAgent: String(row.owner_agent),
      baseRef: String(row.base_ref),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      status: row.status as AgentModeWorkcellStatus,
    };
  }

  getWorkcellWriterLease(leaseId: string): AgentModeWriterLease | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_writer_leases WHERE lease_id = ?').get(leaseId) as Record<string, unknown> | undefined;
    return row ? this.mapWriterLease(row) : undefined;
  }

  listWorkcellWriterLeases(workcellId: string): AgentModeWriterLease[] {
    if (!this.hasWriterTables) return [];
    const rows = this.database.prepare('SELECT * FROM workcell_writer_leases WHERE workcell_id = ? ORDER BY fence_token, lease_id').all(workcellId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapWriterLease(row));
  }

  grantWorkcellWriterLease(input: {
    leaseId: string;
    workcellId: string;
    ownerAgent: string;
    ownerAttempt: string;
    createdAt: string;
    expiresAt: string;
  }): { result: 'granted' | 'duplicate' | 'rejected'; lease?: AgentModeWriterLease; receipt: AgentModeWriterReceipt; reason?: string } {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${input.workcellId}`);
      const existing = this.getWorkcellWriterLease(input.leaseId);
      if (existing) {
        const same = existing.workcellId === input.workcellId
          && existing.ownerAgent === input.ownerAgent
          && existing.ownerAttempt === input.ownerAttempt
          && existing.createdAt === input.createdAt
          && existing.expiresAt === input.expiresAt;
        if (!same) throw new Error(`writer lease conflict: ${input.leaseId}`);
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseGrantedReceipt', 'grant', input.createdAt, existing.status, existing.leaseId, existing.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'duplicate', lease: existing, receipt };
      }
      if (!['prepared', 'active', 'testing'].includes(workcell.status)) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'lease-grant', input.createdAt, 'workcell_state_rejected', null, null, { requestedLeaseId: input.leaseId });
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', receipt, reason: `workcell state does not allow writing: ${workcell.status}` };
      }
      const active = this.database.prepare("SELECT * FROM workcell_writer_leases WHERE workcell_id = ? AND status = 'active'").get(input.workcellId) as Record<string, unknown> | undefined;
      if (active && Date.parse(String(active.expires_at)) > Date.parse(input.createdAt)) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'lease-grant', input.createdAt, 'active_writer_exists', String(active.lease_id), Number(active.fence_token), { requestedLeaseId: input.leaseId });
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', receipt, reason: 'an active writer lease already exists' };
      }
      if (active) {
        this.database.prepare("UPDATE workcell_writer_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(String(active.lease_id));
        const expiryReceipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'expire', input.createdAt, 'expired', String(active.lease_id), Number(active.fence_token));
        this.recordWriterReceiptInternal(expiryReceipt);
        this.appendEventIfAbsent({ eventId: `writer-lease-expired:${active.lease_id}`, entityType: 'workcell_writer_lease', entityId: String(active.lease_id), eventType: 'writer_lease_expired', occurredAt: input.createdAt, payload: { workcellId: input.workcellId, fenceToken: Number(active.fence_token) } });
      }
      const maxFence = this.database.prepare('SELECT COALESCE(MAX(fence_token), 0) AS max_fence FROM workcell_writer_leases WHERE workcell_id = ?').get(input.workcellId) as { max_fence?: number };
      const fenceToken = Number(maxFence.max_fence ?? 0) + 1;
      const lease: AgentModeWriterLease = { ...input, fenceToken, status: 'active' };
      this.database.prepare(`
        INSERT INTO workcell_writer_leases (
          lease_id, workcell_id, owner_agent, owner_attempt, created_at, expires_at, fence_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(lease.leaseId, lease.workcellId, lease.ownerAgent, lease.ownerAttempt, lease.createdAt, lease.expiresAt, lease.fenceToken);
      const receipt = makeWriterReceipt(workcell, 'WriterLeaseGrantedReceipt', 'grant', input.createdAt, 'active', lease.leaseId, lease.fenceToken);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `writer-lease-granted:${lease.leaseId}`, entityType: 'workcell_writer_lease', entityId: lease.leaseId, eventType: 'writer_lease_granted', occurredAt: input.createdAt, payload: { workcellId: lease.workcellId, ownerAgent: lease.ownerAgent, ownerAttempt: lease.ownerAttempt, fenceToken: lease.fenceToken } });
      return { result: 'granted', lease, receipt };
    });
  }

  releaseWorkcellWriterLease(input: {
    leaseId: string;
    ownerAgent: string;
    ownerAttempt: string;
    releasedAt: string;
  }): { result: 'released' | 'duplicate' | 'rejected'; lease: AgentModeWriterLease; receipt: AgentModeWriterReceipt; reason?: string } {
    return this.withTransaction(() => {
      const lease = this.getWorkcellWriterLease(input.leaseId);
      if (!lease) throw new Error(`writer lease not found: ${input.leaseId}`);
      const workcell = this.getWorkcell(lease.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${lease.workcellId}`);
      if (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'lease-release', input.releasedAt, 'wrong_owner', lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', lease, receipt, reason: 'writer lease owner does not match' };
      }
      if (lease.status !== 'active') {
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'release', input.releasedAt, lease.status, lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'duplicate', lease, receipt };
      }
      if (Date.parse(lease.expiresAt) <= Date.parse(input.releasedAt)) {
        this.database.prepare("UPDATE workcell_writer_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(lease.leaseId);
        const expired = { ...lease, status: 'expired' as const };
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'expire', input.releasedAt, 'expired', lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        return { result: 'rejected', lease: expired, receipt, reason: 'writer lease expired' };
      }
      this.database.prepare("UPDATE workcell_writer_leases SET status = 'released' WHERE lease_id = ? AND status = 'active'").run(lease.leaseId);
      const released = { ...lease, status: 'released' as const };
      const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'release', input.releasedAt, 'released', lease.leaseId, lease.fenceToken);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `writer-lease-released:${lease.leaseId}`, entityType: 'workcell_writer_lease', entityId: lease.leaseId, eventType: 'writer_lease_released', occurredAt: input.releasedAt, payload: { workcellId: lease.workcellId, fenceToken: lease.fenceToken } });
      return { result: 'released', lease: released, receipt };
    });
  }

  expireWorkcellWriterLeases(now: string): AgentModeWriterLease[] {
    return this.withTransaction(() => {
      const rows = this.database.prepare("SELECT * FROM workcell_writer_leases WHERE status = 'active' AND expires_at <= ? ORDER BY workcell_id, fence_token").all(now) as Array<Record<string, unknown>>;
      const expired: AgentModeWriterLease[] = [];
      for (const row of rows) {
        const lease = this.mapWriterLease(row);
        const workcell = this.getWorkcell(lease.workcellId);
        if (!workcell) continue;
        this.database.prepare("UPDATE workcell_writer_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(lease.leaseId);
        const receipt = makeWriterReceipt(workcell, 'WriterLeaseReleasedReceipt', 'expire', now, 'expired', lease.leaseId, lease.fenceToken);
        this.recordWriterReceiptInternal(receipt);
        this.appendEventIfAbsent({ eventId: `writer-lease-expired:${lease.leaseId}`, entityType: 'workcell_writer_lease', entityId: lease.leaseId, eventType: 'writer_lease_expired', occurredAt: now, payload: { workcellId: lease.workcellId, fenceToken: lease.fenceToken } });
        expired.push({ ...lease, status: 'expired' });
      }
      return expired;
    });
  }

  admitWorkcellWrite(input: {
    workcellId: string;
    capability: string;
    ownerAgent: string;
    ownerAttempt: string;
    leaseId: string | null;
    fenceToken: number | null;
    repositoryRoot: string;
    worktreePath: string;
    now: string;
    resourceValid?: boolean;
  }): { ok: boolean; reason: string; operationHash: string; receipt?: AgentModeWriterReceipt } {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) return { ok: false, reason: 'workcell_not_found', operationHash: writerOperationHash(input) };
      const operationHash = writerOperationHash(input);
      let reason: string | undefined;
      if (input.capability !== 'repo.write(workcell)') reason = 'capability_not_admitted';
      else if (!['prepared', 'active', 'testing'].includes(workcell.status)) reason = 'workcell_state_does_not_allow_writing';
      else if (input.repositoryRoot !== workcell.repositoryRoot || input.worktreePath !== workcell.worktreePath || input.worktreePath === input.repositoryRoot || input.resourceValid === false) reason = 'resource_binding_mismatch';
      const lease = input.leaseId ? this.getWorkcellWriterLease(input.leaseId) : undefined;
      if (!reason && (!lease || lease.workcellId !== workcell.workcellId)) reason = 'lease_missing';
      if (!reason && lease && lease.status !== 'active') reason = `lease_${lease.status}`;
      if (!reason && lease && Date.parse(lease.expiresAt) <= Date.parse(input.now)) reason = 'lease_expired';
      if (!reason && lease && (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt)) reason = 'wrong_owner';
      if (!reason && lease && lease.fenceToken !== input.fenceToken) reason = 'stale_fence_token';
      if (reason) {
        const receipt = makeWriterReceipt(workcell, 'WriteRejectedReceipt', 'write-admission', input.now, reason, input.leaseId, input.fenceToken, { operationHash });
        this.recordWriterReceiptInternal(receipt);
        this.appendEventIfAbsent({ eventId: `write-rejected:${operationHash}`, entityType: 'workcell', entityId: workcell.workcellId, eventType: 'workcell_write_rejected', occurredAt: input.now, payload: { reason, operationHash, leaseId: input.leaseId, fenceToken: input.fenceToken } });
        return { ok: false, reason, operationHash, receipt };
      }
      this.appendEventIfAbsent({ eventId: `write-admitted:${operationHash}`, entityType: 'workcell', entityId: workcell.workcellId, eventType: 'workcell_write_admitted', occurredAt: input.now, payload: { operationHash, leaseId: input.leaseId, fenceToken: input.fenceToken } });
      return { ok: true, reason: 'writer lease and Workcell capability admitted', operationHash };
    });
  }

  prepareWorkcellMutation(input: {
    operationId: string;
    workcellId: string;
    capability: string;
    ownerAgent: string;
    ownerAttempt: string;
    leaseId: string;
    fenceToken: number;
    repositoryRoot: string;
    worktreePath: string;
    resourceValid: boolean;
    relativePath: string;
    expectedPreimageHash: string;
    replacementHash: string;
    operationHash: string;
    preparedAt: string;
  }): { result: 'prepared' | 'duplicate' | 'conflict' | 'rejected'; mutation?: AgentModeWorkcellMutation; receipt?: AgentModeWorkcellWriteReceipt; reason?: string } {
    return this.withTransaction(() => {
      const existing = this.getWorkcellMutation(input.operationId);
      if (existing) {
        if (existing.operationHash !== input.operationHash) {
          return { result: 'conflict', mutation: existing, reason: 'operation_id_reused_for_different_mutation' };
        }
        return { result: 'duplicate', mutation: existing };
      }
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${input.workcellId}`);
      const lease = this.getWorkcellWriterLease(input.leaseId);
      let reason: string | undefined;
      if (input.capability !== 'repo.write(workcell)') reason = 'capability_not_admitted';
      else if (!['prepared', 'active', 'testing'].includes(workcell.status)) reason = 'workcell_state_does_not_allow_writing';
      else if (input.repositoryRoot !== workcell.repositoryRoot || input.worktreePath !== workcell.worktreePath || input.worktreePath === input.repositoryRoot || !input.resourceValid) reason = 'resource_binding_mismatch';
      else if (!lease || lease.workcellId !== workcell.workcellId) reason = 'lease_missing';
      else if (lease.status !== 'active') reason = `lease_${lease.status}`;
      else if (Date.parse(lease.expiresAt) <= Date.parse(input.preparedAt)) reason = 'lease_expired';
      else if (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt) reason = 'wrong_owner';
      else if (lease.fenceToken !== input.fenceToken) reason = 'stale_fence_token';

      const baseMutation: AgentModeWorkcellMutation = {
        operationId: input.operationId,
        taskId: workcell.taskId,
        runId: workcell.runId,
        attemptId: workcell.attemptId,
        workcellId: workcell.workcellId,
        repositoryRef: workcell.repositoryRef,
        relativePath: input.relativePath,
        leaseId: input.leaseId,
        fenceToken: input.fenceToken,
        expectedPreimageHash: input.expectedPreimageHash,
        preimageState: 'present',
        preimageHash: undefined,
        replacementHash: input.replacementHash,
        postimageHash: undefined,
        operationHash: input.operationHash,
        status: reason ? 'rejected' : 'prepared',
        createdAt: input.preparedAt,
        updatedAt: input.preparedAt,
      };
      this.insertWorkcellMutation(baseMutation);
      if (reason) {
        const receipt = makeWorkcellWriteReceipt(workcell, {
          operationId: input.operationId,
          leaseId: input.leaseId,
          fenceToken: input.fenceToken,
          relativePath: input.relativePath,
          preimageHash: input.expectedPreimageHash,
          postimageHash: null,
          timestamp: input.preparedAt,
          result: reason,
          operationHash: input.operationHash,
        }, 'WorkcellWriteRejectedReceipt');
        this.recordWorkcellWriteReceiptInternal(receipt, 'rejected');
        this.appendEventIfAbsent({ eventId: `workcell-file-rejected:${input.operationId}:${input.operationHash}`, entityType: 'workcell_file_mutation', entityId: input.operationId, eventType: 'workcell_file_write_rejected', occurredAt: input.preparedAt, payload: { workcellId: workcell.workcellId, relativePath: input.relativePath, reason, operationHash: input.operationHash } });
        return { result: 'rejected', mutation: baseMutation, receipt, reason };
      }
      this.appendEventIfAbsent({ eventId: `workcell-file-prepared:${input.operationId}`, entityType: 'workcell_file_mutation', entityId: input.operationId, eventType: 'workcell_file_write_prepared', occurredAt: input.preparedAt, payload: { workcellId: workcell.workcellId, relativePath: input.relativePath, leaseId: input.leaseId, fenceToken: input.fenceToken, operationHash: input.operationHash } });
      return { result: 'prepared', mutation: baseMutation };
    });
  }

  getWorkcellMutation(operationId: string): AgentModeWorkcellMutation | undefined {
    if (!this.hasMutationTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_file_mutations WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    return row ? this.mapWorkcellMutation(row) : undefined;
  }

  listWorkcellMutations(workcellId?: string): AgentModeWorkcellMutation[] {
    if (!this.hasMutationTables) return [];
    const rows = (workcellId
      ? this.database.prepare('SELECT * FROM workcell_file_mutations WHERE workcell_id = ? ORDER BY created_at, operation_id').all(workcellId)
      : this.database.prepare('SELECT * FROM workcell_file_mutations ORDER BY created_at, operation_id').all()) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapWorkcellMutation(row));
  }

  markWorkcellMutationPreimage(operationId: string, preimageHash: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
      if (mutation.preimageHash === preimageHash && mutation.status !== 'rejected') return 'duplicate';
      if (mutation.status !== 'prepared' || mutation.expectedPreimageHash !== preimageHash) return 'conflict';
      this.database.prepare("UPDATE workcell_file_mutations SET preimage_hash = ?, status = 'preimage_verified', updated_at = ? WHERE operation_id = ? AND status = 'prepared'").run(preimageHash, updatedAt, operationId);
      return 'created';
    });
  }

  markWorkcellMutationTempPrepared(operationId: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
      if (mutation.status === 'temp_prepared') return 'duplicate';
      if (mutation.status !== 'preimage_verified') return 'conflict';
      this.database.prepare("UPDATE workcell_file_mutations SET status = 'temp_prepared', updated_at = ? WHERE operation_id = ? AND status = 'preimage_verified'").run(updatedAt, operationId);
      return 'created';
    });
  }

  markWorkcellMutationEffectApplied(operationId: string, postimageHash: string, updatedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
      if (mutation.postimageHash === postimageHash && mutation.status === 'effect_applied') return 'duplicate';
      if (!['preimage_verified', 'temp_prepared'].includes(mutation.status)) return 'conflict';
      this.database.prepare("UPDATE workcell_file_mutations SET postimage_hash = ?, status = 'effect_applied', updated_at = ? WHERE operation_id = ? AND status IN ('preimage_verified', 'temp_prepared')").run(postimageHash, updatedAt, operationId);
      return 'created';
    });
  }

  validateWorkcellMutationLease(operationId: string, now: string): { ok: boolean; reason?: string } {
    return this.withTransaction(() => {
      const mutation = this.getWorkcellMutation(operationId);
      if (!mutation) return { ok: false, reason: 'mutation_not_found' };
      const workcell = this.getWorkcell(mutation.workcellId);
      if (!workcell || !['prepared', 'active', 'testing'].includes(workcell.status)) return { ok: false, reason: 'workcell_state_does_not_allow_writing' };
      const lease = this.getWorkcellWriterLease(mutation.leaseId);
      if (!lease || lease.workcellId !== mutation.workcellId) return { ok: false, reason: 'lease_missing' };
      if (lease.status !== 'active') return { ok: false, reason: `lease_${lease.status}` };
      if (Date.parse(lease.expiresAt) <= Date.parse(now)) return { ok: false, reason: 'lease_expired' };
      if (lease.fenceToken !== mutation.fenceToken) return { ok: false, reason: 'stale_fence_token' };
      return { ok: true };
    });
  }

  recordWorkcellWriteReceipt(receipt: AgentModeWorkcellWriteReceipt, status: 'receipt_recorded' | 'reconciled' | 'rejected' = 'receipt_recorded'): AgentModeOperationResult {
    return this.withTransaction(() => this.recordWorkcellWriteReceiptInternal(receipt, status));
  }

  getWorkcellWriteReceipt(operationId: string): AgentModeWorkcellWriteReceipt | undefined {
    if (!this.hasMutationTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM workcell_write_receipts WHERE operation_id = ? ORDER BY timestamp, receipt_id LIMIT 1').get(operationId) as { receipt_json?: string } | undefined;
    return row ? JSON.parse(String(row.receipt_json)) as AgentModeWorkcellWriteReceipt : undefined;
  }

  listWorkcellWriteReceipts(workcellId: string): AgentModeWorkcellWriteReceipt[] {
    if (!this.hasMutationTables) return [];
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_write_receipts WHERE workcell_id = ? ORDER BY timestamp, receipt_id').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWorkcellWriteReceipt);
  }

  private recordWorkcellWriteReceiptInternal(receipt: AgentModeWorkcellWriteReceipt, status: 'receipt_recorded' | 'reconciled' | 'rejected'): AgentModeOperationResult {
    const mutation = this.getWorkcellMutation(receipt.operationId);
    if (!mutation) throw new Error(`workcell mutation not found: ${receipt.operationId}`);
    if (mutation.operationHash !== receipt.operationHash || mutation.relativePath !== receipt.relativePath || mutation.leaseId !== receipt.leaseId || mutation.fenceToken !== receipt.fenceToken) throw new Error(`workcell write receipt conflicts with mutation: ${receipt.operationId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_write_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`workcell write receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO workcell_write_receipts (
        receipt_id, operation_id, task_id, run_id, attempt_id, workcell_id,
        lease_id, fence_token, repository_ref, relative_path, preimage_hash,
        postimage_hash, timestamp, result, operation_hash, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.operationId, receipt.taskId, receipt.runId, receipt.attemptId, receipt.workcellId, receipt.leaseId, receipt.fenceToken, receipt.repositoryRef, receipt.relativePath, receipt.preimageHash, receipt.postimageHash, receipt.timestamp, receipt.result, receipt.operationHash, serialized);
    this.database.prepare('UPDATE workcell_file_mutations SET status = ?, updated_at = ?, postimage_hash = COALESCE(?, postimage_hash) WHERE operation_id = ?').run(status, receipt.timestamp, receipt.postimageHash, receipt.operationId);
    return 'created';
  }

  private insertWorkcellMutation(mutation: AgentModeWorkcellMutation): void {
    this.database.prepare(`
      INSERT INTO workcell_file_mutations (
        operation_id, task_id, run_id, attempt_id, workcell_id, repository_ref,
        relative_path, lease_id, fence_token, expected_preimage_hash,
        preimage_state, preimage_hash, replacement_hash, postimage_hash,
        operation_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mutation.operationId, mutation.taskId, mutation.runId, mutation.attemptId, mutation.workcellId, mutation.repositoryRef, mutation.relativePath, mutation.leaseId, mutation.fenceToken, mutation.expectedPreimageHash, mutation.preimageState, mutation.preimageHash ?? null, mutation.replacementHash, mutation.postimageHash ?? null, mutation.operationHash, mutation.status, mutation.createdAt, mutation.updatedAt);
  }

  private mapWorkcellMutation(row: Record<string, unknown>): AgentModeWorkcellMutation {
    return {
      operationId: String(row.operation_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), relativePath: String(row.relative_path), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), expectedPreimageHash: String(row.expected_preimage_hash), preimageState: row.preimage_state as 'present', preimageHash: row.preimage_hash == null ? undefined : String(row.preimage_hash), replacementHash: String(row.replacement_hash), postimageHash: row.postimage_hash == null ? undefined : String(row.postimage_hash), operationHash: String(row.operation_hash), status: row.status as AgentModeWorkcellMutationStatus, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  startWorkcellValidation(input: {
    validationId: string;
    workcellId: string;
    capability: string;
    ownerAgent: string;
    ownerAttempt: string;
    leaseId: string;
    fenceToken: number;
    repositoryRoot: string;
    worktreePath: string;
    resourceValid: boolean;
    validatorAllowed: boolean;
    validatorProfile: string;
    diffId: string | null;
    operationHash: string;
    startedAt: string;
  }): { result: 'started' | 'duplicate' | 'conflict' | 'rejected'; validation?: AgentModeWorkcellValidation; receipt?: AgentModeWorkcellValidationReceipt; reason?: string } {
    return this.withTransaction(() => {
      const existing = this.getWorkcellValidationRun(input.validationId);
      if (existing) {
        if (existing.operationHash !== input.operationHash) return { result: 'conflict', validation: existing, reason: 'validation_id_reused_for_different_request' };
        const receipt = this.getWorkcellValidationRunReceipt(input.validationId);
        return receipt ? { result: 'duplicate', validation: existing, receipt } : { result: 'duplicate', validation: existing };
      }
      const workcell = this.getWorkcell(input.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${input.workcellId}`);
      const lease = this.getWorkcellWriterLease(input.leaseId);
      const diff = input.diffId ? this.getWorkcellDiff(input.diffId) : undefined;
      let reason: string | undefined;
      if (input.capability !== 'validation.run(workcell)') reason = 'capability_not_admitted';
      else if (!input.validatorAllowed) reason = 'unknown_validator_profile';
      else if (!['prepared', 'active', 'testing'].includes(workcell.status)) reason = 'workcell_state_does_not_allow_validation';
      else if (input.repositoryRoot !== workcell.repositoryRoot || input.worktreePath !== workcell.worktreePath || input.worktreePath === input.repositoryRoot || !input.resourceValid) reason = 'resource_binding_mismatch';
      else if (!diff) reason = 'diff_evidence_missing';
      else if (diff.workcellId !== workcell.workcellId || diff.taskId !== workcell.taskId || diff.runId !== workcell.runId || diff.attemptId !== workcell.attemptId || diff.repositoryRef !== workcell.repositoryRef) reason = 'diff_evidence_lineage_mismatch';
      else if (!lease || lease.workcellId !== workcell.workcellId) reason = 'lease_missing';
      else if (lease.status !== 'active') reason = `lease_${lease.status}`;
      else if (Date.parse(lease.expiresAt) <= Date.parse(input.startedAt)) reason = 'lease_expired';
      else if (lease.ownerAgent !== input.ownerAgent || lease.ownerAttempt !== input.ownerAttempt) reason = 'wrong_owner';
      else if (lease.fenceToken !== input.fenceToken) reason = 'stale_fence_token';

      const validation: AgentModeWorkcellValidation = {
        validationId: input.validationId,
        taskId: workcell.taskId,
        runId: workcell.runId,
        attemptId: workcell.attemptId,
        workcellId: workcell.workcellId,
        repositoryRef: workcell.repositoryRef,
        validatorProfile: input.validatorProfile,
        diffId: input.diffId,
        leaseId: input.leaseId,
        fenceToken: input.fenceToken,
        operationHash: input.operationHash,
        status: reason ? 'rejected' : 'started',
        result: reason ? 'rejected' : 'started',
        evidenceHash: undefined,
        evidenceJson: undefined,
        startedAt: input.startedAt,
        completedAt: undefined,
        updatedAt: input.startedAt,
      };
      this.insertWorkcellValidation(validation);
      if (reason) {
        const receipt = makeValidationReceipt(validation, 'ValidationRejectedReceipt', input.startedAt, 'rejected');
        this.recordWorkcellValidationReceiptInternal(receipt, 'rejected');
        this.appendEventIfAbsent({ eventId: `workcell-validation-rejected:${input.validationId}`, entityType: 'workcell_validation', entityId: input.validationId, eventType: 'workcell_validation_rejected', occurredAt: input.startedAt, payload: { workcellId: workcell.workcellId, validatorProfile: input.validatorProfile, reason, operationHash: input.operationHash } });
        return { result: 'rejected', validation, receipt, reason };
      }
      const receipt = makeValidationReceipt(validation, 'ValidationStartedReceipt', input.startedAt, 'started');
      this.recordWorkcellValidationReceiptInternal(receipt, 'started');
      this.appendEventIfAbsent({ eventId: `workcell-validation-started:${input.validationId}`, entityType: 'workcell_validation', entityId: input.validationId, eventType: 'workcell_validation_started', occurredAt: input.startedAt, payload: { workcellId: workcell.workcellId, validatorProfile: input.validatorProfile, diffId: input.diffId, operationHash: input.operationHash } });
      return { result: 'started', validation, receipt };
    });
  }

  completeWorkcellValidation(input: { validationId: string; evidenceHash: string; evidenceJson: string; result: 'passed' | 'failed'; completedAt: string }): AgentModeOperationResult {
    return this.withTransaction(() => {
      const validation = this.getWorkcellValidationRun(input.validationId);
      if (!validation) throw new Error(`workcell validation not found: ${input.validationId}`);
      if (validation.status === 'completed') return validation.result === input.result && validation.evidenceHash === input.evidenceHash ? 'duplicate' : 'conflict';
      if (validation.status !== 'started') return 'conflict';
      const updated = { ...validation, status: 'completed' as const, result: input.result, evidenceHash: input.evidenceHash, evidenceJson: input.evidenceJson, completedAt: input.completedAt, updatedAt: input.completedAt };
      this.database.prepare("UPDATE workcell_validations SET status = 'completed', result = ?, evidence_hash = ?, evidence_json = ?, completed_at = ?, updated_at = ? WHERE validation_id = ? AND status = 'started'").run(input.result, input.evidenceHash, input.evidenceJson, input.completedAt, input.completedAt, input.validationId);
      const receipt = makeValidationReceipt(updated, 'ValidationCompletedReceipt', input.completedAt, input.result);
      this.recordWorkcellValidationReceiptInternal(receipt, 'completed');
      this.appendEventIfAbsent({ eventId: `workcell-validation-completed:${input.validationId}`, entityType: 'workcell_validation', entityId: input.validationId, eventType: 'workcell_validation_completed', occurredAt: input.completedAt, payload: { workcellId: validation.workcellId, validatorProfile: validation.validatorProfile, result: input.result, evidenceHash: input.evidenceHash } });
      return 'created';
    });
  }

  rejectWorkcellValidation(validationId: string, result: 'rejected' | 'timed_out' | 'interrupted', completedAt: string): { result: AgentModeOperationResult; validation: AgentModeWorkcellValidation; receipt: AgentModeWorkcellValidationReceipt } {
    return this.withTransaction(() => {
      const validation = this.getWorkcellValidationRun(validationId);
      if (!validation) throw new Error(`workcell validation not found: ${validationId}`);
      const existingReceipt = this.getWorkcellValidationRunReceipt(validationId);
      if (validation.status === 'rejected') {
        if (!existingReceipt) throw new Error(`rejected validation receipt is missing: ${validationId}`);
        return { result: 'duplicate', validation, receipt: existingReceipt };
      }
      if (validation.status === 'completed') throw new Error(`completed validation cannot be rejected: ${validationId}`);
      const updated = { ...validation, status: 'rejected' as const, result, updatedAt: completedAt, completedAt };
      this.database.prepare("UPDATE workcell_validations SET status = 'rejected', result = ?, completed_at = ?, updated_at = ? WHERE validation_id = ? AND status = 'started'").run(result, completedAt, completedAt, validationId);
      const receipt = makeValidationReceipt(updated, 'ValidationRejectedReceipt', completedAt, result);
      this.recordWorkcellValidationReceiptInternal(receipt, 'rejected');
      this.appendEventIfAbsent({ eventId: `workcell-validation-rejected:${validationId}:${result}`, entityType: 'workcell_validation', entityId: validationId, eventType: 'workcell_validation_rejected', occurredAt: completedAt, payload: { workcellId: validation.workcellId, validatorProfile: validation.validatorProfile, result } });
      return { result: 'created', validation: updated, receipt };
    });
  }

  getWorkcellValidationRun(validationId: string): AgentModeWorkcellValidation | undefined {
    if (!this.hasValidationTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_validations WHERE validation_id = ?').get(validationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { validationId: String(row.validation_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), validatorProfile: String(row.validator_profile), diffId: row.diff_id == null ? null : String(row.diff_id), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), operationHash: String(row.operation_hash), status: row.status as AgentModeWorkcellValidationStatus, result: row.result as AgentModeWorkcellValidationResult, evidenceHash: row.evidence_hash == null ? undefined : String(row.evidence_hash), evidenceJson: row.evidence_json == null ? undefined : String(row.evidence_json), startedAt: String(row.started_at), completedAt: row.completed_at == null ? undefined : String(row.completed_at), updatedAt: String(row.updated_at) };
  }

  listWorkcellValidationRuns(workcellId?: string): AgentModeWorkcellValidation[] {
    if (!this.hasValidationTables) return [];
    const rows = (workcellId
      ? this.database.prepare('SELECT * FROM workcell_validations WHERE workcell_id = ? ORDER BY started_at, validation_id').all(workcellId)
      : this.database.prepare('SELECT * FROM workcell_validations ORDER BY started_at, validation_id').all()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ validationId: String(row.validation_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), validatorProfile: String(row.validator_profile), diffId: row.diff_id == null ? null : String(row.diff_id), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), operationHash: String(row.operation_hash), status: row.status as AgentModeWorkcellValidationStatus, result: row.result as AgentModeWorkcellValidationResult, evidenceHash: row.evidence_hash == null ? undefined : String(row.evidence_hash), evidenceJson: row.evidence_json == null ? undefined : String(row.evidence_json), startedAt: String(row.started_at), completedAt: row.completed_at == null ? undefined : String(row.completed_at), updatedAt: String(row.updated_at) }));
  }

  getWorkcellValidationRunReceipt(validationId: string): AgentModeWorkcellValidationReceipt | undefined {
    if (!this.hasValidationTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM workcell_validation_receipts WHERE validation_id = ? ORDER BY rowid DESC LIMIT 1').get(validationId) as { receipt_json?: string } | undefined;
    return row ? JSON.parse(String(row.receipt_json)) as AgentModeWorkcellValidationReceipt : undefined;
  }

  listWorkcellValidationReceipts(workcellId: string): AgentModeWorkcellValidationReceipt[] {
    if (!this.hasValidationTables) return [];
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_validation_receipts WHERE workcell_id = ? ORDER BY rowid').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWorkcellValidationReceipt);
  }

  private insertWorkcellValidation(validation: AgentModeWorkcellValidation): void {
    this.database.prepare(`
      INSERT INTO workcell_validations (
        validation_id, task_id, run_id, attempt_id, workcell_id, repository_ref,
        validator_profile, diff_id, lease_id, fence_token, operation_hash,
        status, result, evidence_hash, evidence_json, started_at, completed_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(validation.validationId, validation.taskId, validation.runId, validation.attemptId, validation.workcellId, validation.repositoryRef, validation.validatorProfile, validation.diffId, validation.leaseId, validation.fenceToken, validation.operationHash, validation.status, validation.result, validation.evidenceHash ?? null, validation.evidenceJson ?? null, validation.startedAt, validation.completedAt ?? null, validation.updatedAt);
  }

  private recordWorkcellValidationReceiptInternal(receipt: AgentModeWorkcellValidationReceipt, status: 'started' | 'completed' | 'rejected'): AgentModeOperationResult {
    const validation = this.getWorkcellValidationRun(receipt.validationId);
    if (!validation) throw new Error(`workcell validation not found: ${receipt.validationId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_validation_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`validation receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO workcell_validation_receipts (
        receipt_id, validation_id, task_id, run_id, attempt_id, workcell_id,
        validator_profile, evidence_hash, timestamp, result, operation_hash,
        receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.validationId, receipt.taskId, receipt.runId, receipt.attemptId, receipt.workcellId, receipt.validatorProfile, receipt.evidenceHash, receipt.timestamp, receipt.result, receipt.operationHash, serialized);
    return 'created';
  }

  recordWorkcellDiff(diff: AgentModeWorkcellDiffEvidence, receipt: AgentModeWriterReceipt): AgentModeOperationResult {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(diff.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${diff.workcellId}`);
      if (diff.taskId !== workcell.taskId || diff.runId !== workcell.runId || diff.attemptId !== workcell.attemptId
        || diff.repositoryRef !== workcell.repositoryRef || diff.branch !== workcell.branch) throw new Error('diff evidence lineage conflicts with Workcell binding');
      const lease = this.getWorkcellWriterLease(diff.leaseId);
      if (!lease || lease.workcellId !== diff.workcellId || lease.status !== 'active' || lease.fenceToken !== diff.fenceToken) throw new Error('diff evidence writer lease is not current');
      const existing = this.database.prepare('SELECT * FROM workcell_diff_evidence WHERE diff_id = ?').get(diff.diffId) as Record<string, unknown> | undefined;
      if (existing) return String(existing.diff_hash) === diff.diffHash ? 'duplicate' : 'conflict';
      this.database.prepare(`
        INSERT INTO workcell_diff_evidence (
          diff_id, task_id, run_id, attempt_id, workcell_id, repository_ref, branch,
          base_revision, current_revision, changed_files_json, diff_hash, lease_id,
          fence_token, captured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(diff.diffId, diff.taskId, diff.runId, diff.attemptId, diff.workcellId, diff.repositoryRef, diff.branch, diff.baseRevision, diff.currentRevision, JSON.stringify(diff.changedFiles), diff.diffHash, diff.leaseId, diff.fenceToken, diff.capturedAt);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `diff-captured:${diff.diffId}`, entityType: 'workcell', entityId: diff.workcellId, eventType: 'workcell_diff_captured', occurredAt: diff.capturedAt, payload: { diffId: diff.diffId, diffHash: diff.diffHash, changedFileCount: diff.changedFiles.length, fenceToken: diff.fenceToken } });
      return 'created';
    });
  }

  getWorkcellDiff(diffId: string): AgentModeWorkcellDiffEvidence | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_diff_evidence WHERE diff_id = ?').get(diffId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      diffId: String(row.diff_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), branch: String(row.branch), baseRevision: String(row.base_revision), currentRevision: String(row.current_revision), changedFiles: JSON.parse(String(row.changed_files_json)) as string[], diffHash: String(row.diff_hash), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), capturedAt: String(row.captured_at),
    };
  }

  listWorkcellDiffs(workcellId?: string): AgentModeWorkcellDiffEvidence[] {
    if (!this.hasWriterTables) return [];
    const rows = (workcellId
      ? this.database.prepare('SELECT * FROM workcell_diff_evidence WHERE workcell_id = ? ORDER BY captured_at, diff_id').all(workcellId)
      : this.database.prepare('SELECT * FROM workcell_diff_evidence ORDER BY captured_at, diff_id').all()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      diffId: String(row.diff_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), repositoryRef: String(row.repository_ref), branch: String(row.branch), baseRevision: String(row.base_revision), currentRevision: String(row.current_revision), changedFiles: JSON.parse(String(row.changed_files_json)) as string[], diffHash: String(row.diff_hash), leaseId: String(row.lease_id), fenceToken: Number(row.fence_token), capturedAt: String(row.captured_at),
    }));
  }

  getLatestWorkcellDiff(workcellId: string): AgentModeWorkcellDiffEvidence | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT diff_id FROM workcell_diff_evidence WHERE workcell_id = ? ORDER BY captured_at DESC, diff_id DESC LIMIT 1').get(workcellId) as { diff_id?: string } | undefined;
    return row?.diff_id ? this.getWorkcellDiff(String(row.diff_id)) : undefined;
  }

  recordWorkcellValidation(validation: AgentModeWorkcellValidationEvidence, receipt: AgentModeWriterReceipt): AgentModeOperationResult {
    return this.withTransaction(() => {
      const workcell = this.getWorkcell(validation.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${validation.workcellId}`);
      if (validation.taskId !== workcell.taskId || validation.runId !== workcell.runId || validation.attemptId !== workcell.attemptId) throw new Error('validation evidence lineage conflicts with Workcell binding');
      const diff = this.getWorkcellDiff(validation.diffId);
      if (!diff || diff.workcellId !== validation.workcellId) throw new Error(`diff evidence not found: ${validation.diffId}`);
      const existing = this.database.prepare('SELECT * FROM workcell_validation_evidence WHERE validation_id = ?').get(validation.validationId) as Record<string, unknown> | undefined;
      if (existing) return existing.state === validation.state && existing.result === validation.result ? 'duplicate' : 'conflict';
      this.database.prepare(`
        INSERT INTO workcell_validation_evidence (
          validation_id, diff_id, task_id, run_id, attempt_id, workcell_id,
          requested_at, result, state, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(validation.validationId, validation.diffId, validation.taskId, validation.runId, validation.attemptId, validation.workcellId, validation.requestedAt, validation.result, validation.state, validation.recordedAt);
      this.recordWriterReceiptInternal(receipt);
      this.appendEventIfAbsent({ eventId: `validation-admitted:${validation.validationId}`, entityType: 'workcell', entityId: validation.workcellId, eventType: 'workcell_validation_admission', occurredAt: validation.recordedAt, payload: { validationId: validation.validationId, diffId: validation.diffId, result: validation.result, state: validation.state } });
      return 'created';
    });
  }

  getWorkcellValidation(validationId: string): AgentModeWorkcellValidationEvidence | undefined {
    if (!this.hasWriterTables) return undefined;
    const row = this.database.prepare('SELECT * FROM workcell_validation_evidence WHERE validation_id = ?').get(validationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { validationId: String(row.validation_id), diffId: String(row.diff_id), taskId: String(row.task_id), runId: String(row.run_id), attemptId: String(row.attempt_id), workcellId: String(row.workcell_id), requestedAt: String(row.requested_at), result: row.result as AgentModeWorkcellValidationEvidence['result'], state: row.state as AgentModeWorkcellValidationEvidence['state'], recordedAt: String(row.recorded_at) };
  }

  listWorkcellWriterReceipts(workcellId: string): AgentModeWriterReceipt[] {
    if (!this.hasWriterTables) return [];
    const rows = this.database.prepare('SELECT receipt_json FROM workcell_writer_receipts WHERE workcell_id = ? ORDER BY timestamp, receipt_id').all(workcellId) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeWriterReceipt);
  }

  private recordWriterReceiptInternal(receipt: AgentModeWriterReceipt): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT receipt_json FROM workcell_writer_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    const serialized = JSON.stringify(receipt);
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`writer receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO workcell_writer_receipts (
        receipt_id, workcell_id, receipt_type, task_id, run_id, attempt_id,
        lease_id, fence_token, timestamp, operation_hash, result_state, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.workcellId, receipt.receiptType, receipt.taskId, receipt.runId, receipt.attemptId, receipt.leaseId, receipt.fenceToken, receipt.timestamp, receipt.operationHash, receipt.resultState, serialized);
    return 'created';
  }

  private mapWriterLease(row: Record<string, unknown>): AgentModeWriterLease {
    return { leaseId: String(row.lease_id), workcellId: String(row.workcell_id), ownerAgent: String(row.owner_agent), ownerAttempt: String(row.owner_attempt), createdAt: String(row.created_at), expiresAt: String(row.expires_at), fenceToken: Number(row.fence_token), status: row.status as AgentModeWriterLeaseStatus };
  }

  getReceipt(operationId: string): AgentModeJournalReceipt | undefined {
    const row = this.database.prepare("SELECT * FROM receipts WHERE operation_id = ? AND state = 'accepted' ORDER BY recorded_at, receipt_id LIMIT 1").get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapReceipt(row);
  }

  listReceipts(operationId: string): AgentModeJournalReceipt[] {
    const rows = this.database.prepare('SELECT * FROM receipts WHERE operation_id = ? ORDER BY recorded_at, receipt_id').all(operationId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapReceipt(row));
  }

  private mapReceipt(row: Record<string, unknown>): AgentModeJournalReceipt {
    const receipt = JSON.parse(String(row.receipt_json)) as OperationReceipt;
    return {
      ...receipt,
      receiptId: String(row.receipt_id),
      state: row.state as AgentModeReceiptState,
    };
  }

  recordReceipt(receipt: OperationReceipt, settlement?: AgentModeBudgetSettlement): 'recorded' | 'duplicate' | 'conflict' | 'stale' {
    return this.withTransaction(() => {
      const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(receipt.operationId) as Record<string, unknown> | undefined;
      if (!effect) throw new Error(`operation not found: ${receipt.operationId}`);
      const sameScope = effect.attempt_id === receipt.attemptId && effect.scope_hash === receipt.scopeHash;
      const existingRows = this.database.prepare('SELECT * FROM receipts WHERE operation_id = ?').all(receipt.operationId) as Array<Record<string, unknown>>;
      const receiptId = receiptIdFor(receipt);
      const sameExisting = existingRows.find((row) => row.receipt_id === receiptId);
      if (sameExisting) return 'duplicate';

      const hasConflict = existingRows.some((row) => row.state === 'accepted' && (
        row.attempt_id !== receipt.attemptId
        || row.scope_hash !== receipt.scopeHash
        || row.effect_hash !== receipt.effectHash
        || row.status !== receipt.status
      ));
      const stale = !sameScope || !this.isCurrentLeaseForAttempt(receipt.attemptId, receipt.recordedAt);
      if (stale) {
        this.database.prepare(`
          INSERT INTO receipts (
            receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
            recorded_at, state, receipt_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'stale', ?)
        `).run(
          receiptId,
          receipt.operationId,
          receipt.attemptId,
          receipt.scopeHash,
          receipt.effectHash,
          receipt.status,
          receipt.recordedAt,
          JSON.stringify(receipt),
        );
        this.appendEventIfAbsent({
          eventId: `receipt-stale:${receiptId}`,
          entityType: 'operation',
          entityId: receipt.operationId,
          eventType: 'receipt_from_stale_attempt',
          occurredAt: receipt.recordedAt,
          payload: { attemptId: receipt.attemptId, effectHash: receipt.effectHash },
        });
        return 'stale';
      }

      if (existingRows.some((row) => row.state === 'conflict') || hasConflict || existingRows.some((row) => row.state === 'accepted' && (
        row.effect_hash !== receipt.effectHash || row.status !== receipt.status
      ))) {
        this.database.prepare(`
          INSERT INTO receipts (
            receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
            recorded_at, state, receipt_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'conflict', ?)
        `).run(
          receiptId,
          receipt.operationId,
          receipt.attemptId,
          receipt.scopeHash,
          receipt.effectHash,
          receipt.status,
          receipt.recordedAt,
          JSON.stringify(receipt),
        );
        this.database.prepare("UPDATE effects SET status = 'uncertain' WHERE operation_id = ?").run(receipt.operationId);
        this.database.prepare("UPDATE dispatch_outbox SET state = 'uncertain' WHERE operation_id = ?").run(receipt.operationId);
        this.database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(receipt.recordedAt, String(effect.attempt_id));
        this.appendEventIfAbsent({
          eventId: `receipt-conflict:${receiptId}`,
          entityType: 'operation',
          entityId: receipt.operationId,
          eventType: 'receipt_conflict',
          occurredAt: receipt.recordedAt,
          payload: { attemptId: receipt.attemptId, effectHash: receipt.effectHash },
        });
        return 'conflict';
      }

      this.database.prepare(`
        INSERT INTO receipts (
          receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
          recorded_at, state, receipt_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', ?)
      `).run(
        receiptId,
        receipt.operationId,
        receipt.attemptId,
        receipt.scopeHash,
        receipt.effectHash,
        receipt.status,
        receipt.recordedAt,
        JSON.stringify(receipt),
      );
      this.database.prepare('UPDATE effects SET status = ?, receipt_json = ? WHERE operation_id = ?').run(receipt.status, JSON.stringify(receipt), receipt.operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'receipt_recorded' WHERE operation_id = ?").run(receipt.operationId);
      if (settlement) this.settleBudgetInternal(settlement);
      this.appendEventIfAbsent({
        eventId: `receipt-recorded:${receiptId}`,
        entityType: 'operation',
        entityId: receipt.operationId,
        eventType: 'receipt_recorded',
        occurredAt: receipt.recordedAt,
        payload: { attemptId: receipt.attemptId, status: receipt.status, settled: Boolean(settlement) },
      });
      this.failIfInjected('receipt');
      return 'recorded';
    });
  }

  requestCancellation(request: AgentModeCancellationRequest): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(request.attemptId);
      if (!attempt) throw new Error(`attempt not found: ${request.attemptId}`);
      const existing = this.database.prepare('SELECT attempt_id, requested_at FROM cancellation_requests WHERE request_id = ?').get(request.requestId) as Record<string, unknown> | undefined;
      if (existing) {
        return existing.attempt_id === request.attemptId && existing.requested_at === request.requestedAt ? 'duplicate' : 'conflict';
      }
      if (attempt.cancellationStatus !== 'running') return 'duplicate';
      this.database.prepare('INSERT INTO cancellation_requests (request_id, attempt_id, requested_at) VALUES (?, ?, ?)')
        .run(request.requestId, request.attemptId, request.requestedAt);
      this.database.prepare("UPDATE attempts SET cancellation_status = 'requested', cancellation_requested_at = ?, updated_at = ? WHERE attempt_id = ? AND cancellation_status = 'running'")
        .run(request.requestedAt, request.requestedAt, request.attemptId);
      this.appendEventIfAbsent({
        eventId: `cancellation-requested:${request.requestId}`,
        entityType: 'attempt',
        entityId: request.attemptId,
        eventType: 'cancellation_requested',
        occurredAt: request.requestedAt,
        payload: { requestId: request.requestId },
      });
      return 'created';
    });
  }

  acknowledgeCancellation(attemptId: string, acknowledgedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.cancellationStatus === 'acknowledged' || attempt.cancellationStatus === 'completed') return 'duplicate';
      if (attempt.cancellationStatus !== 'requested') throw new Error(`cancellation was not requested: ${attemptId}`);
      this.database.prepare("UPDATE attempts SET cancellation_status = 'acknowledged', updated_at = ? WHERE attempt_id = ? AND cancellation_status = 'requested'")
        .run(acknowledgedAt, attemptId);
      this.appendEventIfAbsent({
        eventId: `cancellation-acknowledged:${attemptId}`,
        entityType: 'attempt',
        entityId: attemptId,
        eventType: 'cancellation_acknowledged',
        occurredAt: acknowledgedAt,
        payload: {},
      });
      return 'created';
    });
  }

  finishAttempt(attemptId: string, status: 'completed' | 'failed' | 'cancelled', finishedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.status === status) return 'duplicate';
      if (['completed', 'failed', 'cancelled'].includes(attempt.status)) return 'conflict';
      if (status === 'cancelled' && attempt.cancellationStatus !== 'acknowledged') {
        throw new Error('cancellation acknowledgement is required before terminal cancellation');
      }
      this.database.prepare('UPDATE attempts SET status = ?, cancellation_status = ?, updated_at = ? WHERE attempt_id = ?')
        .run(status, status === 'cancelled' ? 'completed' : attempt.cancellationStatus, finishedAt, attemptId);
      const runStatus = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed';
      this.database.prepare('UPDATE runs SET status = ? WHERE run_id = ?').run(runStatus, attempt.runId);
      this.database.prepare('UPDATE tasks SET status = ? WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)').run(runStatus, attempt.runId);
      this.appendEventIfAbsent({
        eventId: `attempt-finished:${attemptId}`,
        entityType: 'attempt',
        entityId: attemptId,
        eventType: 'attempt_finished',
        occurredAt: finishedAt,
        payload: { status },
      });
      return 'created';
    });
  }

  classifyRecovery(attemptId: string, now: string): AgentModeRecoveryClassification {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
    if (attempt.status === 'duplicate') return 'duplicate';
    if (attempt.status === 'completed') return 'already_completed';
    if (attempt.status === 'failed') return 'terminal_failure';
    if (attempt.status === 'cancelled') return 'already_completed';
    if (attempt.cancellationStatus === 'requested') return 'cancelled_ack_pending';
    if (!this.isCurrentLeaseForAttempt(attemptId, now)) return 'stale_fenced_writer';
    const effect = this.database.prepare('SELECT status FROM effects WHERE attempt_id = ? ORDER BY COALESCE(prepared_at, rowid) DESC LIMIT 1').get(attemptId) as { status?: string } | undefined;
    if (!effect) return 'safe_to_resume';
    if (effect.status === 'effect_applied' || effect.status === 'uncertain') return 'uncertain_non_idempotent_effect';
    if (effect.status === 'dispatched') return 'awaiting_receipt_reconciliation';
    if (effect.status === 'succeeded') return 'already_completed';
    if (effect.status === 'failed') return 'terminal_failure';
    return 'safe_to_resume';
  }

  acquireLease(input: Omit<AgentModeLease, 'fence'>): AgentModeLease | undefined {
    return this.withTransaction(() => this.acquireLeaseAt(input, new Date().toISOString()));
  }

  getLease(resourceKey: string): AgentModeLease | undefined {
    const row = this.database.prepare('SELECT * FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      resourceKey,
      leaseId: String(row.lease_id),
      ownerId: String(row.owner_id),
      fence: Number(row.fence),
      expiresAt: String(row.expires_at),
    };
  }

  private acquireLeaseAt(input: Omit<AgentModeLease, 'fence'>, now: string): AgentModeLease | undefined {
    const current = this.database.prepare('SELECT fence, expires_at FROM leases WHERE resource_key = ?').get(input.resourceKey) as { fence?: number; expires_at?: string } | undefined;
    const currentExpiresAt = current?.expires_at;
    if (current && currentExpiresAt && currentExpiresAt > now) return undefined;
    const fence = Number(current?.fence ?? 0) + 1;
    this.database.prepare(`
      INSERT INTO leases (resource_key, lease_id, owner_id, fence, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(resource_key) DO UPDATE SET
        lease_id = excluded.lease_id,
        owner_id = excluded.owner_id,
        fence = excluded.fence,
        expires_at = excluded.expires_at
    `).run(input.resourceKey, input.leaseId, input.ownerId, fence, input.expiresAt);
    return { ...input, fence };
  }

  releaseLease(resourceKey: string, leaseId: string, fence: number): boolean {
    // Retain the fence counter after release so a future owner can never reuse
    // an old token, even when the previous lease ended cleanly.
    return this.withTransaction(() => {
      const result = this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ? AND lease_id = ? AND fence = ?').run(new Date().toISOString(), resourceKey, leaseId, fence);
      return result.changes === 1;
    });
  }

  recordEffect(effect: AgentModeEffect): 'created' | 'duplicate' | 'conflict' {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT attempt_id, effect_kind, scope_hash, status, receipt_json FROM effects WHERE operation_id = ?').get(effect.operationId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.attempt_id === effect.attemptId
          && existing.effect_kind === effect.effectKind
          && existing.scope_hash === effect.scopeHash;
        if (!same) return 'conflict';
        return 'duplicate';
      }
      this.database.prepare(`
        INSERT INTO effects (operation_id, attempt_id, effect_kind, scope_hash, status, receipt_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(effect.operationId, effect.attemptId, effect.effectKind, effect.scopeHash, effect.status, effect.receiptJson ?? null);
      return 'created';
    });
  }

  getEffect(operationId: string): AgentModeEffect | undefined {
    const row = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      scopeHash: String(row.scope_hash),
      status: row.status as AgentModeEffect['status'],
      ...(row.receipt_json === null ? {} : { receiptJson: String(row.receipt_json) }),
      ...(row.capability_id == null ? {} : { capabilityId: String(row.capability_id) }),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }),
      ...(row.policy_version == null ? {} : { policyVersion: String(row.policy_version) }),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }),
      ...(row.deadline == null ? {} : { deadline: String(row.deadline) }),
      ...(row.prepared_at == null ? {} : { preparedAt: String(row.prepared_at) }),
      ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.observed_at == null ? {} : { observedAt: String(row.observed_at) }),
    };
  }

  listEffects(): AgentModeEffect[] {
    const rows = this.database.prepare('SELECT * FROM effects ORDER BY COALESCE(prepared_at, rowid), operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      scopeHash: String(row.scope_hash),
      status: row.status as AgentModeEffect['status'],
      ...(row.receipt_json === null ? {} : { receiptJson: String(row.receipt_json) }),
      ...(row.capability_id == null ? {} : { capabilityId: String(row.capability_id) }),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }),
      ...(row.policy_version == null ? {} : { policyVersion: String(row.policy_version) }),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }),
      ...(row.deadline == null ? {} : { deadline: String(row.deadline) }),
      ...(row.prepared_at == null ? {} : { preparedAt: String(row.prepared_at) }),
      ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.observed_at == null ? {} : { observedAt: String(row.observed_at) }),
    }));
  }

  createReviewRequest(request: AgentModeReviewRequest): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT request_json FROM agent_mode_review_requests WHERE review_id = ?').get(request.reviewId) as { request_json?: string } | undefined;
      const serialized = JSON.stringify(request);
      if (existing) return existing.request_json === serialized ? 'duplicate' : 'conflict';
      const workcell = this.getWorkcell(request.workcellId);
      if (!workcell) throw new Error(`workcell not found: ${request.workcellId}`);
      if (request.requestingActor.startsWith('model:')) throw new Error('coding model cannot create a review authorization');
      if (request.taskId !== workcell.taskId || request.runId !== workcell.runId || request.attemptId !== workcell.attemptId || request.workerAgentId !== workcell.ownerAgent
        || request.repositoryRef !== workcell.repositoryRef || request.branch !== workcell.branch) throw new Error('review request lineage conflicts with Workcell');
      if (request.status !== 'pending') throw new Error('new review requests must be pending');
      const diff = this.getWorkcellDiff(request.diffId);
      const validation = this.getWorkcellValidationRun(request.validationId);
      if (!diff || diff.workcellId !== request.workcellId || diff.diffHash !== request.diffHash
        || diff.baseRevision !== request.baseRevision || diff.currentRevision !== request.currentRevision) throw new Error('review request diff binding is invalid');
      if (!validation || validation.workcellId !== request.workcellId || validation.diffId !== request.diffId
        || validation.status !== 'completed' || validation.result !== 'passed'
        || validation.evidenceHash !== request.validationEvidenceHash) throw new Error('review request validation binding is invalid');
      this.database.prepare(`INSERT INTO agent_mode_review_requests (
        review_id, workcell_id, task_id, run_id, attempt_id, worker_agent_id, repository_ref, branch,
        base_revision, current_revision, diff_id, diff_hash, validation_id,
        validation_evidence_hash, requesting_actor, created_at, expires_at, status, request_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(request.reviewId, request.workcellId, request.taskId, request.runId, request.attemptId, request.workerAgentId, request.repositoryRef, request.branch,
          request.baseRevision, request.currentRevision, request.diffId, request.diffHash, request.validationId,
          request.validationEvidenceHash, request.requestingActor, request.createdAt, request.expiresAt, request.status, serialized);
      this.recordReviewReceiptInternal(makeReviewReceipt(request, 'ReviewRequestedReceipt', request.requestingActor, request.createdAt));
      this.appendEventIfAbsent({ eventId: `review-requested:${request.reviewId}`, entityType: 'workcell', entityId: request.workcellId, eventType: 'workcell_review_requested', occurredAt: request.createdAt, payload: { reviewId: request.reviewId, diffId: request.diffId, diffHash: request.diffHash, validationId: request.validationId, validationEvidenceHash: request.validationEvidenceHash, status: request.status } });
      return 'created';
    });
  }

  getReviewRequest(reviewId: string): AgentModeReviewRequest | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT request_json FROM agent_mode_review_requests WHERE review_id = ?').get(reviewId) as { request_json?: string } | undefined;
    return row?.request_json ? JSON.parse(row.request_json) as AgentModeReviewRequest : undefined;
  }

  listReviewRequests(): AgentModeReviewRequest[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT request_json FROM agent_mode_review_requests ORDER BY created_at, review_id').all() as Array<{ request_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.request_json)) as AgentModeReviewRequest);
  }

  recordReviewDecision(decision: AgentModeReviewDecision): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const request = this.getReviewRequest(decision.reviewId);
      if (!request) throw new Error(`review request not found: ${decision.reviewId}`);
      const existing = this.database.prepare('SELECT decision_json FROM agent_mode_review_decisions WHERE review_id = ?').get(decision.reviewId) as { decision_json?: string } | undefined;
      const serialized = JSON.stringify(decision);
      if (existing) return existing.decision_json === serialized ? 'duplicate' : 'conflict';
      if (request.status !== 'pending') throw new Error(`review request is not pending: ${decision.reviewId}`);
      if (decision.reviewer === request.workerAgentId || decision.reviewer.startsWith('model:')) throw new Error('coding worker or model cannot modify approval state');
      this.database.prepare(`INSERT INTO agent_mode_review_decisions (
        decision_id, review_id, decision, reviewer, decided_at, reason, evidence_hash, decision_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(decision.decisionId, decision.reviewId, decision.decision, decision.reviewer, decision.decidedAt, decision.reason, decision.evidenceHash, serialized);
      const status = decision.decision === 'approved' ? 'approved' : 'rejected';
      this.database.prepare('UPDATE agent_mode_review_requests SET status = ?, request_json = ? WHERE review_id = ?')
        .run(status, JSON.stringify({ ...request, status }), decision.reviewId);
      this.recordReviewReceiptInternal(makeReviewReceipt(request, decision.decision === 'approved' ? 'ReviewApprovedReceipt' : 'ReviewRejectedReceipt', decision.reviewer, decision.decidedAt, decision.decisionId));
      this.appendEventIfAbsent({ eventId: `review-decision:${decision.decisionId}`, entityType: 'workcell', entityId: request.workcellId, eventType: `workcell_review_${decision.decision}`, occurredAt: decision.decidedAt, payload: { reviewId: decision.reviewId, decisionId: decision.decisionId, decision: decision.decision, reviewer: decision.reviewer, evidenceHash: decision.evidenceHash } });
      return 'created';
    });
  }

  getReviewDecision(reviewId: string): AgentModeReviewDecision | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT decision_json FROM agent_mode_review_decisions WHERE review_id = ?').get(reviewId) as { decision_json?: string } | undefined;
    return row?.decision_json ? JSON.parse(row.decision_json) as AgentModeReviewDecision : undefined;
  }

  listReviewDecisions(): AgentModeReviewDecision[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT decision_json FROM agent_mode_review_decisions ORDER BY decided_at, decision_id').all() as Array<{ decision_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.decision_json)) as AgentModeReviewDecision);
  }

  getReviewReceipt(receiptId: string): AgentModeReviewReceipt | undefined {
    if (!this.hasReviewReceiptTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts WHERE receipt_id = ?').get(receiptId) as { receipt_json?: string } | undefined;
    return row?.receipt_json ? JSON.parse(row.receipt_json) as AgentModeReviewReceipt : undefined;
  }

  listReviewReceipts(reviewId?: string): AgentModeReviewReceipt[] {
    if (!this.hasReviewReceiptTables) return [];
    const rows = (reviewId
      ? this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts WHERE review_id = ? ORDER BY timestamp, receipt_id').all(reviewId)
      : this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts ORDER BY timestamp, receipt_id').all()) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeReviewReceipt);
  }

  private recordReviewReceiptInternal(receipt: AgentModeReviewReceipt): AgentModeOperationResult {
    if (!this.hasReviewReceiptTables) throw new Error('K3.5 review receipt tables are unavailable');
    const request = this.getReviewRequest(receipt.reviewId);
    if (!request) throw new Error(`review request not found: ${receipt.reviewId}`);
    if (request.taskId !== receipt.taskId || request.runId !== receipt.runId || request.attemptId !== receipt.attemptId
      || request.workcellId !== receipt.workcellId || request.workerAgentId !== receipt.workerAgentId || request.diffHash !== receipt.diffHash
      || request.validationEvidenceHash !== receipt.validationEvidenceHash) throw new Error(`review receipt conflicts with request: ${receipt.reviewId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM agent_mode_review_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`review receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_review_receipts (
        receipt_id, review_id, decision_id, task_id, run_id, attempt_id, workcell_id, worker_agent_id,
        diff_hash, validation_evidence_hash, reviewer, timestamp, operation_hash, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.reviewId, receipt.decisionId ?? null, receipt.taskId, receipt.runId, receipt.attemptId, receipt.workcellId, receipt.workerAgentId, receipt.diffHash, receipt.validationEvidenceHash, receipt.reviewer, receipt.timestamp, receipt.operationHash, serialized);
    return 'created';
  }

  markReviewStale(reviewId: string, reason: string, timestamp: string): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const request = this.getReviewRequest(reviewId);
      if (!request) throw new Error(`review request not found: ${reviewId}`);
      if (request.status === 'stale') return 'duplicate';
      if (request.status === 'rejected') return 'conflict';
      const status: AgentModeReviewRequest['status'] = 'stale';
      this.database.prepare("UPDATE agent_mode_review_requests SET status = ?, request_json = ? WHERE review_id = ? AND status IN ('pending', 'approved')")
        .run(status, JSON.stringify({ ...request, status }), reviewId);
      this.appendEventIfAbsent({ eventId: `review-stale:${reviewId}:${request.diffHash}`, entityType: 'workcell', entityId: request.workcellId, eventType: 'workcell_review_stale', occurredAt: timestamp, payload: { reviewId, diffHash: request.diffHash, validationEvidenceHash: request.validationEvidenceHash, reason } });
      return 'created';
    });
  }

  acquireTargetRefLease(input: AgentModeTargetRefLease, now = new Date().toISOString()): { result: 'granted' | 'duplicate' | 'rejected'; lease?: AgentModeTargetRefLease; reason?: string } {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT lease_json, fence_token, status, expires_at FROM agent_mode_target_ref_leases WHERE repository_ref = ? AND target_ref = ? AND status = \'active\'').get(input.repositoryRef, input.targetRef) as { lease_json?: string; fence_token?: number; status?: string; expires_at?: string } | undefined;
      if (existing && existing.lease_json) {
        const current = JSON.parse(existing.lease_json) as AgentModeTargetRefLease;
        if (current.leaseId === input.leaseId && JSON.stringify(current) === JSON.stringify(input)) return { result: 'duplicate' as const, lease: current };
        if (Date.parse(current.expiresAt) > Date.parse(now)) return { result: 'rejected' as const, reason: 'active target ref authority exists' };
        this.database.prepare("UPDATE agent_mode_target_ref_leases SET status = 'expired' WHERE lease_id = ? AND status = 'active'").run(current.leaseId);
      }
      const prior = this.database.prepare('SELECT MAX(fence_token) AS fence FROM agent_mode_target_ref_leases WHERE repository_ref = ? AND target_ref = ?').get(input.repositoryRef, input.targetRef) as { fence?: number } | undefined;
      const lease = { ...input, fenceToken: Math.max(1, Number(prior?.fence ?? 0) + 1), status: 'active' as const };
      try {
        this.database.prepare(`INSERT INTO agent_mode_target_ref_leases (
          lease_id, repository_ref, target_ref, owner_operation, fence_token,
          expected_target_head, expires_at, status, lease_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(lease.leaseId, lease.repositoryRef, lease.targetRef, lease.ownerOperation, lease.fenceToken, lease.expectedTargetHead, lease.expiresAt, lease.status, JSON.stringify(lease));
      } catch (error) {
        if (error instanceof Error && /UNIQUE/i.test(error.message)) return { result: 'rejected' as const, reason: 'target ref authority raced with another operation' };
        throw error;
      }
      this.appendEventIfAbsent({ eventId: `target-ref-lease:${lease.leaseId}`, entityType: 'target_ref', entityId: `${lease.repositoryRef}:${lease.targetRef}`, eventType: 'target_ref_lease_acquired', occurredAt: new Date().toISOString(), payload: { leaseId: lease.leaseId, ownerOperation: lease.ownerOperation, fenceToken: lease.fenceToken, expectedTargetHead: lease.expectedTargetHead } });
      return { result: 'granted' as const, lease };
    });
  }

  getTargetRefLease(leaseId: string): AgentModeTargetRefLease | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT lease_json FROM agent_mode_target_ref_leases WHERE lease_id = ?').get(leaseId) as { lease_json?: string } | undefined;
    return row?.lease_json ? JSON.parse(row.lease_json) as AgentModeTargetRefLease : undefined;
  }

  listTargetRefLeases(): AgentModeTargetRefLease[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT lease_json FROM agent_mode_target_ref_leases ORDER BY lease_id').all() as Array<{ lease_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.lease_json)) as AgentModeTargetRefLease);
  }

  updateTargetRefLeaseStatus(leaseId: string, status: AgentModeTargetRefLease['status']): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const lease = this.getTargetRefLease(leaseId);
      if (!lease) throw new Error(`target ref lease not found: ${leaseId}`);
      if (lease.status === status) return 'duplicate';
      if (lease.status !== 'active') return 'conflict';
      const next = { ...lease, status };
      this.database.prepare('UPDATE agent_mode_target_ref_leases SET status = ?, lease_json = ? WHERE lease_id = ? AND status = \'active\'').run(status, JSON.stringify(next), leaseId);
      return 'created';
    });
  }

  getCommitReceipt(receiptId: string): AgentModeCommitReceipt | undefined {
    if (!this.hasCommitReceiptTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts WHERE receipt_id = ?').get(receiptId) as { receipt_json?: string } | undefined;
    return row?.receipt_json ? JSON.parse(row.receipt_json) as AgentModeCommitReceipt : undefined;
  }

  listCommitReceipts(operationId?: string): AgentModeCommitReceipt[] {
    if (!this.hasCommitReceiptTables) return [];
    const rows = (operationId
      ? this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts WHERE operation_id = ? ORDER BY timestamp, receipt_id').all(operationId)
      : this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts ORDER BY timestamp, receipt_id').all()) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeCommitReceipt);
  }

  recordCommitReceipt(receipt: AgentModeCommitReceipt): AgentModeOperationResult {
    if (!this.hasCommitReceiptTables) throw new Error('K3.5 commit receipt tables are unavailable');
    return this.withTransaction(() => this.recordCommitReceiptInternal(receipt));
  }

  private recordCommitReceiptInternal(receipt: AgentModeCommitReceipt): AgentModeOperationResult {
    const workcell = this.getWorkcell(receipt.workcellId);
    if (!workcell || workcell.branch !== receipt.branch) throw new Error(`commit receipt Workcell binding is invalid: ${receipt.operationId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM agent_mode_commit_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`commit receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_commit_receipts (
        receipt_id, operation_id, workcell_id, branch, parent_commit, resulting_commit,
        diff_hash, validation_evidence_hash, review_id, actor, timestamp,
        operation_hash, result, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.operationId, receipt.workcellId, receipt.branch, receipt.parentCommit, receipt.resultingCommit, receipt.diffHash, receipt.validationEvidenceHash, receipt.reviewId, receipt.actor, receipt.timestamp, receipt.operationHash, receipt.result, serialized);
    return 'created';
  }

  createCommitOperation(operation: AgentModeCommitOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT operation_json FROM agent_mode_commit_operations WHERE operation_id = ?').get(operation.operationId) as { operation_json?: string } | undefined;
      const serialized = JSON.stringify(operation);
      if (existing) return existing.operation_json === serialized ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_commit_operations (
        operation_id, workcell_id, repository_ref, branch, parent_commit, resulting_commit,
        approved_diff_hash, validation_evidence_hash, review_id, actor, created_at, status,
        receipt_hash, reason, operation_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(operation.operationId, operation.workcellId, operation.repositoryRef, operation.branch, operation.parentCommit, operation.resultingCommit ?? null,
          operation.approvedDiffHash, operation.validationEvidenceHash, operation.reviewId, operation.actor, operation.createdAt, operation.status,
          operation.receiptHash ?? null, operation.reason ?? null, serialized);
      this.recordCommitReceiptInternal(makeCommitReceipt(operation, 'CommitRequestedReceipt', 'requested', operation.createdAt));
      this.appendEventIfAbsent({ eventId: `commit-operation:${operation.operationId}`, entityType: 'workcell', entityId: operation.workcellId, eventType: 'workcell_commit_operation_recorded', occurredAt: operation.createdAt, payload: { operationId: operation.operationId, reviewId: operation.reviewId, status: operation.status, approvedDiffHash: operation.approvedDiffHash } });
      return 'created';
    });
  }

  updateCommitOperation(operation: AgentModeCommitOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.getCommitOperation(operation.operationId);
      if (!existing) throw new Error(`commit operation not found: ${operation.operationId}`);
      if (existing.workcellId !== operation.workcellId || existing.repositoryRef !== operation.repositoryRef || existing.branch !== operation.branch || existing.parentCommit !== operation.parentCommit || existing.approvedDiffHash !== operation.approvedDiffHash || existing.validationEvidenceHash !== operation.validationEvidenceHash || existing.reviewId !== operation.reviewId || existing.message !== operation.message) return 'conflict';
      if (JSON.stringify(existing) === JSON.stringify(operation)) return 'duplicate';
      this.database.prepare(`UPDATE agent_mode_commit_operations SET resulting_commit = ?, status = ?, receipt_hash = ?, reason = ?, operation_json = ? WHERE operation_id = ?`)
        .run(operation.resultingCommit ?? null, operation.status, operation.receiptHash ?? null, operation.reason ?? null, JSON.stringify(operation), operation.operationId);
      if (operation.status === 'committed' || operation.status === 'reconciled' || operation.status === 'rejected') {
        this.recordCommitReceiptInternal(makeCommitReceipt(operation, operation.status === 'committed' ? 'CommitCompletedReceipt' : operation.status === 'reconciled' ? 'CommitReconciledReceipt' : 'CommitRejectedReceipt', operation.status === 'committed' ? 'completed' : operation.status, operation.createdAt));
      }
      return 'created';
    });
  }

  getCommitOperation(operationId: string): AgentModeCommitOperation | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT operation_json FROM agent_mode_commit_operations WHERE operation_id = ?').get(operationId) as { operation_json?: string } | undefined;
    return row?.operation_json ? JSON.parse(row.operation_json) as AgentModeCommitOperation : undefined;
  }

  listCommitOperations(): AgentModeCommitOperation[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT operation_json FROM agent_mode_commit_operations ORDER BY created_at, operation_id').all() as Array<{ operation_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.operation_json)) as AgentModeCommitOperation);
  }

  createMergeApproval(approval: AgentModeMergeApproval): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT approval_json FROM agent_mode_merge_approvals WHERE approval_id = ?').get(approval.approvalId) as { approval_json?: string } | undefined;
      const serialized = JSON.stringify(approval);
      if (existing) return existing.approval_json === serialized ? 'duplicate' : 'conflict';
      const workcell = this.getWorkcell(approval.sourceWorkcellId);
      if (!workcell || workcell.repositoryRef !== approval.repositoryRef || workcell.branch !== approval.sourceBranch) throw new Error('merge approval source binding is invalid');
      this.database.prepare(`INSERT INTO agent_mode_merge_approvals (
        approval_id, repository_ref, source_workcell_id, source_branch, source_commit,
        diff_hash, validation_evidence_hash, target_ref, expected_target_head, approver,
        created_at, expires_at, operation_id, status, approval_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(approval.approvalId, approval.repositoryRef, approval.sourceWorkcellId, approval.sourceBranch, approval.sourceCommit, approval.diffHash, approval.validationEvidenceHash, approval.targetRef, approval.expectedTargetHead, approval.approver, approval.createdAt, approval.expiresAt, approval.operationId, approval.status, serialized);
      this.appendEventIfAbsent({ eventId: `merge-approval:${approval.approvalId}`, entityType: 'workcell', entityId: approval.sourceWorkcellId, eventType: 'workcell_merge_approval_created', occurredAt: approval.createdAt, payload: { approvalId: approval.approvalId, operationId: approval.operationId, targetRef: approval.targetRef, expectedTargetHead: approval.expectedTargetHead } });
      return 'created';
    });
  }

  getMergeApproval(approvalId: string): AgentModeMergeApproval | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT approval_json FROM agent_mode_merge_approvals WHERE approval_id = ?').get(approvalId) as { approval_json?: string } | undefined;
    return row?.approval_json ? JSON.parse(row.approval_json) as AgentModeMergeApproval : undefined;
  }

  updateMergeApproval(approval: AgentModeMergeApproval): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.getMergeApproval(approval.approvalId);
      if (!existing) throw new Error(`merge approval not found: ${approval.approvalId}`);
      if (JSON.stringify(existing) === JSON.stringify(approval)) return 'duplicate';
      if (existing.repositoryRef !== approval.repositoryRef || existing.sourceCommit !== approval.sourceCommit || existing.expectedTargetHead !== approval.expectedTargetHead || existing.operationId !== approval.operationId) return 'conflict';
      this.database.prepare('UPDATE agent_mode_merge_approvals SET status = ?, approval_json = ? WHERE approval_id = ?').run(approval.status, JSON.stringify(approval), approval.approvalId);
      return 'created';
    });
  }

  listMergeApprovals(): AgentModeMergeApproval[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT approval_json FROM agent_mode_merge_approvals ORDER BY created_at, approval_id').all() as Array<{ approval_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.approval_json)) as AgentModeMergeApproval);
  }

  getMergeReceipt(receiptId: string): AgentModeMergeReceipt | undefined {
    if (!this.hasMergeReceiptTables) return undefined;
    const row = this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts WHERE receipt_id = ?').get(receiptId) as { receipt_json?: string } | undefined;
    return row?.receipt_json ? JSON.parse(row.receipt_json) as AgentModeMergeReceipt : undefined;
  }

  listMergeReceipts(operationId?: string): AgentModeMergeReceipt[] {
    if (!this.hasMergeReceiptTables) return [];
    const rows = (operationId
      ? this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts WHERE operation_id = ? ORDER BY timestamp, receipt_id').all(operationId)
      : this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts ORDER BY timestamp, receipt_id').all()) as Array<{ receipt_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.receipt_json)) as AgentModeMergeReceipt);
  }

  recordMergeReceipt(receipt: AgentModeMergeReceipt): AgentModeOperationResult {
    if (!this.hasMergeReceiptTables) throw new Error('K3.5 merge receipt tables are unavailable');
    return this.withTransaction(() => this.recordMergeReceiptInternal(receipt));
  }

  private recordMergeReceiptInternal(receipt: AgentModeMergeReceipt): AgentModeOperationResult {
    const workcell = this.getWorkcell(receipt.workcellId);
    if (!workcell) throw new Error(`merge receipt Workcell does not exist: ${receipt.workcellId}`);
    const serialized = JSON.stringify(receipt);
    const existing = this.database.prepare('SELECT receipt_json FROM agent_mode_merge_receipts WHERE receipt_id = ?').get(receipt.receiptId) as { receipt_json?: string } | undefined;
    if (existing) {
      if (existing.receipt_json !== serialized) throw new Error(`merge receipt conflict: ${receipt.receiptId}`);
      return 'duplicate';
    }
    this.database.prepare(`
      INSERT INTO agent_mode_merge_receipts (
        receipt_id, operation_id, approval_id, workcell_id, source_commit, target_ref,
        target_before, target_after, review_id, validation_id, actor, timestamp,
        operation_hash, result, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.receiptId, receipt.operationId, receipt.approvalId, receipt.workcellId, receipt.sourceCommit, receipt.targetRef, receipt.targetBefore, receipt.targetAfter, receipt.reviewId, receipt.validationId, receipt.actor, receipt.timestamp, receipt.operationHash, receipt.result, serialized);
    return 'created';
  }

  createMergeOperation(operation: AgentModeMergeOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT operation_json FROM agent_mode_merge_operations WHERE operation_id = ?').get(operation.operationId) as { operation_json?: string } | undefined;
      const serialized = JSON.stringify(operation);
      if (existing) return existing.operation_json === serialized ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_merge_operations (
        operation_id, approval_id, repository_ref, source_workcell_id, source_branch,
        source_commit, target_ref, expected_target_head, resulting_target_head, actor,
        created_at, status, receipt_hash, reason, operation_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(operation.operationId, operation.approvalId, operation.repositoryRef, operation.sourceWorkcellId, operation.sourceBranch, operation.sourceCommit, operation.targetRef, operation.expectedTargetHead, operation.resultingTargetHead ?? null, operation.actor, operation.createdAt, operation.status, operation.receiptHash ?? null, operation.reason ?? null, serialized);
      this.recordMergeReceiptInternal(makeMergeReceipt(operation, 'MergeRequestedReceipt', 'requested', operation.createdAt));
      this.appendEventIfAbsent({ eventId: `merge-operation:${operation.operationId}`, entityType: 'target_ref', entityId: `${operation.repositoryRef}:${operation.targetRef}`, eventType: 'workcell_merge_operation_recorded', occurredAt: operation.createdAt, payload: { operationId: operation.operationId, approvalId: operation.approvalId, status: operation.status, expectedTargetHead: operation.expectedTargetHead } });
      return 'created';
    });
  }

  updateMergeOperation(operation: AgentModeMergeOperation): AgentModeOperationResult {
    if (!this.hasPromotionTables) throw new Error('K3.5 promotion tables are unavailable');
    return this.withTransaction(() => {
      const existing = this.getMergeOperation(operation.operationId);
      if (!existing) throw new Error(`merge operation not found: ${operation.operationId}`);
      if (existing.approvalId !== operation.approvalId || existing.repositoryRef !== operation.repositoryRef || existing.sourceWorkcellId !== operation.sourceWorkcellId || existing.sourceBranch !== operation.sourceBranch || existing.sourceCommit !== operation.sourceCommit || existing.reviewId !== operation.reviewId || existing.validationId !== operation.validationId || existing.targetRef !== operation.targetRef || existing.expectedTargetHead !== operation.expectedTargetHead || existing.targetFenceToken !== operation.targetFenceToken) return 'conflict';
      if (JSON.stringify(existing) === JSON.stringify(operation)) return 'duplicate';
      this.database.prepare('UPDATE agent_mode_merge_operations SET resulting_target_head = ?, status = ?, receipt_hash = ?, reason = ?, operation_json = ? WHERE operation_id = ?')
        .run(operation.resultingTargetHead ?? null, operation.status, operation.receiptHash ?? null, operation.reason ?? null, JSON.stringify(operation), operation.operationId);
      if (operation.status === 'merged' || operation.status === 'reconciled' || operation.status === 'rejected') {
        this.recordMergeReceiptInternal(makeMergeReceipt(operation, operation.status === 'merged' ? 'MergeCompletedReceipt' : operation.status === 'reconciled' ? 'MergeReconciledReceipt' : 'MergeRejectedReceipt', operation.status === 'merged' ? 'completed' : operation.status, operation.createdAt));
      }
      return 'created';
    });
  }

  getMergeOperation(operationId: string): AgentModeMergeOperation | undefined {
    if (!this.hasPromotionTables) return undefined;
    const row = this.database.prepare('SELECT operation_json FROM agent_mode_merge_operations WHERE operation_id = ?').get(operationId) as { operation_json?: string } | undefined;
    return row?.operation_json ? JSON.parse(row.operation_json) as AgentModeMergeOperation : undefined;
  }

  listMergeOperations(): AgentModeMergeOperation[] {
    if (!this.hasPromotionTables) return [];
    const rows = this.database.prepare('SELECT operation_json FROM agent_mode_merge_operations ORDER BY created_at, operation_id').all() as Array<{ operation_json?: string }>;
    return rows.map((row) => JSON.parse(String(row.operation_json)) as AgentModeMergeOperation);
  }

  get schedulerAvailable(): boolean {
    return this.hasSchedulerTables;
  }

  private mapSchedulerEvent(row: Record<string, unknown>): AgentModeSchedulerEvent {
    return {
      eventId: String(row.event_id), eventType: String(row.event_type), source: String(row.source),
      occurredAt: String(row.occurred_at), receivedAt: String(row.received_at),
      causationId: row.causation_id === null ? null : String(row.causation_id),
      correlationId: row.correlation_id === null ? null : String(row.correlation_id),
      deduplicationKey: String(row.deduplication_key), payloadVersion: String(row.payload_version),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
      status: row.status as AgentModeSchedulerItemStatus, attemptCount: Number(row.attempt_count),
      nextEligibleAt: String(row.next_eligible_at), deadline: row.deadline === null ? null : String(row.deadline),
      maxAttempts: Number(row.max_attempts), contentHash: String(row.content_hash),
      claimOwner: row.claim_owner === null ? null : String(row.claim_owner),
      claimFence: row.claim_fence === null ? null : Number(row.claim_fence),
      claimExpiresAt: row.claim_expires_at === null ? null : String(row.claim_expires_at),
      lastFailure: row.last_failure === null ? null : String(row.last_failure),
      lastFailureAt: row.last_failure_at === null ? null : String(row.last_failure_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at),
      deadLetteredAt: row.dead_lettered_at === null ? null : String(row.dead_lettered_at),
    };
  }

  private mapSchedulerSchedule(row: Record<string, unknown>): AgentModeSchedulerSchedule {
    return {
      scheduleId: String(row.schedule_id), kind: String(row.kind), dueAt: String(row.due_at), createdAt: String(row.created_at),
      status: row.status as AgentModeSchedulerItemStatus, deduplicationKey: String(row.deduplication_key),
      causationId: row.causation_id === null ? null : String(row.causation_id),
      correlationId: row.correlation_id === null ? null : String(row.correlation_id),
      payloadVersion: String(row.payload_version), payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
      attemptCount: Number(row.attempt_count), nextEligibleAt: String(row.next_eligible_at),
      deadline: row.deadline === null ? null : String(row.deadline), maxAttempts: Number(row.max_attempts),
      contentHash: String(row.content_hash), claimOwner: row.claim_owner === null ? null : String(row.claim_owner),
      claimFence: row.claim_fence === null ? null : Number(row.claim_fence),
      claimExpiresAt: row.claim_expires_at === null ? null : String(row.claim_expires_at),
      lastFailure: row.last_failure === null ? null : String(row.last_failure),
      lastFailureAt: row.last_failure_at === null ? null : String(row.last_failure_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at),
      deadLetteredAt: row.dead_lettered_at === null ? null : String(row.dead_lettered_at),
    };
  }

  createSchedulerEvent(input: AgentModeSchedulerEventInput): AgentModeQueueOperationResult {
    if (!this.hasSchedulerTables) throw new Error('scheduler tables are unavailable');
    ensureSchedulerText(input.eventId, 'eventId', true); ensureSchedulerText(input.eventType, 'eventType', true); ensureSchedulerText(input.source, 'source', true); ensureSchedulerText(input.deduplicationKey, 'deduplicationKey', true); ensureSchedulerText(input.causationId, 'causationId'); ensureSchedulerText(input.correlationId, 'correlationId');
    if (!Number.isFinite(Date.parse(input.occurredAt)) || !Number.isFinite(Date.parse(input.receivedAt))) throw new Error('scheduler event timestamps must be ISO timestamps');
    const payloadJson = ensureSchedulerInput(input);
    const contentHash = schedulerContentHash({ eventType: input.eventType, source: input.source, occurredAt: input.occurredAt, causationId: input.causationId, correlationId: input.correlationId, deduplicationKey: input.deduplicationKey, payloadVersion: input.payloadVersion, payload: input.payload, nextEligibleAt: input.nextEligibleAt, deadline: input.deadline, maxAttempts: input.maxAttempts });
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_events WHERE source = ? AND deduplication_key = ?').get(input.source, input.deduplicationKey) as { content_hash?: string } | undefined;
      if (existing) return existing.content_hash === contentHash ? 'duplicate' : 'conflict';
      const sameId = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_events WHERE event_id = ?').get(input.eventId) as { content_hash?: string } | undefined;
      if (sameId) return sameId.content_hash === contentHash ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_scheduler_events
        (event_id,event_type,source,occurred_at,received_at,causation_id,correlation_id,deduplication_key,payload_version,payload_json,status,attempt_count,next_eligible_at,deadline,max_attempts,content_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'pending',0,?,?,?,?)`).run(
        input.eventId, input.eventType, input.source, input.occurredAt, input.receivedAt, input.causationId, input.correlationId,
        input.deduplicationKey, input.payloadVersion, payloadJson, input.nextEligibleAt, input.deadline, input.maxAttempts, contentHash,
      );
      return 'created';
    });
  }

  createSchedulerSchedule(input: AgentModeSchedulerScheduleInput): AgentModeQueueOperationResult {
    if (!this.hasSchedulerTables) throw new Error('scheduler tables are unavailable');
    ensureSchedulerText(input.scheduleId, 'scheduleId', true); ensureSchedulerText(input.kind, 'kind', true); ensureSchedulerText(input.deduplicationKey, 'deduplicationKey', true); ensureSchedulerText(input.causationId, 'causationId'); ensureSchedulerText(input.correlationId, 'correlationId');
    if (!Number.isFinite(Date.parse(input.dueAt)) || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('scheduler timestamps must be ISO timestamps');
    const payloadJson = ensureSchedulerInput(input);
    const contentHash = schedulerContentHash({ kind: input.kind, dueAt: input.dueAt, deduplicationKey: input.deduplicationKey, causationId: input.causationId, correlationId: input.correlationId, payloadVersion: input.payloadVersion, payload: input.payload, nextEligibleAt: input.nextEligibleAt, deadline: input.deadline, maxAttempts: input.maxAttempts });
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_schedules WHERE kind = ? AND deduplication_key = ?').get(input.kind, input.deduplicationKey) as { content_hash?: string } | undefined;
      if (existing) return existing.content_hash === contentHash ? 'duplicate' : 'conflict';
      const sameId = this.database.prepare('SELECT content_hash FROM agent_mode_scheduler_schedules WHERE schedule_id = ?').get(input.scheduleId) as { content_hash?: string } | undefined;
      if (sameId) return sameId.content_hash === contentHash ? 'duplicate' : 'conflict';
      this.database.prepare(`INSERT INTO agent_mode_scheduler_schedules
        (schedule_id,kind,due_at,created_at,status,deduplication_key,causation_id,correlation_id,payload_version,payload_json,attempt_count,next_eligible_at,deadline,max_attempts,content_hash)
        VALUES (?,?,?,?, 'pending',?,?,?,?,?,0,?,?,?,?)`).run(
        input.scheduleId, input.kind, input.dueAt, input.createdAt, input.deduplicationKey, input.causationId, input.correlationId,
        input.payloadVersion, payloadJson, input.nextEligibleAt, input.deadline, input.maxAttempts, contentHash,
      );
      return 'created';
    });
  }

  listSchedulerEvents(limit = 100): AgentModeSchedulerEvent[] {
    if (!this.hasSchedulerTables) return [];
    const bounded = Math.max(0, Math.min(Math.floor(limit), 500));
    return (this.database.prepare('SELECT * FROM agent_mode_scheduler_events ORDER BY rowid LIMIT ?').all(bounded) as Array<Record<string, unknown>>).map((row) => this.mapSchedulerEvent(row));
  }

  listSchedulerSchedules(limit = 100): AgentModeSchedulerSchedule[] {
    if (!this.hasSchedulerTables) return [];
    const bounded = Math.max(0, Math.min(Math.floor(limit), 500));
    return (this.database.prepare('SELECT * FROM agent_mode_scheduler_schedules ORDER BY due_at,schedule_id LIMIT ?').all(bounded) as Array<Record<string, unknown>>).map((row) => this.mapSchedulerSchedule(row));
  }

  getSchedulerEvent(eventId: string): AgentModeSchedulerEvent | undefined {
    if (!this.hasSchedulerTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_scheduler_events WHERE event_id = ?').get(eventId) as Record<string, unknown> | undefined;
    return row ? this.mapSchedulerEvent(row) : undefined;
  }

  getSchedulerSchedule(scheduleId: string): AgentModeSchedulerSchedule | undefined {
    if (!this.hasSchedulerTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_scheduler_schedules WHERE schedule_id = ?').get(scheduleId) as Record<string, unknown> | undefined;
    return row ? this.mapSchedulerSchedule(row) : undefined;
  }

  private claimSchedulerRow(itemType: 'event' | 'schedule', itemId: string, ownerId: string, expiresAt: string, now: string): AgentModeSchedulerClaim | undefined {
    const table = itemType === 'event' ? 'agent_mode_scheduler_events' : 'agent_mode_scheduler_schedules';
    const idColumn = itemType === 'event' ? 'event_id' : 'schedule_id';
    const resourceKey = `agent-mode-scheduler:${itemType}:${itemId}`;
    return this.withTransaction(() => {
      const row = this.database.prepare(`SELECT status,next_eligible_at,claim_expires_at FROM ${table} WHERE ${idColumn} = ?`).get(itemId) as { status?: string; next_eligible_at?: string; claim_expires_at?: string | null } | undefined;
      if (!row) return undefined;
      const liveClaim = row.status === 'claimed' && row.claim_expires_at !== null && row.claim_expires_at !== undefined && row.claim_expires_at > now;
      const eligible = (row.status === 'pending' || row.status === 'failed') && String(row.next_eligible_at) <= now;
      if (liveClaim || (!eligible && row.status !== 'claimed')) return undefined;
      const lease = this.acquireLeaseAt({ resourceKey, leaseId: `${resourceKey}:${ownerId}`, ownerId, expiresAt }, now);
      if (!lease) return undefined;
      const updated = this.database.prepare(`UPDATE ${table} SET status='claimed',attempt_count=attempt_count+1,claim_owner=?,claim_fence=?,claim_expires_at=? WHERE ${idColumn}=? AND (status IN ('pending','failed') OR (status='claimed' AND claim_expires_at <= ?))`).run(ownerId, lease.fence, expiresAt, itemId, now);
      if (updated.changes !== 1) return undefined;
      return { ownerId, fence: lease.fence, expiresAt };
    });
  }

  claimSchedulerEvent(eventId: string, ownerId: string, expiresAt: string, now: string): AgentModeSchedulerClaim | undefined {
    return this.claimSchedulerRow('event', eventId, ownerId, expiresAt, now);
  }

  claimSchedulerSchedule(scheduleId: string, ownerId: string, expiresAt: string, now: string): AgentModeSchedulerClaim | undefined {
    return this.claimSchedulerRow('schedule', scheduleId, ownerId, expiresAt, now);
  }

  private settleSchedulerRow(input: AgentModeSchedulerSettlement, status: 'completed' | 'dead_letter' | 'failed', failure?: AgentModeSchedulerFailure): AgentModeSchedulerItemStatus {
    const table = input.itemType === 'event' ? 'agent_mode_scheduler_events' : 'agent_mode_scheduler_schedules';
    const idColumn = input.itemType === 'event' ? 'event_id' : 'schedule_id';
    const resourceKey = `agent-mode-scheduler:${input.itemType}:${input.itemId}`;
    return this.withTransaction(() => {
      const current = this.database.prepare(`SELECT status,claim_owner,claim_fence,claim_expires_at,attempt_count,max_attempts,deadline FROM ${table} WHERE ${idColumn} = ?`).get(input.itemId) as Record<string, unknown> | undefined;
      if (!current || current.status !== 'claimed' || current.claim_owner !== input.ownerId || Number(current.claim_fence) !== input.fence || current.claim_expires_at === null || String(current.claim_expires_at) <= input.now) throw new Error('stale_scheduler_claim');
      const lease = this.database.prepare('SELECT owner_id,fence,expires_at FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
      if (!lease || lease.owner_id !== input.ownerId || Number(lease.fence) !== input.fence || String(lease.expires_at) <= input.now) throw new Error('stale_scheduler_fence');
      const failureText = failure?.reason ?? null;
      if (status === 'failed') {
        const attemptCount = Number(current.attempt_count);
        const backoffMs = Math.min(300_000, 1_000 * (2 ** Math.max(0, attemptCount - 1)));
        const nextEligibleAt = new Date(Date.parse(input.now) + backoffMs).toISOString();
        if (attemptCount >= Number(current.max_attempts) || (current.deadline !== null && String(current.deadline) <= nextEligibleAt)) status = 'dead_letter';
        this.database.prepare(`UPDATE ${table} SET status=?,next_eligible_at=?,last_failure=?,last_failure_at=?,dead_lettered_at=?,claim_owner=NULL,claim_fence=NULL,claim_expires_at=NULL WHERE ${idColumn}=?`).run(status, nextEligibleAt, failureText, input.now, status === 'dead_letter' ? input.now : null, input.itemId);
      } else {
        this.database.prepare(`UPDATE ${table} SET status=?,completed_at=?,dead_lettered_at=?,last_failure=?,last_failure_at=?,claim_owner=NULL,claim_fence=NULL,claim_expires_at=NULL WHERE ${idColumn}=?`).run(status, status === 'completed' ? input.now : null, status === 'dead_letter' ? input.now : null, failureText, failure ? input.now : null, input.itemId);
      }
      this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ? AND owner_id = ? AND fence = ?').run(input.now, resourceKey, input.ownerId, input.fence);
      return status;
    });
  }

  completeSchedulerEvent(input: AgentModeSchedulerSettlement): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, 'completed'); }
  completeSchedulerSchedule(input: AgentModeSchedulerSettlement): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, 'completed'); }
  failSchedulerEvent(input: AgentModeSchedulerFailure): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, input.forceDeadLetter ? 'dead_letter' : 'failed', input); }
  failSchedulerSchedule(input: AgentModeSchedulerFailure): AgentModeSchedulerItemStatus { return this.settleSchedulerRow(input, input.forceDeadLetter ? 'dead_letter' : 'failed', input); }

  upsertSourceWatermark(input: AgentModeSourceWatermark): 'advanced' | 'duplicate' | 'stale' {
    if (!this.hasSchedulerTables || !input.sourceId || !input.watermark || !Number.isFinite(Date.parse(input.updatedAt))) throw new Error('invalid source watermark');
    return this.withTransaction(() => {
      const current = this.database.prepare('SELECT watermark FROM agent_mode_source_watermarks WHERE source_id = ?').get(input.sourceId) as { watermark?: string } | undefined;
      if (!current) {
        this.database.prepare('INSERT INTO agent_mode_source_watermarks (source_id,watermark,updated_at) VALUES (?,?,?)').run(input.sourceId, input.watermark, input.updatedAt);
        return 'advanced';
      }
      const currentWatermark = current.watermark ?? '';
      const oldTime = Date.parse(currentWatermark); const newTime = Date.parse(input.watermark);
      const comparison = Number.isFinite(oldTime) && Number.isFinite(newTime) ? newTime - oldTime : input.watermark.localeCompare(currentWatermark);
      if (comparison === 0) return 'duplicate';
      if (comparison < 0) return 'stale';
      this.database.prepare('UPDATE agent_mode_source_watermarks SET watermark=?,updated_at=? WHERE source_id=?').run(input.watermark, input.updatedAt, input.sourceId);
      return 'advanced';
    });
  }

  listSourceWatermarks(): AgentModeSourceWatermark[] {
    if (!this.hasSchedulerTables) return [];
    return (this.database.prepare('SELECT source_id,watermark,updated_at FROM agent_mode_source_watermarks ORDER BY source_id').all() as Array<Record<string, unknown>>).map((row) => ({ sourceId: String(row.source_id), watermark: String(row.watermark), updatedAt: String(row.updated_at) }));
  }

  saveLatestSchedulerTick(tick: AgentModeSchedulerTickSummary): void {
    if (!this.hasSchedulerTables) throw new Error('scheduler tables are unavailable');
    this.withTransaction(() => {
      this.database.prepare("INSERT INTO agent_mode_scheduler_observer (singleton,latest_tick_json) VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET latest_tick_json=excluded.latest_tick_json").run(JSON.stringify(tick));
    });
  }

  getLatestSchedulerTick(): AgentModeSchedulerTickSummary | undefined {
    if (!this.hasSchedulerTables) return undefined;
    const row = this.database.prepare('SELECT latest_tick_json FROM agent_mode_scheduler_observer WHERE singleton = 1').get() as { latest_tick_json?: string | null } | undefined;
    return row?.latest_tick_json ? JSON.parse(row.latest_tick_json) as AgentModeSchedulerTickSummary : undefined;
  }

  private mapEventSource(row: Record<string, unknown>): AgentModeEventSourceState {
    return {
      sourceId: String(row.source_id), sourceType: String(row.source_type), repositoryRef: String(row.repository_ref),
      adapterType: row.adapter_type as AgentModeEventSourceConfig['adapterType'],
      debounceWindowMs: Number(row.debounce_window_ms), cooldownWindowMs: Number(row.cooldown_window_ms), catchUpLimit: Number(row.catch_up_limit),
      enabled: Number(row.enabled) === 1, bootstrapWatermark: row.bootstrap_watermark === null ? null : String(row.bootstrap_watermark),
      status: row.status as AgentModeEventSourceStatus, watermark: row.watermark === null ? null : String(row.watermark),
      lastObservedAt: row.last_observed_at === null ? null : String(row.last_observed_at),
      lastSuccessfulObservation: row.last_successful_observation === null ? null : String(row.last_successful_observation),
      lastErrorReason: row.last_error_reason === null ? null : String(row.last_error_reason),
      cooldownNotBefore: row.cooldown_not_before === null ? null : String(row.cooldown_not_before),
      nextEligibleAt: row.next_eligible_at === null ? null : String(row.next_eligible_at),
      catchUpPending: Number(row.catch_up_pending) === 1, lastEmittedEventCount: Number(row.last_emitted_event_count), failureAttemptCount: Number(row.failure_attempt_count),
    };
  }

  upsertEventSource(config: AgentModeEventSourceConfig): 'created' | 'updated' | 'duplicate' | 'conflict' {
    if (!this.hasEventSourceTables) throw new Error('event source tables are unavailable');
    ensureSchedulerText(config.sourceId, 'sourceId', true); ensureSchedulerText(config.sourceType, 'sourceType', true); ensureSchedulerText(config.repositoryRef, 'repositoryRef', true);
    if (!['git.repository.revision', 'brain.task.lifecycle'].includes(config.adapterType) || !Number.isInteger(config.debounceWindowMs) || config.debounceWindowMs < 0 || config.debounceWindowMs > 300_000 || !Number.isInteger(config.cooldownWindowMs) || config.cooldownWindowMs < 0 || config.cooldownWindowMs > 300_000 || !Number.isInteger(config.catchUpLimit) || config.catchUpLimit < 1 || config.catchUpLimit > 100) throw new Error('event source configuration is outside K4.1 bounds');
    ensureSchedulerText(config.bootstrapWatermark, 'bootstrapWatermark');
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM agent_mode_event_sources WHERE source_id = ?').get(config.sourceId) as Record<string, unknown> | undefined;
      if (!existing) {
        this.database.prepare(`INSERT INTO agent_mode_event_sources
          (source_id,source_type,repository_ref,adapter_type,debounce_window_ms,cooldown_window_ms,catch_up_limit,enabled,bootstrap_watermark,status,catch_up_pending,last_emitted_event_count,failure_attempt_count)
          VALUES (?,?,?,?,?,?,?,?,?,'ready',0,0,0)`).run(config.sourceId, config.sourceType, config.repositoryRef, config.adapterType, config.debounceWindowMs, config.cooldownWindowMs, config.catchUpLimit, config.enabled ? 1 : 0, config.bootstrapWatermark);
        return 'created';
      }
      if (existing.source_type !== config.sourceType || existing.repository_ref !== config.repositoryRef || existing.adapter_type !== config.adapterType || existing.bootstrap_watermark !== config.bootstrapWatermark) return 'conflict';
      const same = Number(existing.debounce_window_ms) === config.debounceWindowMs && Number(existing.cooldown_window_ms) === config.cooldownWindowMs && Number(existing.catch_up_limit) === config.catchUpLimit && Number(existing.enabled) === (config.enabled ? 1 : 0);
      if (same) return 'duplicate';
      this.database.prepare('UPDATE agent_mode_event_sources SET debounce_window_ms=?,cooldown_window_ms=?,catch_up_limit=?,enabled=?,status=CASE WHEN ?=0 THEN \'disabled\' WHEN status=\'disabled\' THEN \'ready\' ELSE status END WHERE source_id=?').run(config.debounceWindowMs, config.cooldownWindowMs, config.catchUpLimit, config.enabled ? 1 : 0, config.enabled ? 1 : 0, config.sourceId);
      return 'updated';
    });
  }

  listEventSources(): AgentModeEventSourceState[] {
    if (!this.hasEventSourceTables) return [];
    return (this.database.prepare('SELECT * FROM agent_mode_event_sources ORDER BY source_id').all() as Array<Record<string, unknown>>).map((row) => this.mapEventSource(row));
  }

  getEventSource(sourceId: string): AgentModeEventSourceState | undefined {
    if (!this.hasEventSourceTables) return undefined;
    const row = this.database.prepare('SELECT * FROM agent_mode_event_sources WHERE source_id = ?').get(sourceId) as Record<string, unknown> | undefined;
    return row ? this.mapEventSource(row) : undefined;
  }

  ingestSchedulerEventsAndAdvanceSource(input: { sourceId: string; observedAt: string; observedWatermark: string; events: AgentModeSchedulerEventInput[]; hasMore: boolean; cooldownNotBefore: string | null }): { created: number; duplicates: number } {
    if (!this.hasEventSourceTables) throw new Error('event source tables are unavailable');
    if (!this.getEventSource(input.sourceId)) throw new Error(`event source not found: ${input.sourceId}`);
    const created = { count: 0 }; const duplicates = { count: 0 };
    this.withTransaction(() => {
      for (const event of input.events) {
        if (event.source !== input.sourceId) throw new Error('scheduler event source does not match event source');
        const result = this.createSchedulerEvent(event);
        if (result === 'conflict') throw new Error(`scheduler event conflict: ${event.eventId}`);
        if (result === 'created') created.count += 1; else duplicates.count += 1;
      }
      this.database.prepare(`UPDATE agent_mode_event_sources SET status=?,watermark=?,last_observed_at=?,last_successful_observation=?,last_error_reason=NULL,cooldown_not_before=?,next_eligible_at=?,catch_up_pending=?,last_emitted_event_count=?,failure_attempt_count=0 WHERE source_id=?`).run(input.cooldownNotBefore && input.cooldownNotBefore > input.observedAt ? 'cooldown' : 'ready', input.observedWatermark, input.observedAt, input.observedAt, input.cooldownNotBefore, input.cooldownNotBefore, input.hasMore ? 1 : 0, input.events.length, input.sourceId);
    });
    return { created: created.count, duplicates: duplicates.count };
  }

  recordEventSourceFailure(input: { sourceId: string; observedAt: string; status: 'failed' | 'diverged'; reason: string }): void {
    if (!this.hasEventSourceTables) throw new Error('event source tables are unavailable');
    this.withTransaction(() => {
      const source = this.getEventSource(input.sourceId);
      if (!source) throw new Error(`event source not found: ${input.sourceId}`);
      const attempts = input.status === 'diverged' ? source.failureAttemptCount : source.failureAttemptCount + 1;
      const nextEligibleAt = input.status === 'diverged' ? null : new Date(Date.parse(input.observedAt) + Math.min(300_000, 1_000 * (2 ** Math.max(0, attempts - 1)))).toISOString();
      this.database.prepare('UPDATE agent_mode_event_sources SET status=?,last_observed_at=?,last_error_reason=?,next_eligible_at=?,failure_attempt_count=? WHERE source_id=?').run(input.status, input.observedAt, input.reason.slice(0, 256), nextEligibleAt, attempts, input.sourceId);
    });
  }

  close(): void {
    this.database.close();
  }
}
