#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PID_FILE="$REPO_ROOT/runtime/local/probot.pid"
LOG_FILE="$REPO_ROOT/runtime/local/probot.log"

cd "$REPO_ROOT"
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

if [[ -f "$PID_FILE" ]]; then
  rm -f "$PID_FILE"
fi

echo "ProBot stopped"
