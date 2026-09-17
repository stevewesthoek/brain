# Agent Mode release maintenance

**Status:** bounded baseline complete, 2026-09-17

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
creation. The active support record is R1=`1.0.0-rc.3`, source `78c14f46`,
package ID
`brain-runtime-package:sha256:1b90831bed1e4fa2d309046b6647958f3ba2014ab45cbff3058599a14d1c275e`,
and R0=`0.9.0` is the rollback rehearsal target under the same v1 contracts.

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

For this first baseline, R0 is the current validated pre-promotion baseline
(`72fc9fd7`) and R1 is a separately signed candidate using the same validated
runtime contract. The safe drill is: verify R0 and its logical backup; build
and verify R1; install R1 into a fresh isolated root with service registration
and start disabled; restore the backup into a fresh isolated R1 StateStore;
run isolated foreground startup/smoke checks; then verify rollback
compatibility and restore the R0 backup into a fresh R0 target if required.

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
