/**
 * validate-mcp-runtime-truth.test.mjs
 *
 * Tests for the MCP runtime-truth validator. All tests use only fixture data —
 * no real credential files, ~/.codex/config.toml, or ~/.claude.json are read.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

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
  assert.equal(result.value, 'frozen-scheduler-inactive', `Expected frozen-scheduler-inactive: ${result.value}`);
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
