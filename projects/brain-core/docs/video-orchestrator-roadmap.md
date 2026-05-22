# Video Orchestrator — Roadmap

**Document type:** Phased roadmap  
**Status:** Active  
**Last updated:** 2026-05-22 (roadmap/status sweep; Sprint 0C next)
**Strategy reference:** `video-orchestrator-strategy.md`

---

## Current State (as of 2026-05-22)

**Working:**
- Job queue with normalize, compose, subtitle, thumbnail, metadata, post, multi_post, render, and screen_record job types
- YouTube direct upload via OAuth2 (keychain-persisted token, auto-refresh)
- n8n dispatch fallback with CF Access headers
- Brain Console: Accounts & Credentials tab (all STB/infra credentials set)
- Worker LaunchAgent running, picks up jobs automatically
- Backend VO pipeline through Phase 5: composition, subtitles, thumbnails, metadata, analytics feedback, and approval gate
- AI Model Selector running at `localhost:4890` with local Ollama M4/M1 first, Codex CLI second, Bedrock fallback third

**Current active gap:**
- Agent Orchestrator Sprint 0C needs the read-only capability registry before any autonomous run execution work.
- Read-only agent ledger, task graph, and task-state snapshots are now exposed, and Brain Core can write and reload the snapshot JSON. The remaining gap is executor selection records, approval-bound execution, and live console visibility.

**Remaining VO product gaps:**
- Brain Console UI panels for thumbnails, metadata review, analytics, and AI selector health
- YouTube `thumbnails.set` publish wire and quota deduction
- Multi-platform publishing expansion beyond YouTube/n8n fallback

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
> Local-first AI routing for all generation tasks

**Goal:** Every AI-dependent module calls one unified selector, never an LLM API directly. Local models are preferred first; Codex CLI is the subscription-backed second tier; Amazon Bedrock Claude is the paid fallback.

**Naming clarity:** The AI Model Selector (`localhost:4890`) is NOT the same as Mind Steward (TypeScript Brain Core project). They are completely different. AI Model Selector = LLM routing engine.

**Inference stack decision:** Ollama is the inference server on both machines. LM Studio is not used for serving — only optionally for downloading model files on M4 Pro.

### 0.5.1 Config files
- [x] `~/.config/video-orchestrator/ai-providers.json` — providers registered
- [x] `~/.config/video-orchestrator/ai-task-types.json` — 7 task types defined
- [x] `~/.config/video-orchestrator/ai-selector-config.json` — batch window, defer config

### 0.5.2 Selector service
- [x] `~/.local/video-orchestrator/services/model-selector/selector_service.py` — live at `localhost:4890`
- [x] `core.py` — full selection algorithm with health, rate-limit, context, and local model gates
- [x] `client.py` — Python client helper (stdlib only, no httpx required)
- [x] Rate limit state persisted to `~/.local/video-orchestrator/state/rate-limits.json`
- [x] Audit log at `~/.local/video-orchestrator/logs/ai-selections.jsonl`
- [x] LaunchAgent `com.office.ai-model-selector` running (KeepAlive, RunAtLoad)

### 0.5.3 CLI shim + TypeScript client
- [x] `~/.local/bin/ai-select` — bash/curl wrapper, usable from any shell or AI agent
- [x] `brain-core/src/adapters/ai-model-selector.ts` — TypeScript client for Node.js apps
- [ ] Brain Console VO view: AI selector health chip (running/stopped, current provider) — Sprint 6

### 0.5.4 Platform architecture doc
- [x] `brain/docs/platform-architecture.md` — canonical scaffold standard for all projects

**Deliverable:** ✅ `ai-select --task metadata_generation` returns a routing decision. Ollama is chosen when capable and healthy; Codex CLI is the next fallback; Amazon Bedrock Claude is the paid fallback. Direct OpenAI API and direct Anthropic API are not valid providers.

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

## Phase 0.7 — Brain Agent Orchestrator 🔲 Active Next
> Multi-agent project execution layer above the AI Model Selector

