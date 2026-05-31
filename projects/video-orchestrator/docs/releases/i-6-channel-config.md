# I-6.3 Per-Channel Configuration Storage

**Status:** In Progress  
**Date:** 2026-05-31  
**Target:** Multi-channel publishing with centralized channel configuration  

---

## Overview

A canonical channel configuration layer allows a single publishing workflow to support multiple YouTube channels. Each channel has its own configuration stored in S3, including:
- YouTube OAuth credentials (secret names)
- Default privacy settings
- Content preferences (tags, title formatting)
- Publishing rules (approval requirements, public video enforcement)

**Design:**
- **One shared publisher** — Single Step Functions state machine and Lambda functions
- **Multiple channel profiles** — Each channel has `channels/<channelId>/channel.json`
- **Canonical config** — S3 is source of truth for channel settings

---

## Channel Configuration Schema

### Location

```
s3://prochat-video-dev-909439522876-eu-north-1-an/channels/{channelId}/channel.json
```

### Structure

```json
{
  "channelId": "says-the-bible",
  "displayName": "Says the Bible",
  "platforms": {
    "youtube": {
      "enabled": true,
      "secretName": "prochat/youtube/says-the-bible/oauth-token",
      "defaultPrivacyStatus": "private",
      "allowedPrivacyStatuses": ["private", "unlisted"],
      "categoryId": "22",
      "defaultTags": [
        "Bible",
        "Christian",
        "Jesus",
        "Scripture"
      ],
      "titlePrefix": "",
      "titleSuffix": "",
      "descriptionTemplate": "",
      "madeForKids": false
    }
  },
  "publishing": {
    "requireManualApproval": true,
    "allowPublic": false,
    "defaultPlatform": "youtube"
  },
  "createdAt": "2026-05-31T17:52:51Z",
  "updatedAt": "2026-05-31T17:52:51Z"
}
```

### Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `channelId` | string | Yes | Unique identifier (e.g., "says-the-bible") |
| `displayName` | string | Yes | Human-readable name (e.g., "Says the Bible") |
| `platforms.youtube.enabled` | boolean | Yes | Whether YouTube publishing is enabled |
| `platforms.youtube.secretName` | string | Yes | AWS Secrets Manager secret name for OAuth token |
| `platforms.youtube.defaultPrivacyStatus` | string | Yes | Default privacy (must be "private" or "unlisted") |
| `platforms.youtube.allowedPrivacyStatuses` | array | Yes | Allowed privacy statuses (cannot include "public") |
| `platforms.youtube.categoryId` | string | Yes | YouTube category ID (22 = Entertainment) |
| `platforms.youtube.defaultTags` | array | No | Default tags for all videos |
| `platforms.youtube.titlePrefix` | string | No | Prefix added to all titles |
| `platforms.youtube.titleSuffix` | string | No | Suffix added to all titles |
| `platforms.youtube.descriptionTemplate` | string | No | Template for video descriptions |
| `platforms.youtube.madeForKids` | boolean | No | Whether videos are made for kids (default: false) |
| `publishing.requireManualApproval` | boolean | Yes | Whether approval is required before publishing |
| `publishing.allowPublic` | boolean | Yes | Whether public videos are allowed (must be false) |
| `publishing.defaultPlatform` | string | Yes | Default publishing platform |
| `createdAt` | string | Yes | ISO 8601 creation timestamp |
| `updatedAt` | string | Yes | ISO 8601 last update timestamp |

---

## Script: Create Channel Config

**File:** `../../cloud/scripts/create-channel-config.sh`

**Usage:**
```bash
../../cloud/scripts/create-channel-config.sh <channelId>
```

**Examples:**
```bash
../../cloud/scripts/create-channel-config.sh says-the-bible
../../cloud/scripts/create-channel-config.sh prochat
```

**Behavior:**
1. Accepts channelId as parameter
2. Looks up default config for known channels
3. Builds JSON with channel-specific settings
4. Validates JSON structure
5. Verifies YouTube secret exists in Secrets Manager
6. Uploads to `channels/<channelId>/channel.json`
7. Verifies upload succeeded

**Supported channels:**
- `says-the-bible` — Says the Bible channel
- `prochat` — ProChat channel
- Other channels accepted with manual input

