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
    || generationMode === 'hybrid_image_slideshow_video';
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
