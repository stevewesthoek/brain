# Media Acquisition With yt-dlp

**Status:** Active dormant capability  
**Last reviewed:** 2026-05-09  
**Primary skill:** `ai/skills/custom/media-acquisition/SKILL.md`  
**Backend:** `yt-dlp` + `ffmpeg`

---

## Purpose

This runbook documents how Brain uses `yt-dlp` for online media acquisition.

The user should not need to remember `yt-dlp`, command syntax, or the `media-acquisition` skill name. Natural-language requests should route through the relevant orchestrator:

```text
/video
/research
/web
/design
```

The orchestrator decides whether media acquisition is needed.

---

## What This Capability Does

Use `yt-dlp` to acquire online media resources for legitimate research, production, or reference workflows:

- metadata
- descriptions
- thumbnails
- subtitles
- auto-captions
- transcripts
- audio files
- video files
- playlist source records

This is the missing layer between:

```text
I found a useful online video.
```

and:

```text
Brain can analyze, cite, clip, remix, summarize, or learn from it.
```

---

## What This Capability Is Not

It is not:

- a piracy tool
- a DRM bypass tool
- a paywall bypass tool
- a replacement for Firecrawl
- a replacement for Playwright
- a semantic search engine for local video archives
- an always-on default skill

For local semantic search inside already-downloaded videos, a different future tool may be used. `yt-dlp` is acquisition, not semantic search.

---

## Why Dormant, Not Default

This capability is powerful but not needed in every conversation.

It should remain dormant because:

1. The default active skill set must stay small for Claude Code, Codex, Gemini, and IDEs.
2. Media acquisition has rights/copyright implications.
3. Most research still needs web pages, PDFs, or local notes rather than media downloads.
4. Orchestrators can discover this skill through `docs/skills/skill-index.md` and profile docs.

---

## Install

Run locally on the Mac:

```bash
brew install yt-dlp ffmpeg
```

Verify:

```bash
yt-dlp --version
ffmpeg -version
```

Update later:

```bash
brew upgrade yt-dlp ffmpeg
```

If Homebrew is not available, use the official `yt-dlp` installation docs and keep `ffmpeg` installed separately.

---

## Legal And Safety Boundaries

Default to the safest level that satisfies the task.

Rules:

- Prefer metadata/subtitles over full media for research.
- Preserve provenance for every acquired source.
- Never store cookies, tokens, credentials, or secrets in the repo.
- Use cookies only when the user explicitly confirms authorized access.

---

## Acquisition Levels

### Level 1 — Metadata Only

Use for source discovery, hook analysis, title analysis, source ledgers, and lightweight research.

```bash
yt-dlp --skip-download --write-info-json --write-description --write-thumbnail --convert-thumbnails jpg --paths "<output-dir>" "<url>"
```

### Level 2 — Text Only

Use for research, claim extraction, source analysis, apologetics, sermon/lecture review, tutorial analysis, and transcript-based workflows.

```bash
yt-dlp --skip-download --write-info-json --write-description --write-thumbnail --convert-thumbnails jpg --write-subs --write-auto-subs --sub-langs "en.*" --sub-format "vtt/srt/best" --paths "<output-dir>" "<url>"
```

### Level 3 — Media File

Use for editing, clipping, remixing, offline review, audio analysis, frame extraction, or permitted reference extraction.

Audio only:

```bash
yt-dlp -x --audio-format mp3 --audio-quality 0 --write-info-json --write-thumbnail --convert-thumbnails jpg --paths "<output-dir>" "<url>"
```

Best MP4 up to 1080p:

```bash
yt-dlp -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/best[height<=1080]" --merge-output-format mp4 --write-info-json --write-thumbnail --convert-thumbnails jpg --write-subs --write-auto-subs --sub-langs "en.*" --sub-format "vtt/srt/best" --paths "<output-dir>" "<url>"
```

---

## Recommended Folder Layout

For Mind research:

```text
mind/06-resources/research/sources/web-media/<case-or-topic>/<slug>/
  metadata.info.json
  metadata.md
  subtitles/
  thumbnails/
  audio/
  video/
  clips/
```

For Brain video production:

```text
brain/projects/<project>/sources/media/<slug>/
  metadata.info.json
  metadata.md
  subtitles/
  thumbnails/
  audio/
  video/
  clips/
```

Do not save media randomly into Downloads or repo roots.

---

## Source Record Template

Every acquisition should produce or update a source record:

```yaml
title:
source_url:
uploader_or_channel:
upload_date:
access_date:
duration:
license_or_permission:
acquisition_level: metadata | text | media
saved_paths:
rights_notes:
research_notes:
```

For research, also track:

```yaml
claim_relevance:
timestamps:
confidence:
limitations:
needs_human_review: true
```

For production, also track:

```yaml
usage_purpose:
derivative_allowed: yes | no | unclear
processing_next_step:
```

---

## Natural-Language Routing Examples

The user may say:

```text
Analyze this YouTube debate.
```

Expected route:

```text
/research → /web if discovery needed → /media-acquisition Level 2 → claim/evidence ledger
```

The user may say:

```text
Find hooks from these videos.
```

Expected route:

```text
/video or /viral-flow → /media-acquisition Level 1 or 2 → hook analysis
```

The user may say:

```text
Use this video as a reference for my reel.
```

Expected route:

```text
/video → /media-acquisition Level 1 first, Level 3 only if permitted → /ffmpeg if clipping needed
```

The user may say:

```text
Find animation references for a landing page.
```

Expected route:

```text
/design → /web discovery → /media-acquisition only for permitted references → design principles, not copied assets
```

---

## Orchestrator Integration

### `/video`

Use for:

- source videos
- reference videos
- hooks and title analysis
- subtitles/transcripts
- audio extraction
- thumbnails
- clips and remix preparation

### `/research`

Use for:

- video evidence sources
- debate/lecture/sermon transcripts
- source metadata
- timestamps and provenance
- claim extraction from subtitles

### `/web`

Use as media acquisition route when the target is a video/audio URL or the user wants subtitles, thumbnails, or downloads.

### `/design`

Use for motion/design references only when permitted. Extract principles, not protected assets.

---

## Verification Commands

Check status:

```bash
which yt-dlp
which ffmpeg
yt-dlp --version
ffmpeg -version
```

Test metadata-only acquisition:

```bash
mkdir -p /tmp/yt-dlp-smoke-test
yt-dlp --skip-download --write-info-json --paths /tmp/yt-dlp-smoke-test "<public-test-url>"
find /tmp/yt-dlp-smoke-test -maxdepth 2 -type f
```

Clean up after smoke test:

```bash
rm -rf /tmp/yt-dlp-smoke-test
```

---

## Maintenance

Update docs if:

- `yt-dlp` command flags change
- profile placement changes
- a wrapper script is added later
- media storage locations change
- copyright/rights policy changes

If this becomes frequent daily work, consider adding a safe wrapper script under `tools/` with logging, rights prompts, output-folder enforcement, and preset acquisition levels.
