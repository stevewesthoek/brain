# Video Orchestrator Phase 3Z - Security, Operations, and End-to-End Readiness Review

## Executive Summary
Phase 3Z is a review and hardening phase, not a capability phase. It confirms the current Video Orchestrator boundary after the recent YouTube credential, upload, lifecycle, dashboard, and oMLX sidecar work. It does not add runtime behavior.

The current implementation includes a private-only YouTube upload path, upload lifecycle/status handling, a read-only lifecycle dashboard surface, and an optional MacBook oMLX sidecar for low-risk text tasks. The review confirms that the system still relies on manual fallback and that broader upload modes remain disabled.

## Phase Inventory
- Phase 2A: package specs, schema, and docs
- Phase 2B: PostgreSQL queue, worker, and dashboard MVP
- Phase 2C: local FFmpeg/thumbnail adapters and Whisper.cpp fallback
- Phase 3A: manual upload adapter
- Phase 3B: posting adapter registry
- Phase 3C: YouTube dry-run preflight
- Phase 3D: YouTube credential and OAuth boundary design
- Phase 3E-A through 3E-G: helper, OAuth scaffold, token prototype, credential-backed preflight, private upload, lifecycle handling, and dashboard surfacing
- Phase 3X: localhost-only oMLX provider MVP
- Phase 3Y: MacBook oMLX sidecar worker

## Current Capabilities
- Private-only YouTube upload exists for a single approved job
- Lifecycle/status checks can read redacted status for known uploads
- The dashboard can display read-only lifecycle summaries
- oMLX can generate low-risk local text variants
- A trusted Thunderbolt sidecar can be used for text-only jobs when explicitly enabled

## Explicitly Disabled Capabilities
- Public YouTube uploads
- Unlisted YouTube uploads
- Bulk uploads
- Thumbnail upload
- Caption upload
- Playlist insertion
- Comment or community posting
- OAuth controls in the dashboard
- Upload controls in the dashboard
- Keychain access in the dashboard
- Browser automation
- Remote sidecar secret handling

## YouTube Upload Boundary
The first private upload adapter is intentionally narrow:
- platform must be `youtube`
- adapter mode must be `api`
- dry run must be false
- `real_upload_approved` must be true
- privacy must be private
- upload-ready packages only
- duplicate successes must be blocked by idempotency
- manual fallback remains available

What is still not verified by this review:
- a real private upload smoke test may still be skipped unless the operator explicitly runs one
- quota behavior remains treated as re-verification-required
- private viewing behavior for unverified projects remains an external platform risk

## Token / Keychain Boundary
- Token payloads are stored only in macOS Keychain
- Token values are never logged by the helper, worker, or dashboard
- Token values are not stored in DB rows
- Token values are not stored in repo files
- `.env` is not used for tokens
- Refresh remains explicit and guarded

## Dashboard Boundary
- The dashboard surface is read-only
- It shows lifecycle state, counts, timestamps, and redacted warnings/errors
- It does not show credential references, token values, or Keychain labels
- It does not add upload, OAuth, or polling controls
- It does not call YouTube or Keychain helpers

## oMLX Sidecar Boundary
- The MacBook sidecar is opt-in
- `trusted_thunderbolt_lan` requires explicit opt-in
- public IPs are rejected
- secret-shaped payload keys are blocked before remote calls
- the runtime remains limited to `metadata_variants`
- the sidecar is non-fatal if unavailable
- no posting, upload, or media generation routes to the sidecar

## Manual Fallback Boundary
Manual upload remains the fallback when:
- upload approval is not present
- credentials are unavailable or malformed
- the sidecar is unavailable
- lifecycle checks cannot confirm a known upload
- the operator wants a human-reviewed handoff

## Idempotency and Lifecycle Status
Lifecycle handling is conservative:
- not_started
- uploading
- uploaded
- processing
- available_private
- failed
- unknown

The worker emits redacted lifecycle metadata only. Status checks are only for known orchestrator-owned uploads.

## Validation Commands and Expected Results
- `node tools/scripts/video-orchestrator-credential-helper.mjs self-test`
- `node tools/scripts/video-orchestrator-credential-helper.mjs oauth-self-test`
- `node tools/scripts/video-orchestrator-credential-helper.mjs token-self-test`
- `cd projects/probot && npm run typecheck`
- `cd projects/probot && npm test`
- `projects/probot/node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck operations/specs/video-orchestrator/video-orchestrator-worker.ts`
- `find operations/specs/video-orchestrator -name "*.json" -print0 | xargs -0 -n1 python3 -m json.tool >/dev/null`
- `node tools/scripts/switch-skill-profile.mjs default --check`
- `node tools/scripts/sync-ai-skills.mjs --check`

Expected result:
- typecheck passes
- tests pass
- JSON parses cleanly
- helper self-tests pass
- skill sync remains intact

## Operational Risks
- A private upload can still fail due to upstream OAuth or quota issues
- Unverified-project private visibility may still be restricted by Google policy
- A MacBook sidecar can disappear when the machine sleeps or loses network reachability
- Read-only lifecycle data can lag behind the actual YouTube state

## Known Limitations
- No public or unlisted upload support
- No thumbnail or caption upload
- No bulk scheduler
- No dashboard mutation controls
- No arbitrary video polling
- No new runtime capability in this phase

## First Real Private Upload Readiness
The implementation is close to operational readiness, but the operator still needs to confirm:
- a real private upload has been executed intentionally
- the credential and Keychain flow work with a real account
- quota assumptions remain acceptable
- dashboard/lifecycle data stays redacted
- manual fallback is still available

## Go / No-Go Checklist
- [ ] Private-only upload path remains the only enabled upload path
- [ ] Dashboard remains read-only
- [ ] Token values never appear in logs, events, or UI
- [ ] Sidecar remains opt-in and text-only
- [ ] Manual fallback remains available
- [ ] Real private upload smoke test has been explicitly approved if the team wants full operational sign-off

## Recommended Next Phases
- Use the first real private upload checklist before attempting any operator run
- Add alerting only if lifecycle monitoring proves noisy or incomplete
- Keep public, unlisted, bulk, thumbnail, and caption upload out of scope until separately reviewed
- Keep the MacBook sidecar optional and narrow
