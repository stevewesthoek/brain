/**
 * validate-mcp-runtime-truth.test.mjs
 *
 * Tests for the MCP runtime-truth validator. All tests use only fixture data —
 * no real credential files, ~/.codex/config.toml, or ~/.claude.json are read.
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  detectAdmissionWithoutRegistration,
  detectCandidateDescribedAsDefault,
  detectRetiredBridgeEnabled,
  detectPrematureCodebaseMemoryRegistration,
  detectWorkbenchScopeExceedance,
  detectBareCredentialInConfig,
  detectGraphifySchedulerViolation,
  detectGraphifyFalseTruthClaim,
  detectCodebaseMemoryFalseDefaultClaim,
} from './validate-mcp-runtime-truth.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'validate-mcp-runtime-truth.mjs');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runValidator(args, { HOME: home = '/tmp/fakehome' } = {}) {
  const result = spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status ?? 1 };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeRegistry({ workbenchStatus = 'active-local', cbmStatus = 'candidate' } = {}) {
  return {
    schemaVersion: '1.0.0',
    reviewedAt: '2026-08-02',
    admissions: [
      {
        admissionId: 'workbench-for-brain',
        status: workbenchStatus,
        transport: { serverName: 'workbench' },
        provider: { revision: 'aa7bf7ec', version: '1.3.3-beta' },
        scope: {
          toolAllowlistEnvironmentVariable: 'WORKBENCH_MCP_ALLOWED_TOOLS',
          suboperationAllowlistEnvironmentVariable: 'WORKBENCH_MCP_ALLOWED_COMMAND_KINDS',
          tools: [
            { name: 'getWorkbenchStatus', allowedSuboperations: [] },
            { name: 'readWorkbenchContext', allowedSuboperations: [] },
            { name: 'runWorkbenchCommand', allowedSuboperations: ['n8n_workflow_migration'] }
          ]
        }
      },
      {
        admissionId: 'codebase-memory-mcp-brain',
        status: cbmStatus,
        provider: { version: '0.9.0' }
      }
    ]
  };
}

function makeCodexToml({ includeWorkbench = false, workbenchTools = 'getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand', workbenchKinds = 'n8n_workflow_migration', includeLegacyBridge = false, legacyBridgeEnabled = false, includeCodebaseMemory = false } = {}) {
  const sections = [];

  if (includeWorkbench) {
    sections.push(`[mcp_servers.workbench]
command = "/usr/local/bin/node"
args = ["/repo/packages/mcp/dist/server.js"]

[mcp_servers.workbench.env]
WORKBENCH_MCP_ALLOWED_TOOLS = "${workbenchTools}"
WORKBENCH_MCP_ALLOWED_COMMAND_KINDS = "${workbenchKinds}"
WORKBENCH_MCP_CREDENTIAL_FILE = "/Users/user/.credentials/workbench-mcp.token"
`);
  }

  if (includeLegacyBridge) {
    sections.push(`[mcp_servers.b1_0a_guarded_save_to_mind]
command = "/usr/local/bin/node"
args = ["/repo/tools/mcp/b1-0a-guarded-save-to-mind.mjs"]
${legacyBridgeEnabled ? '' : 'enabled = false'}
`);
  }

  if (includeCodebaseMemory) {
    sections.push(`[mcp_servers.codebase-memory-mcp]
command = "/Users/user/.local/bin/codebase-memory-mcp"
args = []
`);
  }

  return sections.join('\n');
}

function makeClaudeJson({ mcpServers = {} } = {}) {
  return JSON.stringify({ version: 1, mcpServers });
}

// ---------------------------------------------------------------------------
// Test 1: active-local admission with no client registration → detects mismatch
// ---------------------------------------------------------------------------

test('active-local admission with no registration is detected', () => {
  const result = detectAdmissionWithoutRegistration({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({ includeWorkbench: false }),
    claudeJsonText: makeClaudeJson({ mcpServers: {} }),
    registry: makeRegistry({ workbenchStatus: 'active-local' })
  });
  assert.equal(result.key, 'admission-without-registration');
  assert.notEqual(result.value, 'none', `Expected a mismatch but got: ${result.value}`);
  assert.equal(result.level, 'warn');
});

// ---------------------------------------------------------------------------
// Test 2: active-local admission with matching registration → passes
// ---------------------------------------------------------------------------

test('active-local admission with matching registration passes', () => {
  const result = detectAdmissionWithoutRegistration({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({ includeWorkbench: true }),
    claudeJsonText: makeClaudeJson({ mcpServers: {} }),
    registry: makeRegistry({ workbenchStatus: 'active-local' })
  });
  assert.equal(result.key, 'admission-without-registration');
  assert.equal(result.value, 'none', `Expected none but got: ${result.value}`);
});

test('Claude project-scoped registration satisfies active-local discovery', () => {
  const claude = JSON.stringify({
    projects: {
      '/Users/user/project': { mcpServers: { workbench: { type: 'stdio', command: '/usr/bin/node', args: ['/repo/server.js'] } } }
    }
  });
  const result = detectAdmissionWithoutRegistration({
    fixtureOnly: true,
    codexTomlText: '',
    claudeJsonText: claude,
    registry: makeRegistry({ workbenchStatus: 'active-local' })
  });
  assert.equal(result.value, 'none');
});

test('Codex project-scoped registration satisfies active-local discovery', () => {
  const result = detectAdmissionWithoutRegistration({
    fixtureOnly: true,
    codexTomlText: '',
    codexProjectTomlText: makeCodexToml({ includeWorkbench: true }),
    claudeJsonText: makeClaudeJson({ mcpServers: {} }),
    registry: makeRegistry({ workbenchStatus: 'active-local' })
  });
  assert.equal(result.value, 'none');
});

// ---------------------------------------------------------------------------
// Test 3: candidate provider described as default in a document → detects it
// ---------------------------------------------------------------------------

test('candidate provider described as default is detected', () => {
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: {
      'some-doc': 'Codebase Memory is the default context memory provider for all Brain sessions.'
    },
    registry: makeRegistry({ cbmStatus: 'candidate' })
  });
  assert.equal(result.key, 'candidate-described-as-default');
  assert.notEqual(result.value, 'none', `Expected detection but got: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 4: retired b1_0a bridge present and enabled → detects it
// ---------------------------------------------------------------------------

test('retired b1_0a bridge present and enabled is detected', () => {
  const result = detectRetiredBridgeEnabled({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({ includeLegacyBridge: true, legacyBridgeEnabled: true })
  });
  assert.equal(result.key, 'retired-bridge-enabled');
  assert(result.value.includes('present and enabled'), `Expected present-and-enabled detection: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 5: retired b1_0a bridge present but disabled → no detection
// ---------------------------------------------------------------------------

test('retired b1_0a bridge present but disabled is not flagged', () => {
  const result = detectRetiredBridgeEnabled({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({ includeLegacyBridge: true, legacyBridgeEnabled: false })
  });
  assert.equal(result.key, 'retired-bridge-enabled');
  assert.equal(result.value, 'not-detected', `Expected not-detected but got: ${result.value}`);
});

// ---------------------------------------------------------------------------
// Test 6: Codebase Memory registered in Codex before B8.2 → detects premature registration
// ---------------------------------------------------------------------------

test('Codebase Memory registered before B8.2 acceptance is detected', () => {
  const result = detectPrematureCodebaseMemoryRegistration({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({ includeCodebaseMemory: true }),
    claudeJsonText: makeClaudeJson({ mcpServers: {} }),
    registry: makeRegistry({ cbmStatus: 'candidate' })
  });
  assert.equal(result.key, 'premature-codebase-memory-registration');
  assert(result.value.includes('registered'), `Expected registration detection: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 7: Workbench tools exceeding admitted scope → detects it
// ---------------------------------------------------------------------------

test('Workbench tools exceeding admitted scope is detected', () => {
  const result = detectWorkbenchScopeExceedance({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({
      includeWorkbench: true,
      workbenchTools: 'getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand,runUnapprovedTool',
      workbenchKinds: 'n8n_workflow_migration'
    }),
    registry: makeRegistry()
  });
  assert.equal(result.key, 'workbench-scope-exceedance');
  assert(result.value.includes('runUnapprovedTool'), `Expected unapproved tool detection: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 8: Workbench tools within admitted scope → passes
// ---------------------------------------------------------------------------

test('Workbench tools within admitted scope pass', () => {
  const result = detectWorkbenchScopeExceedance({
    fixtureOnly: true,
    codexTomlText: makeCodexToml({
      includeWorkbench: true,
      workbenchTools: 'getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand',
      workbenchKinds: 'n8n_workflow_migration'
    }),
    registry: makeRegistry()
  });
  assert.equal(result.key, 'workbench-scope-exceedance');
  assert.equal(result.value, 'within-admitted-scope', `Expected within-scope but got: ${result.value}`);
});

// ---------------------------------------------------------------------------
// Test 9: config containing a bare token value pattern → detects it
// ---------------------------------------------------------------------------

test('config with bare token value is detected', () => {
  const configWithToken = `[mcp_servers.workbench.env]
WORKBENCH_MCP_CREDENTIAL_FILE = "/Users/user/.credentials/workbench.token"
WORKBENCH_MCP_SOME_KEY = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
`;
  const result = detectBareCredentialInConfig({
    fixtureOnly: true,
    configTexts: { 'test-config': configWithToken }
  });
  assert.equal(result.key, 'bare-credential-in-config');
  assert(result.value.includes('credential-value-detected'), `Expected credential detection: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 10: config containing only env var references → passes
// ---------------------------------------------------------------------------

test('config with only env var references passes credential check', () => {
  const configWithEnvRef = `[mcp_servers.workbench.env]
WORKBENCH_MCP_CREDENTIAL_FILE = "/Users/user/.credentials/workbench.token"
WORKBENCH_MCP_ALLOWED_TOOLS = "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand"
`;
  const result = detectBareCredentialInConfig({
    fixtureOnly: true,
    configTexts: { 'test-config': configWithEnvRef }
  });
  assert.equal(result.key, 'bare-credential-in-config');
  assert.equal(result.value, 'none-detected', `Expected none-detected but got: ${result.value}`);
});

test('trusted SHA-256 allowlists and instruction text are not classified as credentials', () => {
  const nonSecretMetadata = `[mcp_servers.node_repl.env]
NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S = "${'a'.repeat(64)}"
NODE_REPL_INSTRUCTIONS_USE_CASE_CHROME = "${'read-only browser integration instructions '.repeat(4)}"
`;
  const result = detectBareCredentialInConfig({
    fixtureOnly: true,
    configTexts: { 'test-config': nonSecretMetadata }
  });
  assert.equal(result.value, 'none-detected');
});

test('long random values under ordinary env keys still fail closed', () => {
  const suspicious = `[mcp_servers.example.env]\nEXAMPLE_RUNTIME_VALUE = "${'x'.repeat(96)}"\n`;
  const result = detectBareCredentialInConfig({ fixtureOnly: true, configTexts: { suspicious } });
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 11: governance says frozen but scheduler is active → detects it
// ---------------------------------------------------------------------------

test('graphify scheduler active while governance is frozen is detected', () => {
  const result = detectGraphifySchedulerViolation({
    fixtureOnly: true,
    governanceJson: { deletionState: 'prohibited-before-retention-gate' },
    schedulerActive: true
  });
  assert.equal(result.key, 'graphify-scheduler-violation');
  assert(result.value.includes('scheduler active'), `Expected scheduler-active detection: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Test 12: governance says frozen and scheduler is inactive → passes
// ---------------------------------------------------------------------------

test('graphify frozen with inactive scheduler passes', () => {
  const result = detectGraphifySchedulerViolation({
    fixtureOnly: true,
    governanceJson: { deletionState: 'prohibited-before-retention-gate' },
    schedulerActive: false
  });
  assert.equal(result.key, 'graphify-scheduler-violation');
  // Result now contains structured state fields; must not be 'fail'
  assert.equal(result.level, 'info', `Expected info level (not fail), got: ${result.level} value=${result.value}`);
  assert(result.value.includes('graphify-structural-state='), `Expected structural-state in value: ${result.value}`);
});

// ---------------------------------------------------------------------------
// Bonus test 13: graphify false truth claim detection
// ---------------------------------------------------------------------------

test('graphify described as current architecture truth is detected', () => {
  const result = detectGraphifyFalseTruthClaim({
    fixtureOnly: true,
    docTexts: {
      'some-doc': 'Graphify is the current architecture truth for all Brain modules.'
    }
  });
  assert.equal(result.key, 'graphify-false-truth-claim');
  assert.notEqual(result.value, 'none-detected', `Expected detection but got: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Bonus test 14: codebase memory false default claim detection
// ---------------------------------------------------------------------------

test('codebase memory described as active while candidate is detected', () => {
  const result = detectCodebaseMemoryFalseDefaultClaim({
    fixtureOnly: true,
    docTexts: {
      'some-doc': 'Codebase Memory MCP is active and the default context memory provider.'
    },
    registry: makeRegistry({ cbmStatus: 'candidate' })
  });
  assert.equal(result.key, 'codebase-memory-false-default-claim');
  assert.notEqual(result.value, 'none-detected', `Expected detection but got: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Bonus test 15: clean fixture — all clear
// ---------------------------------------------------------------------------

test('clean fixture with no violations passes all checks', () => {
  const registry = makeRegistry({ workbenchStatus: 'active-local', cbmStatus: 'candidate' });
  const toml = makeCodexToml({ includeWorkbench: true, workbenchTools: 'getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand', workbenchKinds: 'n8n_workflow_migration', includeLegacyBridge: false });
  const claude = makeClaudeJson({ mcpServers: {} });
  const docs = { 'roadmap': 'P8 context-memory is planned. Graphify is quiesced. B8.1 is not complete.' };
  const gov = { deletionState: 'prohibited-before-retention-gate' };

  const r1 = detectAdmissionWithoutRegistration({ fixtureOnly: true, codexTomlText: toml, claudeJsonText: claude, registry });
  const r2 = detectCandidateDescribedAsDefault({ fixtureOnly: true, docTexts: docs, registry });
  const r3 = detectRetiredBridgeEnabled({ fixtureOnly: true, codexTomlText: toml });
  const r4 = detectPrematureCodebaseMemoryRegistration({ fixtureOnly: true, codexTomlText: toml, claudeJsonText: claude, registry });
  const r5 = detectWorkbenchScopeExceedance({ fixtureOnly: true, codexTomlText: toml, registry });
  const r6 = detectBareCredentialInConfig({ fixtureOnly: true, configTexts: { 'config': toml } });
  const r7 = detectGraphifySchedulerViolation({ fixtureOnly: true, governanceJson: gov, schedulerActive: false });
  const r8 = detectGraphifyFalseTruthClaim({ fixtureOnly: true, docTexts: docs });
  const r9 = detectCodebaseMemoryFalseDefaultClaim({ fixtureOnly: true, docTexts: docs, registry });

  const failures = [r1, r2, r3, r4, r5, r6, r7, r8, r9]
    .filter((r) => r.level === 'fail')
    .map((r) => `${r.key}=${r.value}`);

  assert.deepEqual(failures, [], `Unexpected failures in clean fixture: ${failures.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Import-safety regression tests (Task 1)
// ---------------------------------------------------------------------------

test('importing the module does not read real home config or print anything', async () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-mcp-rt-home-'));
  try {
    // Verify no .codex/config.toml and no .claude.json exist under fakeHome
    assert(!fs.existsSync(path.join(fakeHome, '.codex/config.toml')));
    assert(!fs.existsSync(path.join(fakeHome, '.claude.json')));

    // Dynamic import from a child process with overridden HOME
    const result = spawnSync('node', [
      '--input-type=module',
      '--eval',
      `import '${SCRIPT}'; process.exit(0);`,
    ], { encoding: 'utf8', env: { ...process.env, HOME: fakeHome } });

    assert.equal(result.status, 0, `Child exit should be 0, got ${result.status}\nstderr: ${result.stderr}`);
    assert.equal(result.stdout, '', `Import must produce no stdout, got: ${result.stdout}`);
    assert.equal(result.stderr, '', `Import must produce no stderr, got: ${result.stderr}`);

    // No home directory files should have been created
    const homeFiles = fs.readdirSync(fakeHome);
    assert.deepEqual(homeFiles, [], `Import must not create files in HOME, found: ${homeFiles}`);
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});

test('importing the module sets no exit code', async () => {
  const result = spawnSync('node', [
    '--input-type=module',
    '--eval',
    `import '${SCRIPT}'; console.log('exitCode=' + (process.exitCode ?? 'undefined'));`,
  ], { encoding: 'utf8', env: { ...process.env, HOME: '/tmp/fakehome' } });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /exitCode=undefined/);
});

// ---------------------------------------------------------------------------
// CLI exit-code matrix tests (Task 2)
// ---------------------------------------------------------------------------

test('--fixture-only clean fixture → exit 0', () => {
  const { exitCode, stdout } = runValidator(['--fixture-only']);
  assert.equal(exitCode, 0, `expected exit 0, got ${exitCode}\n${stdout}`);
  assert.match(stdout, /mcp-runtime-truth-check=pass/);
});

test('--fixture-scenario retired-bridge-enabled → exit 1', () => {
  const { exitCode, stdout } = runValidator(['--fixture-scenario', 'retired-bridge-enabled']);
  assert.equal(exitCode, 1, `expected exit 1, got ${exitCode}\n${stdout}`);
  assert.match(stdout, /mcp-runtime-truth-check=fail/);
});

test('--fixture-scenario premature-cbm-registration → exit 1', () => {
  const { exitCode, stdout } = runValidator(['--fixture-scenario', 'premature-cbm-registration']);
  assert.equal(exitCode, 1, `expected exit 1, got ${exitCode}\n${stdout}`);
  assert.match(stdout, /mcp-runtime-truth-check=fail/);
});

test('unknown --fixture-scenario → exit 2', () => {
  const { exitCode, stderr } = runValidator(['--fixture-scenario', 'nonexistent-scenario']);
  assert.equal(exitCode, 2, `expected exit 2, got ${exitCode}\n${stderr}`);
});

test('real-mode invocation against synthetic home without config → exit 0 (warn only)', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-mcp-rt-real-'));
  try {
    // No codex or claude config — real mode should run and warn, not crash
    const { exitCode, stdout } = runValidator(
      ['--admission-registry', path.join(REPO_ROOT, 'operations/specs/mcp-provider-admissions.json')],
      { HOME: fakeHome }
    );
    // warn → exit 0 without --strict
    assert(exitCode === 0 || exitCode === 1, `exit code must be 0 or 1, got ${exitCode}`);
    assert.match(stdout, /mcp-runtime-truth-check=/);
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});

test('--fixture-only with clean fixture passes no real home config is read', () => {
  // Using a guaranteed non-existent HOME to prove no real files touched
  const { exitCode, stdout } = runValidator(['--fixture-only'], { HOME: '/tmp/nosuchhome-brain-test' });
  assert.equal(exitCode, 0, `exit must be 0, got ${exitCode}\n${stdout}`);
  assert.match(stdout, /mcp-runtime-truth-check=pass/);
});

// ---------------------------------------------------------------------------
// Provider-root and provider-revision verification tests (Task 3)
// ---------------------------------------------------------------------------

import { detectProviderRevisionMismatch } from './validate-mcp-runtime-truth.mjs';

function makeRtRegistry({ revision = 'aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e' } = {}) {
  return {
    schemaVersion: '1.0.0',
    reviewedAt: '2026-08-02',
    admissions: [{
      admissionId: 'workbench-for-brain',
      status: 'candidate',
      transport: { serverName: 'workbench' },
      provider: {
        providerId: 'workbench',
        revision,
        entrypoint: 'src/server.js',
        artifacts: [
          { path: 'src/server.js', sha256: '' },
        ],
      },
    }],
  };
}

function makeGitProviderRoot({ revision: targetRevision, serverJsContent = 'console.log("server")' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-rt-provider-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/server.js'), serverJsContent);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'init'], { cwd: root });
  if (targetRevision) {
    // Use an arbitrary commit sha that won't match
    return { root, actualRevision: 'deadbeef00000000000000000000000000000000' };
  }
  const actualRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, actualRevision };
}

function makeExportedRoot({ serverJsContent = 'console.log("server")' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-rt-exported-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/server.js'), serverJsContent);
  // No .git directory — simulates git archive output
  return root;
}

test('detectProviderRevisionMismatch: no provider roots → not-verified info', async () => {
  const result = await detectProviderRevisionMismatch({ fixtureOnly: false, providerRoots: new Map(), registry: makeRtRegistry() });
  assert.equal(result.key, 'provider-revision-mismatch');
  assert.match(result.value, /not-verified/);
  assert.equal(result.level, 'info');
});

test('detectProviderRevisionMismatch: unknown provider id → fail', async () => {
  const root = makeExportedRoot();
  const roots = new Map([['unknown-provider', root]]);
  const revisions = new Map([['unknown-provider', 'aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e']]);
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, providerRevisions: revisions, registry: makeRtRegistry() });
    assert.equal(result.level, 'fail', `expected fail, got: ${JSON.stringify(result)}`);
    assert.match(result.value, /unknown-provider-id/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detectProviderRevisionMismatch: non-git root without explicit revision → fail', async () => {
  const root = makeExportedRoot();
  const roots = new Map([['workbench', root]]);
  const revision = 'aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e';
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, registry: makeRtRegistry({ revision }) });
    assert.equal(result.level, 'fail');
    assert.match(result.value, /non-git-root-requires-explicit-provider-revision/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detectProviderRevisionMismatch: non-git root with mismatched explicit revision → fail', async () => {
  const root = makeExportedRoot();
  const roots = new Map([['workbench', root]]);
  const revision = 'aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e';
  const revisions = new Map([['workbench', 'wrongrevision000000000000000000000000000']]);
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, providerRevisions: revisions, registry: makeRtRegistry({ revision }) });
    assert.equal(result.level, 'fail');
    assert.match(result.value, /explicit-revision-mismatch/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detectProviderRevisionMismatch: non-git root with correct revision and matching artifacts → pass', async () => {
  const content = 'console.log("server")';
  const root = makeExportedRoot({ serverJsContent: content });
  const { createHash } = await import('node:crypto');
  const sha256 = createHash('sha256').update(content).digest('hex');
  const revision = 'aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e';
  const registry = makeRtRegistry({ revision });
  registry.admissions[0].provider.artifacts[0].sha256 = sha256;
  const roots = new Map([['workbench', root]]);
  const revisions = new Map([['workbench', revision]]);
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, providerRevisions: revisions, registry });
    assert.equal(result.level, 'info', `expected pass, got: ${JSON.stringify(result)}`);
    // Value now uses structured output from shared module
    assert.match(result.value, /providers_source_verified=1/, `expected source_verified in value: ${result.value}`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detectProviderRevisionMismatch: git root with mismatched HEAD → fail', async () => {
  const { root } = makeGitProviderRoot();
  const roots = new Map([['workbench', root]]);
  const revision = 'wrongrevision000000000000000000000000000a';
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, registry: makeRtRegistry({ revision }) });
    assert.equal(result.level, 'fail');
    assert.match(result.value, /revision-mismatch/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detectProviderRevisionMismatch: git root with matching HEAD and digest → pass', async () => {
  const content = 'console.log("server")';
  const { root, actualRevision } = makeGitProviderRoot({ serverJsContent: content });
  const { createHash } = await import('node:crypto');
  const sha256 = createHash('sha256').update(content).digest('hex');
  const registry = makeRtRegistry({ revision: actualRevision });
  registry.admissions[0].provider.artifacts[0].sha256 = sha256;
  const roots = new Map([['workbench', root]]);
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, registry });
    assert.equal(result.level, 'info', `expected pass, got: ${JSON.stringify(result)}`);
    // Value now uses structured output from shared module
    assert.match(result.value, /providers_source_verified=1/, `expected source_verified in value: ${result.value}`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detectProviderRevisionMismatch: working-tree-only entrypoint → fail with runtime-entrypoint-unverified', async () => {
  const content = 'console.log("server")';
  const { root, actualRevision } = makeGitProviderRoot({ serverJsContent: content });
  const { createHash } = await import('node:crypto');
  const sha256 = createHash('sha256').update(content).digest('hex');
  const registry = makeRtRegistry({ revision: actualRevision });
  // Mark the entrypoint artifact as working-tree-only
  registry.admissions[0].provider.artifacts[0].note = 'sourceState: working-tree-only — gitignored';
  registry.admissions[0].provider.artifacts[0].sha256 = sha256;
  const roots = new Map([['workbench', root]]);
  try {
    const result = await detectProviderRevisionMismatch({ providerRoots: roots, registry });
    assert.equal(result.level, 'fail', `expected fail, got: ${JSON.stringify(result)}`);
    assert.match(result.value, /runtime-entrypoint-unverified/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// Task 2 — False positive regression tests for detectCandidateDescribedAsDefault
// and detectCodebaseMemoryFalseDefaultClaim
// Exact sentences from the roadmap and implementation-plan that were being
// falsely flagged.
// ---------------------------------------------------------------------------

test('detectCandidateDescribedAsDefault: roadmap future-deliverable bullet does not trigger', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  // Exact text from operations/specs/infinite-brain-runtime-roadmap.md line 168
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: {
      'roadmap': 'Codebase Memory MCP as the default structural code-memory layer for active repositories;'
    },
    registry,
  });
  assert.equal(result.key, 'candidate-described-as-default');
  assert.equal(result.value, 'none', `Expected none (no false positive), got: ${result.value}`);
});

test('detectCandidateDescribedAsDefault: "B8.2 decides whether Codebase Memory becomes the default" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'roadmap': 'B8.2 decides whether Codebase Memory becomes the default.' },
    registry,
  });
  assert.equal(result.value, 'none', `Expected none, got: ${result.value}`);
});

test('detectCandidateDescribedAsDefault: "Default activation requires explicit approval" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'plan': 'Default activation requires explicit approval.' },
    registry,
  });
  assert.equal(result.value, 'none', `Expected none, got: ${result.value}`);
});

test('detectCandidateDescribedAsDefault: "Codebase Memory is a candidate for the future default" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'plan': 'Codebase Memory is a candidate for the future default.' },
    registry,
  });
  assert.equal(result.value, 'none', `Expected none, got: ${result.value}`);
});

test('detectCandidateDescribedAsDefault: "The planned deliverable is a measured structural default" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'plan': 'The planned deliverable is a measured structural default.' },
    registry,
  });
  assert.equal(result.value, 'none', `Expected none, got: ${result.value}`);
});

test('detectCandidateDescribedAsDefault: "Codebase Memory is not active" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'plan': 'Codebase Memory is not active.' },
    registry,
  });
  assert.equal(result.value, 'none', `Expected none, got: ${result.value}`);
});

test('detectCandidateDescribedAsDefault: "Codebase Memory is the default structural provider" → FAILS', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'plan': 'Codebase Memory is the default structural provider.' },
    registry,
  });
  assert.notEqual(result.value, 'none', `Expected detection, got: ${result.value}`);
  assert.equal(result.level, 'fail');
});

test('detectCandidateDescribedAsDefault: "Default activation is complete" → FAILS', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCandidateDescribedAsDefault({
    fixtureOnly: true,
    docTexts: { 'plan': 'Codebase Memory default activation is complete.' },
    registry,
  });
  assert.notEqual(result.value, 'none', `Expected detection, got: ${result.value}`);
  assert.equal(result.level, 'fail');
});

test('detectCodebaseMemoryFalseDefaultClaim: "No default activation is authorized" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCodebaseMemoryFalseDefaultClaim({
    fixtureOnly: true,
    docTexts: { 'plan': 'No default activation is authorized.' },
    registry,
  });
  assert.equal(result.value, 'none-detected', `Expected none-detected, got: ${result.value}`);
});

test('detectCodebaseMemoryFalseDefaultClaim: "Codebase Memory is not active" → no false positive', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCodebaseMemoryFalseDefaultClaim({
    fixtureOnly: true,
    docTexts: { 'plan': 'Codebase Memory is not active.' },
    registry,
  });
  assert.equal(result.value, 'none-detected', `Expected none-detected, got: ${result.value}`);
});

test('detectCodebaseMemoryFalseDefaultClaim: "Codebase Memory MCP is enabled for all Brain clients" → FAILS', () => {
  const registry = makeRegistry({ cbmStatus: 'candidate' });
  const result = detectCodebaseMemoryFalseDefaultClaim({
    fixtureOnly: true,
    docTexts: { 'plan': 'Codebase Memory MCP is enabled for all Brain clients.' },
    registry,
  });
  assert.notEqual(result.value, 'none-detected', `Expected detection, got: ${result.value}`);
  assert.equal(result.level, 'fail');
});

// ---------------------------------------------------------------------------
// Task 3 — Graphify runtime-truth evaluation with real nested governance
// ---------------------------------------------------------------------------

test('detectGraphifySchedulerViolation: nested governance frozen-pending-migration → frozen', () => {
  const nestedGovernance = {
    states: {
      structuralCodeIndexing: { state: 'frozen-pending-migration', schedulerGate: 'skipping job=graphify-nightly reason=bs0-15-pending-containment' },
      semanticSynthesis: { state: 'retained-inactive' },
      deletion: { state: 'prohibited-before-retention-gate' },
    },
    migrationPath: { globalActivationStatus: 'not-active' },
  };
  const result = detectGraphifySchedulerViolation({
    fixtureOnly: true,
    governanceJson: nestedGovernance,
    schedulerActive: false,
  });
  assert.equal(result.key, 'graphify-scheduler-violation');
  assert.equal(result.level, 'info', `Expected info, got: ${result.level} value=${result.value}`);
  assert(result.value.includes('graphify-structural-state=frozen'), `Expected frozen: ${result.value}`);
  assert(result.value.includes('graphify-scheduler-gate=skip-enforced'), `Expected skip-enforced: ${result.value}`);
  assert(result.value.includes('graphify-process=not-observed'), `Expected not-observed: ${result.value}`);
});

test('detectGraphifySchedulerViolation: B8.5 semantic gate preserves structural freeze', () => {
  const governance = {
    states: {
      structuralCodeIndexing: { state: 'frozen-structural-replaced-by-cbm', schedulerGate: 'tools/scripts/office-nightly-scheduler.sh — event-driven semantic gate only; legacy structural graphify-nightly.sh not scheduled' },
      semanticSynthesis: { state: 'bounded-event-driven-active' },
      deletion: { state: 'prohibited-before-retention-gate' },
    },
    migrationPath: { globalActivationStatus: 'not-active' },
  };
  const result = detectGraphifySchedulerViolation({ fixtureOnly: true, governanceJson: governance, schedulerActive: false });
  assert.equal(result.level, 'info');
  assert(result.value.includes('graphify-structural-state=frozen'));
  assert(result.value.includes('graphify-semantic-state=bounded-event-driven-active'));
  assert(result.value.includes('graphify-scheduler-gate=semantic-event-enforced'));
});

test('detectGraphifySchedulerViolation: nested governance frozen + scheduler active → fail', () => {
  const nestedGovernance = {
    states: {
      structuralCodeIndexing: { state: 'frozen-pending-migration', schedulerGate: 'skipping job=graphify-nightly' },
      deletion: { state: 'prohibited-before-retention-gate' },
    },
    migrationPath: { globalActivationStatus: 'not-active' },
  };
  const result = detectGraphifySchedulerViolation({
    fixtureOnly: true,
    governanceJson: nestedGovernance,
    schedulerActive: true,
  });
  assert.equal(result.level, 'fail', `Expected fail: ${result.value}`);
  assert(result.value.includes('scheduler active'), `Expected scheduler active: ${result.value}`);
});

test('detectGraphifySchedulerViolation: fixture mode uses correct nested governance from FIXTURE constant', () => {
  // Test that the fixture constant itself uses the nested schema
  const result = detectGraphifySchedulerViolation({ fixtureOnly: true, schedulerActive: false });
  assert.equal(result.level, 'info', `Expected info: ${result.value}`);
  assert(result.value.includes('graphify-structural-state=frozen'), `Expected frozen in fixture: ${result.value}`);
});

test('module import is safe when process.argv[1] does not exist', () => {
  const scriptUrl = `file://${SCRIPT}`;
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    `process.argv[1]='/definitely/missing/entrypoint.mjs'; await import(${JSON.stringify(scriptUrl)});`,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
