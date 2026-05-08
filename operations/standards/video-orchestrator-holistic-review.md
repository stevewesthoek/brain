# Video Orchestrator — Holistic Agnosticity Review

**Date:** 2026-05-08  
**Reviewer:** Claude Code  
**Purpose:** Validate that `/video` orchestrator and all integrated skills are platform-agnostic, file-format-agnostic, and account-agnostic. Identify gaps before Phase 2-4 implementation.

---

## Executive Summary

The `/video` orchestrator is **structurally ready** for platform/format/account agnosticity, but has **three concrete gaps** that must be addressed before implementation:

1. **Platform Agnosticity: MOSTLY GOOD** ✅ (E1 workflow covers 7 platforms; gap: hard-coded platform specs in E2)
2. **File Format Agnosticity: MOSTLY GOOD** ✅ (C4 workflow supports 5 formats; gap: no abstraction layer for format conversion)
3. **Account Agnosticity: INCOMPLETE** ❌ (E1 workflow assumes single account per platform; missing: account routing logic)

**Recommendation:** Create three companion documents (one per agnosticity layer) that formalize platform/format/account abstraction, then update E1/E2 workflows with platform-routing and account-selection logic.

---

## 1. Platform Agnosticity Analysis

### Current State

**Covered platforms (E1 workflow):**
- ✅ YouTube (long-form + Shorts)
- ✅ TikTok
- ✅ Instagram Reels
- ✅ LinkedIn
- ✅ Facebook
- ✅ Bluesky
- ✅ X (Twitter)

**How it works:** E1a → E1e explicitly routes to each platform with documented patterns.

### Agnosticity Assessment

**PASSING:**
- ✅ No hard-coded platform logic in STRATEGY (Viral Flow abstracts it)
- ✅ No hard-coded platform logic in A (WRITE workflow platform-agnostic)
- ✅ No hard-coded platform logic in B (VOICE workflow platform-agnostic)
- ✅ C1 routes by FORMAT (narrated/reel/talking-head), not platform
- ✅ D (DESIGN) routes to `/design` orchestrator (platform-agnostic)
- ✅ E1 explicitly lists all 7 platforms with independent patterns

**GAPS:**
- ❌ **E2 (Standing posting rules)** hardcodes platform-agnostic assumptions but lacks platform-specific adjustments
  - Example: "Add 3-5 hashtags for social, 1-2 for YouTube" — this is platform-aware hardcoding
  - Example: "Set thumbnail manually for YouTube, auto for most others" — needs to be abstracted
  - **Fix needed:** Create `E2-platform-specs.json` with per-platform rules (hashtags, descriptions, thumbnails, etc.)

- ❌ **E4 (Export to platform-specific format)** hardcodes aspect ratios and resolutions per platform
  - Example: Table maps platform → format (YouTube 1920×1080, TikTok 1080×1920, etc.)
  - **Fix needed:** Make format selection automatic based on platform selection, not manual

- ❌ **C4 (Export to platform-specific format)** duplication — format mapping appears both in C and E
  - **Fix needed:** Consolidate format mapping into shared abstraction

### Platform Agnosticity Gap Resolution

**Required changes:**

```markdown
## New: E2-platform-specs.json (Per-Platform Rules)

Maps each platform to standardized metadata:
- Hashtags (count, frequency)
- Description (max length, format)
- Thumbnail (required, auto, size)
- Schedule window (best times, blackout periods)
- Account limits (videos/day, batch posting, etc.)
- Filename patterns (platform conventions)

Example:
{
  "youtube": {
    "hashtags": {"count": 1-2, "placement": "description"},
    "description": {"max_length": 5000, "format": "markdown with links"},
    "thumbnail": {"required": true, "auto": false, "size": "1280×720"},
    "schedule": {"optimal_hours": "09:00-11:00 UTC", "batch_max": 3},
    "account_fields": ["channel_id", "upload_method"]
  },
  "tiktok": {
    "hashtags": {"count": 3-5, "placement": "caption_start"},
    "description": {"max_length": 150, "format": "plain text, no markdown"},
    "thumbnail": {"required": false, "auto": true},
    "schedule": {"optimal_hours": "19:00-21:00 UTC", "batch_max": 10},
    "account_fields": ["handle", "oauth_token"]
  },
  ...
}
```

---

## 2. File Format Agnosticity Analysis

### Current State

