#!/bin/bash
# Select topic and generate script draft
# Usage: select-topic-for-script.sh <channelId> <topicId> <jobId>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Arguments
CHANNEL_ID="${1:-}"
TOPIC_ID="${2:-}"
JOB_ID="${3:-}"

# Validation
if [ -z "$CHANNEL_ID" ] || [ -z "$TOPIC_ID" ] || [ -z "$JOB_ID" ]; then
  echo "Usage: select-topic-for-script.sh <channelId> <topicId> <jobId>"
  echo ""
  echo "Example:"
  echo "  select-topic-for-script.sh says-the-bible stb-baptism-001 stb-script-001"
  exit 1
fi

echo "==========================================="
echo "Select Topic & Generate Script Draft"
echo "==========================================="
echo ""
echo "Channel:  $CHANNEL_ID"
echo "Topic:    $TOPIC_ID"
echo "Job:      $JOB_ID"
echo ""

# Check topic backlog exists
TOPIC_BACKLOG="$PROJECT_ROOT/channels/$CHANNEL_ID/topic-backlog.json"
if [ ! -f "$TOPIC_BACKLOG" ]; then
  echo -e "${RED}✗ Topic backlog not found: $TOPIC_BACKLOG${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Topic backlog found${NC}"

# Check content profile exists
CONTENT_PROFILE="$PROJECT_ROOT/channels/$CHANNEL_ID/content-profile.json"
if [ ! -f "$CONTENT_PROFILE" ]; then
  echo -e "${RED}✗ Content profile not found: $CONTENT_PROFILE${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Content profile found${NC}"

# Find topic in backlog
TOPIC=$(jq ".topicBacklog[] | select(.topicId == \"$TOPIC_ID\")" "$TOPIC_BACKLOG" 2>/dev/null)
if [ -z "$TOPIC" ]; then
  echo -e "${RED}✗ Topic not found in backlog: $TOPIC_ID${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Topic found in backlog${NC}"

# Create job directories
JOB_DIR="$PROJECT_ROOT/jobs/$JOB_ID"
mkdir -p "$JOB_DIR/metadata"
mkdir -p "$JOB_DIR/scripts"
echo -e "${GREEN}✓ Job directories created${NC}"

# Create topic.json in job
TOPIC_FILE="$JOB_DIR/metadata/topic.json"
jq -n \
  --arg jobId "$JOB_ID" \
  --arg channelId "$CHANNEL_ID" \
  --arg topicId "$TOPIC_ID" \
  --argjson topic "$TOPIC" \
  '{
    jobId: $jobId,
    channelId: $channelId,
    topicId: $topicId,
    topic: $topic,
    selectedAt: now | todateiso8601
  }' > "$TOPIC_FILE"
echo -e "${GREEN}✓ Topic metadata saved${NC}"

# Extract profile info
THEOLOGICAL_REVIEW=$(jq -r '.scriptRequirements.theologicalReviewRequired // false' "$CONTENT_PROFILE")
TARGET_DURATION=$(jq -r '.targetDurationSeconds // 60' "$CONTENT_PROFILE")
MIN_WORD_COUNT=$(jq -r '.scriptRequirements.minWordCount // 150' "$CONTENT_PROFILE")
MAX_WORD_COUNT=$(jq -r '.scriptRequirements.maxWordCount // 200' "$CONTENT_PROFILE")

# Generate script based on channel template
SCRIPT_MD="$JOB_DIR/scripts/script.md"
TOPIC_TITLE=$(echo "$TOPIC" | jq -r '.title')

if [ "$CHANNEL_ID" = "says-the-bible" ]; then
  # Says the Bible template
  cat > "$SCRIPT_MD" << SCRIPT_EOF
# $TOPIC_TITLE

## Hook (0-5 seconds)
[Opening: reverent, direct]

Many Christians ask: $TOPIC_TITLE

[Pause]

The answer matters. Let's look at what Scripture says.

## Body (5-50 seconds)
[Scripture focus, theological accuracy]

Scripture reveals [MAIN_THEOLOGICAL_CLAIM]:

- [SCRIPTURE_REFERENCE]: [RELEVANT_PASSAGE_or_PARAPHRASE]
- [SCRIPTURE_REFERENCE]: [REINFORCING_PASSAGE]

This matters because [THEOLOGICAL_IMPLICATION].

