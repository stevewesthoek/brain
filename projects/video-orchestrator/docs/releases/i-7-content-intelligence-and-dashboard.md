# I-7.1 Content Intelligence Layer + Brain Console AWS Video Pipeline View

**Status:** ✅ Complete  
**Date:** 2026-05-31  
**Scope:** Content profiles, topic contracts, Brain Console integration

---

## Overview

I-7.1 implements a **content intelligence layer** that allows each YouTube channel to have its own editorial guidelines, topic framework, and publishing guardrails. It also adds an **AWS Video Pipeline view** to the Brain Console dashboard for visibility and control.

This layer sits between **topic creation** and **video generation**, ensuring that content matches channel-specific guidelines before any generation or publishing happens.

---

## Part A: Brain Console Architecture (Findings)

### Dashboard Structure

**Type:** Obsidian Plugin + Markdown  
**Location:** `/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud/brain-console/`  
**Plugin Version:** 2.18  
**Connected to:** Brain Core (localhost:4877)

The Brain Console is a **read-only** Obsidian plugin that displays:
- Status pills (Brain Core, Model Router, Scheduler, etc.)
- 6 core cards (Wiki Health, Maintenance, Approvals, Scheduler, Readiness, Next Action)
- Action buttons (Refresh, View Latest, Open Mind)
- Recent activity panel

**Navigation Pattern:**
- Primary: Brain Console plugin (right sidebar)
- Fallback: Markdown files in `/live/` folder
- Status files linked from dashboard.md

**Existing Views in `/live/`:**
- dashboard.md — Main dashboard reference
- video.md — Video Orchestrator visibility
- machine.md — Brain Core machine state
- tasks.md, projects.md, workflows.md — Activity views

**Decision:** Create new `aws-video-pipeline.md` view alongside existing views. The plugin can optionally link to it.

---

## Part B: Content Profile System

### Schema

Each channel has an immutable **content profile** that defines how its videos are created:

**Location:**
```
s3://prochat-video-dev-909439522876-eu-north-1-an/channels/{channelId}/content-profile.json
```

**Schema:**
```json
{
  "channelId": "says-the-bible",
  "displayName": "Says the Bible",
  "contentSystem": "aws-video-pipeline",
  "targetDurationSeconds": 60,
  "defaultVoice": "Joanna",
  "contentStyle": "biblical teaching, simple, reverent, Scripture-focused",
  "audience": "people looking for clear Bible explanation",
  "defaultTopicTypes": [
    "Bible question",
    "doctrine explainer",
    "verse explanation",
    "biblical character study",
    "theology foundation"
  ],
  "scriptTemplate": "short-form-60s",
  "thumbnailStyle": "Scripture-focused, calm, readable, no sensationalism",
  "defaultTags": [
    "Bible",
    "Jesus",
    "Christianity",
    "Scripture",
    "Biblical Teaching",
    "Gospel"
  ],
  "guardrails": {
    "requiresHumanApproval": true,
    "allowPublicPublishing": false,
    "theologyReviewRequired": true
  },
  "createdAt": "2026-05-31T20:30:00Z",
  "updatedAt": "2026-05-31T20:30:00Z"
}
```

### Channels Implemented

#### Says the Bible
```json
{
  "channelId": "says-the-bible",
  "displayName": "Says the Bible",
  "contentStyle": "biblical teaching, simple, reverent, Scripture-focused",
  "audience": "people looking for clear Bible explanation",
  "defaultTopicTypes": [
    "Bible question",
    "doctrine explainer",
    "verse explanation",
    "biblical character study",
    "theology foundation"
  ],
  "thumbnailStyle": "Scripture-focused, calm, readable, no sensationalism",
  "guardrails": {
    "requiresHumanApproval": true,
    "allowPublicPublishing": false,
    "theologyReviewRequired": true
  }
}
```

**Status:** ✅ Deployed to S3  
**Path:** `channels/says-the-bible/content-profile.json`

