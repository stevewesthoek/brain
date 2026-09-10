import { createHash } from 'node:crypto';
import {
  AgentModeSqliteStateStore,
  type AgentModeCommitOperation,
  type AgentModeMergeApproval,
  type AgentModeMergeOperation,
  type AgentModeReviewDecision,
  type AgentModeReviewRequest,
  type AgentModeTargetRefLease,
} from './sqlite-state-store.js';
import { GitCliWorkcellAdapter, type GitWorkcellAdapter } from './workcell.js';

export const K35_REVIEW_ACTOR = 'brain-review-authority';
export const K35_COMMIT_ACTOR = 'brain-commit-authority';
export const K35_MERGE_ACTOR = 'brain-merge-authority';

export class WorkcellPromotionRejectedError extends Error {
  constructor(readonly reason: string) {
    super(`Workcell promotion rejected: ${reason}`);
    this.name = 'WorkcellPromotionRejectedError';
  }
}

function hash(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function validTime(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new WorkcellPromotionRejectedError('invalid timestamp');
}

function validCommitMessage(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9 .:_/-]{0,119}$/.test(value) || value.startsWith('-') || /\s--/.test(value)) {
    throw new WorkcellPromotionRejectedError('commit message is outside the bounded format');
  }
}

function validTargetRef(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(value) || value.startsWith('-') || value.includes('..') || value.endsWith('/') || value.includes('//')) {
    throw new WorkcellPromotionRejectedError('target ref is outside the bounded format');
  }
}

function validCommitSha(value: string): void {
  if (!/^[0-9a-f]{40}$/i.test(value)) throw new WorkcellPromotionRejectedError('target head must be a full commit SHA');
}

function receiptHash(value: unknown): string { return hash({ domain: 'agent-mode-k3-5-receipt-v1', value }); }

function statusReceipt(workcell: { taskId: string; runId: string; attemptId: string; workcellId: string; repositoryRef: string }, actor: string, timestamp: string, resultState: 'approved' | 'committing' | 'committed' | 'merged') {
  const operationHash = hash({ workcellId: workcell.workcellId, actor, timestamp, resultState });
  return { receiptId: `workcell-receipt:k3-5:${resultState}:${workcell.workcellId}`, receiptType: 'WorkcellCommitReceipt' as const, taskId: workcell.taskId, runId: workcell.runId, attemptId: workcell.attemptId, workcellId: workcell.workcellId, repositoryRef: workcell.repositoryRef, actor, timestamp, operationHash, operation: 'commit' as const, resultState };
}

export type WorkcellPromotionManagerOptions = {
  store: AgentModeSqliteStateStore;
  git?: GitWorkcellAdapter;
  failureInjector?: (point: 'before-commit-effect' | 'after-commit-effect-before-receipt' | 'before-merge-effect' | 'after-merge-effect-before-receipt') => void;
};

export class WorkcellPromotionManager {
  private readonly git: GitWorkcellAdapter;

  constructor(private readonly options: WorkcellPromotionManagerOptions) {
    this.git = options.git ?? new GitCliWorkcellAdapter();
  }

  async requestReview(input: { reviewId: string; workcellId: string; requestingActor: string; createdAt: string; expiresAt: string }): Promise<AgentModeReviewRequest> {
    validTime(input.createdAt); validTime(input.expiresAt);
    const workcell = this.options.store.getWorkcell(input.workcellId);
    if (!workcell) throw new WorkcellPromotionRejectedError('Workcell does not exist');
    if (input.requestingActor.startsWith('model:')) throw new WorkcellPromotionRejectedError('coding model cannot create a review authorization');
    if (workcell.status !== 'awaiting_review') throw new WorkcellPromotionRejectedError('review requires awaiting_review Workcell state');
    const diff = this.options.store.getLatestWorkcellDiff(workcell.workcellId);
    const validation = this.options.store.listWorkcellValidationRuns(workcell.workcellId).filter((item) => item.diffId === diff?.diffId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!diff) throw new WorkcellPromotionRejectedError('latest diff evidence is missing');
    if (!validation || validation.status !== 'completed' || validation.result !== 'passed' || !validation.evidenceHash) throw new WorkcellPromotionRejectedError('latest validation evidence is not passed');
    const observed = await this.currentCandidate(workcell.worktreePath, workcell.baseRef);
    if (!this.sameDiff(observed, diff)) throw new WorkcellPromotionRejectedError('Workcell drifted after diff capture');
    const request: AgentModeReviewRequest = {
      reviewId: input.reviewId, workcellId: workcell.workcellId, taskId: workcell.taskId, runId: workcell.runId, attemptId: workcell.attemptId,
      workerAgentId: workcell.ownerAgent,
      repositoryRef: workcell.repositoryRef, branch: workcell.branch, baseRevision: diff.baseRevision, currentRevision: diff.currentRevision,
      diffId: diff.diffId, diffHash: diff.diffHash, validationId: validation.validationId, validationEvidenceHash: validation.evidenceHash,
      requestingActor: input.requestingActor, createdAt: input.createdAt, expiresAt: input.expiresAt, status: 'pending',
    };
    const result = this.options.store.createReviewRequest(request);
    if (result === 'conflict') throw new WorkcellPromotionRejectedError('review request identity conflict');
    return this.options.store.getReviewRequest(input.reviewId) ?? request;
  }

