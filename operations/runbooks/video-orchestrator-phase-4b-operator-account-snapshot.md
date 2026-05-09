# Video Orchestrator Phase 4B - Operator Account Snapshot + Nightly Health Job

## Purpose
Phase 4B turns the account-health tool into a set-and-forget local operational flow.

The operator keeps a local, untracked account registry under `runtime/local`, and the nightly job writes a safe snapshot that the dashboard can read without exposing secrets or credential material.

This phase does not add upload capability. It only makes the Phase 4A health center operationally easier to use.

## Local Paths
Use these operator-owned paths:

- `runtime/local/video-orchestrator/account-registry.local.json`
- `runtime/local/video-orchestrator/account-health-snapshot.json`
- `runtime/local/video-orchestrator/account-health.log`

These files must remain untracked.

## Credential Reference Compatibility
The canonical local registry field is `credential_reference`.

The CLI tolerates `credentialReference` for imported or ad-hoc configs, but schema-valid registry files should use `credential_reference`.

Snapshots and dashboard output must expose neither field.

## Initialize the Local Registry
Start from the placeholder example:

```bash
node tools/scripts/video-orchestrator-account-health.mjs init-local-registry
```

This copies `operations/specs/video-orchestrator/examples/account-registry.example.json` to `runtime/local/video-orchestrator/account-registry.local.json`.

Use `--force` only if you intentionally want to replace the local registry:

```bash
node tools/scripts/video-orchestrator-account-health.mjs init-local-registry --force
```

The local registry may contain:
- account labels
- display names
- credential references

It must never contain:
- token JSON
- client secrets
- passwords
- cookies
- OAuth codes

Do not commit the local registry.

## Nightly Snapshot Workflow
Run the snapshot job against the local registry:

```bash
node tools/scripts/video-orchestrator-account-health.mjs write-nightly-snapshot \
  runtime/local/video-orchestrator/account-registry.local.json \
  --snapshot runtime/local/video-orchestrator/account-health-snapshot.json \
  --dry-run >> runtime/local/video-orchestrator/account-health.log 2>&1
```

The snapshot is safe for the dashboard because it is redacted and does not include:
- credential references
- token values
- Keychain labels
- OAuth material

The dashboard reads the snapshot only. It does not read the operator registry directly.

## Dashboard Behavior
The dashboard shows the Account Health Center from the snapshot file when it exists.

It shows:
- platform
- display name
- account label, if safe
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

## Scheduler Notes
Add the nightly snapshot command to the existing local scheduler pattern used on this machine.

Keep the job:
- dry-run only
- snapshot-only
- untracked
- non-fatal if the registry is missing or invalid

The repo does not need an enabled destructive job definition for this phase.

## Troubleshooting
Use the status colors:
- `green`: ready
- `yellow`: needs attention soon
- `red`: blocked or invalid
- `grey`: disabled or manual-only

If a row turns red:
- confirm the credential reference shape
- confirm the Keychain payload still exists
- confirm the YouTube upload scope is present for private-upload use cases
- confirm the account remains private-only

If a row turns yellow:
- check for missing refresh metadata
- check expiry warnings
- run the private-upload readiness dry-run again

If a row is grey:
- the account is disabled or manual-only by design

## Private Upload Readiness
Use the readiness dry-run command before the first real private upload:

```bash
node tools/scripts/video-orchestrator-account-health.mjs readiness-youtube-private-upload \
  runtime/local/video-orchestrator/account-registry.local.json \
  <account_id> \
  --video-id <video_id> \
  --package-target <target> \
  --dry-run
```

The command returns `requires_manual_confirmation: true`. It does not upload.

## What This Phase Does Not Do
- No upload capability
- No public uploads
- No unlisted uploads
- No bulk scheduling
- No thumbnail upload
- No caption upload
- No new platform adapters
- No dashboard OAuth/login controls
- No secrets in the repository

## Future Phases
- multi-account scheduling
- richer alerting
- optional dashboard drill-in views
- future account types after separate review
