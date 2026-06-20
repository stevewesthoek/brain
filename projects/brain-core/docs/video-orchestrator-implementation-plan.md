# Video Orchestrator — Implementation Plan

**Document type:** Executable implementation plan  
**Status:** Active  
**Last updated:** 2026-06-19 (Sprint 1W complete — live YouTube publication confirmed; videoId S_-0WpH7Bgc)
**Roadmap reference:** `video-orchestrator-roadmap.md`  
**Strategy reference:** `video-orchestrator-strategy.md`  
**AI Selector architecture:** `ai-model-selector-architecture.md`

---

## Completion Status

**Current AI Model Selector provider policy:**
- Claude Code via Amazon Bedrock is supported.
- Codex CLI is supported.
- Approved AI Model Selector routes are supported.
- Gemini is disabled and is not part of the current stack.
- Direct Anthropic API and direct OpenAI API calls remain disallowed where applicable.

The historical Gemini-first Phase 0.5R work below is retained only as implementation history and is not the active provider policy.

| Sprint | Phase | Status |
|--------|-------|--------|
| Sprint 0A — AI Selector v1 | Phase 0.5 | ✅ Complete |
| Sprint 0B — Dual-Node + Resilience | Phase 0.6 | ✅ Complete |
| Sprint 0D — Historical Gemini-First Selector Policy | Phase 0.5R | ⛔ Superseded; Gemini disabled |
| Sprint 0C — Brain Agent Orchestrator | Phase 0.7 | ⏳ Continue after selector policy alignment |
| Sprint 0E — Normalized VO Studio Read Model | Phase 0.8 | ✅ Complete |
| Sprint 0F — Brain Console VO Shell | Phase 0.9 | ✅ Complete |
| Sprint 1 — Composition | Phase 1 | ✅ Complete |
| Sprint 2 — Subtitles | Phase 2 | ✅ Complete |
| Sprint 3 — Thumbnails | Phase 3 | ✅ Complete (UI carry-over) |
| Sprint 4 — SEO Metadata | Phase 4 | ✅ Complete (UI carry-over) |
| Sprint 5 — Analytics | Phase 5 | ✅ Complete (UI carry-over) |
| Sprint 6 — Moving-Video-to-YouTube Approval Workflow | Phase 1W | ✅ Complete |
| Sprint 7 — Multi-Platform | Phase 6 | 🔲 Future |
| Sprint 8 — Hardening | Phase 7 | 🔲 Future |

---

## Small-Agent Task Contract

Every implementation task in this plan must be executable by Codex Mini or Claude Code Haiku.

Required task shape:
- One clear goal.
- One owner boundary: selector, Brain Core API, Brain Console UI, worker, or docs.
- Explicit files allowed to change.
- Explicit files not allowed to change.
- No credential printing, no secret reads unless the task is specifically a credential-status read with redaction.
- No external platform mutation unless the task is explicitly an approved adapter-write task.
- Tests or verification commands listed before implementation starts.
- Done means code, tests, docs, and guardrail checks all match the strategy.

Default verification:
- Docs-only: `git diff --check` plus stale-phrase `rg` checks.
- Brain Core API/types: `npm run build` and focused `node --test dist/tests/<test>.js`.
- Brain Console UI: `npm run typecheck && npm run build`; use browser screenshot checks when visual layout changes.
- Selector Python: focused unit tests or deterministic CLI dry runs; never print API keys.

---

## Sprint 0D: Historical Gemini-First Selector Policy (Phase 0.5R) ⛔ Superseded

This historical experiment is no longer an active implementation requirement. Gemini is disabled and is not part of the current stack. Historical provider registration, quota-ledger behavior, and Gemini-first routing tests have been removed from the active plan to avoid implying current support.

**Current provider policy:**
- Claude Code via Amazon Bedrock is supported.
- Codex CLI is supported.
- Approved AI Model Selector routes are supported.
- Gemini is disabled and is not part of the current stack.
- Direct Anthropic API and direct OpenAI API calls remain disallowed where applicable.

---

## Sprint 0E: Normalized VO Studio Read Model (Phase 0.8) 🔲 Starting

**Purpose:** Expose canonical read APIs for the Brain Console VO surfaces.

**Boundary:** Brain Core read adapters, types, routes, and tests only. No worker changes. No UI mutation controls. No platform writes.

### Task 0E-A — TypeScript DTO Definitions ✅

**Files:**
- `projects/brain-core/src/types/vo-studio.ts` — 15 DTOs + wire format helpers
- `projects/brain-core/src/tests/vo-studio-types.test.ts` — 7-test suite

**Implemented:**
- Project, BrandProfile, PlatformAccount, PlatformSpec, FormatSpec
- PipelineProfile, ContentItem, ProductionPackage, ArtifactVariant
- PostingTarget, PostingJob, PerformanceSnapshot, Approval, AuditEvent
- Health/status types: WorkerHealth, SelectorHealth, VOStudioHealth
- Response wrapper types for all read endpoints
- Wire format converters: projectFromWire, platformAccountFromWire, contentItemFromWire, packageFromWire
- Comprehensive tests for snake_case → camelCase conversion, optional field defaults, nested array handling

**Tests:**
- ✅ Snake case conversion works correctly
- ✅ Optional fields handled with proper defaults
- ✅ Language defaults to 'en'
- ✅ Nested artifacts/approvals converted correctly
- ✅ Empty nested arrays handled
- ✅ All status type literals valid
- ✅ 7/7 tests pass

### Task 0E-B — Fixture-backed Read Adapters ✅

**Files:**
- `projects/brain-core/src/adapters/vo-studio-fixtures.ts` — complete fixture dataset
- `projects/brain-core/src/adapters/vo-studio-read.ts` — 9 read adapter functions
- `projects/brain-core/src/tests/vo-studio-read.test.ts` — 22-test comprehensive suite

**Implemented:**
- Realistic fixture data: 1 brand, 1 project, 3 platforms, 2 formats, 3 accounts, 2 pipelines, 3 content items, 1 complete package
- Read adapters:
  - `getProjects()` — all projects + brands
  - `getAccounts(projectId)` — filtered accounts + platforms
  - `getPipelineProfiles(projectId)` — pipelines + formats
  - `getContentItems(projectId, limit, offset)` — paginated items
  - `getContentItem(projectId, itemId)` — single item
  - `getPackage(projectId, packageId)` — package with nested artifacts/approvals/targets/events
  - `getAccountAdapterMode(projectId, accountId)` — adapter mode + credential state
  - `getAccountQuotaState(projectId, accountId)` — quota remaining + reset time

**Tests:**
- ✅ Projects/brands returned with correct data
- ✅ Snake_case → camelCase conversion verified
- ✅ Accounts filtered by project, platforms exposed
- ✅ Adapter modes: direct, n8n-dispatch, manual-only
- ✅ Credential states: configured, missing, invalid, expired
- ✅ Quota state exposed (YouTube: 9500 remaining; Facebook: null)
- ✅ Pipeline profiles and formats returned
- ✅ Content items paginated with limit/offset
- ✅ Package with nested artifacts, approvals, posting targets, audit events
- ✅ All queries return null for non-existent items
- ✅ Project ID filtering works correctly
- ✅ 22/22 tests pass

### Task 0E-C — Read Routes with Summary & Safety ✅

**Files:**
- `projects/brain-core/src/adapters/vo-studio-read-routes.ts` (165 lines) — 6 route adapters
- `projects/brain-core/src/tests/vo-studio-read-routes.test.ts` (193 lines) — 15-test suite

**Route adapters:**
- `readVOStudioProjects()` → `GET /video-orchestrator/projects`
- `readVOStudioAccounts(projectId)` → `GET /video-orchestrator/accounts?projectId=...`
- `readVOStudioPipelineProfiles(projectId)` → `GET /video-orchestrator/pipeline-profiles?projectId=...`
- `readVOStudioContentItems(projectId, limit, offset)` → `GET /video-orchestrator/content-items?projectId=...&limit=50&offset=0`
- `readVOStudioPackage(projectId, packageId)` → `GET /video-orchestrator/packages/:id`
- `readVOStudioAnalyticsSummary(projectId)` → `GET /video-orchestrator/analytics/summary?projectId=...`

**Response contract:**
- All responses include: `id`, `generatedAt`, `items` or data, `summary` (counts), `safety` metadata, `nextSafeStep`
- Safety metadata: readOnly=true, no file writes, no platform calls, no scheduling
- Pagination: `limit`, `offset`, `total`, `hasMore`
- Metadata: platform specs, format specs, status breakdowns

