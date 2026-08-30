# Brain Scheduler n8n Backup Closeout — 2026-08-30

## Scope

This closeout reconciles the reviewed `n8n-backup` human category, audits the
legacy standalone LaunchAgent and old monolith path, updates the clean live
runtime, and verifies Brain Core and the on-demand Brain Console. It does not
implement the replacement backup.

No backup, credential export, restore, n8n mutation, scheduler execution,
LaunchAgent mutation, historical-backup deletion, retention change, or review
of another NEEDS REVIEW job was performed.

## 1. SOURCE

- `origin/main` before reconciliation:
  `d55599da1729089bcce000b3e4eac451efe28f50`
- Review branch: `codex/n8n-backup-review-20260830`
- Review branch tip: `11bb485083f2d45b67c2c7e9957bc73e7d0bcfb8`
- Exact review commit contained in `origin/main`: **NO**. The report was
  integrated by clean cherry-picks with equivalent content.
- Source-reconciliation mainline SHA:
  `8dd671db3bad48700a972ed61614e5a5ce23cf68`
- Final `origin/main` after the bounded test-expectation repair:
  `02757f17abd1aa9721d13bbdc7e718d8c3ba31bb`
- Final deployed clean runtime SHA:
  `02757f17abd1aa9721d13bbdc7e718d8c3ba31bb`
- Mainline changes were bounded to the completed review report, the single
  canonical registry category/reason change, and one stale Core category-count
  test expectation.

The shared dirty Brain checkout, dirty `brain-console-launcher` checkout, and
the legacy n8n scripts/plist were not changed. At final audit the protected
shared checkout was already at `e7f807642ec76fef7536e4a057b02713464dc7f9`
(its dirty-entry count remained 80); the legacy plist still matched that
checkout's HEAD blob.

## 2. N8N SCHEDULER STATE

The canonical typed registry now states:

- Human category: `BLOCKED`
- Disposition/reason: replacement required; the existing secret-bearing
  backup implementation is not admitted for automatic scheduler execution
- Lifecycle: `disabled`
- Mode: `disabled`
- Schedule: `not scheduled`
- Runnable: **NO**
- Replacement implemented: **NO**
- Legacy implementation: retained for now

The category change is in `operations/specs/typed-scheduler-jobs.json`. No
parallel classification store was added, and no script or LaunchAgent was
changed.

The completed review remains the evidence basis for this disposition:
secret-bearing decrypted exports, incomplete database/volume/key/runtime
coverage, undefined retention and offsite resilience, absent integrity/restore
proof, and current operational incompatibility with the live SSH user.

## 3. CATEGORY COUNTS

Human review categories in the canonical 17-job registry:

- ACTIVE: **4**
- BLOCKED: **8**
- NEEDS REVIEW: **3**
- OBSOLETE: **2**

The remaining NEEDS REVIEW jobs are `google-ads-sync`,
`memory-context-refresh`, and `skill-prune`. They were not reviewed here.

Note: the existing API also reports lifecycle counts. `policy-blocked` and
human `BLOCKED` are different dimensions; the human counts above are derived
from each job’s `reviewCategory`, as is the Console acceptance below.

## 4. LEGACY STANDALONE AGENT

Agent: `com.office.n8n-backup`

| Field | Read-only result |
| --- | --- |
| Repository plist | Present at `operations/system-configs/launchagents/com.office.n8n-backup.plist` |
| Installed plist | **NO** — `/Users/Office/Library/LaunchAgents/com.office.n8n-backup.plist` absent |
| Loaded | **NO** — `launchctl print gui/502/com.office.n8n-backup` found no service |
| Enabled/disabled state | Not explicitly disabled; `launchctl print-disabled gui/502` reports `enabled`, but no plist/service is installed or loaded |
| Active PID | None |
| ProgramArguments | `/bin/zsh -lc /Users/Office/Repos/stevewesthoek/brain/tools/scripts/run-n8n-backup-schedule.sh` in repository source |
| WorkingDirectory | `/Users/Office/Repos/stevewesthoek/brain` in repository source |
| StartCalendarInterval | 03:00 |
| RunAtLoad | `true` in repository source |
| KeepAlive | Not set in repository source |
| Run count | Unavailable; no loaded service |
| Last exit | Unavailable; no loaded service |
| stdout | `/Users/Office/Library/Logs/com.office.n8n-backup.log` in repository source |
| stderr | `/Users/Office/Library/Logs/com.office.n8n-backup.log` in repository source |
| Actual target | Shared Brain checkout script path above; the target file exists and matches the shared checkout’s `e7f807642ec76fef7536e4a057b02713464dc7f9` HEAD blob |
| Installed/source match | Not applicable; installed plist absent |
| Currently capable of automatic execution | **NO** |

The repository plist itself is retained as historical rollback/source material.
No bootout, disable, enable, bootstrap, kickstart, unload, load, or edit was
performed. Because the agent is absent and unloaded, there is no bounded disable
operation requiring approval at this time.

## 5. EXECUTION PATHS

| Path | Exists | Currently reachable | Automatically scheduled | Currently blocked | Why |
| --- | --- | --- | --- | --- | --- |
| A. Canonical Brain Scheduler runner → `n8n-backup` | YES | Registry-visible; runner reaches the lifecycle decision | The nightly runner is the canonical scheduled process, but this job is skipped | YES | `lifecycle=disabled`, `mode=disabled`, and now human `BLOCKED`; runner emits disabled state and does not spawn the script |
| B. Old `office-nightly-scheduler.sh` monolith → `n8n-backup` | Wrapper exists | No direct n8n branch | Wrapper can be launchd-invoked, but only delegates to the canonical runner | YES | The 11-line wrapper contains no n8n branch; the canonical registry decision remains disabled |
| C. `com.office.n8n-backup` → `run-n8n-backup-schedule.sh` | Repository plist only | NO | NO | YES | Installed plist absent and launchd service unloaded; the enabled-map entry alone does not create an execution path |
| D. Manual/operator invocation → backup scripts | YES | Source path exists | NO | YES for the observed live Docker route | Manual use would still be operator-controlled, but the current SSH user’s bare Docker access is denied; no manual command was run |

