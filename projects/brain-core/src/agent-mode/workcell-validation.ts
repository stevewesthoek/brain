import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  type AgentModeSqliteStateStore,
  type AgentModeWorkcell,
  type AgentModeWorkcellDiffEvidence,
  type AgentModeWorkcellValidation,
  type AgentModeWorkcellValidationReceipt,
} from './sqlite-state-store.js';
import {
  GitCliWorkcellAdapter,
  type GitDiffCapture,
  type GitWorkcellAdapter,
} from './workcell.js';

export const GIT_DIFF_INTEGRITY_VALIDATOR = 'git.diff.integrity' as const;
export const GIT_DIFF_INTEGRITY_EVIDENCE_FORMAT = 'git-diff-integrity/v1' as const;

export type ValidatorProfileId = typeof GIT_DIFF_INTEGRITY_VALIDATOR;

export type ValidatorProfile = {
  id: ValidatorProfileId;
  repositoryType: 'git-workcell';
  allowedOperation: 'fixed-git-diff-integrity';
  timeoutMs: number;
  maxEvidenceBytes: number;
  evidenceFormat: typeof GIT_DIFF_INTEGRITY_EVIDENCE_FORMAT;
};

const BUILTIN_PROFILE: ValidatorProfile = Object.freeze({
  id: GIT_DIFF_INTEGRITY_VALIDATOR,
  repositoryType: 'git-workcell',
  allowedOperation: 'fixed-git-diff-integrity',
  timeoutMs: 15_000,
  maxEvidenceBytes: 32 * 1024,
  evidenceFormat: GIT_DIFF_INTEGRITY_EVIDENCE_FORMAT,
});

export class WorkcellValidatorRegistry {
  get(profileId: string): ValidatorProfile | undefined {
    return profileId === BUILTIN_PROFILE.id ? BUILTIN_PROFILE : undefined;
  }

  list(): readonly ValidatorProfile[] {
    return [BUILTIN_PROFILE];
  }
}

export type WorkcellValidationRequest = {
  validationId?: string;
  workcellId: string;
  validationProfile: string;
  capability: string;
  ownerAgent: string;
  ownerAttempt: string;
  leaseId: string;
  fenceToken: number;
  repositoryRoot: string;
  worktreePath: string;
  now: string;
};

export type ValidatorEvidence = {
  evidenceHash: string;
  evidenceJson: string;
  result: 'passed' | 'failed';
};

export type WorkcellValidatorExecutor = (input: {
  profile: ValidatorProfile;
  workcell: AgentModeWorkcell;
  diff: AgentModeWorkcellDiffEvidence;
}) => Promise<ValidatorEvidence>;

export type WorkcellValidationResult = {
  result: 'passed' | 'failed' | 'rejected' | 'duplicate' | 'interrupted' | 'timed_out';
  validation?: AgentModeWorkcellValidation;
  receipt?: AgentModeWorkcellValidationReceipt;
  reason?: string;
};

export type WorkcellValidationFailurePoint = 'after-start' | 'after-completion';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function ensureTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error('invalid validation timestamp');
}

function canonical(value: string): Promise<string> {
  return realpath(path.resolve(value));
}

async function bindingPath(value: string): Promise<string> {
  try { return await canonical(value); } catch { return path.resolve(value); }
}

function operationHash(input: { validationId: string; workcellId: string; profile: string; diffId: string | null; leaseId: string; fenceToken: number }): string {
  return hash(JSON.stringify(input));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('validation_timeout')), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

export class WorkcellValidationManager {
  private readonly git: GitWorkcellAdapter;
  private readonly registry: WorkcellValidatorRegistry;

  constructor(private readonly options: {
    store: AgentModeSqliteStateStore;
    git?: GitWorkcellAdapter;
    registry?: WorkcellValidatorRegistry;
    executor?: WorkcellValidatorExecutor;
    failureInjector?: (point: WorkcellValidationFailurePoint) => void;
  }) {
    this.git = options.git ?? new GitCliWorkcellAdapter();
    this.registry = options.registry ?? new WorkcellValidatorRegistry();
  }

