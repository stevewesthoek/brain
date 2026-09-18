import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION, loadBrainRuntimeConfig, safeBrainRuntimeConfigView } from '../agent-mode/portable-runtime-config.js';

function tempRoot(prefix = 'brain-d0-a-'): string {
  return mkdtempSync(path.join('/tmp', prefix));
}

test('lean core defaults are versioned, portable, and personal integrations are optional', () => {
  const home = '/tmp/d0-a-user';
  const config = loadBrainRuntimeConfig({ home, env: { HOME: home } });
  assert.equal(config.schemaVersion, BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION);
  assert.equal(config.profile, 'core');
  assert.equal(config.stateStore.kind, 'sqlite');
  assert.equal(config.stateStore.path, '/tmp/d0-a-user/.local/brain/agent-mode/agent-mode.db');
  assert.equal(config.core.bindHost, '127.0.0.1');
  assert.equal(config.core.port, 4877);
  assert.equal(config.optionalCapabilities.voiceStt, 'unavailable');
  assert.equal(config.optionalCapabilities.voiceTts, 'client-capability');
  assert.equal(config.optionalCapabilities.modelBedrock, 'unavailable');
  assert.equal(config.execution.codexCliPath, null);
  assert.equal(config.providerRefs.length, 0);
  assert.equal(JSON.stringify(config).includes('/Users/Office'), false);
});

test('portable, host-local, and environment layers resolve in deterministic precedence order', () => {
  const home = '/tmp/d0-a-precedence';
  const config = loadBrainRuntimeConfig({
    home,
    portableProfile: { schemaVersion: BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION, profile: 'personal', core: { port: 4880 }, optionalCapabilities: { voiceStt: 'configured' } },
    hostProfile: { core: { port: 4882 }, optionalCapabilities: { modelBedrock: 'configured' } },
    env: { HOME: home, BRAIN_RUNTIME_PROFILE: 'test', BRAIN_CORE_PORT: '4883' },
  });
  assert.equal(config.profile, 'test');
  assert.equal(config.core.port, 4883);
  assert.equal(config.optionalCapabilities.voiceStt, 'configured');
  assert.equal(config.optionalCapabilities.modelBedrock, 'configured');
});

test('legacy Agent Mode state directory remains a compatibility override', () => {
  const home = '/tmp/d0-a-legacy';
  const config = loadBrainRuntimeConfig({ home, env: { HOME: home, BRAIN_AGENT_MODE_STATE_DIR: '/tmp/d0-a-state' } });
  assert.equal(config.stateStore.path, '/tmp/d0-a-state/agent-mode.db');
});

test('unknown keys, unsupported versions, unsafe paths, invalid ports, and invalid URLs fail closed', () => {
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { typo: true } }), /unknown key/);
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { schemaVersion: 'brain-runtime-config-v2' } }), /unsupported/);
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { stateStore: { kind: 'postgres' } } }), /unsupported/);
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { stateStore: { path: '/tmp/.git/agent-mode.db' } } }), /portable runtime boundary/);
  assert.throws(() => loadBrainRuntimeConfig({ env: { BRAIN_RUNTIME_CORE_PORT: '0' } }), /invalid/);
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { console: { coreUrl: 'http://user:password@example.test' } } }), /credentials/);
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { execution: { codexCliPath: 'codex' } } }), /absolute or home-relative/);
});

test('Core-owned execution resource configuration supplies an explicit Codex path without environment authority', () => {
  const config = loadBrainRuntimeConfig({
    home: '/tmp/d0-a-execution',
    env: { HOME: '/tmp/d0-a-execution' },
    portableProfile: { execution: { codexCliPath: '/opt/homebrew/bin/codex' } },
  });
  assert.equal(config.execution.codexCliPath, '/opt/homebrew/bin/codex');
  assert.equal('BRAIN_CODEX_BIN' in config, false);
});

