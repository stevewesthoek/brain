# Agent Mode RC.6 signed release-candidate evidence — completed 2026-09-18 (run initiated 2026-09-17)

## Outcome

**RC.6 PROMOTABLE; production activation NOT STARTED.** A fresh candidate was
built from the normalized immutable baseline, signed with the existing
dedicated macOS Keychain Ed25519 identity, verified against tamper, retained
outside Git, restored through the logical StateStore backup contract, and
smoke-tested from an isolated installed package.

No production service, descriptor, pointer, StateStore, scheduler, provider,
AWS resource, network, repository, or release publication was mutated.

## Starting state and reconciliation

- Starting HEAD: `284d162926a8ee8ce80421a726a06c3a22abbd65`
  (`ops(agent-mode): normalize production baseline`), a legitimate later
  revision than the earlier RC.6 planning baseline.
- K0–K5, U0, V0, D0 and H0 were already complete for their recorded gates;
  H0-G2 had already closed the external H0 gates.
- Existing protected unrelated worktree paths remained untouched and
  unstaged. Pre-existing dirty paths were preserved.
- Normalized rollback baseline: package
  `brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba`,
  revision `2a93ab565c697bc18ecb01f1a25f3f9dada11240`, manifest hash
  `a7cd15fe3df41cdbf7de77bcd38267328a2284a32f4055107f8a61dead19c577`.

## Candidate package and signing

The clean detached source worktree was revision
`284d162926a8ee8ce80421a726a06c3a22abbd65`, tree
`37d35e5415d28502e84afaab7e27bf2208a0b2bd`, with no source changes. Dirty
source packaging remains fail-closed. Two builds from the same generated
artifacts were identity-equivalent:

- package ID:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`
- package manifest hash:
  `18f8c9571be1403aec9bf785a7949baa2e6508da276e1e2cf9f3dfacd7ae3b8a`
- file count: `2467`; total bytes: `64395659`; symlinks: `0`;
  package verifier: PASS
- Core build identity:
  `sha256:e57fcb3b2f18930403e0a97428362c2fba24eed560105d0800278dbfaf2ab8d9`
- Console build identity:
  `sha256:0850fae9a29a5a2c0be7d458db3acc992ec248519e28e46084e4ebf230bc87c1`
- package closure contained no verifier-authoritative personal path or
  private-key material.

The candidate is `1.0.0-rc.6`, release ID
`brain-agent-release:sha256:b5813f2c215f6db3fafc0685691cee43ba699f2d699bb748b1b4633804c03242`,
with predecessor `1.0.0-rc.5`. The existing Keychain identity was verified
before signing:

- key ID: `brain-agent-release-production-v1`;
  algorithm/backend: Ed25519 / macOS Keychain
- fingerprint:
  `348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca`
- reference: `keychain-ref://com.brain.agent.release/production-ed25519-v1`
- `privateKeyExported: false`

Release verification passed with the published public metadata. Tamper checks
failed closed for release-version (`INVALID_MANIFEST`), package-byte
(`PACKAGE_UNVERIFIED`), signature (`SIGNATURE_INVALID`), and expected-source-
revision (`PACKAGE_MISMATCH`) changes.

The verified candidate is retained at
`/Users/Office/Library/Application Support/Brain/agent-mode/releases/brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe/`
with package, signed release manifest, public verification metadata, and a
bounded verification receipt. Private signing material is not retained.

## Logical backup, restore, and rollback

The representative fixture used the existing logical
`brain-state-snapshot-v1` contract, not a live SQLite/WAL copy. It included a
Jarvis root/supervisor, K5 plan/final result, three child assignments, review
attention, scheduler state, budget/lease/fence facts, settled effects, and one
uncertain effect.

- snapshot ID:
  `brain-state-snapshot:sha256:9340a1c9eefbf8288b0fe48985e3c86809e5433e1492379968fd6d4e0b59174b`
- snapshot aggregate hash:
  `d7944eee0b514bff1103f4e677c0f57ba0052dfb9d5a119100a62291a5925af8`
- backup ID:
  `brain-agent-backup:sha256:3636daf53b5a932f6508004ed5f62437d55928099c32abb2ee1fa647df928ae9`
- backup hash:
  `05dd7e22ec23b310bf949a30109fd2480add0fb61a240af29a0be36b48c393c1`
- record families: `52`; total records: `123`; final results: `1`;
  uncertain effects: `1`.

Backup verification passed. Fresh RC6 and normalized-baseline rollback
restores passed with schema 10 and matching verification hash. A second import
into the populated RC6 target was rejected as `TARGET_NOT_FRESH`. Exact-once
uncertain-effect replay retained one record and performed no replay.

Rollback compatibility was `compatible`; a deliberately incompatible install
contract was rejected as `incompatible`. Promotion assessment was
`promotable`; a deliberately unverified release was blocked with
`release_unverified`. Neither failure path started a service.

## Isolated promotion smoke

RC6 was installed into a fresh `brain-local-install-v1` root with install ID
`brain-local-install:sha256:c8e633532c6ce2eefcdab71c2c208b30347185ee16e8ac6267aee9cae3a2f2a2`.
Core and Console were started from the installed candidate only, on temporary
localhost ports `5687/5688` and `5691/5692` for the restored fixture.
`/status`, `/agent-mode/observer`, and `/agents` returned 200. Commands
contained no source-checkout path. Candidate and rollback-baseline smoke
processes were stopped and confirmed absent. No LaunchAgent registration or
production activation occurred.

## Effects ledger

| Effect | Count |
|---|---:|
| production Core/Console stops, starts, writes, or pointer changes | 0 |
| AgentRuntime / Harness / ModelGateway / provider calls | 0 |
| AWS / Bedrock / MiniMax / GLM / Opus / Codex calls | 0 |
| BrainNode / Workcell operations | 0 |
| network / SSH / Tailscale operations | 0 |
| repository mutations through Agent Mode | 0 |
| service registrations/activations | 0 |
| extra Agent Mode lifecycle records from the release drill | 0 |

The only processes started were isolated installed-package Core and Console
smoke processes performing read-only localhost requests.

## Production baseline final check

Normalized production Core and Console remained launchd-managed and running
from the immutable baseline release. The canonical Store remained
`/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`,
schema 10, `integrity_check=ok`, `foreign_keys=1`, with agents/tasks/runs/
attempts `0/0/0/0`. Production `/status`, `/agent-mode/observer`,
`/agent-mode/console`, `/agent-console`, `/scheduler/status`, and Console
`/agents` all returned 200. The production backup root remained empty.

## Validation

- RC6 release-maintenance and production-signing focused fixture: `5/5`.
- Earlier release/package/relocation focused selection: `15/15`.
- Full Brain Core suite: `2634/2634` passed, `0` failed/cancelled/skipped/todo;
  duration `99429.926208ms`.
- Brain Core typecheck/build: PASS.
- Brain Console typecheck/build: PASS; `/agents` was in the built route set.
- `git diff --check`: PASS.

## Disposition and next task

RC.6 is **PROMOTABLE** for a separately authorized production activation
window. This task did not cut the production pointer, stop normalized
services, import fixture data into the production Store, register services,
publish, push, or deploy. The normalized baseline remains the immutable
rollback target.

Exact next bounded task: **separately authorize and execute production RC.6
activation**. No activation was started automatically.
