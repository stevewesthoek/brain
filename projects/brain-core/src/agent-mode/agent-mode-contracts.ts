import { createHash } from 'node:crypto';

/** The smallest Brain-owned admission vocabulary for the first Agent Mode slice. */
export const AGENT_MODE_CONTRACT_VERSION = 'agent-mode-contracts-v1';

export type AgentId = string;
export type TaskId = string;
export type RunId = string;
export type AttemptId = string;
export type OperationId = string;
export type CapabilityId = string;
export type PolicyVersion = string;
export type ResourceRef = string;

export type QuotaState = 'available' | 'constrained' | 'exhausted' | 'unknown';
export type AdmissionMode = 'automatic' | 'human_override';
export type AdmissionCode =
  | 'admitted'
  | 'invalid_contract'
  | 'route_not_admitted'
  | 'route_evidence_missing'
  | 'route_evidence_stale'
  | 'quota_unknown'
  | 'quota_exhausted'
  | 'model_not_allowed'
  | 'grant_missing'
  | 'grant_expired'
  | 'effect_not_granted'
  | 'scope_mismatch'
  | 'policy_mismatch'
  | 'lease_missing'
  | 'lease_expired'
  | 'stale_lease_fence'
  | 'budget_exhausted'
  | 'duplicate_operation'
  | 'operation_conflict'
  | 'cancellation_requested';

export type EffectKind =
  | 'model.invoke'
  | 'capability.read'
  | 'capability.write'
  | 'runtime.child'
  | 'runtime.schedule'
  | 'runtime.shell';

export interface AccessEvidence {
  state: 'verified' | 'unverified' | 'denied';
  checkedAt: string;
  freshUntil: string;
  source: string;
}

export interface ModelRouteBinding {
  routeKind: 'amazon-bedrock' | 'codex-subscription';
  vendor: 'minimax' | 'zai' | 'anthropic' | 'openai' | 'unknown';
  modelRef: string;
  invocationRef: string;
  accountRef: ResourceRef;
  region?: string;
  access: AccessEvidence;
  quotaState?: QuotaState;
}

export interface BudgetState {
  maxSteps: number;
  usedSteps: number;
  reservedSteps: number;
  maxTokens: number;
  usedTokens: number;
  reservedTokens: number;
  maxDollars: number;
  usedDollars: number;
  reservedDollars: number;
}

export interface BudgetEstimate {
  steps: number;
  tokens: number;
  dollars: number;
}

export interface CapabilityGrant {
  grantId: string;
  capabilityId: CapabilityId;
  allowedEffects: readonly EffectKind[];
  scopeHash: string;
  policyVersion: PolicyVersion;
  expiresAt: string;
}

export interface LeaseFence {
  resourceRef: ResourceRef;
  fence: number;
  ownerAttemptId: AttemptId;
  expiresAt: string;
}

export interface AttemptAdmissionRequest {
  agentId: AgentId;
  taskId: TaskId;
  runId: RunId;
  attemptId: AttemptId;
  mode: AdmissionMode;
  allowedModelRefs: readonly string[];
  route: ModelRouteBinding;
  runtimeRef: ResourceRef;
  capabilityGrants: readonly CapabilityGrant[];
  budget: BudgetState;
  estimate: BudgetEstimate;
  now: string;
  overrideRef?: string;
}

export interface AdmissionDecision {
  ok: boolean;
  code: AdmissionCode;
  reason: string;
}

export interface OperationCommand {
  operationId: OperationId;
  attemptId: AttemptId;
  kind: EffectKind;
  capabilityId: CapabilityId;
  scopeHash: string;
  policyVersion: PolicyVersion;
  lease?: LeaseFence;
  deadline: string;
}

export interface OperationReceipt {
  operationId: OperationId;
  attemptId: AttemptId;
  scopeHash: string;
  effectHash: string;
  status: 'succeeded' | 'failed';
  recordedAt: string;
}

export interface OperationRecord {
  operationId: OperationId;
  attemptId: AttemptId;
  scopeHash: string;
  status: 'outbox' | 'effect_applied' | 'receipt_recorded' | 'uncertain';
  receipt?: OperationReceipt;
}

export interface ResultVerification {
  resultRef: string;
  evidenceRef: string;
  verifier: string;
  verifiedAt: string;
  passed: boolean;
}

export type CancellationStatus = 'running' | 'requested' | 'acknowledged' | 'completed';

