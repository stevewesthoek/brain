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

function createRequest(
  method: string,
  url = '/api/video-orchestrator/jobs/test-job/thumbnail?key=jobs%2Ftest-job%2Fthumbnail.jpg',
): IncomingMessage {
  return {
    method,
    url,
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




test('thumbnail HEAD suppresses the error body for an invalid job ID', async () => {
  const response = new MockResponse();

  await routeRequest(
    createRequest('HEAD', '/api/video-orchestrator/jobs/invalid%20job/thumbnail'),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(response.body, '');
});




test('thumbnail GET returns a no-store JSON error for an invalid job ID', async () => {
  const response = new MockResponse();

  await routeRequest(
    createRequest('GET', '/api/video-orchestrator/jobs/invalid%20job/thumbnail'),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    code: 'invalid_job_id',
    error: 'Invalid jobId',
    details: null,
  });
});




test('thumbnail OPTIONS advertises GET, HEAD, and OPTIONS only', async () => {
  const response = new MockResponse();

  await routeRequest(
    createRequest('OPTIONS'),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], '*');
  assert.equal(response.headers['access-control-allow-methods'], 'GET, HEAD, OPTIONS');
  assert.equal(response.headers['access-control-allow-headers'], 'content-type');
  assert.equal(response.body, '');
});




test('thumbnail not-ready responses preserve GET and HEAD semantics', async (t) => {
  const { setVideoJobThumbnailPublishableAssetsResolverForTesting } = await import('../providers/video-orchestrator-provider.js');
  setVideoJobThumbnailPublishableAssetsResolverForTesting(async (jobId) => ({
    thumbnailKey: null,
    missing: ['thumbnailKey'],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  t.after(() => setVideoJobThumbnailPublishableAssetsResolverForTesting(null));

  const jobId = 'thumbnail-not-ready-regression-20260614';
  const url = `/api/video-orchestrator/jobs/${jobId}/thumbnail`;

  const getResponse = new MockResponse();
  await routeRequest(
    createRequest('GET', url),
    getResponse as unknown as ServerResponse,
  );

  assert.equal(getResponse.statusCode, 404);
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(getResponse.headers['Content-Type'], 'application/json; charset=utf-8');
  const getPayload = JSON.parse(getResponse.body) as Record<string, unknown>;
  assert.equal(getPayload.ok, false);
  assert.equal(getPayload.code, 'thumbnail_not_ready');
  assert.equal(getPayload.error, 'Thumbnail is not ready because the publish package is incomplete.');

  const headResponse = new MockResponse();
  await routeRequest(
    createRequest('HEAD', url),
    headResponse as unknown as ServerResponse,
  );

  assert.equal(headResponse.statusCode, 404);
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(headResponse.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(headResponse.body, '');
});
