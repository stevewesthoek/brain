#!/bin/bash

# Badge reset hook - runs on Stop to reset badge state when task completes
# Resets reason to "default", but model stays true (from statusline payload)

TRACKING_FILE="$HOME/.claude/model-tracking.json"

# Reset badge state only (reason, agent)
# The actual model is always authoritative from the statusline payload
cat > "$TRACKING_FILE" <<EOF
{
  "reason": "default",
  "context": "",
  "timestamp": null,
  "agent": null
}
EOF
