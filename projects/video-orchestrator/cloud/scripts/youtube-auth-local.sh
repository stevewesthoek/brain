#!/bin/bash
# YouTube OAuth Local Authentication Setup
# Generates local token file for YouTube Data API v3
# Usage: scripts/youtube-auth-local.sh <channel>
# Example: scripts/youtube-auth-local.sh prochat
#          scripts/youtube-auth-local.sh says-the-bible
#
# Credentials location: ~/.config/youtube/<channel>.env (channel-specific credentials store)
# Token output: configured by YOUTUBE_TOKEN_FILE in that channel env file

set -e

CHANNEL_ID="${1:-${YOUTUBE_CHANNEL_ID:-}}"
if [ -z "$CHANNEL_ID" ]; then
    echo "ERROR: channel argument is required"
    echo "Usage: scripts/youtube-auth-local.sh <channel>"
    echo "Examples:"
    echo "  scripts/youtube-auth-local.sh prochat"
    echo "  scripts/youtube-auth-local.sh says-the-bible"
    exit 1
fi

CONFIG_FILE="${YOUTUBE_CONFIG_FILE:-${HOME}/.config/youtube/${CHANNEL_ID}.env}"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Channel-specific credentials config not found: $CONFIG_FILE"
    echo ""
    echo "Setup required:"
    echo "  mkdir -p ~/.config/youtube"
    echo "  # Download OAuth 2.0 Desktop Client JSON from Google Cloud Console"
    echo "  # Save one config per channel, for example:"
    echo "  #   ~/.config/youtube/prochat.env"
    echo "  #   ~/.config/youtube/says-the-bible.env"
    echo ""
    exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

# Validate client_secret.json exists
if [ ! -f "$YOUTUBE_CLIENT_SECRET_JSON" ]; then
    echo "ERROR: OAuth client JSON not found: $YOUTUBE_CLIENT_SECRET_JSON"
    exit 1
fi

# Extract credentials from JSON file
CLIENT_ID=$(jq -r '.installed.client_id' "$YOUTUBE_CLIENT_SECRET_JSON")
CLIENT_SECRET=$(jq -r '.installed.client_secret' "$YOUTUBE_CLIENT_SECRET_JSON")

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "ERROR: Could not extract credentials from $YOUTUBE_CLIENT_SECRET_JSON"
    exit 1
fi

TOKEN_FILE="${YOUTUBE_TOKEN_FILE:-${HOME}/.youtube_tokens-${CHANNEL_ID}.json}"
REDIRECT_URI="http://localhost"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "YouTube OAuth Local Authentication Setup"
echo "==========================================="
echo ""
echo "Channel config: $CHANNEL_ID"
echo "Config file: $CONFIG_FILE"
echo "Client secret JSON: $YOUTUBE_CLIENT_SECRET_JSON"
echo "Token file: ${YOUTUBE_TOKEN_FILE:-${HOME}/.youtube_tokens-${CHANNEL_ID}.json}"
if [ -n "${YOUTUBE_ACCOUNT_LABEL:-}" ]; then
    echo "Expected Google account: $YOUTUBE_ACCOUNT_LABEL"
fi
if [ -n "${YOUTUBE_CHANNEL_TITLE:-}" ]; then
    echo "Expected YouTube channel: $YOUTUBE_CHANNEL_TITLE"
fi
echo ""

# Define scopes
SCOPES="https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload"

# Step 1: Generate authorization URL
AUTH_URL=$(CLIENT_ID="$CLIENT_ID" REDIRECT_URI="$REDIRECT_URI" SCOPES="$SCOPES" python3 - <<'PY'
import os
from urllib.parse import urlencode

params = {
    "client_id": os.environ["CLIENT_ID"],
    "redirect_uri": os.environ["REDIRECT_URI"],
    "response_type": "code",
    "scope": os.environ["SCOPES"],
    "access_type": "offline",
    "prompt": "consent",
    "include_granted_scopes": "true",
}
print("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))
PY
)

echo -e "${CYAN}Step 1: Opening browser for authorization...${NC}"
echo ""
echo "Opening full OAuth URL:"
echo "$AUTH_URL"
echo ""

# Open in browser (macOS)
if command -v open &> /dev/null; then
    open "$AUTH_URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$AUTH_URL"
else
    echo "Please open this URL in your browser:"
    echo "$AUTH_URL"
fi

echo ""
echo -e "${CYAN}Step 2: Paste the authorization code${NC}"
echo ""
echo "After you authorize:"
echo "  1. You'll be redirected to: http://localhost?code=..."
echo "  2. Copy the entire 'code' parameter value"
echo "  3. Paste it below"
echo ""

read -p "Enter authorization code: " AUTH_CODE

if [ -z "$AUTH_CODE" ]; then
    echo -e "${RED}❌ ERROR: No auth code provided${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Step 3: Exchanging code for tokens...${NC}"

TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "code=${AUTH_CODE}" \
    -d "grant_type=authorization_code" \
    -d "redirect_uri=${REDIRECT_URI}")

