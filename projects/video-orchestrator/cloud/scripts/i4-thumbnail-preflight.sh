#!/bin/bash
# I-4 Thumbnail Preflight
# Generates a thumbnail frame from the generated-001-final.mp4 video
# Approach: frame extraction (proven, uses existing artifacts)
# Alternative: Bedrock image generation (blocked on API contract uncertainty)

set -e

REGION="eu-north-1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
JOB_ID="test-001"

VIDEO_S3="s3://${BUCKET}/jobs/${JOB_ID}/exports/generated-001-final.mp4"
THUMBNAIL_S3="s3://${BUCKET}/jobs/${JOB_ID}/thumbnails/thumbnail-001.png"

VIDEO_LOCAL="/tmp/generated-001-final.mp4"
THUMBNAIL_LOCAL="/tmp/thumbnail-001.png"

echo "════════════════════════════════════════════════════════════"
echo "I-4 Thumbnail Generation Preflight"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Method: Frame extraction from generated video (I-3 output)"
echo "Source: $VIDEO_S3"
echo "Output: $THUMBNAIL_S3"
echo ""

# ============================================================================
# Step 1: Verify generated video exists
# ============================================================================
echo "✓ Step 1: Verify generated video exists"

if ! aws s3api head-object --bucket $BUCKET --key "jobs/${JOB_ID}/exports/generated-001-final.mp4" --region $REGION > /dev/null 2>&1; then
    echo "  ❌ FAIL: generated-001-final.mp4 not found"
    exit 1
fi
echo "  ✅ Video exists in S3"

# ============================================================================
# Step 2: Download video
# ============================================================================
echo "✓ Step 2: Download video from S3"

rm -f $VIDEO_LOCAL
aws s3 cp $VIDEO_S3 $VIDEO_LOCAL --region $REGION --quiet

if [ ! -f $VIDEO_LOCAL ]; then
    echo "  ❌ FAIL: Could not download video"
    exit 1
fi

VIDEO_SIZE=$(ls -lh $VIDEO_LOCAL | awk '{print $5}')
echo "  ✅ Downloaded: $VIDEO_LOCAL ($VIDEO_SIZE)"

# ============================================================================
# Step 3: Extract frame at 3-second mark
# ============================================================================
echo "✓ Step 3: Extract frame at 3-second mark"

rm -f $THUMBNAIL_LOCAL

ffmpeg -i $VIDEO_LOCAL \
  -ss 3 \
  -vframes 1 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -y $THUMBNAIL_LOCAL > /dev/null 2>&1 || {
    echo "  ❌ FAIL: Could not extract frame with ffmpeg"
    echo "  Ensure ffmpeg is installed: brew install ffmpeg"
    exit 1
}

if [ ! -f $THUMBNAIL_LOCAL ]; then
    echo "  ❌ FAIL: Could not create thumbnail file"
    exit 1
fi

THUMB_SIZE=$(ls -lh $THUMBNAIL_LOCAL | awk '{print $5}')
echo "  ✅ Thumbnail extracted: $THUMBNAIL_LOCAL ($THUMB_SIZE)"
echo "     Resolution: 1280x720"
echo "     Format: PNG"

# ============================================================================
# Step 4: Upload to S3
# ============================================================================
echo "✓ Step 4: Upload to S3"

aws s3 cp $THUMBNAIL_LOCAL \
  $THUMBNAIL_S3 \
  --region $REGION \
  --content-type image/png \
  --quiet

echo "  ✅ Uploaded to: $THUMBNAIL_S3"

# ============================================================================
# Step 5: Verify S3 object
# ============================================================================
echo "✓ Step 5: Verify S3 object"

HEAD_RESPONSE=$(aws s3api head-object \
  --bucket $BUCKET \
  --key "jobs/${JOB_ID}/thumbnails/thumbnail-001.png" \
  --region $REGION 2>&1)

if ! echo "$HEAD_RESPONSE" | jq . > /dev/null 2>&1; then
    echo "  ❌ FAIL: Could not verify S3 object"
    exit 1
fi

S3_SIZE=$(echo "$HEAD_RESPONSE" | jq -r '.ContentLength')
S3_ETAG=$(echo "$HEAD_RESPONSE" | jq -r '.ETag')
LAST_MOD=$(echo "$HEAD_RESPONSE" | jq -r '.LastModified')

echo "  ✅ S3 object verified"
echo "     Size: $S3_SIZE bytes"
echo "     ETag: $S3_ETAG"
echo "     Modified: $LAST_MOD"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ I-4 Thumbnail Preflight PASSED"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Thumbnail successfully generated and stored:"
echo "  Local:  $THUMBNAIL_LOCAL ($THUMB_SIZE)"
echo "  S3:     $THUMBNAIL_S3 ($S3_SIZE bytes)"
echo ""
echo "Method: Frame extraction (I-3 video → 3-second frame → 1280x720 PNG)"
echo ""
echo "Next step: Update metadata/assets.json with thumbnail reference"
echo ""
