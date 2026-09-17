# Agent Mode release-maintenance baseline evidence — 2026-09-17

## Status

**COMPLETE for the bounded release-maintenance baseline.** Agent Mode remains
in release-maintenance mode. No new foundation phase was created, and no live
Office release was activated.

Starting HEAD was `72fc9fd7 docs(agent-mode): select post-H0 roadmap direction`.
The only pre-existing worktree entries were the protected/unrelated paths:
`operations/accounts/credentials-index.md`, `tools/firecrawl/logs/firecrawl.log`,
`operations/specs/mindcontrol-product-roadmap.md`, and
`operations/specs/nevermind-release-pipeline-roadmap.md`. Their values were not
read and they were not modified, staged, reset, cleaned, or committed.

K0–K5, U0, V0, D0 and H0 were already recorded complete. H0-G2 was the
corrected disposable provider/remote-node acceptance and left zero disposable
resources. The post-H0 decision explicitly selected this release-maintenance
baseline and no H1/K6 foundation phase.

## Contract and implementation

`projects/brain-core/src/agent-mode/release-maintenance.ts` adds the smallest
release layer above the existing validated primitives:

- `brain-agent-release-v1` is a strongly typed manifest with Ed25519/SHA-256
  provenance. The logical release ID is deterministic and binds release
  version, source revision, runtime package ID, package manifest hash, Core and
  Console component identities, StateStore schema 10, snapshot schema,
  install contract, release contract and Node range.
- `verifyReleaseManifest()` first invokes the existing
  `verifyRuntimePackage()` authority, then checks package/revision/hash
  correspondence, supported schema versions, deterministic identity and the
  external public-key signature. Filename or path trust is not used.
- `brain-agent-backup-v1` is metadata only. It binds a signed release to the
  existing quiesced logical `brain-state-snapshot-v1` ID, aggregate hash,
  counts and schema. It does not serialize a second domain ledger.
- `assessReleasePromotion()` requires exact verified/passed package, signature,
  backup, restore, isolated smoke and rollback evidence. There is no force or
  `ready=true` bypass.
- `assessRollbackCompatibility()` distinguishes compatible v1 rollback,
  schema-change restore-required rollback and incompatible contract changes.
- `brain-agent release create|verify` provides the offline CLI seam. Private
  keys are read as external input and never emitted or stored in Git.

The test key is generated ephemerally in memory. No production signing
identity was provisioned. This is a fixture signing proof, not a claim of
production key custody or public release publication.

## Backup, restore and rollback drill

The fixture creates an empty but valid StateStore, closes it, reopens it
read-only, creates a logical `brain-state-snapshot-v1` in
`backup/logical-fixture` mode, wraps it in `brain-agent-backup-v1`, verifies
the snapshot/backup identity, imports into a fresh isolated target, and proves
that a second import into the populated target fails. Snapshot verification
preserves the repository's existing integrity, count/hash, foreign-key,
uncertainty and lease/fence semantics; release code never replays uncertain
effects or treats a PID as authority.

R0 is honestly classified as the current validated pre-promotion baseline at
`72fc9fd7`; no fabricated historical release was introduced. The candidate
uses the same validated fixture package contract as an isolated R1. The
promotion assessment remains blocked until restore, isolated smoke and
rollback proofs are explicitly passed, and then becomes `promotable`. No
service registration/start, AWS call, provider probe, network operation or
Office state mutation occurs.

## Failure and safety evidence

The focused tests prove:

- package file tamper, release metadata tamper, wrong release expectation and
  wrong public key fail verification;
- unsupported package/runtime or contract material cannot be accepted;
- backup hash, snapshot ID/hash/count and deterministic backup ID are checked;
- populated restore targets are rejected, so re-import cannot duplicate state;
- promotion remains blocked when any required gate is missing;
- rollback requires explicit schema/contract compatibility;
- release/package manifests contain no private signing material, credentials,
  provider payloads, prompts or runtime authority.

The release layer contains no Agent/Task/Run/Attempt insertion, budget
reservation, settlement, runtime dispatch, ModelGateway call, Harness launch,
BrainNode operation, Workcell operation, provider call, network access or
second result/cost ledger. Existing StateStore and K4/K5 remain authoritative.

## Validation

Focused release-maintenance tests: **4 passed, 0 failed**.

Full Brain Core suite: **2,631 passed, 0 failed, 0 skipped**. This includes
the K5-A/K5-B/K5-C, D0, H0, package/install/state relocation, scheduler,
Jarvis, uncertainty, lease/fence and runtime regression coverage. The prior
unrelated Video Orchestrator timing/metadata failures did not recur in this
run.

Brain Core typecheck: **passed**.

Brain Core build: **passed**.

`git diff --check`: **passed**.

Brain Console validation: source unchanged; no Console build/test was needed
for this backend-only maintenance slice.

Standard effects: live providers **0**, AWS/Bedrock **0**, MiniMax/GLM/Opus
**0**, Codex **0**, ModelGateway **0**, Harness **0**, network **0**,
SSH/Tailscale **0**, remote BrainNode **0**, Workcells **0**, production Office
state/signals **0**, service-manager mutations **0**, deployment/public
publishing **0**.

## Operational handoff

The dedicated runbook is
`operations/runbooks/agent-mode-release-maintenance.md`. It records release
verification, logical backup/restore, fresh-target rules, promotion/rollback,
monitoring, incident handling, cost reconstruction, support/version policy and
future migration requirements. The current gap is external production signing
identity provisioning and a separately authorized non-production promotion;
neither is silently inferred from the fixture key.

## Decision and next task

The release-maintenance baseline is complete. Agent Mode remains in
release-maintenance mode, not a new foundation phase. The exact next bounded
operational task is to provision/document an external production signing
identity and run a separately authorized non-production signed promotion,
when that operational need is approved. No further Agent Mode foundation phase
is authorized by this report.
