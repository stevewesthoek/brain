#!/usr/bin/env bash
set -euo pipefail

# Retained compatibility/rollback wrapper. The installed LaunchAgent target is
# tools/scripts/brain-scheduler-runner.mjs in the detached brain-runtime. All inventory,
# safety, timing, locking, receipts, and execution decisions belong to the canonical runner.
# The registry retains the blocked Graphify semantic event gate explicitly;
# tools/graphify-semantic-event.mjs remains event-driven and blocked; structural
# Graphify generation remains frozen and is never scheduled here.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/brain-scheduler-runner.mjs" "$@"
