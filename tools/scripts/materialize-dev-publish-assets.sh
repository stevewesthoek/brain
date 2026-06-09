#!/bin/bash
# Dev-only: materialize the full generation + publish package for a fixture job.
# Copies missing assets to S3 from donor jobs, then downloads all required assets
# to the local jobs directory so the fast-path existence check passes.
# Does NOT approve the review — use the API or UI after this runs.
set -e

EXPORT_DONOR="prochat-real-001"
PACKAGE_DONOR=""   # generation package already lives in FIXTURE_JOB S3; set a jobId here to override
FIXTURE_JOB="${1:-prochat-prompt-1780856968989-make-a-video-of-a-box-}"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"
JOBS_ROOT="$(cd "$(dirname "$0")/../../projects/video-orchestrator/cloud/jobs" && pwd)"

# Required generation + publish package assets (from finalizeAwsVideoPublishPackage).
# assets.json / youtube-package.json / publish.json / review.json are written by finalize; not listed here.
# overlay-plan.json is always materialized because the fixture job uses hybrid_image_slideshow_video mode.
EXPORT_KEYS=(
  "exports/generated-001-final.mp4"
  "exports/thumbnail-001.jpg"
)
PACKAGE_KEYS=(
  "metadata/scene-plan.json"
  "audio/narration-script.txt"
  "audio/narration.mp3"
  "metadata/overlay-plan.json"
  "video-generated/generated-001.mp4"
)

echo "Materializing dev publish assets"
echo "  Export donor : ${EXPORT_DONOR}"
echo "  Package donor: ${PACKAGE_DONOR:-<self – fixture job S3>}"
echo "  Target       : ${FIXTURE_JOB}"
echo "  Bucket       : ${BUCKET}"
echo "  Region       : ${REGION}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: S3 – ensure export assets exist in target job's S3 path
# ---------------------------------------------------------------------------
echo "Step 1: Ensuring export assets on S3..."

for rel in "${EXPORT_KEYS[@]}"; do
  TARGET_KEY="jobs/${FIXTURE_JOB}/${rel}"
  if aws s3api head-object --bucket "$BUCKET" --key "$TARGET_KEY" --region "$REGION" &>/dev/null; then
    echo "  SKIP  $rel (already on S3)"
  else
    DONOR_KEY="jobs/${EXPORT_DONOR}/${rel}"
    if ! aws s3api head-object --bucket "$BUCKET" --key "$DONOR_KEY" --region "$REGION" &>/dev/null; then
      echo ""
      echo "❌ Error: export donor asset not found in S3"
      echo "  Donor  : s3://${BUCKET}/${DONOR_KEY}"
      echo "  Provide a valid EXPORT_DONOR job that has ${rel} on S3."
      exit 1
    fi
    if ! aws s3 cp "s3://${BUCKET}/${DONOR_KEY}" "s3://${BUCKET}/${TARGET_KEY}" --region "$REGION"; then
      echo "❌ Error: S3 copy failed for ${rel}"
      echo "  Source : s3://${BUCKET}/${DONOR_KEY}"
      echo "  Target : s3://${BUCKET}/${TARGET_KEY}"
      exit 1
    fi
    echo "  COPY  $rel <- export donor"
  fi
done

echo ""

# ---------------------------------------------------------------------------
# Step 2: S3 – ensure generation package assets exist in target job's S3 path
# ---------------------------------------------------------------------------
echo "Step 2: Ensuring generation package assets on S3..."

