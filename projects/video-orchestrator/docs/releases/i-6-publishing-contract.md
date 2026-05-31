# I-6 Publishing Contract — Proof

**Date:** 2026-05-31  
**Phase:** I-6 Publishing Orchestration (I-6.1)  
**Status:** ✅ COMPLETE AND VERIFIED

---

## Objective

Implement the publishing contract that separates the generation pipeline from the publishing pipeline. Generation produces artifacts; publishing consumes metadata.

---

## Architecture Overview

```
Generation Pipeline
    ├─ Generates video
    ├─ Generates thumbnail
    ├─ Generates metadata (status.json, assets.json)
    └─ Creates publish.json (empty contract)
         ↓
Publishing Pipeline
    ├─ Reads publish.json
    ├─ Reads video and thumbnail from assets.json
    ├─ Executes platform-specific publishing (simulator for now)
    ├─ Creates published.json record
    └─ Updates publish.json with publishStatus=published
```

### Key Separation

**Generation Code:** Does NOT know about publishing platforms  
**Publishing Code:** Reads metadata, does NOT read generation code  
**Contract:** publish.json bridges the two pipelines

---

## Publishing Contract Schema

### publish.json

**Location:** `jobs/{jobId}/metadata/publish.json`

**Example:**
```json
{
  "jobId": "prochat-os-030",
  "publishStatus": "pending",
  "createdAt": "2026-05-31T16:29:00Z",
  "updatedAt": "2026-05-31T16:29:33Z",
  "publishedAt": "2026-05-31T16:29:33Z",
  "title": "",
  "description": "",
  "tags": [],
  "videoKey": "jobs/prochat-os-030/exports/generated-001-final.mp4",
  "thumbnailKey": "jobs/prochat-os-030/exports/thumbnail-001.jpg",
  "platforms": {
    "youtube": {
      "status": "pending",
      "videoId": null,
      "publishedAt": null,
      "url": null,
      "error": null
    }
  }
}
```

**Contract Guarantees:**
- ✅ jobId matches job folder
- ✅ videoKey points to valid S3 object
- ✅ thumbnailKey points to valid S3 object
- ✅ publishStatus is actionable (pending, published, failed)
- ✅ platforms schema supports future integrations (YouTube, TikTok, etc.)

### published.json

**Location:** `jobs/{jobId}/metadata/published.json`

**Purpose:** Audit record of publishing execution

**Example:**
```json
{
  "jobId": "prochat-os-030",
  "status": "published",
  "platform": "simulator",
  "publishedAt": "2026-05-31T16:29:33Z",
  "videoKey": "jobs/prochat-os-030/exports/generated-001-final.mp4",
  "thumbnailKey": "jobs/prochat-os-030/exports/thumbnail-001.jpg",
  "videoSize": 468848,
  "thumbnailSize": 37960
}
```

---

## Implementation: Lambda Functions

### 1. i6-create-publish-contract

**Purpose:** Bridge generation pipeline to publishing pipeline

**Input:**
```json
{
  "jobId": "prochat-os-030"
}
```

**Behavior:**
1. Read metadata/status.json
2. Validate status == "complete"
3. Read metadata/assets.json
4. Validate finalVideo and thumbnail exist
5. Verify assets exist in S3
6. Create publish.json with video/thumbnail references
7. Write to metadata/publish.json

**Output:**
```json
{
  "jobId": "prochat-os-030",
  "publishContractCreated": true,
  "videoKey": "jobs/prochat-os-030/exports/generated-001-final.mp4",
  "thumbnailKey": "jobs/prochat-os-030/exports/thumbnail-001.jpg",
  "publishStatus": "pending"
}
```

### 2. i6-publish-simulator

**Purpose:** Proof-of-concept publishing layer (no external APIs)

**Input:**
```json
{
  "jobId": "prochat-os-030"
}
```

**Behavior:**
1. Read publish.json
2. Verify video exists in S3
3. Verify thumbnail exists in S3
4. Create published.json audit record
5. Update publish.json: publishStatus = published
6. Return success

**Output:**
```json
{
  "jobId": "prochat-os-030",
  "publishStatus": "published",
  "platform": "simulator",
  "publishedAt": "2026-05-31T16:29:33Z",
  "videoSize": 468848,
  "thumbnailSize": 37960
}
```

---

## Step Functions Integration

**New State:** CreatePublishContract

**Position:** After SelectThumbnailFrame (thumbnail generation complete)

**Flow:**
```
SelectThumbnailFrame
    ↓
CreatePublishContract ← New state
    ↓
AssemblySuccess
```

**State Definition:**
```json
{
  "Type": "Task",
  "Resource": "arn:aws:lambda:eu-north-1:909439522876:function:i6-create-publish-contract",
  "TimeoutSeconds": 60,
  "Parameters": {
    "jobId.$": "$.jobId"
  },
  "ResultPath": "$.publishContract",
  "Next": "AssemblySuccess",
  "Catch": [{
    "ErrorEquals": ["States.ALL"],
    "Next": "PublishContractCreationFailed"
  }]
}
```

---

## Proof Executions

### Execution 1: prochat-os-030

**Status:** ✅ SUCCESS

**Workflow:**
1. ✅ Job created: prochat-os-030
2. ✅ Generation workflow: completed
3. ✅ Metadata written: status.json, assets.json (5 assets)
4. ✅ Publish contract created: publish.json with videoKey, thumbnailKey
5. ✅ Publishing simulator: executed
6. ✅ Published record: published.json created
7. ✅ Status updated: publish.json → publishStatus=published

**Verification:**
```
✓ publish.json: publishStatus=pending → published
✓ published.json: status=published
✓ Video: 468,848 bytes (verified in S3)
✓ Thumbnail: 37,960 bytes (verified in S3)
```

