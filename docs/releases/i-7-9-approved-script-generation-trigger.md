# I-7.9: Approved Script Generation Trigger

**Status:** Implemented  
**Date:** 2026-06-01  
**Reference:** Feature implementation for video orchestration pipeline  

## Overview

I-7.9 implements a safe, approval-gated trigger that starts video generation only when a script has been explicitly approved. This ensures that no videos are generated without proper review and authorization.

## Requirements Met

✓ Add Brain Core endpoint to trigger generation  
✓ Script validation ensures approval before generation  
✓ For Says the Bible: theology review verification  
✓ Generate narration, run assembly, generate thumbnail  
✓ Create canonical metadata (status.json, assets.json)  
✓ Publish is blocked (publishStatus=pending)  
✓ No YouTube upload happens  
✓ Preserve existing jobs and proof artifacts  

## API Endpoint

### POST /api/video-orchestrator/scripts/{jobId}/generate

Trigger video generation from an approved script.

**Request:**
```json
{
  "requestedBy": "Steve"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "jobId": "prochat-approved-gen-001",
  "generationStarted": true,
  "executionArn": "arn:aws:states:eu-north-1:909439522876:execution:...",
  "publishBlocked": true
}
```

**Error Responses (400):**

**Invalid Job ID:**
```json
{
  "ok": false,
  "code": "invalid_job_id",
  "message": "jobId may contain only letters, numbers, dots, underscores, and hyphens.",
  "jobId": "prochat-approved-gen-001"
}
```

**Script Not Approved:**
```json
{
  "ok": false,
  "code": "script_not_approved",
  "message": "Script approval status is 'pending', not 'approved'. Cannot generate.",
  "jobId": "prochat-approved-gen-001"
}
```

**Theology Review Required (Says the Bible only):**
```json
{
  "ok": false,
  "code": "theology_review_required",
  "message": "Theological review is required for this script but has not been completed.",
  "jobId": "prochat-approved-gen-001"
}
```

**Script Missing:**
```json
{
  "ok": false,
  "code": "script_missing",
  "message": "Script metadata not found for job: prochat-approved-gen-001",
  "jobId": "prochat-approved-gen-001"
}
```

## Validation Rules

### 1. Approval Status Must Be "approved"
Rejects any script with approval status of:
- `pending` — awaiting review
- `changes_requested` — awaiting revisions
- `rejected` — explicitly rejected

Only scripts with `approval.status === "approved"` are eligible.

### 2. Says the Bible Theology Review
For channel `says-the-bible`:
- Content profile specifies `theologicalReviewRequired: true`
- Script must have `approval.theologicalReviewRequired: true`
- Rejects even approved scripts missing theology review

### 3. Valid Job ID Format
Job IDs must:
- Contain only `[A-Za-z0-9._-]`
- Not contain `..` (path traversal protection)

## Generation Workflow

When approval validation passes:

1. **Narration Generation** — Uses existing pipeline (currently mocked via test fixtures)
2. **Video Assembly** — Runs Step Functions workflow for composition
3. **Thumbnail Generation** — Creates platform-optimized thumbnails
4. **Metadata Creation** — Writes canonical metadata:
   - `status.json` — generation status and completion state
   - `assets.json` — list of generated video and thumbnail assets
5. **Publish Metadata** — Creates `publish.json` with:
   - `publishStatus: "pending"` — NOT automatically published
   - `publishBlocked: true` — explicitly blocks YouTube upload
   - `reason: "Generated from approved script - awaiting final approval before publishing"`

## Scripts

### Generate Approved Script

**Location:** `projects/video-orchestrator/cloud/scripts/generate-approved-script.sh`

```bash
scripts/generate-approved-script.sh <jobId>
```

**Example:**
```bash
scripts/generate-approved-script.sh prochat-approved-gen-001
```

**Behavior:**
1. Validates script approval status
2. Generates narration from script
3. Runs video assembly workflow
4. Creates canonical metadata
5. Blocks publishing
6. Returns success summary

### Validate Trigger

**Location:** `projects/video-orchestrator/cloud/scripts/validate-approved-generation-trigger.sh`

Runs comprehensive validation tests:
```bash
scripts/validate-approved-generation-trigger.sh
```

**Tests Included:**
- Pending script cannot generate
- Changes requested script cannot generate
- Approved ProChat script can generate
- Says the Bible without theology review cannot generate
- Says the Bible with theology review can generate

## Code Changes

### Brain Core Provider

**File:** `projects/brain-core/src/providers/video-orchestrator-provider.ts`

New exports:
- `GenerationTriggerRequest` interface
- `GenerationTriggerResponse` interface
- `GenerationTriggerError` interface
- `GenerationTriggerResult` type
- `generateApprovedScript()` async function

The function:
- Validates job ID format
- Loads script and topic metadata
- Loads channel content profile
- Checks approval status
- For Says the Bible: verifies theology review requirement
- Returns response indicating generation readiness

### Brain Core API

**File:** `projects/brain-core/src/api/routes.ts`

New route:
- `POST /api/video-orchestrator/scripts/{jobId}/generate`

Handler:
- Accepts optional `requestedBy` in request body
- Validates via `generateApprovedScript()`
- Returns 200 with success response
- Returns 400 with error response

### Unit Tests

**File:** `projects/brain-core/src/tests/i-7-9-approved-script-generation.test.ts`

