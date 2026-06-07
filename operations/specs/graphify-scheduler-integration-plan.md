# Graphify Scheduler Integration Plan

This plan defines O7: scheduled/on-demand Brain-owned Graphify orchestration.

It follows:

- `operations/specs/graphify-standard.md`
- `operations/specs/graphify-profile-contract.md`
- `operations/specs/graphify-execution-guardrails.md`
- `operations/specs/graphify-selector-integration-plan.md`

## Current state

Completed:

- Graphify profile contract, schema, and examples;
- report-only orchestrator preflight;
- guarded `--operation update --execute` path behind `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true`;
- AI Model Selector request preview and resolver integration;
- output validation summary;
- Brain Console visibility for Graphify runtime reports.

## O7 goal

Expose Graphify orchestration through Brain Core scheduler/action surfaces without enabling continuous watchers.

The first scheduled/on-demand jobs should be safe and report-only.

## First candidate jobs

Add these scheduler/action candidates in order:

```text
scheduler-run-graphify-preflight-mind
scheduler-run-graphify-preflight-brain
scheduler-run-graphify-update-mind-blocked
scheduler-run-graphify-update-brain-blocked
```

The blocked update jobs intentionally run `--execute --operation update` without setting `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` and should produce `execution-blocked` reports. They validate the guardrail path without modifying target repos.

## Later executable jobs

Executable update jobs must come later and require explicit approval plus feature flag:

```text
scheduler-run-graphify-update-mind
scheduler-run-graphify-update-brain
```

They must require:

```text
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true
```

Do not add full or critical-rebuild scheduler execution yet.

## Jobs that remain blocked

```text
scheduler-run-graphify-full-*
scheduler-run-graphify-critical-rebuild-*
scheduler-run-graphify-hook-*
scheduler-run-graphify-watch-*
```

Reasons:

- full and critical rebuild require premium semantic model policy and AI Model Selector readiness;
- hook/watch can run continuously and affect local machine load;
- these should be separately approved phases.

## Brain Core integration points

Expected files:

```text
projects/brain-core/src/adapters/execution-plans.ts
projects/brain-core/src/adapters/scheduler.ts
projects/brain-core/src/adapters/actions.ts
projects/brain-core/src/adapters/action-allowlist.ts
projects/brain-core/src/adapters/approval-store.ts
projects/brain-core/src/types/api.ts
projects/brain-core/src/tests/routes.test.ts
```

Implementation should mirror the Mind Steward report-only job pattern.

## Required npm/script entrypoints

Existing Brain package scripts should be used where possible:

```text
graphify:preflight:mind
graphify:preflight:brain
graphify:update:mind:blocked
graphify:update:brain:blocked
```

If Brain Core actions need shell scripts, add thin allowlisted wrappers under:

```text
tools/scripts/
```

Wrappers must call the Brain-owned npm scripts and write only Brain runtime reports.

## Acceptance criteria

O7 first slice is complete when:

1. scheduler jobs list includes the four safe Graphify candidates;
2. execution plans expose those candidates;
3. approval requests can preview those candidates;
4. preflight candidates execute successfully when approved;
5. blocked update candidates execute and return `execution-blocked` reports;
6. no target repo source files are modified by blocked jobs;
7. full/critical/hook/watch candidates are not exposed;
8. Brain Core typecheck passes;
9. focused route tests cover job listing, preview, approval, and execution behavior.

## Safety rule

O7 must not introduce continuous execution.

Scheduled/on-demand execution must remain explicit, approved, reportable, and feature-flagged before any repo-writing Graphify update is allowed.
