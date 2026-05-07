# Video Orchestrator Production Studio — Roadmap

**Status:** Phase 0 (Rudimentary Foundation)  
**Created:** 2026-05-07  
**Owner:** Steve Westhoek  
**Vision:** Multi-platform automated video posting studio  

---

## Vision Statement

Transform the `/video` orchestrator from a basic skill-router into a full-fledged production studio that automates end-to-end video distribution across multiple platforms, multiple accounts, on schedule.

**Input:** Script, idea, or raw content  
**Output:** Videos automatically formatted and posted to 7+ platforms with different accounts in series-specific configurations  
**Ideal state:** Batch produce 50 episodes → all posts to all platforms automated, staggered, audited, resilient to failures

---

## Current State: Phase 0 (Rudimentary Foundation)

### What Works Today
- Natural language routing to individual skills: `/video "write a script"` → Claude direct
- Six workflows (WRITE → VOICE → COMPOSE → DESIGN → POST → PIPELINE)
- Integration with: `/stb-pipeline`, `/ffmpeg`, `/design`, `/n8n`
- Basic checkpoint/resume for batch operations (via STB pipeline pattern)

### What's Missing (Blockers for Phases 1-5)
- ❌ Account registry (which YouTube/TikTok/IG accounts exist, which series use them)
- ❌ Credential manager (secure storage of API keys, OAuth tokens, refresh tokens)
- ❌ Multi-account routing (intelligently pick which account to post to)
- ❌ Format converters (auto-resize/crop per platform spec)
- ❌ Schedule manager (post at optimal times per platform, stagger posts)
- ❌ Platform CLIs (YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, X)
- ❌ Platform APIs (wired integrations, not stubs)
- ❌ Audit trail (manifest tracking every post across every platform)
- ❌ Error recovery (retry logic, partial failure handling)
- ❌ Orchestration engine (n8n workflows that tie all pieces together)

---

## Phase 1: Account & Credential Management (Weeks 1-2)

### Objective
Establish persistent storage for platform accounts, credentials, and series assignments.

### Deliverables
1. **Account Registry** (Prisma model or JSON config)
   ```
   Platform | Account Name | Account ID | Series | Credentials Ref | Status
   YouTube  | Channel-A    | UCxxx      | Series-1 | cred-yt-1 | active
   TikTok   | TikTok-Main  | @username  | Series-2 | cred-tt-1 | active
   Instagram | IG-Reels   | @username  | Series-1,3 | cred-ig-1 | active
   LinkedIn | Corp-Page   | company-id | Series-3 | cred-li-1 | active
   ```

2. **Credential Manager**
   - Secure storage (encrypted in `.env` or vault)
   - Credential types: API key, OAuth token, username/password (where needed)
   - Rotation support (refresh tokens, expiry tracking)
   - Per-credential audit trail (when accessed, by whom)

3. **Series Config** (JSON or YAML)
   ```yaml
   series:
     Series-1:
       name: "Daily Motivations"
       accounts:
         - YouTube:Channel-A (primary upload)
         - Instagram:IG-Reels (reels only)
         - TikTok:TikTok-Main (daily)
       tts_voice: "Microsoft:en-GB-OllieMultilingualNeural"
       format_preferences:
         YouTube: 1920x1080 (16:9)
         Instagram: 1080x1080 (1:1)
         TikTok: 1080x1920 (9:16)
       schedule:
         YouTube: "Mon-Fri 9 AM"
         Instagram: "Mon-Wed 3 PM"
         TikTok: "daily 6 PM"
   ```

4. **Runbook** (`operations/runbooks/video-accounts.md`)
   - How to add a new platform account
   - How to link accounts to series
   - How to rotate credentials safely
   - Troubleshooting failed posts

---

## Phase 2: Platform-Specific Pipeline Templates (Weeks 3-5)

### Objective
Build post-ready pipeline templates for each platform, with format conversion built-in.

### Deliverables

1. **Format Converters** (via `/ffmpeg`)
   ```
   Input: 1920x1080 MP4 (generic)
   
   YouTube → 1920x1080 (16:9) H.264
   TikTok  → 1080x1920 (9:16) H.264
   Instagram → 1080x1080 (1:1) + 1080x1920 (9:16) variants
   LinkedIn → 1920x1080 (16:9)
   Facebook → 1080x1080 (1:1)
   Bluesky → 1280x720 (16:9)
   X       → 1280x720 (16:9)
   ```

