#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/runtime/local"
PID_FILE="$RUNTIME_DIR/probot.pid"
META_FILE="$RUNTIME_DIR/probot-process.json"

cd "$REPO_ROOT"

cleanup_stale() {
  local reason="$1"
  rm -f "$PID_FILE" "$META_FILE"
  echo "ProBot stopped (${reason})"
  exit 0
}

if [[ ! -f "$PID_FILE" ]]; then
  rm -f "$META_FILE"
  echo "ProBot stopped (no PID file)"
  exit 0
fi

PID="$(cat "$PID_FILE" || true)"
if [[ -z "$PID" ]]; then
  cleanup_stale "empty PID file removed"
fi

if ! kill -0 "$PID" >/dev/null 2>&1; then
  cleanup_stale "stale PID ${PID} removed, process not alive"
fi

if [[ ! -f "$META_FILE" ]]; then
  cleanup_stale "PID ${PID} has no metadata file, refusing to kill unverified process"
fi

META_APP_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('appId',''))" "$META_FILE" 2>/dev/null || true)"
if [[ "$META_APP_ID" != "probot" ]]; then
  cleanup_stale "metadata appId '${META_APP_ID}' is not 'probot', refusing to kill"
fi

META_PID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('pid',''))" "$META_FILE" 2>/dev/null || true)"
if [[ "$META_PID" != "$PID" ]]; then
  cleanup_stale "metadata PID ${META_PID} does not match PID file ${PID}"
fi

STORED_LSTART="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('processStartSignature',''))" "$META_FILE" 2>/dev/null || true)"
CURRENT_LSTART="$(ps -p "$PID" -o lstart= 2>/dev/null || true)"
if [[ -z "$CURRENT_LSTART" ]]; then
  cleanup_stale "stale PID ${PID}, process disappeared during validation"
fi
if [[ "$STORED_LSTART" != "$CURRENT_LSTART" ]]; then
  cleanup_stale "PID ${PID} start signature mismatch (PID reuse detected), refusing to kill"
fi

PROC_CMD="$(ps -p "$PID" -o args= 2>/dev/null || true)"
if [[ "$PROC_CMD" == *"ProBot"* ]] || [[ "$PROC_CMD" == *"probot"* ]] || [[ "$PROC_CMD" == *"tsx"*"src/index.ts"* ]] || [[ "$PROC_CMD" == *"node"*"dist/index.js"* ]]; then
  kill "$PID" >/dev/null 2>&1 || true
  sleep 2
  rm -f "$PID_FILE" "$META_FILE"
  echo "ProBot stopped (PID ${PID})"
else
  cleanup_stale "PID ${PID} did not match ProBot process markers"
fi
