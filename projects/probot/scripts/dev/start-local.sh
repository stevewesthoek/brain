#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/runtime/local"
LOG_FILE="$RUNTIME_DIR/probot.log"
PID_FILE="$RUNTIME_DIR/probot.pid"

cd "$REPO_ROOT"
mkdir -p "$RUNTIME_DIR"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    echo "ProBot already running as ${PID}"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

echo "Starting ProBot from ${REPO_ROOT}"
npm run dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
