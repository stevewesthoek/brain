# Agent Mode release maintenance

**Status:** bounded baseline normalized, 2026-09-17

This runbook covers the first supported release-maintenance mechanics for the
Brain Agent Mode lane. It does not create a new foundation phase and does not
authorize production activation, provider probing, or deployment.

## Release contract

`brain-agent-release-v1` binds release version, source revision, the validated
`brain-runtime-package-v1` package ID and manifest hash, Core/Console component
identities, StateStore schema 10, `brain-state-snapshot-v1`,
`brain-local-install-v1`, and `brain-agent-release-contract-v1`. The logical
release ID excludes timestamps and random values. Provenance uses Ed25519/SHA-
256 over canonical bounded metadata. Production signing uses the dedicated
macOS Keychain identity below; tests may still use an ephemeral fixture key.

```text
keyId: brain-agent-release-production-v1
algorithm: Ed25519
backend: macos-keychain
reference: keychain-ref://com.brain.agent.release/production-ed25519-v1
fingerprint: 348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca
access: WhenUnlockedThisDeviceOnly; synchronizable=false
privateKeyExported: false
```

The repository retains only public metadata in
`operations/release/agent-mode-release-signing-public-v1.json`. The signer
reads canonical material from stdin and returns bounded signature metadata; it
never exports private key material.

Verify the package before creating a manifest and verify both manifest and
package before install or promotion:

```text
brain-agent release create --package PACKAGE --release-version VERSION \
  --source-revision REV --key-id KEY_ID --private-key KEY_FILE --output RELEASE.json
brain-agent release verify --manifest RELEASE.json --package PACKAGE \
  --public-key PUBLIC_KEY_FILE
```

For the provisioned identity, add
`--keychain-service com.brain.agent.release --keychain-account
production-ed25519-v1 --key-id brain-agent-release-production-v1` to release
creation. The active support record is the fresh R1 candidate `1.0.0-rc.6`,
built from clean committed source `284d162926a8ee8ce80421a726a06c3a22abbd65`.
Its package ID is
`brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`
with manifest hash
`18f8c9571be1403aec9bf785a7949baa2e6508da276e1e2cf9f3dfacd7ae3b8a`.
The signed release ID is
`brain-agent-release:sha256:b5813f2c215f6db3fafc0685691cee43ba699f2d699bb748b1b4633804c03242`.
The normalized immutable baseline is the rollback target under the same v1
contracts. RC.5 and earlier RC records remain historical and are not
recreated or relabeled.

Verified release packaging must be run from a clean Git worktree with the
revision derived by `git rev-parse HEAD`. `brain-agent package build` now
fails closed on dirty source or a revision mismatch before creating its output
directory.

Do not trust filenames, mutable `ready` flags, package paths, or caller
assertions. Signature or package mismatch is a failed promotion.

## Backup and restore

Quiesce the controller and open the existing StateStore read-only. Use the
existing logical `brain-state-snapshot-v1` export; never copy a live SQLite
database/WAL and never create a second Task/Run/Attempt or result ledger.
`brain-agent-backup-v1` is only bounded metadata binding the snapshot ID/hash/
counts to the signed release ID/version.

Verify SQLite integrity, foreign keys, snapshot hashes, record bounds and
semantic state before import. Restore only into a fresh isolated target. A
populated target is a hard failure. Preserve uncertain effects and lease/fence
facts; do not replay them or infer safety from a PID.

## Promotion and rollback drill

For the current baseline, R0 is the normalized immutable package and R1 is
the separately signed RC.6 candidate using the same validated runtime
contract. The safe drill is: verify R0 and its logical backup; build and
verify R1; install R1 into a fresh isolated root with service registration and
start disabled; restore the backup into a fresh isolated R1 StateStore; run
isolated foreground startup/smoke checks; then verify rollback compatibility
and restore the R0 backup into a fresh R0 target if required.

The release gate is `promotable` only when package/signature, backup, restore,
isolated smoke, and rollback evidence say exactly verified/passed. There is no
force bypass and this baseline does not change the live Office install.
Rollback is `compatible` for matching v1 schemas, `restore-required` when the
StateStore schema changes, and `incompatible` when release/snapshot/install
contracts differ. The signed non-production drill restored the logical
snapshot into fresh R1 and R0 targets, rejected a second import into the
populated R1 target, and classified a contract mismatch as incompatible.
Failed promotion or rollback remains blocked; neither path activates a
service.

