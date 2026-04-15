#!/bin/bash

# Model tracking hook - detects mode from user prompt, updates badge state
# Triggered on UserPromptSubmit (receives JSON on stdin with .prompt field)

TRACKING_FILE="$HOME/.claude/model-tracking.json"

# Ensure tracking file exists
if [ ! -f "$TRACKING_FILE" ]; then
  cat > "$TRACKING_FILE" <<EOF
{
  "reason": "default",
  "context": "",
  "timestamp": null,
  "agent": null
}
EOF
fi

# Read the JSON payload from stdin
USER_INPUT=$(cat)

# Extract the actual prompt text from the JSON payload (.prompt field)
PROMPT=$(printf '%s' "$USER_INPUT" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get("prompt", ""))
except Exception:
    pass
' 2>/dev/null || echo "")

update_badge() {
  local reason=$1
  local context=$2
  local agent=$3
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > "$TRACKING_FILE" <<EOF
{
  "reason": "$reason",
  "context": "$context",
  "timestamp": "$timestamp",
  "agent": "$agent"
}
EOF
}

# Detect review skill (/review)
if printf '%s' "$PROMPT" | grep -qE "/review|review.*pr|code.*review"; then
  update_badge "review-mode" "Pre-landing PR review" null

# Detect /firecrawl or web research
elif printf '%s' "$PROMPT" | grep -qE "/firecrawl"; then
  update_badge "research-mode" "Web scraping and research" null

# Detect /gemini preprocessing
elif printf '%s' "$PROMPT" | grep -qE "/gemini"; then
  update_badge "preprocessing-large-context" "Free-tier preprocessing of large inputs" null

# Detect /ship or /land-and-deploy
elif printf '%s' "$PROMPT" | grep -qE "/ship|/land-and-deploy"; then
  update_badge "deploy-mode" "Ship workflow - merge and deploy" null

# Detect plan mode entry
elif printf '%s' "$PROMPT" | grep -qiE "EnterPlanMode"; then
  update_badge "plan-mode" "Architecture planning phase" null
fi

# Echo back the input unchanged (hook protocol)
printf '%s' "$USER_INPUT"
