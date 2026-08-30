# Brain Scheduler Skill-Prune Retirement Review

**Date:** 2026-08-30
**Scope:** Pre-deletion audit and classification only
**Decision:** `skill-prune` is `OBSOLETE` / `DELETE CANDIDATE`.
**Deletion performed:** None

## Executive decision

The Brain no longer needs a periodic skill-pruning responsibility. Skills are
intentionally curated, and age, inactivity, candidate scores, quarantine state,
or report output are not removal authority. The scheduler row is therefore
retained as a truthful compatibility record but classified as:

- `reviewCategory=OBSOLETE`
- `lifecycle=disabled`
- `mode=disabled`
- `scheduleType=disabled`
- `schedule=not scheduled`
- non-runnable by the canonical runner
- explicit human action: `DELETE CANDIDATE`

The current canonical registry still contains all 17 rows. Stage A counts are:

| Human category | Count |
| --- | ---: |
| ACTIVE | 4 |
| BLOCKED | 10 |
| NEEDS REVIEW | 0 |
| OBSOLETE | 3 |

There is no blocker to the `skill-prune` classification or to a future,
dedicated deletion goal after the reference, profile, deployment-copy, and
runtime-retention gates below are satisfied. `skill-prune is safe to remove in a dedicated deletion goal.`

## Source and deployment identities

The review was performed in the isolated worktree
`/private/tmp/brain-skill-prune-retirement.WkbSL4` on branch
`codex/skill-prune-retirement-review-20260830`, based on the then-current
`origin/main` SHA `10ac93f0c343a4a9fcd99394d43339bd29994e8e`.

The classification and focused contract changes were committed as
`28799cf8a33825cc7f67a8d4b04b3a58f6a46189`, pushed to the review branch, and
fast-forwarded into `origin/main`. The clean runtime checkout
`/Users/Office/Repos/stevewesthoek/brain-runtime` was fast-forwarded to the
same SHA and rebuilt.

The shared checkout was not modified:

| Surface | Evidence |
| --- | --- |
| Shared Brain checkout | `/Users/Office/Repos/stevewesthoek/brain`, branch `codex/cloudflare-tooling-normalization`, HEAD `e7f807642ec76fef7536e4a057b02713464dc7f9`, dirty with unrelated user changes |
| Clean accepted source | `28799cf8a33825cc7f67a8d4b04b3a58f6a46189` |
| Clean runtime | `/Users/Office/Repos/stevewesthoek/brain-runtime`, detached HEAD at `28799cf8a33825cc7f67a8d4b04b3a58f6a46189`, clean |
| Installed scheduler LaunchAgent | `/Users/Office/Library/LaunchAgents/com.office.nightly-scheduler.plist` |
| Installed scheduler source target | Protected shared checkout's `tools/scripts/office-nightly-scheduler.sh`, not the clean runtime |

The accepted clean source has a thin canonical bootstrap into
`tools/scripts/brain-scheduler-runner.mjs`. The installed LaunchAgent still
targets the protected dirty checkout, whose historical monolith contains a
`run_skill_prune` function but explicitly logs
`skipping job=skill-prune reason=bs0-11-unsafe-quiesced`. Its report producer is
absent. This is a separate scheduler source/deployment identity mismatch. It
was preserved rather than repaired because the shared checkout and its
LaunchAgent are outside this bounded deletion-review change.

## Current registry proof

The canonical row is in
`operations/specs/typed-scheduler-jobs.json:22`. It keeps the security and
authority metadata intact:

- `destructive=true` remains visible and fail-closed.
- `authority=manual-operator`, `networkAccess=none`, `credentialSensitive=false`,
  and `mindWrite=false` are unchanged.
- `dependencies=[]`; no other canonical job depends on `skill-prune`.
- The historical entrypoint `tools/scripts/skill-prune-report.sh` is retained
  as a historical string in the compatibility row, but the producer is absent
  from current `origin/main`.
- The policy reason states that the curated inventory retires the automated
  pruning responsibility and retains the disabled row only until dedicated
  deletion removes the compatibility surface.

