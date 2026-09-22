import { createHash } from 'node:crypto';
import { chmod, lstat, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  type AgentModeSqliteStateStore,
  type AgentModeWorkcell,
  type AgentModeWorkcellMutation,
  type AgentModeWorkcellWriteReceipt,
} from './sqlite-state-store.js';
import { WorkcellWriterManager } from './workcell-writer.js';

/** Conservative K3.2 bound. K3.2 intentionally does not stream or edit large files. */
export const MAX_WORKCELL_TEXT_FILE_BYTES = 256 * 1024;
export const WORKCELL_FILE_PATCH_PRIMITIVE = 'workcell.file.patch';

export type WorkcellMutationFailurePoint =
  | 'after-admission'
  | 'after-preimage-verification'
  | 'during-temp-preparation'
  | 'after-atomic-mutation-before-receipt'
  | 'after-receipt';

export type WorkcellFilePatchRequest = {
  operationId: string;
  workcellId: string;
  repositoryRef: string;
  repositoryRoot: string;
  worktreePath: string;
  relativePath: string;
  ownerAgent: string;
  ownerAttempt: string;
  leaseId: string;
  fenceToken: number;
  expectedPreimageHash: string;
  oldText: string;
  replacementText: string;
  now: string;
};

export type WorkcellFilePatchResult = {
  result: 'applied' | 'duplicate' | 'reconciled' | 'rejected' | 'safe_to_resume';
  reason?: string;
  receipt?: AgentModeWorkcellWriteReceipt;
  mutation?: AgentModeWorkcellMutation;
};

export type WorkcellFileMutationManagerOptions = {
  store: AgentModeSqliteStateStore;
  writer: WorkcellWriterManager;
  failureInjector?: (point: WorkcellMutationFailurePoint) => void;
};

const FORBIDDEN_COMPONENTS = new Set(['.git', '.brain', '.openai', '.codex', 'agent-mode', 'workcells']);

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function operationHash(request: WorkcellFilePatchRequest): string {
  return sha256(JSON.stringify({
    operationId: request.operationId,
    workcellId: request.workcellId,
    repositoryRef: request.repositoryRef,
    relativePath: request.relativePath,
    ownerAgent: request.ownerAgent,
    ownerAttempt: request.ownerAttempt,
    leaseId: request.leaseId,
    fenceToken: request.fenceToken,
    expectedPreimageHash: request.expectedPreimageHash.toLowerCase(),
    oldTextHash: sha256(request.oldText),
    replacementHash: sha256(request.replacementText),
  }));
}

function ensureTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error('invalid mutation timestamp');
}

function validateRelativePath(relativePath: string): string[] {
  if (!relativePath || relativePath.includes('\0') || relativePath.includes('\\') || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) || /^[A-Za-z]:/.test(relativePath)) {
    throw new Error('relative path is not permitted');
  }
  const components = relativePath.split('/');
  if (components.some((component) => !component || component === '.' || component === '..' || FORBIDDEN_COMPONENTS.has(component))) {
    throw new Error('relative path contains an unsafe component');
  }
  if (path.posix.normalize(relativePath) !== relativePath) throw new Error('relative path is not canonical');
  return components;
}

function isContained(root: string, target: string): boolean {
  return target !== root && target.startsWith(`${root}${path.sep}`);
}

async function readStrictText(filePath: string): Promise<{ text: string; hash: string }> {
  const bytes = await readFile(filePath);
  if (bytes.byteLength > MAX_WORKCELL_TEXT_FILE_BYTES) throw new Error('target file exceeds the K3.2 text-file bound');
  if (bytes.includes(0)) throw new Error('binary target files are not permitted');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('target file is not valid UTF-8 text');
  }
  return { text, hash: sha256(bytes) };
}

async function resolveTarget(workcell: AgentModeWorkcell, relativePath: string): Promise<{ root: string; target: string; mode: number }> {
  const components = validateRelativePath(relativePath);
  const root = path.resolve(await realpath(workcell.worktreePath));
  if (root === path.resolve(await realpath(workcell.repositoryRoot))) throw new Error('the primary checkout is not a Workcell target');
  let current = root;
  for (const component of components) {
    current = path.join(current, component);
    const entry = await lstat(current);
    if (entry.isSymbolicLink()) throw new Error('symlink path components are not permitted');
  }
  const target = path.resolve(current);
  const canonicalTarget = path.resolve(await realpath(target));
  if (!isContained(root, canonicalTarget)) throw new Error('target escapes the Workcell');
  const entry = await lstat(target);
  if (entry.isSymbolicLink() || !entry.isFile()) throw new Error('target must be a regular file');
  if (entry.size > MAX_WORKCELL_TEXT_FILE_BYTES) throw new Error('target file exceeds the K3.2 text-file bound');
  return { root, target, mode: entry.mode & 0o7777 };
}

