# Brain Scheduler `memory-context-refresh` closeout

Date: 2026-08-30
Repository: Brain
Scope: reconcile the completed `memory-context-refresh` review into the
canonical scheduler and verify the clean live runtime and read-only Console.

## 1. Source identity and integration

- `origin/main` before reconciliation:
  `c2288703c2235427d4d761e0f02c110d0db7c79c`.
- Completed review branch:
  `codex/memory-context-review-20260830` at
  `62be359111dbefaa2f33881d90e9afc70026110e`.
- Before integration, `62be3591` was not contained in `origin/main`; its exact
  diff was audited and contained only the completed review report.
- The review report was integrated by a clean cherry-pick as commit
  `4db86579` (`docs(scheduler): review memory context refresh`). The original
  review commit remains preserved on its dedicated branch; the integrated
  report content is present on `main` through the cherry-picked commit.
- Classification reconciliation commit:
  `d7686b50c524eddc45f724723d0a49523ff24597`.
- Final metadata correction commit:
  `cada4ed9fd551daf2907331cca67dcae0e30a8ab`.
- `origin/main` after functional reconciliation and used for live acceptance:
  `cada4ed9fd551daf2907331cca67dcae0e30a8ab`.
- The source advanced only through the expected review report, scheduler
  classification/runbook/tests, and truthful derived-output metadata.
- The review branch was retained. No force push was used.

The clean integration worktree was separate from the dirty development
checkout. The clean runtime
`/Users/Office/Repos/stevewesthoek/brain-runtime` was fast-forwarded from
`c2288703` to `cada4ed9` and was clean at acceptance.

## 2. Review conclusion and category reconciliation

The completed review concluded:

**C. MANUAL / ON-DEMAND ONLY**

The legacy snapshot remains compatibility tooling because current Codex and
Gemini instructions still name it, but it is not authoritative context and
its broad, stale-prone, privacy-exposing nightly materialization is not
admitted to automatic scheduling. Claude's active recall hooks read the
underlying local store directly. Current canonical human context remains
Mind's canonical pages, with bounded provider retrieval when healthy/current
and targeted-read fallback when it is not.

The scheduler has no separate top-level `MANUAL` category. The operational
mapping is therefore `MANUAL / ON-DEMAND ONLY` to human review category
`BLOCKED`, while the execution lifecycle remains `disabled`.

| Human review category | Before | After |
| --- | ---: | ---: |
| `ACTIVE` | 4 | 4 |
| `BLOCKED` | 9 | 10 |
| `NEEDS REVIEW` | 2 | 1 |
| `OBSOLETE` | 2 | 2 |
| **Total jobs** | **17** | **17** |

The only remaining `NEEDS REVIEW` job is `skill-prune`. It was not reviewed
or changed in this closeout.

## 3. Final `memory-context-refresh` state

The canonical registry entry in
`operations/specs/typed-scheduler-jobs.json` now records:

| Field | Final value |
| --- | --- |
| Human category | `BLOCKED` |
| Disposition | Manual / on-demand only |
| Lifecycle | `disabled` |
| Mode | `disabled` |
| Schedule type | `disabled` |
| Schedule | `not scheduled` |
| Runnable | No; disabled lifecycle is skipped before runner spawn |
| Automatic execution | No |
| Manual capability | Retained through `tools/scripts/memory-context-refresh.sh` |
| Deleted | No |
| Declared output | `~/.brain/memory-context.md` |
| Policy reason | Blocked: manual / on-demand only; retain the legacy local derived-context snapshot for explicit operator invocation, but do not admit it to automatic scheduling. |
| Human action | Manual / on-demand only; legacy derived context snapshot must not run automatically. |

The existing safety/write concepts remain explicit through equivalent registry
metadata: `authority=brain`, `networkAccess=none`,
`credentialSensitive=false`, `destructive=false`, `mindWrite=false`, and the
tags `local-derived`, `local-write`, `manual-only`, and `quiesced`. Declaring
the output path makes the local derived write visible without enabling it.

