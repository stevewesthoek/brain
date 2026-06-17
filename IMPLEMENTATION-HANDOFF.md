# Mind Maintenance Implementation Handoff

**Repository:** `brain`  
**Status:** in progress  
**Current implementation-plan task:** Route jobs through Brain Core, scheduler, Mind Steward, and AI Model Selector.  
**Canonical plan:** `../mind/system/mind-implementation-plan.md`

## Operating constraints

Continue the implementation plan literally and sequentially.

- Do not invent phases or tasks.
- Do not mark a checkbox complete without direct code evidence and relevant validation.
- Do not modify unrelated dirty files.
- Do not commit unless explicitly requested.
- Keep the maintenance workflow report-only and approval-gated.
- Durable Mind truth must remain human-approved.

## Completed before this handoff

### Mind implementation plan

The following Phase 4 detector tasks are checked complete in `../mind/system/mind-implementation-plan.md`:

- stale-page candidate detection;
- duplicate-page candidate detection;
- contradiction candidate detection;
- completed-but-still-active detection;
- source-reference gap detection;
- durable-insight-trapped-in-capture detection.

The next unchecked task is:

```text
Route jobs through Brain Core, scheduler, Mind Steward, and AI Model Selector.
```

The following task after that is:

```text
Expose status and latest reports in Brain Console.
```

### Detector implementation

Implemented and enabled under `projects/brain-core/src/mind-maintenance-pilot/`:

- `stale-page-detector.ts`
- `completed-active-detector.ts`
- `source-gap-detector.ts`
- duplicate detection inside `pilot-report-builder.ts`
- `contradiction-detector.ts`
- `capture-promotion-detector.ts`

Relevant report-builder coverage is in:

```text
projects/brain-core/src/tests/mind-maintenance-pilot-report-builder.test.ts
```

The direct focused test script is:

```text
npm run test:mind-maintenance-report-builder:direct
```

Last successful focused result:

```text
12 tests passed
0 failed
```

The normal build-backed script is currently blocked by unrelated existing errors in:

```text
projects/brain-core/src/adapters/thumbnail-queue.ts
```

Errors previously observed:

```text
'marker' is possibly 'undefined'
```

Do not repair that unrelated file as part of this implementation-plan task.

## Current routing work

### Scheduler registration

`projects/brain-core/src/adapters/scheduler.ts` now registers:

```text
id: mind-maintenance-report-only
name: Mind maintenance report-only review
mutationRequired: false
```

It is listed alongside existing Mind Steward jobs.

### AI Model Selector wrapper

`projects/brain-core/src/adapters/ai-model-selector-service.ts` now exports:

```text
selectAiModel(request)
```

This is a bounded wrapper around:

```text
POST /select
```

It returns:

- `ok`
- `selectedModel`
- `provider`
- `reason`

### Routing adapter

Created:

```text
projects/brain-core/src/adapters/mind-maintenance-routing.ts
```

It currently defines:

```text
MIND_MAINTENANCE_SCHEDULER_JOB
routeMindMaintenanceJob(input)
```

Current intended routing contract:

- runtime: Brain Core;
- scheduler job: `mind-maintenance-report-only`;
- owner: Mind Steward;
- mode: report-only;
- AI Model Selector consulted only when `ambiguousSemanticChecks > 0`;
- existing `runMindMaintenancePilot(...)` performs the bounded report-only run;
- routing result returns explicit evidence of each routing layer.

### Reusing tested CLI dependencies

`projects/brain-core/src/bin/mind-maintenance-pilot.ts` was changed to export:

```text
export const defaultDependencies
```

This bundle contains the existing tested implementations for:

- current time;
- Mind root resolution;
- source commit lookup;
- changed-path detection;
- report-only pilot invocation.

The latest change began wiring this into:

```text
projects/brain-core/src/adapters/mind-maintenance-routing.ts
```

Current file state imports:

```text
import { defaultDependencies } from '../bin/mind-maintenance-pilot.js';
```

