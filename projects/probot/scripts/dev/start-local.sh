#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/runtime/local"
LOG_FILE="$RUNTIME_DIR/probot.log"
PID_FILE="$RUNTIME_DIR/probot.pid"
META_FILE="$RUNTIME_DIR/probot-process.json"
CANONICAL_PORT=7070
SCRIPT_VERSION=2

cd "$REPO_ROOT"
mkdir -p "$RUNTIME_DIR"

validate_existing_process() {
  local pid="$1"
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return 1
  fi
  if [[ ! -f "$META_FILE" ]]; then
    return 1
  fi
  local meta_pid
  meta_pid="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['pid'])" "$META_FILE" 2>/dev/null || true)"
  if [[ "$meta_pid" != "$pid" ]]; then
    return 1
  fi
  local stored_lstart
  stored_lstart="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['processStartSignature'])" "$META_FILE" 2>/dev/null || true)"
  local current_lstart
  current_lstart="$(ps -p "$pid" -o lstart= 2>/dev/null || true)"
  if [[ -z "$current_lstart" ]] || [[ "$stored_lstart" != "$current_lstart" ]]; then
    return 1
  fi
  return 0
}

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && validate_existing_process "$PID"; then
    echo "ProBot already running as ${PID} on port ${CANONICAL_PORT}"
    exit 0
  fi
  rm -f "$PID_FILE" "$META_FILE"
fi

echo "Starting ProBot from ${REPO_ROOT} on port ${CANONICAL_PORT}"
PROBOT_DASHBOARD_PORT="$CANONICAL_PORT" npm run dev > "$LOG_FILE" 2>&1 &
CHILD_PID=$!
echo "$CHILD_PID" > "$PID_FILE"

PROCESS_LSTART="$(ps -p "$CHILD_PID" -o lstart= 2>/dev/null || true)"
python3 -c "
import json, sys
meta = {
    'appId': 'probot',
    'pid': int(sys.argv[1]),
    'startedAt': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
    'processStartSignature': sys.argv[2],
    'canonicalPort': int(sys.argv[3]),
    'commandLabel': 'npm run dev',
    'scriptVersion': int(sys.argv[4])
}
with open(sys.argv[5], 'w') as f:
    json.dump(meta, f, indent=2)
" "$CHILD_PID" "$PROCESS_LSTART" "$CANONICAL_PORT" "$SCRIPT_VERSION" "$META_FILE"

echo "ProBot started as PID ${CHILD_PID} on port ${CANONICAL_PORT}"
