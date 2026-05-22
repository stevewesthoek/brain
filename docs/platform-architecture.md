# Platform Architecture — Scaffold Standard

**Document type:** Platform architecture standard  
**Status:** Active — canonical scaffold for all projects  
**Last updated:** 2026-05-22 (added responsibility model, external app onboarding contract, FALA integration pattern)  
**Owner:** Steve Westhoek  
**Scope:** All projects in the brain/mind ecosystem (brain-core, FALA, video-orchestrator, ProBot, cedula, and all future apps)

---

## Philosophy

**One platform, many apps.** Every project in this ecosystem is a consumer of shared platform services, not an owner of its own copy.

Without this principle, every new project rediscovers the same problems: which AI provider to call, how to handle rate limits, how to manage API keys, how to schedule batch work. The result is duplicate logic scattered across repos, silent failures when rate limits hit, and no cost visibility across the business.

With this principle:
- AI provider selection lives in one service. Apps never hardcode a model name or API key.
- Adding a new AI provider is one JSON record. Zero code changes in any app.
- Rate limits, health checks, and batch scheduling are handled centrally.
- Every AI call is audited. Cost is visible across all apps.

**The rule:** If it involves infrastructure that two apps would otherwise duplicate, it belongs in a platform service.

---

## Responsibility Model — Who Decides What

This is the most important question when onboarding a new app: *who decides which AI model is used?*

**The answer is unambiguous:**

| Responsibility | Owner | How |
|----------------|-------|-----|
| What the task *needs* | The **app** | Declares a task type + optional constraints |
| Which provider *to use* | The **selector** | Reads provider registry + health + cost + schedule |
| Which model *on that provider* | The **selector** | Reads task type → capability → provider config |
| API keys and base URLs | The **selector** | Reads env vars; app never sees raw keys |
| Rate limit tracking | The **selector** | App reports failures; selector manages backoff |
| Fallback and retry routing | The **selector** | `previous_failures` list; selector skips failed providers |

**The app expresses intent, not preference.**

- An app that needs local inference does not ask for "Ollama" — it registers a task type with `"local_required": true`.
- An app that needs large context does not ask for "Gemini Flash" — it passes `input_token_count: 900000`.
- An app that needs fast turnaround does not ask for "GPT-4o-mini" — it passes `"urgent": true`.

The selector reads these signals and returns the best available provider right now. If the app hardcodes a provider name anywhere, that is a bug — not a feature.

### Why the app must never name a provider

Three reasons:

1. **Providers change.** API pricing, rate limits, availability, and model quality change constantly. Provider selection logic in app code rots silently.
2. **Context is missing.** The app doesn't know if LM Studio is running, if Gemini hit its quota at 2 AM, or whether it's the batch window. The selector does.
3. **Cost is invisible.** When every app routes independently, there is no single place to see total AI spend. Centralized routing = centralized cost visibility.

### Constraint expression — how apps declare what they need

Apps communicate constraints to the selector in two ways:

**1. Task type registration (permanent, per-task-class)**

Register in `~/.config/video-orchestrator/ai-task-types.json`. This record defines the default behaviour for every call of that type across all apps:

```json
{
  "task_type": "fala_conversation_response",
  "capability": "text/chat",
  "typical_input_tokens": 2000,
  "typical_output_tokens": 500,
  "latency_tolerance": "interactive",
  "local_viable": true,
  "local_required": false,
  "min_local_model_params": 7
}
```

Fields:
- `capability` — what kind of model this needs (`text/chat`, `text/medium`, `audio/transcribe`, `image/generate`, etc.)
- `latency_tolerance` — `"interactive"` (user is waiting) or `"batch"` (can defer)
- `local_viable` — can a local model handle this quality bar?
- `local_required` — must use local inference (e.g. privacy constraint, no internet)
- `min_local_model_params` — minimum model size in billions for acceptable quality

**2. Per-request runtime overrides (dynamic, per-call)**

Pass in the `/select` body to override defaults for a single call:

```json
{
  "task_type": "fala_conversation_response",
  "input_token_count": 3200,
  "urgent": true,
  "require_local": false,
  "previous_failures": ["gemini-flash"]
}
```

Fields:
- `urgent: true` — bypass batch-window deferral; use fastest available
- `require_local: true` — override task type; force local provider only
- `previous_failures: ["provider-id"]` — skip these providers this call (app-side retry)
- `input_token_count` — actual token count for this specific call (may differ from typical)

---

## Platform Services Catalog

| Service | Address | Interface | Purpose |
|---------|---------|-----------|---------|
| **AI Model Selector** | `localhost:4890` | HTTP API + CLI | Unified AI provider routing. Local-first, cost-aware, batch-aware. |
| **Brain Core** | `localhost:4877` | HTTP API | Read-only advisory: credentials, job queues, account status, console data. |
| **Brain Console** | Obsidian plugin | UI | Human control plane for all platform services. |
| **n8n** | Tailscale network | HTTP webhooks | Workflow automation, external platform dispatch. |

Each service is:
- **Independently deployable** — runs as a LaunchAgent on the Mac
- **Language-agnostic** — HTTP means any language can consume it
- **Config-driven** — behavior is changed via JSON files, not code
- **Observable** — every significant action is logged

---

## AI Model Selector — How Every App Consumes It

### The core pattern

Before any AI generation task, call `/select`. The selector returns `base_url`, `api_key`, and `model`. Pass these directly to your AI SDK. Done.

```
app code → POST /select → selector → returns {base_url, api_key, model} → app SDK
```

The app never knows which provider it got. It doesn't care. The selector handles:
- Is LM Studio running? Use it (free).
- Is it 3 AM? Prefer local/free.
- Is Gemini rate-limited? Skip it, try next.
- Does this task need a 200K context window? Only send to providers that support it.
- Did the last provider fail? Try the next one.

### HTTP API (primary — for all apps in any language)

```http
POST http://localhost:4890/select
Content-Type: application/json

{
  "task_type": "metadata_generation",
  "input_token_count": 8000,
  "urgent": false,
  "previous_failures": []
}
```

Response:
```json
{
  "provider_id": "gemini-flash",
  "model": "gemini-2.5-flash",
  "base_url": "https://generativelanguage.googleapis.com/v1beta",
  "api_key": "AIza...",
  "reason": "free; priority=2",
  "cost_estimate": 0.0
}
```

Use `base_url` + `api_key` + `model` to construct your SDK client. Example with OpenAI-compatible SDK:

```python
# Python (VO worker, FALA, any Python app)
from services.model_selector.client import select_ai, report_ai_failure

routing = select_ai('metadata_generation', input_tokens=8000)
client = openai.AsyncOpenAI(
    base_url=routing['base_url'],
    api_key=routing['api_key'] or 'local',
)
try:
    response = await client.chat.completions.create(model=routing['model'], ...)
except Exception as e:
    report_ai_failure(routing['provider_id'], 'error', str(e))
    raise
```

```typescript
// TypeScript (brain-core, FALA, any Node.js app)
import { selectAI, reportAIFailure, TASK_TYPES } from '../adapters/ai-model-selector.js';

const routing = await selectAI(TASK_TYPES.METADATA_GENERATION, { inputTokens: 8000 });
const client = new OpenAI({ baseURL: routing.baseUrl, apiKey: routing.apiKey ?? 'local' });
try {
  const result = await client.chat.completions.create({ model: routing.model, ... });
} catch (err) {
  await reportAIFailure(routing.providerId, 'error', String(err));
  throw err;
}
```

### CLI (secondary — for AI agents and shell scripts)

```bash
# Select a provider for a task
ai-select --task metadata_generation

# With token estimate
TOKENS=8000 ai-select --task metadata_generation

# Mark as urgent (bypasses batch-window deferral)
URGENT=true ai-select --task metadata_generation

# Check health
ai-select --health

# List all providers
ai-select --providers

# View recent audit log
ai-select --audit 20
```

