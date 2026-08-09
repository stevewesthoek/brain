import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { validateAdmissionRegistry, loadAdmissionRegistry, DEFAULT_REGISTRY_PATH } from './validate-mcp-provider-admissions.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-mcp-admission-'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/server.js'), 'server');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sha256 = crypto.createHash('sha256').update('server').digest('hex');
  const registry = {
    schemaVersion: '1.0.0', reviewedAt: '2026-07-15', admissions: [{
      admissionId: 'example-provider', status: 'active-local', owner: 'brain-runtime', consumer: 'brain',
      provider: { providerId: 'example', repository: 'example/provider', revision, sourceState: 'committed', version: '1.0.0', entrypoint: 'dist/server.js', artifacts: [{ path: 'dist/server.js', sha256 }] },
      transport: { kind: 'stdio', serverName: 'example', projectScoped: true, shell: false, networkPolicy: 'loopback-only' },
      authentication: { mode: 'derived-credential-file', credentialFileEnvironmentVariable: 'EXAMPLE_CREDENTIAL_FILE', principal: 'example-principal', audience: 'example-api', storage: 'outside-repositories-owner-only', relayAllowed: false },
      scope: { toolAllowlistEnvironmentVariable: 'EXAMPLE_ALLOWED_TOOLS', suboperationAllowlistEnvironmentVariable: 'EXAMPLE_ALLOWED_OPERATIONS', tools: [{ name: 'readStatus', risk: 'read', approval: 'none', allowedSuboperations: [] }] },
      limits: { startupTimeoutSeconds: 10, toolTimeoutSeconds: 30, maxRequestBytes: 65536, maxResponseBytes: 65536 },
      verification: { commands: ['node --test'], evidence: ['fixture'] },
      revocation: { procedure: 'Remove the project registration.', preserveEvidence: true }
    }]
  };
  return { root, registry };
}

function reproducibleBuildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-mcp-reproducible-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), 'dist/\n');
  fs.writeFileSync(path.join(root, 'src/server.ts'), 'export const value = "reproducible";\n');
  fs.writeFileSync(path.join(root, 'dist/server.js'), 'export const value = "reproducible";\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.gitignore', 'src/server.ts'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'source'], { cwd: root });
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceBytes = fs.readFileSync(path.join(root, 'src/server.ts'));
  const runtimeBytes = fs.readFileSync(path.join(root, 'dist/server.js'));
  const sourceInputs = [{ path: 'src/server.ts', sha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'), bytes: sourceBytes.length }];
  const runtimeArtifacts = [{ path: 'dist/server.js', sha256: crypto.createHash('sha256').update(runtimeBytes).digest('hex'), bytes: runtimeBytes.length }];
  const aggregate = (items) => crypto.createHash('sha256').update(items.map((item) => `${item.path}\0${item.sha256}\0${item.bytes}\n`).join('')).digest('hex');
  const manifest = {
    schemaVersion: 'workbench-mcp-runtime-provenance/v1',
    sourceState: 'reproducible-build',
    sourceRevision,
    packageVersion: '1.0.0',
    toolchain: { node: 'v20.20.2', pnpm: '10.33.0' },
    buildCommands: [{ command: 'pnpm', args: ['build'] }],
    entrypoint: runtimeArtifacts[0],
    sourceInputs,
    sourceAggregateSha256: aggregate(sourceInputs),
    runtimeArtifacts,
    runtimeAggregateSha256: aggregate(runtimeArtifacts),
  };
  fs.writeFileSync(path.join(root, 'runtime-provenance.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  execFileSync('git', ['add', 'runtime-provenance.json'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'provenance'], { cwd: root });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const manifestSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'runtime-provenance.json'))).digest('hex');
  const base = fixture();
  fs.rmSync(base.root, { recursive: true });
  const admission = base.registry.admissions[0];
  admission.provider = {
    providerId: 'example', repository: 'example/provider', revision,
    sourceState: 'reproducible-build', version: '1.0.0', entrypoint: 'dist/server.js',
    runtimeProvenanceManifest: 'runtime-provenance.json',
    artifacts: [
      { path: 'dist/server.js', sha256: runtimeArtifacts[0].sha256 },
      { path: 'runtime-provenance.json', sha256: manifestSha },
    ],
  };
  return { root, registry: base.registry };
}

test('validates identity, scope, and pinned provider artifacts', () => {
  const item = fixture();
  assert.deepEqual(validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) }), []);
  fs.writeFileSync(path.join(item.root, 'dist/server.js'), 'tampered');
  assert(validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) }).some((error) => error.includes('artifact-digest-mismatch')));
  fs.rmSync(item.root, { recursive: true });
});

