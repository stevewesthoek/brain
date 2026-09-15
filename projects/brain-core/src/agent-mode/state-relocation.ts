import { createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AgentModeSqliteStateStore, type AgentModePortableRecordFamily } from './sqlite-state-store.js';

export const BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION = 'brain-state-snapshot-v1' as const;
export const BRAIN_STATE_IMPORT_SCHEMA_VERSION = 'brain-state-import-v1' as const;
export const BRAIN_RELOCATION_SCHEMA_VERSION = 'brain-control-plane-relocation-v1' as const;
export const STATE_SNAPSHOT_MAX_FAMILIES = 64;
export const STATE_SNAPSHOT_MAX_RECORDS = 10_000;
export const STATE_SNAPSHOT_MAX_RECORD_BYTES = 1_048_576;
export const STATE_SNAPSHOT_MAX_BYTES = 32 * 1024 * 1024;

export type BrainStateSnapshot = {
  schemaVersion: typeof BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION;
  snapshotId: string;
  sourceStoreSchemaVersion: number;
  sourceDomainVersion: 'agent-mode-v1';
  createdAt: string;
  mode: 'relocation-final' | 'backup/logical-fixture';
  recordFamilies: readonly AgentModePortableRecordFamily[];
  counts: Record<string, number>;
  hashes: Record<string, string>;
  aggregateHash: string;
};

export type StateSnapshotVerification = { ok: true; snapshot: BrainStateSnapshot } | { ok: false; reasonCode: string; detail: string };
export type StateImportResult = { ok: true; snapshotId: string; targetStoreSchemaVersion: number; counts: Record<string, number>; verificationHash: string } | { ok: false; reasonCode: string; detail: string };
export type RelocationPlan = {
  schemaVersion: typeof BRAIN_RELOCATION_SCHEMA_VERSION;
  sourceSnapshotId: string;
  sourceStoreSchemaVersion: number;
  targetRuntimePackageId: string;
  targetInstallId: string;
  targetStorePath: string;
  activation: 'ready-for-activation' | 'blocked';
  blockers: readonly ('source_not_quiesced' | 'snapshot_invalid' | 'schema_incompatible' | 'target_not_fresh' | 'package_incompatible' | 'target_config_invalid' | 'required_secret_missing' | 'host_local_authority_unreconciled' | 'uncertain_effect_requires_operator_attention')[];
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function assertBoundedSnapshot(snapshot: BrainStateSnapshot): void {
  if (snapshot.schemaVersion !== BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION) throw new Error('unsupported snapshot schema');
  if (!Number.isInteger(snapshot.sourceStoreSchemaVersion) || snapshot.sourceStoreSchemaVersion !== 10) throw new Error('incompatible StateStore schema');
  if (!Number.isFinite(Date.parse(snapshot.createdAt)) || snapshot.recordFamilies.length > STATE_SNAPSHOT_MAX_FAMILIES) throw new Error('snapshot metadata is invalid');
  let total = 0;
  for (const family of snapshot.recordFamilies) {
    if (!/^[A-Za-z0-9_]{1,96}$/u.test(family.family) || family.records.length > STATE_SNAPSHOT_MAX_RECORDS) throw new Error('snapshot family bound is invalid');
    total += family.records.length;
    for (const record of family.records) if (Buffer.byteLength(canonical(record), 'utf8') > STATE_SNAPSHOT_MAX_RECORD_BYTES) throw new Error('snapshot record is too large');
  }
  if (total > STATE_SNAPSHOT_MAX_RECORDS || Object.keys(snapshot.counts).length !== snapshot.recordFamilies.length || Object.keys(snapshot.hashes).length !== snapshot.recordFamilies.length) throw new Error('snapshot completeness is invalid');
}
function snapshotMaterial(snapshot: BrainStateSnapshot): unknown {
  return { schemaVersion: snapshot.schemaVersion, sourceStoreSchemaVersion: snapshot.sourceStoreSchemaVersion, sourceDomainVersion: snapshot.sourceDomainVersion, mode: snapshot.mode, recordFamilies: snapshot.recordFamilies.map((family) => ({ family: family.family, records: family.records })) };
}

export function createStateSnapshot(store: AgentModeSqliteStateStore, input: { mode: BrainStateSnapshot['mode']; createdAt: string }): BrainStateSnapshot {
  if (!store.isReadOnly) throw new Error('final relocation export requires an offline read-only store');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('snapshot timestamp is invalid');
  if (store.quickIntegrityCheck() !== 'ok') throw new Error('source SQLite integrity check failed');
  const recordFamilies = store.readPortableRecordFamilies(STATE_SNAPSHOT_MAX_RECORDS);
  const counts = Object.fromEntries(recordFamilies.map((family) => [family.family, family.records.length]));
  const hashes = Object.fromEntries(recordFamilies.map((family) => [family.family, hash(family.records)]));
  const draft = { schemaVersion: BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION, sourceStoreSchemaVersion: store.schemaVersion, sourceDomainVersion: 'agent-mode-v1' as const, mode: input.mode, recordFamilies, counts, hashes };
  const aggregateHash = hash(draft);
  const snapshot = { ...draft, createdAt: input.createdAt, snapshotId: `brain-state-snapshot:sha256:${hash({ ...draft, aggregateHash })}`, aggregateHash };
  assertBoundedSnapshot(snapshot);
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > STATE_SNAPSHOT_MAX_BYTES) throw new Error('snapshot exceeds total size bound');
  return snapshot;
}

