# Video Orchestrator

Shared video orchestration and processing engine for multi-project content production.

**Project repos own the admin UI and project-specific content decisions.** Brain Core owns orchestration, job state, shared artifact generation, approvals, health, and observability through REST API contracts.

---

## Quick Start

### Queue a Complete Video Pipeline

```bash
vo queue pipeline \
  --audio episode.mp3 \
  --background series-bg.jpg \
  --title "Genesis — Noah" \
  --series "Old Testament" \
  --platforms youtube,facebook,pinterest \
  --account 303e91f9
```

**What happens:**
1. Audio normalizes (sample rate, bit depth, loudness)
2. Subtitles generate (AI transcription + timecode)
3. Video composes (audio + subtitles + background)
4. Thumbnail designs (3 A/B variants + scoring)
5. Metadata generates for the shared multi-platform pipeline
6. Posts dispatch through shared adapters or project-owned downstream tools

### Poll for Completion

```bash
curl http://localhost:5000/api/video-orchestrator/jobs/job-uuid
```

---

## Documentation

Start here based on your role:

### Users / Project Managers
**→ Read `FEATURES.md`**

- What shared pipeline features exist (normalize, subtitle, compose, thumbnail, metadata, multi-post)
- How to use the system (job queueing API, polling, status)
- Supported platforms and their capabilities
- Configuration files and environment variables

### Developers / Engineers
**→ Read `DEVELOPER.md`**

- How shared metadata generation works
- How jobs are queued and observed
- AI Model Selector routing where applicable
- Testing shared pipeline modules
- Troubleshooting guide

### Architects / Decision Makers
**→ Read `ARCHITECTURE.md`**

- Why the shared pipeline lives in Brain
- How project repos delegate work to Brain Core API
- Data flow diagram (project admin UI → API → brain-core → artifact storage)
- Migration path (parallel run → cut over → decommission)
- Where project-specific logic must stay out of Brain

---

## System Architecture

```
Project Repos (current project repo, future projects)
    ↓
    │ REST API POST /api/video-orchestrator/queue/*
    │
    ↓
Brain-Core Pipeline
    │
    ├─ Normalize        (Audio codec/sample-rate/loudness)
    ├─ Subtitle         (AI transcription + SRT generation + frame burn)
    ├─ Compose          (Audio + subtitles + background → MP4)
    ├─ Thumbnail        (AI design + 3 A/B variants + scoring)
    ├─ Metadata         (All 8 platforms + prompt templates + truncation)
    └─ Multi-Post       (n8n webhooks → platform APIs)
    │
    ↓
Artifact Storage
    │
    ├─ S3              (Images, audio, final video)
    ├─ PostgreSQL      (Job state, metrics, A/B results, metadata)
    └─ Redis Queue     (Job scheduling + dependency chains)
    │
    ↓
Project Repos (Display results, approve variant, upload to YouTube)
```

**Key principle:** All stages have explicit `depends_on` job IDs. Sequential execution with shared artifact URLs.

---

## Metadata Generation — Complete Reference

**All 8 platforms in one job.**

### Platforms Supported

| Platform | Caption Type | Max Length | Tone | Hashtags |
|----------|--------------|------------|------|----------|
| YouTube | Description | 4800 | SEO-optimized, keyword-rich | 15 tags + chapters |
| TikTok | Caption | 2200 | Energetic, hook-first, punchy | Embedded in caption |
| Instagram | Caption | 2200 | Visual, emotional, authentic | Embedded in caption |
| Facebook | Post | 500 | Conversational, personal, engaging | Embedded in post |
| LinkedIn | Post | 3000 | Professional, thought leadership | Embedded in post |
| Bluesky | Post | 300 | Intellectual, substantive, thread-friendly | Embedded in post |
| X | Post | 280 | Bold, punchy, one strong idea | Embedded in post |
| Pinterest | Pin | 500 | Evergreen search intent, discovery | Embedded in caption |

### Voice & Tone

All platforms use **Yeshua Academy faith-based voice:**
- Authentic Bible teaching for believers + seekers
- Clear value proposition (education, faith application, engagement)
- Encouragement + intellectual substance
- Platform-specific tone (energetic for TikTok, professional for LinkedIn, etc.)

### Character Limits Enforced

Automatic truncation with "..." if text exceeds platform max.