The canonical runbook row in `operations/runbooks/brain-scheduler.md:84` now
states `OBSOLETE / DELETE CANDIDATE`, disabled lifecycle/mode, and the
non-runnable retention condition.

## Complete reference and dependency graph

### A. Canonical scheduler registry

**Current:** `operations/specs/typed-scheduler-jobs.json` contains the one
current `skill-prune` row. The row is retained in Stage A and is not removed.

**Future action:** Remove only in the dedicated deletion goal after all other
references and deployment copies are reconciled. Stage B should contain 16
rows with `ACTIVE=4`, `BLOCKED=10`, `NEEDS REVIEW=0`, `OBSOLETE=2`.

### B. Canonical runner

**Current:** `tools/scripts/brain-scheduler-runner.mjs` consumes the registry
generically. Disabled and deprecated lifecycle values become a disabled
receipt before any child process is spawned. No `skill-prune` child process was
started in this review.

**Future action:** Remove the row and let the generic runner continue with the
remaining 16 rows. No runner source change is required.

### C. Report producer and manual prune surface

Current tracked prune-specific files are:

- `ai/skills/custom/learned/skill-prune/SKILL.md`
- `ai/skills/prune-config.json`
- `tools/scripts/skill-prune-delete.sh`
- `tools/scripts/skill-prune-quarantine.sh`
- `tools/scripts/skill-prune-keep.sh`

The historical report producer `tools/scripts/skill-prune-report.sh` was
already deleted in commit `90a66348`; it is not a current deletion action.
The manual scripts were read statically only. The quarantine and delete
scripts were not run, and the keep script was not run.

The current source skill documents monthly reporting, candidate action links,
quarantine, deletion, keep logging, and the prune configuration. It is a
prune-exclusive surface, not a dependency of any other current skill.

### D. Active curated-skill export and profile switching

The accepted runtime has exactly seven active symlinks and no
`ai/skills/active/skill-prune` entry:

```text
careful -> ../vendors/gstack/careful
code -> ../custom/code
handoff -> ../custom/handoff/handoff
memory -> ../custom/memory
qa -> ../vendors/gstack/qa
research -> ../custom/research
review -> ../vendors/gstack/review
```

`tools/scripts/sync-ai-skills.mjs` exports the curated `ai/skills/active`
surface generically and does not depend on prune. It must be kept unchanged.

`tools/scripts/switch-skill-profile.mjs` resolves every profile entry and fails
closed on missing or unresolvable sources. `docs/skills/profiles/full-current.txt`
still contains `skill-prune`; that profile reference must be removed or
replaced before deleting the source skill. The default active profile and
current consumer links do not contain `skill-prune`.

### E. Documentation and onboarding references

Current references requiring a future reference-update pass are:

- `ai/skills/README.md` pruning section, report outputs, manual commands, and
  skill guide link.
- `docs/skills/profiles/full-current.txt` line containing `skill-prune`.
- `operations/runbooks/skill-profile-onboarding.md` stale Kiro cleanup path.
- `operations/runbooks/brain-scheduler.md` compatibility row.
- `operations/specs/typed-scheduler-jobs.json` compatibility row.

Historical references in `operations/decision-log.md:237-238` and `:250` are
kept as historical evidence and must not be rewritten as if the old decision
never existed.

The historical runbook
`operations/runbooks/skill-prune.md` was already deleted in `90a66348`; retain
its Git history rather than recreating or deleting it again.

### F. Brain Core and Brain Console

Brain Core's scheduler adapter and Brain Console's SchedulerDashboard are
generic consumers of the typed registry. They do not import the prune skill,
call its scripts, or maintain a prune-specific job order. Brain Core maps the
disabled lifecycle to `status=disabled`, and the Console renders
`reviewCategory`, `policyReason`, and `humanAction` generically.

The focused tests now assert the obsolete classification. No Core or Console
production source change is required for deletion. In a future 16-row deletion
goal, update only the row-count and prune-specific test assertions in:

- `tools/validate-typed-scheduler-jobs.test.mjs`
- `projects/brain-core/src/tests/infra-office-scheduler.test.ts`
- `tools/scripts/brain-scheduler-runner.test.mjs`
- any exact 17-row endpoint tests that are intentionally tied to the canonical
  registry count

