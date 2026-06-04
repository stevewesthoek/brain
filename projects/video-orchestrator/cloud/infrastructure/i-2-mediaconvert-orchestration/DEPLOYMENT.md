# I-2 Deployment: Exact CLI Commands

This document contains exact AWS CLI commands for deploying I-2 MediaConvert orchestration.

## Prerequisites

- AWS CLI configured with credentials (account 909439522876, region eu-north-1)
- Python 3.11 available locally
- Access to S3 bucket: `prochat-video-dev-909439522876-eu-north-1-an`
- Access to MediaConvert in eu-north-1
- Existing IAM role: `arn:aws:iam::909439522876:role/service-role/MediaConvert_Default_Role`

## Step 1: Create IAM Role for Lambda Functions

First, check if execution role exists:

```bash
aws iam get-role \
  --role-name video-orchestrator-lambda-execution \
  --region eu-north-1 \
  2>/dev/null || echo "Role does not exist yet"
```

If it doesn't exist, create it:

```bash
# Create trust policy file
cat > /tmp/lambda-trust-policy.json << 'EOF'
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

# Create role
aws iam create-role \
  --role-name video-orchestrator-lambda-execution \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Store role ARN for later use
LAMBDA_ROLE_ARN=$(aws iam get-role --role-name video-orchestrator-lambda-execution --query 'Role.Arn' --output text)
echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"
```

## Step 2: Attach IAM Policy to Lambda Role

Create and attach S3 + MediaConvert policy:

```bash
# Create policy document
cat > /tmp/lambda-execution-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "mediaconvert:CreateJob",
        "mediaconvert:GetJob",
        "mediaconvert:DescribeEndpoints",
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:eu-north-1:909439522876:log-group:/aws/lambda/video-orchestrator-*"
    }
  ]
}
EOF

# Attach inline policy
aws iam put-role-policy \
  --role-name video-orchestrator-lambda-execution \
  --policy-name video-orchestrator-lambda-policy \
  --policy-document file:///tmp/lambda-execution-policy.json

echo "✅ IAM policy attached"
```

## Step 3: Get MediaConvert Endpoint

```bash
# Discover MediaConvert endpoint for eu-north-1
MEDIACONVERT_ENDPOINT=$(aws mediaconvert describe-endpoints \
  --region eu-north-1 \
  --query 'Endpoints[0].Url' \
  --output text)

echo "MediaConvert Endpoint: $MEDIACONVERT_ENDPOINT"
# Expected: https://abc123def456.mediaconvert.eu-north-1.amazonaws.com
```

Store this for Lambda environment variables.

## Step 4: Package and Deploy Lambda Functions

Create deployment packages and deploy each function:

### 4.1 Lambda: check-approval

```bash
# Create deployment package
cd /tmp
mkdir -p lambda-check-approval
cp ./lambda-check-approval.py lambda-check-approval/index.py
cd lambda-check-approval
zip -r ../lambda-check-approval.zip .
cd /tmp

# Create Lambda function
aws lambda create-function \
  --function-name video-orchestrator-check-approval \
  --runtime python3.11 \
  --role arn:aws:iam::909439522876:role/video-orchestrator-lambda-execution \
  --handler index.lambda_handler \
  --zip-file fileb:///tmp/lambda-check-approval.zip \
  --timeout 30 \
  --memory-size 256 \
  --region eu-north-1 \
  2>/dev/null || \
aws lambda update-function-code \
  --function-name video-orchestrator-check-approval \
  --zip-file fileb:///tmp/lambda-check-approval.zip \
  --region eu-north-1

echo "✅ Lambda check-approval deployed"
```

### 4.2 Lambda: update-status

