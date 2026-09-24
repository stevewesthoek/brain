# RC47 Production Activation Attempt — 2026-09-24

## Outcome

**BLOCKED; production is RC27.** The first RC47 activation attempt failed
terminal intake and was rolled back. During the continued authorized window,
one activation was stopped before live intake when the normal `repos` resolver
still selected RC27. After correcting the pointer target, one production
Jarvis/Auto turn succeeded and the next failed on its GLM-5 lifecycle. This is
a critical acceptance failure; neither failed turn was retried. RC47 was
immediately rolled back again. RC27 is healthy and remains the active release.

## Artifact and source identity

- Candidate: RC47 / `1.0.0-rc.47`.
- Source: `8f4ad9683a28007888a758ea0713f8d5288f8e79`; the accepted source is
  present on `origin/main`.
- Package: `brain-runtime-package:sha256:0401f3ccf6f983b1b82478282c95361f918cb1234b32ebffff85dcc0cf95f2f7`.
- Manifest hash: `2766bb1336ab2e52265fca51b4a649eb22b4f79c0181d1487f464a9d1afabedb`.
- Release: `brain-agent-release:sha256:25986914d0ff3cbd667fb5277610b3b650757cd4a34d4522985de992bf520bd4`.
- Package completeness and Ed25519 signature verification passed. The exact
  package was retained in the canonical release vault and reverified without
  rebuilding.
- Isolated RC47 GLM-5 acceptance remains separately recorded at
  `agent-mode-rc47-isolated-glm5-acceptance-2026-09-24.md`; it was not repeated
  in production.

## Pre-cutover backup and restore

- Private backup bundle:
  `/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc47-prepromotion-20260924TadsMOq`.
- Backup ID:
  `brain-agent-backup:sha256:c6fa6bb4e080ccebf8b15e6268a1f820fa8abc7fee9e69293a6e4dfb89408989`.
- Snapshot ID:
  `brain-state-snapshot:sha256:b1e19aafbee80fc5f74bd942faf2a5ac468c8a7490af34ef68756c5f99d3fc8b`.
- Snapshot aggregate hash:
  `233be3539a79043f1b9608ecfca5dae836b198efcab65c8f41d1fc9f29dd2eee`.
- StateStore schema 11; 58 record families. RC27 descriptors, install
  metadata, support metadata, and release metadata were retained before
  cutover.
- Restore rehearsal imported the snapshot into a separate disposable database,
  passed the StateStore import integrity/foreign-key checks, and re-exported an
  identical snapshot ID and aggregate hash. No production database was
  overwritten.
- The signed RC27 rollback package remained present and verified. The exact
  pre-cutover descriptors and install pointer linted/validated before rollback.

## Descriptor correction and cutover

The offline-generated install plan was not applied unchanged. Corrected RC47
descriptors were derived from the healthy RC27 production descriptors, keeping
the canonical config, external secret reference, schema-11 StateStore, launchd
labels, listener/bind settings, and environment while changing only the
immutable release paths and release identity. Descriptor syntax and path
bindings passed preflight.

The Core and Console labels were individually booted out with bounded waits,
then loaded from the corrected RC47 descriptors. During the brief activation
window, both endpoints returned HTTP 200 and the RC47 service doctor passed
22/22 checks, including package/source identity, one process per service, and
StateStore integrity/foreign keys.

## Production acceptance failure and rollback

The normal `repos` shell function resolved to the exact retained RC47 CLI. One
read-only Auto request was submitted for `stevewesthoek/brain`; the terminal
returned `terminal intake failed` (nonzero exit). The failure stage is the
terminal intake boundary. The interactive CLI prints only
`payload.error.message`; Core's domain-denial response carries
`result.reasonCode`, which the CLI did not display and which was not durably
persisted.

Post-failure durable observer state remained at 58 Agents, 120 Tasks, 120 Runs,
and 57 Attempts, with zero ModelGateway operations. The most recent Attempt
predated this request. This supports that the request did not advance into a
worker lifecycle; no second request was made. No Jev inference was made; the
safe Jev status counts were unchanged at 149 calls, with the `$10` monthly cap
and Keychain reference intact. No AgentRuntime, Harness, provider, BrainNode,
Workcell, or repository mutation was observed for this failed submission.

Because a production Jarvis intake failure is a defined critical rollback
condition, both RC47 services were stopped. The verified RC27 Core/Console
descriptors and install pointer from the private backup were restored, and the
services were safely bootstrapped. The shared StateStore was preserved.

Post-rollback checks:

