# Video Orchestrator Phase 3E-E - First Private YouTube Upload Adapter

## Purpose

Phase 3E-E adds the first narrowly gated private YouTube upload path. It is intended for one job, one package target, one account, and one private upload at a time.

## Hard Gates

The upload path only runs when all of these are true:

- `platform = youtube`
- `adapter_mode = api`
- `dry_run = false`
- `youtube.real_upload_approved = true`
- `youtube.privacy_status = private` or omitted and defaulted to private
- package target exists and is upload-ready
- the video file is real media
- the credential reference is valid
- the credential summary/token payload is present and scope-ready
- idempotency indicates this upload has not already succeeded
- the job config explicitly enables upload for this one run

## What This Phase Does

- Reads a YouTube OAuth token payload from macOS Keychain
- Refreshes the access token only when explicitly allowed and needed
- Stores refreshed token payloads back in Keychain through the same safe worker path
- Uploads one private video file to YouTube using `videos.insert`
- Emits private-upload success/failure audit events
- Preserves manual fallback

## What This Phase Does Not Do

- No public or unlisted uploads
- No bulk upload
- No scheduling
- No multi-account distribution
- No thumbnail upload
- No caption upload
- No playlist insertion
- No comments or community posts
- No browser automation
- No token files
- No `.env`
- No token values in logs or DB rows
- No Google client libraries unless later work explicitly requires them

## Token Handling Rules

- Tokens are read from macOS Keychain only
- Raw token values stay inside worker memory
- Token values must never be logged
- Refresh is disabled unless `youtube.allow_token_refresh = true`
- Refreshed tokens are written back to Keychain only

## Privacy Rules

- Uploads in this phase are private-only
- Public and unlisted uploads remain out of scope
- The upload config must not override privacy away from private

## Idempotency Rules

- The worker computes an idempotency key from the job, package target, credential reference, video path, and title
- If a previous successful private upload exists for that key, the job skips as already uploaded
- The existing YouTube video ID should be reused when available

## Quota and Private Viewing Warning

- Treat the quota cost as conservative and re-verify before production use
- Unverified projects may remain private-only until audit/compliance review

## Rollback and Manual Fallback

- Manual upload remains the fallback path
- If private upload is blocked or fails, the worker should emit a redacted failure and keep manual export available

## Out of Scope

- Thumbnail upload
- Caption upload
- Public or unlisted publishing
- Bulk publishing
- Upload polling and later lifecycle management

## Testing Instructions

- Validate the sample private upload config
- Verify dry-run false with `real_upload_approved = false` blocks
- Verify `privacy_status = public` blocks
- Verify `privacy_status = unlisted` blocks
- Verify `upload_ready = false` blocks
- Verify invalid credential references block
- Verify idempotent duplicates skip

## Approval Checklist

- One private test upload is approved
- A real credential reference exists in Keychain
- The package target is upload-ready
- The upload job is explicitly enabled for this run
- Manual fallback is still acceptable if the upload blocks or fails