## Production readiness recovery

Before an authorized Office activation, first answer four questions from
read-only evidence: the exact retained candidate artifact, the exact running
runtime closure, the canonical active StateStore, and a compatible immutable
rollback target. A release is not ready when any one of those is inferred from
filenames, a dirty checkout, a stale database, a mutable pointer, or a legacy
observer route.

Candidate retention begins when a release becomes promotable. Use an
operator-owned application-support vault outside Git, web roots, logs, and
temporary directories, organized by immutable release/package identity. Retain
the verified runtime package, package manifest, signed release manifest, public
verification metadata, and a bounded verification receipt through the
activation and rollback window. Never retain private signing material,
credentials, StateStore files, WAL files, raw logs, or provider payloads.
Temporary reconstruction outputs are not release artifacts and may be retired
only after the retained copy has independently passed package and release
verification. If exact package or manifest identity cannot be reproduced, do
not re-sign it as the old release; cut a new immutable release instead.

The production baseline record must identify the launchd/service descriptor,
PID, executable, entrypoint, working directory, Node/runtime version, source or
install root, release/package identity where available, and runtime-relevant
hashes. Classify tracked and untracked paths by whether they can affect the
running runtime closure. A clean Core source tree does not prove that an
untracked generated Console build or manually launched service is immutable.

The canonical StateStore must be proven from at least two independent runtime
facts where possible, such as the effective config path plus an active process
file handle. A nearby SQLite file is not canonical by recency or size. During
readiness recovery do not open, checkpoint, migrate, vacuum, export, snapshot,
restore, close, or write the production Store. The expected RC.6 contract is
Store schema 10; compatibility remains unknown until the active Store is
identified.

Rollback requires a retained immutable package and manifest for the actual
production baseline, or a separately identified compatible predecessor whose
package, install contract, schema contract, and isolated startup smoke have
passed. An earlier isolated rehearsal is not automatically the live rollback
target. If the current runtime cannot be reproduced from committed source and
no immutable installed predecessor exists, return
`BLOCKED_ROLLBACK_TARGET_UNAVAILABLE` and normalize production in a separate
authorized task; do not mutate service pointers in the readiness phase.

The supported future macOS layout is one operator-owned install root with
`releases/<package-id>/`, `state/`, `config/`, and `services/` children. The
`brain-local-install-v1` plan leaves registration and start disabled until the
activation window. It is a plan, not permission to create a second Core,
second StateStore, or parallel scheduler.

## Production baseline normalization

The separately authorized 2026-09-17 normalization moved the Office Core and
Console launch agents from the mutable `brain-runtime` checkout to the
verified immutable install root:

```text
installRoot: /Users/Office/Library/Application Support/Brain/agent-mode
releaseRevision: 2a93ab565c697bc18ecb01f1a25f3f9dada11240
packageId: brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba
manifestHash: a7cd15fe3df41cdbf7de77bcd38267328a2284a32f4055107f8a61dead19c577
installId: brain-local-install:sha256:a56d5e0475ecf83eebba0958a69fbdcbc57c609fd61af045e06707584a41715f
stateStore: /Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db
```

The release payload is package-verifier clean and contains no symlinks. Core
production dependencies are hydrated in the install-root dependency layer,
outside the immutable release payload; the release verifier remains clean.
The service descriptors use the supported `brain-runtime-config-v1` profile
plus explicit state/port environment overrides, because the current runtime
loader honors `BRAIN_RUNTIME_PROFILE_PATH` and the explicit compatibility
variables. Console standalone startup additionally requires `PORT=4881` and
`HOSTNAME=127.0.0.1`; `BRAIN_CONSOLE_PORT` alone is not a Next standalone
server setting.

The canonical Store was absent before cutover, so one empty schema-10 Store was
initialized after the legacy services stopped. It passed integrity and foreign
key checks and contained zero agents, tasks, runs, and attempts. No migration,
backup, or existing-state discard occurred. The persistent `backups/` root is
owner-only and reserved for the next logical StateStore backup; it contains no
copy of the empty Store.