export interface CancellationState {
  status: CancellationStatus;
  requestedAt?: string;
  acknowledgedAt?: string;
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isFresh(evidence: AccessEvidence, now: string): boolean {
  return isIsoDate(evidence.checkedAt) && isIsoDate(evidence.freshUntil)
    && Date.parse(evidence.checkedAt) <= Date.parse(now)
    && Date.parse(now) < Date.parse(evidence.freshUntil);
}

function invalid(value: string): boolean {
  return value.trim().length === 0;
}

function budgetAvailable(budget: BudgetState, estimate: BudgetEstimate): boolean {
  return estimate.steps >= 0 && estimate.tokens >= 0 && estimate.dollars >= 0
    && budget.usedSteps + budget.reservedSteps + estimate.steps <= budget.maxSteps
    && budget.usedTokens + budget.reservedTokens + estimate.tokens <= budget.maxTokens
    && budget.usedDollars + budget.reservedDollars + estimate.dollars <= budget.maxDollars;
}

export function hashScope(scope: string): string {
  return createHash('sha256').update(scope).digest('hex');
}

export function admitAttempt(request: AttemptAdmissionRequest): AdmissionDecision {
  const required = [request.agentId, request.taskId, request.runId, request.attemptId, request.runtimeRef];
  if (required.some(invalid) || !isIsoDate(request.now) || !isIsoDate(request.route.access.freshUntil)) {
    return { ok: false, code: 'invalid_contract', reason: 'attempt identity, runtime, or time fields are invalid' };
  }
  if (request.route.access.state !== 'verified') {
    return { ok: false, code: 'route_evidence_missing', reason: 'route access is not verified' };
  }
  if (!isFresh(request.route.access, request.now)) {
    return { ok: false, code: 'route_evidence_stale', reason: 'route access evidence is stale' };
  }
  if (!request.allowedModelRefs.includes(request.route.modelRef)) {
    return { ok: false, code: 'model_not_allowed', reason: 'route model is outside the admitted policy' };
  }
  if (request.route.routeKind === 'codex-subscription') {
    const quota = request.route.quotaState ?? 'unknown';
    if (quota === 'unknown' && !(request.mode === 'human_override' && request.overrideRef)) {
      return { ok: false, code: 'quota_unknown', reason: 'automatic Codex admission requires fresh quota evidence' };
    }
    if (quota === 'exhausted') {
      return { ok: false, code: 'quota_exhausted', reason: 'Codex quota is exhausted' };
    }
  }
  if (!budgetAvailable(request.budget, request.estimate)) {
    return { ok: false, code: 'budget_exhausted', reason: 'attempt estimate exceeds the reserved budget' };
  }
  return { ok: true, code: 'admitted', reason: 'attempt passed offline admission checks' };
}

export function admitOperation(
  command: OperationCommand,
  grants: readonly CapabilityGrant[],
  now: string,
  currentFence?: number,
): AdmissionDecision {
  if (invalid(command.operationId) || invalid(command.attemptId) || invalid(command.capabilityId)
    || invalid(command.scopeHash) || invalid(command.policyVersion) || !isIsoDate(now)
    || !isIsoDate(command.deadline) || Date.parse(command.deadline) < Date.parse(now)) {
    return { ok: false, code: 'invalid_contract', reason: 'operation identity, scope, policy, deadline, or time fields are invalid' };
  }
  const grant = grants.find((candidate) => candidate.capabilityId === command.capabilityId);
  if (!grant) return { ok: false, code: 'grant_missing', reason: 'capability grant is absent' };
  if (!grant.allowedEffects.includes(command.kind)) {
    return { ok: false, code: 'effect_not_granted', reason: `effect ${command.kind} is not granted` };
  }
  if (Date.parse(grant.expiresAt) <= Date.parse(now)) {
    return { ok: false, code: 'grant_expired', reason: 'capability grant has expired' };
  }
  if (grant.scopeHash !== command.scopeHash) {
    return { ok: false, code: 'scope_mismatch', reason: 'operation scope does not match the grant' };
  }
  if (grant.policyVersion !== command.policyVersion) {
    return { ok: false, code: 'policy_mismatch', reason: 'operation policy version does not match the grant' };
  }
  if (command.kind === 'capability.write' || command.kind === 'runtime.shell') {
    if (!command.lease) return { ok: false, code: 'lease_missing', reason: 'write-like effects require a lease fence' };
    if (currentFence === undefined || !Number.isInteger(currentFence) || command.lease.fence !== currentFence) {
      return { ok: false, code: 'stale_lease_fence', reason: 'lease fence is not the current resource fence' };
    }
    if (command.lease.ownerAttemptId !== command.attemptId) {
      return { ok: false, code: 'stale_lease_fence', reason: 'lease fence belongs to another attempt' };
    }
    if (Date.parse(command.lease.expiresAt) <= Date.parse(now)) {
      return { ok: false, code: 'lease_expired', reason: 'lease fence is expired' };
    }
  }
  return { ok: true, code: 'admitted', reason: 'operation passed offline capability checks' };
}

export function reserveBudget(budget: BudgetState, estimate: BudgetEstimate): BudgetState {
  if (!budgetAvailable(budget, estimate)) throw new Error('budget exhausted');
  return {
    ...budget,
    reservedSteps: budget.reservedSteps + estimate.steps,
    reservedTokens: budget.reservedTokens + estimate.tokens,
    reservedDollars: budget.reservedDollars + estimate.dollars,
  };
}

export function reconcileOperation(input: {
  record: OperationRecord;
  receipt?: OperationReceipt;
  effectObserved: boolean;
}): 'duplicate' | 'receipt_recorded' | 'uncertain' | 'pending' | 'conflict' {
  const { record, receipt, effectObserved } = input;
  if (receipt) {
    if (receipt.operationId !== record.operationId || receipt.scopeHash !== record.scopeHash) return 'conflict';
    return record.receipt ? 'duplicate' : 'receipt_recorded';
  }
  if (effectObserved || record.status === 'effect_applied' || record.status === 'uncertain') return 'uncertain';
  return 'pending';
}

export function requestCancellation(state: CancellationState, now: string): CancellationState {
  if (!isIsoDate(now) || state.status === 'completed' || state.status === 'acknowledged') return state;
  if (state.status === 'requested') return state;
  return { status: 'requested', requestedAt: now };
}

export function acknowledgeCancellation(state: CancellationState, now: string): CancellationState {
  if (!isIsoDate(now) || state.status !== 'requested') return state;
  return { ...state, status: 'acknowledged', acknowledgedAt: now };
}

export function canDispatch(state: CancellationState): boolean {
  return state.status === 'running';
}

export function verifyResult(
  resultRef: string,
  evidenceRef: string,
  verifier: string,
  passed: boolean,
  verifiedAt: string,
): ResultVerification {
  if ([resultRef, evidenceRef, verifier].some(invalid) || !isIsoDate(verifiedAt)) {
    throw new Error('invalid verification contract');
  }
  return { resultRef, evidenceRef, verifier, passed, verifiedAt };
}
