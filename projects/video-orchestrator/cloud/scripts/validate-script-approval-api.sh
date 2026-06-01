#!/bin/bash
# Validate Brain Core script approval API without triggering generation or publishing.
# Usage: scripts/validate-script-approval-api.sh

set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRAIN_CORE_URL="${BRAIN_CORE_URL:-http://127.0.0.1:4877}"
JOB_ID="approval-api-test-001"
JOB_DIR="$PROJECT_ROOT/jobs/$JOB_ID"
METADATA_DIR="$JOB_DIR/metadata"
SCRIPT_JSON="$METADATA_DIR/script.json"
TOPIC_JSON="$METADATA_DIR/topic.json"

VALIDATION_FAILED=0

check_pass() {
  echo -e "${GREEN}✓ $1${NC}"
}

check_fail() {
  echo -e "${RED}✗ $1${NC}"
  VALIDATION_FAILED=1
}

check_warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}✗ Missing required tool: $1${NC}"
    exit 1
  fi
}

post_json() {
  local endpoint="$1"
  local payload="$2"
  local output_file="$3"
  local status_file="$4"

  curl -sS \
    -H 'content-type: application/json' \
    -X POST \
    -d "$payload" \
    -w '%{http_code}' \
    -o "$output_file" \
    "$BRAIN_CORE_URL$endpoint" > "$status_file"
}

echo ""
echo -e "${BOLD}Validating I-7.7 Script Approval API${NC}"
echo "Brain Core URL: $BRAIN_CORE_URL"
echo "Test job: $JOB_ID"
echo ""

require_tool curl
require_tool jq

if ! curl -sS "$BRAIN_CORE_URL/status" >/dev/null 2>&1; then
  echo -e "${RED}✗ Brain Core is not reachable at $BRAIN_CORE_URL${NC}"
  echo "  Start it from projects/brain-core with: npm start"
  exit 1
fi
check_pass "Brain Core is reachable"

mkdir -p "$METADATA_DIR" "$JOB_DIR/scripts"

# Keep this validation job deterministic and safe. Only the fixed test job is reset.
rm -rf "$JOB_DIR/video-generated" "$JOB_DIR/video" "$JOB_DIR/exports" "$JOB_DIR/publishing"
rm -f "$METADATA_DIR/publish.json"

cat > "$SCRIPT_JSON" <<JSON
{
  "jobId": "$JOB_ID",
  "channelId": "says-the-bible",
  "topicId": "approval-api-test-topic",
  "status": "draft",
  "title": "Approval API Test Draft",
  "targetDurationSeconds": 60,
  "wordCount": 128,
  "scriptKey": "jobs/$JOB_ID/scripts/script.md",
  "generatedBy": "validate-script-approval-api",
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z",
  "approval": {
    "required": true,
    "status": "pending",
    "theologicalReviewRequired": true,
    "approvedAt": null,
    "approvedBy": null,
    "notes": null
  }
}
JSON

cat > "$TOPIC_JSON" <<JSON
{
  "jobId": "$JOB_ID",
  "channelId": "says-the-bible",
  "topicId": "approval-api-test-topic",
  "topic": {
    "title": "Approval API Test Draft"
  },
  "selectedAt": "2026-06-01T00:00:00.000Z"
}
JSON

cat > "$JOB_DIR/scripts/script.md" <<'MARKDOWN'
# Approval API Test Draft

This is validation-only script content. It is never rendered, uploaded, or published.
MARKDOWN

check_pass "Safe draft script metadata created"

GET_RESPONSE="$(mktemp)"
GET_STATUS="$(curl -sS -w '%{http_code}' -o "$GET_RESPONSE" "$BRAIN_CORE_URL/api/video-orchestrator/scripts/$JOB_ID")"
if [ "$GET_STATUS" = "200" ] && jq -e '.ok == true and .data.jobId == "approval-api-test-001"' "$GET_RESPONSE" >/dev/null 2>&1; then
  check_pass "GET /api/video-orchestrator/scripts/$JOB_ID remains compatible"
else
  check_fail "GET script endpoint did not return the expected safe test job"
  cat "$GET_RESPONSE"
fi

CHANGES_RESPONSE="$(mktemp)"
CHANGES_STATUS_FILE="$(mktemp)"
post_json "/api/video-orchestrator/scripts/$JOB_ID/request-changes" \
  '{"requestedBy":"Steve","notes":"Please tighten the opening and scripture transition."}' \
  "$CHANGES_RESPONSE" \
  "$CHANGES_STATUS_FILE"
CHANGES_STATUS="$(cat "$CHANGES_STATUS_FILE")"

if [ "$CHANGES_STATUS" = "200" ] && jq -e '.ok == true and .scriptStatus == "changes_requested" and .generationTriggered == false and .publishChanged == false' "$CHANGES_RESPONSE" >/dev/null 2>&1; then
  check_pass "request-changes endpoint returned safe success response"
else
  check_fail "request-changes endpoint failed"
  cat "$CHANGES_RESPONSE"
fi

if jq -e '.status == "changes_requested" and .approval.status == "changes_requested" and (.approval.notes | length > 0) and (.approval.updatedAt | length > 0)' "$SCRIPT_JSON" >/dev/null 2>&1; then
  check_pass "script.json updated to changes_requested"
else
  check_fail "script.json was not updated to changes_requested"
  cat "$SCRIPT_JSON"
fi

APPROVE_RESPONSE="$(mktemp)"
APPROVE_STATUS_FILE="$(mktemp)"
post_json "/api/video-orchestrator/scripts/$JOB_ID/approve" \
  '{"approvedBy":"Steve","notes":"Approved for I-7.7 validation."}' \
  "$APPROVE_RESPONSE" \
  "$APPROVE_STATUS_FILE"
APPROVE_STATUS="$(cat "$APPROVE_STATUS_FILE")"

if [ "$APPROVE_STATUS" = "200" ] && jq -e '.ok == true and .scriptStatus == "approved" and .theologyReviewRequired == true and .generationTriggered == false and .publishChanged == false' "$APPROVE_RESPONSE" >/dev/null 2>&1; then
  check_pass "approve endpoint returned safe success response"
else
  check_fail "approve endpoint failed"
  cat "$APPROVE_RESPONSE"
fi

if jq -e '.status == "approved" and .approval.status == "approved" and .approval.approvedBy == "Steve" and (.approval.approvedAt | length > 0)' "$SCRIPT_JSON" >/dev/null 2>&1; then
  check_pass "script.json updated to approved with approvedBy/approvedAt"
else
  check_fail "script.json was not updated to approved with required approval metadata"
  cat "$SCRIPT_JSON"
fi

if [ ! -d "$JOB_DIR/video-generated" ] && [ ! -d "$JOB_DIR/video" ] && [ ! -d "$JOB_DIR/exports" ]; then
  check_pass "No video generation artifacts were created"
else
  check_fail "Unexpected video generation artifacts exist for test job"
fi

if [ ! -f "$METADATA_DIR/publish.json" ] && [ ! -f "$JOB_DIR/publishing/publish.json" ]; then
  check_pass "No publish.json was created"
else
  check_fail "Unexpected publish metadata was created"
fi

echo ""
if [ "$VALIDATION_FAILED" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}I-7.7 script approval API validation passed${NC}"
  exit 0
fi

echo -e "${RED}${BOLD}I-7.7 script approval API validation failed${NC}"
exit 1