**Tests:**
- ✅ Projects response with summary counts
- ✅ Accounts with platform specs and adapter mode counts
- ✅ Accounts uses default projectId fallback
- ✅ Pipeline profiles with format specs
- ✅ Content items paginated with limit/offset
- ✅ Package lookup by ID
- ✅ Analytics summary with statistics
- ✅ All responses include safety metadata (readOnly=true)
- ✅ All responses include nextSafeStep guidance
- ✅ Summary counts match actual item status
- ✅ Pagination hasMore flag accurate
- ✅ Platforms/formats metadata present
- ✅ 15/15 tests pass

**Routes now ready for:** Brain Console UI to call via `/api/video-orchestrator/*` endpoints

Remaining tasks:
- 0E-D: Wire routes into Brain Core HTTP router (if not already done).
- 0E-E: Create API contract tests proving all routes return correct shape.
- 0E-F: Update Brain Console to consume read routes instead of STB-specific branches.

Done when:
- All six routes return typed JSON from fixtures.
- STB is represented as one Project, not a special route or UI branch.
- Tests prove adapter mode, credential state, quota state, and manual fallback capability are exposed for accounts/targets.

---

## Sprint 0F: Brain Console VO Shell (Phase 0.9) 🔲 Active Next

**Purpose:** Build the read-only operator interface from canonical VO read APIs.

**Boundary:** Brain Console UI and client types only. No mutation buttons. No worker changes. No platform writes.

Atomic tasks:
- 0F-A: Global VO context bar with Project, Account, Platform Targets, Pipeline Profile, Date Range. ✅ Complete
- 0F-B: Overview panel with worker/selector health, active jobs, blockers, quota/credential warnings, scheduled/published/failed counters. ✅ Complete
- 0F-C: Pipelines panel with stage map, run history table, detail drawer, logs/dead-letter summary. ✅ Complete
- 0F-D: Accounts panel with platform account cards, adapter status, quota, scheduler policy, enabled profiles. ✅ Complete
- 0F-E: History/Analytics table with project/account/platform/status filters. ✅ Complete

Done when:
- `npm run typecheck && npm run build` passes.
- The UI can render fixture/read API data for all five canonical surfaces.
- No UI card duplicates a project-specific thumbnail generator, SEO editor, or project-specific pipeline.

---

## Sprint 0B: Dual-Node AI Selector + Resilience (Phase 0.6) ✅

**Status:** Complete. The selector now has two Ollama nodes, Codex/Bedrock fallback policy, timeout tiers, circuit breaker behavior, deferred-result handling, and scheduler health checks documented and implemented.

### Hardware reference
- **Mac Mini M4 Pro:** 24 GB RAM, primary machine, runs AI Selector at `localhost:4890`, Ollama at `localhost:11434`
- **MacBook M1:** 16 GB RAM, always-on secondary node, Ollama at `192.168.2.2:11434` (Thunderbolt Bridge)
- **Inference ranking:** M4 Pro is 2-3× faster. M4 Pro = any-time; M1 = batch window preferred

### Task A — Thunderbolt Bridge (manual, one-time on both machines) ✅
1. Mac Mini M4 Pro: System Settings → Network → Thunderbolt Bridge → IP `192.168.2.1`, mask `255.255.255.0`
2. MacBook M1: System Settings → Network → Thunderbolt Bridge → IP `192.168.2.2`, mask `255.255.255.0`
3. MacBook M1: set env var `OLLAMA_HOST=0.0.0.0` before Ollama starts (LaunchAgent plist)
4. Verify: `curl http://192.168.2.2:11434/api/tags` from M4 Pro terminal

**Done when:** curl returns JSON list of Ollama models from M4 Pro targeting M1's IP.

---

### Task B — Install Ollama on both machines + pull models ✅
**Mac Mini M4 Pro:**
```bash
brew install ollama
ollama pull qwen2.5:32b      # quality primary on M4 Pro
ollama pull qwen2.5:14b      # fallback
ollama pull llama3.1:8b      # fast tasks, headlines
```

**MacBook M1:**
```bash
brew install ollama
ollama pull qwen2.5:14b      # primary on M1
ollama pull llama3.1:8b      # fallback
ollama pull llama3.2:3b      # fast fallback
```

**LaunchAgents to create:**
- `~/Library/LaunchAgents/com.office.ollama-m4pro.plist` — starts Ollama at boot on M4 Pro (`OLLAMA_HOST=127.0.0.1:11434`)
- `~/Library/LaunchAgents/com.office.ollama-m1.plist` — starts Ollama at boot on M1 (`OLLAMA_HOST=0.0.0.0:11434`)

See LaunchAgent plist templates in `ai-model-selector-architecture.md`.

**Done when:** `ollama list` shows models on both machines; `launchctl list | grep ollama` shows both agents running.

---

### Task C — Update `ai-providers.json` ✅
**File:** `~/.config/video-orchestrator/ai-providers.json`

Replace the existing `lmstudio-local` provider entry with two Ollama provider entries:

```json
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
  "preferred_models": ["qwen2.5:14b", "llama3.1:8b", "llama3.2:3b"]
}
```

**Done when:** `ai-select --providers` lists both Ollama providers with their health status.

---

### Task D — Circuit breaker in `core.py` ✅
**File:** `~/.local/video-orchestrator/services/model-selector/core.py`

Add `CircuitBreaker` class with state machine: `closed` → `open` (after 3 failures in 5 min) → `half-open` (after timeout) → `closed` (on success) or back to `open` (on failure).

```python
class CircuitBreaker:
    def is_open(self, provider_id: str) -> bool: ...
    def register_failure(self, provider_id: str): ...
    def register_success(self, provider_id: str): ...
    def save_state(self): ...   # writes circuit-breakers.json
    def load_state(self): ...   # reads circuit-breakers.json on startup
```

State file: `~/.local/video-orchestrator/state/circuit-breakers.json`

In `select_provider()`, add circuit breaker check before health check:
```python
if circuit_breaker.is_open(provider["id"]):
    continue
```

**Done when:** If Ollama on M1 is stopped, M1 is excluded from selection within 3 failed attempts. When M1 restarts, it re-enters the pool automatically within 10 min.

---

### Task E — Timeout tiers in `core.py` ✅
**File:** `~/.local/video-orchestrator/services/model-selector/core.py`

Read `timeout_connect_sec` and `timeout_inference_sec` from provider config. Use `socket.setdefaulttimeout()` or per-request timeout when calling health check endpoints and when returning provider info to callers.

For health checks: use `timeout_connect_sec` (short — just testing reachability).  
For inference: `timeout_inference_sec` is returned to callers in the `SelectionResult` so the caller (VO worker) sets the correct timeout on the actual inference request.

**Done when:** Health check to an unreachable M1 fails in ≤5s. Worker uses 180s timeout for M1 inference calls.

---

### Task F — Deferred result in `core.py` + worker handler ✅
**File:** `~/.local/video-orchestrator/services/model-selector/core.py`

When no eligible provider is found and task is non-urgent and `prefer_defer_over_paid=true`:
```python
return {"deferred": True, "scheduled_after": next_batch_window_iso()}
```

**File:** `~/.local/video-orchestrator/worker/video_worker.py`

In every job executor that calls `select_ai()`, check for deferred result:
```python
routing = select_ai("metadata_generation", input_tokens=8000, urgent=False)
if routing.get("deferred"):
    update_job_scheduled_after(conn, job_id, routing["scheduled_after"])
    return  # clean exit, job will retry at scheduled time
```

**Done when:** With all local providers stopped and `prefer_defer_over_paid=true`, queuing a metadata job defers it to the next 01:00 batch window instead of using Codex CLI or Bedrock for non-urgent work.

---

### Task G — Nightly scheduler health check for M1 ✅
**File:** `tools/scripts/office-nightly-scheduler.sh`

Before queuing batch jobs, verify M1 is reachable:
```bash
if ! curl -sf --max-time 5 http://192.168.2.2:11434/api/tags > /dev/null; then
  echo "[scheduler] WARNING: M1 MacBook Ollama unreachable — batch jobs will use M4 Pro or Codex/Bedrock fallback"
fi
```

This is a warning only — batch window still proceeds. The selector handles fallback.

