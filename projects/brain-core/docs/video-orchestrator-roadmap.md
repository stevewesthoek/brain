# Video Orchestrator — Roadmap

**Document type:** Phased roadmap  
**Status:** Active  
**Last updated:** 2026-06-14 (next-phase implementation + thumbnail studio + winner-driven thumbnail replacement)
**Strategy reference:** `video-orchestrator-strategy.md`

---

## Roadmap Rules

This roadmap must flow from `video-orchestrator-strategy.md`.

- Each phase has one owner boundary and one measurable exit criterion.
- A phase marked complete means the implementation matches the current strategy, not only a prior version of the strategy.
- New provider, platform, or UI behavior starts read-only unless the strategy explicitly permits mutation.
- Any task must be small enough for Codex Mini or Claude Code Haiku: one adapter, one route, one UI panel, one schema/test slice, or one documentation slice.
- Direct publishing tasks are always behind adapter capability checks, quota checks, idempotency, approval, and manual fallback.

---

## Current State (as of 2026-06-14)

**Working:**
- Job queue with normalize, compose, subtitle, thumbnail, metadata, post, multi_post, render, and screen_record job types
- YouTube direct upload via OAuth2 (keychain-persisted token, auto-refresh)
- n8n dispatch fallback with CF Access headers
- Brain Console: Accounts & Credentials tab (all STB/infra credentials set)
- Worker LaunchAgent running, picks up jobs automatically
- Backend VO pipeline through Phase 5: composition, subtitles, thumbnails, metadata, analytics feedback, and approval gate
- AI Model Selector running at `localhost:4890`; current approved provider policy supports Claude Code via Amazon Bedrock, Codex CLI, and approved selector routes. Gemini is disabled and is not part of the current stack. Direct Anthropic API and direct OpenAI API calls remain disallowed where applicable.

**Current active gap:**
- The moving-video-to-YouTube workflow is not yet complete end to end.
- YouTube OAuth2 direct upload exists, but the approval-gated path from moving-video input through package queueing and direct YouTube posting still requires ordered completion and verification.
- Sprint 1W is the only authorized implementation milestone until this workflow is tested and confirmed complete by the operator.

**Remaining VO product gaps:**
- Complete the approval-gated moving-video workflow through direct YouTube publishing.
- Test & Compare remains manual via YouTube Studio until/if YouTube exposes a public developer API.
- Multi-platform expansion is deferred until the moving-video-to-YouTube workflow is complete and explicitly re-authorized.

---

## Build Order From Here

The build order preserves completed foundations while identifying the single current implementation milestone:

1. ✅ **Policy lock & Selector policy implementation** — complete.
2. ✅ **Normalized read model (Phase 0.8)** — complete.
3. ✅ **Brain Console read-first shell (Phase 0.9)** — complete.
4. ⏳ **Moving-video-to-YouTube approval workflow (Phase 1W)** — current and in progress.
5. 🔲 **Further multi-platform expansion (Phase 6)** — deferred/future until Phase 1W is tested and operator-confirmed complete.

**Authorized next milestone:** Complete Sprint 1W for the moving-video-to-YouTube workflow.

**Owner boundary:** Brain Core approval, package, posting-target, and YouTube publishing flow, plus the minimum Brain Console controls required by the ordered Sprint 1W tasks. No slideshow generation, non-YouTube adapter expansion, unrelated hardening, or broad UI redesign.

**Ordered execution:**
1. ✅ Task 1W-B audit completed against Tasks 1W-A through 1W-I.
2. ⏳ Task 1W-C is the first genuinely missing task and is next: add real moving-video intake and source updates without slideshow generation.

**Historical Phase 6 labeling:** All completion statements and checkmarks in both `Historical Phase 6 Evidence` sections are unverified historical plan records pending focused verification. They are not active authorization.
3. Validate Task 1W-C with its focused tests and required build checks.
4. Review the result against the roadmap and implementation plan.
5. Mark the task complete only after operator confirmation, then proceed to the next task.

**Measurable exit criterion:** A real moving-video content item can proceed through required thumbnail and metadata approvals, package and YouTube posting-target queueing, and one idempotent direct YouTube upload using the existing OAuth2 adapter, with complete audit history and deterministic failure reporting. The workflow is not complete until focused tests pass and the operator confirms the verified result.

Do not begin work outside this milestone until the roadmap is explicitly updated and approved.

---

## Phase 0 — Foundation ✅ Complete
> Queue, worker, accounts, credentials, Brain Console wiring, first upload

- [x] Job queue (PostgreSQL-backed)
- [x] Worker LaunchAgent (auto-start, CF Access headers)
- [x] YouTube OAuth2 direct upload
- [x] Brain Console credentials tab (all platforms + infra)
- [x] CF Access service token wired
- [x] Auth method persisted to DB on OAuth exchange
- [x] Normalize worker (5 platform crops from master)

---

## Phase 0.5 — AI Model Selector (v1) ✅ Complete
> Approved, privacy-aware routing for AI-dependent work

