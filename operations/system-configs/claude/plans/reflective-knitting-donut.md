# Phase 6: Multi-Platform Direct Publishing — Codex Handoff

## Current Status (2026-05-24)

✅ **Complete:**
- Brain Console design system (global tokens, fonts, spacing, radius, colors)
- CSS pipeline fixed (styles.css from dist/ with Tailwind build)
- Version management (VERSION.md, auto-update script)
- Agent Orchestrator View (Phase 0.7 UI) — 6-card dashboard
- Video Orchestrator Phases 0–5.2 (normalize → subtitle → compose → thumbnail → metadata → multi-post)

⏳ **Next: Phase 6 Multi-Platform Content Generation**

Goal: Expand metadata generation from YouTube-only to 8 platforms. Post to YouTube → Pinterest → Facebook first, then expand to TikTok, Instagram, LinkedIn, Bluesky, X.

---

## Phase 6 Implementation Tasks (for Codex)

### Priority Order

1. **A1. Pinterest to platform-specs.json** — config update
2. **A2. Platform prompts to metadata-prompts.json** — config update
3. **A3. Extend metadata_generator.py** — Python logic (platform-specific captions)
4. **A4. n8n workflow JSON stubs** — workflow templates (4 files)
5. **A5. `vo queue pipeline` command** — CLI command (job queueing)
6. **A6. Python tests** — test coverage for multi-platform

### Detailed Tasks

**A1. Add Pinterest to platform-specs.json**
- File: `~/.config/video-orchestrator/platform-specs.json`
- Add entry: `pinterest`: description (500 char max), 20 hashtags, `n8n_webhook_path: "video-orchestrator-post/pinterest"`, adapter status `manual_only`

**A2. Add 6 platform prompts to metadata-prompts.json**
- File: `~/.config/video-orchestrator/metadata-prompts.json`
- Add keys: `tiktok_caption`, `instagram_caption`, `facebook_post`, `linkedin_post`, `bluesky_post`, `x_post`
- Each: platform-specific tone, char limit constraints, hashtag counts, faith-based Yeshua Academy voice

**A3. Extend metadata_generator.py platform loop**
- File: `~/.local/video-orchestrator/worker/metadata_generator.py`
- For each platform_key in target_platforms: generate platform-specific caption
- Add `_truncate_to_limit(text, platform_key)` helper (reads platform-specs.json, enforces max_length)
- Wire up `youtube_title_variants` prompt (currently defined but unused)
- Result: `platforms[platform_key]` populated for all 8 platforms

**A4. Create n8n workflow JSON stubs**
- New directory: `~/.local/video-orchestrator/n8n/workflows/`
- 4 files (standard n8n export format):
  - `facebook-video-post.json` — webhook → HTTP node → Facebook Graph API page post
  - `tiktok-video-post.json` — webhook → HTTP node → TikTok Content Posting API
  - `instagram-reels-post.json` — webhook → HTTP node → Instagram Graph API Reels
  - `pinterest-pin-post.json` — webhook → HTTP node → Pinterest API v5
- Each: webhook trigger, HTTP request node, success/error branches, placeholder credentials

**A5. Add `vo queue pipeline` command**
- File: `~/.local/video-orchestrator/scripts/vo.py`
- New subcommand: `vo queue pipeline --audio episode.mp3 --background series-bg.jpg --title "Genesis — Noah" --platforms youtube,facebook,pinterest --account 303e91f9`
- Queues jobs: normalize → subtitle → compose → thumbnail → metadata → multi_post (one job with platform list)
- Validates: platform list against VALID_PLATFORMS, account_id exists in DB, audio/background files exist
- Output: prints queued job IDs for tracking

**A6. Update Python tests**
- File: `~/.local/video-orchestrator/tests/test_worker.py`
- Test metadata generator produces all 8 platform outputs
- Test character truncation works per platform
- Test platform validation in `vo queue pipeline`

---

## Critical Context

**Already implemented:**
- Job queuing API (normalize, subtitle, compose, thumbnail, metadata, multi_post)
- `depends_on` chaining for sequential execution
- AI Model Selector at localhost:4890 (Gemini → Claude → Codex → bash fallback)
- YouTube uploader (used by metadata jobs)

**Data sources:**
- Platform specs: `~/.config/video-orchestrator/platform-specs.json` (8 platforms: YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, now adding Pinterest)
- Prompts: `~/.config/video-orchestrator/metadata-prompts.json` (faith-based Yeshua Academy voice)

**Multi-platform flow:**
```
audio/background → normalize → subtitle → compose → thumbnail → metadata (all 8 platforms) → multi_post (queues 1 job per platform)
```

---

## Files to Touch

| File | Action |
|------|--------|
| `~/.config/video-orchestrator/platform-specs.json` | Add Pinterest entry |
| `~/.config/video-orchestrator/metadata-prompts.json` | Add 6 platform prompts |
| `~/.local/video-orchestrator/worker/metadata_generator.py` | Extend platform loop, add truncation |
| `~/.local/video-orchestrator/n8n/workflows/facebook-video-post.json` | Create |
| `~/.local/video-orchestrator/n8n/workflows/tiktok-video-post.json` | Create |
| `~/.local/video-orchestrator/n8n/workflows/instagram-reels-post.json` | Create |
| `~/.local/video-orchestrator/n8n/workflows/pinterest-pin-post.json` | Create |
| `~/.local/video-orchestrator/scripts/vo.py` | Add `queue pipeline` command |
| `~/.local/video-orchestrator/tests/test_worker.py` | Add multi-platform tests |

---

## Verification

```bash
# Python tests
cd ~/.local/video-orchestrator
.venv/bin/python3 -m pytest tests/ -v

# Metadata dry-run (all platforms)
.venv/bin/python3 worker/metadata_generator.py \
  --episode "Genesis — Noah" \
  --platforms youtube,tiktok,instagram,facebook,linkedin,bluesky,x \
  --dry-run

# Metadata for 3 priority platforms
.venv/bin/python3 worker/metadata_generator.py \
  --episode "Genesis — Noah" \
  --platforms youtube,facebook,pinterest \
  --dry-run

# Pipeline command (dry-run)
python3 ~/.local/video-orchestrator/scripts/vo.py queue pipeline \
  --audio /tmp/test.mp3 --title "Genesis — Noah" \
  --platforms youtube,facebook,pinterest \
  --account test --dry-run

# n8n JSON validity
for f in ~/.local/video-orchestrator/n8n/workflows/*.json; do
  python3 -c "import json; json.load(open('$f'))" && echo "✓ $f"
done
```

---

## Next After Phase 6

**Phase 3 — A/B Testing (YouTube Thumbnails):**
- Time-slice CTR comparison: switch variant after 7 days, compare CTR before/after
- Manual winner override API: POST /api/video-orchestrator/thumbnails/declare-winner

**Phase 5.3+ — Vertical Scaling:**
- Multi-account support (currently single account)
- Batch job queueing (queue multiple episodes at once)
