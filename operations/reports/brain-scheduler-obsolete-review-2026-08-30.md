# Brain Scheduler Obsolete Job Review

**Review date:** 2026-08-30
**Scope:** The two jobs classified `OBSOLETE` in the canonical Brain Scheduler registry.
**Safety boundary:** Read-only review. No job was executed, enabled, deleted, reclassified, or migrated; launchd was not edited or restarted.

## 1. Current origin/main SHA

The exact current `origin/main` authority observed for this review is:

`8c92eeab85b3995f995bbcec87e37c6491b6013e`

The canonical source was read from the clean deployment checkout at
`/Users/Office/Repos/stevewesthoek/brain-console-launcher`. The shared dirty
checkout at `/Users/Office/Repos/stevewesthoek/brain` was used only for the
read-only old-monolith cross-check and was not modified.

Primary authority files:

- `operations/specs/typed-scheduler-jobs.json` — registry version `2.0.0`, authority `canonical-job-registry`.
- `operations/runbooks/brain-scheduler.md` — canonical scheduler lifecycle and job decisions.
- `tools/scripts/brain-scheduler-runner.mjs` — registry-backed lifecycle gate and runner behavior.
- `operations/reports/brain-scheduler-current-state-2026-08-29.md` — prior runtime snapshot, treated as historical where it predates the current deployment.

## 2. Exact obsolete jobs

The registry contains exactly these two `OBSOLETE` jobs:

| Job | Current lifecycle | Current mode | Registry entrypoint | Owner | Destructive |
| --- | --- | --- | --- | --- | --- |
| `gemini-cleanup` | `deprecated` | `disabled` | `internal:gemini-cleanup` | Brain infrastructure | yes |
| `video-orchestrator-storage-cleanup` | `disabled` | `disabled` | `external:storage-cleanup` | Video Orchestrator | yes |

The live Brain Core scheduler overview returned 17 jobs with category counts
`ACTIVE 4`, `BLOCKED 7`, `NEEDS REVIEW 4`, and `OBSOLETE 2`; its obsolete IDs
matched this table exactly. No lifecycle or category was changed during this
review.

## 3. Job 1 decision card

────────────────────────
JOB: `gemini-cleanup`
────────────────────────

**Current category:** `OBSOLETE`

**Original purpose:** Scheduled deletion of local Gemini temporary and history
entries older than seven days under `$HOME/.gemini/tmp` and
`$HOME/.gemini/history`.

**Current implementation:** The canonical registry retains the historical ID
with `lifecycle: deprecated`, `mode: disabled`, and no canonical entrypoint.
The current-main bootstrap is only an 11-line wrapper and the current runner
records a disabled receipt without resolving or spawning a deprecated job.
The old monolith in the shared checkout still contains a dead
`run_gemini_cleanup` definition, but its current `main` path logs an explicit
quiescence skip instead of calling it.

**Last meaningful runtime evidence:** The legacy compatibility state records
`success`, exit `0`, duration `0s`, at `2026-07-14 03:00:22 WEST`. The current
canonical per-job receipt is absent, so this is legacy-only evidence, not a
canonical-runner execution. The current scheduler log records a quiescence
skip on 2026-08-30. The two target directories currently exist but contain no
files older than seven days; no active Gemini cleanup process or service was
observed.

**Modern replacement:** `NONE`. Gemini API/tooling/Console surfaces were
decommissioned in the June 2026 history, and there is no current Gemini-owned
cleanup subsystem. Any remaining `.gemini` retention is manual/operator or
OS-owned, outside Brain Scheduler authority.

**Still referenced by:** The canonical registry, Brain Scheduler runbook,
current-state and acceptance reports, historical decision log, and the shared
old monolith's dead function and explicit skip line. No active canonical
entrypoint or scheduler dependency references it.

**Downstream dependency risk:** `LOW`. Registry upstream and downstream
dependency lists are empty; the historical monolith placed cleanup at the end
of its chain and no later job consumed its output.

**Data/history retention need:** Retain the compatibility ID, legacy `.last`
state, scheduler logs, historical reports, and receipt/history interpretation
until an explicit migration window ends. Do not remove historical evidence
just to remove the visible registry row.

**Recommended disposition:** `REMOVE LATER`

**Why:** This is the only reviewed job whose original responsibility is no
longer backed by a live subsystem. Gemini cleanup was introduced in commit
`89a8e20d` on 2026-04-06, while later history records Gemini API/tooling and
Console decommissioning in June. The local target directories are currently
empty, there is no active Gemini service, there are no registry dependents, and
the canonical scheduler already fails closed. Removal is appropriate only as a
future bounded compatibility cleanup, not as part of this review.

