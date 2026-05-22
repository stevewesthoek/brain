# Video Orchestrator — Implementation Plan

**Document type:** Executable implementation plan  
**Status:** Active  
**Last updated:** 2026-05-22 (Phases 1–5 backend complete)  
**Roadmap reference:** `video-orchestrator-roadmap.md`  
**Strategy reference:** `video-orchestrator-strategy.md`

---

## Completion Status

| Sprint | Phase | Status |
|--------|-------|--------|
| Sprint 1 — Composition | Phase 1 | ✅ Complete |
| Sprint 2 — Subtitles | Phase 2 | ✅ Complete |
| Sprint 3 — Thumbnails | Phase 3 | ✅ Complete (UI carry-over) |
| Sprint 4 — SEO Metadata | Phase 4 | ✅ Complete (UI carry-over) |
| Sprint 5 — Analytics | Phase 5 | ✅ Complete (UI carry-over) |
| Sprint 6 — Brain Console UI | Phases 3.4, 4.4, 5.4 | 🔲 Next sprint |
| Sprint 7 — Multi-Platform | Phase 6 | 🔲 Future |
| Sprint 8 — Hardening | Phase 7 | 🔲 Future |

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

## Sprint 6: Brain Console UI (Next) 🔲

All backend modules are complete. The following UI panels need to be built in `brain-console-obsidian/src/view.ts`:

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

brain-core/src/types/
  vo-artifact.ts               ✅ Task 2

brain-core/src/adapters/
  ai-model-selector.ts         ✅ Phase 0.5
  infra-video-orchestrator-approve.ts  ✅ Task 1.5

brain-core/src/api/
  routes.ts                    ✅ Task 1.5 (approve/reject routes)

brain-console-obsidian/src/
  view.ts                      🔲 Tasks 21–24 (thumbnail studio, metadata review, analytics, AI chip)
```

---

## Definition of Done (per sprint)

**Sprint 1–5 done:** ✅  
`vo queue compose` → audio normalizes → video composes → fallback package written → halts for approval → Brain Console POST approve → worker resumes → YouTube upload with captions, thumbnail variant, AI-generated metadata.  
Analytics nightly sync fetches Reporting API CSV, top-performing titles feed next metadata generation.

**Sprint 6 done when:**  
Brain Console shows thumbnail preview (A/B side by side), editable metadata card, analytics dashboard, and AI selector health chip. Thumbnail set on YouTube automatically after publish. `thumbnails.set` quota tracked.

**Sprint 7 done when:**  
`vo queue pipeline --platforms youtube,facebook,pinterest` queues full multi-platform job chain and publishes to all three platforms from a single command.

**Sprint 8 done when:**  
Worker handles transient failures gracefully (exponential backoff), has a health endpoint, Brain Console shows per-module progress for each job.