### G. Other scripts, package scripts, CI, and hooks

The accepted clean source has no package-script, `.github`, hook, or CI
invocation of the prune surface. The compatibility validator
`tools/validate-infinite-brain-scheduler-inventory.mjs` delegates to the typed
registry and contains no current prune-specific execution branch.

The protected shared checkout still contains historical monolith references
in `tools/scripts/office-nightly-scheduler.sh` and a legacy row in its
`tools/scripts/render-office-scheduler-report.sh`. Those are deployment-copy
references, not clean `origin/main` sources, and must be reconciled in a
separate source/deployment cleanup before deleting any live-copy remnants.

### H. Scheduler and automation paths

| Path | Exists | Automatic | Enabled/reachable now | Destructive surface | Current conclusion |
| --- | --- | --- | --- | --- | --- |
| Canonical registry → Brain Scheduler runner | Row yes; runner yes | Generic scheduler is automatic | Row is disabled; runner emits no-spawn disabled receipt | Metadata says destructive; no child spawn | Blocked/non-runnable |
| Installed generic LaunchAgent → protected shared monolith | Yes | Yes, generic daily launchd path | `com.office.nightly-scheduler` appears loaded with `- 0`; no explicit disabled override; final monolith path quiesces prune | Historical function can resolve a report script, but producer is absent | Quiesced and blocked; deployment identity mismatch |
| Standalone `skill-prune` LaunchAgent | Not found | No | No | None found | Not reachable |
| Cron or user crontab | No crontab output; no current source match | No evidence | No evidence | None found | Not reachable |
| CI/hooks/package scripts | No current invocation | No | No | None found | Not reachable |
| Manual report invocation | Producer absent from current source | No | Not reachable | Historical report was report-only; no current producer | Already absent |
| Manual quarantine | `tools/scripts/skill-prune-quarantine.sh` exists | No | Manual only; no active prune symlink | Moves an active symlink and writes quarantine metadata | Retained until dedicated deletion |
| Manual delete | `tools/scripts/skill-prune-delete.sh` exists | No | Manual only; requires quarantine/age/confirmation | Uses guarded source deletion | Retained until dedicated deletion |
| Manual keep | `tools/scripts/skill-prune-keep.sh` exists | No | Manual only | Writes a local decision log | Retained until dedicated deletion |
| Profile switch and skill sync | Generic tools exist | No | Current curated export has no prune entry | Active-set mutation is symlink-only and guarded | Keep general infrastructure |

The canonical row has `dependencies=[]`; no scheduler dependency chain needs
rewiring when it is deleted.

### I. Runtime, receipts, reports, and quarantine

The following were checked without reading secret-bearing state contents:

- `runtime/local/skill-prune/` is absent from the clean source, clean runtime,
  and shared checkout.
- No `ai/skills/quarantine/` directory or quarantine item exists in those
  repository surfaces.
- No current skill-prune log file was found under
  `/Users/Office/Library/Logs/office-scheduler`.
- Machine-local scheduler metadata exists at
  `/Users/Office/.local/state/office-scheduler/`:
  `skill-prune.env`, `skill-prune.last`, and `skill-prune.last-month`, with
  last metadata timestamps on 2026-05-07 for the two receipt-state files and
  2026-04-26 for the environment file.
- The live Core response exposes the existing receipt as disabled, with the
  last observed receipt time 2026-05-07T03:19:14.000Z, duration one second,
  and no current artifact output.

**Retention decision:** There is no current report or quarantine material to
retain. Historical scheduler reports, decision-log entries, and Git history
remain retained. The three machine-local state files are preserved in this
goal and must be handled only by an explicit, separate local-retention cleanup
step after source/deployment reconciliation. No runtime state was cleaned.

### J. Workbench and non-authoritative copies

The dirty Workbench repository
`/Users/Office/Repos/prochattools/saas/workbench-private` had no exact current
prune reference in its tracked source during the read-only audit and was not
modified.

