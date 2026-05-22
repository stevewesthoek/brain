# Handoff — Agent Orchestrator Sprint 0C Next

**Date:** 2026-05-22
**Git:** latest pushed main should include the planning sweep after commit
**Next agent:** GPT-5.4-Mini or Codex Mini
**Next task:** Sprint 0C-E — Approval gates

---

## Where We Are

The Video Orchestrator backend pipeline is built through Phase 5, and the AI Model Selector is documented as local-first with M4/M1 Ollama, Codex CLI, and Bedrock fallback. The active next work is not Sprint 6 UI. The active next work is Sprint 0C: Brain Agent Orchestrator, starting with a read-only capability registry.

**Completed backend/platform items:**
- Phase 0.5 — AI Model Selector (`localhost:4890`) routing all LLM calls
- Phase 0.6 — dual-node local Ollama + circuit breaker/defer/timeout/scheduler resilience
- Phase 1 — Audio normalize → video compose → fallback package → approval gate
- Phase 2 — Subtitles (faster-whisper), YouTube caption upload, quota tracking
- Phase 3 — Thumbnail generation (Pillow, 2 variants), A/B flag in artifact
- Phase 4 — Metadata generation (AI Model Selector, analytics-informed), YouTube metadata update
- Phase 5 — YouTube Reporting API bulk sync, A/B winner declaration
- Phase 0.7-A — Agent Orchestrator research and architecture docs

**Active next (Sprint 0C-E):**
- Build approval gate records in Brain Core.
- Current Mini slice: `Task 0C-E — Approval gates`.

**Still pending later (Sprint 6):**
- Brain Console UI: thumbnail studio, metadata review panel, analytics dashboard, AI health chip
- Two backend wires: `thumbnails.set` call in `execute_post_job`, `thumbnails_set` quota deduction

---

## Architecture Snapshot

```
Job pipeline (Python, ~/.local/video-orchestrator/):
  worker/video_worker.py        Main dispatcher, all JOB_EXECUTORS registered
  worker/artifact.py            JobArtifact schema — travels with every job
  worker/audio_normalizer.py    FFmpeg loudnorm -14 LUFS
  worker/composer.py            FFmpeg filtergraph, 5 format outputs
  worker/fallback_package.py    Manual fallback dir writer
  worker/subtitle_worker.py     faster-whisper transcription
  worker/thumbnail_generator.py Pillow compositor, 2 JPG variants
  worker/metadata_generator.py  LLM via AI Model Selector
  worker/yt_quota.py            YouTube quota state (2100 units/video)
  scripts/youtube_uploader.py   OAuth2 upload + captions + metadata update
  scripts/analytics_sync.py     Reporting API + A/B winner declaration

Brain Core (TypeScript, brain/projects/brain-core/):
  src/adapters/capabilities.ts                    Existing general Brain Core capability manifest
  src/adapters/agents.ts                          Existing agent placeholder registry
  src/adapters/agent-runs.ts                      Existing placeholder run/event surfaces
  src/adapters/infra-video-orchestrator-approve.ts  approve/reject
  src/adapters/ai-model-selector.ts                 TS client for AI Selector
  src/types/vo-artifact.ts                          TS mirror of artifact.py
  src/api/routes.ts                                 approve/reject routes

Config (~/.config/video-orchestrator/):
  platform-specs.json           Platform posting rules
  format-specs.json             5 format key dimensions/bitrates
  thumbnail-templates.json      bold-text + minimal-curiosity
  metadata-prompts.json         4 LLM prompts
  ai-providers.json + ai-task-types.json  AI selector config
```

---

## Agent Orchestrator Docs To Read First

Read these in order:

1. `projects/brain-core/docs/video-orchestrator-implementation-plan.md`
2. `projects/brain-core/docs/agent-orchestrator-architecture.md`
3. `projects/brain-core/docs/agent-orchestrator-research-2026-05-22.md`
4. `projects/brain-core/docs/ai-model-selector-architecture.md`
5. `projects/brain-core/docs/video-orchestrator-roadmap.md`

The implementation plan is canonical for task status.

---

## Sprint 0C-D Snapshot Result

Completed. Brain Core now exposes a read-only executor-plan surface that records intended executor/provider/model choices for each task and can persist/reload that snapshot JSON. The next gap is approval-bound execution gating.

## Sprint 0C-C Snapshot Result

Completed. `brain-agent capabilities` is wired as a smoke command, `/api/agent/capabilities` is exposed over Brain Core, CLI capability records are normalized, AI surfaces come from the live selector when available with static fallback when unavailable, and read-only `/agent-ledger` + `/agent-task-graph` + `/agent-task-state` snapshot endpoints are now exposed.

---

## DB State

```sql
-- jobs table extra columns
scheduled_after TIMESTAMPTZ   -- worker skips jobs scheduled in future
approval_status VARCHAR(20)   -- pending_approval | approved | auto_approved | rejected

-- jobs_job_type_check constraint includes:
-- render, normalize, screen_record, compose, subtitle, thumbnail, metadata, post, multi_post

-- performance_metrics extra columns (Phase 5 migration)
impressions INTEGER DEFAULT 0
ctr FLOAT DEFAULT 0.0
avg_view_duration_sec INTEGER DEFAULT 0
updated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Later Carry-Overs for Sprint 6

### Backend carry-over 1: Wire `thumbnails.set` into post job
**File:** `~/.local/video-orchestrator/worker/video_worker.py` in `execute_post_job()`
After `upload_video()` succeeds and `artifact.thumbnail.variants` is populated:
```python
if artifact.thumbnail and artifact.thumbnail.status == "completed":
    active_variant = next((v for v in artifact.thumbnail.variants if v.active), None)
    if active_variant:
        uploader.set_thumbnail(account_handle, video_id, active_variant.path)
        yt_quota.consume("thumbnails_set")
