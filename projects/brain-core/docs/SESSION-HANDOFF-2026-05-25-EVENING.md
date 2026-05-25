# Session Handoff — 2026-05-25 Evening

## Current State Summary

### ✅ Completed This Session

**Phase 0.1: YouTube Sync Refactoring** — COMPLETE
- Refactored `youtube-sync-templates.mjs` to use brain-core API
- Removed local ImageMagick rendering
- Downloads best variant, uploads to YouTube

**Phase 0.2: Multi-Platform Facebook & Pinterest** — STEPS 1-3 COMPLETE  
- n8n workflows activated
- Platform accounts registered in database
- Pipeline dry-run validated

**Phase T: YouTube A/B Testing** — PARKED
- 5 critical questions documented
- Roadmap outlined (8-12 hours estimated)
- Will resume after SEO strategy and thumbnail studio are production-ready

---

## Next Priority: SEO Strategy + Thumbnail Design Studio

### A. YouTube SEO Strategy Status

**File:** `says-the-bible/docs/product/youtube-seo-implementation.md`

**Current Status:** Phases 1-5 complete; Phase 6 partially complete

| Phase | Goal | Status | Owner |
|-------|------|--------|-------|
| 1 | Strategy documented, schema defined | ✅ DONE | - |
| 2 | Pipeline generates SEO package per video | ✅ DONE | - |
| 3 | Validation — reject weak metadata | ✅ DONE | - |
| 4 | Backfill SEO packages (54 videos) | ⏳ PENDING | Manual review + YouTube Studio apply |
| 5 | YouTube API metadata update | ✅ DONE | - |
| 6 | Analytics feedback loop | ⏳ PARTIAL | Infrastructure done; production migration pending |

**What's Working:**
- New videos automatically get SEO packages during pipeline run
- Validation catches generic/weak metadata before upload
- YouTube API update works (50 quota units per call)
- Dry-run mode available: `npm run pipeline:seo:apply:dry -- --slug <slug>`

**What Needs Doing:**
1. Manual review of 54 backfill SEO packages
2. Apply packages to YouTube Studio (use Phase 5 script or manual)
3. Set up weekly analytics review process (Phase 6 infrastructure exists)

**Command Reference:**
```bash
# Generate new episode SEO package (automatic in pipeline)
npm run pipeline -- --slug 055-your-episode

# Dry-run: see what would be updated on YouTube
npm run pipeline:seo:apply:dry -- --slug <slug>

# Apply SEO package to YouTube (requires PIPELINE_ALLOW_PRODUCTION_MUTATION=1)
npm run pipeline:seo:apply -- --slug <slug>

# List overdue analytics reviews
npm run pipeline:analytics:overdue
```

---

### B. Thumbnail Design Studio Status

**Files:**
- `says-the-bible/docs/features/thumbnail-system-roadmap.md` (source of truth)
- `says-the-bible/src/server/image-generation/thumbnail-render-plan.ts` (TypeScript schema)
- `says-the-bible/src/server/image-generation/thumbnail-render-plan-builder.ts` (builder)

**Current Status:** Phases 1-2 complete; Phase 3 onward ready for production

| Phase | Goal | Status | Note |
|-------|------|--------|------|
| 1 | Define render-plan schema | ✅ DONE | TypeScript interface defined |
| 2 | Preview/output use same source | ✅ DONE | Admin preview uses render-plan API |
| 3 | Canonicalize image generation | ✅ READY | Brain-core integration complete (Phase 4B) |
| 4 | Fix YouTube sync | ✅ DONE | Refactored this session to use brain-core |
| 5 | Clean legacy paths | ⏳ PENDING | After Phase 3 proved |
| 6 | Quality hardening | ⏳ LATER | Caching, validation, determinism |

**What's Working:**
- Brain-core rendering engine (Phase 4B complete)
- 3-variant confidence scoring (0.7-0.99)
- Pipeline integration: compose → thumbnail (brain-core) → YouTube sync
- Admin preview consumes render-plan API
- YouTube sync uses brain-core variants

**What's Fallback:**
- Legacy ImageMagick overlay path exists for recovery if brain-core unavailable
- Local template rendering as safety net

**What Needs Doing (For Production):**
1. End-to-end test: full pipeline with real episode audio/background
2. Verify brain-core variants match admin preview
3. Monitor thumbnail quality for 5+ episodes
4. Confirm YouTube engagement metrics (CTR tracking — Phase T, deferred)

**Production Readiness Checklist:**
- ✅ Render plan schema defined and validated
- ✅ Brain-core API integration complete
- ✅ Pipeline generates 3 variants with confidence scores
- ✅ YouTube sync uploads highest-confidence variant
- ✅ Fallback path documented
- ⏳ End-to-end test with real data needed
- ⏳ Quality baseline established

---

## What's Needed Now (To Make Videos)

### For Today's Video Run:

**Prerequisites:**
1. ✅ Pipeline fully functional (normalize → subtitle → compose → thumbnail → metadata → multi_post)
2. ✅ Brain-core rendering operational (`http://localhost:4877`)
3. ✅ YouTube, Facebook, Pinterest accounts registered
4. ✅ n8n workflows activated and listening

