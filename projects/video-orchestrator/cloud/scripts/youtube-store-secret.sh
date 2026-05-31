#!/bin/bash
# YouTube OAuth Token → AWS Secrets Manager
# Securely stores YouTube OAuth token in AWS Secrets Manager
# Usage: scripts/youtube-store-secret.sh
#
# Credentials location: ~/.youtube_tokens.json (local token)
# Destination: AWS Secrets Manager secret: prochat/youtube/says-the-bible/oauth-token
# Region: eu-north-1

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "YouTube OAuth Token → Secrets Manager"
echo "==========================================="
echo ""

# Step 1: Check local token file
echo -e "${CYAN}Step 1: Reading local token file${NC}"

TOKEN_FILE="${HOME}/.youtube_tokens.json"
if [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${RED}❌ ERROR: Token file not found: $TOKEN_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Token file found${NC}"
echo ""

# Step 2: Validate token structure
echo -e "${CYAN}Step 2: Validating token structure${NC}"

ACCESS_TOKEN=$(jq -r '.access_token // empty' "$TOKEN_FILE" 2>/dev/null)
REFRESH_TOKEN=$(jq -r '.refresh_token // empty' "$TOKEN_FILE" 2>/dev/null)
CREATED_AT=$(jq -r '.created_at // empty' "$TOKEN_FILE" 2>/dev/null)
EXPIRES_IN=$(jq -r '.expires_in // empty' "$TOKEN_FILE" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ] || [ -z "$CREATED_AT" ] || [ -z "$EXPIRES_IN" ]; then
    echo -e "${RED}❌ ERROR: Token file is invalid or missing required fields${NC}"
    echo "Required fields: access_token, refresh_token, created_at, expires_in"
    exit 1
fi

# Calculate expiry timestamp
EXPIRY_AT=$((CREATED_AT + EXPIRES_IN))

echo -e "${GREEN}✓ Token structure valid${NC}"
echo "  access_token: present"
echo "  refresh_token: present"
echo "  created_at: $CREATED_AT"
echo "  expires_in: $EXPIRES_IN"
echo "  expires_at: $EXPIRY_AT"
echo ""

# Step 3: Check AWS credentials
echo -e "${CYAN}Step 3: Checking AWS credentials${NC}"

if ! aws sts get-caller-identity --region eu-north-1 > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: AWS credentials not configured or invalid${NC}"
    echo "Run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region eu-north-1)
echo -e "${GREEN}✓ AWS credentials valid${NC}"
echo "  Account ID: $ACCOUNT_ID"
echo "  Region: eu-north-1"
echo ""

# Step 4: Create/update Secrets Manager secret
echo -e "${CYAN}Step 4: Storing token in Secrets Manager${NC}"

SECRET_NAME="prochat/youtube/says-the-bible/oauth-token"

# Read full token JSON
TOKEN_JSON=$(cat "$TOKEN_FILE")

# Try to update existing secret first
SECRET_EXISTS=$(aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region eu-north-1 2>/dev/null || echo "")

if [ -n "$SECRET_EXISTS" ]; then
    echo "Updating existing secret: $SECRET_NAME"

    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$TOKEN_JSON" \
        --region eu-north-1 > /dev/null

    echo -e "${GREEN}✓ Secret updated${NC}"
else
    echo "Creating new secret: $SECRET_NAME"

    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --secret-string "$TOKEN_JSON" \
        --description "YouTube OAuth token for says-the-bible video uploader" \
        --region eu-north-1 > /dev/null

    echo -e "${GREEN}✓ Secret created${NC}"
fi

echo ""

# Step 5: Verify secret exists
echo -e "${CYAN}Step 5: Verifying secret${NC}"

if aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region eu-north-1 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Secret verified${NC}"
else
    echo -e "${RED}❌ ERROR: Secret verification failed${NC}"
    exit 1
fi

echo ""
echo "==========================================="
echo -e "${GREEN}✅ Token stored in Secrets Manager${NC}"
echo "==========================================="
echo ""
echo "Secret: $SECRET_NAME"
echo "Region: eu-north-1"
echo "Account: $ACCOUNT_ID"
echo ""
echo "Next step:"
echo "  scripts/youtube-secret-check.sh"
echo ""