**Future cleanup scope:**

- Remove the `gemini-cleanup` registry record in a future registry revision only after historical reporting no longer needs it.
- Update the scheduler decision table, reports, validators/tests, and any receipt/history compatibility handling that still names the ID.
- If the old monolith remains relevant at that time, remove its dead function and quiescence log branch in a separately scoped cleanup; the canonical wrapper/runner needs no job-specific code removal.
- Preserve the legacy `.last` file, logs, historical report evidence, and the ID mapping for the agreed retention window.

**Operator decision required:** Approve a later bounded removal of this
historical registry item after the scheduler receipt/log/report retention
window is explicitly agreed, with no restoration of Gemini cleanup.

## 4. Job 2 decision card

────────────────────────
JOB: `video-orchestrator-storage-cleanup`
────────────────────────

**Current category:** `OBSOLETE`

**Original purpose:** Find succeeded Video Orchestrator jobs completed more
than 30 days ago, archive their local output directories to storage archives,
and remove the original directories while leaving logical job/artifact
metadata in PostgreSQL.

**Current implementation:** The canonical registry retains an external,
destructive entrypoint with fixed arguments `run --days 30`, but keeps the job
disabled. The external implementation still exists at
`$HOME/.local/video-orchestrator/scripts/storage_cleanup.py`. Its source scans
the Video Orchestrator database for eligible succeeded jobs, resolves output
directories in `data/`, `packages/`, or `output/`, writes `.tar.gz` archives,
and calls recursive removal of the selected output directory. Its tests cover
both archive-and-remove behavior and dry-run behavior.

Brain Core also retains a storage adapter and API surface from the Video
Orchestrator Phase 7 implementation: `GET
/infra/video-orchestrator/storage-stats` is read-only, while `POST
/infra/video-orchestrator/storage-cleanup` invokes the same external Python
script. This is evidence that the responsibility still exists; it is not
evidence that the Brain Scheduler entry is safe to enable.

**Last meaningful runtime evidence:** The legacy compatibility state records
`failed`, exit `1`, duration `0s`, at `2026-07-14 03:00:24 WEST`, with the
external script failing before work because the system Python lacked its
database dependency. The canonical per-job receipt is absent, so there is no
canonical-runner execution. The current scheduler log records an explicit
quiescence skip on 2026-08-30. Current read-only live probes found the Video
Orchestrator worker and report writer running; no cleanup process was observed.
Brain Core storage stats reported two package directories, 1,178 bytes, and
an oldest age over 30 days, while the Video Orchestrator status endpoint
reported the database unreachable. An existing archive file was present under
`backups/storage-archives/`. These facts require owner review; they do not
authorize cleanup.

**Modern replacement:** Video Orchestrator-owned, human-approved storage
lifecycle management, with Brain Core storage statistics as a read-only
preflight. The Brain Scheduler runbook states that cleanup is manual only.
No separately versioned detailed manual retention procedure was found in the
canonical Brain source, so the migration target still needs explicit owner,
retention, database-readiness, dry-run, archive, rollback, and approval gates.

**Still referenced by:** The canonical registry, Brain Scheduler runbook,
current-state and acceptance reports, the Brain Core storage adapter, API
routes/types/tests, the external cleanup script and its tests, and the shared
old monolith's dead function and explicit skip line.

**Downstream dependency risk:** `LOW` for the canonical scheduler graph: both
registry dependency and dependent lists are empty. Data-loss risk is `HIGH` if
the external script is pointed at the wrong database or output path; the
database-unreachable result means candidate selection and retention cannot be
validated now.

**Data/history retention need:** Preserve Video Orchestrator PostgreSQL
logical history, existing archives, local package/output data, job IDs, and
legacy scheduler state until the Video Orchestrator owner confirms retention
and rollback requirements. Do not delete the observed package directories or
archive files in this review.

**Recommended disposition:** `REPLACE / MIGRATE`

**Why:** The Brain Scheduler entry is obsolete as an automatic mechanism: it
is destructive, external to the repository, disabled, and its last legacy
attempt failed before reaching the database. However, the underlying
responsibility is not obsolete: the external implementation remains present,
the Video Orchestrator worker is live, storage data and an archive exist, and
Brain Core exposes storage inspection plus a cleanup bridge. Move this
responsibility out of the generic Brain Scheduler into an explicitly reviewed
Video Orchestrator procedure, then retire the scheduler record only after that
migration is evidenced. Do not reclassify it as active or execute either
cleanup surface as part of this review.

**Operator decision required:** Approve a separate Video Orchestrator
migration packet that defines the owner, database/readiness gate, dry-run and
archive verification, retention window, rollback, and human approval before
the scheduler record is retired.

