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

The candidate was rebuilt from the clean isolated worktree at
`9276aff7e39973886a08fd75d04fa2521720a720`.

```text
releaseVersion: 1.0.0-rc.7
packageId: brain-runtime-package:sha256:f5d3c6f8fbae2bd3e1d4d0ae3d377f3774a47abc0c5a840bbde872ed18ab1cc2
packageManifestHash: 87f00eb8e014b488d2deac4720cf8ddf6937a866f9bd0e255392fae65f4145d0
releaseId: brain-agent-release:sha256:e358be476bf21ce702a3da9879ab87571be7bf1c1cc39507930faca014011ec3
coreBuildIdentity: sha256:bda2d8eaf1364e5d7769a9ff5d9e437f3802e715a7690c45c43657f3c8fffd4f
consoleBuildIdentity: sha256:8a812266c85f66bc78404cf0f3195bc90e52c3eeabc012424b11688c25e118c7
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

`/Users/Office/Library/Application Support/Brain/agent-mode/releases/brain-runtime-package:sha256:f5d3c6f8fbae2bd3e1d4d0ae3d377f3774a47abc0c5a840bbde872ed18ab1cc2/`

Earlier RC.7 package candidates are superseded and are not the promoted
candidate identity.

## Isolated install and promotion/rollback drill

The final package installed into a fresh disposable root with activation and
launchd registration disabled. The generated macOS descriptors use the
canonical labels `com.office.brain-core` and `com.office.brain-console` while
retaining the supported descriptor filenames. Installed Core and Console ran
on temporary localhost ports `4979` and `4983`, respectively, then were
stopped; both ports were verified closed.

The isolated read-only terminal smoke, using the actual launcher path, passed:

```text
Jarvis completed — root root:jarvis:sha256:2e0dfb087950be505d15f21528655c8ec41fee3df045e96ad3c250a6a54d0168
Repository: brain
Current branch: codex/cloudflare-tooling-normalization
```

Repeating the identical request returned the same root and left counts at
`agents=2, tasks=2, runs=2, attempts=1`. A separate mutation request completed
with an explicit refusal and did not create `.rc7-mutation-denial-marker`.

The final isolated StateStore was exported through the existing logical
`brain-state-snapshot-v1` path and wrapped in `brain-agent-backup-v1` metadata:

```text
snapshotId: brain-state-snapshot:sha256:b6be480c483e564ad87bd3fc374916dfb2a15a0bfada82216054538a0694eaa7
backupId: brain-agent-backup:sha256:2511ad2619b8459025bef3a07ff851c5c9b9abbbd8fe4457d086df3ce70434e1
```

Backup verification passed. Restore into fresh isolated R1 and R0 targets
passed. A second import into the populated R1 target was rejected with
`TARGET_NOT_FRESH`. RC.7-to-RC.6 rollback compatibility was `compatible`.
No live production Store was imported, overwritten, or rolled back.

## Durable reconstruction and side effects

The installed Core observer after the live smoke reported `3` agents, `4`
tasks, `4` runs, `2` attempts, and `0` workcells. The two terminal receipts
were `runtime:codex-cli` receipts with bounded result/evidence references.
The Console `/agents` page rendered from the installed standalone build and
showed `Agents` / `Agent Mode`.

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

- terminal intake and route tests: `12` focused tests;
- local-install and portable-config tests after the service-label fix: `13`;
- Brain Core typecheck;
- Brain Core build;
- Brain Console typecheck and production build;
- launcher resolution/runtime-surface shell tests: `2` scripts;
- final package verification, signature verification, tamper checks, isolated
  Core/Console smoke, duplicate replay, mutation denial, backup/restore, and
  rollback compatibility;
- `git diff --check`.

The full Brain Core suite was attempted but not claimed as green. It reached
the known restricted-Harness E2 failures and environment-dependent K4.3-A/D2
live-runtime failures before the long-running suite was interrupted. Those
unrelated failures were not changed by this candidate; all new intake,
release, install, and focused K4 regression tests passed.

## Disposition and next action

RC.7 is a verified non-production candidate only. No production promotion,
launchd registration, provider call, external-network operation, or push was
performed. The exact next action is a separately authorized RC.7 production
promotion after the normal release-maintenance approval and observation gates.
This candidate does not reopen K0–K5, add a new execution plane, or authorize
live model routing.