```bash
# Create deployment package
cd /tmp
mkdir -p lambda-update-status
cp ./lambda-update-status.py lambda-update-status/index.py
cd lambda-update-status
zip -r ../lambda-update-status.zip .
cd /tmp

# Create Lambda function
aws lambda create-function \
  --function-name video-orchestrator-update-status \
  --runtime python3.11 \
  --role arn:aws:iam::909439522876:role/video-orchestrator-lambda-execution \
  --handler index.lambda_handler \
  --zip-file fileb:///tmp/lambda-update-status.zip \
  --timeout 30 \
  --memory-size 256 \
  --region eu-north-1 \
  2>/dev/null || \
aws lambda update-function-code \
  --function-name video-orchestrator-update-status \
  --zip-file fileb:///tmp/lambda-update-status.zip \
  --region eu-north-1

echo "✅ Lambda update-status deployed"
```

### 4.3 Lambda: mediaconvert

```bash
# Create deployment package
cd /tmp
mkdir -p lambda-mediaconvert
cp ./lambda-mediaconvert.py lambda-mediaconvert/index.py
cd lambda-mediaconvert
zip -r ../lambda-mediaconvert.zip .
cd /tmp

# Get MediaConvert endpoint if not already set
if [ -z "$MEDIACONVERT_ENDPOINT" ]; then
  MEDIACONVERT_ENDPOINT=$(aws mediaconvert describe-endpoints \
    --region eu-north-1 \
    --query 'Endpoints[0].Url' \
    --output text)
fi

# Create Lambda function with environment variable
aws lambda create-function \
  --function-name video-orchestrator-mediaconvert \
  --runtime python3.11 \
  --role arn:aws:iam::909439522876:role/video-orchestrator-lambda-execution \
  --handler index.lambda_handler \
  --zip-file fileb:///tmp/lambda-mediaconvert.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment Variables="{MEDIACONVERT_ENDPOINT=$MEDIACONVERT_ENDPOINT}" \
  --region eu-north-1 \
  2>/dev/null || \
aws lambda update-function-code \
  --function-name video-orchestrator-mediaconvert \
  --zip-file fileb:///tmp/lambda-mediaconvert.zip \
  --region eu-north-1

# Also update environment variable if function already exists
aws lambda update-function-configuration \
  --function-name video-orchestrator-mediaconvert \
  --environment Variables="{MEDIACONVERT_ENDPOINT=$MEDIACONVERT_ENDPOINT}" \
  --region eu-north-1 || true

echo "✅ Lambda mediaconvert deployed"
```

### 4.4 Lambda: wait-mediaconvert

```bash
# Create deployment package
cd /tmp
mkdir -p lambda-wait-mediaconvert
cp ./lambda-wait-mediaconvert.py lambda-wait-mediaconvert/index.py
cd lambda-wait-mediaconvert
zip -r ../lambda-wait-mediaconvert.zip .
cd /tmp

# Get MediaConvert endpoint if not already set
if [ -z "$MEDIACONVERT_ENDPOINT" ]; then
  MEDIACONVERT_ENDPOINT=$(aws mediaconvert describe-endpoints \
    --region eu-north-1 \
    --query 'Endpoints[0].Url' \
    --output text)
fi

# Create Lambda function
aws lambda create-function \
  --function-name video-orchestrator-wait-mediaconvert \
  --runtime python3.11 \
  --role arn:aws:iam::909439522876:role/video-orchestrator-lambda-execution \
  --handler index.lambda_handler \
  --zip-file fileb:///tmp/lambda-wait-mediaconvert.zip \
  --timeout 600 \
  --memory-size 256 \
  --environment Variables="{MEDIACONVERT_ENDPOINT=$MEDIACONVERT_ENDPOINT}" \
  --region eu-north-1 \
  2>/dev/null || \
aws lambda update-function-code \
  --function-name video-orchestrator-wait-mediaconvert \
  --zip-file fileb:///tmp/lambda-wait-mediaconvert.zip \
  --region eu-north-1

# Update environment variable
aws lambda update-function-configuration \
  --function-name video-orchestrator-wait-mediaconvert \
  --environment Variables="{MEDIACONVERT_ENDPOINT=$MEDIACONVERT_ENDPOINT}" \
  --region eu-north-1 || true

echo "✅ Lambda wait-mediaconvert deployed"
```

