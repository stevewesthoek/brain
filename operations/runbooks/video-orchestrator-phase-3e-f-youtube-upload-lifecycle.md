# Video Orchestrator Phase 3E-F - YouTube Upload Lifecycle / Status Handling

## Purpose

Phase 3E-F adds conservative status handling for the first private YouTube upload path. It can check the lifecycle of a known orchestrator-owned YouTube video ID and record redacted lifecycle metadata without adding any new publishing capability.

## What This Phase Does

- Verifies an uploaded YouTube video status by video ID
- Uses the existing Keychain token boundary
- Calls the YouTube read/status endpoint only
- Records redacted lifecycle metadata
- Emits status-check events for `post` jobs using explicit status-check mode
- Preserves manual fallback

## What This Phase Does Not Do

- No new upload modes
- No public or unlisted uploads
- No bulk upload
- No scheduling
- No thumbnail upload
- No caption upload
- No playlist insertion
- No comments or community posts
- No browser automation
- No token files
- No `.env`
- No raw token logging
- No arbitrary polling of unknown videos

## Lifecycle States

The worker uses conservative lifecycle states:

- `not_started`
- `uploading`
- `uploaded`
- `processing`
- `available_private`
- `failed`
- `unknown`

Rules:
- `uploaded` + `private` can resolve to `available_private`
- `processing` status resolves to `processing`
- failed/rejected/deleted states resolve to `failed`
- ambiguous or missing responses resolve to `unknown`
- privacy is never changed by a status check

## Status Check Config

Example shape:

```json
{
  "job_type": "post",
  "video_id": "00000000-0000-4000-8000-000000000001",
  "task_config": {
    "platform": "youtube",
    "package_target": "long-form",
    "adapter_mode": "api",
    "credential_reference": "keychain://video-orchestrator/youtube/example-account-placeholder",
    "youtube": {
      "status_check_only": true,
      "youtube_video_id": "YOUTUBE_VIDEO_ID_PLACEHOLDER",
      "privacy_status": "private",
      "allow_token_refresh": false
    }
  }
}
```

The job must explicitly set `status_check_only: true`.

## Token Rules

- Tokens are read from macOS Keychain only
- Raw token values stay in memory only
- Token values are never logged
- Refresh stays opt-in and disabled by default
- Status checks do not write token files or DB rows

## API Boundary

The status check uses the YouTube Data API read boundary only:

- endpoint: `videos.list`
- parts: `status,processingDetails`
- known video ID only

The phase does not add any new publishing capability.

## Failure Behavior

- Missing `status_check_only` blocks safely
- Missing `youtube_video_id` blocks safely
- Invalid credential reference blocks safely
- Missing token with refresh disabled blocks safely
- API failures return a safe lifecycle state of `unknown` or `failed`
- The worker should not dead-letter on a normal API or lifecycle failure

## Manual Fallback

Manual upload remains the fallback path if a status check is blocked, unavailable, or inconclusive.

## Next Phase Options

- Thumbnail upload hardening
- Caption upload hardening
- More detailed upload polling if later required
- Dashboard lifecycle display if it remains simple and safe

## Testing Instructions

- Validate the sample status-check job config
- Verify `status_check_only=true` does not call `videos.insert`
- Verify missing video ID blocks safely
- Verify invalid credential references block safely
- Verify lifecycle derivation for uploaded/private, processing, failed/rejected/deleted, and unknown responses
- Verify token values never appear in output

