import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {PassThrough} from 'node:stream';
import {callProviderTool, loadProviderConfig, providerHealth, providerResolve, PROVIDER_LIMITS, TOOL_DEFINITIONS} from '../src/provider/runtime.mjs';
import {handleMessage, serializeBoundedResponse, startServer} from '../src/provider/server.mjs';

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
}

function write(file, content, mode) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, mode ? {mode} : undefined);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-context-provider-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  write(path.join(root, 'system', 'current.md'), '# Current Context\nThe current provider state is ready.\n');
  write(path.join(root, 'projects', 'alpha.md'), '# Alpha\nProject alpha is active.\n');
  write(path.join(root, '.obsidian', 'plugins', 'unsafe', 'main.md'), '# Plugin Internals\n');
  write(path.join(root, 'archive', 'old.md'), '# Archived\n');
  write(path.join(root, 'system', 'credentials.md'), '# Secret marker\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'fixture']);
  const head = git(root, ['rev-parse', 'HEAD']);
  const preparationApproval = path.join(root, 'preparation-approval.json');
  write(preparationApproval, `${JSON.stringify({approved: true, approvedBy: 'Steve Westhoek', approvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), approvalId: 'test-preparation', scope: 'mind-context-preparation', providerRevision: 'a'.repeat(40), mindCommit: head, allowedScopes: ['projects', 'system']})}\n`, 0o600);
  const env = {
    MIND_CONTEXT_ROOT: root,
    MIND_CONTEXT_ALLOWED_SCOPES: 'projects,system',
    MIND_CONTEXT_PROVIDER_REVISION: 'a'.repeat(40),
    MIND_CONTEXT_EXPECTED_HEAD: head,
    MIND_CONTEXT_PREPARATION_MODE: '1',
    MIND_CONTEXT_PREPARATION_APPROVAL_FILE: preparationApproval,
    MIND_CONTEXT_ALLOWED_TOOLS: 'mind_context_health,mind_context_resolve,mind_context_explain',
    MIND_CONTEXT_ALLOWED_SUBOPERATIONS: '',
  };
  return {root, head, env, config: loadProviderConfig(env)};
}

test('provider is fixed-scope, read-only, credential-free, and excludes private internals', () => {
  const x = fixture();
  write(path.join(x.root, 'private', 'out-of-scope.md'), `# Out of scope\n${'x'.repeat(PROVIDER_LIMITS.maxSourceBytes)}`);
  const health = providerHealth(x.config);
  assert.equal(health.healthy, true);
  assert.equal(health.fixtureOnly, false);
  assert.equal(health.mutationPathExposed, false);
  assert.equal(health.authentication.credentialRequired, false);
  assert.equal(health.source.sourceCount, 2);
  assert(TOOL_DEFINITIONS.every((tool) => tool.annotations.readOnlyHint === true));
  assert.deepEqual(TOOL_DEFINITIONS.map((tool) => tool.name), ['mind_context_health', 'mind_context_resolve', 'mind_context_explain']);
});

test('provider hashes real source bytes and fails closed on working-tree drift', () => {
  const x = fixture();
  const first = providerResolve(x.config, {query: 'current provider state'});
  const firstHash = first.sources[0].sha256;
  const firstCorpus = providerHealth(x.config).source.corpusSha256;
  fs.appendFileSync(path.join(x.root, 'system', 'current.md'), 'Updated now.\n');
  const changedSource = providerHealth(x.config).source;
  assert.equal(changedSource.workingChangesInScope, 1);
  assert.deepEqual(changedSource.workingChangePaths, ['system/current.md']);
  assert.equal(changedSource.corpusSha256, null);
  assert.throws(() => providerResolve(x.config, {query: 'current provider state'}), /source_worktree_not_clean/);
  assert.equal(typeof firstHash, 'string');
  assert.equal(typeof firstCorpus, 'string');
});

test('caller cannot override root, scopes, or request mutation-like inputs', () => {
  const x = fixture();
  for (const forbidden of ['root', 'scopes', 'mutationLike', 'requestCredentials', 'externalCall']) {
    assert.throws(() => providerResolve(x.config, {query: 'x', [forbidden]: forbidden === 'scopes' ? ['.'] : true}), new RegExp(`forbidden_tool_argument:${forbidden}`));
  }
});

