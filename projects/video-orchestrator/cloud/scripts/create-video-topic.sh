#!/bin/bash
# Create Video Topic Contract
# Creates a canonical topic.json for a video job
# Usage: scripts/create-video-topic.sh <jobId> <channelId>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"

echo "==========================================="
echo "Create Video Topic Contract"
echo "==========================================="
echo ""

JOB_ID="${1}"
CHANNEL_ID="${2}"

if [ -z "$JOB_ID" ] || [ -z "$CHANNEL_ID" ]; then
    echo "Usage: $0 <jobId> <channelId>"
    echo ""
    echo "Examples:"
    echo "  $0 stb-topic-001 says-the-bible"
    echo "  $0 prochat-topic-001 prochat"
    exit 1
fi

echo "Job ID: $JOB_ID"
echo "Channel: $CHANNEL_ID"
echo ""

# Step 1: Verify channel config exists
echo -e "${CYAN}Step 1: Verifying channel configuration${NC}"

if ! aws s3api head-object \
    --bucket "$BUCKET" \
    --key "channels/$CHANNEL_ID/channel.json" \
    --region "$REGION" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Channel config not found: channels/$CHANNEL_ID/channel.json${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Channel config exists${NC}"
echo ""

# Step 2: Verify content-profile exists
echo -e "${CYAN}Step 2: Verifying content profile${NC}"

if ! aws s3api head-object \
    --bucket "$BUCKET" \
    --key "channels/$CHANNEL_ID/content-profile.json" \
    --region "$REGION" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Content profile not found: channels/$CHANNEL_ID/content-profile.json${NC}"
    exit 1
fi

CONTENT_PROFILE=$(aws s3 cp "s3://$BUCKET/channels/$CHANNEL_ID/content-profile.json" - --region "$REGION" 2>&1)

DISPLAY_NAME=$(echo "$CONTENT_PROFILE" | jq -r '.displayName')
echo -e "${GREEN}✓ Content profile exists: $DISPLAY_NAME${NC}"
echo ""

# Step 3: Generate topic.json
echo -e "${CYAN}Step 3: Creating topic contract${NC}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOPIC_ID="${CHANNEL_ID}-$(date +%s)"

cat > /tmp/topic.json << TOPICEOF
{
  "jobId": "$JOB_ID",
  "channelId": "$CHANNEL_ID",
  "topicId": "$TOPIC_ID",
  "title": "",
  "angle": "",
  "audience": "",
  "targetDurationSeconds": 60,
  "status": "draft",
  "createdAt": "$TIMESTAMP",
  "updatedAt": "$TIMESTAMP",
  "source": {
    "type": "manual",
    "reference": null
  },
  "approval": {
    "required": true,
    "status": "pending",
    "approvedAt": null,
    "approvedBy": null
  }
}
TOPICEOF

echo -e "${GREEN}✓ Topic contract generated${NC}"
echo ""

# Step 4: Upload to S3
echo -e "${CYAN}Step 4: Uploading to S3${NC}"

S3_KEY="jobs/$JOB_ID/metadata/topic.json"

aws s3 cp /tmp/topic.json "s3://$BUCKET/$S3_KEY" --region "$REGION"

echo -e "${GREEN}✓ Uploaded to: s3://$BUCKET/$S3_KEY${NC}"
echo ""

# Step 5: Verify upload
echo -e "${CYAN}Step 5: Verifying upload${NC}"

VERIFY=$(aws s3 cp "s3://$BUCKET/$S3_KEY" - --region "$REGION" 2>&1)

if ! echo "$VERIFY" | jq . > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Failed to verify topic.json${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Topic contract verified${NC}"
echo ""

# Final summary
echo "==========================================="
echo -e "${GREEN}✅ Topic contract created${NC}"
echo "==========================================="
echo ""
echo "Job ID: $JOB_ID"
echo "Topic ID: $TOPIC_ID"
echo "Channel: $DISPLAY_NAME ($CHANNEL_ID)"
echo "S3 Path: s3://$BUCKET/$S3_KEY"
echo "Status: draft"
echo "Approval: pending"
echo ""
echo "Next steps:"
echo "  1. Update topic.json with title, angle, audience"
echo "  2. Submit for approval"
echo "  3. Generate video from topic"
echo ""
