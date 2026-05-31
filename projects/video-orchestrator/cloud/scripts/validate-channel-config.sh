#!/bin/bash
# Validate Channel Configuration
# Validates channel configuration and verifies YouTube access
# Usage: scripts/validate-channel-config.sh <channelId>

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "Validate Channel Configuration"
echo "==========================================="
echo ""

CHANNEL_ID="${1}"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"

if [ -z "$CHANNEL_ID" ]; then
    echo "Usage: $0 <channelId>"
    echo ""
    echo "Examples:"
    echo "  $0 says-the-bible"
    echo "  $0 prochat"
    exit 1
fi

echo "Validating channel: $CHANNEL_ID"
echo ""

# Step 1: Download config from S3
echo -e "${CYAN}Step 1: Downloading configuration from S3${NC}"

S3_KEY="channels/$CHANNEL_ID/channel.json"
S3_PATH="s3://$BUCKET/$S3_KEY"

CHANNEL_CONFIG=$(aws s3 cp "$S3_PATH" - --region "$REGION" 2>/dev/null)

if [ -z "$CHANNEL_CONFIG" ]; then
    echo -e "${RED}❌ ERROR: Configuration not found at: $S3_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Configuration downloaded${NC}"
echo ""

# Step 2: Validate JSON structure
echo -e "${CYAN}Step 2: Validating JSON structure${NC}"

if ! echo "$CHANNEL_CONFIG" | jq . > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Invalid JSON${NC}"
    exit 1
fi

echo -e "${GREEN}✓ JSON is valid${NC}"
echo ""

# Step 3: Verify required fields
echo -e "${CYAN}Step 3: Verifying required fields${NC}"

REQUIRED_FIELDS=("channelId" "displayName" "platforms" "publishing")
MISSING_FIELDS=()

for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "$CHANNEL_CONFIG" | jq -e ".$field" > /dev/null 2>&1; then
        MISSING_FIELDS+=("$field")
    fi
done

if [ ${#MISSING_FIELDS[@]} -gt 0 ]; then
    echo -e "${RED}❌ ERROR: Missing required fields: ${MISSING_FIELDS[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required fields present${NC}"
echo ""

# Step 4: Extract configuration values
echo -e "${CYAN}Step 4: Extracting configuration values${NC}"

CHANNEL_ID_VERIFY=$(echo "$CHANNEL_CONFIG" | jq -r '.channelId')
DISPLAY_NAME=$(echo "$CHANNEL_CONFIG" | jq -r '.displayName')
YT_ENABLED=$(echo "$CHANNEL_CONFIG" | jq -r '.platforms.youtube.enabled')
YT_SECRET=$(echo "$CHANNEL_CONFIG" | jq -r '.platforms.youtube.secretName')
DEFAULT_PRIVACY=$(echo "$CHANNEL_CONFIG" | jq -r '.platforms.youtube.defaultPrivacyStatus')
ALLOWED_PRIVACY=$(echo "$CHANNEL_CONFIG" | jq -r '.platforms.youtube.allowedPrivacyStatuses[]' | tr '\n' ' ')
ALLOW_PUBLIC=$(echo "$CHANNEL_CONFIG" | jq -r '.publishing.allowPublic')

if [ "$CHANNEL_ID_VERIFY" != "$CHANNEL_ID" ]; then
    echo -e "${RED}❌ ERROR: channelId mismatch: $CHANNEL_ID_VERIFY != $CHANNEL_ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Configuration extracted${NC}"
echo "  Channel: $DISPLAY_NAME"
echo "  YouTube Enabled: $YT_ENABLED"
echo "  Secret: $YT_SECRET"
echo "  Default Privacy: $DEFAULT_PRIVACY"
echo "  Allowed Privacy: $ALLOWED_PRIVACY"
echo ""

# Step 5: Validate privacy settings
echo -e "${CYAN}Step 5: Validating privacy settings${NC}"

if [ "$DEFAULT_PRIVACY" != "private" ] && [ "$DEFAULT_PRIVACY" != "unlisted" ]; then
    echo -e "${RED}❌ ERROR: Invalid defaultPrivacyStatus: $DEFAULT_PRIVACY${NC}"
    exit 1
fi

if echo "$ALLOWED_PRIVACY" | grep -q "public"; then
    echo -e "${RED}❌ ERROR: allowedPrivacyStatuses contains 'public' - not allowed${NC}"
    exit 1
fi

if [ "$ALLOW_PUBLIC" != "false" ]; then
    echo -e "${RED}❌ ERROR: publishing.allowPublic must be false${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Privacy validation passed${NC}"
echo "  ✓ defaultPrivacyStatus is valid (not public)"
echo "  ✓ allowPublic is false"
echo "  ✓ No public privacy status allowed"
echo ""

# Step 6: Verify YouTube secret exists in Secrets Manager
echo -e "${CYAN}Step 6: Verifying YouTube secret in Secrets Manager${NC}"

if ! aws secretsmanager get-secret-value \
    --secret-id "$YT_SECRET" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: YouTube secret not found: $YT_SECRET${NC}"
    exit 1
fi

echo -e "${GREEN}✓ YouTube secret exists${NC}"
echo "  Secret: $YT_SECRET"
echo ""

# Step 7: Test YouTube API access
echo -e "${CYAN}Step 7: Testing YouTube API access${NC}"

TOKEN_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "$YT_SECRET" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text)

ACCESS_TOKEN=$(echo "$TOKEN_JSON" | jq -r '.access_token')

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠ WARNING: Could not extract access_token from secret${NC}"
else
    # Try to call YouTube API
    API_RESPONSE=$(curl -s "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true" \
        -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null)

    CHANNEL_TITLE=$(echo "$API_RESPONSE" | jq -r '.items[0].snippet.title // empty' 2>/dev/null)
    CHANNEL_YT_ID=$(echo "$API_RESPONSE" | jq -r '.items[0].id // empty' 2>/dev/null)

    if [ -n "$CHANNEL_TITLE" ] && [ -n "$CHANNEL_YT_ID" ]; then
        echo -e "${GREEN}✓ YouTube API access verified${NC}"
        echo "  Authenticated Channel: $CHANNEL_TITLE"
        echo "  YouTube Channel ID: $CHANNEL_YT_ID"
    else
        echo -e "${YELLOW}⚠ WARNING: Could not verify YouTube API access${NC}"
    fi
fi

echo ""

# Final summary
echo "==========================================="
echo -e "${GREEN}✅ Channel configuration validated${NC}"
echo "==========================================="
echo ""
echo "Channel: $DISPLAY_NAME"
echo "Channel ID: $CHANNEL_ID"
echo "S3 Path: s3://$BUCKET/$S3_KEY"
echo ""
echo "Configuration is ready for publishing"
echo ""
