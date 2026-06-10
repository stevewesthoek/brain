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

# Only inspect git staging / commit commands. This hook is intentionally narrow
# so normal source edits and exact-path staging remain low-friction.
if ! printf '%s' "$CMD" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(add|commit)\b'; then
  allow
fi

is_broad_stage=false
if printf '%s' "$CMD" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+add[[:space:]]+(-A|--all|\.)($|[[:space:];&|])'; then
  is_broad_stage=true
fi

# Generated/runtime paths that should not be swept into commits accidentally.
GENERATED_PATTERN='(^|/)(\.next|node_modules|dist|build|coverage|graphify-out)(/|$)|(^|/)tsx-[^/]+(/|$)|\.sqlite(-shm|-wal)?$|\.pack\.gz$|\.tsbuildinfo$|Codex Computer Use\.app/|projects/video-orchestrator/cloud/jobs/'

has_generated_dirty=false
has_generated_staged=false

git_status_names() {
  git status --porcelain --untracked-files=all 2>/dev/null | sed -E 's/^...//'
}

if git_status_names | grep -Eq "$GENERATED_PATTERN"; then
  has_generated_dirty=true
fi

if git diff --cached --name-only 2>/dev/null | grep -Eq "$GENERATED_PATTERN"; then
  has_generated_staged=true
fi

if [ "$is_broad_stage" = true ] && [ "$has_generated_dirty" = true ]; then
  ask "Broad git staging command detected while generated/runtime files are dirty. Stage exact intended paths instead of using git add . / -A / --all."
fi

if printf '%s' "$CMD" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+commit\b' && [ "$has_generated_staged" = true ]; then
  ask "Generated/runtime files are staged for commit. Confirm intentionally committing generated artifacts, or unstage them and commit exact source/docs paths only."
fi

allow
