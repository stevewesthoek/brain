import { createHash, createPublicKey, type KeyObject, sign, verify } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, lstatSync, readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { readRuntimePackageManifest, BRAIN_LOCAL_INSTALL_SCHEMA_VERSION } from './local-install.js';
import { verifyRuntimePackage, type BrainRuntimePackage } from './runtime-package.js';
import { verifyStateSnapshot, type BrainStateSnapshot, BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION } from './state-relocation.js';

export const BRAIN_AGENT_RELEASE_SCHEMA_VERSION = 'brain-agent-release-v1' as const;
export const BRAIN_AGENT_RELEASE_CONTRACT_VERSION = 'brain-agent-release-contract-v1' as const;
export const BRAIN_AGENT_BACKUP_SCHEMA_VERSION = 'brain-agent-backup-v1' as const;
export const BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION = 11 as const;
export const BRAIN_AGENT_MAX_MANIFEST_BYTES = 256 * 1024;
export const BRAIN_AGENT_MAX_EVIDENCE_REFS = 64;
export const BRAIN_AGENT_RELEASE_RETENTION_RECEIPT_SCHEMA_VERSION = 'brain-agent-release-retention-receipt-v1' as const;
export const BRAIN_AGENT_MAX_RETENTION_METADATA_BYTES = 64 * 1024;

type KeyMaterial = KeyObject | string | Buffer;

export type ReleaseProvenance = {
  scheme: 'ed25519-sha256';
  keyId: string;
  signature: string;
};

export type BrainAgentReleaseManifest = {
  schemaVersion: typeof BRAIN_AGENT_RELEASE_SCHEMA_VERSION;
  releaseVersion: string;
  releaseId: string;
  sourceRevision: string;
  runtimePackageId: string;
  runtimePackageManifestHash: string;
  coreBuildIdentity: string;
  consoleBuildIdentity: string;
  stateStoreSchemaVersion: typeof BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION;
  stateSnapshotSchemaVersion: typeof BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION;
  installContractVersion: typeof BRAIN_LOCAL_INSTALL_SCHEMA_VERSION;
  releaseContractVersion: typeof BRAIN_AGENT_RELEASE_CONTRACT_VERSION;
  nodeRange: string;
  buildTimestamp: string;
  supportStatus: 'candidate' | 'supported' | 'rollback-only';
  previousReleaseVersion: string | null;
  provenance: ReleaseProvenance;
};

export type ReleaseVerification = { ok: true; manifest: BrainAgentReleaseManifest } | { ok: false; reasonCode: ReleaseVerificationReason; detail: string };
export type ReleaseVerificationReason = 'INVALID_MANIFEST' | 'UNSUPPORTED_SCHEMA' | 'PACKAGE_UNVERIFIED' | 'PACKAGE_MISMATCH' | 'SIGNATURE_INVALID' | 'UNSAFE_MANIFEST';

export type BrainAgentBackupManifest = {
  schemaVersion: typeof BRAIN_AGENT_BACKUP_SCHEMA_VERSION;
  backupId: string;
  backupHash: string;
  releaseId: string;
  releaseVersion: string;
  snapshotId: string;
  snapshotAggregateHash: string;
  sourceStoreSchemaVersion: typeof BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION;
  snapshotSchemaVersion: typeof BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION;
  recordFamilyCounts: Record<string, number>;
  createdAt: string;
};

export type BackupVerification = { ok: true; backup: BrainAgentBackupManifest } | { ok: false; reasonCode: 'BACKUP_INVALID' | 'SNAPSHOT_INVALID' | 'UNSAFE_BACKUP'; detail: string };

export type PromotionAssessment = {
  status: 'promotable' | 'blocked';
  blockers: readonly ('release_unverified' | 'backup_unverified' | 'restore_not_verified' | 'isolated_smoke_not_passed' | 'rollback_not_verified')[];
};

export type RollbackCompatibility = 'compatible' | 'restore-required' | 'incompatible';
export type ReleaseSigner = (canonicalMaterial: string) => string;