### 4.5 Lambda: verify-output

```bash
# Create deployment package
cd /tmp
mkdir -p lambda-verify-output
cp ./lambda-verify-output.py lambda-verify-output/index.py
cd lambda-verify-output
zip -r ../lambda-verify-output.zip .
cd /tmp

# Create Lambda function
aws lambda create-function \
  --function-name video-orchestrator-verify-output \
  --runtime python3.11 \
  --role arn:aws:iam::909439522876:role/video-orchestrator-lambda-execution \
  --handler index.lambda_handler \
  --zip-file fileb:///tmp/lambda-verify-output.zip \
  --timeout 30 \
  --memory-size 256 \
  --region eu-north-1 \
  2>/dev/null || \
aws lambda update-function-code \
  --function-name video-orchestrator-verify-output \
  --zip-file fileb:///tmp/lambda-verify-output.zip \
  --region eu-north-1

echo "✅ Lambda verify-output deployed"
```

## Step 5: Create Step Functions Execution Role

```bash
# Check if role exists
aws iam get-role \
  --role-name video-orchestrator-stepfunctions-execution \
  --region eu-north-1 \
  2>/dev/null || {
  
  # Create trust policy
  cat > /tmp/stepfunctions-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "states.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  # Create role
  aws iam create-role \
    --role-name video-orchestrator-stepfunctions-execution \
    --assume-role-policy-document file:///tmp/stepfunctions-trust-policy.json
    
  # Attach policy to invoke Lambda functions
  cat > /tmp/stepfunctions-execution-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:eu-north-1:909439522876:function:video-orchestrator-*"
      ]
    }
  ]
}
EOF

  aws iam put-role-policy \
    --role-name video-orchestrator-stepfunctions-execution \
    --policy-name video-orchestrator-stepfunctions-policy \
    --policy-document file:///tmp/stepfunctions-execution-policy.json
}

STEPFUNCTIONS_ROLE=$(aws iam get-role \
  --role-name video-orchestrator-stepfunctions-execution \
  --query 'Role.Arn' \
  --output text)

echo "Step Functions Role ARN: $STEPFUNCTIONS_ROLE"
```

## Step 6: Create or Update Step Functions State Machine

**IMPORTANT:** Use the deploy script to ensure the state machine is always deployed with the correct IAM role (`ProChatVideoStepFunctionsRole`). This prevents regression to `StepFunctionsDefaultRole`, which will fail at runtime.

### Deploy State Machine (Recommended Approach)

```bash
# Deploy state machine with correct role and verification
./deploy-state-machine.sh

# Verify deployment was successful
./verify-state-machine-role.sh
```

The deploy script:
- Validates the state machine definition JSON
- Updates the state machine with the **correct** IAM role: `arn:aws:iam::909439522876:role/ProChatVideoStepFunctionsRole`
- Verifies the deployed role matches expectations
- Prevents regression to `StepFunctionsDefaultRole`

### Manual Deployment (Not Recommended)

If you need manual control, use the AWS CLI directly, but **always** use the correct role:

