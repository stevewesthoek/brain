import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';
import { createGitHubProviderAdapter, GITHUB_VERIFIER_ID, GITHUB_VERIFIER_SCRIPT } from './github-provider-adapter.mjs';
import { createMacOSKeychainAdapterForTesting } from './macos-keychain-adapter.mjs';
import { verifyCredential } from './credential-verification-boundary.mjs';
import {
  GITHUB_API_ORIGIN,
  GITHUB_API_VERSION,
  GITHUB_MAX_RESPONSE_BYTES,
  requestGitHubUserForTestOnly,
  verifyGitHubCredential,
} from './github-provider-verifier.mjs';

const CANARY = 'github-test-token-canary-never-observable';
const GITHUB_CLI_SCRIPT = new URL('./github-credential-verification-cli.mjs', import.meta.url).pathname;

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    return await callback({ origin, server });
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

function localRequest(origin, timeoutOptions = {}) {
  return (token) => requestGitHubUserForTestOnly({ token, origin, ...timeoutOptions });
}

function assertSafeResult(result) {
  assert.equal(JSON.stringify(result).includes(CANARY), false);
  assert.ok(result.transportCheck === undefined || result.transportCheck === 'stdin_only');
  assert.equal(result.headers, undefined);
  assert.equal(result.body, undefined);
}

test('GitHub provider adapter emits only the fixed registered verifier command', () => {
  const adapter = createGitHubProviderAdapter({ credentialType: 'fine_grained_pat' });
  const invocation = adapter.buildVerificationInvocation({ expectedPrincipalRef: '123', requiredScopes: [] });
  assert.equal(adapter.adapterId, 'github');
  assert.equal(adapter.verifierId, GITHUB_VERIFIER_ID);
  assert.equal(invocation.verifierId, GITHUB_VERIFIER_ID);
  assert.equal(invocation.executable, process.execPath);
  assert.deepEqual(invocation.args, [GITHUB_VERIFIER_SCRIPT, '--credential-type', 'fine_grained_pat']);
  assert.equal(invocation.args.some((value) => value.includes(CANARY)), false);
});

test('verification CLI rejects raw-token and arbitrary-endpoint inputs', () => {
  const result = spawnSync(process.execPath, [
    GITHUB_CLI_SCRIPT,
    '--credential-id', 'credential:github.account.01',
    '--credential-ref', 'https://evil.example.invalid/token',
    '--expected-principal', '123456',
    '--credential-type', 'classic_pat',
    '--token', CANARY,
  ], { cwd: '/', encoding: 'utf8' });
  assert.equal(result.status, 64);
  assert.equal(result.stdout.includes(CANARY), false);
  assert.equal(result.stderr.includes(CANARY), false);
});

test('GitHub invocation is admitted only by the fixed Keychain verifier registry', { skip: process.platform !== 'darwin' }, async () => {
  const calls = [];
  const providerAdapter = createGitHubProviderAdapter({ credentialType: 'classic_pat' });
  const invocation = providerAdapter.buildVerificationInvocation({ expectedPrincipalRef: '123456', requiredScopes: [] });
  const keychainAdapter = createMacOSKeychainAdapterForTesting({
    runProbe: async (args) => args[0] === '--availability' ? { status: 0, token: 'available' } : { status: 0, token: 'present' },
    runBoundary: async (args) => {
      calls.push(args);
      return {
        status: 0,
        output: JSON.stringify({
          boundaryState: 'provider_result',
          resultCode: 'accepted',
          providerId: 'github',
          providerCredentialType: 'classic_pat',
          principal: '123456',
          principalLabel: 'alice',
          scopeEvidence: 'provider_observed',
          scopes: ['repo'],
          transportCheck: 'stdin_only',
        }),
      };
    },
  });
  const result = await keychainAdapter.invokeBoundedVerification({
    reference: 'keychain-ref://com.brain.identity-access.github/github.account.01',
    verifierId: invocation.verifierId,
    verifierExecutable: invocation.executable,
    verifierArgs: invocation.args,
  });
  assert.equal(result.boundaryState, 'provider_result');
  assert.equal(result.providerId, 'github');
  assert.deepEqual(calls, [[
    'com.brain.identity-access.github',
    'github.account.01',
    process.execPath,
    JSON.stringify(invocation.args),
  ]]);
  assert.equal(JSON.stringify(result).includes(CANARY), false);
});

