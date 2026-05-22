# AI Model Selector — Architecture

**Document type:** Architecture design  
**Status:** Active — ready for implementation  
**Last updated:** 2026-05-22  
**Routing policy:** `brain/ai/policy/routing.md`  
**VO strategy:** `video-orchestrator-strategy.md`

---

## Purpose

A unified AI routing microservice that all consumers (Video Orchestrator, Claude Code, Codex, Gemini) use to select the right AI provider for any generation task. Local-first, cost-aware, schedule-aware, fully auditable.

**Problem it solves:** Without a selector, every module hardcodes an API call to a specific provider. Adding a new provider (e.g., a better local model) requires touching every module. Rate limits cause silent failures. Batch window optimization is impossible.

---

## Architecture Decision

**Standalone Python HTTP microservice at `localhost:4890`**, co-located with the VO worker virtualenv.

Why not Brain Core (TypeScript at :4877)?
- Brain Core is read-only/advisory by design — adding execution routing violates its safety boundary
- VO worker is Python; HTTP works for all languages anyway

Why not a Python module inside the VO worker?
- Claude Code, Codex, Gemini can't `import` Python — they need HTTP or CLI
- Coupling routing to one consumer prevents reuse

Why not a pure CLI tool?
- No state persistence for rate limits across calls
- Cold-start per invocation, can't background-probe LM Studio health

**Result:** HTTP service + thin CLI shim. Same routing logic serves all consumers.

---

## File Map

```
~/.local/video-orchestrator/services/model-selector/
    selector_service.py      # HTTP server (stdlib http.server)
    core.py                  # Selection algorithm (importable by VO worker directly)
    client.py                # Python client helper
    __init__.py

~/.config/video-orchestrator/
    ai-providers.json        # Provider registry
    ai-task-types.json       # Task capability matrix
    ai-selector-config.json  # Behavior config (batch window, defer preference)

~/.local/video-orchestrator/state/
    rate-limits.json         # Persisted rate limit state

~/.local/video-orchestrator/logs/
    ai-selections.jsonl      # Audit log (one JSON line per selection)
    model-selector.log       # Service stdout/stderr

~/.local/bin/ai-select       # CLI shim
~/Library/LaunchAgents/com.office.ai-model-selector.plist  # LaunchAgent
```

---

## Provider Registry (`ai-providers.json`)

```json
{
  "version": 1,
  "providers": [
    {
      "id": "lmstudio-local",
      "type": "openai-compatible",
      "base_url": "http://localhost:1234/v1",
      "api_key": null,
      "cost_per_1k_tokens": 0.0,
      "priority": 1,
      "capabilities": ["text/small", "text/medium", "image/generate"],
      "max_context_tokens": 8192,
      "health_check": { "endpoint": "/models", "method": "GET", "expect_status": 200 },
      "rate_limit": null,
      "schedule_preference": "batch_window",
      "models": []
    },
    {
      "id": "whisper-local",
      "type": "whisper",
      "binary": "faster-whisper",
      "cost_per_1k_tokens": 0.0,
      "priority": 1,
      "capabilities": ["audio/transcribe"],
      "health_check": { "binary_exists": "faster-whisper" },
      "schedule_preference": "batch_window",
      "models": ["large-v3", "distil-large-v3"]
    },
    {
      "id": "gemini-flash",
      "type": "gemini",
      "base_url": "https://generativelanguage.googleapis.com/v1beta",
      "api_key_env": "GEMINI_API_KEY",
      "cost_per_1k_tokens": 0.0,
      "priority": 2,
      "capabilities": ["text/small", "text/medium", "text/large"],
      "max_context_tokens": 1000000,
      "rate_limit": { "requests_per_minute": 15, "requests_per_day": 1500 },
      "schedule_preference": "any",
      "models": ["gemini-2.5-flash"]
    },
    {
      "id": "claude-haiku",
      "type": "anthropic",
      "base_url": "https://api.anthropic.com/v1",
      "api_key_env": "ANTHROPIC_API_KEY",
      "cost_per_1k_tokens": 0.00025,
      "priority": 3,
      "capabilities": ["text/small", "text/medium"],
      "max_context_tokens": 200000,
      "rate_limit": { "requests_per_minute": 50, "tokens_per_minute": 100000 },
      "schedule_preference": "any",
      "models": ["claude-haiku-4-5"]
    },
    {
      "id": "openai-4o-mini",
      "type": "openai",
      "base_url": "https://api.openai.com/v1",
      "api_key_env": "OPENAI_API_KEY",
      "cost_per_1k_tokens": 0.00015,
      "priority": 4,
      "capabilities": ["text/small", "text/medium"],
      "max_context_tokens": 128000,
      "rate_limit": { "requests_per_minute": 60 },
      "schedule_preference": "any",
      "models": ["gpt-4o-mini"]
    },
    {
      "id": "claude-sonnet",
      "type": "anthropic",
      "base_url": "https://api.anthropic.com/v1",
      "api_key_env": "ANTHROPIC_API_KEY",
      "cost_per_1k_tokens": 0.003,
      "priority": 5,
      "capabilities": ["text/small", "text/medium", "text/large", "text/review"],
      "max_context_tokens": 200000,
      "rate_limit": { "requests_per_minute": 40 },
      "schedule_preference": "any",
      "models": ["claude-sonnet-4-6"]
    },
    {
      "id": "openai-4o",
      "type": "openai",
      "base_url": "https://api.openai.com/v1",
      "api_key_env": "OPENAI_API_KEY",
      "cost_per_1k_tokens": 0.005,
      "priority": 6,
      "capabilities": ["text/small", "text/medium", "text/large", "text/review"],
      "max_context_tokens": 128000,
      "rate_limit": { "requests_per_minute": 30 },
      "schedule_preference": "any",
      "models": ["gpt-4o"]
    },
    {
      "id": "claude-opus",
      "type": "anthropic",
      "base_url": "https://api.anthropic.com/v1",
      "api_key_env": "ANTHROPIC_API_KEY",
      "cost_per_1k_tokens": 0.015,
      "priority": 7,
      "capabilities": ["text/small", "text/medium", "text/large", "text/review"],
      "max_context_tokens": 200000,
      "rate_limit": { "requests_per_minute": 20 },
      "schedule_preference": "any",
      "models": ["claude-opus-4-7"]
    }
  ]
}
```