2. **Platform CLIs**
   - `/youtube-cli` — upload, schedule, update metadata
   - `/tiktok-cli` — post, schedule, draft management (API limitations apply)
   - `/instagram-cli` — post Reels, Stories, feed videos
   - `/linkedin-cli` — post videos to company page
   - `/facebook-cli` — post to page, schedule
   - `/bluesky-cli` — ATProto-based posting
   - `/x-cli` — Twitter v2 API wrapper

3. **Template Skill Files**
   - `/video-youtube` — YouTube-specific workflow
   - `/video-tiktok` — TikTok-specific workflow
   - `/video-instagram` — Instagram Reels-specific workflow
   - Etc.

4. **Manifest Format** (per-video audit trail)
   ```json
   {
     "video_id": "ep-001",
     "script": "production/scripts/ep-001.md",
     "audio": "production/audio/ep-001.wav",
     "rendered_generic": "production/video/ep-001-1920x1080.mp4",
     "platforms": {
       "youtube": {
         "account": "Channel-A",
         "rendered": "production/video/ep-001-yt-1080p.mp4",
         "posted_at": "2026-05-15T09:00:00Z",
         "video_id": "dQw4w9WgXcQ",
         "status": "live",
         "error": null
       },
       "tiktok": {
         "account": "TikTok-Main",
         "rendered": "production/video/ep-001-tt-1080x1920.mp4",
         "posted_at": "2026-05-15T18:00:00Z",
         "video_id": "7xyz123",
         "status": "live",
         "error": null
       }
     }
   }
   ```

---

## Phase 3: Multi-Platform Post Routing (Weeks 6-8)

### Objective
Orchestrate posting across multiple platforms in correct format and schedule.

### Deliverables

1. **Post Router Logic**
   - Input: video_id, series, platforms to post
   - Logic: fetch series config → get accounts → convert formats → queue posts
   - Output: manifest entries for each platform

2. **Scheduler Integration** (via n8n)
   - Trigger workflow: "post episode X to platforms [Y, Z] at [time]"
   - n8n workflow chains:
     1. Convert video to each platform's format
     2. Upload to each platform (queue in order)
     3. Update manifest with timestamps and IDs
     4. Send notifications (Slack, email)