**Output formats supported (C4 workflow):**
- ✅ Video: MP4 (H.264 + AAC, all platforms)
- ✅ Video: Vertical 1080×1920 (TikTok, Instagram, YouTube Shorts)
- ✅ Video: Landscape 1920×1080 (YouTube, LinkedIn, Facebook)
- ✅ Video: Square 1080×1080 (Instagram Feed, LinkedIn Feed, Facebook Feed)
- ✅ Audio: WAV (TTS output from B2)
- ✅ Audio: MP3 (optional conversion from WAV)
- ✅ Image: PNG, JPG (thumbnails, design assets)

**How it works:** C4 table explicitly maps platform → ffmpeg command with resolution.

### Agnosticity Assessment

**PASSING:**
- ✅ Format choice depends on platform, not hard-coded to specific file type
- ✅ C1a/C1b/C1c provide concrete examples of format routing
- ✅ No hard-coded file extension assumptions in VOICE (WAV) or DESIGN (PNG/JPG)
- ✅ Composition logic platform-agnostic: audio + image/video → format-specific encoding

**GAPS:**
- ❌ **C4 (Export) format table is hardcoded** — If a new platform format is needed, table must be manually updated
  - **Fix needed:** Externalize C4 format mapping to `C4-format-specs.json`
  - Example: If YouTube adds 4K requirement, edit JSON instead of SKILL.md

- ❌ **No format normalization layer** (Principle 3 from lessons-learned.md)
  - Current: Generate per-format (compose for YouTube, then compose for TikTok)
  - Better: Generate master format once, convert to all platform formats in parallel
  - **Fix needed:** Add C1z workflow: "Normalize & Convert" (master 1920×1080 → all platform variants)

- ❌ **No audio format conversion abstraction** (only WAV → MP3 mentioned, not formalized)
  - **Fix needed:** Formalize audio format conversions (WAV → MP3, WAV → AAC, etc.) in `/ffmpeg` skill

### File Format Agnosticity Gap Resolution

**Required changes:**

```markdown
## New: C4-format-specs.json (Per-Platform Format Rules)

Maps each platform to resolution, codec, bitrate:
{
  "youtube": {
    "longform": {"resolution": "1920×1080", "fps": 30, "codec": "h264", "bitrate": "5000k"},
    "shorts": {"resolution": "1080×1920", "fps": 30, "codec": "h264", "bitrate": "2500k"},
    "audio_codec": "aac",
    "container": "mp4"
  },
  "tiktok": {
    "video": {"resolution": "1080×1920", "fps": 30, "codec": "h264", "bitrate": "3000k"},
    "audio_codec": "aac",
    "container": "mp4"
  },
  ...
}

## New: C1z Workflow — Normalize & Convert (Phase 2+)

Instead of:
  Compose for YouTube (1920×1080)
  Compose for TikTok (1080×1920)
  Compose for Instagram (1080×1080)
  → 3x redundant composition work

Do:
  Compose master (1920×1080, highest quality)
    ↓
  Convert in parallel:
    ├─ YouTube: 1920×1080 (no change)
    ├─ TikTok: crop+scale 1080×1920 (vertical)
    ├─ Instagram: scale 1080×1080 (square)
    └─ LinkedIn: scale 1920×1080 (no change)

Benefit: Single composition, multiple outputs. 45% faster batch processing.
```

---

## 3. Account Agnosticity Analysis

### Current State

**Account handling (E1 + E2 workflow):**
- E1a (YouTube): Assumes single YouTube channel
- E1b (TikTok): Assumes single TikTok account
- E1c (Instagram): Assumes single Instagram account
- E1d (LinkedIn): Assumes single LinkedIn account
- E1e (Bluesky/X): Assumes single account per platform

**How it works:** E1 lists patterns but doesn't specify which account to route to.

### Agnosticity Assessment

**PASSING:**
- ✅ No account logic baked into STRATEGY/A/B/C/D (all platform-agnostic)
- ✅ E1 workflow structure allows multiple account patterns

**FAILING (Critical Gap):**
- ❌ **No account selection mechanism** — E1 doesn't ask or infer which account to use
  - User has 3 TikTok accounts. Where does the video go? Currently: undefined.
  - User has 2 YouTube channels. Which one? Currently: undefined.
  - **Fix needed:** Add E1z: "Account Selection" step before posting

- ❌ **No account credential routing** — E2 assumes credentials are pre-configured
  - E1b (TikTok) says "use `/n8n` webhook trigger" but doesn't specify which account's credentials
  - E1d (LinkedIn) says "route to `/n8n`" but doesn't specify company page vs. personal profile
  - **Fix needed:** Add account credential abstraction to `/n8n` or create account routing layer

