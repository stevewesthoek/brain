import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  BRAIN_BOOTSTRAP_PLAN_SCHEMA_VERSION,
  bootstrapPlanJson,
  createBrainBootstrapPlan,
  inspectBootstrapPrerequisites,
} from '../agent-mode/bootstrap-plan.js';
import { loadBrainRuntimeConfig } from '../agent-mode/portable-runtime-config.js';

function fixtureRoot(prefix = 'brain-d0-b-'): string {
  const root = mkdtempSync(path.join('/tmp', prefix));
  for (const project of ['brain-core', 'brain-console']) {
    const projectRoot = path.join(root, 'projects', project);
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(path.join(projectRoot, 'package.json'), '{}\n');
    writeFileSync(path.join(projectRoot, 'package-lock.json'), '{"lockfileVersion":3}\n');
  }
  return root;
}

function planInput(sourceRoot: string, installationRoot: string, overrides: Record<string, unknown> = {}) {
  return {
    sourceRoot,
    installationRoot,
    runtimeConfig: loadBrainRuntimeConfig({ home: '/tmp/d0-b-home', env: { HOME: '/tmp/d0-b-home' } }),
    sourceRevision: 'fixture-revision',
    platform: 'darwin',
    architecture: 'arm64',
    nodeVersion: '22.5.0',
    npmVersion: '10.9.0',
    ...overrides,
  };
}

test('creates a versioned bounded source-development plan with fixed lean-core components', () => {
  const sourceRoot = fixtureRoot();
  const installRoot = path.join(sourceRoot, '..', 'd0-b-install');
  try {
    const plan = createBrainBootstrapPlan(planInput(sourceRoot, installRoot));
    assert.equal(plan.schemaVersion, BRAIN_BOOTSTRAP_PLAN_SCHEMA_VERSION);
    assert.match(plan.planId, /^brain-bootstrap-plan:sha256:[a-f0-9]{64}$/u);
    assert.equal(plan.mode, 'source-development');
    assert.deepEqual(plan.platform, { os: 'darwin', architecture: 'arm64' });
    assert.deepEqual(plan.installation, { state: 'fresh', overwrite: false });
    assert.deepEqual(plan.components.map(({ id, status }) => ({ id, status })), [
      { id: 'brain-core', status: 'required' },
      { id: 'brain-console', status: 'required' },
      { id: 'brain-node', status: 'optional' },
      { id: 'voice-stt', status: 'optional' },
      { id: 'browser-tts', status: 'client-capability' },
      { id: 'bedrock', status: 'optional' },
      { id: 'personal-integrations', status: 'excluded' },
    ]);
    assert.deepEqual(plan.actions.map((action) => action.kind), [
      'verify-file', 'verify-file', 'run-package-command', 'run-package-command',
      'run-package-command', 'run-package-command', 'smoke-check', 'smoke-check', 'smoke-check',
    ]);
    assert.deepEqual(plan.actions.filter((action): action is Extract<typeof action, { kind: 'run-package-command' }> => action.kind === 'run-package-command').map((action) => [action.executable, action.args]), [
      ['npm', ['ci']], ['npm', ['run', 'build']], ['npm', ['ci']], ['npm', ['run', 'build']],
    ]);
    assert.deepEqual(plan.servicePlan, { status: 'not-installed', registration: false, start: false });
    assert.equal(plan.startup.brainNode.status, 'optional-not-installed');
    assert.equal(plan.rollback.action, 'no-op');
    assert.equal(JSON.stringify(plan).includes('MiniMax'), false);
    assert.equal(JSON.stringify(plan).includes('SECRET'), false);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('plan identity and serialized material are deterministic without writes', () => {
  const sourceRoot = fixtureRoot();
  const installRoot = path.join(sourceRoot, '..', 'd0-b-install');
  try {
    const before = readdirSync(path.dirname(installRoot), { withFileTypes: true }).map((entry) => entry.name);
    const first = createBrainBootstrapPlan(planInput(sourceRoot, installRoot));
    const second = createBrainBootstrapPlan(planInput(sourceRoot, installRoot));
    assert.equal(first.planId, second.planId);
    assert.equal(bootstrapPlanJson(first), bootstrapPlanJson(second));
    assert.deepEqual(readdirSync(path.dirname(installRoot), { withFileTypes: true }).map((entry) => entry.name), before);
    assert.equal(existsSync(installRoot), false);
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('release plans use supplied immutable provenance and retain service/install boundaries', () => {
  const sourceRoot = fixtureRoot();
  const installRoot = path.join(sourceRoot, '..', 'd0-b-release-install');
  try {
    const plan = createBrainBootstrapPlan(planInput(sourceRoot, installRoot, { mode: 'packaged-release' }));
    assert.equal(plan.source.provenance, 'release-manifest');
    assert.equal(plan.source.revision, 'fixture-revision');
    assert.equal(plan.servicePlan.status, 'not-installed');
    assert.ok(plan.warnings.some((warning) => warning.includes('dry-run only')));
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('prerequisites expose unsupported runtime and missing manifests without probing providers', () => {
  const sourceRoot = fixtureRoot();
  const installRoot = path.join(sourceRoot, '..', 'd0-b-install');
  try {
    const checks = inspectBootstrapPrerequisites(planInput(sourceRoot, installRoot, {
      platform: 'win32', architecture: 'ia32', nodeVersion: '20.0.0', npmVersion: null,
      serviceAuthConfigured: false, operatorAuthConfigured: false,
    }));
    assert.equal(checks.find((check) => check.id === 'platform')?.status, 'unsupported');
    assert.equal(checks.find((check) => check.id === 'architecture')?.status, 'unsupported');
    assert.equal(checks.find((check) => check.id === 'node')?.status, 'unsupported');
    assert.equal(checks.find((check) => check.id === 'npm')?.status, 'missing');
    assert.equal(checks.find((check) => check.id === 'service-auth')?.status, 'missing');
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('unsafe or conflicting installation targets fail closed and never overwrite', () => {
  const sourceRoot = fixtureRoot();
  try {
    assert.throws(() => createBrainBootstrapPlan(planInput(sourceRoot, sourceRoot, { mode: 'packaged-release' })), /conflict/u);
    assert.throws(() => createBrainBootstrapPlan(planInput(sourceRoot, '/tmp/.git/d0-b-install')), /unsafe/u);
    assert.throws(() => createBrainBootstrapPlan(planInput(sourceRoot, '/tmp/node_modules/d0-b-install')), /unsafe/u);
    const unknown = path.join(sourceRoot, '..', 'd0-b-unknown-install');
    mkdirSync(unknown, { recursive: true });
    writeFileSync(path.join(unknown, 'marker.txt'), 'untouched');
    const plan = createBrainBootstrapPlan(planInput(sourceRoot, unknown));
    assert.equal(plan.installation.state, 'existing-unknown');
    assert.equal(readFileSync(path.join(unknown, 'marker.txt'), 'utf8'), 'untouched');
    rmSync(unknown, { recursive: true, force: true });
  } finally { rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('critical runtime paths reject relative values while home-relative paths remain portable', () => {
  assert.throws(() => loadBrainRuntimeConfig({ portableProfile: { stateRoot: 'relative-state' } }), /absolute or home-relative/u);
  const config = loadBrainRuntimeConfig({ home: '/tmp/d0-b-home', env: { HOME: '/tmp/d0-b-home' }, portableProfile: { stateRoot: '~/state' } });
  assert.equal(config.stateRoot, '/tmp/d0-b-home/state');
});