### Execution 2: prochat-os-031

**Status:** ✅ SUCCESS

**Workflow:**
1. ✅ Job created: prochat-os-031
2. ✅ Generation workflow: completed
3. ✅ Metadata written: status.json, assets.json (5 assets)
4. ✅ Publish contract created: publish.json with videoKey, thumbnailKey
5. ✅ Publishing simulator: executed
6. ✅ Published record: published.json created
7. ✅ Status updated: publish.json → publishStatus=published

**Verification:**
```
✓ publish.json: publishStatus=pending → published
✓ published.json: status=published
✓ Video: verified in S3
✓ Thumbnail: verified in S3
```

---

## Publishing Lifecycle

### State Transitions

```
Job Created
    ↓
Generation Complete
    ↓
Metadata Written (status.json, assets.json)
    ↓
Publish Contract Created (publish.json: publishStatus=pending)
    ↓
Publishing Simulator Executed
    ↓
Published (publish.json: publishStatus=published, published.json created)
```

### Per-Job Files

**After Generation:**
- ✅ `metadata/status.json` (complete)
- ✅ `metadata/assets.json` (5 assets)

**After Contract Creation:**
- ✅ `metadata/publish.json` (publishStatus=pending)

**After Publishing:**
- ✅ `metadata/published.json` (audit record)
- ✅ `metadata/publish.json` (publishStatus=published)

---

## Future Integration Points

### YouTube Publishing (I-6.2+)

When YouTube integration is implemented:

1. New Lambda: `i6-publish-youtube`
2. Reads `publish.json`
3. Uses OAuth credentials (from secure storage, not in this contract)
4. Uploads video and thumbnail to YouTube
5. Sets `platforms.youtube.videoId`, `.url`, `.publishedAt`
6. Updates `publish.json`

**Contract remains:** publish.json is the single source of truth for publishing state

### Additional Platforms (I-6.3+)

```json
{
  "platforms": {
    "youtube": {...},
    "tiktok": {
      "status": "pending",
      "videoId": null,
      "error": null
    },
    "instagram": {
      "status": "pending",
      "videoId": null,
      "error": null
    }
  }
}
```

---

## Success Criteria — All Met ✅

- [x] publish.json schema defined and documented
- [x] publish.json created automatically after generation
- [x] videoKey and thumbnailKey extracted from assets.json
- [x] S3 verification: video and thumbnail exist before publishing
- [x] published.json created as audit record
- [x] publishStatus transitions: pending → published
- [x] prochat-os-030 workflow succeeded
- [x] prochat-os-031 workflow succeeded
- [x] Generation code does NOT depend on publishing code
- [x] Publishing code reads ONLY metadata, not generation artifacts
- [x] No external APIs (simulator only)
- [x] No OAuth, no YouTube integration yet

---

## Contract Guarantees

### What Publishing Can Assume

1. ✅ If `publish.json` exists, generation is complete
2. ✅ If `publishStatus == pending`, job is ready for publishing
3. ✅ videoKey always points to valid S3 object
4. ✅ thumbnailKey always points to valid S3 object
5. ✅ Assets have been verified to exist before publish.json creation
6. ✅ No generation process touches publish.json

### What Publishing Must Guarantee

1. ✅ Never modify videoKey or thumbnailKey
2. ✅ Only update publishStatus and publishedAt
3. ✅ Create published.json audit record
4. ✅ Handle errors gracefully (set platforms.*.error)
5. ✅ Never read generation artifacts directly (use metadata only)

---

## Known Limitations (By Design)

1. **No YouTube Integration Yet:** Simulator publishes to metadata only
2. **No OAuth:** Publishing contract defers auth to platform-specific Lambda
3. **No Retry Logic:** First version publishes once; retries deferred to I-6.2
4. **No Multi-Platform:** Simulator publishes to one platform at a time
5. **No Scheduling:** Publishes immediately after generation; scheduling deferred

---

## Files Deployed

| File | Status | Purpose |
|------|--------|---------|
| lambda-create-publish-contract.py | ✅ Deployed | Generates publish.json |
| lambda-publish-simulator.py | ✅ Deployed | Proof-of-concept publishing |
| step-functions-state-machine.json | ✅ Updated | Added CreatePublishContract state |
| i6-publish-proof.sh | ✅ Created | End-to-end proof workflow |

---

## Next Steps (I-6.2+)

### Immediate Opportunities

1. **YouTube Publishing:** Implement OAuth + YouTube API integration
2. **Retry Logic:** Add exponential backoff for failed publishes
3. **Multi-Platform:** Extend simulator to handle multiple platforms
4. **Scheduling:** Add publish-at-time field to publish.json

### Medium-term (I-7+)

1. **Analytics Integration:** Track publishing performance
2. **ProChat Console UI:** Display publish status in console
3. **Webhook Publishing:** Trigger publishing from external systems
4. **Social Media Cross-posting:** TikTok, Instagram, Twitter

---

## Conclusion

✅ **I-6.1 Publishing Contract: COMPLETE**

**Achievement:**
- Established clean separation between generation and publishing pipelines
- Defined canonical contract (publish.json) that decouples the two systems
- Proven with prochat-os-030 and prochat-os-031 successful executions
- Ready for platform-specific publishing implementations

**Status:** Ready for I-6.2 (YouTube integration)

**Key Insight:** By consuming metadata rather than reading generation artifacts directly, the publishing pipeline can scale independently and add new platforms without modifying generation code.

---

**Generated by:** Claude Haiku 4.5  
**Proof Executions:** prochat-os-030, prochat-os-031  
**Date:** 2026-05-31  
**Ready for:** I-6.2 YouTube publishing implementation