**Goal:** Every AI-dependent module uses an approved execution surface or selector route rather than an unapproved direct model API. Claude Code via Amazon Bedrock is supported. Codex CLI is supported. Approved AI Model Selector routes are supported. Gemini is disabled and is not part of the current stack. Direct Anthropic API and direct OpenAI API calls remain disallowed where applicable.

**Naming clarity:** The AI Model Selector (`localhost:4890`) is NOT the same as Mind Steward (TypeScript Brain Core project). They are completely different. AI Model Selector = LLM routing engine.

### 0.5.1 Config files
- [x] `~/.config/video-orchestrator/ai-providers.json` — approved providers registered
- [x] `~/.config/video-orchestrator/ai-task-types.json` — task types defined
- [x] `~/.config/video-orchestrator/ai-selector-config.json` — routing and defer configuration

### 0.5.2 Selector service
- [x] `~/.local/video-orchestrator/services/model-selector/selector_service.py` — live at `localhost:4890`
- [x] `core.py` — selection algorithm with health, context, privacy, and provider gates
- [x] `client.py` — Python client helper
- [x] Audit log at `~/.local/video-orchestrator/logs/ai-selections.jsonl`
- [x] LaunchAgent `com.office.ai-model-selector` running (KeepAlive, RunAtLoad)

### 0.5.3 CLI shim + TypeScript client
- [x] `~/.local/bin/ai-select` — wrapper usable from approved shells and agents
- [x] `brain-core/src/adapters/ai-model-selector.ts` — TypeScript client for Node.js apps
- [x] Brain Console VO view: AI selector health chip

### 0.5.4 Platform architecture doc
- [x] `brain/docs/platform-architecture.md` — canonical scaffold standard for all projects

**Deliverable:** ✅ `ai-select --task metadata_generation` returns an approved routing decision without exposing secrets.

---

## Phase 0.5R — Historical Gemini-First Selector Policy ⛔ Superseded

This phase is retained only as historical context. Gemini is disabled and is not part of the current stack. Its provider registration, quota ledger, and fallback tests are not active policy requirements.

**Current policy:**
- Claude Code via Amazon Bedrock is supported.
- Codex CLI is supported.
- Approved AI Model Selector routes are supported.
- Gemini is disabled and is not part of the current stack.
- Direct Anthropic API and direct OpenAI API calls remain disallowed where applicable.

---

## Phase 0.6 — AI Model Selector v2: Dual-Node + Resilience ✅ Complete
> MacBook M1 as second inference node; circuit breaker; Ollama on both machines

**Goal:** Zero-cost AI inference on all available local hardware. The selector orchestrates Mac Mini M4 Pro + MacBook M1 via Thunderbolt Bridge. Resilience means no job ever fails because a provider is temporarily unavailable.

**Hardware:**
- Mac Mini M4 Pro: 24 GB unified memory, TB5 port, IP `192.168.2.1` (Thunderbolt Bridge)
- MacBook M1: 16 GB unified memory, TB3 port, IP `192.168.2.2` (Thunderbolt Bridge), always on

### 0.6.1 Thunderbolt Bridge setup (manual, one-time) ✅
- [x] M4 Pro: System Settings → Network → Thunderbolt Bridge → assign `192.168.2.1/24`
- [x] M1: System Settings → Network → Thunderbolt Bridge → assign `192.168.2.2/24`
- [x] M1: Set `OLLAMA_HOST=0.0.0.0` in Ollama LaunchAgent plist
- [x] Verify from M4 Pro: `curl http://192.168.2.2:11434/api/tags`

### 0.6.2 Ollama install and models on both machines ✅
- [x] Install Ollama on Mac Mini M4 Pro (`brew install ollama`)
- [x] Install Ollama on MacBook M1 (`brew install ollama`)
- [x] M4 Pro: `ollama pull qwen2.5:32b` (quality primary) + `ollama pull qwen2.5:14b` (fallback) + `ollama pull llama3.1:8b` (fast)
- [x] M1: `ollama pull qwen2.5:14b` (primary) + `ollama pull llama3.1:8b` (fallback) + `ollama pull llama3.2:3b` (fast)
- [x] LaunchAgent for Ollama on M4 Pro (`com.office.ollama-m4pro`, `OLLAMA_HOST=127.0.0.1:11434`)
- [x] LaunchAgent for Ollama on M1 (`com.office.ollama-m1`, `OLLAMA_HOST=0.0.0.0:11434`)

### 0.6.3 Update provider registry ✅
- [x] Remove old LM Studio provider (`lmstudio-local`, port 1234) and add Ollama providers in `ai-providers.json`:
  - `ollama-m4pro` — `http://localhost:11434/v1`, priority 1, any schedule
  - `ollama-m1` — `http://192.168.2.2:11434/v1`, priority 2, batch_window preferred

### 0.6.4 Circuit breaker in selector `core.py` ✅
- [x] Per-provider circuit state: `closed` → `open` → `half-open`
- [x] Opens after 3 failures within 5 min; initial open duration 10 min, doubles each trip (max 2h)
- [x] State persisted to `~/.local/video-orchestrator/state/circuit-breakers.json`
- [x] Health checks skip providers with open circuits (avoids hammering down providers)