**Adding a new provider:** Add one record to this file. Zero code changes.  
**LM Studio models:** The `"models": []` array auto-populates at runtime from the LM Studio `/v1/models` health-check response.

---

## Task Capability Matrix (`ai-task-types.json`)

```json
{
  "task_types": {
    "metadata_generation": {
      "capability": "text/medium",
      "typical_input_tokens": 8000,
      "typical_output_tokens": 2000,
      "latency_tolerance": "minutes",
      "local_viable": true,
      "min_local_model_params": "7B"
    },
    "thumbnail_headline": {
      "capability": "text/small",
      "typical_input_tokens": 500,
      "typical_output_tokens": 20,
      "latency_tolerance": "seconds",
      "local_viable": true,
      "min_local_model_params": "7B"
    },
    "seo_keyword_expansion": {
      "capability": "text/small",
      "typical_input_tokens": 300,
      "typical_output_tokens": 200,
      "latency_tolerance": "seconds",
      "local_viable": true,
      "min_local_model_params": "7B"
    },
    "transcript_summarization": {
      "capability": "text/large",
      "typical_input_tokens": 30000,
      "typical_output_tokens": 1500,
      "latency_tolerance": "minutes",
      "local_viable": true,
      "min_local_model_params": "8B"
    },
    "subtitle_generation": {
      "capability": "audio/transcribe",
      "latency_tolerance": "minutes",
      "local_viable": true
    },
    "background_image": {
      "capability": "image/generate",
      "latency_tolerance": "minutes",
      "local_viable": true
    },
    "description_quality_review": {
      "capability": "text/review",
      "typical_input_tokens": 2000,
      "typical_output_tokens": 2000,
      "latency_tolerance": "minutes",
      "local_viable": false
    }
  }
}
```

---

## Selection Algorithm (pseudocode)

```python
def select_provider(task_type, input_token_count=0, urgent=False, previous_failures=[]):
    task_spec = TASK_TYPES[task_type]
    required_capability = task_spec["capability"]
    now = datetime.now()
    in_batch_window = 1 <= now.hour < 7

    # 1. Filter: capability match + not previously failed
    eligible = [
        p for p in PROVIDERS
        if required_capability in p["capabilities"]
        and p["id"] not in previous_failures
    ]

    # 2. Sort by priority, with batch-window preference
    if in_batch_window:
        # Strongly prefer free/local providers during batch
        eligible.sort(key=lambda p: (p["cost_per_1k_tokens"] > 0, p["priority"]))
    else:
        # Outside batch: prefer fast any-time providers, deprioritize batch-only
        eligible.sort(key=lambda p: (
            p["schedule_preference"] == "batch_window" and not urgent,
            p["priority"]
        ))

    for provider in eligible:
        if is_rate_limited(provider["id"]):
            continue
        if provider.get("health_check") and not check_health(provider):
            continue
        if provider.get("max_context_tokens") and input_token_count > provider["max_context_tokens"]:
            continue
        if is_lmstudio(provider):
            loaded_models = get_lmstudio_models()
            if not loaded_models:
                continue
            if not any(model_meets_min_params(m, task_spec) for m in loaded_models):
                continue

        # Provider passes all gates
        return SelectionResult(
            provider_id=provider["id"],
            model=pick_model(provider, task_spec),
            base_url=provider["base_url"],
            api_key=resolve_key(provider),
            reason=build_reason(provider, in_batch_window, urgent),
            cost_estimate=estimate_cost(provider, task_spec, input_token_count),
        )

    raise NoProviderAvailable(task_type, previous_failures)
```

---

## Behavior Config (`ai-selector-config.json`)

