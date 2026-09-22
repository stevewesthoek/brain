import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { inspectNodeExecutable, evaluateServiceDoctor, normalizeLaunchdDescriptor, type LaunchdDescriptor, type ServiceDoctorExpected, type ServiceDoctorObserved } from '../agent-mode/service-resilience.js';

const node = inspectNodeExecutable(process.execPath);
assert.equal(node.ok, true);

const expected: ServiceDoctorExpected = {
  runtimeRoot: '/tmp/brain-runtime/releases/brain-runtime-package:sha256:fixture',
  runtimeBasePath: '/tmp/brain-runtime',
  packageId: 'brain-runtime-package:sha256:fixture',
  sourceRevision: 'fixture-revision',
  nodeExecutable: process.execPath,
  nodeMajor: node.major!,
  stateStorePath: '/tmp/brain-state/agent-mode.db',
  configPath: '/tmp/brain-config/brain-runtime-config.json',
};

function descriptor(component: 'core' | 'console', overrides: Partial<LaunchdDescriptor> = {}): LaunchdDescriptor {
  const entrypoint = component === 'core' ? `${expected.runtimeRoot}/core/dist/index.js` : `${expected.runtimeRoot}/console/standalone/server.js`;
  return {
    label: component === 'core' ? 'com.office.brain-core' : 'com.office.brain-console',
    programArguments: [expected.nodeExecutable, '--env-file', '/tmp/brain-config/config/secrets.env', entrypoint],
    workingDirectory: expected.runtimeRoot,
    environmentVariables: {
      BRAIN_RUNTIME_PATH: expected.runtimeBasePath!,
      BRAIN_DEPLOYMENT_REVISION: expected.sourceRevision,
      BRAIN_RUNTIME_SQLITE_PATH: expected.stateStorePath,
      BRAIN_RUNTIME_CONFIG_PATH: expected.configPath!,
      BRAIN_SECRETS_FILE: '/tmp/brain-config/config/secrets.env',
    },
    runAtLoad: true,
    keepAlive: true,
    ...overrides,
  };
}

function observed(overrides: Partial<ServiceDoctorObserved> = {}): ServiceDoctorObserved {
  return {
    node,
    coreDescriptor: descriptor('core'),
    consoleDescriptor: descriptor('console'),
    launchd: { coreLoaded: true, consoleLoaded: true },
    processes: { core: 1, console: 1 },
    store: { exists: true, schemaVersion: 11, integrity: 'ok', foreignKeyErrors: 0 },
    package: { verified: true, manifest: { packageId: expected.packageId, releaseRevision: expected.sourceRevision } as unknown as NonNullable<ServiceDoctorObserved['package']['manifest']> },
    ...overrides,
  };
}

test('service doctor passes one immutable RC-style service pair', () => {
  const result = evaluateServiceDoctor(expected, observed());
  assert.equal(result.outcome, 'PASS', JSON.stringify(result));
  assert.equal(result.checks.every((check) => check.status === 'pass'), true);
  assert.equal(result.identity.packageId, expected.packageId);
});

test('service doctor fails closed on missing or incompatible Node', () => {
  const missing = evaluateServiceDoctor(expected, observed({ node: { ok: false, executable: expected.nodeExecutable, reason: 'missing' } }));
  assert.equal(missing.outcome, 'FAIL');
  assert.equal(missing.checks.find((check) => check.id === 'node-runtime')?.status, 'fail');
  const wrongMajor = evaluateServiceDoctor(expected, observed({ node: { ...node, ok: true, major: expected.nodeMajor + 1 } }));
  assert.equal(wrongMajor.outcome, 'FAIL');
  assert.equal(wrongMajor.checks.find((check) => check.id === 'node-runtime')?.status, 'fail');
});

test('service doctor rejects rollback, checkout, descriptor, and StateStore drift', () => {
  const wrongRoot = evaluateServiceDoctor({ ...expected, runtimeRoot: '/Users/Office/Repos/stevewesthoek/brain' }, observed());
  assert.equal(wrongRoot.outcome, 'FAIL');
  const wrongDescriptor = evaluateServiceDoctor(expected, observed({ coreDescriptor: descriptor('core', { workingDirectory: '/tmp/rollback' }) }));
  assert.equal(wrongDescriptor.outcome, 'FAIL');
  assert.equal(wrongDescriptor.checks.find((check) => check.id === 'core.working-directory')?.status, 'fail');
  const wrongStore = evaluateServiceDoctor(expected, observed({ store: { exists: true, schemaVersion: 9, integrity: 'ok', foreignKeyErrors: 0 } }));
  assert.equal(wrongStore.outcome, 'FAIL');
  const duplicate = evaluateServiceDoctor(expected, observed({ processes: { core: 2, console: 1 } }));
  assert.equal(duplicate.outcome, 'FAIL');
});

