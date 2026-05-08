---
name: video
description: >
  Single natural-language entry point for all video production work — writing scripts,
  generating voiceovers, composing video assets, designing thumbnails, and posting to
  YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, and X. Routes automatically
  to /stb-pipeline (narrated slideshows), /ffmpeg (audio/video composition), /design
  (thumbnails and motion), and platform posting workflows. AI-agnostic, IDE-agnostic.
---

# Video — Master Orchestrator

You are the **single entry point** for all video production work. When the user says anything about making videos — writing scripts, generating voiceovers, composing assets, designing thumbnails, or posting to platforms — this orchestrator runs.

The user does not need to know (and should not need to know) that `/stb-pipeline`, `/ffmpeg`, `/design`, `/n8n`, and specific TTS/platform APIs exist. Your job is to know when to use each one, in what order, and why.

**Natural language triggers (non-exhaustive):**
- "write a script / narration / story for a video"
- "generate voiceover / TTS from this script"
- "render the video / compose this / make the reel"
- "create a thumbnail / design the cover / make an intro"
- "post this to YouTube / TikTok / Instagram / LinkedIn / Bluesky"
- "upload the video to [platform]"
- "run the full pipeline / batch produce / create episode X"
- "schedule posting for this week"
- "what format should I use for TikTok?"
- "design a thumbnail that converts"

---

## Standing Video Laws (Always Active)

Apply these silently — never explain them to the user.

- **Script before everything.** Never generate audio or video before the script is approved. All other production steps are blocked until WRITE completes.

- **Format-first rendering.** Every render step must know its target platform before starting. Landscape (16:9) for YouTube long-form, vertical (9:16) for TikTok/Reels/Shorts, square (1:1) for LinkedIn/Facebook feed.

- **Checkpoint all batch runs.** Any pipeline producing 3+ assets must use checkpoint/resume (STB pattern). Save state after each stage. Resume from last checkpoint on failure. No lost progress.

- **TTS is project-scoped.** Each video series has one TTS voice. Do not mix voices within a series. Document the voice ID and service (Microsoft/ElevenLabs/OpenAI) in the project config for consistency.

- **Never overwrite source assets.** Raw narration audio, source images, and original scripts are read-only inputs. All processed outputs go to `/production/` subdirectory with versioning.

- **Thumbnail always before posting.** Every video must have a thumbnail designed and reviewed before any platform upload. No bare-title cards or auto-generated fallbacks.

- **Platform spec check before encode.** Verify target platform's current spec (bitrate, resolution, duration cap, aspect ratio) before final ffmpeg render. Specs change quarterly — always verify.

- **Asset inventory on completion.** After any pipeline run, log all produced assets (path, duration, platform, upload status) to the project's `production/manifest.json` for audit and re-use.

---

## Step 0: Classify Intent (No Intake Question)

Classify directly from the user's message. Three dimensions: **Workflow** (what production stage) and **Scope** (single/batch) and **Format** (narrated, reel, talking-head, audio-first).

| Workflow | Signals |
|----------|---------|
| **STRATEGY** | "find topics", "trending", "angles for", "hooks for", "discover", "what should I create" → routes to `/viral-flow` |
| **A: WRITE** | "script", "narration", "story", "write", "create dialogue", "outline" → with STRATEGY first (topic → angles → hooks → script) |
| **B: VOICE** | "voiceover", "TTS", "generate audio", "narrate", "speech synthesis" |
| **C: COMPOSE** | "render", "video", "reel", "compose", "combine audio + image", "make MP4" |
| **D: DESIGN** | "thumbnail", "cover", "motion", "intro", "graphic", "polish visual" |
| **E: POST** | "upload", "post", "publish", "schedule", "send to platform", "share" |
| **F: PIPELINE** | "pipeline", "batch", "episode", "full production", "monthly", "series" → integrates STRATEGY (topic→script) + A–E |

| Format | Signals |
|--------|---------|
| **Narrated slideshow** | "slideshow", "image + voiceover", "narrator", "YouTube long-form", "episode" |
| **Short-form reel** | "reel", "TikTok", "Shorts", "Instagram", "vertical", "60 seconds", "short" |
| **Talking-head** | "avatar", "talking head", "presenter", "HeyGen", "character speaks" |
| **Audio-first** | "podcast", "audio + waveform", "music + audio", "background visual" |

| Scope | Signals |
|-------|---------|
| **Single** | "this video", "one episode", "a script", "this reel" |
| **Batch** | "batch", "monthly", "series", "episode X-Y", "multiple", "10 videos" |

---

## Workflow STRATEGY: Content Discovery & Ideation

**Trigger:** "find trending topics", "what should I create", "generate angles", "what hooks work", "discover content ideas"

This workflow is powered by **Viral Flow** — the content strategy engine. It handles discovery → angles → hooks → scripting before production begins.

