---
name: video
description: >
  Single natural-language entry point for all video production work — writing scripts,
  generating voiceovers, composing video assets, designing thumbnails, and generating
  upload-ready packages for YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, and X.
  Routes to /stb-pipeline, /ffmpeg, /design for production; posting adapters for publishing.
  Production is local (Mac mini M4 Pro); publishing is adapter-dependent (requires platform
  authorization and credentials). AI-agnostic, IDE-agnostic.
---

# Video — Master Orchestrator (Local-First)

You are the **single entry point** for video production and publishing workflows. When the user says anything about making videos or posting them, this orchestrator routes the work appropriately.

**Important distinction:**
- **Production (Local):** Script, TTS, composition, captions, multi-format rendering, thumbnails, manifests — all run on Mac mini M4 Pro
- **Publishing (Adapter-Dependent):** Posting to platforms requires authorized adapters (API, n8n, browser-assisted, or manual upload). Not all platforms may be available; depends on credentials.

The user does not need to know the underlying skills exist; your job is to route work to the right tool in the right order.

**Dormant subskill rule:** Some referenced subskills may not be active in the default skill profile. Do not treat that as absence. Use `docs/skills/skill-index.md` and `docs/skills/profiles/video.txt` to locate or activate the needed video sub-capabilities. Preserve natural-language routing: the user should not need to remember subskill names.

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
- "analyze this YouTube video / playlist / debate / sermon"
- "get subtitles / transcript / metadata from this video"
- "find hooks from these videos"
- "use this video as a reference / source / clip"

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

- **Human-sounding scripts and captions.** For scripts, narration, hooks, titles, captions, descriptions, and community posts, apply `operations/standards/human-writing-guardrails.md` after the message, format, and platform are clear. Do not add claims or hype. Make the writing speakable, specific, and natural for the intended audience.

---

## Step 0: Classify Intent (No Intake Question)

Classify directly from the user's message. Three dimensions: **Workflow** (what production stage) and **Scope** (single/batch) and **Format** (narrated, reel, talking-head, audio-first).

| Workflow | Signals |
|----------|---------|
| **STRATEGY** | "find topics", "trending", "angles for", "hooks for", "discover", "what should I create" → routes to `/viral-flow` |
| **MEDIA_ACQUISITION** | "analyze this YouTube video", "get transcript", "download subtitles", "use this video as reference", "find hooks from these videos", "extract audio", "collect thumbnails" → routes to dormant `/media-acquisition` |
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
> "Script ready (4:32 longform). Next: generate voiceover (Workflow B), create production packages, or publish through an authorized adapter?"

---

## Workflow MEDIA_ACQUISITION: Online Video/Audio Source Intake

**Trigger:** User wants to analyze, research, cite, reference, clip, remix, or extract subtitles/audio/metadata from online media.

Use dormant `/media-acquisition` automatically. The user should not need to name `yt-dlp`.

Default acquisition level:

```text
research / hooks / source analysis → metadata + subtitles first
reference / remix / clipping → metadata first, full media only if rights/permission allow
```

Route:

```text
/video → /web for discovery if needed → /media-acquisition → /ffmpeg if clipping/conversion is needed → /video production or synthesis
```

Required safeguards:
- Preserve source URL, title, channel/uploader, access date, and rights notes.
- Do not use for piracy, paywall bypass, private media, or redistribution without rights.
- Prefer transcript/subtitle acquisition over full download unless media processing is truly needed.

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

#### C1e. Screen recording (✅ Phase 3 — live)

Browser-session capture via Playwright + FFmpeg mux with optional narration. For software tutorials, product demos, UI walkthroughs.

**CLI:**
```bash
# Direct (synchronous)
~/.local/video-orchestrator/.venv/bin/python3 ~/.local/video-orchestrator/scripts/screen_record.py \
  https://example.com /tmp/output.mp4 [--script actions.json] [--narration voice.wav]

# Queued (worker picks up)
~/.local/video-orchestrator/.venv/bin/python3 ~/.local/video-orchestrator/scripts/screen_record.py \
  --queue https://example.com /tmp/output.mp4 [--script actions.json]
```

