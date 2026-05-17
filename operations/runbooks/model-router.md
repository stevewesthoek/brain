# Model Router Runbook

The model router is the read-first AI steward for the `mind` vault.

## Current status

Implementation lives at:

```text
projects/model-router/
```

Current capability:

- dry-run contract validation
- dry-run compile loop planning
- dry-run memory loop planning
- dry-run hygiene loop planning
- dry-run drift/error planning

No write/apply implementation exists yet.

## Validate

```bash
cd projects/model-router
npm run ci
```

Expected coverage:

- TypeScript typecheck
- compile capture routing plan test
- memory promotion/compaction plan test
- hygiene anti-clutter plan test
- drift/error contract verification plan test

## Dry-run loops

```text
mind-compile-loop
mind-memory-loop
mind-hygiene-loop
mind-drift-error-loop
```

Planner output is advisory only:

- `actions` describes proposed operations
- `plannedWrites` lists target paths that would be affected later
- `blockedBy` explains why execution is not allowed
- `warnings` explain risk and safety gates

## Safety gates

Do not add write/apply execution until all of the following are true:

1. Save-to-Mind is verified landing in `mind/capture/inbox/`.
2. Failure buffer behavior is verified against a real recoverable error, not only a guarded test trigger.
3. Model-router dry-run plans are reviewed by the user.
4. Legacy numbered folders remain read-only unless the user explicitly approves archive phase.
5. Rollback notes exist for any file that may be compacted, split, archived, or rewritten.
6. Scheduler job execution is approval-aware and auditable through Brain Core.

## Current action kinds

```text
compile-capture
promote-memory
summarize-file
split-file
archive-stale-capture
review-failed-capture
verify-contract
```

## Anti-clutter limits

```text
router/current.md      max 150 lines
TODAY.md               max 200 lines
live/tasks.md          max 300 lines
live/projects.md       max 250 lines
wiki/*.md              max 500 lines
capture/inbox/         no files older than 7 days
capture/failed/        no files older than 3 days without retry/review
```

## Scheduler integration target

The Office Nightly Scheduler should eventually run:

1. contract/drift dry-run
2. compile dry-run
3. memory dry-run
4. hygiene dry-run
5. write/apply only after explicit safety gates are met

Initial scheduler integration should call dry-run planners only and report results through Brain Core `/scheduler/latest-run` and `/scheduler/jobs`.

## Do not do yet

- Do not write to `mind` from model-router.
- Do not move/delete/archive legacy numbered folders.
- Do not auto-compact notes.
- Do not run model-router from Obsidian directly.
- Do not treat planned writes as executed writes.
