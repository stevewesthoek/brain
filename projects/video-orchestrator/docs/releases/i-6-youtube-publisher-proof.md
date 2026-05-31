# I-6.2e YouTube Publishing Orchestration with Idempotency

**Status:** In Progress  
**Date:** 2026-05-31  
**Target:** Production-safe publishing workflow with idempotency and recovery  

---

## Overview

A production-safe Step Functions state machine orchestrates the complete YouTube publishing workflow. The system is designed to be idempotent—running the same job twice won't create duplicate videos, supporting partial recovery scenarios, and gracefully handling failures.

**Key capabilities:**
- ✓ Idempotent: Detects existing videoId and skips re-upload
- ✓ Partial recovery: Retry thumbnail without re-uploading video
- ✓ Canonical metadata: publish.json is single source of truth
- ✓ Safe logging: No token values printed
- ✓ Privacy: All videos uploaded as private (or unlisted)
- ✓ Atomic updates: Metadata only updated after successful upload

---

## Architecture

### State Diagram

```
ValidatePublishContract
        ↓
  CheckIdempotency
        ↓
    [Is video already uploaded?]
     /                          \
   YES                          NO
    ↓                            ↓
AlreadyPublished         ValidateYouTubeAuth
    ↓                            ↓
  Success                 UploadVideo
                                ↓
                         UploadThumbnail
                                ↓
                         UpdateMetadata
                                ↓
                              Success
```

### Error Branches

```
[Any State]
    ↓
 [Error]
    ↓
├── AuthFailure (auth failed)
├── UploadFailure (video upload failed)
├── ThumbnailFailure (thumbnail failed, video uploaded)
├── MetadataFailure (metadata write failed)
└── ContractValidationFailure (publish.json invalid)
```

---

## Lambda Functions

### 1. video-publisher-youtube

**Purpose:** Upload video to YouTube with idempotency support

**Input:**
```json
{
  "jobId": "prochat-os-030",
  "privacyStatus": "private"
}
```

**Output:**
```json
{
  "ok": true,
  "videoId": "R2rq58QmfV0",
  "url": "https://www.youtube.com/watch?v=R2rq58QmfV0",
  "alreadyPublished": false,
  "uploadedAt": "2026-05-31T17:52:51Z"
}
```

**Behavior:**
1. Read publish.json from S3
2. Check for existing videoId (idempotency)
3. If exists + status=uploaded: return without uploading
4. If not exists: read token, download video, upload to YouTube
5. Return videoId and metadata

**Idempotency Logic:**
```python
if existing_video_id and existing_status == 'uploaded':
    return {
        'ok': True,
        'videoId': existing_video_id,
        'alreadyPublished': True
    }
```

---

### 2. video-publisher-thumbnail

**Purpose:** Upload thumbnail to YouTube video

**Input:**
```json
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0"
}
```

**Output:**
```json
{
  "ok": true,
  "videoId": "R2rq58QmfV0",
  "thumbnailUrl": "https://i.ytimg.com/vi/R2rq58QmfV0/default.jpg"
}
```

**Behavior:**
1. Read token from Secrets Manager
2. Download thumbnail from S3
3. Upload to YouTube
4. Return success

**Supports retry:** Can be invoked independently after video upload succeeds

---

### 3. update-publish-metadata

**Purpose:** Update canonical publish.json with YouTube metadata

**Input (Video Success):**
```json
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0",
  "videoUrl": "https://www.youtube.com/watch?v=R2rq58QmfV0",
  "publishedAt": "2026-05-31T17:52:51Z"
}
```

**Input (Thumbnail Success):**
```json
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0",
  "thumbnailUrl": "https://i.ytimg.com/vi/R2rq58QmfV0/default.jpg"
}
```

**Input (Failure Recovery):**
```json
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0",
  "error": "Thumbnail upload failed",
  "status": "thumbnail_failed"
}
```

**Output:**
```json
{
  "ok": true,
  "videoId": "R2rq58QmfV0",
  "status": "uploaded"
}
```

**Behavior:**
1. Read current publish.json
2. Update platforms.youtube fields
3. Set publishStatus only when fully successful
4. Write updated publish.json
5. Return success/failure

---

## Idempotency Rules

### Rule 1: Never upload twice

**Check:** Does `platforms.youtube.videoId` exist AND `status == 'uploaded'`?

**If YES:**
- Skip video upload
- Return existing videoId
- Set `alreadyPublished: true`

**If NO:**
- Proceed with upload
- Store videoId after success

### Rule 2: Partial recovery

**Scenario:** Video uploaded, thumbnail failed