**Done when:** Nightly scheduler logs M1 status before batch jobs start.

---

### Sprint 0B Definition of Done

- `ai-select --health` shows both Ollama nodes with status (healthy/degraded/offline)
- `ai-select --task metadata_generation` routes to Gemini free-tier first for eligible non-sensitive text once the 2026-05-24 policy follow-up is implemented
- `ai-select --task metadata_generation` routes to `ollama-m4pro` for sensitive/offline tasks and Gemini fallback
- `ai-select --task metadata_generation` routes to `ollama-m1` during batch window (1–7 AM) when M4 Pro is loaded or Gemini/local policy selects the secondary node
- Stopping Ollama on M1 → within 30s, `--health` shows M1 as degraded; tasks stop routing there
- Restarting Ollama on M1 → within 10 min, M1 re-enters the pool
- No Codex CLI or Bedrock fallback used when Gemini/local providers are healthy, allowed, quota-available, and capable

---

## Sprint 0C: Brain Agent Orchestrator (Phase 0.7) 🔲

**Purpose:** Add agent mode as a Brain Core orchestration layer that can coordinate full-project work across Gemini free-tier where eligible, local Ollama for privacy/offline and fallback work, Codex CLI, Amazon Bedrock Claude, the Brain skill layer, and infrastructure CLIs.

**Research basis:** `agent-orchestrator-research-2026-05-22.md`

**Boundary rule:** Do not put this inside the AI Model Selector. The selector routes LLM execution. The Agent Orchestrator owns planning, task graph, run state, skill/CLI capability discovery, approvals, and handoffs.

### Task 0C-A — Architecture contract ✅
**Files:**
- `projects/brain-core/docs/agent-orchestrator-architecture.md`
- `projects/brain-core/docs/agent-orchestrator-research-2026-05-22.md`

Define:
- agent roles and responsibilities,
- capability registry schema,
- task graph/run ledger schema,
- approval classes,
- selector/executor contract,
- Brain Console surfaces.

**Done:** `agent-orchestrator-architecture.md` defines the layer boundary, provider policy, roles, capability registry schema, run ledger, task graph, approval model, executor contract, and first implementation slice.

---

### Task 0C-B1 — Static Agent Capability Registry adapter ✅
**Scope:** Small, self-contained, read-only Brain Core change. No shell execution, no provider calls, no file writes outside the repo.

**Files to add or update:**
- Add `projects/brain-core/src/adapters/agent-capabilities.ts`
- Add `projects/brain-core/src/tests/agent-capabilities.test.ts`

**Implement:**
- Export type `AgentCapabilitySummary`
- Export function `listAgentCapabilities(): AgentCapabilitySummary[]`
- Return static seed records for:
  - `skill.code`
  - `skill.design`
  - `skill.research`
  - `skill.web`
  - `skill.video`
  - `ai.gemini-free`
  - `ai.ollama-m4pro`
  - `ai.ollama-m1`
  - `ai.codex-cli`
  - `ai.claude-bedrock`
  - `cli.cloudflare`
  - `cli.dokploy`
  - `cli.aws`
  - `cli.azure`
  - `cli.github`
- Each record must include:
  - `id`
  - `kind`: `skill | cli | ai_surface | service | workflow`
  - `label`
  - `source`
  - `description`
  - `safetyClass`: `read_only | local_write | repo_write | external_state | credential_sensitive | destructive | financial`
  - `requiresApprovalFor`
  - `preferredAiTaskTypes`
  - `verification`
  - `enabled`

**Tests:**
- Ensure `listAgentCapabilities()` returns all required ids.
- Ensure every id is unique.
- Ensure every record has a non-empty `label`, `description`, `safetyClass`, and `verification` array.
- Ensure external-state CLIs require approval for at least one of `deploy`, `dns_change`, `external_state`, or `credential_sensitive`.
- Ensure AI surfaces are ordered by selector policy if a `priority` field is added: Gemini free-tier for eligible text first, local Ollama first for sensitive/offline and fallback work, Codex CLI next, Bedrock paid fallback last.

**Do not do in this task:**
- Do not add HTTP routes.
- Do not add a CLI.
- Do not call `ai-select`.
- Do not scan the filesystem dynamically.
- Do not implement run ledger or approvals.

**Done:** `npm run build` and `node --test dist/tests/agent-capabilities.test.js` pass from `projects/brain-core`.

---

### Task 0C-B2 — Skill frontmatter discovery ✅
**Scope:** Replace or enrich the static skill records with read-only parsing of known `SKILL.md` frontmatter.

**Files:** Extend `projects/brain-core/src/adapters/agent-capabilities.ts` and tests.

**Inputs:**
- `ai/skills/custom/code/SKILL.md`
- `ai/skills/custom/design/SKILL.md`
- `ai/skills/custom/research/SKILL.md`
- `ai/skills/custom/web/SKILL.md`
- `ai/skills/custom/video/SKILL.md`

**Done:** The five skill capability records use live frontmatter name/description when available and gracefully fall back to static data when a file is missing.

---

### Task 0C-B3 — CLI capability manifest ✅
**Scope:** Keep CLI capability discovery static and explicit first.

**Files:** Add `projects/brain-core/src/adapters/agent-cli-capability-manifest.ts` or equivalent.

**CLIs to cover:** Cloudflare, Dokploy, AWS, Azure, GCP, Hetzner, Tailscale, Stripe, n8n, GitHub.

**Done:** CLI records are normalized into the same `AgentCapabilitySummary` shape and clearly mark approval requirements.

---

### Task 0C-B4 — AI Selector surface adapter ✅
**Scope:** Read-only, timeout-safe adapter for AI Model Selector provider data.

**Files:** Extend `projects/brain-core/src/adapters/agent-capabilities.ts` or add a helper adapter.

**Behavior:**
- Try `GET http://localhost:4890/providers` with a short timeout.
- Convert returned providers into `ai_surface` capability records.
- If the selector is unavailable, return static fallback AI surface records and include a warning field.

**Done:** Tests cover both healthy JSON provider input and selector-unavailable fallback.

---

### Task 0C-B5 — Brain Core endpoint ✅
**Scope:** Expose the normalized registry over HTTP.