Old generated or protected local copies under `/Users/Office/.config/workbench`
still contain stale Brain snapshots with prune documentation and scripts.
They are not authoritative source for this review and were not modified.
They must be included in the pre-deletion source-copy check if the installed
LaunchAgent or any future deployment points at one of them.

## Capability-impact conclusions

Removing the prune system does not impair the following current capabilities:

| Capability | Impact |
| --- | --- |
| Curated skill loading | No impact; no active prune symlink exists |
| Active skill discovery/routing | No impact; discovery reads the generic active export |
| Curated skill installation/sync | No impact; sync is generic and prune-independent |
| Profile switching | No impact after the `full-current` profile reference is updated first |
| Codex, Claude, Gemini, Cursor current active links | No impact; current links resolve the seven curated active entries |
| Brain Core scheduler API | No production-code impact; it consumes the registry generically |
| Brain Console Scheduler page | No production-code impact; it renders generic metadata |
| Workbench behavior | No current tracked dependency found |
| Scheduler active jobs | No impact; no active job depends on prune |

Periodic prune reports, candidate scores, quarantine, and delete decisions are
not required inputs to any current capability. The only deletion-sensitive
reference is the historical `full-current` profile line and the documented
prune surface itself; both are reference-update gates, not runtime capability
dependencies.

## Exact future safe-removal manifest

This is a manifest for a future dedicated deletion goal. It is not an action
log, and none of these deletions occurred here.

### DELETE AFTER REFERENCE UPDATE

1. Remove the current scheduler compatibility row from
   `operations/specs/typed-scheduler-jobs.json`.
2. Remove the matching row from `operations/runbooks/brain-scheduler.md`.
3. Remove the prune-specific section and links from `ai/skills/README.md`.
4. Remove `skill-prune` from `docs/skills/profiles/full-current.txt`, then run
   profile resolution/checks before removing its source.
5. Remove the stale Kiro prune path from
   `operations/runbooks/skill-profile-onboarding.md`.
6. Update exact 17-row and category-count assertions to the expected Stage B
   inventory: 16 rows, `ACTIVE=4`, `BLOCKED=10`, `NEEDS REVIEW=0`,
   `OBSOLETE=2`.
7. Remove the current prune-specific manual scripts:
   `tools/scripts/skill-prune-delete.sh`,
   `tools/scripts/skill-prune-quarantine.sh`, and
   `tools/scripts/skill-prune-keep.sh`.
8. Remove `ai/skills/prune-config.json` after all script and documentation
   references are gone.
9. Remove `ai/skills/custom/learned/skill-prune/` after profile and index
   checks pass.

### ALREADY ABSENT; DO NOT TREAT AS A NEW DELETE

- `tools/scripts/skill-prune-report.sh` — deleted historically in `90a66348`.
- `operations/runbooks/skill-prune.md` — deleted historically in `90a66348`.
- `ai/skills/active/skill-prune` — deleted historically in `13a5f9d6` and absent
  from the current active export.

### DEPLOYMENT-COPY RECONCILIATION REQUIRED BEFORE SOURCE DELETION

- Protected shared checkout's historical `run_skill_prune` function and final
  quiesced skip in `tools/scripts/office-nightly-scheduler.sh`.
- Any matching legacy renderer row in the protected shared checkout's
  `tools/scripts/render-office-scheduler-report.sh`.
- Any stale generated Brain snapshot under `/Users/Office/.config/workbench`
  that is confirmed to be an active deployment source.
- The installed LaunchAgent source identity must be separately reconciled; do
  not edit or reload it as part of this review.

### RETAIN AS HISTORICAL EVIDENCE

- `operations/decision-log.md:237-238` and `:250`.
- Existing scheduler review/acceptance reports mentioning the old row or old
  category totals.
- Git history for the old report producer, runbook, and active symlink.
- Any future report artifacts discovered during a dedicated retention audit,
  unless an explicit retention decision says otherwise.

### KEEP

- `ai/skills/active/` and all seven current curated symlinks.
- `tools/scripts/sync-ai-skills.mjs`.
- Generic profile/index infrastructure, including
  `tools/scripts/switch-skill-profile.mjs` after profile references are clean.
- Brain Core scheduler adapter and Brain Console scheduler components/schemas.
- All unrelated custom and vendor skills.

