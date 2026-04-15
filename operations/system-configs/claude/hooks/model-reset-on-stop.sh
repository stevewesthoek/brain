#!/bin/bash

# Stop hook — full reset when a task completes
# Clears both mode and agents array.

TRACKING_FILE="$HOME/.claude/model-tracking.json"

cat > "$TRACKING_FILE" <<'EOF'
{
  "mode": "default",
  "agents": []
}
EOF
