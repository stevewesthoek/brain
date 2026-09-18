# Agent Mode production release closeout — 2026-09-18

## Status

**CLOSEOUT PASS — ordinary release maintenance active.** This is a
documentation and operational handoff for the completed RC.6 activation. No
production deployment, feature implementation, provider call, service restart,
StateStore mutation, backup creation, restore, or release successor was
performed during this closeout.

- Starting repository HEAD: `8ffdbaf6 ops(agent-mode): activate rc6 in production`.
- Foundation roadmap: **COMPLETE through H0**.
- Release-maintenance baseline: **COMPLETE**.
- Current lane: **ORDINARY RELEASE MAINTENANCE**.
- Successor foundation phase: **NONE AUTHORIZED**.
- Current production release: **1.0.0-rc.6 / PRODUCTION_ACTIVE**.
- Current rollback baseline: **ROLLBACK_SUPPORTED**.

## Current production identity

Read-only launchd and metadata reconciliation confirmed:

- Core PID: `57428`, launchd label `com.office.brain-core`.
- Console PID: `57784`, launchd label `com.office.brain-console`.
- Runtime root:
  `/Users/Office/Library/Application Support/Brain/agent-mode-rc6`.
- Immutable release root:
  `/Users/Office/Library/Application Support/Brain/agent-mode-rc6/releases/brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Release version: `1.0.0-rc.6`.
- Package ID:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Package manifest hash:
  `18f8c9571be1403aec9bf785a7949baa2e6508da276e1e2cf9f3dfacd7ae3b8a`.
- Source revision: `284d162926a8ee8ce80421a726a06c3a22abbd65`.
- Release ID:
  `brain-agent-release:sha256:b5813f2c215f6db3fafc0685691cee43ba699f2d699bb748b1b4633804c03242`.
- Both launchd descriptors point to the immutable RC.6 root and canonical
  Store; neither uses the mutable source checkout.

## Production health and Store

The canonical Store is:

`/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`

Read-only checks passed:

- schema/user version: `10`;
- SQLite integrity: `ok`;
- foreign keys: enabled;
- `GET /status`: 200;
- `GET /agent-mode/observer`: 200;
- `GET /agent-mode/console`: 200;
- `GET /scheduler/status`: 200;
- Console `GET /agents`: 200.

Current lifecycle/resource counts are all zero:

| Family | Count |
| --- | ---: |
| Agents | 0 |
| Tasks | 0 |
| Runs | 0 |
| Attempts | 0 |
| Pending reviews | 0 |
| Notifications/attention | 0 |
| Uncertain attempts/effects | 0 |
| Leases | 0 |
| Organization plans/final results | 0 |

The Store contains its schema metadata only; no active work, backlog,
uncertain effect, or pending approval requires operational action.

## Rollback identity and backup retention

The normalized previous baseline remains present and verified:

- Package ID:
  `brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba`.
- Source revision: `2a93ab565c697bc18ecb01f1a25f3f9dada11240`.
- Manifest hash:
  `a7cd15fe3df41cdbf7de77bcd38267328a2284a32f4055107f8a61dead19c577`.
- Baseline release ID:
  `brain-agent-release:baseline:bb9c113ef33508e01df22d455c9a0b81db5ff05d9f45f9dcaf3b69510e846a61`.
- Baseline package root:
  `/Users/Office/Library/Application Support/Brain/agent-mode/releases/brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba`.

The verified pre-activation backup remains at:

`/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc6-production-activation-20260918-072024`

- Snapshot ID:
  `brain-state-snapshot:sha256:c198792934471b24b81f6c8ef701e7cf554502ab335520a8082c4676c262e7c7`.
- Backup ID:
  `brain-agent-backup:sha256:db767cbcb070526a36174deaae631b92e83bd6c93cdf0b6a36e1746ceee2d8c3`.
- Snapshot verification: PASS.
- Backup-manifest verification: PASS.
- Directory mode: `0700`; snapshot, manifest, and binding files: `0600`.
- Location is under application support, outside Git and web roots.

Retention policy: retain the baseline and backup for a minimum of 30 calendar
days from 2026-09-18 and until a successor release has completed production
observation, received a fresh verified backup, and passed rollback-
compatibility evidence. Preserve longer for incidents, open support work,
uncertain/unreconciled effects, schema/package contract changes, or failed
successor activation/rollback. Nothing was deleted in this closeout.

## Artifact retention

The retained RC.6 vault exists outside Git under its immutable package ID and
contains:

- `package/manifest.json` and the verified runtime package;
- `release-manifest.json`;
- `signing-public.json`;
- `verification-receipt.json`.

The normalized baseline package root and `manifest.json` remain present under
the baseline package ID. Package verification passed for both RC.6 and the
baseline; signed RC.6 release verification passed against the public key. No
package was rebuilt or re-signed.

## Signing identity custody

The public metadata record is
`operations/release/agent-mode-release-signing-public-v1.json`.

- Key ID: `brain-agent-release-production-v1`.
- Algorithm: Ed25519.
- Backend: macOS Keychain.
- Keychain reference:
  `keychain-ref://com.brain.agent.release/production-ed25519-v1`.
