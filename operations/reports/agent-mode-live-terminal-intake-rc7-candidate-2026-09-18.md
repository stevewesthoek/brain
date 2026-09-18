# Agent Mode live terminal intake RC.7 candidate evidence

**Date:** 2026-09-18
**Disposition:** CANDIDATE VERIFIED; PRODUCTION NOT PROMOTED

## Scope and starting boundary

This bounded change was reconciled from the Agent Mode release-maintenance
baseline at `e22a77fc`. The implementation was landed in:

- `e997ceb1 feat(brain): add Core-owned terminal Agent Mode intake`
- `0f7d2e65 fix(brain): honor installed runtime config path`
- `ed996e4e fix(brain): align packaged service labels`
- `9276aff7 test(brain): document terminal submit launcher`
- `cd401a38 fix(brain): validate hydrated isolated services`
- `b479376a fix(brain): configure Codex executable for isolated services`
- `555c9225 fix(brain): preserve executable path for Codex runtime`

The protected dirty paths were preserved and were not staged, modified, or
cleaned. No production service, pointer, StateStore, provider, AWS resource,
or repository content was changed.

## Core-owned intake contract

`brain-agent submit` and `POST /agent-mode/terminal/intake` are the canonical
terminal entry path. The request is authenticated with the existing Brain Core
service HMAC boundary, binds the repository ref/root and operator identity,
and persists Jarvis/root/task context before using the existing K4 path:

```text
terminal intake → Jarvis root/task → K4 SpawnPolicy → child reservation
→ assignment → runtime dispatch → CodexCliAgentRuntime → receipt/settlement
```

The only admitted live terminal runtime is the closed read-only
`runtime:codex-cli` / `runtime-profile:codex-cli-read-only-v1` mapping. The
runtime invokes `codex exec` with `--sandbox read-only`, an explicit repository
root, and no user configuration. Repository context is durable StateStore
data, not environment-provided Agent Mode evidence. Unsupported model/provider
or repository-root inputs fail closed.

`repos.sh` now selects Auto/Codex and calls `brain-agent submit`; it no longer
constructs fixture-run evidence or accepts manual `BRAIN_AGENT_MODE_*` state.

## Release identity and package

The final candidate was rebuilt from the clean isolated worktree at
`555c922532ee47b25fe8bf6e7ee3e04250851dc8`.

```text
releaseVersion: 1.0.0-rc.7
packageId: brain-runtime-package:sha256:08ef891956a6a16a43559626eb6d0434c70d67719fd96aaef6b4eab3bfd6c5bd
packageManifestHash: 330f2a618f52c55a3e5dd021bab02a3c9faf09d494b89e017baef94f3ba2b2a9
releaseId: brain-agent-release:sha256:3a001f54370f94cca30732b4f523bafd3e579ade5cfb0f3cd4f10eeb42f5b55e
coreBuildIdentity: sha256:595947e04dc814be1bd55398a11290095d1279f2810b5a820e1a4670c1e6cf5a
consoleBuildIdentity: sha256:6228bd90f427ab8c422be6697883d6e0f4646f1298f2bc2357b52ad4bb271d9c
previousReleaseVersion: 1.0.0-rc.6
```

The existing dedicated macOS Keychain Ed25519 identity was verified without
exporting private material:

```text
keyId: brain-agent-release-production-v1
service: com.brain.agent.release
account: production-ed25519-v1
fingerprint: 348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca
privateKeyExported: false
```

The signed manifest verifies against the published public metadata. Package
mutation returns `PACKAGE_UNVERIFIED`; manifest identity mutation returns
`PACKAGE_MISMATCH`; an unrelated Ed25519 public key returns
`SIGNATURE_INVALID`. The final candidate is retained outside Git at:

`/Users/Office/Library/Application Support/Brain/agent-mode/releases/brain-runtime-package:sha256:08ef891956a6a16a43559626eb6d0434c70d67719fd96aaef6b4eab3bfd6c5bd/`

Earlier RC.7 package candidates are superseded and are not the promoted
candidate identity.

## Isolated install and promotion/rollback drill

