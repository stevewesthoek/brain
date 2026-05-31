#!/bin/bash
# Create a new video job with required metadata structure
# Usage: scripts/create-video-job.sh <jobId>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <jobId>"
    echo "Example: $0 prochat-os-001"
    exit 1
fi

JOB_ID="$1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
BASE_JOB_PATH="jobs/$JOB_ID"

echo "Creating video job: $JOB_ID"
echo ""

# Create job.json
echo "1. Creating metadata/job.json..."
cat > /tmp/job.json << EOF
{
  "jobId": "$JOB_ID",
  "createdAt": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "status": "pending",
  "type": "video-assembly",
  "topic": null,
  "scriptStatus": "pending"
}
EOF

aws s3 cp /tmp/job.json s3://$BUCKET/$BASE_JOB_PATH/metadata/job.json \
  --region eu-north-1 \
  --content-type application/json \
  --no-cli-pager > /dev/null && echo "   ✓ job.json created"

# Create status.json (initial state)
echo "2. Creating metadata/status.json..."
cat > /tmp/status.json << EOF
{
  "jobId": "$JOB_ID",
  "status": "pending",
  "currentStep": "awaiting_approval",
  "completedSteps": [],
  "failedStep": null,
  "lastError": null,
  "startedAt": null,
  "completedAt": null,
  "updatedAt": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "stepFunctionsExecutionArn": null,
  "retryCount": 0
}
EOF

aws s3 cp /tmp/status.json s3://$BUCKET/$BASE_JOB_PATH/metadata/status.json \
  --region eu-north-1 \
  --content-type application/json \
  --no-cli-pager > /dev/null && echo "   ✓ status.json created"

# Create approvals.json (pending approval)
echo "3. Creating metadata/approvals.json..."
cat > /tmp/approvals.json << EOF
{
  "jobId": "$JOB_ID",
  "approvals": {
    "script": {
      "status": "pending",
      "approvedBy": null,
      "approvedAt": null,
      "notes": null
    },
    "scenes": {
      "status": "not_required",
      "approvedBy": null,
      "approvedAt": null,
      "notes": null
    },
    "final": {
      "status": "not_required",
      "approvedBy": null,
      "approvedAt": null,
      "notes": null
    }
  }
}
EOF

aws s3 cp /tmp/approvals.json s3://$BUCKET/$BASE_JOB_PATH/metadata/approvals.json \
  --region eu-north-1 \
  --content-type application/json \
  --no-cli-pager > /dev/null && echo "   ✓ approvals.json created"

# Create assets.json (empty, will be populated)
echo "4. Creating metadata/assets.json..."
cat > /tmp/assets.json << EOF
{
  "jobId": "$JOB_ID",
  "pipelineVersion": "I-4.2",
  "generatedAt": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "assets": {}
}
EOF

aws s3 cp /tmp/assets.json s3://$BUCKET/$BASE_JOB_PATH/metadata/assets.json \
  --region eu-north-1 \
  --content-type application/json \
  --no-cli-pager > /dev/null && echo "   ✓ assets.json created"

echo ""
echo "✅ Job '$JOB_ID' created successfully"
echo ""
echo "Next steps:"
echo "  1. Upload script to: s3://$BUCKET/$BASE_JOB_PATH/scripts/script.md"
echo "  2. Upload narration to: s3://$BUCKET/$BASE_JOB_PATH/audio/narration.mp3"
echo "  3. Upload generated video to: s3://$BUCKET/$BASE_JOB_PATH/video-generated/generated-001.mp4"
echo "  4. Update approvals: s3://$BUCKET/$BASE_JOB_PATH/metadata/approvals.json (set script.status = approved)"
echo "  5. Run Step Functions: scripts/i5-dynamic-job-proof.sh $JOB_ID"
echo ""