- Fingerprint:
  `348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca`.
- `privateKeyExported`: `false`.
- Metadata-only Keychain lookup succeeded; no secret/private key value was
  read or exported.

Rotate by provisioning a new Keychain item under a new key ID, publishing new
public metadata, signing/verifying a new candidate, and changing the active
release only after isolated promotion evidence and separate authorization.
For compromise, stop signing and promotion, retain the public metadata so
existing signatures remain verifiable, provision a new identity, and cut a new
release. Do not reuse RC.6 identity or delete historical public metadata.

## Monitoring handoff

The minimum ongoing checks are documented in the runbook and use existing
launchd, localhost health, StateStore, release metadata, and filesystem
observability:

- Core/Console launchd state, PID, health routes, and immutable runtime root;
- release version, package ID, source revision, release ID, and signature/
  package verification;
- Store path, schema, foreign keys, integrity, and lifecycle/resource counts;
- Agent/Run backlog, pending reviews, attention, uncertain effects, scheduler
  state/dead letters, and budget exhaustion;
- durable provider/runtime errors and BrainNode connectivity where applicable,
  without live provider probes or BrainNode commands;
- disk usage, backup age/verification, last activation, and last rollback drill.

At reconciliation, the host filesystem was 95% utilized with approximately
45 GiB free. This is a monitoring warning, not an activation blocker; disk
capacity should be watched before any future package or backup operation.
Last successful activation is 2026-09-18. Last rollback compatibility drill
is 2026-09-17.

## Incident and rollback handoff

Responses remain bounded by existing authority:

- Core/Console crash: preserve launchd, health, and log evidence; inspect the
  exact service label and use supported launchd recovery only when authorized.
- Store integrity warning: stop promotion/new writes, preserve the Store and
  backup, and restore only into a fresh isolated target.
- Scheduler stall: classify durable scheduler state; do not invent work.
- UNCERTAIN effect: do not replay or replace it; use K4 reconciliation.
- Provider outage or BrainNode loss: apply the existing provider/BrainNode
  policy without credential or authority bypass.
- Release/signature/package mismatch: fail closed and leave active and
  rollback identities unchanged.
- Failed upgrade: preserve the pre-cutover backup and rollback only after
  compatibility and safe-write conditions are proven.
- Failed rollback: stop and preserve both release identities and Store
  evidence; do not blindly retry.
- Signing compromise: stop signing/promotion, preserve public verification
  metadata, rotate under a new identity, and issue a new signed release.

Never use name-based process killing, live SQLite/WAL copying, or a force
bypass. If post-cutover writes make restore safety unproven, stop and classify
the event as unsafe rollback rather than overwriting state.

## Future release triggers and rules

Cut a new candidate only for a bounded production-source change: bugfix,
security fix, dependency/security update, StateStore schema change,
NodeTransport protocol change, provider adapter change, Core/Console contract
change, signing-policy change, or critical runtime defect. No RC.7 or other
successor was created here.

Future releases must use a new immutable package and release identity. Schema
changes require migration plus rollback proof; package-contract changes need
compatibility evidence; security/auth changes need focused security review;
and every production activation requires separate authorization. The supported
maintenance categories are `BUGFIX`, `SECURITY_PATCH`,
`DEPENDENCY_MAINTENANCE`, `PROVIDER_ADAPTER`, `WORKCELL_INTEGRATION`,
`BRAINNODE_ADAPTER`, `CONSOLE_UX`, `JARVIS_VOICE_UX`, `RELEASE_OPERATIONS`,
and `INCIDENT_RESPONSE`. These do not reopen K0–H0 or create a new foundation
phase.

## Closeout decision

All current release records agree: RC.6 is **PRODUCTION_ACTIVE**, the
normalized baseline is **ROLLBACK_SUPPORTED**, the release-maintenance baseline
and Agent Mode foundation are complete, and no release blocker is open. The
system is handed off to ordinary release maintenance. The current support
record is `operations/release/agent-mode-production-support-v1.json`.

Expected mutation ledger for this closeout: Core stops `0`, Core starts `0`,
Console stops `0`, Console starts `0`, StateStore writes `0`, backups `0`,
restores `0`, provider/model/AWS/network/SSH/BrainNode/Workcell effects `0`,
public publishing `0`, and Git push `0`.
