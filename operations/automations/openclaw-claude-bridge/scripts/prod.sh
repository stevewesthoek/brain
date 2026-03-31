#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f .env ]; then
  echo "⚠️  No .env found."
  echo "    cp .env.example .env  — then fill in BRIDGE_SECRET and OPENCLAW_BEARER_TOKEN"
  exit 1
fi

echo "▶ Building TypeScript..."
npx tsc

echo "▶ Starting bridge in production mode..."
node dist/index.js