3. **Batch Posting**
   - Input: episode list [1-50], platforms [YouTube, TikTok, Instagram]
   - Logic: for each episode → for each platform → queue post
   - Checkpoint after each platform batch (resume if partial failure)
   - Stagger posts (don't post all at once, respect rate limits)

4. **Error Handling**
   - Retry logic: exponential backoff, max 3 retries per post
   - Partial failure: continue with other platforms if one fails
   - Manual recovery: skip failed post, resume on next run

---

## Phase 4: Multi-Account Series Management (Weeks 9-10)

### Objective
Support complex scenarios: same video across different accounts, different videos for different accounts, series-specific routing.

### Deliverables

1. **Series Routing Rules**
   ```yaml
   # Series 1: Post to ALL accounts
   Series-1:
     routing: "broadcast"
     accounts: [YouTube-A, TikTok-A, Instagram-A]
   
   # Series 2: Different videos for different platforms
   Series-2:
     routing: "split"
     rules:
       - platforms: [YouTube, LinkedIn] → accounts: [YouTube-B, LinkedIn-B]
       - platforms: [TikTok, Instagram] → accounts: [TikTok-A, Instagram-A]
   
   # Series 3: Different accounts by schedule
   Series-3:
     routing: "scheduled"
     accounts:
       YouTube-A: ["Mon 9 AM", "Wed 9 AM"]
       YouTube-B: ["Fri 9 AM"]
   ```

2. **Account Health Monitoring**
   - Last successful post per account
   - Failure streak counter
   - Credential expiry warnings
   - Rate limit tracking

3. **Cross-Account Analytics** (stub for Phase 5)
   - Aggregate views/engagement across all accounts
   - Compare performance by series, platform, account

---

## Phase 5: Production Studio UI & Automation (Weeks 11-14)

### Objective
Make the entire system accessible without CLI/code knowledge.

### Deliverables

1. **Dashboard**
   - Series overview (last episode, next scheduled post)
   - Account status (live, paused, needs attention)
   - Recent posts (last 10 across all platforms/accounts)
   - Engagement metrics (views, likes, shares)

2. **UI for Creating Posts**
   - Script writer (integrated editor or markdown upload)
   - Platform/account selector (checkboxes for which to post)
   - Schedule picker (when to post, stagger options)
   - Preview (what it will look like on each platform)
   - "Post" button → orchestrated to all selected platforms

3. **Automation Rules**
   - "Every Monday at 9 AM, post to YouTube and TikTok"
   - "After new episode, auto-post to all Series-1 accounts within 1 hour"
   - "Post to Instagram Reels first, then YouTube Shorts 2 hours later"

4. **Audit & Analytics**
   - View all posts (across all platforms/accounts)
   - Filter by series, date, account, status
   - Export analytics (CSV, JSON)
   - Repost capability (re-upload old video to new platform)

---

## Implementation Strategy

### Why Incremental?
- **Phase 0-1:** You have account management (1-2 weeks work)
- **Phase 0-2:** You have a working MVP (write script → format → post to 1 platform)
- **Phase 0-3:** You can post to multiple platforms with staggered scheduling
- **Phase 0-4:** You can manage complex multi-account scenarios
- **Phase 0-5:** You have a production studio dashboard

At each phase, you gain capability. You don't wait 3 months to get anything working.

### Parallel Workstreams
- **Credential management** (Phase 1): Can start immediately, independent
- **Platform CLIs** (Phase 2): Each platform can be built independently
- **Routing logic** (Phase 3): Waits on Phase 1-2, but can be designed in parallel
- **UI** (Phase 5): Can be designed while backend is being built

### Key Principle
**All underlying tools remain independently callable.** The orchestrator routes + convenience. You can always:
- Use `/ffmpeg` directly for custom video work
- Use `/stb-pipeline` directly for episodic production
- Use `/n8n` directly for custom workflows
- Use platform CLIs directly

The orchestrator is the high-level layer. Individual skills are the power-user layer. Both coexist.

---

## Success Metrics

### Phase 0 (now)
- ✅ Single video to single platform via natural language

### Phase 2 (MVP)
- ✅ Single video to multiple platforms, auto-formatted
- ✅ Staggered posting (not all at once)
- ✅ Manifest tracking all posts

### Phase 3 (working)
- ✅ Batch produce 10 episodes
- ✅ Auto-post to 3+ platforms
- ✅ Checkpoint/resume on failure

### Phase 4 (sophisticated)
- ✅ Multi-account routing per series
- ✅ Different schedules per account
- ✅ Complex series rules (broadcast/split/scheduled)

### Phase 5 (studio)
- ✅ Zero-CLI usage for content creators (all via UI)
- ✅ 50 episodes → all platforms in batch
- ✅ Dashboard showing all activity
- ✅ Automated recurring posts

---

## Known Friction Points (Collect as You Go)

**Phase 0-1:**
- TikTok API is restricted (Creator API only, need approval)
- Instagram requires app review (in beta for most)
- YouTube quota limits (100K videos/day API limit, 4+ hour waiting period on first channel)
- X API v2 is good but rate-limited

**To solve:**
- TikTok: Use n8n + Zapier workaround until API access
- Instagram: Use browser automation or wait for app review
- YouTube: Plan batches to avoid quota hits
- X: Respect rate limits, queue posts

---

## Timeline (Aggressive)

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 0 | now | 2026-05-07 | now |
| Phase 1 | 2 weeks | 2026-05-14 | 2026-05-28 |
| Phase 2 | 3 weeks | 2026-05-28 | 2026-06-18 |
| Phase 3 | 3 weeks | 2026-06-18 | 2026-07-09 |
| Phase 4 | 2 weeks | 2026-07-09 | 2026-07-23 |
| Phase 5 | 4 weeks | 2026-07-23 | 2026-08-20 |

**Total:** ~15 weeks from now (mid-August 2026) to full production studio.

---

## Next Step

**Phase 1, Week 1:** Build account registry + credential manager  
**PR/Task:** `[VIDEO] Account & Credential Management`  
**Estimate:** 1-2 weeks  

Once Phase 1 lands, Phase 2 can start immediately (platform CLIs are independent).

---

## Remember

The video orchestrator is NOT mature. It's a foundation. Every friction point you hit (manual upload, forgotten account, failed post) is a signal to add to the roadmap. Collect these signals, batch them into phase planning.

This is how all great tools are built. Not from perfect plans. From using the imperfect version and iterating.

**Start small. Iterate fast. Build something real.**
