import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { createRelocationPlan, createStateSnapshot, deriveRelocationReadiness, importStateSnapshot, readStateSnapshot, verifyStateSnapshot, writeStateSnapshot } from '../agent-mode/state-relocation.js';
import { buildRuntimePackage } from '../agent-mode/runtime-package.js';
import { installRuntimePackage } from '../agent-mode/local-install.js';

test('exports a deterministic logical snapshot from an offline read-only store and imports into a fresh target', () => {
  const root = mkdtempSync('/tmp/brain-d0-e-'); const sourcePath = path.join(root, 'source.db'); const snapshotPath = path.join(root, 'snapshot.json'); const targetPath = path.join(root, 'target.db');
  try {
    const source = new AgentModeSqliteStateStore(sourcePath); source.upsertAgent({ agentId: 'agent:root', agentKind: 'jarvis', role: 'jarvis', displayName: 'Jarvis', policyId: 'policy:v1', status: 'active', rootGoalId: 'goal:root', depth: 0 }); const expectedAgent = source.getAgent('agent:root'); source.close();
    const offline = AgentModeSqliteStateStore.openExisting(sourcePath)!; const snapshot = createStateSnapshot(offline, { mode: 'relocation-final', createdAt: '2026-09-15T00:00:00.000Z' }); const secondSnapshot = createStateSnapshot(offline, { mode: 'relocation-final', createdAt: '2026-09-16T00:00:00.000Z' }); assert.equal(snapshot.snapshotId, secondSnapshot.snapshotId); offline.close();
    assert.equal(verifyStateSnapshot(snapshot).ok, true); const writable = new AgentModeSqliteStateStore(path.join(root, 'writable.db')); assert.throws(() => createStateSnapshot(writable, { mode: 'relocation-final', createdAt: '2026-09-15T00:00:00.000Z' }), /read-only/u); writable.close(); writeStateSnapshot(snapshot, snapshotPath); assert.equal(statSync(snapshotPath).mode & 0o777, 0o600); assert.deepEqual(readStateSnapshot(snapshotPath), snapshot);
    const imported = importStateSnapshot(snapshot, targetPath, snapshot.snapshotId); assert.equal(imported.ok, true); assert.equal(existsSync(targetPath), true);
    const target = AgentModeSqliteStateStore.openExisting(targetPath)!; assert.deepEqual(target.getAgent('agent:root'), expectedAgent); target.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('snapshot tamper and populated-target imports fail without accepting partial state', () => {
  const root = mkdtempSync('/tmp/brain-d0-e-tamper-'); const sourcePath = path.join(root, 'source.db'); const targetPath = path.join(root, 'target.db');
  try {
    const source = new AgentModeSqliteStateStore(sourcePath); source.close(); const offline = AgentModeSqliteStateStore.openExisting(sourcePath)!; const snapshot = createStateSnapshot(offline, { mode: 'backup/logical-fixture', createdAt: '2026-09-15T00:00:00.000Z' }); offline.close();
    const tampered = structuredClone(snapshot); tampered.counts.agents = 99; assert.equal(verifyStateSnapshot(tampered).ok, false);
    const populated = new AgentModeSqliteStateStore(targetPath); populated.close(); assert.equal(importStateSnapshot(snapshot, targetPath, snapshot.snapshotId).ok, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('relocation readiness is evidence-backed and legacy caller booleans cannot bypass blockers', () => {
  const root = mkdtempSync('/tmp/brain-d0-f-'); const sourcePath = path.join(root, 'source.db'); const sourceRoot = path.join(root, 'package-source'); const packageRoot = path.join(root, 'package'); const installRoot = path.join(root, 'install'); const targetStorePath = path.join(installRoot, 'state', 'agent-mode', 'agent-mode.db'); const secretPath = path.join(installRoot, 'config', 'secrets.env');
  try {
    mkdirSync(path.join(sourceRoot, 'projects', 'brain-core', 'dist'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', '.next'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'static'), { recursive: true });
    writeFileSync(path.join(sourceRoot, 'projects', 'brain-core', 'dist', 'index.js'), 'console.log("core");\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-core', 'package.json'), '{}\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-core', 'package-lock.json'), '{"lockfileVersion":3}\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'server.js'), 'console.log("console");\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', '.next', 'BUILD_ID'), 'fixture-build\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next', 'package.json'), '{"name":"next","version":"fixture"}\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'static', 'BUILD_ID'), 'fixture-build\n');
    buildRuntimePackage({ sourceRoot, outputRoot: packageRoot, releaseRevision: 'd0-f-fixture', platform: 'darwin', architecture: 'arm64' });
    const source = new AgentModeSqliteStateStore(sourcePath); source.close(); const offline = AgentModeSqliteStateStore.openExisting(sourcePath)!; const snapshot = createStateSnapshot(offline, { mode: 'relocation-final', createdAt: '2026-09-16T00:00:00.000Z' }); offline.close();
    assert.equal(installRuntimePackage({ packageRoot, installRoot, platform: 'darwin', architecture: 'arm64', nodeExecutable: process.execPath, nodeVersion: '22.5.0', secretRef: 'config/secrets.env', hydrate: () => 'verified-by-fixture' }).ok, true); mkdirSync(path.dirname(secretPath), { recursive: true }); writeFileSync(secretPath, 'fixture-secret=external\n', { mode: 0o600 });
    assert.equal(importStateSnapshot(snapshot, targetStorePath, snapshot.snapshotId).ok, true);
    const readiness = deriveRelocationReadiness({ snapshot, sourceStorePath: sourcePath, targetPackageRoot: packageRoot, targetInstallRoot: installRoot, targetStorePath, targetConfig: { home: path.join(root, 'target-home'), portableProfile: { stateRoot: path.join(installRoot, 'state'), stateStore: { kind: 'sqlite', path: targetStorePath }, core: { bindHost: '127.0.0.1', port: 4987 }, console: { coreUrl: 'http://127.0.0.1:4987', port: 4988 } } }, requiredSecretPaths: [secretPath] }); assert.equal(readiness.plan.activation, 'ready-for-activation'); assert.deepEqual(readiness.plan.blockers, []);
    const legacy = createRelocationPlan({ snapshot, targetRuntimePackageId: 'claimed', targetInstallId: 'claimed', targetStorePath, targetConfigValid: true, requiredSecretProvisioned: true, hostLocalAuthorityReconciled: true }); assert.equal(legacy.activation, 'blocked');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

async function waitFor(url: string): Promise<Response> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try { return await fetch(url); } catch { await new Promise((resolve) => setTimeout(resolve, 20)); }
  }
  throw new Error(`target foreground service did not start: ${url}`);
}

function stop(child: ChildProcess | undefined): void { if (child && child.exitCode === null) child.kill('SIGTERM'); }

test('isolated darwin cutover starts the installed target in foreground and survives restart without source activation', async () => {
  const root = mkdtempSync('/tmp/brain-d0-f-start-'); const sourceRoot = path.join(root, 'package-source'); const packageRoot = path.join(root, 'package'); const installRoot = path.join(root, 'install'); const sourcePath = path.join(root, 'source.db'); const targetStorePath = path.join(installRoot, 'state', 'agent-mode', 'agent-mode.db'); const secretPath = path.join(installRoot, 'config', 'secrets.env'); const corePort = 4997; const consolePort = 4998;
  let core: ChildProcess | undefined; let console: ChildProcess | undefined;
  try {
    mkdirSync(path.join(sourceRoot, 'projects', 'brain-core', 'dist'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', '.next'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next'), { recursive: true }); mkdirSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'static'), { recursive: true });
    const coreServer = (name: string) => `import('node:http').then(({ createServer }) => { const port = Number(process.env.${name}_PORT); createServer((_req, res) => { res.end('${name}-ok'); }).listen(port, '127.0.0.1'); });\n`;
    const consoleServer = (name: string) => `const { createServer } = require('node:http'); const port = Number(process.env.${name}_PORT); createServer((_req, res) => { res.end('${name}-ok'); }).listen(port, '127.0.0.1');\n`;
    writeFileSync(path.join(sourceRoot, 'projects', 'brain-core', 'dist', 'index.js'), coreServer('CORE')); writeFileSync(path.join(sourceRoot, 'projects', 'brain-core', 'package.json'), '{}\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-core', 'package-lock.json'), '{"lockfileVersion":3}\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'server.js'), consoleServer('CONSOLE')); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', '.next', 'BUILD_ID'), 'fixture-build\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next', 'package.json'), '{"name":"next","version":"fixture"}\n'); writeFileSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'static', 'BUILD_ID'), 'fixture-build\n');
    buildRuntimePackage({ sourceRoot, outputRoot: packageRoot, releaseRevision: 'd0-f-start-fixture', platform: 'darwin', architecture: 'arm64' });
    const source = new AgentModeSqliteStateStore(sourcePath); source.close(); const offline = AgentModeSqliteStateStore.openExisting(sourcePath)!; const snapshot = createStateSnapshot(offline, { mode: 'relocation-final', createdAt: '2026-09-16T00:00:00.000Z' }); offline.close();
    assert.equal(installRuntimePackage({ packageRoot, installRoot, platform: 'darwin', architecture: 'arm64', nodeExecutable: process.execPath, nodeVersion: '22.5.0', secretRef: 'config/secrets.env', hydrate: () => 'verified-by-fixture' }).ok, true); mkdirSync(path.dirname(secretPath), { recursive: true }); writeFileSync(secretPath, 'fixture-secret=external\n', { mode: 0o600 }); assert.equal(importStateSnapshot(snapshot, targetStorePath, snapshot.snapshotId).ok, true);
    const readiness = deriveRelocationReadiness({ snapshot, sourceStorePath: sourcePath, targetPackageRoot: packageRoot, targetInstallRoot: installRoot, targetStorePath, targetConfig: { home: path.join(root, 'target-home'), portableProfile: { stateRoot: path.join(installRoot, 'state'), stateStore: { kind: 'sqlite', path: targetStorePath }, core: { bindHost: '127.0.0.1', port: corePort }, console: { coreUrl: `http://127.0.0.1:${corePort}`, port: consolePort } } }, requiredSecretPaths: [secretPath] }); assert.equal(readiness.plan.activation, 'ready-for-activation');
    const env = { ...process.env, CORE_PORT: String(corePort), CONSOLE_PORT: String(consolePort) }; core = spawn(process.execPath, [path.join(installRoot, 'releases', readiness.plan.targetRuntimePackageId, 'core', 'dist', 'index.js')], { env }); console = spawn(process.execPath, [path.join(installRoot, 'releases', readiness.plan.targetRuntimePackageId, 'console', 'standalone', 'server.js')], { env });
    assert.equal((await waitFor(`http://127.0.0.1:${corePort}`)).status, 200); assert.equal(await (await waitFor(`http://127.0.0.1:${consolePort}`)).text(), 'CONSOLE-ok'); stop(core); stop(console); await new Promise((resolve) => setTimeout(resolve, 40));
    core = spawn(process.execPath, [path.join(installRoot, 'releases', readiness.plan.targetRuntimePackageId, 'core', 'dist', 'index.js')], { env }); assert.equal((await waitFor(`http://127.0.0.1:${corePort}`)).status, 200);
  } finally { stop(core); stop(console); rmSync(root, { recursive: true, force: true }); }
});