However, the adapter still needs to be updated to actually use `defaultDependencies` instead of directly calling the old runner symbol.

## Exact next steps

Perform these in order.

### 1. Finish routing adapter dependency reuse

Update:

```text
projects/brain-core/src/adapters/mind-maintenance-routing.ts
```

The adapter should resolve or accept the Mind root, resolve the source commit when not supplied, provide `listChangedPaths`, and call:

```text
defaultDependencies.runPilot(...)
```

Use:

```text
defaultDependencies.resolveMindRoot
defaultDependencies.resolveSourceCommit
defaultDependencies.listChangedPaths
defaultDependencies.now
```

Do not duplicate the CLI git/path logic.

### 2. Expose one bounded Brain Core POST route

Add a route in:

```text
projects/brain-core/src/api/routes.ts
```

Suggested route:

```text
POST /mind-maintenance/run
```

Required request behavior:

- explicit report-only enablement;
- required Mind root or approved configured default;
- optional source commit;
- optional `ambiguousSemanticChecks`, default `0`;
- no direct Mind-content mutation;
- call `routeMindMaintenanceJob(...)`;
- return the routing evidence and runner result.

Follow existing `routePostRequest(...)` JSON parsing and error-response patterns. Use a narrow `grep_context` or `read_range` before patching because `routes.ts` is large.

### 3. Add focused routing tests

Create or extend a focused test under:

```text
projects/brain-core/src/tests/
```

The tests should verify:

- scheduler metadata identifies `mind-maintenance-report-only`;
- runtime is `brain-core`;
- owner is `mind-steward`;
- AI Model Selector is not consulted when ambiguous checks are `0`;
- AI Model Selector is consulted when ambiguous checks are greater than `0`;
- the report-only runner receives `generatedBy: brain-core/scheduler/mind-steward`;
- no source writes are introduced;
- invalid negative ambiguous-check counts are rejected.

Prefer dependency injection or a narrow exported factory if needed. Do not call the live selector service in tests.

### 4. Run focused validation

Use a direct `tsx --test` script if the unrelated project-wide TypeScript error remains.

Do not claim the routing task complete until focused routing tests pass.

### 5. Update the canonical implementation plan

After successful validation, update only this line in:

```text
../mind/system/mind-implementation-plan.md
```

From:

```text
- [ ] Route jobs through Brain Core, scheduler, Mind Steward, and AI Model Selector.
```

To an evidence-backed checked line citing:

- `projects/brain-core/src/adapters/mind-maintenance-routing.ts`;
- `projects/brain-core/src/adapters/scheduler.ts`;
- `projects/brain-core/src/adapters/ai-model-selector-service.ts`;
- the Brain Core route in `projects/brain-core/src/api/routes.ts`;
- focused routing test results.

Then continue to the next literal unchecked task:

```text
Expose status and latest reports in Brain Console.
```

## Files changed during the current routing task

```text
projects/brain-core/src/adapters/ai-model-selector-service.ts
projects/brain-core/src/adapters/mind-maintenance-routing.ts
projects/brain-core/src/adapters/scheduler.ts
projects/brain-core/src/bin/mind-maintenance-pilot.ts
```

Earlier detector work also changed:

```text
projects/brain-core/src/mind-maintenance-pilot/pilot-report-builder.ts
projects/brain-core/src/mind-maintenance-pilot/report-schema-validator.ts
projects/brain-core/src/mind-maintenance-pilot/contradiction-detector.ts
projects/brain-core/src/mind-maintenance-pilot/capture-promotion-detector.ts
projects/brain-core/src/tests/mind-maintenance-pilot-report-builder.test.ts
projects/brain-core/package.json
```

Mind plan changes are in:

```text
../mind/system/mind-implementation-plan.md
```

## Important repository state warning

There are unrelated existing dirty files in the Brain repository. Do not stage, revert, or modify them while continuing this task. In particular, previous context identified unrelated changes under system configs, generated caches, build artifacts, and video-related files.

No commit has been requested or created for this work.
