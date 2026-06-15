import test from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(this.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(this.headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
    assert.equal(this.headers['Access-Control-Allow-Headers'], 'content-type');
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
  assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
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




test('thumbnail success responses preserve GET and HEAD semantics', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-success-regression-20260615';
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.png`;
  const thumbnailBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async () => thumbnailBytes);
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const url = `/api/video-orchestrator/jobs/${jobId}/thumbnail`;
  const getResponse = new MockResponse();
  await routeRequest(
    createRequest('GET', url),
    getResponse as unknown as ServerResponse,
  );

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.headers['Content-Type'], 'image/png');
  assert.equal(getResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.deepEqual(getResponse.body as unknown, thumbnailBytes);

  const headResponse = new MockResponse();
  await routeRequest(
    createRequest('HEAD', url),
    headResponse as unknown as ServerResponse,
  );

  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.headers['Content-Type'], 'image/png');
  assert.equal(headResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(headResponse.body, '');
});




test('thumbnail loader failures preserve GET and HEAD error semantics', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-loader-failure-regression-20260615';
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async () => {
    throw new Error('simulated thumbnail load failure');
  });
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const url = `/api/video-orchestrator/jobs/${jobId}/thumbnail`;
  const getResponse = new MockResponse();
  await routeRequest(
    createRequest('GET', url),
    getResponse as unknown as ServerResponse,
  );

  assert.equal(getResponse.statusCode, 502);
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(getResponse.headers['Content-Type'], 'application/json; charset=utf-8');
  const getPayload = JSON.parse(getResponse.body) as Record<string, unknown>;
  assert.equal(getPayload.ok, false);
  assert.equal(getPayload.code, 'thumbnail_fetch_failed');
  assert.equal(getPayload.error, 'simulated thumbnail load failure');

  const headResponse = new MockResponse();
  await routeRequest(
    createRequest('HEAD', url),
    headResponse as unknown as ServerResponse,
  );

  assert.equal(headResponse.statusCode, 502);
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(headResponse.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(headResponse.body, '');
});

test('thumbnail empty byte results map to thumbnail_empty', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-empty-regression-20260615';
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.webp`;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async () => null);
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const response = new MockResponse();
  await routeRequest(
    createRequest('GET', `/api/video-orchestrator/jobs/${jobId}/thumbnail`),
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 502);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  const payload = JSON.parse(response.body) as Record<string, unknown>;
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'thumbnail_empty');
  assert.equal(payload.error, 'Thumbnail loaded from S3 but no image bytes were returned.');
});




test('thumbnail requested-key validation selects only safe same-job image keys', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-requested-key-regression-20260615';
  const canonicalKey = `jobs/${jobId}/exports/thumbnail-canonical.jpg`;
  let loadedKey: string | null = null;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey: canonicalKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: canonicalKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async (_localPath, thumbnailKey) => {
    loadedKey = thumbnailKey;
    return Buffer.from([1]);
  });
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const validRequestedKeys = [
    `jobs/${jobId}/exports/requested.jpg`,
    `jobs/${jobId}/exports/requested.png`,
    `jobs/${jobId}/exports/requested.webp`,
  ];
  for (const requestedKey of validRequestedKeys) {
    loadedKey = null;
    const response = new MockResponse();
    const url = `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=${encodeURIComponent(requestedKey)}`;
    await routeRequest(createRequest('GET', url), response as unknown as ServerResponse);

    assert.equal(response.statusCode, 200);
    assert.equal(loadedKey, requestedKey);
  }

  const rejectedRequestedKeys = [
    'jobs/another-job/exports/requested.jpg',
    `jobs/${jobId}/../another-job/requested.png`,
    `jobs/${jobId}/exports/requested.gif`,
  ];
  for (const requestedKey of rejectedRequestedKeys) {
    loadedKey = null;
    const response = new MockResponse();
    const url = `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=${encodeURIComponent(requestedKey)}`;
    await routeRequest(createRequest('GET', url), response as unknown as ServerResponse);

    assert.equal(response.statusCode, 200);
    assert.equal(loadedKey, canonicalKey);
  }
});