test('200 returns only stable principal/display metadata and observed OAuth scopes', async () => {
  await withServer((request, response) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, '/user');
    assert.equal(request.headers.authorization, `Bearer ${CANARY}`);
    response.writeHead(200, {
      'content-type': 'application/json',
      'x-oauth-scopes': 'repo, user',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': '1893456000',
    });
    response.end(JSON.stringify({ id: 123456, login: 'alice', email: 'private@example.invalid', token: CANARY, bio: 'not retained' }));
  }, async ({ origin }) => {
    const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'classic_pat', request: localRequest(origin) });
    assert.equal(result.resultCode, 'accepted');
    assert.equal(result.providerId, 'github');
    assert.equal(result.providerCredentialType, 'classic_pat');
    assert.equal(result.principal, '123456');
    assert.equal(result.principalLabel, 'alice');
    assert.deepEqual(result.scopes, ['repo', 'user']);
    assert.equal(result.scopeEvidence, 'provider_observed');
    assert.deepEqual(result.rateLimit, { limit: 5000, remaining: 4999, resetAt: '2030-01-01T00:00:00.000Z' });
    assertSafeResult(result);
  });
});

test('wrong stable principal becomes wrong_account without using a mutable login as identity', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: 222222, login: 'renamed-account' }));
  }, async ({ origin }) => {
    const providerResult = await verifyGitHubCredential({ token: CANARY, credentialType: 'fine_grained_pat', request: localRequest(origin) });
    const observation = await verifyCredential({
      credentialId: 'credential:github.account.01',
      credentialRef: 'keychain-ref://com.brain.identity-access.github/github.account.01',
      expectedPrincipal: { principalType: 'provider_account', principalRef: '111111', displayLabel: 'expected-account', matchStrategy: 'provider_asserted_id' },
      verificationPolicy: { probeMode: 'read_only', readOnlyOnly: true, requiredScopes: [] },
      providerAdapter: { buildVerificationInvocation: () => ({ verifierId: GITHUB_VERIFIER_ID, executable: process.execPath, args: [GITHUB_VERIFIER_SCRIPT, '--credential-type', 'fine_grained_pat'] }) },
      secretStoreAdapter: { invokeBoundedVerification: async () => ({ boundaryState: 'provider_result', ...providerResult }) },
      now: '2030-01-01T00:00:00Z',
    });
    assert.equal(observation.detailedState, 'wrong_account');
    assert.equal(observation.normalizedStatus, 'unhealthy');
    assert.equal(observation.observedPrincipalRef, '222222');
    assert.equal(observation.observedPrincipalLabel, 'renamed-account');
    assertSafeResult(observation);
  });
});

test('401 is conservative authentication rejection, not automatic revocation', async () => {
  await withServer((request, response) => {
    response.writeHead(401, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'Bad credentials', token: CANARY }));
  }, async ({ origin }) => {
    const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'classic_pat', request: localRequest(origin) });
    assert.equal(result.resultCode, 'rejected');
    assert.equal(result.reasonCode, 'provider_authentication_failed');
    assertSafeResult(result);
  });
});

test('403 permission-like, rate-limit-like, and SSO policy responses remain distinct', async () => {
  const cases = [
    [{}, 'unknown', 'provider_forbidden'],
    [{ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1893456000' }, 'provider_unavailable', 'provider_rate_limited'],
    [{ 'x-github-sso': 'required; url=https://github.example.invalid/authorize' }, 'reauthentication_required', 'provider_policy_required'],
  ];
  for (const [headers, resultCode, reasonCode] of cases) {
    await withServer((request, response) => {
      response.writeHead(403, { 'content-type': 'application/json', ...headers });
      response.end(JSON.stringify({ message: 'not retained', token: CANARY }));
    }, async ({ origin }) => {
      const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'classic_pat', request: localRequest(origin) });
      assert.equal(result.resultCode, resultCode);
      assert.equal(result.reasonCode, reasonCode);
      assertSafeResult(result);
    });
  }
});

test('429 and 5xx are provider-unavailable without retries', async () => {
  for (const [statusCode, responseHeaders, reasonCode] of [
    [429, { 'retry-after': '60' }, 'provider_rate_limited'],
    [503, {}, 'provider_network_failed'],
  ]) {
    let requests = 0;
    await withServer((request, response) => {
      requests += 1;
      response.writeHead(statusCode, { 'content-type': 'application/json', ...responseHeaders });
      response.end(JSON.stringify({ message: 'temporary', token: CANARY }));
    }, async ({ origin }) => {
      const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'oauth_access_token', request: localRequest(origin) });
      assert.equal(result.resultCode, 'provider_unavailable');
      assert.equal(result.reasonCode, reasonCode);
      assert.equal(requests, 1);
      assertSafeResult(result);
    });
  }
});