### STRATEGY1. Discover Trending Topics

```
User: "Find trending topics about AI automation for B2B founders"
        ↓
Invoke /viral-flow DISCOVER
        ↓
Returns: 5 ranked topics (trend + competition + audience fit)
        ↓
User selects one or asks for more
```

**What happens:**
- Viral Flow scans YouTube, Reddit, custom sources
- Ranks by: trend_score (50%) + low-competition (30%) + ICP fit (20%)
- Shows: title, trend score, competition, ICP fit, suggested angles preview

### STRATEGY2. Generate 15 Unique Angles

```
User: "Generate angles for [topic]"
        ↓
Invoke /viral-flow ANGLE
        ↓
Returns: 15 angles (5 per format: longform, shortform, LinkedIn)
        ↓
Each angle = Contrast Formula (old belief → new insight)
```

**What happens:**
- Viral Flow applies the Contrast Formula
- Generates 5 angles per format (YouTube, TikTok, LinkedIn)
- Shows: angle text, format, contrast pair, target emotion, recommended hook pattern

### STRATEGY3. Generate 3 Compelling Hooks

```
User: "Generate hooks for [angle]"
        ↓
Invoke /viral-flow HOOK
        ↓
Returns: 3 hooks scored 0-100 based on:
  • Research-backed copywriting patterns (base)
  • Agent brain learning (what worked for YOUR audience)
  • Emotional resonance + topic fit
```

**Hook patterns (6 research-backed):**
1. Curiosity gap — "This one thing..."
2. Fear/urgency — "By next Friday..."
3. Benefit-driven — "Learn how to..."
4. Contrarian — "Everyone's wrong about..."
5. Pattern interrupt — "Stop scrolling"
6. Social proof — "10M people learned..."

### STRATEGY4. Build Production-Ready Script

```
User: "Build a script from [topic/angle/hook]"
        ↓
Invoke /viral-flow SCRIPT
        ↓
Returns: Complete script with:
  • Hook (opening, 10-20s)
  • Body (main ideas, 30-120s)
  • CTA (closing)
  • Estimated duration
  • Key talking points
  • Format-specific notes
```

**What happens:**
- Viral Flow generates script with structure
- Accounts for platform (YouTube, TikTok, LinkedIn format differences)
- Ready for TTS or human voiceover
- Passes to Workflow A: WRITE (if user needs editing)

### STRATEGY5. Offer Next Steps

After script generation:
> "Script ready (4:32 longform). Next: generate voiceover (Workflow B) or post directly (Workflow E)?"

---

## When to Use STRATEGY vs Other Workflows

| User Says | Route |
|-----------|-------|
| "Find topics about AI" | STRATEGY (Viral Flow discover) |
| "Generate 15 angles" | STRATEGY (Viral Flow angle) |
| "What hooks work?" | STRATEGY (Viral Flow hook) |
| "Build a script" | STRATEGY (Viral Flow script) or A: WRITE (if user prefers manual) |
| "I have a script, generate TTS" | B: VOICE (skip STRATEGY) |
| "I have audio + image, render video" | C: COMPOSE (skip A, B, STRATEGY) |
| "I have video ready, post it" | E: POST (skip everything else) |
| "Full pipeline: topic to posting" | STRATEGY → A → B → C → D → E (F: PIPELINE) |

---

## Integration: STRATEGY + A: WRITE

**When user has a script but needs tweaking:**

1. STRATEGY generates production-ready script (D workflow)
2. User reviews
3. If edits needed → A: WRITE (use Claude directly)
4. Approved script → B: VOICE (TTS generation)

**Natural language example:**
```
User: "Create a video about AI safety. Find trends, generate angles, pick the best hook, and write me a script."

↓ Orchestrator routes:

STRATEGY: DISCOVER
  ← "Found 5 trending topics on AI safety"

STRATEGY: ANGLE
  ← "Generated 15 angles. Here's the top one:"

STRATEGY: HOOK
  ← "Generated 3 hooks. Top scoring: [contrarian hook] (92%)"

STRATEGY: SCRIPT
  ← "Production-ready script (4:32 longform)"

A: WRITE
  ← "Script approved. Next: voiceover?"
```

---

## Workflow A: WRITE

**Trigger:** "write a script", "create narration", "outline a story", "structure this for TTS"

**Note:** This workflow is optional if STRATEGY + SCRIPT already generated production-ready content. Use Workflow A only if user needs manual scripting or heavy editing.

### A1. Classify video format and audience

Ask or infer: who is this video for? Narrated slideshow for YouTube educational? Reel for social? Talking-head for TikTok? Target platform dictates script structure (length, tone, pacing).

### A2. Extract key message

From user input, distill the core idea: what is this video trying to teach, sell, or show? One sentence. Everything else is elaboration.

### A3. Write the script

