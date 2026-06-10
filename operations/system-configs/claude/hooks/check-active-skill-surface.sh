#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

extract_field() {
  local field="$1"
  printf '%s' "$INPUT" | python3 -c 'import json,sys
field = sys.argv[1]
try:
    payload = json.loads(sys.stdin.read())
    tool_input = payload.get("tool_input", {})
    print(tool_input.get(field, ""))
except Exception:
    pass
' "$field" 2>/dev/null || true
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

TARGET_PATH="$(extract_field file_path)"
[ -n "$TARGET_PATH" ] || TARGET_PATH="$(extract_field path)"
COMMAND="$(extract_field command)"

TARGET_LOWER=$(printf '%s' "$TARGET_PATH" | tr '[:upper:]' '[:lower:]')
COMMAND_LOWER=$(printf '%s' "$COMMAND" | tr '[:upper:]' '[:lower:]')

# Guard direct file writes/edits into the exported active skill surface.
# Active should remain an explicit export/profile surface, not a place for raw skill source edits.
case "$TARGET_LOWER" in
  *"/ai/skills/active/"*|"ai/skills/active/"*)
    case "$TARGET_LOWER" in
      *"/skill.md"|*"skill.md")
        ask "Direct SKILL.md write/edit under ai/skills/active detected. Put skill source in ai/skills/custom or ai/skills/vendors, register it in docs/skills/skill-index.md, and only activate via an explicit profile/export decision."
        ;;
      *)
        ask "Direct edit under ai/skills/active detected. active/ is the exported skill surface; confirm this is an intentional activation/symlink change, not source editing."
        ;;
    esac
    ;;
esac

# Guard common shell commands that copy or create raw active skill folders.
if [ -n "$COMMAND_LOWER" ]; then
  if printf '%s' "$COMMAND_LOWER" | grep -Eq '\b(mkdir|cp|rsync|mv)\b.*ai/skills/active/' 2>/dev/null; then
    ask "Command appears to create/copy/move content into ai/skills/active. active/ should contain only intentional exported entries; use custom/ or vendors/ for source and update the skill registry."
  fi

  if printf '%s' "$COMMAND_LOWER" | grep -Eq '\bln[[:space:]].*ai/skills/active/' 2>/dev/null; then
    ask "Skill activation symlink command detected. Confirm this activation is intentional and documented in the relevant profile/skill registry."
  fi
fi

allow
