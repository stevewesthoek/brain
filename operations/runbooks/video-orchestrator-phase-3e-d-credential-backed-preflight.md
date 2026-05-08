# Video Orchestrator Phase 3E-D - Credential-Backed YouTube Upload Preflight

## Purpose

Phase 3E-D adds a redacted, credential-backed preflight for YouTube dry-run jobs. It verifies that a Keychain credential reference exists and summarizes token readiness without exposing token values or contacting YouTube.

## What This Phase Does

- Validates a YouTube Keychain credential reference
- Reads only a redacted Keychain summary when explicitly requested
- Reports whether access and refresh tokens appear present
- Reports whether the stored scope includes `https://www.googleapis.com/auth/youtube.upload`
- Keeps dry-run behavior, manual fallback, and upload avoidance intact

## What This Phase Does Not Do

- No YouTube upload
- No `videos.insert`
- No YouTube API call
- No refresh-token flow
- No browser automation
- No Keychain write or delete as part of preflight
- No raw token values in logs, JSON, or events
- No `.env` changes
- No Google client libraries
- No dependency changes

## Helper Command Usage

The helper script lives at:

```text
tools/scripts/video-orchestrator-credential-helper.mjs
```

Relevant read-only command:

- `keychain-summary-youtube-token <credential_reference> --confirm-real-keychain-read`

This command returns redacted summary JSON only. It must never print raw token values.

## Worker Credential-Backed Preflight Behavior

When a YouTube dry-run job sets `credential_preflight_only: true` and provides a valid `credential_reference`, the worker may invoke the helper and merge redacted credential metadata into the posting result.

Expected metadata fields:

- `credential_preflight_only: true`
- `credential_reference_present`
- `credential_reference_format`
- `credential_summary_checked`
- `credential_found`
- `access_token_present`
- `refresh_token_present`
- `scope_youtube_upload_present`
- `token_value_printed: false`
- `upload_performed: false`
- `network_calls: 0`

## Missing Credential Behavior

- Missing credential references should return a blocked or warning preflight result, not a dead-lettered job
- If the Keychain entry is absent, the worker should report that absence in redacted metadata
- Execution must still avoid upload and network calls

## Malformed Credential Behavior

- Malformed or unsupported credential references should block safely
- No helper token read should occur for malformed references
- No raw error text containing secrets may be emitted

## Redaction Guarantees

- No token values are printed
- No authorization codes are printed
- No client secrets are printed
- Helper errors must be redacted before being returned

## Manual Fallback

Manual upload remains the fallback path until a later phase explicitly approves real upload behavior.

## Next Phase Gate Before Real Upload

Before any YouTube upload work:

- credential-backed preflight must be validated
- redacted summary behavior must be verified
- no token values may appear in repo files or logs
- the upload adapter must remain separate from the preflight-only path

