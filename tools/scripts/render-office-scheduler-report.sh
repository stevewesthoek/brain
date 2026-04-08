#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${OFFICE_SCHEDULER_STATE_DIR:-$HOME/.local/state/office-scheduler}"
LOG_DIR="${OFFICE_SCHEDULER_LOG_DIR:-$HOME/Library/Logs/office-scheduler}"
OUTPUT_FILE="${OFFICE_SCHEDULER_REPORT_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/runtime/local/office-scheduler/latest-run.md}"
MAIN_LOG="$LOG_DIR/nightly.log"
LAST_COMPLETED_FILE="$STATE_DIR/last_completed_lisbon_date"

mkdir -p "$(dirname "$OUTPUT_FILE")"

timestamp() {
  TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z'
}

read_state_value() {
  local file="$1"
  local key="$2"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  awk -F= -v key="$key" '$1 == key { sub(/^[^=]+=/, "", $0); print $0; exit }' "$file"
}

render_job_row() {
  local job_name="$1"
  local state_file="$STATE_DIR/${job_name}.last"
  local status="not-run-yet"
  local exit_code="-"
  local duration_seconds="-"
  local updated_at="-"

  if [[ -f "$state_file" ]]; then
    status="$(read_state_value "$state_file" "status" || true)"
    exit_code="$(read_state_value "$state_file" "exit_code" || true)"
    duration_seconds="$(read_state_value "$state_file" "duration_seconds" || true)"
    updated_at="$(read_state_value "$state_file" "updated_at_lisbon" || true)"
  fi

  printf '| `%s` | `%s` | `%s` | `%s` | `%s` |\n' \
    "$job_name" \
    "${status:--}" \
    "${exit_code:--}" \
    "${duration_seconds:--}" \
    "${updated_at:--}"
}

last_completed_lisbon_date="not-yet-recorded"
if [[ -f "$LAST_COMPLETED_FILE" ]]; then
  last_completed_lisbon_date="$(cat "$LAST_COMPLETED_FILE")"
fi

last_log_lines="_log file not found_"
if [[ -f "$MAIN_LOG" ]]; then
  last_log_lines="$(tail -n 20 "$MAIN_LOG")"
fi

cat > "$OUTPUT_FILE" <<EOF
# Office Scheduler Latest Run

Generated at: \`$(timestamp)\`

State sources:
- \`$STATE_DIR\`
- \`$LOG_DIR\`

Last completed Lisbon date: \`$last_completed_lisbon_date\`

## Latest Job States

| Job | Status | Exit code | Duration (s) | Updated at |
| --- | --- | --- | --- | --- |
$(render_job_row "stb-pipeline-batch")
$(render_job_row "n8n-backup")
$(render_job_row "claude-session-cleanup")
$(render_job_row "dance-of-life-sync")
$(render_job_row "bible-studies-pipeline")
$(render_job_row "gemini-cleanup")
$(render_job_row "skill-prune")

## Latest Nightly Log Tail

\`\`\`text
$last_log_lines
\`\`\`
EOF

