import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  GitCliWorkcellAdapter,
  type GitDiffCapture,
  type GitWorkcellAdapter,
  type WorkcellCapability,
} from './workcell.js';
import type {
  AgentModeSqliteStateStore,
  AgentModeWorkcell,
  AgentModeWorkcellDiffEvidence,
  AgentModeWorkcellValidationEvidence,
  AgentModeWriterLease,
  AgentModeWriterReceipt,
} from './sqlite-state-store.js';

export type WriterLeaseRequest = {
  workcellId: string;
  leaseId: string;
  ownerAgent: string;
  ownerAttempt: string;
  createdAt: string;
  expiresAt: string;
};

export type WriteAdmissionRequest = {
  workcellId: string;
  capability: WorkcellCapability | string;
  ownerAgent: string;
  ownerAttempt: string;
  leaseId?: string | null;
  fenceToken?: number | null;
  repositoryRoot: string;
  worktreePath: string;
  now: string;
};

export type DiffCaptureRequest = WriteAdmissionRequest;

export type ValidationRequest = {
  diffId: string;
  actor: string;
  requestedAt: string;
  result: 'passed' | 'failed' | 'unknown';
};

export class WorkcellWriteRejectedError extends Error {
  constructor(readonly reason: string, readonly operationHash: string, readonly receipt?: AgentModeWriterReceipt) {
    super(`Workcell write rejected: ${reason}`);
    this.name = 'WorkcellWriteRejectedError';
  }
}

