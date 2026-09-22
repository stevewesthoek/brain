import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildRuntimePackage } from '../agent-mode/runtime-package.js';
import { installRuntimePackage, renderServiceDescriptor, verifyInstalledRelease } from '../agent-mode/local-install.js';

function sourceFixture(): string {
  const root = mkdtempSync(path.join('/tmp', 'brain-d0-d-source-'));
  mkdirSync(path.join(root, 'projects', 'brain-core', 'dist'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', '.next'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next'), { recursive: true });
  mkdirSync(path.join(root, 'projects', 'brain-console', '.next', 'static'), { recursive: true });
  writeFileSync(path.join(root, 'projects', 'brain-core', 'dist', 'index.js'), 'console.log("core");\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package.json'), '{"name":"brain-core"}\n');
  writeFileSync(path.join(root, 'projects', 'brain-core', 'package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'server.js'), 'console.log("console");\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', '.next', 'BUILD_ID'), 'fixture-build\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'standalone', 'node_modules', 'next', 'package.json'), '{"name":"next","version":"fixture"}\n');
  writeFileSync(path.join(root, 'projects', 'brain-console', '.next', 'static', 'BUILD_ID'), 'fixture-build\n');
  return root;
}

function packageFixture(sourceRoot: string, platform: 'darwin' | 'linux' = 'linux'): string {
  const packageRoot = path.join(sourceRoot, `package-${platform}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  buildRuntimePackage({ sourceRoot, outputRoot: packageRoot, releaseRevision: 'fixture-revision', platform, architecture: platform === 'darwin' ? 'arm64' : 'x64' });
  return packageRoot;
}

test('verified package installs into separated release/state/config/service roots with fake hydration', () => {
  const sourceRoot = sourceFixture(); const packageRoot = packageFixture(sourceRoot); const installRoot = path.join(sourceRoot, `install-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  let hydrations = 0;
  try {
    const result = installRuntimePackage({ packageRoot, installRoot, platform: 'linux', architecture: 'x64', nodeExecutable: '/usr/local/bin/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env', now: '2026-09-15T00:00:00.000Z', hydrate: () => { hydrations += 1; return 'verified-by-fixture'; } });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(hydrations, 1);
    assert.equal(result.install.dependencyHydration.status, 'verified-by-fixture');
    assert.equal(result.install.releaseRoot, path.join(installRoot, 'releases', result.install.packageId));
    assert.equal(result.install.stateRoot, path.join(installRoot, 'state'));
    assert.equal(existsSync(path.join(result.install.releaseRoot, 'manifest.json')), true);
    assert.equal(verifyInstalledRelease(installRoot).ok, true);
    assert.equal(readFileSync(result.install.servicePackages[0]!, 'utf8').includes('fixture-only-service-secret'), false);
    assert.equal(readFileSync(result.install.servicePackages[0]!, 'utf8').includes('/Users/Office'), false);
    assert.equal(readFileSync(result.install.servicePackages[0]!, 'utf8').includes('systemctl'), false);
    assert.equal(renderServiceDescriptor(result.plan.servicePackages[0]!).includes('ExecStart='), true);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(packageRoot, { recursive: true, force: true }); rmSync(installRoot, { recursive: true, force: true }); }
});

