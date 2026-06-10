/**
 * Pure helpers for publish gate ordering logic.
 * Shared between video-orchestrator-provider.ts and tests.
 * No I/O, no S3, no async - pure logic only.
 */

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested';

/**
 * Infer generation mode from metadata objects (no I/O).
 * Follows precedence: publishJson > statusJson > assetsJson
 */
export function inferGenerationModeForPublishGate(input: {
  publishJson: Record<string, unknown> | null;
  statusJson: Record<string, unknown> | null;
  assetsJson: Record<string, unknown> | null;
}): string | null {
  const stringValue = (val: unknown): string | null => {
    return typeof val === 'string' && val.length > 0 ? val : null;
  };

  return stringValue(input.publishJson?.generationMode)
    ?? stringValue(input.statusJson?.generationMode)
    ?? stringValue(input.assetsJson?.generationMode);
}

/**
 * Check if a generation mode is a generated-media type requiring review.
 */
export function isGeneratedMediaGenerationMode(generationMode: string | null | undefined): boolean {
  return generationMode === 'hybrid_storyboard_fixture_video'
    || generationMode === 'hybrid_slideshow_video'
    || generationMode === 'hybrid_image_slideshow_video'
    || generationMode === 'hybrid_animated_video';
}

/**
 * Determine if this generation mode requires review approval before publish.
 */
export function shouldRequireReviewGate(generationMode: string | null | undefined): boolean {
  return isGeneratedMediaGenerationMode(generationMode);
}

/**
 * Check if review approval is satisfied for a given review status.
 * Returns true if review is approved.
 * Returns false if review is pending or changes_requested.
 */
export function isReviewApproved(reviewStatus: ReviewStatus | null | undefined): boolean {
  return reviewStatus === 'approved';
}

/**
 * Determine the publish gate result code based on generation mode and review status.
 * This models the decision logic from runControlledYouTubePublish().
 *
 * Returns:
 * - 'review_required': generated-media with non-approved review (gate check happens first)
 * - 'asset_check_needed': no review gate (proceed to asset resolution)
 */
export function publishGateDecision(input: {
  generationMode: string | null | undefined;
  reviewStatus: ReviewStatus | null | undefined;
}): 'review_required' | 'asset_check_needed' {
  if (shouldRequireReviewGate(input.generationMode)) {
    // For generated-media, review gate is checked first
    if (!isReviewApproved(input.reviewStatus)) {
      return 'review_required';
    }
  }
  // No review gate, or review already approved: proceed to asset resolution
  return 'asset_check_needed';
}

/**
 * Validate generated-media mode publish assets.
 * For generated modes (hybrid_slideshow_video, hybrid_image_slideshow_video, hybrid_animated_video), ensure:
 * - videoKey does not point to fixture (jobs/test-001)
 * - thumbnailKey exists and points to generated location
 * - videoKey must point to jobs/<jobId>/exports/ or jobs/<jobId>/video-generated/
 *
 * Returns { valid: true } or { valid: false, reason: "..." }
 */
export function validateGeneratedMediaPublishAssets(input: {
  generationMode: string | null | undefined;
  videoKey: string | null | undefined;
  thumbnailKey: string | null | undefined;
  jobId: string;
}): { valid: true } | { valid: false; reason: string } {
  const mode = input.generationMode;
  const jobId = input.jobId;
  const videoKey = input.videoKey;
  const thumbnailKey = input.thumbnailKey;

  // Only validate generated-media modes.
  if (mode !== 'hybrid_slideshow_video' && mode !== 'hybrid_image_slideshow_video' && mode !== 'hybrid_animated_video') {
    // Other modes (fixture/hybrid_tts, etc.) can use any key
    return { valid: true };
  }

  // Validate videoKey
  if (!videoKey || typeof videoKey !== 'string' || videoKey.length === 0) {
    return { valid: false, reason: 'videoKey is missing for generated-media mode' };
  }
  if (videoKey.includes('jobs/test-001')) {
    return { valid: false, reason: `videoKey must not point to fixture (test-001): ${videoKey}` };
  }
  if (!videoKey.includes(`jobs/${jobId}`)) {
    return { valid: false, reason: `videoKey must belong to this job (${jobId}): ${videoKey}` };
  }
  if (!videoKey.includes('/exports/') && !videoKey.includes('/video-generated/')) {
    return {
      valid: false,
      reason: `videoKey must be in exports/ or video-generated/ subdirectory: ${videoKey}`,
    };
  }

  // Validate thumbnailKey
  if (!thumbnailKey || typeof thumbnailKey !== 'string' || thumbnailKey.length === 0) {
    return { valid: false, reason: 'thumbnailKey is missing for generated-media mode' };
  }
  if (thumbnailKey.includes('jobs/test-001')) {
    return { valid: false, reason: `thumbnailKey must not point to fixture (test-001): ${thumbnailKey}` };
  }
  if (!thumbnailKey.includes(`jobs/${jobId}`)) {
    return { valid: false, reason: `thumbnailKey must belong to this job (${jobId}): ${thumbnailKey}` };
  }
  if (!thumbnailKey.includes('/exports/')) {
    return {
      valid: false,
      reason: `thumbnailKey must be in exports/ subdirectory: ${thumbnailKey}`,
    };
  }

  return { valid: true };
}
