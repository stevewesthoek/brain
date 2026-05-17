import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../api/routes.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

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
  method?: string;
  url?: string;
  remoteAddress?: string;
}): IncomingMessage {
  const request: IncomingMessage = {
    socket: {
      remoteAddress: input.remoteAddress ?? '127.0.0.1',
    },
  };

  if (input.method !== undefined) {
    request.method = input.method;
  }

  if (input.url !== undefined) {
    request.url = input.url;
  }

  return request;
}

async function exercise(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

test('GET /status returns read-only status for local requests', async () => {
  const response = await exercise({ method: 'GET', url: '/status' });
  const body = JSON.parse(response.body) as { service: string; mode: string; ok: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.service, 'brain-core');
  assert.equal(body.mode, 'read-only');
  assert.equal(body.ok, true);
});

test('GET /sessions returns placeholder session list', async () => {
  const response = await exercise({ method: 'GET', url: '/sessions' });
  const body = JSON.parse(response.body) as { sessions: Array<{ source: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.sessions.length, 1);
  assert.equal(body.sessions[0]?.source, 'placeholder');
});

test('GET /skills returns a skills list', async () => {
  const response = await exercise({ method: 'GET', url: '/skills' });
  const body = JSON.parse(response.body) as { skills: Array<{ status: string; sourcePath: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.skills.length > 0, true);
  assert.equal(typeof body.skills[0]?.sourcePath, 'string');
});

test('GET /repos returns a repo alias list or setup placeholder', async () => {
  const response = await exercise({ method: 'GET', url: '/repos' });
  const body = JSON.parse(response.body) as { repos: Array<{ alias: string; handoffExists: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.repos.length > 0, true);
  assert.equal(typeof body.repos[0]?.alias, 'string');
  assert.equal(typeof body.repos[0]?.handoffExists, 'boolean');
});

test('GET /scheduler/status returns read-only placeholder scheduler state', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/status' });
  const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'placeholder');
  assert.equal(body.enabled, false);
  assert.equal(body.source, 'placeholder');
});

test('GET /scheduler/latest-run returns read-only placeholder latest run state', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/latest-run' });
  const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'placeholder');
  assert.equal(body.enabled, false);
  assert.equal(body.source, 'placeholder');
});

test('GET /scheduler/jobs returns placeholder model-router jobs', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
  const body = JSON.parse(response.body) as { jobs: Array<{ id: string; mutationRequired: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.jobs.length, 4);
  assert.equal(body.jobs[0]?.id, 'mind-compile-loop');
  assert.equal(typeof body.jobs[0]?.mutationRequired, 'boolean');
});

test('GET /local-apps returns placeholder local app list', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps' });
  const body = JSON.parse(response.body) as { apps: Array<{ id: string; actionsSupported: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.apps.length > 0, true);
  assert.equal(body.apps[0]?.actionsSupported, false);
});

test('GET /video/status returns read-only placeholder video state', async () => {
  const response = await exercise({ method: 'GET', url: '/video/status' });
  const body = JSON.parse(response.body) as { enabled: boolean; queueDepth: number; source: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.enabled, false);
  assert.equal(body.queueDepth, 0);
  assert.equal(body.source, 'placeholder');
});

test('GET /video/queue returns read-only queue list', async () => {
  const response = await exercise({ method: 'GET', url: '/video/queue' });
  const body = JSON.parse(response.body) as { queue: unknown[] };

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body.queue), true);
});

test('GET /approvals returns placeholder approvals list before action requests', async () => {
  const response = await exercise({ method: 'GET', url: '/approvals' });
  const body = JSON.parse(response.body) as { approvals: Array<{ id: string; status: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approvals.length > 0, true);
  assert.equal(typeof body.approvals[0]?.status, 'string');
});

test('POST /actions/request creates an approval record without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/request?kind=restart-probot' });
  const body = JSON.parse(response.body) as { approval: { id: string; kind: string; status: string }; executed: boolean };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'restart-probot');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.executed, false);
});

test('POST /approvals/:id/approve marks approval approved without executing', async () => {
  const requestResponse = await exercise({ method: 'POST', url: '/actions/request?kind=test-action' });
  const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
  const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
  const body = JSON.parse(response.body) as { approval: { status: string }; executed: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approval.status, 'approved');
  assert.equal(body.executed, false);
});

test('POST /approvals/:id/reject marks approval rejected without executing', async () => {
  const requestResponse = await exercise({ method: 'POST', url: '/actions/request?kind=test-action' });
  const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
  const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/reject` });
  const body = JSON.parse(response.body) as { approval: { status: string }; executed: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approval.status, 'rejected');
  assert.equal(body.executed, false);
});

test('unsupported non-GET/POST requests are rejected', async () => {
  const response = await exercise({ method: 'PUT', url: '/status' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 405);
  assert.equal(body.error.code, 'method_not_allowed');
});

test('non-local requests are rejected', async () => {
  const response = await exercise({ method: 'GET', url: '/status', remoteAddress: '203.0.113.10' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 403);
  assert.equal(body.error.code, 'forbidden_non_local_request');
});
