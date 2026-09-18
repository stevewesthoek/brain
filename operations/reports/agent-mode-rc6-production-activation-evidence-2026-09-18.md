# Agent Mode RC.6 production activation evidence — 2026-09-18

## Outcome

**PASS — `1.0.0-rc.6` is `PRODUCTION_ACTIVE`.** The retained signed RC.6
candidate was activated on the normalized Office Brain production baseline
under the separately authorized production activation window. The baseline is
retained as the deterministic rollback target, and the logical production
backup is retained.

No live model, provider, AWS, SSH, Tailscale, BrainNode, Workcell, Harness,
ModelGateway, network, repository, or Agent Mode worker effects occurred.

## Starting state and authorization

- Starting repository HEAD: `11d55a29 ops(agent-mode): cut signed rc6 candidate`.
- RC.6 source revision: `284d162926a8ee8ce80421a726a06c3a22abbd65`.
- RC.6 source tree hash: `37d35e5415d28502e84afaab7e27bf2208a0b2bd`.
- RC.6 release version: `1.0.0-rc.6`.
- RC.6 package ID:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- RC.6 package manifest hash:
  `18f8c9571be1403aec9bf785a7949baa2e6508da276e1e2cf9f3dfacd7ae3b8a`.
- RC.6 release ID:
  `brain-agent-release:sha256:b5813f2c215f6db3fafc0685691cee43ba699f2d699bb748b1b4633804c03242`.
- Signing identity: `brain-agent-release-production-v1`.
- Ed25519 fingerprint:
  `348d91963cd74037ea3bf7331d0c25218c527a35bbef39aca33eaf11d6d322ca`.
- Keychain reference:
  `keychain-ref://com.brain.agent.release/production-ed25519-v1`.
  Public-key verification passed; private-key export remained false.
- User authorization covered this exact production activation, backup/restore,
  rollback drill, and read-only observation. Publication and push were not
  authorized and were not performed.

The protected unrelated worktree paths remained untouched. Their pre-existing
status remains the same: credentials index modified, Firecrawl log modified,
and the two unrelated roadmap files untracked. None was staged or committed.

## Baseline, backup, and rollback target

The pre-cutover production baseline was empty and quiescent:

- Baseline package ID:
  `brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba`.
- Baseline source revision: `2a93ab565c697bc18ecb01f1a25f3f9dada11240`.
- Baseline manifest hash:
  `a7cd15fe3df41cdbf7de77bcd38267328a2284a32f4055107f8a61dead19c577`.
- Baseline install root:
  `/Users/Office/Library/Application Support/Brain/agent-mode`.
- Canonical Store:
  `/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`.
- Store schema: `10`; SQLite integrity: `ok`; foreign keys: enabled.
- Pre-cutover semantic counts: one `store_meta` record and zero agents, tasks,
  runs, attempts, leases, effects, receipts, schedules, organization plans,
  and organization final results.

The production backup was created before service stop and remains retained at:

`/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc6-production-activation-20260918-072024`

- Snapshot ID:
  `brain-state-snapshot:sha256:c198792934471b24b81f6c8ef701e7cf554502ab335520a8082c4676c262e7c7`.
- Snapshot aggregate hash:
  `72645c95bb5355b11b66e3b2056f7657e5b3dffc62447c123a348dbff006a869`.
- Backup ID:
  `brain-agent-backup:sha256:db767cbcb070526a36174deaae631b92e83bd6c93cdf0b6a36e1746ceee2d8c3`.
- Backup hash:
  `66cebee99d3cf6e0b4be7db9381fd46736667b22d79a1ab35838d30345364416`.
- Snapshot verification: PASS.
- Backup-manifest verification: PASS.
- Backup directory mode: `0700`; backup files: `0600`.
- Backup contains 52 record families, with one `store_meta` record and all
  lifecycle/resource families at zero.

The baseline binding is retained in `baseline-binding.json`; it binds the
baseline package/source/manifest identity, Store path hash, schema 10, snapshot
ID, and backup ID. The baseline package remains present and is the supported
rollback target. No rollback was triggered because no activation gate failed.

## Quiesce and cutover

