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
| **A: WRITE** | "script", "narration", "story", "write", "create dialogue", "outline" |
| **B: VOICE** | "voiceover", "TTS", "generate audio", "narrate", "speech synthesis" |
| **C: COMPOSE** | "render", "video", "reel", "compose", "combine audio + image", "make MP4" |
| **D: DESIGN** | "thumbnail", "cover", "motion", "intro", "graphic", "polish visual" |
| **E: POST** | "upload", "post", "publish", "schedule", "send to platform", "share" |
| **F: PIPELINE** | "pipeline", "batch", "episode", "full production", "monthly", "series" |

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

## Workflow A: WRITE

**Trigger:** "write a script", "create narration", "outline a story", "structure this for TTS"

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

### C1. Determine composition type

Route by format (narrated / reel / talking-head / audio-first):

#### C1a. Narrated slideshow (STB pattern)

Static image + audio → YouTube landscape MP4.

```
input: image.jpg + narration.wav
output: video-1080p-16-9.mp4 (1920×1080, YouTube upload-ready)
```

Use `/stb-pipeline` or `/ffmpeg` directly:
```bash
ffmpeg -loop 1 -i image.jpg -i narration.wav -c:v libx264 -c:a aac \
  -vf scale=1920:1080 -shortest video-landscape.mp4
```

#### C1b. Short-form reel (vertical 9:16)

Image or video + audio → TikTok/Reels/Shorts portrait MP4.

```
input: image.jpg + narration.wav (or video-clip.mp4 + narration.wav)
output: video-1080p-9-16.mp4 (1080×1920, vertical)
constraint: <60 seconds
```

Use `/ffmpeg`:
```bash
ffmpeg -i image.jpg -i narration.wav -c:v libx264 -c:a aac \
  -vf scale=1080:1920 -shortest video-vertical.mp4
```

Add captions (optional but recommended for social):
```bash
ffmpeg -i video-vertical.mp4 -vf subtitles=captions.srt output-with-subs.mp4
```

#### C1c. Talking-head (HeyGen stub)

User provides script + selects avatar. Route to HeyGen API (service-agnostic stub — wire when API key available).

**Documented pattern** (for future):
```
POST https://api.heygen.com/v1/videos
{
  "template_id": "<avatar-template>",
  "caption": false,
  "script": {"type": "text", "input": "narration text"}
}
```

For now, handoff to manual creation or document URL.

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

| Tool | Location | Use when |
|------|----------|----------|
| `/stb-pipeline` | `custom/stb-pipeline/SKILL.md` | Narrated slideshow episodes — SSML TTS + audio mixing + YouTube rendering (battle-tested) |
| `/ffmpeg` | `custom/ffmpeg/ffmpeg/SKILL.md` | Audio mixing, video composition, format conversion, cropping, scaling, encoding |
| `/design` | `custom/design/SKILL.md` | Thumbnail design, cover graphics, motion graphics, visual polish |
| `/taste-skill` | `custom/taste-skill/taste-skill/SKILL.md` | Visual quality review — thumbnails, motion, overall aesthetic |
| `/design-motion-principles` | `vendors/kylezantos/design-motion-principles/SKILL.md` | Motion auditing, animation critique, transition design |
| `/notebooklm` | (CLI: `notebooklm`) | Pre-production research — synthesize sources into script ideas |
| `/n8n` | `custom/n8n/SKILL.md` | Platform automation — webhook-triggered Instagram/LinkedIn/Facebook posting |
| HeyGen (future) | (API stub) | Talking-head avatar videos — wired when API key available |
| ElevenLabs (future) | (API stub) | High-quality TTS voices — wired when API key available |
| OpenAI TTS | (API: `openai.com/v1/audio/speech`) | Simple, affordable TTS narration — already accessible |
| Microsoft MSTTS | (via STB pipeline) | Production-ready SSML TTS — reuse existing Says the Bible pipeline |

---

## Natural Language Routing Guide

| User says | Workflow | Primary tool(s) |
|-----------|----------|-----------------|
| "write a script / narration / story" | A: WRITE | Claude (direct) |
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
| "post this to YouTube" | E: POST | YouTube Studio API (stub) / manual |
| "upload to TikTok" | E: POST | Manual / `/n8n` webhook |
| "upload to Instagram Reels" | E: POST | `/n8n` webhook |
| "post to LinkedIn / Facebook" | E: POST | `/n8n` webhook |
| "share on Bluesky / X" | E: POST | X v2 API (stub) / ATProto (stub) / manual |
| "schedule posting for tomorrow" | E: POST | Platform scheduler / `/n8n` |
| "run the full pipeline / batch produce" | F: PIPELINE | A→B→C→D→E (checkpoint-resume) |
| "produce episode X through Y" | F: PIPELINE | STB batch pattern |
| "monthly production run" | F: PIPELINE | F1-F6 (complete workflow) |
| "what format should I use for TikTok?" | (none — info) | Answer: 1080×1920, <60s, vertical, 9:16 aspect |
| "which platform should I post to first?" | (none — strategy) | Answer: YouTube first (SEO), then TikTok (engagement), then Instagram (reach) |

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

