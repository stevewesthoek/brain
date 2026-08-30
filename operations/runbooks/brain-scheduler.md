# Brain Scheduler Runbook

**Status:** canonical repository authority
**Registry:** `operations/specs/typed-scheduler-jobs.json`
**Schema:** `operations/specs/typed-scheduler-jobs.schema.json`
**Version:** 2.0.0

The Brain Scheduler is a first-class, read-only-observable Brain subsystem. It
has one typed job registry, one registry-backed runner, one receipt contract,
and one Brain Core overview. The older Office naming remains only in the
launchd label and filesystem compatibility paths.

## Architecture

```text
macOS launchd
  com.office.nightly-scheduler
  daily 03:00 Europe/Lisbon + RunAtLoad=false
          |
          v
/opt/homebrew/bin/node brain-runtime/tools/scripts/brain-scheduler-runner.mjs
  validate registry -> cutoff -> once/day -> single lock
  -> active report-only jobs -> receipts/history/report
          |
          +--> ~/.local/state/office-scheduler/receipts/*.json
          +--> ~/.local/state/office-scheduler/scheduler-latest.json
          +--> ~/.local/state/office-scheduler/history.jsonl
          +--> runtime/local/office-scheduler/latest-run.md
          |
          v
Brain Core GET /infra/scheduler (read-only)
          |
          v
Brain Console /scheduler (read-only Control Center)
```

The registry is the sole job inventory truth. No shell function list, report
table, duplicate JSON inventory, or UI ordering may define jobs. The current
canonical inventory is 16 jobs: ACTIVE 4, BLOCKED 10, NEEDS REVIEW 0, and
OBSOLETE 2. The runner loads the registry on every invocation and executes
only `lifecycle: active`
jobs in a report-only or dry-run-report-only mode. It performs no retries.

Production launch identity is the clean, detached
`/Users/Office/Repos/stevewesthoek/brain-runtime` checkout. The installed
`~/Library/LaunchAgents/com.office.nightly-scheduler.plist` is a symlink to
that runtime's canonical plist, so Brain Core can verify source/deployment
identity by realpath. The historical
`tools/scripts/office-nightly-scheduler.sh` wrapper remains retained for
compatibility and rollback reference only; it is not the installed launch
target.

Mind Steward's unattended report uses the repository-local `tsx` binary from
the locked `projects/mind-steward/package-lock.json`. Provision it with
`npm ci --omit=dev --ignore-scripts` from `projects/mind-steward`; the wrapper
never uses `npx --yes`, global `tsx`, or automatic package download. A missing
local binary fails closed.

## Timing, lock, and receipts

- The schedule is daily at 03:00 in `Europe/Lisbon`.
- The deployed plist uses `RunAtLoad=false` so bootstrap/reload cannot invoke
  the production runner immediately. The runner retains its before-03:00 and
  once-per-Lisbon-day guards as defense in depth.
- `FORCE_RUN=1` is an explicit operator/test override for the time and
  once-per-Lisbon-day guards. It does not enable inactive jobs.
- `nightly.lock` is a single-run lock. A held lock returns `running`; a stale
  lock is a health failure and is not silently removed by Brain Core.
- Successful completion writes `last_completed_lisbon_date`. A failed run
  never advances it.
- If `last_completed_lisbon_date` exists, it must be one strict, possible
  Lisbon calendar date that is not in the future. Empty, malformed,
  impossible, multiline, and future state blocks before any child process is
  started; operators must inspect and repair the state explicitly.
- `receipts/<job-id>.json` is the per-job runtime receipt. The stable job
  statuses are `success`, `failed`, `running`, `skipped`, `disabled`,
  `blocked`, and `never-run`.
- `scheduler-latest.json` is the overall receipt and `history.jsonl` is bounded
  to the latest 100 overall records.
- Dry-runs require explicit isolated state, log, and report paths. They never
  write the production completion marker, receipts, history, or latest-run
  slot. `scheduler-latest.json` represents actual production scheduler
  execution; temporary worktrees cannot become its authoritative provenance.
- Captured child output is bounded and redacted before it is written. Brain
  Core exposes errors and artifact paths, never raw logs.

## Job decisions

