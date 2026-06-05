import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferGenerationModeForPublishGate,
  isGeneratedMediaGenerationMode,
  shouldRequireReviewGate,
  isReviewApproved,
  publishGateDecision,
  validateGeneratedMediaPublishAssets,
  type ReviewStatus,
} from '../providers/video-orchestrator-publish-gate.js';

/**
 * Test A: Generated-media with pending review
 *
 * Input:
 *   - generationMode: "hybrid_image_slideshow_video" (generated-media type)
 *   - reviewStatus: "pending" (not approved)
 *
 * Expected:
 *   - Gate decision: 'review_required'
 *   - This means publish_review_required is returned BEFORE asset resolution
 */
test('A: generated-media pending review blocks publish', (t) => {
  const decision = publishGateDecision({
    generationMode: 'hybrid_image_slideshow_video',
    reviewStatus: 'pending',
  });

  assert.strictEqual(decision, 'review_required', 'should require review before proceeding');
});

/**
 * Test B: Generated-media with changes_requested review
 *
 * Similar to A, but review status is changes_requested (still not approved).
 */
test('B: generated-media changes_requested blocks publish', (t) => {
  const decision = publishGateDecision({
    generationMode: 'hybrid_storyboard_fixture_video',
    reviewStatus: 'changes_requested',
  });

  assert.strictEqual(decision, 'review_required', 'changes_requested should also block');
});

/**
 * Test C: Generated-media with approved review
 *
 * Input:
 *   - generationMode: "hybrid_image_slideshow_video"
 *   - reviewStatus: "approved"
 *
 * Expected:
 *   - Gate decision: 'asset_check_needed'
 *   - This allows proceeding to asset resolution
 */
test('C: generated-media approved review allows asset check', (t) => {
  const decision = publishGateDecision({
    generationMode: 'hybrid_slideshow_video',
    reviewStatus: 'approved',
  });

  assert.strictEqual(decision, 'asset_check_needed', 'approved review should proceed to asset check');
});

/**
 * Test D: Non-generated-media with pending review
 *
 * Input:
 *   - generationMode: "hybrid_tts_fixture_video" (NOT generated-media)
 *   - reviewStatus: "pending"
 *
 * Expected:
 *   - Gate decision: 'asset_check_needed'
 *   - Review gate does not apply; asset resolution proceeds normally
 */
test('D: non-generated-media ignores review gate', (t) => {
  const decision = publishGateDecision({
    generationMode: 'hybrid_tts_fixture_video',
    reviewStatus: 'pending',
  });

  assert.strictEqual(decision, 'asset_check_needed', 'non-generated-media should skip review gate');
});

/**
 * Test E: Fixture mode with pending review
 */
test('E: fixture mode ignores review gate', (t) => {
  const decision = publishGateDecision({
    generationMode: 'fixture',
    reviewStatus: 'pending',
  });

  assert.strictEqual(decision, 'asset_check_needed', 'fixture should skip review gate');
});

/**
 * Test F: Unknown generation mode (null)
 *
 * Input:
 *   - generationMode: null (not determined)
 *   - reviewStatus: "pending"
 *
 * Expected:
 *   - Gate decision: 'asset_check_needed'
 *   - No early review gate; asset resolution can proceed
 */
test('F: unknown generation mode skips review gate', (t) => {
  const decision = publishGateDecision({
    generationMode: null,
    reviewStatus: 'pending',
  });

  assert.strictEqual(decision, 'asset_check_needed', 'unknown mode should proceed to asset check');
});

/**
 * Test G: Generation mode inference - publishJson wins
 *
 * When multiple metadata sources have generationMode, publishJson takes precedence.
 */
test('G: generation mode precedence - publishJson over statusJson/assetsJson', (t) => {
  const mode = inferGenerationModeForPublishGate({
    publishJson: { generationMode: 'hybrid_slideshow_video' },
    statusJson: { generationMode: 'fixture' },
    assetsJson: { generationMode: 'fixture' },
  });

  assert.strictEqual(mode, 'hybrid_slideshow_video', 'publishJson should win');
});

