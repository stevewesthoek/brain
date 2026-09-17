# Agent Mode clean signed release-candidate evidence — 2026-09-17

## Result

**PASS for the isolated non-production RC.5 reconciliation.** A fresh
`1.0.0-rc.5` candidate was built from an isolated clean checkout at committed
source `c81c6785bc976fc88b8492bd0eb1e20b2f8cd961`. The candidate was signed and
verified with the existing macOS Keychain Ed25519 identity, restored into fresh
isolated targets, smoke-tested from installed package contents, and rolled back
to an isolated R0 target. Production activation, service registration, public
publishing, push, and live Office StateStore access were not performed.

RC.4 remains a historical functional candidate. It was not promoted because
its declared source revision preceded the package-builder correction later
committed in `c81c6785`. Its historical evidence was preserved unchanged.

## Provenance and package identity

- Starting HEAD: `c81c6785bc976fc88b8492bd0eb1e20b2f8cd961`
- Source tree: `f6549f993a998d6311edc371417b9b62fc78d23c`
- Clean isolated checkout: `git status --short` empty before and after Core/
  Console builds (dependency links were removed before the status check).
- Release: `1.0.0-rc.5`
- Release ID: `brain-agent-release:sha256:5028c78a4369950f6481093c772a855e1c90819469c301b025c876f530cec8ce`
- Runtime package ID: `brain-runtime-package:sha256:39df90b4497f2107f78ab4beb4f6457ff9d1f5dcdfb3d4c6397af065a94898c5`
- Package manifest hash: `c343d410536a8d9f2c26761256f9849bfac5e7220021190411319eedfa639584`
- Package closure: 2,467 files, 64,401,086 bytes; Core and Console component
  identities were `sha256:3933e0535d12c0c21365f1dda8adb30afca0e1c182c59c87a876d57ec1c380fb`
  and `sha256:e89a6b78eeb03df9017d52e91e989f6ad759555a63d2434b0f5ceeb4cf98ddbf`.
- Package verification: passed; no symlinks, personal paths, secrets, logs,
  mutable state, or unsupported package files were admitted.
- Source/package/release equality: passed. The package `releaseRevision`, the
  signed release `sourceRevision`, and `git rev-parse HEAD` are identical.

The package CLI now invokes a fixed-argument Git provenance check for verified
builds. A dirty build against the shared primary worktree failed closed before
creating an output directory; a temporary Git fixture also proved clean,
mismatched, and dirty cases. The protected unrelated worktree state remained
untouched.

## Signing identity

- Key ID: `brain-agent-release-production-v1`
- Algorithm/backend: Ed25519 / macOS Keychain
- Reference: `keychain-ref://com.brain.agent.release/production-ed25519-v1`
- Fingerprint: `348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca`
- Private export: false; access: `WhenUnlockedThisDeviceOnly`,
  synchronizable false.
- Keychain signing operations: 2 bounded operations (RC.5 and isolated R0
  rollback target).
- Signature verification: passed with the repository's public metadata; no
  private key material entered the repository, package, evidence, or output.

An intentionally wrong-source manifest was rejected with
`PACKAGE_MISMATCH`; promotion assessment for that release was `blocked`.
The verified RC.5 assessment was `promotable` with no blockers.

## Isolated promotion, backup, and rollback

R0 was signed separately as `0.9.0` under the same v1 contracts:

- R0 release ID:
  `brain-agent-release:sha256:9ab20b58592af4b3599f652e560387cdfc58fe98335fc1ee404fbbd9bf43e2fe`
- R0 source revision and package identity matched RC.5.
- Rollback compatibility: `compatible`.

The representative logical StateStore fixture contained 3 organization work
items, 3 child assignments, 3 organization spawn receipts, 5 agents, 5 tasks,
5 runs, 4 attempts, 4 budget reservations, 4 effects, 1 organization final
result, 1 pending review request, 1 schedule, and 1 uncertain effect. It was
exported through the existing read-only `brain-state-snapshot-v1` path; no raw
SQLite/WAL copy or second result ledger was used.

- Snapshot ID:
  `brain-state-snapshot:sha256:9340a1c9eefbf8288b0fe48985e3c86809e5433e1492379968fd6d4e0b59174b`