Claude Code, Codex, and Gemini CLI all call `ai-select` directly when they need AI routing.

### Reporting failures (required)

Every app must report failures back to the selector. This feeds the rate-limit tracker:

```http
POST http://localhost:4890/report-failure
Content-Type: application/json

{
  "provider_id": "gemini-flash",
  "error_type": "rate_limit",
  "error_message": "Quota exceeded"
}
```

`error_type` values: `"rate_limit"` | `"timeout"` | `"error"`

**Why this matters:** Without failure reports, the selector will keep routing to a rate-limited provider until the state persists to disk (every 60s). Report immediately for instant failover.

---

## Task Type Registry

Task types define what capability a task requires. The selector maps task types to eligible providers.

| Task Type | Capability | Local viable | Notes |
|-----------|-----------|--------------|-------|
| `metadata_generation` | text/medium | Yes (7B+) | YouTube/social metadata |
| `thumbnail_headline` | text/small | Yes (7B+) | 3–5 word hooks |
| `seo_keyword_expansion` | text/small | Yes (7B+) | Keyword lists |
| `transcript_summarization` | text/large | Yes (8B+) | Requires large context |
| `subtitle_generation` | audio/transcribe | Yes (faster-whisper) | Local only |
| `background_image` | image/generate | Yes (LM Studio) | Local preferred |
| `description_quality_review` | text/review | No | Requires high-quality model |

**Adding a task type:** Add one record to `~/.config/video-orchestrator/ai-task-types.json`. No code changes in any app.

---

## External App Onboarding Contract

This contract applies to every external repository that uses AI — whether it is a new app you are starting today or an existing app that you are migrating off hardcoded models.

The contract is the same for all apps. FALA, ProBot, cedula, and every future app all follow this identical pattern.

### Step 1 — Audit your AI usage

Before writing any integration code, list every place in the repo where AI is called. For each call, record:

1. What is this call *doing*? (summarizing, generating, classifying, transcribing, chatting...)
2. What quality bar does it need? (good enough for a draft vs. customer-facing)
3. Can a local model handle it, or does it need a cloud model?
4. Is the user waiting for this (interactive) or is it a background task (batch)?
5. Roughly how many input tokens per call?

This audit becomes your task type list.

### Step 2 — Register your task types

For each distinct call pattern, add one record to `~/.config/video-orchestrator/ai-task-types.json`. Use a namespaced key (`fala_`, `probot_`, `cedula_`) to avoid collisions.

```json
{
  "task_type": "fala_conversation_response",
  "capability": "text/chat",
  "typical_input_tokens": 2000,
  "typical_output_tokens": 500,
  "latency_tolerance": "interactive",
  "local_viable": true,
  "local_required": false,
  "min_local_model_params": 7
}
```

Verify immediately:
```bash
ai-select --task fala_conversation_response
```
If you get a valid provider back, routing works.

### Step 3 — Install the client

**Python app:**

Copy `~/.local/video-orchestrator/services/model-selector/client.py` into your project at `src/services/ai_selector.py` (or add to your `PYTHONPATH`). No pip dependencies — uses only stdlib `urllib.request`.

```python
from src.services.ai_selector import select_ai, report_ai_failure

routing = select_ai('fala_conversation_response', input_tokens=2000)
# routing = {'provider_id': ..., 'model': ..., 'base_url': ..., 'api_key': ..., ...}
```

**TypeScript / Node.js app:**

Copy `brain/projects/brain-core/src/adapters/ai-model-selector.ts` into your project at `src/lib/ai-selector.ts`. No npm dependencies — uses built-in `fetch`.

```typescript
import { selectAI, reportAIFailure, TASK_TYPES } from './lib/ai-selector.js';

const routing = await selectAI('fala_conversation_response', { inputTokens: 2000 });
```

### Step 4 — Replace every AI call

For every AI call you found in Step 1:

**Before:**
```python
# BAD — hardcoded provider, model, and key
client = openai.OpenAI(api_key=os.environ['OPENAI_API_KEY'])
response = client.chat.completions.create(model='gpt-4o', messages=[...])
```