test('temporary HOME values produce equivalent semantics with host-local paths', () => {
  const first = loadBrainRuntimeConfig({ home: '/tmp/d0-a-home-one', env: { HOME: '/tmp/d0-a-home-one' } });
  const second = loadBrainRuntimeConfig({ home: '/tmp/d0-a-home-two', env: { HOME: '/tmp/d0-a-home-two' } });
  const normalize = (value: string, home: string): string => value.replaceAll(home, '<HOME>');
  assert.equal(first.core.port, second.core.port);
  assert.equal(first.console.coreUrl, second.console.coreUrl);
  assert.equal(normalize(first.stateStore.path, '/tmp/d0-a-home-one'), normalize(second.stateStore.path, '/tmp/d0-a-home-two'));
  assert.equal(normalize(first.node.configRoot, '/tmp/d0-a-home-one'), normalize(second.node.configRoot, '/tmp/d0-a-home-two'));
});

test('fake installation profile loads without depending on repository cwd', () => {
  const installRoot = tempRoot('brain-d0-a-install-');
  const home = '/tmp/d0-a-fake-install-user';
  const profilePath = path.join(installRoot, 'profile.json');
  writeFileSync(profilePath, JSON.stringify({ schemaVersion: BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION, profile: 'test', stateRoot: '~/state', console: { coreUrl: 'http://127.0.0.1:4877' } }));
  try {
    const config = loadBrainRuntimeConfig({ home, env: { HOME: home }, portableProfilePath: profilePath });
    assert.equal(config.profile, 'test');
    assert.equal(config.stateRoot, path.join(home, 'state'));
    assert.equal(config.stateStore.path, path.join(home, 'state', 'agent-mode', 'agent-mode.db'));
    assert.equal(config.node.configRoot.startsWith(installRoot), false);
    assert.equal(loadBrainRuntimeConfig({ home, env: { HOME: home, BRAIN_RUNTIME_PROFILE_PATH: profilePath } }).profile, 'test');
    assert.equal(loadBrainRuntimeConfig({ home, env: { HOME: home, BRAIN_RUNTIME_CONFIG_PATH: profilePath } }).profile, 'test');
  } finally {
    rmSync(installRoot, { recursive: true, force: true });
  }
});

test('personal profile absence does not load personal integrations or secrets', () => {
  const config = loadBrainRuntimeConfig({ home: '/tmp/d0-a-no-personal', env: { HOME: '/tmp/d0-a-no-personal' } });
  const safe = safeBrainRuntimeConfigView(config);
  assert.deepEqual(safe.providerRefs, []);
  assert.deepEqual(safe.resourceRefs, []);
  assert.equal(JSON.stringify(safe).includes('SECRET'), false);
  assert.equal(JSON.stringify(safe).includes('credential'), false);
});

test('config loading is synchronous and side-effect free with no provider or network probe', () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { fetchCalls += 1; throw new Error('fetch must not be called'); }) as typeof fetch;
  try {
    loadBrainRuntimeConfig({ home: '/tmp/d0-a-no-probe', env: { HOME: '/tmp/d0-a-no-probe', BRAIN_RUNTIME_PROFILE: 'test' } });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('configuration changes do not contain domain identity or execution authority', () => {
  const first = loadBrainRuntimeConfig({ home: '/tmp/d0-a-one', env: { HOME: '/tmp/d0-a-one' } });
  const second = loadBrainRuntimeConfig({ home: '/tmp/d0-a-two', env: { HOME: '/tmp/d0-a-two', BRAIN_RUNTIME_CORE_PORT: '4999' } });
  assert.equal('agentId' in first, false);
  assert.equal('taskId' in first, false);
  assert.equal('modelRef' in first, false);
  assert.equal('capabilityGrant' in first, false);
  assert.notEqual(first.stateStore.path, second.stateStore.path);
  assert.notEqual(first.core.port, second.core.port);
});
