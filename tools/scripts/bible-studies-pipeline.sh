#!/usr/bin/env bash
# bible-studies-pipeline.sh — Nightly transcription + NotebookLM sync for Dance of Life Bible Studies
#
# Phases:
#   1. Scan Bible Studies/ for new audio/video files
#   2. Transcribe each with mlx-whisper (large-v3, max quality)
#   3. Format transcript as Obsidian markdown note
#   4. Write note to brain/personal/bible-studies/dance-of-life/
#   5. Sync notes + resources to NotebookLM (one notebook per series: "DOL - [Series]")
#   6. Regenerate README index
#   7. Git commit new notes to brain repo
#
# Called by: office-nightly-scheduler.sh (last content job, after dance-of-life-sync)
# Script:    tools/scripts/bible-studies/pipeline.mjs
# State:     ~/.local/state/bible-studies/state.json
# Log:       ~/Library/Logs/office-scheduler/bible-studies.log
#
# Usage:
#   ./bible-studies-pipeline.sh              # normal nightly run
#   FORCE_RESCAN=1 ./bible-studies-pipeline.sh  # recheck all videos (skip already-transcribed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE="$SCRIPT_DIR/bible-studies/pipeline.mjs"

# ── Concurrency lock ─────────────────────────────────────────────────────────
# Prevents a second nightly scheduler run from spawning a concurrent mlx_whisper
# process on top of a still-running transcription session (which would exhaust
# memory and trigger a kernel watchdog panic).
LOCK_FILE="${HOME}/.local/state/bible-studies/pipeline.lock"
mkdir -p "$(dirname "$LOCK_FILE")"

if [[ -f "$LOCK_FILE" ]]; then
  EXISTING_PID="$(cat "$LOCK_FILE" 2>/dev/null || echo '')"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "[$(date '+%H:%M:%S')] Pipeline already running (pid $EXISTING_PID) — skipping this invocation" >&2
    exit 0
  else
    echo "[$(date '+%H:%M:%S')] Stale lock found (pid $EXISTING_PID) — clearing and continuing" >&2
    rm -f "$LOCK_FILE"
  fi
fi

printf '%s\n' "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

if [[ ! -f "$PIPELINE" ]]; then
  echo "ERROR: pipeline not found at $PIPELINE" >&2
  exit 1
fi

# Locate bun
BUN_BIN="$(command -v bun 2>/dev/null || echo "$HOME/.bun/bin/bun")"
if [[ ! -x "$BUN_BIN" ]]; then
  echo "ERROR: bun not found. Install it with: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

# Locate mlx_whisper (launchd has minimal PATH; pipx installs to ~/.local/bin)
MLX_BIN="$(command -v mlx_whisper 2>/dev/null || echo "$HOME/.local/bin/mlx_whisper")"
if [[ ! -x "$MLX_BIN" ]]; then
  echo "ERROR: mlx_whisper not found." >&2
  echo "  Install with: brew install pipx && pipx install mlx-whisper" >&2
  exit 1
fi
export MLX_WHISPER_BIN="$MLX_BIN"

export FORCE_RESCAN="${FORCE_RESCAN:-0}"

exec "$BUN_BIN" "$PIPELINE"
