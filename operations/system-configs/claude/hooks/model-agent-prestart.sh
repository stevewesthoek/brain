#!/bin/bash

# Agent pre-start hook — fires PreToolUse on Agent calls
# Updates badge state BEFORE the agent runs, so the statusline shows it DURING execution
# PreToolUse payload: JSON with tool_name, tool_input, session_id

TRACKING_FILE="$HOME/.claude/model-tracking.json"

INPUT=$(cat)

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

# Extract subagent_type from tool_input
SUBAGENT=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get("tool_input", {}).get("subagent_type", ""))
except Exception:
    pass
' 2>/dev/null || echo "")

case "$SUBAGENT" in
  "deep-architect")
    update_badge "escalation-high-complexity" "Deep architecture analysis" "deep-architect"
    ;;
  "coder-default")
    update_badge "escalation-complexity" "Complex coding task" "coder-default"
    ;;
  "cheap-prep")
    update_badge "preprocessing-triage" "Context compression" "cheap-prep"
    ;;
  "Plan"|"plan")
    update_badge "plan-mode" "Planning phase" null
    ;;
  "")
    # No subagent_type — general agent spawn
    ;;
  *)
    # Other agent types — show agent name
    update_badge "escalation-complexity" "Agent: $SUBAGENT" "$SUBAGENT"
    ;;
esac

# Output empty JSON to allow the tool call (PreToolUse protocol)
printf '{}'
