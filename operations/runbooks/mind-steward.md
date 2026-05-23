# Mind Steward Runbook

Mind Steward is the live Brain project that maintains the `mind` vault through read-only and dry-run workflows.

Implementation lives at:

```text
projects/mind-steward/
```

This is separate from AI Model Selector at `localhost:4890`, which selects providers/models for API calls. Shared agent/provider routing rules live in `ai/policy/routing.md`.

## Current Status

Current capability:

- dry-run contract validation
- dry-run compile loop planning
- dry-run memory loop planning
- dry-run hygiene loop planning
- dry-run drift/error planning
- stat-only Mind path snapshot collection
- report-only scheduler output when `MIND_STEWARD_MIND_ROOT` is configured

A narrow approved-preview apply helper exists for `mind-steward-update-current-context`. Broad automated write/apply execution remains disabled, and the scheduler dry-run job never mutates Mind.

The legacy task migration was a human-approved repository migration in Mind, not a Mind Steward action. Any future expansion beyond the narrow approved-preview helper remains blocked until explicit policy, approval, and rollback notes exist.

## Validate

```bash
cd projects/mind-steward
npm run ci
```

Expected coverage:

- TypeScript typecheck
- compile capture routing plan test
- memory promotion/compaction plan test
- hygiene anti-clutter plan test
- drift/error contract verification plan test

## Dry-Run Loops

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

## Safety Gates

Do not add broad or automated write/apply execution until all of the following are true:

1. Save-to-Mind is verified landing in `mind/capture/inbox/`.
2. Failure buffer behavior is verified against a real recoverable error, not only a guarded test trigger.
3. Mind Steward dry-run plans are reviewed by the user.
4. Legacy numbered folders remain read-only unless the user explicitly approves archive phase.
5. Rollback notes exist for any file that may be compacted, split, archived, or rewritten.
6. Scheduler job execution is approval-aware and auditable through Brain Core.

## Current Action Kinds

```text
compile-capture
promote-memory
summarize-file
split-file
archive-stale-capture
review-failed-capture
verify-contract
```

## Anti-Clutter Limits

```text
router/current.md      max 150 lines
TODAY.md               max 200 lines
live/tasks.md          max 300 lines
live/projects.md       max 250 lines
wiki/*.md              max 500 lines
capture/inbox/         no files older than 7 days
capture/failed/        no files older than 3 days without retry/review
```

## Scheduler Integration

The Office Nightly Scheduler calls the report-only helper:

```text
tools/scripts/mind-steward-dry-run-report.sh
```

The scheduler job name currently remains `mind-steward-dry-run` because Brain Core and Brain Console still use that runtime report ID. Treat that as an API/report identifier, not a skill name.

Runtime outputs:

```text
runtime/local/mind-steward/latest.md
runtime/local/mind-steward/latest.json
```

Scheduler log:

```text
~/Library/Logs/office-scheduler/mind-steward-dry-run.log
```

When `MIND_STEWARD_MIND_ROOT` is set, the report helper should:

- create a stat-only snapshot from the configured Mind root
- call Mind Steward dry-run checks
- generate loop plans for all dry-run jobs
- write `runtime/local/mind-steward/latest.json`
- avoid mutating Mind

## Do Not Do Yet

- Do not write to `mind` from Mind Steward.
- Do not expand beyond the narrow approved-preview helper without a separate policy and explicit approval.
- Do not move, delete, or archive legacy numbered folders.
- Do not auto-compact notes.
- Do not run Mind Steward writes from Obsidian directly.
- Do not treat planned writes as executed writes.
