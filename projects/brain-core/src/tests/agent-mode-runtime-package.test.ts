import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildRuntimePackage, verifyRuntimePackage } from '../agent-mode/runtime-package.js';

function fixtureRoot(): string {
  const root = mkdtempSync(path.join('/tmp', 'brain-d0-c-source-'));
  mkdirSync(path.join(root, 'projects', 'brain-core', 'dist'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'static'), { recursive: true });
  writeFileSync(path.join(root, 'projects', 'brain-core', 'dist', 'index.js'), 'console.log("core");\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'dist', 'runtime-helper.mjs'), 'export const fixture = true;\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package.json'), '{"name":"brain-core","dependencies":{"pg":"1.0.0"}}\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'server.js'), 'const buildNote = "/Users/Office/Repos/stevewesthoek/mind"; console.log(buildNote);\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'static', 'BUILD_ID'), 'fixture-build\n');
  return root;
}

function build(sourceRoot: string, suffix: string) {
  return buildRuntimePackage({ sourceRoot, outputRoot: path.join('/tmp', `brain-d0-c-package-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}`), releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' });
}

test('builds and verifies a bounded allowlisted package with explicit runtime strategies', () => {
  const sourceRoot = fixtureRoot();
  const outputRoot = path.join('/tmp', `brain-d0-c-package-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const manifest = buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' });
    assert.equal(manifest.schemaVersion, 'brain-runtime-package-v1');
    assert.match(manifest.packageId, /^brain-runtime-package:sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(manifest.components.map(({ id, dependencyStrategy }) => [id, dependencyStrategy]), [
      ['brain-core', 'npm-production-hydration'], ['brain-console', 'standalone-traced'], ['runtime-config-template', 'none'],
    ]);
    assert.ok(manifest.files.some((file) => file.relativePath === 'core/dist/index.js'));
    assert.ok(manifest.files.some((file) => file.relativePath === 'core/dist/runtime-helper.mjs'));
    assert.ok(manifest.files.some((file) => file.relativePath === 'console/standalone/server.js'));
    assert.equal(manifest.files.some((file) => file.relativePath.includes('.next/cache')), false);
    assert.equal(manifest.files.some((file) => file.relativePath.includes('/Users/Office')), false);
    assert.deepEqual(verifyRuntimePackage(outputRoot), { ok: true, packageId: manifest.packageId, manifestHash: manifest.manifestHash, fileCount: manifest.files.length, totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0) });
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(outputRoot, { recursive: true, force: true }); }
});

test('same fixture and revision produce the same manifest identity under different roots and HOME values', () => {
  const sourceRoot = fixtureRoot();
  const firstRoot = path.join('/tmp', `brain-d0-c-package-one-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const secondRoot = path.join('/tmp', `brain-d0-c-package-two-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const first = buildRuntimePackage({ sourceRoot, outputRoot: firstRoot, releaseRevision: 'fixture-revision', platform: 'darwin', architecture: 'arm64' });
    const second = buildRuntimePackage({ sourceRoot, outputRoot: secondRoot, releaseRevision: 'fixture-revision', platform: 'darwin', architecture: 'arm64' });
    assert.equal(first.packageId, second.packageId);
    assert.equal(first.manifestHash, second.manifestHash);
    assert.deepEqual(first.files, second.files);
    assert.deepEqual(first.startup, second.startup);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(firstRoot, { recursive: true, force: true }); rmSync(secondRoot, { recursive: true, force: true }); }
});

test('tamper, extra-file, missing-file, symlink, and stale-target conditions fail closed', () => {
  const sourceRoot = fixtureRoot();
  const outputRoot = path.join('/tmp', `brain-d0-c-package-tamper-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const symlink = path.join(sourceRoot, 'projects', 'brain-core', 'dist', 'escape.js');
    symlinkSync('/tmp', symlink);
    assert.throws(() => buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' }), /symlink/u);
    rmSync(symlink, { force: true });
    buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' });
    const runtimeFile = path.join(outputRoot, 'core', 'dist', 'index.js');
    writeFileSync(runtimeFile, 'tampered\n');
    assert.equal(verifyRuntimePackage(outputRoot).ok, false);
    writeFileSync(runtimeFile, 'console.log("core");\n');
    writeFileSync(path.join(outputRoot, 'extra.txt'), 'unexpected\n');
    assert.deepEqual(verifyRuntimePackage(outputRoot), { ok: false, reason: 'unexpected-file', detail: 'package file set differs from manifest' });
    rmSync(path.join(outputRoot, 'extra.txt'), { force: true });
    rmSync(runtimeFile, { force: true });
    assert.equal(verifyRuntimePackage(outputRoot).ok, false);
    assert.throws(() => buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' }), /fresh nonexistent/u);
    const invalidOutput = path.join('/tmp', `brain-d0-c-package-invalid-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(invalidOutput, { recursive: true });
    writeFileSync(path.join(invalidOutput, 'secret.env'), 'TOKEN=secret\n');
    assert.throws(() => buildRuntimePackage({ sourceRoot, outputRoot: invalidOutput, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' }), /fresh nonexistent/u);
    rmSync(invalidOutput, { recursive: true, force: true });
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(outputRoot, { recursive: true, force: true }); }
});

test('missing build artifacts are rejected before an owned staging root is left behind', () => {
  const sourceRoot = fixtureRoot();
  rmSync(path.join(sourceRoot, 'projects', 'brain-core', 'dist', 'index.js'), { force: true });
  const outputRoot = path.join('/tmp', `brain-d0-c-package-failure-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    assert.throws(() => buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' }), /Core build artifacts are incomplete/u);
    assert.equal(existsSync(outputRoot), false);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(outputRoot, { recursive: true, force: true }); }
});

test('package manifest contains no secrets, mutable state, personal paths, or shell startup authority', () => {
  const sourceRoot = fixtureRoot();
  const outputRoot = path.join('/tmp', `brain-d0-c-package-security-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const manifest = buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'unsupported', architecture: 'unsupported' });
    const text = readFileSync(path.join(outputRoot, 'manifest.json'), 'utf8');
    assert.equal(text.includes('fixture-secret'), false);
    assert.equal(text.includes('HOME'), false);
    assert.equal(text.includes('&&'), false);
    assert.deepEqual(manifest.requiredExternalSecrets, ['BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET', 'BRAIN_CONSOLE_OPERATOR_ID', 'BRAIN_CONSOLE_OPERATOR_SECRET']);
    assert.equal(verifyRuntimePackage(outputRoot).ok, false);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(outputRoot, { recursive: true, force: true }); }
});

test('packages the bounded Core support closure needed by the installed read-only server', () => {
  const sourceRoot = fixtureRoot();
  const supportFiles = [
    'tools/mind-canonical-path-registry.mjs',
    'tools/infrastructure-catalog/governance-core.mjs',
    'tools/context-learning/context-learning-core.mjs',
    'operations/specs/infinite-brain-boundary-contracts.js',
    'operations/specs/infinite-brain-path-registry.json',
  ];
  for (const relative of supportFiles) {
    const target = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, relative.endsWith('.json') ? '{"registry":true}\n' : 'export const fixtureSupport = true;\n');
  }
  const outputRoot = path.join('/tmp', `brain-d0-c-package-support-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const manifest = buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' });
    assert.ok(manifest.components.some(({ id }) => id === 'brain-core-support'));
    for (const relative of supportFiles) assert.ok(manifest.files.some((file) => file.relativePath === relative));
    assert.deepEqual(verifyRuntimePackage(outputRoot).ok, true);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(outputRoot, { recursive: true, force: true }); }
});
