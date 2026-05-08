# Video Orchestrator Phase 3C - YouTube Dry-Run Preflight

## Purpose

Phase 3C adds a YouTube-specific dry-run adapter that validates package readiness and emits audit output without credentials or upload.

## What It Does

- Validates the package target is `youtube/long-form`
- Validates title and description presence and length
- Verifies the video is real media
- Checks thumbnail and caption availability
- Reads YouTube metadata shape from task config
- Computes an idempotency key for later phases
- Emits dry-run audit events

## What It Does Not Do

- No OAuth
- No tokens
- No credential storage
- No browser automation
- No YouTube API calls
- No uploads

## Required Readiness

- A schema-valid production package manifest exists
- The target package is upload-ready or otherwise explicitly accepted for dry-run validation
- The target video file exists and is real media

## YouTube Config Fields

- `privacy_status`: private, unlisted, or public
- `made_for_kids`: boolean
- `category_id`: string or number
- `notify_subscribers`: boolean
- `license`: string
- `embeddable`: boolean
- `public_stats_viewable`: boolean

Default privacy is `private`.

## Expected Dry-Run Output

- `validateConfig` passes for valid package/config shape
- `validateCredentials` returns dry-run-safe output without reading secrets
- `preflight` reports readiness and warnings
- `execute` returns a dry-run result with `idempotency_key`, metadata, and `network_calls: 0`

## Credential Boundary

Credential readiness is intentionally not checked in Phase 3C. No secrets are read, persisted, or logged.

## Phase 3D

Phase 3D can add real upload only after a separate credential, approval, and network design is intentionally introduced.

## Recommendation

Keep the manual export adapter as the fallback path until a real platform adapter is explicitly approved and implemented.
