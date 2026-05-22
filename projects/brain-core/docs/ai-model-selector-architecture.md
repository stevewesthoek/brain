# AI Model Selector — Architecture

**Document type:** Architecture design  
**Status:** Active  
**Last updated:** 2026-05-22 (M1 MacBook node added; Ollama replaces LM Studio; resilience model added)  
**Routing policy:** `brain/ai/policy/routing.md`  
**VO strategy:** `video-orchestrator-strategy.md`

---

## Naming Clarity (read this first)

Two things with similar-sounding names are completely unrelated:

| Name | What it is | Where |
|------|-----------|-------|
| **AI Model Selector** | Python HTTP microservice — decides which AI provider (local or cloud) to use for any task | `localhost:4890` |
| **Mind Steward** | TypeScript Brain Core project — routes Brain Core context/plan operations | `brain/projects/mind-steward/` |

When this document says "AI Model Selector" it always means the Python service at port 4890. Never confused with mind-steward.

---

## Purpose

A unified AI routing microservice that all consumers (Video Orchestrator, Claude Code, Codex, Gemini) use to select the right AI provider for any generation task. Local-first, cost-aware, schedule-aware, multi-node, fully resilient.

**Problem it solves:** Without a selector, every module hardcodes an API call to a specific provider. Adding a new provider requires touching every module. Rate limits cause silent failures. A second local machine (M1 MacBook) can't be utilized. Batch window optimization is impossible.

---

## Hardware Inventory

The AI Model Selector orchestrates inference across two local machines plus cloud APIs.

### Mac Mini M4 Pro — Primary (host machine)
- **RAM:** 24 GB unified memory
- **Storage:** 1 TB
- **Thunderbolt:** TB5 port (negotiates TB3 speed with M1 MacBook)
- **Network IP (Thunderbolt Bridge):** `192.168.100.1`
- **Ollama:** Runs locally, `localhost:11434`
- **AI Selector service:** Runs here at `localhost:4890` — orchestrates all providers

**Model capacity (M4 Pro, 24 GB):**

| Model | Size Q4_K_M | Use |
|-------|------------|-----|
| `qwen2.5:14b` | 8.5 GB | Primary — best local quality, metadata generation |
| `llama3.1:8b` | 5.0 GB | Fast tasks — headlines, keywords, small text |
| Both simultaneously | 13.5 GB | Leaves 10.5 GB headroom ✅ |

### MacBook M1 — Secondary inference node (always on)
- **RAM:** 16 GB unified memory
- **Storage:** 1 TB
- **Thunderbolt:** TB3/TB4 port
- **Network IP (Thunderbolt Bridge):** `192.168.100.2`
- **Ollama:** Runs at `0.0.0.0:11434` (accessible from M4 Pro via Thunderbolt Bridge)
- **Speed:** ~2-3× slower inference than M4 Pro — suitable for batch window / non-urgent tasks

**Model capacity (M1, 16 GB):**

| Model | Size Q4_K_M | Use |
|-------|------------|-----|
| `qwen2.5:14b` | 8.5 GB | Primary — same model as M4 Pro, batch overnight work |
| `llama3.1:8b` | 5.0 GB | Alternative when qwen is loaded |
| Both simultaneously | 13.5 GB | Leaves 2.5 GB headroom — run one at a time ⚠️ |

---

## Inference Stack — Ollama (not LM Studio)

**Ollama is the inference server on both machines.** LM Studio is not used for serving.

| Tool | Role | Where |
|------|------|-------|
| **Ollama** | Always-on headless inference server, OpenAI-compatible API | Both machines |
| **LM Studio** | Optional — only for browsing/downloading model files interactively | M4 Pro only, optional |

**Why Ollama over LM Studio for serving:**
- Runs headless as a LaunchAgent — no GUI session required
- Starts at boot automatically
- Designed for scripting and automation
- Stable for multi-process concurrent access
- LM Studio cannot reliably serve requests headless overnight

**Ollama API is OpenAI-compatible:** `POST /v1/chat/completions` — same interface the selector already uses for cloud providers.

### Thunderbolt Bridge Setup (one-time, manual)

