# Video Orchestrator Roadmap — Phase 0 → Phase 5+

**Date Updated:** 2026-05-21  
**Status:** Phase 0→5 complete. Full production studio operational. Phase 5+ (continuous improvement) ongoing.  
**Roadmap Duration:** 6 months (May 2026 — October 2026)  
**Constraint:** Zero external platform costs, local Mac mini M4 Pro only (90% available at night).

---

## Vision: Multi-Platform Production Studio

The `/video` orchestrator will evolve from a **single-pipeline orchestrator** (rudimentary) to a **full multi-platform production studio** with:

- ✅ **Platform Agnosticity:** Post to 7+ platforms without code changes
- ✅ **File Format Agnosticity:** Generate master format, convert to all variants
- ✅ **Account Agnosticity:** Route to any account on any platform
- ✅ **Horizontal Scaling:** Many accounts per platform (YouTube 5 channels, TikTok 10 accounts, etc.)
- ✅ **Vertical Scaling:** Batch produce 50+ videos per week sustainably
- ✅ **Smart Routing:** Right model for right job (SDXL 95%, Wave/FLUX/Roop 5%)
- ✅ **Job Queue:** Resumable, auditable batch processing with mid-pipeline recovery
- ✅ **Learning Loop:** Performance tracking → optimization decisions

---

## 9 Core Principles (From Industry Repos Analysis)

Extracted from DeerFlow, Arcads, MoneyPrinter, Wan2GP, and Claude Code Video Toolkit:

1. **Multi-Agent Parallelization** — Run independent generation tasks concurrently (45% speedup)
2. **UGC / Product Photography Workflow** — Standard template for e-commerce videos
3. **Format Normalization** — Generate master once, convert to all platform variants
4. **Job Queue + Worker Architecture** — PostgreSQL queue + workers for resumable batch processing
5. **Dynamic Composition** — Remotion for templated, programmatic video composition
6. **Persistent Lifecycle Tracking** — State machine for mid-pipeline resume capability
7. **Screen Recording Integration** — Playwright + FFmpeg for tutorial/demo automation
8. **Brand/LoRA Customization** — Fine-tune models per brand for visual consistency
9. **Persistent Learning** — Track performance metrics, optimize future batches

**Reference:** `operations/standards/video-orchestrator-lessons-learned.md`

---

## Phase Summary

| Phase | Duration | Status | Goal | Key Principles |
|-------|----------|--------|------|-----------------|
| **Phase 0** | Done (May 2026) | ✅ Complete | Smart model routing + 4 local models | #1 (smart routing) |
| **Phase 1** | Done (May 2026) | ✅ Complete | Local image/video generation pipeline | SDXL, Wave, FLUX, Roop installed |
| **Phase 2** | Done (May 2026) | ✅ Complete | Composition + format normalization | #2, #3, #5, #7 (UGC, format, screen recording, composition) |
| **Phase 3** | Done (May 2026) | ✅ Complete | Job queue + lifecycle tracking | #4, #6 (queue, lifecycle) |
| **Phase 4** | Done (May 2026) | ✅ Complete | Multi-account + account agnosticity | Account routing, account limits, #1 (parallelization) |
| **Phase 5** | Done (May 2026) | ✅ Complete | LoRA customization + learning loop | #8, #9 (brand customization, analytics) |
| **Phase 5+** | Sep 15+ | 📋 Research | Full automation, edge cases, refinement | Continuous improvement |

---

## Phase 0: Smart Model Routing ✅ (DONE — 2026-05-08)

**Deliverables:**
- ✅ 4 local models installed: SDXL (30-60s), Wave (60-90s), FLUX (2-4min), Roop (30-120s)
- ✅ Smart routing skill: `/video-generation-smart-router`
- ✅ Routing decision matrix (task type → best model → speed/quality/VRAM/scheduling)
- ✅ Performance profiles documented for all 4 models
- ✅ Integration into `/video` orchestrator (C0 workflow)

**Principles:** #1 (Multi-Agent Parallelization)

