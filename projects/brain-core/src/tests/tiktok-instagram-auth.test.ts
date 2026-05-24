/**
 * Tests for TikTok OAuth2 + Instagram publisher adapters.
 *
 * All external HTTPS calls are intercepted by replacing `_transport.request`
 * on each module's exported transport object. No real API calls are made.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as tiktokAuth from '../adapters/tiktok-auth.js';
import * as tiktokPublisher from '../adapters/tiktok-publisher.js';
import * as instagramPublisher from '../adapters/instagram-publisher.js';
import type https from 'node:https';
import type { IncomingMessage } from 'node:http';

// ─────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ─────────────────────────────────────────────────────────────────────────────

interface MockResponse {
  statusCode: number;
  body: string;
}

/** Matches the ReqHandle interface used by the adapters' _transport object. */
interface ReqHandle {
  on(event: string, handler: (err: Error) => void): void;
  write(data: string | Buffer): boolean;
  end(): void;
}

/** Matches the ResHandle interface used by the adapters' _transport callback. */
interface ResHandle {
  on(event: string, handler: (...args: unknown[]) => void): void;
  readonly statusCode?: number;
}

type TransportRequest = (
  options: https.RequestOptions,
  callback: (res: ResHandle) => void,
) => ReqHandle;

/**
 * Returns a mock transport.request function that responds in order.
 * Responses are consumed FIFO per call index.
 */
function makeMockRequest(responses: MockResponse[]): TransportRequest {
  let index = 0;
  return (options: https.RequestOptions, callback: (res: ResHandle) => void): ReqHandle => {
    const spec = responses[index] ?? { statusCode: 200, body: '{}' };
    index++;

    // Minimal IncomingMessage mock — statusCode as plain property so cast works
    const mockRes = {
      statusCode: spec.statusCode,
      on(event: string, handler: (...args: unknown[]) => void) {
        if (event === 'data') {
          setImmediate(() => handler(Buffer.from(spec.body)));
        } else if (event === 'end') {
          // Fire end after data (two setImmediate hops to ensure data fires first)
          setImmediate(() => setImmediate(() => handler()));
        }
        return mockRes;
      },
    } as ResHandle;

    setImmediate(() => callback(mockRes));

    // Minimal ReqHandle mock
    const mockReq: ReqHandle = {
      on(_e: string, _h: (err: Error) => void) { /* noop */ },
      write(_d: string | Buffer): boolean { return true; },
      end() { /* noop */ },
    };

    void options;
    return mockReq;
  };
}

function tmpVideoFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tt-ig-test-'));
  const filePath = path.join(dir, 'test.mp4');
  writeFileSync(filePath, 'dummy-mp4-content-for-testing');
  return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// tiktok-auth: getTikTokAuthUrl
// ─────────────────────────────────────────────────────────────────────────────

test('getTikTokAuthUrl returns a valid TikTok authorize URL', () => {
  const url = tiktokAuth.getTikTokAuthUrl('test-state-123');
  assert.ok(
    url.startsWith('https://www.tiktok.com/v1/oauth/authorize'),
    'URL must start with TikTok authorize endpoint',
  );
  assert.ok(url.includes('state=test-state-123'), 'URL must contain the state param');
  assert.ok(url.includes('response_type=code'), 'URL must request authorization code grant');
  assert.ok(url.includes('scope='), 'URL must include scope');
});