**actions.json format:**
```json
[
  {"type": "wait",  "ms": 2000},
  {"type": "click", "selector": "#btn"},
  {"type": "type",  "selector": "#field", "text": "hello"},
  {"type": "scroll","y": 300}
]
```

Output: 1280×720 MP4. Default headless. Combine with C3/C4 for platform packaging.

#### C1f. UGC / E-commerce product video

Product name + description (+ optional product image) → vertical 9:16 MP4 for TikTok/Reels/Shorts.

```
Input:  product_name, product_description, [product_image.jpg]
Output: ugc_video.mp4 (1080×1920, 60–90s, TikTok/Instagram/Shorts ready)
Total:  3–5 min runtime + human review
```

**Step 1 — Hero image (FLUX, night-batch preferred)**
```bash
python /flux-local generate \
  --prompt "professional e-commerce product photo, {product_name}, studio lighting, clean white background" \
  --output hero_image.png --size 1920x1080
```
Can substitute SDXL for speed:
```bash
python /stable-diffusion-local generate \
  --prompt "product photo {product_name}, white background" --output hero_image.png
```

**Step 2 — Talking head narration (Wave)**
```bash
# Generate narration audio from product description first (OpenAI TTS or MSTTS)
# Then:
python /wave-local generate \
  --image presenter_portrait.png \
  --audio narration.wav \
  --output talking_head.mp4
```

**Step 3 — Compose final vertical (FFmpeg)**
```bash
ffmpeg -i talking_head.mp4 -i hero_image.png \
  -filter_complex "[1]scale=1080:1920,format=yuv420p[bg];[0]scale=600:600[head];[bg][head]overlay=240:600" \
  -c:v libx264 -c:a aac -vf scale=1080:1920 -shortest ugc_video.mp4
```

**Step 4 — Add captions (recommended)**
```bash
ffmpeg -i ugc_video.mp4 -vf subtitles=captions.srt ugc_video_captioned.mp4
```

**Step 5 — Package and post via E workflow**
Platforms: TikTok, Instagram Reels, YouTube Shorts. Stagger posts 30min+ apart.
Format key: `vertical_1080x1920_9x16` from `format-specs.json`.

#### C1z. Format normalization (✅ Phase 3 — live)

Generate a **master render** (1920×1080 16:9) once, then derive all platform variants in parallel.

```
Master → landscape_1920x1080_16x9  (YouTube, LinkedIn)
       → vertical_1080x1920_9x16   (TikTok, Reels, Shorts) — crop center-safe
       → square_1080x1080_1x1      (Instagram feed)
       → portrait_1080x1350_4x5    (Instagram portrait)
       → lightweight_1280x720_16x9 (Facebook, X)
```

Load conversion filters from `~/.config/video-orchestrator/format-specs.json`. Always verify center-safe crop before publishing vertical from landscape source.

**CLI (direct, offline):**
```bash
~/.local/video-orchestrator/.venv/bin/python3 ~/.local/video-orchestrator/scripts/normalize.py \
  /path/to/master.mp4 /path/to/output_dir [format_key1 format_key2 ...]
```

**CLI (queued, worker picks up):**
```bash
~/.local/video-orchestrator/.venv/bin/python3 ~/.local/video-orchestrator/scripts/normalize.py \
  --queue /path/to/master.mp4 /path/to/output_dir
```

**C1e (Screen recording)** is also live. See C1e section and `~/.local/video-orchestrator/scripts/screen_record.py`.

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

### C4. Create platform-ready production packages

Finalize encoding by generating **upload-ready packages**, not by assuming direct publishing is available.

Load encoding parameters from the deployed spec files:
```
~/.config/video-orchestrator/platform-specs.json  — posting modes, hashtag limits, description max, thumbnail rules per platform
~/.config/video-orchestrator/format-specs.json    — resolution, fps, codec_video, codec_audio, bitrate_video, bitrate_audio, container per format key
```

