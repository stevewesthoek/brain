# Phase T: YouTube A/B Testing Framework — PARKED

**Status:** Parked for later (2026-05-25)  
**Priority:** Low — Phase 0.2 (Multi-platform Facebook/Pinterest) and SEO Strategy take priority  
**Owner:** TBD

## Five Critical Questions (To Answer When Resuming)

These must be answered before implementing YouTube A/B testing framework.

### Question 1: YouTube OAuth Token Refresh
**Question:** Is the YouTube OAuth token currently stored and refreshable?

**Why it matters:** YouTube Analytics API requires valid OAuth2 token. If token expires, we can't fetch CTR data.

**What we need to know:**
- Where is the YouTube token stored? (Says the Bible `.env` or database?)
- Is there a token refresh mechanism?
- What's the expiration window?

**Related files:**
- Says the Bible: `.env` (YouTube credentials)
- Brain-core: `~/.local/video-orchestrator/services/youtube-uploader/` (if exists)

---

### Question 2: Episode → YouTube Video ID Mapping
**Question:** Can we reliably map episode_slug → youtube_video_id for Analytics queries?

**Why it matters:** YouTube Analytics API requires video_id. We need to fetch CTR for specific videos.

**What we need to know:**
- Is youtube_video_id stored in `catalogProduct` table?
- Do all published episodes have video_id set?
- What's the gap? (How many published episodes missing video_id?)

**Related schema:**
```sql
SELECT slug, youtube_video_id FROM catalogProduct WHERE youtube_video_id IS NOT NULL;
```

---

### Question 3: A/B Test Window Start Timing
**Question:** When should the A/B test window START for a newly uploaded video?

**Options:**
- **A:** Immediately upon upload (0 hour)
- **B:** After first 24 hours (YouTube initial push, then stabilize)
- **C:** After first 48 hours (YouTube Analytics 48h reporting delay)
- **D:** Configurable per episode

**Why it matters:** Starting too early = noisy data (algorithm still pushing). Starting too late = lose early engagement window.

**Best practice:** YouTube typically recommends 48h minimum before analyzing.

---

### Question 4: A/B Test Duration & Stopping Rule
**Question:** How long should each variant be shown before switching or declaring winner?

**Options:**
- **A:** Fixed 7 days (standard A/B test window)
- **B:** Adaptive (stop when significance p<0.05)
- **C:** Configurable per campaign
- **D:** Manual operator decision

**Why it matters:** 7 days standard, but faith-based content might have different patterns (weekend spikes, etc.)

**Consideration:** Operating assumption is 7 days. Revisit if data suggests otherwise.

---

### Question 5: YouTube Analytics API Fallback
**Question:** What do we do if YouTube Analytics API fails or returns no data?

**Failure scenarios:**
- API rate limited (quota exceeded)
- Token expired (OAuth failure)
- Video too new (<48h, no analytics available)
- API returns zeros (no engagement data)

**Options:**
- **A:** Use view count from YouTube Studio admin UI (manual verification)
- **B:** Use proxy metrics (watch time, average view duration)
- **C:** Skip test window, use next video
- **D:** Delay A/B test window start

**Why it matters:** We need a graceful degradation strategy so video posting doesn't block on analytics.

---

## Implementation Roadmap (Deferred)

**Phase T1 (YouTube Analytics Integration):** 2-3 hours
**Phase T2 (Variant Tracking & Assignment):** 1-2 hours
**Phase T3 (A/B Testing Logic):** 2-3 hours
**Phase T4 (Admin API for Winner Declaration):** 1 hour
**Phase T5 (Dashboard Integration):** 2-3 hours

**Total:** 8-12 hours

## How to Resume

When returning to this phase:
1. Answer the 5 questions above with the user
2. Document answers in this file
3. Proceed with Phase T1
4. Use documented answers to guide implementation choices

## Related Files (When Needed)

**Brain-core:**
- `projects/brain-core/docs/PHASE-4B-COMPLETE.md` — thumbnail rendering complete
- `projects/brain-core/docs/video-orchestrator-strategy.md` — multi-platform flow

**Says the Bible:**
- `docs/features/thumbnail-system-roadmap.md` — Phase 4B brain-core integration
- `.env` — YouTube OAuth credentials
- `src/app/api/admin/thumbnails/` — thumbnail admin routes

**Video Orchestrator:**
- `~/.local/video-orchestrator/worker/video_worker.py` — job execution
- `~/.local/video-orchestrator/api_server.py` — REST API
- `~/.config/video-orchestrator/platform-specs.json` — platform configuration