### 0.6.5 Timeout tiers in selector ✅
- [x] Local same-machine: connect 3s, inference 120s
- [x] Local Thunderbolt (M1): connect 5s, inference 180s
- [x] Codex CLI / Bedrock fallback: connect 5s, inference 300s
- [x] Timeout triggers `report_ai_failure()` → circuit breaker registers failure

### 0.6.6 Deferred result handling in worker ✅
- [x] `core.py` returns `{"deferred": true, "scheduled_after": "..."}` when all providers unavailable and task is non-urgent
- [x] `video_worker.py` handles deferred result: updates job `scheduled_after`, exits cleanly (no error)

### 0.6.7 Update nightly scheduler ✅
- [x] `office-nightly-scheduler.sh`: verify both Ollama instances healthy before queuing batch jobs
- [x] Alert (stdout log) if M1 is unreachable at batch window start

**Deliverable:** AI Selector orchestrates M4 Pro + M1 Ollama + Codex/Bedrock fallback. No job fails because a single node is down. M1 handles overnight batch load automatically. If everything local is down, tasks defer to next batch window for free, use Codex CLI when quality or urgency requires it, or use Bedrock only as the paid fallback.

---

## Phase 0.7 — Brain Agent Orchestrator ✅ Complete
> Multi-agent project execution layer above the AI Model Selector

**Goal:** Add agent mode as a Brain Core orchestration layer that can plan and coordinate full projects using Gemini free-tier where eligible, local AI for private/offline and fallback work, Codex CLI, Amazon Bedrock Claude, existing orchestration skills, and approved infrastructure CLIs.

**Boundary:** The Agent Orchestrator is not the AI Model Selector. The selector chooses an AI execution surface. The orchestrator decomposes work, assigns tasks, calls skills/CLIs, records run state, handles handoffs, and asks for approval before risky actions.

**Status:** Core orchestrator implemented (task decomposition, DAG execution, approval gates) and provider wiring is now implemented through approved selector/CLI surfaces.

### 0.7.1 Research and architecture ✅
- [x] NotebookLM and research-orchestrator synthesis completed
- [x] Research note: `agent-orchestrator-research-2026-05-22.md`
- [x] Architecture doc: `agent-orchestrator-architecture.md`

### 0.7.2 Task decomposition and DAG execution ✅
- [x] `planProjectExecution(goal, context)` — decomposes into task graph
- [x] `OrchestrationExecutor.executeAll()` — topological sort + dependency checking
- [x] DAG validation — prevents circular dependencies
- [x] Task types: ai_analysis, ai_generation, code_change, file_operation, external_api_call, approval_gate

### 0.7.3 Approval gates ✅
- [x] Execution pauses at approval_gate tasks
- [x] Operator reviews + decides in Brain Console
- [x] Operator approval stored in execution ledger
- [x] Resumes execution after approval

### 0.7.4 Provider routing ✅ Implemented
- [x] Gemini/Claude-labelled AI execution paths route through the AI Model Selector; Codex routes through Codex CLI
- [x] Routing ladder defined: Gemini → Claude → Codex → bash → n8n
- [x] Provider selection logic now executes real provider paths with safe fallback behavior

### 0.7.5 Execution ledger ✅
- [x] Records all task steps, results, provider selected, latency, actor
- [x] Immutable append-only log
- [x] Audit trail for approvals and decisions

### 0.7.6 Brain Console Agent View ✅
- [x] Brain Console `Agents` tab in VO shell
- [x] Read-only agent console surface wired to `/agent-console` and `/agent-cost-summary`
- [x] Shows run summary, task graph, executor plan, approval gates, event stream, and cost snapshot

**Deliverable:** ✅ Agent Orchestrator can plan and execute task graphs with approval gates and approved provider paths. Direct Anthropic/OpenAI API calls remain forbidden.

---

## Phase 0.8 — Normalized VO Studio Read Model ✅ Complete
> One shared data model for all projects, accounts, platforms, formats, packages, and posting targets

**Goal:** Brain Core exposes read APIs that let Brain Console render the canonical VO surfaces without STB-specific branches.

**Boundary:** Read APIs and fixture-backed tests only. No package generation, no posting, no credential mutation, no direct platform writes.

**Status:** All read adapters complete with fixture-backed endpoints and typed responses.

### 0.8.1 Read adapters ✅
- [x] `GET /video-orchestrator/projects`
- [x] `GET /video-orchestrator/accounts`
- [x] `GET /video-orchestrator/pipeline-profiles`
- [x] `GET /video-orchestrator/content-items`
- [x] `GET /video-orchestrator/packages/:id`
- [x] `GET /video-orchestrator/analytics/summary`

### 0.8.2 Contract tests ✅
- [x] Every endpoint returns stable typed JSON from fixture data
- [x] Says the Bible appears as one configured project, not as special-case UI logic
- [x] Platform account records expose adapter mode, credential state, quota state, and manual fallback capability
- [x] Package records expose stage status, artifact variants, approvals, posting targets, and audit events

