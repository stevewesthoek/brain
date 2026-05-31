#!/bin/bash
# YouTube OAuth Token Setup and Validation
# Generates token if missing, validates if present
# Usage: scripts/youtube-auth-check.sh

set -e

# Load central YouTube credentials config
CONFIG_FILE="${HOME}/.config/youtube/.env"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Central credentials config not found: $CONFIG_FILE"
    exit 1
fi

source "$CONFIG_FILE"

TOKEN_FILE="${YOUTUBE_TOKEN_FILE:-${HOME}/.youtube_tokens.json}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "YouTube OAuth Token Setup and Validation"
echo "==========================================="
echo ""

# Step 1: Check if token exists
echo -e "${CYAN}Step 1: Checking for existing token...${NC}"

if [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${YELLOW}⚠ Token file not found: $TOKEN_FILE${NC}"
    echo ""
    echo "This is normal on first setup."
    echo ""
    read -p "Would you like to generate a token now? (y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Running: scripts/youtube-auth-local.sh"
        echo ""
        scripts/youtube-auth-local.sh

        if [ ! -f "$TOKEN_FILE" ]; then
            echo -e "${RED}❌ Token generation failed${NC}"
            exit 1
        fi
    else
        echo ""
        echo "To generate a token manually, run:"
        echo "  scripts/youtube-auth-local.sh"
        exit 0
    fi
fi

echo -e "${GREEN}✓ Token file found: $TOKEN_FILE${NC}"
echo ""

# Step 2: Extract token data
echo -e "${CYAN}Step 2: Reading token data...${NC}"

ACCESS_TOKEN=$(jq -r '.access_token // empty' "$TOKEN_FILE" 2>/dev/null)
REFRESH_TOKEN=$(jq -r '.refresh_token // empty' "$TOKEN_FILE" 2>/dev/null)
CREATED_AT=$(jq -r '.created_at // empty' "$TOKEN_FILE" 2>/dev/null)
EXPIRES_IN=$(jq -r '.expires_in // empty' "$TOKEN_FILE" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
    echo -e "${RED}❌ Token file is invalid or corrupted${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Token data valid${NC}"
echo ""

# Step 3: Check token expiry
echo -e "${CYAN}Step 3: Checking token expiry...${NC}"

CURRENT_TIME=$(date +%s)
CREATED_TIME=$CREATED_AT
TOKEN_LIFETIME=$((EXPIRES_IN))
EXPIRY_TIME=$((CREATED_TIME + TOKEN_LIFETIME))
SECONDS_REMAINING=$((EXPIRY_TIME - CURRENT_TIME))

if [ $SECONDS_REMAINING -lt 0 ]; then
    echo -e "${YELLOW}⚠ Token is EXPIRED${NC}"
    echo ""
    echo "Re-generate token:"
    echo "  scripts/youtube-auth-local.sh"
    exit 1
elif [ $SECONDS_REMAINING -lt 300 ]; then
    echo -e "${YELLOW}⚠ Token expiring soon (< 5 minutes)${NC}"
else
    echo -e "${GREEN}✓ Token valid${NC}"
    HOURS=$((SECONDS_REMAINING / 3600))
    MINUTES=$(((SECONDS_REMAINING % 3600) / 60))
    echo "  Expires in: ${HOURS}h ${MINUTES}m"
fi
echo ""

# Step 4: Test YouTube API access
echo -e "${CYAN}Step 4: Testing YouTube API access...${NC}"

API_RESPONSE=$(curl -s "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null)

# Check for API errors
API_ERROR=$(echo "$API_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)

if [ -n "$API_ERROR" ]; then
    echo -e "${RED}❌ YouTube API error: $API_ERROR${NC}"
    exit 1
fi

# Extract channel info
CHANNEL_NAME=$(echo "$API_RESPONSE" | jq -r '.items[0].snippet.title // empty' 2>/dev/null)
CHANNEL_ID=$(echo "$API_RESPONSE" | jq -r '.items[0].id // empty' 2>/dev/null)

if [ -z "$CHANNEL_NAME" ] || [ -z "$CHANNEL_ID" ]; then
    echo -e "${RED}❌ Could not retrieve channel information${NC}"
    exit 1
fi

echo -e "${GREEN}✓ YouTube API responding${NC}"
echo "  Channel: $CHANNEL_NAME"
echo "  Channel ID: $CHANNEL_ID"
echo ""

# Final status
echo "==========================================="
echo -e "${GREEN}✅ YouTube OAuth Setup Complete${NC}"
echo "==========================================="
echo ""
echo "Token file: $TOKEN_FILE"
echo "Authenticated: $CHANNEL_NAME"
echo ""
echo "Ready for upload test:"
echo "  scripts/youtube-upload-local.sh prochat-os-030 --dry-run"
echo ""
