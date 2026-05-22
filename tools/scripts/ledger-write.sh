#!/bin/bash
# Ledger Writer CLI
# Usage: ledger-write --type <type> --session <id> --agent <agent> --payload <json>

set -euo pipefail

TYPE=""
SESSION_ID=""
AGENT=""
PAYLOAD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      TYPE="$2"
      shift 2
      ;;
    --session)
      SESSION_ID="$2"
      shift 2
      ;;
    --agent)
      AGENT="$2"
      shift 2
      ;;
    --payload)
      PAYLOAD="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TYPE" ]] || [[ -z "$SESSION_ID" ]] || [[ -z "$AGENT" ]]; then
  echo "Usage: ledger-write --type <type> --session <id> --agent <agent> --payload <json>" >&2
  exit 1
fi

LEDGER_PATH="${HOME}/.local/brain-ledger/ledger.jsonl"
mkdir -p "$(dirname "$LEDGER_PATH")"

ENTRY=$(cat <<EOF
{
  "id": "evt_$(date +%s%N | cut -c1-14)_$(tr -dc 'a-z0-9' < /dev/urandom | head -c 6)",
  "version": "1.0",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "sessionId": "$SESSION_ID",
  "agent": "$AGENT",
  "type": "$TYPE",
  "actor": "haiku",
  "severity": "info",
  "status": "completed",
  "metadata": { "model": "haiku" },
  "payload": $PAYLOAD
}
EOF
)

echo "$ENTRY" >> "$LEDGER_PATH"
echo "✓ Logged: $TYPE" >&2
