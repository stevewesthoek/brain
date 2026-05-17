#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${MODEL_ROUTER_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ROUTER_DIR="${MODEL_ROUTER_DIR:-$REPO_ROOT/projects/model-router}"
OUTPUT_DIR="${MODEL_ROUTER_RUNTIME_DIR:-$REPO_ROOT/runtime/local/model-router}"
JSON_OUTPUT="$OUTPUT_DIR/latest.json"
MD_OUTPUT="$OUTPUT_DIR/latest.md"
STARTED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
STARTED_EPOCH="$(date +%s)"
STATUS="success"
MESSAGE="model-router dry-run validation passed"
EXIT_CODE=0
CLI_PATH="$ROUTER_DIR/src/cli/dry-run-report.ts"

mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"

if [[ ! -d "$ROUTER_DIR" ]]; then
  STATUS="failed"
  MESSAGE="model-router package directory not found"
  EXIT_CODE=1
else
  if [[ -f "$CLI_PATH" ]]; then
    CLI_ARGS=(npx --yes --prefix "$ROUTER_DIR" tsx "$CLI_PATH")
    if [[ -n "${MODEL_ROUTER_MIND_ROOT:-}" ]]; then
      CLI_ARGS+=(--mind-root "$MODEL_ROUTER_MIND_ROOT")
    fi
    CLI_ARGS+=(--output-json "$JSON_OUTPUT" --output-md "$MD_OUTPUT")
    if ! "${CLI_ARGS[@]}" >/tmp/model-router-dry-run-report.log 2>&1; then
      STATUS="failed"
      MESSAGE="model-router dry-run report failed; see /tmp/model-router-dry-run-report.log"
      EXIT_CODE=1
    fi
  elif ! npm --prefix "$ROUTER_DIR" run ci >/tmp/model-router-dry-run-report.log 2>&1; then
    STATUS="failed"
    MESSAGE="model-router ci failed; see /tmp/model-router-dry-run-report.log"
    EXIT_CODE=1
  fi
fi

ENDED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
ENDED_EPOCH="$(date +%s)"
DURATION_SECONDS="$((ENDED_EPOCH - STARTED_EPOCH))"

cat > "$JSON_OUTPUT" <<JSON
{
  "job": "model-router-dry-run",
  "status": "$STATUS",
  "message": "$MESSAGE",
  "startedAtLisbon": "$STARTED_AT",
  "endedAtLisbon": "$ENDED_AT",
  "durationSeconds": $DURATION_SECONDS,
  "mode": "dry-run-report-only",
  "writesToMind": false,
  "executableActions": false
}
JSON

cat > "$MD_OUTPUT" <<MD
# Model Router Dry-Run Report

- Job: model-router-dry-run
- Status: $STATUS
- Started: $STARTED_AT
- Ended: $ENDED_AT
- Duration: ${DURATION_SECONDS}s
- Mode: dry-run-report-only
- Writes to Mind: false
- Executable actions: false

## Message

$MESSAGE

## Safety

This scheduler report validates the model-router package only. It does not write, move, delete, archive, compact, split, or rewrite Mind files.
MD

chmod 600 "$JSON_OUTPUT" "$MD_OUTPUT"
exit "$EXIT_CODE"
