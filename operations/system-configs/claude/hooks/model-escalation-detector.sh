#!/bin/bash

# Model escalation detector - runs PostToolUse to catch actual Agent invocations
# Detects when tools complete and updates model state based on what actually ran

TRACKING_FILE="$HOME/.claude/model-tracking.json"

update_model() {
  local model=$1
  local reason=$2
  local context=$3
  local agent=$4

  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$TRACKING_FILE" <<EOF
{
  "model": "$model",
  "reason": "$reason",
  "context": "$context",
  "timestamp": "$timestamp",
  "agent": "$agent"
}
EOF
}

# Read the tool result from stdin
TOOL_RESULT=$(cat)

# Check for Agent tool invocation patterns in the result
# When an Agent completes, the result includes the tool name and subagent_type

# Detect which Agent was invoked based on output patterns
if echo "$TOOL_RESULT" | grep -q "subagent_type.*deep-architect"; then
  update_model "opus" "escalation-high-complexity" "Deep architecture analysis and planning" "deep-architect"
elif echo "$TOOL_RESULT" | grep -q "subagent_type.*coder-default"; then
  update_model "sonnet" "escalation-complexity" "Complex multi-file coding task" "coder-default"
elif echo "$TOOL_RESULT" | grep -q "subagent_type.*cheap-prep"; then
  update_model "haiku" "preprocessing-triage" "Context compression and analysis" "cheap-prep"
elif echo "$TOOL_RESULT" | grep -q "gemini-flash\|Flash.*preprocessing"; then
  update_model "gemini-flash" "preprocessing-large-context" "Free-tier context summarization (1M tokens)" null
fi

# Echo back the result (hook protocol)
echo "$TOOL_RESULT"
