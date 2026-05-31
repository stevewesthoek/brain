# I-2 Execution Proof Template

After deploying the I-2 infrastructure (Step Functions + Lambda functions), use this template to document successful end-to-end execution.

## Pre-Deployment Validation

- [ ] All Lambda functions deployed to AWS
- [ ] Step Functions state machine created
- [ ] IAM role grants S3 access
- [ ] IAM role grants MediaConvert access
- [ ] MediaConvert endpoint URL configured in Lambda environment
- [ ] S3 paths verified (bucket name, job ID paths)

## Execution Test

### Step 1: Prepare Approval

```bash
# Create or update metadata/approvals.json with approved status
cat > approvals.json << 'EOF'
{
  "jobId": "test-001",
  "approvals": {
    "script": {
      "status": "approved",
      "approvedBy": "system-test",
      "approvedAt": "2026-05-30T12:00:00Z",
      "notes": "I-2 implementation test"
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
aws s3 cp approvals.json \
  s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/approvals.json

# Verify
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/approvals.json - | jq '.approvals.script.status'
```

**Result:** `approved` ✅

### Step 2: Trigger Step Functions Execution

```bash
# Start execution
EXECUTION_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:video-orchestrator-i2-assembly \
  --name execution-$(date +%s) \
  --input '{"jobId":"test-001"}' \
  --query 'executionArn' \
  --output text)

echo "Execution started: $EXECUTION_ARN"
```

**Expected output:** `arn:aws:states:eu-north-1:909439522876:execution:video-orchestrator-i2-assembly:execution-XXXXXXXXX` ✅

### Step 3: Monitor Execution

```bash
# Check execution status (run multiple times)
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --query 'status' \
  --output text
```

**Expected transitions:**
- `RUNNING` (initial) ✅
- `SUCCEEDED` (final) ✅

### Step 4: Verify Workflow States

```bash
# Get execution history
aws stepfunctions get-execution-history \
  --execution-arn $EXECUTION_ARN \
  --query 'events[].{Type:type,State:stateEnteredEventDetails.name}'
```

**Expected states in order:**
```
CheckApprovalState ✅
ApprovalDecision ✅
UpdateStatusAssembling ✅
TriggerMediaConvertJob ✅
WaitForMediaConvertCompletion ✅
MediaConvertCompleted ✅
VerifyOutput ✅
AssemblySuccess ✅
```

### Step 5: Verify Status Transition

```bash
# Check status.json after execution
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/status.json - | jq '.'
```

**Expected status.json:**
```json
{
  "jobId": "test-001",
  "status": "complete",
  "updatedAt": "2026-05-30T12:XX:XXZ",
  "assemblyStartedAt": "2026-05-30T12:XX:XXZ",
  "assemblyCompletedAt": "2026-05-30T12:XX:XXZ",
  "mediaConvertJobId": "1234567890abcdef1234567890abcdef"
}
```

**Verification:**
- `status` == `"complete"` ✅
- `assemblyStartedAt` exists ✅
- `assemblyCompletedAt` exists ✅
- `mediaConvertJobId` populated ✅

### Step 6: Verify Output File

```bash
# Check file exists
aws s3 ls s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4

# Check file properties
aws s3api head-object \
  --bucket prochat-video-dev-909439522876-eu-north-1-an \
  --key jobs/test-001/exports/test-001-final.mp4 \
  --query '{Size:ContentLength,LastModified:LastModified,ContentType:ContentType}'

# Download and validate
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4 test-001-final.mp4
ffprobe test-001-final.mp4
```

**Expected ffprobe output:**
```
Duration: 00:01:04.033333 (matches I-1: 64.033333 seconds)
Video codec: h264
Audio codec: aac
Channels: 2 (stereo)
Sample rate: 48000 Hz
Bitrate: ~5000 kbps (video) + 128 kbps (audio)
```

**File size:**
- Approximately 20-30 MB for 64-second video at 5Mbps ✅

**Playability:**
- ffprobe reports no errors ✅
- Can play in media player ✅
- Audio and video synchronized ✅

## Execution Proof Checklist

- [ ] Approval state verified as "approved"
- [ ] Step Functions execution started successfully
- [ ] Execution status transitioned to SUCCEEDED
- [ ] All 8 workflow states executed in correct order
- [ ] status.json updated to "complete" with all metadata
- [ ] mediaConvertJobId recorded in status.json
- [ ] test-001-final.mp4 exists in S3
- [ ] Output file duration: 64.033333 ± 0.1 seconds
- [ ] Output file has H.264 + AAC codecs
- [ ] Output file is playable without errors
- [ ] Audio and video are synchronized

## Success Criteria Met

✅ **I-2 Bridge Operational**
- Step Functions automatically submits MediaConvert after approval
- No manual intervention required beyond initial approval

✅ **Metadata Contract Honored**
- status.json transitions: pending → assembling → complete
- All timestamps recorded
- MediaConvert job ID tracked

✅ **Output Matches I-1 Validation**
- Duration within tolerance (64.033333 ± 0.1 seconds)
- Same codec settings (H.264 + AAC)
- Playable and synchronized

✅ **Production Path Established**
- AWS handles all execution (MediaConvert)
- Step Functions orchestrates workflow
- ProChat OS owns approval decisions
- Boundary maintained: ProChat OS ↔ AWS

## Next Steps

1. **Ready for I-3:** Replace placeholder with generated clips
   - Move from sample-transcoded.mp4 to Bedrock Nova Reel output
   - Integrate Nova Reel step into Step Functions workflow
   
2. **Document execution:** Commit this filled-out proof as evidence

3. **Baseline established:** I-2 is the production foundation for all future phases

## Troubleshooting Notes

If execution fails:

1. **ApprovalCheckFailed:** Verify approvals.json format and S3 path
2. **StatusUpdateFailed:** Check Lambda has S3 write permissions
3. **MediaConvertJobFailed:** Verify MediaConvert endpoint URL in Lambda environment
4. **MediaConvertWaitFailed:** Check MediaConvert job succeeded in AWS console
5. **OutputVerificationFailed:** Verify S3 bucket and key path

For detailed troubleshooting, see IMPLEMENTATION_GUIDE.md
