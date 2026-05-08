# Video Orchestrator Phase 3D - YouTube Credential and OAuth Design

## Purpose

Phase 3D defines the credential and OAuth boundary for a future YouTube upload adapter without enabling any real upload or secret handling.

## What This Phase Does

- Defines the future OAuth flow shape for YouTube
- Defines credential boundaries and approved storage patterns
- Defines the local callback shape for a future OAuth setup flow
- Defines preflight checks and failure modes for credential readiness
- Defines idempotency and duplicate-prevention expectations
- Defines the approval checklist required before any real upload phase

## What This Phase Explicitly Does Not Do

- No OAuth execution
- No token storage
- No YouTube API calls
- No upload implementation
- No browser automation
- No `.env` changes
- No client secret files in the repo
- No refresh token or access token handling
- No Google client libraries

## Official YouTube Constraints

- YouTube Data API authorization uses OAuth 2.0 for user/channel upload flows.
- Service accounts are not supported for YouTube Data API channel upload flows.
- `videos.insert` is the upload method and requires authorization plus media upload support.
- The recommended initial scope for upload is `https://www.googleapis.com/auth/youtube.upload`.
- `videos.insert` currently costs 1600 quota units per call in the published docs.
- Unverified API projects created after July 28, 2020 may be restricted to private viewing until verification/compliance review is completed.

## OAuth App Requirements

- The app must be created outside this repo.
- The YouTube Data API must be enabled in the Google Cloud project.
- OAuth consent screen setup must be complete.
- The upload flow must use a user-owned YouTube channel, not a service account.

## Local Callback Design

- The user explicitly starts OAuth setup from a local CLI or local dashboard action.
- The callback server binds only to localhost.
- The callback path should be fixed and documented, such as `http://127.0.0.1:<port>/oauth/youtube/callback`.
- A state parameter is required.
- PKCE is preferred when compatible with the chosen OAuth client type.

## Token Storage Decision Options

### Recommended

- Store tokens in macOS Keychain through a small local helper.
- Store only a credential reference or keychain label in the database.

### Acceptable Future Alternative

- Use an encrypted local credential vault outside the repo.

### Not Allowed

- `.env` files
- committed JSON token files
- repo-local token caches
- plaintext database rows for access or refresh tokens

## Recommended Token Storage Approach

Use macOS Keychain for local secrets, with the worker storing only a reference key and non-secret account metadata.

## Scope Selection

Start with:

- `https://www.googleapis.com/auth/youtube.upload`

Do not widen the scope unless a later feature demonstrates a concrete need.

## Quota Implications

- `videos.insert` is quota-expensive and should be preflighted before upload jobs.
- Upload jobs should confirm available quota policy before attempting real network calls.

## Audit and Private Upload Implications

- Default privacy should be `private` until the user explicitly selects otherwise.
- Unverified project behavior can force private viewing until review is complete.
- The adapter must preserve a manual fallback path even after credential handling exists.

## Credential Preflight Design

Credential preflight should validate:

- A credential reference exists
- A local callback registration has been configured
- The selected scope matches the upload intent
- The account/channel is the expected one
- Token storage is present in the approved local secret store
- Logging redaction is active before any real upload phase

Credential preflight should not:

- read tokens into logs
- print client secrets
- call YouTube
- mutate media artifacts

## Failure Modes

- Missing credential reference
- Missing local callback registration
- Missing or invalid scope selection
- Missing keychain entry
- Unverified project restrictions
- Quota exhaustion or policy block
- Manual fallback required

## Idempotency and Duplicate-Prevention Rules

- Idempotency should include platform, package target, video identity, and upload intent.
- The worker should avoid duplicate upload attempts when a matching successful upload record already exists.
- Duplicate suppression must not depend on secrets being logged or exposed.

## Manual Fallback Rules

- Manual upload remains the safe fallback until a real upload phase is explicitly approved.
- Any credential issue should preserve the manual package export path.
- A blocked or unverified credential state must not break production package generation.

## Approval Checklist Before Phase 3E

- [ ] OAuth app created outside the repo
- [ ] YouTube Data API enabled
- [ ] Redirect URI approved for localhost callback
- [ ] Scope selection approved
- [ ] Token storage implementation approved
- [ ] Logging redaction verified
- [ ] Quota policy reviewed
- [ ] Private-upload restriction understood
- [ ] Manual fallback verified
- [ ] User explicitly approves real network upload

