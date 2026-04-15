#!/bin/bash

# Model tracking hook — UserPromptSubmit
# Clears the agent list from the previous turn (fresh start per prompt).
# Also sets the mode badge for skill-level context (/review, /ship, etc.).

TRACKING_FILE="$HOME/.claude/model-tracking.json"

USER_INPUT=$(cat)

# Extract the actual prompt text from the JSON payload
PROMPT=$(printf '%s' "$USER_INPUT" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get("prompt", ""))
except Exception:
    pass
' 2>/dev/null || echo "")

# Detect mode from skill invocations in the prompt
MODE="default"
if printf '%s' "$PROMPT" | grep -qE "^/review|review.*pr|code.*review"; then
    MODE="review"
elif printf '%s' "$PROMPT" | grep -qE "^/firecrawl|^/browse"; then
    MODE="research"
elif printf '%s' "$PROMPT" | grep -qE "^/gemini"; then
    MODE="gemini"
elif printf '%s' "$PROMPT" | grep -qE "^/ship|^/land-and-deploy"; then
    MODE="deploy"
elif printf '%s' "$PROMPT" | grep -qiE "EnterPlanMode"; then
    MODE="plan"
fi

# Reset agents array for new turn; preserve mode
python3 - "$TRACKING_FILE" "$MODE" <<'PY'
import json, sys

path, mode = sys.argv[1], sys.argv[2]

try:
    with open(path) as f:
        state = json.load(f)
except Exception:
    state = {}

state["mode"] = mode
state["agents"] = []  # clear previous turn's agents

with open(path, "w") as f:
    json.dump(state, f, indent=2)
PY

# Pass through (UserPromptSubmit protocol)
printf '%s' "$USER_INPUT"
