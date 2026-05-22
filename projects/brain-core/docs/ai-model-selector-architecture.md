# AI Model Selector — Architecture

**Document type:** Architecture design  
**Status:** Active  
**Last updated:** 2026-05-22 (dual-node load policy added)
**Routing policy:** `brain/ai/policy/routing.md`  
**VO strategy:** `video-orchestrator-strategy.md`

---

## Naming Clarity (read this first)

Two things with similar-sounding names are completely unrelated:

| Name | What it is | Where |
|------|-----------|-------|
| **AI Model Selector** | Python HTTP microservice — decides which AI provider or fallback surface to use for any task | `localhost:4890` |
| **Mind Steward** | TypeScript Brain Core project — routes Brain Core context/plan operations | `brain/projects/mind-steward/` |

When this document says "AI Model Selector" it always means the Python service at port 4890. Never confused with mind-steward.

---

## Purpose

A unified AI routing microservice that all consumers (Video Orchestrator, Claude Code, Codex, agent orchestrator, and future services) use to select the right AI provider for any generation task. Local-first, cost-aware, schedule-aware, multi-node, fully resilient.

**Problem it solves:** Without a selector, every module hardcodes an API call to a specific provider. Adding a new provider requires touching every module. Rate limits cause silent failures. A second local machine (M1 MacBook) can't be utilized. Batch window optimization is impossible.

---

## Hardware Inventory

The AI Model Selector orchestrates inference across two local machines plus nonlocal fallback surfaces.

### Mac Mini M4 Pro — Primary (host machine)
- **RAM:** 24 GB unified memory
- **Storage:** 1 TB
- **Thunderbolt:** TB5 port (negotiates TB3 speed with M1 MacBook)
- **Network IP (Thunderbolt Bridge):** `192.168.2.1`
- **Ollama:** Runs locally, `localhost:11434`
- **AI Selector service:** Runs here at `localhost:4890` — orchestrates all providers

**Model capacity (M4 Pro, 24 GB):**

| Model | Size Q4_K_M | Use |
|-------|------------|-----|
| `qwen2.5:32b` | 19.8 GB | Quality primary on M4 Pro when memory pressure is acceptable |
| `qwen2.5:14b` | 8.5 GB | Fallback quality model, metadata generation |
| `llama3.1:8b` | 5.0 GB | Fast tasks — headlines, keywords, small text |
| `bakllava:latest` | 4.7 GB | Existing local vision model, optional/manual use |

### MacBook M1 — Secondary inference node (always on)
- **RAM:** 16 GB unified memory
- **Storage:** 1 TB
- **Thunderbolt:** TB3/TB4 port
- **Network IP (Thunderbolt Bridge):** `192.168.2.2`
- **Ollama:** Runs at `0.0.0.0:11434` (accessible from M4 Pro via Thunderbolt Bridge)
- **Speed:** ~2-3× slower inference than M4 Pro — suitable for batch window / non-urgent tasks

**Model capacity (M1, 16 GB):**

| Model | Size Q4_K_M | Use |
|-------|------------|-----|
| `qwen2.5:14b` | 8.5 GB | Primary on M1, batch overnight work |
| `llama3.1:8b` | 5.0 GB | Fallback for medium tasks |
| `llama3.2:3b` | 2.0 GB | Fast fallback for small tasks |

The M1 should generally run one model at a time. It is valuable because it adds parallel overnight throughput, not because it should carry heavy interactive work.

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

**Ollama API is OpenAI-compatible:** `POST /v1/chat/completions` — same interface the selector uses for local providers.

### Thunderbolt Bridge Setup (one-time, manual)

1. Connect Mac Mini M4 Pro and MacBook M1 with Thunderbolt cable
2. Mac Mini → System Settings → Network → Thunderbolt Bridge → assign IP `192.168.2.1`, mask `255.255.255.0`
3. MacBook M1 → System Settings → Network → Thunderbolt Bridge → assign IP `192.168.2.2`, mask `255.255.255.0`
4. On M1: `launchctl setenv OLLAMA_HOST 0.0.0.0` (or set in LaunchAgent plist) — Ollama must listen on all interfaces
5. Verify from M4 Pro: `curl http://192.168.2.2:11434/api/tags`