The manual-only contract is precise:

- There is no nightly scheduling for this job.
- There is no `RunAtLoad` path for this job.
- There is no hidden cron, `at`, shell-startup, or automatic-hook invocation.
- There is no scheduler activation or Console action for this job.
- An operator must explicitly invoke the retained script if compatibility use
  is required.
- An operator must understand that explicit invocation rewrites
  `~/.brain/memory-context.md`.
- The output is a derived local snapshot, not canonical personal memory.
- Canonical personal/business/ministry meaning remains in Mind's current
  authority model; Brain remains the authority for AI capability and
  operational configuration.

## 4. Execution-path matrix

`BLOCKED` means automatic scheduler admission is blocked. The manual row is
reachable by explicit operator choice even though its automatic admission is
blocked.

| Path | Exists | Automatic | Enabled | Reachable | Blocked | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A. Canonical Brain Scheduler | Yes | No | No | Yes, as a registry/API row | Yes | Registry has `lifecycle=disabled`; the canonical runner emits a disabled receipt and skips before spawning. |
| B. Legacy `office-nightly-scheduler.sh` monolith | Yes, in the launched shared checkout | No for refresh | No for refresh | Yes as historical source only | Yes | `run_memory_context_refresh` is defined, but the main path explicitly logs `memory-context-refresh` as `bs0-11-unsafe-quiesced`; no invocation reference exists. |
| C. Standalone macOS LaunchAgent | No | No | No | No | Yes, no admitted path | No dedicated memory LaunchAgent file or live launchd job was found. |
| D. cron / at / shell scheduler | No | No | No | No | Yes, no admitted path | No refresh reference was found in the bounded shell-startup files or user crontab. |
| E. Agent hooks / startup hooks | Yes, client hooks and startup instructions exist | No for refresh | No for refresh | No for refresh | Yes | Claude hooks read `mem-search`/`mem-facts`; Codex/Gemini startup instructions read the existing snapshot but do not produce it. |
| F. Other scripts / services | No independent path found | No | No | No | Yes, no admitted path | No other current Brain executable or service invokes the refresh; no matching process was present. |
| G. Manual invocation | Yes | No | No scheduler permission | Yes, explicit script path | Yes for automatic admission | The retained executable remains available for an explicit operator invocation only. |

## 5. Standalone launchd and old-monolith safety audit

The live launchd audit was read-only:

- No LaunchAgent or LaunchDaemon whose label, `ProgramArguments`, or script
  path references `memory-context-refresh` or
  `memory-context-refresh.sh` was found.
- `launchctl list` and the user-domain `launchctl print` contained no
  standalone memory refresh job.
- The generic `com.office.nightly-scheduler` LaunchAgent remains configured
  for 03:00 Europe/Lisbon with `RunAtLoad=true`, but it is not a
  memory-specific agent. It currently points to the shared dirty checkout's
  old monolith and `launchctl` reports `state=not running`, `runs=5`, and
  `last exit code=0`.
- `com.office.nightly-scheduler` was not bootstrapped, booted out, enabled,
  disabled, kicked, edited, or otherwise changed.

The clean runtime's canonical
`tools/scripts/office-nightly-scheduler.sh` is a thin bootstrap to
`brain-scheduler-runner.mjs`; the runner skips every disabled lifecycle before
it can spawn an entrypoint. The launched shared checkout still contains the
historical `run_memory_context_refresh` function, but its safe/quiesced main
path logs:

`skipping job=memory-context-refresh reason=bs0-11-unsafe-quiesced`

No alternate call to that function was found. The monolith was not modified or
run.

## 6. Live Brain Core acceptance

The clean runtime was updated to exact functional acceptance SHA
`cada4ed9fd551daf2907331cca67dcae0e30a8ab`. Brain Core was already serving
from the clean runtime, and its scheduler adapter rereads the registry on the
request path; no Core restart was required or performed because no Core source
or API implementation changed.

