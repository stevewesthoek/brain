import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createRequest(input: {
  method: string;
  url: string;
  remoteAddress?: string;
  headers?: Record<string, string>;
  on?: IncomingMessage['on'];
}): IncomingMessage {
  return {
    method: input.method,
    url: input.url,
    headers: input.headers ?? {},
    socket: { remoteAddress: input.remoteAddress ?? '127.0.0.1' },
    ...(input.on ? { on: input.on } : {}),
  } as IncomingMessage;
}

async function exercise(input: Parameters<typeof createRequest>[0]): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

function assertContained(response: MockResponse): void {
  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    code: 'mutable_capability_contained',
    message: 'This high-impact mutable capability is unavailable until an authenticated service identity is implemented.',
    safety: {
      accessControl: 'fail-closed',
      localhostIsNotAuthentication: true,
      originIsNotAuthentication: true,
      requestBodyRead: false,
      approvalBypassAllowed: false,
      credentialValuesAccepted: false,
    },
  });
}

test('high-impact mutations fail closed for localhost and Origin-only requests', async () => {
  const response = await exercise({
    method: 'POST',
    url: '/api/agent/execute',
    headers: { origin: 'https://untrusted.example' },
    on() {
      throw new Error('contained request must not read its body');
    },
  });

  assertContained(response);
});

test('caller-supplied authorization header cannot bypass containment', async () => {
  const response = await exercise({
    method: 'POST',
    url: '/ops/brain-core/restart',
    headers: { authorization: 'Bearer test-only-value', origin: 'http://localhost:3000' },
  });

  assertContained(response);
});

test('contained mutation preflight does not advertise POST as an allowed cross-origin method', async () => {
  const response = await exercise({
    method: 'OPTIONS',
    url: '/api/video-orchestrator/package/publish',
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-methods'], 'GET, HEAD, OPTIONS');
});

test('read-only routes remain available and a GET cannot invoke a contained mutation', async () => {
  const status = await exercise({
    method: 'GET',
    url: '/status',
    headers: { authorization: 'Bearer read-only-test' },
  });
  assert.equal(status.statusCode, 200);

  const mutationAsGet = await exercise({
    method: 'GET',
    url: '/api/video-orchestrator/package/publish?confirmation=attempt',
  });
  assert.equal(mutationAsGet.statusCode, 404);
});

test('approval decisions cannot be bypassed or replayed during containment', async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await exercise({
      method: 'POST',
      url: '/approvals/test-approval/approve',
      headers: { origin: 'http://localhost:4820' },
    });
    assertContained(response);
  }
});

test('credential query values and arbitrary execution inputs are rejected without response disclosure', async () => {
  const credentialFixtureValue = 'not-a-real-secret-value';
  const credentialResponse = await exercise({
    method: 'POST',
    url: `/credentials/project/set?key=TOKEN&value=${credentialFixtureValue}`,
  });
  assertContained(credentialResponse);
  assert.equal(credentialResponse.body.includes(credentialFixtureValue), false);

  const executionResponse = await exercise({
    method: 'POST',
    url: '/research/video-analyze',
    on() {
      throw new Error('contained execution route must not read caller-controlled input');
    },
  });
  assertContained(executionResponse);
});

test('non-local callers remain denied before the containment boundary', async () => {
  const response = await exercise({
    method: 'POST',
    url: '/api/agent/execute',
    remoteAddress: '203.0.113.10',
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.includes('mutable_capability_contained'), false);
});
