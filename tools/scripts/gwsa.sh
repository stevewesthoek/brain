#!/usr/bin/env bash
# gwsa — Multi-account gws wrapper
# Usage: gwsa <email> <gws args...>
# Example: gwsa info@arkware.solutions gmail users messages list --params '{"userId":"me"}'
#
# Accounts live in ~/.config/gws-accounts/<email>/
# Each dir needs client_secret.json + credentials.enc (from `gwsa-login <email>`)

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: gwsa <email> <gws args...>" >&2
  echo "" >&2
  echo "Authenticated accounts:" >&2
  for dir in "$HOME/.config/gws-accounts"/*/; do
    email=$(basename "$dir")
    if [[ -f "$dir/credentials.enc" ]]; then
      echo "  ✓ $email" >&2
    else
      echo "  ✗ $email (not authenticated — run: gwsa-login $email)" >&2
    fi
  done
  exit 1
fi

EMAIL="$1"; shift
CONFIG_DIR="$HOME/.config/gws-accounts/$EMAIL"

if [[ ! -d "$CONFIG_DIR" ]]; then
  echo "Error: No account directory for '$EMAIL'." >&2
  echo "Run: gwsa-login $EMAIL" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_DIR/credentials.enc" ]]; then
  echo "Error: '$EMAIL' is not authenticated yet." >&2
  echo "Run: gwsa-login $EMAIL" >&2
  exit 1
fi

GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$CONFIG_DIR" gws "$@"
