# AI Model Selector — Canonical Request Contract

This document is the single source of truth for how any service, script, or automation must call the AI Model Selector.

Service endpoint: `http://127.0.0.1:4890` (override with `AI_SELECTOR_URL` env var)

---

## POST /select

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `task_type` | string | Registered task type name (see registry below) |

### Optional fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `input_token_count` | integer | 0 | Estimated input token count for the task |
| `urgent` | boolean | false | Set true to prefer immediate selection over batch-window deferral |
| `previous_failures` | string[] | [] | Provider IDs to exclude this attempt |
| `local_only` | boolean | false | Legacy shorthand: forces `external_provider_disallowed=true, offline=true` |
| `task_metadata` | object | {} | Preference and constraint object (see below) |

### task_metadata fields (all optional)

| Field | Type | Description |
|-------|------|-------------|
| `quality_tier` | string | Hint to selector: `"highest"`, `"balanced"`, `"efficient"`, `"cost_efficient"` |
| `preferred_providers` | string[] | Provider IDs in preference order. Selector tries these first. |
| `preferred_models` | string[] | Registry model IDs or compatibility aliases in preference order. The request adapter resolves them before selection. |
| `allowed_providers` | string[] | Whitelist: restrict to these provider IDs only |
| `disallowed_providers` | string[] | Blacklist: exclude these provider IDs |
| `allowed_models` | string[] | Whitelist: restrict to these model IDs only |
| `disallowed_models` | string[] | Blacklist: exclude these model IDs |
| `fallback_policy` | string | `"selector_default"` (default), `"ordered"`, `"ordered_then_selector_default"`, `"ordered_strict"`, `"none"` |
| `selection_policy` | string | Optional named policy label (informational, reserved for future routing) |
| `offline` | boolean | Only local/LAN providers allowed |
| `external_provider_disallowed` | boolean | Same as offline for external provider filtering |
| `sensitive` | boolean | Apply privacy constraints |
| `private` | boolean | Apply privacy constraints |

### Fallback policies

| Policy | Behavior |
|--------|----------|
| `selector_default` | Default. Use selector priority/cost/batch-window ranking. No preference override. |
| `ordered` | Try `preferred_providers` + `preferred_models` first; fall back to selector ranking if none viable. |
| `ordered_then_selector_default` | Explicit alias for `ordered`. Recommended for high-quality automation. |
| `ordered_strict` | Try preferred only. If none viable, return 503 (NoProviderAvailable). No fallback. |
| `none` | Use only the first explicitly preferred provider. If it is unavailable, return 503. Unknown policy names are rejected. |

### Hard constraints (cannot be overridden by preferences)

- `offline=true` or `external_provider_disallowed=true` → local/LAN providers only, regardless of `preferred_providers`
- `sensitive=true` / `private=true` → existing privacy constraints apply

---

## Response — success

HTTP 200 when a provider and model are selected. Consumers must branch on the
`outcome` discriminator before using the selection fields.

```json
{
  "outcome": "selected",
  "provider_id": "codex-cli",
  "model": "gpt-5.5",
  "base_url": "",
  "api_key": null,
  "reason": "urgent; priority=4",
  "cost_estimate": 0.0,
  "timeout_inference_sec": 120
}
```

## Response — deferred

HTTP 200 when policy defers a non-urgent request to a later batch window. A
deferred response is not a provider/model selection and must not be executed.
The `deferred` field is retained for compatibility.

```json
{
  "outcome": "deferred",
  "deferred": true,
  "scheduled_after": "2026-06-10T01:00:00",
  "reason": "selector_policy_deferred"
}
```

## Response — unavailable

HTTP 503 when no eligible provider is available after the selector's health,
constraint, and failure checks. This response contains no executable
provider/model selection.

```json
{
  "outcome": "unavailable",
  "error": "No provider available for task='codebase_semantic_graph' after failures=[]",
  "reason": "No provider available for task='codebase_semantic_graph' after failures=[]",
  "task_type": "codebase_semantic_graph"
}
```

## Response — rejected

HTTP 400 when the request is invalid, malformed, or violates the selector's
request constraints. This response contains no executable provider/model
selection.

```json
{
  "outcome": "rejected",
  "error": "task_type is required",
  "reason": "task_type is required"
}
```

Unexpected internal server failures use HTTP 500 and may not include a typed
outcome. Consumers must fail closed for those responses as well.

Consumers must branch on `outcome`; only `selected` permits use of
`provider_id` and `model`. A non-selected outcome must never be interpreted as
an executable provider/model selection.

---

## POST /report-success

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_id` | string | yes | Provider that was used |
| `model` | string | no | Model ID that was used |

## POST /report-failure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_id` | string | yes | Provider that failed |
| `model` | string | no | Model ID that failed |
| `error_type` | string | no | `"rate_limit"`, `"timeout"`, or other error class |
| `error_message` | string | no | Human-readable error detail (truncated to 500 chars) |

---

## Registered task types

| Task Type | Capability | Notes |
|-----------|-----------|-------|
| `metadata_generation` | text/large | Video metadata generation |
| `thumbnail_headline` | text/small | Short headline generation |
| `seo_keyword_expansion` | text/small | SEO keyword expansion |
| `transcript_summarization` | text/large | Long transcript summarization |
| `subtitle_generation` | text/small | Subtitle/caption generation |
| `background_image` | text/small | Background image prompt |
| `description_quality_review` | text/review | Review video descriptions |
| `design_visual_workbench` | text/large | Design asset generation |
| `design_spec_generation` | text/large | Design spec writing |
| `design_review` | text/review | Design review |
| `video_frame_analysis` | image/analyze | Per-frame visual analysis |
| `video_summary_generation` | text/large | Video summary |
| `fala_conversation_response` | text/medium | FALA chat response |
| `fala_prompt_qa` | text/small | FALA prompt QA |
| `fala_content_analysis` | text/large | FALA content analysis |
| `fala_curriculum_generation` | text/large | FALA curriculum generation |
| `mind_capture_classification` | text/small | Mind capture triage |
| `mind_maintenance_semantic_comparison` | text/medium | Bounded private-Mind semantic comparison for the report-only maintenance pilot |
| `codebase_semantic_graph` | text/large | Codebase semantic graph generation (Graphify) |