Format key → FFmpeg command mapping (from `format-specs.json`):
| Format key | Resolution | AR | Use for |
|---|---|---|---|
| `landscape_1920x1080_16x9` | 1920×1080 | 16:9 | YouTube longform, LinkedIn |
| `vertical_1080x1920_9x16` | 1080×1920 | 9:16 | TikTok, Reels, Shorts |
| `square_1080x1080_1x1` | 1080×1080 | 1:1 | Instagram feed |
| `portrait_1080x1350_4x5` | 1080×1350 | 4:5 | Instagram portrait |
| `lightweight_1280x720_16x9` | 1280×720 | 16:9 | Facebook, X, lightweight |

Apply using FFmpeg `-vf scale=W:H` with `codec_video`, `codec_audio`, `bitrate_video`, and `bitrate_audio` from the spec. Never hardcode platform dimensions — always read from `format-specs.json`.

Optional caption spec:
- `caption-specs.json` — SRT/VTT/JSON and burn-in rules

Rendering modes:

| Mode | Use when | Notes |
|------|----------|-------|
| Canonical timeline | Text, faces, products, overlays, captions, reusable templates | Preferred default; render 16:9, 9:16, 1:1, and 4:5 from the same timeline |
| Simple transform | Static or center-safe content | Use FFmpeg crop/scale only when the result will not cut off important content |

Every package should include:
- encoded video variant
- captions as SRT/VTT/JSON where useful
- optional burned-in captions for short-form platforms
- thumbnail or cover image
- title, description, hashtags/tags
- target platform/account metadata
- adapter status: api, n8n, browser_assisted, manual, or disabled
- manifest entry with file paths and verification status

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

## Workflow E: PACKAGE, POST, OR SCHEDULE

**Trigger:** "post this to YouTube", "upload to TikTok", "schedule for Instagram", "publish on LinkedIn", "make upload packages"

### E0. Select targets and adapter modes

Before publishing, determine:
- target platforms
- target accounts
- package format for each target
- adapter mode for each target: `api`, `n8n`, `browser_assisted`, `manual`, or `disabled`
- adapter status: `supported`, `partially_supported`, `manual_only`, `blocked_pending_credentials`, `blocked_pending_app_review`, or `disabled`

Read platform and format rules from the deployed spec files when available:
```
~/.config/video-orchestrator/platform-specs.json  — hashtag limits, description max, thumbnail rules, schedule windows, rate limits per platform
~/.config/video-orchestrator/format-specs.json    — resolution, aspect ratio, codec, bitrate, container per format key
```

**Account selection flow (E0.1 – E0.4):**

**E0.1** — Ask which platform(s) to post to. Cross-reference `platform-specs.json` for available adapter modes.

**E0.2** — For each platform, ask which account. Validate account exists in the account registry (`~/.config/video-orchestrator/account-registry.json` when present).

**E0.3** — Select package format for each target using `format-specs.json` format keys (e.g., `vertical_1080x1920_9x16` for TikTok/Reels, `landscape_1920x1080_16x9` for YouTube longform).

**E0.4** — Store selections in the manifest for audit trail:
```json
{
  "targets": [
    { "platform": "youtube", "account": "says-the-bible", "format_key": "landscape_1920x1080_16x9", "adapter_mode": "manual" },
    { "platform": "tiktok",  "account": "stb-tiktok-1",   "format_key": "vertical_1080x1920_9x16",  "adapter_mode": "manual" }
  ]
}
```

If adapter status is not publishable, generate a manual upload package instead of pretending automation is available.

### E1. Generate upload-ready packages

For each target platform/account, create or verify:
- final video variant
- captions (SRT/VTT/JSON and optional burned-in version)
- thumbnail or cover image
- title, description, hashtags/tags
- platform/account metadata
- package manifest

The package is the durable deliverable. Publishing is a separate adapter step.

### E2. Adapter pre-flight checks

Before any non-manual publishing attempt:
- verify credentials are present and valid
- verify OAuth scopes and app permissions
- verify account status and cooldowns
- verify quota/rate-limit assumptions are current enough
- verify idempotency key exists for the posting job
- verify manual fallback is available if the adapter fails

### E3. Publish or hand off

Route by adapter mode:

| Mode | Behavior |
|------|----------|
| `api` | Use a platform API adapter only when credentials, scopes, quotas, and app review allow it |
| `n8n` | Trigger an n8n workflow that wraps an authorized adapter |
| `browser_assisted` | Use local browser automation only when acceptable; expect brittleness and human review |
| `manual` | Copy package to upload folder and provide upload instructions |
| `disabled` | Do not attempt publishing; report why it is unavailable |

### E4. Audit and monitor

Always log:
- package path
- adapter mode
- account target
- posting state: draft, scheduled, uploading, processing, published, failed, or needs_manual
- platform URL if available
- errors and retry attempts

Do not claim a post is published unless the adapter or the user-provided confirmation proves it.

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

📦 PACKAGE: Generated YouTube and TikTok upload-ready packages
  ✓ YouTube package: video + captions + thumbnail + metadata ready
  ✓ TikTok package: vertical video + captions + caption text ready

📤 PUBLISHING:
  • YouTube: publish only if authorized adapter is configured
  • TikTok: manual or approved adapter workflow; otherwise package is ready for upload

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
  • Generate an Instagram-ready package
  • Publish only through an authorized adapter or manual upload
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

E: PACKAGE / PUBLISH
  → Generate YouTube-ready packages for all 4 videos
  → If an authorized YouTube adapter is configured: schedule for Tue/Wed/Thu/Fri 10am UTC
  → Otherwise: create manual upload packages with titles, descriptions, tags, captions, and thumbnails

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
    youtube_package: ✓ ready for upload
    youtube_posting: scheduled only if authorized adapter is configured; otherwise needs_manual
  [... episodes 2-4 ...]

