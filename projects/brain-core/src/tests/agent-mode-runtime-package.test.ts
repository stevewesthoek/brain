import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { assertCleanSourceProvenance, assertPackagedConsoleBoot, buildRuntimePackage, verifyRuntimePackage } from '../agent-mode/runtime-package.js';

function fixtureRoot(): string {
  const root = mkdtempSync(path.join('/tmp', 'brain-d0-c-source-'));
  mkdirSync(path.join(root, 'projects', 'brain-core', 'dist'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', '.next'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'static'), { recursive: true });
  writeFileSync(path.join(root, 'projects', 'brain-core', 'dist', 'index.js'), 'console.log("core");\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'dist', 'runtime-helper.mjs'), 'export const fixture = true;\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package.json'), '{"name":"brain-core","dependencies":{"pg":"1.0.0"}}\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'server.js'), [
    'const buildNote = "/Users/Office/Repos/stevewesthoek/mind";',
    'const next = require("next");',
    'const http = require("node:http");',
    'const server = http.createServer((request, response) => {',
    '  if (request.url?.startsWith("/_next/static/")) { response.writeHead(200, { "content-type": "text/plain" }); response.end("fixture asset"); return; }',
    '  response.writeHead(200, { "content-type": "text/html" }); response.end("<html><body>fixture console<script src=\\"/_next/static/BUILD_ID.js\\"></script></body></html>");',
    '});',
    'void next; void buildNote;',
    'server.listen(Number(process.env.PORT ?? 3000), process.env.HOSTNAME ?? "127.0.0.1");',
  ].join('\n'));
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next', 'package.json'), '{"name":"next","version":"fixture"}\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next', 'index.js'), 'module.exports = function fixtureNext() {};\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'static', 'BUILD_ID'), 'fixture-build\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', '.next', 'BUILD_ID'), 'fixture-build\n');
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
    assert.ok(manifest.files.some((file) => file.relativePath === 'console/standalone/node_modules/next/package.json'));
    assert.equal(manifest.files.some((file) => file.relativePath.includes('.next/cache')), false);
    assert.equal(manifest.files.some((file) => file.relativePath.includes('/Users/Office')), false);
    assert.deepEqual(verifyRuntimePackage(outputRoot), { ok: true, packageId: manifest.packageId, manifestHash: manifest.manifestHash, fileCount: manifest.files.length, totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0) });
    assert.doesNotThrow(() => assertPackagedConsoleBoot(outputRoot, 5_000));
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

test('incomplete standalone dependency closure is rejected before signing material can be created', () => {
  const sourceRoot = fixtureRoot();
  rmSync(path.join(sourceRoot, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next', 'package.json'), { force: true });
  const outputRoot = '/tmp/brain-d0-c-package-console-closure-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  try {
    assert.throws(() => buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'linux', architecture: 'x64' }), /dependency closure is incomplete/u);
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

test('packages Jev bridge code, native boundary, keychain adapter, and SDK as one immutable closure', () => {
  const sourceRoot = fixtureRoot();
  const runtimeFiles = [
    'tools/jev/brain-jev.mjs', 'tools/jev/jev-contract.mjs', 'tools/jev/jev-ledger.mjs', 'tools/jev/jev-pricing.mjs',
    'tools/jev/macos-keychain-enroll-typesafe.swift', 'tools/jev/macos-keychain-request-boundary.swift',
    'tools/jev/package.json', 'tools/jev/package-lock.json', 'tools/jev/typesafe-request.mjs',
    'tools/jev/node_modules/@typesafe-ai/sdk/LICENSE', 'tools/jev/node_modules/@typesafe-ai/sdk/README.md',
    'tools/jev/node_modules/@typesafe-ai/sdk/package.json', 'tools/jev/node_modules/@typesafe-ai/sdk/dist/index.mjs',
    'tools/infrastructure-identity-access/macos-keychain-adapter.mjs',
    'tools/infrastructure-identity-access/macos-keychain-probe.swift',
    'tools/infrastructure-identity-access/macos-keychain-verification-boundary.swift',
  ];
  for (const relative of runtimeFiles) {
    const target = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, relative.endsWith('.json') ? '{}\n' : `fixture ${relative}\n`);
  }
  const reflex = path.join(sourceRoot, 'projects', 'brain-core', 'dist', 'agent-mode', 'jarvis-system-one-reflex.js');
  mkdirSync(path.dirname(reflex), { recursive: true });
  writeFileSync(reflex, "export const bridge = '../../../../tools/jev/brain-jev.mjs';\n");
  const outputRoot = path.join('/tmp', `brain-d0-c-package-jev-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const manifest = buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision: 'fixture-revision', platform: 'darwin', architecture: 'arm64' });
    assert.ok(manifest.components.some(({ id }) => id === 'jev-bridge'));
    for (const relative of runtimeFiles) assert.ok(manifest.files.some((file) => file.relativePath === relative));
    assert.equal(readFileSync(path.join(outputRoot, 'core', 'dist', 'agent-mode', 'jarvis-system-one-reflex.js'), 'utf8'), "export const bridge = '../../../tools/jev/brain-jev.mjs';\n");
    assert.equal(verifyRuntimePackage(outputRoot).ok, true);
    rmSync(path.join(outputRoot, 'tools', 'jev', 'typesafe-request.mjs'));
    assert.deepEqual(verifyRuntimePackage(outputRoot), { ok: false, reason: 'missing-file', detail: 'tools/jev/typesafe-request.mjs' });
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(outputRoot, { recursive: true, force: true }); }
});

test('verified release packaging rejects dirty or mismatched Git source provenance', () => {
  const root = mkdtempSync('/tmp/brain-d0-c-source-provenance-');
  try {
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['-C', root, 'config', 'user.email', 'fixture@example.invalid']);
    execFileSync('git', ['-C', root, 'config', 'user.name', 'fixture']);
    writeFileSync(path.join(root, 'tracked.txt'), 'clean\n');
    execFileSync('git', ['-C', root, 'add', 'tracked.txt']);
    execFileSync('git', ['-C', root, 'commit', '-qm', 'fixture']);
    const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const clean = assertCleanSourceProvenance(root, revision);
    assert.equal(clean.revision, revision);
    assert.equal(clean.dirty, false);
    assert.throws(() => assertCleanSourceProvenance(root, '0'.repeat(40)), /does not match Git HEAD/u);
    writeFileSync(path.join(root, 'tracked.txt'), 'dirty\n');
    assert.throws(() => assertCleanSourceProvenance(root, revision), /source tree must be clean/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