Once the bridge is up, the AI Selector on M4 Pro reaches M1 Ollama at `http://192.168.2.2:11434`.

Codex CLI usage is plan-limited under the user's ChatGPT subscription, and Claude usage is via Amazon Bedrock. Both are modeled as providers inside `ai-providers.json`.

---

## Architecture Decision

**Standalone Python HTTP microservice at `localhost:4890`**, running on Mac Mini M4 Pro.

- Brain Core (TypeScript :4877) is read-only/advisory — adding execution routing violates its safety boundary
- VO worker is Python; HTTP works for all languages
- Claude Code, Codex CLI, and other consumers cannot import Python — they need HTTP or CLI
- Coupling routing to one consumer prevents reuse across tools

**Result:** HTTP service + thin CLI shim. Same routing logic serves all consumers.

**Consumer onboarding:** See `ai-selector-consumer-onboarding.md` for the standard repo/process integration checklist and execution contract.

---

## File Map

```
~/.local/video-orchestrator/services/model-selector/
    selector_service.py      # HTTP server (stdlib http.server)
    core.py                  # Selection algorithm (importable by VO worker directly)
    client.py                # Python client helper
    __init__.py

~/.config/video-orchestrator/
    ai-providers.json        # Provider registry (5 providers incl. M1 Ollama node)
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

Five providers. Two local Ollama nodes handle all generation tasks. Codex CLI is the second tier. Claude via Amazon Bedrock is the third tier. There is no OpenAI API fallback and no direct Anthropic API fallback in the selector.

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
      "preferred_models": ["qwen2.5:32b", "qwen2.5:14b", "llama3.1:8b"]
    },
    {
      "id": "ollama-m1",
      "label": "MacBook M1 (Thunderbolt node)",
      "type": "openai-compatible",
      "base_url": "http://192.168.2.2:11434/v1",
      "api_key": null,
      "cost_per_1k_tokens": 0.0,
      "priority": 2,
      "capabilities": ["text/small", "text/medium"],
      "max_context_tokens": 32768,
      "health_check": { "endpoint": "http://192.168.2.2:11434/api/tags", "method": "GET", "expect_status": 200 },
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 180,
      "schedule_preference": "batch_window",
      "preferred_models": ["qwen2.5:14b", "llama3.1:8b", "llama3.2:3b"],
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
      "id": "codex-cli",
      "label": "ChatGPT subscription Codex CLI",
      "type": "cli",
      "cost_per_1k_tokens": 0.0,
      "priority": 3,
      "capabilities": ["text/small", "text/medium", "text/large", "text/review"],
      "max_context_tokens": 200000,
      "health_check": { "binary_exists": "codex" },
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 300,
      "schedule_preference": "any",
      "models": ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"],
      "notes": "Local Codex CLI routing under the ChatGPT subscription. No OpenAI API use."
    },
    {
      "id": "claude-bedrock",
      "label": "Claude via Amazon Bedrock",
      "type": "bedrock",
      "cost_per_1k_tokens": 0.0,
      "priority": 4,
      "capabilities": ["text/small", "text/medium", "text/large", "text/review", "text/large-context-batch"],
      "max_context_tokens": 200000,
      "health_check": { "binary_exists": "aws" },
      "timeout_connect_sec": 5,
      "timeout_inference_sec": 300,
      "schedule_preference": "any",
      "models": ["claude-haiku", "claude-sonnet", "claude-opus"],
      "notes": "Claude Code / Bedrock surface only. No direct Anthropic API use."
    }
  ]
}
```

**Adding a new provider:** add one record to this file. Zero code changes.

---

## Provider Escalation Order

### Generation tasks (`text/small`, `text/medium`, `text/large`)

The selector works through this ladder and stops at the first passing provider:

```
1. ollama-m4pro    (local, free, fast — always preferred)
2. ollama-m1       (local, free, slower — batch window preferred)
   ── defer to next batch window if non-urgent ──
3. codex-cli       (ChatGPT subscription, no API cost)
4. claude-bedrock  (paid Bedrock fallback)
```