**Exit criterion:** ✅ Brain Console can render Overview, Studio, Pipelines, Accounts, and History/Analytics from read APIs without direct filesystem or STB-specific assumptions.

---

## Phase 0.9 — Brain Console VO Shell ✅ Complete
> Dense read-first operator interface

**Goal:** Build the VO Console surfaces in read-only mode before adding mutation controls.

**Boundary:** UI rendering only. No buttons that mutate jobs, credentials, files, approvals, or platform state.

**Status:** All UI panels complete and integrated into VOShell. 6 panels rendering with live data from Phase 0.8 APIs.

### 0.9.1 Global VO context bar ✅
- [x] Project selector (part of VOShell state)
- [x] VOShell manages tab navigation and context

### 0.9.2 Surfaces ✅
- [x] OverviewPanel: worker/selector health, active jobs, blockers, quota warnings, credential warnings, scheduled/published/failed counters
- [x] StudioPanel: tabs for Brief, Script, Media, Captions, Thumbnails, SEO, Preview (read-only)
- [x] PipelinesPanel: left-to-right stage map, run history table, stage detail drawer
- [x] AccountsPanel: platform account cards with connection state, adapter status, quota, scheduler policy
- [x] HistoryPanel: table for drafts, scheduled, published, failed packages with filters

**Exit criterion:** ✅ User can inspect the full VO operational state from Brain Console without knowing whether the source project is STB or another project.

---

## Phase 1W — Moving-Video-to-YouTube Approval Workflow ⏳ Current
> Complete the approval-gated path from real moving-video input through direct YouTube publishing

**Goal:** Prevent unauthorized publishing by requiring explicit thumbnail and metadata approvals before package queueing and direct YouTube upload.

**Status:** In progress. Task 1W-B audit is complete. Task 1W-A is implemented for the legacy audio-plus-image contract. Task 1W-C real moving-video intake and source update is complete and operator-confirmed. Task 1W-D thumbnail variants is complete with focused validation passing. Task 1W-E explicit thumbnail approval is complete with canonical persistence, active POST routing, a correct 405 contract, VO Studio write tests 67/67, thumbnail route tests 20/20, and typecheck passing. Task 1W-F YouTube metadata generation is complete: it resolves the canonical moving-video item, generates YouTube-only title, description, tags, and hashtags, rejects missing/cross-project items, and passed VO Studio write tests 69/69. Task 1W-G canonical YouTube metadata approval is complete and passed its focused persistence suite 6/6. Task 1W-H package queue, approval gates, idempotency, and direct OAuth2 YouTube upload is current; Task 1W-I remains incomplete until focused validation and operator confirmation.

### 1W.1 ApprovalQueuePanel integration ✅
- [x] ApprovalQueuePanel integrated into VOShell; "Approvals" tab visible
- [x] Panel loads approval queue from `/api/video-orchestrator/approvals/queue`
- [x] Shows pending items with type badge + timestamp + IDs
- [x] Click item → expand to show variants
- [x] Bulk select with "Approve Selected"/"Reject Selected" buttons

### 1W.2 Approval decision endpoints ✅
- [x] `POST /api/video-orchestrator/approvals/decide` wired
- [x] `POST /api/video-orchestrator/thumbnails/approve` wired
- [x] `POST /api/video-orchestrator/metadata/approve` wired
- [x] `GET /api/video-orchestrator/approvals/queue` wired
- [x] `POST /api/video-orchestrator/approvals/bulk-decide` added (Phase 2W)

### 1W.3 Approval decision logic ✅
- [x] `decideApprovalRequest()` implemented
- [x] Accepts approvalId, projectId, approved, variantId, rejectionReason
- [x] Updates approval record with status, decidedAt, decidedBy
- [x] If approved: triggers write commitment

### 1W.4 Audit & approval record schema ✅
- [x] `ApprovalRequest` interface defined: id, projectId, type, actor, requestedAt, requestPayload, preview, status, decidedBy, decidedAt, rejectionReason, expiresAt
- [x] Persistence: `~/.local/video-orchestrator/state/approvals.json`
- [x] Immutability: never rewrite after decided

### 1W.5 End-to-end validation ✅
- [x] ApprovalQueuePanel renders with pending list
- [x] Create approvals via API → appear in queue
- [x] Operator selects + approves → success + queue refreshes
- [x] All 5 write endpoints (content, metadata, thumbnail, package) create approval records

**Deliverable:** ✅ Content item creation, thumbnail generation, metadata generation, package queueing all gate on approval. Operator approves in VO Studio → write commits → pipeline continues.

---

## Phase 1 — Video Composition
> Audio + background → watchable composed video

**Goal:** The video uploaded to YouTube has a proper background, not just audio.

### 1.0 Tech debt fixes
- [x] **Remove platform-specific logic from `video_worker.py`** — `if platform == 'youtube'` replaced with `spec.get("direct_upload_handler")` lookup. `direct_upload_handler: "youtube"` field added to platform-specs.json. Guardrail #1 satisfied.
- [x] **DB migration: `scheduled_after TIMESTAMPTZ` added to `jobs` table** — worker job-claim query updated to respect it
- [x] **DB migration: `approval_status VARCHAR(20)` added to `jobs` table** — worker job-claim query updated to skip `pending_approval` jobs

