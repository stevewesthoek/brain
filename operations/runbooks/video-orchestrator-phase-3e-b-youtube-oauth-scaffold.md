# Video Orchestrator Phase 3E-B - YouTube OAuth Setup Scaffold

## Purpose

Phase 3E-B adds a local-only OAuth setup scaffold for future YouTube uploads. It generates authorization metadata, validates callback shape, and validates PKCE/state boundaries without exchanging tokens or storing credentials.

## What This Phase Does

- Generates PKCE verifier/challenge pairs
- Generates state nonces
- Builds a YouTube OAuth authorization URL from placeholder config
- Validates redirect/callback shape and state
- Redacts sensitive-looking values in diagnostic output
- Keeps credential references local-only and non-secret

## What This Phase Does Not Do

- No OAuth token exchange
- No token storage
- No Keychain read or write
- No YouTube API calls
- No upload
- No browser automation
- No Google client libraries
- No `.env` values
- No client secrets in the repo

## Helper Commands

The helper script lives at:

```text
tools/scripts/video-orchestrator-credential-helper.mjs
```

New OAuth scaffold commands:

- `generate-pkce`
- `generate-state`
- `build-youtube-auth-url <config_path>`
- `validate-callback <callback_url> --expected-state <state>`
- `oauth-self-test`

## Sample Config

Use the placeholder-only config at:

```text
operations/specs/video-orchestrator/examples/sample-youtube-oauth-setup-config.json
```

The config is dry-run only and must not contain real credentials.

## PKCE Behavior

- PKCE uses S256
- The helper generates a code verifier and code challenge
- Real verifier values must not be logged or committed

## State Behavior

- The helper generates a local state nonce
- The state is only for transient local memory in a future real flow
- Callback validation must reject mismatched state

## Authorization URL Behavior

- The helper builds a Google authorization URL from placeholder config
- It does not open a browser
- It does not contact Google
- It does not exchange an authorization code

## Callback Validation Behavior

- Callback URLs must be localhost-only
- Callback path must be `/oauth/youtube/callback`
- State must match the expected state
- Authorization code presence may be reported, but the code itself must never be printed

## Redaction Rules

The helper redacts:

- access tokens
- refresh tokens
- client secrets
- authorization codes
- Bearer tokens
- private key blocks
- common API-key-looking values

## Approval Gate Before Real Token Exchange

Before any real token exchange:

- OAuth app must already exist outside the repo
- redirect URI must be approved
- PKCE/state handling must be confirmed
- log redaction must be verified
- manual fallback must remain available

## Approval Gate Before Real Upload

Before any real upload:

- token storage must be approved
- quota and privacy behavior must be accepted
- no secrets may be logged or committed
- a rollback path must remain available

## Manual Fallback

Manual upload remains the safe fallback until a later phase explicitly enables real network upload.

## Testing Instructions

- Run the helper self-test
- Run the OAuth scaffold self-test
- Validate the sample config JSON
- Verify no real tokens, secrets, or Keychain operations occur

