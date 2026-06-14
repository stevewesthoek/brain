import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';

class MockResponse {
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

function createRequest(method: string): IncomingMessage {
  return {
    method,
    url: '/api/video-orchestrator/jobs/test-job/thumbnail?key=jobs%2Ftest-job%2Fthumbnail.jpg',
    socket: { remoteAddress: '127.0.0.1' },
  } as IncomingMessage;
}

test('thumbnail route rejects unsupported methods with explicit endpoint semantics', async () => {
  const response = new MockResponse();

  await routeRequest(
    createRequest('POST'),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET, HEAD');
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    code: 'method_not_allowed',
    error: 'Use GET or HEAD to load the thumbnail.',
  });
});
