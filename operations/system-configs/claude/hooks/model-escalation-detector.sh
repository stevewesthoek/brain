#!/bin/bash

# Agent post-complete hook — fires PostToolUse on Agent calls
# Resets badge state AFTER the agent completes, returning to outer session model
# PostToolUse payload: JSON with tool_name, tool_input, tool_response, session_id

TRACKING_FILE="$HOME/.claude/model-tracking.json"

INPUT=$(cat)

# After an agent completes, reset to default so the statusline shows the outer session model cleanly
cat > "$TRACKING_FILE" <<EOF
{
  "reason": "default",
  "context": "",
  "timestamp": null,
  "agent": null
}
EOF

# Echo the input back (hook protocol for PostToolUse — pass through)
printf '%s' "$INPUT"