# Check for errors
ERROR=$(echo "$TOKEN_RESPONSE" | jq -r '.error // empty')
if [ -n "$ERROR" ]; then
    ERROR_DESC=$(echo "$TOKEN_RESPONSE" | jq -r '.error_description // "Unknown error"')
    echo -e "${RED}❌ ERROR: OAuth token exchange failed${NC}"
    echo "Error: $ERROR"
    echo "Description: $ERROR_DESC"
    exit 1
fi

# Extract tokens
ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token // empty')
EXPIRES_IN=$(echo "$TOKEN_RESPONSE" | jq -r '.expires_in // 3600')

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
    echo -e "${RED}❌ ERROR: Missing access_token or refresh_token${NC}"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Tokens received${NC}"
echo ""

# Step 4: Save tokens to file
echo -e "${CYAN}Step 4: Saving tokens to ${TOKEN_FILE}${NC}"

CREATED_AT=$(date +%s)

TOKEN_DATA=$(cat <<EOF
{
  "access_token": "$ACCESS_TOKEN",
  "token_type": "Bearer",
  "expires_in": $EXPIRES_IN,
  "refresh_token": "$REFRESH_TOKEN",
  "scope": "$SCOPES",
  "created_at": $CREATED_AT
}
EOF
)

echo "$TOKEN_DATA" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

echo -e "${GREEN}✓ Tokens saved${NC}"
echo ""

# Step 5: Validate token
echo -e "${CYAN}Step 5: Validating token...${NC}"

CHANNEL_INFO=$(curl -s "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

CHANNEL_NAME=$(echo "$CHANNEL_INFO" | jq -r '.items[0].snippet.title // empty')
CHANNEL_ID=$(echo "$CHANNEL_INFO" | jq -r '.items[0].id // empty')

if [ -z "$CHANNEL_NAME" ] || [ -z "$CHANNEL_ID" ]; then
    echo -e "${RED}❌ ERROR: Could not retrieve channel info${NC}"
    exit 1
fi

if [ -n "${YOUTUBE_CHANNEL_TITLE:-}" ] && [ "$CHANNEL_NAME" != "$YOUTUBE_CHANNEL_TITLE" ]; then
    echo -e "${RED}❌ ERROR: Authorized YouTube channel does not match this config${NC}"
    echo "  Config channel: $YOUTUBE_CHANNEL_TITLE"
    echo "  Authorized channel: $CHANNEL_NAME"
    echo "  Token file: $TOKEN_FILE"
    echo "Delete the token and rerun auth with the correct Google/brand account:"
    echo "  rm -f \"$TOKEN_FILE\""
    exit 1
fi

echo -e "${GREEN}✓ Token valid!${NC}"
 echo "  Channel: $CHANNEL_NAME"
 echo "  Channel ID: $CHANNEL_ID"

echo ""
echo "==========================================="
echo -e "${GREEN}✅ YouTube OAuth Setup Complete${NC}"
echo "==========================================="
echo ""
echo "Token file: $TOKEN_FILE"
echo "Expires in: ${EXPIRES_IN}s (approx $(( EXPIRES_IN / 3600 )) hours)"
echo ""
echo "Next steps:"
echo "  1. scripts/youtube-auth-check.sh"
echo "     (validate token and test YouTube API)"
echo ""
echo "  2. scripts/youtube-upload-local.sh prochat-os-030 --dry-run"
echo "     (test upload workflow without posting to YouTube)"
echo ""