function failure(options: WorkcellFileMutationManagerOptions, point: WorkcellMutationFailurePoint): void {
  options.failureInjector?.(point);
}

export class WorkcellFileMutationManager {
  constructor(private readonly options: WorkcellFileMutationManagerOptions) {}

  async applyPatch(request: WorkcellFilePatchRequest): Promise<WorkcellFilePatchResult> {
    ensureTimestamp(request.now);
    if (!request.operationId || !request.workcellId || !request.repositoryRef || !request.leaseId || !request.ownerAgent || !request.ownerAttempt) throw new Error('Workcell file patch identity is incomplete');
    if (!/^[a-f0-9]{64}$/i.test(request.expectedPreimageHash)) throw new Error('expected preimage hash must be SHA-256');
    if (Buffer.byteLength(request.replacementText, 'utf8') > MAX_WORKCELL_TEXT_FILE_BYTES) throw new Error('replacement exceeds the K3.2 text-file bound');
    const immutableHash = operationHash(request);
    const workcell = this.options.store.getWorkcell(request.workcellId);
    if (!workcell) throw new Error(`workcell not found: ${request.workcellId}`);
    if (request.repositoryRef !== workcell.repositoryRef) return { result: 'rejected', reason: 'repository_ref_mismatch' };
    validateRelativePath(request.relativePath);
    const existing = this.options.store.getWorkcellMutation(request.operationId);
    if (existing && existing.operationHash !== immutableHash) return { result: 'rejected', reason: 'operation_id_reused_for_different_mutation', mutation: existing };

    if (existing?.status === 'rejected') {
      const receipt = this.options.store.getWorkcellWriteReceipt(request.operationId);
      if (!receipt) throw new Error(`rejected mutation receipt is missing: ${request.operationId}`);
      return { result: 'rejected', reason: 'previously_rejected', mutation: existing, receipt };
    }
    if (existing?.status === 'receipt_recorded' || existing?.status === 'reconciled') {
      const target = await this.resolveTarget(workcell, request.relativePath);
      const current = await readStrictText(target.target);
      const receipt = this.options.store.getWorkcellWriteReceipt(request.operationId);
      if (!receipt) throw new Error(`completed mutation receipt is missing: ${request.operationId}`);
      if (existing.postimageHash && current.hash === existing.postimageHash) return { result: 'duplicate', mutation: existing, receipt };
      return { result: 'rejected', reason: 'postimage_changed_after_receipt', mutation: existing, receipt };
    }
    if (existing?.status === 'effect_applied') return this.reconcile(request.operationId, request.now);

    const admission = await this.options.writer.admitWrite({
      workcellId: request.workcellId,
      capability: 'repo.write(workcell)',
      ownerAgent: request.ownerAgent,
      ownerAttempt: request.ownerAttempt,
      leaseId: request.leaseId,
      fenceToken: request.fenceToken,
      repositoryRoot: request.repositoryRoot,
      worktreePath: request.worktreePath,
      now: request.now,
    });
    if (!admission.ok) return { result: 'rejected', reason: admission.reason };

    const prepared = this.options.store.prepareWorkcellMutation({
      operationId: request.operationId,
      workcellId: request.workcellId,
      capability: 'repo.write(workcell)',
      ownerAgent: request.ownerAgent,
      ownerAttempt: request.ownerAttempt,
      leaseId: request.leaseId,
      fenceToken: request.fenceToken,
      repositoryRoot: workcell.repositoryRoot,
      worktreePath: workcell.worktreePath,
      resourceValid: true,
      relativePath: request.relativePath,
      expectedPreimageHash: request.expectedPreimageHash.toLowerCase(),
      replacementHash: sha256(request.replacementText),
      operationHash: immutableHash,
      preparedAt: request.now,
    });
    if (prepared.result === 'rejected') {
      if (!prepared.reason || !prepared.mutation || !prepared.receipt) throw new Error('rejected Workcell mutation was incomplete');
      return { result: 'rejected', reason: prepared.reason, mutation: prepared.mutation, receipt: prepared.receipt };
    }
    if (prepared.result === 'conflict') {
      if (!prepared.reason || !prepared.mutation) throw new Error('conflicting Workcell mutation was incomplete');
      return { result: 'rejected', reason: prepared.reason, mutation: prepared.mutation };
    }
    const mutation = prepared.mutation;
    if (!mutation) throw new Error('prepared Workcell mutation was not returned');
    if (prepared.result === 'prepared') failure(this.options, 'after-admission');

    const target = await this.resolveTarget(workcell, request.relativePath);
    const current = await readStrictText(target.target);
    const expected = request.expectedPreimageHash.toLowerCase();
    if (current.hash !== expected) return this.rejectMutation(mutation, 'preimage_conflict', request.now);
    if (mutation.status === 'prepared') {
      const marked = this.options.store.markWorkcellMutationPreimage(request.operationId, current.hash, request.now);
      if (marked === 'conflict') return this.rejectMutation(mutation, 'preimage_state_conflict', request.now);
      mutation.preimageHash = current.hash;
      mutation.status = 'preimage_verified';
      mutation.updatedAt = request.now;
      failure(this.options, 'after-preimage-verification');
    }
    const occurrences = current.text.split(request.oldText).length - 1;
    if (!request.oldText || occurrences !== 1) return this.rejectMutation(mutation, 'old_text_anchor_mismatch', request.now);
    const replacement = current.text.replace(request.oldText, request.replacementText);
    const replacementBytes = Buffer.from(replacement, 'utf8');
    if (replacementBytes.byteLength > MAX_WORKCELL_TEXT_FILE_BYTES) return this.rejectMutation(mutation, 'postimage_exceeds_text_file_bound', request.now);
    const postHash = sha256(replacementBytes);
    const leaseBeforeTemp = this.options.store.validateWorkcellMutationLease(request.operationId, request.now);
    if (!leaseBeforeTemp.ok) return this.rejectMutation(mutation, leaseBeforeTemp.reason ?? 'writer_lease_no_longer_current', request.now);
    const tempPath = path.join(path.dirname(target.target), `.brain-workcell-patch-${sha256(request.operationId).slice(0, 24)}.tmp`);
    await unlink(tempPath).catch(() => undefined);
    await this.prepareTemp(tempPath, replacementBytes, target.mode);
    const markedTemp = this.options.store.markWorkcellMutationTempPrepared(request.operationId, request.now);
    if (markedTemp === 'conflict') return this.rejectMutation(mutation, 'mutation_phase_conflict', request.now);
    const leaseBeforeRename = this.options.store.validateWorkcellMutationLease(request.operationId, request.now);
    if (!leaseBeforeRename.ok) {
      await unlink(tempPath).catch(() => undefined);
      return this.rejectMutation(mutation, leaseBeforeRename.reason ?? 'writer_lease_no_longer_current', request.now);
    }
    const beforeRename = await readStrictText(target.target);
    if (beforeRename.hash !== expected) {
      await unlink(tempPath).catch(() => undefined);
      return this.rejectMutation(mutation, 'preimage_changed_before_atomic_rename', request.now);
    }
    await rename(tempPath, target.target);
    const observed = await readStrictText(target.target);
    this.options.store.markWorkcellMutationEffectApplied(request.operationId, observed.hash, request.now);
    const appliedMutation = this.options.store.getWorkcellMutation(request.operationId) ?? mutation;
    if (observed.hash !== postHash) return this.rejectMutation(appliedMutation, 'postimage_verification_failed', request.now, observed.hash);
    failure(this.options, 'after-atomic-mutation-before-receipt');
    const receipt = this.makeReceipt(workcell, request, immutableHash, current.hash, postHash, request.now, 'applied', 'WorkcellWriteAppliedReceipt');
    this.options.store.recordWorkcellWriteReceipt(receipt, 'receipt_recorded');
    failure(this.options, 'after-receipt');
    const finalMutation = this.options.store.getWorkcellMutation(request.operationId);
    if (!finalMutation) throw new Error(`applied mutation disappeared: ${request.operationId}`);
    return { result: 'applied', mutation: finalMutation, receipt };
  }