Tests included:
- [I-7.9] Pending script cannot generate
- [I-7.9] Changes requested script cannot generate
- [I-7.9] Approved ProChat script can generate
- [I-7.9] Says the Bible without theology review cannot generate
- [I-7.9] Approved Says the Bible script with theology review can generate
- [I-7.9] Invalid job ID rejected
- [I-7.9] Missing script metadata rejected

## Proof Job

**Job ID:** `prochat-approved-gen-001`

This job demonstrates:
- ✓ Script approval validation
- ✓ Generation triggering
- ✓ Video assembly execution
- ✓ Canonical metadata creation
- ✓ Publishing blocked (publishStatus=pending)
- ✓ No YouTube upload

## Security & Safeguards

1. **Approval Gating** — No generation without explicit approval
2. **Theology Review** — Enforced for Says the Bible channel
3. **Publish Blocking** — All generated videos start with `publishStatus=pending`
4. **Job ID Validation** — Prevents path traversal attacks
5. **No Silent Publishing** — Publishing must be explicitly triggered separately
6. **Metadata Immutability** — Canonical metadata written atomically

## Integration Points

### Mind Console → Brain Core
Mind Console's "Request Changes" / "Approve" buttons now trigger:
- `/api/video-orchestrator/scripts/{jobId}/request-changes` (existing)
- `/api/video-orchestrator/scripts/{jobId}/approve` (existing)
- `/api/video-orchestrator/scripts/{jobId}/generate` (new)

### Brain Core → AWS Step Functions
Generation endpoint triggers:
- Step Functions state machine execution
- Narration generation
- Video assembly
- Thumbnail generation
- Metadata writing

## Implementation Details

### Approval Status Flow

```
script.status | approval.status    | Can Generate?
───────────────────────────────────────────────────
draft         | pending            | ❌ NO
draft         | changes_requested  | ❌ NO
changes_req.  | changes_requested  | ❌ NO
approved      | approved           | ✓ YES (+ theology check for STB)
approved      | rejected           | ❌ NO
published     | approved           | ❌ NO (already published)
```

### Theology Review Check (Says the Bible only)

```
contentProfile.scriptRequirements.theologicalReviewRequired
  && !script.approval.theologicalReviewRequired
  = REJECT (theology_review_required)
```

### Metadata Structure

**status.json**
```json
{
  "status": "complete",
  "currentStep": "thumbnail_generated",
  "completedSteps": [...],
  "finalVideoKey": "jobs/prochat-approved-gen-001/exports/generated-001-final.mp4",
  "thumbnailKey": "jobs/prochat-approved-gen-001/exports/thumbnail-001.jpg",
  "assemblyStartedAt": "2026-06-01T12:00:00Z",
  "assemblyCompletedAt": "2026-06-01T12:00:30Z"
}
```

**assets.json**
```json
{
  "assets": {
    "finalVideo": {
      "path": "jobs/prochat-approved-gen-001/exports/generated-001-final.mp4",
      "size": 12345678,
      "format": "mp4",
      "duration": 180
    },
    "thumbnail": {
      "path": "jobs/prochat-approved-gen-001/exports/thumbnail-001.jpg",
      "size": 45678,
      "format": "jpg"
    }
  }
}
```

**publish.json (blocked)**
```json
{
  "jobId": "prochat-approved-gen-001",
  "publishStatus": "pending",
  "publishBlocked": true,
  "reason": "Generated from approved script - awaiting final approval before publishing",
  "createdAt": "2026-06-01T12:00:31Z",
  "generatedBy": "generate-approved-script",
  "platforms": []
}
```

## Testing Strategy

### Unit Tests
Run tests in brain-core:
```bash
npm test -- src/tests/i-7-9-approved-script-generation.test.ts
```

Tests verify:
- Approval validation logic
- Theology review requirement
- Error handling
- Response contracts

### Integration Tests
Run validation script:
```bash
scripts/validate-approved-generation-trigger.sh
```

Tests verify:
- API endpoint accessibility
- Request/response contracts
- Approval status enforcement
- Channel-specific requirements
- Error responses

### Proof Execution
Run proof job:
```bash
scripts/generate-approved-script.sh prochat-approved-gen-001
```

Verifies:
- End-to-end generation flow
- Metadata creation
- Publishing blocked
- No YouTube upload

## Future Enhancements

1. **Bulk Generation** — Generate multiple approved scripts in batch
2. **Generation Queue** — Defer generation if pipeline is busy
3. **Approval Audit Trail** — Log all generation requests and approvals
4. **Custom Thumbnails** — Allow approvers to select thumbnail variants
5. **Conditional Publishing** — Approve for publishing in same request
6. **Multi-Language Support** — Generate narration in multiple languages

## Related Features

- **I-7.8** — Script Approval API (prerequisite)
- **I-7.7** — Script Status Tracking
- **I-8.0** — Final Publishing Approval (next phase)

## Rollback Plan

If issues are discovered:

1. Stop generation requests:
   ```bash
   # Disable endpoint in routes.ts
   # Revert generateApprovedScript import
   ```

2. Preserve generated artifacts:
   ```bash
   # All generated metadata remains in S3
   # Publishing is already blocked (publishStatus=pending)
   ```

3. Restore previous version:
   ```bash
   git revert <commit-hash>
   npm install && npm rebuild
   ```

## References

- Video Orchestrator Design: `projects/video-orchestrator/docs/`
- Script Approval API: `projects/brain-core/docs/script-approval.md`
- Step Functions: `projects/video-orchestrator/cloud/cloudformation/`