test('source revision drift and core unavailability fail closed with manual fallback', () => {
  const x = fixture();
  write(path.join(x.root, 'system', 'new.md'), '# New\n');
  git(x.root, ['add', '.']);
  git(x.root, ['commit', '-qm', 'new head']);
  assert.throws(() => providerResolve(x.config, {query: 'x'}), /source_revision_mismatch/);
  const disabled = fixture();
  const previous = process.env.MIND_CONTEXT_CORE_DISABLED;
  process.env.MIND_CONTEXT_CORE_DISABLED = '1';
  try {
    const health = providerHealth(disabled.config);
    assert.equal(health.coreAvailable, false);
    assert.equal(health.fallback.mode, 'manual-targeted-read');
    assert.equal(health.fallback.automaticFallback, false);
    assert.throws(() => providerResolve(disabled.config, {query: 'x'}), /core_unavailable/);
  } finally {
    if (previous === undefined) delete process.env.MIND_CONTEXT_CORE_DISABLED;
    else process.env.MIND_CONTEXT_CORE_DISABLED = previous;
  }
});

test('activation fails closed without Steve approval and accepts an owner-only bound approval file', () => {
  const x = fixture();
  const activeEnv = {...x.env, MIND_CONTEXT_PREPARATION_MODE: '0'};
  assert.throws(() => loadProviderConfig(activeEnv), /activation_approval_file_required/);
  const approval = path.join(x.root, 'approval.json');
  write(approval, `${JSON.stringify({approved: true, approvedBy: 'Steve Westhoek', approvedAt: '2026-08-04T00:00:00.000Z', approvalId: 'test-approval', scope: 'mind-context-read-only', providerRevision: 'a'.repeat(40), mindCommit: x.head, allowedScopes: ['projects', 'system']})}\n`, 0o600);
  const config = loadProviderConfig({...activeEnv, MIND_CONTEXT_ACTIVATION_APPROVAL_FILE: approval});
  assert.equal(config.activationState, 'active-local-approved');
  fs.chmodSync(approval, 0o644);
  assert.throws(() => loadProviderConfig({...activeEnv, MIND_CONTEXT_ACTIVATION_APPROVAL_FILE: approval}), /owner_only/);
});

test('activation approval is bound to the exact Mind commit and scopes', () => {
  const x = fixture();
  const approval = path.join(x.root, 'approval.json');
  const base = {approved: true, approvedBy: 'Steve Westhoek', approvedAt: '2026-08-04T00:00:00.000Z', approvalId: 'test-approval', scope: 'mind-context-read-only', providerRevision: 'a'.repeat(40), mindCommit: x.head, allowedScopes: ['projects', 'system']};
  write(approval, `${JSON.stringify({...base, mindCommit: 'b'.repeat(40)})}\n`, 0o600);
  assert.throws(() => loadProviderConfig({...x.env, MIND_CONTEXT_PREPARATION_MODE: '0', MIND_CONTEXT_ACTIVATION_APPROVAL_FILE: approval}), /activation_approval_invalid/);
  write(approval, `${JSON.stringify({...base, allowedScopes: ['system']})}\n`, 0o600);
  assert.throws(() => loadProviderConfig({...x.env, MIND_CONTEXT_PREPARATION_MODE: '0', MIND_CONTEXT_ACTIVATION_APPROVAL_FILE: approval}), /activation_approval_invalid/);
});

test('preparation mode fails closed without a short-lived bound approval', () => {
  const x = fixture();
  assert.throws(() => loadProviderConfig({...x.env, MIND_CONTEXT_PREPARATION_APPROVAL_FILE: undefined}), /activation_approval_file_required/);
  const expired = path.join(x.root, 'expired-preparation.json');
  write(expired, `${JSON.stringify({approved: true, approvedBy: 'Steve Westhoek', approvedAt: '2026-08-04T00:00:00.000Z', expiresAt: '2026-08-04T00:30:00.000Z', approvalId: 'expired-preparation', scope: 'mind-context-preparation', providerRevision: 'a'.repeat(40), mindCommit: x.head, allowedScopes: ['projects', 'system']})}\n`, 0o600);
  assert.throws(() => loadProviderConfig({...x.env, MIND_CONTEXT_PREPARATION_APPROVAL_FILE: expired}), /activation_approval_invalid/);
});

