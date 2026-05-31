# Phase 5 Release Checklist

**For:** New engineer validating Phase 5 infrastructure  
**Time:** ~30 minutes  
**Prerequisites:** AWS CLI configured, `jq` installed, basic git knowledge

---

## Part A: Infrastructure Verification (10 minutes)

### A.1 Verify State Machine Exists

```bash
# Expected: Should list prochat-video-skeleton-dev
aws stepfunctions list-state-machines \
  --region eu-north-1 \
  --query 'stateMachines[?name==`prochat-video-skeleton-dev`].{name:name, arn:stateMachineArn}'

# Verify state count
aws stepfunctions describe-state-machine \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev \
  --region eu-north-1 \
  --query 'definition' | jq '.States | keys | length'

# Expected: 15 states
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### A.2 Verify I-3 Lambda Functions (Video Assembly)

```bash
# List all video-orchestrator functions
aws lambda list-functions \
  --region eu-north-1 \
  --query 'Functions[?contains(FunctionName, `video-orchestrator`)].FunctionName'

# Expected functions:
# - video-orchestrator-check-approval
# - video-orchestrator-update-status
# - video-orchestrator-mediaconvert
# - video-orchestrator-wait-mediaconvert
# - video-orchestrator-verify-output
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### A.3 Verify I-4.2 Lambda Functions (Thumbnail)

```bash
# List all i4-frame-capture functions
aws lambda list-functions \
  --region eu-north-1 \
  --query 'Functions[?contains(FunctionName, `i4-frame-capture`)].FunctionName'

# Expected functions:
# - i4-frame-capture-thumbnail-mediaconvert
# - i4-frame-capture-wait-thumbnail-mediaconvert
# - i4-frame-capture-select-thumbnail
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### A.4 Verify IAM Roles

```bash
# Check I-4.2 Lambda role
aws iam get-role \
  --role-name prochat-i4-thumbnail-lambda \
  --query 'Role.Arn'

# Expected: arn:aws:iam::909439522876:role/prochat-i4-thumbnail-lambda

# Check role has correct permissions
aws iam get-role-policy \
  --role-name prochat-i4-thumbnail-lambda \
  --policy-name i4-thumbnail-inline-policy \
  --query 'RolePolicyDocument.Statement[0].Action' | jq '.[]'

# Expected: s3:GetObject, s3:PutObject, s3:ListBucket, mediaconvert:CreateJob, etc.
```

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Part B: S3 Artifact Verification (8 minutes)

### B.1 Verify Bucket and Job Folder

```bash
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

# List job folder structure
aws s3 ls s3://$BUCKET/jobs/test-001/ --region eu-north-1 --recursive

# Expected folders:
# - jobs/test-001/metadata/
# - jobs/test-001/exports/
# - jobs/test-001/video-generated/
# - jobs/test-001/audio/
# - jobs/test-001/captions/
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### B.2 Verify Metadata Files

```bash
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

# Check status.json exists and is valid JSON
aws s3 cp s3://$BUCKET/jobs/test-001/metadata/status.json - --region eu-north-1 | jq '.' > /dev/null && echo "✓ status.json valid" || echo "✗ status.json invalid"

# Check assets.json exists and is valid JSON
aws s3 cp s3://$BUCKET/jobs/test-001/metadata/assets.json - --region eu-north-1 | jq '.' > /dev/null && echo "✓ assets.json valid" || echo "✗ assets.json invalid"

# Check approvals.json exists
aws s3api head-object \
  --bucket $BUCKET \
  --key jobs/test-001/metadata/approvals.json \
  --region eu-north-1 2>/dev/null && echo "✓ approvals.json exists" || echo "✗ approvals.json missing"
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### B.3 Verify Video Assets

```bash
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

# Check final video exists
aws s3api head-object \
  --bucket $BUCKET \
  --key jobs/test-001/exports/generated-001-final.mp4 \
  --region eu-north-1 \
  --query 'ContentLength'

# Expected: 468538 bytes (or similar size)

# Check thumbnail exists
aws s3api head-object \
  --bucket $BUCKET \
  --key jobs/test-001/exports/thumbnail-001.jpg \
  --region eu-north-1 \
  --query 'ContentLength'

# Expected: 37960 bytes (or similar size)
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### B.4 Verify Generated Frames

```bash
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

# List frame captures
aws s3 ls s3://$BUCKET/jobs/test-001/exports/ --region eu-north-1 | grep "frame.000"

# Expected: 4 files
# - test-001-final-frame.0000000.jpg
# - test-001-final-frame.0000001.jpg
# - test-001-final-frame.0000002.jpg (selected for thumbnail)
# - test-001-final-frame.0000003.jpg
```

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Part C: Metadata Content Verification (6 minutes)

### C.1 Verify status.json Structure

```bash
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

aws s3 cp s3://$BUCKET/jobs/test-001/metadata/status.json - --region eu-north-1 | jq '.'

# Verify required fields:
# - jobId: "test-001"
# - status: "complete"
# - currentStep: "thumbnail_generated"
# - completedSteps: array with 7 items
# - assemblyCompletedAt: timestamp
# - thumbnailCompletedAt: timestamp
# - mediaConvertJobId: string (assembly job)
# - thumbnailMediaConvertJobId: string (thumbnail job)
```

