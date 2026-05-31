#!/bin/bash
# I-2 Quick Start Deployment Script
# Run this from your terminal to deploy I-2 infrastructure

set -e

REGION="eu-north-1"
ACCOUNT="909439522876"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
I2_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 I-2 Deployment Quick Start"
echo "Region: $REGION"
echo "Account: $ACCOUNT"
echo ""

# ============================================================================
# STEP 1: Create IAM Role for Lambda
# ============================================================================
echo "📋 Step 1: Creating IAM role for Lambda..."

cat > /tmp/lambda-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name video-orchestrator-lambda-execution \
  --assume-role-policy-document file:///tmp/lambda-trust.json \
  2>/dev/null || echo "  (role already exists)"

# Attach policy
cat > /tmp/lambda-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/*"
    },
    {
      "Effect": "Allow",
      "Action": ["mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:DescribeEndpoints", "iam:PassRole"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:eu-north-1:909439522876:log-group:/aws/lambda/video-orchestrator-*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name video-orchestrator-lambda-execution \
  --policy-name video-orchestrator-lambda-policy \
  --policy-document file:///tmp/lambda-policy.json

echo "  ✅ IAM role configured"

# ============================================================================
# STEP 2: Deploy Lambda Functions
# ============================================================================
echo "📋 Step 2: Deploying Lambda functions..."

deploy_lambda() {
  local name=$1
  local file=$2
  local timeout=$3
  local memory=$4

  echo "  Deploying $name..."

  cd /tmp
  mkdir -p $name
  cp $file $name/index.py
  cd $name
  zip -q -r ../$name.zip .
  cd /tmp

  aws lambda create-function \
    --function-name $name \
    --runtime python3.11 \
    --role arn:aws:iam::909439522876:role/video-orchestrator-lambda-execution \
    --handler index.lambda_handler \
    --zip-file fileb:///tmp/$name.zip \
    --timeout $timeout \
    --memory-size $memory \
    --region $REGION \
    2>/dev/null || \
  aws lambda update-function-code \
    --function-name $name \
    --zip-file fileb:///tmp/$name.zip \
    --region $REGION
}

# Deploy each function
deploy_lambda "video-orchestrator-check-approval" "$I2_DIR/lambda-check-approval.py" 30 256
deploy_lambda "video-orchestrator-update-status" "$I2_DIR/lambda-update-status.py" 30 256
deploy_lambda "video-orchestrator-mediaconvert" "$I2_DIR/lambda-mediaconvert.py" 60 512
deploy_lambda "video-orchestrator-wait-mediaconvert" "$I2_DIR/lambda-wait-mediaconvert.py" 600 256
deploy_lambda "video-orchestrator-verify-output" "$I2_DIR/lambda-verify-output.py" 30 256

# Get MediaConvert endpoint and set environment
ENDPOINT=$(aws mediaconvert describe-endpoints \
  --region $REGION \
  --query 'Endpoints[0].Url' \
  --output text)

aws lambda update-function-configuration \
  --function-name video-orchestrator-mediaconvert \
  --environment Variables="{MEDIACONVERT_ENDPOINT=$ENDPOINT}" \
  --region $REGION > /dev/null

aws lambda update-function-configuration \
  --function-name video-orchestrator-wait-mediaconvert \
  --environment Variables="{MEDIACONVERT_ENDPOINT=$ENDPOINT}" \
  --region $REGION > /dev/null

echo "  ✅ All Lambda functions deployed"

# ============================================================================
# STEP 3: Create Step Functions Execution Role
# ============================================================================
echo "📋 Step 3: Creating Step Functions execution role..."

cat > /tmp/stepfunctions-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "states.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name video-orchestrator-stepfunctions-execution \
  --assume-role-policy-document file:///tmp/stepfunctions-trust.json \
  2>/dev/null || echo "  (role already exists)"

cat > /tmp/stepfunctions-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["lambda:InvokeFunction"],
    "Resource": ["arn:aws:lambda:eu-north-1:909439522876:function:video-orchestrator-*"]
  }]
}
EOF

aws iam put-role-policy \
  --role-name video-orchestrator-stepfunctions-execution \
  --policy-name video-orchestrator-stepfunctions-policy \
  --policy-document file:///tmp/stepfunctions-policy.json

STEPFUNCTIONS_ROLE=$(aws iam get-role \
  --role-name video-orchestrator-stepfunctions-execution \
  --query 'Role.Arn' \
  --output text)

echo "  ✅ Step Functions role configured"

# ============================================================================
# STEP 4: Create or Update Step Functions State Machine
# ============================================================================
echo "📋 Step 4: Creating Step Functions state machine..."

STATE_MACHINE_DEF=$(cat $I2_DIR/step-functions-state-machine.json)

# Check if exists
EXISTING=$(aws stepfunctions list-state-machines \
  --region $REGION \
  --query "stateMachines[?name=='video-orchestrator-i2-assembly'].stateMachineArn" \
  --output text 2>/dev/null || echo "")

if [ -z "$EXISTING" ]; then
  STATE_MACHINE_ARN=$(aws stepfunctions create-state-machine \
    --name video-orchestrator-i2-assembly \
    --definition "$STATE_MACHINE_DEF" \
    --role-arn $STEPFUNCTIONS_ROLE \
    --region $REGION \
    --query 'stateMachineArn' \
    --output text)
  echo "  ✅ State machine created"
else
  aws stepfunctions update-state-machine \
    --state-machine-arn "$EXISTING" \
    --definition "$STATE_MACHINE_DEF" \
    --role-arn $STEPFUNCTIONS_ROLE \
    --region $REGION
  STATE_MACHINE_ARN="$EXISTING"
  echo "  ✅ State machine updated"
fi

# ============================================================================
# STEP 5: Prepare Test Data
# ============================================================================
echo "📋 Step 5: Preparing test approval..."

cat > /tmp/approvals.json << 'EOF'
{
  "jobId": "test-001",
  "approvals": {
    "script": {
      "status": "approved",
      "approvedBy": "deployment-test",
      "approvedAt": "2026-05-30T12:00:00Z",
      "notes": "I-2 deployment test"
    },
    "scenes": {"status": "not_required"},
    "final": {"status": "not_required"}
  }
}
EOF

aws s3 cp /tmp/approvals.json \
  s3://$BUCKET/jobs/test-001/metadata/approvals.json

echo "  ✅ Test approval uploaded"

# ============================================================================
# STEP 6: Execute Workflow
# ============================================================================
echo "📋 Step 6: Executing workflow..."

EXECUTION_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name "test-$(date +%s)" \
  --input '{"jobId":"test-001"}' \
  --region $REGION \
  --query 'executionArn' \
  --output text)

echo "  ✅ Execution started: $EXECUTION_ARN"

# ============================================================================
# STEP 7: Wait for Completion
# ============================================================================
echo "📋 Step 7: Waiting for execution to complete (this may take 3-5 minutes)..."

STATUS="RUNNING"
ATTEMPTS=0
MAX_ATTEMPTS=180  # 15 minutes

while [ "$STATUS" = "RUNNING" ] && [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  STATUS=$(aws stepfunctions describe-execution \
    --execution-arn $EXECUTION_ARN \
    --region $REGION \
    --query 'status' \
    --output text)

  ATTEMPTS=$((ATTEMPTS + 1))

  if [ "$STATUS" = "RUNNING" ]; then
    echo -n "."
    sleep 5
  fi
done

echo ""

if [ "$STATUS" = "SUCCEEDED" ]; then
  echo "  ✅ Execution SUCCEEDED"
else
  echo "  ❌ Execution $STATUS"
  echo "  Check execution history:"
  echo "    aws stepfunctions get-execution-history --execution-arn $EXECUTION_ARN --region $REGION"
  exit 1
fi

# ============================================================================
# STEP 8: Validate Results
# ============================================================================
echo "📋 Step 8: Validating results..."

# Check status.json
echo "  Checking status.json..."
STATUS_JSON=$(aws s3 cp s3://$BUCKET/jobs/test-001/metadata/status.json - 2>/dev/null || echo "{}")
STATUS_FIELD=$(echo "$STATUS_JSON" | jq -r '.status' 2>/dev/null || echo "ERROR")

if [ "$STATUS_FIELD" = "complete" ]; then
  echo "    ✅ status.json shows complete"
  echo "    MediaConvert Job ID: $(echo "$STATUS_JSON" | jq -r '.mediaConvertJobId')"
else
  echo "    ❌ status.json not updated correctly: $STATUS_FIELD"
fi

# Check output file
echo "  Checking output file..."
if aws s3 ls s3://$BUCKET/jobs/test-001/exports/test-001-final.mp4 2>/dev/null; then
  FILE_SIZE=$(aws s3api head-object \
    --bucket $BUCKET \
    --key jobs/test-001/exports/test-001-final.mp4 \
    --query 'ContentLength' \
    --output text)
  echo "    ✅ test-001-final.mp4 exists ($FILE_SIZE bytes)"
else
  echo "    ❌ test-001-final.mp4 not found"
fi

# ============================================================================
# DONE
# ============================================================================
echo ""
echo "🎉 I-2 Deployment Complete!"
echo ""
echo "Summary:"
echo "  State Machine: $STATE_MACHINE_ARN"
echo "  Lambda Functions: 5 deployed"
echo "  Execution Status: $STATUS"
echo ""
echo "To download and verify the output file:"
echo "  aws s3 cp s3://$BUCKET/jobs/test-001/exports/test-001-final.mp4 test-001-final.mp4"
echo "  ffprobe test-001-final.mp4"
echo ""
