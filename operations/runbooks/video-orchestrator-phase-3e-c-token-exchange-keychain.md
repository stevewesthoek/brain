# Video Orchestrator Phase 3E-C - YouTube OAuth Token Exchange + Keychain Storage Prototype

## Purpose

Phase 3E-C provides a CLI-only prototype for exchanging a YouTube authorization code for tokens and storing those tokens in macOS Keychain. It is intentionally gated, manual, and local-only.

## What This Phase Does

- Exchanges a user-provided authorization code for tokens using Node fetch
- Writes OAuth token JSON to macOS Keychain when explicitly approved
- Reads token JSON from macOS Keychain for validation when explicitly approved
- Deletes token JSON from macOS Keychain when explicitly approved
- Keeps all token material out of repo files, `.env`, logs, and output JSON
- Redacts sensitive-looking values in summaries and tests

## What This Phase Does Not Do

- No YouTube upload
- No `videos.insert`
- No YouTube API publishing calls
- No browser automation
- No automatic browser open
- No Google client libraries
- No `.env`
- No committed token files
- No OAuth cache files

## Approval Boundary

Real token exchange, Keychain write, Keychain read, and Keychain delete all require explicit confirmation flags. Without those flags, the helper must refuse with safe JSON.

## Helper Commands

The helper script lives at:

```text
tools/scripts/video-orchestrator-credential-helper.mjs
```

Relevant commands:

- `exchange-youtube-code <config_path> --callback-url <callback_url> --expected-state <state> --code-verifier <code_verifier> --write-to-keychain <credential_reference> --confirm-real-token-exchange --confirm-real-keychain-write`
- `keychain-write-youtube-token <credential_reference> --token-json-stdin --confirm-real-keychain-write`
- `keychain-read-youtube-token <credential_reference> --confirm-real-keychain-read`
- `keychain-delete-youtube-token <credential_reference> --confirm-real-keychain-delete`
- `token-self-test`

## Safe Workflow

1. Generate an auth URL in Phase 3E-B.
2. Obtain the callback URL and authorization code manually.
3. Run the exchange command with explicit confirmation flags.
4. Write tokens directly to Keychain.
5. Verify the stored credential with a redacted read summary.
6. Delete the credential when done or during cleanup.

## Unsafe Workflows to Avoid

- Saving raw token JSON to disk
- Copying tokens into `.env`
- Printing client secrets or authorization codes
- Calling the YouTube upload API from this phase
- Logging the raw callback URL if it contains sensitive query parameters

## Callback and PKCE Expectations

- Phase 3E-B generates the authorization URL, state, and PKCE verifier/challenge.
- Phase 3E-C uses the callback code and expected state from that setup.
- The code verifier must be supplied explicitly and must be PKCE-shaped.

## Keychain Behavior

- Service name: `video-orchestrator/youtube`
- Account comes from the validated credential reference
- Token JSON is stored in macOS Keychain only
- Reads and deletes require explicit confirmation flags

## Redaction Rules

- Never print access tokens, refresh tokens, client secrets, or authorization codes
- Print only presence/absence and safe metadata
- All error paths must redact suspicious values before returning them

## Manual Fallback

Manual upload remains the fallback until a later phase explicitly approves real upload.

## Next Phase Gate Before Upload

Before any upload work:

- token exchange prototype must be validated
- Keychain storage behavior must be approved
- redaction behavior must be verified
- no token material may appear in repo files or logs

