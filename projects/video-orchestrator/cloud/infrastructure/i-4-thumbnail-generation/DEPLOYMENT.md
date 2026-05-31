# I-4.2 Deployment: Thumbnail Lambda

This document contains exact AWS CLI commands for deploying I-4.2 thumbnail extraction Lambda.

## CRITICAL BLOCKER: ffmpeg Availability

**Status:** BLOCKED — AWS Lambda base image does not include ffmpeg.

The `lambda-extract-thumbnail.py` function requires ffmpeg to extract frames from video files. AWS Lambda does not include ffmpeg in the base Python runtime.

### Options to resolve:

1. **Create Lambda Layer with ffmpeg** (RECOMMENDED)
   - Build ffmpeg static binary for Amazon Linux 2
   - Package as Lambda layer
   - Attach to `video-orchestrator-extract-thumbnail` Lambda
   - Unblocks I-4.2 deployment

2. **Package static ffmpeg with ZIP** 
   - Download pre-compiled ffmpeg binary (14MB+)
   - Include in deployment ZIP
   - Makes deployment package ~15MB+ (larger cold start)
   - Less maintainable across updates

3. **Use container image instead of ZIP**
   - Create ECR image based on Amazon Linux 2 with ffmpeg
   - Deploy Lambda as container
   - Higher complexity, better for production

### Recommendation:
Build a Lambda layer at `../lambda-layers/ffmpeg/` containing a static ffmpeg binary. This layer can be reused for any Lambda that needs video processing.

## Prerequisites

- AWS CLI configured with credentials (account 909439522876, region eu-north-1)
- Python 3.11 available locally
- Access to S3 bucket: `prochat-video-dev-909439522876-eu-north-1-an`
- **BLOCKED:** ffmpeg available in Lambda (requires layer)

## Step 1: Check IAM Role

Reuse existing `video-orchestrator-lambda-execution` role if available:

```bash
LAMBDA_ROLE_ARN=$(aws iam get-role \
  --role-name video-orchestrator-lambda-execution \
  --query 'Role.Arn' \
  --output text 2>/dev/null) || echo "Role does not exist"

echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"
```

If role doesn't exist, create it:

```bash
# Create trust policy
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

LAMBDA_ROLE_ARN=$(aws iam get-role \
  --role-name video-orchestrator-lambda-execution \
  --query 'Role.Arn' \
  --output text)

echo "Created Lambda Role: $LAMBDA_ROLE_ARN"
```

## Step 2: Update IAM Policy for Thumbnail Operations

Add S3 read/write permissions for thumbnail bucket:

```bash
cat > /tmp/thumbnail-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/thumbnails/*"
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

aws iam put-role-policy \
  --role-name video-orchestrator-lambda-execution \
  --policy-name video-orchestrator-thumbnail-policy \
  --policy-document file:///tmp/thumbnail-policy.json

echo "✓ IAM policy updated"
```

## Step 3: Create Lambda Layer with ffmpeg (REQUIRED TO PROCEED)

This step is BLOCKED until a Lambda layer with ffmpeg is created.

```bash
# TODO: Build Lambda layer with ffmpeg binary
# mkdir -p lambda-layers/ffmpeg/python/lib
# Download/compile ffmpeg for Amazon Linux 2 runtime
# Package as ZIP with structure: python/lib/ffmpeg
# Create layer version
# Reference: ../lambda-layers/ffmpeg/BUILD.md

echo "⚠️  BLOCKER: ffmpeg Lambda layer not yet created"
echo "   See ../lambda-layers/ffmpeg/BUILD.md for instructions"
exit 1
```

## Step 4: Create Deployment Package (when ffmpeg layer is ready)

```bash
# Create deployment directory
mkdir -p /tmp/lambda-extract-thumbnail
cd /tmp/lambda-extract-thumbnail

# Copy function code
cp ../i-4-thumbnail-generation/lambda-extract-thumbnail.py .

# Create ZIP
zip -r lambda-extract-thumbnail.zip lambda-extract-thumbnail.py

# Verify
ls -lh lambda-extract-thumbnail.zip
```

## Step 5: Deploy Lambda (when ffmpeg layer is ready)

```bash
LAMBDA_ROLE_ARN=$(aws iam get-role \
  --role-name video-orchestrator-lambda-execution \
  --query 'Role.Arn' \
  --output text)

REGION="eu-north-1"
FUNCTION_NAME="video-orchestrator-extract-thumbnail"

# Deploy function
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime python3.11 \
  --role $LAMBDA_ROLE_ARN \
  --handler lambda-extract-thumbnail.lambda_handler \
  --zip-file fileb:///tmp/lambda-extract-thumbnail/lambda-extract-thumbnail.zip \
  --region $REGION \
  --timeout 60 \
  --memory-size 512 \
  --description "Extract thumbnail frame from final video (I-4.2)"

echo "✓ Lambda deployed: $FUNCTION_NAME"

# Get function ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "Lambda ARN: $LAMBDA_ARN"
```

## Step 6: Test Lambda Invocation (when ffmpeg layer is ready)

```bash
FUNCTION_NAME="video-orchestrator-extract-thumbnail"
REGION="eu-north-1"

# Create test payload
cat > /tmp/test-thumbnail-payload.json << 'EOF'
{
  "jobId": "test-001",
  "videoKey": "jobs/test-001/exports/generated-001-final.mp4",
  "bucket": "prochat-video-dev-909439522876-eu-north-1-an",
  "thumbnailKey": "jobs/test-001/thumbnails/thumbnail-001.png",
  "frameTime": 3,
  "resolution": "1280x720"
}
EOF

# Invoke Lambda
aws lambda invoke \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --payload fileb:///tmp/test-thumbnail-payload.json \
  /tmp/lambda-response.json

echo "✓ Lambda invoked"
echo "Response:"
cat /tmp/lambda-response.json | jq .

# Check S3 output
echo ""
echo "Verifying S3 output:"
aws s3api head-object \
  --bucket prochat-video-dev-909439522876-eu-north-1-an \
  --key jobs/test-001/thumbnails/thumbnail-001.png \
  --region $REGION
```

## Status

- ✅ Function code written: `lambda-extract-thumbnail.py`
- ✅ IAM permissions configured
- ⏳ **BLOCKED:** ffmpeg Lambda layer required
  - Cannot deploy until layer is created
  - See `../lambda-layers/ffmpeg/BUILD.md` (does not exist yet)
  - Next task: Build Lambda layer with static ffmpeg binary
- ⏳ Lambda deployment (blocked)
- ⏳ Direct invocation test (blocked)
- ⏳ Step Functions integration (blocked)

## Next Steps

1. **Create Lambda layer with ffmpeg** (required blocker resolution)
2. Deploy `video-orchestrator-extract-thumbnail` Lambda
3. Test direct invocation with thumbnail extraction payload
4. Integrate with Step Functions after proving Lambda works
5. Mark I-4.2 complete

## References

- Function code: `../i-4-thumbnail-generation/lambda-extract-thumbnail.py`
- Preflight test: `../../scripts/i4-thumbnail-preflight.sh` (proves frame extraction works locally)
- Expected output: `jobs/test-001/thumbnails/thumbnail-001.png` (360267 bytes)
