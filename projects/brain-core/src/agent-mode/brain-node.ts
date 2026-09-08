import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AgentModeBudgetSettlement, AgentModeSqliteStateStore } from './sqlite-state-store.js';

export const BRAIN_NODE_PROTOCOL_VERSION = 'brain-node-v1';
export const BRAIN_NODE_READ_CAPABILITY = 'repo.read';

export type BrainNodeCapability = {
  capabilityId: typeof BRAIN_NODE_READ_CAPABILITY;
  maxBytes: number;
};

export type BrainNodeResourceBinding = {
  resourceId: string;
  rootPath: string;
  worktreeId?: string;
};

export type BrainNodeDescriptor = {
  nodeId: string;
  resourceRef: string;
  protocolVersion: typeof BRAIN_NODE_PROTOCOL_VERSION;
  capabilities: readonly BrainNodeCapability[];
  bindings: readonly BrainNodeResourceBinding[];
  platform: { os: string; arch: string };
  health: { state: 'available' | 'unavailable'; checkedAt: string };
};

export type BrainNodeCommand = {
  protocolVersion: string;
  controllerRef: string;
  nodeId: string;
  taskId: string;
  runId: string;
  attemptId: string;
  operationId: string;
  capabilityId: string;
  resourceId: string;
  worktreeId?: string;
  relativePath: string;
  scopeHash: string;
  grantId: string;
  policyVersion: string;
  lease: { resourceKey: string; leaseId: string; fence: number };
  deadline: string;
  correlationId: string;
  causationId: string;
  authProof: string;
};

export type BrainNodeReceiptStatus = 'succeeded' | 'failed' | 'rejected' | 'duplicate';

export type BrainNodeReceipt = {
  protocolVersion: typeof BRAIN_NODE_PROTOCOL_VERSION;
  nodeId: string;
  operationId: string;
  attemptId: string;
  capabilityId: string;
  scopeHash: string;
  observedFence: number | null;
  status: BrainNodeReceiptStatus;
  resultHash?: string;
  evidenceRef?: string;
  resultText?: string;
  startedAt: string;
  endedAt: string;
  effectHash?: string;
  errorCode?: string;
  reconciliation?: 'recorded' | 'duplicate' | 'conflict' | 'stale';
};

export type BrainNodeAuthInput = {
  protocolVersion: string;
  controllerRef: string;
  nodeId: string;
  operationId: string;
  attemptId: string;
  authProof: string;
};

export type BrainNodeAuthenticator = (input: BrainNodeAuthInput) => boolean;

export type BrainNodeFilesystem = {
  readFile: (filePath: string) => Promise<Buffer>;
  realpath: (filePath: string) => Promise<string>;
  stat: (filePath: string) => Promise<{ isFile: () => boolean }>;
};

export class BrainNodeCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BrainNodeCommandError';
  }
}

export function createFixtureAuthenticator(expected: {
  controllerRef: string;
  nodeId: string;
  proof: string;
}): BrainNodeAuthenticator {
  return (input) => input.controllerRef === expected.controllerRef
    && input.nodeId === expected.nodeId
    && input.authProof === expected.proof;
}

export function hashNodeReadScope(resourceId: string, worktreeId: string | undefined, relativePath: string): string {
  return createHash('sha256').update(JSON.stringify({
    capabilityId: BRAIN_NODE_READ_CAPABILITY,
    resourceId,
    worktreeId: worktreeId ?? null,
    relativePath,
  })).digest('hex');
}

