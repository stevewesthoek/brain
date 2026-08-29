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
| `3` | `com.office.supabase-recovery-copy-backup` | macOS `launchd` LaunchAgent (installed, enabled) | `05:30` daily after the Azure VM Backup window | Up to 4 hours; dynamic latest recovery point selection | `High` Azure restore, isolated PostgreSQL logical dump, and Blob upload | Enabled only after the accepted Phase 3X run, idempotency, telemetry, cleanup, and post-health gates. `RunAtLoad=false`, timeout `14400`, own lock, no retry, and never uses the production logical-dump path. | Repo artifact: `operations/system-configs/launchagents/com.office.supabase-recovery-copy-backup.plist`; runner: preserved Phase 3X feature worktree `tools/scripts/supabase-recovery-copy-backup.sh`; legacy `pgdump-upload.timer` remains disabled/inactive. |

## Nightly Chain Members

These jobs are ordered by the nightly scheduler rather than owning their own direct trigger.

| Order | Job | Trigger owner | Approx duration | Resource profile | Timeout policy | Source / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `1` | `stb-pipeline-batch` | `com.office.nightly-scheduler` | High variance. Treat as long-running. On `2026-04-04` it failed quickly because `brownnoise.wav` was missing. | `High` CPU, disk, network, API usage | If it times out, the chain stops. If it exits fast with an error, the chain logs it and continues. | Registered by the STB installer into `~/.local/state/office-scheduler/stb-pipeline-batch.env`. |
| `2` | `n8n-backup` | `com.office.nightly-scheduler` | Likely `1-5 min` by inference from export scope and current log shape | `Low` to `Medium` CPU/network/SSH/container exec | If it times out, the chain stops. | Reuses `tools/scripts/run-n8n-backup-schedule.sh` inside the nightly lane. |
| `3` | `claude-session-cleanup` | `com.office.nightly-scheduler` | Seconds | `Negligible` | If it times out, the chain stops. | Source: `operations/system-configs/claude/cleanup-sessions.sh`. |
| `4` | `dance-of-life-sync` | `com.office.nightly-scheduler` | Up to 6 hours (bulk download); timeout does not stop chain | `Medium` network/disk during bulk download | Timeout does not stop chain — lowest priority job. | Source: `tools/scripts/dance-of-life-sync.sh`. |
| `5` | `bible-studies-pipeline` | `com.office.nightly-scheduler` | Up to 4 hours (batch transcription); timeout does not stop chain | `High` CPU (Apple Silicon Neural Engine via mlx-whisper large-v3) + `Low` network (NotebookLM sync via `claude --print`) | Timeout does not stop chain. Runs after `dance-of-life-sync` so newly downloaded videos are transcribed the same night. Skips gracefully if mlx_whisper is not installed. Idempotent: state tracked per-video at `~/.local/state/bible-studies/state.json`. | Source: `tools/scripts/bible-studies-pipeline.sh` → `tools/scripts/bible-studies/pipeline.mjs`. Transcripts written to `personal/bible-studies/dance-of-life/`. One `DOL - [Series]` NotebookLM notebook per series, auto-created on first encounter. Detects new series/videos/folders automatically on every run. Log: `~/Library/Logs/office-scheduler/bible-studies.log`. |
| `6` | `gemini-cleanup` | `com.office.nightly-scheduler` | Seconds | `Negligible` | Never stops chain. | Deletes `~/.gemini/tmp` and `~/.gemini/history` entries older than 7 days. |
| `6a` | `gws-token-refresh` | `com.office.nightly-scheduler` | Seconds | `Negligible` | Never stops chain. Runs daily to keep GWS authentication fresh, preventing "reauth required" errors during skill-prune email sends. | Calls `gws gmail users getProfile` to refresh token. Log: `~/Library/Logs/office-scheduler/gws-token-refresh.log`. Source: `tools/scripts/office-nightly-scheduler.sh`. Improves email reliability but does not guarantee permanent auth. |
| `7` | `skill-prune` | `com.office.nightly-scheduler` | 1–5 min | `Negligible` | Never stops chain. Only executes on the 7th of each month; skips silently on all other days. State tracked in `~/.local/state/office-scheduler/skill-prune.last-month`. | **REPORT-only mode:** Generates skill library analysis (no file modifications). Outputs: `runtime/local/skill-prune/latest.md` and `.json`. Optional email via GWS if configured in `~/.local/state/office-scheduler/skill-prune.env`. Manual quarantine/delete scripts available: `tools/scripts/skill-prune-quarantine.sh`, `tools/scripts/skill-prune-delete.sh`, `tools/scripts/skill-prune-keep.sh`. Log: `~/Library/Logs/office-scheduler/skill-prune.log`. Source: `tools/scripts/skill-prune-report.sh`, docs: `ai/skills/custom/learned/skill-prune/SKILL.md`. |
| `8` | `mind-steward-dry-run` | `com.office.nightly-scheduler` | Under 5 min | `Low` | Never stops chain. Runs after auth refresh as report-only validation. | **REPORT-only mode:** Runs `projects/mind-steward` CI and writes runtime status to `runtime/local/mind-steward/latest.md` and `.json`. It does not write, move, delete, archive, compact, split, or rewrite Mind files. Log: `~/Library/Logs/office-scheduler/mind-steward-dry-run.log`. Source: `tools/scripts/mind-steward-dry-run-report.sh`. |
| `9` | `local-apps-report` | `com.office.nightly-scheduler` | Seconds | `Negligible` | Never stops chain. Writes read-only local app runtime summaries only. | **REPORT-only mode:** Writes `runtime/local/local-apps/latest.md` and `.json` with placeholder-safe app status. No process inspection, no app control, no Mind writes. Log: `~/Library/Logs/office-scheduler/local-apps-report.log`. Source: `tools/scripts/local-apps-report.sh`. |
| `10` | `video-runtime-report` | `com.office.nightly-scheduler` | Seconds | `Negligible` | Never stops chain. Writes read-only video runtime summaries only. | **REPORT-only mode:** Writes `runtime/local/video/latest.md` and `.json` with placeholder-safe queue state. No workflow triggers, queue mutation, or Mind writes. Log: `~/Library/Logs/office-scheduler/video-runtime-report.log`. Source: `tools/scripts/video-runtime-report.sh`. |
| `11` | `graphify-nightly` | `com.office.nightly-scheduler` | Up to 5 min | `Low` by default; bounded semantic runner cost only when explicitly configured | Never stops chain. Event gate is fail-closed and code-only/unapproved changes do not invoke a runner. | B8.5 semantic event gate only. Structural Graphify remains frozen; CBM is the structural navigation layer and exact source remains authority. Scheduler calls `tools/graphify-semantic-event.mjs --mode=scheduler`; no default local/external model is configured, no broad repo scan occurs, and Mind is not approved. Log: `~/Library/Logs/office-scheduler/graphify-semantic-event.log`. Legacy `tools/scripts/graphify-nightly.sh` is a fail-closed compatibility stub. |