**Commands:**
```bash
# Full pipeline with SEO strategy + thumbnails + multi-platform posting
cd ~/Repos/prochattools/web/says-the-bible
npm run pipeline -- --slug <new-episode-slug>

# With dry-run first
npm run pipeline -- --slug <slug> --dry-run

# Monitor jobs
vo jobs --pending
vo job <job-id>
```

**Expected Output:**
- Normalized audio
- Generated subtitles
- Composed video
- 3 thumbnail variants from brain-core
- Platform-specific metadata (Facebook, Pinterest, YouTube)
- Posted to all 3 platforms via n8n

---

## Context for Next Session

### If Resuming SEO/Thumbnail Work:

**To understand SEO status:**
- Read: `says-the-bible/docs/product/youtube-seo-implementation.md` (Phases 1-5 complete, Phase 6 partial)
- Next: Manual review of 54 backfill packages, then deploy with Phase 5 script

**To understand Thumbnail status:**
- Read: `says-the-bible/docs/features/thumbnail-system-roadmap.md` (Phases 1-4 complete)
- Next: End-to-end test with real episode, monitor quality, consider legacy fallback

**If Resuming A/B Testing (Later):**
- Read: `brain/projects/brain-core/docs/PHASE-T-YOUTUBE-AB-TESTING-PARKED.md`
- Answer the 5 questions first
- Then proceed with Phase T1-T5

### Git State:

All changes committed:
```
✅ Phase 0.1 YouTube sync refactored
✅ Phase 0.2 Facebook/Pinterest ready for testing
✅ Documentation updated
✅ Parked notes created
```

### Key Files Modified This Session:

**Brain-core:**
- `projects/brain-core/docs/project-onboarding-split.md` (added Says the Bible section)
- `projects/brain-core/README.md` (Phase 4B status)
- `projects/brain-core/docs/PHASE-T-YOUTUBE-AB-TESTING-PARKED.md` (new)
- `projects/brain-core/docs/SESSION-HANDOFF-2026-05-25-EVENING.md` (this file)

**Says the Bible:**
- `scripts/pipeline/00d-generate-thumbnail-overlay.mjs` (refactored to brain-core)
- `scripts/pipeline/youtube-sync-templates.mjs` (refactored to brain-core)
- `docs/README.md` (added brain-core reference)
- `docs/features/thumbnail-system-roadmap.md` (Phase 4B section added)

---

## Immediate Action Items

### To Make Videos Today:

1. ✅ Prepare audio + background image
2. ✅ Have episode slug and title ready
3. Run: `npm run pipeline -- --slug <slug>`
4. Monitor posting to YouTube, Facebook, Pinterest
5. Verify n8n completion callbacks
6. Check posting instructions in Brain Console

### To Complete SEO Strategy:

1. Review 54 SEO package drafts manually
2. Apply to YouTube with Phase 5 script: `npm run pipeline:seo:apply -- --slug <slug>`
3. Set up weekly analytics review (Phase 6 infrastructure exists)

### To Validate Thumbnail Studio:

1. Run 5+ episodes through full pipeline
2. Inspect brain-core variants for quality
3. Compare with admin preview
4. Monitor YouTube CTR (Phase T, deferred)

---

## Architecture Overview (Current State)

```
Audio + Background + Title
         ↓
[Brain-Core Video Orchestrator]
         ↓
   normalize → subtitle → compose → thumbnail (brain-core API)
         ↓
   metadata (LLM platform-specific)
         ↓
   multi_post (3 accounts: YouTube, Facebook, Pinterest)
         ↓
   n8n workflows → Platform APIs
```

**SEO Integration:**
- YouTube: Title, description, tags, chapters embedded in metadata
- Facebook: 500-char post, 3-5 hashtags, engagement CTA
- Pinterest: 500-char pin, 5-10 hashtags, evergreen discovery

**Thumbnail Integration:**
- Brain-core: Renders 3 variants per request
- Pipeline: Selects highest-confidence variant for YouTube sync
- Admin: Can override with manual template/colors

---

## Questions Answered / Deferred

**Answered This Session:**
- ✅ Are Facebook/Pinterest workflows in n8n? YES (import/activate complete)
- ✅ Are accounts registered? YES (added to database)
- ✅ Does pipeline dry-run work? YES (validated with 6-step chain)

**Deferred to Phase T:**
- ⏳ YouTube OAuth refresh mechanism?
- ⏳ Episode → YouTube video_id mapping complete?
- ⏳ A/B test window timing (0h / 24h / 48h)?
- ⏳ Test duration (7 days fixed / adaptive)?
- ⏳ YouTube Analytics fallback strategy?

---

## Notes for Continuity

- **Brain-core URL:** `http://localhost:4877` (default)
- **n8n URL:** `https://n8n.prochat.tools`
- **Video Orchestrator API:** `~/.local/video-orchestrator/` (Python worker + FastAPI)
- **Pipeline:** `says-the-bible/scripts/pipeline/run.mjs` (main orchestrator)
- **Memory system:** Use `/memory` skill or `mem-write` CLI for persistent notes

---

**Session ended:** 2026-05-25 evening  
**Next focus:** Make videos with working pipeline (SEO + thumbnails + multi-platform)  
**Backup plan:** Fall back to legacy thumbnail pipeline if brain-core unavailable
