#!/bin/bash
# YouTube OAuth Token Verification from Secrets Manager
# Verifies token can be read and is valid
# Usage: scripts/youtube-secret-check.sh
#
# Reads from: AWS Secrets Manager secret: prochat/youtube/says-the-bible/oauth-token
# Region: eu-north-1
# Never prints token values

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "YouTube Secret Manager Verification"
echo "==========================================="
echo ""

SECRET_NAME="prochat/youtube/says-the-bible/oauth-token"

# Step 1: Check AWS credentials
echo -e "${CYAN}Step 1: Checking AWS credentials${NC}"

if ! aws sts get-caller-identity --region eu-north-1 > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: AWS credentials not configured or invalid${NC}"
    echo "Run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region eu-north-1)
echo -e "${GREEN}✓ AWS credentials valid${NC}"
echo "  Account ID: $ACCOUNT_ID"
echo ""

# Step 2: Read secret from Secrets Manager
echo -e "${CYAN}Step 2: Reading secret from Secrets Manager${NC}"

TOKEN_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region eu-north-1 \
    --query SecretString \
    --output text 2>/dev/null)

if [ -z "$TOKEN_JSON" ]; then
    echo -e "${RED}❌ ERROR: Could not read secret: $SECRET_NAME${NC}"
    echo "Secret may not exist or permission denied"
    exit 1
fi

echo -e "${GREEN}✓ Secret retrieved${NC}"
echo ""

# Step 3: Validate token structure
echo -e "${CYAN}Step 3: Validating token structure${NC}"

ACCESS_TOKEN=$(echo "$TOKEN_JSON" | jq -r '.access_token // empty' 2>/dev/null)
REFRESH_TOKEN=$(echo "$TOKEN_JSON" | jq -r '.refresh_token // empty' 2>/dev/null)
CREATED_AT=$(echo "$TOKEN_JSON" | jq -r '.created_at // empty' 2>/dev/null)
EXPIRES_IN=$(echo "$TOKEN_JSON" | jq -r '.expires_in // empty' 2>/dev/null)
TOKEN_TYPE=$(echo "$TOKEN_JSON" | jq -r '.token_type // empty' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ] || [ -z "$CREATED_AT" ] || [ -z "$EXPIRES_IN" ]; then
    echo -e "${RED}❌ ERROR: Token structure invalid${NC}"
    echo "Required fields: access_token, refresh_token, created_at, expires_in"
    exit 1
fi

echo -e "${GREEN}✓ Token structure valid${NC}"
echo "  access_token: present (${#ACCESS_TOKEN} chars)"
echo "  refresh_token: present (${#REFRESH_TOKEN} chars)"
echo "  token_type: $TOKEN_TYPE"
echo ""

# Step 4: Check token expiry
echo -e "${CYAN}Step 4: Checking token expiry${NC}"

CURRENT_TIME=$(date +%s)
EXPIRY_AT=$((CREATED_AT + EXPIRES_IN))
SECONDS_REMAINING=$((EXPIRY_AT - CURRENT_TIME))

if [ $SECONDS_REMAINING -lt 0 ]; then
    echo -e "${YELLOW}⚠ Token is EXPIRED${NC}"
    echo "  Created: $(date -u -d @$CREATED_AT +'%Y-%m-%dT%H:%M:%SZ')"
    echo "  Expires: $(date -u -d @$EXPIRY_AT +'%Y-%m-%dT%H:%M:%SZ')"
    echo "  Refresh token can be used to get new access token"
elif [ $SECONDS_REMAINING -lt 300 ]; then
    echo -e "${YELLOW}⚠ Token expiring soon (< 5 minutes)${NC}"
    HOURS=$((SECONDS_REMAINING / 3600))
    MINUTES=$(((SECONDS_REMAINING % 3600) / 60))
    echo "  Expires in: ${HOURS}h ${MINUTES}m"
else
    echo -e "${GREEN}✓ Token valid${NC}"
    HOURS=$((SECONDS_REMAINING / 3600))
    MINUTES=$(((SECONDS_REMAINING % 3600) / 60))
    echo "  Expires in: ${HOURS}h ${MINUTES}m"
fi
echo ""

# Step 5: Test YouTube API access
echo -e "${CYAN}Step 5: Testing YouTube API access${NC}"

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
echo -e "${GREEN}✅ Token verification successful${NC}"
echo "==========================================="
echo ""
echo "Secret: $SECRET_NAME"
echo "Account: $ACCOUNT_ID"
echo "Authenticated channel: $CHANNEL_NAME"
echo ""
echo "Token ready for Step Functions integration (I-6.2c)"
echo ""