| ID | Lifecycle | Mode | Decision and safe human action |
| --- | --- | --- | --- |
| `stb-pipeline-batch` | disabled | disabled | External write pipeline; require separate safety review. |
| `n8n-backup` | disabled | disabled | Credential/backup side effects; verify destination, retention, and rollback first. |
| `claude-session-cleanup` | disabled | disabled | Local deletion and external entrypoint; manual review only. |
| `dance-of-life-sync` | disabled | disabled | External media sync/rescan; keep out of scheduler. |
| `bible-studies-pipeline` | policy-blocked | disabled | Mind-write-capable implementation; Mind safety review and approval required. |
| `gemini-cleanup` | deprecated | disabled | No canonical entrypoint; do not restore. |
| `google-ads-sync` | disabled | disabled | Blocked pending replacement/hardening before unattended scheduling; keep the current implementation disabled. |
| `gws-token-refresh` | policy-blocked | disabled | Credential-sensitive; use a secret-safe provider procedure first. |
| `mind-steward-dry-run` | active | dry-run-report-only | Run report-only validation; review findings, never apply changes. |
| `local-apps-report` | active | report-only | Generate local application status; remediation is separate. |
| `video-runtime-report` | active | report-only | Generate video runtime and aggregate storage telemetry; no queue or video mutation. |
| `video-orchestrator-storage-cleanup` | disabled | disabled | Retired legacy deletion responsibility; storage visibility is owned by `video-runtime-report`; remove later after historical retention. |
| `memory-context-refresh` | disabled | disabled | Manual / on-demand only; legacy derived context snapshot must not run automatically. |
| `mind-compile-loop` | active | report-only | Generate inbox proposals only; no Mind moves or writes. |
| `graphify-nightly` | policy-blocked | disabled | Event-driven semantic gate only; structural Graphify remains frozen. |
| `ing-bank-statement-download` | policy-blocked | disabled | Financial/credential-sensitive; never enable from this scheduler. |

## Adding, changing, or retiring a job

1. Update the typed registry and schema-compatible metadata in one change.
2. Declare lifecycle, mode, authority, network, credential, destructive, and
   Mind-write facts explicitly. Repository configuration cannot prove external
   activation; keep `externalActivation` as `unknown` until separately
   evidenced.
3. Add fixed arguments and dependencies. Retries remain zero and concurrency
   remains single.
4. For an active job, the entrypoint must be inside this repository and the
   job must be local read-only report work. A dangerous, external-write,
   credential-sensitive, destructive, or Mind-mutating job must remain
   disabled or policy-blocked.
5. Run `node tools/validate-typed-scheduler-jobs.mjs`, the scheduler tests,
   Brain Core and Console typechecks, and a dry-run acceptance with temporary
   state/log/report directories.
6. Update this decision table and preserve a receipt-compatible migration
   path. Do not edit launchd during repository validation.

## Troubleshooting

- `health: failed` with a stale lock: preserve the lock evidence, identify the
  owner, and remove it only through an explicitly approved bounded operator
  action. Do not make the runner guess.
- `health: warning` with missing receipts: inspect the scheduler log and
  report paths, then rerun a bounded dry-run. Missing evidence is not success.
- A job is `blocked` or `disabled`: this is intentional policy state, not an
  invitation to pass an argument or call the entrypoint directly from the
  scheduler.
- A report is stale: verify the overall receipt, per-job receipt, and Lisbon
  date before deciding whether a run is needed. Do not retry a failed external
  operation from this runbook.
- Launchd source/install mismatch: compare the source plist, installed link,
  label, calendar, and working directory. A repository branch is not live
  deployment evidence.

## Production migration and rollback

1. Verify `origin/main`, the detached clean runtime, the typed registry, and
   the four active report-only jobs. Run the supported dry-run with temporary
   state, log, and report directories; never invoke the production runner as a
   validation shortcut.
2. Capture the exact installed plist, hash, realpath, launchd arguments,
   working directory, calendar, RunAtLoad, run count, and last exit in a
   bounded rollback artifact under the runtime's local operational storage.
3. Install/update only `com.office.nightly-scheduler` with the canonical plist
   above, then bootstrap that label. Do not kickstart, force-run, enable
   blocked jobs, or invoke the runner manually. The first natural trigger is
   the next 03:00 Europe/Lisbon calendar event after migration.
4. If bootstrap or Core identity acceptance fails, restore the captured plist
   for this label only and bootstrap it again. Do not improvise a production
   invocation after rollback.

## Never enable automatically

The scheduler must never automatically enable or execute financial,
credential-sensitive, external-write, destructive, or Mind-write-capable jobs.
That includes `bible-studies-pipeline`, `gws-token-refresh`,
`ing-bank-statement-download`, all disabled external/local-delete jobs, and
the blocked Graphify event gate. Any future exception needs an explicit,
separately recorded authority decision and new validation evidence.
