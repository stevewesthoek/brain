# I-2 MediaConvert Orchestration Implementation Guide

This document describes how to deploy the Step Functions and Lambda functions that automate MediaConvert final assembly after script approval.

## Overview

**Goal:** Extend Step Functions to automatically submit MediaConvert jobs after `approvals.json` indicates `script.status = "approved"`.

**Architecture:**
```
Step Functions State Machine
    ↓
Lambda: CheckApproval (verify approvals.json)
    ↓
Lambda: UpdateStatus (set status = "assembling")
    ↓
Lambda: TriggerMediaConvert (submit job)
    ↓
Lambda: WaitMediaConvert (poll until complete)
    ↓
Lambda: UpdateStatus (set status = "complete")
    ↓
Lambda: VerifyOutput (confirm file exists)
    ↓
Success
```

## Deployment Steps

### 1. Create IAM Role for Lambda

The Lambda functions need permissions to:
- Read/write S3 objects in the video dev bucket
- Create and query MediaConvert jobs

Attach this policy to the Lambda execution role:

```json
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
        "mediaconvert:DescribeEndpoints"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Deploy Lambda Functions

Create five Lambda functions with the provided Python code:

#### Function 1: `video-orchestrator-check-approval`
- **Runtime:** Python 3.11
- **Handler:** `lambda_check_approval.lambda_handler`
- **Timeout:** 30 seconds
- **Memory:** 256 MB
- **Code:** `lambda-check-approval.py`

#### Function 2: `video-orchestrator-update-status`
- **Runtime:** Python 3.11
- **Handler:** `lambda_update_status.lambda_handler`
- **Timeout:** 30 seconds
- **Memory:** 256 MB
- **Code:** `lambda-update-status.py`

#### Function 3: `video-orchestrator-mediaconvert`
- **Runtime:** Python 3.11
- **Handler:** `lambda_mediaconvert.lambda_handler`
- **Timeout:** 60 seconds
- **Memory:** 512 MB
- **Code:** `lambda-mediaconvert.py`
- **Environment variables:**
  - `MEDIACONVERT_ENDPOINT`: `https://abcdef1234567.mediaconvert.eu-north-1.amazonaws.com`

#### Function 4: `video-orchestrator-wait-mediaconvert`
- **Runtime:** Python 3.11
- **Handler:** `lambda_wait_mediaconvert.lambda_handler`
- **Timeout:** 600 seconds (10 minutes for typical jobs)
- **Memory:** 256 MB
- **Code:** `lambda-wait-mediaconvert.py`

#### Function 5: `video-orchestrator-verify-output`
- **Runtime:** Python 3.11
- **Handler:** `lambda_verify_output.lambda_handler`
- **Timeout:** 30 seconds
- **Memory:** 256 MB
- **Code:** `lambda-verify-output.py`

### 3. Create Step Functions State Machine

Use the AWS Console or CLI to create a new state machine:

```bash
aws stepfunctions create-state-machine \
  --name video-orchestrator-i2-assembly \
  --definition file://step-functions-state-machine.json \
  --role-arn arn:aws:iam::909439522876:role/step-functions-execution-role
```

Update the JSON with the correct Lambda ARNs for your account:
- Replace `arn:aws:lambda:eu-north-1:909439522876:function:video-orchestrator-check-approval` with actual ARN

### 4. Update Existing Step Functions

If you have an existing Step Functions state machine:

1. Get current state machine definition:
```bash
aws stepfunctions describe-state-machine \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:video-orchestrator \
  --query 'definition' > current-state-machine.json
```

2. Add the I-2 states to the definition (after script approval):
   - CheckApprovalState
   - ApprovalDecision
   - UpdateStatusAssembling
   - TriggerMediaConvertJob
   - WaitForMediaConvertCompletion
   - MediaConvertCompleted
   - VerifyOutput

3. Update the state machine:
```bash
aws stepfunctions update-state-machine \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:video-orchestrator \
  --definition file://updated-state-machine.json
```

## Testing the Implementation

### Manual Test Flow

1. **Approve the script:**
```bash
# Update metadata/approvals.json with approval
aws s3 cp metadata/approvals.json \
  s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/approvals.json
```

Content should be:
```json
{
  "jobId": "test-001",
  "approvals": {
    "script": {
      "status": "approved",
      "approvedBy": "manual-test",
      "approvedAt": "2026-05-30T12:00:00Z",
      "notes": "Manual test approval"
    }
  }
}
```

2. **Trigger Step Functions execution:**
```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:video-orchestrator-i2-assembly \
  --input '{"jobId":"test-001"}'
```

3. **Monitor execution:**
```bash
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:eu-north-1:909439522876:execution:video-orchestrator-i2-assembly:execution-id
```

4. **Verify output:**
```bash
# Check status.json
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/metadata/status.json -

# Check final output exists
aws s3 ls s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4

# Verify MP4 properties
aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4 test-001-final.mp4
ffprobe test-001-final.mp4
```

## Validation Criteria

✅ Step Functions executes without errors
✅ metadata/status.json transitions: pending → awaiting_script_approval → assembling → complete
✅ MediaConvert job is created with correct inputs (sample-transcoded.mp4 + narration.mp3)
✅ test-001-final.mp4 is created and uploaded to S3
✅ Output MP4 duration matches I-1 validation (64.033333 seconds ± 0.1 seconds)
✅ Output MP4 is playable (H.264 + AAC)

## Troubleshooting

### MediaConvert Job Fails

**Error:** `ABORTING_DUE_TO_CONFLICTING_OUTPUTS`

**Cause:** MediaConvert job template has conflicting settings

**Solution:** Verify inputs and output settings match the template

### S3 Access Denied

**Cause:** Lambda execution role doesn't have S3 permissions

**Solution:** Attach the IAM policy from step 1

### Lambda Timeout

**Cause:** MediaConvert job takes too long

**Solution:** Increase Lambda timeout (max 15 minutes) or reduce polling interval

### Approval Check Fails

**Cause:** approvals.json doesn't have correct format

**Solution:** Verify approvals.json structure:
```json
{
  "jobId": "test-001",
  "approvals": {
    "script": {
      "status": "approved"
    }
  }
}
```

## File Structure

```
./
├── step-functions-state-machine.json    # State machine definition
├── lambda-check-approval.py              # Check approval status
├── lambda-update-status.py               # Update metadata/status.json
├── lambda-mediaconvert.py                # Submit MediaConvert job
├── lambda-wait-mediaconvert.py           # Poll job completion
├── lambda-verify-output.py               # Verify output file
└── IMPLEMENTATION_GUIDE.md               # This file
```

## Next Steps

After successful I-2 implementation:

1. Mark I-2 as complete in roadmap
2. Validate with one end-to-end execution
3. Document execution proof
4. Proceed to I-3 (Replace placeholder with generated clips)