for rel in "${PACKAGE_KEYS[@]}"; do
  TARGET_KEY="jobs/${FIXTURE_JOB}/${rel}"
  if aws s3api head-object --bucket "$BUCKET" --key "$TARGET_KEY" --region "$REGION" &>/dev/null; then
    echo "  SKIP  $rel (already on S3)"
  elif [ -n "$PACKAGE_DONOR" ]; then
    DONOR_KEY="jobs/${PACKAGE_DONOR}/${rel}"
    if ! aws s3api head-object --bucket "$BUCKET" --key "$DONOR_KEY" --region "$REGION" &>/dev/null; then
      echo ""
      echo "❌ Error: package donor asset not found in S3"
      echo "  Donor  : s3://${BUCKET}/${DONOR_KEY}"
      echo "  Provide a PACKAGE_DONOR job that has ${rel} on S3."
      exit 1
    fi
    if ! aws s3 cp "s3://${BUCKET}/${DONOR_KEY}" "s3://${BUCKET}/${TARGET_KEY}" --region "$REGION"; then
      echo "❌ Error: S3 copy failed for ${rel}"
      exit 1
    fi
    echo "  COPY  $rel <- package donor"
  else
    echo ""
    echo "❌ Error: required package asset missing from S3 and no PACKAGE_DONOR set"
    echo "  Missing: s3://${BUCKET}/${TARGET_KEY}"
    echo "  Set PACKAGE_DONOR to a job whose S3 path contains this file."
    exit 1
  fi
done

echo ""

# ---------------------------------------------------------------------------
# Step 3: Local – download all required assets from S3
# (provider checks local first; S3 head-only check is slower)
# ---------------------------------------------------------------------------
echo "Step 3: Downloading required assets to local jobs directory..."

ALL_KEYS=("${EXPORT_KEYS[@]}" "${PACKAGE_KEYS[@]}")

for rel in "${ALL_KEYS[@]}"; do
  S3_KEY="jobs/${FIXTURE_JOB}/${rel}"
  LOCAL_PATH="${JOBS_ROOT}/${FIXTURE_JOB}/${rel}"
  LOCAL_DIR="$(dirname "$LOCAL_PATH")"

  if [ -f "$LOCAL_PATH" ]; then
    echo "  SKIP  $rel (already local)"
  else
    mkdir -p "$LOCAL_DIR"
    if ! aws s3 cp "s3://${BUCKET}/${S3_KEY}" "$LOCAL_PATH" --region "$REGION" --no-progress 2>/dev/null; then
      echo "❌ Error: download failed for ${rel}"
      echo "  Source: s3://${BUCKET}/${S3_KEY}"
      echo "  Target: ${LOCAL_PATH}"
      echo "  Verify AWS credentials and S3 permissions."
      exit 1
    fi
    echo "  COPY  $rel -> local"
  fi
done

echo ""

# ---------------------------------------------------------------------------
# Step 4: Verification – confirm each required target asset is present
# ---------------------------------------------------------------------------
echo "Step 4: Verification"
ALL_PASS=true

for rel in "${ALL_KEYS[@]}"; do
  S3_KEY="jobs/${FIXTURE_JOB}/${rel}"
  LOCAL_PATH="${JOBS_ROOT}/${FIXTURE_JOB}/${rel}"

  S3_OK=false
  LOCAL_OK=false

  if [ -f "$LOCAL_PATH" ]; then LOCAL_OK=true; fi
  if aws s3api head-object --bucket "$BUCKET" --key "$S3_KEY" --region "$REGION" &>/dev/null; then S3_OK=true; fi

  if $LOCAL_OK && $S3_OK; then
    echo "  OK    $rel (local + S3)"
  elif $LOCAL_OK; then
    echo "  OK    $rel (local only)"
  elif $S3_OK; then
    echo "  WARN  $rel (S3 only – local missing)"
    ALL_PASS=false
  else
    echo "  FAIL  $rel (missing from both local and S3)"
    ALL_PASS=false
  fi
done

echo ""

if $ALL_PASS; then
  echo "✅ All required assets present. Next steps:"
else
  echo "❌ One or more assets missing. Review output above."
  exit 1
fi

echo "  1. Approve review via API (unlocks real publish):"
echo "     curl -X POST http://127.0.0.1:4877/api/video-orchestrator/jobs/${FIXTURE_JOB}/review/approve"
echo "  2. Run dry-run:"
echo "     curl -sS -X POST \\"
echo "       'http://127.0.0.1:4877/api/video-orchestrator/jobs/${FIXTURE_JOB}/publish/youtube/dry-run' \\"
echo "       -H 'content-type: application/json' \\"
echo "       -d '{}' | jq '.'"
