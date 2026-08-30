# Brain Scheduler Video Storage Cleanup Migration Review

**Review date:** 2026-08-30
**Scope:** Reconcile the completed obsolete-job review and resolve the future
disposition of `video-orchestrator-storage-cleanup`.  This review is
report-only with one human-category correction.  No scheduler job or video
artifact was executed, enabled, deleted, moved, or archived.

## 1. Obsolete review reconciliation

The exact current `origin/main` authority at the start of this work was:

`8c92eeab85b3995f995bbcec87e37c6491b6013e`

There were no commits on `origin/main` after that SHA.  The obsolete-review
commit `5407d094c8e39831c46f878e8c8828fa0ad4ee6b` was not contained in
`origin/main`.  Its exact diff was audited and contained only:

`operations/reports/brain-scheduler-obsolete-review-2026-08-30.md`

That report was integrated into the clean migration branch by cherry-picking
its report-only commit range.  The historical report was not rewritten: its
original snapshot correctly records that both jobs were classified
`OBSOLETE` at that earlier review point and that the Video Orchestrator
responsibility should be migrated rather than silently removed.

The bounded source correction is committed on:

`codex/brain-scheduler-video-storage-migration-20260830`

Substantive correction commit:

`b5412509` — `fix(scheduler): reconcile video cleanup review category`

The final report is documentation added after that source correction.  The
shared dirty Brain checkout and the existing scheduler LaunchAgent were not
modified.

## 2. Gemini retained as OBSOLETE / REMOVE LATER

`gemini-cleanup` remains:

- human category: `OBSOLETE`;
- lifecycle and mode: `deprecated` / `disabled`;
- runnable: **no**;
- future disposition: `REMOVE LATER`;
- deleted in this work: **NO**.

The reviewed Gemini subsystem is retired, so no modern Gemini-owned cleanup
replacement is required.  The registry row, legacy state, logs, reports, and
historical references remain until a separately approved compatibility
retention window and bounded removal are defined.  No Gemini cleanup function
was restored or invoked.

## 3. Video cleanup moved to NEEDS REVIEW

`video-orchestrator-storage-cleanup` now has human category `NEEDS REVIEW` in
the sole canonical registry.  The correction intentionally leaves every
execution and safety field unchanged:

- lifecycle and mode: `disabled` / `disabled`;
- runnable: **no**;
- entrypoint: `external:storage-cleanup`;
- fixed arguments: `run --days 30`;
- destructive: `true`;
- authority: `manual-operator`;
- receipt and artifact paths: unchanged;
- external activation: `unknown`.

This corrects the human review classification.  It does not authorize the
legacy external script, alter scheduler lifecycle, create a receipt, or
change local-delete behavior.

## 4. Current video architecture

There are two related but distinct video paths. They must not be conflated.

### Canonical Brain video analysis and Save-to-Mind path

The current Brain-owned analysis contract is documented by
`operations/specs/brain-video-analysis-v1.md` and implemented by
`projects/brain-core/services/video-analyzer/`:

```text
YouTube URL | remote video URL | explicitly allowed local file
  -> canonical Brain request
  -> watch-video captions/metadata/scene-aware frame extraction
  -> bounded transcription fallback when explicitly admitted
  -> bounded selected-frame vision analysis
  -> VideoAnalysisResult v1 with transcript, observations, hashes, and provenance
  -> optional exact-path Apply-one preview
  -> separately approved Mind artifact
```

The Save-to-Mind dispatcher sets `caller: save-to-mind`, preserves the capture
reference, uses a correlation/idempotency key, and requests persistence only
through the approval-aware writer.  The writer permits one exact canonical
`mind/inbox/processed/video-analysis/<job-id>.md` destination, preserves the
original `inbox/new` capture, and keeps preview, approval/audit, rollback, and
post-write receipt material in Brain runtime state.

The analyzer's temporary transcript/provider request directories are created
under the operating-system temporary directory and removed in the process.
Analysis job directories under
`runtime/local/brain-core/video-analysis/jobs/` hold the result cache, lock,
watch-video report, and selected frame evidence.  No current Save-to-Mind
contract references `.local/video-orchestrator` or `storage_cleanup.py`.