**Files:**
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/tests/routes.test.ts` or focused route test

Endpoint:
```text
GET /api/agent/capabilities
```

**Compatibility note:** Existing `/capabilities` must remain unchanged. The new endpoint is additive.

**Done:** Endpoint returns `{ capabilities: [...] }`, is localhost-only like all Brain Core routes, and tests pass.

---

### Task 0C-B6 — CLI smoke command ✅
**Scope:** Add a thin local command that calls the endpoint.

Command:
```text
brain-agent capabilities
```

**Done:** The command prints normalized JSON and exits nonzero if Brain Core is unavailable.

---

### Task 0C-C — Run ledger and task graph ⏳ IN PROGRESS
**In progress:** Read-only ledger and task graph snapshot endpoints are now exposed in Brain Core.
**Implemented so far:** `/agent-ledger`, `/agent-task-graph`, and `/agent-task-state` return derived or persisted read-only snapshots, and Brain Core can now write and reload append-only JSON snapshots for ledger/task-state records.
**Still next:** executor selection records, approval-bound mutation flow, and console visibility for live agent runs.

---

### Task 0C-C — Run ledger and event log
Persist:
- run id, goal, repo, status,
- task graph nodes and dependencies,
- selected skill/CLI/executor,
- selected model/provider from AI Model Selector,
- commands run,
- files touched,
- approvals requested/approved/rejected,
- verification output,
- unresolved risk.

**Done when:** A dry-run plan can be recorded and resumed without performing mutations.

---

### Task 0C-D — Selector-aware executor adapter ⏳ IN PROGRESS
Rules:
- Gemini free-tier first for eligible non-sensitive text tasks while quota remains,
- local Ollama M4/M1 first for sensitive/private/offline tasks and as Gemini quota/health/quality fallback,
- Codex CLI next for subscription-backed work when Gemini/local quality is insufficient or lower-cost providers are unavailable/rate-limited,
- Amazon Bedrock Claude last as paid fallback,
- no direct OpenAI API,
- no direct Anthropic API.

**Implemented so far:** Brain Core can derive and inspect a read-only executor plan from the task graph and task state, and it can persist/reload a snapshot JSON for that plan.
**Still next:** executor-selection mutation flow, approval-bound execution gating, and live console visibility.

**Done when:** A dry-run plan records which executor would handle each task and why.

---

### Task 0C-E — Approval gates ✅ COMPLETE
Approval required for:
- file writes,
- commits and pushes,
- deploys,
- DNS changes,
- database mutations,
- destructive shell commands,
- credential-sensitive commands,
- memory or decision-log writes.

**Done:** Brain Core now exposes a read-only approval-gate surface that records approval store state, counts, supported kinds, blocked kinds, and a next safe step. Approval mutation remains in the existing approval routes.

---

### Task 0C-F — Brain Console Agent View ✅ COMPLETE
Show:
- active runs,
- task graph,
- selected providers/executors,
- running CLI actions,
- blocked approval requests,
- verification results,
- final summary and handoff.

**Done:** Brain Console now shows a read-only agent console panel powered by the aggregated `/agent-console` surface with active runs, task graph, executor selections, approval gates, and handoff summary.

---

### Sprint 0C Definition of Done

- `brain-agent capabilities` returns registered skills, CLI capabilities, and AI execution surfaces.
- `GET /api/agent/capabilities` returns the same normalized registry.
- A dry-run agent plan can be created, recorded, resumed, and inspected.
- No autonomous file write, deploy, DNS, DB, credential, or destructive operation is possible without an approval record.

---

## Sprint 6: Moving-Video-to-YouTube Approval Workflow (Phase 1W) ⏳ Current

**Purpose:** Complete one end-to-end workflow for real moving-video inputs through approval, packaging, queueing, and direct YouTube upload.

**Boundary:** Execute only the ordered Phase 1W tasks needed for the moving-video-to-YouTube path. Brain Core adapters, routes, audit records, focused tests, and the minimum Brain Console controls required by each task are allowed. Slideshow generation, non-YouTube adapters, unrelated hardening, broad UI redesign, and opportunistic cleanup are out of scope.

**Execution rule:** Work on one task at a time. Before implementation, confirm its current code status and allowed files. After implementation, run the documented focused validation, review the result against this plan and the roadmap, and wait for operator confirmation before marking it complete or starting the next task.

### Task 1W-A — Create Content Item 📋 Legacy contract implemented

**Status:** Implemented for the existing audio-plus-image content contract only; it does not yet register a real moving-video source.

**Scope:** Small, self-contained Brain Core write. Validation, approval routing, unique ID generation.

**Files:**
- `projects/brain-core/src/adapters/vo-studio-write.ts`
- `projects/brain-core/src/tests/vo-studio-write.test.ts`
- `projects/brain-core/src/api/routes.ts`

**Implemented contract:** `POST /api/video-orchestrator/content-items/create` validates input, creates an approval record, and returns an approval ID plus preview using `sourceAudioPath` and `backgroundImagePath`.

### Task 1W-B — Audit Tasks 1W-A Through 1W-I Against Current Code ✅ Complete

**Status:** Audit complete. Task 1W-C is the first genuinely missing moving-video-to-YouTube implementation task.

**Output:** A factual status table for Tasks 1W-A through 1W-I, exact file evidence, focused validation commands, and the first genuinely missing implementation task. No code changes.

### Task 1W-C — Moving-Video Intake and Content Update ✅ Complete

**Status:** Implemented, focused validation passed with 66/66 tests, and operator-confirmed. Real moving-video sources can be registered and updated through the approval boundary without slideshow inputs while preserving the legacy audio/image contract.

Confirm that a real moving-video source can be selected or registered without slideshow generation, and that required content metadata can be updated through the approval boundary.

### Task 1W-D — Generate Thumbnail Variants ✅ Complete

**Status:** The repo-owned FFmpeg worker generates two real 1280×720 JPEG artifacts, the adapter validates JPEG structure and dimensions before accepting them, and the approval-gated route attaches the first two outputs as `variant_a` and `variant_b` to the moving-video content item. Focused validation passed: thumbnail queue 5/5, thumbnail route 19/19, and TypeScript typecheck.

**Implementation:**

**Worker Contract** — CLI entry point: `~/.local/video-orchestrator/worker/cli_thumbnail_designer_basic.py`
- Input: JSON on stdin with schema: `{episode_id, title, background_image_url, template_definition, color_scheme, platform?}`
- Output: JSON on stdout with schema: `{status: "completed"|"failed", job_id, episode_id, variants: [{variant_id, url, confidence_score, ...}], error_message?}`
- Exit code: 0 on success, 1 on failure
- Guarantees:
  - Two real JPEG image files generated per request
  - Files created at `~/.local/video-orchestrator/artifacts/thumbnails/{episode_id}_v{N}.jpg`
  - Files verified to exist before returning success
  - No synthetic S3 URLs returned

**TypeScript Adapter** — `src/adapters/thumbnail-queue.ts`
- `invokePythonDesigner()` spawns the CLI with proper IPC
- Sends JSON request via stdin (no shell interpolation)
- Captures stdout/stderr separately
- Enforces 60-second timeout
- Validates exit code
- Parses and validates JSON response
- Verifies artifact files exist before accepting response
- Requires minimum 2 real variants with valid file paths
- Maps first two variants to `variant_a` and `variant_b`
- Preserves `contentItemId` association

**Tests:**
- `npm run test:thumbnail-route` — 19 tests pass, including live thumbnail generation
- `npx tsx --test src/tests/thumbnail-queue.test.ts` — 2 focused unit tests pass
- `npm run typecheck` — passes

**Verification:** Real JPEG files created at `~/.local/video-orchestrator/artifacts/thumbnails/` with valid file headers. Files associated with moving-video `contentItemId`. Approval workflow gated before YouTube publishing.

### Task 1W-E — Approve Thumbnail ✅ Complete

Record an explicit, auditable thumbnail approval required before YouTube publishing.

**Status:** Complete. `approveThumbnailRequest()` persists a canonical `thumbnail` approval containing `projectId`, `contentItemId`, `variantId`, and `requiredBefore: 'youtube_publish'`. `/api/video-orchestrator/thumbnails/approve` is reachable through the active POST router, rejects non-POST methods with a correct `405` contract, and no duplicate unreachable handler remains.

**Verification:** VO Studio write tests 67/67 passed, thumbnail route tests 20/20 passed, and TypeScript typecheck passed.

### Task 1W-F — Generate Metadata ✅ Complete

Generate the YouTube title, description, and related metadata for the approved moving-video package.

**Status:** Complete. Metadata generation now resolves the canonical moving-video content item, rejects missing and cross-project items deterministically, uses the item title and canonical source, targets YouTube only, and returns populated YouTube title, description, tags, hashtags, and a single `youtube` platform entry.

**Verification:** `npm run test:vo-studio-write-metadata` passed 22/22 tests, including canonical moving-video metadata generation, durable API-created content lookup, YouTube-only output, populated metadata fields, and deterministic missing/cross-project/malformed/duplicate failures. `npm run typecheck` passed on 2026-06-19.

### Task 1W-G — Approve Metadata ✅ Complete

Record an explicit, auditable metadata approval required before YouTube publishing.

**Status:** Complete. `approveMetadataRequest()` now persists a canonical `metadata` approval containing `contentItemId`, `variantId`, `requiredBefore: 'youtube_publish'`, and `targetPlatform: 'youtube'`. The response returns the persisted approval ID and canonical `pending` status.

**Verification:** `npm run test:metadata-approval` passed 6/6 focused tests, covering valid approval creation, canonical persistence, required YouTube publish gating, validation failures, and unique approval IDs.

### Task 1W-H — Queue Package and YouTube Posting Target ✅ Complete

Create the final production package, queue exactly one YouTube posting target, enforce idempotency, and invoke the existing OAuth2 direct-upload adapter only after all required approvals pass.

**Status:** Complete. The package publish contract now requires a bound `jobId`, exactly one normalized YouTube posting target, a non-empty account ID, and explicit confirmation. Scheduled and non-YouTube publishing are rejected. The active package publish route invokes the existing `runControlledYouTubePublish()` path, preserving its approval gates, duplicate/idempotency checks, and shell-backed OAuth2 upload adapter.

**Verification:** `npm run test:youtube-package-publish` passed 10/10 focused package and dry-run artifact tests. `npm run test:youtube-package-route` passed 2/2 focused route tests, proving YouTube-only validation and invocation of the controlled uploader for the bound job.

### Task 1W-I — End-to-End Verification and Operator Confirmation ✅ Complete — Sprint 1W Closed

Run the focused tests and required builds, verify deterministic failure reporting and complete audit history, then perform one operator-confirmed moving-video-to-YouTube workflow. Do not mark Sprint 1W complete without operator confirmation.

**Automated verification:** Fresh 2026-06-19 verification passed: `npm run typecheck`; `npm run test:phase-1w-approved-content-dispatch` 19/19; `npm run test:vo-studio-write-metadata` 22/22; `npm run test:youtube-package-route` 2/2; `npm run test:youtube-package-publish` 10/10; `npm run test:phase-1w-publish-readiness` 13/13; `npm run test:phase-1w-publish-readiness-inspector` 4/4; `npm run test:phase-1w-e2e-focused` 44/44; `npx tsx --test src/tests/video-orchestrator-youtube-live-gates.test.ts` 2/2; `npm run test:youtube-upload-channel-inference` 13/13 TAP checks; and `git diff --check`.

**Dry-run proof audit:** Complete. Dry-run wrote `publish-check.json` with `dryRunPassed: true` and mirrored into `publish.json`. Persisted proof validated before upload.

**Live publication evidence (2026-06-19T18:14:43.089Z):**
- **YouTube videoId:** `S_-0WpH7Bgc`
- **YouTube URL:** `https://www.youtube.com/watch?v=S_-0WpH7Bgc`
- **Channel:** Says the Bible (`UCTET3QhCzrA1nwMkcNj8LmQ`) — confirmed as authorized channel before upload
- **Privacy:** private
- **publishedAt:** `2026-06-19T18:14:43.089Z`
- **Audit files persisted:** `publication-audit.json` (status: published), `publication-attempt.json`, S3 `publish.json` (publishStatus: uploaded)
- **Idempotency verified:** second route call returned `duplicate: true` with same videoId — no second upload
- **Readiness inspector post-publish:** `priorPublication.published=true`, `source: publication-audit.json`
- **Canonical tuple:** packageId `pkg-mql6i7az-55u44l` / jobId `approved-video-approval-content-mql6hqdi-p7zqpv` / accountId `acct-stb-youtube`
- **Bug fixed:** `finalizeAwsVideoPublishPackage` did not handle `approved-source-video` mode (where video/thumbnail live under a different job prefix). Fixed to substitute the actual `videoKey`/`thumbnailKey` from `publish.json`/`assets.json` and skip audio/scene-plan prerequisites that don't apply to this mode.
- **Infrastructure note:** The production `brain` server (port 4877) was unable to complete the publish due to consistent S3 read timeouts (1200ms limit; S3 latency ~1.2s). The publish was executed via a temporary `brain-video-orchestrator` server instance (port 4879) where job files exist locally, avoiding the S3 timeout.
- **Historical stale candidate:** The older candidate (`approved-video-approval-content-mql62g8g-622x04`) remains in historical blocked state and was not altered.