```bash
# Get state machine definition
STATE_MACHINE_DEF=$(cat ./step-functions-state-machine.json)

# CORRECT role (must be this exact ARN)
STEPFUNCTIONS_ROLE="arn:aws:iam::909439522876:role/ProChatVideoStepFunctionsRole"

# Check if state machine already exists
EXISTING_SM=$(aws stepfunctions list-state-machines \
  --region eu-north-1 \
  --query "stateMachines[?name=='prochat-video-skeleton-dev'].stateMachineArn" \
  --output text)

if [ -z "$EXISTING_SM" ]; then
  # Create new state machine
  aws stepfunctions create-state-machine \
    --name prochat-video-skeleton-dev \
    --definition "$STATE_MACHINE_DEF" \
    --role-arn "$STEPFUNCTIONS_ROLE" \
    --region eu-north-1
  
  STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
    --region eu-north-1 \
    --query "stateMachines[?name=='prochat-video-skeleton-dev'].stateMachineArn" \
    --output text)
  
  echo "✅ State machine created: $STATE_MACHINE_ARN"
else
  # Update existing state machine
  STATE_MACHINE_ARN=$EXISTING_SM
  
  aws stepfunctions update-state-machine \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --definition "$STATE_MACHINE_DEF" \
    --role-arn "$STEPFUNCTIONS_ROLE" \
    --region eu-north-1
  
  echo "✅ State machine updated: $STATE_MACHINE_ARN"
fi

# Always verify after deployment
./verify-state-machine-role.sh
```

### Guardrails and Verification

**Why `ProChatVideoStepFunctionsRole` is required:**

The state machine role must have a trust policy that explicitly allows `states.amazonaws.com` to invoke Lambda functions in this account. The `StepFunctionsDefaultRole` does not have these permissions.

**Symptom of wrong role** (`StepFunctionsDefaultRole`):
- Jobs fail at `CheckApprovalState` with:
  ```
  ApprovalCheckError: The principal states.amazonaws.com is not authorized to assume the provided role
  ```

**Verification command (for CI/CD):**
```bash
./verify-state-machine-role.sh
# Exits 0 if role is correct, nonzero if wrong
```

## Step 7: Prepare Test Data

Before executing, ensure approval is set:

```bash
# Create approval file
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
    "scenes": {
      "status": "not_required"
    },
    "final": {
      "status": "not_required"
    }
  }
}
EOF

# Upload to S3
aws s3 cp /tmp/approvals.json \
  s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/approvals.json

# Verify
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/approvals.json - | jq '.approvals.script.status'
# Expected output: "approved"

echo "✅ Test approval uploaded"
```

## Step 8: Execute Step Functions Workflow

```bash
# Get state machine ARN
STATE_MACHINE_ARN=$(cat /tmp/state-machine-arn.txt 2>/dev/null || \
  aws stepfunctions list-state-machines \
    --region eu-north-1 \
    --query "stateMachines[?name=='video-orchestrator-i2-assembly'].stateMachineArn" \
    --output text)

# Start execution
EXECUTION_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name "test-$(date +%s)" \
  --input '{"jobId":"test-001"}' \
  --region eu-north-1 \
  --query 'executionArn' \
  --output text)

echo "Execution started: $EXECUTION_ARN"
echo $EXECUTION_ARN > /tmp/execution-arn.txt
```

## Step 9: Monitor Execution

```bash
# Get execution ARN
EXECUTION_ARN=$(cat /tmp/execution-arn.txt)

# Watch execution status (run multiple times)
echo "Checking execution status..."
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --region eu-north-1 \
  --query '{Status:status, StopDate:stopDate}' \
  --output text

# To see full execution history:
aws stepfunctions get-execution-history \
  --execution-arn $EXECUTION_ARN \
  --region eu-north-1 \
  --query 'events[].{Type:type,State:stateEnteredEventDetails.name,Error:executionFailedEventDetails.error}' \
  --output table
```

## Step 10: Verify Results

### 10.1 Check Execution Succeeded

```bash
EXECUTION_ARN=$(cat /tmp/execution-arn.txt)

STATUS=$(aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --region eu-north-1 \
  --query 'status' \
  --output text)

if [ "$STATUS" = "SUCCEEDED" ]; then
  echo "✅ Execution SUCCEEDED"
else
  echo "❌ Execution $STATUS"
fi
```

### 10.2 Check status.json Updated

```bash
echo "Checking status.json..."
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/status.json - | jq '.'

# Expected:
# {
#   "jobId": "test-001",
#   "status": "complete",
#   "assemblyStartedAt": "2026-05-30T...",
#   "assemblyCompletedAt": "2026-05-30T...",
#   "mediaConvertJobId": "1234567..."
# }
```