test('provider enforces corpus and stdio request byte bounds', async () => {
  const x = fixture();
  write(path.join(x.root, 'system', 'large.md'), `# Large\n${'x'.repeat(PROVIDER_LIMITS.maxSourceBytes)}`);
  git(x.root, ['add', 'system/large.md']);
  git(x.root, ['commit', '-qm', 'large source']);
  assert.throws(() => providerHealth(x.config), /source_bytes_cap_exceeded/);

  const bounded = fixture();
  const input = new PassThrough();
  const output = new PassThrough();
  let responseText = '';
  output.on('data', (chunk) => { responseText += chunk.toString(); });
  const server = startServer({env: bounded.env, input, output});
  input.write('x'.repeat(PROVIDER_LIMITS.maxRequestBytes + 1));
  await new Promise((resolve) => setImmediate(resolve));
  input.write('\n');
  server.close();
  assert.match(responseText, /Request exceeds admitted byte limit/);
  assert.match(serializeBoundedResponse({jsonrpc: '2.0', id: 9, result: 'x'.repeat(PROVIDER_LIMITS.maxResponseBytes)}), /Response exceeds admitted byte limit/);
});

test('explain returns a bounded ranking for a large admitted corpus', () => {
  const x = fixture();
  for (let index = 0; index < 600; index += 1) {
    write(path.join(x.root, 'projects', `source-${String(index).padStart(3, '0')}.md`), `# Source ${index}\nCurrent context source ${index}.\n`);
  }
  git(x.root, ['add', 'projects']);
  git(x.root, ['commit', '-qm', 'large explain corpus']);
  const head = git(x.root, ['rev-parse', 'HEAD']);
  const approval = JSON.parse(fs.readFileSync(x.env.MIND_CONTEXT_PREPARATION_APPROVAL_FILE, 'utf8'));
  approval.mindCommit = head;
  write(x.env.MIND_CONTEXT_PREPARATION_APPROVAL_FILE, `${JSON.stringify(approval)}\n`, 0o600);
  const config = loadProviderConfig({...x.env, MIND_CONTEXT_EXPECTED_HEAD: head});
  const explanation = callProviderTool(config, 'mind_context_explain', {query: 'current context', maxItems: 3, maxTokens: 800});
  assert.equal(explanation.ranking.length, 3);
  assert.equal(explanation.rankingReturned, 3);
  assert.equal(explanation.rankingTotal, 602);
  assert.equal(explanation.rankingTruncated, true);
  const response = serializeBoundedResponse({jsonrpc: '2.0', id: 10, result: explanation});
  assert.doesNotMatch(response, /Response exceeds admitted byte limit/);
});

test('MCP protocol exposes only the admitted read tools and returns live health/readback', () => {
  const x = fixture();
  const init = handleMessage(x.config, {jsonrpc: '2.0', id: 1, method: 'initialize', params: {}});
  assert.equal(init.result.serverInfo.name, 'mind-context');
  const list = handleMessage(x.config, {jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}});
  assert.equal(list.result.tools.length, 3);
  const readback = handleMessage(x.config, {jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'mind_context_resolve', arguments: {query: 'alpha'}}});
  assert.equal(readback.result.isError, false);
  assert.equal(readback.result.structuredContent.state.observed, 'live-readback');
  assert.equal(readback.result.structuredContent.state.deployed, 'not-installed');
  const mutation = handleMessage(x.config, {jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'write_file', arguments: {}}});
  assert.equal(mutation.result.isError, true);
  assert.equal(mutation.result.structuredContent.code, 'tool_not_admitted');
});

test('health tool rejects arguments', () => {
  const x = fixture();
  assert.throws(() => callProviderTool(x.config, 'mind_context_health', {root: '/'}), /health_arguments_forbidden/);
});