**Sprint 1W status: ✅ COMPLETE**

### Task 1W-I.1 — Approved Moving-Video Content to Production Job Dispatch ✅ Complete

**Goal:** Connect an approved Phase 1W moving-video `ContentItem` to the existing production execution path without using fixture, slideshow, `test-001`, or `create-from-prompt` flows.

**Status:** Complete. Approved real-S3 moving-video content now creates one canonical approval-based production `jobId`, writes `topic.json`, `script.json`, `assets.json`, and `status.json`, records `mediaSource: 'uploaded-video'` and `generationMode: 'approved-source-video'`, starts the configured Amazon Step Functions execution, and persists `executionArn`. It also writes root `jobs/<jobId>/topic.json` so the existing YouTube uploader can infer the approved-video channel from S3. Duplicate approval dispatch is idempotent and does not start a second execution. Non-S3, fixture, slideshow, and `test-001` sources are rejected. Approval history remains preserved in the approval store.

**Implementation:** `dispatchApprovedMovingVideoContent()` in `src/providers/video-orchestrator-provider.ts`, approval record return in `src/adapters/vo-studio-approval-store.ts`, approval-route wiring in `src/api/routes.ts`, and focused coverage in `src/tests/video-orchestrator-approved-content-dispatch.test.ts`.

**Verification:** `npm run typecheck` passed. `npm run test:vo-studio-write-metadata` passed 22/22 tests. `npm run test:phase-1w-approved-content-dispatch` passed 19/19 tests.

**Durable API-created content lookup:** Complete. `generateMetadataRequest()` first preserves static seeded lookup behavior through `readVOStudioContentItem(contentItemId)`. If no seeded item exists, it reconstructs the minimal metadata-generation content shape from durable same-project VO content approvals returned by `readAllVOApprovals(projectId)`, requiring `type: content`, matching `projectId`, and matching `requestPayload.contentItemId`. Malformed payloads, cross-project records, and duplicate matching approvals are rejected deterministically. No process-local content registry or restart-volatile map is used.

**Direct-upload dry-run artifact behavior:** Complete. The dry-run path initializes the minimal canonical `metadata/publish.json` only when needed through the existing metadata storage abstraction, preserving `projectId`, `contentItemId`, `jobId`, `packageId`, selected YouTube `accountId`, `videoKey`, `thumbnailKey`, `publishStatus: "pending"`, and dry-run state. It does not mark uploads as published, does not create a fake `videoId`, does not create false approval evidence, and is idempotent. Successful dry-runs persist `dryRunPassed: true` in both `publish-check.json` and `publish.json`; failed/running dry-runs keep `dryRunPassed: false`.

**Uploader compatibility:** Complete. The shell uploader compatibility harness verifies explicit `YOUTUBE_CHANNEL_ID` override priority, `prochat-*` inference, `says-the-bible-*` inference, `approved-video-*` inference from `jobs/<jobId>/topic.json` in the configured S3 bucket, supported-project validation, safe failure for missing/unsupported projects, dry-run OAuth/token/YouTube API skipping, live-mode token requirement, and shell syntax. Tests do not call real AWS, OAuth, YouTube, or live upload paths.

**Server verification:** Brain Core route code was activated from the current repo with `npm run brain-core:clean-start`; the running server reported `Brain Core read-only API listening at http://127.0.0.1:4877` and reloaded after `src/providers/video-orchestrator-provider.ts` changed. Route probes used the actual `projects/brain-core/src/api/routes.ts` definitions: `/status` returned HTTP 200, and the content-item, content approval, production dispatch/binding, thumbnail generation/approval, metadata generation/approval, package queue/approval, YouTube dry-run, readiness inspector, and final publish route surfaces returned their expected validation responses. The launchd restart helper now creates the restart log directory before opening the log file.

**Post-dispatch package handoff:** Complete. Content approvals persist the canonical `contentItemId`; approved production dispatch persists that ID in `topic.json`, `assets.json`, and `status.json`; a durable idempotent binding store records `contentItemId → productionJobId`; and package queueing requires a same-project binding and stores the resolved production `jobId` in both the package approval payload and preview. Missing and cross-project bindings fail deterministically before package approval.

**Canonical thumbnail handoff:** Complete. Thumbnail generation and approval resolve the same durable `contentItemId → productionJobId` binding and reuse the real moving-video production `jobId` rather than creating an unrelated thumbnail job. The generic VO approval-decision route validates the approval record against that binding and, on approval, persists `thumbnail-selection.json` plus `selectedThumbnailVariantId`, `thumbnailApprovalId`, and `thumbnailApprovedAt` in canonical `assets.json` and `status.json`. Missing bindings, cross-project bindings, mismatched `jobId` values, fixture jobs, slideshow jobs, and `test-001` jobs fail deterministically before persistence.

**Canonical metadata handoff:** Complete. Metadata generation and approval now resolve the durable same-project `contentItemId → productionJobId` binding and remove the previous unrelated/random metadata job identity. Optional `jobId` values are accepted only when they match the bound production job. Metadata approval payloads persist `contentItemId`, canonical `jobId`, `variantId`, `youtubeTitle`, `youtubeDescription`, `youtubeTags`, `hashtags`, `requiredBefore: 'youtube_publish'`, and `targetPlatform: 'youtube'`; previews return the canonical `jobId`. `persistApprovedMetadataSelection()` validates approval, project, content, job, variant, title, and description inputs; reads canonical `topic.json`, `assets.json`, and `status.json`; requires exact `contentItemId` continuity and project ownership; requires `generationMode: 'approved-source-video'` and `mediaSource: 'uploaded-video'`; rejects fixture, slideshow, and `test-001` jobs; and persists `metadata-selection.json`, `metadata.json`, and status evidence (`metadataApprovalId`, `metadataApprovedAt`, `selectedMetadataVariantId`). The generic approval-decision route handles approved metadata records, validates missing/cross-project/mismatched bindings, calls metadata persistence, includes `metadataPersistence` in the response, and returns HTTP 422 on binding or persistence failure.

