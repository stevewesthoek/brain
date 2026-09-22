import { spawn } from 'node:child_process';
import { brainNodeAuthProof, brainNodeEffectHash, type BrainNodeCommand, type BrainNodeDescriptor, type BrainNodeReceipt, BrainNodeLocalPerimeter } from './brain-node.js';
import { SSH_NODE_RUNNER_ARGV, validateSshNodeEnrollment, type SshNodeEnrollment } from './node-enrollment.js';
import type { AgentModeBudgetSettlement, AgentModeSqliteStateStore } from './sqlite-state-store.js';

export type NodeTransportErrorKind = 'transport_disconnected' | 'transport_failed' | 'protocol_rejected' | 'invalid_receipt';
export type NodeDeliveryState = 'not_sent' | 'sent_receipt_unknown' | 'receipt_known' | 'remote_rejected' | 'invalid_receipt' | 'transport_unavailable';

export class NodeTransportError extends Error {
  constructor(readonly kind: NodeTransportErrorKind, message: string, readonly deliveryState: NodeDeliveryState = 'transport_unavailable') {
    super(message);
    this.name = 'NodeTransportError';
  }
}

export type NodeTransport = {
  readonly transportRef: string;
  negotiate(): Promise<BrainNodeDescriptor>;
  execute(command: BrainNodeCommand, settlement?: AgentModeBudgetSettlement): Promise<BrainNodeReceipt>;
};

export type ProcessResult = { code: number | null; stdout: string; stderr: string; sent?: boolean };
export type ProcessRunner = (file: string, args: readonly string[], input: string, timeoutMs: number) => Promise<ProcessResult>;

const MAX_PROTOCOL_BYTES = 1_048_576;

function runProcess(file: string, args: readonly string[], input: string, timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const sent = input.length > 0;
    let settled = false;
    const finish = (result: ProcessResult): void => { if (!settled) { settled = true; resolve({ ...result, sent }); } };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ code: null, stdout, stderr: `${stderr}\ntransport timeout` });
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); if (Buffer.byteLength(stdout) > MAX_PROTOCOL_BYTES) child.kill('SIGTERM'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8').slice(0, MAX_PROTOCOL_BYTES); });
    child.once('error', (error) => { clearTimeout(timer); if (!settled) { settled = true; reject(error); } });
    child.once('close', (code) => { clearTimeout(timer); finish({ code, stdout, stderr }); });
    child.stdin.end(input);
  });
}

function parseOneJsonLine(stdout: string, context: string): Record<string, unknown> {
  if (Buffer.byteLength(stdout) > MAX_PROTOCOL_BYTES) throw new NodeTransportError('invalid_receipt', `${context}: protocol output too large`);
  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length !== 1) throw new NodeTransportError('invalid_receipt', `${context}: expected exactly one JSON line`);
  try {
    const value = JSON.parse(lines[0]!) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value as Record<string, unknown>;
  } catch {
    throw new NodeTransportError('invalid_receipt', `${context}: malformed JSON envelope`);
  }
}

function validateDescriptor(descriptor: BrainNodeDescriptor, enrollment: SshNodeEnrollment, now: string, healthMaxAgeMs: number): BrainNodeDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || descriptor.protocolVersion !== 'brain-node-v1' || !descriptor.runnerVersion || !Array.isArray(descriptor.capabilities) || !Array.isArray(descriptor.bindings) || !descriptor.health || !descriptor.platform) throw new NodeTransportError('protocol_rejected', 'node protocol or descriptor shape mismatch');
  if (descriptor.nodeId !== enrollment.nodeId) throw new NodeTransportError('protocol_rejected', 'node identity mismatch');
  if (descriptor.resourceRef !== enrollment.resourceRef) throw new NodeTransportError('protocol_rejected', 'node resource identity mismatch');
  if (descriptor.health.state !== 'available') throw new NodeTransportError('protocol_rejected', 'node is unavailable');
  const checkedAt = Date.parse(descriptor.health.checkedAt);
  const observedAt = Date.parse(now);
  if (!Number.isFinite(checkedAt) || !Number.isFinite(observedAt) || checkedAt > observedAt + 5_000 || observedAt - checkedAt > healthMaxAgeMs) throw new NodeTransportError('protocol_rejected', 'node health evidence is stale');
  if (descriptor.capabilities.length !== 1 || descriptor.capabilities[0]?.capabilityId !== 'repo.read' || !Number.isSafeInteger(descriptor.capabilities[0]?.maxBytes) || descriptor.capabilities[0]!.maxBytes <= 0) throw new NodeTransportError('protocol_rejected', 'node capability negotiation mismatch');
  return descriptor;
}

