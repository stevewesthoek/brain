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

async function request(method: string, url: string): Promise<MockResponse> {
  const response = new MockResponse();
  const request = { method, url, socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage;
  await routeRequest(request, response);
  return response;
}

test('runtime identity route exposes bounded non-secret identity metadata', async () => {
  const response = await request('GET', '/runtime/identity');
  const body = JSON.parse(response.body) as Record<string, unknown>;
  assert.equal(response.statusCode, 200);
  assert.equal(body.contract, 'brain-core-deployment-identity-v1');
  assert.equal((body.safety as Record<string, unknown>).exposesSecrets, false);
  assert.equal((body.safety as Record<string, unknown>).exposesEnvironmentValues, false);
});

test('operational snapshot route is additive and read-only', async () => {
  const response = await request('GET', '/operational-snapshot');
  const body = JSON.parse(response.body) as Record<string, unknown>;
  assert.equal(response.statusCode, 200);
  assert.equal(body.contract, 'operational-snapshot-v1');
  const attention = (body.sections as Record<string, unknown>).attention as Record<string, unknown>;
  assert.ok(Array.isArray((attention.data as Record<string, unknown>).items));
  assert.deepEqual(body.safety, { readOnly: true, writesToMind: false, executionEnabled: false, externalMutations: false });

  const post = await request('POST', '/operational-snapshot');
  assert.ok(post.statusCode === 404 || post.statusCode === 405);
});