#### ProChat
```json
{
  "channelId": "prochat",
  "displayName": "ProChat",
  "contentStyle": "direct B2B SaaS/product education",
  "audience": "non-technical founders, small business owners, SaaS builders",
  "defaultTopicTypes": [
    "SaaS problem",
    "AI workflow",
    "product explanation",
    "founder education",
    "automation how-to",
    "productivity tip"
  ],
  "thumbnailStyle": "clean SaaS automation, indigo/blue, no hype",
  "guardrails": {
    "requiresHumanApproval": true,
    "allowPublicPublishing": false,
    "theologyReviewRequired": false
  }
}
```

**Status:** ✅ Deployed to S3  
**Path:** `channels/prochat/content-profile.json`

---

## Part C: Topic Contract System

### Schema

Each video starts with a **topic contract** that captures editorial intent:

**Location:**
```
s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/{jobId}/metadata/topic.json
```

**Schema:**
```json
{
  "jobId": "stb-topic-001",
  "channelId": "says-the-bible",
  "topicId": "says-the-bible-1780258458",
  "title": "What Does the Bible Say About...?",
  "angle": "Scripture interpretation from [book]",
  "audience": "Christians seeking clarity",
  "targetDurationSeconds": 60,
  "status": "draft",
  "createdAt": "2026-05-31T20:30:00Z",
  "updatedAt": "2026-05-31T20:30:00Z",
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
```

**Status Workflow:**
```
draft 
  ↓
pending approval (if required by content profile)
  ↓
approved / rejected
  ↓
generating (after approval)
  ↓
completed / failed
```

### Create Topic Script

**File:** `../../cloud/scripts/create-video-topic.sh`

**Usage:**
```bash
../../cloud/scripts/create-video-topic.sh <jobId> <channelId>
```

**Examples:**
```bash
../../cloud/scripts/create-video-topic.sh stb-topic-001 says-the-bible
../../cloud/scripts/create-video-topic.sh prochat-topic-001 prochat
```

**Behavior:**
1. Validates channel config exists
2. Validates content-profile.json exists
3. Generates topic.json with empty fields (draft)
4. Uploads to S3
5. Returns topicId and next steps

**Safety:**
- Does NOT trigger generation automatically
- Does NOT bypass approval requirement
- Does NOT validate privacy (that happens at publishing time)

**Test Execution:**
```bash
$ ../../cloud/scripts/create-video-topic.sh stb-topic-001 says-the-bible

===========================================
Create Video Topic Contract
===========================================

Job ID: stb-topic-001
Channel: says-the-bible

Step 1: Verifying channel configuration
✓ Channel config exists

Step 2: Verifying content profile
✓ Content profile exists: Says the Bible

Step 3: Creating topic contract
✓ Topic contract generated

Step 4: Uploading to S3
✓ Uploaded to: s3://BUCKET/jobs/stb-topic-001/metadata/topic.json

Step 5: Verifying upload
✓ Topic contract verified

===========================================
✅ Topic contract created
===========================================

Job ID: stb-topic-001
Topic ID: says-the-bible-1780258458
Channel: Says the Bible (says-the-bible)
S3 Path: s3://BUCKET/jobs/stb-topic-001/metadata/topic.json
Status: draft
Approval: pending
```

---

## Part D: Brain Console View

### New Dashboard: AWS Video Pipeline

**File:** `live/aws-video-pipeline.md`

**Purpose:** Central visibility hub for the AWS video pipeline

**Sections:**

1. **Pipeline Status** — Generation, publishing, auth status
2. **Channel Cards** — Says the Bible, ProChat with status
3. **Recent Jobs** — Recent topics, generation status, publishing results
4. **Content System** — Content profiles, topic schema, actions
5. **Security & Privacy** — Privacy enforcement overview
6. **Architecture Diagram** — Pipeline flow
7. **Workflows** — Available commands and integrations
8. **Integration Points** — Future plugin/UI connections

