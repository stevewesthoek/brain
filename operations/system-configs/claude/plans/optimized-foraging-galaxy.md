# Plan: /video — Master Video Orchestrator Skill

## Context

The user produces video content for YouTube, TikTok, Instagram Reels, LinkedIn, Facebook, Bluesky, and X — in three primary formats: narrated slideshows (static image + TTS), short-form reels/clips, and talking-head/AI avatar videos. They need a single natural-language entry point that orchestrates the full video production lifecycle: write → voice → compose → design → post.

The orchestrator must match the exact structural pattern of the existing `/code`, `/web`, and `/design` skills: YAML frontmatter, Standing Laws, classified Workflows (A–F), Tool Reference Map, Routing Guide, AI-Agnostic section, and Underlying Tools section. It must be registered in all four config files and synced.

---

## What Gets Created / Modified

| Action | Path |
|--------|------|
| **CREATE** new skill | `brain/ai/skills/custom/video/SKILL.md` |
| **CREATE** active symlink | `brain/ai/skills/active/video -> ../custom/video` |
| **EDIT** repo CLAUDE.md | Add `## Video, media & production` section |
| **EDIT** `~/.claude/CLAUDE.md` | Add `/video` to Available skills line |
| **EDIT** AGENTS.md | Add `/video` to Workspace layout section |
| **EDIT** GEMINI.md | Add `/video` to Workspace layout section |
| **RUN** sync + check | `node tools/scripts/sync-ai-skills.mjs` |

---

## SKILL.md Structure (matches /web and /code pattern exactly)

### Frontmatter
```yaml
---
name: video
description: >
  Single natural-language entry point for all video production work — writing scripts, 
  generating voiceovers, composing video assets, designing thumbnails, and posting to 
  YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, and X. Routes automatically 
  to /stb-pipeline (narrated slideshows), /ffmpeg (audio/video composition), 
  /design (thumbnails and motion), and platform posting workflows. AI-agnostic, IDE-agnostic.
---
```

### Title
`# Video — Master Orchestrator`

---

## Six Workflows

### A: WRITE
Script and story generation for any video format.
- Sub-steps: classify format → extract key message → write script with Claude → structure for TTS (SSML if Microsoft, plain if ElevenLabs/OpenAI)
- Trigger: "write a script", "create a story for", "write narration for"

### B: VOICE
TTS audio generation — routes to the right TTS service based on project.
- Sub-steps: detect service (Microsoft MSTTS / ElevenLabs / OpenAI) → generate audio → save to production folder → quality check duration
- Microsoft: SSML with `<mstts:express-as>` tags (reuse STB pattern)
- ElevenLabs: API call with selected voice ID
- OpenAI: `/v1/audio/speech` endpoint
- Trigger: "generate voiceover", "TTS for this script", "make audio from this"

### C: COMPOSE
Video composition — combines audio, visuals, captions.
- Sub-step A: **Narrated slideshow** (STB pattern) → static image + audio → ffmpeg render → YouTube/landscape MP4
- Sub-step B: **Short-form reel** → vertical crop (9:16) + audio + captions → TikTok/Reels MP4
- Sub-step C: **Talking-head** → delegate to HeyGen API (service-agnostic stub, wirable later)
- Sub-step D: **Audio-first** → waveform + still → ffmpeg render
- Trigger: "render the video", "compose this", "make the reel"

### D: DESIGN
Thumbnails, covers, and motion graphics.
- Routes to `/design` orchestrator for thumbnail design
- Routes to `/ffmpeg` for video intro/outro overlays
- Routes to `/taste-skill` for visual polish
- Trigger: "make a thumbnail", "design the cover", "create an intro"

### E: POST
Upload and schedule to platforms — routes by platform.
- YouTube: `ytdlp` or manual (documented) + schedule via YouTube Studio API stub
- TikTok: manual posting workflow (TikTok API restricted) + documented automation path
- Instagram: documented + n8n webhook trigger pattern
- LinkedIn / Facebook: documented + n8n/Make webhook trigger pattern
- Bluesky / X: documented API path (ATProto + Twitter v2)
- Standing rule: always tag, always add description, always check format spec before posting
- Trigger: "post this to YouTube", "upload to TikTok", "schedule for Instagram"

