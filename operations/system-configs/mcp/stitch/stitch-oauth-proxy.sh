#!/usr/bin/env bash

# Launch the official Stitch MCP proxy with a short-lived OAuth access token.
#
# The Stitch SDK treats STITCH_API_KEY literally.  "gcloud-adc" is therefore
# not a valid API-key sentinel for the proxy: it causes an X-Goog-Api-Key
# request and the Stitch MCP endpoint rejects it.  Resolve ADC at process
# start instead, pass the resulting short-lived token to the SDK's supported
# OAuth path, and never persist or print the token.

set -euo pipefail

GCLOUD_BIN="${STITCH_GCLOUD_BIN:-gcloud}"

if ! command -v "$GCLOUD_BIN" >/dev/null 2>&1; then
  echo "[stitch-oauth-proxy] gcloud is not available in PATH" >&2
  exit 1
fi

access_token="$("$GCLOUD_BIN" auth application-default print-access-token 2>/dev/null || true)"
if [[ -z "$access_token" ]]; then
  echo "[stitch-oauth-proxy] Application Default Credentials are unavailable; run the official Stitch login flow" >&2
  exit 1
fi

project_id="${STITCH_PROJECT_ID:-}"
if [[ -z "$project_id" ]]; then
  project_id="$("$GCLOUD_BIN" config get-value project 2>/dev/null || true)"
fi

if [[ -z "$project_id" || "$project_id" == "(unset)" ]]; then
  echo "[stitch-oauth-proxy] no Google Cloud project is configured" >&2
  exit 1
fi

# The token is process-local and short-lived.  Do not set STITCH_API_KEY: its
# presence takes precedence over OAuth in the Stitch SDK.
export STITCH_ACCESS_TOKEN="$access_token"
export STITCH_PROJECT_ID="$project_id"
export DOTENV_CONFIG_QUIET="${DOTENV_CONFIG_QUIET:-true}"
unset STITCH_API_KEY

exec npx -y @_davideast/stitch-mcp proxy --transport stdio "$@"
