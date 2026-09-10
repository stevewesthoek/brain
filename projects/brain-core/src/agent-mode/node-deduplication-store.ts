import { mkdir, open, readFile, rename, unlink, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BrainNodeDeduplicationRecord, BrainNodeDeduplicationStore } from './brain-node.js';

const SCHEMA_VERSION = 1;
const DEFAULT_RETENTION_MS = 86_400_000;
const MAX_RETENTION_MS = 7 * DEFAULT_RETENTION_MS;
const MAX_RECORDS = 512;
const LOCK_TIMEOUT_MS = 5_000;

type PersistedState = {
  schemaVersion: 1;
  records: Record<string, BrainNodeDeduplicationRecord>;
};

export class NodeDeduplicationConflictError extends Error {
  constructor(operationId: string) {
    super(`node deduplication conflict for ${operationId}`);
    this.name = 'NodeDeduplicationConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isValidReceipt(value: unknown): boolean {
  return isRecord(value)
    && value.protocolVersion === 'brain-node-v1'
    && typeof value.nodeId === 'string'
    && typeof value.operationId === 'string'
    && typeof value.attemptId === 'string'
    && typeof value.capabilityId === 'string'
    && typeof value.scopeHash === 'string'
    && ['succeeded', 'failed', 'rejected', 'duplicate'].includes(String(value.status))
    && typeof value.startedAt === 'string'
    && typeof value.endedAt === 'string';
}

function isValidEntry(key: string, value: unknown): value is BrainNodeDeduplicationRecord {
  if (!isRecord(value)
    || value.schemaVersion !== SCHEMA_VERSION
    || value.operationId !== key
    || typeof value.commandHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.commandHash)
    || typeof value.createdAt !== 'string'
    || typeof value.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(value.createdAt))
    || !Number.isFinite(Date.parse(value.expiresAt))
    || Date.parse(value.expiresAt) <= Date.parse(value.createdAt)
    || !isValidReceipt(value.receipt)) return false;
  return true;
}

function parseState(input: string): PersistedState {
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error('node deduplication state is corrupt'); }
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || !isRecord(value.records)) throw new Error('node deduplication state is corrupt');
  const records: Record<string, BrainNodeDeduplicationRecord> = {};
  for (const [key, entry] of Object.entries(value.records)) {
    if (!isValidEntry(key, entry)) throw new Error('node deduplication state is corrupt');
    records[key] = entry;
  }
  if (Object.keys(records).length > MAX_RECORDS) throw new Error('node deduplication state exceeds retention bound');
  return { schemaVersion: SCHEMA_VERSION, records };
}

export class FileNodeDeduplicationStore implements BrainNodeDeduplicationStore {
  private readonly retentionMs: number;

  constructor(private readonly filePath: string, retentionMs = DEFAULT_RETENTION_MS) {
    if (!filePath || !path.isAbsolute(filePath)) throw new Error('node deduplication path must be absolute');
    if (!Number.isSafeInteger(retentionMs) || retentionMs <= 0 || retentionMs > MAX_RETENTION_MS) throw new Error('node deduplication retention is outside bounds');
    this.retentionMs = retentionMs;
  }

  async lookup(operationId: string, now: string): Promise<BrainNodeDeduplicationRecord | undefined> {
    return this.withLock(async () => {
      const state = await this.readState();
      const changed = this.prune(state, now);
      if (changed) await this.writeState(state);
      return state.records[operationId];
    });
  }

  async remember(record: BrainNodeDeduplicationRecord): Promise<void> {
    if (!isValidEntry(record.operationId, record)) throw new Error('invalid node deduplication record');
    await this.withLock(async () => {
      const state = await this.readState();
      this.prune(state, record.createdAt);
      const existing = state.records[record.operationId];
      if (existing) {
        if (existing.commandHash !== record.commandHash) throw new NodeDeduplicationConflictError(record.operationId);
        return;
      }
      if (Object.keys(state.records).length >= MAX_RECORDS) {
        const oldest = Object.entries(state.records).sort(([, left], [, right]) => Date.parse(left.createdAt) - Date.parse(right.createdAt))[0]?.[0];
        if (oldest) delete state.records[oldest];
      }
      state.records[record.operationId] = record;
      await this.writeState(state);
    });
  }

  private prune(state: PersistedState, now: string): boolean {
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) throw new Error('node deduplication clock is invalid');
    let changed = false;
    for (const [operationId, record] of Object.entries(state.records)) {
      if (Date.parse(record.expiresAt) <= nowMs || Date.parse(record.createdAt) < nowMs - this.retentionMs) {
        delete state.records[operationId];
        changed = true;
      }
    }
    return changed;
  }

  private async readState(): Promise<PersistedState> {
    try { return parseState(await readFile(this.filePath, 'utf8')); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return { schemaVersion: SCHEMA_VERSION, records: {} };
      throw error;
    }
  }

  private async writeState(state: PersistedState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    await chmod(path.dirname(this.filePath), 0o700);
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.filePath);
    await chmod(this.filePath, 0o600);
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = `${this.filePath}.lock`;
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    await chmod(path.dirname(this.filePath), 0o700);
    const startedAt = Date.now();
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    while (!handle) {
      try { handle = await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
        if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) throw new Error('node deduplication lock unavailable');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    try { return await operation(); }
    finally {
      await handle.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }
}