export function verifyStateSnapshot(snapshot: unknown): StateSnapshotVerification {
  try {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('snapshot must be an object');
    const candidate = snapshot as BrainStateSnapshot;
    assertBoundedSnapshot(candidate);
    for (const family of candidate.recordFamilies) if (candidate.counts[family.family] !== family.records.length || candidate.hashes[family.family] !== hash(family.records)) throw new Error('snapshot family hash mismatch');
    const expectedAggregate = hash({ schemaVersion: candidate.schemaVersion, sourceStoreSchemaVersion: candidate.sourceStoreSchemaVersion, sourceDomainVersion: candidate.sourceDomainVersion, mode: candidate.mode, recordFamilies: candidate.recordFamilies, counts: candidate.counts, hashes: candidate.hashes });
    if (candidate.aggregateHash !== expectedAggregate) throw new Error('snapshot aggregate hash mismatch');
    const expectedId = `brain-state-snapshot:sha256:${hash({ schemaVersion: candidate.schemaVersion, sourceStoreSchemaVersion: candidate.sourceStoreSchemaVersion, sourceDomainVersion: candidate.sourceDomainVersion, mode: candidate.mode, recordFamilies: candidate.recordFamilies, counts: candidate.counts, hashes: candidate.hashes, aggregateHash: candidate.aggregateHash })}`;
    if (candidate.snapshotId !== expectedId) throw new Error('snapshot identity mismatch');
    return { ok: true, snapshot: candidate };
  } catch (error) { return { ok: false, reasonCode: 'SNAPSHOT_INVALID', detail: error instanceof Error ? error.message : String(error) }; }
}

export function writeStateSnapshot(snapshot: BrainStateSnapshot, outputPath: string): void {
  if (!verifyStateSnapshot(snapshot).ok) throw new Error('cannot write an unverified snapshot');
  if (!path.isAbsolute(outputPath) || outputPath.length > 1024 || existsSync(outputPath)) throw new Error('snapshot output must be a fresh absolute path');
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  chmodSync(outputPath, 0o600);
}
export function readStateSnapshot(snapshotPath: string): BrainStateSnapshot {
  if (!path.isAbsolute(snapshotPath) || !lstatSync(snapshotPath).isFile() || statSync(snapshotPath).size > STATE_SNAPSHOT_MAX_BYTES) throw new Error('snapshot path is invalid');
  const parsed = JSON.parse(readFileSync(snapshotPath, 'utf8')) as unknown;
  const verification = verifyStateSnapshot(parsed);
  if (!verification.ok) throw new Error(`${verification.reasonCode}: ${verification.detail}`);
  return verification.snapshot;
}

export function importStateSnapshot(snapshot: BrainStateSnapshot, targetStorePath: string, expectedSnapshotId: string): StateImportResult {
  const verification = verifyStateSnapshot(snapshot);
  if (!verification.ok) return verification;
  if (expectedSnapshotId !== snapshot.snapshotId || !path.isAbsolute(targetStorePath) || targetStorePath === ':memory:' || (existsSync(targetStorePath) && (lstatSync(targetStorePath).isSymbolicLink() || statSync(targetStorePath).size > 0))) return { ok: false, reasonCode: 'TARGET_NOT_FRESH', detail: 'import requires a fresh target StateStore path' };
  let store: AgentModeSqliteStateStore | undefined;
  try {
    store = new AgentModeSqliteStateStore(targetStorePath);
    store.importPortableRecordFamilies(snapshot.recordFamilies);
    const targetSchema = store.schemaVersion;
    store.close(); store = undefined;
    return { ok: true, snapshotId: snapshot.snapshotId, targetStoreSchemaVersion: targetSchema, counts: snapshot.counts, verificationHash: snapshot.aggregateHash };
  } catch (error) {
    store?.close();
    rmSync(targetStorePath, { force: true }); rmSync(`${targetStorePath}-wal`, { force: true }); rmSync(`${targetStorePath}-shm`, { force: true });
    return { ok: false, reasonCode: 'IMPORT_FAILED', detail: error instanceof Error ? error.message : String(error) };
  }
}

export function createRelocationPlan(input: { snapshot: BrainStateSnapshot; targetRuntimePackageId: string; targetInstallId: string; targetStorePath: string; targetConfigValid: boolean; requiredSecretProvisioned: boolean; hostLocalAuthorityReconciled: boolean }): RelocationPlan {
  const verification = verifyStateSnapshot(input.snapshot);
  const blockers: Array<RelocationPlan['blockers'][number]> = [];
  if (!verification.ok) blockers.push('snapshot_invalid');
  if (!path.isAbsolute(input.targetStorePath)) blockers.push('target_not_fresh');
  if (!input.targetConfigValid) blockers.push('target_config_invalid');
  if (!input.requiredSecretProvisioned) blockers.push('required_secret_missing');
  if (!input.hostLocalAuthorityReconciled) blockers.push('host_local_authority_unreconciled');
  return { schemaVersion: BRAIN_RELOCATION_SCHEMA_VERSION, sourceSnapshotId: input.snapshot.snapshotId, sourceStoreSchemaVersion: input.snapshot.sourceStoreSchemaVersion, targetRuntimePackageId: input.targetRuntimePackageId, targetInstallId: input.targetInstallId, targetStorePath: input.targetStorePath, activation: blockers.length === 0 ? 'ready-for-activation' : 'blocked', blockers };
}
