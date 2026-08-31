#!/usr/bin/env bash
# dance-of-life-sync.sh — Manual sync wrapper for the Dance of Life Library downloader
#
# The production scheduler entry is blocked/disabled; this wrapper is not an automatic lane.
# Manual default rescans for new files. Already-downloaded files are skipped (never re-downloaded).
#
# Usage:
#   ./dance-of-life-sync.sh              # FORCE_RESCAN=1 (manual default)
#   FORCE_RESCAN=0 ./dance-of-life-sync.sh  # continue initial bulk download without rescan
#
# Called by: explicit operator procedure only
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

# Locate bun (launchd has a minimal PATH, so check known install location too)
BUN_BIN="$(command -v bun 2>/dev/null || echo "$HOME/.bun/bin/bun")"
if [[ ! -x "$BUN_BIN" ]]; then
  echo "ERROR: bun not found. Install it with: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

export FORCE_RESCAN="${FORCE_RESCAN:-1}"

exec "$BUN_BIN" "$DOWNLOADER"