### Video Orchestrator generation/distribution path

The documented shared generation architecture remains:

```text
project admin/content decision
  -> Brain Core / Video Orchestrator API
  -> queued normalize/subtitle/compose/thumbnail/metadata/post stages
  -> worker execution and job state
  -> S3 media artifacts + PostgreSQL metadata
  -> project-owned review/distribution/publishing surface
```

The documented queue is Redis-backed and temporary, S3 is the intended media
artifact store, and PostgreSQL holds job/artifact metadata and metrics.  Cloud
assets are versioned under `projects/video-orchestrator/cloud/`; the local
runtime remains external at `$HOME/.local/video-orchestrator`.

The Brain Core planning surfaces are currently read-only: intake, research,
script, asset, voiceover, visuals, assembly, metadata, publishing-prep,
artifact-sandbox, controlled-execution, and rollback/cleanup modules do not
render, publish, write Mind, or execute cleanup.  The active
`video-runtime-report` scheduler job currently writes a placeholder
report-only queue summary; it does not yet collect storage telemetry.

## 5. Live storage inventory

The bounded read-only inventory found the following on the current host:

| Location | Observation | Classification | Action taken |
| --- | --- | --- | --- |
| `$HOME/.local/video-orchestrator/data` | Not present | No observed data root | None |
| `$HOME/.local/video-orchestrator/output` | Not present | No observed output root | None |
| `$HOME/.local/video-orchestrator/packages` | Two directories: `cc244de4` and `fbe09ce7`; one `posting_instructions.md` in each, 589 bytes each, modified 2026-05-22 | Unknown/operator package artifacts; not proven disposable | Retained |
| `$HOME/.local/video-orchestrator/backups/storage-archives` | `abcdef12.tar.gz`, 301 bytes, modified 2026-05-24 | Historical archive | Retained |
| `$HOME/.local/video-orchestrator/artifacts/thumbnails` | JPEG artifacts observed with 2026-06-16 through 2026-06-19 modification times; this root is outside the legacy cleanup script's three target roots | Unknown until job/reference linkage is proven | Retained |
| `$HOME/.local/video-orchestrator/worker` and report writer | `video_worker.py` and `report_writer.py --watch` processes observed | Active external runtime | Untouched |
| `$HOME/.local/state/office-scheduler/video-orchestrator-storage-cleanup.last` | Legacy state: `failed`, exit `1`, 2026-07-14 03:00:24 WEST, missing `psycopg2` dependency | Historical failed attempt | Retained |
| `$HOME/.local/state/office-scheduler/receipts/video-orchestrator-storage-cleanup.json` | Not present | No canonical cleanup receipt | None |

The read-only Brain Core storage probe reported:

```text
dirs_scanned=3
total_files=2
total_bytes=1178
oldest_job_age_seconds=8680280
eligible_for_cleanup_30d=true
```

In this adapter, `total_files=2` is the count of observed top-level job
directories, not a recursive file count.  The two counted directories match
the two `packages/` directories above.  The age flag is only a stale-age
signal; it is not an approval or proof that the contents are safe to delete.

The external cleanup script's target roots are `data/`, `packages/`, and
`output/`.  It queries succeeded PostgreSQL jobs older than the requested
retention, archives the resolved directory to
`backups/storage-archives/`, and then calls recursive removal.  The live
database status probe was unavailable, so candidate identity and retention
could not be validated.  The script was not invoked, including in dry-run
mode.

## 6. Durable versus temporary artifact model