**Status Display:**
- ✅ Complete and operational
- ⏳ In progress, pending setup
- ⚠️ Warning, manual action needed
- 📝 Draft or pending review
- — Not yet tested

**Key Features:**
- Channel status matrix
- Recent job list with S3 links
- Content profile display
- Topic contract schema reference
- Privacy enforcement explanation
- Idempotency proof
- Data source references

**Location:** `/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/live/aws-video-pipeline.md`

---

## Part E: Data Source

### Brain Console Data File

**File:** `../../cloud/brain-console/aws-video-pipeline.json`

**Purpose:** Centralized data source for Brain Console plugin (future integration)

**Contents:**
```json
{
  "pipeline": "aws-video-pipeline",
  "displayName": "AWS Video Pipeline",
  "s3Bucket": "prochat-video-dev-909439522876-eu-north-1-an",
  "awsRegion": "eu-north-1",
  "channels": [
    {
      "channelId": "says-the-bible",
      "displayName": "Says the Bible",
      "youtubeEnabled": true,
      "publishingStatus": "ready",
      "videoCount": 2
    },
    {
      "channelId": "prochat",
      "displayName": "ProChat",
      "youtubeEnabled": false,
      "publishingStatus": "auth-pending",
      "videoCount": 0
    }
  ],
  "stateMachines": [...],
  "lambdas": [...],
  "schemas": {
    "contentProfile": {...},
    "topic": {...},
    "publish": {...}
  },
  "privacyPolicy": {
    "enforcement": "channel-aware",
    "publicVideosAllowed": false
  }
}
```

**Location:** `/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud/brain-console/aws-video-pipeline.json`

---

## Part F: Validation Script

### Validate Content Intelligence

**File:** `../../cloud/scripts/validate-content-intelligence.sh`

**Purpose:** Verify content intelligence layer is properly configured

**Usage:**
```bash
../../cloud/scripts/validate-content-intelligence.sh
```

**Validates:**
1. ✅ `channels/says-the-bible/channel.json` exists
2. ✅ `channels/says-the-bible/content-profile.json` exists
3. ✅ Content profile JSON is valid
4. ✅ `allowPublicPublishing: false` in profile
5. ✅ `allowPublic: false` in channel config
6. ✅ YouTube secret exists
7. ✅ ProChat channel config exists
8. ✅ ProChat content profile exists
9. ✅ Brain Console view exists

**Test Results:**
```bash
$ ../../cloud/scripts/validate-content-intelligence.sh

===========================================
Validate Content Intelligence Layer
===========================================

Validating: says-the-bible
  [1/5] Channel config...
    ✓ exists
  [2/5] Content profile...
    ✓ exists
  [3/5] Content profile JSON...
    ✓ valid JSON
    ✓ allowPublicPublishing = false
  [4/5] Channel config privacy rules...
    ✓ allowPublic = false
  [5/5] YouTube credentials...
    ✓ secret exists: prochat/youtube/says-the-bible/oauth-token

Validating: prochat
  [1/5] Channel config...
    ✓ exists
  [2/5] Content profile...
    ✓ exists
  [3/5] Content profile JSON...
    ✓ valid JSON
    ✓ allowPublicPublishing = false
  [4/5] Channel config privacy rules...
    ✓ allowPublic = false
  [5/5] YouTube credentials...
    ⚠ YouTube publishing disabled (secretName configured but not active)

Checking Brain Console Integration
  ✓ AWS Video Pipeline view exists

===========================================
✅ Content Intelligence validation passed
===========================================
Warnings: 0
```

---

## Part H: Proof Execution

### Created Topics

**Topic 1: Says the Bible**
```bash
$ ../../cloud/scripts/create-video-topic.sh stb-topic-001 says-the-bible
✅ Topic contract created
JobId: stb-topic-001
Topic ID: says-the-bible-1780258458
S3 Path: s3://BUCKET/jobs/stb-topic-001/metadata/topic.json
```

