import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';

class MockResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  setHeader(name: string, value: string | number | readonly string[]): void {
    this.headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...(headers ?? {}) };
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createJsonPost(url: string, body: Record<string, unknown>): IncomingMessage {
  const request = Readable.from([JSON.stringify(body)]) as unknown as IncomingMessage;
  request.method = 'POST';
  request.url = url;
  Object.defineProperty(request, 'socket', {
    value: { remoteAddress: '127.0.0.1' },
  });
  return request;
}

test('package publish route validates one YouTube target before controlled upload', async () => {
  const response = new MockResponse();

  await routeRequest(
    createJsonPost('/api/video-orchestrator/package/publish', {
      packageId: 'pkg-moving-video-1',
      jobId: 'job-moving-video-1',
      postingTarget: { platformId: 'tiktok', accountId: 'acct-tiktok' },
      confirmation: 'publish approved moving video',
    }),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  const payload = JSON.parse(response.body) as { ok: boolean; error: string };
  assert.equal(payload.ok, false);
  assert.match(payload.error, /postingTarget\.platformId must be youtube/);
});

test('package publish route invokes controlled YouTube publishing for the bound job', async () => {
  const response = new MockResponse();

  await routeRequest(
    createJsonPost('/api/video-orchestrator/package/publish', {
      packageId: 'pkg-moving-video-1',
      jobId: 'job-does-not-exist',
      postingTarget: { platformId: 'youtube', accountId: 'acct-stb-youtube' },
      confirmation: 'PUBLISH TO YOUTUBE',
    }),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  const payload = JSON.parse(response.body) as Record<string, unknown>;
  assert.equal(payload.jobId, 'job-does-not-exist');
  assert.notEqual(payload.code, undefined);
  assert.deepEqual(payload.package, {
    id: 'pkg-moving-video-1',
    jobId: 'job-does-not-exist',
    status: 'publishing',
    postingTarget: {
      platformId: 'youtube',
      accountId: 'acct-stb-youtube',
    },
    publishedAt: payload.package && typeof payload.package === 'object'
      ? (payload.package as Record<string, unknown>).publishedAt
      : undefined,
  });
});
