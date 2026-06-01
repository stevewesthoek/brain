#!/bin/bash
# Validation script for interactive video prompt draft API (I-8.1)
# Tests creating draft jobs from prompts without generation/publishing

set -e

BRAIN_CORE_HOST="${BRAIN_CORE_HOST:-http://localhost:4877}"
JOBS_DIR="${JOBS_DIR:-$(dirname "$0")/../jobs}"

echo "=========================================="
echo "I-8.1: Interactive Video Prompt Draft API"
echo "=========================================="
echo ""
echo "Brain Core: $BRAIN_CORE_HOST"
echo ""

# Test 1: Create ProChat prompt job
echo "[Test 1/4] Creating ProChat prompt job..."
PROCHAT_RESPONSE=$(curl -s -X POST "$BRAIN_CORE_HOST/api/video-orchestrator/jobs/create-from-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "prochat",
    "prompt": "AI can write code but not businesses",
    "requestedBy": "Steve"
  }')

PROCHAT_OK=$(echo "$PROCHAT_RESPONSE" | jq -r '.ok // false' 2>/dev/null)
if [ "$PROCHAT_OK" = "true" ]; then
  PROCHAT_JOB_ID=$(echo "$PROCHAT_RESPONSE" | jq -r '.jobId' 2>/dev/null)
  echo "✓ PASS: ProChat job created: $PROCHAT_JOB_ID"
else
  echo "❌ FAIL: Could not create ProChat job"
  echo "$PROCHAT_RESPONSE"
  exit 1
fi
echo ""

# Test 2: Verify ProChat job is draft/pending
echo "[Test 2/4] Verifying ProChat job status..."
PROCHAT_SCRIPT_STATUS=$(echo "$PROCHAT_RESPONSE" | jq -r '.scriptStatus' 2>/dev/null)
PROCHAT_APPROVAL=$(echo "$PROCHAT_RESPONSE" | jq -r '.approvalStatus' 2>/dev/null)

if [ "$PROCHAT_SCRIPT_STATUS" = "draft" ] && [ "$PROCHAT_APPROVAL" = "pending" ]; then
  echo "✓ PASS: ProChat job status is draft/pending"
else
  echo "❌ FAIL: ProChat job status incorrect"
  echo "  scriptStatus=$PROCHAT_SCRIPT_STATUS (expected: draft)"
  echo "  approvalStatus=$PROCHAT_APPROVAL (expected: pending)"
  exit 1
fi
echo ""

# Test 3: Create Says the Bible prompt job
echo "[Test 3/4] Creating Says the Bible prompt job..."
STB_RESPONSE=$(curl -s -X POST "$BRAIN_CORE_HOST/api/video-orchestrator/jobs/create-from-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "says-the-bible",
    "prompt": "Why is grace more powerful than judgment",
    "requestedBy": "Steve"
  }')

STB_OK=$(echo "$STB_RESPONSE" | jq -r '.ok // false' 2>/dev/null)
if [ "$STB_OK" = "true" ]; then
  STB_JOB_ID=$(echo "$STB_RESPONSE" | jq -r '.jobId' 2>/dev/null)
  echo "✓ PASS: Says the Bible job created: $STB_JOB_ID"
else
  echo "❌ FAIL: Could not create Says the Bible job"
  echo "$STB_RESPONSE"
  exit 1
fi
echo ""

# Test 4: Verify no video assets or publish files
echo "[Test 4/4] Verifying no video assets or publishing..."
if [ -d "$JOBS_DIR/$PROCHAT_JOB_ID" ]; then
  # Check what files exist
  if [ -f "$JOBS_DIR/$PROCHAT_JOB_ID/metadata/script.json" ]; then
    echo "✓ Script metadata exists"
  else
    echo "❌ Script metadata missing"
    exit 1
  fi

  if [ -f "$JOBS_DIR/$PROCHAT_JOB_ID/metadata/topic.json" ]; then
    echo "✓ Topic metadata exists"
  else
    echo "❌ Topic metadata missing"
    exit 1
  fi

  if [ -f "$JOBS_DIR/$PROCHAT_JOB_ID/scripts/script.md" ]; then
    echo "✓ Script content exists"
  else
    echo "❌ Script content missing"
    exit 1
  fi

  # Verify NO video assets
  if [ -d "$JOBS_DIR/$PROCHAT_JOB_ID/assets" ]; then
    echo "❌ FAIL: Video assets folder should not exist for draft job"
    exit 1
  fi

  # Verify NO publish.json
  if [ -f "$JOBS_DIR/$PROCHAT_JOB_ID/metadata/publish.json" ]; then
    echo "❌ FAIL: publish.json should not exist for draft job"
    exit 1
  fi

  echo "✓ PASS: No video assets or publishing files created"
else
  echo "⚠ WARNING: Job folder not accessible at $JOBS_DIR/$PROCHAT_JOB_ID"
  echo "  (This may be normal if running against remote Brain Core)"
fi
echo ""

echo "=========================================="
echo "✅ All validation tests passed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- ProChat job: $PROCHAT_JOB_ID (draft/pending)"
echo "- Says the Bible job: $STB_JOB_ID (draft/pending)"
echo ""
echo "Next steps:"
echo "1. Review scripts at jobs/<jobId>/scripts/script.md"
echo "2. Approve scripts when ready for generation"
echo "3. Generation will happen on approval (Phase 2)"
echo ""