```
`set_thumbnail()` method needs to be added to `youtube_uploader.py` — it uses `thumbnails.set` API.

### Backend carry-over 2: Per-variant A/B CTR
`declare_ab_winners()` in `analytics_sync.py` currently declares `variant_a` by default.
True per-variant comparison requires YouTube Test & Compare API. Mark as future when wiring thumbnails.set.

---

## Later Sprint 6 Task List

### Task 21 — Thumbnail studio (Brain Console)
**New Brain Core endpoints:**
```typescript
// GET /infra/video-orchestrator/jobs/:id/thumbnails
// Returns: { variants: [{id, path, template, active}], ab_test_active, impressions, winner }
// Read from task_config->'artifact'->'thumbnail'

// PATCH /infra/video-orchestrator/jobs/:id/thumbnail-headline
// Body: { headline_text: string }
// Re-runs thumbnail generator with new headline, updates artifact
```

**UI in `brain-console-obsidian/src/view.ts`:**
- Fetch job artifact on job detail open
- Show variant_a and variant_b as `<img>` side by side (base64 or file path)
- Headline text `<input>` → PATCH → regenerate
- "Upload to YouTube" button → calls `thumbnails.set` carry-over endpoint
- Chip: "A/B Active (Xk impr)" / "Winner: A" / "No thumbnail"

### Task 22 — Metadata review panel (Brain Console)
**New Brain Core endpoints:**
```typescript
// GET /infra/video-orchestrator/jobs/:id/artifact
// Returns full artifact JSON from task_config->'artifact'

// PATCH /infra/video-orchestrator/jobs/:id/metadata
// Body: { title?: string, description?: string, tags?: string[] }
// Writes back into task_config->'artifact'->'metadata'->'platforms'->'youtube_standard'
```

**UI:**
- Editable title input, description textarea, tags (pill list)
- "Regenerate" → queues new `metadata` job for this job_id
- "Approve" button → sets `task_config.metadata_approved = true`
- Status chip: pending (yellow) / approved (green) / published (blue)

### Task 23 — Analytics dashboard panel (Brain Console)
**New Brain Core endpoints:**
```typescript
// GET /infra/video-orchestrator/analytics/summary
// Returns: { total_videos, total_views, avg_ctr, avg_duration, top_videos: [{title, ctr, views, impressions}] }
// SELECT from performance_metrics JOIN jobs

// GET /infra/video-orchestrator/analytics/videos
// Returns paginated list ordered by CTR DESC
```

**UI:**
- Summary bar at top of VO view: total videos, total views, avg CTR, avg duration
- Sortable table: title | impressions | CTR | views | avg duration | A/B status

### Task 24 — AI selector health chip (Brain Console)
**New Brain Core endpoint:**
```typescript
// GET /infra/ai-selector/health
// Proxies: GET http://localhost:4890/health with 2s timeout
// Returns: { running: boolean, provider?: string, model?: string }
```

**UI:**
- Small chip in VO view header, right-aligned
- Green: current AI Model Selector provider/model, typically local Ollama first
- Red: "AI Selector offline"
- Poll every 30s (not on every render)

---

## Brain Console UI Context

The Brain Console is an Obsidian plugin at `brain/projects/brain-console-obsidian/`.
UI entry point: `src/view.ts` — one large class `BrainConsoleView`.
Brain Core HTTP runs at `localhost:3000` (local Node.js server from `brain/projects/brain-core/`).
Pattern used throughout: fetch JSON from Brain Core endpoint → render HTML via `setInnerHTML` or DOM manipulation.
The VO view section starts around line 450 in `view.ts` (search for `video-orchestrator` or `VO Jobs`).

New endpoints go in:
1. `brain-core/src/api/routes.ts` — URL matching + handler call
2. `brain-core/src/adapters/infra-video-orchestrator-*.ts` — DB query or Python subprocess

---

## Resume Prompt For GPT-5.4-Mini

```text
You are GPT-5.4-Mini working in /Users/Office/Repos/stevewesthoek/brain.

Start by reading:
1. AGENTS.md
2. .ai/handoffs/2026-05-22-vo-phases-1-5-complete.md
3. projects/brain-core/docs/video-orchestrator-implementation-plan.md
4. projects/brain-core/docs/agent-orchestrator-architecture.md

Your next task is Sprint 0C-E only: build approval gate records on top of the existing read-only capability registry, ledger, task graph, task-state, and executor-plan snapshot endpoints.

Start by reading:
1. AGENTS.md
2. .ai/handoffs/2026-05-22-vo-phases-1-5-complete.md
3. projects/brain-core/docs/video-orchestrator-implementation-plan.md
4. projects/brain-core/docs/agent-orchestrator-architecture.md

Focus on approval gating state and persistence only. Do not implement execution mutations in this slice.

Run:
cd projects/brain-core
npm run build
node --test dist/tests/*.test.js

When done, update the implementation plan to mark the run ledger/task graph task complete if the work is finished, and push only your changes to main.
```