**Evidence:** The 22-test focused metadata script covers canonical job reuse, durable API-created content lookup without in-memory registration, static seeded fallback preservation, malformed/cross-project/duplicate durable approval rejection, canonical approval payload and preview, optional `jobId` validation, missing/cross-project/mismatched binding rejection, fixture/slideshow/`test-001` rejection, and isolated `VO_CONTENT_PRODUCTION_BINDINGS_PATH` use. The 19-test Phase 1W suite covers approved-content dispatch, root `jobs/<jobId>/topic.json` emission for uploader inference, package identity continuity, thumbnail persistence, metadata-selection and metadata persistence, status approval evidence, successful generic approval-route persistence, HTTP 422 failures for missing/cross-project/mismatched metadata bindings, fixture/slideshow/`test-001` rejection, and no metadata writes after rejected route persistence.

**Canonical publish readiness and live gate:** Complete. `evaluateCanonicalYouTubePublishReadiness()` performs a read-only canonical readiness audit across content approval binding, production job metadata, thumbnail approval, metadata approval, approved package ID, exactly one YouTube account target, persisted successful dry-run proof, exact-confirmation requirement, and existing publication state. `publishApprovedYouTubePackage()` re-evaluates readiness immediately before delegating to the existing YouTube uploader, requires the exact `PUBLISH TO YOUTUBE` phrase with no trimming/case folding/aliases, returns an idempotent duplicate result for already-published jobs, and persists `publication-audit.json`, `status.json`, and `publish.json` evidence only after a successful uploader result with a YouTube video ID. Rejections and uploader failures persist deterministic `publication-attempt.json` evidence without marking the job published.

**Live-readiness evidence:** The 13-test focused readiness suite covers complete canonical readiness success, missing thumbnail approval, missing metadata approval, mismatched identities, missing/failed dry-run proof, wrong confirmation, exact confirmation, fixture/slideshow/`test-001` rejection, cross-project rejection, missing account binding, package approvals with extra posting targets, duplicate publication idempotency, no uploader invocation on rejected paths, one mocked uploader invocation on success, persisted publication audit evidence, and uploader failure without a false published state.

**Operator readiness inspector:** Added `npm run inspect:phase-1w-publish-readiness`, a read-only JSON inspector that scans existing durable bindings, approval records, and local canonical job metadata without uploading, changing approvals, writing job metadata, or modifying bindings. It reports project/content/job/package/account tuples, thumbnail approval evidence, metadata approval evidence, dry-run proof evidence, prior publication state, readiness, and deterministic blockers. Exact filters are supported with `--project-id`, `--content-item-id`, `--job-id`, and `--package-id`; explicitly requested not-ready candidates exit nonzero.

**Validation:** Fresh 2026-06-19 counts: `npm run typecheck` passed. `npm run test:phase-1w-approved-content-dispatch` passed 19/19 tests. `npm run test:vo-studio-write-metadata` passed 22/22 tests. `npm run test:youtube-package-route` passed 2/2 tests. `npm run test:youtube-package-publish` passed 10/10 tests. `npm run test:phase-1w-publish-readiness` passed 13/13 tests. `npm run test:phase-1w-publish-readiness-inspector` passed 4/4 tests. `npm run test:phase-1w-e2e-focused` passed 44/44 tests. `npx tsx --test src/tests/video-orchestrator-youtube-live-gates.test.ts` passed 2/2 tests. `npm run test:youtube-upload-channel-inference` passed 13/13 TAP checks. `git diff --check` passed.

**Real API workflow tuple (2026-06-19):** A real API-driven workflow reached YouTube-ready dry-run state without live upload. Source: `s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/i-7-9-stb-with-theology-001/exports/generated-001-final.mp4` (`video/mp4`, 2,047,543 bytes) with adjacent thumbnail `jobs/i-7-9-stb-with-theology-001/exports/thumbnail-001.jpg`. There were no upload-prefix MP4 objects in the configured bucket, so this verified non-fixture, non-slideshow, non-`test-001` moving-video object was used as the real S3 source. Tuple: `projectId=says-the-bible`, `accountId=acct-stb-youtube`, `contentItemId=content-mql6hqdh-is2yxy`, `jobId=approved-video-approval-content-mql6hqdi-p7zqpv`, `packageId=pkg-mql6i7az-55u44l`, `contentApprovalId=approval-content-mql6hqdi-p7zqpv`, `thumbnailApprovalId=approval-thumbnail-mql6hsyp-2a1t5c`, `metadataApprovalId=approval-metadata-mql6i5yl-dg9wqy`, `packageApprovalId=approval-package-mql6i7az-1sr2jk`, and Step Functions `executionArn=arn:aws:states:eu-north-1:909439522876:execution:prochat-video-skeleton-dev:console-gen-approved-video-approval-content-mql6hqdi-p7zqpv-1781888646602-eb6044`.

**Readiness inspection:** `npm run inspect:phase-1w-publish-readiness -- --project-id says-the-bible --content-item-id content-mql6hqdh-is2yxy --job-id approved-video-approval-content-mql6hqdi-p7zqpv --package-id pkg-mql6i7az-55u44l` returned `ok: true`, one candidate, `ready: 1`, `blocked: 0`, candidate `readiness: true`, and candidate `blockers: []`. Evidence included `dryRunProofId=publish-check:approved-video-approval-content-mql6hqdi-p7zqpv:2026-06-19T17:04:38.223Z`, `dryRunPassedAt=2026-06-19T17:04:38.223Z`, and `priorPublication.published=false`. S3 proof exists at `jobs/approved-video-approval-content-mql6hqdi-p7zqpv/topic.json`, `metadata/publish.json`, and `metadata/publish-check.json`; `publish.json.publishStatus` remains `pending`, `dryRunPassed` is `true`, and YouTube `videoId`, `url`, and `publishedAt` remain `null`.

**Final pre-publication preflight (2026-06-19):** The source-defined final package route is `POST /api/video-orchestrator/package/publish` with `packageId`, `jobId`, `postingTarget.platformId: "youtube"`, `postingTarget.accountId`, and exact `confirmation: "PUBLISH TO YOUTUBE"`; there is no source-defined `projectId` request-body field for this route. The canonical tuple above still inspected as ready with `blockers: []`, one YouTube target, `publishStatus: "pending"`, no YouTube `videoId`, no URL, no `publishedAt`, and no `publication-audit.json`. Credential preflight was redacted: channel config present, OAuth refresh capability available, `acct-stb-youtube` bound to `says-the-bible`, uploader channel inference selected `says-the-bible`, expected channel label `Says the Bible`, and the expected token file was missing. Live execution is therefore not immediately executable until that token is present, even though canonical readiness remains true.

**Stale blocked candidate audit (2026-06-19):** The older tuple `contentItemId=content-mql65xkb-u5l5bh`, `jobId=approved-video-approval-content-mql65xkb-2veshg`, `packageId=pkg-mql66crv-n8pzao` remains a stale incomplete historical candidate, not an evaluator bug. It exposes `dryRunProofId=publish-check:approved-video-approval-content-mql65xkb-2veshg:2026-06-19T16:58:05.483Z` because a dry-run check timestamp exists, but `publish-check.json` reports failed dry-run state and `publish.json.dryRunPassed` remains `false`; readiness correctly blocks with `publish_dry_run_required`. Do not delete it, mark it ready, or copy proof from another job.

**Final preflight validation:** Fresh 2026-06-19 counts for the final pre-publication pass: `npm run typecheck` passed. `npm run test:phase-1w-publish-readiness` passed 13/13 tests. `npm run test:phase-1w-publish-readiness-inspector` passed 4/4 tests. `npm run test:youtube-package-route` passed 2/2 tests. `npm run test:youtube-package-publish` passed 10/10 tests. `npx tsx --test src/tests/video-orchestrator-youtube-live-gates.test.ts` passed 2/2 tests. `npm run test:youtube-upload-channel-inference` passed 13/13 TAP checks. `git diff --check` passed.

