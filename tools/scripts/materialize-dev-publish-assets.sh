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
if aws s3api head-object --bucket "$BUCKET" --key "$TARGET_VIDEO" --region "$REGION" &>/dev/null; then
  echo "  S3 video already present, skipping"
else
  aws s3 cp "s3://$BUCKET/$DONOR_VIDEO" "s3://$BUCKET/$TARGET_VIDEO" --region "$REGION"
  echo "  S3 video copied"
fi

if aws s3api head-object --bucket "$BUCKET" --key "$TARGET_THUMB" --region "$REGION" &>/dev/null; then
  echo "  S3 thumbnail already present, skipping"
else
  aws s3 cp "s3://$BUCKET/$DONOR_THUMB" "s3://$BUCKET/$TARGET_THUMB" --region "$REGION"
  echo "  S3 thumbnail copied"
fi
echo ""

# --- Local copy (for checkPublishAssetsAvailable fast-path) ---
echo "Step 2: Copying assets locally..."
TARGET_EXPORTS_DIR="$JOBS_ROOT/$FIXTURE_JOB/exports"
mkdir -p "$TARGET_EXPORTS_DIR"

if [ ! -f "$TARGET_EXPORTS_DIR/generated-001-final.mp4" ]; then
  aws s3 cp "s3://$BUCKET/$TARGET_VIDEO" "$TARGET_EXPORTS_DIR/generated-001-final.mp4" --region "$REGION"
  echo "  Local video written"
else
  echo "  Local video already present, skipping"
fi

if [ ! -f "$TARGET_EXPORTS_DIR/thumbnail-001.jpg" ]; then
  aws s3 cp "s3://$BUCKET/$TARGET_THUMB" "$TARGET_EXPORTS_DIR/thumbnail-001.jpg" --region "$REGION"
  echo "  Local thumbnail written"
else
  echo "  Local thumbnail already present, skipping"
fi
echo ""

echo "Assets materialized. Next steps:"
echo "  1. Approve review via API or UI (dry-run unlocks only after approval)"
echo "     curl -X POST http://127.0.0.1:4877/api/video-orchestrator/jobs/$FIXTURE_JOB/review/approve"
echo "  2. Then POST dry-run:"
echo "     curl -s -X POST http://127.0.0.1:4877/api/video-orchestrator/jobs/$FIXTURE_JOB/publish \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"dryRun\":true}' | python3 -m json.tool"
