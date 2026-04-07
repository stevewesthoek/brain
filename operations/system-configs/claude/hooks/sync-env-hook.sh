#!/usr/bin/env bash
# sync-env-hook.sh — PostToolUse hook: when a .env file is written or edited,
# run sync-credentials to pick up any new credential variables.

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(python3 -c '
import json, sys
try:
    payload = json.loads(sys.stdin.read())
    tool_input = payload.get("tool_input", {})
    print(tool_input.get("file_path") or tool_input.get("path") or "")
except Exception:
    pass
' <<< "$INPUT" 2>/dev/null || true)

[[ -z "$FILE_PATH" ]] && exit 0

FILE_LOWER=$(printf '%s' "$FILE_PATH" | tr '[:upper:]' '[:lower:]')

# Only trigger for real .env files, not templates
case "$FILE_LOWER" in
  *.env.example|*.env.sample|*.env.template) exit 0 ;;
  */.env|*/.env.*) ;;
  *) exit 0 ;;
esac

# Run sync in background so it doesn't block the response
"$HOME/.local/bin/sync-credentials" --quiet 2>/dev/null &

exit 0