The key result is that no independent automatic n8n backup execution path is
live. The source is blocked and the only current scheduler path is
non-runnable.

## 6. STB DEPENDENCY

- Classification: **HISTORICAL ORDERING**
- Changed in this closeout: **NO**

The registry retains `n8n-backup -> stb-pipeline-batch`, but the backup script
does not call STB and the old monolith contains no n8n branch. The runner checks
disabled lifecycle state before failed dependencies, so the disabled job does
not wait on or execute after STB. `claude-session-cleanup` retains a reverse
historical dependency, but it is also disabled. Leave this harmless metadata
cleanup for a future scheduler maintenance packet.

## 7. LIVE CORE

Brain Core was queried after the clean runtime fast-forward:

- Jobs: **17**
- ACTIVE: **4**
- BLOCKED: **8**
- NEEDS REVIEW: **3**
- OBSOLETE: **2**
- `n8n-backup` BLOCKED visible: **YES**
- `n8n-backup` lifecycle/mode: `disabled` / `disabled`
- `n8n-backup` status: `disabled`
- `n8n-backup` reason: replacement required; the existing secret-bearing
  implementation is not admitted for automatic scheduler execution
- Previously accepted video checks: `video-runtime-report` remained
  ACTIVE/report-only/success; `video-orchestrator-storage-cleanup` remained
  OBSOLETE/disabled.

Core still reports `health=failed` because the installed
`com.office.nightly-scheduler` plist does not match the clean runtime source;
the closeout did not touch that LaunchAgent. This is the remaining runtime
deployment-identity blocker, not an n8n execution path.

## 8. BRAIN CONSOLE

Brain Console was started using the documented on-demand command
`npm run dev` from the clean runtime’s `projects/brain-console` directory. No
new supervisor, LaunchAgent, login item, or service architecture was created.

Live acceptance at `http://127.0.0.1:4881/scheduler`:

- Port 4881: listening during bounded verification
- HTTP: **200**
- All 17 rows rendered: **YES**
- Category totals from rendered table: ACTIVE 4, BLOCKED 8, NEEDS REVIEW 3,
  OBSOLETE 2
- `n8n-backup` BLOCKED visible: **YES**
- `n8n-backup` non-runnable/disabled visible: **YES**
- Replacement-required reason and next human action visible: **YES**
- `Run` control: absent
- `Backup Now` control: absent
- `Export Credentials` control: absent
- `Restore` control: absent
- Persistent supervision exists: **NO**; Console is intentionally on-demand
- New service architecture created: **NO**

The Console’s health card displays the separate Core/LaunchAgent mismatch noted
above. The Console was available for the duration of the documented dev
process; no claim of persistent supervision is made.

## 9. SAFETY

- Backup executed: **NO**
- Credential export: **NO**
- Secrets displayed: **NO**
- Credential backup contents inspected: **NO**
- n8n mutated: **NO**
- Restore/import performed: **NO**
- Scheduler LaunchAgent modified: **NO**
- Standalone n8n agent modified: **NO**
- Dirty checkouts touched: **NO**
- Replacement backup implemented: **NO**
- Historical backups deleted: **NO**
- Other NEEDS REVIEW jobs reviewed: **NO**

## 10. VALIDATION

- Required runtime: Node `v20.20.2`
- `node tools/validate-typed-scheduler-jobs.mjs`: **PASS**, 17 jobs
- `node --test tools/validate-typed-scheduler-jobs.test.mjs tools/scripts/brain-scheduler-runner.test.mjs`: **PASS**, 7/7
- Focused Core tests (`infra-office-scheduler` and `scheduler-manual-success-gate`): **PASS**, 7/7
- Brain Core typecheck: **PASS**
- Brain Console typecheck: **PASS**
- `git diff --check`: **PASS** on the integrated clean worktree and final runtime
- Remote `main`, clean runtime, and integrated worktree all resolve to
  `02757f17abd1aa9721d13bbdc7e718d8c3ba31bb`; the review branch remains at
  `11bb485083f2d45b67c2c7e9957bc73e7d0bcfb8`.

## 11. OPERATOR ACTION

No live standalone agent requires action: the repository plist exists only as
historical source; the installed plist is absent, the launchd service is
unloaded, and no active PID or exit record exists.

If an operator later discovers that `com.office.n8n-backup` has been installed
or loaded, stop before any backup run and obtain explicit approval for a
bounded launchd safety operation. That future operation must identify the
actual installed plist, label, domain, and whether `bootout` and/or
`launchctl disable` is required; it is not part of this closeout and no such
command was issued.

## 12. NEXT REVIEW

The next remaining NEEDS REVIEW jobs are:

- `google-ads-sync`
- `memory-context-refresh`
- `skill-prune`

They remain out of scope. The next n8n-specific implementation packet, if
approved, must separately design and prove the safer replacement: infrastructure
ownership, encrypted database/volume recovery, encryption-key recovery,
retention/rotation, off-machine integrity, restore drills, and metadata-only
Brain Scheduler health reporting. It must not activate this legacy backup,
export routine plaintext credentials, or use the STB dependency as a recovery
gate.

N8N backup closeout is complete; the legacy backup is blocked pending a safer replacement.