**Checklist:**
- [ ] currentStep == "thumbnail_generated"
- [ ] completedSteps.length == 7
- [ ] status == "complete"
- [ ] assemblyCompletedAt is not null
- [ ] thumbnailCompletedAt is not null

**Pass/Fail:** ☐ PASS ☐ FAIL

### C.2 Verify assets.json Structure

```bash
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

aws s3 cp s3://$BUCKET/jobs/test-001/metadata/assets.json - --region eu-north-1 | jq '.assets | keys'

# Expected: ["final-video", "generated-clip", "narration", "thumbnail", "transcript"]

# Verify thumbnail asset details
aws s3 cp s3://$BUCKET/jobs/test-001/metadata/assets.json - --region eu-north-1 | jq '.assets.thumbnail'

# Expected fields:
# - path: "jobs/test-001/exports/thumbnail-001.jpg"
# - type: "thumbnail-preview"
# - extractedAt: 3
# - frameIndex: 2
# - size: 37960
# - status: "available"
```

**Checklist:**
- [ ] thumbnail.path points to exports/thumbnail-001.jpg
- [ ] thumbnail.extractedAt == 3 (3-second mark)
- [ ] thumbnail.frameIndex == 2
- [ ] thumbnail.status == "available"
- [ ] final-video.size > 400000 (at least 400KB)

**Pass/Fail:** ☐ PASS ☐ FAIL

### C.3 Verify Dynamic Job Metadata (New in I-5 Cleanup)

```bash
# Test with a recent dynamic job (prochat-os-010 or prochat-os-011)
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
JOB_ID="prochat-os-010"

# Check status.json for dynamic job
aws s3 cp s3://$BUCKET/jobs/$JOB_ID/metadata/status.json - --region eu-north-1 | jq '.'

# Verify dynamic job metadata
# - jobId matches input ($JOB_ID)
# - status == "complete"
# - currentStep == "thumbnail_generated"
# - completedSteps has 6+ items
# - finalVideoKey contains "prochat-os-010"
# - thumbnailKey contains "prochat-os-010"

# Check assets.json for dynamic job
aws s3 cp s3://$BUCKET/jobs/$JOB_ID/metadata/assets.json - --region eu-north-1 | jq '.assets | keys'

# Verify asset paths reference dynamic jobId, not test-001
aws s3 cp s3://$BUCKET/jobs/$JOB_ID/metadata/assets.json - --region eu-north-1 | jq '.assets[] | select(.path | contains("test-001"))'

# Expected: Empty (no test-001 references for dynamic jobs)
```

**Checklist:**
- [ ] status.json currentStep == "thumbnail_generated"
- [ ] status.json completedSteps has 6+ items
- [ ] status.json finalVideoKey references correct jobId (not test-001)
- [ ] status.json thumbnailKey references correct jobId (not test-001)
- [ ] assets.json has 4+ assets
- [ ] All asset paths start with `jobs/{jobId}/`, never test-001
- [ ] finalVideo asset exists in S3
- [ ] thumbnail asset exists in S3

**Pass/Fail:** ☐ PASS ☐ FAIL

### C.4 Verify Concurrent Job Execution (Bonus Proof)

```bash
# This test validates that multiple jobs can run concurrently without contamination
# (Only run this test if interested in concurrency validation beyond basic functionality)

BUCKET="prochat-video-dev-909439522876-eu-north-1-an"

# Check concurrent job metadata (prochat-os-020, prochat-os-021)
for JOB_ID in prochat-os-020 prochat-os-021; do
  echo "Checking $JOB_ID..."
  
  # Verify status.json has correct jobId
  aws s3 cp s3://$BUCKET/jobs/$JOB_ID/metadata/status.json - --region eu-north-1 | jq ".jobId"
  
  # Verify no cross-job contamination
  aws s3 cp s3://$BUCKET/jobs/$JOB_ID/metadata/assets.json - --region eu-north-1 | jq '.assets[] | .path' | grep -i "test-001" && echo "FAIL: Found test-001 ref" || echo "PASS: No test-001 refs"
done
```

**Checklist:**
- [ ] prochat-os-020 jobId correctly set in status.json
- [ ] prochat-os-021 jobId correctly set in status.json
- [ ] No cross-job file path collisions detected
- [ ] Each job has independent metadata files
- [ ] Each job has separate S3 folders (no shared assets)
- [ ] test-001 fixture remains unchanged

**Pass/Fail:** ☐ PASS ☐ FAIL (optional, bonus test)

---

## Part D: Step Functions Execution Test (4 minutes)

### D.1 Find Latest Successful Execution

```bash
# List recent executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev \
  --status-filter SUCCEEDED \
  --region eu-north-1 \
  --query 'executions[0:3].[name, status, stopDate]'

# Expected: At least one SUCCEEDED execution (likely: i4-thumbnail-proof-exports-*)
```