  async reconcile(operationId: string, now: string): Promise<WorkcellFilePatchResult> {
    ensureTimestamp(now);
    const mutation = this.options.store.getWorkcellMutation(operationId);
    if (!mutation) throw new Error(`workcell mutation not found: ${operationId}`);
    const workcell = this.options.store.getWorkcell(mutation.workcellId);
    if (!workcell) throw new Error(`workcell not found: ${mutation.workcellId}`);
    const target = await this.resolveTarget(workcell, mutation.relativePath);
    if (mutation.status === 'effect_applied') {
      const current = await readStrictText(target.target);
      if (mutation.postimageHash && current.hash === mutation.postimageHash) {
        const receipt = this.makeReceipt(workcell, mutation, mutation.operationHash, mutation.preimageHash ?? mutation.expectedPreimageHash, mutation.postimageHash, now, 'reconciled', 'WorkcellWriteReconciledReceipt');
        this.options.store.recordWorkcellWriteReceipt(receipt, 'reconciled');
        const reconciledMutation = this.options.store.getWorkcellMutation(operationId);
        if (!reconciledMutation) throw new Error(`reconciled mutation disappeared: ${operationId}`);
        return { result: 'reconciled', mutation: reconciledMutation, receipt };
      }
      const postimageRejection = this.rejectMutation(mutation, 'postimage_changed_during_reconciliation', now, current.hash);
      if (!postimageRejection.receipt) throw new Error('postimage rejection receipt was not recorded');
      return { result: 'rejected', reason: 'postimage_changed_during_reconciliation', mutation, receipt: postimageRejection.receipt };
    }
    if (['prepared', 'preimage_verified', 'temp_prepared'].includes(mutation.status)) {
      const current = await readStrictText(target.target);
      if (current.hash === mutation.expectedPreimageHash) {
        const tempPath = path.join(path.dirname(target.target), `.brain-workcell-patch-${sha256(operationId).slice(0, 24)}.tmp`);
        await unlink(tempPath).catch(() => undefined);
        return { result: 'safe_to_resume', mutation };
      }
      const preimageRejection = this.rejectMutation(mutation, 'preimage_changed_during_reconciliation', now, current.hash);
      if (!preimageRejection.receipt) throw new Error('preimage rejection receipt was not recorded');
      return { result: 'rejected', reason: 'preimage_changed_during_reconciliation', mutation, receipt: preimageRejection.receipt };
    }
    const receipt = this.options.store.getWorkcellWriteReceipt(operationId);
    return receipt
      ? { result: mutation.status === 'reconciled' ? 'reconciled' : 'rejected', mutation, receipt }
      : { result: mutation.status === 'reconciled' ? 'reconciled' : 'rejected', mutation };
  }