## 5. Comparison table

| Job | Truly obsolete? | Replacement proven? | Dependency risk | Recommended disposition |
| --- | --- | --- | --- | --- |
| `gemini-cleanup` | Yes; the owned subsystem was decommissioned | No replacement needed; `NONE` | Low scheduler risk | `REMOVE LATER` |
| `video-orchestrator-storage-cleanup` | The Scheduler entry is obsolete; the storage responsibility is not | Partial: manual ownership is stated, but the complete approved procedure is not evidenced | Low scheduler-graph risk; high deletion/data risk | `REPLACE / MIGRATE` |

The safer first cleanup candidate is `gemini-cleanup`, because it has no live
owner subsystem, no active target data, no active process, and no scheduler
dependents. It still should not be removed until historical compatibility
retention is explicitly approved.

## 6. Monolith references

The production LaunchAgent source still names
`tools/scripts/office-nightly-scheduler.sh`. The old shared-checkout copy was
read only; it was not executed or modified.

**`gemini-cleanup`:** The monolith defines `run_gemini_cleanup` at lines
289–301. It constructs a seven-day `find ... -delete` command and would write
legacy job state through `run_job`. The current `main` path does not call that
function; it logs `skipping job=gemini-cleanup reason=bs0-11-unsafe-quiesced`
at line 500. The canonical current-main wrapper has no Gemini logic.

**`video-orchestrator-storage-cleanup`:** The monolith defines
`run_video_orchestrator_storage_cleanup` at lines 375–388. It checks for the
external Python script and would invoke `python3 ... run --days 30`. The
current `main` path does not call that function; it logs
`skipping job=video-orchestrator-storage-cleanup reason=bs0-11-unsafe-quiesced`
at line 513. The canonical current-main runner skips disabled/deprecated
registry jobs before resolving an entrypoint, so neither external path is
reachable through the canonical runner.

Eventual cleanup of either job may remove these dead monolith definitions and
skip lines, but that is a separate bounded cleanup and was intentionally not
done here.

## 7. Dependency risks

- The canonical registry reports no upstream or downstream dependencies for either obsolete job.
- No active canonical job assumes either job's output or ordering.
- The old monolith's historical chain also placed both jobs after the main work and did not pass their outputs downstream.
- `gemini-cleanup` has low data risk because its target directories are currently empty and the Gemini subsystem is retired.
- `video-orchestrator-storage-cleanup` has high data risk despite low scheduler-graph risk because candidate selection depends on an external PostgreSQL database and path resolution, and the live database probe is currently unavailable.

## 8. Live Console visibility

Verified read-only in live `http://127.0.0.1:4881/scheduler` after the page
finished loading:

- Job 1 visible: **yes** — `Gemini Cleanup`, ID `gemini-cleanup`, category `OBSOLETE`, lifecycle/mode `deprecated`/`disabled`, last legacy result `exit 0`, and the historical human action.
- Job 2 visible: **yes** — `Video Storage Cleanup`, ID `video-orchestrator-storage-cleanup`, category `OBSOLETE`, lifecycle/mode `disabled`/`disabled`, last legacy result `exit 1`, and the manual-only human action.
- The live table rendered all 17 canonical rows and included the `Human review` column.

The Console also displayed scheduler health as `failed` with a missing current
report while still rendering the full inventory. That health/report condition
was preserved as observed and does not change the visibility result.

## 9. Changes made

Analysis report only: this file. No registry entry, lifecycle/category,
script, adapter, route, receipt, log, launchd configuration, or external
Video Orchestrator file was changed.

## 10. Git

- Branch: `codex/brain-scheduler-obsolete-review-20260830`
- Base: exact `origin/main` SHA `8c92eeab85b3995f995bbcec87e37c6491b6013e`
- Report commit: `e47096c2`; all later commits on this branch are metadata-only delivery updates for this same report.
- Push: initial report push succeeded normally to `origin/codex/brain-scheduler-obsolete-review-20260830`; this metadata update is also pushed normally.
- Feature worktree: isolated at `/tmp/brain-scheduler-obsolete-review-20260830`.
- Shared dirty Brain checkout: untouched; no scheduler-scoped status change was introduced.

## 11. Recommended next operator decision

1. Approve `gemini-cleanup` as the first future bounded compatibility cleanup,
   retaining its historical ID/state/log/report evidence through an explicit
   window.
2. Keep `video-orchestrator-storage-cleanup` disabled in Brain Scheduler and
   approve a separate Video Orchestrator migration packet before any registry
   removal or storage action.
3. Do not activate, force-run, or manually invoke either cleanup path from this
   review.

Obsolete scheduler review is complete; no jobs were deleted or activated.
