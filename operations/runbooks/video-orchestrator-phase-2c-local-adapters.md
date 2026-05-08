# Video Orchestrator Phase 2C — Local Production Adapters

## Purpose

Phase 2C turns the Phase 2B queue worker into a real local production runner where local tools are available. It produces FFmpeg-rendered MP4 variants, FFmpeg-extracted thumbnails, optional Whisper.cpp captions, and schema-valid manifests without attempting any platform posting.

## Assumptions

- PostgreSQL Phase 2B schema is already initialized.
- Worker file: `operations/specs/video-orchestrator/video-orchestrator-worker.ts`.
- Local artifacts are written outside the repo or under an ignored temporary path for tests.
- Source media paths in job configs are absolute paths.

## Required Tools

- `ffmpeg` for render, audio extraction, and thumbnail jobs.
- `ffprobe` for artifact validation.
- Optional Whisper.cpp binary: `whisper-cli`, `whisper-cpp`, or a configured command.
- Optional Whisper model path, supplied as `task_config.whisper_model_path` or `VIDEO_ORCHESTRATOR_WHISPER_MODEL`.

No cloud transcription APIs, platform APIs, credentials, or posting adapters are used in Phase 2C.

## Render Job

Use `render_command` for a fully custom command, or provide local source media:

```json
{
  "video_id": "00000000-0000-4000-8000-000000000001",
  "format_key": "vertical_1080x1920_9x16",
  "input_video_path": "/absolute/path/to/source.mp4",
  "input_audio_path": "/absolute/path/to/optional-audio.wav",
  "input_image_path": "/absolute/path/to/optional-still.png",
  "output_path": "/absolute/path/to/output/vertical.mp4",
  "duration_seconds": 60,
  "render_mode": "simple_transform"
}
```

Behavior:
- custom `render_command` runs first when supplied
- otherwise `input_video_path` is transformed to the target format
- otherwise `input_image_path` plus `input_audio_path` renders a still-image video
- otherwise the worker creates an explicit placeholder artifact
- outputs are validated with `ffprobe`; text files with `.mp4` extensions are not upload-ready

## Caption Job

```json
{
  "video_id": "00000000-0000-4000-8000-000000000001",
  "input_audio_path": "/absolute/path/to/audio.wav",
  "input_video_path": "/absolute/path/to/source-with-audio.mp4",
  "output_dir": "/absolute/path/to/output/captions",
  "language": "en",
  "whisper_command": "whisper-cli",
  "whisper_model_path": "/absolute/path/to/ggml-base.en.bin"
}
```

Behavior:
- custom `caption_command` runs first when supplied
- otherwise the worker looks for a compatible Whisper.cpp command and model path
- if only video is supplied, FFmpeg extracts a 16 kHz mono WAV first
- SRT, VTT, and JSON outputs are preserved or generated
- if Whisper.cpp or the model is unavailable, placeholder captions are created and marked as non-production

## Thumbnail Job

```json
{
  "video_id": "00000000-0000-4000-8000-000000000001",
  "format_key": "landscape_1920x1080_16x9",
  "input_video_path": "/absolute/path/to/render.mp4",
  "output_path": "/absolute/path/to/output/thumbnail.jpg",
  "timecode": "00:00:03",
  "method": "extracted_frame"
}
```

Behavior:
- custom `thumbnail_command` runs first when supplied
- otherwise FFmpeg extracts a frame from `input_video_path`
- otherwise FFmpeg resizes `input_image_path` into the target thumbnail
- otherwise the worker creates an explicit placeholder thumbnail
- readable image validation is required before a thumbnail can count as production-ready

## Manifest Validation

Generate the manifest with a manifest job after render, caption, and thumbnail jobs have completed:

```json
{
  "video_id": "00000000-0000-4000-8000-000000000001"
}
```

Expected manifest behavior:
- real readable video plus real readable thumbnail targets can become `upload_ready: true`
- placeholder or invalid media is excluded from upload-ready completeness
- manifest warnings identify placeholder or invalid artifacts
- `artifact_provenance` records local artifact classification

Validate JSON syntax:

```bash
python3 -m json.tool operations/specs/video-orchestrator/production-package.schema.json >/dev/null
python3 -m json.tool operations/specs/video-orchestrator/test-manifest.json >/dev/null
```

## One-Video Local Package Test

1. Prepare a short source MP4 or still image plus WAV outside the repo.
2. Insert a `videos` row in the local Phase 2B database.
3. Add render jobs using the example configs under `operations/specs/video-orchestrator/examples/`.
4. Add a caption job. If Whisper.cpp is not configured, expect placeholder captions and warnings.
5. Add thumbnail jobs pointing at rendered MP4 outputs.
6. Add a manifest job.
7. Verify the generated manifest contains real artifact paths, warning state only when appropriate, and no posting state.

## Out Of Scope

- YouTube, TikTok, Instagram, Bluesky, X, LinkedIn, or Facebook posting adapters.
- Platform credentials, tokens, cookies, OAuth flows, or `.env` changes.
- Cloud transcription APIs.
- Database schema migrations for artifact provenance. Provenance is surfaced through job events and manifest metadata.