test('thumbnail MIME selection follows canonical and accepted requested key extensions', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-mime-regression-20260615';
  let canonicalKey = `jobs/${jobId}/exports/thumbnail.jpg`;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey: canonicalKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: canonicalKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async () => Buffer.from([1, 2, 3]));
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const cases = [
    { source: 'canonical', key: `jobs/${jobId}/exports/canonical.JPG`, expected: 'image/jpeg' },
    { source: 'canonical', key: `jobs/${jobId}/exports/canonical.jpeg`, expected: 'image/jpeg' },
    { source: 'canonical', key: `jobs/${jobId}/exports/canonical.PNG`, expected: 'image/png' },
    { source: 'canonical', key: `jobs/${jobId}/exports/canonical.WebP`, expected: 'image/webp' },
    { source: 'requested', key: `jobs/${jobId}/exports/requested.jpg`, expected: 'image/jpeg' },
    { source: 'requested', key: `jobs/${jobId}/exports/requested.JPEG`, expected: 'image/jpeg' },
    { source: 'requested', key: `jobs/${jobId}/exports/requested.png`, expected: 'image/png' },
    { source: 'requested', key: `jobs/${jobId}/exports/requested.WEBP`, expected: 'image/webp' },
  ] as const;

  for (const testCase of cases) {
    canonicalKey = testCase.source === 'canonical'
      ? testCase.key
      : `jobs/${jobId}/exports/fallback.jpg`;
    const query = testCase.source === 'requested'
      ? `?key=${encodeURIComponent(testCase.key)}`
      : '';
    const response = new MockResponse();

    await routeRequest(
      createRequest('GET', `/api/video-orchestrator/jobs/${jobId}/thumbnail${query}`),
      response as unknown as ServerResponse,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Content-Type'], testCase.expected);
  }
});




test('thumbnail malformed encoded job IDs return invalid_job_id for GET and HEAD', async () => {
  const url = '/api/video-orchestrator/jobs/%E0%A4%A/thumbnail';

  const getResponse = new MockResponse();
  await routeRequest(
    createRequest('GET', url),
    getResponse as unknown as ServerResponse,
  );

  assert.equal(getResponse.statusCode, 400);
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(getResponse.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(getResponse.body), {
    ok: false,
    code: 'invalid_job_id',
    error: 'Invalid jobId',
    details: null,
  });

  const headResponse = new MockResponse();
  await routeRequest(
    createRequest('HEAD', url),
    headResponse as unknown as ServerResponse,
  );

  assert.equal(headResponse.statusCode, 400);
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(headResponse.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(headResponse.body, '');
});




test('thumbnail malformed requested keys fall back to canonical GET and HEAD success', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-malformed-key-regression-20260615';
  const canonicalKey = `jobs/${jobId}/exports/thumbnail-canonical.png`;
  const thumbnailBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  let loadedKey: string | null = null;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey: canonicalKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: canonicalKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async (_localPath, thumbnailKey) => {
    loadedKey = thumbnailKey;
    return thumbnailBytes;
  });
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const url = `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=%E0%A4%A`;
  const getResponse = new MockResponse();
  await routeRequest(createRequest('GET', url), getResponse as unknown as ServerResponse);

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.headers['Content-Type'], 'image/png');
  assert.equal(getResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(loadedKey, canonicalKey);
  assert.deepEqual(getResponse.body as unknown, thumbnailBytes);

  loadedKey = null;
  const headResponse = new MockResponse();
  await routeRequest(createRequest('HEAD', url), headResponse as unknown as ServerResponse);

  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.headers['Content-Type'], 'image/png');
  assert.equal(headResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(loadedKey, canonicalKey);
  assert.equal(headResponse.body, '');
});




test('thumbnail duplicate key queries use only the first value', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-duplicate-key-regression-20260615';
  const canonicalKey = `jobs/${jobId}/exports/thumbnail-canonical.jpg`;
  const safeFirstKey = `jobs/${jobId}/exports/thumbnail-first.png`;
  const safeLaterKey = `jobs/${jobId}/exports/thumbnail-later.webp`;
  const thumbnailBytes = Buffer.from([1, 2, 3]);
  let loadedKey: string | null = null;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey: canonicalKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: canonicalKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async (_localPath, thumbnailKey) => {
    loadedKey = thumbnailKey;
    return thumbnailBytes;
  });
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const safeFirstUrl = `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=${encodeURIComponent(safeFirstKey)}&key=${encodeURIComponent(safeLaterKey)}`;
  const getResponse = new MockResponse();
  await routeRequest(createRequest('GET', safeFirstUrl), getResponse as unknown as ServerResponse);

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.headers['Content-Type'], 'image/png');
  assert.equal(getResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(loadedKey, safeFirstKey);
  assert.deepEqual(getResponse.body as unknown, thumbnailBytes);

  loadedKey = null;
  const unsafeFirstUrl = `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=${encodeURIComponent('jobs/another-job/thumbnail.jpg')}&key=${encodeURIComponent(safeLaterKey)}`;
  const headResponse = new MockResponse();
  await routeRequest(createRequest('HEAD', unsafeFirstUrl), headResponse as unknown as ServerResponse);

  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.headers['Content-Type'], 'image/jpeg');
  assert.equal(headResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(loadedKey, canonicalKey);
  assert.equal(headResponse.body, '');
});