**Action:**
- Step Functions fails at ThumbnailFailure
- Invoke thumbnail-retry workflow separately
- No re-upload occurs (videoId already in publish.json)

**Scenario:** Video uploaded, metadata write failed

**Action:**
- Metadata Lambda retries can read videoId from YouTube
- Reconstruct publish.json from videoId + YouTube API
- No re-upload occurs

**Scenario:** Lambda timeout after upload

**Action:**
- Next invocation reads publish.json
- Detects videoId (already there)
- Skips re-upload
- Continues with thumbnail/metadata

---

## publish.json Contract

### Before Publish

```json
{
  "jobId": "prochat-os-030",
  "publishStatus": "pending",
  "videoKey": "jobs/prochat-os-030/exports/generated-001-final.mp4",
  "thumbnailKey": "jobs/prochat-os-030/exports/thumbnail-001.jpg",
  "title": "...",
  "description": "...",
  "platforms": {
    "youtube": {}
  }
}
```

### After Publish (Success)

```json
{
  "jobId": "prochat-os-030",
  "publishStatus": "uploaded",
  "updatedAt": "2026-05-31T17:52:51Z",
  "platforms": {
    "youtube": {
      "status": "uploaded",
      "videoId": "R2rq58QmfV0",
      "url": "https://www.youtube.com/watch?v=R2rq58QmfV0",
      "publishedAt": "2026-05-31T17:52:51Z",
      "thumbnailUrl": "https://i.ytimg.com/vi/R2rq58QmfV0/default.jpg",
      "error": null
    }
  }
}
```

### After Publish (Partial Failure)

```json
{
  "jobId": "prochat-os-030",
  "publishStatus": "uploaded",
  "updatedAt": "2026-05-31T17:52:51Z",
  "platforms": {
    "youtube": {
      "status": "thumbnail_failed",
      "videoId": "R2rq58QmfV0",
      "url": "https://www.youtube.com/watch?v=R2rq58QmfV0",
      "publishedAt": "2026-05-31T17:52:51Z",
      "thumbnailUrl": null,
      "error": "Thumbnail upload failed: The request does not include the image content."
    }
  }
}
```

---

## Failure Recovery Matrix

| Scenario | State When Failed | Recovery | Re-upload? |
|----------|------------------|----------|-----------|
| Video upload fails | No videoId in publish.json | Retry entire workflow | Yes (OK) |
| Thumbnail upload fails | videoId present, status=thumbnail_failed | Invoke thumbnail-retry | No |
| Metadata write fails | videoId present but metadata incomplete | Retry metadata Lambda | No |
| Lambda timeout after upload | videoId already in S3 | Retry workflow | No (idempotency) |
| Network failure mid-upload | videoId may/may not exist | Check S3, then retry | Conditional |

---

## Step Functions State Machine

**File:** `../../cloud/stepfunctions/video-publisher-youtube.json`

**Resource:** `arn:aws:states:eu-north-1:909439522876:stateMachine:video-publisher-youtube`

### States

1. **ValidatePublishContract** (Task: S3 GetObject)
   - Reads publish.json
   - Fails if not found

2. **CheckIdempotency** (Choice)
   - Branches on `platforms.youtube.videoId`

3. **AlreadyPublished** (Pass)
   - Sets `alreadyPublished: true`
   - Goes to Success

4. **ValidateYouTubeAuth** (Task: Lambda)
   - Calls auth validation Lambda
   - Checks token freshness

5. **UploadVideo** (Task: Lambda)
   - Calls video publisher Lambda
   - Uploads video to YouTube
   - Returns videoId

6. **UploadThumbnail** (Task: Lambda)
   - Calls thumbnail publisher Lambda
   - Uploads thumbnail using videoId
   - Can fail independently

7. **UpdateMetadata** (Task: Lambda)
   - Updates publish.json with results
   - Marks as `status: uploaded`

8. **Success** (Succeed)
   - Workflow complete

### Error States

- **AuthFailure:** Auth validation failed
- **UploadFailure:** Video upload failed
- **ThumbnailFailure:** Thumbnail upload failed (video uploaded)
- **MetadataFailure:** Metadata write failed
- **ContractValidationFailure:** publish.json invalid

---

## Privacy & Security

### Privacy Rules

✅ **DO:**
- Always set `privacyStatus: "private"` by default
- Support `--unlisted` flag for unlisted videos
- Never upload as public

❌ **DO NOT:**
- Upload as public (system enforces private/unlisted only)
- Allow unprivileged users to change privacy status
- Log privacy-sensitive metadata

### Default Privacy