---

## Provider registry

| Provider ID | Type | Priority | Models |
|-------------|------|----------|--------|
| `ollama-m4pro` | openai-compatible | 2 | qwen2.5:14b, qwen2.5:32b, llama3.1:8b, gemma4:12b, gemma4:e4b |
| `ollama-m1` | openai-compatible | 3 | qwen2.5:14b, llama3.1:8b, llama3.2:3b, gemma4:e4b, gemma4:12b |
| `whisper-m4pro` | whisper | 2 | large-v3, distil-large-v3 |
| `whisper-m1` | whisper-remote | 1 | large-v3, distil-large-v3 |
| `codex-cli` | cli | 4 | gpt-5.4-mini, gpt-5.4, gpt-5.5 |
| `claude-bedrock` | bedrock | 5 | See bedrock model registry below |

### Registry compatibility references

The following provider/model values document compatibility aliases and registry
bindings. They are not policy-owned portfolios. New consumers should send a
`task_type` plus capability/constraint metadata and use model references only
when an explicit compatibility preference or safety constraint is required.

### Bedrock model registry

| Model Key (id) | Model ID (use in preferred_models) | Label |
|----------------|-------------------------------------|-------|
| `nemotron-super-3` | `nvidia.nemotron-super-3-120b` | NVIDIA Nemotron 3 Super 120B |
| `qwen3-coder-next` | `qwen.qwen3-coder-next` | Qwen3 Coder Next |
| `deepseek-v3-2` | `deepseek.v3.2` | DeepSeek V3.2 |
| `kimi-k2-thinking` | `moonshot.kimi-k2-thinking` | Kimi K2 Thinking |
| `kimi-k2-5` | `moonshotai.kimi-k2.5` | Kimi K2.5 |
| `gpt-oss-120b` | `openai.gpt-oss-120b-1:0` | gpt-oss-120b |
| `claude-sonnet-4-6` | `us.anthropic.claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-opus-4-6` | `us.anthropic.claude-opus-4-6-v1` | Claude Opus 4.6 ✓ |
| `claude-opus-4-7` | `us.anthropic.claude-opus-4-7` | Claude Opus 4.7 (disabled) |

When using `preferred_models`, use a `registry_model_id` or compatibility alias.
The request adapter resolves it to the provider binding and rejects ambiguous,
unknown, or non-admitted references.

---

## Consumer rules

1. Do not implement provider or model fallback inside the consumer. Use `fallback_policy` instead.
2. Do not hardcode `--backend ollama` or any provider-specific flag in caller scripts.
3. Execute only the selected provider type: Bedrock through a private request
   file and Codex through stdin/private output. `base_url`/`api_key` apply only
   to an explicitly admitted HTTP provider; active text consumers must not
   assume an OpenAI-compatible endpoint.
4. Always call `/report-success` or `/report-failure` after execution completes.
5. Do not set `local_only=true` unless the task genuinely requires private/offline routing.
6. Identify yourself via a `caller` or `service` label in log output, not in the HTTP request.

---

## Examples

### No preferences (selector routing)

```json
{
  "task_type": "codebase_semantic_graph",
  "input_token_count": 45000,
  "urgent": true
}
```

### Codex-first, Opus fallback, then selector default

```json
{
  "task_type": "codebase_semantic_graph",
  "input_token_count": 45000,
  "urgent": true,
  "task_metadata": {
    "quality_tier": "highest",
    "preferred_providers": ["codex-cli", "claude-bedrock"],
    "preferred_models": ["codex-cli/gpt-5.5", "claude-bedrock/claude-opus-4-6"],
    "fallback_policy": "ordered_then_selector_default"
  }
}
```

### Private Bedrock-only task

```json
{
  "task_type": "mind_capture_classification",
  "input_token_count": 500,
  "urgent": true,
  "task_metadata": {
    "private": true,
    "sensitive": true,
    "allowed_providers": ["claude-bedrock"],
    "allowed_models": ["us.anthropic.claude-sonnet-4-6"],
    "preferred_providers": ["claude-bedrock"],
    "preferred_models": ["us.anthropic.claude-sonnet-4-6"],
    "fallback_policy": "none"
  }
}
```

### Report success

```json
{
  "provider_id": "codex-cli",
  "model": "gpt-5.5"
}
```

### Report failure

```json
{
  "provider_id": "codex-cli",
  "model": "gpt-5.5",
  "error_type": "timeout",
  "error_message": "graphify extract timed out after 7200s"
}
```

---

## Backend mapping rules

The selector response includes `provider_id`, `provider_type`, `model`, and `base_url`. Consumers translate these into tool-specific CLI flags:

| provider_type | Mapping |
|---------------|---------|
| `openai-compatible` | `--backend openai-compatible --api-base <base_url> --model <model>` |
| `cli` | Model passed as provider-specific flag (e.g. Codex CLI uses `--model <model>`) |
| `bedrock` | Model passed via environment or provider-specific config |

---

_This document is canonical. Do not duplicate the request schema in consumer scripts._
_Any addition of task types, provider IDs, or model IDs must update this document._