| Artifact class | Current authority/model | Automatic deletion decision |
| --- | --- | --- |
| Original Mind `inbox/new` capture | Source evidence for Save-to-Mind analysis | Never delete automatically |
| Approved Mind `inbox/processed/video-analysis/<job-id>.md` | Canonical reviewed analysis artifact | Never delete automatically |
| Source hash, transcript provenance, selected-frame references, approval/audit records, rollback artifacts, and post-write receipts | Evidence and recovery chain | Never delete automatically while referenced |
| Video Orchestrator PostgreSQL job/artifact metadata | Logical job history and artifact references | Preserve; local file cleanup must not imply metadata deletion |
| S3 final media, approved exports, thumbnails, and publish metadata | Documented durable generation artifacts | Preserve until a separately approved provider lifecycle policy exists |
| Redis queue entries and in-flight worker scratch | Temporary execution state | Eligible only under an owner-approved queue/worker TTL; no current cleanup policy is proven |
| OS temporary transcript/provider request directories | Reproducible process scratch; canonical code removes them in-process | Process-local cleanup is already bounded; no scheduler action needed |
| Brain analysis result caches and extracted frames | Rebuildable runtime evidence, but result/provenance references may be needed for review | Candidate only after terminal-state, reference, and retention checks are implemented |
| External `.local/video-orchestrator/packages` and `artifacts` | Mixed/unknown local runtime storage with active workers and no current cross-reference proof | Retain and classify before any action |
| Scheduler receipts, bounded scheduler history, and migration reports | Operational audit evidence | Preserve through the compatibility/migration window |

Current evidence does not prove that a package, thumbnail, output directory,
or archive is unreferenced merely because its modification time exceeds 30
days.  Unknown and active/in-flight/failed/retry-linked artifacts remain
retained.

## 7. Current cleanup requirement

The selected product answer is:

**B. REPORT-ONLY STORAGE MONITORING.**

Brain still needs storage visibility because the external Video Orchestrator
worker is active and local artifacts and an archive exist.  Brain does not
currently have enough authoritative evidence for safe automatic deletion:

- storage is split across documented cloud roots and an external local runtime;
- the local runtime is mixed and only partly covered by the legacy scanner;
- the live database is currently unreachable;
- no approved retention policy distinguishes durable, retryable, operator, and
  reproducible artifacts; and
- the existing destructive implementation is external and unguarded by the
  canonical scheduler's report-only contract.

This means the immediate requirement is measurement and candidate visibility.
Any eventual deletion remains a separate human-approved operation.

## 8. Proposed replacement

The selected future disposition is:

**2. MERGE INTO `VIDEO-RUNTIME-REPORT`.**

The separate destructive scheduler concept should be retired only after the
following report-only migration is implemented and accepted.

### Responsibility owner

Brain Core owns the read-only storage-health projection.  The Video
Orchestrator owner owns the storage-root inventory, retention policy, and any
future deletion procedure.  The generic Brain Scheduler owns only the active
report-only `video-runtime-report` job.

### Authoritative roots and candidate rules

The future report should inspect only explicitly allowlisted roots:

1. Brain analysis runtime state under `runtime/local/brain-core/video-analysis`;
2. Brain video report state under `runtime/local/video`; and
3. Video Orchestrator roots only after the owner registers their current local
   and provider-backed authority, including the relationship to PostgreSQL
   job IDs and S3 keys.

For report purposes, a candidate may be listed only when it has a stable job
identity, a terminal successful state, a measured path and size, a completed
timestamp, and no active/retry/publish/reference hold.  The initial review
threshold is at least 30 days after successful completion, inherited from the
legacy contract but not an execution authorization.  Durable artifacts have
no deletion floor until a separate lifecycle policy is approved.

### Exclusions and protections

The report must exclude original captures, Mind paths, source repositories,
PostgreSQL metadata, scheduler receipts/history, approval/audit/rollback
evidence, active or failed/retry-linked jobs, pending operator packages,
unknown paths, symlinks, and anything without a verified cross-reference from
the deletion candidate set.  S3 canonical outputs may be measured as durable
storage, but they are never deletion candidates under this report-only design.
The report must never infer safety from age alone.

### Dry run, receipts, and report

The normal `video-runtime-report` execution remains read-only.  It may write
only its bounded JSON/Markdown report under `runtime/local/video`, with a
storage section containing:

- schema version and generation time;
- root identity and classification;
- bytes, item counts, oldest/newest timestamps, and scan errors;
- candidate evidence and explicit unknown/blocked reasons;
- database/provider reachability state; and
- `writesToMind: false`, `deletesFiles: false`, and
  `executableActions: false`.

