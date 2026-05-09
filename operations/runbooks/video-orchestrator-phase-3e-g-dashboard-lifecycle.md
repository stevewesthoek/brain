# Video Orchestrator Phase 3E-G - Dashboard Lifecycle Surfacing

## Purpose
Surface read-only YouTube upload lifecycle state in the local dashboard so operators can see the current lifecycle of known private uploads without adding any control surface.

## What This Phase Does
- Reads existing local database events and status metadata
- Surfaces the latest YouTube upload lifecycle state in the dashboard
- Shows YouTube video ID when it is already known locally
- Shows privacy status, last checked timestamp, upload event timestamp, manual fallback availability, status-check pending, and counts
- Redacts warning/error strings before display

## What This Phase Does Not Do
- No upload button
- No OAuth button
- No token display
- No credential reference display
- No Keychain read/write
- No YouTube API calls from the dashboard
- No polling from the dashboard
- No public or unlisted controls
- No thumbnail, caption, or bulk upload controls

## Data Source
The dashboard reads local lifecycle metadata from the existing Video Orchestrator database event stream. It does not call YouTube or Keychain helpers.

Expected event sources include:
- `youtube_private_upload_succeeded`
- `youtube_private_upload_failed`
- `youtube_upload_status_checked`

## Fields Displayed
- latest lifecycle state
- YouTube video ID
- privacy status
- upload event timestamp
- last checked timestamp
- manual fallback availability
- status check pending
- redacted warning/error summary
- lifecycle counts by state

## Redaction Rules
- Never display credential references
- Never display access tokens, refresh tokens, client secrets, authorization codes, or Bearer tokens
- Redact warning/error strings before rendering
- Keep the UI read-only even when status is missing or ambiguous

## Validation Instructions
- Verify the `/api/video-orchestrator/status` payload includes a `youtube_lifecycle` object
- Confirm the dashboard renders the lifecycle panel without any control buttons
- Confirm the panel shows `No YouTube lifecycle events yet.` when the local database has no lifecycle events
- Confirm the response does not expose credential references or token material

## Hardening Validation
- Tested: token-like warning/error text is redacted before it reaches the UI
- Tested: the lifecycle object only exposes sanitized fields and does not surface raw event data
- Tested: the rendered lifecycle fragment stays read-only and does not add upload, OAuth, or Keychain controls
- Deferred: richer drill-in history, alerting, and any workflow that would mutate upload state
- Deferred: dashboard polling or any new YouTube API access path from the UI

## What the Dashboard Does Not Do
- It does not upload video
- It does not exchange OAuth codes
- It does not read or write Keychain
- It does not call YouTube APIs
- It does not change privacy settings
- It does not poll status on a timer

## Next Possible Phases
- Dashboard filters for lifecycle history
- Read-only drill-in views for a single known upload
- Optional alerting on failed or stalled lifecycle states
- Keep all upload, OAuth, and credential actions outside the dashboard