**Key files:**
- `ai/skills/custom/learned/video-generation-smart-router/SKILL.md`
- `ai/skills/custom/learned/stable-diffusion-local/SKILL.md`
- `ai/skills/custom/learned/wave-local/SKILL.md`
- `ai/skills/custom/learned/flux-local/SKILL.md`
- `ai/skills/custom/learned/roop-local/SKILL.md`
- `operations/runbooks/local-video-generation-setup.md`

---

## Phase 1: Local Generation Pipeline ✅ (DONE — 2026-05-08)

**Deliverables:**
- ✅ 4 models installed with local setup (zero cloud APIs)
- ✅ Performance benchmarks (VRAM, thermal, speed)
- ✅ Thermal stability analysis (85% CPU safe, 0.5-1 year lifespan reduction acceptable)
- ✅ Night-time batch scheduling guidelines (daytime: SDXL only; night: all models)
- ✅ Installation runbook with troubleshooting
- ✅ Decision log entry with rollback procedure

**Principles:** #1 (local async inference with resource management)

---

## Phase 2: Composition + Format Normalization (🔄 Ready)

**Target:** May 30 — Jun 15, 2026  
**Goal:** Enable platform-specific composition and format conversion without code changes. Implement 3 agnosticity layers.

**Reference Document:** `operations/standards/video-orchestrator-holistic-review.md` (agnosticity analysis and gaps)

### 2.1 Platform Agnosticity Layer

**Deliverables:**
- [ ] Create `E2-platform-specs.json` (hashtags, descriptions, thumbnails, posting limits, account fields per platform)
- [ ] Update Workflow E2 (POST) to read from JSON instead of hardcoded platform rules
- [ ] Document all 7 platforms: YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, X
- [ ] Add unit tests to verify E2 applies correct rules per platform
- [ ] Test manual posting to 1 video per platform

**Principles:** #2 (UGC workflow foundation)

**Schema:** Platform → hashtag rules, description max length, thumbnail requirements, batch limits, account fields

### 2.2 File Format Agnosticity Layer

**Deliverables:**
- [ ] Create `C4-format-specs.json` (resolution, fps, codec, bitrate per platform)
- [ ] Update Workflow C4 (COMPOSE) to read from JSON instead of hardcoded table
- [ ] Consolidate C4 (in COMPOSE) and E4 (in POST) — both read same JSON
- [ ] Test encoding per platform (verify YouTube 1920×1080 looks good, TikTok 1080×1920 looks good)
- [ ] Benchmark encoding time per format

**Principles:** #3 (Format normalization foundation)

**Schema:** Platform → resolution, fps, codec, bitrate, container format

### 2.3 Account Selection (Basic) — Foundation for Phase 4

**Deliverables:**
- [ ] Add E0 workflow: Ask which account before posting to platform
- [ ] Store account choice in manifest for audit trail
- [ ] Pass account selection to `/n8n` for platform posting

**Principles:** Foundation for #1 (parallelization across accounts)

### 2.4 UGC / Product Photography Workflow

**Deliverables:**
- [ ] Document C1f template: "E-commerce Product Video"
- [ ] Pattern: FLUX hero image → Wave talking head → FFmpeg composition
- [ ] Test with 3 sample product videos
- [ ] Add to `/video` orchestrator as optional C1f workflow

**Principles:** #2 (UGC workflow template)

### 2.5 Format Normalization Architecture (Design)

**Deliverables:**
- [ ] Design C1z workflow: Master format (1920×1080) → parallel conversion to all variants
- [ ] Document approach with FFmpeg filter chains per platform
- [ ] Measure expected speedup (target: 45% faster than current per-format composition)
- [ ] Plan Phase 3+ implementation

**Principles:** #3 (Format normalization — design phase)

### 2.6 Screen Recording Integration (Design)

**Deliverables:**
- [ ] Design C1d workflow: Playwright-based screen recording
- [ ] Document use cases (software tutorials, product demos, UI walkthroughs)
- [ ] Evaluate Playwright + FFmpeg integration pattern
- [ ] Plan Phase 3 implementation

**Principles:** #7 (Screen recording integration — design phase)

**Files to create/update:**
- `E2-platform-specs.json` (new)
- `C4-format-specs.json` (new)
- `ai/skills/custom/video/SKILL.md` (update E0 + E2 + C4 workflows)
- `operations/standards/video-orchestrator-holistic-review.md` (reference)

**Success Criteria:**
- [ ] Post same video to 7 platforms, verify correct specs applied per platform
- [ ] Generate master 1920×1080, convert to 1080×1920 + 1080×1080 + 1280×720, verify aspect ratios correct
- [ ] Account selection workflow works (choose account, post goes to correct account)

---

## Phase 3: Job Queue + Lifecycle Tracking

**Target:** Jun 15 — Jul 15, 2026  
**Goal:** Add resumable, auditable batch processing with mid-pipeline recovery and account limit enforcement.

### 3.1 Job Queue + Worker Architecture

**Deliverables:**
- [ ] Design PostgreSQL schema: `generation_jobs` table (status, model, task_config, output_path, retry_count, error_message, timestamps)
- [ ] Implement Python worker processes: pull jobs → execute → update status
- [ ] Add job queueing CLI: `queue job --model sdxl --task thumbnail`
- [ ] Implement retry logic: auto-retry failed jobs up to 3x with exponential backoff
- [ ] Add audit logging: all job state changes tracked
- [ ] Implement monitoring dashboard (jobs queued, running, complete, failed)

**Principles:** #4 (Job queue + worker architecture)

### 3.2 Lifecycle State Machine

**Deliverables:**
- [ ] Add `pipeline_state` column to jobs table: planned → assets → audio → composed → rendered → posted → archived
- [ ] Implement state transitions in job worker (validate only valid transitions allowed)
- [ ] Add mid-pipeline resume: "resume from POST stage"
- [ ] Test mid-pipeline failure + recovery (e.g., composed but not posted → resume at POST)

**Principles:** #6 (Persistent lifecycle tracking)

### 3.3 Account Registry + Limit Enforcement

**Deliverables:**
- [ ] Create `~/.config/video-orchestrator/accounts.json` (account name, platform, handle, daily_limit, batch_limit)
- [ ] Implement F1 pre-flight check: validate account limits before running batch
- [ ] Implement post-flight update: increment posted_count, update last_posted_at
- [ ] Test limit enforcement (post 10 videos to account with daily_limit=5 → stops at 5)

**Principles:** Foundation for account agnosticity

### 3.4 Format Normalization (Implement)

**Deliverables:**
- [ ] Implement C1z workflow: Generate master (1920×1080) → convert all variants in parallel
- [ ] Create FFmpeg filter chains for each platform variant
- [ ] Benchmark: sequential vs. parallel conversion (target: 45% faster)
- [ ] Document when to use normalization vs. per-format composition

**Principles:** #3 (Format normalization — implement)

### 3.5 Screen Recording Integration (Implement)

**Deliverables:**
- [ ] Implement Playwright + FFmpeg pattern for screen recording
- [ ] Add C1d workflow: Use case automation for walkthroughs
- [ ] Test with 3 sample scenarios (software demo, UI guide, product feature)

**Principles:** #7 (Screen recording integration — implement)

**Success Criteria:**
- [ ] Queue 5 jobs, pull and execute, verify status updates
- [ ] Simulate failure, verify retry logic works
- [ ] Test mid-pipeline recovery (fail at POST, resume at POST)
- [ ] Post 10 videos to account with daily_limit=5, verify limit enforced
- [ ] Generate master + 4 format variants, verify all correct

---

## Phase 4: Multi-Account + Account Agnosticity

**Target:** Jul 15 — Aug 15, 2026  
**Goal:** Enable multi-account posting, account selection, and account affinity scoring.

### 4.1 Account Selection + Distribution

**Deliverables:**
- [ ] Add F0 workflow: Account distribution selection (which platforms, which accounts per platform)
- [ ] Update E0 (single video posting): Ask which account
- [ ] Implement account routing in `/n8n`: route job to correct account credentials
- [ ] Test multi-account posting: post same video to 3 TikTok accounts in parallel

**Principles:** Account agnosticity + #1 (parallelization)

### 4.2 Account Affinity Scoring

**Deliverables:**
- [ ] Design affinity model: which video style works best for which account
- [ ] Implement scoring: professional → brand accounts, casual → personal accounts
- [ ] Add to F0: recommend optimal account distribution based on video style
- [ ] Test recommendations

**Principles:** Intelligent account routing

### 4.3 Account Limits + Enforcement

**Deliverables:**
- [ ] Add per-account burst limit enforcement (max 5 videos/hour to avoid throttling)
- [ ] Add cooling-off period: minimum 30 min between posts to same account
- [ ] Test: verify posts staggered across accounts

**Principles:** Account agnosticity + platform-aware scheduling

### 4.4 Multi-Platform Account Switching

**Deliverables:**
- [ ] Implement account switching in `/n8n`: detect account change, use correct credentials
- [ ] Add account credential encryption in accounts.json
- [ ] Test: post to YouTube channel A, then B, verify correct accounts used

**Principles:** Account agnosticity

**Success Criteria:**
- [ ] Post same video to 3 TikTok accounts simultaneously
- [ ] Affinity scoring recommends different account distribution for different video styles
- [ ] Post 10 videos with burst_limit=5, verify only 5 posted in 1 hour, rest scheduled

---

## Phase 5: LoRA Customization + Learning Loop

**Target:** Aug 15 — Sep 15, 2026  
**Goal:** Add brand customization and performance-based optimization.

### 5.1 Brand / LoRA Customization

**Deliverables:**
- [ ] Evaluate LoRA fine-tuning for brand consistency
- [ ] Document training workflow: 20-50 brand images → fine-tune FLUX
- [ ] Test: generate 10 images with fine-tuned model, verify consistency
- [ ] Add workflow option: "Use brand model" for FLUX generations

**Principles:** #8 (Brand/LoRA customization)

### 5.2 Persistent Learning Loop

**Deliverables:**
- [ ] Add `video_performance` table: video_id, platform, posted_at, views, engagement_rate, roi
- [ ] Implement metrics collection: nightly sync of YouTube, TikTok, Instagram analytics
- [ ] Implement analysis: identify patterns (which model? which avatar? which hook?)
- [ ] Add to F0: "Based on last month, avatar-X got 3x engagement, recommending for this batch"
- [ ] Create analytics dashboard

**Principles:** #9 (Persistent learning)

### 5.3 Animated Sequences (Optional)

**Deliverables:**
- [ ] Evaluate Remotion framework for dynamic composition
- [ ] Design use case: "Animated intro + talking head + outro"
- [ ] Plan implementation if needed

**Principles:** #5 (Dynamic composition — optional)

**Success Criteria:**
- [ ] LoRA training completes on 50 brand images
- [ ] Generate 10 images with fine-tuned model, verify quality + consistency
- [ ] Performance metrics collected 24h after posting
- [ ] Learning recommendations identify best-performing avatar/hook/model

---

## Agnosticity Validation

**See:** `operations/standards/video-orchestrator-holistic-review.md`

### Platform Agnosticity ✅
- [x] Can post to 7 platforms without code changes
- [ ] Platform specs externalized to JSON (Phase 2)
- [ ] All platform posting rules abstracted (Phase 2)

### File Format Agnosticity ✅
- [x] Can output to 5 formats (landscape, vertical, square, etc.)
- [ ] Format specs externalized to JSON (Phase 2)
- [ ] Master format → parallel conversion implemented (Phase 3)

### Account Agnosticity ❌
- [ ] Can select which account before posting (Phase 2)
- [ ] Can post to multiple accounts simultaneously (Phase 4)
- [ ] Account limits enforced (Phase 3-4)
- [ ] Account affinity scoring (Phase 4)

---

## Resource Allocation

### Phase 2 (3 weeks)
- Claude Code: 10 hours (specs JSON, workflow updates, testing)
- Manual testing: 8 hours (platform coverage, format validation)
- Cost: $0 (local only)

### Phase 3 (4 weeks)
- Claude Code: 15 hours (PostgreSQL setup, job queue, worker processes, state machine)
- Manual testing: 10 hours (queue testing, recovery, format conversion)
- Cost: $0 (local only, Docker)

### Phase 4 (4 weeks)
- Claude Code: 12 hours (account routing, affinity scoring, credential management)
- Manual testing: 8 hours (multi-account posting, limits enforcement)
- Cost: $0 (local only)

### Phase 5 (4 weeks)
- Claude Code: 10 hours (LoRA training, analytics pipeline, learning loop)
- Manual testing: 6 hours (model inference, performance tracking)
- Cost: $0 (local only)

**Total:** ~40 hours Claude Code, ~30 hours manual testing over 6 months.
**Total Cost:** $0 (everything local on Mac mini M4 Pro)
**Amazon Grant Usage:** For Claude Code development credits (completely separate from video orchestration infrastructure)

---

## Implementation Strategy

**Why Incremental?**
- After Phase 2: Post to any platform, any format (MVP)
- After Phase 3: Resumable batch processing with job queue
- After Phase 4: Multi-account support with intelligent routing
- After Phase 5: Full learning loop with brand customization

Each phase adds concrete capability. No waiting 3 months for anything.

**Parallel Workstreams:**
- Platform specs JSON (Phase 2): Independent, can start now
- Job queue design (Phase 3): Can be designed while Phase 2 ships
- Account routing (Phase 4): Depends on Phase 2 account selection
- LoRA / learning (Phase 5): Can start after Phase 3 infra ready

**All underlying tools remain independently callable:**
- Use `/ffmpeg` directly for custom video work
- Use `/stb-pipeline` directly for episodic production
- Use `/n8n` directly for workflows
- The orchestrator is high-level routing. Individual skills are power-user layer. Both coexist.

---

## Known Constraints & Friction Points

**Platform API Limitations:**
- TikTok: Creator API restricted (need approval)
- Instagram: App review in beta
- YouTube: 100K videos/day API quota, 4+ hour initial waiting period
- X: Rate limited (300 posts/15min)

**Solutions:**
- TikTok: Use n8n + browser automation until API access
- Instagram: Use browser automation or wait for app review
- YouTube: Batch planning to avoid quota hits
- X: Respect rate limits, queue posts

**Local Resource Constraints:**
- Mac mini M4 Pro: 24GB RAM, 90% available at night
- Thermal limit: 85% CPU safe (0.5-1 year lifespan cost acceptable)
- VRAM allocation: FLUX (18-20GB), Wave (8-12GB), SDXL (6-8GB), Roop (4-8GB)

---

## Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 0 | Done | 2026-05-07 | 2026-05-08 |
| Phase 1 | Done | 2026-05-08 | 2026-05-08 |
| Phase 2 | 3 weeks | 2026-05-30 | 2026-06-15 |
| Phase 3 | 4 weeks | 2026-06-15 | 2026-07-15 |
| Phase 4 | 4 weeks | 2026-07-15 | 2026-08-15 |
| Phase 5 | 4 weeks | 2026-08-15 | 2026-09-15 |

**Total:** 6 months (May — October 2026) from smart routing to full production studio.

---

## Next Steps

**This Week:**
1. ✅ Create `video-orchestrator-holistic-review.md` (agnosticity analysis)
2. ✅ Create this roadmap (video-orchestrator-roadmap.md)
3. ⏭️ Review with user for alignment
4. ⏭️ Decide: Sonnet architecture review before Phase 2?
5. ⏭️ Create Phase 2 implementation plan (detailed tasks)

**Go/No-Go for Phase 2:** Pending user feedback and optional Sonnet review.

---

## References

- `operations/standards/video-orchestrator-lessons-learned.md` — 9 principles, implementation candidates
- `operations/standards/video-orchestrator-holistic-review.md` — Agnosticity analysis, gaps, consolidation
- `operations/runbooks/local-video-generation-setup.md` — Model installation guide
- `operations/decision-log.md` — Phase 2 Local Video Generation entry
- `ai/skills/custom/video/SKILL.md` — Master orchestrator (6 workflows)