test('thumbnail empty and valueless key queries fall back to the canonical key', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-empty-key-regression-20260615';
  const canonicalKey = `jobs/${jobId}/exports/thumbnail-canonical.webp`;
  const thumbnailBytes = Buffer.from([1, 2, 3, 4]);
  let loadedKey: string | null = null;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey: canonicalKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: canonicalKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async (_localPath, thumbnailKey) => {
    loadedKey = thumbnailKey;
    return thumbnailBytes;
  });
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const getResponse = new MockResponse();
  await routeRequest(
    createRequest('GET', `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=`),
    getResponse as unknown as ServerResponse,
  );

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.headers['Content-Type'], 'image/webp');
  assert.equal(getResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(getResponse.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(getResponse.headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
  assert.equal(getResponse.headers['Access-Control-Allow-Headers'], 'content-type');
  assert.equal(loadedKey, canonicalKey);
  assert.deepEqual(getResponse.body as unknown, thumbnailBytes);

  loadedKey = null;
  const headResponse = new MockResponse();
  await routeRequest(
    createRequest('HEAD', `/api/video-orchestrator/jobs/${jobId}/thumbnail?key`),
    headResponse as unknown as ServerResponse,
  );

  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.headers['Content-Type'], 'image/webp');
  assert.equal(headResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(headResponse.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(headResponse.headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
  assert.equal(headResponse.headers['Access-Control-Allow-Headers'], 'content-type');
  assert.equal(loadedKey, canonicalKey);
  assert.equal(headResponse.body, '');
});




test('thumbnail whitespace-only key queries fall back to the canonical key', async (t) => {
  const {
    setVideoJobThumbnailBytesLoaderForTesting,
    setVideoJobThumbnailPublishableAssetsResolverForTesting,
  } = await import('../providers/video-orchestrator-provider.js');
  const jobId = 'thumbnail-whitespace-key-regression-20260615';
  const canonicalKey = `jobs/${jobId}/exports/thumbnail-canonical.png`;
  const thumbnailBytes = Buffer.from([9, 8, 7]);
  let loadedKey: string | null = null;

  setVideoJobThumbnailPublishableAssetsResolverForTesting(async () => ({
    thumbnailKey: canonicalKey,
    missing: [],
    expectedKeys: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: canonicalKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  }));
  setVideoJobThumbnailBytesLoaderForTesting(async (_localPath, thumbnailKey) => {
    loadedKey = thumbnailKey;
    return thumbnailBytes;
  });
  t.after(() => {
    setVideoJobThumbnailBytesLoaderForTesting(null);
    setVideoJobThumbnailPublishableAssetsResolverForTesting(null);
  });

  const getResponse = new MockResponse();
  await routeRequest(
    createRequest('GET', `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=   `),
    getResponse as unknown as ServerResponse,
  );

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.headers['Content-Type'], 'image/png');
  assert.equal(getResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(getResponse.headers['Cache-Control'], 'no-store');
  assert.equal(getResponse.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(getResponse.headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
  assert.equal(getResponse.headers['Access-Control-Allow-Headers'], 'content-type');
  assert.equal(loadedKey, canonicalKey);
  assert.deepEqual(getResponse.body as unknown, thumbnailBytes);

  loadedKey = null;
  const headResponse = new MockResponse();
  await routeRequest(
    createRequest('HEAD', `/api/video-orchestrator/jobs/${jobId}/thumbnail?key=%20%09%0A`),
    headResponse as unknown as ServerResponse,
  );

  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.headers['Content-Type'], 'image/png');
  assert.equal(headResponse.headers['Content-Length'], String(thumbnailBytes.length));
  assert.equal(headResponse.headers['Cache-Control'], 'no-store');
  assert.equal(headResponse.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(headResponse.headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
  assert.equal(headResponse.headers['Access-Control-Allow-Headers'], 'content-type');
  assert.equal(loadedKey, canonicalKey);
  assert.equal(headResponse.body, '');
});