The exact pre-change descriptors are retained at:
`/Users/Office/Library/Application Support/Brain/agent-mode/recovery/2026-09-17T221500Z-legacy-launchd/`.
If the normalized health gate fails, stop only the two current launch agents,
restore those exact descriptor files, bootstrap the two `com.office.*` labels,
and verify the legacy Core/Console health routes. Do not delete the normalized
release or Store during rollback diagnosis. If the five-minute observation
passes, the immutable package is the retained rollback target for the next
authorized RC.6 task; the separate RC.6 candidate procedure is recorded below.

Normalization evidence is in
`operations/reports/agent-mode-production-baseline-normalization-evidence-2026-09-17.md`.

## RC.6 signed candidate and isolated promotion — 2026-09-17

Fresh candidate `1.0.0-rc.6` was cut from clean committed revision
`284d162926a8ee8ce80421a726a06c3a22abbd65`:

```text
packageId: brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe
packageManifestHash: 18f8c9571be1403aec9bf785a7949baa2e6508da276e1e2cf9f3dfacd7ae3b8a
releaseId: brain-agent-release:sha256:b5813f2c215f6db3fafc0685691cee43ba699f2d699bb748b1b4633804c03242
```

The package was reproduced from clean source and verified before signing with
`brain-agent-release-production-v1` in the macOS Keychain. Release/package
tamper checks fail closed. The verified candidate is retained outside Git in
the application-support release vault by package identity with its signed
manifest, public verification metadata, and bounded verification receipt.

The logical `brain-state-snapshot-v1` backup was verified and restored into
fresh RC6 and normalized-baseline targets; a second import into a populated
target was rejected. The fixture retained Jarvis/K5 state, scheduler/review
metadata, lease/fence lineage, settled effects, and one uncertain effect
without replay. Rollback compatibility with the normalized baseline is
`compatible`; contract mismatch is `incompatible`.

The installed candidate passed foreground read-only Core/Console smoke on
temporary localhost ports and was stopped. No service registration, production
pointer change, production Store import, provider/model/network call, or
publication occurred. Candidate disposition is **PROMOTABLE** only for a
separately authorized production activation window; production activation is
**NOT STARTED**. Evidence:
`operations/reports/agent-mode-rc6-signed-release-candidate-evidence-2026-09-18.md`.

The exact next task is **separately authorize and execute production RC.6
activation**; do not start it automatically.

## Operational handoff

Monitor release/source/package/manifest hashes, backup ID, snapshot aggregate
hash, install ID, restore verification, uncertain effects, active leases, and
service startup/health receipts. An incident preserves those IDs, stops
promotion, avoids replaying uncertain effects, and diagnoses only in a fresh
isolated target. Cost is reconstructed from authoritative settled StateStore
facts, not requested envelopes; the offline fixture has zero provider/model
cost. Support is limited to the v1 contracts, package Node/npm ranges, and one
local controller/SQLite store. Retain old manifests/backups for the rollback
window. Future schema migration requires a new compatibility decision, fresh
restore evidence, and a new signed release; it must not mutate a release.

Release verification, logical backup/restore, and promotion assessment are
offline/read-only mechanics. The baseline and signed non-production drill
perform zero live provider/AWS/network/SSH/Tailscale/BrainNode/Workcell/
Harness/ModelGateway effects and no production Office activation. The only
started process was the installed candidate Core in the disposable root, in
the foreground on localhost, and it was stopped after read-only `/status` and
`/agent-mode/observer` smoke checks.

The production normalization is the separate exception authorized on
2026-09-17: it stopped and restarted only the two existing user launch agents,
created one previously absent empty schema-10 Store, and performed localhost
health reads. It made zero provider/model/AWS/SSH/Tailscale/BrainNode/Workcell/
Harness/ModelGateway effects and created zero Agent Mode lifecycle records.

## Key rotation, retirement, and revocation

Rotate by provisioning a new Keychain item under a new key ID, publishing its
public key/fingerprint metadata, signing and verifying a candidate with the
new identity, and switching the active release procedure only after an
isolated promotion drill passes. Retain old public metadata for historical
verification and rollback-window support; never export or copy private keys.

Retire or revoke by marking the public identity metadata non-active in the
release record, stopping new signing, and retaining the public key for
historical verification. If compromise is suspected, block affected release
promotion, preserve manifests and backup evidence, provision a new identity,
and issue a replacement candidate. Keychain deletion/revocation is not part
of the routine drill.
