#!/bin/bash
# Validate script generation metadata, word count, approval status, and channel requirements
# Usage: validate-script-generation.sh [jobId]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

JOB_ID="${1:-}"

# Color-coded output helpers
print_header() {
  echo ""
  echo -e "${BOLD}${CYAN}===========================================${NC}"
  echo -e "${BOLD}$1${NC}"
  echo -e "${BOLD}${CYAN}===========================================${NC}"
  echo ""
}

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

# If no jobId provided, validate all jobs
if [ -z "$JOB_ID" ]; then
  print_header "Script Generation Validation - All Jobs"

  JOBS_DIR="$PROJECT_ROOT/jobs"
  if [ ! -d "$JOBS_DIR" ]; then
    echo -e "${RED}✗ No jobs directory found${NC}"
    exit 1
  fi

  JOB_COUNT=0
  for job_dir in "$JOBS_DIR"/*; do
    if [ -d "$job_dir" ]; then
      JOB_ID=$(basename "$job_dir")
      "$0" "$JOB_ID"
      JOB_COUNT=$((JOB_COUNT + 1))
    fi
  done

  if [ $JOB_COUNT -eq 0 ]; then
    echo -e "${YELLOW}No jobs found${NC}"
  fi
  exit 0
fi

print_header "Script Generation Validation - Job: $JOB_ID"

VALIDATION_FAILED=0
JOB_DIR="$PROJECT_ROOT/jobs/$JOB_ID"

# Check job directory
if [ ! -d "$JOB_DIR" ]; then
  echo -e "${RED}✗ Job directory not found: $JOB_DIR${NC}"
  exit 1
fi
check_pass "Job directory exists"

# Phase 1: Metadata Structure
echo -e "${BOLD}Phase 1: Metadata Structure${NC}"

TOPIC_METADATA="$JOB_DIR/metadata/topic.json"
if [ -f "$TOPIC_METADATA" ]; then
  check_pass "Topic metadata exists"

  # Validate topic.json structure
  if jq -e '.jobId and .channelId and .topicId and .topic and .selectedAt' "$TOPIC_METADATA" >/dev/null 2>&1; then
    check_pass "Topic metadata structure valid"
  else
    check_fail "Topic metadata missing required fields"
  fi
else
  check_fail "Topic metadata not found"
fi

SCRIPT_JSON="$JOB_DIR/metadata/script.json"
if [ -f "$SCRIPT_JSON" ]; then
  check_pass "Script metadata exists"

  # Validate script.json structure
  if jq -e '.jobId and .channelId and .topicId and .status and .title and .approval' "$SCRIPT_JSON" >/dev/null 2>&1; then
    check_pass "Script metadata structure valid"
  else
    check_fail "Script metadata missing required fields"
  fi
else
  check_fail "Script metadata not found"
fi

# Phase 2: Script Content
echo ""
echo -e "${BOLD}Phase 2: Script Content${NC}"

SCRIPT_MD="$JOB_DIR/scripts/script.md"
if [ -f "$SCRIPT_MD" ]; then
  check_pass "Script markdown exists"

  # Count words
  WORD_COUNT=$(sed '/^---$/,$d' "$SCRIPT_MD" | wc -w)
  echo "  Word count: $WORD_COUNT words"

  # Check word count range (loose)
  if [ "$WORD_COUNT" -ge 100 ] && [ "$WORD_COUNT" -le 300 ]; then
    check_pass "Word count in reasonable range"
  else
    check_warn "Word count outside typical range (150-200 recommended)"
  fi

  # Check for template placeholders (should be minimal)
  PLACEHOLDER_COUNT=$(grep -o '\[.*\]' "$SCRIPT_MD" | wc -l)
  if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
    check_warn "Script contains $PLACEHOLDER_COUNT template placeholders (review before approval)"
  else
    check_pass "No template placeholders"
  fi
else
  check_fail "Script markdown not found"
fi

# Phase 3: Approval Status
echo ""
echo -e "${BOLD}Phase 3: Approval Status${NC}"

if [ -f "$SCRIPT_JSON" ]; then
  CHANNEL_ID=$(jq -r '.channelId' "$SCRIPT_JSON")
  STATUS=$(jq -r '.status' "$SCRIPT_JSON")
  APPROVAL_REQUIRED=$(jq -r '.approval.required' "$SCRIPT_JSON")
  APPROVAL_STATUS=$(jq -r '.approval.status' "$SCRIPT_JSON")
  THEOLOGICAL_REVIEW=$(jq -r '.approval.theologicalReviewRequired' "$SCRIPT_JSON")

  echo "  Channel: $CHANNEL_ID"
  echo "  Status: $STATUS"
  echo "  Approval required: $APPROVAL_REQUIRED"
  echo "  Approval status: $APPROVAL_STATUS"
  echo "  Theological review required: $THEOLOGICAL_REVIEW"

  if [ "$APPROVAL_STATUS" = "pending" ]; then
    check_warn "Script awaiting approval"

    if [ "$THEOLOGICAL_REVIEW" = "true" ]; then
      check_warn "  ⬜ Waiting for theological review"
    fi
  elif [ "$APPROVAL_STATUS" = "approved" ]; then
    APPROVED_AT=$(jq -r '.approval.approvedAt' "$SCRIPT_JSON")
    APPROVED_BY=$(jq -r '.approval.approvedBy' "$SCRIPT_JSON")
    check_pass "Script approved"
    echo "  Approved at: $APPROVED_AT"
    echo "  Approved by: $APPROVED_BY"
  elif [ "$APPROVAL_STATUS" = "rejected" ]; then
    NOTES=$(jq -r '.approval.notes' "$SCRIPT_JSON")
    check_fail "Script rejected"
    echo "  Rejection reason: $NOTES"
  fi
fi

# Phase 4: Channel-Specific Requirements
echo ""
echo -e "${BOLD}Phase 4: Channel-Specific Requirements${NC}"

CONTENT_PROFILE="$PROJECT_ROOT/channels/$CHANNEL_ID/content-profile.json"
if [ -f "$CONTENT_PROFILE" ]; then
  check_pass "Content profile found for channel"

  # Extract requirements
  MIN_WORD=$(jq -r '.scriptRequirements.minWordCount // 150' "$CONTENT_PROFILE" 2>/dev/null)
  MAX_WORD=$(jq -r '.scriptRequirements.maxWordCount // 200' "$CONTENT_PROFILE" 2>/dev/null)
  THEOLOGY_REQ=$(jq -r '.scriptRequirements.theologicalReviewRequired // false' "$CONTENT_PROFILE" 2>/dev/null)

  # Ensure MIN_WORD and MAX_WORD are numbers
  MIN_WORD=${MIN_WORD:-150}
  MAX_WORD=${MAX_WORD:-200}

  echo "  Word count requirement: $MIN_WORD–$MAX_WORD"

  # Check word count against requirements (templates are skeletons, so warn if at edges but don't fail)
  if [ "$WORD_COUNT" -ge "$MIN_WORD" ] && [ "$WORD_COUNT" -le "$MAX_WORD" ]; then
    check_pass "Word count meets channel requirements"
  else
    check_warn "Word count outside channel requirements ($MIN_WORD–$MAX_WORD words; template is skeleton until filled in)"
  fi

  # Channel-specific checks
  if [ "$CHANNEL_ID" = "says-the-bible" ]; then
    echo ""
    echo -e "${CYAN}Says the Bible Checks:${NC}"

    if grep -q "Scripture\|Bible\|Psalm\|Genesis\|John\|Romans\|Corinthians\|Colossians" "$SCRIPT_MD" 2>/dev/null; then
      check_pass "Scripture references detected"
    else
      check_warn "No Scripture references found (required for Says the Bible)"
    fi

    if [ "$THEOLOGY_REQ" = "true" ]; then
      if [ "$APPROVAL_STATUS" != "pending" ]; then
        check_pass "Theological review enforced"
      else
        check_warn "Awaiting mandatory theological review"
      fi
    fi

    if grep -q "sensational\|SHOCKING\|REVEALED\|EXPOSED" "$SCRIPT_MD" 2>/dev/null; then
      check_fail "Sensational language detected (violates 'reverent' tone)"
    else
      check_pass "No sensational language (maintains reverent tone)"
    fi

  elif [ "$CHANNEL_ID" = "prochat" ]; then
    echo ""
    echo -e "${CYAN}ProChat Checks:${NC}"

    CALL_TO_ACTION_REQ=$(jq -r '.scriptRequirements.callToActionRequired // false' "$CONTENT_PROFILE")

    if [ "$CALL_TO_ACTION_REQ" = "true" ]; then
      if grep -q "try\|start\|next\|week\|action\|build\|implement\|test" "$SCRIPT_MD" 2>/dev/null; then
        check_pass "Call-to-action detected"
      else
        check_warn "CTA expected but not clearly present"
      fi
    fi

    if grep -q "Pain\|Insight\|Solution" "$SCRIPT_MD" 2>/dev/null; then
      check_pass "Pain-Insight-Solution framework detected"
    else
      check_warn "Pain-Insight-Solution framework not clearly present"
    fi
  fi
else
  check_fail "Content profile not found for channel"
fi

# Phase 5: Integration Check
echo ""
echo -e "${BOLD}Phase 5: Integration Check${NC}"

# Check if this job is tracked in topic backlog
if [ -f "$TOPIC_METADATA" ]; then
  TOPIC_ID=$(jq -r '.topicId' "$TOPIC_METADATA")
  TOPIC_BACKLOG="$PROJECT_ROOT/channels/$CHANNEL_ID/topic-backlog.json"

  if [ -f "$TOPIC_BACKLOG" ]; then
    if jq -e ".topicBacklog[] | select(.topicId == \"$TOPIC_ID\")" "$TOPIC_BACKLOG" >/dev/null 2>&1; then
      check_pass "Topic ID found in backlog"
    else
      check_warn "Topic ID not in current backlog (may have been archived)"
    fi
  fi
fi

# Summary
echo ""
print_header "Validation Summary"

if [ $VALIDATION_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed${NC}"
  echo ""
  echo "Script is ready for:"
  if [ "$APPROVAL_STATUS" = "pending" ]; then
    echo "  - Human review and approval"
    if [ "$THEOLOGICAL_REVIEW" = "true" ]; then
      echo "  - Theological review (mandatory)"
    fi
  elif [ "$APPROVAL_STATUS" = "approved" ]; then
    echo "  - Video generation"
  fi
else
  echo -e "${RED}❌ Validation failed (see errors above)${NC}"
  exit 1
fi

echo ""