export type BrainAgentReleaseRetentionReceipt = {
  schemaVersion: typeof BRAIN_AGENT_RELEASE_RETENTION_RECEIPT_SCHEMA_VERSION;
  releaseId: string;
  releaseVersion: string;
  packageId: string;
  packageManifestHash: string;
  sourceRevision: string;
  retainedAt: string;
  verification: { package: true; release: true };
  privateSigningMaterialRetained: false;
};

export type ReleaseRetentionResult = {
  status: 'retained' | 'already-retained';
  vaultPath: string;
  receipt: BrainAgentReleaseRetentionReceipt;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function isIso(value: string): boolean { return Number.isFinite(Date.parse(value)); }
function boundedText(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value); }
function releaseVersion(value: unknown): value is string { return typeof value === 'string' && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/u.test(value); }
function key(value: KeyMaterial): KeyObject | string | Buffer { return value; }

function publicKeyBase64(value: KeyMaterial): string {
  const keyObject = typeof value === 'object' && value !== null && 'type' in value && 'export' in value ? value as KeyObject : createPublicKey(value);
  const spki = keyObject.export({ type: 'spki', format: 'der' });
  const ed25519Prefix = '302a300506032b6570032100';
  if (spki.length !== 44 || spki.subarray(0, 12).toString('hex') !== ed25519Prefix) throw new Error('signing public key must be Ed25519');
  return spki.subarray(12).toString('base64');
}