**Goal:** Add agent mode as a Brain Core orchestration layer that can plan and coordinate full projects using local AI, Codex CLI, Amazon Bedrock Claude, existing orchestration skills, and approved infrastructure CLIs.

**Boundary:** The Agent Orchestrator is not the AI Model Selector. The selector chooses an AI execution surface. The orchestrator decomposes work, assigns tasks, calls skills/CLIs, records run state, handles handoffs, and asks for approval before risky actions.

### 0.7.1 Research and architecture
- [x] NotebookLM and research-orchestrator synthesis completed
- [x] Research note: `agent-orchestrator-research-2026-05-22.md`
- [x] Architecture doc: `agent-orchestrator-architecture.md`

### 0.7.2 Read-only capability registry
- [ ] 0C-B1: Add a static `agent-capabilities` adapter with seed skill/CLI/AI-surface records and tests
- [ ] 0C-B2: Add skill frontmatter discovery for `/code`, `/design`, `/research`, `/web`, `/video`
- [ ] 0C-B3: Add CLI capability manifest for Cloudflare, Dokploy, AWS, Azure, GCP, Hetzner, Tailscale, Stripe, n8n, GitHub
- [ ] 0C-B4: Add AI execution surface adapter that reads AI Model Selector `/providers` with timeout-safe fallback
- [ ] 0C-B5: Expose `GET /api/agent/capabilities`
- [ ] 0C-B6: Add CLI smoke command: `brain-agent capabilities`

### 0.7.3 Run ledger and task graph
- [ ] Persist agent runs, steps, selected executors, selected model/provider, commands, files touched, approvals, verification output, and unresolved risk
- [ ] Represent large work as a task graph with dependencies and status
- [ ] Support handoff summaries between research, code, design, web, and video tasks

### 0.7.4 Selector-aware executor dispatch
- [ ] Route each LLM task through the AI Model Selector
- [ ] Prefer M4/M1 local models for tasks they can handle
- [ ] Use Codex CLI when local quality is insufficient or local nodes are unavailable/rate-limited
- [ ] Use Amazon Bedrock Claude only as the paid fallback
- [ ] Allow parallel local work on M4 and M1 for independent simple tasks

### 0.7.5 Approval and safety gates
- [ ] Default mode is read-only planning and verification
- [ ] Require explicit approval for file writes, commits, pushes, deploys, DNS changes, database mutations, destructive commands, and credential-sensitive operations
- [ ] Record every approval decision in the run ledger

### 0.7.6 Brain Console Agent View
- [ ] Show active runs, task graph, selected providers, running CLIs, blocked approvals, and verification results
- [ ] Provide approve/reject controls for gated steps

**Deliverable:** `brain-agent capabilities` and Brain Core `GET /api/agent/capabilities` show registered skills, CLI capabilities, and AI execution surfaces. A dry-run agent plan can be recorded without mutating files or infrastructure.

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
- [ ] YouTube upload: `youtube_uploader.py` `upload_captions(video_id, srt_path)` — Phase 2.3 carry-over

### 2.4 YouTube API quota tracking
- [x] `yt_quota.py` — state in `~/.local/video-orchestrator/state/yt-quota.json`; resets midnight Pacific
- [x] `execute_post_job`: quota gate before any YouTube upload; defers to next 01:00 if < 2,100 units
- [x] Quota consumed on successful upload (`video_insert` + `videos_update`)
- [ ] Caption + thumbnail quota consumed on those operations (wired when those modules land)

**Deliverable:** ✅ `subtitle` job type runs, transcribes audio, writes SRT/VTT to job dir. Quota gate prevents uploads when exhausted — defers to next batch window automatically.

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
- [ ] YouTube upload: `thumbnails.set` after video upload — carry-over to 3.4

### 3.4 Thumbnail studio in Brain Console
- [ ] Template library card in VO view
- [ ] Per-job thumbnail preview before publishing
- [ ] A/B variant selector + manual headline edit
- [ ] `thumbnails.set` API call wired into `youtube_uploader.py`