  async decideReview(input: { reviewId: string; decisionId: string; decision: 'approved' | 'rejected'; reviewer: string; decidedAt: string; reason?: string }): Promise<AgentModeReviewDecision> {
    validTime(input.decidedAt);
    const existingDecision = this.options.store.getReviewDecision(input.reviewId);
    if (existingDecision) {
      if (existingDecision.decision === input.decision && existingDecision.reviewer === input.reviewer
        && existingDecision.decidedAt === input.decidedAt && existingDecision.reason === (input.reason ?? '')) return existingDecision;
      throw new WorkcellPromotionRejectedError('review decision replay differs from original');
    }
    const request = await this.refreshReview(input.reviewId, input.decidedAt);
    const workcell = this.options.store.getWorkcell(request.workcellId);
    if (!workcell) throw new WorkcellPromotionRejectedError('review Workcell does not exist');
    if (input.reviewer === workcell.ownerAgent || input.reviewer.startsWith('model:')) throw new WorkcellPromotionRejectedError('coding worker cannot self-approve');
    if (Date.parse(request.expiresAt) <= Date.parse(input.decidedAt)) throw new WorkcellPromotionRejectedError('review request is expired');
    if (request.status !== 'pending') throw new WorkcellPromotionRejectedError('review request is stale or already decided');
    const latestDiff = this.options.store.getLatestWorkcellDiff(workcell.workcellId);
    const latestValidation = this.options.store.listWorkcellValidationRuns(workcell.workcellId).filter((item) => item.diffId === latestDiff?.diffId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (input.decision === 'approved' && (!latestDiff || latestDiff.diffId !== request.diffId || latestDiff.diffHash !== request.diffHash || !latestValidation || latestValidation.validationId !== request.validationId || latestValidation.result !== 'passed' || latestValidation.evidenceHash !== request.validationEvidenceHash)) throw new WorkcellPromotionRejectedError('approval candidate evidence is stale or validation is not passed');
    const decision: AgentModeReviewDecision = { decisionId: input.decisionId, reviewId: input.reviewId, decision: input.decision, reviewer: input.reviewer, decidedAt: input.decidedAt, reason: input.reason ?? '', evidenceHash: receiptHash({ request, decision: input.decision, reviewer: input.reviewer, decidedAt: input.decidedAt }) };
    const result = this.options.store.recordReviewDecision(decision);
    if (result === 'conflict') throw new WorkcellPromotionRejectedError('review decision replay differs from original');
    if (input.decision === 'approved' && workcell.status === 'awaiting_review') {
      this.options.store.updateWorkcellStatus(workcell.workcellId, 'approved', input.decidedAt, 'awaiting_review', statusReceipt(workcell, input.reviewer, input.decidedAt, 'approved'));
    }
    return this.options.store.getReviewDecision(input.reviewId) ?? decision;
  }

  async refreshReview(reviewId: string, now: string): Promise<AgentModeReviewRequest> {
    validTime(now);
    const request = this.options.store.getReviewRequest(reviewId);
    if (!request) throw new WorkcellPromotionRejectedError('review request does not exist');
    if (request.status === 'rejected' || request.status === 'stale') return request;
    const workcell = this.options.store.getWorkcell(request.workcellId);
    if (!workcell) throw new WorkcellPromotionRejectedError('review Workcell does not exist');
    const diff = this.options.store.getLatestWorkcellDiff(workcell.workcellId);
    const validation = diff
      ? this.options.store.listWorkcellValidationRuns(workcell.workcellId).filter((item) => item.diffId === diff.diffId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      : undefined;
    let reason: string | undefined;
    if (!diff || diff.diffId !== request.diffId || diff.diffHash !== request.diffHash || diff.baseRevision !== request.baseRevision || diff.currentRevision !== request.currentRevision) reason = 'review diff binding is stale';
    else if (!validation || validation.validationId !== request.validationId || validation.status !== 'completed' || validation.result !== 'passed' || validation.evidenceHash !== request.validationEvidenceHash) reason = 'review validation evidence is stale';
    else {
      try {
        const observed = await this.currentCandidate(workcell.worktreePath, workcell.baseRef);
        if (!this.sameDiff(observed, diff)) reason = 'review Workcell candidate is stale';
      } catch {
        reason = 'review Workcell candidate could not be verified';
      }
    }
    if (reason) {
      this.options.store.markReviewStale(reviewId, reason, now);
      return this.options.store.getReviewRequest(reviewId) ?? { ...request, status: 'stale' };
    }
    return request;
  }

  async commitWorkcell(input: { operationId: string; workcellId: string; leaseId: string; fenceToken: number; actor?: string; message?: string; now: string }): Promise<AgentModeCommitOperation> {
    validTime(input.now);
    const message = input.message ?? `K3.5 ${input.workcellId}`;
    const workcell = this.options.store.getWorkcell(input.workcellId);
    if (!workcell) return this.rejectCommit(input, 'Workcell does not exist');
    const actor = input.actor ?? K35_COMMIT_ACTOR;
    try {
      validCommitMessage(message);
    } catch (error) {
      return this.rejectCommit(input, error instanceof Error ? error.message.replace(/^Workcell promotion rejected: /, '') : 'commit message is outside the bounded format', workcell);
    }
    const existing = this.options.store.getCommitOperation(input.operationId);
    const diff = this.options.store.getLatestWorkcellDiff(workcell.workcellId);
    if (!diff) return this.rejectCommit(input, 'latest diff evidence is missing', workcell);

    if (existing) {
      if (existing.workcellId !== workcell.workcellId || existing.repositoryRef !== workcell.repositoryRef || existing.branch !== workcell.branch || existing.approvedDiffHash !== diff.diffHash) {
        return this.rejectCommit(input, 'commit operation replay has a different candidate', workcell, diff.diffHash, existing.validationEvidenceHash, existing.reviewId, existing.parentCommit);
      }
      if (existing.status === 'committed' || existing.status === 'reconciled') return existing;
      if (existing.status === 'rejected') return this.rejectCommit(input, existing.reason ?? 'commit operation was rejected', workcell, diff.diffHash, existing.validationEvidenceHash, existing.reviewId, existing.parentCommit);

      const inspected = await this.inspectWorkcell(workcell.worktreePath);
      if (inspected.repositoryRoot !== workcell.repositoryRoot || inspected.branch !== existing.branch) {
        return this.rejectCommit(input, 'Workcell repository binding changed before commit reconciliation', workcell, diff.diffHash, existing.validationEvidenceHash, existing.reviewId, existing.parentCommit);
      }
      if (!inspected.dirty && inspected.revision !== existing.parentCommit) {
        const reconciled: AgentModeCommitOperation = {
          ...existing,
          resultingCommit: inspected.revision,
          status: 'reconciled',
          receiptHash: receiptHash({ operationId: input.operationId, commit: inspected.revision, diff: existing.approvedDiffHash }),
        };
        this.options.store.updateCommitOperation(reconciled);
        if (workcell.status === 'committing') this.options.store.updateWorkcellStatus(workcell.workcellId, 'committed', input.now, 'committing', statusReceipt(workcell, actor, input.now, 'committed'));
        return reconciled;
      }
      if (existing.message !== message) return this.rejectCommit(input, 'commit operation replay message differs from original', workcell, diff.diffHash, existing.validationEvidenceHash, existing.reviewId, existing.parentCommit);
    }

    const review = this.options.store.getReviewRequest(existing?.reviewId ?? this.options.store.listReviewRequests().find((item) => item.workcellId === workcell.workcellId && item.status === 'approved')?.reviewId ?? '');
    if (!review) return this.rejectCommit(input, 'approved review evidence is missing', workcell, diff.diffHash, undefined, existing?.reviewId);
    const refreshedReview = await this.refreshReview(review.reviewId, input.now);
    if (refreshedReview.status !== 'approved') return this.rejectCommit(input, 'review approval is stale', workcell, diff.diffHash, existing?.validationEvidenceHash, review.reviewId);
    const validation = this.options.store.listWorkcellValidationRuns(workcell.workcellId).filter((item) => item.diffId === diff.diffId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const decision = this.options.store.getReviewDecision(review.reviewId);
    if (!validation || validation.status !== 'completed' || validation.result !== 'passed' || !validation.evidenceHash || !decision || decision.decision !== 'approved' || review.diffId !== diff.diffId || review.diffHash !== diff.diffHash || review.validationId !== validation.validationId || review.validationEvidenceHash !== validation.evidenceHash) {
      return this.rejectCommit(input, 'commit requires exact approved diff and passed validation evidence', workcell, diff.diffHash, validation?.evidenceHash, review.reviewId);
    }
    if (existing && (existing.validationEvidenceHash !== validation.evidenceHash || existing.reviewId !== review.reviewId || existing.message !== message)) {
      return this.rejectCommit(input, 'commit operation replay binding differs from approved evidence', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, existing.parentCommit);
    }

    const lease = this.options.store.getWorkcellWriterLease(input.leaseId);
    if (!lease || lease.workcellId !== workcell.workcellId || lease.ownerAgent !== workcell.ownerAgent || lease.ownerAttempt !== workcell.attemptId || lease.status !== 'active' || lease.fenceToken !== input.fenceToken || Date.parse(lease.expiresAt) <= Date.parse(input.now)) {
      return this.rejectCommit(input, 'current Workcell writer lease and fence are required', workcell, diff.diffHash, validation.evidenceHash, review.reviewId);
    }
    const observed = await this.currentCandidate(workcell.worktreePath, workcell.baseRef);
    if (!this.sameDiff(observed, diff)) return this.rejectCommit(input, 'commit candidate drifted after review approval', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, existing?.parentCommit);
    const inspected = await this.inspectWorkcell(workcell.worktreePath);
    if (inspected.repositoryRoot !== workcell.repositoryRoot || inspected.branch !== workcell.branch) return this.rejectCommit(input, 'Workcell repository binding changed before commit', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, inspected.revision);
    if (existing && existing.parentCommit !== inspected.revision) return this.rejectCommit(input, 'commit parent changed before retry', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, existing.parentCommit);
    if (!existing && workcell.status !== 'approved') return this.rejectCommit(input, 'Workcell is not in the approved state', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, inspected.revision);
    if (existing && !['approved', 'committing'].includes(workcell.status)) return this.rejectCommit(input, 'Workcell is not in an admissible commit state', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, inspected.revision);
    const git = this.git.commitWorktree;
    if (!git) return this.rejectCommit(input, 'fixed Git adapter has no commit operation', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, inspected.revision);

    const operation: AgentModeCommitOperation = existing ?? {
      operationId: input.operationId,
      workcellId: workcell.workcellId,
      repositoryRef: workcell.repositoryRef,
      branch: workcell.branch,
      parentCommit: inspected.revision,
      approvedDiffHash: diff.diffHash,
      validationEvidenceHash: validation.evidenceHash,
      reviewId: review.reviewId,
      actor,
      message,
      createdAt: input.now,
      status: 'prepared',
    };
    if (!existing) {
      const inserted = this.options.store.createCommitOperation(operation);
      if (inserted === 'conflict') return this.rejectCommit(input, 'commit operation identity conflict', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, inspected.revision);
    }
    if (workcell.status === 'approved') {
      const transitioned = this.options.store.updateWorkcellStatus(workcell.workcellId, 'committing', input.now, 'approved', statusReceipt(workcell, actor, input.now, 'committing'));
      if (transitioned === 'conflict') return this.rejectCommit(input, 'Workcell commit state changed before Git mutation', workcell, diff.diffHash, validation.evidenceHash, review.reviewId, inspected.revision);
    }
    this.options.failureInjector?.('before-commit-effect');
    let result;
    try {
      result = await git.call(this.git, { worktreePath: workcell.worktreePath, expectedBranch: workcell.branch, expectedParent: inspected.revision, changedFiles: diff.changedFiles, message });
    } catch (error) {
      const rejected: AgentModeCommitOperation = { ...operation, status: 'rejected', reason: error instanceof Error ? error.message : String(error), receiptHash: receiptHash({ operation, error: String(error) }) };
      this.options.store.updateCommitOperation(rejected);
      throw error;
    }
    this.options.failureInjector?.('after-commit-effect-before-receipt');
    const committed: AgentModeCommitOperation = { ...operation, resultingCommit: result.commitSha, resultingTreeRevision: result.treeRevision, status: 'committed', receiptHash: receiptHash({ operation, result }) };
    this.options.store.updateCommitOperation(committed);
    const statusResult = this.options.store.updateWorkcellStatus(workcell.workcellId, 'committed', input.now, 'committing', statusReceipt(workcell, actor, input.now, 'committed'));
    if (statusResult === 'conflict') throw new WorkcellPromotionRejectedError('Workcell commit state could not be finalized');
    return committed;
  }

  private rejectCommit(
    input: { operationId: string; workcellId: string; actor?: string; now: string },
    reason: string,
    workcell?: ReturnType<AgentModeSqliteStateStore['getWorkcell']>,
    diffHash = 'unavailable',
    validationEvidenceHash = 'unavailable',
    reviewId = 'unavailable',
    parentCommit: string | null = null,
  ): never {
    if (workcell) {
      const actor = input.actor ?? K35_COMMIT_ACTOR;
      const operationHash = receiptHash({ operationId: input.operationId, workcellId: workcell.workcellId, reason, diffHash, validationEvidenceHash, reviewId, parentCommit, actor, timestamp: input.now });
      this.options.store.recordCommitReceipt({
        receiptId: `agent-mode-commit-receipt:${input.operationId}:CommitRejectedReceipt:${hash(reason)}`,
        receiptType: 'CommitRejectedReceipt',
        operationId: input.operationId,
        workcellId: workcell.workcellId,
        branch: workcell.branch,
        parentCommit,
        resultingCommit: null,
        diffHash,
        validationEvidenceHash,
        reviewId,
        actor,
        timestamp: input.now,
        operationHash,
        result: 'rejected',
      });
    }
    throw new WorkcellPromotionRejectedError(reason);
  }

  createMergeApproval(input: { approvalId: string; operationId: string; commitOperationId: string; workcellId: string; targetRef: string; expectedTargetHead: string; approver: string; createdAt: string; expiresAt: string }): AgentModeMergeApproval {
    validTime(input.createdAt); validTime(input.expiresAt); validTargetRef(input.targetRef); validCommitSha(input.expectedTargetHead);
    const workcell = this.options.store.getWorkcell(input.workcellId);
    const commit = this.options.store.getCommitOperation(input.commitOperationId);
    const diff = workcell ? this.options.store.getLatestWorkcellDiff(workcell.workcellId) : undefined;
    const validation = workcell ? this.options.store.listWorkcellValidationRuns(workcell.workcellId).find((item) => item.diffId === diff?.diffId && item.result === 'passed' && item.status === 'completed' && item.evidenceHash) : undefined;
    const review = workcell ? this.options.store.listReviewRequests().find((item) => item.workcellId === workcell.workcellId && item.status === 'approved') : undefined;
    const decision = review ? this.options.store.getReviewDecision(review.reviewId) : undefined;
    if (!workcell || !commit || commit.workcellId !== workcell.workcellId || commit.repositoryRef !== workcell.repositoryRef || !commit.resultingCommit || !['committed', 'reconciled'].includes(commit.status) || !diff || commit.approvedDiffHash !== diff.diffHash || !validation?.evidenceHash || commit.validationEvidenceHash !== validation.evidenceHash || !review || !decision || decision.decision !== 'approved' || review.diffId !== diff.diffId || review.diffHash !== diff.diffHash || review.validationId !== validation.validationId || review.validationEvidenceHash !== validation.evidenceHash) throw new WorkcellPromotionRejectedError('merge requires an exact approved committed Workcell candidate');
    if (input.approver.startsWith('model:') || input.approver === workcell.ownerAgent) throw new WorkcellPromotionRejectedError('coding worker cannot mint merge approval');
    if (input.targetRef === workcell.branch) throw new WorkcellPromotionRejectedError('merge target must differ from the Workcell source branch');
    const approval: AgentModeMergeApproval = { approvalId: input.approvalId, repositoryRef: workcell.repositoryRef, sourceWorkcellId: workcell.workcellId, sourceBranch: workcell.branch, sourceCommit: commit.resultingCommit, reviewId: review.reviewId, diffHash: diff.diffHash, validationId: validation.validationId, validationEvidenceHash: validation.evidenceHash, targetRef: input.targetRef, expectedTargetHead: input.expectedTargetHead, approver: input.approver, createdAt: input.createdAt, expiresAt: input.expiresAt, operationId: input.operationId, status: 'pending' };
    const result = this.options.store.createMergeApproval(approval);
    if (result === 'conflict') throw new WorkcellPromotionRejectedError('merge approval identity conflict');
    return this.options.store.getMergeApproval(input.approvalId) ?? approval;
  }

  async mergeWorkcell(input: { operationId: string; approvalId: string; workcellId: string; now: string; actor?: string }): Promise<AgentModeMergeOperation> {
    validTime(input.now);
    const workcell = this.options.store.getWorkcell(input.workcellId);
    const approval = this.options.store.getMergeApproval(input.approvalId);
    if (!workcell) return this.rejectMerge(input, 'Workcell does not exist');
    if (!approval || approval.sourceWorkcellId !== input.workcellId || approval.operationId !== input.operationId) return this.rejectMerge(input, 'merge approval is absent or mismatched', workcell, approval);
    const existing = this.options.store.getMergeOperation(input.operationId);
    if (existing && (existing.approvalId !== approval.approvalId || existing.repositoryRef !== approval.repositoryRef || existing.sourceWorkcellId !== approval.sourceWorkcellId || existing.sourceCommit !== approval.sourceCommit || existing.targetRef !== approval.targetRef || existing.expectedTargetHead !== approval.expectedTargetHead)) return this.rejectMerge(input, 'merge operation replay has a different candidate', workcell, approval, existing);
    if (existing?.status === 'merged' || existing?.status === 'reconciled') return existing;
    if (approval.status !== 'pending') return this.rejectMerge(input, `merge approval is not pending: ${approval.status}`, workcell, approval, existing);
    if (Date.parse(approval.expiresAt) <= Date.parse(input.now)) {
      this.options.store.updateMergeApproval({ ...approval, status: 'expired' });
      return this.rejectMerge(input, 'merge approval is expired', workcell, approval, existing);
    }
    const source = await this.inspectWorkcell(workcell.worktreePath);
    if (source.repositoryRoot !== workcell.repositoryRoot || source.branch !== approval.sourceBranch || source.revision !== approval.sourceCommit) {
      this.options.store.updateMergeApproval({ ...approval, status: 'rejected' });
      return this.rejectMerge(input, 'source commit differs from merge approval', workcell, approval, existing);
    }
    if (existing) {
      const targetLease = this.options.store.getTargetRefLease(`target-ref-lease:${input.operationId}`);
      if (!targetLease || targetLease.ownerOperation !== input.operationId || targetLease.repositoryRef !== approval.repositoryRef || targetLease.targetRef !== approval.targetRef || targetLease.expectedTargetHead !== approval.expectedTargetHead || targetLease.status !== 'active' || Date.parse(targetLease.expiresAt) <= Date.parse(input.now)) return this.rejectMerge(input, 'merge recovery lacks current target-ref authority', workcell, approval, existing);
      if (this.git.verifyMergedSource) {
        const observed = await this.git.verifyMergedSource({ repositoryRoot: workcell.repositoryRoot, targetRef: approval.targetRef, expectedTargetHead: approval.expectedTargetHead, sourceCommit: approval.sourceCommit });
        if (observed.sourceIncluded && observed.head !== approval.expectedTargetHead) return this.finishMerge(existing, approval, workcell, observed.head, 'reconciled');
      }
      const target = await this.inspectTarget(workcell.repositoryRoot, approval.targetRef);
      if (target.head !== approval.expectedTargetHead) return this.rejectMerge(input, 'target changed while merge operation was prepared', workcell, approval, existing);
      const merge = this.git.mergeWorktree;
      if (!merge) return this.rejectMerge(input, 'fixed Git adapter has no merge operation', workcell, approval, existing);
      this.options.failureInjector?.('before-merge-effect');
      let result;
      try {
        result = await merge.call(this.git, { repositoryRoot: workcell.repositoryRoot, expectedTargetRef: approval.targetRef, sourceBranch: approval.sourceBranch, expectedTargetHead: approval.expectedTargetHead });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const rejected: AgentModeMergeOperation = { ...existing, status: 'rejected', reason, receiptHash: receiptHash({ operation: existing, error: reason }) };
        this.options.store.updateMergeOperation(rejected);
        this.options.store.updateMergeApproval({ ...approval, status: 'rejected' });
        this.options.store.updateTargetRefLeaseStatus(targetLease.leaseId, 'released');
        throw new WorkcellPromotionRejectedError(reason);
      }
      this.options.failureInjector?.('after-merge-effect-before-receipt');
      return this.finishMerge(existing, approval, workcell, result.targetHeadAfter, 'merged');
    }
    const targetBefore = await this.inspectTarget(workcell.repositoryRoot, approval.targetRef);
    if (targetBefore.head !== approval.expectedTargetHead) {
      this.options.store.updateMergeApproval({ ...approval, status: 'stale' });
      return this.rejectMerge(input, 'merge target head moved since approval', workcell, approval);
    }
    const lease: AgentModeTargetRefLease = { leaseId: `target-ref-lease:${input.operationId}`, repositoryRef: approval.repositoryRef, targetRef: approval.targetRef, ownerOperation: input.operationId, fenceToken: 0, expectedTargetHead: approval.expectedTargetHead, expiresAt: approval.expiresAt, status: 'active' };
    const acquired = this.options.store.acquireTargetRefLease(lease, input.now);
    if (!acquired.lease || (acquired.result !== 'granted' && acquired.result !== 'duplicate')) return this.rejectMerge(input, acquired.reason ?? 'target ref is already leased', workcell, approval);
    const targetAfterLease = await this.inspectTarget(workcell.repositoryRoot, approval.targetRef);
    if (targetAfterLease.head !== approval.expectedTargetHead) {
      this.options.store.updateTargetRefLeaseStatus(acquired.lease.leaseId, 'released');
      this.options.store.updateMergeApproval({ ...approval, status: 'stale' });
      return this.rejectMerge(input, 'merge target head moved after target authority acquisition', workcell, approval);
    }
    const operation: AgentModeMergeOperation = { operationId: input.operationId, approvalId: approval.approvalId, repositoryRef: approval.repositoryRef, sourceWorkcellId: workcell.workcellId, sourceBranch: approval.sourceBranch, sourceCommit: approval.sourceCommit, reviewId: approval.reviewId, validationId: approval.validationId, targetRef: approval.targetRef, expectedTargetHead: approval.expectedTargetHead, targetFenceToken: acquired.lease.fenceToken, actor: input.actor ?? K35_MERGE_ACTOR, createdAt: input.now, status: 'prepared' };
    const inserted = this.options.store.createMergeOperation(operation);
    if (inserted === 'conflict') return this.rejectMerge(input, 'merge operation identity conflict', workcell, approval, operation);
    const merge = this.git.mergeWorktree;
    if (!merge) return this.rejectMerge(input, 'fixed Git adapter has no merge operation', workcell, approval, operation);
    this.options.failureInjector?.('before-merge-effect');
    let result;
    try {
      result = await merge.call(this.git, { repositoryRoot: workcell.repositoryRoot, expectedTargetRef: approval.targetRef, sourceBranch: approval.sourceBranch, expectedTargetHead: approval.expectedTargetHead });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const rejected: AgentModeMergeOperation = { ...operation, status: 'rejected', reason, receiptHash: receiptHash({ operation, error: reason }) };
      this.options.store.updateMergeOperation(rejected);
      this.options.store.updateMergeApproval({ ...approval, status: 'rejected' });
      this.options.store.updateTargetRefLeaseStatus(lease.leaseId, 'released');
      throw new WorkcellPromotionRejectedError(reason);
    }
    this.options.failureInjector?.('after-merge-effect-before-receipt');
    return this.finishMerge(operation, approval, workcell, result.targetHeadAfter, 'merged');
  }

  private async finishMerge(operation: AgentModeMergeOperation, approval: AgentModeMergeApproval, workcell: NonNullable<ReturnType<AgentModeSqliteStateStore['getWorkcell']>>, targetHeadAfter: string, status: 'merged' | 'reconciled'): Promise<AgentModeMergeOperation> {
    const completed: AgentModeMergeOperation = { ...operation, resultingTargetHead: targetHeadAfter, status, receiptHash: receiptHash({ operation, targetHeadAfter }) };
    this.options.store.updateMergeOperation(completed);
    this.options.store.updateMergeApproval({ ...approval, status: 'consumed' });
    this.options.store.updateTargetRefLeaseStatus(`target-ref-lease:${operation.operationId}`, 'consumed');
    if (workcell.status === 'approved') this.options.store.updateWorkcellStatus(workcell.workcellId, 'merged', operation.createdAt, 'approved', statusReceipt(workcell, operation.actor, operation.createdAt, 'merged'));
    else if (workcell.status === 'committed') this.options.store.updateWorkcellStatus(workcell.workcellId, 'merged', operation.createdAt, 'committed', statusReceipt(workcell, operation.actor, operation.createdAt, 'merged'));
    return completed;
  }

  private async inspectTarget(repositoryRoot: string, targetRef: string): Promise<{ targetRef: string; head: string }> {
    return this.git.inspectRef ? this.git.inspectRef({ repositoryRoot, targetRef }) : { targetRef, head: (await this.inspectWorkcell(repositoryRoot)).revision };
  }

  private rejectMerge(
    input: { operationId: string; approvalId: string; workcellId: string; now: string; actor?: string },
    reason: string,
    workcell?: ReturnType<AgentModeSqliteStateStore['getWorkcell']>,
    approval?: AgentModeMergeApproval,
    operation?: AgentModeMergeOperation,
  ): never {
    if (workcell) {
      const actor = input.actor ?? K35_MERGE_ACTOR;
      const targetRef = approval?.targetRef ?? operation?.targetRef ?? 'unavailable';
      const receiptOperation: AgentModeMergeOperation = operation ?? {
        operationId: input.operationId,
        approvalId: approval?.approvalId ?? input.approvalId,
        repositoryRef: approval?.repositoryRef ?? workcell.repositoryRef,
        sourceWorkcellId: workcell.workcellId,
        sourceBranch: approval?.sourceBranch ?? workcell.branch,
        sourceCommit: approval?.sourceCommit ?? '',
        reviewId: approval?.reviewId ?? 'unavailable',
        validationId: approval?.validationId ?? 'unavailable',
        targetRef,
        expectedTargetHead: approval?.expectedTargetHead ?? '',
        targetFenceToken: 0,
        actor,
        createdAt: input.now,
        status: 'rejected',
        reason,
      };
      const operationHash = receiptHash({ operationId: input.operationId, approvalId: receiptOperation.approvalId, workcellId: workcell.workcellId, reason, actor, timestamp: input.now });
      this.options.store.recordMergeReceipt({ receiptId: `agent-mode-merge-receipt:${input.operationId}:MergeRejectedReceipt:${hash(reason)}`, receiptType: 'MergeRejectedReceipt', operationId: input.operationId, approvalId: receiptOperation.approvalId, workcellId: workcell.workcellId, sourceCommit: receiptOperation.sourceCommit || null, targetRef, targetBefore: receiptOperation.expectedTargetHead || null, targetAfter: null, reviewId: receiptOperation.reviewId, validationId: receiptOperation.validationId, actor, timestamp: input.now, operationHash, result: 'rejected' });
    }
    throw new WorkcellPromotionRejectedError(reason);
  }

  private async inspectWorkcell(worktreePath: string): Promise<{ repositoryRoot: string; branch: string; revision: string; dirty: boolean }> {
    return (this.git as GitWorkcellAdapter).inspectWorktree({ worktreePath });
  }

  private async currentCandidate(worktreePath: string, baseRef: string) {
    return this.git.captureDiff({ worktreePath, baseRef });
  }

  private sameDiff(a: { baseRevision: string; currentRevision: string; diffHash: string; changedFiles: string[] }, b: { baseRevision: string; currentRevision: string; diffHash: string; changedFiles: string[] }): boolean {
    return a.baseRevision === b.baseRevision && a.currentRevision === b.currentRevision && a.diffHash === b.diffHash && JSON.stringify(a.changedFiles) === JSON.stringify(b.changedFiles);
  }
}
