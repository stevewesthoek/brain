import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_CAPABILITIES,
  publishToPlatform,
  type PublishRequest,
  type PublishingPlatform,
} from '../adapters/vo-studio-publishing-platform.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpVideoFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vo-pub-test-'));
  const filePath = path.join(dir, 'test.mp4');
  // Write dummy content so existsSync + statSync succeed
  fs.writeFileSync(filePath, 'dummy-mp4-content');
  return filePath;
}

function makeRequest(overrides: Partial<PublishRequest> & { platform: PublishingPlatform }): PublishRequest {
  return {
    packageId: 'pkg-test-001',
    accountId: 'acct-test',
    videoPath: tmpVideoFile(),
    metadata: {
      title: 'Test video title',
      description: 'Test description',
      tags: ['test'],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PLATFORM_CAPABILITIES static shape
// ---------------------------------------------------------------------------

test('PLATFORM_CAPABILITIES has entries for all six platforms', () => {
  const platforms: PublishingPlatform[] = ['youtube', 'tiktok', 'instagram', 'linkedin', 'facebook', 'bluesky'];
  for (const p of platforms) {
    assert.ok(PLATFORM_CAPABILITIES[p], `missing capabilities entry for ${p}`);
  }
});

test('youtube capability has direct_upload true', () => {
  assert.equal(PLATFORM_CAPABILITIES.youtube.direct_upload, true);
});

test('tiktok capability has direct_upload true', () => {
  assert.equal(PLATFORM_CAPABILITIES.tiktok.direct_upload, true);
});

test('instagram capability has direct_upload true', () => {
  assert.equal(PLATFORM_CAPABILITIES.instagram.direct_upload, true);
});

test('linkedin has direct_upload false (n8n fallback only)', () => {
  assert.equal(PLATFORM_CAPABILITIES.linkedin.direct_upload, false);
});

test('facebook has direct_upload false (n8n fallback only)', () => {
  assert.equal(PLATFORM_CAPABILITIES.facebook.direct_upload, false);
});

test('bluesky has direct_upload false (n8n fallback only)', () => {
  assert.equal(PLATFORM_CAPABILITIES.bluesky.direct_upload, false);
});

test('all capability entries have required numeric and array fields', () => {
  const platforms: PublishingPlatform[] = ['youtube', 'tiktok', 'instagram', 'linkedin', 'facebook', 'bluesky'];
  for (const platform of platforms) {
    const cap = PLATFORM_CAPABILITIES[platform];
    assert.ok(typeof cap.max_title_length === 'number', `${platform}: max_title_length must be a number`);
    assert.ok(typeof cap.max_description_length === 'number', `${platform}: max_description_length must be a number`);
    assert.ok(Array.isArray(cap.supported_formats), `${platform}: supported_formats must be an array`);
    assert.ok(Array.isArray(cap.aspect_ratios), `${platform}: aspect_ratios must be an array`);
    assert.ok(typeof cap.rate_limit?.requests_per_hour === 'number', `${platform}: rate_limit.requests_per_hour must be a number`);
  }
});

// ---------------------------------------------------------------------------
// publishToPlatform — validation guards
// ---------------------------------------------------------------------------

test('publishToPlatform returns fallback mode when video file does not exist', async () => {
  const req = makeRequest({ platform: 'youtube' });
  req.videoPath = '/nonexistent/path/video.mp4';
  const result = await publishToPlatform(req);
  assert.equal(result.fallbackMode, true);
});

test('publishToPlatform returns fallback mode when title exceeds platform limit', async () => {
  const req = makeRequest({ platform: 'youtube' });
  req.metadata.title = 'A'.repeat(PLATFORM_CAPABILITIES.youtube.max_title_length + 1);
  const result = await publishToPlatform(req);
  assert.equal(result.fallbackMode, true);
});

test('publishToPlatform returns fallback mode when description exceeds platform limit', async () => {
  const req = makeRequest({ platform: 'instagram' });
  req.metadata.description = 'D'.repeat(PLATFORM_CAPABILITIES.instagram.max_description_length + 1);
  const result = await publishToPlatform(req);
  assert.equal(result.fallbackMode, true);
});

// ---------------------------------------------------------------------------
// publishToPlatform — direct-upload platforms
// ---------------------------------------------------------------------------

test('publishToPlatform YouTube stub returns ok with publishedUrl', async () => {
  const req = makeRequest({ platform: 'youtube' });
  const result = await publishToPlatform(req);
  assert.equal(result.ok, true);
  assert.ok(result.publishedUrl?.includes('youtube.com'), 'publishedUrl should contain youtube.com');
  assert.ok(result.videoId, 'videoId should be set');
  assert.equal(result.fallbackMode, undefined); // direct path, not fallback
});

test('publishToPlatform TikTok falls back to n8n when TIKTOK_ACCESS_TOKEN not configured', async () => {
  // In test env, TIKTOK_ACCESS_TOKEN is not set — expect n8n fallback path
  const orig = process.env['TIKTOK_ACCESS_TOKEN'];
  delete process.env['TIKTOK_ACCESS_TOKEN'];
  try {
    const req = makeRequest({ platform: 'tiktok' });
    const result = await publishToPlatform(req);
    assert.equal(result.fallbackMode, true);
    assert.equal(typeof result.ok, 'boolean');
  } finally {
    if (orig !== undefined) process.env['TIKTOK_ACCESS_TOKEN'] = orig;
  }
});

test('publishToPlatform Instagram falls back to n8n when credentials not configured', async () => {
  // In test env, INSTAGRAM_* vars are not set — expect n8n fallback path
  const origToken = process.env['INSTAGRAM_ACCESS_TOKEN'];
  const origAcct = process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'];
  delete process.env['INSTAGRAM_ACCESS_TOKEN'];
  delete process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'];
  try {
    const req = makeRequest({ platform: 'instagram' });
    const result = await publishToPlatform(req);
    assert.equal(result.fallbackMode, true);
    assert.equal(typeof result.ok, 'boolean');
  } finally {
    if (origToken !== undefined) process.env['INSTAGRAM_ACCESS_TOKEN'] = origToken;
    if (origAcct !== undefined) process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'] = origAcct;
  }
});

// ---------------------------------------------------------------------------
// publishToPlatform — n8n fallback platforms (no webhook configured in test env)
// ---------------------------------------------------------------------------

test('publishToPlatform LinkedIn always uses n8n fallback path', async () => {
  const req = makeRequest({ platform: 'linkedin' });
  const result = await publishToPlatform(req);
  // No n8n webhook configured in test env: ok=false but fallbackMode must be true
  assert.equal(result.fallbackMode, true);
});

test('publishToPlatform Facebook always uses n8n fallback path', async () => {
  const req = makeRequest({ platform: 'facebook' });
  const result = await publishToPlatform(req);
  assert.equal(result.fallbackMode, true);
});

test('publishToPlatform Bluesky always uses n8n fallback path', async () => {
  const req = makeRequest({ platform: 'bluesky' });
  const result = await publishToPlatform(req);
  assert.equal(result.fallbackMode, true);
});

// ---------------------------------------------------------------------------
// publishToPlatform — PublishResult shape invariants
// ---------------------------------------------------------------------------

test('PublishResult always has ok boolean field for all platforms', async () => {
  const platforms: PublishingPlatform[] = ['youtube', 'tiktok', 'instagram', 'linkedin', 'facebook', 'bluesky'];
  for (const platform of platforms) {
    const req = makeRequest({ platform });
    const result = await publishToPlatform(req);
    assert.ok(typeof result.ok === 'boolean', `${platform}: result.ok must be a boolean`);
  }
});
