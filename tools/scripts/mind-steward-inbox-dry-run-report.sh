#!/usr/bin/env bash
set -euo pipefail

resolve_mind_root_fallback() {
  if [[ -d "${HOME}/Repos/stevewesthoek/mind" ]]; then
    printf '%s\n' "${HOME}/Repos/stevewesthoek/mind"
    return 0
  fi

  if [[ -d "/Users/Office/Repos/stevewesthoek/mind" ]]; then
    printf '%s\n' "/Users/Office/Repos/stevewesthoek/mind"
    return 0
  fi

  printf '%s\n' "${HOME}/Repos/stevewesthoek/mind"
}

file_size_bytes() {
  local file_path="$1"
  stat -f %z "$file_path" 2>/dev/null || stat -c %s "$file_path"
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  printf '%s' "$value"
}

INBOX_SOURCE=""

resolve_inbox_source() {
  local mind_root="$1"
  if [[ -d "${mind_root}/inbox/new" ]]; then
    printf 'target'
  else
    printf 'unavailable'
  fi
}

resolve_inbox_dir() {
  local mind_root="$1"
  if [[ -d "${mind_root}/inbox/new" ]]; then
    printf '%s\n' "${mind_root}/inbox/new"
    return 0
  fi
  # No fallback to capture/inbox; retired after Batch 8W cleanup (2026-07-09)
  printf '%s\n' "unavailable"
  return 1
}

REPO_ROOT="${MIND_STEWARD_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUTPUT_DIR="${MIND_STEWARD_RUNTIME_DIR:-$REPO_ROOT/runtime/local/mind-steward}"
JSON_OUTPUT="$OUTPUT_DIR/inbox-latest.json"
MD_OUTPUT="$OUTPUT_DIR/inbox-latest.md"
MIND_ROOT="${MIND_STEWARD_MIND_ROOT:-$(resolve_mind_root_fallback)}"
INBOX_DIR="$(resolve_inbox_dir "$MIND_ROOT")"
INBOX_SOURCE="$(resolve_inbox_source "$MIND_ROOT")"
STARTED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
STARTED_EPOCH="$(date +%s)"
STATUS="success"
MESSAGE="Mind Steward inbox inspection completed without writes"
EXIT_CODE=0
SAMPLE_LIMIT="${MIND_STEWARD_INBOX_SAMPLE_LIMIT:-5}"
LARGE_FILE_THRESHOLD_MB="${MIND_STEWARD_INBOX_LARGE_FILE_THRESHOLD_MB:-2}"
LARGE_FILE_THRESHOLD_BYTES="$((LARGE_FILE_THRESHOLD_MB * 1024 * 1024))"

mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"

sample_files=()
large_files=()
file_count=0
large_file_count=0

if [[ ! -d "$MIND_ROOT" ]]; then
  STATUS="failed"
  MESSAGE="Mind repo root not found at $MIND_ROOT"
  EXIT_CODE=1
elif [[ ! -d "$INBOX_DIR" ]]; then
  STATUS="failed"
  MESSAGE="Mind inbox directory not found (tried inbox/new and capture/inbox) at $MIND_ROOT"
  EXIT_CODE=1