**Topic 2: ProChat**
```bash
$ ../../cloud/scripts/create-video-topic.sh prochat-topic-001 prochat
✅ Topic contract created
Job ID: prochat-topic-001
Topic ID: prochat-1780258473
S3 Path: s3://BUCKET/jobs/prochat-topic-001/metadata/topic.json
```

### Validation Results

```bash
$ ../../cloud/scripts/validate-content-intelligence.sh
✅ Content Intelligence validation passed
```

All checks passed:
- ✅ Says the Bible channel config + content profile + YouTube secret
- ✅ ProChat channel config + content profile
- ✅ Privacy enforcement in place
- ✅ Brain Console view created

---

## What's Functional Now

### ✅ Content Profiles
- Says the Bible content profile deployed
- ProChat content profile deployed
- Profiles are immutable blueprints
- Include channel-specific guidelines and guardrails

### ✅ Topic Contracts
- Topic creation script working
- Creates draft topic.json in S3
- Validates channel + content profile exist
- Generates unique topicId
- Sets approval status to pending

### ✅ Brain Console View
- AWS Video Pipeline view created
- Shows channel status matrix
- Displays recent jobs
- Explains content profiles, topic schema
- Documents privacy enforcement
- Links to all data sources

### ✅ Validation
- validate-content-intelligence.sh working
- Checks all required configs exist
- Validates JSON structure
- Verifies privacy rules
- Reports YouTube auth status

### ✅ Privacy Enforcement
- Channel-level: allowPublic=false in both configs
- Content profile: allowPublicPublishing=false
- Lambda level: validates privacy before upload (I-6.4)
- Result: All videos PRIVATE by default

---

## What's Placeholder

### ⏳ Generation Pipeline Integration
- Topic → Bedrock script generation (not yet wired)
- Script approval workflow (planned)
- Bedrock → MediaConvert rendering (exists, not in this scope)

### ⏳ Brain Console Plugin Integration
- Plugin should fetch aws-video-pipeline.json
- Plugin should display channel cards
- Plugin should link to topic creation
- (Currently: markdown view only)

### ⏳ ProChat YouTube Auth
- ProChat channel config exists (YouTube disabled)
- Awaiting OAuth token setup
- Once token uploaded: set enabled=true

### ⏳ UI/Workflow Automation
- Approve topic button (currently manual S3 edit)
- Trigger generation button
- Publish button (can use Step Functions CLI)
- Status polling (currently manual check)

### ⏳ Analytics
- Video performance tracking
- Viewer engagement metrics
- Topic effectiveness scoring
- (Planned for future releases)

### ⏳ Scheduling
- Batch topic creation
- Scheduled generation runs
- Scheduled publishing (future)
- (Not in scope for I-7.1)

---

## Architecture Diagram

```
Content Intelligence Layer (I-7.1)
═════════════════════════════════════════════════════════

Topic Submission
    ↓
Content Profile Rules
(says-the-bible/ or prochat/)
    ├─ Content style guidelines
    ├─ Audience definition
    ├─ Approval requirements
    ├─ Theology review flag
    └─ Privacy enforcement: allowPublic=false
    ↓
Topic Contract Created (topic.json)
    ├─ jobId, topicId
    ├─ title, angle, audience (user-editable)
    ├─ status: draft
    └─ approval: pending
    ↓
Approval Gate (if required)
    ├─ Human review
    └─ Update approval.status → approved
    ↓
Generation Pipeline (future I-7.2)
    ├─ Bedrock: script generation
    ├─ Image gen: visuals
    ├─ Polly: voiceover
    └─ MediaConvert: render MP4
    ↓
Publishing Check (before upload)
    ├─ Load channel config
    ├─ Load content profile
    ├─ Validate: privacyStatus in allowedPrivacyStatuses
    ├─ Validate: allowPublic=false
    └─ Privacy enforcement: FAIL if public attempted
    ↓
YouTube Upload (Lambda: publish-youtube)
    ├─ Extract channel config
    ├─ Idempotency check: videoId exists?
    ├─ Upload as PRIVATE
    └─ Return videoId
    ↓
Metadata Update (Lambda: update-metadata)
    └─ topic.json → status: completed
    ↓
Result: YouTube Video (PRIVATE)
```

