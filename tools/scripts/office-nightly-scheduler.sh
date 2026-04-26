#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${OFFICE_SCHEDULER_STATE_DIR:-$HOME/.local/state/office-scheduler}"
LOG_DIR="${OFFICE_SCHEDULER_LOG_DIR:-$HOME/Library/Logs/office-scheduler}"
MAIN_LOG="$LOG_DIR/nightly.log"
LOCK_DIR="$STATE_DIR/nightly.lock"
LAST_COMPLETED_FILE="$STATE_DIR/last_completed_lisbon_date"
STB_CONFIG_FILE="${OFFICE_SCHEDULER_STB_CONFIG_FILE:-$STATE_DIR/stb-pipeline-batch.env}"
REPORT_SCRIPT="${OFFICE_SCHEDULER_REPORT_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/render-office-scheduler-report.sh}"

mkdir -p "$STATE_DIR" "$LOG_DIR"
chmod 700 "$STATE_DIR" "$LOG_DIR"
touch "$MAIN_LOG"
chmod 600 "$MAIN_LOG"

timestamp() {
  TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z'
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*" >> "$MAIN_LOG"
}

write_job_state() {
  local job_name="$1"
  local status="$2"
  local exit_code="$3"
  local duration_seconds="$4"
  local error_message="${5:-}"
  local state_file="$STATE_DIR/${job_name}.last"

  {
    printf 'job_name=%s\n' "$job_name"
    printf 'status=%s\n' "$status"
    printf 'exit_code=%s\n' "$exit_code"
    printf 'duration_seconds=%s\n' "$duration_seconds"
    printf 'updated_at_lisbon=%s\n' "$(timestamp)"
    if [[ -n "$error_message" ]]; then
      printf 'error_message=%s\n' "$error_message"
    fi
  } > "$state_file"
  chmod 600 "$state_file"
}

run_with_timeout() {
  local timeout_seconds="$1"
  local command="$2"

  python3 - "$timeout_seconds" "$command" <<'PY'
import subprocess
import sys

timeout_seconds = int(sys.argv[1])
command = sys.argv[2]

try:
    completed = subprocess.run(
        command,
        shell=True,
        executable="/bin/bash",
        timeout=timeout_seconds,
        env=None,
    )
    raise SystemExit(completed.returncode)
except subprocess.TimeoutExpired:
    print(f"[office-nightly-scheduler] timeout after {timeout_seconds}s", file=sys.stderr)
    raise SystemExit(124)
PY
}

_read_error_snippet() {
  local log_file="$1"
  local lines="${2:-3}"
  if [[ -f "$log_file" ]]; then
    # Last $lines non-empty lines, collapsed to one line, max 200 chars
    grep -v '^\s*$' "$log_file" | tail -"$lines" | tr '\n' ' ' | cut -c1-200
  fi
}

run_job() {
  local job_name="$1"
  local timeout_seconds="$2"
  local command="$3"
  local error_log="${4:-}"   # optional: log file to read for error snippet on failure

  local started_at
  local ended_at
  local duration_seconds
  started_at="$(date +%s)"

  log "starting job=$job_name timeout=${timeout_seconds}s"

  if run_with_timeout "$timeout_seconds" "$command"; then
    ended_at="$(date +%s)"
    duration_seconds="$((ended_at - started_at))"
    write_job_state "$job_name" "success" "0" "$duration_seconds"
    log "finished job=$job_name status=success duration=${duration_seconds}s"
    return 0
  else
    local exit_code="$?"
    ended_at="$(date +%s)"
    duration_seconds="$((ended_at - started_at))"
    local error_snippet=""
    if [[ -n "$error_log" ]]; then
      error_snippet="$(_read_error_snippet "$error_log")"
    fi

    if [[ "$exit_code" -eq 124 ]]; then
      write_job_state "$job_name" "timeout" "$exit_code" "$duration_seconds" "$error_snippet"
      log "finished job=$job_name status=timeout duration=${duration_seconds}s"
    else
      write_job_state "$job_name" "failed" "$exit_code" "$duration_seconds" "$error_snippet"
      log "finished job=$job_name status=failed exit_code=$exit_code duration=${duration_seconds}s"
    fi

    return "$exit_code"
  fi
}

