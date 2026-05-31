#!/bin/bash
# I-4.2 Thumbnail MediaConvert Preflight
# Tests frame extraction after MediaConvert assembly completes
# Uses Lambda-compatible approach (not MediaConvert output groups)

set -e

REGION="eu-north-1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
JOB_ID="test-001"

VIDEO_KEY="jobs/${JOB_ID}/exports/generated-001-final.mp4"
THUMBNAIL_KEY="jobs/${JOB_ID}/thumbnails/thumbnail-001.png"
VIDEO_S3="s3://${BUCKET}/${VIDEO_KEY}"
THUMBNAIL_S3="s3://${BUCKET}/${THUMBNAIL_KEY}"

FRAME_TIME=3
RESOLUTION="1280x720"

echo "════════════════════════════════════════════════════════════"
echo "I-4.2 Thumbnail Extraction Preflight"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Source video: $VIDEO_S3"
echo "Thumbnail output: $THUMBNAIL_S3"
echo "Frame time: ${FRAME_TIME}s"
echo "Resolution: $RESOLUTION"
echo ""

# ============================================================================
# Step 1: Verify video exists
# ============================================================================
echo "✓ Step 1: Verify video exists"

if ! aws s3api head-object --bucket $BUCKET --key $VIDEO_KEY --region $REGION > /dev/null 2>&1; then
    echo "  ❌ FAIL: Video not found: $VIDEO_S3"
    exit 1
fi
echo "  ✅ Video exists"

# ============================================================================
# Step 2: Download video locally
# ============================================================================
echo "✓ Step 2: Download video locally"

VIDEO_LOCAL="/tmp/mediaconvert-output.mp4"
rm -f $VIDEO_LOCAL

aws s3 cp $VIDEO_S3 $VIDEO_LOCAL --region $REGION --quiet

if [ ! -f $VIDEO_LOCAL ]; then
    echo "  ❌ FAIL: Could not download video"
    exit 1
fi

VIDEO_SIZE=$(ls -lh $VIDEO_LOCAL | awk '{print $5}')
echo "  ✅ Downloaded: $VIDEO_LOCAL ($VIDEO_SIZE)"

# ============================================================================
# Step 3: Extract frame with ffmpeg
# ============================================================================
echo "✓ Step 3: Extract frame at ${FRAME_TIME}s"

THUMBNAIL_LOCAL="/tmp/mediaconvert-thumbnail.png"
rm -f $THUMBNAIL_LOCAL

if ! command -v ffmpeg &> /dev/null; then
    echo "  ❌ FAIL: ffmpeg not found"
    echo "  Install: brew install ffmpeg"
    exit 1
fi

ffmpeg -i $VIDEO_LOCAL \
  -ss $FRAME_TIME \
  -vframes 1 \
  -vf "scale=${RESOLUTION}" \
  -update 1 \
  -y $THUMBNAIL_LOCAL 2>&1 | grep -E "error|Error|ERROR" || true

# Give ffmpeg a moment to finish writing
sleep 1

if [ ! -f $THUMBNAIL_LOCAL ]; then
    echo "  ❌ FAIL: ffmpeg frame extraction failed"
    echo "  File: $THUMBNAIL_LOCAL"
    ls -la /tmp/mediaconvert* 2>&1 || echo "  No mediaconvert files found"
    exit 1
fi

THUMB_SIZE=$(ls -lh $THUMBNAIL_LOCAL | awk '{print $5}')
echo "  ✅ Frame extracted: $THUMBNAIL_LOCAL ($THUMB_SIZE)"
echo "     Resolution: $RESOLUTION"

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

HEAD=$(aws s3api head-object \
  --bucket $BUCKET \
  --key $THUMBNAIL_KEY \
  --region $REGION 2>&1)

if ! echo "$HEAD" | jq . > /dev/null 2>&1; then
    echo "  ❌ FAIL: Could not verify S3 object"
    exit 1
fi

S3_SIZE=$(echo "$HEAD" | jq -r '.ContentLength')
S3_ETAG=$(echo "$HEAD" | jq -r '.ETag')

echo "  ✅ Verified in S3"
echo "     Size: $S3_SIZE bytes"
echo "     ETag: $S3_ETAG"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ I-4.2 Thumbnail Extraction Preflight PASSED"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Thumbnail successfully generated and stored:"
echo "  Source: $VIDEO_S3"
echo "  Frame: ${FRAME_TIME}s"
echo "  Local: $THUMBNAIL_LOCAL ($THUMB_SIZE)"
echo "  S3: $THUMBNAIL_S3 ($S3_SIZE bytes)"
echo ""
echo "Ready for Step Functions integration:"
echo "  Lambda will run this extraction after MediaConvert completes"
echo "  State machine will invoke extract-thumbnail Lambda"
echo ""
