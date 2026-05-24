import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateVideoOrchestratorMetadata,
  _truncateForPlatform,
  type VideoOrchestratorMetadataInput,
} from '../adapters/video-orchestrator-metadata-generator.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal input with all 6 platforms enabled and an optional description.
 */
function makeInput(overrides: Partial<VideoOrchestratorMetadataInput> = {}): VideoOrchestratorMetadataInput {
  return {
    projectId: 'test-project',
    contentItemId: 'test-content-001',
    title: 'Test Video Title',
    description: 'A short description.',
    targetPlatforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'bluesky'],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('generateVideoOrchestratorMetadata: all 6 platforms produce all 6 platform keys', async () => {
  // The AI call will fail in the test environment (no server); the fallback path
  // also uses the enabled-platforms list, so we rely on that code path.
  const result = await generateVideoOrchestratorMetadata(makeInput());

  const expectedPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'bluesky'];
  for (const platform of expectedPlatforms) {
    assert.ok(platform in result.platforms, `Expected platforms to contain key: ${platform}`);
    const entry = result.platforms[platform];
    assert.ok(entry !== undefined, `platforms.${platform} must be defined`);
    assert.ok(typeof entry.title === 'string', `platforms.${platform}.title must be a string`);
    assert.ok(typeof entry.description === 'string', `platforms.${platform}.description must be a string`);
    assert.ok(Array.isArray(entry.tags), `platforms.${platform}.tags must be an array`);
    assert.ok(Array.isArray(entry.hashtags), `platforms.${platform}.hashtags must be an array`);
  }
});

test('generateVideoOrchestratorMetadata: platform descriptions respect max character limits', async () => {
  // Use a very long description to trigger truncation
  const longDescription = 'x'.repeat(6000);
  const result = await generateVideoOrchestratorMetadata(makeInput({ description: longDescription }));

  const limits: Record<string, number> = {
    youtube: 5000,
    tiktok: 2200,
    instagram: 2200,
    facebook: 500,
    linkedin: 3000,
    bluesky: 300,
  };

  for (const [platform, maxLen] of Object.entries(limits)) {
    const entry = result.platforms[platform];
    if (entry !== undefined) {
      assert.ok(
        entry.description.length <= maxLen,
        `platforms.${platform}.description length ${entry.description.length} exceeds max ${maxLen}`,
      );
    }
  }
});

test('generateVideoOrchestratorMetadata: fallback includes all 6 platform keys when all platforms enabled', async () => {
  // Request all 6 platforms; because the AI endpoint is not reachable in tests,
  // the function returns a fallback result.
  const result = await generateVideoOrchestratorMetadata(
    makeInput({ title: 'Fallback Test', description: 'desc' }),
  );

  // The result must come from fallback or ai — either way platforms must all be present
  const facebookEntry = result.platforms['facebook'];
  const linkedinEntry = result.platforms['linkedin'];
  const blueskyEntry = result.platforms['bluesky'];

  assert.ok(facebookEntry !== undefined, 'platforms.facebook must exist in result');
  assert.ok(linkedinEntry !== undefined, 'platforms.linkedin must exist in result');
  assert.ok(blueskyEntry !== undefined, 'platforms.bluesky must exist in result');

  assert.ok(typeof facebookEntry.description === 'string');
  assert.ok(typeof linkedinEntry.description === 'string');
  assert.ok(typeof blueskyEntry.description === 'string');
});

// ── _truncateForPlatform unit tests ──────────────────────────────────────────

test('_truncateForPlatform: returns text unchanged when within limit', () => {
  const text = 'Hello world';
  const result = _truncateForPlatform(text, 'bluesky', 300);
  assert.equal(result, text);
});

test('_truncateForPlatform: truncates to maxChars and appends ellipsis', () => {
  const text = 'a'.repeat(400);
  const result = _truncateForPlatform(text, 'bluesky', 300);
  assert.equal(result.length, 300);
  assert.ok(result.endsWith('...'));
});

test('_truncateForPlatform: text exactly at limit is not truncated', () => {
  const text = 'a'.repeat(300);
  const result = _truncateForPlatform(text, 'bluesky', 300);
  assert.equal(result, text);
  assert.equal(result.length, 300);
});
