#!/bin/bash
# Deploy YouTube Auth Check Lambda
# Packages and deploys lambda-youtube-auth-check.py to AWS Lambda
# Usage: scripts/deploy-youtube-auth-check-lambda.sh

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "==========================================="
echo "Deploying YouTube Auth Check Lambda"
echo "==========================================="
echo ""

# Configuration
LAMBDA_NAME="video-orchestrator-youtube-auth-check"
LAMBDA_HANDLER="youtube-auth-check.handler"
RUNTIME="python3.11"
TIMEOUT=30
MEMORY=256
REGION="eu-north-1"
SECRET_NAME="prochat/youtube/says-the-bible/oauth-token"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")

LAMBDA_DIR="lambda"
LAMBDA_FILE="$LAMBDA_DIR/youtube-auth-check.py"
ZIP_FILE="/tmp/youtube-auth-check.zip"
IAM_ROLE_NAME="lambda-youtube-auth-check-role"
POLICY_NAME="lambda-youtube-auth-check-policy"

echo "Configuration:"
echo "  Function: $LAMBDA_NAME"
echo "  Region: $REGION"
echo "  Timeout: ${TIMEOUT}s"
echo "  Memory: ${MEMORY}MB"
echo "  Runtime: $RUNTIME"
echo "  Secret: $SECRET_NAME"
echo ""

# Step 1: Check Lambda file exists
echo -e "${CYAN}Step 1: Checking Lambda source file${NC}"

if [ ! -f "$LAMBDA_FILE" ]; then
    echo -e "${RED}❌ ERROR: Lambda file not found: $LAMBDA_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Lambda source found${NC}"
echo ""

# Step 2: Create or verify IAM role
echo -e "${CYAN}Step 2: Setting up IAM role${NC}"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${IAM_ROLE_NAME}"

# Check if role exists
if aws iam get-role --role-name "$IAM_ROLE_NAME" --region "$REGION" > /dev/null 2>&1; then
    echo "IAM role exists: $IAM_ROLE_NAME"
else
    echo "Creating IAM role: $IAM_ROLE_NAME"

    # Create role with Lambda trust policy
    TRUST_POLICY=$(cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

    aws iam create-role \
        --role-name "$IAM_ROLE_NAME" \
        --assume-role-policy-document "$TRUST_POLICY" \
        --region "$REGION" > /dev/null

    echo "Role created"
fi

# Check if inline policy exists
POLICY_EXISTS=$(aws iam list-role-policies \
    --role-name "$IAM_ROLE_NAME" \
    --region "$REGION" \
    --query "PolicyNames[?@ == '$POLICY_NAME']" \
    --output text 2>/dev/null || echo "")

if [ -z "$POLICY_EXISTS" ]; then
    echo "Attaching policy to role"

    # Create inline policy with least-privilege permissions
    POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:prochat/youtube/says-the-bible/oauth-token*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/lambda/${LAMBDA_NAME}*"
    }
  ]
}
EOF
)

    aws iam put-role-policy \
        --role-name "$IAM_ROLE_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --region "$REGION" > /dev/null

    echo "Policy attached"
fi

echo -e "${GREEN}✓ IAM role ready${NC}"
echo ""

# Step 3: Package Lambda
echo -e "${CYAN}Step 3: Packaging Lambda function${NC}"

# Create temporary directory for packaging
PACKAGE_DIR=$(mktemp -d)
trap "rm -rf $PACKAGE_DIR" EXIT

# Copy Lambda source
cp "$LAMBDA_FILE" "$PACKAGE_DIR/youtube-auth-check.py"

# Package into zip (urllib3 is included in Python 3.11)
cd "$PACKAGE_DIR"
zip -q "$ZIP_FILE" youtube-auth-check.py

echo -e "${GREEN}✓ Lambda packaged${NC}"
echo "  File: $ZIP_FILE"
echo "  Size: $(du -h $ZIP_FILE | cut -f1)"
echo ""

# Step 4: Deploy or update Lambda
echo -e "${CYAN}Step 4: Deploying Lambda function${NC}"

# Wait for role to be available (IAM eventual consistency)
sleep 2

# Check if function already exists
FUNCTION_EXISTS=$(aws lambda get-function \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Configuration.FunctionName' \
    --output text 2>/dev/null || echo "")

if [ -n "$FUNCTION_EXISTS" ]; then
    echo "Updating existing function: $LAMBDA_NAME"

    aws lambda update-function-code \
        --function-name "$LAMBDA_NAME" \
        --zip-file "fileb://$ZIP_FILE" \
        --region "$REGION" > /dev/null

    # Update configuration
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_NAME" \
        --timeout "$TIMEOUT" \
        --memory-size "$MEMORY" \
        --environment "Variables={YOUTUBE_SECRET_NAME=$SECRET_NAME}" \
        --region "$REGION" > /dev/null

    echo "Function updated"
else
    echo "Creating new function: $LAMBDA_NAME"

    aws lambda create-function \
        --function-name "$LAMBDA_NAME" \
        --runtime "$RUNTIME" \
        --role "$ROLE_ARN" \
        --handler "$LAMBDA_HANDLER" \
        --zip-file "fileb://$ZIP_FILE" \
        --timeout "$TIMEOUT" \
        --memory-size "$MEMORY" \
        --environment "Variables={YOUTUBE_SECRET_NAME=$SECRET_NAME}" \
        --region "$REGION" > /dev/null

    echo "Function created"
fi

echo -e "${GREEN}✓ Lambda deployed${NC}"
echo ""

# Step 5: Verify deployment
echo -e "${CYAN}Step 5: Verifying deployment${NC}"

FUNCTION_INFO=$(aws lambda get-function \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION" \
    --query 'Configuration.[FunctionArn,Runtime,Timeout,MemorySize,Environment.Variables.YOUTUBE_SECRET_NAME]' \
    --output json)

FUNCTION_ARN=$(echo "$FUNCTION_INFO" | jq -r '.[0]')
FUNCTION_RUNTIME=$(echo "$FUNCTION_INFO" | jq -r '.[1]')
FUNCTION_TIMEOUT=$(echo "$FUNCTION_INFO" | jq -r '.[2]')
FUNCTION_MEMORY=$(echo "$FUNCTION_INFO" | jq -r '.[3]')
FUNCTION_SECRET=$(echo "$FUNCTION_INFO" | jq -r '.[4]')

echo -e "${GREEN}✓ Function verified${NC}"
echo "  ARN: $FUNCTION_ARN"
echo "  Runtime: $FUNCTION_RUNTIME"
echo "  Timeout: ${FUNCTION_TIMEOUT}s"
echo "  Memory: ${FUNCTION_MEMORY}MB"
echo "  Secret: $FUNCTION_SECRET"
echo ""

echo "==========================================="
echo -e "${GREEN}✅ Lambda deployment complete${NC}"
echo "==========================================="
echo ""
echo "Function: $LAMBDA_NAME"
echo "Region: $REGION"
echo ""
echo "Next step:"
echo "  scripts/youtube-auth-check-lambda.sh"
echo ""
