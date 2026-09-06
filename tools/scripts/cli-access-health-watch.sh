#!/usr/bin/env bash
set -u

BRAIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_BIN="${BRAIN_NODE_BIN:-/Users/Office/.nvm/versions/node/v20.20.2/bin/node}"

set +e
"$NODE_BIN" "$BRAIN_ROOT/tools/check-cli-access-health.mjs" --write --notify
status="$?"
set -e

# A failed provider/session probe is an expected health result. Keep launchd's
# own job state healthy while preserving the redacted report and notification.
if [[ "$status" -eq 1 ]]; then
  exit 0
fi
exit "$status"
