#!/usr/bin/env bash
# Nightly Google Ads sync scheduler
# Called by office-nightly-scheduler.sh

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$HOME/Repos/stevewesthoek/brain}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_WRAPPER="${REPO_ROOT}/tools/google-ads/run.sh"

if [[ ! -x "$CLI_WRAPPER" ]]; then
  echo "ERROR: CLI wrapper not found at $CLI_WRAPPER" >&2
  exit 1
fi

# Run the sync command
cd "$REPO_ROOT"
bash "$CLI_WRAPPER" sync

exit $?