1. Connect Mac Mini M4 Pro and MacBook M1 with Thunderbolt cable
2. Mac Mini → System Settings → Network → Thunderbolt Bridge → assign IP `192.168.100.1`, mask `255.255.255.0`
3. MacBook M1 → System Settings → Network → Thunderbolt Bridge → assign IP `192.168.100.2`, mask `255.255.255.0`
4. On M1: `launchctl setenv OLLAMA_HOST 0.0.0.0` (or set in LaunchAgent plist) — Ollama must listen on all interfaces
5. Verify from M4 Pro: `curl http://192.168.100.2:11434/api/tags`

Once the bridge is up, the AI Selector on M4 Pro reaches M1 Ollama at `http://192.168.100.2:11434`.

---

## Architecture Decision

**Standalone Python HTTP microservice at `localhost:4890`**, running on Mac Mini M4 Pro.

- Brain Core (TypeScript :4877) is read-only/advisory — adding execution routing violates its safety boundary
- VO worker is Python; HTTP works for all languages
- Claude Code, Codex, Gemini CLI cannot import Python — they need HTTP or CLI
- Coupling routing to one consumer prevents reuse across tools

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
    ai-providers.json        # Provider registry (8 providers incl. M1 Ollama node)
    ai-task-types.json       # Task capability matrix (7 task types)
    ai-selector-config.json  # Behavior config (batch window, defer, timeouts)

~/.local/video-orchestrator/state/
    rate-limits.json         # Persisted rate limit state
    circuit-breakers.json    # Circuit breaker state per provider (NEW)

~/.local/video-orchestrator/logs/
    ai-selections.jsonl      # Audit log (one JSON line per selection)
    model-selector.log       # Service stdout/stderr
```

---

## Provider Registry (`ai-providers.json`)

Nine providers. Two local Ollama nodes handle all generation tasks. Gemini Flash is **reserved exclusively for large-context batch work** (save-to-mind, knowledge graph ingestion, bulk processing) — it never appears in the generation fallback chain. After local, paid cloud escalates Anthropic-first because Claude Haiku produces better faith-based and nuanced content than GPT-4o-mini.

```json
{
  "version": 3,
  "providers": [
    {
      "id": "ollama-m4pro",
      "label": "Mac Mini M4 Pro (local)",
      "type": "openai-compatible",
      "base_url": "http://localhost:11434/v1",
      "api_key": null,
      "cost_per_1k_tokens": 0.0,
      "priority": 1,
      "capabilities": ["text/small", "text/medium", "text/large"],
      "max_context_tokens": 128000,
      "health_check": { "endpoint": "http://localhost:11434/api/tags", "method": "GET", "expect_status": 200 },
      "timeout_connect_sec": 3,
      "timeout_inference_sec": 120,
      "schedule_preference": "any",
      "preferred_models": ["qwen2.5:14b", "llama3.1:8b"]
    },
    {
      "id": "ollama-m1",
      "label": "MacBook M1 (Thunderbolt node)",
      "type": "openai-compatible",
      "base_url": "http://192.168.100.2:11434/v1",
      "api_key": null,
      "cost_per_1k_tokens": 0.0,
      "priority": 2,
      "capabilities": ["text/small", "text/medium"],
      "max_context_tokens": 32768,
      "health_check": { "endpoint": "http://192.168.100.2:11434/api/tags", "method": "GET", "expect_status": 200 },
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 180,
      "schedule_preference": "batch_window",
      "preferred_models": ["qwen2.5:14b", "llama3.1:8b"],
      "notes": "M1 MacBook on Thunderbolt Bridge. 2-3x slower than M4 Pro. Prefer for batch/overnight tasks."
    },
    {
      "id": "whisper-local",
      "type": "whisper",
      "binary": "faster-whisper",
      "cost_per_1k_tokens": 0.0,
      "priority": 1,
      "capabilities": ["audio/transcribe"],
      "health_check": { "binary_exists": "faster-whisper" },
      "schedule_preference": "any",
      "models": ["large-v3", "distil-large-v3"]
    },
    {
      "id": "gemini-flash",
      "type": "gemini",
      "base_url": "https://generativelanguage.googleapis.com/v1beta",
      "api_key_env": "GEMINI_API_KEY",
      "cost_per_1k_tokens": 0.0,
      "priority": 99,
      "capabilities": ["text/large-context-batch"],
      "max_context_tokens": 1000000,
      "rate_limit": { "requests_per_minute": 15, "requests_per_day": 1500 },
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 60,
      "schedule_preference": "any",
      "models": ["gemini-2.5-flash"],
      "notes": "RESERVED: large-context batch work only (save-to-mind, knowledge graph, bulk processing). Never used for content generation. Priority 99 ensures it never appears in generation fallback chain."
    },
    {
      "id": "claude-haiku",
      "type": "anthropic",
      "base_url": "https://api.anthropic.com/v1",
      "api_key_env": "ANTHROPIC_API_KEY",
      "cost_per_1k_tokens": 0.00025,
      "priority": 3,
      "capabilities": ["text/small", "text/medium", "text/review"],
      "max_context_tokens": 200000,
      "rate_limit": { "requests_per_minute": 50, "tokens_per_minute": 100000 },
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 30,
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
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 30,
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
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 30,
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
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 30,
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
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 30,
      "schedule_preference": "any",
      "models": ["claude-opus-4-7"]
    }
  ]
}
```

**Adding a new provider:** add one record to this file. Zero code changes.

---

## Provider Escalation Order

### Generation tasks (`text/small`, `text/medium`, `text/large`, `text/review`)

The selector works through this ladder and stops at the first passing provider:

```
1. ollama-m4pro    (local, free, fast — always preferred)
2. ollama-m1       (local, free, slower — batch window preferred)
   ── defer to next batch window if non-urgent ──