  async run(request: WorkcellValidationRequest): Promise<WorkcellValidationResult> {
    ensureTimestamp(request.now);
    if (!request.workcellId || !request.ownerAgent || !request.ownerAttempt || !request.leaseId) throw new Error('validation authorization is incomplete');
    if (!Number.isInteger(request.fenceToken) || request.fenceToken < 1) throw new Error('validation fence token is invalid');
    const workcell = this.options.store.getWorkcell(request.workcellId);
    if (!workcell) throw new Error(`workcell not found: ${request.workcellId}`);
    const profile = this.registry.get(request.validationProfile);
    const diff = this.options.store.getLatestWorkcellDiff(request.workcellId);
    const validationId = request.validationId ?? `validation-run:${hash(JSON.stringify({ workcellId: request.workcellId, profile: request.validationProfile, diffId: diff?.diffId ?? null, leaseId: request.leaseId, fenceToken: request.fenceToken }))}`;
    const opHash = operationHash({ validationId, workcellId: request.workcellId, profile: request.validationProfile, diffId: diff?.diffId ?? null, leaseId: request.leaseId, fenceToken: request.fenceToken });
    const resourceValid = await this.validResourceBinding(workcell, request);
    const started = this.options.store.startWorkcellValidation({
      validationId,
      workcellId: request.workcellId,
      capability: request.capability,
      ownerAgent: request.ownerAgent,
      ownerAttempt: request.ownerAttempt,
      leaseId: request.leaseId,
      fenceToken: request.fenceToken,
      repositoryRoot: await bindingPath(request.repositoryRoot),
      worktreePath: await bindingPath(request.worktreePath),
      resourceValid,
      validatorAllowed: profile !== undefined,
      validatorProfile: request.validationProfile,
      diffId: diff?.diffId ?? null,
      operationHash: opHash,
      startedAt: request.now,
    });
    if (started.result === 'rejected') {
      if (!started.reason || !started.validation || !started.receipt) throw new Error('rejected validation admission was incomplete');
      return { result: 'rejected', reason: started.reason, validation: started.validation, receipt: started.receipt };
    }
    if (started.result === 'conflict') {
      if (!started.reason || !started.validation) throw new Error('conflicting validation admission was incomplete');
      return { result: 'rejected', reason: started.reason, validation: started.validation };
    }
    if (!started.validation) throw new Error('started validation was not returned');
    if (started.result === 'duplicate') {
      if (!started.receipt) throw new Error('duplicate validation receipt is missing');
      if (started.validation.status === 'completed') return { result: started.validation.result as 'passed' | 'failed', validation: started.validation, receipt: started.receipt };
      if (started.validation.status === 'rejected') return { result: 'rejected', reason: 'previously_rejected', validation: started.validation, receipt: started.receipt };
      return { result: 'rejected', reason: 'validation_already_started', validation: started.validation, receipt: started.receipt };
    }
    if (!profile || !diff) throw new Error('validation admission did not reject an invalid request');
    this.options.failureInjector?.('after-start');
    let completedResult: WorkcellValidationResult | undefined;
    try {
      const evidence = await withTimeout(this.options.executor?.({ profile, workcell, diff }) ?? this.executeBuiltIn(profile, workcell, diff), profile.timeoutMs);
      if (Buffer.byteLength(evidence.evidenceJson, 'utf8') > profile.maxEvidenceBytes) {
        const rejected = this.options.store.rejectWorkcellValidation(validationId, 'rejected', request.now);
        return { result: 'rejected', reason: 'evidence_exceeds_profile_bound', validation: rejected.validation, receipt: rejected.receipt };
      }
      this.options.store.completeWorkcellValidation({ validationId, evidenceHash: evidence.evidenceHash, evidenceJson: evidence.evidenceJson, result: evidence.result, completedAt: request.now });
      const validation = this.options.store.getWorkcellValidationRun(validationId);
      const receipt = this.options.store.getWorkcellValidationRunReceipt(validationId);
      if (!validation || !receipt) throw new Error(`validation completion evidence missing: ${validationId}`);
      completedResult = { result: evidence.result, validation, receipt };
    } catch (error) {
      const result = error instanceof Error && error.message === 'validation_timeout' ? 'timed_out' : 'interrupted';
      const rejected = this.options.store.rejectWorkcellValidation(validationId, result, request.now);
      return { result, reason: result, validation: rejected.validation, receipt: rejected.receipt };
    }
    this.options.failureInjector?.('after-completion');
    return completedResult as WorkcellValidationResult;
  }

  reconcile(validationId: string, now: string): WorkcellValidationResult {
    ensureTimestamp(now);
    const validation = this.options.store.getWorkcellValidationRun(validationId);
    if (!validation) throw new Error(`workcell validation not found: ${validationId}`);
    if (validation.status === 'started') {
      const rejected = this.options.store.rejectWorkcellValidation(validationId, 'interrupted', now);
      return { result: 'interrupted', reason: 'interrupted_recovery', validation: rejected.validation, receipt: rejected.receipt };
    }
    const receipt = this.options.store.getWorkcellValidationRunReceipt(validationId);
    if (validation.status === 'completed') return { result: validation.result as 'passed' | 'failed', validation, ...(receipt ? { receipt } : {}) };
    return { result: 'rejected', reason: 'previously_rejected', validation, ...(receipt ? { receipt } : {}) };
  }

  private async validResourceBinding(workcell: AgentModeWorkcell, request: WorkcellValidationRequest): Promise<boolean> {
    try {
      const inspected = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
      const requestRoot = await canonical(request.repositoryRoot);
      const requestWorktree = await canonical(request.worktreePath);
      return requestRoot === path.resolve(workcell.repositoryRoot)
        && requestWorktree === path.resolve(workcell.worktreePath)
        && requestWorktree !== requestRoot
        && inspected.repositoryRoot === path.resolve(workcell.repositoryRoot)
        && inspected.branch === workcell.branch;
    } catch {
      return false;
    }
  }

  private async executeBuiltIn(profile: ValidatorProfile, workcell: AgentModeWorkcell, diff: AgentModeWorkcellDiffEvidence): Promise<ValidatorEvidence> {
    const observed: GitDiffCapture = await this.git.captureDiff({ worktreePath: workcell.worktreePath, baseRef: workcell.baseRef });
    const matches = observed.baseRevision === diff.baseRevision
      && observed.currentRevision === diff.currentRevision
      && observed.diffHash === diff.diffHash
      && JSON.stringify(observed.changedFiles) === JSON.stringify(diff.changedFiles);
    const evidenceJson = JSON.stringify({ format: profile.evidenceFormat, validatorProfile: profile.id, diffId: diff.diffId, expectedDiffHash: diff.diffHash, observedDiffHash: observed.diffHash, expectedChangedFiles: diff.changedFiles, observedChangedFiles: observed.changedFiles, expectedBaseRevision: diff.baseRevision, observedBaseRevision: observed.baseRevision, expectedCurrentRevision: diff.currentRevision, observedCurrentRevision: observed.currentRevision, matches });
    return { result: matches ? 'passed' : 'failed', evidenceJson, evidenceHash: hash(evidenceJson) };
  }
}