test('macOS LaunchAgent and Linux systemd-user descriptors are generic, structured, and inert', () => {
  const sourceRoot = sourceFixture();
  try {
    for (const platform of ['darwin', 'linux'] as const) {
      const packageRoot = packageFixture(sourceRoot, platform);
      const installRoot = path.join(sourceRoot, `install-${platform}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const result = installRuntimePackage({ packageRoot, installRoot, platform, architecture: platform === 'darwin' ? 'arm64' : 'x64', nodeExecutable: '/opt/node/bin/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env', now: '2026-09-15T00:00:00.000Z', hydrate: () => 'verified-by-fixture' });
      assert.equal(result.ok, true);
      if (result.ok) for (const service of result.plan.servicePackages) {
        const body = renderServiceDescriptor(service);
        if (platform !== 'darwin') assert.equal(body.includes('office'), false); assert.equal(body.includes('macbook'), false); assert.equal(body.includes('BRAIN_CORE_SERVICE_SECRET='), false); assert.equal(body.includes('launchctl'), false); assert.equal(body.includes('systemctl'), false); assert.match(body, /BRAIN_CODEX_AUTH_MODE[\s\S]*host-managed/u);
        if (platform === 'darwin') assert.equal(service.label, service.component === 'brain-core' ? 'com.office.brain-core' : 'com.office.brain-console');
        assert.equal(service.scope, 'user'); assert.equal(service.activation, 'not-registered'); assert.equal(service.argv[0], '--env-file'); assert.equal(service.argv[1], path.join(installRoot, 'config/secrets.env'));
        if (platform === 'darwin') {
          assert.match(body, new RegExp(`<key>ProgramArguments</key><array><string>${service.executable.replaceAll('/', '\\/')}</string><string>--env-file</string>`));
          assert.match(body, /<key>BRAIN_CODEX_AUTH_MODE<\/key><string>host-managed<\/string>/u);
          assert.match(body, /<key>PATH<\/key><string>\/opt\/homebrew\/bin:/u);
        }
      }
      rmSync(installRoot, { recursive: true, force: true });
      rmSync(packageRoot, { recursive: true, force: true });
    }
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('unverified, conflicting, failed, and repeated installs are fail-closed or idempotent', () => {
  const sourceRoot = sourceFixture(); const packageRoot = packageFixture(sourceRoot); const installRoot = path.join(sourceRoot, `install-idempotent-${Date.now()}-${Math.random().toString(16).slice(2)}`); const unknown = path.join(sourceRoot, `unknown-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const bad = path.join(sourceRoot, `bad-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(bad, { recursive: true }); writeFileSync(path.join(bad, 'manifest.json'), '{}');
    assert.equal(installRuntimePackage({ packageRoot: bad, installRoot, platform: 'linux', architecture: 'x64', nodeExecutable: '/usr/bin/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env' }).ok, false);
    mkdirSync(unknown, { recursive: true }); writeFileSync(path.join(unknown, 'marker'), 'keep');
    assert.deepEqual(installRuntimePackage({ packageRoot, installRoot: unknown, platform: 'linux', architecture: 'x64', nodeExecutable: '/usr/bin/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env' }), { ok: false, reason: 'target-conflict', detail: 'installRoot must be fresh or empty' });
    let hydrations = 0; const first = installRuntimePackage({ packageRoot, installRoot, platform: 'linux', architecture: 'x64', nodeExecutable: '/usr/bin/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env', hydrate: () => { hydrations += 1; return 'verified-by-fixture'; } }); const second = installRuntimePackage({ packageRoot, installRoot, platform: 'linux', architecture: 'x64', nodeExecutable: '/usr/bin/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env', hydrate: () => { hydrations += 1; return 'verified-by-fixture'; } });
    assert.equal(first.ok, true); assert.equal(second.ok, true); assert.equal(hydrations, 1);
    assert.equal(installRuntimePackage({ packageRoot, installRoot, platform: 'linux', architecture: 'x64', nodeExecutable: '/different/node', nodeVersion: '22.5.0', secretRef: 'config/secrets.env' }).ok, false);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(packageRoot, { recursive: true, force: true }); rmSync(installRoot, { recursive: true, force: true }); rmSync(unknown, { recursive: true, force: true }); }
});

test('local install rejects a declared Node runtime below the package contract', () => {
  const sourceRoot = sourceFixture(); const packageRoot = packageFixture(sourceRoot); const installRoot = path.join(sourceRoot, `install-node-version-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    const result = installRuntimePackage({ packageRoot, installRoot, platform: 'linux', architecture: 'x64', nodeExecutable: process.execPath, nodeVersion: '22.4.9', secretRef: 'config/secrets.env' });
    assert.deepEqual(result, { ok: false, reason: 'invalid-input', detail: 'Node >=22.5.0 is required' });
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(packageRoot, { recursive: true, force: true }); rmSync(installRoot, { recursive: true, force: true }); }
});
