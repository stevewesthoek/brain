import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildRuntimePackage, verifyRuntimePackage } from '../agent-mode/runtime-package.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { installRuntimePackage } from '../agent-mode/local-install.js';
import { createStateSnapshot, importStateSnapshot } from '../agent-mode/state-relocation.js';
import { assessReleasePromotion, assessRollbackCompatibility, createBackupManifest, createReleaseManifest, verifyBackupManifest, verifyReleaseManifest, writeReleaseManifest } from '../agent-mode/release-maintenance.js';

function sourceRoot(): string {
  const root = mkdtempSync(path.join('/tmp', 'brain-release-source-'));
  mkdirSync(path.join(root, 'projects', 'brain-core', 'dist'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone'), { recursive: true });
  writeFileSync(path.join(root, 'projects', 'brain-core', 'dist', 'index.js'), 'console.log("fixture core");\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package.json'), '{"name":"brain-core","dependencies":{}}\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'server.js'), 'console.log("fixture console");\n');
  return root;
}

function packageRoot(source: string, suffix: string): string {
  const root = path.join('/tmp', `brain-release-package-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  buildRuntimePackage({ sourceRoot: source, outputRoot: root, releaseRevision: '72fc9fd7', platform: 'linux', architecture: 'x64' });
  return root;
}

test('signed release identity binds the validated runtime package and rejects tamper or filename trust', () => {
  const source = sourceRoot(); const pkg = packageRoot(source, 'identity');
  try {
    const keys = generateKeyPairSync('ed25519', { privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const manifest = createReleaseManifest({ packageRoot: pkg, releaseVersion: '0.1.0', sourceRevision: '72fc9fd7', keyId: 'fixture-release-key-v1', privateKey: keys.privateKey, buildTimestamp: '2026-09-17T00:00:00.000Z' });
    assert.match(manifest.releaseId, /^brain-agent-release:sha256:[a-f0-9]{64}$/u);
    const sameMaterial = createReleaseManifest({ packageRoot: pkg, releaseVersion: '0.1.0', sourceRevision: '72fc9fd7', keyId: 'fixture-release-key-v1', privateKey: generateKeyPairSync('ed25519').privateKey, buildTimestamp: '2026-09-17T00:00:00.000Z' });
    assert.equal(sameMaterial.releaseId, manifest.releaseId);
    assert.equal(verifyReleaseManifest(manifest, { packageRoot: pkg, publicKey: keys.publicKey }).ok, true);
    const tampered = { ...manifest, releaseVersion: '0.1.1' };
    assert.equal(verifyReleaseManifest(tampered, { packageRoot: pkg, publicKey: keys.publicKey }).ok, false);
    assert.equal(verifyReleaseManifest(manifest, { packageRoot: pkg, publicKey: keys.publicKey, expectedReleaseVersion: '0.1.1' }).ok, false);
    assert.equal(verifyReleaseManifest(manifest, { packageRoot: pkg, publicKey: generateKeyPairSync('ed25519').publicKey }).ok, false);
    const manifestPath = path.join('/tmp', `release-${Date.now()}.json`); writeReleaseManifest(manifest, manifestPath);
    assert.equal(readFileSync(manifestPath).includes('fixture-release-key-v1'), true);
    rmSync(manifestPath, { force: true });
  } finally { rmSync(source, { recursive: true, force: true }); rmSync(pkg, { recursive: true, force: true }); }
});

test('logical backup wraps the existing brain-state-snapshot-v1 and is tamper evident', () => {
  const source = sourceRoot(); const pkg = packageRoot(source, 'backup'); const install = path.join('/tmp', `brain-release-install-${Date.now()}-${Math.random().toString(16).slice(2)}`); const db = path.join('/tmp', `brain-release-db-${Date.now()}.sqlite`);
  try {
    const keys = generateKeyPairSync('ed25519');
    const release = createReleaseManifest({ packageRoot: pkg, releaseVersion: '0.1.0', sourceRevision: '72fc9fd7', keyId: 'fixture-release-key-v1', privateKey: keys.privateKey, buildTimestamp: '2026-09-17T00:00:00.000Z' });
    const installed = installRuntimePackage({ packageRoot: pkg, installRoot: install, platform: 'linux', architecture: 'x64', nodeExecutable: process.execPath, nodeVersion: process.version, secretRef: 'config/secrets.env', hydrate: () => 'verified-by-fixture' });
    assert.equal(installed.ok, true);
    const writable = new AgentModeSqliteStateStore(db); writable.close();
    const readonly = AgentModeSqliteStateStore.openExisting(db); assert.ok(readonly);
    const snapshot = createStateSnapshot(readonly!, { mode: 'backup/logical-fixture', createdAt: '2026-09-17T00:01:00.000Z' }); readonly!.close();
    const backup = createBackupManifest({ release, snapshot, createdAt: '2026-09-17T00:02:00.000Z' });
    assert.match(backup.backupId, /^brain-agent-backup:sha256:[a-f0-9]{64}$/u);
    assert.equal(verifyBackupManifest(backup, snapshot).ok, true);
    assert.equal(verifyBackupManifest({ ...backup, releaseVersion: '9.9.9' }, snapshot).ok, false);
    const restored = path.join('/tmp', `brain-release-restored-${Date.now()}.sqlite`);
    const imported = importStateSnapshot(snapshot, restored, snapshot.snapshotId);
    assert.equal(imported.ok, true);
    assert.equal(importStateSnapshot(snapshot, restored, snapshot.snapshotId).ok, false, 'restore is exact-once/fresh-target only');
    rmSync(restored, { force: true }); rmSync(`${restored}-wal`, { force: true }); rmSync(`${restored}-shm`, { force: true });
  } finally { rmSync(db, { force: true }); rmSync(`${db}-wal`, { force: true }); rmSync(`${db}-shm`, { force: true }); rmSync(install, { recursive: true, force: true }); rmSync(source, { recursive: true, force: true }); rmSync(pkg, { recursive: true, force: true }); }
});

test('promotion and rollback gates fail closed until every offline proof is present', () => {
  const source = sourceRoot(); const pkg = packageRoot(source, 'gate');
  try {
    const keys = generateKeyPairSync('ed25519');
    const release = createReleaseManifest({ packageRoot: pkg, releaseVersion: '0.1.0', sourceRevision: '72fc9fd7', keyId: 'fixture-release-key-v1', privateKey: keys.privateKey, buildTimestamp: '2026-09-17T00:00:00.000Z' });
    const verifiedRelease = verifyReleaseManifest(release, { packageRoot: pkg, publicKey: keys.publicKey });
    const db = path.join('/tmp', `brain-release-gate-${Date.now()}.sqlite`); const writable = new AgentModeSqliteStateStore(db); writable.close(); const readonly = AgentModeSqliteStateStore.openExisting(db)!;
    const snapshot = createStateSnapshot(readonly, { mode: 'backup/logical-fixture', createdAt: '2026-09-17T00:01:00.000Z' }); readonly.close(); rmSync(db, { force: true });
    const backup = verifyBackupManifest(createBackupManifest({ release, snapshot, createdAt: '2026-09-17T00:02:00.000Z' }), snapshot);
    assert.deepEqual(assessReleasePromotion({ release: verifiedRelease, backup, restore: 'not-verified', isolatedSmoke: 'not-passed', rollback: 'not-passed' }), { status: 'blocked', blockers: ['restore_not_verified', 'isolated_smoke_not_passed', 'rollback_not_verified'] });
    assert.equal(assessReleasePromotion({ release: verifiedRelease, backup, restore: 'verified', isolatedSmoke: 'passed', rollback: 'passed' }).status, 'promotable');
    assert.equal(assessRollbackCompatibility(release, { ...release, releaseVersion: '0.0.9', previousReleaseVersion: null }), 'compatible');
    assert.equal(assessRollbackCompatibility(release, { ...release, stateStoreSchemaVersion: 9 as unknown as 10 }), 'restore-required');
  } finally { rmSync(source, { recursive: true, force: true }); rmSync(pkg, { recursive: true, force: true }); }
});

test('package verifier remains the install admission authority and exposes no private signing material', () => {
  const source = sourceRoot(); const pkg = packageRoot(source, 'security');
  try { assert.equal(verifyRuntimePackage(pkg).ok, true); const text = readFileSync(path.join(pkg, 'manifest.json'), 'utf8'); assert.equal(text.includes('privateKey'), false); assert.equal(text.includes('BEGIN PRIVATE KEY'), false); }
  finally { rmSync(source, { recursive: true, force: true }); rmSync(pkg, { recursive: true, force: true }); }
});