test('getTikTokAuthUrl includes redirect_uri pointing to localhost:4877', () => {
  const url = tiktokAuth.getTikTokAuthUrl('s1');
  assert.ok(url.includes('redirect_uri='), 'URL must include redirect_uri');
  const decoded = decodeURIComponent(url);
  assert.ok(
    decoded.includes('localhost:4877'),
    `Redirect URI must target localhost:4877, got: ${decoded}`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// tiktok-auth: exchangeTikTokCode — mocked responses
// ─────────────────────────────────────────────────────────────────────────────

test('exchangeTikTokCode returns ok with tokens on successful API response', async () => {
  const original = tiktokAuth._transport.request;
  tiktokAuth._transport.request = makeMockRequest([{
    statusCode: 200,
    body: JSON.stringify({
      data: {
        access_token: 'act-test-token-abc',
        refresh_token: 'rft-test-refresh-xyz',
        open_id: 'openid-123',
        expires_in: 86400,
      },
    }),
  }]);

  const origClientId = process.env['TIKTOK_CLIENT_ID'];
  const origSecret = process.env['TIKTOK_CLIENT_SECRET'];
  process.env['TIKTOK_CLIENT_ID'] = 'test-client-id';
  process.env['TIKTOK_CLIENT_SECRET'] = 'test-client-secret';

  try {
    const result = await tiktokAuth.exchangeTikTokCode('auth-code-xyz');
    assert.equal(result.ok, true);
    assert.equal(result.accessToken, 'act-test-token-abc');
    assert.equal(result.refreshToken, 'rft-test-refresh-xyz');
    assert.equal(result.openId, 'openid-123');
    assert.equal(result.expiresIn, 86400);
  } finally {
    tiktokAuth._transport.request = original;
    process.env['TIKTOK_CLIENT_ID'] = origClientId ?? '';
    process.env['TIKTOK_CLIENT_SECRET'] = origSecret ?? '';
  }
});

test('exchangeTikTokCode returns error on API error response', async () => {
  const original = tiktokAuth._transport.request;
  tiktokAuth._transport.request = makeMockRequest([{
    statusCode: 400,
    body: JSON.stringify({
      error: { message: 'invalid_code', code: 10013 },
    }),
  }]);

  const origClientId = process.env['TIKTOK_CLIENT_ID'];
  const origSecret = process.env['TIKTOK_CLIENT_SECRET'];
  process.env['TIKTOK_CLIENT_ID'] = 'test-client-id';
  process.env['TIKTOK_CLIENT_SECRET'] = 'test-client-secret';

  try {
    const result = await tiktokAuth.exchangeTikTokCode('bad-code');
    assert.equal(result.ok, false);
    assert.ok(
      result.error?.includes('invalid_code') || result.error?.includes('10013'),
      `error should reflect API error, got: ${result.error}`,
    );
  } finally {
    tiktokAuth._transport.request = original;
    process.env['TIKTOK_CLIENT_ID'] = origClientId ?? '';
    process.env['TIKTOK_CLIENT_SECRET'] = origSecret ?? '';
  }
});

test('exchangeTikTokCode returns error when code is empty', async () => {
  // Empty code guard fires before any network call
  const result = await tiktokAuth.exchangeTikTokCode('');
  assert.equal(result.ok, false);
  assert.ok(result.error, 'error must be set');
});

// ─────────────────────────────────────────────────────────────────────────────
// tiktok-publisher: publishToTikTok — mocked responses
// ─────────────────────────────────────────────────────────────────────────────

test('publishToTikTok completes full 3-step flow on success', async () => {
  const original = tiktokPublisher._transport.request;
  const videoPath = tmpVideoFile();

  tiktokPublisher._transport.request = makeMockRequest([
    // Step 1: init upload
    {
      statusCode: 200,
      body: JSON.stringify({
        error: { code: 'ok' },
        data: {
          video_id: 'vid-test-123',
          upload_url: 'https://upload.tiktok.test/v1/upload/vid-test-123',
        },
      }),
    },
    // Step 2: PUT upload
    { statusCode: 200, body: '' },
    // Step 3: publish confirm
    {
      statusCode: 200,
      body: JSON.stringify({ error: { code: 'ok' } }),
    },
  ]);

  try {
    const result = await tiktokPublisher.publishToTikTok({
      accessToken: 'test-access-token',
      videoPath,
      title: 'Test TikTok Video',
      description: 'A test description',
      tags: ['test', 'video'],
    });

    assert.equal(result.ok, true);
    assert.equal(result.videoId, 'vid-test-123');
    assert.ok(result.publishedUrl?.includes('tiktok.com'), 'publishedUrl must include tiktok.com');
  } finally {
    tiktokPublisher._transport.request = original;
  }
});

test('publishToTikTok returns error when accessToken is empty', async () => {
  const result = await tiktokPublisher.publishToTikTok({
    accessToken: '',
    videoPath: tmpVideoFile(),
    title: 'Title',
    description: 'Desc',
  });
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('access_token'), `expected access_token error, got: ${result.error}`);
});

test('publishToTikTok returns error when video file does not exist', async () => {
  const result = await tiktokPublisher.publishToTikTok({
    accessToken: 'valid-token',
    videoPath: '/nonexistent/video-tt-test.mp4',
    title: 'Title',
    description: 'Desc',
  });
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('not_found'), `expected not_found error, got: ${result.error}`);
});

test('publishToTikTok returns error when init upload fails', async () => {
  const original = tiktokPublisher._transport.request;
  const videoPath = tmpVideoFile();

  tiktokPublisher._transport.request = makeMockRequest([
    {
      statusCode: 401,
      body: JSON.stringify({
        error: { code: 'access_token_invalid', message: 'Access token is invalid or expired' },
      }),
    },
  ]);

  try {
    const result = await tiktokPublisher.publishToTikTok({
      accessToken: 'expired-token',
      videoPath,
      title: 'Title',
      description: 'Desc',
    });
    assert.equal(result.ok, false);
    assert.ok(result.error, 'error must be set on init failure');
  } finally {
    tiktokPublisher._transport.request = original;
  }
});

test('publishToTikTok returns error when video upload step fails', async () => {
  const original = tiktokPublisher._transport.request;
  const videoPath = tmpVideoFile();

  tiktokPublisher._transport.request = makeMockRequest([
    // Step 1: init succeeds
    {
      statusCode: 200,
      body: JSON.stringify({
        error: { code: 'ok' },
        data: {
          video_id: 'vid-456',
          upload_url: 'https://upload.tiktok.test/upload/vid-456',
        },
      }),
    },
    // Step 2: upload fails with 500
    { statusCode: 500, body: 'Internal Server Error' },
  ]);

  try {
    const result = await tiktokPublisher.publishToTikTok({
      accessToken: 'valid-token',
      videoPath,
      title: 'Title',
      description: 'Desc',
    });
    assert.equal(result.ok, false);
    assert.ok(result.error, 'error must be set on upload failure');
  } finally {
    tiktokPublisher._transport.request = original;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// instagram-publisher: publishToInstagram — mocked responses
// ─────────────────────────────────────────────────────────────────────────────

test('publishToInstagram completes full 3-step flow on success', async () => {
  const original = instagramPublisher._transport.request;

  instagramPublisher._transport.request = makeMockRequest([
    // Step 1: create container
    { statusCode: 200, body: JSON.stringify({ id: 'container-789' }) },
    // Step 2: status — FINISHED
    { statusCode: 200, body: JSON.stringify({ status_code: 'FINISHED', id: 'container-789' }) },
    // Step 3: publish
    { statusCode: 200, body: JSON.stringify({ id: 'media-999' }) },
  ]);

  try {
    const result = await instagramPublisher.publishToInstagram({
      accessToken: 'ig-test-token',
      accountId: 'ig-account-123',
      videoUrl: 'https://cdn.example.com/test-video.mp4',
      caption: 'Test caption',
      mediaType: 'REELS',
    });

    assert.equal(result.ok, true);
    assert.equal(result.mediaId, 'media-999');
    assert.ok(result.publishedUrl?.includes('instagram.com'), 'publishedUrl must include instagram.com');
    assert.ok(result.publishedUrl?.includes('media-999'), 'publishedUrl must include media ID');
  } finally {
    instagramPublisher._transport.request = original;
  }
});

test('publishToInstagram returns error when accessToken is empty', async () => {
  const result = await instagramPublisher.publishToInstagram({
    accessToken: '',
    accountId: 'acct-id',
    videoUrl: 'https://cdn.example.com/video.mp4',
    caption: 'Caption',
  });
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('access_token'), `expected access_token error, got: ${result.error}`);
});

test('publishToInstagram returns error when accountId is empty', async () => {
  const result = await instagramPublisher.publishToInstagram({
    accessToken: 'valid-token',
    accountId: '',
    videoUrl: 'https://cdn.example.com/video.mp4',
    caption: 'Caption',
  });
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('account_id'), `expected account_id error, got: ${result.error}`);
});

test('publishToInstagram returns error when videoUrl is empty', async () => {
  const result = await instagramPublisher.publishToInstagram({
    accessToken: 'valid-token',
    accountId: 'acct-id',
    videoUrl: '',
    caption: 'Caption',
  });
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('video_url'), `expected video_url error, got: ${result.error}`);
});

test('publishToInstagram returns error on container creation failure', async () => {
  const original = instagramPublisher._transport.request;

  instagramPublisher._transport.request = makeMockRequest([
    {
      statusCode: 400,
      body: JSON.stringify({
        error: { code: 190, message: 'Invalid OAuth access token' },
      }),
    },
  ]);

  try {
    const result = await instagramPublisher.publishToInstagram({
      accessToken: 'bad-token',
      accountId: 'acct-123',
      videoUrl: 'https://cdn.example.com/video.mp4',
      caption: 'Caption',
    });
    assert.equal(result.ok, false);
    assert.ok(result.error, 'error must be set on container creation failure');
  } finally {
    instagramPublisher._transport.request = original;
  }
});

test('publishToInstagram returns error when container processing fails with ERROR status', async () => {
  const original = instagramPublisher._transport.request;

  instagramPublisher._transport.request = makeMockRequest([
    // Step 1: container created
    { statusCode: 200, body: JSON.stringify({ id: 'container-bad' }) },
    // Step 2: status — ERROR
    {
      statusCode: 200,
      body: JSON.stringify({
        status_code: 'ERROR',
        error_code: 'VIDEO_FORMAT_UNSUPPORTED',
        id: 'container-bad',
      }),
    },
  ]);

  try {
    const result = await instagramPublisher.publishToInstagram({
      accessToken: 'valid-token',
      accountId: 'acct-123',
      videoUrl: 'https://cdn.example.com/video.mov',
      caption: 'Caption',
    });
    assert.equal(result.ok, false);
    assert.ok(result.error, 'error must be set when container processing fails');
  } finally {
    instagramPublisher._transport.request = original;
  }
});

test('publishToInstagram handles slow processing with multiple status polls', async () => {
  const original = instagramPublisher._transport.request;

  instagramPublisher._transport.request = makeMockRequest([
    // Step 1: container created
    { statusCode: 200, body: JSON.stringify({ id: 'container-slow' }) },
    // Step 2a: IN_PROGRESS
    { statusCode: 200, body: JSON.stringify({ status_code: 'IN_PROGRESS', id: 'container-slow' }) },
    // Step 2b: FINISHED
    { statusCode: 200, body: JSON.stringify({ status_code: 'FINISHED', id: 'container-slow' }) },
    // Step 3: publish
    { statusCode: 200, body: JSON.stringify({ id: 'media-slow-777' }) },
  ]);

  try {
    const result = await instagramPublisher.publishToInstagram({
      accessToken: 'valid-token',
      accountId: 'acct-123',
      videoUrl: 'https://cdn.example.com/video.mp4',
      caption: 'Slow video caption',
    });

    assert.equal(result.ok, true);
    assert.equal(result.mediaId, 'media-slow-777');
  } finally {
    instagramPublisher._transport.request = original;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// vo-studio-publishing-platform: fallback when no credentials
// ─────────────────────────────────────────────────────────────────────────────

test('publishing platform falls back to n8n when TikTok token missing', async () => {
  const { publishToPlatform } = await import('../adapters/vo-studio-publishing-platform.js');

  const dir = mkdtempSync(path.join(tmpdir(), 'vo-pub-cred-test-'));
  const videoPath = path.join(dir, 'test.mp4');
  writeFileSync(videoPath, 'dummy');

  const orig = process.env['TIKTOK_ACCESS_TOKEN'];
  delete process.env['TIKTOK_ACCESS_TOKEN'];

  try {
    const result = await publishToPlatform({
      packageId: 'pkg-001',
      platform: 'tiktok',
      accountId: 'acct-001',
      videoPath,
      metadata: { title: 'Test', description: 'Desc', tags: [] },
    });
    // No token → direct fails → n8n fallback attempted → no webhook → fallbackMode=true
    assert.equal(result.fallbackMode, true);
  } finally {
    if (orig !== undefined) process.env['TIKTOK_ACCESS_TOKEN'] = orig;
  }
});

test('publishing platform falls back to n8n when Instagram credentials missing', async () => {
  const { publishToPlatform } = await import('../adapters/vo-studio-publishing-platform.js');

  const dir = mkdtempSync(path.join(tmpdir(), 'vo-pub-ig-test-'));
  const videoPath = path.join(dir, 'test.mp4');
  writeFileSync(videoPath, 'dummy');

  const origToken = process.env['INSTAGRAM_ACCESS_TOKEN'];
  const origAcct = process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'];
  delete process.env['INSTAGRAM_ACCESS_TOKEN'];
  delete process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'];

  try {
    const result = await publishToPlatform({
      packageId: 'pkg-002',
      platform: 'instagram',
      accountId: 'acct-002',
      videoPath,
      metadata: { title: 'Test', description: 'Desc', tags: [] },
    });
    assert.equal(result.fallbackMode, true);
  } finally {
    if (origToken !== undefined) process.env['INSTAGRAM_ACCESS_TOKEN'] = origToken;
    if (origAcct !== undefined) process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'] = origAcct;
  }
});

test('publishing platform falls back to n8n when Instagram video path is local (not public URL)', async () => {
  const { publishToPlatform } = await import('../adapters/vo-studio-publishing-platform.js');

  const dir = mkdtempSync(path.join(tmpdir(), 'vo-pub-ig-local-'));
  const videoPath = path.join(dir, 'test.mp4');
  writeFileSync(videoPath, 'dummy');

  const origToken = process.env['INSTAGRAM_ACCESS_TOKEN'];
  const origAcct = process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'];
  process.env['INSTAGRAM_ACCESS_TOKEN'] = 'valid-token';
  process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'] = 'acct-123';

  try {
    const result = await publishToPlatform({
      packageId: 'pkg-003',
      platform: 'instagram',
      accountId: 'acct-123',
      videoPath, // local path — requires public URL
      metadata: { title: 'Test', description: 'Desc', tags: [] },
    });
    // Local path → direct upload fails → n8n fallback
    assert.equal(result.fallbackMode, true);
  } finally {
    if (origToken !== undefined) process.env['INSTAGRAM_ACCESS_TOKEN'] = origToken;
    else delete process.env['INSTAGRAM_ACCESS_TOKEN'];
    if (origAcct !== undefined) process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'] = origAcct;
    else delete process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'];
  }
});
