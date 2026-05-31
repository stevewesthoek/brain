---
type: dashboard
status: active
---

# AWS Video Pipeline

This is the canonical human-facing dashboard for the AWS-based video generation and publishing pipeline.

Canonical implementation lives in the Brain project:

```text
/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/
```

## 🚀 Pipeline Status

**Overall Status:** ✅ READY

| Component | Status | Details |
|-----------|--------|---------|
| Generation Pipeline | ✅ Ready | Bedrock + MediaConvert + Polly |
| Publishing Pipeline | ✅ Ready | YouTube channel-aware publisher |
| Says the Bible Auth | ✅ Configured | YouTube OAuth validated |
| ProChat Auth | ⏳ Pending | Requires OAuth token setup |

---

## 📺 Channels

### Says the Bible

**Configuration Status:** ✅ Complete

| Item | Status | Details |
|------|--------|---------|
| Channel Config | ✅ | `channels/says-the-bible/channel.json` |
| Content Profile | ✅ | Theology-focused short-form content |
| YouTube Secret | ✅ | `prochat/youtube/says-the-bible/oauth-token` |
| Publishing | ✅ Ready | Private videos only |
| Last Upload | ✓ | VideoID: O8-HEhG8IlE (prochat-os-040) |

**Content Profile:**
```
Style: Biblical teaching, reverent, Scripture-focused
Audience: People seeking clear Bible explanation
Topics: Bible Q&A, doctrine, verse study, theology
Thumbnail: Calm, readable, no sensationalism
Privacy: PRIVATE (not public)
Approval: Required
```

---

### ProChat

**Configuration Status:** ⏳ In Progress

| Item | Status | Details |
|------|--------|---------|
| Channel Config | ✅ | `channels/prochat/channel.json` |
| Content Profile | ✅ | SaaS/automation education |
| YouTube Secret | ⏳ | Not yet configured |
| Publishing | ⏳ Config-ready | Requires OAuth token |
| Last Upload | — | Awaiting first test |

**Content Profile:**
```
Style: B2B SaaS education, direct, practical
Audience: Founders, SMB owners, SaaS builders
Topics: SaaS problems, AI workflows, product education
Thumbnail: Clean automation, indigo/blue, no hype
Privacy: PRIVATE (not public)
Approval: Required
```

---

## 📊 Recent Jobs

### Says the Bible

| Job ID | Status | Video | Thumbnail | YouTube | Date |
|--------|--------|-------|-----------|---------|------|
| prochat-os-040 | ✅ Published | Yes | Yes | O8-HEhG8IlE | 2026-05-31 |
| prochat-os-030 | ✅ Published | Yes | Yes | R2rq58QmfV0 | 2026-05-31 |

**Recent Topics:**
- `stb-topic-001` — Draft, awaiting approval

### ProChat

| Job ID | Status | Video | Thumbnail | YouTube | Date |
|--------|--------|-------|-----------|---------|------|
| prochat-topic-001 | 📝 Topic | — | — | — | 2026-05-31 |

**Recent Topics:**
- `prochat-topic-001` — Draft, awaiting details

---

## 🎬 Content System

### Available Actions

1. **Create Topic** — Start a new video topic contract
   ```bash
   /Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud/scripts/create-video-topic.sh <jobId> <channelId>
   ```

2. **Validate Configuration** — Check content intelligence setup
   ```bash
   /Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud/scripts/validate-content-intelligence.sh
   ```

3. **Generate Video** — Trigger generation pipeline
   - Topic must be approved first
   - Bedrock generates script
   - MediaConvert renders MP4
   - (Integration coming: link to generation UI)

4. **Publish Video** — Publish to YouTube
   - Channel must have YouTube secret configured
   - Videos publish as PRIVATE by default
   - Idempotent: re-running returns existing videoId
   - (Integration coming: link to publishing UI)

### Content Profiles

Content profiles are **immutable blueprints** that define how each channel's videos are created:

#### Says the Bible
```json
{
  "channelId": "says-the-bible",
  "displayName": "Says the Bible",
  "contentStyle": "biblical teaching, simple, reverent, Scripture-focused",
  "audience": "people looking for clear Bible explanation",
  "defaultTopicTypes": ["Bible question", "doctrine explainer", "verse explanation"],
  "scriptTemplate": "short-form-60s",
  "thumbnailStyle": "Scripture-focused, calm, readable, no sensationalism",
  "guardrails": {
    "requiresHumanApproval": true,
    "allowPublicPublishing": false,
    "theologyReviewRequired": true
  }
}
```

#### ProChat
```json
{
  "channelId": "prochat",
  "displayName": "ProChat",
  "contentStyle": "direct B2B SaaS/product education",
  "audience": "non-technical founders, small business owners, SaaS builders",
  "defaultTopicTypes": ["SaaS problem", "AI workflow", "product explanation"],
  "scriptTemplate": "short-form-60s",
  "thumbnailStyle": "clean SaaS automation, indigo/blue, no hype",
  "guardrails": {
    "requiresHumanApproval": true,
    "allowPublicPublishing": false,
    "theologyReviewRequired": false
  }
}
```

**Location:** `s3://prochat-video-dev-909439522876-eu-north-1-an/channels/{channelId}/content-profile.json`

---

## 📋 Topic Contract Schema

Each video topic follows a canonical contract:

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