### 1.1 Platform format config
- [x] `format-specs.json` — 5 format keys covering all aspect ratios; `platform-specs.json` — 2 YouTube entries with `direct_upload_handler`
- [x] Worker reads spec at runtime — no hardcoded platform logic

### 1.2 Composition module
- [x] `composer.py` — FFmpeg filtergraph per format key, static image and looping video backgrounds
- [x] One composed mp4 per format key; `artifact.composition` written with paths, codec, bitrate, duration

### 1.3 Audio normalization in pipeline
- [x] `audio_normalizer.py` — two-pass FFmpeg loudnorm to -14 LUFS / -1.0 dBFS peak
- [x] `artifact.audio` written with loudness stats and normalized path

### 1.4 Job artifact schema v1
- [x] `artifact.py` — Python `JobArtifact` dataclass + JSON round-trip (serialize/deserialize)
- [x] `vo-artifact.ts` — TypeScript mirror with `jobArtifactFromWire()` snake→camel decoder

### 1.5 Approval gate + manual fallback package
- [x] `execute_compose_job` sets `approval_status = pending_approval` after composition
- [x] `POST /infra/video-orchestrator/jobs/:id/approve` — Brain Core endpoint; worker picks up job on next poll
- [x] `POST /infra/video-orchestrator/jobs/:id/reject` — marks job failed
- [x] `fallback_package.py` — writes `fallback/` dir with video symlinks, subtitle links, `platform-metadata.json`, `README.md`

**Deliverable:** ✅ Queue a compose job → audio normalizes → video composes → fallback package written → job halts for approval → Brain Console POST approve → worker resumes → post job uploads to YouTube.

---

## Phase 2 — Subtitles
> Auto-generated SRT/VTT from source audio

**Goal:** Every video has subtitles. No SaaS transcription cost.

### 2.1 faster-whisper integration
- [x] `faster-whisper` installed in VO venv (Python 3.14 compatible, v1.2.1)
- [x] `subtitle_worker.py` — GPU: large-v3 FP16; CPU: distil-large-v3 int8; Silero VAD at 3.5s threshold
- [x] `artifact.subtitles` written with model, SRT path, VTT path, word count

### 2.2 New job type: `subtitle`
- [x] DB migration: `subtitle` added to `jobs_job_type_check` constraint
- [x] `execute_subtitle_job` registered in `JOB_EXECUTORS`

### 2.3 Subtitle delivery
- [x] SRT + VTT written to job output dir; symlinked into `fallback/` package
- [x] YouTube upload: `youtube_uploader.py` `upload_captions(video_id, srt_path)`

### 2.4 YouTube API quota tracking
- [x] `yt_quota.py` — state in `~/.local/video-orchestrator/state/yt-quota.json`; resets midnight Pacific
- [x] `execute_post_job`: quota gate before any YouTube upload; defers to next 01:00 if < 2,100 units
- [x] Quota consumed on successful upload (`video_insert` + `videos_update`)
- [x] Caption + thumbnail quota consumed on those operations

**Deliverable:** ✅ `subtitle` job type runs, transcribes audio, writes SRT/VTT to job dir. Quota gate prevents uploads when exhausted — defers to next batch window automatically.

---

## Phase 2W — Approval Advanced Features ✅ Complete
> Timeout, escalation, batch approvals, role-based (foundation)

**Goal:** Production-grade approval workflow: auto-reject expired approvals, notify operators, batch actions, foundation for role-based.

**Status:** All features complete and tested.

### 2W.1 Approval timeout + escalation ✅
- [x] Auto-reject approvals 24 hours after creation (configurable)
- [x] Escalation notification when within 5 minutes of expiry
- [x] `POST /api/video-orchestrator/approvals/check-expiry` endpoint for manual or scheduled sweep
- [x] Escalated IDs returned for operator notification

### 2W.2 Email notifications ✅
- [x] Notify operator when approval requested (gracefully falls back to console.log)
- [x] Notify when expiring soon (5-min warning)
- [x] Configurable recipient via `VO_OPERATOR_EMAIL` env var

### 2W.3 Bulk approval actions ✅
- [x] UI checkboxes on each pending approval item
- [x] "Select All" checkbox in header
- [x] "Approve Selected" and "Reject Selected" buttons
- [x] `POST /api/video-orchestrator/approvals/bulk-decide` endpoint
- [x] Batch operations: returns per-approval results

### 2W.4 Role-based foundation ✅
- [x] Approval store tracks `decisionRole` field (can specify who approved)
- [x] UI layer ready for role filters (Phase 2W.5+)
- [x] Test suite includes multi-role scenarios

**Deliverable:** ✅ Operator can batch-approve items, auto-rejections prevent stalled pipelines, email notifications keep operator informed.

---

## Historical Phase 6 Evidence — Direct Publishing Adapters 📋 Audit pending
> Multi-platform publishing with capability checks and fallback

**Goal:** Publish videos directly to YouTube, TikTok, Instagram with automatic n8n fallback if direct fails.

