#!/usr/bin/env bash
# Manual/approved backup wrapper; the production Brain Scheduler entry is blocked/disabled.
set -euo pipefail

STATE_DIR="${N8N_BACKUP_STATE_DIR:-$HOME/.local/state/n8n-backup}"
LAST_SUCCESS_FILE="$STATE_DIR/last_successful_lisbon_date"
BACKUP_SCRIPT="${N8N_BACKUP_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-n8n.sh}"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

today_lisbon="$(TZ=Europe/Lisbon date +%F)"
hour_lisbon="$(TZ=Europe/Lisbon date +%H)"

if [[ "${FORCE_RUN:-0}" != "1" ]]; then
  if (( 10#$hour_lisbon < 3 )); then
    exit 0
  fi

  if [[ -f "$LAST_SUCCESS_FILE" ]] && [[ "$(cat "$LAST_SUCCESS_FILE")" == "$today_lisbon" ]]; then
    exit 0
  fi
fi

"$BACKUP_SCRIPT"

printf '%s\n' "$today_lisbon" > "$LAST_SUCCESS_FILE"
chmod 600 "$LAST_SUCCESS_FILE"