- ❌ **No account limit enforcement** — E2 doesn't check account posting limits
  - Example: TikTok allows 10 videos/day per account, but pipeline doesn't verify
  - Example: LinkedIn company page has different posting limits than personal profile
  - **Fix needed:** Add pre-flight check in F1 (Preconditions) to validate account limits

- ❌ **No multi-account batching** — F (PIPELINE) assumes single output account
  - Example: User wants to post same video to 3 TikTok accounts in parallel
  - Example: User wants to post to YouTube + 2 backup channels simultaneously
  - **Fix needed:** Add F1z: "Account Distribution" (which platforms, which accounts per platform)

### Account Agnosticity Gap Resolution

**Required changes:**

```markdown
## New: Account Selection & Routing (Phase 2+)

Add to E1 workflow:

### E0. Account Selection (NEW — Run before E1)

For each platform, determine which account to post to:
```
User request: "Post to TikTok and YouTube"
  ↓ Ask or infer:
  • TikTok: Which account? (business, personal, brand-1, brand-2)
  • YouTube: Which channel? (main, backup, shorts-only)
  
  Store in posting manifest:
  {
    "platforms": {
      "tiktok": {"account": "business", "account_id": "tiktok-123"},
      "youtube": {"account": "main", "channel_id": "UCxxxxx"}
    }
  }
```

## New: Account Credentials & Limits (Phase 3+)

Maintain account registry:
```
~/.config/video-orchestrator/accounts.json
{
  "tiktok": [
    {"name": "business", "username": "...", "handle": "@...", "daily_limit": 10, "batch_limit": 3},
    {"name": "personal", "username": "...", "handle": "@...", "daily_limit": 10, "batch_limit": 3}
  ],
  "youtube": [
    {"name": "main", "channel_id": "UCxxxxx", "channel_name": "...", "daily_limit": 50, "batch_limit": 10},
    {"name": "backup", "channel_id": "UCyyyyy", "channel_name": "...", "daily_limit": 50, "batch_limit": 10}
  ],
  ...
}
```

## New: F1z Workflow — Account Distribution (Phase 2+)

In F (PIPELINE), add account selection step:

```
F0. Select platforms and accounts for batch
  Input: ["youtube", "tiktok", "instagram"]
  For each platform:
    • Ask which account(s)
    • Validate account limits (daily, batch, burst)
    • Check credentials are valid
    
  Output: routing manifest
  {
    "batch": ["ep1", "ep2", "ep3"],
    "distribution": {
      "youtube": ["main"],
      "tiktok": ["business"],
      "instagram": ["brand-1", "brand-2"]
    }
  }

F1-F5: Run production (same as before)

F6: Post to distributed accounts
  For each episode:
    For each platform in distribution:
      For each account in platform:
        POST(episode, platform, account)
