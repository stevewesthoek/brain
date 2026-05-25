# Video Orchestrator — Features

## Overview

Video Orchestrator is the shared video generation and distribution engine for multiple project repos. It produces shared artifacts and orchestrates jobs for content that project-specific admin panels send to Brain Core API.

**Architecture:** Project repos own the admin UI and project-specific content decisions. Brain Core owns the shared processing engine, job state, approvals, and observability.

---

## Phase 0–5.2: Current Features

### Phase 0: Job Queueing & Orchestration
**Status:** ✅ Complete

Jobs are queued via REST API and processed sequentially with dependency chaining (`depends_on`).

**Job types:**
- `normalize` — Audio sample rate, bit depth, loudness normalization
- `subtitle` — AI-generated subtitles with timecode metadata
- `compose` — Audio + subtitle frames + background → final video
- `thumbnail` — AI-designed thumbnail with 3 A/B variants
- `metadata` — Platform-specific metadata (all 8 platforms)
- `multi_post` — Multi-platform dispatching via n8n webhooks

**Queue storage:** Redis (fast, temporary)
**Artifact storage:** S3 (images, audio, video)
**Metadata storage:** PostgreSQL (job state, performance metrics, A/B results)

---

### Phase 1: Audio Normalization
**Status:** ✅ Complete

Standardizes audio across all videos:
- Sample rate: 44.1 kHz
- Bit depth: 16-bit
- Loudness: −14 LUFS (YouTube-compliant)
- Format: AAC @ 128 kbps

**Input:** Raw MP3/WAV
**Output:** Normalized MP3 + S3 artifact URL

---

### Phase 2: Subtitle Generation & Burn
**Status:** ✅ Complete

AI-generated subtitles with timing, burned into video frames.

**Process:**
1. AI transcribes video audio → subtitle SRT
2. Validates timing, removes garbage/filler words
3. Extracts short meaningful chunks (5–15 sec each)
4. Burns text overlays into video frames
5. Stores with timecode metadata in PostgreSQL

**Input:** Normalized audio, background video template
**Output:** Subtitle SRT file + burned video frames

---

### Phase 3: Video Composition
**Status:** ✅ Complete (Phase 5.2)

Combines audio + subtitle frames + background → final video.

**Process:**
1. Load background template
2. Overlay subtitle frames at correct timecodes
3. Mix audio + composited video
4. Render to H.264 MP4 (YouTube-optimized)

**Input:** Audio, subtitle frames, background template
**Output:** Final video MP4 + S3 artifact URL

---

### Phase 4: Thumbnail Design
**Status:** ✅ Complete (Phase 5.2)

Shared thumbnail generation with 3 A/B variants.

**Process:**
1. Load shared thumbnail template
2. Resolve project-provided copy and style inputs
3. Generate 3 design variants
4. Score each variant (0–1 confidence)
5. Store artifacts in shared artifact storage + metadata in PostgreSQL

**A/B testing:** Manual winner selection via API → winner stored for future reference

**Input:** Episode title, transcript excerpt, template IDs
**Output:** 3 PNG thumbnails + JSON metadata (scores, hooks used, template info)

---

### Phase 5: Metadata Generation
**Status:** ✅ Complete (Phase 5.2) — **All 8 Platforms**

Platform-specific metadata with AI-generated captions, tags, and titles.

**Platforms:**
1. **YouTube** — Description (4800 char max), tags (15 tags), title variants (5), chapters (8 max)
2. **TikTok** — Caption (2200 char max), faith-forward tone
3. **Instagram** — Caption (2200 char max), visually-minded, emotional resonance
4. **Facebook** — Post (500 char max), conversational, engagement-focused
5. **LinkedIn** — Post (3000 char max), faith-and-work angle, thought leadership
6. **Bluesky** — Post (300 char max), intellectual, thread-friendly
7. **X** — Post (280 char max), bold, punchy, one strong idea
8. **Pinterest** — Pin metadata (500 char max), evergreen search intent

**Process:**
- AI Model Selector routes all LLM calls (Gemini → Claude → Codex → bash fallback)
- Prompt templates read from shared metadata prompt configuration
- Project-specific voice and tone come from the calling repo
- Character limits enforced per platform with automatic truncation
- Top-performing titles fetched from analytics for style reference

**Input:** Episode title, transcript excerpt, series name, duration
**Output:** MetadataArtifact with PlatformMetadata for each platform (title, description, tags, chapters, hashtags)

---

### Phase 5.1: Multi-Platform Metadata (Extended)
**Status:** ✅ Complete

Metadata generator already produces all 8 platforms in a single job.

**Features:**
- Single LLM request generates all metadata
- Platform-specific prompt templates (Yeshua Academy voice)
- Character limits enforced per platform
- Top titles from analytics used for reference
- YouTube chapters generated if duration > 5 min
- Title variants generated once and reused across artifact

**Cost optimization:**
- Batches requests into single metadata job
- AI Model Selector caches responses by platform
- Routes to cheaper models when possible

