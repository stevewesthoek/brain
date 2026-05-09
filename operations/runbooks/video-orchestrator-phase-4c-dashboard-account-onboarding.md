# Video Orchestrator Phase 4C - Dashboard Account Onboarding + OAuth Connect Flow

## Purpose
Phase 4C makes the ProBot dashboard the operator entry point for YouTube account onboarding and OAuth connection.

Manual JSON editing is no longer the normal workflow. The dashboard becomes the central place to add accounts, connect YouTube, inspect safe health, and regenerate the local snapshot.

This phase does not add any upload capability.

## Dashboard-First Onboarding
Use the dashboard to:
- add a YouTube account
- set `account_id`
- set `account_label`
- set `display_name`
- enable the account when ready
- connect YouTube with OAuth
- refresh health
- regenerate the safe snapshot

The registry and snapshot remain internal runtime artifacts under `runtime/local/video-orchestrator/`.

## What the Dashboard Does Not Show
The UI must not display:
- credential references
- token values
- OAuth codes
- Keychain labels
- client secrets

## OAuth Client Setup
Phase 4C uses PKCE public-client mode.

The dashboard stores the OAuth client ID in a local runtime file and keeps the token boundary in macOS Keychain.

The operator should:
- configure the client ID from the dashboard
- keep the client secret out of the repo
- avoid manual JSON editing for normal onboarding

If OAuth client configuration is missing, the dashboard should show that it is not configured and provide the setup entry point.

## OAuth Client Modes
Current Phase 4C mode:
- `pkce_public_client`
- dashboard stores `client_id` only
- no `client_secret` is stored in runtime JSON
- token exchange uses PKCE
- if Google client requires a client secret, connection may fail safely

Future mode:
- `client_secret_keychain`
- client secret stored in macOS Keychain
- dashboard must never display it
- runtime JSON stores only a reference or boolean, not the secret

No JSON editing is the normal workflow.
The dashboard is the operator workflow.
A one-time Google Cloud OAuth client still must exist outside the repo.
The dashboard can store a local client ID and later support Keychain-backed client-secret mode.

## YouTube Connect Flow
1. Add the YouTube account in the dashboard.
2. Click Connect YouTube.
3. The dashboard generates PKCE and state locally.
4. The dashboard opens the Google OAuth authorization URL.
5. Google redirects to the local callback route.
6. The callback exchanges the code for tokens.
7. Tokens are stored only in macOS Keychain.
8. The local registry is updated.
9. The safe snapshot is regenerated.

The connect flow does not upload anything.

## Keychain Boundary
Only OAuth token payloads belong in macOS Keychain.

The dashboard and snapshot must not store:
- access tokens
- refresh tokens
- client secrets
- OAuth codes

## Registry and Snapshot Updates
Account saves and OAuth callback success should regenerate the safe snapshot automatically.

The dashboard should read the snapshot only for health display.

## Refresh and Revocation Model
Tokens may expire or be revoked. Health checks should surface that drift.

The operator must still expect:
- refresh token expiration
- user revocation
- inactivity expiration
- per-client token limits

## Health Status Behavior
Use the existing green/yellow/red/grey model:
- green: ready
- yellow: needs attention soon
- red: blocked or invalid
- grey: disabled or manual-only

## Troubleshooting
- If connect fails, check the local OAuth client config.
- If callback fails, check the redirect URI and state.
- If health stays red, re-check the Keychain token summary.
- If health stays grey, confirm the account is enabled.

## What This Phase Does Not Do
- No upload
- No videos.insert
- No public or unlisted publishing
- No bulk or scheduled posting
- No thumbnail or caption upload
- No new platform adapters
- No token display
- No credential-reference display
- No `.env` storage
