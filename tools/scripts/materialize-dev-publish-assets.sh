#!/bin/bash
# Dev-only: copy real-001 exports to a fixture job's S3 + local paths so dry-run can pass.
# Does NOT approve the review — use the API or UI to do that after this runs.
set -e

FIXTURE_DONOR="prochat-real-001"
FIXTURE_JOB="${1:-prochat-prompt-1780856968989-make-a-video-of-a-box-}"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"
JOBS_ROOT="$(cd "$(dirname "$0")/../../projects/video-orchestrator/cloud/jobs" && pwd)"

echo "Materializing dev publish assets"
echo "  Donor : $FIXTURE_DONOR"
echo "  Target: $FIXTURE_JOB"
echo ""

DONOR_VIDEO="jobs/${FIXTURE_DONOR}/exports/generated-001-final.mp4"
DONOR_THUMB="jobs/${FIXTURE_DONOR}/exports/thumbnail-001.jpg"
TARGET_VIDEO="jobs/${FIXTURE_JOB}/exports/generated-001-final.mp4"
TARGET_THUMB="jobs/${FIXTURE_JOB}/exports/thumbnail-001.jpg"

# --- S3 copy ---
echo "Step 1: Copying assets in S3..."
echo "  Bucket: $BUCKET | Region: $REGION"

if aws s3api head-object --bucket "$BUCKET" --key "$TARGET_VIDEO" --region "$REGION" &>/dev/null; then
  echo "  S3 video already present, skipping"
else
  if ! aws s3 cp "s3://$BUCKET/$DONOR_VIDEO" "s3://$BUCKET/$TARGET_VIDEO" --region "$REGION"; then
    echo "❌ Error: Failed to copy video from S3"
    echo "  Source: s3://$BUCKET/$DONOR_VIDEO"
    echo "  Target: s3://$BUCKET/$TARGET_VIDEO"
    echo "  Check AWS credentials and S3 permissions."
    exit 1
  fi
  echo "  S3 video copied"
fi

if aws s3api head-object --bucket "$BUCKET" --key "$TARGET_THUMB" --region "$REGION" &>/dev/null; then
  echo "  S3 thumbnail already present, skipping"
else
  if ! aws s3 cp "s3://$BUCKET/$DONOR_THUMB" "s3://$BUCKET/$TARGET_THUMB" --region "$REGION"; then
    echo "❌ Error: Failed to copy thumbnail from S3"
    echo "  Source: s3://$BUCKET/$DONOR_THUMB"
    echo "  Target: s3://$BUCKET/$TARGET_THUMB"
    echo "  Check AWS credentials and S3 permissions."
    exit 1
  fi
  echo "  S3 thumbnail copied"
fi
echo ""

# --- Local copy (for checkPublishAssetsAvailable fast-path) ---
echo "Step 2: Copying assets locally..."
TARGET_EXPORTS_DIR="$JOBS_ROOT/$FIXTURE_JOB/exports"
mkdir -p "$TARGET_EXPORTS_DIR"

if [ ! -f "$TARGET_EXPORTS_DIR/generated-001-final.mp4" ]; then
  if ! aws s3 cp "s3://$BUCKET/$TARGET_VIDEO" "$TARGET_EXPORTS_DIR/generated-001-final.mp4" --region "$REGION"; then
    echo "❌ Error: Failed to download video to local filesystem"
    echo "  Source: s3://$BUCKET/$TARGET_VIDEO"
    echo "  Target: $TARGET_EXPORTS_DIR/generated-001-final.mp4"
    echo "  Check AWS credentials and local disk permissions."
    exit 1
  fi
  echo "  Local video written"
else
  echo "  Local video already present, skipping"
fi

if [ ! -f "$TARGET_EXPORTS_DIR/thumbnail-001.jpg" ]; then
  if ! aws s3 cp "s3://$BUCKET/$TARGET_THUMB" "$TARGET_EXPORTS_DIR/thumbnail-001.jpg" --region "$REGION"; then
    echo "❌ Error: Failed to download thumbnail to local filesystem"
    echo "  Source: s3://$BUCKET/$TARGET_THUMB"
    echo "  Target: $TARGET_EXPORTS_DIR/thumbnail-001.jpg"
    echo "  Check AWS credentials and local disk permissions."
    exit 1
  fi
  echo "  Local thumbnail written"
else
  echo "  Local thumbnail already present, skipping"
fi
echo ""

echo "Assets materialized. Next steps:"
echo "  1. Approve review via API or UI (dry-run unlocks only after approval)"
echo "     curl -X POST http://127.0.0.1:4877/api/video-orchestrator/jobs/$FIXTURE_JOB/review/approve"
echo "  2. Then POST dry-run:"
echo "     curl -sS -X POST \\"
echo "       'http://127.0.0.1:4877/api/video-orchestrator/jobs/$FIXTURE_JOB/publish/youtube/dry-run' \\"
echo "       -H 'content-type: application/json' \\"
echo "       -d '{}' | jq '.'"