**There is no OpenAI API or Anthropic API fallback in this chain.** Codex CLI and Claude Bedrock are the fallback surfaces.

---

## Local Load and Scheduling Policy

The selector must protect the user's workstation during the day and use both machines aggressively during scheduled unattended windows.

### Operating Modes

| Mode | Intended use | Local load target | Routing behavior |
|------|--------------|-------------------|------------------|
| `interactive_day` | Normal daytime work, agent mode, small app tasks | Sustained local load <= 50%; short bursts up to 80% acceptable | Prefer local for light/short tasks; avoid routing sustained heavy tasks to M4 while the user is active |
| `short_burst` | Urgent local task expected to finish quickly | Up to 80% for <= 5 minutes | Allow heavier local routing if it will not make the workstation unusable for long |
| `scheduled_batch` | Office/night scheduler, video generation, bulk metadata/thumbnail work | 80-90% on both M4 and M1 | Use both local nodes concurrently and keep paid fallback last |
| `manual_heavy` | User explicitly starts heavy local work during the day | User-approved | Allow sustained local load because the user made an explicit tradeoff |

### Scheduler Rule

Bulk video work scheduled by `office-nightly-scheduler.sh` or future scheduler jobs should use both local machines simultaneously. The target is to consume roughly 80-90% of available local AI capacity during unattended windows, while keeping both machines responsive enough for health checks, logging, and recovery.

This is especially important for:
- batch metadata generation,
- thumbnail prompt generation,
- transcript summarization,
- bulk content classification,
- agent planning/review work that can run overnight.

### Daytime Rule

Local AI remains available during the day, but the selector must avoid sustained heavy pressure on the M4 workstation. A task that is expected to consume most local compute for 15 minutes should not be selected automatically during active daytime use unless it is urgent or explicitly user-approved.

Recommended daytime defaults:
- M4 Pro: light local tasks and short bursts are allowed.
- M1: safe background local tasks are allowed, but avoid long tasks if they interfere with scheduled availability.
- Heavy local tasks: defer to the next batch window when non-urgent, use Codex CLI when quality or responsiveness requires it, and use Bedrock only as the paid fallback.

### Selection Inputs To Add

The selector should eventually score expected load before picking a provider:

```json
{
  "expected_duration_sec": 900,
  "expected_load_pct": 80,
  "execution_mode": "interactive_day",
  "allow_heavy_local": false
}
```

Until runtime load telemetry exists, use task-type heuristics:
- `text/small`: light, always eligible for local.
- `text/medium`: eligible for local; avoid M4 sustained load during daytime if expected duration is high.
- `text/large`: batch-preferred unless urgent or explicitly approved.
- video/bulk tasks: `scheduled_batch` only by default.

The AI Model Selector should expose the reason in the selection response and audit log, for example: `deferred: daytime heavy local load would block workstation`.

### Large-context batch tasks (`text/large-context-batch`)

```
1. codex-cli       (if supported by the task)
2. claude-bedrock  (if supported by the task)
```

If Codex CLI is rate-limited or unavailable, the selector falls through to Claude Bedrock. The selector never uses OpenAI API or Anthropic API directly.

### Audio transcription (`audio/transcribe`)

```
1. whisper-local (faster-whisper binary — always local, no cloud fallback)
```

Subtitles are always generated locally. No cloud fallback exists for transcription.

### Quality review (`text/review`)

Review tasks use the same local → Codex CLI → Bedrock order as other AI tasks.

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
| Codex CLI / Bedrock | 5s | 300s |

Inference timeouts trigger `report_ai_failure()` → circuit breaker registers a failure.

### What Happens When M1 Goes Offline

1. Health check fails within 30s → M1 excluded from eligible pool
2. All tasks fall through to M4 Pro (or Codex/Bedrock if M4 Pro is unavailable or inappropriate for the task)
3. Zero error to any caller — selector just picks next eligible provider
4. M1 comes back → health check passes → automatically re-enters pool
5. Caller never knows. This is the required behavior.

