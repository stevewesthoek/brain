#!/usr/bin/env bash
# cleanup-sessions.sh — delete Claude session files older than 90 days.
# Run inside the Office nightly scheduler. Logs to ~/.claude/logs/cleanup-sessions.log.

PROJECTS_DIR="$HOME/.claude/projects"
LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/cleanup-sessions.log"
MAX_AGE_DAYS=90

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "--- cleanup run start ---"

# Count and delete .jsonl files older than MAX_AGE_DAYS
deleted=0
while IFS= read -r -d '' file; do
  rm "$file"
  log "deleted: $file"
  ((deleted++))
done < <(find "$PROJECTS_DIR" -name "*.jsonl" -mtime +"$MAX_AGE_DAYS" -print0 2>/dev/null)

# Remove empty directories left behind (but not the project root dirs themselves)
find "$PROJECTS_DIR" -mindepth 2 -type d -empty -delete 2>/dev/null

log "done — deleted $deleted session file(s) older than ${MAX_AGE_DAYS} days"

# Rotate log: keep last 500 lines
if [[ -f "$LOG_FILE" ]]; then
  tail -500 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi
