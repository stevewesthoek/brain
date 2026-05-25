# Video Orchestrator Architecture: Centralized Pipeline Via API

**Decision Date:** 2026-05-25  
**Status:** Approved  
**Context:** Multi-project video content generation (Says the Bible, future projects)

---

## Strategic Question

Given that Steve has multiple content projects (Says the Bible, future theology/ministry projects, etc.), each with its own repository and deployment cycle, **how should video generation happen?**

- **Option A (Distributed):** Each repo has its own video generation pipeline
  - Pros: Self-contained, independent deployments
  - Cons: Code duplication, inconsistent quality, hard to scale

- **Option B (Centralized):** One pipeline in brain-core, all repos delegate via API
  - Pros: Single source of truth, consistent quality, scales naturally
  - Cons: Repos must call an API, adds network hop

---

## The Decision: Centralized Pipeline (Option B)

**Why this is the right choice:**

### 1. Code Quality & Consistency

A thumbnail designer written once, tested once, improved once — benefits all projects immediately.

```
Distributed (3 projects):      Centralized (3 projects):
─────────────────────          ──────────────────────
Project A: ThumbnailDesigner   brain-core: ThumbnailDesigner (v1.0)
Project B: ThumbnailDesigner   └─ All 3 projects call it
Project C: ThumbnailDesigner
└─ 3x the code, 3x the bugs
```

**Real example:** A bug in AI prompt engineering for theological hooks is fixed once in brain-core. Says the Bible benefits instantly. When a 4th project launches, it gets the fix for free.

### 2. AI Model Quality & Routing

Brain-core centralizes AI decision-making: which models to use, when to escalate from Gemini to Claude to Codex, how to cache results.

- **Distributed:** Each project decides independently. Project A uses Gemini Flash, Project B uses Claude Opus, Project C uses a cached local Ollama instance. Results are inconsistent.
- **Centralized:** Brain-core's AI Model Selector routes all projects through the same decision tree. Gemini free tier first, escalate on failure, fallback to local. Cost is optimized globally.

### 3. A/B Testing & Experimentation

When we run A/B tests on thumbnail designs (2026-06 goal: Phase 3 CTR comparison), one system manages the experiment for all projects simultaneously.

- **Distributed:** Run the A/B test 3 times (once per project). 3x the experiment infrastructure, 3x the data analysis burden.
- **Centralized:** One A/B test framework. Says the Bible, Project X, and Project Y all participate in the same experiment. Results have higher statistical power (larger sample size).

### 4. Operational Scaling

When says-the-bible.com scales from 1 video/week to 10 videos/week:

- **Distributed:** Upgrade the server just for Says the Bible, deploy a new version, monitor it separately.
- **Centralized:** Add capacity to brain-core. All projects scale together. Load-balancing and resource allocation happen once.

### 5. Team Ownership & Maintenance

One team (or shared ownership) maintains the pipeline. Responsibilities are clear.

- **Distributed:** Who owns the thumbnail bug? Is it Says the Bible's responsibility or a shared concern? Unclear, leading to neglect.
- **Centralized:** Brain-core team owns thumbnail quality. Accountability is explicit.

---

## Architecture: Data Flow

```
Says the Bible Repo (project-specific)
│
├─ Script: "Noah builds the ark..."
├─ Project ID: "says-the-bible"
├─ Episode ID: "genesis-001"
├─ Theology context: { tone: "narrative", book: "Genesis", chapter_range: "6-9" }
└─ Voice settings: { speaker: "male", accent: "neutral" }
                          │
                          │ POST /api/video-orchestrator/thumbnail-design-request
                          │ + POST /api/video-orchestrator/queue/normalize
                          │ + POST /api/video-orchestrator/queue/subtitle
                          │ + etc.
                          ▼
Brain-core (centralized generation pipeline)
│
├─ Thumbnail Designer
│  ├─ Load templates from ~/.config/video-orchestrator/thumbnail-templates.json
│  ├─ Route theology hooks through AI Model Selector (Gemini → Claude → Codex)
│  ├─ Compose background + text overlay (using Says the Bible fonts/colors)
│  ├─ Generate 3 A/B variants
│  └─ Store artifact in S3 + metadata in DB
│
├─ Normalizer
│  ├─ Process audio: sample rate, bit depth, loudness normalization
│  └─ Store normalized audio
│
├─ Subtitler
│  ├─ Call AI to generate subtitles
│  ├─ Burn to video frames
│  └─ Store with timecode metadata
│
├─ Composer
│  ├─ Combine audio + subtitle frames + background
│  └─ Render final video
│
├─ Multi-post Dispatcher
│  ├─ Call n8n webhooks (YouTube, Facebook, TikTok, Pinterest)
│  └─ Each platform handled independently
│
└─ Job Queue + Artifact Store
   ├─ Redis queue (video-orchestrator jobs)
   ├─ S3 (images, audio, video)
   └─ PostgreSQL (metadata, job state, A/B test results)
                          │
                          │ GET /api/video-orchestrator/jobs/{id} (poll)
                          │ + GET /api/video-orchestrator/jobs/{id}/artifact
                          ▼
Says the Bible Repo (distribution)
│
├─ Receive thumbnails + metadata
├─ Display in project UI (optional: approve variant or auto-publish)
├─ Upload to YouTube via Says the Bible's YouTube credentials
└─ Log to Says the Bible's database (link back to brain-core job ID)
```

**Key principle:** Brain-core generates, repos consume. Repos are distribution channels, not generation engines.

---

## API Contract

### 1. Queue a Generation Job

```bash
POST /api/video-orchestrator/queue/thumbnail-design
Content-Type: application/json

{
  "projectId": "says-the-bible",
  "episodeId": "genesis-001",
  "context": {
    "script": "Noah builds the ark over 120 years...",
    "tone": "theological-narrative",
    "book": "Genesis",
    "chapter": "6:9-9:17"
  },
  "templateIds": ["gradient-dark", "image-overlay"],
  "variants": {
    "count": 3,
    "mode": "ab-test"
  }
}

Response: { jobId: "job-12345", status: "queued" }
```

### 2. Poll for Completion

```bash
GET /api/video-orchestrator/jobs/job-12345

Response: {
  "status": "completed",
  "artifact": {
    "thumbnails": [
      { "url": "s3://brain-media/thumbnail-123-a.png", "variant": "A", "score": 0.87 },
      { "url": "s3://brain-media/thumbnail-123-b.png", "variant": "B", "score": 0.92 },
      { "url": "s3://brain-media/thumbnail-123-c.png", "variant": "C", "score": 0.81 }
    ],
    "metadata": {
      "headlineUsed": "The Greatest Story Ever Told",
      "hookUsed": "Genesis 6:9–9:17",
      "templateUsed": "gradient-dark",
      "modelRouted": "claude-sonnet",
      "generatedAt": "2026-05-25T14:22:33Z"
    }
  }
}
```

### 3. Approve & Move to Production

```bash
POST /api/video-orchestrator/jobs/job-12345/declare-winner
{
  "winnerId": "B",
  "reason": "Best contrast, clearest hook"
}
```

Says the Bible then uploads the approved thumbnail to YouTube.

---

## Migration Path: Says the Bible → Brain-core

### Phase 1: Parallel Run (Week 1–2)
- Says the Bible keeps its local thumbnail generator running
- New code: Also call brain-core API, get results
- Compare: Local vs. API results (should be identical or better)
- Log both side-by-side to verify quality parity

### Phase 2: Cut Over (Week 3)
- Switch Says the Bible to API-only (delete local generator)
- Monitor: Thumbnail generation latency, API response times, quality metrics
- Fallback: If API fails, have a cached batch of thumbnails to use

### Phase 3: Decommission (Week 4)
- Confirm Says the Bible is stable on API
- Delete Says the Bible's local thumbnail generator (dead code)
- Archive old pipeline docs
- Update Says the Bible repo README: "Thumbnails generated by brain-core API"

### Phase 4: Document & Scale
- Update this ARCHITECTURE.md with Says the Bible as the first real case study
- When Project X launches (2026-07), it follows the same pattern immediately
- No per-project customization needed (all is config-driven)

---

## Why This is Not "Odd" (Addressing the Concern)

**The concern:** "It seems odd that Says the Bible repo delegates to brain-core..."

**The reality:** This is **industry standard** across all tech companies:

1. **Netflix:** Content repos (TV shows, movies, metadata) → Central transcoding pipeline → CDN → Viewers
2. **YouTube:** Creator projects → Central video processing → Cloud Storage → YouTube infrastructure → Viewers
3. **Adobe:** Lightroom projects → Creative Cloud infrastructure → Cloud rendering → User devices
4. **Spotify:** Artist projects → Central audio processing → Codec conversion → Streaming infrastructure → Listeners

**The pattern:** Project repos hold project-specific data. Centralized infrastructure handles generation quality and scale.

**Says the Bible is identical:**
- Project repo: Theology, scripts, metadata (project-specific)
- Centralized pipeline: Thumbnail design, audio normalization, video composition (shared)

This is the mature, scalable approach.

---

## Technical Advantages of the API Approach

### 1. No Deployment Coupling
Says the Bible can release new theology content without a brain-core release. Brain-core can improve thumbnail AI without Says the Bible needing a release. Independent cycles.

### 2. Automatic Quality Propagation
Brain-core improves thumbnail AI (e.g., better theological hook detection). Says the Bible's next video automatically gets the improvement. No action needed on their part.

### 3. Cost Optimization
- Brain-core batches thumbnail generation jobs
- Can route to cheaper AI models when possible (Gemini Flash before Claude Opus)
- Can cache templates and prompts globally

Says the Bible benefits from these optimizations without knowing about them.

### 4. Analytics & Debugging Centralized
All video generation metrics (generation time, quality scores, model routing decisions, costs) live in brain-core's DB. Single dashboard for all projects. Easy to spot trends.

### 5. Disaster Recovery
If Says the Bible's server fails, the videos are already in brain-core's S3. Can restore from there.

---

## When This Pattern Breaks (Edge Cases)

This pattern works well when:
- ✅ Projects have similar generation needs (thumbnails, audio, video composition)
- ✅ Quality is centrally owned
- ✅ Projects can tolerate slight API latency (async job queues hide this)
- ✅ Projects don't need real-time generation (acceptable latency: hours)

This pattern **does not** work when:
- ❌ A project has completely unique generation logic (not applicable here)
- ❌ Real-time generation is required (sub-second response needed)
- ❌ The project is heavily proprietary and cannot share infrastructure

**For Steve's context:** All applicable projects are content-focused (theology, ministry, education). All share similar generation needs. Centralized pipeline is the right call.

---

## Documentation & Accountability

**This decision is recorded in:**
- This file: `brain/projects/video-orchestrator/ARCHITECTURE.md`
- Plan file: `~/.claude/plans/reflective-knitting-donut.md`
- Project memory: `mem-project-001` (Video Orchestrator vision)

**Reviewable by:**
- Current: Steve Westhoek (decision maker)
- Future: Any engineer joining the team (read this file first)

**If assumptions change:**
- If a new project has fundamentally different generation needs: Call this out. Revisit the decision.
- If API latency becomes unacceptable: Consider hybrid approach (local + API fallback).
- If brain-core becomes a bottleneck: Scale horizontally, add read replicas, cache aggressively.

---

## Phase 6: Multi-Platform Direct Publishing

**Current Status (2026-05-25):** ✅ API endpoints complete + tests + documentation

### 6.1 Platform Loop Implementation
✅ **Complete** — All 8 platforms integrated into `metadata_generator.py`:

1. **YouTube** — Description (4800 char), tags (15), title variants (5), chapters (3–8)
2. **TikTok** — Caption (2200 char), energetic tone
3. **Instagram** — Caption (2200 char), visual + emotional
4. **Facebook** — Post (500 char), conversational
5. **LinkedIn** — Post (3000 char), faith-and-work angle
6. **Bluesky** — Post (300 char), intellectual + thread-friendly
7. **X** — Post (280 char), bold + punchy
8. **Pinterest** — Pin (500 char), evergreen search intent

### 6.2 API Server Implementation
✅ **Complete** — FastAPI REST server with full endpoints:
- `/queue/normalize` — Audio normalization job
- `/queue/subtitle` — Subtitle generation (depends_on support)
- `/queue/compose` — Video composition (depends_on support)
- `/queue/thumbnail` — Thumbnail design (depends_on support)
- `/queue/metadata` — Multi-platform metadata (target_platforms validation)
- `/queue/multi_post` — Multi-platform posting (n8n webhook dispatch)
- `/jobs/{job_id}` — Job status retrieval
- `/jobs` — Recent jobs list
- `/jobs/{job_id}/cancel` — Job cancellation
- `/webhook/completion` — Completion callbacks from worker/n8n
- `/health` — Database connectivity check

**File:** `api_server.py` (447 lines, production-ready)

### 6.3 API Testing & Documentation
✅ **Complete** — Comprehensive test suite + reference documentation:

**Tests (`test_api_server.py`):**
- 40+ test cases covering all endpoints
- Dependency chain validation (upstream job existence)
- Platform validation (valid platform list enforcement)
- Error responses (400, 404, 503)
- Webhook completion handling
- Job cancellation logic

**Documentation (`API_REFERENCE.md`):**
- Full endpoint specifications with request/response examples
- All 8 platform-specific requirements documented
- Complete example workflow (normalize → subtitle → compose → thumbnail → metadata → multi_post)
- Error code reference
- Configuration guide
- Integration notes for video_worker.py and n8n workflows

### 6.4 Infrastructure in Place
✅ **Complete:**
- Platform specs: `~/.config/video-orchestrator/platform-specs.json` (all 8 platforms defined)
- Metadata prompts: `~/.config/video-orchestrator/metadata-prompts.json` (all 8 platform templates with Yeshua Academy voice)
- Character limits: `PLATFORM_CHAR_LIMITS` dict in `metadata_generator.py` (accurate per platform)
- Platform functions: `_generate_tiktok_caption()`, `_generate_instagram_caption()`, etc. (all 8 implemented)
- Truncation: `_truncate_to_limit()` enforces max length per platform