### What Happens When All Local Providers Are Down

1. Selector checks `prefer_defer_over_paid` config
2. If `true` and task is non-urgent → set job `scheduled_after = next 01:00` → return deferred signal to worker
3. If `true` and task is urgent → use Codex CLI first, then Bedrock if needed; log the reason
4. If `false` → use Codex CLI or Bedrock instead of deferring

### What Happens When Codex CLI or Bedrock Is Rate-Limited

1. Provider marked rate-limited in `rate-limits.json`
2. Next provider in escalation ladder tried
3. If all nonlocal fallback surfaces are exhausted → defer to batch window (non-urgent) or raise error (urgent)

---

## Selection Algorithm (pseudocode)

```python
def select_provider(task_type, input_token_count=0, urgent=False, previous_failures=[]):
    task_spec = TASK_TYPES[task_type]
    required_capability = task_spec["capability"]
    in_batch_window = 1 <= datetime.now().hour < 7
    execution_mode = infer_execution_mode(task_spec, urgent, in_batch_window)

    eligible = [
        p for p in PROVIDERS
        if required_capability in p["capabilities"]
        and p["id"] not in previous_failures
        and not is_circuit_open(p["id"])         # NEW: circuit breaker check
        and not is_rate_limited(p["id"])
        and check_health(p)                       # timeout-bounded health check
        and fits_context(p, input_token_count)
        and fits_load_policy(p, task_spec, execution_mode)
    ]

    # Sort: free first, then by priority; daytime protects the workstation from sustained load
    eligible.sort(key=lambda p: (
        p["cost_per_1k_tokens"] > 0,
        p["schedule_preference"] == "batch_window" and not in_batch_window and not urgent,
        sustained_daytime_load_penalty(p, task_spec, execution_mode),
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
  "local_load_policy": {
    "interactive_day_max_sustained_load_pct": 50,
    "short_burst_max_load_pct": 80,
    "short_burst_max_duration_sec": 300,
    "scheduled_batch_target_load_pct": 85,
    "scheduled_batch_max_load_pct": 90,
    "defer_heavy_local_daytime": true
  },
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
ollama pull qwen2.5:32b          # Quality primary when memory pressure is acceptable
ollama pull qwen2.5:14b          # Fallback quality model
ollama pull llama3.1:8b          # Secondary — fastest local
```

### MacBook M1
```bash
ollama pull qwen2.5:14b          # Same primary model — batch overnight work
ollama pull llama3.1:8b          # Medium fallback
ollama pull llama3.2:3b          # Fast fallback
```

---

## Audit Log Format

```json
{"ts":"2026-05-22T03:14:22Z","task":"metadata_generation","provider":"ollama-m4pro","model":"qwen2.5:32b","reason":"scheduled_batch; local ollama healthy; load target 85%; cost=0.0","cost":0.0,"batch_window":true}
{"ts":"2026-05-22T03:14:23Z","task":"metadata_generation","provider":"ollama-m1","model":"qwen2.5:14b","reason":"scheduled_batch; second local node available; parallel bulk work; cost=0.0","cost":0.0,"batch_window":true}
{"ts":"2026-05-22T03:14:55Z","task":"metadata_generation","provider":"ollama-m4pro","model":"qwen2.5:32b","reason":"completed","latency_ms":28400,"success":true}
{"ts":"2026-05-22T09:30:11Z","task":"metadata_generation","provider":"ollama-m1","model":"qwen2.5:14b","reason":"m4pro circuit open; m1 available; cost=0.0","cost":0.0,"batch_window":false}
{"ts":"2026-05-22T14:02:00Z","task":"bulk_video_metadata","provider":"none","reason":"deferred; daytime heavy local load would block workstation; scheduled_after=2026-05-23T01:00:00","cost":0.0,"batch_window":false}
{"ts":"2026-05-22T14:05:00Z","task":"large_context_batch","provider":"codex-cli","reason":"local models insufficient for context; Codex CLI available; no direct API use","cost":0.0,"batch_window":false}
```