3. claude-haiku    (paid Anthropic, $0.00025/1k — cheapest, best quality for faith-based content)
4. openai-4o-mini  (paid OpenAI, $0.00015/1k — slightly cheaper, lower nuance)
5. claude-sonnet   (paid, mid-tier — when task requires higher quality)
6. openai-4o       (paid, mid-tier)
7. claude-opus     (paid, most capable — last resort)
```

**Gemini Flash is NOT in this chain.** It only matches `text/large-context-batch` tasks and is never a generation fallback.

### Large-context batch tasks (`text/large-context-batch`)

```
1. gemini-flash    (free, 1M context — save-to-mind, knowledge graph, bulk processing)
2. claude-sonnet   (paid fallback if Gemini Flash rate-limited)
```

Only tasks explicitly registering `text/large-context-batch` as their capability reach Gemini Flash. Metadata generation, thumbnail headlines, and all content generation tasks use `text/small`/`text/medium`/`text/large` — they never touch Gemini Flash.

### Audio transcription (`audio/transcribe`)

```
1. whisper-local (faster-whisper binary — always local, no cloud fallback)
```

Subtitles are always generated locally. No cloud fallback exists for transcription.

### Quality review (`text/review`)

```
1. claude-haiku    (local_viable=false for review tasks — skips Ollama entirely)
2. claude-sonnet
3. claude-opus
```

---

## Resilience Model

The selector is the critical path for all AI work. It must never cause a job to fail just because a provider is temporarily unavailable.

### Circuit Breaker (per provider)

```
CLOSED (healthy)
  │  3 consecutive failures within 5 min
  ▼
OPEN (degraded) — provider excluded from pool
  │  10 min timeout (doubles each trip: 10 → 20 → 40 min, max 2h)
  ▼
HALF-OPEN — try one request
  │ success → CLOSED
  │ failure → OPEN (double timeout)