run_stb_pipeline_batch() {
  if [[ ! -f "$STB_CONFIG_FILE" ]]; then
    log "skipping job=stb-pipeline-batch reason=no_config_file file=$STB_CONFIG_FILE"
    return 0
  fi

  # shellcheck disable=SC1090
  source "$STB_CONFIG_FILE"

  if [[ "${STB_BATCH_ENABLED:-1}" != "1" ]]; then
    log "skipping job=stb-pipeline-batch reason=disabled"
    return 0
  fi

  if [[ -z "${STB_REPO_ROOT:-}" || -z "${STB_NODE_PATH:-}" || -z "${STB_SLUGS:-}" ]]; then
    log "skipping job=stb-pipeline-batch reason=incomplete_config"
    return 0
  fi

  local timeout_seconds="${STB_TIMEOUT_SECONDS:-10800}"
  local batch_log="${STB_BATCH_LOG:-/tmp/stb-pipeline-batch.log}"
  local extra_flags="${STB_EXTRA_FLAGS:-}"
  local command

  command=$(
    printf 'cd %q && %q --env-file .env scripts/pipeline/batch-run.mjs --slugs %q --fail-on-errors %s >> %q 2>&1' \
      "$STB_REPO_ROOT" \
      "$STB_NODE_PATH" \
      "$STB_SLUGS" \
      "$extra_flags" \
      "$batch_log"
  )

  run_job "stb-pipeline-batch" "$timeout_seconds" "$command" "$batch_log"
}

run_n8n_backup() {
  local timeout_seconds="${N8N_BACKUP_TIMEOUT_SECONDS:-1800}"
  local backup_script="${N8N_BACKUP_SCHEDULE_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-n8n-backup-schedule.sh}"
  local backup_log="${N8N_BACKUP_LOG_FILE:-$LOG_DIR/n8n-backup.log}"
  local command

  command=$(
    printf '%q >> %q 2>&1' \
      "$backup_script" \
      "$backup_log"
  )

  run_job "n8n-backup" "$timeout_seconds" "$command" "$backup_log"
}

run_claude_session_cleanup() {
  local timeout_seconds="${CLAUDE_CLEANUP_TIMEOUT_SECONDS:-300}"
  local cleanup_script="${CLAUDE_CLEANUP_SCRIPT:-$HOME/.claude/cleanup-sessions.sh}"
  local cleanup_log="$LOG_DIR/claude-cleanup.log"
  local command

  if [[ ! -x "$cleanup_script" ]]; then
    log "skipping job=claude-session-cleanup reason=missing_script path=$cleanup_script"
    return 0
  fi

  command="$(printf '%q >> %q 2>&1' "$cleanup_script" "$cleanup_log")"
  run_job "claude-session-cleanup" "$timeout_seconds" "$command" "$cleanup_log"
}

run_dance_of_life_sync() {
  local timeout_seconds="${DANCE_OF_LIFE_TIMEOUT_SECONDS:-21600}"  # 6 hours
  local sync_script="${DANCE_OF_LIFE_SYNC_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/dance-of-life-sync.sh}"
  local sync_log="$LOG_DIR/dance-of-life-sync.log"
  local command

  if [[ ! -x "$sync_script" ]]; then
    log "skipping job=dance-of-life-sync reason=missing_script path=$sync_script"
    return 0
  fi

  command="$(printf 'FORCE_RESCAN=1 %q >> %q 2>&1' "$sync_script" "$sync_log")"
  run_job "dance-of-life-sync" "$timeout_seconds" "$command" "$sync_log"
}

run_bible_studies_pipeline() {
  local timeout_seconds="${BIBLE_STUDIES_TIMEOUT_SECONDS:-14400}"  # 4 hours
  local pipeline_script="${BIBLE_STUDIES_PIPELINE_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bible-studies-pipeline.sh}"
  local pipeline_log="$LOG_DIR/bible-studies-pipeline.log"
  local command

  if [[ ! -x "$pipeline_script" ]]; then
    log "skipping job=bible-studies-pipeline reason=missing_script path=$pipeline_script"
    return 0
  fi

  command="$(printf '%q >> %q 2>&1' "$pipeline_script" "$pipeline_log")"
  run_job "bible-studies-pipeline" "$timeout_seconds" "$command" "$pipeline_log"
}