Read-only `GET http://localhost:4877/infra/scheduler` returned HTTP 200 with:

- `totalJobs=17` and a valid canonical manifest;
- review-category totals of `ACTIVE=4`, `BLOCKED=10`,
  `NEEDS REVIEW=1`, and `OBSOLETE=2`, counted from the 17 returned jobs;
- `memory-context-refresh` present as `reviewCategory=BLOCKED`,
  `lifecycle=disabled`, `mode=disabled`, `enabled=false`,
  `status=disabled`, `scheduleType=disabled`, and `schedule=not scheduled`;
- the manual/on-demand policy reason and human action visible;
- the declared derived output `~/.brain/memory-context.md` visible;
- `n8n-backup` and `google-ads-sync` still `BLOCKED`;
- `gemini-cleanup` and `video-orchestrator-storage-cleanup` still `OBSOLETE`.

The API correctly remains `status=error` / `health=failed` because existing
live launch evidence is not healthy (the generic LaunchAgent source/install
identity is not aligned and the scheduler report is missing). That existing
health condition was reported truthfully and was not altered as part of this
closeout.

## 7. Live Console acceptance

Read-only `GET http://127.0.0.1:4881/scheduler` returned HTTP 200. The in-app
Brain Console page at `/scheduler` rendered:

- all 17 scheduler rows;
- visible review-category totals of 4 ACTIVE, 10 BLOCKED, 1 NEEDS REVIEW,
  and 2 OBSOLETE when the rendered rows were counted;
- `Memory Context Refresh` with `memory-context-refresh`, `BLOCKED`,
  `disabled`, and the manual/on-demand reason;
- no `Run`, `Refresh Now`, `Generate Context`, or `Activate` control;
- no Console action, activation, submission, or state mutation.

The Console's existing top-level lifecycle telemetry remains separate from the
human review categories. The closeout acceptance uses the authoritative table
rows and confirms every row remains visible.

## 8. Validation

The smallest meaningful validation passed:

- `jq empty operations/specs/typed-scheduler-jobs.json` passed.
- The typed scheduler validator passed using the provisioned clean-runtime
  dependency set: 17 jobs, lifecycle counts `active=4`,
  `policy-blocked=4`, `disabled=8`, `deprecated=1`.
- Typed registry and scheduler runner compatibility tests passed: 9 tests.
- Focused Brain Core scheduler tests passed: 3 tests.
- `git diff --check` and staged path checks passed before each commit.
- No arbitrary dependency installation was performed.

## 9. Legacy script retention/removal consideration

**B. Retain temporarily until all legacy consumers disappear.**

The script remains a manual compatibility tool because Codex/Gemini startup
instructions still consume the snapshot. A later separately approved task may
reconcile those client instructions and provider conformance, inventory the
legacy store without deleting history, and then remove the script and snapshot
only after all consumers are migrated and verified. This closeout does not
perform that migration or deletion.

## 10. Safety and non-goals verified

- `memory-context-refresh.sh` executed: **NO**, including no dry-run.
- `~/.brain/memory-context.md` written: **NO**.
- `~/.brain/memory` modified: **NO**.
- Mind written or modified: **NO**.
- Personal memory contents displayed: **NO**.
- New memory system implemented: **NO**.
- Context providers or startup architecture modified: **NO**.
- `memory-context-refresh` activated: **NO**.
- The refresh script deleted: **NO**.
- Scheduler LaunchAgent modified: **NO**.
- `FORCE_RUN` used: **NO**.
- Dirty development/user checkouts touched: **NO**.
- `skill-prune` reviewed: **NO**; it remains the sole `NEEDS REVIEW` job.

Memory context refresh closeout is complete; the capability is retained for manual/on-demand use and blocked from automatic scheduling.