```

State persisted to `~/.local/video-orchestrator/state/circuit-breakers.json` so service restarts don't reset it.

### Timeout Tiers

| Provider type | Connect timeout | Inference timeout |
|--------------|----------------|------------------|
| Local (same machine) | 3s | 120s |
| Local (M1 via Thunderbolt) | 5s | 180s |
| Cloud APIs | 5s | 30s |

Inference timeouts trigger `report_ai_failure()` → circuit breaker registers a failure.

### What Happens When M1 Goes Offline

1. Health check fails within 30s → M1 excluded from eligible pool
2. All tasks fall through to M4 Pro (or cloud if M4 Pro is also loaded)
3. Zero error to any caller — selector just picks next eligible provider
4. M1 comes back → health check passes → automatically re-enters pool
5. Caller never knows. This is the required behavior.

### What Happens When All Local Providers Are Down

1. Selector checks `prefer_defer_over_paid` config
2. If `true` and task is non-urgent → set job `scheduled_after = next 01:00` → return deferred signal to worker
3. If `true` and task is urgent → pay for cloud, log cost reason
4. If `false` → always use cloud (never defer)

### What Happens When Cloud API Is Rate-Limited

1. Provider marked rate-limited in `rate-limits.json`
2. Next provider in escalation ladder tried
3. If all paid providers exhausted → defer to batch window (non-urgent) or raise error (urgent)

---

## Selection Algorithm (pseudocode)

```python
def select_provider(task_type, input_token_count=0, urgent=False, previous_failures=[]):
    task_spec = TASK_TYPES[task_type]
    required_capability = task_spec["capability"]
    in_batch_window = 1 <= datetime.now().hour < 7

    eligible = [
        p for p in PROVIDERS
        if required_capability in p["capabilities"]
        and p["id"] not in previous_failures
        and not is_circuit_open(p["id"])         # NEW: circuit breaker check
        and not is_rate_limited(p["id"])
        and check_health(p)                       # timeout-bounded health check
        and fits_context(p, input_token_count)
    ]

    # Sort: free first, then by priority; batch window deprioritizes slow remote nodes
    eligible.sort(key=lambda p: (
        p["cost_per_1k_tokens"] > 0,
        p["schedule_preference"] == "batch_window" and not in_batch_window and not urgent,
        p["priority"]
    ))

    for provider in eligible:
        if is_ollama(provider):
            models = get_ollama_models(provider)  # calls /api/tags on correct host
            if not models:
                register_failure(provider["id"], "no_models_loaded")
                continue
            if not any(model_meets_task(m, task_spec) for m in models):
                continue
        return SelectionResult(provider_id=provider["id"], ...)

    # Nothing available
    if not urgent and DEFER_OVER_PAID:
        return DeferResult(scheduled_after=next_batch_window())
    raise NoProviderAvailable(task_type)
```

Key change from prior version: `is_circuit_open()` is now checked before health, which avoids hammering a known-down provider with health checks.

---

## Behavior Config (`ai-selector-config.json`)

```json
{
  "batch_window": { "start_hour": 1, "end_hour": 7 },
  "prefer_defer_over_paid": true,
  "max_defer_hours": 18,
  "urgent_tasks_use_paid": true,
  "ollama_health_check_interval_sec": 30,
  "rate_limit_state_persist_interval_sec": 60,
  "circuit_breaker": {
    "failure_threshold": 3,
    "failure_window_sec": 300,
    "open_duration_sec": 600,
    "max_open_duration_sec": 7200,
    "half_open_probe_count": 1
  }
}
```

---

## HTTP API

Running at `localhost:4890`:

| Endpoint | Method | Body/Query | Returns |
|----------|--------|------------|---------|
| `/select` | POST | `{task_type, input_token_count, urgent, previous_failures}` | `{provider_id, model, base_url, api_key, reason, cost_estimate}` or `{deferred: true, scheduled_after}` |
| `/report-failure` | POST | `{provider_id, error_type, error_message}` | `{ok}` |
| `/providers` | GET | — | All providers with live health + circuit breaker state |
| `/health` | GET | — | Service health, all node status, rate limits, circuit states |
| `/audit` | GET | `?limit=N&task_type=X` | Recent selection log entries |
| `/config` | GET | — | Current config (no secrets) |

---

## VO Worker Integration

```python
# In any VO module that needs AI (unchanged interface):
from client import select_ai, report_ai_failure

routing = select_ai("metadata_generation", input_tokens=8000, urgent=False)

