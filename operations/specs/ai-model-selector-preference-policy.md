# AI Model Selector Preference and Fallback Policy

This specification defines the repo-agnostic model preference and fallback mechanism for AI Model Selector.

It is not Graphify-specific.

Any Brain module, repo automation, CLI workflow, scheduler job, or application-specific tool that consumes AI Model Selector can use this policy when it needs ordered model preferences, fallback behavior, provider constraints, or quality tiers.

## Current selector behavior

The current selector already supports:

- task-type specific routing;
- provider capability matching;
- provider priority;
- local/private/offline metadata constraints;
- previous-failure exclusion;
- rate-limit checks;
- circuit breakers;
- provider health checks;
- Bedrock access checks;
- Bedrock model scoring;
- local resource guards;
- audit logging.

Current `TaskMetadata` supports:

```text
sensitive
private
offline
external_provider_disallowed
```

This is enough for local-only/private/offline routing, but it is not enough for explicit ordered preferences such as:

```text
try model A first
if unavailable/rate-limited/unhealthy, try model B
then fall back according to policy
```

## Required new capability

AI Model Selector should support a general selection policy object that is independent from any one application.

The policy must support:

- quality tiers;
- ordered model preferences;
- ordered provider preferences;
- allowed model labels;
- disallowed model labels;
- allowed provider IDs;
- disallowed provider IDs;
- fallback policy;
- local-only and external-provider constraints;
- structured reporting of why a model/provider was selected or skipped.

## Proposed metadata extension

Extend `TaskMetadata` with optional generic fields:

```python
quality_tier: str | None = None
preferred_models: list[str] = []
preferred_providers: list[str] = []
allowed_models: list[str] = []
disallowed_models: list[str] = []
allowed_providers: list[str] = []
disallowed_providers: list[str] = []
fallback_policy: str | None = None
selection_policy: str | None = None
```

These fields are generic and reusable.

They must not contain application-specific names such as `graphify_only`.

## Proposed fallback policies

### selector_default

Use the current selector behavior: filter eligible providers and rank by existing selector priority, cost, batch-window preference, health, rate limits, circuit breakers, and task-specific logic.

### ordered

Try explicit ordered preferences first.

Expected behavior:

```text
1. apply hard constraints;
2. try preferred provider/model pairs in order;
3. skip unavailable, unhealthy, rate-limited, circuit-open, context-exceeded, or disallowed options;
4. return the first viable preferred option;
5. if no preferred option is viable, fall back according to fallback_if_unavailable.
```

### ordered_strict

Try explicit ordered preferences only.

If none are viable, return `NoProviderAvailable` or a structured blocked result.

### ordered_then_selector_default

Try explicit ordered preferences first, then continue with the existing selector ranking.

This should be the default for most high-quality automation because it preserves resilience.

## Policy labels

Selection policy labels should be reusable names, not application-specific scripts.

Examples:

```text
highest_quality
balanced
local_private
cost_efficient
ordered_premium
```

A consuming module may request:

```yaml
task_type: semantic_full_build
quality_tier: highest
selection_policy: ordered_premium
preferred_models:
  - codex-5.5-xhigh
  - bedrock-opus
fallback_policy: ordered_then_selector_default
```

The exact model labels must be mapped by AI Model Selector configuration to concrete providers/models.

## Consumer contract

A consumer should call AI Model Selector with:

```python
selector.select(
    task_type="some_task_type",
    input_token_count=estimated_tokens,
    urgent=False,
    previous_failures=[...],
    task_metadata=TaskMetadata(
        quality_tier="highest",
        preferred_models=["codex-5.5-xhigh", "bedrock-opus"],
        fallback_policy="ordered_then_selector_default",
    ),
)
```

The consumer should not implement provider/model fallback itself.

The consumer should handle only the result returned by AI Model Selector.

## Implementation boundaries

The preference/fallback mechanism belongs in:

```text
operations/system-configs/model-selector/runtime/core.py
```

and related selector config/tests.

It does not belong in:

- Graphify wrapper scripts;
- project repos;
- scheduler shell scripts;
- CLI task scripts;
- Brain Console UI;
- Mind repo automation.

## Acceptance criteria

The implementation is complete when:

1. `TaskMetadata` supports generic preference/fallback fields.
2. Selector can prefer ordered model labels when provided.
3. Selector can prefer ordered provider IDs when provided.
4. Selector skips unavailable or disallowed preferences safely.
5. Selector supports `selector_default`, `ordered`, `ordered_strict`, and `ordered_then_selector_default`.
6. Existing local-only/private/offline behavior remains unchanged.
7. Existing task-type routing remains unchanged.
8. Existing callers with no preference metadata behave exactly as before.
9. Tests cover generic preference/fallback behavior independent of Graphify.
10. Documentation explains how any repo/module should call the selector.

## Graphify usage as one consumer

Graphify will be only one consumer of this general mechanism.

For high-quality full semantic graph builds, Graphify Orchestrator may request:

```yaml
task_type: graphify_semantic_full_build
quality_tier: highest
selection_policy: ordered_premium
preferred_models:
  - codex-5.5-xhigh
  - bedrock-opus
fallback_policy: ordered_then_selector_default
```

But the selector mechanism itself must remain reusable for any future workflow.
