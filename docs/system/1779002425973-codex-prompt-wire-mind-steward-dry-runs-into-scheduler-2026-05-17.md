# Historical Codex Prompt — Wire Mind Steward Dry Runs Into Office Nightly Scheduler

## Repo / source
**Classification:** Historical implementation prompt; current scheduler identity and active-set truth are in `operations/runbooks/brain-scheduler-current-state.md`.

Work from the `brain` repo. Verify `mind` only through safe explicit paths.

## Goal

Wire the mind-steward dry-run planner into the Office Nightly Scheduler as read-only reporting jobs. Do not enable writes to `mind` yet.

## Current implemented state

Model-router implementation:

```text
projects/mind-steward/
```

Validation:

```bash
cd projects/mind-steward
npm run ci
```

Current dry-run API:

```ts
createMindContractDryRunResult(snapshot)
createMindRouterLoopPlan(jobId, snapshot, now?)
```

Supported jobs:

```text
mind-compile-loop
mind-memory-loop
mind-hygiene-loop
mind-drift-error-loop
```

Planner output includes:

```text
actions
plannedWrites
warnings
blockedBy
errors
```

No write/apply implementation exists.

## Safety rules

- Do not write to `mind`.
- Do not move, delete, archive, compact, split, or rewrite files.
- Do not touch legacy numbered folders.
- Do not claim planned writes were executed.
- Do not store secrets or runtime logs in Mind.
- Do not enable scheduler-triggered writes until explicit user approval and rollback design exist.
- Do not read `.env` or secret stores.

## Task 1 — Locate Office Nightly Scheduler

Find the scheduler implementation in `brain`. Identify where jobs are defined and where status/results can be reported.

Do not modify scheduler behavior until you understand the existing schedule and validation paths.

## Task 2 — Add read-only mind-steward dry-run job integration

Add scheduler jobs or job descriptors for:

```text
mind-drift-error-loop
mind-compile-loop
mind-memory-loop
mind-hygiene-loop
```

The jobs must:

- create or receive a safe observed `MindContractSnapshot`
- call `createMindContractDryRunResult` for drift/error validation
- call `createMindRouterLoopPlan` for each loop
- capture output as structured JSON or scheduler result metadata
- avoid modifying `mind`
- mark all write/apply behavior as blocked

## Task 3 — Snapshot source

Preferred snapshot source order:

1. existing safe scheduler/Brain Core file metadata adapter if present
2. explicit path list with stat-only metadata
3. BuildFlow/Codex local stat logic that reads metadata only, not content

A snapshot may include:

```text
path
kind
exists
sizeBytes
lineCount
modifiedAt
```

Do not read large file contents unless needed for line counts. If line counts are expensive, skip them and report `lineCount` unavailable.

## Task 4 — Brain Core scheduler reporting

If safe, expose latest dry-run results through Brain Core placeholders:

```text
GET /scheduler/latest-run
GET /scheduler/jobs
```

Do not add action execution. If a request-run endpoint is used, it must create an approval request only and return `executed: false`.

## Task 5 — Update docs

Update:

```text
operations/runbooks/mind-steward.md
operations/runbooks/brain-core.md
docs/system/mind-os-migration-handoff-2026-05-16.md
```

If Mind docs are safe and isolated, update:

```text
mind/live/machine.md
mind/MIND-OS-HANDOFF-2026-05-16.md
```

Do not stage unrelated Mind dirty state.

## Validation

Run:

```bash
npm run --prefix projects/mind-steward ci
npm run --prefix projects/brain-core ci
```

Run any scheduler-specific tests if available.

Run targeted secret scans if tooling exists.

## Commit guidance

Stage explicit paths only. Do not stage:

```text
projects/mind-steward/dist/
projects/brain-core/dist/
tools/firecrawl/logs/firecrawl.log
.env
.env.*
node_modules/
```

Commit only if validation passes.

## Expected final report

Report:

1. Scheduler files found.
2. Model-router dry-run jobs added or blocker.
3. Brain Core scheduler reporting added or blocker.
4. Validations passed.
5. Files changed.
6. Whether anything was committed/pushed.
7. Remaining blockers.