if routing.get("deferred"):
    # Task was deferred — update job scheduled_after and exit
    update_job_scheduled_after(job_id, routing["scheduled_after"])
    return

client = openai.OpenAI(
    base_url=routing["base_url"],
    api_key=routing["api_key"] or "local",
)
try:
    response = client.chat.completions.create(model=routing["model"], ...)
except Exception as e:
    report_ai_failure(routing["provider_id"], "error", str(e))
    raise
```

---

## CLI Shim (`~/.local/bin/ai-select`)

```bash
#!/usr/bin/env bash
SELECTOR_URL="${AI_SELECTOR_URL:-http://localhost:4890}"

case "${1:-}" in
  --task)      curl -s -X POST "$SELECTOR_URL/select" \
                 -H "Content-Type: application/json" \
                 -d "{\"task_type\":\"$2\",\"input_token_count\":${TOKENS:-0},\"urgent\":${URGENT:-false}}" \
                 | python3 -m json.tool ;;
  --providers) curl -s "$SELECTOR_URL/providers" | python3 -m json.tool ;;
  --health)    curl -s "$SELECTOR_URL/health" | python3 -m json.tool ;;
  --audit)     curl -s "$SELECTOR_URL/audit?limit=${2:-20}" | python3 -m json.tool ;;
  *) echo "Usage: ai-select --task <type> | --providers | --health | --audit [N]" ;;
esac
```

---

## LaunchAgents (Both Machines)

### Mac Mini M4 Pro — AI Selector service
```xml
<key>Label</key><string>com.office.ai-model-selector</string>
<key>ProgramArguments</key>
<array>
  <string>/Users/Office/.local/video-orchestrator/.venv/bin/python3</string>
  <string>/Users/Office/.local/video-orchestrator/services/model-selector/selector_service.py</string>
</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
```

### Mac Mini M4 Pro — Ollama
```xml
<key>Label</key><string>com.office.ollama-m4pro</string>
<key>ProgramArguments</key>
<array>
  <string>/usr/local/bin/ollama</string>
  <string>serve</string>
</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>EnvironmentVariables</key>
<dict>
  <key>OLLAMA_HOST</key><string>127.0.0.1:11434</string>
</dict>
```

### MacBook M1 — Ollama (listens on all interfaces for Thunderbolt access)
```xml
<key>Label</key><string>com.office.ollama-m1</string>
<key>ProgramArguments</key>
<array>
  <string>/usr/local/bin/ollama</string>
  <string>serve</string>
</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>EnvironmentVariables</key>
<dict>
  <key>OLLAMA_HOST</key><string>0.0.0.0:11434</string>
</dict>
```

---

## Recommended Model Install

### Mac Mini M4 Pro
```bash
ollama pull qwen2.5:14b          # Primary — best local quality
ollama pull llama3.1:8b          # Secondary — fastest local
```

### MacBook M1
```bash
ollama pull qwen2.5:14b          # Same primary model — batch overnight work
```

---

## Audit Log Format

```json
{"ts":"2026-05-22T03:14:22Z","task":"metadata_generation","provider":"ollama-m4pro","model":"qwen2.5:14b","reason":"local ollama healthy; batch window; cost=0.0","cost":0.0,"batch_window":true}
{"ts":"2026-05-22T03:14:55Z","task":"metadata_generation","provider":"ollama-m4pro","model":"qwen2.5:14b","reason":"completed","latency_ms":28400,"success":true}
{"ts":"2026-05-22T09:30:11Z","task":"metadata_generation","provider":"ollama-m1","model":"qwen2.5:14b","reason":"m4pro circuit open; m1 available; cost=0.0","cost":0.0,"batch_window":false}
{"ts":"2026-05-22T14:02:00Z","task":"metadata_generation","provider":"claude-haiku","reason":"all local providers unavailable; non-urgent deferred to 01:00; urgent=true so using paid fallback","cost":0.00025,"batch_window":false}
{"ts":"2026-05-22T14:05:00Z","task":"large_context_batch","provider":"gemini-flash","reason":"task requires text/large-context-batch; gemini-flash is only eligible provider","cost":0.0,"batch_window":false}
```