| `12` | `supabase-recovery-copy-backup` | Independent installed/enabled LaunchAgent | `05:30` Europe/Lisbon, after the expected Azure Daily recovery point window | Up to 4 hours | `High` temporary Azure VM restore plus sequential PG15 dumps and off-host Blob upload | Dynamic latest recovery point; clean no-op when the selected point was already processed; fail closed on Azure delay, active prior run, restore failure, Blob collision/unavailability, or any production preflight failure. `RunAtLoad=false`; no immediate catch-up; timeout `14400`; no retry. | Source: preserved Phase 3X feature worktree `tools/scripts/supabase-recovery-copy-backup.sh`; receipt: `runtime/local/infrastructure/backup-runtime-state.json`; legacy `pgdump-upload.timer` remains disabled/inactive. |

## Persistent LaunchAgents / Daemons

These are not nightly batch jobs, but they still consume machine resources and should be tracked centrally.

| Job | Surface | Trigger model | Verified state on 2026-04-04 | Approx duration | Resource profile | Scheduling rule | Source / notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

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
- `2026-04-07` — Added `dance-of-life-sync`, `gemini-cleanup`, and `skill-prune` to Nightly Chain Members table to reflect current scheduler state.
- `2026-04-08` — Added `bible-studies-pipeline` as chain member #5 (between `dance-of-life-sync` and `gemini-cleanup`). Added `bible-studies-pipeline` and `skill-prune` to Brain Console job order. Updated `render-office-scheduler-report.sh` to include all 7 chain members (was only showing 3).
- `2026-04-26` — Hardened skill-prune: clarified REPORT-only mode, added `gws-token-refresh` as daily job, documented manual scripts, updated sources. Added safety validation to delete/quarantine/keep scripts.
- `2026-05-17` — Added `mind-steward-dry-run` as a non-blocking report-only nightly chain member. It now validates `projects/mind-steward` and writes runtime report files without touching Mind content. The job name remains for compatibility with existing report IDs.
- `2026-05-17` — Added `local-apps-report` and `video-runtime-report` as non-blocking report-only nightly chain members. They write safe runtime/local JSON and Markdown summaries without mutating Mind or executing actions.
- `2026-05-18` — Live HTTP verified Brain Core reading the generated `local-apps` and `video` runtime reports; the manual Brain Console install/test path is now documented separately in `operations/runbooks/brain-console-manual-install-test.md`.
- `2026-05-17` — Added `local-apps-report` and `video-runtime-report` as non-blocking report-only nightly chain members. They write safe runtime/local JSON and Markdown summaries without mutating Mind or executing actions.
