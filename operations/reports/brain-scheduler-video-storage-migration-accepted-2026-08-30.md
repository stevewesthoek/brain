# Brain Scheduler Video Storage Telemetry Migration — Accepted

**Acceptance date:** 2026-08-30
**Scope:** Move the useful, read-only storage visibility responsibility from the
legacy Video Storage Cleanup concept into `video-runtime-report`, while keeping
the legacy cleanup implementation and registry history retained and disabled.

No video files, scheduler jobs, or external storage artifacts were deleted,
moved, archived, or modified during this migration.

## 1. Source and deployment identity

- `origin/main` before implementation: `8c92eeab85b3995f995bbcec87e37c6491b6013e`.
- `origin/main` had no commits after the accepted live deployment SHA.
- Review branch: `codex/brain-scheduler-video-storage-migration-20260830`.
- Branch tip `b0c6331cdeffb55a0d21dc47ab99111b5be8c0b0` contains the accepted
  prior migration review and is based on `origin/main`; the branch was not
  silently deployed before main integration.
- Relevant source scope is limited to the scheduler registry/category metadata,
  scheduler compatibility tests, the video runtime report, its focused tests,
  Brain Core report consumption, and these reports.
- Final main and live deployment SHAs are recorded in the delivery evidence
  accompanying this report after the normal fast-forward and deployment.

## 2. Replacement contract

`video-runtime-report` is the single active owner of report-only video runtime
and storage visibility. It writes only:

- `runtime/local/video/latest.json`
- `runtime/local/video/latest.md`

The JSON `storage` section contains root IDs and classifications,
`CURRENT_DURABLE`, `CURRENT_TEMPORARY`, `LEGACY`, or `UNKNOWN` status, existence,
bytes, file and directory counts, oldest/newest modification times, age buckets,
aggregate temporary/durable/legacy/unknown bytes, warning thresholds, bounded
scan limits, collection errors, and an explicit zero deletion-candidate count.
It never emits storage paths, private filenames, directory contents, media
contents, credentials, or Mind content.

The scan is limited to the configured known roots, rejects broad roots and
symlink roots/entries, skips special files, and enforces per-root depth, file,
directory, and time limits. Missing roots are safe `missing` observations.
Unreadable or incomplete roots are `partial` or `unavailable` with stable
warnings. Unknown data remains `UNKNOWN`; age alone never creates deletion
authority.

## 3. Read-only safety

The report and Brain Core read model preserve:

```text
writesToMind=false
executableActions=false
deletesFiles=false
movesFiles=false
archivesFiles=false
networkAccess=false
privateContentNames=false
candidateCount=0
```

Brain Core validates these flags before exposing storage telemetry through
`GET /video/status` and the existing `GET /runtime/reports` surface. The Brain
Console Scheduler Control Center remains a registry observability view: it has
no Run, Cleanup, Delete, archive, or other destructive controls.

## 4. Read-only acceptance run

The isolated branch ran the report against the approved root inventory only.
The run completed successfully in report-only mode with no collection errors.
Observed aggregate evidence:

| Metric | Observation |
| --- | ---: |
| Approved roots | 7 |
| Total bytes | 234,838 |
| Files / directories | 21 / 7 |
| Current temporary bytes | 0 |
| Current durable bytes | 0 |
| Legacy bytes | 301 |
| Unknown/unclassified bytes | 234,537 |
| Storage warnings | unknown data, legacy archive, older-than-30-days, missing data/output roots |
| Report duration | 0 seconds, rounded |

Roots observed were the Brain analysis runtime, Brain report runtime, the
historical Video Orchestrator data/packages/output roots, the external artifact
root, and the historical storage-archive root. The external packages and
artifacts remain `UNKNOWN` because active workers and authoritative job/reference
linkage were not proven. The archive remains `LEGACY` and retained.

## 5. Video cleanup disposition

`video-orchestrator-storage-cleanup` is now:

- human category: `OBSOLETE`;
- lifecycle and mode: `disabled` / `disabled`;
- runnable: **no**;
- destructive flag: preserved as `true`;
- external entrypoint, fixed arguments, receipt path, and historical row:
  preserved;
- reason: storage observability migrated into `video-runtime-report`, so the
  separate destructive cleanup scheduler responsibility is no longer required;
- future action: `REMOVE LATER` only after historical retention is approved.

The legacy cleanup implementation, `storage_cleanup.py`, historical receipts,
legacy state, reports, and monolith logic were retained. The external cleanup
script was not executed, including dry-run mode. Replacement is accepted for
the remaining operational responsibility—visibility—not for any future delete,
archive, or retention action.

## 6. Category counts

The authoritative 17-job registry now reports:

```text
ACTIVE        4
BLOCKED       7
NEEDS REVIEW  4
OBSOLETE      2
TOTAL        17
```

Both obsolete rows remain visible and non-runnable:

```text
gemini-cleanup: visible=yes, lifecycle=deprecated, mode=disabled, category=OBSOLETE
video-orchestrator-storage-cleanup: visible=yes, lifecycle=disabled, mode=disabled, category=OBSOLETE
```

The remaining `NEEDS REVIEW` job IDs are `n8n-backup`, `google-ads-sync`,
`memory-context-refresh`, and `skill-prune`. They are explicitly out of scope
for this migration and must not be reviewed in this packet.

## 7. Validation evidence

- `bash -n tools/scripts/video-runtime-report.sh` — passed.
- Focused report tests using temporary fixtures only — 4/4 passed.
- Focused scheduler/registry tests — 11/11 passed.
- `node tools/validate-typed-scheduler-jobs.mjs` — 17 jobs valid.
- Brain Core typecheck — passed.
- Brain Core scheduler and runtime-report tests — 7/7 passed.
- Brain Core video route tests — passed, including storage read-model exposure.
- `git diff --check` — passed.
- Safety scan found no delete/unlink/rmdir/archive/move/network execution path
  in the new telemetry collector.
- Fixture assertions covered approved roots only, symlink escape rejection,
  missing roots, unreadable roots, unknown classification, no media-content or
  filename output, bounded file-count/runtime, report-file-only writes, no Mind
  writes, no external mutations, and existing queue/report compatibility.

## 8. Explicit safety result

```text
video files deleted: NO
video files moved: NO
video files archived: NO
video artifacts modified: NO
Mind writes: NO
external mutations: NO
scheduler jobs activated: NO
com.office.nightly-scheduler modified/reloaded/restarted: NO
shared dirty Brain checkout touched: NO
other NEEDS REVIEW jobs touched: NO
```

Video storage telemetry migration is accepted; the legacy cleanup job is now
obsolete but retained.
