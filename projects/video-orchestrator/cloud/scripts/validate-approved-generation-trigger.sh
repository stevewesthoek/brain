#!/bin/bash
# Validation tests for approved script generation trigger
# Usage: scripts/validate-approved-generation-trigger.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRAIN_CORE="$(cd "$CLOUD_ROOT/../../projects/brain-core" && pwd)"

BRAIN_API_HOST="${BRAIN_API_HOST:-http://localhost:3000}"

echo "==========================================="
echo "Approved Script Generation Trigger Validation"
echo "==========================================="
echo ""
echo "Using API: $BRAIN_API_HOST"
echo ""

# Test 1: Pending script cannot generate
echo "[Test 1/6] Pending script cannot generate"
TEST_PENDING_JOB="validation-test-pending-$(date +%s)"

mkdir -p "$CLOUD_ROOT/jobs/$TEST_PENDING_JOB/metadata"

cat > "$CLOUD_ROOT/jobs/$TEST_PENDING_JOB/metadata/script.json" << EOF
{
  "jobId": "$TEST_PENDING_JOB",
  "channelId": "prochat",
  "topicId": "test-topic",
  "status": "draft",
  "title": "Test Pending Script",
  "wordCount": 100,
  "approval": {
    "required": true,
    "status": "pending",
    "theologicalReviewRequired": false,
    "notes": null
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$TEST_PENDING_JOB/metadata/topic.json" << EOF
{"jobId": "$TEST_PENDING_JOB", "channelId": "prochat"}
EOF

RESPONSE=$(curl -s -X POST "$BRAIN_API_HOST/api/video-orchestrator/scripts/$TEST_PENDING_JOB/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

SCRIPT_STATUS=$(echo "$RESPONSE" | jq -r '.code // "unknown"')
if [ "$SCRIPT_STATUS" = "script_not_approved" ]; then
    echo "✓ PASS: Pending script correctly rejected"
else
    echo "❌ FAIL: Expected script_not_approved, got: $(echo "$RESPONSE" | jq -r '.code // "unknown"')"
    exit 1
fi
echo ""

# Test 2: Changes requested script cannot generate
echo "[Test 2/6] Changes requested script cannot generate"
TEST_CHANGES_JOB="validation-test-changes-$(date +%s)"

mkdir -p "$CLOUD_ROOT/jobs/$TEST_CHANGES_JOB/metadata"

cat > "$CLOUD_ROOT/jobs/$TEST_CHANGES_JOB/metadata/script.json" << EOF
{
  "jobId": "$TEST_CHANGES_JOB",
  "channelId": "prochat",
  "topicId": "test-topic",
  "status": "changes_requested",
  "title": "Test Changes Script",
  "wordCount": 100,
  "approval": {
    "required": true,
    "status": "changes_requested",
    "theologicalReviewRequired": false,
    "notes": "Please revise"
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$TEST_CHANGES_JOB/metadata/topic.json" << EOF
{"jobId": "$TEST_CHANGES_JOB", "channelId": "prochat"}
EOF

RESPONSE=$(curl -s -X POST "$BRAIN_API_HOST/api/video-orchestrator/scripts/$TEST_CHANGES_JOB/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

SCRIPT_STATUS=$(echo "$RESPONSE" | jq -r '.code // "unknown"')
if [ "$SCRIPT_STATUS" = "script_not_approved" ]; then
    echo "✓ PASS: Changes requested script correctly rejected"
else
    echo "❌ FAIL: Expected script_not_approved, got: $SCRIPT_STATUS"
    exit 1
fi
echo ""

# Test 3: Approved ProChat script can generate
echo "[Test 3/6] Approved ProChat script can generate"
TEST_APPROVED_JOB="validation-test-approved-$(date +%s)"

mkdir -p "$CLOUD_ROOT/jobs/$TEST_APPROVED_JOB/metadata"

cat > "$CLOUD_ROOT/jobs/$TEST_APPROVED_JOB/metadata/script.json" << EOF
{
  "jobId": "$TEST_APPROVED_JOB",
  "channelId": "prochat",
  "topicId": "test-topic",
  "status": "approved",
  "title": "Test Approved Script",
  "wordCount": 100,
  "approval": {
    "required": true,
    "status": "approved",
    "theologicalReviewRequired": false,
    "approvedBy": "test-user",
    "approvedAt": "2026-06-01T00:00:00Z",
    "notes": "Approved for testing"
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$TEST_APPROVED_JOB/metadata/topic.json" << EOF
{"jobId": "$TEST_APPROVED_JOB", "channelId": "prochat"}
EOF

RESPONSE=$(curl -s -X POST "$BRAIN_API_HOST/api/video-orchestrator/scripts/$TEST_APPROVED_JOB/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

RESPONSE_OK=$(echo "$RESPONSE" | jq -r '.ok // false')
if [ "$RESPONSE_OK" = "true" ]; then
    echo "✓ PASS: Approved ProChat script can generate"
    APPROVED_JOB_ID=$TEST_APPROVED_JOB
else
    echo "❌ FAIL: Expected ok=true, got: $(echo "$RESPONSE" | jq '.')"
    exit 1
fi
echo ""

# Test 4: Approved Says the Bible script without theology review cannot generate
echo "[Test 4/6] Says the Bible without theology review cannot generate"
TEST_STB_JOB="validation-test-stb-$(date +%s)"

mkdir -p "$CLOUD_ROOT/jobs/$TEST_STB_JOB/metadata"
mkdir -p "$CLOUD_ROOT/channels/says-the-bible"

cat > "$CLOUD_ROOT/channels/says-the-bible/content-profile.json" << EOF
{
  "channelId": "says-the-bible",
  "scriptRequirements": {
    "approvalRequired": true,
    "theologicalReviewRequired": true
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$TEST_STB_JOB/metadata/script.json" << EOF
{
  "jobId": "$TEST_STB_JOB",
  "channelId": "says-the-bible",
  "topicId": "test-topic",
  "status": "approved",
  "title": "Test STB Script",
  "wordCount": 100,
  "approval": {
    "required": true,
    "status": "approved",
    "theologicalReviewRequired": false,
    "approvedBy": "test-user",
    "approvedAt": "2026-06-01T00:00:00Z",
    "notes": "Approved without theology"
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$TEST_STB_JOB/metadata/topic.json" << EOF
{"jobId": "$TEST_STB_JOB", "channelId": "says-the-bible"}
EOF

RESPONSE=$(curl -s -X POST "$BRAIN_API_HOST/api/video-orchestrator/scripts/$TEST_STB_JOB/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

SCRIPT_CODE=$(echo "$RESPONSE" | jq -r '.code // "unknown"')
if [ "$SCRIPT_CODE" = "theology_review_required" ]; then
    echo "✓ PASS: Says the Bible without theology review correctly rejected"
else
    echo "❌ FAIL: Expected theology_review_required, got: $SCRIPT_CODE"
    exit 1
fi
echo ""

# Test 5: Approved Says the Bible script with theology review can generate
echo "[Test 5/6] Says the Bible with theology review can generate"
TEST_STB_APPROVED_JOB="validation-test-stb-approved-$(date +%s)"

mkdir -p "$CLOUD_ROOT/jobs/$TEST_STB_APPROVED_JOB/metadata"

cat > "$CLOUD_ROOT/jobs/$TEST_STB_APPROVED_JOB/metadata/script.json" << EOF
{
  "jobId": "$TEST_STB_APPROVED_JOB",
  "channelId": "says-the-bible",
  "topicId": "test-topic",
  "status": "approved",
  "title": "Test STB Script Approved",
  "wordCount": 100,
  "approval": {
    "required": true,
    "status": "approved",
    "theologicalReviewRequired": true,
    "approvedBy": "test-user",
    "approvedAt": "2026-06-01T00:00:00Z",
    "notes": "Approved with theology"
  }
}
EOF

cat > "$CLOUD_ROOT/jobs/$TEST_STB_APPROVED_JOB/metadata/topic.json" << EOF
{"jobId": "$TEST_STB_APPROVED_JOB", "channelId": "says-the-bible"}
EOF

RESPONSE=$(curl -s -X POST "$BRAIN_API_HOST/api/video-orchestrator/scripts/$TEST_STB_APPROVED_JOB/generate" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy": "test"}')

RESPONSE_OK=$(echo "$RESPONSE" | jq -r '.ok // false')
if [ "$RESPONSE_OK" = "true" ]; then
    echo "✓ PASS: Approved Says the Bible script with theology review can generate"
else
    echo "❌ FAIL: Expected ok=true, got: $(echo "$RESPONSE" | jq '.')"
    exit 1
fi
echo ""

# Test 6: Validation summary
echo "[Test 6/6] Validation summary"
echo "✓ All validation tests passed"
echo ""

echo "==========================================="
echo "✅ Approved Script Generation Trigger Validation Complete"
echo "==========================================="
echo ""