else
  while IFS= read -r file_path; do
    [[ -n "$file_path" ]] || continue
    file_count=$((file_count + 1))
    base_name="$(basename "$file_path")"
    size_bytes="$(file_size_bytes "$file_path")"

    if (( ${#sample_files[@]} < SAMPLE_LIMIT )); then
      sample_files+=("$base_name")
    fi

    if (( size_bytes > LARGE_FILE_THRESHOLD_BYTES )); then
      large_file_count=$((large_file_count + 1))
      large_files+=("$base_name|$size_bytes")
    fi
  done < <(find "$INBOX_DIR" -maxdepth 1 -type f | LC_ALL=C sort)

  MESSAGE="Mind Steward inbox inspection completed: $file_count files, $large_file_count over ${LARGE_FILE_THRESHOLD_MB} MB."
fi

ENDED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
ENDED_EPOCH="$(date +%s)"
DURATION_SECONDS="$((ENDED_EPOCH - STARTED_EPOCH))"

sample_json='['
sample_first=1
if [[ ${#sample_files[@]} -gt 0 ]]; then
  for sample in "${sample_files[@]}"; do
    if [[ $sample_first -eq 0 ]]; then
      sample_json+=','
    fi
    sample_json+="\"$(json_escape "$sample")\""
    sample_first=0
  done
fi
sample_json+=']'

large_json='['
large_first=1
if [[ ${#large_files[@]} -gt 0 ]]; then
  for entry in "${large_files[@]}"; do
    file_name="${entry%%|*}"
    file_size="${entry##*|}"
    if [[ $large_first -eq 0 ]]; then
      large_json+=','
    fi
    large_json+="{\"name\":\"$(json_escape "$file_name")\",\"sizeBytes\":$file_size}"
    large_first=0
  done
fi
large_json+=']'

cat > "$JSON_OUTPUT" <<JSON
{
  "job": "mind-steward-inbox-dry-run",
  "status": "$STATUS",
  "message": "$(json_escape "$MESSAGE")",
  "startedAtLisbon": "$STARTED_AT",
  "endedAtLisbon": "$ENDED_AT",
  "durationSeconds": $DURATION_SECONDS,
  "mode": "inbox-dry-run-report-only",
  "writesToMind": false,
  "externalSideEffects": false,
  "executableActions": false,
  "mindRoot": "$(json_escape "$MIND_ROOT")",
  "inboxPath": "$(json_escape "$INBOX_DIR")",
  "inboxSource": "$INBOX_SOURCE",
  "fileCount": $file_count,
  "sampleFiles": $sample_json,
  "largeFileThresholdMb": $LARGE_FILE_THRESHOLD_MB,
  "largeFileThresholdBytes": $LARGE_FILE_THRESHOLD_BYTES,
  "largeFileCount": $large_file_count,
  "largeFiles": $large_json
}
JSON

{
  printf '# Mind Steward Inbox Dry-Run Report\n\n'
  printf -- '- Job: mind-steward-inbox-dry-run\n'
  printf -- '- Status: %s\n' "$STATUS"
  printf -- '- Started: %s\n' "$STARTED_AT"
  printf -- '- Ended: %s\n' "$ENDED_AT"
  printf -- '- Duration: %ss\n' "$DURATION_SECONDS"
  printf -- '- Mode: inbox-dry-run-report-only\n'
  printf -- '- Writes to Mind: false\n'
  printf -- '- External side effects: false\n'
  printf -- '- Executable actions: false\n'
  printf -- '- Mind root: `%s`\n' "$MIND_ROOT"
  printf -- '- Inbox path: `%s`\n' "$INBOX_DIR"
  printf -- '- Inbox source: %s\n' "$INBOX_SOURCE"
  printf -- '- Files discovered: %s\n' "$file_count"
  printf -- '- Large-file threshold: %s MB (%s bytes)\n' "$LARGE_FILE_THRESHOLD_MB" "$LARGE_FILE_THRESHOLD_BYTES"
  printf '\n## Message\n\n%s\n' "$MESSAGE"

  printf '\n## Sample Files\n\n'
  if [[ ${#sample_files[@]} -eq 0 ]]; then
    printf -- '- None found.\n'
  else
    for sample in "${sample_files[@]}"; do
      printf -- '- `%s`\n' "$sample"
    done
  fi

  printf '\n## Large Files\n\n'
  if [[ ${#large_files[@]} -eq 0 ]]; then
    printf -- '- None above threshold.\n'
  else
    for entry in "${large_files[@]}"; do
      file_name="${entry%%|*}"
      file_size="${entry##*|}"
      printf -- '- `%s` (%s bytes)\n' "$file_name" "$file_size"
    done
  fi

  printf '\n## Safety\n\n'
  printf 'This scheduler report only inspects the Mind inbox (preferring inbox/new, falling back to capture/inbox) and writes to Brain runtime/local/mind-steward/. It does not classify, move, delete, rename, rewrite, or queue Mind files.\n'
} > "$MD_OUTPUT"

chmod 600 "$JSON_OUTPUT" "$MD_OUTPUT"
exit "$EXIT_CODE"
