# Brain Video Analysis — Canonical v1

**Status:** active Brain Core capability

This service is the one provider-neutral video analysis backend for Brain
Console, `brain-agent`, Codex, Claude Code, and the Save-to-Mind queue. It is
not a YouTube-only analyzer and it does not write to Mind.

## Flow

```text
YouTube URL | direct remote video URL | approved local file
  -> canonical Brain request
  -> watch-video adapter (captions, metadata, ffmpeg scene frames)
  -> optional local/free or explicitly permitted Whisper fallback
  -> selected-frame vision route (bounded budget)
  -> managed text summary with visual evidence
  -> VideoAnalysisResult v1
  -> optional exact-path Apply-one preview
```

The canonical contract is `operations/specs/brain-video-analysis-v1.md` and
its JSON Schema. Existing top-level `title`, `channel`, `transcript_text`,
`human_summary`, and `ai_summary` fields remain compatibility projections; the
authoritative transcript is the structured `transcript` object.

## Transcription and visual evidence

- Captions/subtitles are first and are preserved with timestamps.
- The repository's local MLX Whisper surface is selected only when captions are
  unavailable and the admitted local binary is installed; no cloud
  transcription is enabled implicitly.
- NotebookLM is an optional YouTube text fallback only, enabled explicitly by
  `BRAIN_VIDEO_ENABLE_NOTEBOOKLM=1`. Its fulltext fallback is marked
  untimestamped and never counts as visual watching.
- `watch-video` performs local media inspection and scene-aware frame
  extraction. Only up to the configured selected-frame budget is sent to the
  admitted `video_frame_analysis` vision route. Every result records extracted
  frames, paid-vision frames, provider/model, and selector cost estimate.

## Entry points

Brain Core exposes `POST /research/video-analysis`. The repository CLI uses the
same service module. The older `/research/video-analyze` mutation remains a
fail-closed compatibility boundary and is not the canonical entry point:

```bash
node projects/brain-core/dist/bin/brain-agent.js video analyze \
  'https://www.youtube.com/watch?v=EXAMPLE' --focus 'visual changes'
```

Claude Code and Codex use the same command; `--caller claude-code` labels the
request when needed. A local CLI file is permitted explicitly by the CLI
adapter. HTTP callers may only use the configured local-video root.

## Mind boundary

`--save-to-mind` or `persist_to_mind` creates a Brain-runtime preview for one
canonical `mind/inbox/processed/video-analysis/<job-id>.md` file. It preserves
the original `inbox/new` capture and requires concrete approval matching the
preview, source commit, exact target, expected-before hash, and a second
confirmation token before applying. Receipts and rollback artifacts remain in
Brain runtime state.

## Verification

```bash
python3 -m py_compile projects/brain-core/services/video-analyzer/analyze.py
python3 -m unittest projects/brain-core/services/video-analyzer/test_analyze.py
projects/brain-core/node_modules/.bin/tsx --test projects/brain-core/src/tests/video-analysis-pipeline.test.ts
```
