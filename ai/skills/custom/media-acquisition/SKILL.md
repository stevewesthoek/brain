---
name: media-acquisition
description: Dormant specialist skill for online media acquisition using yt-dlp. Use implicitly when a video, research, web, or design workflow needs to collect online video/audio metadata, subtitles, transcripts, thumbnails, or permitted media files from YouTube or other supported platforms. Not a general web scraper and not a piracy tool. Prefer metadata/subtitles first; full media download only when needed and rights/permissions allow it.
---

# Media Acquisition — yt-dlp Specialist

You are the specialist skill for acquiring online video/audio resources so other orchestrators can research, analyze, cite, clip, remix, or learn from them.

This skill is intentionally dormant. Users should not need to name it. It is routed implicitly by `/video`, `/research`, `/web`, or `/design` when the end goal needs online media metadata, subtitles, transcripts, thumbnails, audio, or video files.

Primary backend:

```text
yt-dlp
```

Required companion tool:

```text
ffmpeg
```

---

## Core Role

Use this skill when the task involves online media acquisition, such as:

- collect metadata from a YouTube/video URL
- get subtitles or auto-captions for research
- extract a transcript from a lecture, sermon, debate, interview, or tutorial
- download audio for transcription or analysis
- download a permitted video for clipping, remixing, or offline review
- collect thumbnails for hook/title/style analysis
- archive source metadata for a research note
- prepare source clips for `/ffmpeg`, `/video`, or `/research`
- collect visual or motion references for `/design`

Do not use this skill for normal webpage scraping. Use `/firecrawl` for pages and `/web` for browser workflows.

---

## Non-Negotiable Boundaries

This is a powerful acquisition tool. Apply these rules silently:

- Do not use for piracy.
- Do not bypass paywalls, DRM, or access controls.
- Do not download private content without permission.
- Respect copyright, platform terms, licenses, and the user's rights to use the material.
- Prefer metadata/subtitles over full downloads for research.
- Prefer public-domain, Creative Commons, owned, licensed, or explicitly permitted material.
- Preserve source URL, title, uploader/channel, upload date, access date, and license/permission notes.
- Do not redistribute downloaded media unless rights allow it.
- Use cookies only when the user explicitly confirms they are authorized to access the account/content.
- Do not store cookies, tokens, credentials, or secrets in the repo.

If rights are unclear, collect metadata/subtitles only or ask for permission/ownership clarification before full media download.

---

## Acquisition Levels

Default to the least invasive level that satisfies the task.

### Level 1 — Metadata Only

Use when researching sources, discovering examples, evaluating hooks/titles, or building a source ledger.

Collect:

- URL
- title
- uploader/channel
- upload date
- duration
- description
- chapters if available
- thumbnail URL or thumbnail file if needed
- webpage URL
- license/permission note when available

### Level 2 — Text Only

Use when the user needs source analysis, claim extraction, script research, apologetics/debate analysis, sermon/lecture review, or educational research.

Collect:

- subtitles
- auto-captions if no human subtitles exist
- transcript text
- chapters
- timestamps when possible

### Level 3 — Media File

Use only when the user needs editing, clipping, remixing, offline review, audio processing, frame extraction, or visual reference extraction and has rights/permission.

Collect:

- video file
- audio file
- thumbnail image
- subtitles alongside the media
- metadata sidecar

---

## Default Folder Pattern

When saving into a project, use a clear media-source folder. Do not scatter downloads.

```text
<project>/sources/media/<slug>/
  metadata.info.json
  metadata.md
  subtitles/
  thumbnails/
  audio/
  video/
  clips/
```

For `mind` research notes, prefer:

```text
mind/06-resources/research/sources/web-media/<case-or-topic>/<slug>/
```

For `brain` video projects, prefer the relevant project production/source folder, never raw root paths.

---

## Commands

Check install:

```bash
yt-dlp --version
ffmpeg -version
```

Metadata only:

```bash
yt-dlp --skip-download --write-info-json --write-description --write-thumbnail --convert-thumbnails jpg --paths "<output-dir>" "<url>"
```