---

## Configuration Files

### Channel Configs
- `s3://BUCKET/channels/says-the-bible/channel.json`
- `s3://BUCKET/channels/prochat/channel.json`

### Content Profiles
- `s3://BUCKET/channels/says-the-bible/content-profile.json` ✅ Deployed
- `s3://BUCKET/channels/prochat/content-profile.json` ✅ Deployed

### Topic Contracts
- `s3://BUCKET/jobs/stb-topic-001/metadata/topic.json` ✅ Created
- `s3://BUCKET/jobs/prochat-topic-001/metadata/topic.json` ✅ Created

### Brain Console
- `live/aws-video-pipeline.md` ✅ Created
- `../../cloud/brain-console/aws-video-pipeline.json` ✅ Created

### Scripts
- `../../cloud/scripts/create-video-topic.sh` ✅ Created
- `../../cloud/scripts/validate-content-intelligence.sh` ✅ Created

---

## Related Documentation

- **I-6.4:** `./i-6-4-channel-aware-publisher-proof.md` — YouTube publisher
- **I-6.3:** `./i-6-channel-config.md` — Channel configuration
- **I-6.2e:** `./i-6-youtube-publisher-proof.md` — Publishing orchestration

---

## Privacy & Guardrails Summary

| Layer | Enforcement | Details |
|-------|-------------|---------|
| Content Profile | `allowPublicPublishing: false` | Channel-specific, immutable |
| Channel Config | `allowPublic: false` | Runtime config check |
| Publisher Lambda | Privacy validation | Rejects public uploads |
| YouTube | PRIVATE status | Video is not searchable |
| Default | "private" | If no status specified |

---

## Privacy: All Videos PRIVATE ✅

1. **Says the Bible videos:**
   - VideoID: O8-HEhG8IlE (prochat-os-040) — PRIVATE ✅
   - VideoID: R2rq58QmfV0 (prochat-os-030) — PRIVATE ✅

2. **ProChat videos:**
   - None published yet (awaiting OAuth)
   - Will be PRIVATE by default ✅

3. **Enforcement:**
   - Lambda validates privacy before upload
   - Channel config blocks public setting
   - Content profile enforces no public publishing
   - YouTube result: not searchable, direct link only

---

## Next Steps

### Immediate (I-7.2)
1. Wire topic → generation pipeline
2. Add Bedrock script generation
3. Implement approval workflow
4. Add generation status tracking

### Short-term (I-7.3)
1. ProChat YouTube OAuth setup
2. Multi-channel content strategies
3. Topic template library
4. Content analytics dashboard

### Future (I-8+)
1. Brain Console plugin native integration
2. Automated scheduling and batching
3. Performance analytics
4. Social platform expansion (Twitter, LinkedIn)

---

## Files Created/Modified

**New Files:**
- `../../cloud/scripts/create-video-topic.sh` — Topic creation script
- `../../cloud/scripts/validate-content-intelligence.sh` — Validation script
- `live/aws-video-pipeline.md` — Dashboard view
- `../../cloud/brain-console/aws-video-pipeline.json` — Data source

**S3 Uploads:**
- `channels/says-the-bible/content-profile.json` — Content profile
- `channels/prochat/content-profile.json` — Content profile
- `channels/prochat/channel.json` — Channel config (new)
- `jobs/stb-topic-001/metadata/topic.json` — Test topic
- `jobs/prochat-topic-001/metadata/topic.json` — Test topic

---

**Status:** ✅ COMPLETE  
**Tested:** ✅ YES  
**Deployed:** ✅ YES  
**Ready for Next Phase:** ✅ YES
