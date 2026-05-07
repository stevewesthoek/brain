#!/bin/bash
set -euo pipefail

cd /Users/Office/Repos/stevewesthoek/brain/projects/probot

# ProBot itself must run on a stable Node runtime because it loads native
# better-sqlite3 bindings. Do not inherit Homebrew Node 25 by accident.
# Managed apps still use their own per-app runtime config from local-apps.json.
if [[ -z "${PROBOT_NODE_BIN:-}" ]]; then
  if [[ -x "/Users/Office/.nvm/versions/node/v22.16.0/bin/node" ]]; then
    PROBOT_NODE_BIN="/Users/Office/.nvm/versions/node/v22.16.0/bin"
  else
    echo "[probot-start] ERROR: ProBot requires Node 22 because its runtime graph uses node:sqlite."
    echo "[probot-start] Install it with: nvm install 22.16.0"
    exit 1
  fi
fi

export PATH="${PROBOT_NODE_BIN}:${PATH}"

NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"

echo "[probot-start] node: ${NODE_BIN} ($(${NODE_BIN} -v))"
echo "[probot-start] npm:  ${NPM_BIN} ($(${NPM_BIN} -v))"

# Build TypeScript with the same Node/npm runtime that will start ProBot.
"${NPM_BIN}" run build

# Rebuild the native sqlite binding for the exact active Node ABI.
# Do not hide errors: a stale better-sqlite3 binding makes ProBot fail at boot.
echo "[probot-start] rebuilding better-sqlite3 for $(${NODE_BIN} -v)"
"${NPM_BIN}" rebuild better-sqlite3

# Fail early with a clear error if the native binding still cannot load.
"${NODE_BIN}" -e "import('better-sqlite3').then(({ default: Database }) => { const db = new Database(':memory:'); db.close(); console.log('[probot-start] better-sqlite3 OK') })"

# Start ProBot with the same Node runtime.
exec "${NPM_BIN}" start