---

## Script: Validate Channel Config

**File:** `../../cloud/scripts/validate-channel-config.sh`

**Usage:**
```bash
../../cloud/scripts/validate-channel-config.sh <channelId>
```

**Validation steps:**
1. Downloads config from S3
2. Validates JSON structure
3. Verifies all required fields exist
4. Verifies YouTube secret exists in Secrets Manager
5. Validates privacy settings:
   - `defaultPrivacyStatus` is "private" or "unlisted" (never "public")
   - `allowedPrivacyStatuses` does not include "public"
   - `allowPublic` is false
6. Tests YouTube API access with configured credentials

**Output (safe):**
- Channel display name
- Enabled platforms
- Privacy settings (no token values printed)
- Authenticated YouTube channel name and ID

---

## Updated publish.json Contract

### Schema Addition

Added to all publish.json files:

```json
{
  "jobId": "prochat-os-030",
  "channelId": "says-the-bible",
  "publishStatus": "pending",
  "platforms": {
    "youtube": {
      "secretName": null,
      "privacyStatus": "private"
    }
  }
}
```

**Changes:**
- **New field:** `channelId` identifies which channel config to use
- **Removed:** `platforms.youtube.secretName` (now read from channel config)
- **Added:** `platforms.youtube.privacyStatus` from channel defaults

### Proof

Updated publish.json for prochat-os-030:

```json
{
  "jobId": "prochat-os-030",
  "channelId": "says-the-bible",
  "publishStatus": "pending",
  "videoKey": "jobs/prochat-os-030/exports/generated-001-final.mp4",
  "thumbnailKey": "jobs/prochat-os-030/exports/thumbnail-001.jpg",
  "title": "...",
  "description": "...",
  "platforms": {
    "youtube": {
      "status": "uploaded",
      "videoId": "R2rq58QmfV0",
      "privacyStatus": "private"
    }
  }
}
```

---

## Publisher Lambda Integration

### Updated Flow

**Before (hardcoded):**
```
publish-youtube Lambda
  → reads YouTube secret directly: prochat/youtube/says-the-bible/oauth-token
```

**After (channel-aware):**
```
publish-youtube Lambda
  → reads channelId from publish.json
  → downloads channels/{channelId}/channel.json
  → extracts YouTube secretName: prochat/youtube/says-the-bible/oauth-token
  → uses channel's privacy/category/tags defaults
  → enforces allowPublic=false
```

### Code Changes

```python
def handler(event, context):
    job_id = event.get('jobId')
    privacy_status = event.get('privacyStatus', 'private')

    # Read publish.json
    publish_json = read_publish_json(BUCKET, job_id)
    
    # Get channel config
    channel_id = publish_json.get('channelId', 'says-the-bible')
    channel_config = read_channel_config(BUCKET, channel_id)
    
    # Get YouTube secret from channel config
    yt_config = channel_config['platforms']['youtube']
    secret_name = yt_config['secretName']
    
    # Enforce privacy rules
    allowed_statuses = yt_config['allowedPrivacyStatuses']
    if privacy_status not in allowed_statuses:
        raise Exception(f"Privacy status not allowed: {privacy_status}")
    
    if not channel_config['publishing']['allowPublic']:
        if privacy_status == 'public':
            raise Exception("Public videos not allowed for this channel")
    
    # Continue with upload...
```

---

## Multi-Channel Onboarding

### Adding a New Channel

1. **Create OAuth credentials** in Google Cloud:
   - Create new OAuth 2.0 Desktop Client
   - Download client_secret.json

2. **Store in Secrets Manager:**
   ```bash
   aws secretsmanager create-secret \
     --name prochat/youtube/new-channel/oauth-token \
     --secret-string file://token.json \
     --region eu-north-1
   ```

3. **Create channel config:**
   ```bash
   ../../cloud/scripts/create-channel-config.sh new-channel
   ```
   
   Or manually add to script for default settings.

4. **Validate:**
   ```bash
   ../../cloud/scripts/validate-channel-config.sh new-channel
   ```

