# Agent Mode Production Signing and Non-Production Promotion Evidence

Date: 2026-09-17

## Outcome

The bounded release-maintenance operation passed. A dedicated Ed25519 signing
identity was provisioned in the local macOS Keychain, one corrected Agent Mode
release candidate was signed and verified, and the candidate passed an
isolated non-production install, logical StateStore backup/restore, foreground
read-only smoke, rollback rehearsal, exact-once checks, and fail-closed failure
checks.

No production Office StateStore, runtime, service registration, provider, AWS,
SSH, Tailscale, BrainNode, Workcell, Harness, ModelGateway, or repository
mutation was used. No release was published or pushed.

## Starting state and scope

- Starting HEAD: `78c14f46 feat(agent-mode): add release-maintenance baseline`.
- K0–K5, U0, V0, D0 and H0 were already complete for their recorded gates.
- The protected credential index, Firecrawl log, and unrelated roadmap files
  were not read, modified, staged, or committed.
- The operation was limited to the release-maintenance baseline's explicitly
  authorized signing and isolated non-production drill.

## Signing identity

The identity is a dedicated macOS Keychain generic-password item, not a file
key and not a model/provider credential:

```text
keyId: brain-agent-release-production-v1
algorithm: Ed25519
backend: macos-keychain
reference: keychain-ref://com.brain.agent.release/production-ed25519-v1
fingerprint: 348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca
access: WhenUnlockedThisDeviceOnly; synchronizable=false
privateKeyExported: false
```

Only the public key and fingerprint are recorded in
`operations/release/agent-mode-release-signing-public-v1.json`. The Swift
signer accepts bounded canonical material on stdin and never exports private
key bytes. Re-running provisioning refuses replacement of the existing item.

Rotation is a new key ID and Keychain item, public metadata publication,
candidate verification, and a new isolated drill. Retired/revoked identities
stop signing but retain public metadata for historical verification and the
rollback window. Routine deletion/revocation was not performed here.

## Candidate and package

R0 was signed as `0.9.0` for the rollback rehearsal. R1 was signed as
`1.0.0-rc.4` from source revision `78c14f46`:

- release ID:
  `brain-agent-release:sha256:994dfc44a47d566072efedf63607c92505cb67e1569905858205bdf313489b8b`
- package ID:
  `brain-runtime-package:sha256:72c8729d0d9af537133f3bfa4d67c94f294dd34eb373d13cdb64f3f07597cccc`
- package manifest hash:
  `dde42275ac3b9adde8e152018a2c0cdb3ed4a267526bbe7c996554cf5347bc66`
- package file count: `2467`
- package total bytes: `64394406`
- isolated install ID:
  `brain-local-install:sha256:8c870e887f6b07dcf7b561676e87fa8a35c700c5b0204a0dcf17aa2326598a80`
- R0 release ID:
  `brain-agent-release:sha256:d3a89e6bd9d0f9d40dc5d58633908d4a34c94d88325d10f08a378e01110c9a23`

The first two disposable smoke attempts exposed that the package builder
omitted the Core's `.mjs` files, repository-level support imports, and the
declared production dependency hydration. The bounded package boundary was
corrected to include the required Core support closure and to resolve it
inside the installed release; local dependency hydration was then supplied in
the disposable install root without network access. The package test now
covers `.mjs` entries and the support closure; the final regenerated package
verified cleanly.

## Backup, restore, and rollback

The representative fixture contains one Jarvis root/supervisor, the K5
organization plan and final result, three child assignments, Jarvis result and
response records, review/workcell evidence, one uncertain effect, scheduler
state, budgets, leases, and fence lineage. It is exported as the existing
logical `brain-state-snapshot-v1`, not as a live SQLite/WAL copy.

- snapshot ID:
  `brain-state-snapshot:sha256:9340a1c9eefbf8288b0fe48985e3c86809e5433e1492379968fd6d4e0b59174b`
- snapshot aggregate hash:
  `d7944eee0b514bff1103f4e677c0f57ba0052dfb9d5a119100a62291a5925af8`
- backup ID:
  `brain-agent-backup:sha256:34b795ab2cd0c1bd0368d2d0def3dfbfd1ae55dfe325c7ec201f7de575aa7399`
- backup hash:
  `c08110a9c913129cca1adea68f2eca3f35d2ef15d15909f708a349ec3fc6b013`
- backup verification: PASS
- fresh R1 restore: PASS
- fresh R0 rollback restore: PASS
- second import into the populated R1 target: rejected as `TARGET_NOT_FRESH`
- uncertain-effect replay: duplicate/no record growth

Portable record-family comparison after restore was exact. The restored
fixture retained one organization final result, one Jarvis response, one
pending review, one schedule, one uncertain effect, and the complete K5/K4
lineage.

## Promotion and failure gates

The real candidate, package, snapshot, backup, restore, smoke, and rollback
checks produced `promotable` with no blockers. The tampered release version was
rejected by the repository verifier. A rollback candidate with an incompatible
install contract was rejected as `incompatible`. Neither failure path started
or activated a service.

The installed R1 candidate was started only in the disposable install root,
foreground, on `127.0.0.1:4979`, with the restored disposable StateStore. The
read-only `/status` and `/agent-mode/observer` requests succeeded, and the
process was stopped and confirmed absent. No LaunchAgent registration or
service manager activation occurred.

## Effects and counts

| Effect | Count |
|---|---:|
| production Office state/runtime changes | 0 |
| provider/AWS/Bedrock calls | 0 |
| SSH/Tailscale/network effects | 0 |
| BrainNode operations | 0 |
| Workcell operations by release drill | 0 |
| Harness launches | 0 |
| ModelGateway calls | 0 |
| repository mutations through Agent Mode | 0 |
| service registrations/activations | 0 |
| public releases/pushes | 0 |

The process launches were limited to disposable installed-Core smoke attempts;
the final attempt passed and was stopped cleanly. They were not worker
executions and did not call a provider.

## Validation

The deterministic production-signing fixture test passed and preserved the
representative K5/Jarvis/review/scheduler/uncertain/effect/lease graph across
logical restore, including exact-once effect replay. Package and relocation
regressions passed after the support-closure fix. The focused release,
production-drill, package, and relocation run passed 15/15 tests. The full
Brain Core suite passed 2633/2633 tests. Brain Core typecheck, build, and
`git diff --check` passed.

## Operational disposition

The production signing identity remains active and persistent in the macOS
Keychain. The signed candidate is a non-production release candidate only.
Production installation, service registration, activation, deployment, and
publishing remain separately authorized and were not performed.

The Agent Mode lane remains in release-maintenance mode. This operation does
not create a new foundation phase or change Agent Mode authority.