### 10.3 Check Output File Exists

```bash
echo "Checking output file..."
aws s3 ls s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4

# Expected: Size ~20-30 MB
```

### 10.4 Verify Output File Properties

```bash
# Download and check
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4 /tmp/test-001-final.mp4

# Verify with ffprobe (requires ffmpeg installed)
ffprobe /tmp/test-001-final.mp4 | grep -E "Duration|Stream"

# Expected:
# Duration: 00:01:04.033333 (±0.1 seconds)
# Video: h264
# Audio: aac
```

## Troubleshooting

### Issue: Lambda functions not found

**Error:** `InvalidStateDefinitionException: Lambda function resource not found`

**Solution:** 
- Verify Lambda functions were created in eu-north-1
- Check IAM role has correct ARN
- Verify function names match exactly in state machine JSON

```bash
aws lambda list-functions --region eu-north-1 --query 'Functions[?starts_with(FunctionName, `video-orchestrator`)].FunctionName'
```

### Issue: Permission denied

**Error:** `An error occurred (AccessDenied) when calling the ... operation`

**Solution:** Check IAM policies attached to execution role:

```bash
aws iam list-role-policies --role-name video-orchestrator-lambda-execution
aws iam get-role-policy --role-name video-orchestrator-lambda-execution --policy-name video-orchestrator-lambda-policy
```

### Issue: MediaConvert endpoint error

**Error:** `Could not connect to MediaConvert endpoint`

**Solution:** Verify MediaConvert endpoint and update Lambda environment:

```bash
# Get correct endpoint
aws mediaconvert describe-endpoints --region eu-north-1 --query 'Endpoints[0].Url'

# Update in Lambda environment
aws lambda update-function-configuration \
  --function-name video-orchestrator-mediaconvert \
  --environment Variables="{MEDIACONVERT_ENDPOINT=https://abc123.mediaconvert.eu-north-1.amazonaws.com}" \
  --region eu-north-1
```

### Issue: S3 permission denied

**Error:** `An error occurred (AccessDenied) when calling PutObject operation`

**Solution:** Verify S3 bucket policy and Lambda role:

```bash
# Check Lambda role
aws iam get-role-policy --role-name video-orchestrator-lambda-execution --policy-name video-orchestrator-lambda-policy | jq '.PolicyDocument.Statement[] | select(.Action[] | contains("s3"))'
```

## All-in-One Deployment Script

Save this as `deploy-i2.sh`:

```bash
#!/bin/bash
set -e

REGION="eu-north-1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
ACCOUNT="909439522876"
I2_DIR="$(pwd)"

echo "Starting I-2 deployment..."

# Step 1: Create IAM role
echo "Step 1: Creating IAM roles..."
# (IAM commands here)

# Step 2: Deploy Lambda functions
echo "Step 2: Deploying Lambda functions..."
# (Lambda deployment commands here)

# Step 3: Create Step Functions
echo "Step 3: Creating Step Functions..."
# (Step Functions commands here)

# Step 4: Prepare test data
echo "Step 4: Preparing test data..."
# (Test data commands here)

# Step 5: Execute
echo "Step 5: Executing workflow..."
# (Execution commands here)

echo "✅ Deployment complete!"
```

## Validation Checklist

- [ ] 5 Lambda functions created/updated
- [ ] Lambda execution role with S3 + MediaConvert permissions
- [ ] Step Functions state machine created/updated
- [ ] Test approval uploaded to S3
- [ ] Step Functions execution started
- [ ] Execution status: SUCCEEDED
- [ ] status.json shows "complete" with mediaConvertJobId
- [ ] test-001-final.mp4 exists in S3 exports/
- [ ] Output file duration ~64.033333 seconds
- [ ] Output file is playable (H.264 + AAC)