### F: PIPELINE
Full end-to-end pipeline for a series or batch.
- Chains A → B → C → D → E in sequence with checkpointing between stages
- Reuses STB Pipeline's monthly batch pattern (checkpoint/resume)
- Trigger: "run the full pipeline", "produce episode X", "batch produce"

---

## Standing Video Laws (flat bullet format, matching /web)

1. **Script before everything.** Never generate audio or video before the script is approved. All other steps are blocked until WRITE completes.
2. **Format-first rendering.** Every render step must know its target platform before starting. Landscape (16:9) for YouTube long-form, vertical (9:16) for TikTok/Reels/Shorts, square (1:1) for LinkedIn/Facebook feed.
3. **Checkpoint all batch runs.** Any pipeline producing 3+ assets must use checkpoint/resume (STB pattern). Save state after each stage. Resume from last checkpoint on failure.
4. **TTS is project-scoped.** Each video series has one TTS voice. Do not mix voices within a series. Document the voice ID in the project config.
5. **Never overwrite source assets.** Raw narration audio, source images, and original scripts are read-only inputs. All processed outputs go to `/production/` subdirectory.
6. **Thumbnail always before posting.** Every video must have a thumbnail designed and reviewed before any platform upload. No bare-title cards.
7. **Platform spec check before encode.** Verify target platform's current spec (bitrate, resolution, duration cap, aspect ratio) before final ffmpeg render. Specs change — always check.
8. **Asset inventory on completion.** After any pipeline run, log all produced assets (path, duration, platform, upload status) to the project's `production/manifest.json`.

---

## Tool Reference Map

| Tool | Skill path | Use when |
|------|-----------|----------|
| `/stb-pipeline` | `custom/stb-pipeline/SKILL.md` | Narrated slideshow episodes — TTS + audio mix + YouTube render (battle-tested pipeline) |
| `/ffmpeg` | `custom/ffmpeg/ffmpeg/SKILL.md` | Audio mixing, video composition, format conversion, resampling, crop/scale |
| `/design` | `custom/design/SKILL.md` | Thumbnails, covers, motion graphics, visual polish |
| `/taste-skill` | `custom/taste-skill/taste-skill/SKILL.md` | Visual quality bar — review and improve thumbnails and motion |
| `/design-motion-principles` | `vendors/kylezantos/design-motion-principles/SKILL.md` | Motion audit for intros/outros/transitions |
| `/notebooklm` | (CLI) | Pre-production research — synthesize source material into scripts |
| `/n8n` | `custom/n8n/SKILL.md` | Platform posting automation via webhook triggers (Instagram, LinkedIn, Facebook) |
| HeyGen | (future stub) | Talking-head avatar video — wired in when API key available |
| ElevenLabs | (future stub) | High-quality TTS — wired in when API key available |
| Microsoft MSTTS | (via STB pattern) | Production-ready TTS — reuse existing SSML rendering pipeline |

---

## Natural Language Routing Guide (key rows)

| User says | Workflow | Primary tool |
|-----------|----------|--------------|
| "write a script for a video about X" | A: WRITE | Claude (direct) |
| "write narration / SSML for episode X" | A: WRITE | STB pattern |
| "generate voiceover / TTS for this script" | B: VOICE | MSTTS / ElevenLabs / OpenAI |
| "render the video / compose this" | C: COMPOSE | ffmpeg |
| "make a YouTube video from this audio + image" | C: COMPOSE (A) | ffmpeg (STB pattern) |
| "make a TikTok reel / Shorts / vertical clip" | C: COMPOSE (B) | ffmpeg (9:16 crop) |
| "create a talking-head video" | C: COMPOSE (C) | HeyGen (stub) |
| "make a thumbnail / design the cover" | D: DESIGN | /design orchestrator |
| "post this to YouTube" | E: POST | YouTube API / yt-dlp |
| "upload to TikTok / Instagram / Reels" | E: POST | n8n webhook / manual |
| "post to LinkedIn / Facebook / Bluesky / X" | E: POST | n8n / platform API |
| "run the full pipeline for episode X" | F: PIPELINE | A→B→C→D→E chain |
| "batch produce N episodes" | F: PIPELINE | STB batch pattern + checkpoint |
| "schedule posting for this week" | E: POST | n8n scheduling |