test('admits a gitignored runtime only through committed reproducible-build provenance', () => {
  const item = reproducibleBuildFixture();
  assert.deepEqual(validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) }), []);
  fs.writeFileSync(path.join(item.root, 'dist/server.js'), 'tampered runtime');
  const errors = validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) });
  assert(errors.some((error) => error.includes('artifact-digest-mismatch') || error.includes('provenance-digest-mismatch')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('reproducible-build rejects a provenance commit that also changes provider source', () => {
  const item = reproducibleBuildFixture();
  fs.writeFileSync(path.join(item.root, 'src/extra.ts'), 'export const widened = true;\n');
  execFileSync('git', ['add', 'src/extra.ts'], { cwd: item.root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'unattested source'], { cwd: item.root });
  item.registry.admissions[0].provider.revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: item.root, encoding: 'utf8' }).trim();
  const errors = validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) });
  assert(errors.some((error) => error.includes('runtime-provenance-revision-delta-invalid')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('rejects embedded secret values and unapproved mutations', () => {
  const item = fixture();
  item.registry.admissions[0].authentication.token = 'forbidden';
  item.registry.admissions[0].scope.tools.push({ name: 'writeFile', risk: 'write', approval: 'none', allowedSuboperations: [] });
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((error) => error.includes('secret values are forbidden')));
  assert(errors.some((error) => error.includes('mutation requires approval')));
  fs.rmSync(item.root, { recursive: true });
});

function noneAuthAdmission() {
  const base = fixture();
  const admission = base.registry.admissions[0];
  admission.authentication = { mode: 'none', relayAllowed: false };
  admission.scope.tools[0].name = 'read_status';
  return base;
}

test('mode=none: accepts credential-free admission', () => {
  const item = noneAuthAdmission();
  assert.deepEqual(validateAdmissionRegistry(item.registry), []);
  fs.rmSync(item.root, { recursive: true });
});

test('mode=none: rejects credentialFileEnvironmentVariable field', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].authentication.credentialFileEnvironmentVariable = 'SOME_CRED_FILE';
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((e) => e.includes('must not set credentialFileEnvironmentVariable')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('mode=none: rejects principal, audience, storage fields', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].authentication.principal = 'some-principal';
  item.registry.admissions[0].authentication.audience = 'some-api';
  item.registry.admissions[0].authentication.storage = 'outside-repositories-owner-only';
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((e) => e.includes('must not set principal')), `errors: ${errors}`);
  assert(errors.some((e) => e.includes('must not set audience')), `errors: ${errors}`);
  assert(errors.some((e) => e.includes('must not set storage')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('derived-credential-file: preserves existing behavior unchanged', () => {
  const item = fixture();
  assert.deepEqual(validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) }), []);
  fs.rmSync(item.root, { recursive: true });
});

test('tool names: accepts snake_case names', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].scope.tools = [
    { name: 'index_repository', risk: 'write', approval: 'per-call', allowedSuboperations: [] },
    { name: 'search_code', risk: 'read', approval: 'none', allowedSuboperations: [] },
    { name: 'get_code_snippet', risk: 'read', approval: 'none', allowedSuboperations: [] },
  ];
  assert.deepEqual(validateAdmissionRegistry(item.registry), []);
  fs.rmSync(item.root, { recursive: true });
});

