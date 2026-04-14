#!/bin/bash

# Model reset hook - runs on Stop to reset model tracking when task completes
# Allows the next task to start with a clean slate at Haiku

TRACKING_FILE="$HOME/.claude/model-tracking.json"

# Reset to default state
cat > "$TRACKING_FILE" <<EOF
{
  "model": "haiku",
  "reason": "default",
  "context": "",
  "timestamp": null,
  "agent": null
}
EOF

echo "Model tracking reset to default (Haiku)"
