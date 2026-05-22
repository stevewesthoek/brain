#!/bin/bash
# Ledger Report Generator
# Usage: ledger-report --type approvals|costs|errors|audit [--agent <agent>] [--days <n>]

set -euo pipefail

REPORT_TYPE="${1:-audit}"
AGENT=""
DAYS="7"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      REPORT_TYPE="$2"
      shift 2
      ;;
    --agent)
      AGENT="$2"
      shift 2
      ;;
    --days)
      DAYS="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

LEDGER_PATH="${HOME}/.local/brain-ledger/ledger.jsonl"

if [[ ! -f "$LEDGER_PATH" ]]; then
  echo "Ledger not found: $LEDGER_PATH" >&2
  exit 1
fi

case "$REPORT_TYPE" in
  approvals)
    echo "=== Approval Report ===" >&2
    echo "Approvals requested, granted, rejected:" >&2
    grep -c "approval_requested" "$LEDGER_PATH" || echo "0 requested" >&2
    grep -c "approval_granted" "$LEDGER_PATH" || echo "0 granted" >&2
    grep -c "approval_rejected" "$LEDGER_PATH" || echo "0 rejected" >&2
    ;;
  costs)
    echo "=== Cost Report ===" >&2
    echo "Total cost (last $DAYS days):" >&2
    grep '"type":"session_end"' "$LEDGER_PATH" | \
      tail -10 | \
      jq '.payload.total_cost' 2>/dev/null | \
      awk '{sum+=$1} END {print "$" sum}' || echo "No cost data" >&2
    ;;
  errors)
    echo "=== Error Report ===" >&2
    echo "Errors encountered:" >&2
    grep '"type":"error_encountered"' "$LEDGER_PATH" | wc -l || echo "0 errors" >&2
    ;;
  audit)
    echo "=== Audit Report ===" >&2
    echo "Ledger path: $LEDGER_PATH" >&2
    echo "Total entries: $(wc -l < "$LEDGER_PATH" || echo 0)" >&2
    echo "Sessions: $(grep -c 'session_start' "$LEDGER_PATH" || echo 0)" >&2
    echo "Tool calls: $(grep -c 'tool_call' "$LEDGER_PATH" || echo 0)" >&2
    echo "Errors: $(grep -c 'error_encountered' "$LEDGER_PATH" || echo 0)" >&2
    ;;
esac
