# Agent Mode production activation readiness recovery — 2026-09-17

## Decision

**BLOCKED_MULTIPLE.** This was a release-maintenance readiness recovery, not a
production activation. Production Core and Console remained running; the
production StateStore, service descriptors, and service pointers were not
written. The four required readiness questions are not all YES:

| Question | Result | Evidence |
| --- | --- | --- |
| Exact retained RC.5 artifact | **NO** | No candidate artifact was found in the bounded release/cache/archive locations. A clean reconstruction was structurally valid but had different package identity and manifest hash. |
| Exact current production runtime | **PARTIAL** | Core's complete generated closure matches clean commit `9a5719e7`; the live generated Console closure has the same 268 paths as a clean 9a build but 368 hash-entry differences. The active installation is still a mutable checkout. |
| Canonical production Agent Mode StateStore | **NO** | The configured default store is absent, no Agent Mode SQLite file is open by the Core process, and the running Core exposes no canonical Agent Mode routes. |
| Compatible immutable rollback target | **NO** | No installed immutable predecessor exists. The isolated R0 rehearsal target is not evidence of the current production baseline, and the 9a source predates the standalone package contract. |

The exact next authorized work is a separate production-baseline
normalization onto a supported immutable release with an explicitly configured
canonical StateStore. Because historical RC.5 bytes cannot be reproduced
exactly, a new immutable RC.6 must then be cut rather than relabeling a new
package as RC.5.

## Starting state and prior blocker

- Brain repository HEAD: `2b216b2fd72e16939d34eff928201146c2393d47`
  (`test(brain-core): stabilize release acceptance suite`).
- The primary checkout has no staged changes. Existing worktree changes are
  limited to the protected/unrelated credential index, Firecrawl log, and two
  unrelated roadmap files; they were not read for values, modified, staged, or
  committed.
- The failed activation preflight correctly stopped before any service stop,
  backup, install, pointer change, or production StateStore access.

RC.5's immutable expected identities remain:

| Field | Expected value |
| --- | --- |
| Release | `1.0.0-rc.5` |
| Source revision | `c81c6785bc976fc88b8492bd0eb1e20b2f8cd961` |
| Git tree | `f6549f993a998d6311edc371417b9b62fc78d23c` |
| Package ID | `brain-runtime-package:sha256:39df90b4497f2107f78ab4beb4f6457ff9d1f5dcdfb3d4c6397af065a94898c5` |
| Package manifest hash | `c343d410536a8d9f2c26761256f9849bfac5e7220021190411319eedfa639584` |
| Release ID | `brain-agent-release:sha256:5028c78a4369950f6481093c772a855e1c90819469c301b025c876f530cec8ce` |
| Signing identity | `brain-agent-release-production-v1` |
| Signing fingerprint | `348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca` |

## RC.5 artifact recovery

The bounded search covered the configured/referenced Brain release locations,
operator application-support/cache locations, known archives, `/tmp`, local
Brain repositories, and Git refs. No exact RC.5 package, package manifest, or
signed release manifest was found. The exact identifiers occur only in the
committed evidence/public metadata.

A detached clean worktree at `c81c6785` was created. Its revision and tree
matched the expected values, and its Git status was empty before and after
builds. Core and Console builds completed using local dependencies. The
reconstructed package then passed the package verifier structurally:

- 2,467 files;
- 64,401,091 bytes;
- reconstructed package ID:
  `brain-runtime-package:sha256:d2ee8d45f71296c2a80057c6cbd46ea53173f2c6e2f745ce7d39d438c21b0f29`;
- reconstructed manifest hash:
  `1acf3e2100f744f42d2f91f13ee1cf1ec70ca5f236393da3f3b326456b4309ee`.

Those values do not equal the expected RC.5 package ID, manifest hash, or
recorded 64,401,086-byte closure. The mismatch is therefore a failed exact
reconstruction, not a candidate promotion. No new signature was made and no
reconstructed package was retained as RC.5. Re-signing it would change the
immutable release identity.

## Current production baseline

Read-only launchd/process inspection found:

| Component | Current identity |
| --- | --- |
| Core service | `com.office.brain-core`, running, PID `15733` |
| Core entrypoint | `/Users/Office/Repos/stevewesthoek/brain-runtime/projects/brain-core/dist/index.js` |
| Core working directory | `/Users/Office/Repos/stevewesthoek/brain-runtime/projects/brain-core` |
| Console service | `com.office.brain-console`, running, PID `4039` |
| Console entrypoint | `/Users/Office/Repos/stevewesthoek/brain-runtime/tools/brain-console-service.mjs` |
| Console working directory | `/Users/Office/Repos/stevewesthoek/brain-runtime/projects/brain-console` |
| Node executable | `/opt/homebrew/bin/node` (host Node `v25.9.0`) |
| Service manager | per-user macOS launchd LaunchAgents |

The runtime checkout HEAD is `8f8d6c8d7a1eb8929a7dbdc2329407ebb73a8c51`, with
uncommitted/untracked scheduler and runbook work outside the active Core and
Console source paths. Launchd claims source/deployment revision
`9a5719e731f16c4e88bb34720c1679f1e3276be9`. The Core generated closure is 537
JavaScript/module files and is byte-for-byte equal to a clean 9a rebuild,
including `dist/index.js`; the Console launcher source is also byte-for-byte
equal to 9a. This proves a Core/launcher mapping to 9a, not an immutable
installed release.

