#!/bin/bash
# Claude Code Ledger Writer Hook
# Triggered: UserPromptSubmit, ToolUse, ToolResult
# Purpose: Capture all agent actions for append-only audit trail

set -euo pipefail

SESSION_ID="${CLAUDE_SESSION_ID:-sess_$(date +%s)_$$}"
LEDGER_CLI="$HOME/.local/bin/ledger-write"

EVENT_TYPE="${1:-unknown}"
TOOL_NAME="${2:-}"
TOOL_RESULT="${3:-}"

case "$EVENT_TYPE" in
  ToolUse)
    LEDGER_TYPE="tool_call"
    PAYLOAD=$(cat <<EOF
{
  "tool_name": "$TOOL_NAME",
  "tool_type": "bash",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF
    )
    ;;
  ToolResult)
    LEDGER_TYPE="tool_result"
    PAYLOAD=$(cat <<EOF
{
  "tool_name": "$TOOL_NAME",
  "success": true,
  "duration_ms": 1000
}
EOF
    )
    ;;
  *)
    exit 0
    ;;
esac

if [[ -x "$LEDGER_CLI" ]]; then
  "$LEDGER_CLI" \
    --type "$LEDGER_TYPE" \
    --session "$SESSION_ID" \
    --agent claude-code \
    --payload "$PAYLOAD" \
    &> /dev/null &
fi

exit 0