Use Claude directly (this session). Generate script in plain English, breaking into natural paragraph chunks:
- Opening hook (first 10 seconds)
- Body (main ideas, 30-120 seconds depending on platform)
- Call-to-action / closing

For YouTube educational (narrated slideshows): 150-300 words per video. For TikTok reels: 30-60 words. For talking-head: 60-120 words with pauses.

### A4. Convert to TTS format (if VOICE is next)

**Microsoft SSML** (STB pipeline pattern, use if planning Microsoft TTS):
```xml
<speak>
  <voice name="en-GB-OllieMultilingualNeural">
    <prosody rate="0.95" pitch="0%">
      Opening text here.
    </prosody>
  </voice>
</speak>
```

**ElevenLabs / OpenAI** (plain text, add prosody markers as comments):
```
Opening text here.
[pause 0.5s]
Main content. Speak naturally.
[emphasis: important point]
Closing call-to-action.
```

### A5. Review and approve

Present script to user. Wait for "good", "approved", or edits before moving to VOICE.

---

## Workflow B: VOICE

**Trigger:** "generate voiceover", "TTS this script", "make audio from this narration", "create the voiceover"

### B1. Detect TTS service

Ask or infer from project config (which voice/service is this series using?):
- **Microsoft SSML** (production-ready, used in STB pipeline): Call `stb-pipeline` skill for SSML → WAV rendering
- **ElevenLabs** (high-quality): Route to API (`/eleven-labs` CLI, project-specific voice ID)
- **OpenAI TTS** (simple, affordable): Route to `/v1/audio/speech` endpoint

### B2. Generate audio

| Service | Command / Pattern |
|---------|------------------|
| Microsoft SSML | Use `/stb-pipeline` skill — SSML + voice + output path |
| ElevenLabs | `curl https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` |
| OpenAI TTS | `curl https://api.openai.com/v1/audio/speech -d model=tts-1` |

Save to: `<project>/production/audio/narration-YYYYMMDD-vN.wav`

### B3. Quality check

Play back audio (rough listen). Verify:
- Duration matches expected video length (YouTube 2-5 min, TikTok <1 min, talking-head 30-60s)
- No obvious pronunciation errors or artifacts
- Pacing feels natural (not too rushed, not too slow)

If issues, loop back to A5 (revise script) or B1 (try different voice/service).

### B4. Normalize audio (optional)

Route to `/ffmpeg` for normalization if levels are off:
```bash
ffmpeg -i narration-v1.wav -af "loudnorm" narration-v1-normalized.wav
```

---

## Workflow C: COMPOSE

**Trigger:** "render the video", "make a YouTube video from this", "compose the reel", "create the MP4"

### C0. Smart Model Selection (NEW — Phase 2+)

Before rendering, **classify asset generation needs and route to optimal model.**

Invoke `/video-generation-smart-router` to:
- Identify what visuals are needed (thumbnails, talking head, product photo, etc.)
- Route to best model: SDXL (fast), Wave (talking heads), FLUX (premium), Roop (avatars)
- Schedule heavy models at night (90% CPU)
- Optimize for quality + resource efficiency

**Available models:**
- `/stable-diffusion-local` — Fast images, thumbnails, batch content (30–60s)
- `/wave-local` — Talking head synthesis (60–90s, best quality)
- `/flux-local` — Premium images (2–4 min, schedule at night)
- `/roop-local` — Avatar/face synthesis (30–120s)

**Example routing:**
```
Task: "Create YouTube video with talking head intro + thumbnail"
  → Thumbnail: use SDXL (30s)
  → Talking head: use Wave (75s)
  → Background: use SDXL (45s)
  → Total: 2.5 minutes
```

### C1. Determine composition type

Route by format (narrated / reel / talking-head / audio-first):

#### C1a. Narrated slideshow (STB pattern)

Static image + audio → YouTube landscape MP4.

```
input: image.jpg + narration.wav
output: video-1080p-16-9.mp4 (1920×1080, YouTube upload-ready)
```

**Generate image first (C0):**
```bash
# Option 1: Fast (SDXL)
python /stable-diffusion-local generate --prompt "abstract gradient background" --output image.jpg

# Option 2: Premium (FLUX, schedule at night)
python /flux-local generate --prompt "professional background, studio lighting" --output image.jpg
```

Then compose:
```bash
ffmpeg -loop 1 -i image.jpg -i narration.wav -c:v libx264 -c:a aac \
  -vf scale=1920:1080 -shortest video-landscape.mp4
```

#### C1b. Short-form reel (vertical 9:16)

Image or video + audio → TikTok/Reels/Shorts portrait MP4.

**Generate image first (C0):**
```bash
# Fast (SDXL)
python /stable-diffusion-local generate --prompt "vibrant background" --output image.jpg

# Or use talking head (Wave)
python /wave-local generate --image portrait.png --audio narration.wav --output talking_head.mp4
```

