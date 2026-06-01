#!/bin/bash
# Create a draft video job from an interactive prompt
# Usage: create-job-from-prompt.sh <channelId> "<prompt>" [requestedBy]

set -e

if [ $# -lt 2 ]; then
  echo "Usage: $0 <channelId> \"<prompt>\" [requestedBy]"
  echo ""
  echo "Example:"
  echo "  $0 prochat \"AI can write code but not businesses\" Steve"
  exit 1
fi

CHANNEL_ID="$1"
PROMPT="$2"
REQUESTED_BY="${3:-Steve}"
BRAIN_CORE_HOST="${BRAIN_CORE_HOST:-http://localhost:4877}"

echo "Creating draft video job from prompt..."
echo "Channel: $CHANNEL_ID"
echo "Prompt: $PROMPT"
echo "Requested By: $REQUESTED_BY"
echo ""

# Call Brain Core API
RESPONSE=$(curl -s -X POST "$BRAIN_CORE_HOST/api/video-orchestrator/jobs/create-from-prompt" \
  -H "Content-Type: application/json" \
  -d "{
    \"channelId\": \"$CHANNEL_ID\",
    \"prompt\": \"$PROMPT\",
    \"requestedBy\": \"$REQUESTED_BY\"
  }")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract jobId for convenience
JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId // empty' 2>/dev/null)
if [ -n "$JOB_ID" ]; then
  echo "✓ Job created successfully: $JOB_ID"
  echo ""
  echo "Next steps:"
  echo "1. Review the script at: projects/video-orchestrator/cloud/jobs/$JOB_ID/scripts/script.md"
  echo "2. Edit and refine as needed"
  echo "3. Approve for generation when ready"
  exit 0
else
  ERROR=$(echo "$RESPONSE" | jq -r '.message // .error // "Unknown error"' 2>/dev/null)
  echo "✗ Failed to create job: $ERROR"
  exit 1
fi
