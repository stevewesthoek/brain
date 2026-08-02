import { createHash } from 'node:crypto';

export type CapabilityLifecycleState = 'planned' | 'candidate' | 'configured' | 'deployed' | 'observed' | 'verified' | 'paused' | 'retired' | 'blocked' | 'unknown';
export type WorkerReceiptStatus = 'succeeded' | 'failed' | 'blocked' | 'idempotent-replay';

export interface TypedCapabilityWorkerDefinition {
  capabilityId: 'capability-state-report';
  owner: 'brain-runtime';
  contractId: 'capability-state-contract';
  privilege: 'local-read-only';
  readScope: 'fixture-capability-state';
  writeScope: 'none';
  mode: 'report-only';
  timeoutMs: number;
  maxRetries: number;
  killSwitch: 'BS0.18_TYPED_CAPABILITY_WORKERS';
}

export interface CapabilityStateSnapshot {
  repositoryState: CapabilityLifecycleState;
  deploymentState: CapabilityLifecycleState;
  observationState: CapabilityLifecycleState;
  verificationState: CapabilityLifecycleState;
  recordCount: number;
}

export interface TypedCapabilityWorkerInput {
  capabilityId: string;
  requestId: string;
  idempotencyKey: string;
  requestedAt: string;
  owner: string;
  contractId: string;
  privilege: string;
  readScope: string;
  writeScope: string;
  operation: 'report';
  killSwitchEnabled: boolean;
  snapshot: CapabilityStateSnapshot;
  simulation?: {
    durationMs?: number;
    failuresBeforeSuccess?: number;
    failureCode?: string;
  };
  modelSupplied?: Record<string, unknown>;
}

export interface TypedCapabilityWorkerReceipt {
  receiptVersion: '1.0.0';
  status: WorkerReceiptStatus;
  capabilityId: string;
  requestId: string;
  idempotencyKey: string;
  requestHash: string;
  generatedAt: string;
  owner: string;
  contractId: string;
  privilege: string;
  readScope: string;
  writeScope: string;
  mode: 'report-only';
  killSwitch: { id: string; enabled: boolean };
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  timedOut: boolean;
  failure: null | { code: string; retryable: boolean; exhausted: boolean };
  state: CapabilityStateSnapshot;
  output: null | { kind: 'capability-state-report'; recordCount: number; summaryHash: string };
  writesToMind: false;
  externalWrites: false;
}

export class TypedCapabilityWorkerError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export const CAPABILITY_STATE_REPORT_WORKER: TypedCapabilityWorkerDefinition = Object.freeze({
  capabilityId: 'capability-state-report',
  owner: 'brain-runtime',
  contractId: 'capability-state-contract',
  privilege: 'local-read-only',
  readScope: 'fixture-capability-state',
  writeScope: 'none',
  mode: 'report-only',
  timeoutMs: 250,
  maxRetries: 2,
  killSwitch: 'BS0.18_TYPED_CAPABILITY_WORKERS',
});

const FORBIDDEN_MODEL_FIELDS = new Set(['owner', 'contractId', 'privilege', 'readScope', 'writeScope', 'operation', 'authorization', 'killSwitchEnabled']);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
};

function validateState(snapshot: CapabilityStateSnapshot): void {
  const states = ['planned','candidate','configured','deployed','observed','verified','paused','retired','blocked','unknown'];
  for (const value of [snapshot.repositoryState, snapshot.deploymentState, snapshot.observationState, snapshot.verificationState]) {
    if (!states.includes(value)) throw new TypedCapabilityWorkerError('invalid_state');
  }
  if (!Number.isInteger(snapshot.recordCount) || snapshot.recordCount < 0) throw new TypedCapabilityWorkerError('invalid_input');
}

function validateAuthority(input: TypedCapabilityWorkerInput): void {
  const definition = CAPABILITY_STATE_REPORT_WORKER;
  if (input.capabilityId !== definition.capabilityId) throw new TypedCapabilityWorkerError('unknown_capability');
  if (!input.requestId || !input.idempotencyKey || !Number.isFinite(Date.parse(input.requestedAt))) throw new TypedCapabilityWorkerError('invalid_input');
  if (!input.owner || !input.contractId) throw new TypedCapabilityWorkerError('missing_owner_or_contract');
  if (input.owner !== definition.owner || input.contractId !== definition.contractId) throw new TypedCapabilityWorkerError('authority_scope_mismatch');
  if (input.privilege !== definition.privilege || input.readScope !== definition.readScope || input.writeScope !== definition.writeScope) throw new TypedCapabilityWorkerError('scope_expansion');
  if (input.operation !== 'report') throw new TypedCapabilityWorkerError('unsupported_mutation_request');
  for (const key of Object.keys(input.modelSupplied ?? {})) if (FORBIDDEN_MODEL_FIELDS.has(key)) throw new TypedCapabilityWorkerError('model_supplied_authority');
  validateState(input.snapshot);
}

export function runTypedCapabilityWorker(input: TypedCapabilityWorkerInput, receipts = new Map<string, TypedCapabilityWorkerReceipt>()): TypedCapabilityWorkerReceipt {
  validateAuthority(input);
  const definition = CAPABILITY_STATE_REPORT_WORKER;
  const requestHash = sha256(canonicalJson({ capabilityId: input.capabilityId, idempotencyKey: input.idempotencyKey, snapshot: input.snapshot, simulation: input.simulation ?? null }));
  const existing = receipts.get(input.idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) throw new TypedCapabilityWorkerError('idempotency_conflict');
    return { ...existing, status: 'idempotent-replay' };
  }
  const maxAttempts = definition.maxRetries + 1;
  const durationMs = input.simulation?.durationMs ?? 0;
  const failuresBeforeSuccess = input.simulation?.failuresBeforeSuccess ?? 0;
  let status: WorkerReceiptStatus = 'succeeded';
  let attempts = 1;
  let timedOut = false;
  let failure: TypedCapabilityWorkerReceipt['failure'] = null;
  let output: TypedCapabilityWorkerReceipt['output'] = null;

  if (!input.killSwitchEnabled) {
    status = 'blocked';
    failure = { code: 'kill_switch_disabled', retryable: false, exhausted: false };
  } else if (durationMs > definition.timeoutMs) {
    status = 'failed';
    timedOut = true;
    attempts = maxAttempts;
    failure = { code: 'timeout', retryable: true, exhausted: true };
  } else if (failuresBeforeSuccess >= maxAttempts) {
    status = 'failed';
    attempts = maxAttempts;
    failure = { code: input.simulation?.failureCode ?? 'retry_exhausted', retryable: true, exhausted: true };
  } else {
    attempts = Math.min(failuresBeforeSuccess + 1, maxAttempts);
    output = {
      kind: 'capability-state-report',
      recordCount: input.snapshot.recordCount,
      summaryHash: sha256(canonicalJson(input.snapshot)),
    };
  }

  const receipt: TypedCapabilityWorkerReceipt = {
    receiptVersion: '1.0.0', status, capabilityId: input.capabilityId, requestId: input.requestId,
    idempotencyKey: input.idempotencyKey, requestHash, generatedAt: input.requestedAt,
    owner: definition.owner, contractId: definition.contractId, privilege: definition.privilege,
    readScope: definition.readScope, writeScope: definition.writeScope, mode: definition.mode,
    killSwitch: { id: definition.killSwitch, enabled: input.killSwitchEnabled }, attempts, maxAttempts,
    timeoutMs: definition.timeoutMs, timedOut, failure, state: input.snapshot, output,
    writesToMind: false, externalWrites: false,
  };
  receipts.set(input.idempotencyKey, receipt);
  return receipt;
}