/**
 * Test H: Generation mode inference - statusJson used if publishJson missing
 */
test('H: generation mode precedence - statusJson when publishJson missing', (t) => {
  const mode = inferGenerationModeForPublishGate({
    publishJson: null,
    statusJson: { generationMode: 'hybrid_storyboard_fixture_video' },
    assetsJson: { generationMode: 'fixture' },
  });

  assert.strictEqual(mode, 'hybrid_storyboard_fixture_video', 'statusJson should be used');
});

/**
 * Test I: Generation mode inference - assetsJson used if neither publishJson nor statusJson
 */
test('I: generation mode precedence - assetsJson last resort', (t) => {
  const mode = inferGenerationModeForPublishGate({
    publishJson: null,
    statusJson: null,
    assetsJson: { generationMode: 'hybrid_image_slideshow_video' },
  });

  assert.strictEqual(mode, 'hybrid_image_slideshow_video', 'assetsJson should be used');
});

/**
 * Test J: Generation mode inference - all null returns null
 */
test('J: generation mode inference - all sources null', (t) => {
  const mode = inferGenerationModeForPublishGate({
    publishJson: null,
    statusJson: null,
    assetsJson: null,
  });

  assert.strictEqual(mode, null, 'should return null when no source has generationMode');
});

/**
 * Test K: isGeneratedMediaGenerationMode detects all three types
 */
test('K: isGeneratedMediaGenerationMode recognizes all generated-media types', (t) => {
  assert.strictEqual(
    isGeneratedMediaGenerationMode('hybrid_storyboard_fixture_video'),
    true,
    'hybrid_storyboard_fixture_video is generated-media'
  );
  assert.strictEqual(
    isGeneratedMediaGenerationMode('hybrid_slideshow_video'),
    true,
    'hybrid_slideshow_video is generated-media'
  );
  assert.strictEqual(
    isGeneratedMediaGenerationMode('hybrid_image_slideshow_video'),
    true,
    'hybrid_image_slideshow_video is generated-media'
  );
});

/**
 * Test L: isGeneratedMediaGenerationMode rejects non-generated types
 */
test('L: isGeneratedMediaGenerationMode rejects non-generated types', (t) => {
  assert.strictEqual(isGeneratedMediaGenerationMode('fixture'), false, 'fixture is not generated-media');
  assert.strictEqual(isGeneratedMediaGenerationMode('hybrid_tts'), false, 'hybrid_tts is not generated-media');
  assert.strictEqual(isGeneratedMediaGenerationMode('ai'), false, 'ai is not generated-media');
  assert.strictEqual(isGeneratedMediaGenerationMode(null), false, 'null is not generated-media');
});

/**
 * Test M: shouldRequireReviewGate distinguishes generated-media
 */
test('M: shouldRequireReviewGate returns true only for generated-media', (t) => {
  assert.strictEqual(
    shouldRequireReviewGate('hybrid_image_slideshow_video'),
    true,
    'generated-media requires review gate'
  );
  assert.strictEqual(
    shouldRequireReviewGate('fixture'),
    false,
    'fixture does not require review gate'
  );
});

/**
 * Test N: isReviewApproved validates approval status
 */
test('N: isReviewApproved checks approval correctly', (t) => {
  assert.strictEqual(isReviewApproved('approved'), true, 'approved is approved');
  assert.strictEqual(isReviewApproved('pending'), false, 'pending is not approved');
  assert.strictEqual(isReviewApproved('changes_requested'), false, 'changes_requested is not approved');
  assert.strictEqual(isReviewApproved(null), false, 'null is not approved');
});

/**
 * Test O: Gate decision matrix - comprehensive behavior
 *
 * Verifies the core gate ordering behavior across all combinations:
 * - Generated-media without approval → review_required
 * - Generated-media with approval → asset_check_needed
 * - Non-generated-media → asset_check_needed (always)
 */