test('binary-direct: executable=true + mode=none generates correct TOML', async () => {
  const { renderProjectRegistration } = await import('./generate-mcp-project-registration.mjs');
  const admission = {
    transport: { serverName: 'test-server' },
    authentication: { mode: 'none', relayAllowed: false },
    provider: { entrypoint: 'test-binary', executable: true },
    limits: { startupTimeoutSeconds: 10, toolTimeoutSeconds: 30 },
    scope: {
      toolAllowlistEnvironmentVariable: 'TEST_ALLOWED_TOOLS',
      suboperationAllowlistEnvironmentVariable: 'TEST_ALLOWED_SUB',
      tools: [{ name: 'read_graph', allowedSuboperations: [] }],
    },
  };
  const rendered = renderProjectRegistration(admission, { providerRoot: '/opt/bin', credentialFile: null, nodeExecutable: '/usr/bin/node' });
  assert(rendered.includes('command = "/opt/bin/test-binary"'), `missing binary command: ${rendered}`);
  assert(rendered.includes('args = []'), `missing empty args: ${rendered}`);
  assert(!rendered.includes('cwd ='), `should not include cwd: ${rendered}`);
  assert(!rendered.includes('CREDENTIAL'), `should not include credential: ${rendered}`);
});

test('loopback-with-bounded-egress: accepts valid bounded egress exceptions', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].transport.networkPolicy = 'loopback-with-bounded-egress';
  item.registry.admissions[0].transport.boundedEgressExceptions = [{
    host: 'api.github.com',
    purpose: 'Update check',
    protocol: 'https',
    method: 'GET',
    failureBehavior: 'non-blocking-non-fatal',
    sourceDataTransmitted: false,
    disableableByEnvVar: null,
    note: 'Startup version check'
  }];
  assert.deepEqual(validateAdmissionRegistry(item.registry), []);
  fs.rmSync(item.root, { recursive: true });
});

test('loopback-with-bounded-egress: rejects missing boundedEgressExceptions', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].transport.networkPolicy = 'loopback-with-bounded-egress';
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some(e => e.includes('requires non-empty boundedEgressExceptions')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('loopback-with-bounded-egress: rejects sourceDataTransmitted=true', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].transport.networkPolicy = 'loopback-with-bounded-egress';
  item.registry.admissions[0].transport.boundedEgressExceptions = [{
    host: 'evil.com',
    purpose: 'Exfiltration',
    protocol: 'https',
    method: 'POST',
    failureBehavior: 'non-blocking-non-fatal',
    sourceDataTransmitted: true,
    disableableByEnvVar: null,
    note: 'Should fail'
  }];
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some(e => e.includes('sourceDataTransmitted=false')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('loopback-only: rejects boundedEgressExceptions field', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].transport.boundedEgressExceptions = [{
    host: 'api.github.com',
    purpose: 'Update check',
    protocol: 'https',
    method: 'GET',
    failureBehavior: 'non-blocking-non-fatal',
    sourceDataTransmitted: false,
    disableableByEnvVar: null,
    note: 'Should not exist on loopback-only'
  }];
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some(e => e.includes('loopback-only must not have boundedEgressExceptions')), `errors: ${errors}`);
  fs.rmSync(item.root, { recursive: true });
});

test('live admission registry: passes validation without provider root', () => {
  const registry = loadAdmissionRegistry(DEFAULT_REGISTRY_PATH);
  const errors = validateAdmissionRegistry(registry);
  assert.deepEqual(errors, [], `live registry errors: ${errors.join(', ')}`);
});

test('optional corpus limits must be positive integers', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].limits.maxSourceFiles = 0;
  item.registry.admissions[0].limits.maxSourceBytes = 1.5;
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((error) => error.includes('invalid optional limit maxSourceFiles')), `errors: ${errors}`);
  assert(errors.some((error) => error.includes('invalid optional limit maxSourceBytes')), `errors: ${errors}`);
  fs.rmSync(item.root, {recursive: true});
});