### 3.5 A/B testing
- [ ] Analytics nightly: compare CTR per variant; declare winner at 300+ impressions

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
- [ ] Per-job metadata preview and edit before publishing (UI — carry-over)

### 4.5 YouTube upload uses metadata
- [ ] `youtube_uploader.py` reads `artifact.metadata.youtube_standard` (carry-over)

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
- [x] Declares variant_a winner; sets `ab_test_active=false` + `winner_declared_at` in JSONB via `jsonb_set`
- [x] `analytics_sync.py ab-check [--dry-run]` CLI command
- [ ] Per-variant CTR comparison requires YouTube Test & Compare API (future; current: variant_a default winner)
- [ ] `thumbnails.set` API call after winner declaration (carry-over — uploader scaffolded, not wired here)

### 5.4 Analytics in Brain Console
- [ ] Per-video analytics card: impressions, CTR, views, avg duration
- [ ] Channel summary: rolling 7d/30d totals
- [ ] Thumbnail A/B test status: active, winner declared

**Deliverable:** ✅ `reporting-setup` creates YouTube Reporting job. `reporting-fetch` downloads daily CSV and upserts impressions/CTR/duration into `performance_metrics`. Metadata generation pulls top-performing titles as LLM context. A/B winner declaration runs via `ab-check` command.

---

## Phase 6 — Multi-Platform Full Stack
> Facebook, Pinterest, TikTok, Instagram via n8n + platform-specific metadata

**Goal:** A single `vo queue pipeline` command produces and publishes to all connected platforms.

### 6.1 n8n workflows per platform
- [ ] Facebook workflow: page post with video + description
- [ ] Pinterest workflow: pin with thumbnail + description + board routing
- [ ] TikTok workflow: short-form post with platform description
- [ ] Instagram Reels: post with caption + hashtags

### 6.2 Platform-specific metadata
- [ ] Metadata generator produces platform-specific copy for all active platforms
- [ ] Character limit enforcement per platform
- [ ] Hashtag sets per platform (Pinterest: SEO keyword tags; Instagram: discovery hashtags)

### 6.3 Full pipeline command
```bash
vo queue pipeline \
  --audio episode.mp3 \
  --background series-bg.jpg \
  --title "Genesis — Noah" \
  --platforms youtube,facebook,pinterest \
  --account 303e91f9
```
This queues: normalize → subtitle → compose → thumbnail → metadata → publish (all platforms)

---

## Phase 7 — Production Hardening
> Reliability, observability, recovery

- [ ] Job retry with exponential backoff (currently max_retries=3 flat)
- [ ] Dead letter review in Brain Console (not just CLI)
- [ ] Worker health endpoint and alerting (currently only launchctl PID check)
- [ ] Artifact versioning — store v1/v2 of artifact when metadata regenerated
- [ ] Storage cleanup — archive completed job output files after 30d, keep artifact forever
- [ ] VO view in Brain Console shows per-job module progress (composition ✅, subtitles ⏳, etc.)

---

## Phase Sequencing

```
Phase 0 ✅ → Phase 0.5 ✅ → Phase 0.6 ✅ → Phase 0.7 🔲 → Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ✅ → Phase 5 ✅ → Phase 6 🔲 → Phase 7 🔲
Foundation   AI Selector    Dual-node    Agents      Compose   Subtitles  Thumbs    SEO Meta   Analytics  All Plat   Hardening

Phase 0.5 must complete before Phase 3 (thumbnails) and Phase 4 (metadata) — they depend on AI.
Phase 0.7 is now the active next phase because agent dispatch must consume the local-first selector.
Phase 1 and Phase 2 are independent of Phase 0.5 (FFmpeg work, no AI needed).
Phase 3 and Phase 4 can run in parallel after Phase 0.5.
```

---

## Immediate Next Steps

**Next Codex/GPT-5.4-Mini implementation step:** Sprint 0C-B1 — add the static Agent Capability Registry adapter and tests.

This creates the agent orchestrator foundation without granting autonomous write/deploy power.
