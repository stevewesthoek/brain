# Agent Mode production baseline normalization evidence — 2026-09-17

## Result

**Status:** `PASS`
**RC.6 readiness:** `READY` as a future separately authorized cut/validation
**RC.6 cut or signing:** not performed
**Scope:** Office Core and Console baseline normalization only

This record covers the authorized move from the mutable Office `brain-runtime`
checkout to a verified immutable local install. It does not activate or sign
RC.6, publish, push, rotate credentials, migrate an existing Store, or execute
Agent Mode work.

## Starting state and reconciliation

- Repository: `/Users/Office/Repos/stevewesthoek/brain`
- Starting HEAD: `2a93ab565c697bc18ecb01f1a25f3f9dada11240`
- Current source worktree: no unexpected staged changes; protected unrelated
  changes remained untouched (`operations/accounts/credentials-index.md`, the
  Firecrawl log, and the two unrelated roadmap paths).
- K4/K5/H0: already complete; this task reopened none of those phases.
- Historical RC.5 readiness recovery remains `BLOCKED_MULTIPLE`; its exact
  artifact was not relabeled or reused.

The previous live closure was mutable:

| Component | PID | Entrypoint/cwd | Source revision |
|---|---:|---|---|
| Core | 15733 | `brain-runtime/projects/brain-core/dist/index.js` / `brain-runtime/projects/brain-core` | `9a5719e731f16c4e88bb34720c1679f1e3276be9` |
| Console | 4039 | `brain-runtime/tools/brain-console-service.mjs` / `brain-runtime/projects/brain-console` | mutable checkout |

Pre-change descriptor hashes were retained and verified:

```text
com.office.brain-core.plist    1a3fab61ba04ce0b570a17c33f983071f00f781503527c1b64f60f4ec32618d4
com.office.brain-console.plist a397819f5712f4839f09b25c3abdf563e0fa8f283a66d544d4f80405398b6830
```

Recovery copies are retained at:
`/Users/Office/Library/Application Support/Brain/agent-mode/recovery/2026-09-17T221500Z-legacy-launchd/`.

The configured default Store
`/Users/Office/.local/brain/agent-mode/agent-mode.db` was absent, no Agent
Mode SQLite handle was open in the legacy Core, and no pre-existing Agent Mode
records were found. Therefore this normalization created an empty Store rather
than migrating or discarding data.

## Immutable baseline

Candidate source was built from a fresh clean detached worktree. The earlier
`9a5719e7` closure passed isolated legacy smoke but could not satisfy the
supported package contract because its Console build lacked `.next/standalone`.
The current committed HEAD was selected because it preserved the legacy API
surface and produced the supported standalone package.

```text
releaseRevision: 2a93ab565c697bc18ecb01f1a25f3f9dada11240
sourceTree: 731470fac6906887b3fd3b1064a8bfb08a720cd9
packageId: brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba
manifestHash: a7cd15fe3df41cdbf7de77bcd38267328a2284a32f4055107f8a61dead19c577
fileCount: 2467
totalBytes: 64395673
node: v25.9.0
installId: brain-local-install:sha256:a56d5e0475ecf83eebba0958a69fbdcbc57c609fd61af045e06707584a41715f
```

Core and Console clean builds passed. Package build was run with clean-source
provenance; package verification passed before and after installation. The
immutable release contains no symlinks. Core production dependencies were
hydrated with `npm ci --omit=dev --offline` in the install-root dependency
layer, outside the verified release payload, and the installed release
verifier remained `ok`.

The supported install root is:
`/Users/Office/Library/Application Support/Brain/agent-mode`.
The persistent owner-only `releases/`, `state/`, `config/`, `services/`,
`logs/`, `recovery/`, and `backups/` layout exists. No backup was created: the
pre-normalization canonical Store was absent, so there was no existing snapshot
to copy. The empty `backups/` root is retained for the next authorized RC.6
backup/restore operation.

## Isolated package smoke

Before the live switch, the installed package was started outside the Git
checkout on disposable localhost ports with explicit state/config overrides.
The Core and standalone Console passed:

