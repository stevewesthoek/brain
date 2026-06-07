# Graphify Hook and Watch Plan

This plan defines O8: safe hook/watch support for Graphify.

It follows:

- `operations/specs/graphify-standard.md`
- `operations/specs/graphify-profile-contract.md`
- `operations/specs/graphify-execution-guardrails.md`
- `operations/specs/graphify-selector-integration-plan.md`
- `operations/specs/graphify-scheduler-integration-plan.md`

## Current state

Completed before O8:

- canonical Graphify strategy and operating standard;
- repo profile contract, schema, and examples;
- report-only preflight;
- guarded update execution behind `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true`;
- AI Model Selector request preview and selector resolver integration;
- output validation summaries;
- Brain Console visibility;
- safe scheduler/action candidates for preflight and blocked update validation.

## O8 goal

Enable Graphify hook/watch behavior only after manual and scheduled execution paths are stable.

O8 must not introduce hidden continuous work. Hook/watch must be explicit, observable, reversible, and profile-aware.

## Non-goals

O8 must not:

- enable full semantic rebuilds automatically;
- enable critical rebuilds automatically;
- bypass AI Model Selector;
- hardcode model fallback logic;
- watch every repo by default;
- run continuously without status visibility;
- modify source files outside Graphify output paths;
- run without an explicit feature flag and approval path.

## Supported modes

### Hook mode

Purpose:

```text
Run a bounded Graphify update after explicit repo events, such as git commit or checkout, when safe.
```

Initial hook mode should be opt-in per repo profile and disabled by default.

### Watch mode

Purpose:

```text
Observe file changes and run bounded update behavior when safe.
```

Watch mode is higher risk because it can run continuously and consume local CPU/IO. It must come after hook mode.

## Feature flags

Required future flags:

```text
GRAPHIFY_ORCHESTRATOR_ENABLE_HOOKS=true
GRAPHIFY_ORCHESTRATOR_ENABLE_WATCH=true
```

These flags are separate from:

```text
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true
GRAPHIFY_ORCHESTRATOR_ENABLE_SELECTOR_RESOLUTION=true
```

Hook/watch should require both execution enablement and the specific hook/watch flag.

## Repo profile additions

Future `.graphify-profile.json` fields may include:

```json
{
  "hooks": {
    "enabled": false,
    "postCommit": false,
    "postCheckout": false,
    "operation": "update"
  },
  "watch": {
    "enabled": false,
    "debounceMs": 30000,
    "maxRunsPerHour": 4,
    "operation": "update"
  }
}
```

These fields must remain declarative. Profiles must not contain procedural commands.

## Guardrails

Hook/watch execution must:

1. use the Brain Graphify Orchestrator;
2. run only `--operation update` at first;
3. use profile exclusions;
4. write reports under `runtime/local/graphify/`;
5. validate expected outputs after each run;
6. expose status through Brain Core and Brain Console;
7. rate-limit repeated runs;
8. record last trigger, last run, duration, exit code, and blocked reason;
9. never enable full or critical rebuilds automatically;
10. never call providers directly.

## Rollout order

1. Extend profile schema with disabled hook/watch fields.
2. Add report-only hook/watch preflight status.
3. Add Brain Core read-only hook/watch readiness endpoint.
4. Add Console visibility for readiness.
5. Add manual hook install preview.
6. Add explicitly approved hook install.
7. Validate on Brain only.
8. Validate on Mind only.
9. Consider code-app rollout.
10. Evaluate watch mode only after hook mode is stable.

## Acceptance criteria

O8 planning is complete when:

- hook/watch risk boundaries are documented;
- feature flags are defined;
- profile schema extension is planned;
- hook/watch remains disabled by default;
- full/critical rebuild remains blocked for hook/watch;
- next implementation slice is limited to profile schema and report-only readiness.

## Decision

Hook/watch is not enabled yet.

The next safe implementation slice is:

```text
Extend the Graphify profile schema and examples with disabled hook/watch declarations.
```