function hashResult(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function validateRelativePath(relativePath: string): boolean {
  if (!nonEmpty(relativePath) || relativePath.includes('\0') || relativePath.includes('\\')) return false;
  if (path.isAbsolute(relativePath) || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) return false;
  if (relativePath.split('/').some((part) => part === '..' || part === '.')) return false;
  return path.posix.normalize(relativePath) === relativePath;
}

function sameOptional(left: string | undefined, right: string | undefined): boolean {
  return (left ?? undefined) === (right ?? undefined);
}

export class BrainNodeLocalPerimeter {
  private readonly filesystem: BrainNodeFilesystem;

  constructor(
    readonly descriptor: BrainNodeDescriptor,
    private readonly store: AgentModeSqliteStateStore,
    private readonly authenticate: BrainNodeAuthenticator,
    filesystem?: Partial<BrainNodeFilesystem>,
  ) {
    this.filesystem = {
      readFile: async (filePath) => readFile(filePath),
      realpath,
      stat,
      ...filesystem,
    };
  }

  async execute(command: BrainNodeCommand, now: string, settlement?: AgentModeBudgetSettlement): Promise<BrainNodeReceipt> {
    const startedAt = now;
    const malformed = !command || typeof command !== 'object'
      || !nonEmpty(command.protocolVersion)
      || !nonEmpty(command.controllerRef)
      || !nonEmpty(command.nodeId)
      || !nonEmpty(command.taskId)
      || !nonEmpty(command.runId)
      || !nonEmpty(command.attemptId)
      || !nonEmpty(command.operationId)
      || !nonEmpty(command.capabilityId)
      || !nonEmpty(command.resourceId)
      || !nonEmpty(command.relativePath)
      || !nonEmpty(command.scopeHash)
      || !nonEmpty(command.grantId)
      || !nonEmpty(command.policyVersion)
      || !nonEmpty(command.deadline)
      || !nonEmpty(command.correlationId)
      || !nonEmpty(command.causationId)
      || !nonEmpty(command.authProof)
      || !command.lease
      || !nonEmpty(command.lease.resourceKey)
      || !nonEmpty(command.lease.leaseId)
      || !Number.isInteger(command.lease.fence);
    if (malformed) return this.reject(command, 'invalid_command', startedAt);
    if (command.protocolVersion !== BRAIN_NODE_PROTOCOL_VERSION || this.descriptor.protocolVersion !== BRAIN_NODE_PROTOCOL_VERSION) {
      return this.reject(command, 'unsupported_protocol', startedAt);
    }
    if (command.nodeId !== this.descriptor.nodeId) return this.reject(command, 'wrong_node', startedAt);
    if (!this.authenticate({
      protocolVersion: command.protocolVersion,
      controllerRef: command.controllerRef,
      nodeId: command.nodeId,
      operationId: command.operationId,
      attemptId: command.attemptId,
      authProof: command.authProof,
    })) return this.reject(command, 'invalid_provenance', startedAt);
    if (this.descriptor.health.state !== 'available') return this.reject(command, 'node_unavailable', startedAt);
    const capability = this.descriptor.capabilities.find((item) => item.capabilityId === command.capabilityId);
    if (!capability) return this.reject(command, 'capability_not_advertised', startedAt);
    if (command.capabilityId !== BRAIN_NODE_READ_CAPABILITY) return this.reject(command, 'capability_not_advertised', startedAt);

    const task = this.store.getTask(command.taskId);
    const run = this.store.getRun(command.runId);
    const attempt = this.store.getAttempt(command.attemptId);
    if (!task || !run || !attempt || run.taskId !== task.taskId || run.runId !== command.runId
      || run.agentId !== attempt.agentId || attempt.runId !== run.runId) {
      return this.reject(command, 'operation_conflict', startedAt);
    }
    const outbox = this.store.getOutbox(command.operationId);
    if (!outbox || outbox.attemptId !== command.attemptId) return this.reject(command, 'outbox_missing', startedAt);
    if (outbox.capabilityId !== command.capabilityId) return this.reject(command, 'capability_not_granted', startedAt);
    if (outbox.grantId === undefined || outbox.grantId !== command.grantId) return this.reject(command, 'grant_mismatch', startedAt);
    if (outbox.policyVersion !== command.policyVersion) return this.reject(command, 'policy_mismatch', startedAt);
    if (outbox.scopeHash !== command.scopeHash || attempt.capabilityScopeHash !== command.scopeHash) return this.reject(command, 'scope_mismatch', startedAt);
    if (outbox.leaseResourceKey !== command.lease.resourceKey || outbox.leaseId !== command.lease.leaseId || outbox.leaseFence !== command.lease.fence) {
      return this.reject(command, 'stale_lease_fence', startedAt);
    }
    if (!this.store.isCurrentLease(command.attemptId, command.lease.resourceKey, command.lease.leaseId, command.lease.fence, now)) {
      return this.reject(command, 'stale_lease_fence', startedAt);
    }
    if (attempt.cancellationStatus !== 'running') return this.reject(command, 'cancellation_requested', startedAt);
    if (!Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(command.deadline)) || Date.parse(command.deadline) <= Date.parse(now)) {
      return this.reject(command, 'deadline_expired', startedAt);
    }
    if (!validateRelativePath(command.relativePath)) return this.reject(command, 'invalid_relative_path', startedAt);
    const binding = this.descriptor.bindings.find((item) => item.resourceId === command.resourceId);
    if (!binding) return this.reject(command, 'unknown_resource', startedAt);
    if (!sameOptional(binding.worktreeId, command.worktreeId)) return this.reject(command, 'resource_worktree_mismatch', startedAt);
    if (hashNodeReadScope(command.resourceId, command.worktreeId, command.relativePath) !== command.scopeHash) {
      return this.reject(command, 'scope_mismatch', startedAt);
    }

    const acceptedReceipt = this.store.getReceipt(command.operationId);
    if (acceptedReceipt) {
      return {
        protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
        nodeId: this.descriptor.nodeId,
        operationId: command.operationId,
        attemptId: command.attemptId,
        capabilityId: command.capabilityId,
        scopeHash: command.scopeHash,
        observedFence: command.lease.fence,
        status: 'duplicate',
        resultHash: acceptedReceipt.effectHash,
        evidenceRef: `evidence:${acceptedReceipt.effectHash}`,
        startedAt,
        endedAt: now,
        effectHash: acceptedReceipt.effectHash,
        reconciliation: 'duplicate',
      };
    }
    if (outbox.state !== 'dispatchable' && outbox.state !== 'dispatched') return this.reject(command, 'outbox_not_dispatchable', startedAt);

    let canonicalCandidate: string;
    try {
      const root = await this.filesystem.realpath(binding.rootPath);
      const lexicalCandidate = path.resolve(root, command.relativePath);
      if (!isContained(root, lexicalCandidate)) return this.reject(command, 'path_escape', startedAt);
      canonicalCandidate = await this.filesystem.realpath(lexicalCandidate);
      if (!isContained(root, canonicalCandidate)) return this.reject(command, 'symlink_escape', startedAt);
      const targetStats = await this.filesystem.stat(canonicalCandidate);
      if (!targetStats.isFile()) return this.reject(command, 'target_not_file', startedAt);
    } catch {
      return this.reject(command, 'resource_resolution_failed', startedAt);
    }

    if (outbox.state === 'dispatchable') {
      try {
        this.store.markDispatched(command.operationId, now);
      } catch (error) {
        return this.reject(command, error instanceof Error && error.message.includes('cancellation') ? 'cancellation_requested' : 'stale_lease_fence', startedAt);
      }
    }

    try {
      const content = await this.filesystem.readFile(canonicalCandidate);
      if (content.byteLength > capability.maxBytes) return this.recordFailure(command, startedAt, now, 'result_too_large');
      const resultText = content.toString('utf8');
      const resultHash = hashResult(resultText);
      const effectHash = hashResult(JSON.stringify({ operationId: command.operationId, capabilityId: command.capabilityId, scopeHash: command.scopeHash, resultHash, status: 'succeeded' }));
      const reconciliation = this.store.recordReceipt({
        operationId: command.operationId,
        attemptId: command.attemptId,
        scopeHash: command.scopeHash,
        effectHash,
        status: 'succeeded',
        recordedAt: now,
      }, settlement);
      if (reconciliation === 'conflict' || reconciliation === 'stale') return this.reject(command, 'receipt_reconciliation_failed', startedAt);
      return {
        protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
        nodeId: this.descriptor.nodeId,
        operationId: command.operationId,
        attemptId: command.attemptId,
        capabilityId: command.capabilityId,
        scopeHash: command.scopeHash,
        observedFence: command.lease.fence,
        status: reconciliation === 'duplicate' ? 'duplicate' : 'succeeded',
        resultHash,
        evidenceRef: `evidence:${resultHash}`,
        resultText,
        startedAt,
        endedAt: now,
        effectHash,
        reconciliation,
      };
    } catch (error) {
      if (error instanceof BrainNodeCommandError) throw error;
      return this.recordFailure(command, startedAt, now, 'read_failed');
    }
  }

  private async recordFailure(command: BrainNodeCommand, startedAt: string, endedAt: string, errorCode: string): Promise<BrainNodeReceipt> {
    const effectHash = hashResult(JSON.stringify({ operationId: command.operationId, capabilityId: command.capabilityId, scopeHash: command.scopeHash, errorCode, status: 'failed' }));
    const reconciliation = this.store.recordReceipt({
      operationId: command.operationId,
      attemptId: command.attemptId,
      scopeHash: command.scopeHash,
      effectHash,
      status: 'failed',
      recordedAt: endedAt,
    });
    return {
      protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
      nodeId: this.descriptor.nodeId,
      operationId: command.operationId,
      attemptId: command.attemptId,
      capabilityId: command.capabilityId,
      scopeHash: command.scopeHash,
      observedFence: command.lease.fence,
      status: reconciliation === 'duplicate' ? 'duplicate' : 'failed',
      startedAt,
      endedAt,
      effectHash,
      errorCode,
      reconciliation,
    };
  }

  private reject(command: Partial<BrainNodeCommand> | undefined, errorCode: string, at: string): BrainNodeReceipt {
    const fence = command?.lease?.fence;
    return {
      protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
      nodeId: this.descriptor.nodeId,
      operationId: typeof command?.operationId === 'string' ? command.operationId : 'unknown',
      attemptId: typeof command?.attemptId === 'string' ? command.attemptId : 'unknown',
      capabilityId: typeof command?.capabilityId === 'string' ? command.capabilityId : 'unknown',
      scopeHash: typeof command?.scopeHash === 'string' ? command.scopeHash : 'unknown',
      observedFence: typeof fence === 'number' && Number.isInteger(fence) ? fence : null,
      status: 'rejected',
      startedAt: at,
      endedAt: at,
      errorCode,
    };
  }
}
