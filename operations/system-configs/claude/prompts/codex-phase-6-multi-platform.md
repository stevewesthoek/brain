# Codex Prompt: Phase 6 Multi-Platform Direct Publishing

## Context & Goal

Video Orchestrator is a production automation pipeline: audio/background → normalize → subtitle → compose → thumbnail → metadata → multi_post → YouTube/social media.

**Current state:** Metadata generator has now been expanded beyond YouTube. The active platform set is 8 platforms: YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, and Pinterest.

**Your job:** Implement multi-platform metadata generation and job queueing command.

---

## Phase 6 Tasks (in order)

### A1. Add Pinterest to platform-specs.json

**File:** `~/.config/video-orchestrator/platform-specs.json`

**What:** Add a new platform entry for Pinterest.

**Details:**
- `id: "pinterest"`
- `name: "Pinterest"`
- `description` field: max 500 characters
- `hashtags` field: max 20 hashtags
- `n8n_webhook_path: "video-orchestrator-post/pinterest"`
- `adapter`: `manual_only` (Pinterest posting is manual for now, like Facebook before n8n was ready)
- `status: "planned"`

**Success:** File parses as valid JSON, Pinterest entry has all required fields.

---

### A2. Add 6 platform prompts to metadata-prompts.json

**File:** `~/.config/video-orchestrator/metadata-prompts.json`

**What:** Add AI prompts for each platform (excluding YouTube, which already exists).

**New keys to add:**
1. `tiktok_caption` — hook-first energy, 2200 char max, 10 hashtags, youth-oriented tone
2. `instagram_caption` — visual description + CTA, 2200 char max, 25 hashtags, aspirational
3. `facebook_post` — conversational, 500 char soft max (Facebook allows 63k but we cap at 500), 10 hashtags
4. `linkedin_post` — professional tone, 3000 char max, 10 hashtags, thought leadership
5. `bluesky_post` — thread-friendly, 300 char max (Bluesky limit), 5 hashtags
6. `x_post` — 280 char max (X/Twitter limit), 5 hashtags, punchy

**Tone:** All prompts use faith-based Yeshua Academy voice (already documented in existing YouTube prompts). Reference existing YouTube prompt as template for style consistency.

**Success:** All 6 keys present, each with system prompt + constraints. JSON parses clean.

---

### A3. Extend metadata_generator.py

**File:** `~/.local/video-orchestrator/worker/metadata_generator.py`

**What:** Rewrite the platform loop to generate platform-specific captions for all 8 platforms.

**Changes:**

1. **Add platform char limits dict:**
   ```python
   PLATFORM_CHAR_LIMITS = {
       'youtube': None,
       'tiktok': 2200,
       'instagram': 2200,
       'facebook': 500,
       'linkedin': 3000,
       'bluesky': 300,
       'x': 280,
   }
   ```

2. **Replace the old platform loop** with:
   ```python
   for platform_key in target_platforms:
       if 'youtube' in platform_key:
           # existing logic
       elif 'tiktok' in platform_key:
           caption = _generate_tiktok_caption(episode_title, transcript_excerpt, series)
           platforms[platform_key] = PlatformMetadata(title=episode_title, description=caption, hashtags=tiktok_tags)
       elif 'instagram' in platform_key:
           caption = _generate_instagram_caption(...)
           platforms[platform_key] = ...
       # ... etc for all 8
   ```

3. **Add helper functions** (call AI selector to generate each):
   - `_generate_tiktok_caption(title, excerpt, series) → str`
   - `_generate_instagram_caption(...) → str`
   - `_generate_facebook_post(...) → str`
   - `_generate_linkedin_post(...) → str`
   - `_generate_bluesky_post(...) → str`
   - `_generate_x_post(...) → str`

   Each calls AI Model Selector with the corresponding prompt key from metadata-prompts.json.

4. **Add truncation helper:**
   ```python
   def _truncate_to_limit(text: str, platform_key: str) -> str:
       limit = PLATFORM_CHAR_LIMITS.get(platform_key)
       if limit and len(text) > limit:
           return text[:limit-3] + '...'
       return text
   ```

5. **Wire up `youtube_title_variants`** (currently unused):
   - Call `_generate_youtube_title_variants()` and store variants in artifact

**Success:** Metadata generator produces all 8 platform outputs when run with `--platforms youtube,tiktok,instagram,facebook,linkedin,bluesky,x,pinterest`. Character limits enforced.

---

### A4. Create n8n workflow JSON stubs

**New directory:** `~/.local/video-orchestrator/n8n/workflows/`

**Create 4 files** (standard n8n export format):

1. **facebook-video-post.json**
   - Webhook trigger on `video-orchestrator-post/facebook`
   - HTTP node: POST to `https://graph.facebook.com/v18.0/{page_id}/video` with video URL
   - Success/error branches
   - Placeholder credentials: `page_access_token`

2. **tiktok-video-post.json**
   - Webhook trigger on `video-orchestrator-post/tiktok`
   - HTTP node: POST to `https://open.tiktokapis.com/v1/video/upload/` with video file
   - Success/error branches
   - Placeholder credentials: `client_key`, `client_secret`, `access_token`

3. **instagram-reels-post.json**
   - Webhook trigger on `video-orchestrator-post/instagram`
   - HTTP node: POST to `https://graph.instagram.com/v18.0/{ig_user_id}/media` (video container creation)
   - Then POST to publish endpoint
   - Success/error branches
   - Placeholder credentials: `user_access_token`

4. **pinterest-pin-post.json**
   - Webhook trigger on `video-orchestrator-post/pinterest`
   - HTTP node: POST to `https://api.pinterest.com/v5/pins` with image URL (Pinterest uses images, not videos)
   - Success/error branches
   - Placeholder credentials: `access_token`

