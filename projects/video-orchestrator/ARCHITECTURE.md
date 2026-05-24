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

## Next Steps

1. ✅ This architecture is documented
2. ⏳ Phase 6 implementation: Extend brain-core to handle multi-platform (YouTube → Pinterest → Facebook → all 8)
3. ⏳ Phase 6.5 (after Phase 6): Rebuild Thumbnail Studio as a real design tool in Brain Console, wire it into the pipeline
4. ⏳ Phase 4: Says the Bible migration (extract its thumbnail logic, rebuild in brain-core, migrate)

---

## References

- **Video Orchestrator Roadmap:** `brain/projects/video-orchestrator/docs/roadmap.md`
- **Brain-core API:** `brain/projects/brain-core/src/api/routes.ts`
- **Job Queueing:** `brain/projects/brain-core/src/adapters/job-orchestrator.ts`
- **Says the Bible repo:** `/Users/Office/Repos/yeshuaacademy/says-the-bible/`
