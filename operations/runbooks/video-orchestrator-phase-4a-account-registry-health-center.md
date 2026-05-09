# Video Orchestrator Phase 4A - Account Registry + Credential Health Center

## Purpose
Phase 4A turns the manual first-private-upload checklist into a read-only account registry and health center. It gives operators one place to register placeholder accounts, inspect credential readiness, and run automated dry-run checks before attempting a real private upload.

This phase is a foundation step. It does not widen the upload surface.

## Why This Exists
The first private upload path is operationally usable, but the operator workflow is too manual:
- credential readiness must be checked separately
- upload-ready package verification is fragmented
- the dashboard does not show account-specific readiness
- there is no central registry for placeholder account entries and future expansion

Phase 4A addresses that gap without adding any new publishing capability.

## Account Registry Format
Use `operations/specs/video-orchestrator/account-registry.schema.json`.

The registry supports:
- `schema_version`
- `accounts`
- `account_id`
- `platform`
- `account_label`
- `display_name`
- `enabled`
- `auth_mode`
- `credential_reference` only for credential-backed account modes
- `capabilities`
- `default_privacy`
- `allowed_privacy`
- `rate_limits`
- `cooldowns`
- `health_check`
- `notification_policy`
- `notes`

Rules:
- YouTube accounts must default to `private`
- YouTube `allowed_privacy` must stay `["private"]` in this phase
- placeholder values only in repo examples
- no token JSON
- no client secrets
- no browser auth state
- no secret storage in repo files

## Health Statuses
The account-health script uses four statuses:
- `green` for ready accounts with valid credential references and usable token summaries
- `yellow` for accounts that are enabled but need action soon, such as missing refresh metadata or expiry uncertainty
- `red` for invalid credential references, missing required credentials, scope failures, helper failures, or other blocked states
- `grey` for disabled or manual-only accounts

## Token Expiry and Revocation Model
Operators must treat token health as time-sensitive.

Important Google refresh-token risks:
- External Testing mode refresh tokens expire after 7 days
- refresh tokens can be revoked by the user
- refresh tokens can expire after six months unused
- per-client token limits can invalidate older refresh tokens

That means a valid account today can still fail later. The health center is meant to surface that drift early.

## Dashboard Behavior
The dashboard shows a read-only Account Health panel:
- platform
- display name
- account label when safe
- auth mode
- status
- capability summary
- last checked timestamp
- next action
- manual fallback
- notification state

It does not show:
- credential references
- token values
- Keychain labels
- OAuth codes
- client secrets

The dashboard does not perform Keychain reads, token exchange, or upload actions.

## Nightly Health Check Behavior
The account-health script can be run nightly in dry-run mode to keep an operational signal on account readiness.

Suggested use:
- run `check-all` against the registry
- write a safe snapshot to `runtime/local/video-orchestrator/account-health-snapshot.json`
- let the dashboard read that snapshot
- keep the snapshot out of version control

The snapshot must not contain:
- credential references
- token values
- Keychain labels
- secrets

## Readiness Dry-Run Command
The readiness command automates as much of the first-private-upload checklist as can be checked locally:
- registry validation
- credential reference validation
- Keychain summary check through the existing safe helper boundary
- PostgreSQL reachability, if available
- package target existence and `upload_ready` state, if available
- manual fallback confirmation

The command must still return `requires_manual_confirmation: true`.

It must not:
- upload anything
- refresh tokens
- display tokens
- call YouTube upload endpoints
- introduce public or unlisted upload checks

## What This Phase Does Not Do
- No upload capability
- No public uploads
- No unlisted uploads
- No bulk scheduling
- No thumbnail upload
- No caption upload
- No new platform adapters
- No dashboard login or OAuth controls
- No secrets in the repository

## Future Phases
- multi-account scheduling
- platform-specific health policies
- richer alerting on failed or yellow states
- optional dashboard drill-in views
- future account types, only after separate review