**Status:** All adapters implemented with stub endpoints and full test suite.

### 6.1 Platform publishing abstraction ✅
- [x] `publishToPlatform(request)` — unified entry point for all platforms
- [x] `PLATFORM_CAPABILITIES` registry: all 6 platforms with capabilities (duration limit, aspect ratios, direct_upload capability)
- [x] Validation checks: file size, title length, description length
- [x] Automatic fallback to n8n webhook if direct upload fails

### 6.2 Direct upload stubs ✅
- [x] YouTube stub: existing OAuth2 integration (Phase 0)
- [x] TikTok stub: validates metadata, returns mock response
- [x] Instagram stub: validates metadata, returns mock response

### 6.3 n8n fallback integration ✅
- [x] Falls back to webhook if direct upload unavailable or fails
- [x] `N8N_VIDEO_PUBLISH_WEBHOOK` env var configurable
- [x] Returns `fallbackMode: true` to indicate fallback used

### 6.4 API endpoints ✅
- [x] `GET /api/video-orchestrator/platforms/capabilities` — returns capability map
- [x] `POST /api/video-orchestrator/package/publish-direct` — triggers publish flow

### 6.5 Validation layer ✅
- [x] Validates video exists and file size OK
- [x] Validates title/description length against platform limits
- [x] Prevents publishing if validation fails (returns error with reason)

**Deliverable:** ✅ Operator approves final review → video published to YouTube/TikTok/Instagram directly or falls back to n8n.

---

## Phase 3 — Thumbnails
> Platform-aware, brand-consistent, A/B-testable

**Goal:** Every uploaded video has a custom thumbnail that matches brand guidelines.

### 3.1 Thumbnail design system
- [x] `thumbnail-templates.json` — `bold-text` and `minimal-curiosity` templates; brand defaults (`brand_line`, `label_text`, colors)
- [x] Layer schema: `background`, `scrim`, `text` with zone, font, shadow, wrap, padding, uppercase

### 3.2 Thumbnail generator (`thumbnail_generator.py`)
- [x] Pillow layer compositor (Pillow 12.2.0 installed); cover-fit background, gradient scrim, text with shadow
- [x] Font fallback chain: Inter TTF → system Helvetica → Pillow default
- [x] `generate_thumbnails()` → 2 variants (bold-text A, minimal-curiosity B); variant_a active
- [x] `artifact.thumbnail` written with variant paths, template IDs, ab_test_active flag

### 3.3 New job type: `thumbnail`
- [x] `thumbnail` already in DB constraint (was pre-existing)
- [x] `execute_thumbnail_job` registered in `JOB_EXECUTORS`
- [x] YouTube upload: `thumbnails.set` after video upload

### 3.4 Thumbnail studio in Brain Console
- [x] Template library card in VO view
- [x] Per-job thumbnail preview before publishing (approval queue preview)
- [x] A/B variant selector + manual headline edit in dedicated studio UI
- [x] `thumbnails.set` API call wired into `youtube_uploader.py`

### 3.5 A/B testing ✅
- [x] Analytics nightly: time-slice CTR comparison (Phase 1: switch variant after N days; Phase 2: compare CTR before/after switch). YouTube Test & Compare API unavailable, so using practical alternative: if variant B's CTR during its serving period is ≥5% higher than variant A's, declare B winner
- [x] Winner declaration workflow updates the active thumbnail and re-applies it via `thumbnails.set`
- [x] Manual override API: `POST /api/video-orchestrator/thumbnails/declare-winner` for operator-driven declaration with reason recording

**Deliverable:** ✅ `thumbnail` job type generates 2 JPG variants per video from configurable templates. Variant A is active by default. A/B test flag set.

---

## Phase 4 — SEO Metadata
> LLM-generated, platform-specific, human-reviewable

**Goal:** Every video has a complete description, tags, and chapters. No blank description fields.

### 4.1 Metadata generator (`metadata_generator.py`)
- [x] Input: episode_title + transcript_excerpt + target_platforms + series + duration_minutes
- [x] LLM routed via AI Model Selector (`metadata_generation` task type) — never calls provider directly
- [x] Reports failures back to selector via `report_ai_failure`
- [x] Analytics-informed: queries top 10 videos by CTR from `performance_metrics`, injects as `{top_performing_titles}`
- [x] Outputs: description, tags (15 max), chapters (if duration known), hashtags per platform

### 4.2 Prompt system
- [x] `metadata-prompts.json` — 4 prompts: `youtube_description`, `youtube_tags`, `youtube_title_variants`, `chapters`
- [x] Variables: `{episode_title}`, `{series}`, `{transcript_excerpt}`, `{top_performing_titles}`, `{duration_minutes}`
- [x] Faith-based system prompts for YeshuaAcademy channel

### 4.3 New job type: `metadata`
- [x] DB migration: `metadata` added to `jobs_job_type_check`
- [x] `execute_metadata_job` registered in `JOB_EXECUTORS`

### 4.4 Metadata review in Brain Console
- [x] Per-job metadata preview and edit before publishing (approval queue preview)