[OPTIONAL_COUNTERARGUMENT]: Some claim [OBJECTION]. But Scripture is clear: [REFUTATION].

## Application (50-55 seconds)
[Personal relevance]

This changes how we [PRACTICAL_APPLICATION].

## Call to Action (55-60 seconds)
[Closing: reverent]

If this has been helpful, subscribe to explore more Scripture-based answers to questions Christians face.

---

## Metadata
- Target Duration: ${TARGET_DURATION}s
- Word Count: [ESTIMATE_150-200]
- Scripture Quotes Minimum: 1
- Theological Review Required: YES
- Review Checklist: [ ] Accuracy [ ] Tone [ ] Scripture Integration [ ] Clarity
SCRIPT_EOF

elif [ "$CHANNEL_ID" = "prochat" ]; then
  # ProChat template
  cat > "$SCRIPT_MD" << SCRIPT_EOF
# $TOPIC_TITLE

## Hook (0-5 seconds)
[Direct, B2B, founder-focused]

Here's what I see:

$TOPIC_TITLE

[Pause]

This is killing SaaS teams. Let me break it down.

## Pain (5-20 seconds)
[The problem founders face]

Most founders [PAIN_POINT]:

- They [SYMPTOM_1]
- They [SYMPTOM_2]
- Result: [CONSEQUENCE]

## Insight (20-40 seconds)
[Why it matters, reframe]

But here's what most miss: [INSIGHT]

The real issue is: [ROOT_CAUSE]

[DATA_POINT or OBSERVATION]: [SUPPORTING_EVIDENCE]

This changes the game because [WHY_IT_MATTERS].

## Solution (40-55 seconds)
[What to do]

Here's what works:

1. [ACTION_1]: [HOW_IT_FIXES_PAIN]
2. [ACTION_2]: [WHAT_CHANGES]

Result: [OUTCOME]

## Call to Action (55-60 seconds)
[Direct close]

If your team is facing this, try [ACTION_1] next week.

Tag me when you ship it. I want to see it work.

---

## Metadata
- Target Duration: ${TARGET_DURATION}s
- Word Count: [ESTIMATE_150-200]
- CTA Required: YES
- Approval Required: YES
- Framework: Pain → Insight → Solution → CTA
SCRIPT_EOF

else
  echo -e "${RED}✗ Unknown channel template: $CHANNEL_ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Script template generated${NC}"

# Count words in script content (excluding metadata and section headers with brackets)
SCRIPT_WORD_COUNT=$(sed '/^---$/,$d' "$SCRIPT_MD" | grep -v '^\[.*\]$' | wc -w)

# Create script.json metadata
SCRIPT_JSON="$JOB_DIR/metadata/script.json"
jq -n \
  --arg jobId "$JOB_ID" \
  --arg channelId "$CHANNEL_ID" \
  --arg topicId "$TOPIC_ID" \
  --arg title "$TOPIC_TITLE" \
  --arg targetDuration "$TARGET_DURATION" \
  --arg wordCount "$SCRIPT_WORD_COUNT" \
  --arg theologicalReview "$THEOLOGICAL_REVIEW" \
  '{
    jobId: $jobId,
    channelId: $channelId,
    topicId: $topicId,
    status: "draft",
    title: $title,
    targetDurationSeconds: ($targetDuration | tonumber),
    wordCount: ($wordCount | tonumber),
    scriptKey: "jobs/\($jobId)/scripts/script.md",
    generatedBy: "manual-template-v1",
    createdAt: now | todateiso8601,
    updatedAt: now | todateiso8601,
    approval: {
      required: true,
      status: "pending",
      theologicalReviewRequired: ($theologicalReview == "true"),
      approvedAt: null,
      approvedBy: null,
      notes: null
    }
  }' > "$SCRIPT_JSON"

echo -e "${GREEN}✓ Script metadata saved${NC}"

echo ""
echo "==========================================="
echo -e "${GREEN}✅ Script draft generated${NC}"
echo "==========================================="
echo ""
echo "Files created:"
echo "  Topic metadata:  $TOPIC_FILE"
echo "  Script markdown: $SCRIPT_MD"
echo "  Script metadata: $SCRIPT_JSON"
echo ""
echo "Status: draft (approval pending)"
echo "Word count: $SCRIPT_WORD_COUNT"
echo "Theological review required: $THEOLOGICAL_REVIEW"
echo ""