export function validateBrainNodeReceipt(command: BrainNodeCommand, receipt: unknown, expectedNodeId: string): BrainNodeReceipt {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new NodeTransportError('invalid_receipt', 'receipt is not an object');
  const value = receipt as Record<string, unknown>;
  if (value.protocolVersion !== 'brain-node-v1' || value.nodeId !== expectedNodeId) throw new NodeTransportError('invalid_receipt', 'receipt protocol or node identity mismatch');
  if (value.operationId !== command.operationId || value.attemptId !== command.attemptId || value.capabilityId !== command.capabilityId || value.scopeHash !== command.scopeHash) throw new NodeTransportError('invalid_receipt', 'receipt lineage or scope mismatch');
  if (!['succeeded', 'failed', 'rejected', 'duplicate'].includes(String(value.status))) throw new NodeTransportError('invalid_receipt', 'receipt status is invalid');
  if (!Number.isFinite(Date.parse(String(value.startedAt))) || !Number.isFinite(Date.parse(String(value.endedAt)))) throw new NodeTransportError('invalid_receipt', 'receipt timestamps are invalid');
  if (value.observedFence !== null && value.observedFence !== command.lease.fence) throw new NodeTransportError('invalid_receipt', 'receipt fence mismatch');
  if ((value.status === 'succeeded' || value.status === 'duplicate') && (typeof value.resultHash !== 'string' || typeof value.effectHash !== 'string')) throw new NodeTransportError('invalid_receipt', 'successful receipt lacks integrity hashes');
  if (value.status === 'succeeded' && value.effectHash !== brainNodeEffectHash(command, String(value.resultHash), 'succeeded')) throw new NodeTransportError('invalid_receipt', 'receipt effect hash mismatch');
  if (value.status === 'failed' && typeof value.effectHash !== 'string') throw new NodeTransportError('invalid_receipt', 'failed receipt lacks integrity hash');
  return value as unknown as BrainNodeReceipt;
}

export class LocalNodeTransport implements NodeTransport {
  readonly transportRef = 'local';
  constructor(private readonly node: BrainNodeLocalPerimeter, private readonly options: { clock?: () => string } = {}) {}
  async negotiate(): Promise<BrainNodeDescriptor> { return this.node.descriptor; }
  async execute(command: BrainNodeCommand, settlement?: AgentModeBudgetSettlement): Promise<BrainNodeReceipt> {
    return validateBrainNodeReceipt(command, await this.node.execute(command, this.options.clock?.() ?? new Date().toISOString(), settlement), this.node.descriptor.nodeId);
  }
}

export type SshNodeTransportOptions = {
  enrollment: SshNodeEnrollment;
  knownResourceRefs: ReadonlySet<string>;
  authSecret: string;
  sshPath?: string;
  timeoutMs?: number;
  runProcess?: ProcessRunner;
  healthMaxAgeMs?: number;
  clock?: () => string;
  stateStore?: AgentModeSqliteStateStore;
};

export class SshNodeTransport implements NodeTransport {
  readonly transportRef: string;
  private readonly enrollment: SshNodeEnrollment;
  private readonly authSecret: string;
  private readonly sshPath: string;
  private readonly timeoutMs: number;
  private readonly run: ProcessRunner;
  private readonly healthMaxAgeMs: number;
  private readonly clock: () => string;
  private readonly stateStore: AgentModeSqliteStateStore | undefined;

  constructor(options: SshNodeTransportOptions) {
    if (!options.enrollment) throw new Error('SSH NodeTransport requires explicit enrollment');
    this.enrollment = options.enrollment;
    validateSshNodeEnrollment(this.enrollment, options.knownResourceRefs);
    if (!options.authSecret) throw new Error('SSH NodeTransport requires a node authentication secret');
    this.authSecret = options.authSecret;
    this.sshPath = options.sshPath ?? '/usr/bin/ssh';
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.run = options.runProcess ?? runProcess;
    this.healthMaxAgeMs = options.healthMaxAgeMs ?? 60_000;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.stateStore = options.stateStore;
    this.transportRef = this.enrollment.transportRef;
  }

