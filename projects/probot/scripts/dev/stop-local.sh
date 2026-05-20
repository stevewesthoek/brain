#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PID_FILE="$REPO_ROOT/runtime/local/probot.pid"

cd "$REPO_ROOT"
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -z "$PID" ]]; then
    rm -f "$PID_FILE"
    echo "ProBot stopped (empty PID file removed)"
    exit 0
  fi

  if ! kill -0 "$PID" >/dev/null 2>&1; then
    rm -f "$PID_FILE"
    echo "ProBot stopped (stale PID ${PID} removed)"
    exit 0
  fi

  PROC_CMD="$(ps -p "$PID" -o args= 2>/dev/null || true)"
  if [[ "$PROC_CMD" == *"ProBot"* ]] || [[ "$PROC_CMD" == *"probot"* ]] || [[ "$PROC_CMD" == *"tsx"*"src/index.ts"* ]] || [[ "$PROC_CMD" == *"node"*"dist/index.js"* ]]; then
    kill "$PID" >/dev/null 2>&1 || true
    sleep 2
    rm -f "$PID_FILE"
    echo "ProBot stopped (PID ${PID})"
  else
    rm -f "$PID_FILE"
    echo "ProBot stopped (PID ${PID} did not match ProBot process, PID file removed)"
  fi
else
  echo "ProBot stopped (no PID file)"
fi