- Active release pointer: RC27, package
  `brain-runtime-package:sha256:267e41d9df24b83abd632cfc1c4dbb4c0333a2245db5cea576c7dbf776c47246`.
- Restored Core/Console descriptors and install pointer byte-match the saved
  RC27 backup copies.
- Core `/status`: HTTP 200.
- Console `/agents`: HTTP 200.
- RC27 service doctor: **PASS, 22/22**; schema-11 integrity and foreign keys
  clean.
- RC47 acceptance was not retried; no production promotion decision is
  granted.

## Security and limits

No secret values, credentials, provider request/response bodies, or raw logs
are included. A follow-up read-only source/config diagnosis established the
matching deterministic admission condition:

- The retained RC47 Core environment had only one available runtime candidate:
  Claude Opus was configured and its CLI was present, but Brain's Auto cost
  policy marks Opus pricing unverified (`cost_unknown`) and therefore does not
  admit it.
- The stored GLM-5 and MiniMax Bedrock access evidence both expired at
  `2026-09-21T21:32:09.807Z`, before the `2026-09-24` cutover. Both models are
  consequently unavailable to Auto under the fresh-evidence gate.
- Re-running the exact RC47 pure route resolver with the production-available
  candidate set and submitted request text returns
  `AUTO_COST_ADMISSION_DENIED`. This deterministic fail-closed result is not
  evidence of a provider invocation or authentication defect.
- Production Jev was not configured for this Core: `BRAIN_JEV_REFLEX_MODE` was
  `OFF`, no bridge override was present, and the packaged default bridge path
  did not exist. The separate `jev status` command proves only that the local
  bridge credential/budget are available; it does not prove Core wiring.

The continued authorized window below refreshed model-access evidence and
explicitly configured the Jev bridge before a second cutover. Do not weaken
Opus's cost gate, copy stale evidence forward, or retry a failed request.
RC27 remains active and is the rollback baseline.

## Continued authorized activation and acceptance — 2026-09-24 UTC

### Fresh backup and restore proof

A second, fresh pre-cutover backup was created after quiescing Core and
Console. The logical export used the supported StateStore snapshot CLI; no
live SQLite/WAL copy was made. Private bundle:

`/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc47-retry-precutover-20260924T230231Z`

- RC27 snapshot: `brain-state-snapshot:sha256:998b72827373d8fe64e69cbf01a6d7f3a6f43d59fe33b8108ecd7c2102ce2344`.
- Aggregate hash: `4692a2b4c8724d06a03e618be91c6c257c9745fed0509bc2b9070e06fffd1842`.
- StateStore schema 11; 58 record families.
- Snapshot verification passed. Restore into a fresh isolated target passed;
  re-export reproduced the same snapshot ID and aggregate hash. Isolated
  SQLite integrity was `ok`, with no foreign-key violations.
- The bundle contains the RC27 Core/Console descriptors, package manifest,
  and byte-matched canonical `/agent-mode-rc6/install.json` pointer. The
  earlier `/agent-mode/install.json` pointer is not the resolver authority.
- RC27 rollback package identity and signature had already passed the prior
  artifact verification and were not modified.

### Resolver correction and second cutover

The first resumed cutover changed the legacy `/agent-mode/install.json`
record, but `tools/scripts/brain-cli-resolver.sh` reads
`$HOME/Library/Application Support/Brain/agent-mode-rc6/install.json`. The
Core/Console paths were briefly RC47, but `repos --resolve-brain-cli` still
returned RC27. No Jarvis request was submitted in that window. The identity
mismatch was treated as critical and RC27 was restored before proceeding.

The canonical RC27 pointer was then captured byte-for-byte in the fresh
backup, and the RC47 install record was corrected/applied specifically at the
resolver's `agent-mode-rc6/install.json` path. Fresh Bedrock metadata reads
confirmed GLM-5 and MiniMax active, authorized, agreed, entitled, and region
available. Their account-bound access evidence was refreshed for a bounded
15-minute window. No inference was performed by these metadata reads.

The second cutover passed the safe label-absence waits. RC47 Core and Console
both returned HTTP 200; the RC47 service doctor passed 22/22. The normal
`repos --resolve-brain-cli` resolved the exact retained RC47 CLI, and both
loaded launchd descriptors and the canonical install pointer referred to the
same package/source. The RC47 release remained the already-retained,
signature-verified artifact; it was not rebuilt.

### Bounded production Jarvis / Auto / Jev smoke

Two read-only turns were submitted through the normal `repos → Auto` path for
`stevewesthoek/brain`:

1. `Hi.` completed. Auto selected MiniMax M2.5; one K4 Attempt and provider
   process lifecycle completed, with one Jarvis response. Jev correctly
   bypassed this simple turn with `REFLEX_SKIPPED_SIMPLE_TURN`. The terminal
   displayed activity/progress, a single completed response, and no duplicate
   rendering.
2. The model/route/Jev status question was accepted, Auto selected GLM-5, and
   Jev returned the durable fallback reason `REFLEX_LOW_CONFIDENCE`. The K4
   GLM-5 Attempt and dispatch then settled as failed; no assistant response
   was produced. This is a critical acceptance failure. The turn was not
   retried.

Durable observer facts after rollback show the pre-smoke baseline of 58 Agents,
120 Tasks, 120 Runs, and 57 Attempts became 60 Agents, 124 Tasks, 124 Runs,
and 59 Attempts: one completed and one failed worker lifecycle. The shared
StateStore was not restored, preserving these truthful acceptance records.
The completed MiniMax turn has provider prepare/spawn/exit lifecycle evidence.
The failed GLM lifecycle has no provider-command lifecycle, provider request
ID, or provider status. A read-only reconciliation of the durable runtime
receipt's deterministic result hash against the exact RC47 source identifies
the failure code as `MODEL_ACCESS_UNAVAILABLE`. The attempt therefore failed
inside Brain's local runtime access-evidence gate, before the ModelGateway
invocation; no GLM provider inference occurred. No further model call was
made.

Jev's safe status moved from 149 to 150 calls. Its Keychain credential
reference remains present; the secret was not read or exposed. The monthly
budget remains capped at $10, with $9.994547 remaining; pilot remaining is
$0.244586. The first turn proves simple-turn bypass; the second exposes the
low-confidence fallback code. A successful Jev-assisted turn, adaptive
bypass under load, context narrowing, and candidate-filtering behavior were
not fully proven. Opus remains fail-closed because pricing is unverified;
Codex was not selected and no escalation occurred.

The RC47 stale-resume-route regression remains covered by the exact-source
focused suite (99/99 passed), but a production resume/recall turn was not
completed. No repository file mutation through Agent Mode, BrainNode,
Workcell, Harness, or tool execution was observed. There was no production
push or source change.

### Second rollback and final state

On the failed GLM turn, the CLI session was stopped and RC27 Core/Console
descriptors plus the canonical `agent-mode-rc6/install.json` pointer were
restored from the fresh backup. The shared StateStore was deliberately left
intact. Post-rollback:

- RC27 Core `/status`: HTTP 200; Console `/agents`: HTTP 200.
- RC27 service doctor: **PASS, 22/22**.
- Rollback observation: Core **10/10** and Console **10/10** HTTP-200 samples.
- Canonical resolver again selects the RC27 CLI and pointer source revision
  `6dbfee3fbfa4ac05cade1d7382502de5d3b189eb`.
- Candidate port 4991 is stopped. RC27 remains active; there is no promotion.

### Decision and exact blocker

**GO_LIVE: NO — BLOCKED.** The production smoke did not pass because a
GLM-5-routed K4 lifecycle failed after Jev's `REFLEX_LOW_CONFIDENCE` fallback.
The exact RC47 Core descriptor used for the cutover embedded GLM access
evidence with `checkedAt=2026-09-24T22:58:40Z` and
`freshUntil=2026-09-24T23:13:40Z`. The failed Attempt/runtime-start event was
recorded at `2026-09-24T23:13:39.112Z`, less than one second before that
expiry. The descriptor saved in `rc47-refreshed-descriptors/` had a new file
modification time but retained those old embedded evidence timestamps. The
durable failure hash is the deterministic `MODEL_ACCESS_UNAVAILABLE` result;
the exact source checks freshness again at runtime start and records
`policy_admitted_model` only after that gate passes. Together, these facts
locate the failure at Brain's local access-evidence freshness gate, before
ModelGateway/provider invocation. The evidence had effectively expired by the
runtime's gate, rather than indicating a GLM provider or authentication
failure. The persisted receipt does not carry the runtime's sub-second
`startedAt`, so the exact crossing instant cannot be independently recovered;
the near-expiry window and failure code are durable.

No Brain source defect is demonstrated. The operational defect is that the
descriptor refresh did not embed the refreshed evidence timestamps and
cutover proceeded with less than one second of freshness headroom at the
recorded runtime-start event. Do not retry or promote RC47 from this window.
Any future production acceptance requires a separately scoped bounded window
after regenerating the descriptors from verified fresh evidence and checking
the embedded `freshUntil` value—not the file mtime—before service startup and
acceptance. RC27 remains the rollback baseline.