**Sprint 1W complete:** The live YouTube upload succeeded at 2026-06-19T18:14:43.089Z. videoId `S_-0WpH7Bgc`, URL `https://www.youtube.com/watch?v=S_-0WpH7Bgc`, channel `Says the Bible`, privacy `private`. Publication audit evidence is persisted. Sprint 1W is closed.

**Required order:** 1W-B → 1W-C → 1W-D → 1W-E → 1W-F → 1W-G → 1W-H → 1W-I.

**Sprint 1W done when (criterion met 2026-06-19):** One real moving-video content item proceeded through required thumbnail and metadata approvals, package creation, one idempotent YouTube posting target, and direct YouTube upload through the existing OAuth2 adapter, with complete audit history, passing focused validation, and operator confirmation.

---

## Sprint 1: Video Composition (Phase 1) ✅

### Task 1 — Platform specs config file ✅
**File:** `~/.config/video-orchestrator/platform-specs.json` + `format-specs.json`

`platform-specs.json` — platform posting rules with `direct_upload_handler` field  
`format-specs.json` — 5 format keys: `landscape_1920x1080_16x9`, `vertical_1080x1920_9x16`, `square_1080x1080_1x1`, `portrait_1080x1350_4x5`, `lightweight_1280x720_16x9`

**Done:** Worker reads `platform-specs.json` at runtime. No hardcoded platform logic.

---

### Task 2 — Job artifact schema ✅
**Files:**
- Python: `/Users/Office/.local/video-orchestrator/worker/artifact.py`
- TypeScript: `brain-core/src/types/vo-artifact.ts`

Python `JobArtifact` dataclass with all nested types: `AudioArtifact`, `CompositionArtifact`, `CompositionOutput`, `SubtitleArtifact`, `ThumbnailArtifact`, `ThumbnailVariant`, `PlatformMetadata`, `MetadataArtifact`, `PublishingResult`, `AnalyticsSnapshot`. Round-trip JSON serialization verified.

TypeScript mirror with `jobArtifactFromWire()` (snake→camelCase) and `newJobArtifact(jobId)`.

**Done:** Artifact serializes to/from JSON, stored in `task_config` JSONB.

---

### Task 3 — Audio normalization module ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/audio_normalizer.py`

Two-pass FFmpeg loudnorm: pass 1 reads stats, pass 2 applies `-14 LUFS / -1.0 dBFS`. Output: 44100 Hz, 256k AAC.

**Done:** `normalize_audio(mp3_path, output_path)` returns valid `AudioArtifact`.

---

### Task 4 — Composition module ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/composer.py`

FFmpeg filtergraph per format key — scale+pad per output. Static image: `-loop 1`; video background: `-stream_loop -1`. Trims to audio duration with `-t`.

**Done:** `compose_video(audio, bg, format_keys, output_dir)` returns `CompositionArtifact` with one output per format key.

---

### Task 5 — Wire composition into post job ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/video_worker.py`

`execute_compose_job`: normalize audio → compose video → write fallback package → set `approval_status = pending_approval`.  
`execute_post_job`: reads artifact for composed video path, metadata, thumbnail.

**Done:** Compose job runs full pipeline and halts for approval.

---

### Task 6 — Pass metadata to YouTube uploader ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/video_worker.py`

`execute_post_job` reads `artifact.metadata.youtube_standard` if present; falls back to `task_config` title/description. Passes title, description, tags to `update_video_metadata()` after upload.

**Done:** Artifact metadata flows through to YouTube.

---

### Task 1.5 — Approval gate + manual fallback package ✅
**Files:**
- `fallback_package.py` — writes `fallback/` dir with video symlinks, subtitle links, `platform-metadata.json`, `README.md`
- `brain-core/src/adapters/infra-video-orchestrator-approve.ts` — `approveVOJob()` / `rejectVOJob()`
- `brain-core/src/api/routes.ts` — `POST /infra/video-orchestrator/jobs/:id/approve` + `reject`

**Done:** Compose job sets `pending_approval` → Brain Core HTTP endpoint flips to `approved` → worker resumes on next poll.

---

### Task 1.0 — Tech debt ✅
- DB migration: `scheduled_after TIMESTAMPTZ` added to `jobs`
- DB migration: `approval_status VARCHAR(20)` added to `jobs`
- Worker job-claim query respects both columns
- Platform-specific logic removed from `video_worker.py` — replaced with `platform-specs.json` lookup

---

## Sprint 2: Subtitles (Phase 2) ✅

### Task 7 — faster-whisper subtitle worker ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/subtitle_worker.py`

`generate_subtitles(audio_path, output_dir, language, model_override) -> SubtitleArtifact`  
GPU: large-v3/float16. CPU: distil-large-v3/int8. Silero VAD, 3500ms silence threshold.  
faster-whisper 1.2.1 installed in Python 3.14 venv.

**Done:** SRT + VTT written to job output dir.

---

### Task 8 — `subtitle` job type ✅
- DB migration: `subtitle` added to `jobs_job_type_check` constraint
- `execute_subtitle_job` registered in `JOB_EXECUTORS`

**Done:** Worker dispatches subtitle jobs.

---

### Task 9 — YouTube caption upload ✅
**File:** `/Users/Office/.local/video-orchestrator/scripts/youtube_uploader.py`

`upload_captions(account_handle, video_id, srt_path, language, name)` — two-step resumable upload via `captions.insert`.  
Called in `execute_post_job` after video upload when `artifact.subtitles.srt_path` is present.

**Done:** Captions upload wired into post job.

---

## Sprint 3: Thumbnails (Phase 3) ✅

### Task 10 — Thumbnail design system JSON ✅
**File:** `~/.config/video-orchestrator/thumbnail-templates.json`

Two templates: `bold-text` (full-bleed + dark scrim + large white headline) and `minimal-curiosity` (subtle + hook-focused).  
Brand defaults: `brand_line: "YeshuaAcademy.com"`, `label_text: "BIBLE STUDY"`, `accent_color: "#F5C842"`.

**Done:** Template system defined with layer schema.

---

### Task 11 — Thumbnail generator ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/thumbnail_generator.py`

Pillow layer compositor: background (cover-fit), scrim (RGBA), text (multiline, shadow, zone-based).  
Font fallback: Inter TTF → Helvetica.ttc → Pillow default.  
Output: 1280×720 JPG, quality=92.  
`generate_thumbnails()` produces variant_a (bold-text) and variant_b (minimal-curiosity); variant_a active.

**Done:** Two JPG variants generated per video, `artifact.thumbnail` written.

---

### Task 12 — `thumbnail` job type ✅ / YouTube upload ⚠️ partial
- `execute_thumbnail_job` registered in `JOB_EXECUTORS`
- `youtube_uploader.py` OAuth scopes expanded to include `force-ssl` + `yt-analytics.readonly`

**Carry-over:** `thumbnails.set` API call after publish not yet wired into `execute_post_job`. The uploader has the method signature; the call in the post job needs to be added.

---

### Task 13 — Thumbnail studio in Brain Console 🔲
- Template library card in VO view
- Per-job thumbnail preview before publishing
- A/B variant selector + manual headline edit
- Wire `thumbnails.set` into publish flow

**Not started.** Requires Brain Console UI work.

---

## Sprint 4: SEO Metadata (Phase 4) ✅

### Task 14 — Metadata generator ✅
**File:** `/Users/Office/.local/video-orchestrator/worker/metadata_generator.py`

Routes all LLM calls via AI Model Selector (`localhost:4890`, task type `metadata_generation`).  
`_fetch_top_performing_titles()` queries top 10 by CTR from `performance_metrics` — injected as `{top_performing_titles}` in prompts.  
Reports failures via `report_ai_failure()`.  
Returns `MetadataArtifact` with `PlatformMetadata` per target platform.

**Done:** Metadata generation wired end-to-end.

---

### Task 15 — Prompt template system ✅
**File:** `~/.config/video-orchestrator/metadata-prompts.json`

Four prompts: `youtube_description`, `youtube_tags`, `youtube_title_variants`, `chapters`.  
Faith-based system prompts for YeshuaAcademy.com channel.

**Done:** Prompt system in place.

---

### Task 16 — Metadata review in Brain Console 🔲
- VO job detail: generated title/description/tags
- Edit inline, approve and publish
- Metadata status chip

**Not started.** Requires Brain Console UI work.

---

