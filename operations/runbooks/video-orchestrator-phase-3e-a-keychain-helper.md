# Video Orchestrator Phase 3E-A - Keychain Credential Helper Scaffold

## Purpose

Phase 3E-A defines a local-only helper scaffold for future YouTube credential references. It standardizes how credentials will be named, redacted, and dry-run checked without reading or writing real secrets.

## What This Phase Does

- Validates credential reference strings
- Documents the expected Keychain reference shape
- Provides dry-run output for future Keychain read/write command shapes
- Redacts sensitive-looking values from logs or pasted text
- Adds placeholder-only sample configs for credential references
- Records the OAuth scaffold boundary for future implementation work

## What This Phase Does Not Do

- No OAuth execution
- No token exchange
- No token storage
- No Keychain read or write by default
- No YouTube API calls
- No upload implementation
- No Google client libraries
- No `.env` values
- No committed credential files
- No browser automation

## Credential Reference Format

Expected reference shape:

```text
keychain://video-orchestrator/youtube/<account-label>
```

Rules:

- Scheme must be `keychain://`
- Service path must begin with `video-orchestrator`
- Supported platform in this phase is `youtube`
- Account label must be non-empty and must not contain traversal or shell-dangerous characters

## Helper Script Usage

The helper script lives at:

```text
tools/scripts/video-orchestrator-credential-helper.mjs
```

Supported commands:

- `validate-ref <credential_reference>`
- `redact <text>`
- `dry-run-keychain-read <credential_reference>`
- `dry-run-keychain-write-placeholder <credential_reference>`
- `self-test`

## Dry-Run Read/Write Behavior

The helper only prints the future command shape.

- `dry-run-keychain-read` prints what a read would target, but does not call `security`
- `dry-run-keychain-write-placeholder` prints a placeholder write shape, but does not write to Keychain
- A real write is intentionally not implemented in this phase

## Redaction Behavior

The helper redacts:

- access tokens
- refresh tokens
- client secrets
- authorization codes
- Bearer tokens
- private key blocks
- common API key-looking values

Redaction is used for logs, self-tests, and any future credential-adjacent diagnostics.

## Future OAuth Setup Shape

The future OAuth flow should be local-first:

- user explicitly starts setup
- callback server binds to localhost only
- fixed callback path such as `http://127.0.0.1:<port>/oauth/youtube/callback`
- state parameter required
- PKCE preferred when compatible
- tokens stored in macOS Keychain, not repo files

## Approval Gate Before Real OAuth Token Exchange

Before any real OAuth token exchange, confirm:

- OAuth app exists outside the repo
- YouTube Data API is enabled
- redirect URI is approved
- token storage approach is approved
- logging redaction is verified
- manual fallback remains available

## Approval Gate Before Real YouTube Upload

Before any real upload, confirm:

- OAuth is approved and tested
- credential storage is in the approved local store
- quota behavior is accepted
- privacy default and private-only risks are understood
- no secrets are logged or committed
- a rollback path remains available

## Manual Fallback Requirement

Manual upload remains the safe fallback until a later phase explicitly enables real network upload.

