#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${VIDEO_RUNTIME_REPORT_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUTPUT_DIR="${VIDEO_RUNTIME_REPORT_DIR:-$REPO_ROOT/runtime/local/video}"
JSON_OUTPUT="$OUTPUT_DIR/latest.json"
MD_OUTPUT="$OUTPUT_DIR/latest.md"
STARTED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
STARTED_EPOCH="$(date +%s)"
ENDED_AT=""
STATUS="success"
MESSAGE="video runtime report generated with placeholder queue"

mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"

cat > "$JSON_OUTPUT" <<'JSON'
{
  "job": "video-runtime-report",
  "status": "success",
  "enabled": false,
  "message": "video runtime report generated with placeholder queue",
  "startedAtLisbon": "REPLACE_STARTED_AT",
  "endedAtLisbon": "REPLACE_ENDED_AT",
  "durationSeconds": 0,
  "mode": "report-only",
  "writesToMind": false,
  "executableActions": false,
  "queue": []
}
JSON

ENDED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
ENDED_EPOCH="$(date +%s)"
DURATION_SECONDS="$((ENDED_EPOCH - STARTED_EPOCH))"

python3 - "$JSON_OUTPUT" "$STARTED_AT" "$ENDED_AT" "$DURATION_SECONDS" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
started_at = sys.argv[2]
ended_at = sys.argv[3]
duration_seconds = int(sys.argv[4])
payload = json.loads(path.read_text())
payload["startedAtLisbon"] = started_at
payload["endedAtLisbon"] = ended_at
payload["durationSeconds"] = duration_seconds
path.write_text(json.dumps(payload, indent=2) + "\n")
PY

cat > "$MD_OUTPUT" <<MD
# Video Runtime Report

- Job: video-runtime-report
- Status: $STATUS
- Message: $MESSAGE
- Started: $STARTED_AT
- Ended: $ENDED_AT
- Duration: ${DURATION_SECONDS}s
- Mode: report-only
- Writes to Mind: false
- Executable actions: false

## Queue

Placeholder queue only.

## Safety

This report only writes safe JSON and Markdown summaries into Brain runtime storage. It does not trigger video workflows, mutate queue state, or mutate Mind.
MD

chmod 600 "$JSON_OUTPUT" "$MD_OUTPUT"