The final package installed into a fresh disposable root. Its package
descriptors were inspected by the service doctor; the actual isolated proof
used unique temporary labels `com.brain.rc7f8.core` and
`com.brain.rc7f8.console` on ports `4998` and `4999`. Canonical production
labels were never registered, unloaded, or changed. The service doctor passed
`22/22` checks, including package/source identity, launchd ownership, exact
Node arguments, resilient lifecycle, runtime/config/StateStore bindings, and
SQLite integrity. Both temporary services were booted out and both ports were
verified closed after the drill.

The launchd-safe runtime configuration explicitly bound
`execution.codexCliPath=/opt/homebrew/bin/codex`; the runtime adapter also
preserves the configured executable directory in the child PATH so the
Codex `env node` launcher works under launchd's minimal environment. No
manual `BRAIN_AGENT_MODE_*` variables were used.

The isolated read-only terminal smoke, using the actual launcher path, passed:

```text
Jarvis completed — root root:jarvis:sha256:2e0dfb087950be505d15f21528655c8ec41fee3df045e96ad3c250a6a54d0168
Repository: brain
Current branch: codex/cloudflare-tooling-normalization
```

Repeating the identical request returned the same root and one worker
lifecycle. The final durable StateStore contained `agents=3` (Jarvis plus two
read-only smoke workers), `tasks=4`, `runs=4`, `attempts=2`, and `0` Workcells;
the duplicate read-only request did not add a lifecycle. A separate mutation
request completed with an explicit refusal and did not create
`.rc7-mutation-denial-marker`.

The final isolated StateStore was exported through the existing logical
`brain-state-snapshot-v1` path and wrapped in `brain-agent-backup-v1` metadata:

```text
snapshotId: brain-state-snapshot:sha256:7c3ebb30f1a5bbddd931a71fd75f7bd2edad4397ee5e3b6aa77e917b2ee65d0d
backupId: brain-agent-backup:sha256:8a768fbdde852af75250dc460f386076fa2bba7866ed984ac1cd48d215ea7bd6
```

Backup verification passed. Restore into fresh isolated R1 and R0 targets
passed. A second import into the populated R1 target was rejected with
`TARGET_NOT_FRESH`. RC.7-to-RC.6 rollback compatibility was `compatible`.
No live production Store was imported, overwritten, or rolled back.

## Durable reconstruction and side effects

The installed Core observer after the live smoke reported `3` agents, `4`
tasks, `4` runs, `2` attempts, and `0` workcells. Both terminal receipts were
`runtime:codex-cli` receipts with bounded result/evidence references. The
Console `/agents` page rendered from the installed standalone build and the
Core `/status` endpoint passed.

All external-effect counts for this candidate are zero:

```text
AgentRuntime calls beyond the intended Codex CLI workers: 0
Harness launches: 0
ModelGateway/provider calls: 0
Bedrock/MiniMax/GLM/Opus calls: 0
BrainNode calls: 0
Workcells: 0
network/provider probes: 0
repository mutations: 0
production service/pointer/Store mutations: 0
```

The read-only mutation-denial request was intentionally executed as a
terminal worker, but the repository remained unchanged.

## Validation

Passed:

- terminal intake, route, and portable-config tests: `13` focused tests;
- local-install, runtime-package, release, service-resilience, and intake tests: `35`;
- K5 organization/finalization, K4 admission/reservation/assignment/dispatch,
  observer, recovery, relocation, and signing-drill tests: `287`;
- Brain Core typecheck;
- Brain Core build;
- Brain Console typecheck and production build;
- launcher resolution/runtime-surface shell tests: `2` scripts;
- final package verification, Keychain-backed signature verification, tamper
  checks, isolated launchd Core/Console smoke, duplicate replay, mutation
  denial, backup/restore, and rollback compatibility;
- `git diff --check`.

The full Brain Core suite was not rerun to completion in this continuation and
is not claimed as green. The prior baseline attempt reached the known
restricted-Harness E2 failures and environment-dependent K4.3-A/D2 live-runtime
failures before interruption. Those unrelated failures were not changed by
this candidate; all new intake, release, install, and focused K4/K5 regression
tests passed.

## Disposition and next action

RC.7 is a verified non-production candidate only. No production promotion,
launchd registration, provider call, external-network operation, or push was
performed. The exact next action is a separately authorized RC.7 production
promotion after the normal release-maintenance approval and observation gates.
This candidate does not reopen K0–K5, add a new execution plane, or authorize
live model routing.
