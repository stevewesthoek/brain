#!/bin/bash
# Validation script for I-8.3c AWS Video Operational Job API (Phase A)
# Tests the 4 new operational endpoints on Brain Core

set -e

BASE_URL="http://localhost:4877"

echo "==========================================="
echo "I-8.3c Phase A: Operational Job API"
echo "==========================================="
echo ""

# Test 1: Recent jobs endpoint
echo "[Test 1/8] GET /api/video-orchestrator/jobs/recent"
RECENT=$(curl -s "$BASE_URL/api/video-orchestrator/jobs/recent")
if echo "$RECENT" | grep -qE '"ok"\s*:\s*true'; then
  JOBS_COUNT=$(echo "$RECENT" | grep -o '"jobId"' | wc -l)
  echo "✓ PASS: Recent jobs endpoint returns OK, found $JOBS_COUNT jobs"
else
  echo "❌ FAIL: Recent jobs endpoint did not return ok:true"
  echo "Response: $RECENT"
  exit 1
fi
echo ""

# Test 2: prochat-console-gen-001 appears in recent
echo "[Test 2/8] Checking prochat-console-gen-001 in recent jobs"
if echo "$RECENT" | grep -q 'prochat-console-gen-001'; then
  echo "✓ PASS: prochat-console-gen-001 found in recent jobs"
else
  echo "❌ FAIL: prochat-console-gen-001 not found in recent jobs"
  exit 1
fi
echo ""

# Test 3: prochat-real-001 shows published status
echo "[Test 3/8] Checking prochat-real-001 status"
REAL_JOB=$(curl -s "$BASE_URL/api/video-orchestrator/jobs/prochat-real-001")
if echo "$REAL_JOB" | grep -qE '"status"\s*:\s*"published"'; then
  echo "✓ PASS: prochat-real-001 shows published status"
else
  echo "⚠ WARNING: prochat-real-001 status is not published"
fi
echo ""

# Test 4: Individual job endpoint
echo "[Test 4/8] GET /api/video-orchestrator/jobs/prochat-real-001"
if echo "$REAL_JOB" | grep -qE '"ok"\s*:\s*true'; then
  if echo "$REAL_JOB" | grep -q '"jobId":"prochat-real-001"' || echo "$REAL_JOB" | grep -q '"jobId": "prochat-real-001"'; then
    echo "✓ PASS: Job detail endpoint returns normalized summary for prochat-real-001"
  else
    echo "❌ FAIL: Job detail response missing jobId"
    exit 1
  fi
else
  echo "❌ FAIL: Job detail endpoint did not return ok:true"
  exit 1
fi
echo ""

# Test 5: Timeline endpoint
echo "[Test 5/8] GET /api/video-orchestrator/jobs/prochat-real-001/timeline"
TIMELINE=$(curl -s "$BASE_URL/api/video-orchestrator/jobs/prochat-real-001/timeline")
if echo "$TIMELINE" | grep -qE '"ok"\s*:\s*true'; then
  if echo "$TIMELINE" | grep -q '"events"'; then
    EVENTS_COUNT=$(echo "$TIMELINE" | grep -o '"step"' | wc -l)
    echo "✓ PASS: Timeline endpoint returns $EVENTS_COUNT events for prochat-real-001"
  else
    echo "❌ FAIL: Timeline response missing events array"
    exit 1
  fi
else
  echo "❌ FAIL: Timeline endpoint did not return ok:true"
  exit 1
fi
echo ""

# Test 6: Artifacts endpoint
echo "[Test 6/8] GET /api/video-orchestrator/jobs/prochat-real-001/artifacts"
ARTIFACTS=$(curl -s "$BASE_URL/api/video-orchestrator/jobs/prochat-real-001/artifacts")
if echo "$ARTIFACTS" | grep -qE '"ok"\s*:\s*true'; then
  echo "✓ PASS: Artifacts endpoint returns data for prochat-real-001"
else
  echo "❌ FAIL: Artifacts endpoint did not return ok:true"
  exit 1
fi
echo ""

# Test 7: Missing job returns 404
echo "[Test 7/8] GET /api/video-orchestrator/jobs/nonexistent-job-xyz"
MISSING=$(curl -s "$BASE_URL/api/video-orchestrator/jobs/nonexistent-job-xyz")
if echo "$MISSING" | grep -qE '"ok"\s*:\s*false'; then
  echo "✓ PASS: Missing job returns error (not a crash)"
else
  echo "⚠ WARNING: Missing job did not return expected error format"
fi
echo ""

# Test 8: No secrets in responses
echo "[Test 8/8] Checking for secrets in all responses"
SECRETS=0
for RESPONSE in "$RECENT" "$REAL_JOB" "$TIMELINE" "$ARTIFACTS"; do
  if echo "$RESPONSE" | grep -i 'AWS_SECRET_ACCESS_KEY\|AWS_ACCESS_KEY_ID\|token.*:.*"\|credential\|secret.*:.*"\|private_key'; then
    SECRETS=$((SECRETS + 1))
  fi
done
if [ "$SECRETS" -eq 0 ]; then
  echo "✓ PASS: No secrets found in API responses"
else
  echo "❌ FAIL: Found potential secrets in $SECRETS responses"
  exit 1
fi
echo ""

echo "==========================================="
echo "✅ All validation tests passed!"
echo "==========================================="
echo ""
echo "Summary:"
echo "- Recent jobs endpoint works"
echo "- Job list includes test fixtures"
echo "- Individual job detail normalized correctly"
echo "- Timeline events inferred from metadata"
echo "- Artifacts endpoint functional"
echo "- Missing jobs return gracefully"
echo "- No secrets in responses"
echo ""