### Task 17 — YouTube upload uses artifact metadata ✅
`execute_post_job` prefers `artifact.metadata.youtube_standard` over `task_config` fields.  
`update_video_metadata()` called after upload.

**Done:** Artifact metadata used for YouTube upload.

---

## Sprint 5: Analytics (Phase 5) ✅

### Task 18 — YouTube Analytics integration ✅
**File:** `/Users/Office/.local/video-orchestrator/scripts/analytics_sync.py`

**YouTube Reporting API path (bulk, 1 quota unit/day):**
- `setup_reporting_job(account)` — creates `channel_basic_a2` reporting job once; state in `yt-reporting-job.json`
- `fetch_reporting_csv(account, dry_run)` — downloads daily CSV, upserts impressions/CTR/views/avg_view_duration_sec
- `sync_all()` auto-calls Reporting CSV fetch when job configured

**CLI commands added:** `reporting-setup`, `reporting-fetch`

**DB migration applied:**
```sql
ALTER TABLE performance_metrics
  ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctr FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS avg_view_duration_sec INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

**Done:** Bulk analytics sync operational.

---

### Task 19 — Performance context for metadata ✅
Already wired in Task 14 — `metadata_generator.py` queries `performance_metrics` before every LLM call.

**Done:** Analytics feedback loop closed.

---

### Task 20 — A/B winner declaration ✅
**Function:** `declare_ab_winners(dry_run)` in `analytics_sync.py`

Queries jobs where `ab_test_active=true` and `impressions >= 300`.  
Declares variant_a winner; clears `ab_test_active` flag via `jsonb_set`.  
CLI command: `ab-check [--dry-run]`

**Note:** Per-variant CTR comparison requires YouTube Test & Compare API (future). Current logic declares variant_a by default when threshold is reached.

**Done:** A/B winner declaration operational.

---

## Historical Brain Console UI Carry-Over (Later) 🔲

Historical plan records backend modules as implemented, but current-code status remains audit pending under Task 1W-B. The following UI panels remain historical carry-over items in `brain-console-obsidian/src/view.ts`:

### Task 21 — Thumbnail studio panel
- Template library: show available templates from `thumbnail-templates.json`
- Per-job preview: display variant_a / variant_b JPGs side by side
- Manual headline edit: `PATCH /infra/video-orchestrator/jobs/:id` updates `task_config.headline_text`
- A/B status chip: "Testing" (yellow) / "Winner: variant_a" (green)
- Wire `thumbnails.set` into `execute_post_job` (requires `yt_quota.py` deduction for `thumbnails_set` operation)

**Entry point:** `brain-core/src/api/routes.ts` — needs `GET /infra/video-orchestrator/jobs/:id/thumbnails` endpoint

---

### Task 22 — Metadata review panel
- Per-job metadata card: generated title, description, tags (read from `artifact.metadata`)
- Inline edit (textarea) + "Save" button → `PATCH /infra/video-orchestrator/jobs/:id/metadata`
- Approval button for metadata: sets `metadata_approved = true` in `task_config`
- Status chip: `pending` (yellow) → `approved` (green) → `published` (blue)

**Entry point:** needs `GET /infra/video-orchestrator/jobs/:id/artifact` and `PATCH /infra/video-orchestrator/jobs/:id/metadata` endpoints in Brain Core

---

### Task 23 — Analytics dashboard panel
- Per-video card: impressions, CTR, views, avg duration (from `performance_metrics`)
- Channel summary: rolling 7d/30d totals (aggregate query)
- A/B test status per job

**Entry point:** needs `GET /infra/video-orchestrator/analytics/summary` endpoint in Brain Core

---

### Task 24 — AI selector health chip in VO view
- Running/stopped status for `localhost:4890`
- Current provider being routed to

**Entry point:** proxy `GET localhost:4890/health` through Brain Core

---

## Sprint 7: Multi-Platform (Phase 6) 🔲

### Task 25 — n8n workflows per platform
- Facebook: page post with video + description
- Pinterest: pin with thumbnail + description + board routing
- TikTok: short-form post with platform description
- Instagram Reels: post with caption + hashtags

### Task 26 — Platform-specific metadata
- `metadata_generator.py` produces copy for all active platforms
- Character limit enforcement per platform
- Hashtag sets per platform

### Task 27 — Full pipeline CLI command
```bash
vo queue pipeline \
  --audio episode.mp3 \
  --background series-bg.jpg \
  --title "Genesis — Noah" \
  --platforms youtube,facebook,pinterest \
  --account 303e91f9
```
Queues: `normalize → subtitle → compose → thumbnail → metadata → publish` (all platforms)

---

## Sprint 8: Production Hardening (Phase 7) 🔲

### Task 28 — Job retry with exponential backoff
Currently `max_retries=3` flat in `video_worker.py`. Add exponential backoff with jitter.

### Task 29 — Worker health endpoint
- HTTP endpoint on worker process: `GET /health` → `{status, jobs_processed, last_job_at}`
- LaunchAgent alert if worker process dies

### Task 30 — Artifact versioning
- Store `v1/v2` snapshots when metadata is regenerated
- `artifact_history` table or versioned JSON key in `task_config`

### Task 31 — Storage cleanup
- Archive composed video files after 30 days (move to `~/.local/video-orchestrator/archive/`)
- Keep artifact JSON forever (it's lightweight)

### Task 32 — Per-job module progress in Brain Console
- VO view shows each module status: composition ✅ / subtitles ⏳ / thumbnail ⏳ / metadata ⏳

---

## File Map — Current State

```
~/.config/video-orchestrator/
  platform-specs.json          ✅ Task 1
  format-specs.json            ✅ Task 1
  thumbnail-templates.json     ✅ Task 10
  metadata-prompts.json        ✅ Task 15
  ai-providers.json            ✅ Phase 0.5
  ai-task-types.json           ✅ Phase 0.5
  ai-selector-config.json      ✅ Phase 0.5

~/.local/video-orchestrator/worker/
  artifact.py                  ✅ Task 2
  audio_normalizer.py          ✅ Task 3
  composer.py                  ✅ Task 4
  fallback_package.py          ✅ Task 1.5
  subtitle_worker.py           ✅ Task 7
  thumbnail_generator.py       ✅ Task 11
  metadata_generator.py        ✅ Task 14
  yt_quota.py                  ✅ Phase 2.4
  video_worker.py              ✅ Tasks 5, 8, 12, 17 wired in

~/.local/video-orchestrator/scripts/
  analytics_sync.py            ✅ Tasks 18–20
  youtube_uploader.py          ✅ Tasks 6, 9 (upload_captions, update_video_metadata)

~/.local/video-orchestrator/services/model-selector/
  selector_service.py          ✅ Phase 0.5
  core.py                      ✅ Phase 0.5
  client.py                    ✅ Phase 0.5

brain-core agent orchestrator/
  capability registry          🔲 Sprint 0C
  run ledger/event log         🔲 Sprint 0C
  approval gate adapter        🔲 Sprint 0C
  selector-aware executors     🔲 Sprint 0C

brain-core/src/types/
  vo-artifact.ts               ✅ Task 2

brain-core/src/adapters/
  ai-model-selector.ts         ✅ Phase 0.5
  infra-video-orchestrator-approve.ts  ✅ Task 1.5

brain-core/src/api/
  routes.ts                    ✅ Task 1.5 (approve/reject routes)

brain-console-obsidian/src/
  view.ts                      🔲 Tasks 21–24 (shared artifact review, analytics, AI chip)
```

---

## Definition of Done (per sprint)

**Sprint 1–5 done:** ✅  
`vo queue compose` → audio normalizes → video composes → fallback package written → halts for approval → Brain Console POST approve → worker resumes → YouTube upload with captions, thumbnail variant, AI-generated metadata.  
Analytics nightly sync fetches Reporting API CSV, top-performing titles feed next metadata generation.

**Sprint 6 done when:**  
Brain Console shows shared artifact preview, approval status, analytics dashboard, and AI selector health chip. Project-specific thumbnail editing and SEO authoring happen in the project repo admin UI. `thumbnails.set` quota tracked where the project workflow triggers the upload.

**Sprint 7 done when:**  
`vo queue pipeline --platforms youtube,facebook,pinterest` queues full multi-platform job chain and publishes to all three platforms from a single command.

**Sprint 8 done when:**  
Worker handles transient failures gracefully (exponential backoff), has a health endpoint, Brain Console shows per-module progress for each job.
