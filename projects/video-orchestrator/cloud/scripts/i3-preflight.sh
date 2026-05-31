#!/bin/bash
# I-3 Preflight Validation
# Prove locally that generated clip assembly can work before Step Functions retry

set -e

REGION="eu-north-1"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
JOB_ID="test-001"

GENERATED_VIDEO="s3://${BUCKET}/jobs/${JOB_ID}/video-generated/generated-001.mp4"
NARRATION="s3://${BUCKET}/jobs/${JOB_ID}/audio/narration.mp3"
OUTPUT_DIR="s3://${BUCKET}/jobs/${JOB_ID}/exports/"

MEDIACONVERT_ENDPOINT=$(aws mediaconvert describe-endpoints --region $REGION --query 'Endpoints[0].Url' --output text)

echo "════════════════════════════════════════════════════════════"
echo "I-3 Preflight Validation"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Region: $REGION"
echo "Bucket: $BUCKET"
echo "Job ID: $JOB_ID"
echo "MediaConvert Endpoint: $MEDIACONVERT_ENDPOINT"
echo ""

# ============================================================================
# Step 1: Verify generated video exists
# ============================================================================
echo "✓ Step 1: Verify generated video exists"
if aws s3api head-object --bucket $BUCKET --key "jobs/${JOB_ID}/video-generated/generated-001.mp4" --region $REGION > /dev/null 2>&1; then
    echo "  ✅ generated-001.mp4 exists"
else
    echo "  ❌ FAIL: generated-001.mp4 not found"
    exit 1
fi

# ============================================================================
# Step 2: Verify narration exists
# ============================================================================
echo "✓ Step 2: Verify narration exists"
if aws s3api head-object --bucket $BUCKET --key "jobs/${JOB_ID}/audio/narration.mp3" --region $REGION > /dev/null 2>&1; then
    echo "  ✅ narration.mp3 exists"
else
    echo "  ❌ FAIL: narration.mp3 not found"
    exit 1
fi

# ============================================================================
# Step 3: Create MediaConvert job with generated-001.mp4
# ============================================================================
echo "✓ Step 3: Create MediaConvert job with generated-001.mp4"

MEDIACONVERT_PAYLOAD=$(cat <<'PAYLOAD'
{
  "Role": "arn:aws:iam::909439522876:role/service-role/MediaConvert_Default_Role",
  "UserMetadata": {
    "jobId": "test-001",
    "phase": "i-3-preflight"
  },
  "Settings": {
    "TimecodeConfig": {
      "Source": "ZEROBASED"
    },
    "Inputs": [
      {
        "FileInput": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/video-generated/generated-001.mp4",
        "AudioSelectors": {
          "Audio Selector 1": {
            "DefaultSelection": "DEFAULT",
            "ExternalAudioFileInput": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/audio/narration.mp3"
          }
        },
        "VideoSelector": {}
      }
    ],
    "OutputGroups": [
      {
        "Name": "File Group",
        "Outputs": [
          {
            "NameModifier": "-final",
            "VideoDescription": {
              "CodecSettings": {
                "Codec": "H_264",
                "H264Settings": {
                  "RateControlMode": "QVBR",
                  "MaxBitrate": 5000000,
                  "QvbrSettings": {
                    "QvbrQualityLevel": 7
                  }
                }
              }
            },
            "AudioDescriptions": [
              {
                "AudioSourceName": "Audio Selector 1",
                "CodecSettings": {
                  "Codec": "AAC",
                  "AacSettings": {
                    "Bitrate": 128000,
                    "CodingMode": "CODING_MODE_2_0",
                    "SampleRate": 48000
                  }
                }
              }
            ],
            "ContainerSettings": {
              "Container": "MP4"
            }
          }
        ],
        "OutputGroupSettings": {
          "Type": "FILE_GROUP_SETTINGS",
          "FileGroupSettings": {
            "Destination": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/"
          }
        }
      }
    ]
  }
}
PAYLOAD
)

MEDIACONVERT_JOB=$(aws mediaconvert create-job \
  --endpoint-url $MEDIACONVERT_ENDPOINT \
  --region $REGION \
  --cli-input-json "$MEDIACONVERT_PAYLOAD")