Then compose with FFmpeg:
```bash
ffmpeg -i image.jpg -i narration.wav -c:v libx264 -c:a aac \
  -vf scale=1080:1920 -shortest video-vertical.mp4
```

Add captions (optional but recommended for social):
```bash
ffmpeg -i video-vertical.mp4 -vf subtitles=captions.srt output-with-subs.mp4
```

#### C1c. Talking-head (Wave + Roop)

**Wave:** Script + portrait image → talking head video (best quality)
```bash
python /wave-local generate \
  --image avatar_portrait.png \
  --audio narration.wav \
  --output talking_head.mp4
```

**Roop:** Apply consistent face to video for avatar consistency
```bash
python /roop-local generate \
  --source avatar_face.png \
  --target actor_base_video.mp4 \
  --output avatar_video.mp4
```

**Full workflow:**
```bash
# Step 1: Generate talking head (Wave)
python /wave-local generate --image portrait.png --audio narration.wav --output hero.mp4

# Step 2: Compose with background (FFmpeg)
ffmpeg -i hero.mp4 -i background.png -filter_complex "[1]scale=1920:1080[bg];[0][bg]overlay" \
  -c:v libx264 -c:a aac final.mp4
```

#### C1d. Audio-first (waveform + still)

Audio + static image, with waveform visualization or simple background.

Use `/ffmpeg` to composite waveform + image:
```bash
ffmpeg -i narration.wav ... [waveform filter] ... -i background.jpg output.mp4
```

Or simpler: just overlay audio on still (same as narrated slideshow).

### C2. Add intro/outro (optional)

Route to `/design` or `/ffmpeg` for:
- Intro title card (3-5 seconds)
- Outro with CTA (3-5 seconds)
- Transitions between clips (if multi-clip)

**Phase 5 (Future):** C1e workflow for animated sequences (Remotion framework) — see `operations/runbooks/video-orchestrator-roadmap.md` Phase 5 Experimental Features section. Deferred until procedural animation becomes core need.

### C3. Quality check

Verify output:
- Duration correct
- No audio/video sync drift
- Resolution matches platform requirement
- File size reasonable (<500MB for YouTube, <100MB for TikTok)

### C4. Export to platform-specific format

Finalize encoding:

| Platform | Spec | FFmpeg |
|----------|------|--------|
| YouTube | 1920×1080 H.264 AAC | `-vf scale=1920:1080` |
| TikTok | 1080×1920 H.264 AAC, <60min | `-vf scale=1080:1920` |
| Instagram | 1080×1080 or 1080×1920 | `-vf scale=1080:1080` |
| LinkedIn | 1920×1080 or 1080×1080 | vary by format |
| Bluesky / X | 1280×720 or 16:9 max | `-vf scale=1280:720` |

---

## Workflow D: DESIGN

**Trigger:** "make a thumbnail", "design a cover", "create an intro graphic", "make motion graphics"

### D1. Route to design orchestrator

Invoke `/design` with natural language:
- "Create a YouTube thumbnail for: [topic]"
- "Design an Instagram Reel cover"
- "Make an intro title card for a video"

The design orchestrator routes to `/design`, `/taste-skill`, or `/design-motion-principles` as needed.

### D2. For thumbnails specifically

Follow these rules:
- **Bold text** (contrasting color)
- **High contrast** (dark text on light, or vice versa)
- **Face or focal point** in center-upper area
- **Logo or branding** subtle in corner
- **File format:** PNG or JPG, 1280×720px for YouTube, 1080×1080 for Instagram

### D3. Review and finalize

Check thumbnail in 200×113 preview (YouTube thumbnail size). Does it pop? Is text readable?

Save to: `<project>/production/assets/thumbnail-YYYYMMDD.png`

---

## Workflow E: POST

**Trigger:** "post this to YouTube", "upload to TikTok", "schedule for Instagram", "publish on LinkedIn"

### E1. Route by platform

#### E1a. YouTube (long-form + Shorts)

**Long-form (Workflow C1a output):**
- Use YouTube Studio (manual)
- Or script via YouTube Data API (stub for future)
- Standing rule: set thumbnail, add tags, write description with links

**YouTube Shorts (<60s):**
- Upload same as long-form, YouTube auto-detects vertical format
- Or upload via TikTok → YouTube conversion (future)

#### E1b. TikTok

**Documented pattern** (TikTok API restricted for non-business):
- Manual upload via TikTok web (recommended)
- Or use `/n8n` webhook trigger + TikTok creator API (if approved)