---

## Files to Modify

### 1. brain/CLAUDE.md
Add new section after the `## Web, browser & automation` section:

```markdown
## Video, media & production

For ALL video-related work — writing scripts, generating voiceovers, composing video
assets, designing thumbnails, and posting to platforms — use `/video`. The master 
orchestrator classifies intent and routes automatically to `/stb-pipeline` (narrated 
slideshows), `/ffmpeg` (audio/video composition), `/design` (thumbnails and motion), 
and platform posting workflows. No tool names or commands needed — just describe the task.

Underlying tools remain independent and directly callable: users can still invoke 
`/stb-pipeline`, `/ffmpeg`, `/design`, `/n8n` directly if they prefer.
```

### 2. operations/system-configs/claude/CLAUDE.md — Available skills line
Add to the comma-separated list:
```
`/video` (primary video/media orchestrator — natural language, all video production and posting scenarios),
```

### 3. operations/system-configs/codex/AGENTS.md — Workspace layout section
Add after the `/web` line:
```
For ALL video and media work (script writing, TTS/voiceover, video composition, thumbnail design, platform posting to YouTube/TikTok/Instagram/LinkedIn/Facebook/Bluesky/X), use the shared `/video` orchestrator at `brain/ai/skills/custom/video/SKILL.md` — single natural-language entry point that routes to `/stb-pipeline` (narrated episodes), `/ffmpeg` (audio/video composition), `/design` (thumbnails), and platform posting workflows. Underlying tools remain independently callable.
```

### 4. operations/system-configs/gemini/GEMINI.md — Workspace layout section
Add after the `/web` line:
```
For ALL video and media work (script writing, TTS/voiceover, video composition, thumbnail design, platform posting to YouTube/TikTok/Instagram/LinkedIn/Facebook/Bluesky/X), use the shared `/video` orchestrator at `brain/ai/skills/custom/video/SKILL.md` — single natural-language entry point that routes to `/stb-pipeline`, `/ffmpeg`, `/design`, and platform posting workflows. **Gemini's role in video:** excel at preprocessing large video transcripts, batch script review, and multi-episode planning (1M context window handles full series scripts); compress findings before handing production to Claude.
```

---

## Implementation Order

1. Create `brain/ai/skills/custom/video/` directory
2. Write `brain/ai/skills/custom/video/SKILL.md` (full orchestrator, matching /web and /code pattern)
3. Create symlink: `ln -s ../custom/video brain/ai/skills/active/video`
4. Edit `brain/CLAUDE.md` — add Video section
5. Edit `operations/system-configs/claude/CLAUDE.md` — add to Available skills list
6. Edit `operations/system-configs/codex/AGENTS.md` — add to Workspace layout
7. Edit `operations/system-configs/gemini/GEMINI.md` — add to Workspace layout
8. Run sync: `node tools/scripts/sync-ai-skills.mjs --dry-run && node tools/scripts/sync-ai-skills.mjs && node tools/scripts/sync-ai-skills.mjs --check`
9. Commit all changes together

---

## Verification

- `ls brain/ai/skills/active/video` — symlink exists
- `cat brain/ai/skills/active/video/SKILL.md | head -5` — YAML frontmatter present
- `node tools/scripts/sync-ai-skills.mjs --check` — exits 0
- `/video` resolves in Claude Code session (invoke skill, verify it loads)
- Grep `CLAUDE.md` and `AGENTS.md` for "video" — registration lines present
