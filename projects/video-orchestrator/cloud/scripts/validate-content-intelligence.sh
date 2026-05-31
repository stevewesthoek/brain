#!/bin/bash
# Validate Content Intelligence Layer
# Verifies all content profiles and channel configs are properly configured
# Usage: scripts/validate-content-intelligence.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"

echo "==========================================="
echo "Validate Content Intelligence Layer"
echo "==========================================="
echo ""

ERRORS=0
WARNINGS=0

# Channels to validate
CHANNELS=("says-the-bible" "prochat")

for CHANNEL_ID in "${CHANNELS[@]}"; do
    echo -e "${CYAN}Validating: $CHANNEL_ID${NC}"
    echo ""

    # Check 1: Channel config exists
    echo "  [1/5] Channel config..."
    if aws s3api head-object \
        --bucket "$BUCKET" \
        --key "channels/$CHANNEL_ID/channel.json" \
        --region "$REGION" > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ exists${NC}"
    else
        echo -e "    ${RED}✗ NOT FOUND${NC}"
        ((ERRORS++))
        continue
    fi

    # Check 2: Content profile exists
    echo "  [2/5] Content profile..."
    if aws s3api head-object \
        --bucket "$BUCKET" \
        --key "channels/$CHANNEL_ID/content-profile.json" \
        --region "$REGION" > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ exists${NC}"
    else
        echo -e "    ${RED}✗ NOT FOUND${NC}"
        ((ERRORS++))
    fi

    # Check 3: Content profile is valid JSON
    echo "  [3/5] Content profile JSON..."
    PROFILE=$(aws s3 cp "s3://$BUCKET/channels/$CHANNEL_ID/content-profile.json" - --region "$REGION" 2>&1)

    if echo "$PROFILE" | jq . > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ valid JSON${NC}"

        # Check for required fields
        ALLOW_PUBLIC=$(echo "$PROFILE" | jq -r '.guardrails.allowPublicPublishing')
        if [ "$ALLOW_PUBLIC" = "false" ]; then
            echo -e "    ${GREEN}✓ allowPublicPublishing = false${NC}"
        else
            echo -e "    ${RED}✗ allowPublicPublishing should be false${NC}"
            ((ERRORS++))
        fi
    else
        echo -e "    ${RED}✗ invalid JSON${NC}"
        ((ERRORS++))
    fi

    # Check 4: Channel config is valid and has privacy rules
    echo "  [4/5] Channel config privacy rules..."
    CHANNEL_CONFIG=$(aws s3 cp "s3://$BUCKET/channels/$CHANNEL_ID/channel.json" - --region "$REGION" 2>&1)

    if echo "$CHANNEL_CONFIG" | jq . > /dev/null 2>&1; then
        ALLOW_PUBLIC_CHANNEL=$(echo "$CHANNEL_CONFIG" | jq -r '.publishing.allowPublic')
        if [ "$ALLOW_PUBLIC_CHANNEL" = "false" ]; then
            echo -e "    ${GREEN}✓ allowPublic = false${NC}"
        else
            echo -e "    ${RED}✗ allowPublic should be false${NC}"
            ((ERRORS++))
        fi
    else
        echo -e "    ${RED}✗ invalid channel config JSON${NC}"
        ((ERRORS++))
    fi

    # Check 5: YouTube credentials
    echo "  [5/5] YouTube credentials..."
    YT_ENABLED=$(echo "$CHANNEL_CONFIG" | jq -r '.platforms.youtube.enabled')
    SECRET_NAME=$(echo "$CHANNEL_CONFIG" | jq -r '.platforms.youtube.secretName')

    if [ "$YT_ENABLED" = "true" ]; then
        if aws secretsmanager get-secret-value \
            --secret-id "$SECRET_NAME" \
            --region "$REGION" > /dev/null 2>&1; then
            echo -e "    ${GREEN}✓ secret exists: $SECRET_NAME${NC}"
        else
            echo -e "    ${YELLOW}⚠ secret not found: $SECRET_NAME (needs YouTube OAuth setup)${NC}"
            ((WARNINGS++))
        fi
    else
        echo -e "    ${YELLOW}⚠ YouTube publishing disabled (secretName configured but not active)${NC}"
    fi

    echo ""
done

# Check 6: Brain Console view
echo -e "${CYAN}Checking Brain Console Integration${NC}"
echo ""

if [ -f "live/aws-video-pipeline.md" ]; then
    echo -e "  ${GREEN}✓ AWS Video Pipeline view exists${NC}"
else
    echo -e "  ${YELLOW}⚠ AWS Video Pipeline view not found (will be created)${NC}"
    ((WARNINGS++))
fi

echo ""

# Summary
echo "==========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Content Intelligence validation passed${NC}"
    echo "==========================================="
else
    echo -e "${RED}❌ Content Intelligence validation failed${NC}"
    echo "==========================================="
    echo -e "${RED}Errors: $ERRORS${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    exit 1
fi

exit 0
