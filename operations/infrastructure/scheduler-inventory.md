# Scheduler Inventory

Central inventory for scheduled and always-on jobs that affect the `Office` Mac mini control plane.

Purpose:
- Keep one canonical overview of local timed jobs, background LaunchAgents, and app-level schedulers that are already documented or discoverable from the current machine state.
- Make future scheduling decisions explicit so heavy jobs do not overlap accidentally.
- Record source-of-truth references and known doc drift.

Verification status:
- Repo scan completed on `2026-04-04`.
- Live `Office` Mac state was first checked on `2026-04-04` via `crontab -l`, `launchctl print`, and the latest n8n backup export.
- Live `Office` Mac state was updated to the centralized nightly scheduler on `2026-04-04 09:01 WEST`.
- Controlled scheduler integration tests were run on `2026-04-04 09:31 WEST` using isolated stub jobs to verify both success-path ordering and timeout stop-chain behavior.
- The nightly scheduler now renders a local markdown snapshot after each real run at `runtime/local/office-scheduler/latest-run.md` so measured durations are captured automatically.

Scope notes:
- This document is about scheduler surfaces that can affect the `Office` Mac or that should be considered in the same operations inventory.
- It separates `timed jobs`, `persistent daemons`, `app-level schedulers`, and `observed-but-not-yet-repo-documented` jobs.

## Current Findings

Pre-migration collision found on `2026-04-04`:

- Three timed jobs currently start at `03:00` local Mac time:
  - `stb-pipeline-batch`
  - `com.office.n8n-backup`
  - `claude-session-cleanup`
- This showed the live machine was overlapping the heaviest known job with two maintenance jobs before centralization.

Pre-migration doc drift found on `2026-04-04`:

- Brain docs for the Says the Bible batch uploader previously said the OS cron fired at `09:05` local time.
- The live crontab on `2026-04-04` showed the real current trigger was `0 3 * * *`.

Post-migration live state verified on `2026-04-04 09:01 WEST`:

- `com.office.nightly-scheduler` is now the only nightly timed entrypoint in `launchd`.
- The direct `stb-pipeline-batch` and `claude-session-cleanup` crontab entries have been removed.
- `com.office.n8n-backup` has been unloaded and removed from `~/Library/LaunchAgents`.
- `stb-flip-available` remains as the only direct crontab entry because it is lightweight and hourly.

Measured-runtime snapshot:

- Latest generated runtime report: [latest-run.md](/Users/Office/Repos/stevewesthoek/brain/runtime/local/office-scheduler/latest-run.md)
- After the next live `03:00` run, use this generated file as the source for replacing estimated durations with observed values.

## Local Timed Entry Points

| Order | Job | Surface | Trigger | Desired state | Approx duration | Resource profile | Scheduling rule | Source / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `1` | `com.office.nightly-scheduler` | macOS `launchd` LaunchAgent | `03:00` daily via `StartCalendarInterval` plus `RunAtLoad` catch-up | Active and canonical timed entrypoint | Seconds for scheduler startup; actual runtime depends on the chain contents | `Low` for orchestration itself | This is now the only timed nightly entrypoint for ordered Office-Mac work. | Repo source: `operations/system-configs/launchagents/com.office.nightly-scheduler.plist`; runner: `tools/scripts/office-nightly-scheduler.sh`; live LaunchAgent verified on `2026-04-04 09:01 WEST`. |
| `2` | `stb-flip-available` | macOS `crontab` | `10 * * * *` | Remains separate and lightweight | Seconds to under a minute when idle | `Low` DB write/read load | Keep separate from the heavy nightly lane. Hourly cadence is acceptable because the job is lightweight and idempotent. | Code/docs currently live in `/Users/Office/Repos/prochattools/web/says-the-bible/scripts/pipeline/flip-available.mjs` and `install-cron.mjs`. |

## Nightly Chain Members

These jobs are ordered by the nightly scheduler rather than owning their own direct trigger.

| Order | Job | Trigger owner | Approx duration | Resource profile | Timeout policy | Source / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `1` | `stb-pipeline-batch` | `com.office.nightly-scheduler` | High variance. Treat as long-running. On `2026-04-04` it failed quickly because `brownnoise.wav` was missing. | `High` CPU, disk, network, API usage | If it times out, the chain stops. If it exits fast with an error, the chain logs it and continues. | Registered by the STB installer into `~/.local/state/office-scheduler/stb-pipeline-batch.env`. |
| `2` | `n8n-backup` | `com.office.nightly-scheduler` | Likely `1-5 min` by inference from export scope and current log shape | `Low` to `Medium` CPU/network/SSH/container exec | If it times out, the chain stops. | Reuses `tools/scripts/run-n8n-backup-schedule.sh` inside the nightly lane. |
| `3` | `claude-session-cleanup` | `com.office.nightly-scheduler` | Seconds | `Negligible` | If it times out, the chain stops. | Source: `operations/system-configs/claude/cleanup-sessions.sh`. |