Subtitles / captions only:

```bash
yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "en.*" --sub-format "vtt/srt/best" --write-info-json --paths "<output-dir>" "<url>"
```

Metadata + subtitles + thumbnail:

```bash
yt-dlp --skip-download --write-info-json --write-description --write-thumbnail --convert-thumbnails jpg --write-subs --write-auto-subs --sub-langs "en.*" --sub-format "vtt/srt/best" --paths "<output-dir>" "<url>"
```

Audio only:

```bash
yt-dlp -x --audio-format mp3 --audio-quality 0 --write-info-json --write-thumbnail --convert-thumbnails jpg --paths "<output-dir>" "<url>"
```

Best MP4 video, limited to 1080p:

```bash
yt-dlp -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/best[height<=1080]" --merge-output-format mp4 --write-info-json --write-thumbnail --convert-thumbnails jpg --write-subs --write-auto-subs --sub-langs "en.*" --sub-format "vtt/srt/best" --paths "<output-dir>" "<url>"
```

Playlist metadata/text only:

```bash
yt-dlp --yes-playlist --skip-download --write-info-json --write-description --write-thumbnail --convert-thumbnails jpg --write-subs --write-auto-subs --sub-langs "en.*" --sub-format "vtt/srt/best" --paths "<output-dir>" "<playlist-url>"
```

Archive already-processed videos:

```bash
yt-dlp --download-archive "<output-dir>/download-archive.txt" --skip-download --write-info-json --paths "<output-dir>" "<url-or-playlist>"
```

---

## Routing By Orchestrator

### From `/video`

Use when the user says things like:

- "find references for this video"
- "download subtitles from this video"
- "analyze these YouTube hooks"
- "make a remix from this source"
- "extract audio from this lecture"
- "collect b-roll/reference clips"

Route:

```text
/video → /web for discovery if needed → /media-acquisition → /ffmpeg → /video synthesis/production
```

### From `/research`

Use when video/audio is a research source.

Route:

```text
/research → /web discovery → /media-acquisition metadata/subtitles → evidence ledger → synthesis/review
```

Default for research is metadata/subtitles, not full video.

### From `/web`

Use when a URL is a media URL or the task is to acquire subtitles, thumbnails, audio, or video.

Route:

```text
webpage content → /firecrawl
interactive/auth page → browser/playwright
media URL/resource → /media-acquisition
```

### From `/design`

Use only for permitted visual/motion references.

Route:

```text
/design → /web discovers references → /media-acquisition collects permitted reference metadata/media → /ffmpeg extracts frames/clips → /design extracts principles
```

Never copy another creator's design or assets without rights. Extract principles, not protected assets.

---

## Output Requirements

For any acquisition, return or save a source record with:

```text
title:
source_url:
uploader/channel:
upload_date:
access_date:
duration:
license_or_permission:
acquisition_level: metadata | text | media
saved_paths:
notes:
```

For research, add:

```text
claim relevance:
timestamps:
confidence:
limitations:
needs human review:
```

For video production, add:

```text
usage purpose:
rights/permission status:
derivative allowed: yes/no/unclear
processing next step:
```

---

## Stupid-Proof Natural Language Rule

If the user asks for a goal that clearly requires online media acquisition, do not ask them to name `yt-dlp` or `/media-acquisition`.

Examples:

```text
"Analyze this YouTube debate."
"Find hooks from these YouTube videos."
"Get the transcript of this sermon."
"Use this video as a reference for my reel."
"Download the audio so I can study it."
"Collect subtitles and metadata for this playlist."
```

In these cases, infer the media acquisition step automatically and use the least-invasive acquisition level.

---

## Install Boundary

This skill documents how to use `yt-dlp`, but it does not prove the binary is installed.

Before use, check:

```bash
yt-dlp --version
ffmpeg -version
```

If missing, install locally using the runbook:

```text
operations/runbooks/media-acquisition-yt-dlp.md
```