**Pass/Fail:** ☐ PASS ☐ FAIL

### D.2 Verify Execution Output

```bash
# Use the latest execution ARN (example):
EXEC_ARN="arn:aws:states:eu-north-1:909439522876:execution:prochat-video-skeleton-dev:i4-thumbnail-proof-exports-1780241084"

# Check execution status
aws stepfunctions describe-execution \
  --execution-arn $EXEC_ARN \
  --region eu-north-1 \
  --query '[status, startDate, stopDate]'

# Expected status: SUCCEEDED

# Check execution history (last 5 events)
aws stepfunctions get-execution-history \
  --execution-arn $EXEC_ARN \
  --region eu-north-1 \
  --query 'events[-5:].type'

# Expected: Task, TaskSucceeded, StateExited, etc. (no failed states)
```

**Checklist:**
- [ ] Execution status == SUCCEEDED
- [ ] No TaskFailed or LambdaFunctionFailed events
- [ ] Duration < 60 seconds

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Part E: Lambda Function Test (2 minutes)

### E.1 Test Thumbnail Lambda Directly

```bash
# Create test payload
cat > /tmp/lambda-test.json << 'EOF'
{
  "jobId": "test-001",
  "videoKey": "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4",
  "bucket": "prochat-video-dev-909439522876-eu-north-1-an",
  "roleArn": "arn:aws:iam::909439522876:role/service-role/MediaConvert_Default_Role"
}
EOF

# Invoke Lambda directly
aws lambda invoke \
  --function-name i4-frame-capture-thumbnail-mediaconvert \
  --payload "$(cat /tmp/lambda-test.json | base64 -w 0)" \
  --region eu-north-1 \
  /tmp/lambda-response.json

# Check response (should not have FunctionError field)
cat /tmp/lambda-response.json | jq '.FunctionError'

# Expected: null or field absent
```

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Part F: Documentation Verification (Not tested, informational)

### F.1 Verify Release Documents Exist

```bash
# Check main release checkpoint
[ -f ./phase-5-complete.md ] && echo "✓ phase-5-complete.md exists" || echo "✗ missing"

# Check this checklist
[ -f ./phase-5-checklist.md ] && echo "✓ phase-5-checklist.md exists" || echo "✗ missing"

# Check infrastructure proof documents
[ -f ../../cloud/infrastructure/i-4-thumbnail-generation/EXECUTION_PROOF.md ] && echo "✓ EXECUTION_PROOF.md exists" || echo "✗ missing"

# Check preflight script
[ -f ../../cloud/scripts/i4-frame-capture-preflight.sh ] && echo "✓ i4-frame-capture-preflight.sh exists" || echo "✗ missing"
```

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Summary

### Scoring

Count your passes:
- **A.1 to A.4** (4 tests): _____ / 4 pass
- **B.1 to B.4** (4 tests): _____ / 4 pass
- **C.1 to C.2** (2 tests): _____ / 2 pass
- **D.1 to D.2** (2 tests): _____ / 2 pass
- **E.1** (1 test): _____ / 1 pass
- **F.1** (1 test): _____ / 1 pass

**Total:** _____ / 14 pass

### Result

- **14/14 pass:** ✅ Phase 5 is PRODUCTION READY
- **12-13/14 pass:** ⚠️ One issue found (see below) but generally ready
- **< 12/14 pass:** ❌ Stop and review failures before proceeding

### If Any Test Failed

1. Note the failed test number (e.g., "B.2 failed")
2. Re-run that specific test to confirm
3. Check the error message carefully
4. Reference the troubleshooting guide: `./phase-5-complete.md` (Section 11-12)
5. Contact the team if the issue persists

### Next Steps After Passing

✅ Phase 5 is verified working  
✅ Ready to proceed with I-5 (Real Content Generation)  
✅ Baseline infrastructure is stable  
✅ Rollback and recovery procedures are documented

---

## Quick Reference Commands

```bash
# These are the commands you'll use most often:

# View current job status
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
aws s3 cp s3://$BUCKET/jobs/test-001/metadata/status.json - --region eu-north-1 | jq '.currentStep, .status'

# Check latest execution
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev \
  --status-filter SUCCEEDED \
  --region eu-north-1 \
  --max-items 1 \
  --query 'executions[0]'

# Manually trigger next execution (for testing)
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev \
  --name "manual-test-$(date +%s)" \
  --input '{"jobId":"test-001","videoKey":"s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/exports/test-001-final.mp4","bucket":"prochat-video-dev-909439522876-eu-north-1-an","approved":true}' \
  --region eu-north-1

# Check thumbnail file
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
aws s3api head-object --bucket $BUCKET --key jobs/test-001/exports/thumbnail-001.jpg --region eu-north-1 | jq '.ContentLength, .ContentType, .LastModified'
```

---

**Completed by:** _____________________ (name)  
**Date:** _____________________ (YYYY-MM-DD)  
**Result:** ☐ PASS ☐ FAIL

If PASS, initial Phase 5 verification is complete. Infrastructure is ready for I-5.