  private sshArgs(mode: '--handshake' | '--execute'): string[] {
    return ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no', '-o', 'ConnectTimeout=5', this.enrollment.hostAlias, ...SSH_NODE_RUNNER_ARGV, mode];
  }

  async negotiate(): Promise<BrainNodeDescriptor> {
    let result: ProcessResult;
    try { result = await this.run(this.sshPath, this.sshArgs('--handshake'), '', this.timeoutMs); } catch (error) { throw new NodeTransportError('transport_disconnected', `SSH handshake could not start: ${error instanceof Error ? error.message : String(error)}`, 'transport_unavailable'); }
    if (result.code !== 0) throw new NodeTransportError('transport_disconnected', `SSH handshake failed with exit ${result.code ?? 'unknown'}`, 'transport_unavailable');
    const envelope = parseOneJsonLine(result.stdout, 'handshake');
    if (envelope.kind !== 'brain-node-handshake' || envelope.protocolVersion !== 'brain-node-v1') throw new NodeTransportError('protocol_rejected', 'unexpected handshake envelope');
    const descriptor = envelope.descriptor as BrainNodeDescriptor | undefined;
    if (!descriptor) throw new NodeTransportError('protocol_rejected', 'handshake descriptor missing');
    return validateDescriptor(descriptor, this.enrollment, this.clock(), this.healthMaxAgeMs);
  }

  async execute(command: BrainNodeCommand, settlement?: AgentModeBudgetSettlement): Promise<BrainNodeReceipt> {
    const descriptor = await this.negotiate();
    if (command.nodeId !== descriptor.nodeId || !descriptor.bindings.some((binding) => binding.resourceId === command.resourceId) || command.capabilityId !== 'repo.read') throw new NodeTransportError('protocol_rejected', 'command is outside negotiated node authority', 'not_sent');
    const signedCommand = { ...command, authProof: brainNodeAuthProof({ protocolVersion: command.protocolVersion, controllerRef: command.controllerRef, nodeId: command.nodeId, operationId: command.operationId, attemptId: command.attemptId, authProof: command.authProof }, this.authSecret) };
    let result: ProcessResult;
    try { result = await this.run(this.sshPath, this.sshArgs('--execute'), `${JSON.stringify(signedCommand)}\n`, this.timeoutMs); } catch (error) { throw new NodeTransportError('transport_disconnected', `SSH command transport failed: ${error instanceof Error ? error.message : String(error)}`, 'not_sent'); }
    const sent = result.sent ?? true;
    if (result.code !== 0) {
      if (sent) throw this.receiptUnknown(command, result.code === null ? 'transport_disconnected' : 'transport_failed', `SSH runner failed with exit ${result.code ?? 'unknown'}`);
      throw new NodeTransportError('transport_failed', `SSH runner failed before command delivery with exit ${result.code ?? 'unknown'}`, 'not_sent');
    }
    let envelope: Record<string, unknown>;
    try { envelope = parseOneJsonLine(result.stdout, 'receipt'); }
    catch (error) {
      if (error instanceof NodeTransportError) throw this.receiptUnknown(command, 'invalid_receipt', error.message);
      throw this.receiptUnknown(command, 'invalid_receipt', 'receipt envelope parsing failed');
    }
    if (envelope.kind !== 'brain-node-receipt') throw this.receiptUnknown(command, 'invalid_receipt', 'unexpected receipt envelope');
    let receipt: BrainNodeReceipt;
    try { receipt = validateBrainNodeReceipt(signedCommand, envelope.receipt, descriptor.nodeId); }
    catch (error) {
      if (error instanceof NodeTransportError) throw this.receiptUnknown(command, 'invalid_receipt', error.message);
      throw this.receiptUnknown(command, 'invalid_receipt', 'receipt validation failed');
    }
    return receipt;
  }

  async reconnect(): Promise<BrainNodeDescriptor> { return this.negotiate(); }

  private receiptUnknown(command: BrainNodeCommand, kind: 'transport_disconnected' | 'transport_failed' | 'invalid_receipt', message: string): NodeTransportError {
    try { this.stateStore?.markEffectObserved(command.operationId, this.clock()); } catch { /* the durable operation remains unresolved and must not be replayed */ }
    return new NodeTransportError(kind, message, 'sent_receipt_unknown');
  }
}

export function createSshNodeTransport(options: SshNodeTransportOptions): SshNodeTransport {
  return new SshNodeTransport(options);
}