test('O: gate decision matrix - all combinations', (t) => {
  const testCases: Array<{
    name: string;
    generationMode: string | null;
    reviewStatus: ReviewStatus | null;
    expected: 'review_required' | 'asset_check_needed';
  }> = [
    // Generated-media + pending review → review_required
    {
      name: 'generated + pending',
      generationMode: 'hybrid_storyboard_fixture_video',
      reviewStatus: 'pending',
      expected: 'review_required',
    },
    // Generated-media + changes_requested → review_required
    {
      name: 'generated + changes_requested',
      generationMode: 'hybrid_slideshow_video',
      reviewStatus: 'changes_requested',
      expected: 'review_required',
    },
    // Generated-media + approved → asset_check_needed
    {
      name: 'generated + approved',
      generationMode: 'hybrid_image_slideshow_video',
      reviewStatus: 'approved',
      expected: 'asset_check_needed',
    },
    // Non-generated + pending → asset_check_needed (no review gate)
    {
      name: 'fixture + pending',
      generationMode: 'fixture',
      reviewStatus: 'pending',
      expected: 'asset_check_needed',
    },
    // Non-generated + approved → asset_check_needed
    {
      name: 'fixture + approved',
      generationMode: 'fixture',
      reviewStatus: 'approved',
      expected: 'asset_check_needed',
    },
    // Unknown mode → asset_check_needed
    {
      name: 'unknown + pending',
      generationMode: null,
      reviewStatus: 'pending',
      expected: 'asset_check_needed',
    },
  ];

  for (const tc of testCases) {
    const decision = publishGateDecision({
      generationMode: tc.generationMode,
      reviewStatus: tc.reviewStatus,
    });
    assert.strictEqual(
      decision,
      tc.expected,
      `${tc.name}: expected ${tc.expected}, got ${decision}`
    );
  }
});

/**
 * TEST SUITE: validateGeneratedMediaPublishAssets
 *
 * Validates that generated-media modes (hybrid_slideshow_video, hybrid_image_slideshow_video)
 * have strict asset validation: no fixture fallback, videoKey/thumbnailKey must belong to jobId,
 * and paths must be in /exports/ or /video-generated/ subdirectories.
 */

/**
 * Test P: validateGeneratedMediaPublishAssets - fixture mode skips validation
 *
 * Non-generated-media modes (fixture, hybrid_tts_fixture_video, etc.) should
 * always return { valid: true } regardless of asset keys.
 */
test('P: validateGeneratedMediaPublishAssets skips fixture modes', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_tts_fixture_video',
    videoKey: 'jobs/test-001/exports/video.mp4',
    thumbnailKey: 'jobs/test-001/exports/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.deepStrictEqual(result, { valid: true }, 'fixture mode should skip validation');
});

/**
 * Test Q: validateGeneratedMediaPublishAssets - missing videoKey rejects
 */
test('Q: validateGeneratedMediaPublishAssets rejects missing videoKey', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_slideshow_video',
    videoKey: null,
    thumbnailKey: 'jobs/xyz-123/exports/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'missing videoKey should fail');
  assert(result.valid === false && result.reason.includes('videoKey is missing'), 'should mention videoKey missing');
});

/**
 * Test R: validateGeneratedMediaPublishAssets - missing thumbnailKey rejects
 */
test('R: validateGeneratedMediaPublishAssets rejects missing thumbnailKey', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/xyz-123/exports/video.mp4',
    thumbnailKey: null,
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'missing thumbnailKey should fail');
  assert(result.valid === false && result.reason.includes('thumbnailKey is missing'), 'should mention thumbnailKey missing');
});

/**
 * Test S: validateGeneratedMediaPublishAssets - fixture videoKey rejects
 *
 * This is the critical production incident: hybrid_image_slideshow must not
 * allow videoKey pointing to jobs/test-001.
 */
test('S: validateGeneratedMediaPublishAssets rejects fixture videoKey (test-001)', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/test-001/exports/video.mp4',
    thumbnailKey: 'jobs/xyz-123/exports/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'fixture videoKey should fail');
  assert(result.valid === false && result.reason.includes('test-001'), 'should mention test-001 fixture');
});

