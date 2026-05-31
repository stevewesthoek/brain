#!/bin/bash
# Invoke YouTube Auth Check Lambda
# Tests Lambda function and validates YouTube OAuth token
# Usage: scripts/youtube-auth-check-lambda.sh

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "Testing YouTube Auth Check Lambda"
echo "==========================================="
echo ""

LAMBDA_NAME="video-orchestrator-youtube-auth-check"
REGION="eu-north-1"

echo "Configuration:"
echo "  Function: $LAMBDA_NAME"
echo "  Region: $REGION"
echo ""

# Step 1: Check function exists
echo -e "${CYAN}Step 1: Checking Lambda function${NC}"

if ! aws lambda get-function \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Configuration.FunctionName' \
    --output text > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Lambda function not found: $LAMBDA_NAME${NC}"
    echo "Run: scripts/deploy-youtube-auth-check-lambda.sh"
    exit 1
fi

echo -e "${GREEN}✓ Lambda function found${NC}"
echo ""

# Step 2: Invoke Lambda
echo -e "${CYAN}Step 2: Invoking Lambda function${NC}"

RESPONSE=$(aws lambda invoke \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --log-type Tail \
    --query 'LogResult' \
    --output text /tmp/lambda-response.json)

# Base64 decode logs
if [ -n "$RESPONSE" ]; then
    LOGS=$(echo "$RESPONSE" | base64 -d 2>/dev/null || echo "")
    if [ -n "$LOGS" ]; then
        echo "Lambda logs:"
        echo "$LOGS" | head -20
        echo ""
    fi
fi

echo -e "${GREEN}✓ Lambda invoked${NC}"
echo ""

# Step 3: Parse response
echo -e "${CYAN}Step 3: Parsing response${NC}"

if [ ! -f /tmp/lambda-response.json ]; then
    echo -e "${RED}❌ ERROR: No response file${NC}"
    exit 1
fi

RESPONSE_JSON=$(cat /tmp/lambda-response.json)
OK=$(echo "$RESPONSE_JSON" | jq -r '.ok // false')
CHANNEL_ID=$(echo "$RESPONSE_JSON" | jq -r '.channelId // empty')
CHANNEL_TITLE=$(echo "$RESPONSE_JSON" | jq -r '.channelTitle // empty')
TOKEN_REFRESHED=$(echo "$RESPONSE_JSON" | jq -r '.tokenRefreshed // false')
EXPIRES_IN=$(echo "$RESPONSE_JSON" | jq -r '.expiresIn // empty')
ERROR=$(echo "$RESPONSE_JSON" | jq -r '.error // empty')

echo "Response:"
echo "  ok: $OK"
echo "  channelId: $CHANNEL_ID"
echo "  channelTitle: $CHANNEL_TITLE"
echo "  tokenRefreshed: $TOKEN_REFRESHED"
if [ -n "$EXPIRES_IN" ]; then
    HOURS=$((EXPIRES_IN / 3600))
    MINUTES=$(((EXPIRES_IN % 3600) / 60))
    echo "  expiresIn: ${HOURS}h ${MINUTES}m"
fi
if [ -n "$ERROR" ]; then
    echo "  error: $ERROR"
fi
echo ""

# Step 4: Validate response
echo -e "${CYAN}Step 4: Validating response${NC}"

if [ "$OK" != "true" ]; then
    echo -e "${RED}❌ Lambda validation failed${NC}"
    if [ -n "$ERROR" ]; then
        echo "Error: $ERROR"
    fi
    exit 1
fi

if [ -z "$CHANNEL_ID" ] || [ -z "$CHANNEL_TITLE" ]; then
    echo -e "${RED}❌ Invalid response: missing channel info${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Response valid${NC}"
echo ""

# Step 5: Summary
echo "==========================================="
echo -e "${GREEN}✅ Lambda validation successful${NC}"
echo "==========================================="
echo ""
echo "Function: $LAMBDA_NAME"
echo "Channel: $CHANNEL_TITLE"
echo "Channel ID: $CHANNEL_ID"
if [ "$TOKEN_REFRESHED" = "true" ]; then
    echo "Status: Token was refreshed"
else
    echo "Status: Token is fresh"
fi
echo ""
echo "Lambda is ready for Step Functions integration (I-6.2e)"
echo ""