function hashOperation(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function writerReceipt(
  workcell: AgentModeWorkcell,
  receiptType: AgentModeWriterReceipt['receiptType'],
  operation: string,
  timestamp: string,
  resultState: string,
  leaseId: string | null,
  fenceToken: number | null,
  extra: Record<string, unknown> = {},
): AgentModeWriterReceipt {
  const operationHash = hashOperation({ receiptType, operation, workcellId: workcell.workcellId, leaseId, fenceToken, resultState, ...extra });
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

function ensureTimestamp(value: string, name: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`invalid ${name}`);
}

async function bindingPath(value: string): Promise<string> {
  const resolved = path.resolve(value);
  try { return path.resolve(await realpath(resolved)); } catch { return resolved; }
}

export type WorkcellWriterManagerOptions = {
  store: AgentModeSqliteStateStore;
  git?: GitWorkcellAdapter;
};

export class WorkcellWriterManager {
  private readonly git: GitWorkcellAdapter;

  constructor(private readonly options: WorkcellWriterManagerOptions) {
    this.git = options.git ?? new GitCliWorkcellAdapter();
  }

  grantLease(request: WriterLeaseRequest): { result: 'granted' | 'duplicate' | 'rejected'; lease?: AgentModeWriterLease; receipt: AgentModeWriterReceipt; reason?: string } {
    if (!request.leaseId || !request.ownerAgent || !request.ownerAttempt) throw new Error('writer lease identity is incomplete');
    ensureTimestamp(request.createdAt, 'lease createdAt');
    ensureTimestamp(request.expiresAt, 'lease expiresAt');
    if (Date.parse(request.expiresAt) <= Date.parse(request.createdAt)) throw new Error('writer lease must expire after creation');
    return this.options.store.grantWorkcellWriterLease(request);
  }

  releaseLease(request: { leaseId: string; ownerAgent: string; ownerAttempt: string; releasedAt: string }): { result: 'released' | 'duplicate' | 'rejected'; lease: AgentModeWriterLease; receipt: AgentModeWriterReceipt; reason?: string } {
    ensureTimestamp(request.releasedAt, 'lease releasedAt');
    return this.options.store.releaseWorkcellWriterLease(request);
  }

  expireLeases(now: string): AgentModeWriterLease[] {
    ensureTimestamp(now, 'lease recovery time');
    return this.options.store.expireWorkcellWriterLeases(now);
  }

  async admitWrite(request: WriteAdmissionRequest): Promise<{ ok: boolean; reason: string; operationHash: string; receipt?: AgentModeWriterReceipt }> {
    const leaseId = request.leaseId ?? null;
    const fenceToken = request.fenceToken ?? null;
    const workcell = this.options.store.getWorkcell(request.workcellId);
    const repositoryRoot = await bindingPath(request.repositoryRoot);
    const worktreePath = await bindingPath(request.worktreePath);
    let resourceValid = false;
    if (workcell) {
      try {
        const inspection = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
        resourceValid = path.resolve(inspection.repositoryRoot) === path.resolve(workcell.repositoryRoot)
          && inspection.branch === workcell.branch
          && worktreePath === path.resolve(workcell.worktreePath);
      } catch {
        resourceValid = false;
      }
    }
    return this.options.store.admitWorkcellWrite({
      ...request,
      leaseId,
      fenceToken,
      repositoryRoot,
      worktreePath,
      resourceValid,
    });
  }

  async captureDiff(request: DiffCaptureRequest): Promise<AgentModeWorkcellDiffEvidence> {
    const workcell = this.options.store.getWorkcell(request.workcellId);
    if (!workcell) throw new Error(`workcell not found: ${request.workcellId}`);
    const admission = await this.admitWrite(request);
    if (!admission.ok) throw new WorkcellWriteRejectedError(admission.reason, admission.operationHash, admission.receipt);
    const capture = await this.git.captureDiff({ worktreePath: workcell.worktreePath, baseRef: workcell.baseRef });
    const diffId = `diff:${hashOperation({ workcellId: workcell.workcellId, leaseId: request.leaseId ?? null, fenceToken: request.fenceToken ?? null, ...capture })}`;
    const diff = this.makeDiffEvidence(workcell, request, capture, diffId);
    const receipt = writerReceipt(workcell, 'DiffCapturedReceipt', 'diff-capture', request.now, 'captured', request.leaseId ?? null, request.fenceToken ?? null, { diffId, diffHash: capture.diffHash });
    const result = this.options.store.recordWorkcellDiff(diff, receipt);
    if (result === 'conflict') throw new Error(`diff evidence conflict: ${diffId}`);
    return diff;
  }

  requestValidation(request: ValidationRequest): AgentModeWorkcellValidationEvidence {
    if (!request.actor) throw new Error('validation actor is required');
    ensureTimestamp(request.requestedAt, 'validation requestedAt');
    const diff = this.options.store.getWorkcellDiff(request.diffId);
    if (!diff) throw new Error(`diff evidence not found: ${request.diffId}`);
    const workcell = this.options.store.getWorkcell(diff.workcellId);
    if (!workcell) throw new Error(`workcell not found: ${diff.workcellId}`);
    const state: AgentModeWorkcellValidationEvidence['state'] = request.result === 'passed' ? 'validation_ready' : 'rejected';
    const validationId = `validation:${hashOperation({ diffId: request.diffId, requestedAt: request.requestedAt, result: request.result })}`;
    const validation: AgentModeWorkcellValidationEvidence = {
      validationId,
      diffId: diff.diffId,
      taskId: workcell.taskId,
      runId: workcell.runId,
      attemptId: workcell.attemptId,
      workcellId: workcell.workcellId,
      requestedAt: request.requestedAt,
      result: request.result,
      state,
      recordedAt: request.requestedAt,
    };
    const receipt = writerReceipt(workcell, 'ValidationAdmissionReceipt', 'validation-admission', request.requestedAt, state, diff.leaseId, diff.fenceToken, { diffId: diff.diffId, validationId, actor: request.actor, result: request.result });
    const result = this.options.store.recordWorkcellValidation(validation, receipt);
    if (result === 'conflict') throw new Error(`validation evidence conflict: ${validationId}`);
    return validation;
  }

  private makeDiffEvidence(workcell: AgentModeWorkcell, request: DiffCaptureRequest, capture: GitDiffCapture, diffId: string): AgentModeWorkcellDiffEvidence {
    return {
      diffId,
      taskId: workcell.taskId,
      runId: workcell.runId,
      attemptId: workcell.attemptId,
      workcellId: workcell.workcellId,
      repositoryRef: workcell.repositoryRef,
      branch: workcell.branch,
      baseRevision: capture.baseRevision,
      currentRevision: capture.currentRevision,
      changedFiles: capture.changedFiles,
      diffHash: capture.diffHash,
      leaseId: request.leaseId ?? '',
      fenceToken: request.fenceToken ?? 0,
      capturedAt: request.now,
    };
  }
}
