# RC47 Production Activation Attempt — 2026-09-24

## Outcome

**BLOCKED; production rolled back to RC27.** The authorized RC47 production
window completed artifact retention, fresh backup/restore proof, corrected
descriptor validation, and launchd cutover. The first production
`repos → Auto` read-only submission returned `terminal intake failed` and
exited nonzero. This is a critical acceptance failure under the promotion
authorization, so the smoke was not retried and production was immediately
restored to the verified RC27 service descriptors and install pointer. The
shared StateStore was not restored or modified during rollback.

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
terminal intake boundary. No provider/runtime identity or lower-level error
code was returned to the caller, so this report does not infer a cause.

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
are included. Production Auto admission, Jev participation in a Jarvis turn,
history/resume behavior for a new production turn, and the post-cutover
observation window remain unverified because the initial terminal intake gate
failed. The appropriate next action is a separately authorized diagnosis of
the production terminal-intake failure against RC47, followed by a new explicit
promotion/acceptance authorization only after the cause is established. RC27
remains active and is the rollback baseline.