run_ing_bank_statement_download() {
  local day_of_month
  day_of_month="$(TZ=Europe/Lisbon date +%-d)"

  if [[ "$day_of_month" -ne 1 ]]; then
    log "skipping job=ing-bank-statement-download reason=not_first_of_month day=$day_of_month"
    return 0
  fi

  local timeout_seconds="${ING_DOWNLOAD_TIMEOUT_SECONDS:-900}"  # 15 minutes
  local download_script="${ING_DOWNLOAD_SCHEDULE_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-ing-bank-statement-download.sh}"
  local download_log="$LOG_DIR/ing-bank-statement-download.log"
  local command

  if [[ ! -x "$download_script" ]]; then
    log "skipping job=ing-bank-statement-download reason=missing_script path=$download_script"
    return 0
  fi

  command=$(
    printf '%q >> %q 2>&1' \
      "$download_script" \
      "$download_log"
  )

  run_job "ing-bank-statement-download" "$timeout_seconds" "$command" "$download_log"
}

run_skill_prune() {
  local day_of_month
  day_of_month="$(TZ=Europe/Lisbon date +%-d)"

  if [[ "$day_of_month" -ne 7 ]]; then
    log "skipping job=skill-prune reason=not_prune_day day=$day_of_month"
    return 0
  fi

  local month_key
  month_key="$(TZ=Europe/Lisbon date +%Y-%m)"
  local last_prune_file="$STATE_DIR/skill-prune.last-month"

  if [[ -f "$last_prune_file" ]] && [[ "$(cat "$last_prune_file")" == "$month_key" ]]; then
    log "skipping job=skill-prune reason=already_ran_this_month month=$month_key"
    return 0
  fi

  local timeout_seconds="${SKILL_PRUNE_TIMEOUT_SECONDS:-300}"
  local prune_log="$LOG_DIR/skill-prune.log"
  local prune_script="${SKILL_PRUNE_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skill-prune-report.sh}"
  local prune_config="${SKILL_PRUNE_CONFIG:-$STATE_DIR/skill-prune.env}"
  local command

  if [[ ! -x "$prune_script" ]]; then
    log "skipping job=skill-prune reason=missing_script path=$prune_script"
    return 0
  fi

  # Load skill-prune config if it exists
  local config_cmd=""
  if [[ -f "$prune_config" ]]; then
    config_cmd="source $prune_config && "
  fi

  command=$(printf '%s%q >> %q 2>&1' "$config_cmd" "$prune_script" "$prune_log")

  if run_job "skill-prune" "$timeout_seconds" "$command" "$prune_log"; then
    printf '%s\n' "$month_key" > "$last_prune_file"
    chmod 600 "$last_prune_file"
  fi
}

run_gemini_cleanup() {
  local timeout_seconds="${GEMINI_CLEANUP_TIMEOUT_SECONDS:-60}"
  local gemini_dir="${HOME}/.gemini"
  local max_age_days="${GEMINI_CLEANUP_MAX_AGE_DAYS:-7}"
  local command

  command=$(printf \
    'find %q/tmp %q/history -mindepth 1 -mtime +%d -delete 2>/dev/null; true' \
    "$gemini_dir" "$gemini_dir" "$max_age_days"
  )

  run_job "gemini-cleanup" "$timeout_seconds" "$command"
}

run_google_ads_sync() {
  local timeout_seconds="${GOOGLE_ADS_SYNC_TIMEOUT_SECONDS:-600}"  # 10 minutes
  local sync_script="${GOOGLE_ADS_SYNC_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/google-ads-sync-schedule.sh}"
  local sync_log="$LOG_DIR/google-ads-sync.log"
  local command

  if [[ ! -x "$sync_script" ]]; then
    log "skipping job=google-ads-sync reason=missing_script path=$sync_script"
    return 0
  fi

  command="$(printf '%q >> %q 2>&1' "$sync_script" "$sync_log")"
  run_job "google-ads-sync" "$timeout_seconds" "$command" "$sync_log"
}

render_runtime_report() {
  if [[ -x "$REPORT_SCRIPT" ]]; then
    OFFICE_SCHEDULER_STATE_DIR="$STATE_DIR" \
    OFFICE_SCHEDULER_LOG_DIR="$LOG_DIR" \
    "$REPORT_SCRIPT" || log "warning report_render_failed script=$REPORT_SCRIPT"
  fi
}