### 4.5 YouTube upload uses metadata
- [x] `execute_post_job` reads finalized artifact metadata and passes title/description/tags into the YouTube upload + metadata update flow

**Deliverable:** ✅ `metadata` job type generates description/tags/chapters via LLM, analytics-informed, through AI Model Selector. DB migration adds `impressions`, `ctr`, `avg_view_duration_sec` to `performance_metrics`.

---

## Phase 5 — Analytics Feedback Loop
> Performance data closes back to content decisions

**Goal:** Every published video's performance is tracked. Top-performing content informs new metadata generation.

### 5.1 Analytics sync worker
- [x] `analytics_sync.py` — extended with YouTube Reporting API path
- [x] **YouTube Reporting API** `setup_reporting_job()` + `fetch_reporting_csv()` — bulk daily CSV (1 quota unit); `analytics_sync.py reporting-setup` / `reporting-fetch` CLI commands
- [x] Fetches impressions, CTR, views, avg_view_duration_sec per video
- [x] Upserts to `performance_metrics` (impressions, ctr, avg_view_duration_sec, updated_at columns added)
- [x] `sync_all()` automatically calls Reporting API fetch when job is configured

### 5.2 Feedback context for metadata generation
- [x] `metadata_generator.py` `_fetch_top_performing_titles()` — queries top 10 videos by CTR from `performance_metrics` JOIN `jobs`
- [x] Top titles injected as `{top_performing_titles}` variable in YouTube description + tags prompts
- [x] Falls back to "(no data yet)" gracefully on empty DB

### 5.3 A/B winner declaration
- [x] `declare_ab_winners()` in `analytics_sync.py` — checks `ab_test_active=true` jobs with `>= 300` impressions
- [x] Declares the current active variant as winner; sets `ab_test_active=false`, updates variant `active` flags, writes `winner_declared_at`, and re-applies the winning thumbnail via `thumbnails.set`
- [x] `analytics_sync.py ab-check [--dry-run]` CLI command
- [x] Runtime capability explicitly reports Test & Compare automation as manual YouTube Studio only until an official developer API is confirmed
- [blocked external dependency] Per-variant CTR comparison requires an official YouTube developer API surface; current flow intentionally does not automate Studio-only experiments
- [x] `thumbnails.set` API call after winner declaration

### 5.4 Analytics in Brain Console
- [x] Per-video analytics card
- [x] Channel summary: rolling 7d/30d totals
- [x] Thumbnail A/B test status: active, winner declared

**Deliverable:** ✅ `reporting-setup` creates YouTube Reporting job. `reporting-fetch` downloads daily CSV and upserts impressions/CTR/duration into `performance_metrics`. Metadata generation pulls top-performing titles as LLM context. A/B winner declaration runs via `ab-check` command.

---

## Historical Phase 6 Evidence — Multi-Platform Full Stack 📋 Audit pending
> Facebook, Pinterest, TikTok, Instagram via n8n + platform-specific metadata

**Goal:** A single `vo queue pipeline` command produces and publishes to all connected platforms.

### 6.1 n8n workflows per platform ✅
- [x] Facebook workflow: page post with video + description
- [x] Pinterest workflow: pin with thumbnail + description + board routing
- [x] TikTok workflow: short-form post with platform description
- [x] Instagram Reels: post with caption + hashtags

### 6.2 Platform-specific metadata ✅
- [x] Metadata generator produces platform-specific copy for all active platforms (YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest)
- [x] Character limit enforcement per platform (500 chars Facebook, 280 X, etc.)
- [x] Platform-specific prompts in metadata-prompts.json with faith-based YeshuaAcademy voice

### 6.3 Full pipeline command ✅
```bash
vo queue pipeline \
  --audio episode.mp3 \
  --background series-bg.jpg \
  --title "Genesis — Noah" \
  --platforms youtube,facebook,pinterest \
  --account 303e91f9
```
This queues: normalize → subtitle → compose → thumbnail → metadata → multi_post (all platforms)

---

## Phase 7 — Production Hardening
> Reliability, observability, recovery

- [x] Job retry with exponential backoff (non-blocking via scheduled_after)
- [x] Dead letter review in Brain Console (read-only operator review tab)
- [x] Worker health endpoint and dashboard card
- [x] Artifact versioning — preserve previous artifacts in `task_config.artifact_versions`
- [x] Storage cleanup — archive completed job output files after 30d, keep artifact forever
- [x] VO view in Brain Console shows per-job module progress (Jobs tab)

---

## Phase 10 — Webhook Events & Analytics ✅ Complete
> Event streaming, dashboard health, webhook security

**Goal:** VO Studio has real-time event visibility and operational dashboard showing pipeline health, routing stats, webhook delivery, and recent activity.

**Boundary:** Read-only event log and analytics surfaces. No event mutations or webhook modifications.