- Snapshot aggregate hash:
  `d7944eee0b514bff1103f4e677c0f57ba0052dfb9d5a119100a62291a5925af8`
- RC.5 backup ID:
  `brain-agent-backup:sha256:abf775a8d9116c3dff882e09a8980138b78a9d448dbedc7fce3dc96b9f6543ba`
- Backup hash:
  `dd980b197eada76bad9cb63c452b4617b64cde425fb398c048e812f9b7da6395`
- Backup verification: passed.
- Fresh restore into isolated R1 and R0 targets: passed.
- Reopen reconstruction: both targets had 52 record families and were byte-
  equivalent at the portable-record-family level.
- Second import into the populated R1 target: rejected with
  `TARGET_NOT_FRESH`.
- Uncertain effect replay: existing exact-once semantics returned duplicate
  without adding a record; no effect was replayed.

## Installed runtime smoke

RC.5 was applied into a fresh disposable install root with service descriptors
left unregistered and stopped. The installed Core was then launched from `/`
with a temporary HOME, isolated StateStore, empty `NODE_PATH`, and only the
hydrated install-root dependency directory. No source checkout or developer
HOME fallback was available.

- Install ID:
  `brain-local-install:sha256:3f88dae1ae64154cd67aa0df302b480e8539ebfbaec8a9ba06da076ca26259f0`
- Installed package/revision equality: passed.
- Read-only `/status`: passed (`ok: true`).
- Read-only `/agent-mode/observer`: passed against a pre-created isolated
  empty StateStore (`availability: empty`).
- Foreground process stopped and confirmed absent: passed.
- First observer probe before StateStore creation returned `unavailable`, as
  designed; it did not manufacture empty state.
- Console startup was not required for this Core release smoke and no service
  manager registration/start occurred.

## Effects and safety counts

The rich fixture test used only the existing deterministic in-process fixture
runtime to establish representative state; it made no external calls. The
release operation itself had these counts:

| Effect | Count |
| --- | ---: |
| live provider/AWS/Bedrock calls | 0 |
| network calls outside localhost smoke | 0 |
| SSH/Tailscale operations | 0 |
| AgentRuntime/ModelGateway/Harness calls outside fixture test | 0 |
| BrainNode operations | 0 |
| Workcells created by release operation | 0 |
| repository mutations through Agent Mode | 0 |
| production Office StateStore reads/writes | 0 |
| service-manager registration/start | 0 |
| public publish / Git push | 0 |
| Keychain signing operations | 2 |

The package and release contracts contain no provider raw payload, prompt,
hidden reasoning, credential, private-key, or environment-value material.

## Validation

- Clean-source/package/release focused checks: passed.
- Runtime package, release-maintenance, and production-signing fixture tests:
  **12 passed, 0 failed**.
- Existing rich representative fixture backup/restore test: **1 passed, 0
  failed**.
- Core build after the provenance guard: passed.
- Dirty-source CLI rejection: passed; output directory was not created.
- Release mismatch rejection: passed.
- Backup/restore and exact-once checks: passed.
- Installed Core startup/status/observer smoke: passed.
- `git diff --check`: passed.
- Brain Core typecheck and final build after the provenance guard: passed.
- Full Brain Core suite completed under a temporary local-only AWS S3
  emulation (the historical suite otherwise invokes the AWS CLI): **2,628
  passed, 6 failed, 0 skipped**. The six failures are pre-existing and
  unrelated to this release reconciliation: five `agent-orchestrator.test.js`
  timing/fixture assertions and the known VO metadata-title expectation in
  `vo-studio-write.test.js`. The AWS emulation made no network calls and is
  not part of the release artifact. No K5/H0 release-maintenance test failed.
- Brain Console source disposition: no Console source change was needed for
  this release reconciliation; the prior RC.4 Console build remains part of
  the package closure and was not rebuilt from a dirty source.

## Current records and next authority

The roadmap, progress record, and release-maintenance runbook now identify
RC.5 as the active candidate and preserve RC.3/RC.4 historical reports. No
production activation is authorized by this evidence. The Agent Mode lane
remains in release-maintenance mode with no new foundation phase; the next
step requires a separate explicit release decision, not automatic activation.