main() {
  local today_lisbon
  local hour_lisbon

  today_lisbon="$(TZ=Europe/Lisbon date +%F)"
  hour_lisbon="$(TZ=Europe/Lisbon date +%H)"

  if [[ "${FORCE_RUN:-0}" != "1" ]]; then
    if (( 10#$hour_lisbon < 3 )); then
      log "skipping nightly scheduler reason=before_cutoff today=$today_lisbon hour=$hour_lisbon"
      exit 0
    fi

    if [[ -f "$LAST_COMPLETED_FILE" ]] && [[ "$(cat "$LAST_COMPLETED_FILE")" == "$today_lisbon" ]]; then
      log "skipping nightly scheduler reason=already_completed today=$today_lisbon"
      exit 0
    fi
  fi

  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "skipping nightly scheduler reason=lock_present lock=$LOCK_DIR"
    exit 0
  fi

  trap 'rm -rf "$LOCK_DIR"' EXIT
  chmod 700 "$LOCK_DIR"
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
  chmod 600 "$LOCK_DIR/pid"

  log "nightly scheduler start today=$today_lisbon"

  local stop_chain=0

  if run_stb_pipeline_batch; then
    :
  else
    local rc="$?"
    if [[ "$rc" -eq 124 ]]; then
      log "stopping chain reason=stb_timeout"
      stop_chain=1
    else
      log "continuing chain after stb failure exit_code=$rc"
    fi
  fi

  if [[ "$stop_chain" -eq 0 ]]; then
    if run_n8n_backup; then
      :
    else
      local rc="$?"
      if [[ "$rc" -eq 124 ]]; then
        log "stopping chain reason=n8n_timeout"
        stop_chain=1
      else
        log "continuing chain after n8n backup failure exit_code=$rc"
      fi
    fi
  fi

  if [[ "$stop_chain" -eq 0 ]]; then
    if run_claude_session_cleanup; then
      :
    else
      local rc="$?"
      if [[ "$rc" -eq 124 ]]; then
        log "stopping chain reason=cleanup_timeout"
        stop_chain=1
      else
        log "continuing after cleanup failure exit_code=$rc"
      fi
    fi
  fi

  if [[ "$stop_chain" -eq 0 ]]; then
    if run_dance_of_life_sync; then
      :
    else
      local rc="$?"
      if [[ "$rc" -eq 124 ]]; then
        log "continuing after dance-of-life-sync timeout exit_code=$rc"
        # Not stopping chain — this job is lowest priority, timeout is expected during bulk download
      else
        log "continuing after dance-of-life-sync failure exit_code=$rc"
      fi
    fi
  fi

  # Bible Studies transcription pipeline — runs after dance-of-life-sync (new videos first),
  # never stops chain, lowest priority content job, 4-hour timeout
  if [[ "$stop_chain" -eq 0 ]]; then
    if run_bible_studies_pipeline; then
      :
    else
      local rc="$?"
      if [[ "$rc" -eq 124 ]]; then
        log "continuing after bible-studies-pipeline timeout exit_code=$rc"
      else
        log "continuing after bible-studies-pipeline failure exit_code=$rc"
      fi
    fi
  fi

  # Gemini tmp/history cleanup — never stops chain
  run_gemini_cleanup || log "warning gemini-cleanup failed but chain continues"

  # Google Ads daily sync — never stops chain, lightweight (< 2 minutes typically)
  run_google_ads_sync || log "warning google-ads-sync failed but chain continues"

  # ING Bank Statement download — runs on the 1st of each month, never stops chain
  run_ing_bank_statement_download || log "warning ing-bank-statement-download failed but chain continues"

  # Skill library pruning — runs on the 7th of each month only, never stops chain
  run_skill_prune || log "warning skill-prune failed but chain continues"

  if [[ "$stop_chain" -eq 0 ]]; then
    printf '%s\n' "$today_lisbon" > "$LAST_COMPLETED_FILE"
    chmod 600 "$LAST_COMPLETED_FILE"
    log "nightly scheduler completed today=$today_lisbon"
    render_runtime_report
    exit 0
  fi

  log "nightly scheduler incomplete today=$today_lisbon"
  render_runtime_report
  exit 1
}

main "$@"