The running Console uses a mutable non-standalone Next build from `.next`.
Against a fresh clean 9a Console build, the live and clean trees have the same
268 non-cache file paths but 368 hash-entry differences, including different
build IDs. The supported `brain-runtime-package-v1` contract requires
standalone Console output, so the complete live runtime cannot be mapped to a
reproducible supported package. This is classified as
`LIVE_RUNTIME_NOT_REPRODUCIBLE_FROM_COMMITTED_SOURCE` for the full service
closure; no dirty checkout was cleaned or packaged as production.

The bounded forensic runtime facts are:

- Core `dist/index.js` SHA-256:
  `5d2040a2493dfdfecd011e8786ea03793a1e3e29c8cf1c5e84b13069894c2202`;
- Console launcher SHA-256:
  `899b34ccb139a912bda3de006597d95d08f38793d22165c590772fab1d70f7df`;
- Core and Console package-lock files match their 9a committed versions;
- running dependency identities include Next `15.5.19`, React `19.2.7`, and
  React DOM `19.2.7`;
- no credentials, environment values, provider payloads, or private material
  are included in this report.

## Canonical StateStore recovery

The current Core's supported default resolves to:

`/Users/Office/.local/brain/agent-mode/agent-mode.db`

That file is absent. Read-only open-file inspection of Core PID `15733` showed
no Agent Mode SQLite database, WAL, or shared-memory file. The only nearby
Agent Mode databases are historical K2-1 live/retry stores and were classified
`INACTIVE/STALE`, not selected by recency or size. The launchd descriptor has no
`BRAIN_AGENT_MODE_STATE_DIR`, `BRAIN_RUNTIME_STATE_ROOT`, or
`BRAIN_RUNTIME_SQLITE_PATH` override. Running `/agent-mode/observer` and
`/agent-mode/console` both return 404, while the legacy Core status is healthy
and read-only. This means the active production controller's canonical
Agent Mode Store cannot be proven.

No StateStore was opened, checkpointed, migrated, vacuumed, exported,
snapshotted, restored, or written during this goal. RC.5's expected Store
schema is 10; compatibility cannot be assessed without an identified active
Store.

## Rollback candidate and future layout

The recorded R0=`72fc9fd7` package/backup was an isolated rehearsal target and
does not automatically correspond to the current production runtime. No
immutable installed release or retained package corresponding to the current
service exists.

The current 9a source can rebuild Core, but it predates the release CLI and its
Console build has no `.next/standalone/server.js`. It therefore cannot satisfy
the supported `brain-local-install-v1` package contract without changing the
runtime contract. No rollback candidate was invented from it, and no Keychain
signing operation was performed.

The supported future layout was generated in plan-only mode and was not
applied:

```text
<operator-owned Brain install root>/
  releases/<immutable package ID>/
  state/
  config/brain-runtime-config.json
  services/com.brain.core.plist
  services/com.brain.console.plist
```

On this host the candidate operator-owned root is reserved conceptually as
`~/Library/Application Support/Brain/agent-mode`; no directory, descriptor,
pointer, or secret file was created. The plan keeps registration and start at
`not-run`. The current `com.office.*` checkout descriptors must not be edited
until a separately authorized baseline-normalization/activation window.

## Retention policy correction

The release-maintenance procedure now requires a candidate to enter a stable,
owner-controlled application-support release vault when it becomes
promotable. The retained record is keyed by immutable release/package identity
and contains only the package, package manifest, signed release manifest,
public verification metadata, and a bounded verification receipt. Temporary
reconstruction/drill outputs may be retired only after the retained copy has
passed independent package and release verification. Private keys, credentials,
StateStores, raw logs, WAL files, and raw provider output are never retained in
the vault.

Production logical backups use `brain-state-snapshot-v1` and
`brain-agent-backup-v1`, live through the activation and rollback window, and
are retained with their release binding, verification result, and owner-only
permissions. Raw live SQLite/WAL copies are not backups. Backup retirement
requires an explicit release-retirement decision after the rollback window.

## Validation and effect ledger

- clean c81 reconstruction worktree: revision/tree/status checks passed;
- clean c81 Core build: passed;
- clean c81 Console build: passed with existing CSS warnings;
- reconstructed package structural verify: passed, but exact RC.5 identity:
  **failed**;
- clean 9a Core build and 537-file closure comparison: passed;
- supported local-install plan: passed in plan-only mode;
- production services remained running and untouched;
- production Core stops: `0`;
- production Core starts: `0`;
- Console stops/starts: `0`;
- production StateStore writes/backups: `0`;
- service descriptor/pointer mutations: `0`;
- Keychain signing operations: `0`;
- provider/AWS/Bedrock/SSH/Tailscale/network effects: `0`;
- BrainNode/Workcell/Harness/AgentRuntime/ModelGateway effects: `0`;
- Git push/public publish: `0`.

## Final readiness and next task

Final readiness decision:

`BLOCKED_MULTIPLE`

The blockers are `BLOCKED_RC5_ARTIFACT_NOT_REPRODUCIBLE`,
`BLOCKED_PRODUCTION_RUNTIME_NOT_REPRODUCIBLE`,
`BLOCKED_CANONICAL_STATESTORE_UNKNOWN`, and
`BLOCKED_ROLLBACK_TARGET_UNAVAILABLE`.

Next task, separately authorized: **normalize the Office production baseline
onto a supported immutable Brain install with an explicitly configured and
proven canonical Agent Mode StateStore, preserving the running service and
all existing state until a controlled migration window**. After that baseline
is proven, cut and sign a new immutable **RC.6** from a reproducible package
build; do not retry RC.5 under a different package identity.
