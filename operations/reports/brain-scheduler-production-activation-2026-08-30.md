# Brain Scheduler Production Activation — 2026-08-30

## Decision

The live `com.office.nightly-scheduler` LaunchAgent was migrated from the
legacy shared-checkout wrapper target to the canonical Brain Scheduler runner
in the clean detached `brain-runtime`. The migration completed without an
immediate scheduler invocation or production job execution.

No blocked or obsolete job was enabled or executed. The legacy
`tools/scripts/office-nightly-scheduler.sh` remains in the repository as a
compatibility/rollback reference only and is no longer referenced by the
installed LaunchAgent.

## Source and deployment identity

| Evidence | Result |
| --- | --- |
| `origin/main` before migration | `1b091c9abe4dd58763886b96e8b1061374ef35da` |
| Source deployment commit | `2a769d07997e94e9ac0bfd331ce247a37ab664f3` |
| `origin/main` after source deployment | `2a769d07997e94e9ac0bfd331ce247a37ab664f3` |
| Clean runtime | `/Users/Office/Repos/stevewesthoek/brain-runtime` |
| Clean runtime SHA at deployment | `2a769d07997e94e9ac0bfd331ce247a37ab664f3` |
| Installed plist | `/Users/Office/Library/LaunchAgents/com.office.nightly-scheduler.plist` |
| Installed plist type | Symlink to the clean runtime plist |
| Old installed plist SHA-256 | `edee38ed195dfa7cd04078f4f5f13e9f9e9b69ca7c57393ef14e8957461b4998` |
| New canonical plist SHA-256 | `c775969e1b1f880cdc60592479f0f03ed454fe8ccab945cd8abb64ef75914519` |
| Core source/deployment identity | `matchesSource=true` |

Old target:
`/Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh`

New target:
`/opt/homebrew/bin/node /Users/Office/Repos/stevewesthoek/brain-runtime/tools/scripts/brain-scheduler-runner.mjs`

Working directory:
`/Users/Office/Repos/stevewesthoek/brain-runtime`

## Launch configuration

- Label: `com.office.nightly-scheduler`
- Trigger: daily `03:00 Europe/Lisbon`
- Next natural trigger: `2026-08-31 03:00 Europe/Lisbon` (`2026-08-31T02:00:00Z`)
- `RunAtLoad`: `false` in the deployed plist; this prevents bootstrap/reload
  from invoking the runner immediately.
- `KeepAlive`: not configured.
- stdout/stderr: `/Users/Office/Library/Logs/office-scheduler/nightly.log`
  and `nightly.error.log`.
- Post-reload launchd state: loaded, `state=not running`, `active count=0`,
  `runs=0`, `last exit=(never exited)`.

The runner retains independent before-cutoff and once-per-Lisbon-day guards.
The host timezone was observed as Europe/Lisbon (`WEST`, UTC+01:00) during
deployment; launchd retained the `Hour=3`, `Minute=0` calendar descriptor.

## Canonical job inventory and containment

The typed registry and safe dry-run both reported 16 jobs with human review
categories exactly:

| Category | Count | IDs |
| --- | ---: | --- |
| ACTIVE | 4 | `mind-steward-dry-run`, `local-apps-report`, `video-runtime-report`, `mind-compile-loop` |
| BLOCKED | 10 | `stb-pipeline-batch`, `n8n-backup`, `claude-session-cleanup`, `dance-of-life-sync`, `bible-studies-pipeline`, `google-ads-sync`, `gws-token-refresh`, `memory-context-refresh`, `graphify-nightly`, `ing-bank-statement-download` |
| NEEDS REVIEW | 0 | none |
| OBSOLETE | 2 | `gemini-cleanup`, `video-orchestrator-storage-cleanup` |

The runner lifecycle filter and tests prove that only the four active
report-only jobs can reach child execution. The safe dry-run produced 16
receipts, `executedJobIds=[]`, and no spawned child processes. Blocked,
disabled, deprecated, and obsolete jobs were represented as non-runnable
receipts.

## Migration evidence

- Pre-migration launchd state was idle with the old shared-checkout target,
  `RunAtLoad=true`, `runs=5`, and `last exit code=0`.
- The exact old plist was captured at:
  `/Users/Office/Repos/stevewesthoek/brain-runtime/runtime/local/brain-scheduler/rollback/com.office.nightly-scheduler-20260830T193000Z/installed-before.plist`
- Rollback metadata was recorded beside it in `before-migration.txt`.
- Only `com.office.nightly-scheduler` was booted out and bootstrapped.
- No `kickstart`, force-run, manual production runner invocation, job
  enablement, Mind write/delete, credential action, or external mutation was
  performed.
- After reload, production scheduler state and logs retained their pre-
  migration hashes and mtimes: no scheduler receipt, history, last-completed
  date, stdout, stderr, or lock changed.

## Live Core and Console acceptance

Brain Core `GET http://127.0.0.1:4877/infra/scheduler` returned HTTP 200:

- `status=ok`, `health=warning` only because the production latest report is
  unavailable before the first natural run;
- canonical manifest path in `brain-runtime`, valid, 16 jobs;
- `launch.matchesSource=true`, canonical target and working directory;
- `lock.present=false`, `held=false`, `stale=false`;
- next run `2026-08-31T02:00:00.000Z`;
- exact active set above and human categories `4/10/0/2`.

The live Console `/scheduler` page returned HTTP 200 and rendered all 16 rows.
It showed the `03:00 Europe/Lisbon` schedule, label, next run of Aug 31 at
03:00, four active rows, ten blocked rows, two obsolete rows, four successful
historical active-job receipts, a free lock, and no Run/force-run/mutation
controls. The Console’s warning is the same expected pre-first-run missing
report condition; launch identity is accepted by Core.

## Validation

Passed:

- `plutil -lint` on the canonical plist;
- absolute target and working-directory existence checks;
- `bash -n tools/scripts/office-nightly-scheduler.sh`;
- typed registry validator and compatibility inventory validator;
- 10 focused scheduler/registry tests;
- `git diff --check` before source commit;
- safe dry-run with temporary state, log, and report directories.

The first natural production run has **not** been observed; it must remain so
until the calendar trigger occurs naturally. No claim is made about its future
result.
