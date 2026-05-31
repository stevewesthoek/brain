#!/bin/bash
# I-6 Publishing Contract Proof
# Tests publishing contract creation and simulator workflow
# Usage: scripts/i6-publish-proof.sh <jobId>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <jobId>"
    echo "Example: $0 prochat-os-030"
    exit 1
fi

JOB_ID="$1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

echo "==========================================="
echo "I-6 Publishing Contract Proof"
echo "==========================================="
echo "Job ID: $JOB_ID"
echo ""

# Step 1: Create job and run generation workflow
echo "[1/5] Creating job and running generation (~30 seconds)..."
scripts/create-video-job.sh "$JOB_ID" > /dev/null
echo "  Job created. Running workflow..."
scripts/i5-dynamic-job-proof.sh "$JOB_ID" > /dev/null
echo "✓ Generation workflow complete"
echo ""

# Step 2: Verify publish.json was created by state machine
echo "[2/5] Verifying publish.json created by workflow..."
PUBLISH_JSON=$(aws s3 cp "s3://$BUCKET/jobs/$JOB_ID/metadata/publish.json" - --region eu-north-1 2>/dev/null || echo "NOT_FOUND")

if [ "$PUBLISH_JSON" = "NOT_FOUND" ]; then
    echo "❌ publish.json not found in S3"
    exit 1
fi

PUBLISH_STATUS=$(echo "$PUBLISH_JSON" | jq -r '.publishStatus // "MISSING"')
VIDEO_KEY=$(echo "$PUBLISH_JSON" | jq -r '.videoKey // "MISSING"')
THUMBNAIL_KEY=$(echo "$PUBLISH_JSON" | jq -r '.thumbnailKey // "MISSING"')

if [ "$PUBLISH_STATUS" != "pending" ]; then
    echo "❌ publishStatus should be 'pending' but is '$PUBLISH_STATUS'"
    exit 1
fi

if [ "$VIDEO_KEY" = "MISSING" ] || [ -z "$VIDEO_KEY" ]; then
    echo "❌ videoKey missing from publish.json"
    exit 1
fi

if [ "$THUMBNAIL_KEY" = "MISSING" ] || [ -z "$THUMBNAIL_KEY" ]; then
    echo "❌ thumbnailKey missing from publish.json"
    exit 1
fi

echo "✓ publish.json valid:"
echo "  - publishStatus: $PUBLISH_STATUS"
echo "  - videoKey: $VIDEO_KEY"
echo "  - thumbnailKey: $THUMBNAIL_KEY"
echo ""

# Step 3: Invoke publishing simulator
echo "[3/5] Invoking publishing simulator..."
PAYLOAD=$(echo "{\"jobId\": \"$JOB_ID\"}" | base64 -w 0)
SIMULATOR_RESULT=$(aws lambda invoke --function-name i6-publish-simulator --payload "$PAYLOAD" --region eu-north-1 /tmp/simulator-result.json 2>&1 > /dev/null && cat /tmp/simulator-result.json | jq -r '.publishStatus // "ERROR"')

if [ "$SIMULATOR_RESULT" != "published" ]; then
    echo "❌ Publishing simulator failed"
    cat /tmp/simulator-result.json | jq .
    exit 1
fi

echo "✓ Publishing simulator executed successfully"
echo ""

# Step 4: Verify published.json created
echo "[4/5] Verifying published.json created..."
PUBLISHED_JSON=$(aws s3 cp "s3://$BUCKET/jobs/$JOB_ID/metadata/published.json" - --region eu-north-1 2>/dev/null || echo "NOT_FOUND")

if [ "$PUBLISHED_JSON" = "NOT_FOUND" ]; then
    echo "❌ published.json not found"
    exit 1
fi

PUBLISHED_STATUS=$(echo "$PUBLISHED_JSON" | jq -r '.status // "MISSING"')
PLATFORM=$(echo "$PUBLISHED_JSON" | jq -r '.platform // "MISSING"')

if [ "$PUBLISHED_STATUS" != "published" ]; then
    echo "❌ published.json status should be 'published' but is '$PUBLISHED_STATUS'"
    exit 1
fi

echo "✓ published.json created:"
echo "  - status: $PUBLISHED_STATUS"
echo "  - platform: $PLATFORM"
echo ""

# Step 5: Verify publish.json updated with publishStatus=published
echo "[5/5] Verifying publish.json updated..."
PUBLISH_JSON_UPDATED=$(aws s3 cp "s3://$BUCKET/jobs/$JOB_ID/metadata/publish.json" - --region eu-north-1)
PUBLISH_STATUS_UPDATED=$(echo "$PUBLISH_JSON_UPDATED" | jq -r '.publishStatus // "MISSING"')
PUBLISHED_AT=$(echo "$PUBLISH_JSON_UPDATED" | jq -r '.publishedAt // "MISSING"')

if [ "$PUBLISH_STATUS_UPDATED" != "published" ]; then
    echo "❌ publish.json publishStatus should be 'published' but is '$PUBLISH_STATUS_UPDATED'"
    exit 1
fi

if [ "$PUBLISHED_AT" = "MISSING" ] || [ -z "$PUBLISHED_AT" ]; then
    echo "❌ publishedAt timestamp missing"
    exit 1
fi

echo "✓ publish.json updated:"
echo "  - publishStatus: $PUBLISH_STATUS_UPDATED"
echo "  - publishedAt: $PUBLISHED_AT"
echo ""

echo "==========================================="
echo "✅ I-6 Publishing Contract Proof Complete"
echo "==========================================="
echo ""
echo "Summary:"
echo "  Job ID: $JOB_ID"
echo "  publish.json: Created with status=pending"
echo "  published.json: Created with status=published"
echo "  Workflow: Generation → Contract → Simulator → Published"
echo ""
echo "Contract flow proven ✓"
echo ""