test('tool allowlist: rendered TOML includes all admitted snake_case tool names', async () => {
  const { renderProjectRegistration } = await import('./generate-mcp-project-registration.mjs');
  const tools = [
    'index_repository', 'search_code', 'query_graph', 'trace_path',
    'get_code_snippet', 'get_graph_schema', 'get_architecture', 'search_graph',
    'list_projects', 'delete_project', 'index_status', 'detect_changes',
    'manage_adr', 'ingest_traces',
  ];
  const admission = {
    transport: { serverName: 'codebase-memory-mcp' },
    authentication: { mode: 'none', relayAllowed: false },
    provider: { entrypoint: 'codebase-memory-mcp', executable: true },
    limits: { startupTimeoutSeconds: 15, toolTimeoutSeconds: 60 },
    scope: {
      toolAllowlistEnvironmentVariable: 'CBM_ALLOWED_TOOLS',
      suboperationAllowlistEnvironmentVariable: 'CBM_ALLOWED_SUBOPERATIONS',
      tools: tools.map((name, i) => ({ name, allowedSuboperations: [], risk: i === 0 ? 'write' : 'read', approval: i === 0 ? 'per-call' : 'none' })),
    },
  };
  const rendered = renderProjectRegistration(admission, { providerRoot: '/opt', credentialFile: null, nodeExecutable: '/usr/bin/node' });
  const expected = tools.join(',');
  assert(rendered.includes(expected), `tool allowlist mismatch.\nExpected: ${expected}\nGot: ${rendered}`);
});

test('candidate registration is disabled and renders validated fixed non-secret environment', async () => {
  const { renderProjectRegistration } = await import('./generate-mcp-project-registration.mjs');
  const item = noneAuthAdmission();
  const admission = item.registry.admissions[0];
  admission.status = 'candidate';
  admission.scope.fixedEnvironment = {EXAMPLE_ROOT: '/opt/example', EXAMPLE_MODE: 'read-only'};
  assert.deepEqual(validateAdmissionRegistry(item.registry), []);
  const rendered = renderProjectRegistration(admission, {providerRoot: '/opt', credentialFile: null, nodeExecutable: '/usr/bin/node'});
  assert.match(rendered, /enabled = false/);
  assert.match(rendered, /required = false/);
  assert.match(rendered, /EXAMPLE_MODE = "read-only"/);
  assert.match(rendered, /EXAMPLE_ROOT = "\/opt\/example"/);
  fs.rmSync(item.root, {recursive: true});
});

test('paused and revoked registrations render disabled', async () => {
  const { renderProjectRegistration } = await import('./generate-mcp-project-registration.mjs');
  const item = noneAuthAdmission();
  for (const status of ['paused', 'revoked']) {
    item.registry.admissions[0].status = status;
    const rendered = renderProjectRegistration(item.registry.admissions[0], {providerRoot: '/opt', credentialFile: null, nodeExecutable: '/usr/bin/node'});
    assert.match(rendered, /enabled = false/);
    assert.match(rendered, /required = false/);
  }
  fs.rmSync(item.root, {recursive: true});
});

test('registration verifies the rendered runtime tree artifacts', async () => {
  const { verifyRenderedRuntimeRoot } = await import('./generate-mcp-project-registration.mjs');
  const item = noneAuthAdmission();
  assert.doesNotThrow(() => verifyRenderedRuntimeRoot(item.registry.admissions[0], item.root));
  fs.writeFileSync(path.join(item.root, 'dist/server.js'), 'runtime-tamper');
  assert.throws(() => verifyRenderedRuntimeRoot(item.registry.admissions[0], item.root), /Runtime artifact digest mismatch/);
  fs.rmSync(item.root, {recursive: true});
});

test('fixed environment cannot override the admitted tool allowlist binding', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].scope.fixedEnvironment = {EXAMPLE_ALLOWED_TOOLS: 'broadened'};
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((error) => error.includes('must not override admission allowlist bindings')), `errors: ${errors}`);
  fs.rmSync(item.root, {recursive: true});
});

test('fixed environment rejects cross-provider process controls and secret-bearing bindings', () => {
  const item = noneAuthAdmission();
  item.registry.admissions[0].scope.fixedEnvironment = {NODE_OPTIONS: '--import=evil', EXAMPLE_SECRET: 'value'};
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((error) => error.includes('must use provider prefix EXAMPLE_')), `errors: ${errors}`);
  assert(errors.some((error) => error.includes('must not contain secret-bearing binding EXAMPLE_SECRET')), `errors: ${errors}`);
  fs.rmSync(item.root, {recursive: true});
});
