# Agent Mode RC48 production activation evidence — 2026-09-25

## Outcome

RC48 is production-active. The accepted source remains immutable at
`0674c11877348069b5ad06d51e47118fb5969abc`; the release artifact was not
rebuilt or modified during activation. RC47 remains the immediate retained
rollback target. Canonical `origin/main` contained the accepted source and
isolated-acceptance evidence before this activation report was added.

## Release and source identity

- Version: `1.0.0-rc.48`.
- Source: `0674c11877348069b5ad06d51e47118fb5969abc`.
- Package: `brain-runtime-package:sha256:b0fb30ada370d9aedc196f386f50d95eab23cd23a1fba4326670ca158a0e9a13`.
- Package manifest hash: `fa0ec49fa321b6f1df85f0d21ea150a613b7972ae09f59126a052ae74028ed6a`.
- Release: `brain-agent-release:sha256:fd7fc7cff41a1c0831851930f8f2a049fecf916e7017e0dcefb7287251dcaa3d`.
- Signature: Ed25519 verification passed against the retained production public key.
- Artifact completeness: 2,567 files, 65,780,239 bytes; package and release source identities verified.
- Canonical main at source integration: `7c8f6ba40652265e5bee492d4c4fc8b9b07691d0` (remote confirmed). This report and updated support record are included in the following scoped main commit.

## Backup and rollback

A private pre-cutover backup was created before changing the RC47 services:

- Backup ID: `brain-agent-backup:sha256:17f791e0961684686043fe2450e45faff6294441c5636440295504fe05696052`.
- State snapshot: `brain-state-snapshot:sha256:959d6dbf59a7d39d7ce70ba395f424c117a7e012665edc2da6224f3ed9a52c01`.
- Location: `/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc48-go-live-precutover-20260925T1630Z.AtRumu`.
- Snapshot verification, SQLite integrity, and foreign-key checks passed. Backup contains pre-cutover install pointer, RC47 Core/Console descriptors, RC47 package/release metadata, and verification receipt.
- Immediate rollback is retained RC47: package `brain-runtime-package:sha256:0401f3ccf6f983b1b82478282c95361f918cb1234b32ebffff85dcc0cf95f2f7`, source `8f4ad9683a28007888a758ea0713f8d5288f8e79`, release `brain-agent-release:sha256:25986914d0ff3cbd667fb5277610b3b650757cd4a34d4522985de992bf520bd4`.
- Rollback was prepared and verified; it was not performed.

## Cutover and service health

The RC47 Core and Console labels were booted out and confirmed absent before
the RC48 descriptors and active install pointer were atomically selected. The
same canonical config, secrets reference, StateStore, listener addresses,
service labels, and production environment were preserved. RC48 Core and
Console were then bootstrapped.

- Core `http://127.0.0.1:4877/status`: HTTP 200.
- Console `http://127.0.0.1:4881/agents`: HTTP 200.
- Read-only production service doctor: PASS, 22/22, including exact release and
  source identity, launchd ownership/cardinality, external secret reference,
  StateStore schema 11, SQLite integrity, and foreign keys.
- Agent Mode scheduler projection: latest durable tick `NO_ACTION`, zero
  schedules and zero pending/claimed work. This is the expected no-due-work
  result; no scheduler mutation was made. The separate Office Nightly
  Scheduler integration endpoint remains a placeholder and was not changed by
  this Agent Mode release.
- Model-access evidence embedded in the active Core descriptor was refreshed
  under the already-approved read-only path at `2026-09-25T16:35:32.503Z` and
  remains valid through `2026-09-26T16:35:32.503Z`: MiniMax M2.5 and GLM-5 are
  verified callable in `us-east-1`. No provider probes were made by the
  projection or health requests.

## Bounded production Jarvis acceptance

Exactly three authorized prompts were submitted through the RC48 CLI to the
production Core URL, with no repository context and one linked Jarvis
conversation. All three completed through `runtime:model-gateway`, selected
`agent-mode/minimax-m2.5`, and have one completed K4 Attempt, a verified
runtime dispatch receipt, and durable result/evidence references. Settled
ModelGateway cost totals `$0.001121` across the three Attempts. There were no
Codex escalations or repository contexts.

| Turn | Root | Attempt | Result / evidence reference | Jev state |
|---|---|---|---|---|
| `hi` | `root:jarvis:sha256:45a0b15e95226d242efa3ecd6b9e5da7430428cb85ab1ef6d8a5eb2a930dacc3` | `attempt:child-assignment:399a6a32353ae6854e86847635f70738fcbe98cf709d90b99785bd50d990ec2a` | `b799b1a7ba2dbca52e612136e4d4dd8279b085369a792d1a5a7400e8b34e46e1` / `evidence:model-gateway:b799b1a7ba2dbca52e612136e4d4dd8279b085369a792d1a` | deterministic simple-turn bypass (`REFLEX_SKIPPED_SIMPLE_TURN`) |
| `which model is this?` | `root:jarvis:sha256:d0be3215d9f7fca4c4a52c357c7c043494a923c1caed14cd2154a5966631df16` | `attempt:child-assignment:37d597a2f529e96315d94286f599a74d97401956c5dba19d8106cecc4df09922` | `730b1068c207ac4cf6b857514b44e038825efb56484eaff3570129263849c32f` / `evidence:model-gateway:730b1068c207ac4cf6b857514b44e038825efb56484eaff3` | Jev ran; low-confidence fallback, recommendation not applied (`REFLEX_LOW_CONFIDENCE`) |
| `Do you make use of Jev?` | `root:jarvis:sha256:06c2c2d0b64a31efa104b5d6133237c6ab3416443d9b75886043a8eaf6e78a0b` | `attempt:child-assignment:8e3eb42ea41d8caf1ca356707e7388f78636879b94f017f4ee54076f91389b17` | `fd8db9c1b2a98956a1321f7272c1eafa8dd8706607ae838f6b1292ef630aa1da` / `evidence:model-gateway:fd8db9c1b2a98956a1321f7272c1eafa8dd8706607ae838f` | Jev ran; low-confidence fallback, recommendation not applied (`REFLEX_LOW_CONFIDENCE`) |

For the model question, Jarvis returned Brain-derived routing disclosure:
Auto selected MiniMax M2.5 through ModelGateway. For the Jev question, the
answer also reported Jev ran and the low-confidence fallback; it did not claim
Jev was absent. The packaged RC48 terminal renderer was invoked against each
durable turn status and displayed matching authoritative states: deterministic
bypass for `hi`, and low-confidence fallback for the latter two. Brain route,
terminal header, and Jarvis answer agree. No further live prompts were sent.

The Jev bridge remains configured in active pilot mode; the two nontrivial
turns recorded low-confidence fallback rather than applying a recommendation.
The simple greeting was intentionally bypassed. The global monthly ceiling is
`$10`; post-acceptance ledger reports `$9.993556` remaining. Brain retained
final routing authority; Codex was not admitted or selected.

## Final activation state

- Active release: RC48, exact retained package and source.
- Main: accepted source and evidence pushed without force; activation report
  and support record are included in the scoped follow-up commit.
- Core, Console, service doctor, and StateStore: PASS.
- Auto greeting: MiniMax M2.5.
- Model identity and Jev status: Brain-authoritative and consistent with the
  packaged terminal renderer.
- Duplicate attempts: zero; one unique completed Attempt per authorized turn.
- Harness, BrainNode, Workcell, and repository-write effects: zero.
- Immediate rollback: RC47, retained and verified; not performed.