/**
 * Test T: validateGeneratedMediaPublishAssets - fixture thumbnailKey rejects
 */
test('T: validateGeneratedMediaPublishAssets rejects fixture thumbnailKey (test-001)', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_slideshow_video',
    videoKey: 'jobs/xyz-123/exports/video.mp4',
    thumbnailKey: 'jobs/test-001/exports/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'fixture thumbnailKey should fail');
  assert(result.valid === false && result.reason.includes('test-001'), 'should mention test-001 fixture');
});

/**
 * Test U: validateGeneratedMediaPublishAssets - mismatched jobId rejects
 */
test('U: validateGeneratedMediaPublishAssets rejects mismatched jobId in videoKey', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/different-123/exports/video.mp4',
    thumbnailKey: 'jobs/xyz-123/exports/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'mismatched jobId should fail');
  assert(result.valid === false && result.reason.includes('must belong to this job'), 'should mention jobId mismatch');
});

/**
 * Test V: validateGeneratedMediaPublishAssets - videoKey not in exports/video-generated rejects
 */
test('V: validateGeneratedMediaPublishAssets rejects videoKey not in exports/ or video-generated/', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_slideshow_video',
    videoKey: 'jobs/xyz-123/metadata/video.mp4',
    thumbnailKey: 'jobs/xyz-123/exports/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'videoKey not in exports/video-generated should fail');
  assert(result.valid === false && result.reason.includes('exports/ or video-generated/'), 'should mention subdirectory requirement');
});

/**
 * Test W: validateGeneratedMediaPublishAssets - thumbnailKey not in exports/ rejects
 */
test('W: validateGeneratedMediaPublishAssets rejects thumbnailKey not in exports/', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/xyz-123/exports/video.mp4',
    thumbnailKey: 'jobs/xyz-123/metadata/thumb.jpg',
    jobId: 'xyz-123',
  });

  assert.strictEqual(result.valid, false, 'thumbnailKey not in exports/ should fail');
  assert(result.valid === false && result.reason.includes('exports/'), 'should mention exports/ requirement');
});

/**
 * Test X: validateGeneratedMediaPublishAssets - valid with exports paths
 */
test('X: validateGeneratedMediaPublishAssets accepts valid exports paths', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_slideshow_video',
    videoKey: 'jobs/xyz-123/exports/slideshow.mp4',
    thumbnailKey: 'jobs/xyz-123/exports/thumbnail-001.jpg',
    jobId: 'xyz-123',
  });

  assert.deepStrictEqual(result, { valid: true }, 'valid exports paths should pass');
});

/**
 * Test Y: validateGeneratedMediaPublishAssets - valid with video-generated path for videoKey
 */
test('Y: validateGeneratedMediaPublishAssets accepts video-generated/ path for videoKey', (t) => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/xyz-123/video-generated/slideshow-final.mp4',
    thumbnailKey: 'jobs/xyz-123/exports/thumbnail-001.jpg',
    jobId: 'xyz-123',
  });

  assert.deepStrictEqual(result, { valid: true }, 'valid video-generated/ videoKey should pass');
});

/**
 * Test Z: validateGeneratedMediaPublishAssets - hybrid_image_slideshow_video specifically
 *
 * Ensures the mode that had the production incident is properly validated.
 */
test('Z: validateGeneratedMediaPublishAssets validates hybrid_image_slideshow_video', (t) => {
  // Valid case
  const validResult = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/abc-999/exports/image-slideshow.mp4',
    thumbnailKey: 'jobs/abc-999/exports/thumb.jpg',
    jobId: 'abc-999',
  });
  assert.deepStrictEqual(validResult, { valid: true }, 'valid hybrid_image_slideshow should pass');

  // Invalid: fixture videoKey
  const invalidResult = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: 'jobs/test-001/exports/proof-video.mp4',
    thumbnailKey: 'jobs/abc-999/exports/thumb.jpg',
    jobId: 'abc-999',
  });
  assert.strictEqual(invalidResult.valid, false, 'fixture videoKey should fail');
});