The preflight confirmed no active work, leases, uncertain effects, scheduler
work, or Agent Mode lifecycle records. The only running services were the two
supported user launch agents. They were stopped through exact launchd labels:

- `com.office.brain-console`, prior PID `92250`.
- `com.office.brain-core`, prior PID `89475`.

Both jobs and both PIDs were verified absent before installation. No unrelated
service was targeted.

RC.6 was installed into a separate immutable production root:

`/Users/Office/Library/Application Support/Brain/agent-mode-rc6`

with release root:

`/Users/Office/Library/Application Support/Brain/agent-mode-rc6/releases/brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`

The installed package verifier passed with 2,467 files and 64,395,659 bytes.
The retained package verifier and signed release verifier also passed. The
RC.6 install ID is:

`brain-local-install:sha256:122c855b7724df9f07eafa5138ea78f1c5404a98cc2365f068ec693a07680ee9`

Launchd descriptors were switched atomically to the RC.6 release root while
preserving the canonical Store, supported ports, config path, and service
authentication references. The descriptors contain no mutable repository
checkout runtime path. No staged descriptor leftovers remain.

## Core and Console activation

Core was bootstrapped first and passed the initial Store/health gate. Console
was bootstrapped only after Core passed.

Active launchd state at final verification:

- Core: `running`, PID `57428`, RC.6 working directory, last exit code never
  exited.
- Console: `running`, PID `57784`, RC.6 working directory, last exit code never
  exited.

Read-only smoke results:

| Surface | Result |
| --- | --- |
| `GET /status` | 200 |
| `GET /agent-mode/observer` | 200 |
| `GET /agent-mode/console` | 200 |
| `GET /agent-console` | 200 |
| `GET /scheduler/status` | 200 |
| Console `GET /agents` | 200 |

Core reported read-only fixture mode. The canonical Console projection was
empty/available, not fabricated as healthy activity. Response inspection found
no secret, credential, private-key, session-token, raw-prompt, hidden-reasoning,
or provider-payload markers.

## Observation window

RC.6 Core started at approximately `2026-09-18T07:27:47Z`. A finite sampler ran
17 read-only probes from `2026-09-18T07:32:35Z` through
`2026-09-18T07:39:19Z`; the required ten-minute threshold was crossed at
`2026-09-18T07:38:29Z`. Every sample observed:

- Core PID `57428` and Console PID `57784` unchanged;
- Core status, observer, canonical console projection, scheduler status, and
  Console `/agents` all `200`;
- SQLite integrity `ok`;
- domain counts `000000000` for agents/tasks/runs/attempts/effects/receipts/
  leases/organization plans/organization final results.

No service restart, crash, new work, uncertain state, lease, scheduler
mutation, budget mutation, or external side effect occurred during observation.

## Final state and effect ledger

At final verification (`2026-09-18T07:39:46Z`):

- RC.6 production status: **PRODUCTION_ACTIVE**.
- Baseline status: **ROLLBACK_SUPPORTED**.
- Canonical Store schema/integrity/FK checks: `10` / `ok` / enabled.
- Agents, Tasks, Runs, Attempts: `0 / 0 / 0 / 0`.
- Effects, receipts, leases: `0 / 0 / 0`.
- Organization plans/final results: `0 / 0`.
- New workers/child agents: `0`.
- AgentRuntime calls: `0`.
- Harness launches: `0`.
- ModelGateway calls: `0`.
- Bedrock/MiniMax/GLM/Opus/Codex calls: `0`.
- BrainNode calls: `0`.
- Workcells: `0`.
- Network/provider calls: `0`.
- Repository mutations through Agent Mode: `0`.
- Production rollback: not triggered.

The only production mutations were the authorized service quiesce/restart,
creation of the retained logical backup, installation of the verified RC.6
release root, and launchd/install-pointer cutover. The canonical Store was not
imported or mutated because it was already empty and matched the verified
backup.

## Decision

RC.6 production activation **PASS**. The exact next state is ordinary
release-maintenance operation with RC.6 active and the normalized baseline plus
verified backup retained for rollback support. No new foundation phase is
opened, and no follow-on implementation task was started automatically.
