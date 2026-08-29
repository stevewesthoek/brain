#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${LOCAL_APPS_REPORT_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUTPUT_DIR="${LOCAL_APPS_REPORT_DIR:-$REPO_ROOT/runtime/local/local-apps}"
JSON_OUTPUT="$OUTPUT_DIR/latest.json"
MD_OUTPUT="$OUTPUT_DIR/latest.md"
STARTED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
STARTED_EPOCH="$(date +%s)"

mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"
cat > "$JSON_OUTPUT" <<JSON
{
  "job": "local-apps-report",
  "status": "success",
  "message": "local-apps report generated",
  "startedAtLisbon": "$STARTED_AT",
  "endedAtLisbon": "$STARTED_AT",
  "durationSeconds": 0,
  "mode": "report-only",
  "writesToMind": false,
  "executableActions": false,
  "apps": [
    {"id":"probot","name":"ProBot","status":"unknown","actionsSupported":false},
    {"id":"office-scheduler","name":"Brain Scheduler","status":"unknown","actionsSupported":false},
    {"id":"brain-core","name":"Brain Core","status":"unknown","actionsSupported":false},
    {"id":"fala","name":"Fala","status":"unknown","actionsSupported":true,"url":"http://localhost:3050","healthCheck":"http://localhost:3050/api/health"}
  ]
}
JSON
ENDED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
DURATION_SECONDS="$(( $(date +%s) - STARTED_EPOCH ))"
python3 - "$JSON_OUTPUT" "$ENDED_AT" "$DURATION_SECONDS" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
payload = json.loads(path.read_text())
payload["endedAtLisbon"] = sys.argv[2]
payload["durationSeconds"] = int(sys.argv[3])
path.write_text(json.dumps(payload, indent=2) + "\n")
PY
cat > "$MD_OUTPUT" <<MD
# Local Apps Report

- Job: local-apps-report
- Status: success
- Started: $STARTED_AT
- Ended: $ENDED_AT
- Duration: ${DURATION_SECONDS}s
- Mode: report-only
- Writes to Mind: false
- Executable actions: false

## Apps

- ProBot
- Brain Scheduler
- Brain Core
- Fala

## Safety

This report only writes safe JSON and Markdown summaries into Brain runtime storage. It does not inspect live processes, read logs, or mutate Mind.
MD
chmod 600 "$JSON_OUTPUT" "$MD_OUTPUT"
