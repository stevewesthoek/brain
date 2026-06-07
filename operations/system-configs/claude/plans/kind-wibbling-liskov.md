# Plan: Generic Model Selector Preference Policy

## Context

AI Model Selector (`core.py`) currently supports local-only/offline/private routing but lacks ordered model preferences, provider allow/disallow lists, and fallback policies. Any automation, scheduler job, or CLI tool that wants "try model A first, fall back to B" must implement this logic itself — the spec says it belongs in the selector.

This change adds generic preference/fallback fields to `TaskMetadata` and corresponding selection logic. It is intentionally repo-agnostic. Existing behavior is fully preserved when new fields are absent (all default to empty/None).

## Files to modify

- `operations/system-configs/model-selector/runtime/core.py` — implementation (all changes here)
- `operations/specs/ai-model-selector-preference-policy.md` — add Consumer Contract section

## File to create

- `operations/system-configs/model-selector/tests/test_model_selector_preference_policy.py`

---

## Implementation

### 1. Extend `TaskMetadata` (core.py:50)

Add 9 optional fields using `field(default_factory=list)` for lists:

```python
@dataclass
class TaskMetadata:
    sensitive: bool = False
    private: bool = False
    offline: bool = False
    external_provider_disallowed: bool = False
    # New generic preference/fallback fields
    quality_tier: str | None = None
    preferred_models: list[str] = field(default_factory=list)
    preferred_providers: list[str] = field(default_factory=list)
    allowed_models: list[str] = field(default_factory=list)
    disallowed_models: list[str] = field(default_factory=list)
    allowed_providers: list[str] = field(default_factory=list)
    disallowed_providers: list[str] = field(default_factory=list)
    fallback_policy: str | None = None
    selection_policy: str | None = None
```

### 2. Extend `_provider_allowed_for_metadata` (core.py:825)

After the existing offline/external_provider_disallowed logic (which is a hard constraint and must run first), append:

```python
# Hard: disallowed_providers
if provider.get("id") in task_metadata.disallowed_providers:
    return False

# Hard: allowed_providers (non-empty = whitelist)
if task_metadata.allowed_providers and provider.get("id") not in task_metadata.allowed_providers:
    return False

return True
```

Existing early-return path (`if not offline and not external_provider_disallowed: return True`) must be changed to fall through to the new checks instead of returning immediately.

### 3. Extend `select_provider` (core.py:844)

After the existing sort block, add two blocks:

**A. Preferred provider ordering (stable sort, any policy):**
```python
if task_metadata.preferred_providers:
    pref_set = set(task_metadata.preferred_providers)
    eligible.sort(key=lambda p: 0 if p["id"] in pref_set else 1)
```
Python sort is stable, so existing relative order is preserved within each group.

**B. ordered_strict filtering (restrict to preferred_providers only):**
```python
fallback_policy = task_metadata.fallback_policy or "selector_default"
if fallback_policy == "ordered_strict" and task_metadata.preferred_providers:
    pref_set = set(task_metadata.preferred_providers)
    eligible = [p for p in eligible if p["id"] in pref_set]
```

Pass `task_metadata` to `_pick_model` and `_pick_bedrock_model`:
```python
model = self._pick_model(provider, task_spec, task_metadata)
bedrock_model = self._pick_bedrock_model(task_type, task_spec, input_token_count, urgent, task_metadata)
```

### 4. Extend `_pick_model` (core.py:766)

Add `task_metadata: TaskMetadata | None = None` parameter.

In the viability loop, add model-level filtering before appending to `viable`:
```python
if task_metadata:
    if task_metadata.allowed_models and model not in task_metadata.allowed_models:
        continue
    if model in task_metadata.disallowed_models:
        continue
```

After building `viable`, apply preference ordering:
```python
if task_metadata and task_metadata.preferred_models and viable:
    pref_order = {m: i for i, m in enumerate(task_metadata.preferred_models)}
    viable.sort(key=lambda m: pref_order.get(m, len(task_metadata.preferred_models)))
```

### 5. Extend `_pick_bedrock_model` (core.py:724)

Add `task_metadata: TaskMetadata | None = None` parameter.

After building `candidates` (and before scoring/sorting), apply model-level filtering:
```python
if task_metadata:
    if task_metadata.disallowed_models:
        dis = set(task_metadata.disallowed_models)
        candidates = [m for m in candidates
                      if m.get("model_id") not in dis and m.get("id") not in dis]
    if task_metadata.allowed_models:
        al = set(task_metadata.allowed_models)
        candidates = [m for m in candidates
                      if m.get("model_id") in al or m.get("id") in al]
```

After scoring/sorting `scored`, apply preference ordering:
```python
if task_metadata and task_metadata.preferred_models:
    pref_order = {m: i for i, m in enumerate(task_metadata.preferred_models)}
    def bedrock_pref_key(m):
        return pref_order.get(m.get("model_id", ""), pref_order.get(m.get("id", ""), len(task_metadata.preferred_models)))
    scored.sort(key=bedrock_pref_key)
```

---

## Test file: `test_model_selector_preference_policy.py`

Reuse the same `setUp`/`tearDown`/`_write_config` pattern as existing tests.

Test config: three providers — `ollama-local` (localhost openai-compatible), `codex-cli` (cli), `claude-bedrock` (bedrock). Two models on ollama: `qwen2.5:14b` and `qwen2.5:32b`.

**Tests to implement:**

| Test name | Scenario | Expected |
|-----------|----------|----------|
| `test_no_metadata_preference_uses_default_priority` | No new fields set | Selector picks as before |
| `test_preferred_providers_chosen_when_healthy` | `preferred_providers=["codex-cli"]`, codex healthy | `codex-cli` selected |
| `test_disallowed_providers_excluded` | `disallowed_providers=["codex-cli"]` | `codex-cli` not selected |
| `test_allowed_providers_restricts_to_list` | `allowed_providers=["ollama-local"]`, ollama healthy | `ollama-local` selected, codex skipped |
| `test_preferred_models_chosen_when_available` | `preferred_models=["qwen2.5:32b"]`, both models loaded, resource ok | `qwen2.5:32b` selected |
| `test_disallowed_models_excluded` | `disallowed_models=["qwen2.5:14b"]`, only 14b loaded | No model → skip provider |
| `test_allowed_models_restricts` | `allowed_models=["qwen2.5:32b"]`, only 14b loaded | No model from ollama |
| `test_ordered_then_selector_default_falls_back` | `preferred_providers=["codex-cli"]`, codex unhealthy | Falls back to `ollama-local` |
| `test_ordered_strict_raises_when_preferred_unavailable` | `preferred_providers=["codex-cli"]`, `fallback_policy="ordered_strict"`, codex unhealthy | `NoProviderAvailable` |
| `test_external_provider_disallowed_overrides_preferred` | `preferred_providers=["codex-cli"], external_provider_disallowed=True` | `ollama-local` selected (not codex) |

---

## Spec update: `ai-model-selector-preference-policy.md`

Add a **Consumer contract** section with a code example showing how any module/repo calls the selector with the new fields. Make clear the mechanism is repo-agnostic. Mark which fallback policies correspond to which behaviors.

---

## Verification

```bash
# Run all tests
python3 -m unittest discover operations/system-configs/model-selector/tests

# Run specific tests
python3 operations/system-configs/model-selector/tests/test_model_selector_local_only.py
python3 operations/system-configs/model-selector/tests/test_model_selector_preference_policy.py
```

All existing tests must pass unchanged. New test file must pass.