**After:**
```python
# GOOD — selector provides provider, model, and key
routing = select_ai('fala_conversation_response', input_tokens=len(messages) * 4)
client = openai.OpenAI(base_url=routing['base_url'], api_key=routing['api_key'] or 'local')
try:
    response = client.chat.completions.create(model=routing['model'], messages=[...])
except Exception as e:
    report_ai_failure(routing['provider_id'], 'error', str(e))
    raise
```

The OpenAI SDK works with any OpenAI-compatible base URL — this covers LM Studio, Ollama, Gemini (via compatibility layer), and the real OpenAI API.

### Step 5 — Set the environment variable

The selector URL defaults to `http://localhost:4890`. If your app runs on a different machine or in a container, set:

```bash
AI_SELECTOR_URL=http://host.docker.internal:4890
```

### Step 6 — Verify end-to-end

```bash
# Selector is running
ai-select --health

# Your task type resolves
ai-select --task your_task_type

# Run your app's AI feature once, then check the audit log
ai-select --audit 5
# You should see your task_type appear in the log
```

### Onboarding checklist (copy this into your repo's CLAUDE.md)

```markdown
## AI Model Selector integration

This repo uses the platform AI Model Selector at `http://localhost:4890`.

- [ ] All task types registered in `~/.config/video-orchestrator/ai-task-types.json`
- [ ] Client installed at `src/[services|lib]/ai_selector.[py|ts]`
- [ ] Zero hardcoded model names, API keys, or provider base URLs in application code
- [ ] Every AI call: `select_ai(task_type, ...)` before the SDK call
- [ ] Every AI failure: `report_ai_failure(provider_id, error_type)` in the except/catch block
- [ ] `AI_SELECTOR_URL` documented in `.env.example` (default: `http://localhost:4890`)
- [ ] End-to-end verified: `ai-select --audit 5` shows your task type after a live call
```

---

### What NOT to put in your repo

These things belong in the selector, not in the app:

| ❌ Do not put in app | ✅ Belongs in selector |
|---------------------|----------------------|
| Provider-specific retry logic | Provider health tracking |
| Rate limit detection and backoff | Rate limit state management |
| API key rotation | Provider key registry (`ai-providers.json`) |
| "Use Ollama if local, else OpenAI" decision | Routing algorithm |
| Cost estimation | Cost tracking and audit log |
| "If it's late, use cheap model" | Batch window logic |

If you see any of these patterns in app code during an audit, that is technical debt to remove — not to preserve.

---

## Provider Registry

Providers are registered in `~/.config/video-orchestrator/ai-providers.json`.

**Current providers (routing priority order):**

| Priority | Provider | Type | Cost/1k | Schedule | Notes |
|----------|---------|------|---------|----------|-------|
| 1 | `lmstudio-local` | openai-compatible | $0.00 | batch_window | LM Studio at `:1234` |
| 1 | `whisper-local` | whisper | $0.00 | batch_window | faster-whisper binary |
| 2 | `gemini-flash` | gemini | $0.00 | any | 1M context, free tier |
| 3 | `claude-haiku` | anthropic | $0.00025 | any | Cheapest paid |
| 4 | `openai-4o-mini` | openai | $0.00015 | any | |
| 5 | `claude-sonnet` | anthropic | $0.003 | any | Mid-tier reasoning |
| 6 | `openai-4o` | openai | $0.005 | any | |
| 7 | `claude-opus` | anthropic | $0.015 | any | Deep architecture work |

**Adding a provider:** One JSON record in `ai-providers.json`. Specify `id`, `type`, `base_url`, `api_key_env`, `cost_per_1k_tokens`, `priority`, `capabilities`, `rate_limit`. The selector picks it up on next restart.

---

## Routing Rules

The selector applies these gates in order. First provider to pass all gates is selected:

1. **Capability match** — provider must support the required capability (`text/medium`, `audio/transcribe`, etc.)
2. **Not previously failed** — skips providers in the `previous_failures` list
3. **Not rate-limited** — skips providers with an active backoff window
4. **Health check** — LM Studio polled every 30s; Whisper: binary existence check; cloud providers: always healthy
5. **Context window** — skips if `input_token_count > provider.max_context_tokens`
6. **Local model quality** — LM Studio: skips if no loaded model meets `min_local_model_params`

**Sort order:**
- Batch window (1–7 AM): free providers first, then by priority
- Outside batch window: `schedule_preference=batch_window` providers deprioritized (unless urgent)

**Deferral:** When `prefer_defer_over_paid=true` (config), non-urgent tasks that would require paid APIs outside the batch window get `scheduled_after` set to next 1:00 AM. The VO job queue respects this field.

---

## Audit and Observability

All selections are logged to `~/.local/video-orchestrator/logs/ai-selections.jsonl`:

```json
{"ts":"2026-05-22T03:14:22Z","event":"selected","task":"metadata_generation","provider":"lmstudio-local","model":"llama-3.1-8b-instruct","reason":"local model available; batch window; cost=0.0","cost":0.0,"tokens_in":8200}
```

Live queries:
```bash
ai-select --audit 20                          # last 20 selections
ai-select --health                            # service + LM Studio status
ai-select --providers                         # all providers with health
curl -s http://localhost:4890/audit?task_type=metadata_generation  # filter by task
```

---

## Infrastructure

**LaunchAgent:** `~/Library/LaunchAgents/com.office.ai-model-selector.plist`  
`RunAtLoad: true`, `KeepAlive: true` — starts on login, restarts on crash.

**Restart:**
```bash
launchctl kickstart -k gui/$(id -u)/com.office.ai-model-selector
```

**Logs:**
```bash
tail -f ~/.local/video-orchestrator/logs/model-selector.log
```

**Config files** (edit to change behavior, restart service to apply):
- `~/.config/video-orchestrator/ai-providers.json` — provider registry
- `~/.config/video-orchestrator/ai-task-types.json` — task capability matrix
- `~/.config/video-orchestrator/ai-selector-config.json` — batch window, defer preference

---

## Naming Clarification

There are three things in this system that could be confused with each other. They are completely unrelated:

| Name | Location | Purpose |
|------|---------|---------|
| **AI Model Selector** | `localhost:4890` | Routes AI API calls to the right provider (Gemini, Claude, OpenAI, local). This document. |
| **Mind Steward** | `brain/projects/mind-steward` | TypeScript library that maintains the Mind vault (captures, memories, wiki compile). Has nothing to do with AI API routing. |
| **`/model-router` skill** | `brain/ai/policy/routing.md` | Claude's internal policy for which *agent* to use (Haiku/Sonnet/Opus). Not a runtime service — a policy document. |

**When to use which name:**
- "AI Model Selector" or "the selector" — for the `:4890` HTTP service that routes AI API calls
- "Mind Steward" — for the vault maintenance TypeScript library
- "routing policy" or "/model-router skill" — for Claude's agent-selection policy

---

## References

| Resource | Path |
|----------|------|
| Provider registry | `~/.config/video-orchestrator/ai-providers.json` |
| Task types | `~/.config/video-orchestrator/ai-task-types.json` |
| Selector config | `~/.config/video-orchestrator/ai-selector-config.json` |
| Architecture detail | `brain/projects/brain-core/docs/ai-model-selector-architecture.md` |
| Routing policy | `brain/ai/policy/routing.md` |
| TypeScript client | `brain/projects/brain-core/src/adapters/ai-model-selector.ts` |
| Python client | `~/.local/video-orchestrator/services/model-selector/client.py` |
| CLI shim | `~/.local/bin/ai-select` |
| LaunchAgent | `~/Library/LaunchAgents/com.office.ai-model-selector.plist` |
| Audit log | `~/.local/video-orchestrator/logs/ai-selections.jsonl` |
| Service log | `~/.local/video-orchestrator/logs/model-selector.log` |
