#!/bin/bash

# Agent pre-start hook — PreToolUse(Agent)
# Adds the spawned agent to the agents array BEFORE it starts running,
# so the statusline shows it live during execution.

TRACKING_FILE="$HOME/.claude/model-tracking.json"

INPUT=$(cat)

# Extract subagent_type from the tool_input payload
SUBAGENT=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get("tool_input", {}).get("subagent_type", ""))
except Exception:
    pass
' 2>/dev/null || echo "")

# Allow all agent invocations — we just want to track them
[ -z "$SUBAGENT" ] && { printf '{}'; exit 0; }

# Map agent type → model (from routing policy in CLAUDE.md)
case "$SUBAGENT" in
  cheap-prep)          AGENT_MODEL="haiku"  ;;
  coder-default)       AGENT_MODEL="sonnet" ;;
  deep-architect)      AGENT_MODEL="opus"   ;;
  Plan|plan)           AGENT_MODEL="sonnet" ;;
  Explore|explore)     AGENT_MODEL="sonnet" ;;
  general-purpose)     AGENT_MODEL="sonnet" ;;
  claude-code-guide)   AGENT_MODEL="sonnet" ;;
  statusline-setup)    AGENT_MODEL="sonnet" ;;
  *)
    # Unknown type — inherit session model
    AGENT_MODEL=$(jq -r '.model // "sonnet"' "$HOME/.claude/settings.json" 2>/dev/null || echo "sonnet")
    ;;
esac

# Unique ID: type + epoch seconds + random
AGENT_ID="${SUBAGENT}-$(date +%s)-${RANDOM}"

# Add this agent to the tracking file
python3 - "$TRACKING_FILE" "$AGENT_ID" "$SUBAGENT" "$AGENT_MODEL" <<'PY'
import json, sys

path, agent_id, agent_type, model = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

try:
    with open(path) as f:
        state = json.load(f)
except Exception:
    state = {"mode": "default", "agents": []}

if "agents" not in state:
    state["agents"] = []

state["agents"].append({
    "id": agent_id,
    "type": agent_type,
    "model": model,
    "status": "running"
})

with open(path, "w") as f:
    json.dump(state, f, indent=2)
PY

# Output {} = allow the tool call (PreToolUse protocol)
printf '{}'