---

### Phase 5.2: Multi-Platform Dispatching (n8n)
**Status:** ✅ Complete (Stub/Partial)

Metadata jobs trigger multi-post jobs, each queuing 1 dispatcher per platform.

**Architecture:**
- Job `multi_post` receives platform list and metadata
- For each platform: queue individual posting job via n8n webhook
- Each n8n workflow handles platform-specific API integration (YouTube, Pinterest, Facebook, etc.)

**n8n workflows:** (stub implementations exist in `~/.local/video-orchestrator/n8n/workflows/`)
- `youtube-video-post.json` — YouTube Data API
- `pinterest-pin-post.json` — Pinterest API v5
- `facebook-video-post.json` — Facebook Graph API
- `tiktok-video-post.json` — TikTok Content Posting API
- `instagram-reels-post.json` — Instagram Graph API
- `linkedin-video-post.json` — LinkedIn Share API
- `bluesky-video-post.json` — Bluesky ATP API
- `x-video-post.json` — X API v2

---

## Phase 6: Multi-Platform Direct Publishing (Current)
**Status:** 🟡 In Progress

Expand metadata generation beyond YouTube to all 8 platforms.

**Tasks:**
1. ✅ Verify platform loop in `metadata_generator.py` — all 8 platforms callable
2. ⏳ Create n8n workflow JSON stubs (4 priority platforms)
3. ⏳ Extend `vo queue pipeline` CLI command
4. ⏳ Add Python tests for multi-platform output

---

## Phase 3: A/B Testing (Queued)
**Status:** ⏳ Planned

Time-slice CTR comparison for YouTube thumbnails.

**Features:**
- Pause variant A after 7 days
- Switch to variant B, track CTR for another 7 days
- Store results in `a_b_test_results` table
- Manual winner selection via API
- Winner stored for future reference

---

## Phase 4: Project Migration (Queued)
**Status:** ⏳ Research → Build

Migrate project thumbnail pipelines to Brain Core API.

**Phases:**
1. **Parallel run:** Local generator + API generator, compare results
2. **Cut over:** Switch to API-only
3. **Decommission:** Delete local pipeline
4. **Rebuild shared thumbnail processing:** As modular, scalable tool for Brain Core

---

## API Contract

### Queue a Job

```bash
POST /api/video-orchestrator/queue/normalize
Content-Type: application/json

{
  "jobId": "auto-generated-uuid",
  "episodeId": "genesis-001",
  "accountId": "303e91f9",
  "projectId": "says-the-bible",
  "taskConfig": {
    "input_audio": "s3://brain-media/raw-audio/genesis-001.mp3",
    "background_video": "s3://brain-media/templates/series-bg.mp4",
    "title": "Genesis — Noah Builds the Ark",
    "series": "Old Testament"
  }
}

Response: { "jobId": "job-uuid", "status": "queued" }
```

### Chain Jobs with `depends_on`

```bash
POST /api/video-orchestrator/queue/subtitle
{
  "jobId": "job-uuid-subtitle",
  "depends_on": ["job-uuid-normalize"],
  "taskConfig": { ... }
}
```

### Poll for Completion

```bash
GET /api/video-orchestrator/jobs/job-uuid

Response: {
  "status": "completed",
  "artifact": { ... }
}
```

---

## Configuration Files

**Platform specs:** `~/.config/video-orchestrator/platform-specs.json`
- Platform names, capabilities, API endpoints, constraints

**Metadata prompts:** `~/.config/video-orchestrator/metadata-prompts.json`
- LLM prompt templates for each platform
- Yeshua Academy faith-based voice/tone
- Character limits, hashtag strategies, format requirements

**Job database:** `~/.local/video-orchestrator/db/`
- PostgreSQL schema for jobs, artifacts, metrics
- Tables: `jobs`, `artifacts`, `performance_metrics`, `a_b_test_results`, `multi_post_dispatch`

---

## Developer Quick Reference

**Main entry point:** `metadata_generator.py:generate_metadata()`

**Platform functions:**
- `_generate_tiktok_caption()`
- `_generate_instagram_caption()`
- `_generate_facebook_post()`
- `_generate_linkedin_post()`
- `_generate_bluesky_post()`
- `_generate_x_post()`
- `_generate_pinterest_pin()`

**Character limits:** `PLATFORM_CHAR_LIMITS` dict (lines 38–47)

**Truncation:** `_truncate_to_limit(text, platform_key)` enforces max length + ellipsis

**AI routing:** `_call_llm(prompt_key, variables)` routes via Model Selector (localhost:4890)

**Job queueing:** `vo queue` CLI commands (normalize, subtitle, compose, thumbnail, metadata, multi_post)

---

## Next Steps

1. Complete Phase 6 (multi-platform publishing)
2. Implement Phase 3 (A/B testing)
3. Research & rebuild Thumbnail Studio for brain-core
4. Migrate the current project repo to brain-core API