MEDIACONVERT_JOB_ID=$(echo "$MEDIACONVERT_JOB" | jq -r '.Job.Id')
if [ -z "$MEDIACONVERT_JOB_ID" ] || [ "$MEDIACONVERT_JOB_ID" = "null" ]; then
    echo "  ❌ FAIL: Could not create MediaConvert job"
    echo "$MEDIACONVERT_JOB" | jq '.'
    exit 1
fi

echo "  ✅ MediaConvert job created: $MEDIACONVERT_JOB_ID"

# ============================================================================
# Step 4: Poll MediaConvert until COMPLETE/ERROR
# ============================================================================
echo "✓ Step 4: Poll MediaConvert job ($MEDIACONVERT_JOB_ID)"

MAX_ATTEMPTS=120
ATTEMPT=0
JOB_STATUS=""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    JOB_RESPONSE=$(aws mediaconvert get-job \
      --endpoint-url $MEDIACONVERT_ENDPOINT \
      --region $REGION \
      --id $MEDIACONVERT_JOB_ID)

    JOB_STATUS=$(echo "$JOB_RESPONSE" | jq -r '.Job.Status')

    if [ "$JOB_STATUS" = "COMPLETE" ]; then
        echo "  ✅ MediaConvert job COMPLETE after $((ATTEMPT + 1)) attempts"
        break
    elif [ "$JOB_STATUS" = "ERROR" ]; then
        ERROR_CODE=$(echo "$JOB_RESPONSE" | jq -r '.Job.ErrorCode // "UNKNOWN"')
        ERROR_MSG=$(echo "$JOB_RESPONSE" | jq -r '.Job.ErrorMessage // "No error message"')
        echo "  ❌ FAIL: MediaConvert job ERROR"
        echo "     Code: $ERROR_CODE"
        echo "     Message: $ERROR_MSG"
        exit 1
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $((ATTEMPT % 10)) -eq 0 ]; then
        echo "  ⏳ Polling... attempt $ATTEMPT/$MAX_ATTEMPTS (status: $JOB_STATUS)"
    fi
    sleep 5
done

if [ "$JOB_STATUS" != "COMPLETE" ]; then
    echo "  ❌ FAIL: MediaConvert job did not complete within $MAX_ATTEMPTS attempts"
    exit 1
fi

# ============================================================================
# Step 5: List exports/ and find output
# ============================================================================
echo "✓ Step 5: List exports/ and find output"

EXPORTS_LIST=$(aws s3api list-objects-v2 \
  --bucket $BUCKET \
  --prefix "jobs/${JOB_ID}/exports/" \
  --region $REGION)

FINAL_FILES=$(echo "$EXPORTS_LIST" | jq -r '.Contents[] | select(.Key | endswith("-final.mp4")) | .Key' | sort -r)

if [ -z "$FINAL_FILES" ]; then
    echo "  ❌ FAIL: No *-final.mp4 files found in exports/"
    echo "$EXPORTS_LIST" | jq '.Contents[].Key'
    exit 1
fi

LATEST_OUTPUT=$(echo "$FINAL_FILES" | head -1)
echo "  ✅ Found output: $LATEST_OUTPUT"
echo ""

# ============================================================================
# Step 6: Verify output file
# ============================================================================
echo "✓ Step 6: Verify output file"

OUTPUT_HEAD=$(aws s3api head-object \
  --bucket $BUCKET \
  --key "$LATEST_OUTPUT" \
  --region $REGION)

OUTPUT_SIZE=$(echo "$OUTPUT_HEAD" | jq -r '.ContentLength')
echo "  ✅ Output file size: $OUTPUT_SIZE bytes"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ I-3 Preflight PASSED"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Results:"
echo "  Generated video: $GENERATED_VIDEO (✅ exists)"
echo "  Narration: $NARRATION (✅ exists)"
echo "  MediaConvert job: $MEDIACONVERT_JOB_ID (✅ COMPLETE)"
echo "  Output file: s3://${BUCKET}/${LATEST_OUTPUT} (✅ $OUTPUT_SIZE bytes)"
echo ""
echo "Next step: Run Step Functions execution test-001-i3-final-proof"
echo ""
