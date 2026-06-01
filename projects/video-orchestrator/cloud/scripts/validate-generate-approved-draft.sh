#!/bin/bash
# Validation tests for generating approved draft videos (I-8.3)
# Usage: scripts/validate-generate-approved-draft.sh

set -e

BRAIN_CORE_HOST="${BRAIN_CORE_HOST:-http://localhost:4877}"
CLOUD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==========================================="
echo "I-8.3: Generate Approved Draft Video"
echo "==========================================="
echo ""
echo "Using Brain Core: $BRAIN_CORE_HOST"
echo ""

# Test 1: Pending script rejected
echo "[Test 1/5] Pending script cannot generate"
PENDING_JOB="test-pending-$(date +%s)"
mkdir -p "$CLOUD_ROOT/jobs/$PENDING_JOB/metadata"

cat > "$CLOUD_ROOT/jobs/$PENDING_JOB/metadata/script.json" << EOF
{
  "jobId": "$PENDING_JOB",
  "channelId": "prochat",
  "approval": {
    "required": true,
    "status": "pending"
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$PENDING_JOB/metadata/topic.json" << EOF
{"jobId": "$PENDING_JOB"}
EOF

RESPONSE=$(curl -s -X POST "$BRAIN_CORE_HOST/api/video-orchestrator/scripts/$PENDING_JOB/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

CODE=$(echo "$RESPONSE" | jq -r '.code // "unknown"')
if [ "$CODE" = "script_not_approved" ]; then
  echo "✓ PASS: Pending script correctly rejected"
else
  echo "❌ FAIL: Expected script_not_approved, got: $CODE"
  exit 1
fi
echo ""

# Test 2: Generate approved ProChat draft
echo "[Test 2/5] Approved ProChat script generates"
RESPONSE=$(curl -s -X POST "$BRAIN_CORE_HOST/api/video-orchestrator/scripts/prochat-console-gen-001/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

OK=$(echo "$RESPONSE" | jq -r '.ok // false')
GEN_STATUS=$(echo "$RESPONSE" | jq -r '.generationStatus // "unknown"')
EXECUTION_ARN=$(echo "$RESPONSE" | jq -r '.executionArn // ""')

if [ "$OK" = "true" ] && [ "$GEN_STATUS" = "started" ] && [ -n "$EXECUTION_ARN" ]; then
  echo "✓ PASS: Generation triggered successfully"
  echo "  Execution ARN: $EXECUTION_ARN"
else
  echo "❌ FAIL: Expected ok=true, generationStatus=started, got: $(echo "$RESPONSE" | jq '.')"
  exit 1
fi
echo ""

# Test 3: Verify status.json exists
echo "[Test 3/5] Verify status.json written"
JOB_ID="prochat-console-gen-001"
if [ -f "$CLOUD_ROOT/jobs/$JOB_ID/metadata/status.json" ]; then
  STATUS=$(jq -r '.status // "unknown"' "$CLOUD_ROOT/jobs/$JOB_ID/metadata/status.json")
  CURRENT_STEP=$(jq -r '.currentStep // "unknown"' "$CLOUD_ROOT/jobs/$JOB_ID/metadata/status.json")

  if [ "$STATUS" = "generating" ] && [ "$CURRENT_STEP" = "workflow_started" ]; then
    echo "✓ PASS: status.json written correctly"
  else
    echo "❌ FAIL: Unexpected status.json content: status=$STATUS, currentStep=$CURRENT_STEP"
    exit 1
  fi
else
  echo "❌ FAIL: status.json not found at $CLOUD_ROOT/jobs/$JOB_ID/metadata/status.json"
  exit 1
fi
echo ""

# Test 4: Verify publish.json in both locations
echo "[Test 4/5] Verify publish.json written to metadata and publishing"
if [ -f "$CLOUD_ROOT/jobs/$JOB_ID/metadata/publish.json" ]; then
  PUBLISH_STATUS=$(jq -r '.publishStatus // "unknown"' "$CLOUD_ROOT/jobs/$JOB_ID/metadata/publish.json")
  BLOCKED=$(jq -r '.publishBlocked // false' "$CLOUD_ROOT/jobs/$JOB_ID/metadata/publish.json")

  if [ "$PUBLISH_STATUS" = "pending" ] && [ "$BLOCKED" = "true" ]; then
    echo "✓ PASS: metadata/publish.json written correctly"
  else
    echo "❌ FAIL: Unexpected metadata/publish.json: publishStatus=$PUBLISH_STATUS, publishBlocked=$BLOCKED"
    exit 1
  fi
else
  echo "❌ FAIL: metadata/publish.json not found"
  exit 1
fi

if [ -f "$CLOUD_ROOT/jobs/$JOB_ID/publishing/publish.json" ]; then
  echo "✓ PASS: publishing/publish.json written"
else
  echo "❌ FAIL: publishing/publish.json not found"
  exit 1
fi
echo ""

# Test 5: Verify no YouTube upload data
echo "[Test 5/5] Verify no YouTube videoId or url"
VIDEO_ID=$(jq -r '.platforms.youtube.videoId // ""' "$CLOUD_ROOT/jobs/$JOB_ID/publishing/publish.json")
VIDEO_URL=$(jq -r '.platforms.youtube.url // ""' "$CLOUD_ROOT/jobs/$JOB_ID/publishing/publish.json")

if [ -z "$VIDEO_ID" ] && [ -z "$VIDEO_URL" ]; then
  echo "✓ PASS: No YouTube upload data (videoId and url are empty)"
else
  echo "❌ FAIL: Found YouTube data: videoId=$VIDEO_ID, url=$VIDEO_URL"
  exit 1
fi
echo ""

echo "==========================================="
echo "✅ All validation tests passed!"
echo "==========================================="
echo ""
echo "Summary:"
echo "- Pending scripts rejected correctly"
echo "- Approved scripts generate with executionArn"
echo "- Status files written with generation step tracking"
echo "- Publish metadata created with pending status"
echo "- No YouTube upload data (as expected for approved drafts)"
echo ""
echo "Next: Approve and publish via explicit publishing workflow"
echo ""
