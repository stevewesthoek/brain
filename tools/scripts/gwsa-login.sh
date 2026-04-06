#!/usr/bin/env bash
# gwsa-login — Authenticate a Google account for use with gwsa
# Usage: gwsa-login <email>
# Example: gwsa-login info@arkware.solutions
#
# Opens a browser OAuth2 flow for the given account.
# Credentials are stored in ~/.config/gws-accounts/<email>/

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: gwsa-login <email>" >&2
  exit 1
fi

EMAIL="$1"
CONFIG_DIR="$HOME/.config/gws-accounts/$EMAIL"
SHARED_SECRET="$HOME/.config/gws/client_secret.json"

if [[ ! -f "$SHARED_SECRET" ]]; then
  echo "Error: Shared OAuth client secret not found at $SHARED_SECRET" >&2
  echo "Run 'gws auth setup' first to configure the OAuth2 client." >&2
  exit 1
fi

mkdir -p "$CONFIG_DIR"

# Symlink the shared client_secret.json if not already present
if [[ ! -L "$CONFIG_DIR/client_secret.json" ]] && [[ ! -f "$CONFIG_DIR/client_secret.json" ]]; then
  ln -sf "$SHARED_SECRET" "$CONFIG_DIR/client_secret.json"
fi

echo "Authenticating $EMAIL..."
echo "A browser window will open. Sign in as: $EMAIL"
echo ""

GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$CONFIG_DIR" gws auth login

echo ""
echo "✓ $EMAIL authenticated successfully."
echo "  Use: gwsa $EMAIL <service> <resource> <method> [flags]"