test('malformed, oversized, unexpected, and principal-less responses fail closed', async () => {
  const cases = [
    { statusCode: 200, body: '{not-json' },
    { statusCode: 200, body: 'x'.repeat(GITHUB_MAX_RESPONSE_BYTES + 1) },
    { statusCode: 200, headers: { 'content-type': 'text/html' }, body: JSON.stringify({ id: 123, login: 'alice' }) },
    { statusCode: 204, body: '' },
    { statusCode: 200, body: JSON.stringify({ login: 'alice' }) },
  ];
  for (const { statusCode, headers = { 'content-type': 'application/json' }, body } of cases) {
    await withServer((request, response) => {
      response.writeHead(statusCode, headers);
      response.end(body);
    }, async ({ origin }) => {
      const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'fine_grained_pat', request: localRequest(origin) });
      assert.equal(result.resultCode, 'unknown');
      assert.match(result.reasonCode, /^provider_response_/);
      assertSafeResult(result);
    });
  }
});

test('unexpected redirect is rejected and Authorization never reaches another origin', async () => {
  let captureRequests = 0;
  await withServer((request, response) => {
    if (request.url === '/capture') {
      captureRequests += 1;
      assert.equal(request.headers.authorization, undefined);
      response.writeHead(200);
      response.end('{}');
      return;
    }
    response.writeHead(302, { location: `http://${request.headers.host}/capture` });
    response.end();
  }, async ({ origin }) => {
    const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'classic_pat', request: localRequest(origin) });
    assert.equal(result.resultCode, 'unknown');
    assert.equal(result.reasonCode, 'provider_redirect_rejected');
    assert.equal(captureRequests, 0);
    assertSafeResult(result);
  });
});

test('request timeout is bounded and does not retry', async () => {
  let requests = 0;
  await withServer((request, response) => {
    requests += 1;
    setTimeout(() => response.end('{}'), 100);
  }, async ({ origin }) => {
    const result = await verifyGitHubCredential({
      token: CANARY,
      credentialType: 'fine_grained_pat',
      request: localRequest(origin, { requestTimeoutMs: 25, overallTimeoutMs: 50 }),
    });
    assert.equal(result.resultCode, 'provider_unavailable');
    assert.equal(result.reasonCode, 'provider_timeout');
    assert.equal(requests, 1);
    assertSafeResult(result);
  });
});

test('fine-grained permissions and expiry remain explicitly unobservable from GET /user', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: 777777, login: 'fine-grained-user' }));
  }, async ({ origin }) => {
    const providerResult = await verifyGitHubCredential({ token: CANARY, credentialType: 'fine_grained_pat', request: localRequest(origin) });
    assert.equal(providerResult.scopeEvidence, 'not_observable');
    assert.equal(providerResult.expiryMetadataSource, 'unknown');
    const observation = await verifyCredential({
      credentialId: 'credential:github.account.02',
      credentialRef: 'keychain-ref://com.brain.identity-access.github/github.account.02',
      expectedPrincipal: { principalType: 'provider_account', principalRef: '777777', displayLabel: 'fine-grained-user', matchStrategy: 'provider_asserted_id' },
      verificationPolicy: { probeMode: 'read_only', readOnlyOnly: true, requiredScopes: ['contents:read'] },
      providerAdapter: { buildVerificationInvocation: () => ({ verifierId: GITHUB_VERIFIER_ID, executable: process.execPath, args: [GITHUB_VERIFIER_SCRIPT, '--credential-type', 'fine_grained_pat'] }) },
      secretStoreAdapter: { invokeBoundedVerification: async () => ({ boundaryState: 'provider_result', ...providerResult }) },
      now: '2030-01-01T00:00:00Z',
    });
    assert.equal(observation.detailedState, 'unknown');
    assert.equal(observation.normalizedStatus, 'unknown');
    assert.equal(observation.scopeEvidence, 'not_observable');
    assert.equal(observation.expiryMetadataSource, 'unknown');
    assertSafeResult(observation);
  });
});

test('default production request path is fixed to GitHub HTTPS and blocks proxy environment use', async () => {
  assert.equal(GITHUB_API_ORIGIN, 'https://api.github.com');
  assert.equal(GITHUB_API_VERSION, '2026-03-10');
  const saved = process.env.HTTPS_PROXY;
  process.env.HTTPS_PROXY = 'http://proxy.example.invalid';
  try {
    const result = await verifyGitHubCredential({ token: CANARY, credentialType: 'classic_pat' });
    assert.equal(result.resultCode, 'provider_unavailable');
    assert.equal(result.reasonCode, 'provider_proxy_blocked');
    assertSafeResult(result);
  } finally {
    if (saved === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = saved;
  }
});