  private async prepareTemp(tempPath: string, bytes: Buffer, mode: number): Promise<void> {
    const handle = await open(tempPath, 'wx', mode);
    try {
      await chmod(tempPath, mode);
      const partialLength = Math.max(1, Math.floor(bytes.byteLength / 2));
      if (this.options.failureInjector) {
        await handle.write(bytes.subarray(0, partialLength));
        await handle.sync();
        failure(this.options, 'during-temp-preparation');
        await handle.write(bytes.subarray(partialLength));
      } else {
        await handle.write(bytes);
      }
      await handle.sync();
    } finally {
      try { await handle.close(); } catch { /* already closed after injected crash */ }
    }
  }

  private async resolveTarget(workcell: AgentModeWorkcell, relativePath: string): Promise<{ root: string; target: string; mode: number }> {
    const target = await resolveTarget(workcell, relativePath);
    for (const other of this.options.store.listWorkcells()) {
      if (other.workcellId === workcell.workcellId) continue;
      try {
        if (path.resolve(await realpath(other.worktreePath)) === target.root) throw new Error('target resolves to another Workcell');
      } catch (error) {
        if (error instanceof Error && error.message === 'target resolves to another Workcell') throw error;
      }
    }
    return target;
  }

  private rejectMutation(mutation: AgentModeWorkcellMutation, reason: string, timestamp: string, observedPostimageHash: string | null = null): WorkcellFilePatchResult {
    const workcell = this.options.store.getWorkcell(mutation.workcellId);
    if (!workcell) throw new Error(`workcell not found: ${mutation.workcellId}`);
    const receipt = this.makeReceipt(workcell, mutation, mutation.operationHash, mutation.preimageHash ?? mutation.expectedPreimageHash, observedPostimageHash, timestamp, reason, 'WorkcellWriteRejectedReceipt');
    this.options.store.recordWorkcellWriteReceipt(receipt, 'rejected');
    const rejectedMutation = this.options.store.getWorkcellMutation(mutation.operationId);
    if (!rejectedMutation) throw new Error(`rejected mutation disappeared: ${mutation.operationId}`);
    return { result: 'rejected', reason, mutation: rejectedMutation, receipt };
  }

  private makeReceipt(
    workcell: AgentModeWorkcell,
    request: WorkcellFilePatchRequest | AgentModeWorkcellMutation,
    immutableHash: string,
    preimageHash: string,
    postimageHash: string | null,
    timestamp: string,
    result: string,
    receiptType: AgentModeWorkcellWriteReceipt['receiptType'],
  ): AgentModeWorkcellWriteReceipt {
    return {
      receiptId: `workcell-write-receipt:${request.operationId}:${immutableHash}:${receiptType}`,
      receiptType,
      taskId: workcell.taskId,
      runId: workcell.runId,
      attemptId: workcell.attemptId,
      workcellId: workcell.workcellId,
      operationId: request.operationId,
      leaseId: request.leaseId,
      fenceToken: request.fenceToken,
      repositoryRef: workcell.repositoryRef,
      relativePath: request.relativePath,
      preimageHash,
      postimageHash,
      timestamp,
      result,
      operationHash: immutableHash,
    };
  }
}
