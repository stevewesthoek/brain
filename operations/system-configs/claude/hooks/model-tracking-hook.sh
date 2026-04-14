#!/bin/bash

# Model tracking hook - detects model changes and updates tracking state
# Triggered on UserPromptSubmit to detect routing, plan mode, reviews, etc.

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

# Read the user's input from stdin
USER_INPUT=$(cat)

# Extract the actual prompt text (remove system messages, focus on user intent)
PROMPT=$(echo "$USER_INPUT" | sed -n '/^User:/,/^---/p' | head -1)

# Track badge state (reason, agent, context) based on user intent
# The actual model comes from Claude Code's statusline payload (always accurate)
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

# Detect Agent invocations (spawning coder-default, deep-architect, cheap-prep, etc.)
if echo "$PROMPT" | grep -qE "Agent\(|subagent_type"; then
  if echo "$PROMPT" | grep -q "deep-architect"; then
    update_badge "escalation-high-complexity" "Deep architecture task - multi-system reasoning" "deep-architect"
  elif echo "$PROMPT" | grep -q "coder-default"; then
    update_badge "escalation-complexity" "Complex coding task - multi-file or deep reasoning" "coder-default"
  elif echo "$PROMPT" | grep -q "cheap-prep"; then
    update_badge "preprocessing-triage" "Context compression before handing to main task" "cheap-prep"
  fi
fi

# Detect plan mode entry
if echo "$PROMPT" | grep -qiE "EnterPlanMode|enter.*plan|planning.*mode"; then
  update_badge "plan-mode" "Architecture planning phase - gathering info" null
fi

# Detect review skill (/review)
if echo "$PROMPT" | grep -qE "/review|review.*pr|code.*review"; then
  update_badge "review-mode" "Pre-landing PR review" null
fi

# Detect /firecrawl or web research
if echo "$PROMPT" | grep -qE "/firecrawl|/gemini|preprocessing.*context|large.*context"; then
  if echo "$PROMPT" | grep -q "/gemini"; then
    update_badge "preprocessing-large-context" "Free-tier preprocessing of large inputs" null
  else
    update_badge "research-mode" "Web scraping and research" null
  fi
fi

# Detect /ship or /land-and-deploy
if echo "$PROMPT" | grep -qE "/ship|/land-and-deploy|merge.*pr"; then
  update_badge "deploy-mode" "Ship workflow - merge and deploy" null
fi

# Default: back to default badge if no special mode detected
if [ -z "$PROMPT" ] || (! echo "$PROMPT" | grep -qE "Agent\(|subagent_type|EnterPlanMode|/review|/firecrawl|/gemini|/ship"); then
  # Only reset if we're not already in a multi-turn task
  CURRENT=$(jq -r '.reason' "$TRACKING_FILE" 2>/dev/null || echo "default")

  # Don't reset if we just started an agent or mode
  if [ "$CURRENT" = "default" ]; then
    update_badge "default" "" null
  fi
fi

# Echo back the input (hook protocol)
echo "$USER_INPUT"
