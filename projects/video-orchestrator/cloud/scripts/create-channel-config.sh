#!/bin/bash
# Create Channel Configuration
# Creates and uploads channel configuration to S3
# Usage: scripts/create-channel-config.sh <channelId>
#
# Example: scripts/create-channel-config.sh says-the-bible

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "Create Channel Configuration"
echo "==========================================="
echo ""

# Parameters
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

echo "Creating configuration for channel: $CHANNEL_ID"
echo ""

# Step 1: Build channel config JSON based on channelId
echo -e "${CYAN}Step 1: Building channel configuration${NC}"

case "$CHANNEL_ID" in
    says-the-bible)
        DISPLAY_NAME="Says the Bible"
        YOUTUBE_SECRET="prochat/youtube/says-the-bible/oauth-token"
        DEFAULT_PRIVACY="private"
        CATEGORY_ID="22"
        DEFAULT_TAGS='["Bible", "Christian", "Jesus", "Scripture"]'
        TITLE_PREFIX=""
        TITLE_SUFFIX=""
        DESCRIPTION_TEMPLATE=""
        MADE_FOR_KIDS="false"
        ;;
    prochat)
        DISPLAY_NAME="ProChat"
        YOUTUBE_SECRET="prochat/youtube/prochat/oauth-token"
        DEFAULT_PRIVACY="private"
        CATEGORY_ID="22"
        DEFAULT_TAGS='["ProChat", "Conversation", "AI"]'
        TITLE_PREFIX=""
        TITLE_SUFFIX=""
        DESCRIPTION_TEMPLATE=""
        MADE_FOR_KIDS="false"
        ;;
    *)
        echo -e "${YELLOW}Channel '$CHANNEL_ID' not in defaults${NC}"
        echo "You can add it to this script or provide config manually"
        echo ""
        read -p "Display name: " DISPLAY_NAME
        read -p "YouTube secret name (e.g., prochat/youtube/...): " YOUTUBE_SECRET
        read -p "Default privacy status (private/unlisted): " DEFAULT_PRIVACY
        read -p "Category ID (default 22): " CATEGORY_ID
        CATEGORY_ID="${CATEGORY_ID:-22}"
        DEFAULT_TAGS='[]'
        TITLE_PREFIX=""
        TITLE_SUFFIX=""
        DESCRIPTION_TEMPLATE=""
        MADE_FOR_KIDS="false"
        ;;
esac

# Validate privacy status
if [ "$DEFAULT_PRIVACY" != "private" ] && [ "$DEFAULT_PRIVACY" != "unlisted" ]; then
    echo -e "${RED}❌ ERROR: Invalid privacy status: $DEFAULT_PRIVACY${NC}"
    echo "Must be: private or unlisted"
    exit 1
fi

echo -e "${GREEN}✓ Configuration built${NC}"
echo "  Channel: $DISPLAY_NAME"
echo "  YouTube Secret: $YOUTUBE_SECRET"
echo "  Default Privacy: $DEFAULT_PRIVACY"
echo ""

# Step 2: Create JSON configuration
echo -e "${CYAN}Step 2: Creating JSON configuration${NC}"

CREATED_AT=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
UPDATED_AT="$CREATED_AT"

CHANNEL_CONFIG=$(cat <<EOF
{
  "channelId": "$CHANNEL_ID",
  "displayName": "$DISPLAY_NAME",
  "platforms": {
    "youtube": {
      "enabled": true,
      "secretName": "$YOUTUBE_SECRET",
      "defaultPrivacyStatus": "$DEFAULT_PRIVACY",
      "allowedPrivacyStatuses": ["private", "unlisted"],
      "categoryId": "$CATEGORY_ID",
      "defaultTags": $DEFAULT_TAGS,
      "titlePrefix": "$TITLE_PREFIX",
      "titleSuffix": "$TITLE_SUFFIX",
      "descriptionTemplate": "$DESCRIPTION_TEMPLATE",
      "madeForKids": $MADE_FOR_KIDS
    }
  },
  "publishing": {
    "requireManualApproval": true,
    "allowPublic": false,
    "defaultPlatform": "youtube"
  },
  "createdAt": "$CREATED_AT",
  "updatedAt": "$UPDATED_AT"
}
EOF
)

echo -e "${GREEN}✓ JSON configuration created${NC}"
echo ""

# Step 3: Validate JSON structure
echo -e "${CYAN}Step 3: Validating JSON structure${NC}"

if ! echo "$CHANNEL_CONFIG" | jq . > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Invalid JSON${NC}"
    exit 1
fi

# Validate required fields
REQUIRED_FIELDS=("channelId" "displayName" "platforms" "publishing")
for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "$CHANNEL_CONFIG" | jq -e ".$field" > /dev/null 2>&1; then
        echo -e "${RED}❌ ERROR: Missing required field: $field${NC}"
        exit 1
    fi
done

# Validate YouTube config
if ! echo "$CHANNEL_CONFIG" | jq -e '.platforms.youtube.enabled' > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Missing platforms.youtube.enabled${NC}"
    exit 1
fi

# Validate publishing rules
ALLOW_PUBLIC=$(echo "$CHANNEL_CONFIG" | jq -r '.publishing.allowPublic')
if [ "$ALLOW_PUBLIC" != "false" ]; then
    echo -e "${YELLOW}⚠ WARNING: allowPublic should be false${NC}"
fi

echo -e "${GREEN}✓ JSON validation passed${NC}"
echo ""

# Step 4: Verify YouTube secret exists (if AWS access available)
echo -e "${CYAN}Step 4: Verifying YouTube secret in Secrets Manager${NC}"

if aws secretsmanager get-secret-value \
    --secret-id "$YOUTUBE_SECRET" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text > /dev/null 2>&1; then
    echo -e "${GREEN}✓ YouTube secret exists: $YOUTUBE_SECRET${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: Could not verify YouTube secret${NC}"
    echo "Secret may not exist or you lack permissions"
fi

echo ""

# Step 5: Upload to S3
echo -e "${CYAN}Step 5: Uploading to S3${NC}"

S3_KEY="channels/$CHANNEL_ID/channel.json"
S3_PATH="s3://$BUCKET/$S3_KEY"

echo "$CHANNEL_CONFIG" | aws s3 cp - "$S3_PATH" \
    --region "$REGION" \
    --content-type "application/json"

echo -e "${GREEN}✓ Configuration uploaded${NC}"
echo "  Path: $S3_PATH"
echo ""

# Step 6: Verify upload
echo -e "${CYAN}Step 6: Verifying upload${NC}"

VERIFY=$(aws s3 cp "$S3_PATH" - --region "$REGION" | jq -r '.channelId')

if [ "$VERIFY" != "$CHANNEL_ID" ]; then
    echo -e "${RED}❌ ERROR: Upload verification failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Upload verified${NC}"
echo ""

echo "==========================================="
echo -e "${GREEN}✅ Channel configuration created${NC}"
echo "==========================================="
echo ""
echo "Channel: $DISPLAY_NAME"
echo "Channel ID: $CHANNEL_ID"
echo "S3 Path: $S3_PATH"
echo ""
echo "Next step:"
echo "  scripts/validate-channel-config.sh $CHANNEL_ID"
echo ""