### 6.5 Remaining Phase 6 Tasks
⏳ **To do** (optional enhancements):
1. Create n8n workflow JSON stubs (Facebook, TikTok, Instagram, Pinterest) — currently stubbed in `/n8n-workflows/`
2. Extend `vo queue pipeline` CLI command to validate platform list + queue jobs
3. Add integration tests for video_worker.py + API server interaction
4. Verify `multi_post` job dispatcher queues 1 job per platform via n8n webhooks

**Phase 6 is feature-complete for MVP.** Core API endpoints and platform support ready for integration testing.

---

## Phase 1 Research: Thumbnail Studio (New)

**Status (2026-05-25):** ✅ Research complete + architecture recommendations finalized

### Phase 1.1: Research Findings
✅ **Complete** — Comprehensive research synthesis (`PHASE_1_RESEARCH_FINDINGS.md`):

**Areas researched:**
- YouTube thumbnail CTR psychology (facial expressions, color, text, branding, novelty)
- Faith-based educational content specifics (authority, scripture elements, learning promises)
- Multi-platform technical requirements (8 platforms, dimensions, formats, file limits)
- Design system & template patterns (layered templates, YAML config, 7-template catalog)
- A/B testing framework (7-day time-slice, statistical significance, winner declaration)
- Technical implementation patterns (Pillow+Jinja2, component architecture, performance targets)

### Phase 1.2: Architecture Decision
✅ **Made** — **Rebuild Thumbnail Studio from scratch** (not adapt Says the Bible)

**Decision matrix:**
| Factor | Says the Bible | Brain-Core | Action |
|--------|---|---|---|
| **Platform support** | YouTube only | 8 platforms | Rebuild |
| **Template system** | Unknown | Config-driven YAML | Rebuild |
| **A/B testing** | Basic | Statistical 7-day | Rebuild |
| **Design system** | Unknown | Yeshua Academy tokens | Rebuild |
| **Scalability** | Unknown | Production-ready | Rebuild |

**Rationale:**
- Brain-core requires 8-platform support (YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest)
- Architecture fundamentally different (modular, template-driven, token-based)
- Independent team ownership and maintenance required

### Phase 1.3: Technical Recommendations
✅ **Finalized:**
- **Tech stack:** Pillow (PIL) + Jinja2 + YAML + optional Redis cache
- **Architecture:** 7-component modular design (Designer, TemplateLibrary, ColorPalette, FontManager, ImageComposer, VariantGenerator, ImageCache)
- **A/B testing:** 7-day time-slice per variant, statistical significance rules, heuristic scoring (no ML)
- **Design system:** Yeshua Academy brand colors, typography tokens, template catalog (7 core templates)
- **Performance:** <2 sec/variant, <80 KB YouTube, 1000 thumbnails/hour throughput

### Phase 1.4: Documentation
✅ **Complete:**
- `PHASE_1_RESEARCH_SPECIFICATION.md` — Research dimensions, questions, decision matrix
- `PHASE_1_RESEARCH_FINDINGS.md` — Full synthesis, architecture recommendation, next steps
- `THUMBNAIL_STUDIO_RESEARCH_PLAN.md` — Original high-level roadmap (now detailed by research)

---

## Next Steps

### Phase 6 Completion (2026-05-26)
1. ✅ API endpoints implemented
2. ✅ API tests written + documented
3. ⏳ Optional: n8n workflow stubs, CLI extensions, integration tests

### Phase 3 Implementation (2026-06)
⏳ **A/B Testing for YouTube Thumbnails:**
- Database schema: `a_b_test_results` table
- API endpoints: `/thumbnail-tests/create`, `/thumbnail-tests/{id}/record-slice-a`, etc.
- 7-day time-slice CTR comparison
- Winner determination algorithm
- Dashboard integration

### Phase 1 → Phase 2 (2026-06)
⏳ **Thumbnail Studio Phase 2: Architecture Design**
1. Finalize component APIs
2. Design YAML template format with examples
3. Create platform-specific cropping rules
4. Database schema for variant results
5. Error handling strategy

### Phase 1 → Phase 4 (2026-06)
⏳ **Says the Bible Migration:**
1. Parallel run (both systems generate)
2. Compare results (quality, speed)
3. Gradual cutover (metadata job uses brain-core thumbnail API)
4. Decommission old pipeline

---

## References

- **Video Orchestrator Roadmap:** `brain/projects/video-orchestrator/docs/roadmap.md`
- **Brain-core API:** `brain/projects/brain-core/src/api/routes.ts`
- **Job Queueing:** `brain/projects/brain-core/src/adapters/job-orchestrator.ts`
- **Says the Bible repo:** `/Users/Office/Repos/yeshuaacademy/says-the-bible/`