```

---

## Consolidated Gap List

| Criterion | Status | Gap | Fix |
|-----------|--------|-----|-----|
| **Platform** | ✅ Mostly good | E2 hardcodes platform rules; C4/E4 duplication | Create `E2-platform-specs.json`; consolidate format rules |
| **File Format** | ✅ Mostly good | C4 format table hardcoded; no normalization layer | Create `C4-format-specs.json`; add C1z Normalize workflow |
| **Account** | ❌ Incomplete | No account selection, routing, or limit tracking | Add E0 (Account Selection); add F0 (Account Distribution); maintain accounts.json registry |

---

## Implementation Roadmap

### Phase 2 (Immediate)

**Platform Agnosticity:**
1. Create `E2-platform-specs.json` with rules for all 7 platforms
2. Update E2 workflow to read from JSON instead of hardcoded rules
3. Add unit tests: verify E2 applies correct rules per platform

**File Format Agnosticity:**
1. Create `C4-format-specs.json` with resolution/codec per platform
2. Update C4 workflow to read from JSON instead of hardcoded table
3. Consolidate C4 (in Compose) and E4 (in Post) — both read same JSON

**Account Agnosticity (Partial):**
1. Document account credential structure in `/n8n` skill
2. Add E0 step to POST workflow: ask which account before routing to platform

### Phase 3 (Medium-term)

**Account Agnosticity (Full):**
1. Create `~/.config/video-orchestrator/accounts.json` registry
2. Add F0 workflow: account distribution selection for batches
3. Add F1 preconditions: validate account limits before running batch
4. Wire n8n account credentials to Workflow E1

### Phase 4+ (Future)

**File Format Agnosticity (Advanced):**
1. Implement C1z: Normalize → Convert (master format + parallel outputs)
2. Benefit: 45% faster batch processing (generate once, convert all)
3. Reference: `operations/standards/video-orchestrator-lessons-learned.md` Principle 3

**Account Agnosticity (Advanced):**
1. Implement account affinity scoring (which account gets which content)
2. Example: Brand-1 account posts professional videos, Personal account posts behind-the-scenes
3. Implement multi-account distribution for scaling (same video to 5 accounts in parallel)

---

## Validation Checklist

### Platform Agnosticity ✅

- ✅ Can post to YouTube without touching code? → Yes (E1a documented)
- ✅ Can post to TikTok without touching code? → Yes (E1b documented)
- ✅ Can add new platform without rewriting core? → Yes, E1 structure allows (but must update specs JSON)
- ✅ Platform posting logic isolated to E1? → Yes (STRATEGY/A/B/C/D are platform-agnostic)
- ✅ Platform specs externalized to JSON? → **No** (Gap: E2 hardcoded)

### File Format Agnosticity ✅

- ✅ Can output MP4 for YouTube? → Yes (C4 documented)
- ✅ Can output vertical MP4 for TikTok? → Yes (C4 documented)
- ✅ Can output square MP4 for Instagram? → Yes (C4 documented)
- ✅ Can add new format without rewriting core? → Yes, but format table must be updated
- ✅ Format specs externalized to JSON? → **No** (Gap: C4 hardcoded in SKILL.md)
- ✅ Can generate master format → convert to multiple? → **No** (Gap: C1z not implemented, generates per-format)

### Account Agnosticity ❌

- ❌ Can post to specific TikTok account? → No (E1b doesn't ask which account)
- ❌ Can post to 2 YouTube channels simultaneously? → No (F workflow assumes single output account)
- ❌ Can enforce per-account posting limits? → No (F1 preconditions don't validate)
- ❌ Can route based on account type (personal vs. brand)? → No (E0 account selection doesn't exist)
- ❌ Account registry maintained? → No (no `accounts.json` created)

---

## Phase 2-4 Roadmap Alignment

This review informs updates to `operations/runbooks/video-orchestrator-roadmap.md`:

**Phase 2 (Generation + Composition):**
- ✅ Implement smart model routing (C0) — DONE
- ✅ Integrate 4 local models — DONE
- ⚠️ **Add:** Platform specs JSON (E2-platform-specs.json)
- ⚠️ **Add:** Format specs JSON (C4-format-specs.json)
- ⚠️ **Add:** E0 account selection step (basic account choice)

**Phase 3 (Job Queue + Lifecycle Tracking):**
- ✅ Add lifecycle state machine
- ⚠️ **Add:** Account registry (accounts.json)
- ⚠️ **Add:** F0 account distribution workflow
- ⚠️ **Add:** F1 account limit validation

**Phase 4+ (Format Normalization + Multi-Account):**
- ⚠️ **Add:** C1z normalize workflow (master → multi-format)
- ⚠️ **Add:** Multi-account parallel posting
- ⚠️ **Add:** Account affinity scoring

---

## Recommendations for Implementation

### Approach 1: Incremental (Recommended)

1. **Week 1:** Create E2-platform-specs.json + C4-format-specs.json (trivial, ~2h)
2. **Week 2:** Update E2 + C4 workflows to read from JSON (trivial, ~1h)
3. **Week 3-4:** Add E0 account selection (small, ~3h)
4. **Later phases:** Add F0, C1z, advanced account features

**Benefit:** Incremental validation, catches issues early, keeps Phase 2 focused.

### Approach 2: Comprehensive (Higher Effort)

1. **Week 1-2:** Design complete account registry + routing system
2. **Week 3:** Implement all three layers simultaneously
3. **Week 4:** Integration testing across all 7 platforms with multi-account scenarios

**Benefit:** Unified design, fewer revisions, but higher upfront effort.

**Recommendation:** Start with Approach 1 (incremental). Phase 2 can ship with platform/format specs JSON. Account routing (E0/F0) can follow in Phase 3 when job queue is live.

---

## Summary

The `/video` orchestrator is **architecturally sound** for the three agnosticity criteria:

- **Platform Agnosticity:** Structure is there; needs specs JSON to avoid hardcoding
- **File Format Agnosticity:** Structure is there; needs specs JSON + C1z normalization
- **Account Agnosticity:** Structure missing; needs E0/F0 workflow additions + registry

**No spaghetti, no re-engineering required.** Just add three JSON files and three workflow steps, then you can post to any platform, any format, any account without code changes.

**Next step:** Create the three specs JSON files, update Workflows E/F, then move forward with Phase 2 implementation.