function readBoundedJson(filePath: string, label: string): { value: Record<string, unknown>; text: string } {
  if (!path.isAbsolute(filePath) || !existsSync(filePath) || statSync(filePath).size > BRAIN_AGENT_MAX_RETENTION_METADATA_BYTES) throw new Error(`${label} path is invalid or oversized`);
  const text = readFileSync(filePath, 'utf8');
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object`);
  return { value: value as Record<string, unknown>, text };
}

function validateSigningPublicMetadata(value: Record<string, unknown>, release: BrainAgentReleaseManifest, publicKey: KeyMaterial): void {
  const allowed = new Set(['schemaVersion', 'keyId', 'algorithm', 'backend', 'reference', 'publicKeyBase64', 'fingerprint', 'privateKeyExported', 'status']);
  if (Object.keys(value).some((field) => !allowed.has(field))) throw new Error('signing public metadata contains unsupported fields');
  if (value.schemaVersion !== 'brain-agent-release-signing-public-v1' || value.keyId !== release.provenance.keyId || value.algorithm !== 'Ed25519' || value.privateKeyExported !== false || value.status !== 'active' || typeof value.publicKeyBase64 !== 'string' || value.publicKeyBase64 !== publicKeyBase64(publicKey)) throw new Error('signing public metadata is not bound to the verified release signer');
  for (const field of ['backend', 'reference', 'fingerprint']) if (typeof value[field] !== 'string' || !boundedText(value[field], 512)) throw new Error('signing public metadata is invalid');
}

function retentionReceipt(release: BrainAgentReleaseManifest, pkg: BrainRuntimePackage, retainedAt: string): BrainAgentReleaseRetentionReceipt {
  return {
    schemaVersion: BRAIN_AGENT_RELEASE_RETENTION_RECEIPT_SCHEMA_VERSION,
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    packageId: pkg.packageId,
    packageManifestHash: pkg.manifestHash,
    sourceRevision: release.sourceRevision,
    retainedAt,
    verification: { package: true, release: true },
    privateSigningMaterialRetained: false,
  };
}

function retentionReceiptIdentity(receipt: BrainAgentReleaseRetentionReceipt): string {
  const { retainedAt: _retainedAt, ...identity } = receipt;
  return canonical(identity);
}

function packageComponentIdentity(pkg: BrainRuntimePackage, component: 'brain-core' | 'brain-console'): string {
  return `sha256:${hash(pkg.files.filter((file) => file.component === component).map((file) => ({ relativePath: file.relativePath, sha256: file.sha256, size: file.size })))}`;
}

function identityMaterial(input: Omit<BrainAgentReleaseManifest, 'releaseId' | 'provenance' | 'buildTimestamp' | 'supportStatus'>): Record<string, unknown> {
  return { schemaVersion: input.schemaVersion, releaseVersion: input.releaseVersion, sourceRevision: input.sourceRevision, runtimePackageId: input.runtimePackageId, runtimePackageManifestHash: input.runtimePackageManifestHash, coreBuildIdentity: input.coreBuildIdentity, consoleBuildIdentity: input.consoleBuildIdentity, stateStoreSchemaVersion: input.stateStoreSchemaVersion, stateSnapshotSchemaVersion: input.stateSnapshotSchemaVersion, installContractVersion: input.installContractVersion, releaseContractVersion: input.releaseContractVersion, nodeRange: input.nodeRange, previousReleaseVersion: input.previousReleaseVersion };
}

function signedMaterial(manifest: BrainAgentReleaseManifest): string {
  const { provenance: _provenance, releaseId: _releaseId, ...material } = manifest;
  return canonical(material);
}

function releaseId(manifest: Omit<BrainAgentReleaseManifest, 'releaseId' | 'provenance'>): string {
  return `brain-agent-release:sha256:${hash(identityMaterial(manifest as Omit<BrainAgentReleaseManifest, 'releaseId' | 'provenance' | 'buildTimestamp' | 'supportStatus'>))}`;
}

export function createReleaseManifest(input: {
  packageRoot: string;
  releaseVersion: string;
  sourceRevision: string;
  keyId: string;
  privateKey: KeyMaterial;
  buildTimestamp: string;
  previousReleaseVersion?: string | null;
  supportStatus?: BrainAgentReleaseManifest['supportStatus'];
}): BrainAgentReleaseManifest {
  if (!releaseVersion(input.releaseVersion) || !boundedText(input.sourceRevision, 256) || !boundedText(input.keyId, 128) || !isIso(input.buildTimestamp)) throw new Error('release metadata is invalid');
  if (input.previousReleaseVersion !== undefined && input.previousReleaseVersion !== null && !releaseVersion(input.previousReleaseVersion)) throw new Error('previous release version is invalid');
  const verification = verifyRuntimePackage(input.packageRoot);
  if (!verification.ok) throw new Error(`package is not verified: ${verification.detail}`);
  const pkg = readRuntimePackageManifest(input.packageRoot);
  if (pkg.releaseRevision !== input.sourceRevision) throw new Error('source revision does not match runtime package');
  const unsigned = {
    schemaVersion: BRAIN_AGENT_RELEASE_SCHEMA_VERSION,
    releaseVersion: input.releaseVersion,
    sourceRevision: input.sourceRevision,
    runtimePackageId: pkg.packageId,
    runtimePackageManifestHash: pkg.manifestHash,
    coreBuildIdentity: packageComponentIdentity(pkg, 'brain-core'),
    consoleBuildIdentity: packageComponentIdentity(pkg, 'brain-console'),
    stateStoreSchemaVersion: BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION,
    stateSnapshotSchemaVersion: BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION,
    installContractVersion: BRAIN_LOCAL_INSTALL_SCHEMA_VERSION,
    releaseContractVersion: BRAIN_AGENT_RELEASE_CONTRACT_VERSION,
    nodeRange: pkg.nodeRange,
    buildTimestamp: input.buildTimestamp,
    supportStatus: input.supportStatus ?? 'candidate',
    previousReleaseVersion: input.previousReleaseVersion ?? null,
  } satisfies Omit<BrainAgentReleaseManifest, 'releaseId' | 'provenance'>;
  const draft = { ...unsigned, releaseId: releaseId(unsigned), provenance: { scheme: 'ed25519-sha256' as const, keyId: input.keyId, signature: '' } };
  const signature = sign(null, Buffer.from(signedMaterial(draft), 'utf8'), key(input.privateKey)).toString('base64');
  return { ...draft, provenance: { ...draft.provenance, signature } };
}

/** Creates the same manifest using an external signer; private material never enters Brain Core. */
export function createReleaseManifestWithSigner(input: {
  packageRoot: string;
  releaseVersion: string;
  sourceRevision: string;
  keyId: string;
  signer: ReleaseSigner;
  buildTimestamp: string;
  previousReleaseVersion?: string | null;
  supportStatus?: BrainAgentReleaseManifest['supportStatus'];
}): BrainAgentReleaseManifest {
  if (!releaseVersion(input.releaseVersion) || !boundedText(input.sourceRevision, 256) || !boundedText(input.keyId, 128) || !isIso(input.buildTimestamp)) throw new Error('release metadata is invalid');
  if (input.previousReleaseVersion !== undefined && input.previousReleaseVersion !== null && !releaseVersion(input.previousReleaseVersion)) throw new Error('previous release version is invalid');
  const verification = verifyRuntimePackage(input.packageRoot);
  if (!verification.ok) throw new Error(`package is not verified: ${verification.detail}`);
  const pkg = readRuntimePackageManifest(input.packageRoot);
  if (pkg.releaseRevision !== input.sourceRevision) throw new Error('source revision does not match runtime package');
  const unsigned = {
    schemaVersion: BRAIN_AGENT_RELEASE_SCHEMA_VERSION,
    releaseVersion: input.releaseVersion,
    sourceRevision: input.sourceRevision,
    runtimePackageId: pkg.packageId,
    runtimePackageManifestHash: pkg.manifestHash,
    coreBuildIdentity: packageComponentIdentity(pkg, 'brain-core'),
    consoleBuildIdentity: packageComponentIdentity(pkg, 'brain-console'),
    stateStoreSchemaVersion: BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION,
    stateSnapshotSchemaVersion: BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION,
    installContractVersion: BRAIN_LOCAL_INSTALL_SCHEMA_VERSION,
    releaseContractVersion: BRAIN_AGENT_RELEASE_CONTRACT_VERSION,
    nodeRange: pkg.nodeRange,
    buildTimestamp: input.buildTimestamp,
    supportStatus: input.supportStatus ?? 'candidate',
    previousReleaseVersion: input.previousReleaseVersion ?? null,
  } satisfies Omit<BrainAgentReleaseManifest, 'releaseId' | 'provenance'>;
  const draft = { ...unsigned, releaseId: releaseId(unsigned), provenance: { scheme: 'ed25519-sha256' as const, keyId: input.keyId, signature: '' } };
  const signature = input.signer(signedMaterial(draft));
  if (!boundedText(signature, 16_384)) throw new Error('external signer response is invalid');
  const finalDraft = { ...draft, provenance: { ...draft.provenance, signature } };
  return finalDraft;
}

export function verifyReleaseManifest(manifest: unknown, input: { packageRoot: string; publicKey: KeyMaterial; expectedSourceRevision?: string; expectedReleaseVersion?: string }): ReleaseVerification {
  try {
    if (!manifest || typeof manifest !== 'object') return { ok: false, reasonCode: 'INVALID_MANIFEST', detail: 'release manifest must be an object' };
    const candidate = manifest as BrainAgentReleaseManifest;
    if (candidate.schemaVersion !== BRAIN_AGENT_RELEASE_SCHEMA_VERSION) return { ok: false, reasonCode: 'UNSUPPORTED_SCHEMA', detail: 'unsupported release schema' };
    if (!releaseVersion(candidate.releaseVersion) || !boundedText(candidate.releaseId, 128) || !boundedText(candidate.sourceRevision, 256) || !boundedText(candidate.runtimePackageId, 128) || !/^[a-f0-9]{64}$/u.test(candidate.runtimePackageManifestHash) || !isIso(candidate.buildTimestamp) || !candidate.provenance || candidate.provenance.scheme !== 'ed25519-sha256' || !boundedText(candidate.provenance.keyId, 128) || !boundedText(candidate.provenance.signature, 16_384)) return { ok: false, reasonCode: 'INVALID_MANIFEST', detail: 'release manifest fields are invalid' };
    if (candidate.stateStoreSchemaVersion !== BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION || candidate.stateSnapshotSchemaVersion !== BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION || candidate.installContractVersion !== BRAIN_LOCAL_INSTALL_SCHEMA_VERSION || candidate.releaseContractVersion !== BRAIN_AGENT_RELEASE_CONTRACT_VERSION) return { ok: false, reasonCode: 'UNSUPPORTED_SCHEMA', detail: 'release contract is not supported' };
    if (input.expectedSourceRevision !== undefined && input.expectedSourceRevision !== candidate.sourceRevision) return { ok: false, reasonCode: 'PACKAGE_MISMATCH', detail: 'source revision expectation mismatch' };
    if (input.expectedReleaseVersion !== undefined && input.expectedReleaseVersion !== candidate.releaseVersion) return { ok: false, reasonCode: 'PACKAGE_MISMATCH', detail: 'release version expectation mismatch' };
    const pkgVerification = verifyRuntimePackage(input.packageRoot);
    if (!pkgVerification.ok) return { ok: false, reasonCode: 'PACKAGE_UNVERIFIED', detail: pkgVerification.detail };
    const pkg = readRuntimePackageManifest(input.packageRoot);
    if (pkg.packageId !== candidate.runtimePackageId || pkg.manifestHash !== candidate.runtimePackageManifestHash || pkg.releaseRevision !== candidate.sourceRevision || pkg.nodeRange !== candidate.nodeRange) return { ok: false, reasonCode: 'PACKAGE_MISMATCH', detail: 'release/package identity mismatch' };
    if (candidate.releaseId !== releaseId(candidate)) return { ok: false, reasonCode: 'INVALID_MANIFEST', detail: 'release identity mismatch' };
    if (!verify(null, Buffer.from(signedMaterial(candidate), 'utf8'), key(input.publicKey), Buffer.from(candidate.provenance.signature, 'base64'))) return { ok: false, reasonCode: 'SIGNATURE_INVALID', detail: 'release signature is invalid' };
    return { ok: true, manifest: candidate };
  } catch (error) { return { ok: false, reasonCode: 'UNSAFE_MANIFEST', detail: error instanceof Error ? error.message : String(error) }; }
}

export function writeReleaseManifest(manifest: BrainAgentReleaseManifest, outputPath: string): void {
  if (!path.isAbsolute(outputPath) || existsSync(outputPath) || Buffer.byteLength(JSON.stringify(manifest), 'utf8') > BRAIN_AGENT_MAX_MANIFEST_BYTES) throw new Error('release manifest output must be fresh, absolute, and bounded');
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
}

export function readReleaseManifest(manifestPath: string): BrainAgentReleaseManifest {
  if (!path.isAbsolute(manifestPath) || !existsSync(manifestPath) || statSync(manifestPath).size > BRAIN_AGENT_MAX_MANIFEST_BYTES) throw new Error('release manifest path is invalid');
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as BrainAgentReleaseManifest;
}

/** Retains a verified release under its immutable package identity.
 *
 * The destination is created in a private temporary sibling and renamed only
 * after package, release, and signer metadata have been copied and verified.
 * Existing complete material is idempotent; any conflicting or partial
 * identity fails closed rather than repairing it in place.
 */
export function retainVerifiedRelease(input: {
  packageRoot: string;
  releaseManifestPath: string;
  signingPublicMetadataPath: string;
  publicKey: KeyMaterial;
  vaultRoot: string;
  retainedAt: string;
}): ReleaseRetentionResult {
  if (![input.packageRoot, input.releaseManifestPath, input.signingPublicMetadataPath, input.vaultRoot].every((value) => path.isAbsolute(value))) throw new Error('release retention paths must be absolute');
  if (!isIso(input.retainedAt)) throw new Error('retention timestamp is invalid');
  const release = readReleaseManifest(input.releaseManifestPath);
  const verification = verifyReleaseManifest(release, { packageRoot: input.packageRoot, publicKey: input.publicKey });
  if (!verification.ok) throw new Error(`release is not verified: ${verification.detail}`);
  const pkg = readRuntimePackageManifest(input.packageRoot);
  const signingPublic = readBoundedJson(input.signingPublicMetadataPath, 'signing public metadata');
  validateSigningPublicMetadata(signingPublic.value, release, input.publicKey);
  if (!/^brain-runtime-package:sha256:[a-f0-9]{64}$/u.test(pkg.packageId)) throw new Error('runtime package identity is invalid');

  const vaultRoot = path.resolve(input.vaultRoot);
  if (existsSync(vaultRoot) && lstatSync(vaultRoot).isSymbolicLink()) throw new Error('retention vault root must not be a symbolic link');
  const vaultPath = path.join(vaultRoot, pkg.packageId);
  const relative = path.relative(vaultRoot, vaultPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('retention destination escapes vault root');
  const expectedReceipt = retentionReceipt(release, pkg, input.retainedAt);

  if (existsSync(vaultPath)) {
    if (lstatSync(vaultPath).isSymbolicLink()) throw new Error('retention destination must not be a symbolic link');
    if (!statSync(vaultPath).isDirectory()) throw new Error('retention destination conflicts with a file');
    const existingPackage = path.join(vaultPath, 'package');
    const existingReleasePath = path.join(vaultPath, 'release-manifest.json');
    const existingSigningPublicPath = path.join(vaultPath, 'signing-public.json');
    const existingReceiptPath = path.join(vaultPath, 'verification-receipt.json');
    if (!existsSync(existingPackage) || !existsSync(existingReleasePath) || !existsSync(existingSigningPublicPath) || !existsSync(existingReceiptPath)) throw new Error('retention destination is partial or conflicting');
    const existingRelease = readReleaseManifest(existingReleasePath);
    const existingVerification = verifyReleaseManifest(existingRelease, { packageRoot: existingPackage, publicKey: input.publicKey });
    const existingSigningPublic = readBoundedJson(existingSigningPublicPath, 'retained signing public metadata');
    const existingReceipt = JSON.parse(readFileSync(existingReceiptPath, 'utf8')) as BrainAgentReleaseRetentionReceipt;
    if (!existingVerification.ok || canonical(existingRelease) !== canonical(release) || canonical(existingSigningPublic.value) !== canonical(signingPublic.value) || retentionReceiptIdentity(existingReceipt) !== retentionReceiptIdentity(expectedReceipt)) throw new Error('retention destination conflicts with verified release material');
    return { status: 'already-retained', vaultPath, receipt: existingReceipt };
  }

  mkdirSync(vaultRoot, { recursive: true });
  chmodSync(vaultRoot, 0o700);
  const temporaryRoot = mkdtempSync(path.join(vaultRoot, '.retention-'));
  try {
    const temporaryPackage = path.join(temporaryRoot, 'package');
    cpSync(input.packageRoot, temporaryPackage, { recursive: true });
    copyFileSync(input.releaseManifestPath, path.join(temporaryRoot, 'release-manifest.json'));
    copyFileSync(input.signingPublicMetadataPath, path.join(temporaryRoot, 'signing-public.json'));
    writeFileSync(path.join(temporaryRoot, 'verification-receipt.json'), `${JSON.stringify(expectedReceipt, null, 2)}\n`, { mode: 0o600 });
    if (!verifyRuntimePackage(temporaryPackage).ok || !verifyReleaseManifest(readReleaseManifest(path.join(temporaryRoot, 'release-manifest.json')), { packageRoot: temporaryPackage, publicKey: input.publicKey }).ok) throw new Error('retained release verification failed');
    renameSync(temporaryRoot, vaultPath);
    return { status: 'retained', vaultPath, receipt: expectedReceipt };
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

function backupMaterial(backup: BrainAgentBackupManifest): Record<string, unknown> {
  return { schemaVersion: backup.schemaVersion, releaseId: backup.releaseId, releaseVersion: backup.releaseVersion, snapshotId: backup.snapshotId, snapshotAggregateHash: backup.snapshotAggregateHash, sourceStoreSchemaVersion: backup.sourceStoreSchemaVersion, snapshotSchemaVersion: backup.snapshotSchemaVersion, recordFamilyCounts: backup.recordFamilyCounts, createdAt: backup.createdAt };
}

export function createBackupManifest(input: { release: BrainAgentReleaseManifest; snapshot: BrainStateSnapshot; createdAt: string }): BrainAgentBackupManifest {
  const verification = verifyStateSnapshot(input.snapshot);
  if (!verification.ok) throw new Error(`snapshot is not verified: ${verification.detail}`);
  if (!isIso(input.createdAt)) throw new Error('backup timestamp is invalid');
  const material = { schemaVersion: BRAIN_AGENT_BACKUP_SCHEMA_VERSION, releaseId: input.release.releaseId, releaseVersion: input.release.releaseVersion, snapshotId: input.snapshot.snapshotId, snapshotAggregateHash: input.snapshot.aggregateHash, sourceStoreSchemaVersion: BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION, snapshotSchemaVersion: input.snapshot.schemaVersion, recordFamilyCounts: input.snapshot.counts, createdAt: input.createdAt } as const;
  const backupHash = hash(material);
  return { ...material, backupId: `brain-agent-backup:sha256:${hash({ ...material, backupHash })}`, backupHash };
}

export function verifyBackupManifest(backup: unknown, snapshot: BrainStateSnapshot): BackupVerification {
  try {
    if (!backup || typeof backup !== 'object') return { ok: false, reasonCode: 'BACKUP_INVALID', detail: 'backup manifest must be an object' };
    const candidate = backup as BrainAgentBackupManifest;
    if (candidate.schemaVersion !== BRAIN_AGENT_BACKUP_SCHEMA_VERSION || candidate.sourceStoreSchemaVersion !== BRAIN_AGENT_STATE_STORE_SCHEMA_VERSION || candidate.snapshotSchemaVersion !== BRAIN_STATE_SNAPSHOT_SCHEMA_VERSION || !isIso(candidate.createdAt) || !/^brain-agent-backup:sha256:[a-f0-9]{64}$/u.test(candidate.backupId) || !/^[a-f0-9]{64}$/u.test(candidate.backupHash)) return { ok: false, reasonCode: 'BACKUP_INVALID', detail: 'backup metadata is invalid' };
    const snapshotVerification = verifyStateSnapshot(snapshot);
    if (!snapshotVerification.ok) return { ok: false, reasonCode: 'SNAPSHOT_INVALID', detail: snapshotVerification.detail };
    if (candidate.snapshotId !== snapshot.snapshotId || candidate.snapshotAggregateHash !== snapshot.aggregateHash || canonical(candidate.recordFamilyCounts) !== canonical(snapshot.counts) || candidate.backupHash !== hash(backupMaterial(candidate)) || candidate.backupId !== `brain-agent-backup:sha256:${hash({ ...backupMaterial(candidate), backupHash: candidate.backupHash })}`) return { ok: false, reasonCode: 'BACKUP_INVALID', detail: 'backup/snapshot identity mismatch' };
    return { ok: true, backup: candidate };
  } catch (error) { return { ok: false, reasonCode: 'UNSAFE_BACKUP', detail: error instanceof Error ? error.message : String(error) }; }
}

export function assessReleasePromotion(input: { release: ReleaseVerification; backup: BackupVerification; restore: 'verified' | 'not-verified'; isolatedSmoke: 'passed' | 'not-passed'; rollback: 'passed' | 'not-passed' }): PromotionAssessment {
  const blockers: Array<PromotionAssessment['blockers'][number]> = [];
  if (!input.release.ok) blockers.push('release_unverified');
  if (!input.backup.ok) blockers.push('backup_unverified');
  if (input.restore !== 'verified') blockers.push('restore_not_verified');
  if (input.isolatedSmoke !== 'passed') blockers.push('isolated_smoke_not_passed');
  if (input.rollback !== 'passed') blockers.push('rollback_not_verified');
  return blockers.length === 0 ? { status: 'promotable', blockers } : { status: 'blocked', blockers };
}

export function assessRollbackCompatibility(current: BrainAgentReleaseManifest, target: BrainAgentReleaseManifest): RollbackCompatibility {
  if (current.releaseContractVersion !== target.releaseContractVersion || current.stateSnapshotSchemaVersion !== target.stateSnapshotSchemaVersion || current.installContractVersion !== target.installContractVersion) return 'incompatible';
  if (current.stateStoreSchemaVersion !== target.stateStoreSchemaVersion) return 'restore-required';
  return 'compatible';
}