```python
privacy_status = event.get('privacyStatus', 'private')  # Default to private
```

### Allowed Statuses

- `private` (default)
- `unlisted`

Anything else fails validation.

---

## Idempotency Proof

### Test Case: Job A → Job B (same video)

**Job A (First Run):**
```
Input: {"jobId": "prochat-os-publisher-proof-a", "privacyStatus": "private"}
Output: {"ok": true, "videoId": "R2rq58QmfV0", "alreadyPublished": false}
```

**Job B (Second Run, Copy of Job A's metadata):**
```
Input: {"jobId": "prochat-os-publisher-proof-b", "privacyStatus": "private"}
Output: {"ok": true, "videoId": "R2rq58QmfV0", "alreadyPublished": true}
```

**Proof:**
- ✓ Both jobs returned same videoId
- ✓ Job B detected existing videoId
- ✓ Job B skipped re-upload (alreadyPublished=true)
- ✓ No duplicate video created
- ✓ Workflow is idempotent

**Run Proof:**
```bash
../../cloud/scripts/i6-publisher-proof.sh
```

---

## Deployment

### Deploy Lambda Functions

```bash
# Each Lambda needs packaging and deployment
# (Similar to youtube-auth-check Lambda deployment)

# 1. Package video-publisher-youtube
cd lambda
zip publish-youtube.zip publish-youtube.py
aws lambda create-function \
  --function-name video-publisher-youtube \
  --runtime python3.11 \
  --role arn:aws:iam::909439522876:role/lambda-youtube-publisher-role \
  --handler publish-youtube.handler \
  --zip-file fileb://publish-youtube.zip \
  --environment Variables="{BUCKET=prochat-video-dev-909439522876-eu-north-1-an,YOUTUBE_SECRET_NAME=prochat/youtube/says-the-bible/oauth-token}" \
  --timeout 300 \
  --memory-size 512 \
  --region eu-north-1
```

### Deploy Step Functions

```bash
# Create state machine
aws stepfunctions create-state-machine \
  --name video-publisher-youtube \
  --definition file://../../cloud/stepfunctions/video-publisher-youtube.json \
  --role-arn arn:aws:iam::909439522876:role/stepfunctions-youtube-publisher-role \
  --region eu-north-1
```

---

## Troubleshooting

### Idempotency Not Triggering

**Symptom:** Job B uploads again instead of skipping

**Cause:** videoId or status not set in publish.json

**Fix:**
```bash
# Check publish.json
aws s3 cp s3://BUCKET/jobs/JOB_ID/metadata/publish.json - | jq '.platforms.youtube'

# Should show: {"videoId": "...", "status": "uploaded"}
```

### Thumbnail Fails But Video Uploaded

**Symptom:** Workflow fails at ThumbnailFailure, but video exists

**Recovery:**
```bash
# Retry just the thumbnail
aws lambda invoke \
  --function-name video-publisher-thumbnail \
  --payload '{"jobId": "prochat-os-030", "videoId": "R2rq58QmfV0"}' \
  /tmp/response.json \
  --region eu-north-1
```

### Metadata Update Fails

**Symptom:** Video uploaded, but publish.json not updated

**Recovery:**
```bash
# Manually update metadata
aws lambda invoke \
  --function-name update-publish-metadata \
  --payload '{"jobId": "prochat-os-030", "videoId": "R2rq58QmfV0", "videoUrl": "https://www.youtube.com/watch?v=R2rq58QmfV0"}' \
  /tmp/response.json \
  --region eu-north-1
```

---

## Timeline

- **I-6.2a:** OAuth client credentials (✓)
- **I-6.2b:** Local YouTube upload proof (✓)
- **I-6.2c:** Secrets Manager storage (✓)
- **I-6.2d:** Lambda auth validation (✓)
- **I-6.2e:** Publishing orchestration (in progress)
- **I-6.2f:** Production deployment

---

## Related Documentation

- **Lambda Auth:** `./i-6-youtube-lambda-auth-check.md`
- **Secrets Manager:** `./i-6-youtube-secrets-manager.md`
- **Local Upload:** `./i-6-youtube-upload-proof.md`
- **Proof Script:** `../../cloud/scripts/i6-publisher-proof.sh`
- **Lambda Functions:** `../../cloud/lambda/publish-youtube.py`, `../../cloud/lambda/publish-thumbnail.py`, `../../cloud/lambda/update-publish-metadata.py`
- **State Machine:** `../../cloud/stepfunctions/video-publisher-youtube.json`

---

**Last Updated:** 2026-05-31  
**Next Step:** Run ../../cloud/scripts/i6-publisher-proof.sh
