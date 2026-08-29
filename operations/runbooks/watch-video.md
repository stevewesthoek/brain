# Watch Video Runbook

## Scope

`watch-video` is a dormant video-analysis skill. It adapts the MIT-licensed
`taoufik123-collab/claude-watch` source snapshot into a Brain-local,
provider-neutral report pipeline. It is not a Mind writer, Obsidian writer,
platform login, or system package installer.

Source and provenance:

- adapter: `ai/skills/custom/watch-video/`
- vendored snapshot: `ai/skills/vendors/taoufik123-collab/claude-watch/`
- upstream version: `0.2.0`
- upstream commit: `7711231e4c47e5d4e06bcf5326c4abf5b70ab4a9`
- license: `ai/skills/vendors/taoufik123-collab/claude-watch/LICENSE`

## Preflight

The operator must install `ffmpeg`, `ffprobe`, and `yt-dlp` through the
approved machine setup. The adapter only checks `PATH`; it never runs the
upstream `setup.py` and never invokes Homebrew or another system package
manager.

Use captions by default:

```bash
python3 ai/skills/custom/watch-video/scripts/watch_video.py \
  'https://example.invalid/video' \
  --transcript-provider captions \
  --intent 'research question'
```

Whisper fallback requires both a provider choice and explicit permission for
external audio upload:

```bash
GROQ_API_KEY='injected-by-approved-secret-store' \
python3 ai/skills/custom/watch-video/scripts/watch_video.py \
  '/path/to/video.mp4' \
  --transcript-provider groq \
  --allow-external-transcription
```

Do not place the example secret value in a file or command history. The
adapter does not print it.

## Outputs and boundaries

Reports and extracted frames go under `runtime/local/watch-video/<run>/` by
default. The output directory must not be inside a Mind directory or be a
symlink. Preserve the source URL/path, acquisition date, title/uploader,
transcript source, rights note, and analysis uncertainty in the report.

The upstream Obsidian auto-save path is intentionally not copied into the
adapter. Do not use `obsidian://`, `$WATCH_VAULT_DIR`, hooks, or plugin
installation in Brain.

Save-to-Mind remains a separate, human-reviewed action. The current Brain
ingestion envelope is explicitly bounded to Markdown, text, and limited local
PDF extraction; it does not expose a validated video queue/dispatcher. Do not
create a second video-to-Mind ingestion framework. If a future approved queue
is located, hand off the report at that existing source-type dispatch boundary
and keep promotion/write gates unchanged.