## Required future deletion order

1. Freeze the exact source, runtime, and installed-deployment identities and
   confirm no active prune symlink, report directory, or quarantine material
   has appeared.
2. Reconcile the protected shared/deployed scheduler copy in a separately
   approved source/deployment change; do not modify it during this review.
3. Update current documentation, profile references, and exact tests.
4. Validate profile resolution and the unchanged seven-entry active export.
5. Remove the canonical registry/runbook compatibility row and validate the
   16-row Stage B inventory.
6. Remove the manual scripts, prune configuration, and source skill.
7. Make a separate explicit decision on the three machine-local state files;
   preserve historical reports and do not infer retention from age alone.
8. Run schema, runner, profile/sync, Core, and Console validation.
9. Update the clean runtime/deployment only after the source deletion commit is
   accepted, then verify exact SHA and live Core/Console behavior.

## Validation and live acceptance

### Repository validation

At accepted classification SHA `28799cf8`:

- `git diff --check` passed.
- Typed registry JSON and schema validation passed.
- `node --test tools/validate-typed-scheduler-jobs.test.mjs tools/scripts/brain-scheduler-runner.test.mjs` passed: 10 tests.
- Focused Brain Core test passed: 3 tests in
  `projects/brain-core/src/tests/infra-office-scheduler.test.ts`.
- Brain Core production build passed.
- Brain Console production build passed with one pre-existing Autoprefixer
  warning about mixed `end` value support; the build completed successfully.
- Temporary dependency linkage used only for isolated validation was removed;
  the review worktree is clean apart from the report work to be committed.
- No prune script, `FORCE_RUN`, quarantine operation, delete operation, or
  scheduler LaunchAgent mutation was performed.

### Live Core

After the clean runtime was fast-forwarded to the accepted classification SHA
and Brain Core was restarted through its repository-supported Core restart
helper, `GET http://127.0.0.1:4877/infra/scheduler` returned HTTP 200.

The response proved:

- manifest valid, 17 jobs;
- review categories `ACTIVE=4`, `BLOCKED=10`, `NEEDS REVIEW=0`, `OBSOLETE=3`;
- `skill-prune` is `enabled=false`, `status=disabled`,
  `lifecycle=disabled`, `mode=disabled`, `schedule=not scheduled`;
- `skill-prune` human action contains `DELETE CANDIDATE`;
- no active job failed or timed out in the returned runtime summary;
- `launch.matchesSource=false` remains visible because the installed generic
  LaunchAgent still points at the protected shared checkout.

The overall Core scheduler health is therefore truthfully `failed` for the
pre-existing launch-source identity mismatch, while the registry and
skill-prune classification data are valid and observable.

### Live Console

The live Console at `http://127.0.0.1:4881/scheduler` was inspected in the
in-app browser after the Console dev process was restarted with the explicit
loopback Core URL. The visible page proved:

- Brain Core is online;
- all 17 registry rows render;
- the lifecycle summary shows `4 active`, `4 blocked`, and `9 disabled/retired`;
- the `Skill Prune Report` row shows lifecycle `disabled`, human review
  `OBSOLETE`, mode `disabled`, and the exact `DELETE CANDIDATE` action;
- selecting the row exposes the same policy, safety, receipt, and human-action
  details;
- no job-run, activate, generate-context, quarantine, or delete control was
  used or exposed. The only UI action used was the read-only page refresh.

## Safety checklist

| Prohibited action | Result |
| --- | --- |
| Delete a skill or prune source | No |
| Quarantine or restore a skill | No |
| Change active skill symlinks | No |
| Clean runtime reports or receipts | No |
| Run prune, quarantine, delete, or keep scripts | No |
| Use `FORCE_RUN` or run a scheduler cycle | No |
| Edit, reload, enable, disable, or kick the scheduler LaunchAgent | No |
| Modify the shared dirty Brain checkout | No |
| Modify Workbench or unrelated skill infrastructure | No |
| Read, print, or move secrets | No |

Skill prune retirement review is complete; the job is obsolete and queued for
deletion, but nothing was deleted in this goal.
