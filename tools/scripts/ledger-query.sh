#!/bin/bash
# Ledger Query CLI
# Usage: ledger-query [--type <type>] [--agent <agent>] [--recent <n>] [--format json|csv|table]

set -euo pipefail

LEDGER_PATH="${HOME}/.local/brain-ledger/ledger.jsonl"
TYPE=""
AGENT=""
RECENT=""
FORMAT="json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      TYPE="$2"
      shift 2
      ;;
    --agent)
      AGENT="$2"
      shift 2
      ;;
    --recent)
      RECENT="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$LEDGER_PATH" ]]; then
  echo "Ledger not found: $LEDGER_PATH" >&2
  exit 1
fi

ENTRIES=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  TYPE_IN_LINE=$(echo "$line" | grep -o '"type":"[^"]*"' | cut -d'"' -f4 || echo "")
  AGENT_IN_LINE=$(echo "$line" | grep -o '"agent":"[^"]*"' | cut -d'"' -f4 || echo "")

  if [[ -n "$TYPE" ]] && [[ "$TYPE_IN_LINE" != "$TYPE" ]]; then
    continue
  fi
  if [[ -n "$AGENT" ]] && [[ "$AGENT_IN_LINE" != "$AGENT" ]]; then
    continue
  fi

  ENTRIES+=("$line")
done < "$LEDGER_PATH"

if [[ -n "$RECENT" ]]; then
  ENTRIES=("${ENTRIES[@]: -$RECENT}")
fi

case "$FORMAT" in
  json)
    echo "[" >&2
    for i in "${!ENTRIES[@]}"; do
      echo "${ENTRIES[$i]}"
      if [[ $i -lt $((${#ENTRIES[@]} - 1)) ]]; then
        echo "," >&2
      fi
    done
    echo "]" >&2
    ;;
  csv)
    echo "id,timestamp,type,agent,severity" >&2
    for entry in "${ENTRIES[@]}"; do
      ID=$(echo "$entry" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
      TS=$(echo "$entry" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
      TY=$(echo "$entry" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
      AG=$(echo "$entry" | grep -o '"agent":"[^"]*"' | cut -d'"' -f4)
      SV=$(echo "$entry" | grep -o '"severity":"[^"]*"' | cut -d'"' -f4)
      echo "$ID,$TS,$TY,$AG,$SV" >&2
    done
    ;;
  table)
    printf "%-20s | %-25s | %-20s | %-15s | %-10s\n" "ID" "TIMESTAMP" "TYPE" "AGENT" "SEVERITY" >&2
    printf "%s\n" "$(printf '%.0s-' {1..100})" >&2
    for entry in "${ENTRIES[@]}"; do
      ID=$(echo "$entry" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | cut -c1-18)
      TS=$(echo "$entry" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4 | cut -c1-23)
      TY=$(echo "$entry" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
      AG=$(echo "$entry" | grep -o '"agent":"[^"]*"' | cut -d'"' -f4)
      SV=$(echo "$entry" | grep -o '"severity":"[^"]*"' | cut -d'"' -f4)
      printf "%-20s | %-25s | %-20s | %-15s | %-10s\n" "$ID" "$TS" "$TY" "$AG" "$SV" >&2
    done
    ;;
esac

echo "Total entries: ${#ENTRIES[@]}" >&2
