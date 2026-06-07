# Graphify Selector Integration Plan

This plan defines O3: connecting the Brain Graphify Orchestrator to AI Model Selector without hardcoding model fallback logic.

It follows:

- `operations/specs/graphify-standard.md`
- `operations/specs/graphify-profile-contract.md`
- `operations/specs/graphify-execution-guardrails.md`
- `operations/specs/ai-model-selector-preference-policy.md`

## Current state

The orchestrator already emits a report-only selector request preview from the selected Graphify profile policy.

It does not call AI Model Selector yet.

## Goal

Add an explicit selector resolution step for operations that require semantic model policy.

Initial selector integration should remain report-only for these operations:

```text
full
critical-rebuild
```

It may resolve the selector policy and report the selected provider/model, but it must not run Graphify full or critical rebuild until a later approved phase.

## Required behavior

When selector resolution is enabled, the orchestrator should:

1. read the selected operation policy from `.graphify-profile.json` or Brain examples;
2. convert profile policy to `TaskMetadata` fields;
3. call AI Model Selector through a stable Brain-owned interface;
4. record selected provider/model/base URL/reason/cost estimate;
5. record selector failures as blocked reports;
6. not call providers directly;
7. not hardcode model fallback;
8. preserve local-only/private/offline selector semantics.

## Stable interface requirement

The orchestrator should not import arbitrary selector internals in multiple places.

Preferred approach:

```text
tools/graphify/selector-resolve.mjs or .py
```

or a future Brain Core endpoint/action that wraps:

```text
operations/system-configs/model-selector/runtime/core.py
```

This wrapper should be reusable by other Brain tools.

## Feature flag

Selector resolution should require an explicit flag at first:

```text
GRAPHIFY_ORCHESTRATOR_ENABLE_SELECTOR_RESOLUTION=true
```

Without the flag, reports should keep showing the selector request preview only.

## First supported operations

Selector resolution should apply first to:

```text
--operation full
--operation critical-rebuild
```

The operations remain blocked from Graphify execution, but the selector can confirm which model/provider would be used.

## Update operation

`--operation update` does not require selector resolution for the first guarded execution slice.

If a future update requires semantic AI, the orchestrator should use the same selector resolution mechanism.

## Report fields

Add a selector section:

```yaml
selector:
  resolutionRequested: true|false
  resolutionEnabled: true|false
  status: skipped|ok|blocked|failed
  request: {}
  selectedProvider: null
  selectedModel: null
  baseUrl: null
  reason: null
  costEstimate: null
  error: null
```

## Acceptance criteria

O3 is complete when:

1. selector request preview remains visible without calling selector;
2. selector resolution is blocked without `GRAPHIFY_ORCHESTRATOR_ENABLE_SELECTOR_RESOLUTION=true`;
3. selector resolution succeeds with the feature flag when selector config is available;
4. full and critical-rebuild still do not run Graphify;
5. update execution remains unchanged;
6. no provider/model fallback logic is added outside AI Model Selector;
7. reports remain profile-specific;
8. preflight and blocked-update smoke scripts still pass.