**Location:** `s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/{jobId}/metadata/topic.json`

**Status Workflow:**
```
draft → pending approval → approved → generating → completed
        ↓
      rejected
```

---

## 🔐 Security & Privacy

### Privacy Enforcement

✅ **All videos remain PRIVATE**

1. **Channel Config Level:**
   - `allowPublic: false` — blocks public uploads at config level
   - `allowedPrivacyStatuses: ["private", "unlisted"]` — only private/unlisted allowed

2. **Publisher Lambda Level:**
   - Validates privacyStatus against allowedPrivacyStatuses
   - Enforces allowPublic=false check
   - Rejects any attempt to publish public

3. **Default Behavior:**
   - If no privacyStatus specified: defaults to "private"
   - If privacyStatus="public": rejected by Lambda

4. **YouTube Result:**
   - Video is PRIVATE (not searchable, not listed)
   - Only accessible via direct link
   - Only the owner can view video metadata

### Approval Gates

Each channel has configurable approval requirements:

**Says the Bible:**
- `requiresHumanApproval: true` — script must be approved
- `theologyReviewRequired: true` — theology review required

**ProChat:**
- `requiresHumanApproval: true` — script must be approved
- `theologyReviewRequired: false` — no theology review needed

---

## 🏗️ Architecture

```
Topic Contract (topic.json)
         ↓
   [Generation Pipeline]
   - Bedrock: Generate script from topic
   - Image gen: Create scene visuals
   - Polly: Generate voiceover audio
   - MediaConvert: Render MP4
   - S3: Store video + thumbnail
         ↓
    Approval Gate
    (if required)
         ↓
  Content Intelligence Check
   - Verify against content profile
   - Validate privacy rules
   - Check guardrails
         ↓
  [Publishing Pipeline]
   - Lambda: publish-youtube
     ├─ Load channel config
     ├─ Load content profile
     ├─ Validate privacy (must be private/unlisted)
     ├─ Enforce allowPublic=false
     ├─ Upload to YouTube as PRIVATE
   - Lambda: publish-thumbnail
     ├─ Upload thumbnail image
   - Lambda: update-metadata
     ├─ Write videoId to topic.json
     └─ Mark status: published
         ↓
   YouTube: https://www.youtube.com/watch?v=VIDEO_ID
   (PRIVATE - direct link only)
```

---

## 🔄 Workflows Supported

### Create Topic → Generate → Publish (Full Flow)

```bash
# 1. Create topic contract
/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud/scripts/create-video-topic.sh prochat-topic-001 prochat

# 2. Review/update topic.json with title, angle, audience
aws s3 cp s3://BUCKET/jobs/prochat-topic-001/metadata/topic.json - | jq .

# 3. Mark as approved (integration coming)
# 4. Trigger generation (integration coming)
# 5. Publish to YouTube (Step Functions)
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-north-1:...:stateMachine:video-publisher-youtube \
  --input '{"jobId": "prochat-topic-001"}' \
  --region eu-north-1
```

### Idempotent Publishing

Re-running publish with same jobId:
- Returns existing videoId
- Does NOT create duplicate video
- Idempotency flag: `alreadyPublished: true`

```bash
# First run: creates video
aws stepfunctions start-execution ... --name run-1
# Result: videoId = O8-HEhG8IlE

# Second run: returns existing video
aws stepfunctions start-execution ... --name run-2
# Result: videoId = O8-HEhG8IlE (same), alreadyPublished = true
```

---

## 🔗 Integration Points

### From Brain Console Plugin

The Obsidian Brain Console plugin should eventually:
- Display channel cards with status
- Show recent jobs and topics
- Link to create-video-topic.sh
- Show YouTube upload status
- Verify privacy settings

### From Generation UI

The generation UI should eventually:
- Read topic.json from S3
- Display content profile guidelines
- Show approval status
- Trigger generation pipeline
- Update topic status: draft → approved → generating → completed

### From Publishing UI

The publishing UI should eventually:
- Read publish.json from S3
- Check channel config + content profile
- Validate privacy settings before upload
- Show video URL after publish
- Display thumbnail verification

---

## 📚 Guides

- [[i-7-content-intelligence-and-dashboard.md|Content Intelligence & Dashboard Documentation]]
- [[../docs/releases/i-6-channel-aware-publisher-proof.md|YouTube Publisher Proof (I-6.4)]]
- [[../docs/releases/i-6-channel-config.md|Channel Configuration (I-6.3)]]

---

## 🔗 Data Sources

**S3 Paths (Read-Only):**
- Channels: `s3://prochat-video-dev-909439522876-eu-north-1-an/channels/{channelId}/`
- Jobs: `s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/{jobId}/`

**AWS Secrets Manager:**
- Says the Bible: `prochat/youtube/says-the-bible/oauth-token`
- ProChat: `prochat/youtube/prochat/oauth-token` (pending)

**AWS Step Functions:**
- State Machine: `video-publisher-youtube`
- Region: `eu-north-1`

---

## 📝 Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete and operational |
| ⏳ | In progress, pending setup |
| ⚠️ | Warning, manual action needed |
| 📝 | Draft or pending review |
| — | Not yet tested |

---

**Last Updated:** 2026-05-31  
**Status:** Active  
**Say the Bible Videos Published:** 2  
**ProChat Videos Published:** 0 (awaiting OAuth)