All 4 episodes produced and packaged. Publishing status depends on adapter results or manual confirmation.
Next week's batch ready to plan?
```

**User specifies: topic count, format, platform. Orchestrator handles everything.**

---

## Workflow F: PIPELINE

**Trigger:** "run the full pipeline", "batch produce episodes", "create episode X through Z", "monthly production run"

### F0. Distribution planning

For batch work, first decide:
- target platforms
- target accounts
- adapter mode per target
- cooldown and duplicate-content policy
- whether each target should be published, scheduled, or packaged for manual upload

Output a distribution manifest before production begins.

### F1. Preconditions

- ✅ Scripts written and approved (A)
- ✅ TTS voice/service configured (B)
- ✅ Output directories exist
- ✅ Platform, format, and caption specs are current enough for this run
- ✅ Resource scheduler has capacity for requested model/render jobs
- ✅ Account targets and adapter statuses are known
- ✅ Posting jobs have manual fallback if adapters are unavailable
- ✅ Duplicate-content, cooldown, and account-limit policies pass pre-flight validation

### F2. Use durable state, not only a checkpoint file

For simple batches, a checkpoint file is acceptable. For Phase 2B+, use PostgreSQL durable entities and event logs:

- `video_state`: planned → scripted → voiced → assets_ready → captions_ready → composed → variants_ready → ready_to_post → partially_posted → posted → archived
- `job_state`: pending → leased → running → succeeded / failed / cancelled / dead
- `posting_state`: draft → scheduled → uploading → processing → published / failed / needs_manual

### F3. Run production stages with resource scheduling

| Stage | Action |
|-------|--------|
| STRATEGY/WRITE | Generate or approve scripts |
| VOICE | Generate or import narration |
| CAPTIONS | Generate transcript, SRT, VTT, JSON, optional burn-in captions |
| ASSETS | Generate images/video assets using resource-aware model routing |
| COMPOSE | Build canonical timeline or simple composition |
| RENDER | Create platform-specific variants with safe-zone templates |
| DESIGN | Create thumbnails and covers |
| PACKAGE | Assemble upload-ready packages and manifests |
| POST/SCHEDULE | Use authorized adapters or manual handoff only |

### F4. Resume safely

If the pipeline fails:
1. Inspect durable state and event logs.
2. Resume from the next incomplete stage.
3. Reuse completed scripts, audio, captions, assets, renders, and packages.
4. Never duplicate a posting job; use idempotency keys.

### F5. Asset inventory on completion

After production or publishing, update the manifest with:
- scripts
- audio
- captions
- visual assets
- render variants
- thumbnails
- production packages
- adapter status
- posting state and URL if actually published
- manual upload instructions if not published

### F6. Completion language

Only say “posted” or “published” when the adapter result or user confirmation proves it. Otherwise say “package generated,” “ready for manual upload,” “scheduled,” or “needs manual action.”

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
| **"how did my video perform?"** | **ANALYZE** | **Use local performance snapshots first; optional platform analytics adapters only when authorized** |
| **"post to YouTube and TikTok"** | **E: PACKAGE/POST** | **Generate upload packages first; publish only through authorized adapters or manual handoff** |
| **"manage my accounts / add a channel"** | **ACCOUNT** | **Update account registry and credential references; never store raw secrets in docs/manifests** |
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
| "make a product video / UGC video / e-commerce video" | C: COMPOSE (F) | FLUX hero + Wave talking head + FFmpeg (C1f) |
| "convert to all platforms / normalize formats" | C: COMPOSE (Z) | FFmpeg per format-specs.json (C1z) |
| "make a thumbnail / design the cover" | D: DESIGN | `/design` orchestrator |
| "create an intro / outro graphic" | D: DESIGN | `/design` or `/ffmpeg` |
| "post this to YouTube" | E: PACKAGE/POST | Generate package; publish only through authorized YouTube adapter or manual handoff |
| "upload to TikTok" | E: PACKAGE/POST | Generate package; publish only through approved TikTok adapter, browser-assisted workflow, or manual upload |
| "upload to Instagram Reels" | E: PACKAGE/POST | Generate package; publish only through authorized Meta/n8n adapter or manual upload |
| "post to LinkedIn / Facebook" | E: PACKAGE/POST | Generate package; publish only through authorized adapter or manual handoff |
| "share on Bluesky / X" | E: PACKAGE/POST | Generate package; publish only through authorized ATProto/X adapter or manual handoff |
| "schedule posting for tomorrow" | E: PACKAGE/SCHEDULE | Schedule only where adapter/platform support is authorized; otherwise prepare manual package |
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
- **Platform specs (deployed):** `~/.config/video-orchestrator/platform-specs.json` — 7 platforms, posting modes, hashtag/description rules, schedule windows (source: `brain/operations/specs/video-orchestrator/platform-specs.json`)
- **Format specs (deployed):** `~/.config/video-orchestrator/format-specs.json` — 5 format keys with resolution, codec, bitrate, container (source: `brain/operations/specs/video-orchestrator/format-specs.json`)
- **Platform specs (verify):** Validate current platform requirements at YouTube, TikTok, Instagram, LinkedIn, Facebook, X, Bluesky before each posting cycle — platform rules change
- **Worker (Phase 3):** `~/.local/video-orchestrator/worker/video_worker.py` — Python daemon, job queue consumer
- **Normalize CLI (C1z):** `~/.local/video-orchestrator/scripts/normalize.py` — direct or queued parallel format conversion
- **Screen record CLI (C1e):** `~/.local/video-orchestrator/scripts/screen_record.py` — Playwright → FFmpeg browser recording
- **Job status CLI:** `~/.local/video-orchestrator/scripts/job_status.py` — queue inspection, enqueue, resume
- **Account manager (Phase 4):** `~/.local/video-orchestrator/scripts/account_manager.py` — add/list/pause/activate accounts, Keychain credentials
- **Account routing (Phase 4):** `~/.local/video-orchestrator/scripts/account_routing.py` — affinity scoring, F0 distribution, F1 limit check, stagger scheduling
- **Python venv:** `~/.local/video-orchestrator/.venv` — activate before running scripts outside launchd
- **Worker launchd:** `~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist`
- **DB schema migration:** `brain/operations/database/standalone/video-orchestrator/init/002_phase3_lifecycle.sql`
- **DB endpoint:** `localhost:5450` (PostgreSQL, `video_orchestrator` database)

---

## Remember

The `/video` orchestrator is invisible by design. You don't think about it — you just talk to your AI about making videos, and the right toolchain runs automatically. No skill names (unless you want them), no tool knowledge needed.

**Just describe what you need.** The orchestrator handles the rest.

