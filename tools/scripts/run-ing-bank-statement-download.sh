#!/usr/bin/env bash
# ING Bank Statement Download — Monthly Scheduler
#
# Purpose: Downloads bank statements from ING Business Banking for all 3 accounts
#          (2 current + 1 savings), runs once per month on the 1st
#
# Triggered by: office-nightly-scheduler.sh (runs every night, checks date before executing)
# Logs to: ~/Library/Logs/office-scheduler/ing-bank-statement-download.log
# State: ~/.local/state/office-scheduler/ing-bank-statement-download.last

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAYWRIGHT_SCRIPT="$SCRIPT_DIR/bank-statement-login.js"
CREDENTIALS_FILE="$HOME/.config/ing/.env"

# ===== Functions =====

die() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

info() {
  printf '[INFO] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

# ===== Validation =====

if [[ ! -f "$PLAYWRIGHT_SCRIPT" ]]; then
  die "Playwright script not found: $PLAYWRIGHT_SCRIPT"
fi

if [[ ! -f "$CREDENTIALS_FILE" ]]; then
  die "Credentials file not found: $CREDENTIALS_FILE. Please create $CREDENTIALS_FILE with ING_USERNAME and ING_PASSWORD"
fi

# ===== Execute =====

info "Starting ING Bank Statement download..."
info "Accounts: 2 current (Yeshua Academy) + 1 savings"
info "File format: CSV, semicolon-separated, last month"
info "Download directory: $HOME/Downloads"

# Load credentials and run the Playwright script
if source "$CREDENTIALS_FILE"; then
  if TIMEOUT_SECONDS=600 node "$PLAYWRIGHT_SCRIPT"; then
    info "ING Bank Statement download completed successfully"
    exit 0
  else
    local exit_code="$?"
    die "Playwright script failed with exit code: $exit_code"
  fi
else
  die "Failed to load credentials from $CREDENTIALS_FILE"
fi