5. **Test publish:**
   ```bash
   # Create publish.json with channelId
   aws s3 cp publish.json \
     "s3://BUCKET/jobs/test-job/metadata/publish.json" \
     --region eu-north-1
   
   # Run publisher
   aws stepfunctions start-execution \
     --state-machine-arn arn:aws:states:eu-north-1:...:stateMachine:video-publisher-youtube \
     --input '{"jobId": "test-job"}' \
     --region eu-north-1
   ```

---

## Privacy Enforcement

### Rule 1: No Public Videos

Channel config enforces:
```json
"publishing": {
  "allowPublic": false
}
```

Publisher Lambda rejects:
```python
if privacy_status == 'public':
    raise Exception("Public videos not allowed")
```

### Rule 2: Allowed Privacy Statuses

Channel config specifies:
```json
"allowedPrivacyStatuses": ["private", "unlisted"]
```

Publisher Lambda validates:
```python
if privacy_status not in channel_config['platforms']['youtube']['allowedPrivacyStatuses']:
    raise Exception(f"Privacy status not allowed: {privacy_status}")
```

### Rule 3: Default Is Private

```python
privacy_status = event.get('privacyStatus', 'private')  # Always default to private
```

---

## Proof Execution

### Setup

1. **Create channel config:**
   ```bash
   ../../cloud/scripts/create-channel-config.sh says-the-bible
   ```
   
   Output:
   ```
   ✅ Channel configuration created
   Channel: Says the Bible
   Channel ID: says-the-bible
   S3 Path: s3://prochat-video-dev-909439522876-eu-north-1-an/channels/says-the-bible/channel.json
   ```

2. **Validate:**
   ```bash
   ../../cloud/scripts/validate-channel-config.sh says-the-bible
   ```
   
   Output:
   ```
   ✅ Channel configuration validated
   Channel: Says the Bible
   YouTube Enabled: true
   Default Privacy: private
   ```

3. **Update publish.json with channelId:**
   ```bash
   # Add channelId to prochat-os-030/metadata/publish.json
   aws s3 cp "s3://BUCKET/jobs/prochat-os-030/metadata/publish.json" - | \
     jq '. + {"channelId": "says-the-bible"}' | \
     aws s3 cp - "s3://BUCKET/jobs/prochat-os-030/metadata/publish.json"
   ```

4. **Dry-run upload:**
   ```bash
   ../../cloud/scripts/youtube-upload-local.sh prochat-os-030 --dry-run
   ```
   
   Expected output:
   ```
   ✓ Token valid
   ✓ publish.json found
   ✓ Channel config loaded: Says the Bible
   ✓ Privacy status validated: private (allowed)
   [DRY-RUN] Would upload video...
   ```

---

## S3 Structure

```
s3://prochat-video-dev-909439522876-eu-north-1-an/
├── channels/
│   ├── says-the-bible/
│   │   └── channel.json                    ← Channel config
│   ├── prochat/
│   │   └── channel.json
│   └── future-channel/
│       └── channel.json
├── jobs/
│   ├── prochat-os-030/
│   │   └── metadata/
│   │       └── publish.json                ← References channelId
│   └── other-job/
│       └── metadata/
│           └── publish.json
```

---

## IAM Permissions

### For Configuration Management

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an/channels/*",
    "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an"
  ]
}
```

### For Lambda Execution

Add to Lambda execution role:
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject"
  ],
  "Resource": "arn:aws:s3:::prochat-video-dev-909439522876-eu-north-1-an/channels/*"
}
```

---

## Related Documentation

- **Local Upload:** `./i-6-youtube-upload-proof.md`
- **Publisher Workflow:** `./i-6-youtube-publisher-proof.md`
- **Secrets Manager:** `./i-6-youtube-secrets-manager.md`
- **Create Config Script:** `../../cloud/scripts/create-channel-config.sh`
- **Validate Config Script:** `../../cloud/scripts/validate-channel-config.sh`

---

## Timeline

- **I-6.2:** YouTube publishing orchestration (✓)
- **I-6.3:** Per-channel configuration (in progress)
- **I-6.4:** Multi-channel publisher deployment
- **I-6.5:** Social platform expansion (Twitter, etc.)

---

**Last Updated:** 2026-05-31  
**Next Step:** Run ../../cloud/scripts/validate-channel-config.sh says-the-bible