```python
PLATFORM_CHAR_LIMITS = {
    "youtube": None,        # No hard limit (4800 in description)
    "tiktok": 2200,
    "instagram": 2200,
    "facebook": 500,
    "linkedin": 3000,
    "bluesky": 300,
    "x": 280,
    "pinterest": 500,
}
```

### Example: Queue Metadata-Only Job

```bash
POST /api/video-orchestrator/queue/metadata
Content-Type: application/json

{
  "episodeId": "genesis-001",
  "taskConfig": {
    "episode_title": "Genesis — Noah Builds the Ark",
    "transcript_excerpt": "Noah spent 120 years building the ark...",
    "target_platforms": ["youtube_standard", "facebook", "pinterest"],
    "series": "Old Testament",
    "duration_minutes": 12.5
  }
}

Response: {
  "platforms": {
    "youtube_standard": {
      "title": "Genesis — Noah Builds the Ark",
      "description": "...",
      "tags": ["Bible", "Genesis", ...],
      "chapters": [...],
      "hashtags": ["#Bible", "#Genesis", ...]
    },
    "facebook": {
      "title": "Genesis — Noah Builds the Ark",
      "description": "...",  # 500 char max
      "tags": [],
      "chapters": [],
      "hashtags": []
    },
    "pinterest": {
      "title": "Genesis — Noah Builds the Ark",
      "description": "...",  # 500 char max
      "tags": [],
      "chapters": [],
      "hashtags": []
    }
  },
  "title_variants": ["title1", "title2", ...],
  "completed_at": "2026-05-25T14:22:33Z"
}
```

---

## Configuration

### Platform Specs

**File:** `~/.config/video-orchestrator/platform-specs.json`

Complete platform specifications: API endpoints, capabilities, constraints.

### Metadata Prompts

**File:** `~/.config/video-orchestrator/metadata-prompts.json`

LLM prompt templates for each platform (Yeshua Academy voice).

### Environment Variables

```bash
PLATFORM_SPECS_PATH=~/.config/video-orchestrator/platform-specs.json
METADATA_PROMPTS_PATH=~/.config/video-orchestrator/metadata-prompts.json
VO_DB_HOST=127.0.0.1
VO_DB_PORT=5450
VO_DB_NAME=video_orchestrator
VO_DB_USER=postgres
VO_DB_PASS=postgres
```

---

## Current Status (2026-05-25)

✅ **Complete:**
- Job queueing (normalize, subtitle, compose, thumbnail, metadata, multi_post)
- Metadata generation (all 8 platforms)
- Platform-specific prompts (Yeshua Academy voice)
- Character limit enforcement
- AI Model Selector routing
- Database schema (jobs, artifacts, metrics)

🟡 **In Progress (Phase 6):**
- n8n workflow JSON stubs (4 priority platforms)
- `vo queue pipeline` CLI command extension
- Comprehensive test suite
- Multi-platform dispatch verification

⏳ **Planned:**
- Phase 3: A/B testing for YouTube thumbnails
- Phase 4: Project migration (parallel run → cut over)
- Thumbnail Studio research & rebuild (use NotebookLM first)

---

## Key Files

| Path | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Strategic design decisions and patterns |
| `FEATURES.md` | User-facing feature reference |
| `DEVELOPER.md` | Developer guide and API reference |
| `~/.local/video-orchestrator/worker/metadata_generator.py` | Core metadata generation logic |
| `~/.config/video-orchestrator/platform-specs.json` | Platform capabilities + constraints |
| `~/.config/video-orchestrator/metadata-prompts.json` | LLM prompt templates |
| `~/.local/video-orchestrator/scripts/vo.py` | CLI commands (queue, poll, etc.) |
| `~/.local/video-orchestrator/tests/test_worker.py` | Unit + integration tests |
| `~/.local/video-orchestrator/n8n/workflows/*.json` | Platform posting workflows |

---

## Support

- **Feature questions?** → `FEATURES.md`
- **How do I add a new platform?** → `DEVELOPER.md` → "Adding a New Platform"
- **Why is this architecture the right choice?** → `ARCHITECTURE.md`
- **Something is broken?** → `DEVELOPER.md` → "Troubleshooting"

---

## Next Steps

1. Complete Phase 6 (n8n stubs, CLI command, tests)
2. Implement Phase 3 (A/B testing)
3. Research & rebuild Thumbnail Studio
4. Migrate the current project repo to brain-core API