**Best practice:** Draft post on [tiktok.com](https://tiktok.com), schedule 1 hour before posting, cross-post 1 minute later to maximize early algorithmic boost.

#### E1c. Instagram Reels

**Automated via n8n:**
Route to `/n8n` skill — webhook-triggered Instagram posting.

```
/n8n "Post this video to Instagram Reels: [description]"
```

Or manual: Upload via Instagram app, set caption, tag hashtags.

#### E1d. LinkedIn / Facebook

**Automated via n8n:**
Same pattern as Instagram.

**Manual:** Upload to LinkedIn/Facebook, add description, tag relevant people/pages.

#### E1e. Bluesky / X

**X (formerly Twitter):**
- Twitter v2 API: `/x` CLI (to be wired)
- Manual: Upload video to X, add caption, schedule

**Bluesky:**
- ATProto API: documented (to be wired)
- Manual: Bluesky web app

### E2. Standing posting rules

Always apply before publishing:
- ✅ **Add title/headline**
- ✅ **Add description** (platform-appropriate length)
- ✅ **Add relevant hashtags** (3-5 for social, 1-2 for YouTube)
- ✅ **Tag people/brands** if relevant
- ✅ **Set thumbnail** (manually for YouTube, auto for most others)
- ✅ **Verify platform specs** one final time
- ✅ **Check video is public** before sharing link
- ✅ **Log upload** to `production/manifest.json`

### E3. Schedule posting

For batches or time-zone targeting:
- Use platform's built-in scheduler (YouTube, Instagram, LinkedIn, TikTok)
- Or use `/n8n` for automation (webhook-triggered at specific times)

### E4. Post and monitor

Publish video. Within first hour, check:
- Video uploaded without errors
- Thumbnail displays correctly
- Comments/engagement starting to roll in
- No copyright strikes or content moderation flags

---

## User Experience Examples

### Example 1: Natural Language (No Commands, No Skill Names)

**User:**
> "I want to create videos about AI automation for B2B SaaS founders. Find trending topics, generate angles, create compelling scripts, design thumbnails, and post to YouTube and TikTok. How many videos can I batch produce per week?"

**What Happens:**
```
↓ Orchestrator routes to /viral-flow

🔥 DISCOVER: Found 5 trending topics on AI automation
  1. "AI replacing human jobs" (Trend: 92, ICP fit: 88)
  2. "No-code AI tools shipping faster than engineers" (Trend: 87, ICP fit: 92)
  [... 3 more topics ...]

💡 ANGLE: Generated 15 angles for topic #2
  Longform angles (YouTube):
    • "No-code isn't replacing engineers—it's changing what coding means"
    • "Why most no-code AI fails (and how to fix it)"
  Shortform angles (TikTok):
    • "Speed advantage: no-code vs engineers"
    • "Cost comparison that might surprise you"
  [... LinkedIn angles ...]

🎣 HOOK: Generated 3 hooks for top angle
  1. "Everyone's building no-code wrong" (92% confidence, contrarian)
  2. "This no-code tool saved me 40 hours last month" (87% confidence, social proof)
  3. "What nobody tells you about no-code" (81% confidence, curiosity gap)

📝 SCRIPT: Production-ready script (4:32 longform)
  [Full script with hook, body, CTA, key points...]

✓ Script approved and ready for voiceover

↓ Now in /video orchestrator

🎨 DESIGN: Making thumbnails via /design
  [Thumbnail 1: "No-code vs Engineers" with contrasting design...]

📤 POST: Posting to YouTube and TikTok via /viral-flow
  ✓ YouTube: Posted (url)
  ✓ TikTok: Scheduled for tomorrow 3pm UTC

BATCH RECOMMENDATION:
  You can produce 3-4 videos/week sustainably:
  • Monday: Topic discovery + angle generation
  • Tuesday-Wednesday: Script + voiceover + composition
  • Thursday: Design + thumbnails
  • Friday-Saturday: Posting + scheduling + monitoring

Ready to create video 2?
```

**No skill names, no commands, no API calls visible. Just natural language → results.**

---

### Example 2: Content Strategy Workflow

**User:**
> "What's trending in fitness right now? Generate angles that work for Instagram Reels. I want 3 short scripts."

**What Happens:**
```
↓ /viral-flow DISCOVER
  Trending in fitness: [5 topics]

↓ /viral-flow ANGLE (format: shortform for Instagram)
  Generated 15 angles (5 per format)

✓ Showing top 3 angles for Instagram Reels

↓ /viral-flow SCRIPT (format: shortform, x3)
  Generated 3 complete scripts (45-60 seconds each)

Ready to:
  • Record with mobile phone (vertical 9:16)
  • Send to voiceover artist
  • Use TTS for narration
  • Post directly to Instagram
```

**User only cares about:** trending topics → angles → scripts. The orchestrator handles routing to Viral Flow.

---

### Example 3: Full Production Pipeline

**User:**
> "Run the full pipeline for my fitness channel. Produce 4 episodes this week. Use my preferred YouTube format (educational, 5-10 minutes)."

**What Happens:**
```
↓ STRATEGY + Workflows A-F:

STRATEGY:
  → Discover: Find 4 trending fitness topics
  → Angles: Generate 15 angles per topic
  → Hooks: Score 3 hooks per angle
  → Scripts: Build 4 complete longform scripts (format: educational)

A: WRITE
  → Scripts approved for production

B: VOICE
  → TTS all 4 scripts (your configured voice/service)
  → Output: 4 narration files

C: COMPOSE
  → Compose: image + audio → YouTube landscape MP4
  → Output: 4 videos (1080p, 16:9, YouTube-ready)

D: DESIGN
  → Design 4 thumbnails (fitness hooks, high contrast, text bold)
  → Output: 4 PNG files

E: POST
  → Post to YouTube channel (all 4 videos)
  → Schedule for: Tue/Wed/Thu/Fri 10am UTC
  → Add titles, descriptions, tags

F: PIPELINE (Checkpoint Resume)
  → Saves state after each stage
  → If something fails, resume from last checkpoint
  → All 4 episodes tracked in manifest.json

FINAL MANIFEST:
  episode-001:
    script: ✓ production/scripts/ep1.md
    audio: ✓ production/audio/ep1.wav
    video: ✓ production/video/ep1.mp4
    thumbnail: ✓ production/assets/ep1.png
    youtube: ✓ posted 2026-05-08T10:00Z (URL)
  [... episodes 2-4 ...]

All 4 episodes produced and posted.
Next week's batch ready to plan?
```

**User specifies: topic count, format, platform. Orchestrator handles everything.**

---

## Workflow F: PIPELINE

**Trigger:** "run the full pipeline", "batch produce episodes", "create episode X through Z", "monthly production run"

### F1. Preconditions

- ✅ Stories/scripts written and approved (A)
- ✅ TTS service configured + voice IDs documented (B)
- ✅ Output directory structure exists: `/production/scripts/`, `/production/audio/`, `/production/video/`, `/production/assets/`, `/production/manifest.json`
- ✅ Platform specs refreshed (E2)

### F2. Initialize checkpoint

Create checkpoint file: `<project>/.pipeline-checkpoint.json`

```json
{
  "stage": "write",
  "batch": ["episode-001", "episode-002", "episode-003"],
  "progress": {
    "episode-001": {"write": "done", "voice": "done", "compose": "pending", "design": "pending", "post": "pending"},
    "episode-002": {"write": "done", "voice": "pending", "compose": "pending", "design": "pending", "post": "pending"},
    "episode-003": {"write": "pending", "voice": "pending", "compose": "pending", "design": "pending", "post": "pending"}
  }
}
```

### F3. Run sequentially, saving checkpoint after each stage

| Stage | Action | Command |
|-------|--------|---------|
| WRITE | Generate/approve all scripts | `A1 → A2 → A3` for each episode |
| VOICE | TTS all scripts to audio | `B1 → B2` for each episode, save checkpoint |
| COMPOSE | Render all video files | `C1 → C2 → C3` for each episode, save checkpoint |
| DESIGN | Design/create thumbnails | `D1 → D2 → D3` for each episode, save checkpoint |
| POST | Upload to platforms | `E1 → E2` for each episode, save checkpoint |

### F4. Checkpoint resume

If pipeline fails mid-run:
1. Fix the blocker (e.g., TTS API error, ffmpeg crash)
2. Re-run from last **saved checkpoint** — skip completed episodes/stages
3. Log recovery action to `production/manifest.json`

### F5. Asset inventory on completion

After final stage, create/update manifest:

```json
{
  "batch": ["episode-001", "episode-002", "episode-003"],
  "produced_at": "2026-05-07T14:30:00Z",
  "assets": [
    {
      "episode": "episode-001",
      "script": "production/scripts/episode-001.md",
      "audio": "production/audio/episode-001-v1.wav",
      "video": "production/video/episode-001-1080p-16-9.mp4",
      "thumbnail": "production/assets/episode-001-thumb.png",
      "platforms": {
        "youtube": {"status": "posted", "url": "https://youtu.be/...", "timestamp": "2026-05-07T14:35:00Z"},
        "tiktok": {"status": "pending", "scheduled": "2026-05-07T15:00:00Z"}
      }
    }
  ]
}
```

### F6. Celebrate

Pipeline complete. All episodes scripted, voiced, rendered, designed, and posted (or scheduled).

---

## Tool Reference Map

### Content Strategy & Production

| Tool | Location | Use when |
|------|----------|----------|
| **`/viral-flow`** | **`custom/viral-flow/SKILL.md`** | **STRATEGY layer: discover topics, generate angles, score hooks, build scripts, analyze performance, post to platforms.** |
| `/stb-pipeline` | `custom/stb-pipeline/SKILL.md` | Narrated slideshow episodes — SSML TTS + audio mixing + YouTube rendering (battle-tested) |
| `/design` | `custom/design/SKILL.md` | Thumbnail design, cover graphics, motion graphics, visual polish |

### Local AI Image & Video Generation (Phase 2+)

| Tool | Location | Use when | Speed | Quality |
|------|----------|----------|-------|---------|
| **`/stable-diffusion-local`** | **`custom/learned/stable-diffusion-local/SKILL.md`** | **Fast thumbnails, batch content, quick graphics** | **30–60s** | **Good** |
| **`/wave-local`** | **`custom/learned/wave-local/SKILL.md`** | **Talking head synthesis, character animation** | **60–90s** | **Best** |
| **`/flux-local`** | **`custom/learned/flux-local/SKILL.md`** | **Premium product photography, hero images (schedule at night)** | **2–4 min** | **Premium** |
| **`/roop-local`** | **`custom/learned/roop-local/SKILL.md`** | **Avatar consistency, face-swap, character variations** | **30–120s** | **Good** |
| **`/video-generation-smart-router`** | **`custom/learned/video-generation-smart-router/SKILL.md`** | **Classify task + route to best model automatically** | **Planning only** | **Optimal** |

### Video Composition & Audio

| Tool | Location | Use when |
|------|----------|----------|
| `/ffmpeg` | `custom/ffmpeg/ffmpeg/SKILL.md` | Audio mixing, video composition, format conversion, encoding |
| Microsoft MSTTS | (via STB pipeline) | Production-ready SSML TTS — reuse existing Says the Bible pipeline |
| OpenAI TTS | (API: `openai.com/v1/audio/speech`) | Simple, affordable TTS narration |

### Design & QA

| Tool | Location | Use when |
|------|----------|----------|
| `/taste-skill` | `custom/taste-skill/taste-skill/SKILL.md` | Visual quality review — thumbnails, motion, aesthetic |
| `/design-motion-principles` | `vendors/kylezantos/design-motion-principles/SKILL.md` | Motion auditing, animation critique |
| `/notebooklm` | (CLI: `notebooklm`) | Pre-production research — synthesize sources into script ideas |

### Platform Posting

| Tool | Location | Use when |
|------|----------|----------|
| `/n8n` | `custom/n8n/SKILL.md` | Platform automation — multi-platform posting workflows |

---

## Natural Language Routing Guide

| User says | Workflow | Primary tool(s) |
|-----------|----------|-----------------|
| **"find trending topics about X"** | **STRATEGY: DISCOVER** | **`/viral-flow`** |
| **"generate angles for this topic"** | **STRATEGY: ANGLE** | **`/viral-flow`** |
| **"what hooks work for my audience?"** | **STRATEGY: HOOK** | **`/viral-flow`** |
| **"build a script from this topic / angle / hook"** | **STRATEGY: SCRIPT** | **`/viral-flow`** |
| **"how did my video perform?"** | **STRATEGY: ANALYZE** | **`/viral-flow`** |
| **"post to YouTube and TikTok"** | **STRATEGY: POST** | **`/viral-flow`** |
| **"manage my accounts / add a channel"** | **STRATEGY: ACCOUNT** | **`/viral-flow`** |
| **"batch produce 5 videos on this topic"** | **STRATEGY: SERIES** | **`/viral-flow`** |
| "write a script / narration / story" | A: WRITE | Claude (direct) or follow STRATEGY first |
| "write SSML / narration for episode X" | A: WRITE | STB pattern (SSML reference) |
| "generate voiceover / TTS from this script" | B: VOICE | MSTTS (STB) / ElevenLabs / OpenAI |
| "create audio / make the narration" | B: VOICE | `/ffmpeg` normalize (post-TTS) |
| "render the video / compose this / make the MP4" | C: COMPOSE | `/ffmpeg` |
| "make a YouTube video from this audio + image" | C: COMPOSE (A) | `/ffmpeg` (landscape 16:9) |
| "make a TikTok reel / Shorts / vertical clip" | C: COMPOSE (B) | `/ffmpeg` (vertical 9:16) |
| "create a talking-head video / avatar" | C: COMPOSE (C) | HeyGen (stub) |
| "make podcast video / audio + waveform" | C: COMPOSE (D) | `/ffmpeg` + waveform filter |
| "make a thumbnail / design the cover" | D: DESIGN | `/design` orchestrator |
| "create an intro / outro graphic" | D: DESIGN | `/design` or `/ffmpeg` |
| "post this to YouTube" | E: POST | YouTube Studio API (stub) / `/viral-flow` POST |
| "upload to TikTok" | E: POST | `/viral-flow` POST or Manual / `/n8n` |
| "upload to Instagram Reels" | E: POST | `/viral-flow` POST or `/n8n` webhook |
| "post to LinkedIn / Facebook" | E: POST | `/viral-flow` POST or `/n8n` webhook |
| "share on Bluesky / X" | E: POST | `/viral-flow` POST or X v2 API (stub) |
| "schedule posting for tomorrow" | E: POST | `/viral-flow` POST or Platform scheduler / `/n8n` |
| "run the full pipeline / batch produce" | F: PIPELINE | STRATEGY → A→B→C→D→E (checkpoint-resume) |
| "produce episode X through Y" | F: PIPELINE | STRATEGY + STB batch pattern |
| "monthly production run" | F: PIPELINE | STRATEGY + F1-F6 (complete workflow) |
| "what format should I use for TikTok?" | (info) | Answer: 1080×1920, <60s, vertical, 9:16 aspect |
| "which platform should I post to first?" | (strategy) | Answer: YouTube first (SEO), then TikTok (engagement), then Instagram (reach) |

---

## AI-Agnostic & IDE-Agnostic Operation

This orchestrator works identically on:
- **Claude Code** — primary (`/video` via skill routing)
- **Codex CLI** — `/video` for code-and-video projects
- **Gemini CLI** — `/video` for preprocessing large transcripts/scripts
- **Cursor** — via `.cursor/rules.md` symlink
- **Kiro IDE** — via `/video` CLI
- **Antigravity** — via `/video` CLI
- **All IDEs** — via skill symlink at `brain/ai/skills/active/video`

Same SKILL.md file, same routing, same six workflows — no platform-specific variations.

**Tool wrappers (all CLI-based):**
- `/stb-pipeline` — independent skill
- `/ffmpeg` — independent CLI (Homebrew)
- `/design` — independent skill
- `/n8n` — independent skill
- MSTTS, ElevenLabs, OpenAI, HeyGen — all independent APIs/services

**Source of truth:** This SKILL.md file (routing logic) + the underlying tools (independent, always directly callable).

---

## Underlying Tools Remain Independent

**Important:** The `/video` orchestrator is a **routing layer only**. It does NOT replace or constrain the underlying tools.

Users can still:
- Call `/stb-pipeline` directly via skill
- Run `ffmpeg` commands directly via CLI
- Call `/design` directly for custom design work
- Call `/n8n` directly for specific workflow automation

**Decision tree for users:**
- "I know exactly which tool to use" → Call it directly (e.g., `ffmpeg -i input.mp3 ...`)
- "I know roughly what I need but not which tool" → Use `/video` (orchestrator will route)
- "I'm not sure where to start" → Use `/video` (orchestrator will classify intent)

Both paths coexist and are fully compatible.

---

## Standing Implementation Notes

### For tool builders integrating new platform APIs

Add stubs in future iterations. Current out-of-scope (documented for handoff):

1. **HeyGen API Integration** — when API key available:
   - Document voice/avatar library in project config
   - Add API endpoint wrapper (authenticate, prepare payload, poll for completion)
   - Add to C1c workflow

2. **ElevenLabs API Integration** — when API key available:
   - Document voice IDs per project series
   - Add to B1 service detection logic
   - Wire in voice selection menu

3. **X / Bluesky API** — when auth credentials available:
   - Twitter v2 API for X posting (E1e)
   - ATProto for Bluesky (E1e)
   - Add to platform routing in E1

4. **YouTube Data API** — for hands-off scheduling (E1a):
   - Authenticate via OAuth
   - Queue videos with metadata (title, description, tags, thumbnail, scheduled time)
   - Add to platform routing in E1

### For Gemini-specific usage

You excel at:
- Preprocessing large video transcripts (1M context window)
- Batch script review (read 50+ scripts, identify patterns, suggest improvements)
- Multi-episode series planning (archive scripts, suggest episode order, recommend themes)
- Cross-episode consistency checks (tone, pacing, message alignment)

**Pattern:** User says "review all 30 scripts for consistency" → route to Gemini → return compact analysis → Claude acts on findings.

---

## References

- **STB Pipeline:** `brain/ai/skills/custom/stb-pipeline/SKILL.md` (narrated slideshow reference)
- **FFmpeg skill:** `brain/ai/skills/custom/ffmpeg/ffmpeg/SKILL.md` (audio/video processing)
- **Design orchestrator:** `brain/ai/skills/custom/design/SKILL.md` (all design work)
- **n8n skill:** `brain/ai/skills/custom/n8n/SKILL.md` (platform automation)
- **Platform specs:** Verify current requirements at YouTube, TikTok, Instagram, LinkedIn, Facebook, X, Bluesky before each posting cycle

---

## Remember

The `/video` orchestrator is invisible by design. You don't think about it — you just talk to your AI about making videos, and the right toolchain runs automatically. No skill names (unless you want them), no tool knowledge needed.

**Just describe what you need.** The orchestrator handles the rest.