**JSON structure (per n8n standard):**
```json
{
  "id": "workflow-id",
  "name": "Platform Name — Video Post",
  "nodes": [
    { "id": "webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 1, ... },
    { "id": "http", "type": "n8n-nodes-base.httpRequest", "typeVersion": 3, ... }
  ],
  "connections": { ... },
  "settings": { ... }
}
```

**Success:** All 4 JSON files parse valid. Each has webhook trigger + HTTP node + basic error handling.

---

### A5. Add `vo queue pipeline` command

**File:** `~/.local/video-orchestrator/scripts/vo.py`

**What:** Add a new subcommand to queue a full video production pipeline.

**Usage:**
```bash
vo queue pipeline \
  --audio episode.mp3 \
  --background series-bg.jpg \
  --title "Genesis — Noah" \
  --platforms youtube,facebook,pinterest \
  --account 303e91f9
```

**What it does:**
1. Validate `--platforms` against VALID_PLATFORMS (youtube, tiktok, instagram, facebook, linkedin, bluesky, x, pinterest)
2. Validate `--account` exists in video orchestrator account DB
3. Validate `--audio` and `--background` files exist locally
4. Queue jobs in sequence with `depends_on` chaining:
   - `normalize` (takes audio)
   - `subtitle` (depends on normalize)
   - `compose` (depends on subtitle, uses background)
   - `thumbnail` (depends on compose)
   - `metadata` (depends on thumbnail, takes platforms list)
   - `multi_post` (depends on metadata, takes platforms list) ← **one job, dispatches to all platform n8n webhooks**

5. Print queued job IDs to stdout

**Success:** Command queues jobs correctly, validates inputs, prints job IDs.

---

### A6. Update Python tests

**File:** `~/.local/video-orchestrator/tests/test_worker.py`

**What:** Add test coverage for multi-platform metadata generation.

**New tests:**
1. `test_metadata_generator_all_platforms()` — verify all 8 platforms produced
2. `test_metadata_char_truncation_per_platform()` — verify truncation works (e.g., X at 280 chars, TikTok at 2200)
3. `test_metadata_prompt_keys_used()` — verify correct prompt keys used for each platform
4. `test_platform_validation_in_queue_pipeline()` — verify invalid platform rejected
5. `test_queue_pipeline_job_ordering()` — verify depends_on chaining is correct

**Success:** All tests pass. `pytest -v` shows 5+ new passing tests.

---

## Critical Notes

### Data Sources

**Config files (read by worker):**
- `~/.config/video-orchestrator/platform-specs.json` — platform metadata (char limits, n8n paths, etc.)
- `~/.config/video-orchestrator/metadata-prompts.json` — AI prompts for each platform

**Job queueing API (already implemented):**
- All job types (normalize, subtitle, compose, thumbnail, metadata, multi_post) exist
- `depends_on` field chains jobs sequentially
- Video orchestrator DB stores accounts

**AI Model Selector (localhost:4890):**
- Already running, handles Gemini → Claude → Codex → bash fallback
- Call it via HTTP POST `/select-and-run` with prompt + context

### Multi-Platform Flow

```
audio → normalize job → subtitle job → compose job → thumbnail job → 
metadata job (calls AI for all 8 platforms) → 
multi_post job (queues 1 dispatch per platform to n8n webhooks)
```

### Platform Priority

User directive: **YouTube → Pinterest → Facebook first, then expand to all 8 after.**

This means:
- Implement all 8 (complete implementation)
- Test with YouTube, Pinterest, Facebook first (those are the proven paths)
- TikTok, Instagram, LinkedIn, Bluesky, X come after (when we expand)

### No TypeScript Changes

Phase 6 is Python + config. Brain-core TypeScript adapter already exists and handles metadata routing. No brain-core changes needed.

---

## Success Criteria

✅ **All tasks complete when:**
1. Pinterest added to platform-specs.json (valid JSON)
2. 6 platform prompts in metadata-prompts.json (valid JSON)
3. metadata_generator.py produces all 8 platform outputs (verified via dry-run)
4. n8n workflow JSONs created and parse valid
5. `vo queue pipeline` queues jobs correctly (dry-run shows job IDs)
6. Python tests pass (`pytest -v`, 5+ new tests)

✅ **Ready for posting when:**
- Dry-run: `vo queue pipeline --platforms youtube,facebook,pinterest ... --dry-run` prints job IDs
- Metadata verify: output includes all 3 platform captions with correct char limits enforced
- n8n workflows wired up and credentials configured (manual step after code is done)

---

## Files to Modify

1. `~/.config/video-orchestrator/platform-specs.json` — add Pinterest
2. `~/.config/video-orchestrator/metadata-prompts.json` — add 6 prompts
3. `~/.local/video-orchestrator/worker/metadata_generator.py` — platform loop + helpers
4. `~/.local/video-orchestrator/n8n/workflows/facebook-video-post.json` — create
5. `~/.local/video-orchestrator/n8n/workflows/tiktok-video-post.json` — create
6. `~/.local/video-orchestrator/n8n/workflows/instagram-reels-post.json` — create
7. `~/.local/video-orchestrator/n8n/workflows/pinterest-pin-post.json` — create
8. `~/.local/video-orchestrator/scripts/vo.py` — add `queue pipeline` command
9. `~/.local/video-orchestrator/tests/test_worker.py` — add 5+ tests

---

## Questions Before Starting?

None expected — this is a straightforward expansion of existing metadata + job queueing infrastructure. All APIs, config, and job types already exist. You're just wiring them up for multi-platform.

**Ready to proceed?** Start with A1 (config), then A2 (prompts), then A3 (Python logic), then A4–A6 (workflows + command + tests). This order allows you to test config changes before writing the logic that uses them.