```text
Core /status:             200
Core /agent-mode/observer: 200
Core /agent-console:      200
Console /agents:          200
```

The smoke used a disposable StateStore path and was stopped after read-only
checks. No model/provider/runtime/BrainNode/Workcell/Harness/network effect
was observed.

## Bounded production cutover

The change window stopped only the existing `com.office.brain-core` and
`com.office.brain-console` user LaunchAgents. Exact old descriptors were
captured before the stop. The live descriptors now point to the immutable
release and retain the canonical localhost ports:

```text
Core entrypoint: /Users/Office/Library/Application Support/Brain/agent-mode/releases/brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba/core/dist/index.js
Console entrypoint: /Users/Office/Library/Application Support/Brain/agent-mode/releases/brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba/console/standalone/server.js
Core/Console cwd: same immutable release root
Core PID after cutover: 89475
Console PID after cutover: 92250
Core descriptor after cutover: 76b9c1f9290584dcf682fd0daa647ae7f7d79a118055e95dc799c6ce84c62d31
Console descriptor after cutover: bd35ff2fd57476dfe5f1ad79ffe20405f398fb9bda48a4d7baef444082b88727
```

The Console descriptor was corrected once during the same bounded window to
provide standalone Next's explicit `PORT=4881` and `HOSTNAME=127.0.0.1`; the
first package start was otherwise healthy but listened on Next's default 3000.
This was a service configuration correction, not a source or package change.

The canonical Store is now:
`/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`.
It was created once after the old services stopped, with schema 10, SQLite
`integrity_check=ok`, `foreign_keys=1`, owner-only mode `0600`, and these
counts:

```text
agents=0 tasks=0 runs=0 attempts=0
```

No StateStore migration, fixture insertion, or data discard occurred.

## Health and observation

Final read-only health returned HTTP 200 for:

```text
http://127.0.0.1:4877/status
http://127.0.0.1:4877/agent-mode/observer
http://127.0.0.1:4877/agent-mode/console
http://127.0.0.1:4877/agent-console
http://127.0.0.1:4877/scheduler/status
http://127.0.0.1:4881/
http://127.0.0.1:4881/agents
```

The five-minute observation ran from `22:14:19Z` through `22:19:37Z` and
returned the following on every sample:

```text
Core=200 Console=200 CoreState=running ConsoleState=running
agents/tasks/runs/attempts=0/0/0/0
```

The final projection reported an available empty Agent Mode StateStore with
zero active roots/agents/tasks/attempts, zero reserved and settled cost, and
no pending approvals/schedules/failures. Repeated read requests did not
advance runtime state.

## Effects ledger

| Effect | Count/result |
|---|---:|
| Core stop/start | 1 / 1 |
| Console stop/start | 2 / 2 (one bounded port correction) |
| live descriptor pointer changes | 2 |
| canonical empty Store creation | 1 |
| existing Agent Mode records discarded | 0 |
| child Agents / Tasks / Runs / Attempts | 0 / 0 / 0 / 0 |
| AgentRuntime / Harness / ModelGateway calls | 0 / 0 / 0 |
| Bedrock / MiniMax / GLM / Opus / Codex calls | 0 / 0 / 0 / 0 / 0 |
| BrainNode / Workcells / repository mutations | 0 / 0 / 0 |
| AWS / SSH / Tailscale / external network | 0 / 0 / 0 / 0 |

The only external process activity was the authorized local launchd restart and
localhost health reads. No secrets, credentials, provider payloads, prompts,
or runtime logs were copied into the repository or recovery record.

## Rollback and next task

Rollback material is retained and was not needed: exact old launchd descriptors
are in the recovery vault, the old mutable runtime checkout was not cleaned or
deleted, and the immutable package is retained under its package-identity
release directory. A failed future health gate must boot out only the two
current labels, restore the retained descriptors, bootstrap them, and verify
legacy health before any further action.

The normalized immutable baseline is now the retained rollback target for the
next separately authorized operation. This task did **not** cut or sign RC.6.
The exact next task is **RC.6 — cut and validate the next signed release from
the normalized immutable baseline**. Stop here; do not begin that task
automatically.