```json
{
  "batch_window": { "start_hour": 1, "end_hour": 7 },
  "prefer_defer_over_paid": true,
  "max_defer_hours": 18,
  "urgent_tasks_use_paid": true,
  "lmstudio_health_check_interval_sec": 30,
  "rate_limit_state_persist_interval_sec": 60
}
```

When `prefer_defer_over_paid` is `true`: non-urgent AI tasks that would require a paid API outside the batch window get their job's `scheduled_after` set to the next 1:00 AM instead of incurring API cost.

---

## HTTP API

Running at `localhost:4890`:

| Endpoint | Method | Body/Query | Returns |
|----------|--------|------------|---------|
| `/select` | POST | `{task_type, input_token_count, urgent, previous_failures}` | `{provider_id, model, base_url, api_key, reason, cost_estimate}` |
| `/report-failure` | POST | `{provider_id, error_type, error_message}` | `{ok}` |
| `/providers` | GET | — | All providers with live health status |
| `/health` | GET | — | Service health, LM Studio status, rate limits |
| `/audit` | GET | `?limit=N&task_type=X` | Recent selection log entries |
| `/config` | GET | — | Current config (no secrets) |

---

## VO Worker Integration

```python
# In any VO module that needs AI:
import httpx

def select_ai(task_type: str, input_tokens: int = 0, urgent: bool = False) -> dict:
    resp = httpx.post("http://localhost:4890/select", json={
        "task_type": task_type,
        "input_token_count": input_tokens,
        "urgent": urgent,
    }, timeout=5.0)
    resp.raise_for_status()
    return resp.json()

def report_ai_failure(provider_id: str, error_type: str, message: str):
    httpx.post("http://localhost:4890/report-failure", json={
        "provider_id": provider_id,
        "error_type": error_type,  # "rate_limit" | "timeout" | "error"
        "error_message": message,
    }, timeout=3.0)
```

Usage in `metadata_generator.py`:
```python
routing = select_ai("metadata_generation", input_tokens=len(transcript) // 4)
# routing["base_url"] and routing["api_key"] → pass directly to openai.AsyncOpenAI()
client = openai.AsyncOpenAI(
    base_url=routing["base_url"],
    api_key=routing["api_key"] or "local",
)
```

---

## CLI Shim (`~/.local/bin/ai-select`)

```bash
#!/usr/bin/env bash
# Thin wrapper around the AI Model Selector HTTP service.
# Works from Claude Code, Codex, Gemini CLI, and shell scripts.

SELECTOR_URL="${AI_SELECTOR_URL:-http://localhost:4890}"

case "${1:-}" in
  --task)
    curl -s -X POST "$SELECTOR_URL/select" \
      -H "Content-Type: application/json" \
      -d "{\"task_type\":\"$2\",\"input_token_count\":${TOKENS:-0},\"urgent\":${URGENT:-false}}" \
      | python3 -m json.tool
    ;;
  --providers)  curl -s "$SELECTOR_URL/providers" | python3 -m json.tool ;;
  --health)     curl -s "$SELECTOR_URL/health" | python3 -m json.tool ;;
  --audit)      curl -s "$SELECTOR_URL/audit?limit=${2:-20}" | python3 -m json.tool ;;
  *)
    echo "Usage: ai-select --task <task_type>"
    echo "       ai-select --providers | --health | --audit [N]"
    ;;
esac
```

---

## LaunchAgent Plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.office.ai-model-selector</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/Office/.local/video-orchestrator/.venv/bin/python3</string>
    <string>/Users/Office/.local/video-orchestrator/services/model-selector/selector_service.py</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key>
  <string>/Users/Office/.local/video-orchestrator/logs/model-selector.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/Office/.local/video-orchestrator/logs/model-selector.log</string>
</dict>
</plist>
```

---

## Audit Log Format

Every selection is appended to `~/.local/video-orchestrator/logs/ai-selections.jsonl`:

```json
{"ts":"2026-05-22T03:14:22Z","task":"metadata_generation","provider":"lmstudio-local","model":"llama-3.1-8b-instruct","reason":"local model available; batch window; cost=0.0","cost":0.0,"tokens_in":8200,"batch_window":true}
{"ts":"2026-05-22T03:14:55Z","task":"metadata_generation","provider":"lmstudio-local","model":"llama-3.1-8b-instruct","reason":"completed","latency_ms":33200,"success":true}
```

---

## Adding LM Studio Models (zero config required)

1. Download a model in LM Studio (e.g., `llama-3.1-8b-instruct-Q4_K_M`)
2. Load it in LM Studio
3. The selector's health-check polls `/v1/models` every 30s and auto-discovers the loaded model
4. No changes to `ai-providers.json` or any code

**Recommended downloads (Apple Silicon, 24 GB unified memory):**

| Model | Size | Best for |
|-------|------|---------|
| `mistral-7b-instruct-v0.3-Q4_K_M` | 4.4 GB | Headlines, SEO, small tasks |
| `llama-3.1-8b-instruct-Q4_K_M` | 5.0 GB | Metadata gen, summarization (128K context) |
| `qwen2.5-14b-instruct-Q4_K_M` | 8.5 GB | Highest local quality |
