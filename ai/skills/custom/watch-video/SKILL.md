---
name: watch-video
description: Use for provider-neutral multimodal video analysis from a URL or local file. Produces a local report with captions or explicitly selected Whisper fallback, scene-change frames, pacing, and hook analysis without writing to Mind, Obsidian, or installing system dependencies.
---

# Watch Video — Brain Adapter

Use this skill when the user asks to watch, analyze, research, cite, or find
hooks and visual moments in a video. The adapter is based on the vendored
`claude-watch` source snapshot, but its execution boundary is Brain-owned:

- invoke `scripts/watch_video.py`, never the upstream installer;
- require `ffmpeg`, `ffprobe`, and `yt-dlp` on `PATH` as applicable;
- use native captions first;
- use Groq or OpenAI Whisper only when the user explicitly selects the provider
  and permits external audio upload;
- keep output under `runtime/local/watch-video/` or an explicitly supplied safe
  output directory;
- never auto-install Homebrew/system packages, read cookies, bypass access
  controls, or write directly to Mind or an Obsidian vault.

The report is an artifact, not a memory promotion. The agent may read the
generated frames and complete the report narrative, but must preserve source
URL/path, access date, title/uploader when available, transcript provenance,
and rights notes. Keep frame extraction bounded (default max 80, hard max 100)
and use focused `--start`/`--end` ranges for long videos.

## Execution

```bash
python3 ai/skills/custom/watch-video/scripts/watch_video.py \
  '<url-or-local-video>' \
  --transcript-provider captions \
  --intent 'why this video matters'
```

For an explicit Whisper fallback, add `--transcript-provider groq` or
`openai` and `--allow-external-transcription`. Credentials remain in the
process environment or the provider's approved local secret store; never put
them in arguments, reports, or repository files.

The upstream snapshot is provenance-only under
`ai/skills/vendors/taoufik123-collab/claude-watch/`. Its `setup.py`, hooks,
plugin manifests, and Obsidian instructions are not part of this adapter's
execution path.

## Mind boundary

Do not copy the report into Mind automatically. For canonical analysis used by
Console, Codex, Claude Code, or Save-to-Mind, call Brain Core's shared
`video-analysis` operation (documented at
`operations/specs/brain-video-analysis-v1.md`) rather than calling the vendored
script from a consumer. Save-to-Mind dispatch remains asynchronous through the
existing inbox queue; its Apply-one artifact writer is exact-path and approval
gated.
