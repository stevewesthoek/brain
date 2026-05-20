#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_FILE="${PROBOT_LOG_FILE:-/tmp/probot.log}"

cd "$REPO_ROOT"
echo "Starting ProBot from ${REPO_ROOT}"
npm run dev > "$LOG_FILE" 2>&1 &
echo $! > /tmp/probot.pid