## Persistent LaunchAgents / Daemons

These are not nightly batch jobs, but they still consume machine resources and should be tracked centrally.

| Job | Surface | Trigger model | Verified state on 2026-04-04 | Approx duration | Resource profile | Scheduling rule | Source / notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tools.prochat.probot` | macOS `launchd` LaunchAgent | `RunAtLoad` + `KeepAlive` | Running live | Continuous | `Low` steady-state, bursty when handling Telegram requests | Treat as an always-on service, not part of the nightly queue. Avoid overlapping heavy local AI work if Telegram responsiveness matters. | Repo docs: `projects/probot/README.md`, installer: `projects/probot/scripts/install-launchd.sh`. Live LaunchAgent verified `2026-04-04`. |

## App-Level Schedulers Found In Brain

These do not currently add load to the `Office` Mac unless a local backup or sync interacts with them, but they belong in the same operational inventory.

Source:
- Latest n8n backup export at `operations/automations/n8n/n8n_backup/latest/workflows.json`

| Workflow | Surface | Active in latest backup | Trigger seen in export | Mac impact | Notes |
| --- | --- | --- | --- | --- | --- |
| `ProChat LinkedIn Auto Post` | n8n cron node | `false` | Monday at `09:00` via weekly trigger node | None unless backup/export is running | Present in the latest backup, but inactive on `2026-04-04`. |
| `ProChat Twitter Autoposter` | n8n cron node | `false` | Custom cron `0 16 * * 2,4` | None unless backup/export is running | Present in the latest backup, but inactive on `2026-04-04`. |
| `StatusLink Trial Reminder` | n8n cron node | `false` | Cron node present, exported parameters empty in the backup | None unless backup/export is running | Present in the latest backup, but inactive on `2026-04-04`. Needs separate n8n-side inspection if reactivated later. |

## Recommended Scheduling Lanes

This is the implemented ordering policy for the `Office` Mac nightly lane.

| Lane | Recommended window | Jobs | Rule |
| --- | --- | --- | --- |
| `Heavy media lane` | `03:00` onward | `stb-pipeline-batch` | Reserve this lane for one heavy batch only. Nothing else expensive should start here. |
| `Maintenance lane` | After heavy lane completion | `n8n-backup` then `claude-session-cleanup` | Only start when the heavy media lane has exited. Timeouts stop the chain. |
| `Hourly guard lane` | `:10` every hour | `stb-flip-available` | Leave independent. It is lightweight and idempotent. |
| `Daemon lane` | Always on | `tools.prochat.probot` | Monitor separately from batch ordering. |

Recommended near-term target schedule:

| Proposed time | Job | Reason |
| --- | --- | --- |
| `03:00` | `stb-pipeline-batch` | Heavy YouTube work gets the quietest window and exclusive access to the batch lane. |
| `05:15` or `after heavy batch exit` | `n8n-backup` | Low-cost maintenance, but it should not compete with the media pipeline. |
| `05:30` or `after n8n-backup success` | `claude-session-cleanup` | Negligible load; safe to run last. |
| `10 * * * *` | `stb-flip-available` | Keep as-is unless hourly checks prove unnecessary. |

## Rule For Adding Future Jobs

Every new scheduled job should be added here before installation and should include:

| Required field | Meaning |
| --- | --- |
| `Job` | Stable identifier or LaunchAgent label |
| `Surface` | `launchd`, `crontab`, `n8n`, other |
| `Trigger` | Exact schedule or event source |
| `Approx duration` | Expected wall-clock runtime |
| `Resource profile` | `Negligible`, `Low`, `Medium`, or `High` |
| `Order` | Batch lane order if timed |
| `Blocker policy` | What must finish before it starts |
| `Source / notes` | Repo doc or live source of truth |

Decision rule:

- If the new job is `High`, it must get its own lane.
- If the new job is `Medium`, it can only run in parallel with `Low` or `Negligible` work after explicit review.
- If the job can hang, it should not own its own independent cron unless it also has timeout and lock handling.

## Implementation Direction For A Reliable Scheduler

The nightly scheduler now enforces the following:

1. One Office-Mac scheduler runner script owns the ordered nightly jobs.
2. A lock around the whole batch lane prevents overlap after reboot or retries.
3. Each job has a timeout and state-file marker.
4. Timeouts stop the chain instead of blindly starting the next job.
5. State lives under `~/.local/state/office-scheduler/` so measured timings can replace estimates over time.

Current implementation shape:

- One `launchd` entrypoint for the nightly lane
- One state directory such as `~/.local/state/office-scheduler/`
- One log directory such as `~/Library/Logs/office-scheduler/`
- Keep hourly guards and always-on daemons outside that sequential runner unless they become expensive

Last updated:
- `2026-04-04 09:02 WEST`