test('service doctor is deterministic and rejects launchd unload or descriptor label drift', () => {
  const facts = observed();
  assert.deepEqual(evaluateServiceDoctor(expected, facts), evaluateServiceDoctor(expected, facts));
  const unloaded = evaluateServiceDoctor(expected, observed({ launchd: { coreLoaded: false, consoleLoaded: true } }));
  assert.equal(unloaded.outcome, 'FAIL');
  const wrongLabel = evaluateServiceDoctor(expected, observed({ consoleDescriptor: descriptor('console', { label: 'com.brain.console' }) }));
  assert.equal(wrongLabel.outcome, 'FAIL');
});

test('service doctor supports explicitly scoped isolated labels without changing production defaults', () => {
  const isolated = evaluateServiceDoctor({ ...expected, coreLabel: 'com.brain.rc7.core', consoleLabel: 'com.brain.rc7.console' }, observed({ coreDescriptor: descriptor('core', { label: 'com.brain.rc7.core' }), consoleDescriptor: descriptor('console', { label: 'com.brain.rc7.console' }) }));
  assert.equal(isolated.outcome, 'PASS', JSON.stringify(isolated));
  assert.equal(evaluateServiceDoctor(expected, observed()).outcome, 'PASS');
});

test('terminal-readiness doctor gate checks private auth, repository policy, and packaged Codex runtime', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-service-doctor-'));
  const runtimeRoot = path.join(root, 'runtime');
  const configPath = path.join(root, 'config', 'brain-runtime-config.json');
  const secretPath = path.join(root, 'config', 'secrets.env');
  mkdirSync(path.join(runtimeRoot, 'core', 'dist', 'agent-mode'), { recursive: true });
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(path.join(runtimeRoot, 'core', 'dist', 'agent-mode', 'codex-cli-agent-runtime.js'), 'fixture');
  writeFileSync(configPath, JSON.stringify({ repositoryRoots: [path.join(root, 'Repos')] }));
  writeFileSync(secretPath, 'BRAIN_CORE_SERVICE_ID=fixture\nBRAIN_CORE_SERVICE_SECRET=fixture\n', { mode: 0o600 });
  chmodSync(secretPath, 0o600);
  const localExpected: ServiceDoctorExpected = { ...expected, runtimeRoot, runtimeBasePath: root, configPath, terminalReadiness: true };
  const localDescriptor = (component: 'core' | 'console'): LaunchdDescriptor => ({
    ...descriptor(component),
    workingDirectory: runtimeRoot,
    programArguments: [expected.nodeExecutable, '--env-file', secretPath, component === 'core' ? path.join(runtimeRoot, 'core', 'dist', 'index.js') : path.join(runtimeRoot, 'console', 'standalone', 'server.js')],
    environmentVariables: { ...descriptor(component).environmentVariables, BRAIN_RUNTIME_PATH: root, BRAIN_RUNTIME_CONFIG_PATH: configPath, BRAIN_SECRETS_FILE: secretPath },
  });
  try {
    const result = evaluateServiceDoctor(localExpected, observed({ coreDescriptor: localDescriptor('core'), consoleDescriptor: localDescriptor('console') }));
    assert.equal(result.outcome, 'PASS', JSON.stringify(result));
    assert.equal(result.checks.find((check) => check.id === 'terminal.secret-file')?.status, 'pass');
    assert.equal(result.checks.find((check) => check.id === 'terminal.repository-policy')?.status, 'pass');
    assert.equal(result.checks.find((check) => check.id === 'terminal.codex-runtime')?.status, 'pass');
    chmodSync(secretPath, 0o644);
    const insecure = evaluateServiceDoctor(localExpected, observed({ coreDescriptor: localDescriptor('core'), consoleDescriptor: localDescriptor('console') }));
    assert.equal(insecure.outcome, 'FAIL');
    assert.equal(insecure.checks.find((check) => check.id === 'terminal.secret-file')?.status, 'fail');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('launchd plist normalization is bounded and rejects malformed descriptors', () => {
  const valid = normalizeLaunchdDescriptor({ Label: 'com.office.brain-core', ProgramArguments: [process.execPath, '--env-file', '/tmp/secrets.env', '/tmp/index.js'], WorkingDirectory: '/tmp', EnvironmentVariables: { BRAIN_RUNTIME_PATH: '/tmp' }, RunAtLoad: true, KeepAlive: true });
  assert.equal(valid?.label, 'com.office.brain-core');
  assert.equal(normalizeLaunchdDescriptor({ Label: 'bad', ProgramArguments: [], WorkingDirectory: '/tmp', RunAtLoad: true, KeepAlive: 'yes' }), undefined);
});

test('actual current Node executable satisfies the host runtime inspection contract', () => {
  assert.equal(node.ok, true);
  assert.equal(node.major, Number(process.versions.node.split('.')[0]));
  assert.ok(node.sha256 && /^[a-f0-9]{64}$/u.test(node.sha256));
});
