#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

extract_command() {
  printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    payload = json.loads(sys.stdin.read())
    tool_input = payload.get("tool_input", {})
    print(tool_input.get("command", ""))
except Exception:
    pass
' 2>/dev/null || true
}

ask() {
  local reason="$1"
  python3 - <<'PY' "$reason"
import json, sys
reason = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": reason,
    }
}))
PY
  exit 0
}

allow() {
  echo '{}'
  exit 0
}

CMD="$(extract_command)"
[ -n "$CMD" ] || allow

CMD_LOWER=$(printf '%s' "$CMD" | tr '[:upper:]' '[:lower:]')

# Only gate commands that ship, publish, open PRs, or mutate remote environments.
if ! printf '%s' "$CMD_LOWER" | grep -Eq '\b(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+create|npm[[:space:]]+publish|cargo[[:space:]]+publish|wrangler[[:space:]]+deploy|vercel([[:space:]].*)?[[:space:]]+deploy|flyctl?[[:space:]]+deploy|netlify[[:space:]]+deploy|terraform[[:space:]]+apply|pulumi[[:space:]]+up|kubectl[[:space:]]+apply|helm[[:space:]]+(upgrade|install)|dokploy(-cli)?[[:space:]].*\bdeploy\b)\b' 2>/dev/null; then
  allow
fi

# Review evidence is intentionally local and lightweight. This hook starts as
# confirmation-only because review evidence formats are still being standardized.
review_evidence=false

if [ -f ".ai/review-ok" ]; then
  review_evidence=true
fi

if [ -f ".ai/current.md" ] && grep -Eiq 'review (passed|clean|ok)|clean after [0-9]+ iteration|no blocking review findings' .ai/current.md 2>/dev/null; then
  review_evidence=true
fi

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/brain-hooks"
if [ -f "$state_dir/review-ok" ]; then
  review_evidence=true
fi

if [ "$review_evidence" = true ]; then
  allow
fi

ask "Shipping/publish/PR/deploy command detected without local review evidence. Run /review or confirm intentionally proceeding without a fresh review marker."