### 10.1 Event streaming infrastructure
- [x] Webhook handler (processWebhookEventRequest, verifyWebhookSignatureRequest, routeEventRequest)
- [x] Event processor (emitEventRequest, acknowledgeEventRequest, subscribeToEventsRequest)
- [x] Analytics endpoints (readWebhookDeliveryRates, readEventLatencyMetrics, readRoutingStatistics, readPipelineHealth)
- [x] Webhook security (rotateWebhookSecretRequest, disableWebhookRequest, readWebhookSecurityAudit, readWebhookStatus)
- [x] EventLogPanel UI with 15-second auto-refresh

### 10.2 Dashboard Panel
- [x] StudioDashboardPanel (Phase 10) — Pipeline health, routing stats, webhook summary, recent events, quick actions
- [x] 60-second auto-refresh with Promise.allSettled
- [x] Operational summary: health score + status badge, platform routing count, event delivery rates, last 5 events

### 10.3 Brain Console integration (Phase 11)
- [x] Remove Studio/Orchestrators/Pipelines from top-level SECTION_TABS
- [x] Add single "Video Orchestrator" root tab
- [x] Create renderVideoOrchestratorSection() to host VOShell
- [x] CSS styling for scoped VO container
- [x] Keep the shared console read-only for project-specific workflows

**Deliverable:** ✅ Backend: event routing, webhook security, analytics read paths. UI: Dashboard panel + EventLogPanel. Phase 10: VO internal dashboard. Phase 11: Brain Console integration and scoped "Video Orchestrator" section.

---

## Phase 11 — Brain Console VO Studio Integration ✅ Complete
> Scoped VO section with unified internal tabs

**Goal:** Video Orchestrator is a unified scoped section within Brain Console with shared health, usage, approvals, and orchestrator visibility, not competing top-level tabs or project-specific authoring surfaces.

**Boundary:** UI restructuring and integration. No backend changes.

### 11.1 Tab restructuring
- [x] Remove Studio, Orchestrators, Pipelines from SECTION_TABS (3 entries removed)
- [x] Add single "Video Orchestrator" entry to SECTION_TABS
- [x] Update BrainConsoleSectionId type (removed 3 values, added video-orchestrator)

### 11.2 VOShell mounting
- [x] Create renderVideoOrchestratorSection() function
- [x] Mount VOShell in scoped .vo-studio-container
- [x] Pass state data (projects, accounts, profiles, contentItems, selector, analytics, accountStats) to VOShell

### 11.3 CSS for VO container
- [x] .vo-studio-container — full-height flex layout with dark theme
- [x] .vo-studio-tabs-row — horizontal tab bar with scrollable overflow
- [x] .vo-studio-content — scrollable area matching Brain Console viewport
- [x] Responsive fallback for narrow viewports (<768px)
- [x] CSS variables inherited from Brain Console (--bg-primary, --accent-warm, --text-primary)

**Exit criterion:** User clicks "Video Orchestrator" root tab and sees unified internal tabs. No Studio/Orchestrators/Pipelines as separate entries in top navigation. Information is readable and responsive.

**Deliverable:** ✅ Brain Console top navigation is organized and clear. VO is scoped within unified "Video Orchestrator" section. Shared read-only visibility is available without project-specific authoring tabs.

---

## Phase Next — Five Implementation Steps ✅ Complete

**Implemented in the codebase:**

1. Real AI provider paths are wired in the orchestrator with safe fallback behavior.
2. Job progress UI exists and is integrated into Brain Console.
3. Approval previews for thumbnails and metadata are available.
4. Metadata generation exists and returns preview payloads.
5. Analytics feedback loop exists and is surfaced in Brain Console.

**See:** `IMPLEMENTATION-PLAN-NEXT-PHASE.md` for the historical record of the completed work.

---

## Phase Sequencing (Updated)

```
Phase 0 ✅ → Phase 0.5 ✅ → Phase 0.6 ✅ → Phase 0.5R ✅ → Phase 0.7 ✅ → Phase 0.8 ✅ → Phase 0.9 ✅ → Phase 1W ⏳
Foundation   Selector v1    Dual-node    Gemini policy   Agents        Read model   Console UI   Moving-video-to-YouTube workflow

Phase 2W ✅ → Phase 6 🔲
Approval advances complete   Further multi-platform expansion deferred/future

Current: Phase 1W is the sole authorized implementation focus. Existing approval and publishing components must be audited against Tasks 1W-B through 1W-I, completed where missing, tested in order, and operator-confirmed before the phase is marked complete.

Phase 0.7 is complete.
Phase 1-5 processing foundations are implementation evidence, not proof that the end-to-end moving-video-to-YouTube workflow is complete.
Later roadmap work remains blocked until Phase 1W completion and explicit authorization.
```

---

## Immediate Next Steps

**Next session:** Execute Task 1W-B only: audit Tasks 1W-A through 1W-I against the current codebase, correct their documented status, and identify the first genuinely missing moving-video-to-YouTube task. Do not begin implementation until the audit is reviewed and operator-approved.

**Session handoff:** `SESSION-HANDOFF-2026-05-24.md` — context snapshot. `CODEX-NEXT-SESSION-PROMPT.md` — Codex pickup script.

**Quick start:**
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run typecheck && npm test  # Should pass (997 tests)
# Review the remaining open roadmap items
```
