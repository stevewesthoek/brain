#!/usr/bin/env bash
# dance-of-life-sync.sh — Daily sync wrapper for the Dance of Life Library downloader
#
# By default sets FORCE_RESCAN=1 so the daily scheduler always rescans the source
# for new files. Already-downloaded files are skipped (never re-downloaded).
#
# Usage:
#   ./dance-of-life-sync.sh              # FORCE_RESCAN=1 (daily scheduler default)
#   FORCE_RESCAN=0 ./dance-of-life-sync.sh  # continue initial bulk download without rescan
#
# Called by: office-nightly-scheduler.sh (last job in chain, lowest priority)
# Script:    tools/scripts/dance-of-life/sync_downloader.mjs
# State:     ~/.local/state/dance-of-life/state.json
# Log:       ~/Library/Logs/office-scheduler/dance-of-life.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOWNLOADER="$SCRIPT_DIR/dance-of-life/sync_downloader.mjs"

if [[ ! -f "$DOWNLOADER" ]]; then
  echo "ERROR: downloader not found at $DOWNLOADER" >&2
  exit 1
fi

# Require bun
if ! command -v bun &>/dev/null; then
  echo "ERROR: bun is not installed. Install it with: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

export FORCE_RESCAN="${FORCE_RESCAN:-1}"

exec bun "$DOWNLOADER"
