#!/bin/bash
# Ledger Replay — Show all events in a session
# Usage: ledger-replay <session-id> [--detailed]

set -euo pipefail

SESSION_ID="${1:-}"
DETAILED="${2:-}"

if [[ -z "$SESSION_ID" ]]; then
  echo "Usage: ledger-replay <session-id> [--detailed]" >&2
  exit 1
fi

LEDGER_PATH="${HOME}/.local/brain-ledger/ledger.jsonl"

if [[ ! -f "$LEDGER_PATH" ]]; then
  echo "Ledger not found: $LEDGER_PATH" >&2
  exit 1
fi

echo "Session: $SESSION_ID" >&2
echo "---" >&2

while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  SESSION_IN_LINE=$(echo "$line" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || echo "")

  if [[ "$SESSION_IN_LINE" != "$SESSION_ID" ]]; then
    continue
  fi

  if [[ "$DETAILED" == "--detailed" ]]; then
    echo "$line" | jq '.' 2>/dev/null || echo "$line"
  else
    ID=$(echo "$line" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    TS=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
    TY=$(echo "$line" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
    AG=$(echo "$line" | grep -o '"agent":"[^"]*"' | cut -d'"' -f4)
    echo "[$TS] $TY ($AG) - $ID" >&2
  fi
done < "$LEDGER_PATH"
