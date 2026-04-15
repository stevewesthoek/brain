#!/bin/bash

# Agent post-complete hook — PostToolUse(Agent)
# Marks the most-recently-started running agent as "done".
# Agents stay visible in the statusline (with ✓) until the next user prompt clears them.

TRACKING_FILE="$HOME/.claude/model-tracking.json"

INPUT=$(cat)

# Mark the last "running" agent as "done"
python3 - "$TRACKING_FILE" <<'PY'
import json, sys

path = sys.argv[1]

try:
    with open(path) as f:
        state = json.load(f)
except Exception:
    state = {"mode": "default", "agents": []}

agents = state.get("agents", [])

# Find the last running agent and mark it done
for a in reversed(agents):
    if a.get("status") == "running":
        a["status"] = "done"
        break

state["agents"] = agents

with open(path, "w") as f:
    json.dump(state, f, indent=2)
PY

# Pass through (PostToolUse protocol)
printf '%s' "$INPUT"
