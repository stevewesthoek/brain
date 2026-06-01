#!/bin/bash
# Generate video from an approved script
# Usage: scripts/generate-approved-script.sh <jobId>
# Example: scripts/generate-approved-script.sh prochat-approved-gen-001

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <jobId>"
    echo "Example: $0 prochat-approved-gen-001"
    exit 1
fi

JOB_ID="$1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
STATE_MACHINE_ARN="arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
METADATA_DIR="$CLOUD_ROOT/jobs/$JOB_ID/metadata"

echo "==========================================="
echo "Generate Approved Script"
echo "==========================================="
echo "Job ID: $JOB_ID"
echo "Bucket: $BUCKET"
echo ""

# Step 1: Verify script exists and is approved
echo "[1/6] Verifying script approval..."
if [ ! -f "$METADATA_DIR/script.json" ]; then
    echo "❌ Script metadata not found for job: $JOB_ID"
    exit 1
fi

SCRIPT_STATUS=$(jq -r '.approval.status // "pending"' "$METADATA_DIR/script.json")
if [ "$SCRIPT_STATUS" != "approved" ]; then
    echo "❌ Script approval status is '$SCRIPT_STATUS', not 'approved'. Cannot generate."
    exit 1
fi
echo "✓ Script approved"
echo ""

# Step 2: Verify topic metadata exists
echo "[2/6] Verifying topic metadata..."
if [ ! -f "$METADATA_DIR/topic.json" ]; then
    echo "❌ Topic metadata not found for job: $JOB_ID"
    exit 1
fi
echo "✓ Topic metadata found"
echo ""

# Step 3: Generate narration (mocked - using test fixture)
echo "[3/6] Generating narration..."
NARRATION_DEST="jobs/$JOB_ID/audio/narration.mp3"
TEST_NARRATION="jobs/test-001/audio/narration.mp3"

aws s3 cp "s3://$BUCKET/$TEST_NARRATION" \
    "s3://$BUCKET/$NARRATION_DEST" \
    --region eu-north-1 \
    --no-cli-pager > /dev/null
echo "✓ Narration ready: $NARRATION_DEST"
echo ""

# Step 4: Run video assembly workflow
echo "[4/6] Starting video assembly workflow..."
EXECUTION_ID="approved-gen-${JOB_ID}-$(date +%s)"
INPUT_JSON=$(cat <<EOF
{
  "jobId": "$JOB_ID",
  "videoKey": "jobs/$JOB_ID/video-generated/generated-001.mp4",
  "audioKey": "$NARRATION_DEST"
}
EOF
)

EXECUTION_ARN=$(aws stepfunctions start-execution \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --name "$EXECUTION_ID" \
    --input "$INPUT_JSON" \
    --region eu-north-1 \
    --query 'executionArn' \
    --output text \
    --no-cli-pager)

echo "✓ Execution started"
echo "  Execution ARN: $EXECUTION_ARN"
echo "  Execution ID: $EXECUTION_ID"
echo ""

# Step 5: Wait for execution completion
echo "[5/6] Waiting for workflow completion (~20-30 seconds)..."
echo ""

MAX_WAIT=60
WAIT_INTERVAL=5
ATTEMPTS=0
EXECUTION_STATUS="RUNNING"

while [ "$EXECUTION_STATUS" = "RUNNING" ] && [ "$ATTEMPTS" -lt "$MAX_WAIT" ]; do
    EXECUTION_STATUS=$(aws stepfunctions describe-execution \
        --execution-arn "$EXECUTION_ARN" \
        --region eu-north-1 \
        --query 'status' \
        --output text \
        --no-cli-pager)

    if [ "$EXECUTION_STATUS" = "RUNNING" ]; then
        echo -ne "\r  Polling... attempt $((ATTEMPTS+1))/$MAX_WAIT (${EXECUTION_STATUS})"
        sleep $WAIT_INTERVAL
        ((ATTEMPTS++))
    fi
done

echo ""
echo ""

if [ "$EXECUTION_STATUS" != "SUCCEEDED" ]; then
    echo "❌ Workflow FAILED: $EXECUTION_STATUS"
    echo ""
    echo "Failure details:"
    aws stepfunctions describe-execution \
        --execution-arn "$EXECUTION_ARN" \
        --region eu-north-1 \
        --no-cli-pager | jq '.cause' 2>/dev/null || echo "Unable to fetch failure details"
    exit 1
fi

echo "✅ Workflow SUCCEEDED"
echo ""

# Step 6: Create publish.json with publishStatus=pending (do not publish)
echo "[6/6] Creating publish metadata..."
mkdir -p "$CLOUD_ROOT/jobs/$JOB_ID/publishing"

cat > "$CLOUD_ROOT/jobs/$JOB_ID/publishing/publish.json" << EOF
{
  "jobId": "$JOB_ID",
  "publishStatus": "pending",
  "publishBlocked": true,
  "reason": "Generated from approved script - awaiting final approval before publishing",
  "createdAt": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "generatedBy": "generate-approved-script",
  "platforms": []
}
EOF

aws s3 cp "$CLOUD_ROOT/jobs/$JOB_ID/publishing/publish.json" \
    "s3://$BUCKET/jobs/$JOB_ID/publishing/publish.json" \
    --region eu-north-1 \
    --content-type application/json \
    --no-cli-pager > /dev/null

echo "✓ Publish metadata created: publish.json (publishStatus=pending)"
echo ""

echo "==========================================="
echo "✅ Approved Script Generation Complete"
echo "==========================================="
echo ""
echo "Summary:"
echo "  Job ID: $JOB_ID"
echo "  Execution: $EXECUTION_ID"
echo "  Status: $EXECUTION_STATUS"
echo "  Narration: $NARRATION_DEST"
echo "  Publish: BLOCKED (publishStatus=pending)"
echo ""
echo "Next step: Approve final video for publishing"
echo ""