The scheduler receipt should preserve the existing job identity and add the
storage observation summary.  A database-unreachable, root-mismatch,
permission, reference, or parsing failure must produce a warning/unknown
result and zero deletion authority.

### Human approval and recovery

The report creates no approval and performs no archive or delete.  If the
Video Orchestrator owner later wants deletion, a separate exact-scope packet
must identify each path/job, prove database and artifact references, apply the
approved retention policy, verify an archive manifest before removal, and
write an immutable action receipt.  Recovery must restore from the verified
archive while preserving PostgreSQL logical metadata and the audit chain.

Because storage telemetry can be absorbed into the existing report-only job,
no separate cleanup scheduler job is needed.  The current
`video-orchestrator-storage-cleanup` row remains visible as `NEEDS REVIEW` and
disabled until this migration is accepted; it is not replaced or activated in
this change.

## 9. Safety boundaries

The migration preserves all existing boundaries:

- no scheduler job was executed, enabled, force-run, or retried;
- `com.office.nightly-scheduler` was not edited, reloaded, or restarted;
- no external cleanup script, cleanup API, database mutation, archive action,
  file delete, move, or timestamp change was performed;
- no Mind content, original capture, transcript, provenance, receipt, or
  operator history was modified;
- no registry row was removed and no lifecycle or destructive flag was
  relaxed;
- no Brain Console Run/Cleanup control was added;
- no other `ACTIVE`, `BLOCKED`, or `NEEDS REVIEW` job was touched; and
- the shared dirty Brain checkout and external Video Orchestrator runtime were
  not modified.

## 10. Future implementation scope

Future work is limited to a separately reviewed report-only packet:

1. define and register the current Video Orchestrator storage roots and
   provider/database authority;
2. version the storage-health fields in `video-runtime-report`;
3. implement read-only measurement and explicit unknown/reference holds;
4. expose storage detail through the existing video runtime observability
   surface, while keeping `/scheduler` focused on lifecycle/category; and
5. after owner acceptance and a retention window, retire the disabled
   scheduler cleanup row and separately address the legacy external bridge.

No deletion implementation belongs in this migration review.

### Validation and delivery evidence

The corrected source passed:

- `node tools/validate-typed-scheduler-jobs.mjs` — 17 jobs valid;
- `node --test tools/validate-typed-scheduler-jobs.test.mjs tools/scripts/brain-scheduler-runner.test.mjs` — 7/7 passed;
- `npm run typecheck` in `projects/brain-core` — passed;
- `npx tsx --test src/tests/infra-office-scheduler.test.ts` — 3/3 passed;
- `git diff --check` — passed.

The source-side human-category counts are exactly:

```text
ACTIVE       4
BLOCKED      7
NEEDS REVIEW 5
OBSOLETE     1
TOTAL        17
```

The two source-side row checks are:

```text
gemini-cleanup: visible=yes, runnable=no, category=OBSOLETE
video-orchestrator-storage-cleanup: visible=yes, runnable=no, category=NEEDS REVIEW
```

The category correction is not merged to `main` in this bounded branch.  The
live Core/Console deployment checkout remains at the accepted `8c92eea`
identity, so live `/scheduler` continues to represent the pre-correction
baseline until a normal main-branch merge and the already-approved bounded
Core/Console deployment procedure occur.  No deployment was attempted under
an unmerged feature-branch identity.  If deployment is later required, it
must not touch `com.office.nightly-scheduler`.

## 11. Explicit operator decision required

Approve or reject the proposed future disposition:

**Merge video storage-health observation into `video-runtime-report`, keep
the separate cleanup row disabled and `NEEDS REVIEW`, and require a distinct
Video Orchestrator owner-approved storage lifecycle packet before any legacy
row retirement or artifact action.**

Until that decision and the later report-only implementation are accepted,
retain all observed local packages, thumbnails, archives, receipts,
provenance, and unknown artifacts.  Do not activate or invoke either reviewed
cleanup path.

Video storage cleanup migration review is complete; no scheduler jobs or video artifacts were deleted or activated.
