---
name: ffmpeg
description: Use when the user asks to process audio or video with FFmpeg — mixing, encoding, format conversion, rendering static image + audio into video, or integrating FFmpeg into pipeline scripts. Assumes FFmpeg is installed globally via Homebrew.
---

# FFmpeg

## What this skill is for
Help Claude use FFmpeg safely and consistently for audio processing, video rendering, format conversion, and pipeline integration across projects.

## Use this skill when
- Mixing or processing audio (fade in/out, combining tracks, format conversion)
- Rendering a video from a static image + audio (e.g. YouTube uploads)
- Converting media formats (MP3, AAC, WAV, MP4, MOV, etc.)
- Integrating FFmpeg commands into Node.js, shell, or workflow pipeline scripts
- Diagnosing FFmpeg errors or tuning encoding parameters
- Building or reviewing FFmpeg filter graphs (`-filter_complex`)

## Do not use this skill for
- Video editing that requires frame-level cuts or timelines — use a proper NLE tool
- Bulk/batch operations on production media without explicit confirmation
- Operations that would overwrite original source files without a backup plan

## Safety rules
1. **Never overwrite originals silently.** Always write to a new output file. Use `-y` only when the user explicitly confirms overwrite intent.
2. **Test with a short segment first.** For long-running jobs, use `-t 10` to test the first 10 seconds before committing to the full run.
3. **Confirm before large batch operations.** State the number of files and estimated output size before running batch jobs.
4. **Preserve originals.** Recommend keeping source files (TTS audio, WAV noise, source images) separate from pipeline outputs.
5. **Verify FFmpeg is in PATH before pipeline scripts rely on it.** Use `which ffmpeg` or check exit code.

## Recommended workflow

```bash
# 1. Confirm FFmpeg is installed
which ffmpeg
ffmpeg -version

# 2. Test with a short segment first (always before full run)
ffmpeg -i input.mp3 -t 10 -c copy test_output.mp3

# 3. Run full operation with explicit output path
ffmpeg -i input.mp3 [options] output.mp3

# 4. Inspect output
ffprobe output.mp3
```

## Common patterns

### Mix two audio tracks (narration + background)
```bash
ffmpeg -y \
  -i narration.mp3 \
  -i background.wav \
  -filter_complex \
    "[0:a]adelay=20000|20000[narr];\
     [1:a]afade=t=in:st=0:d=20,afade=t=out:st=1740:d=60[bg];\
     [narr][bg]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[out]" \
  -map '[out]' \
  -ac 2 \
  -b:a 320k \
  mixed.mp3
```

### Render static image + audio → YouTube-ready MP4
```bash
ffmpeg -y \
  -loop 1 \
  -i thumbnail.png \
  -i mixed.mp3 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 \
  -preset veryfast \
  -tune stillimage \
  -c:a aac \
  -b:a 192k \
  -pix_fmt yuv420p \
  -shortest \
  -movflags +faststart \
  output.mp4
```

### Convert audio format
```bash
ffmpeg -i input.wav -b:a 192k output.mp3
ffmpeg -i input.mp3 -c:a aac -b:a 192k output.m4a
```

### Trim audio
```bash
ffmpeg -i input.mp3 -ss 00:00:20 -t 00:30:00 -c copy trimmed.mp3
```

### Extract audio from video
```bash
ffmpeg -i video.mp4 -vn -c:a copy audio.aac
```

### Inspect a file (no encoding)
```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

## Programmatic integration (Node.js pipeline)

When integrating FFmpeg into a Node.js pipeline script:
- Shell out via `child_process.execSync` or `spawnSync` with `stdio: 'inherit'` so errors surface
- Always validate `which ffmpeg` at pipeline startup — fail fast with a clear message if missing
- Pass all configurable parameters (delays, durations, bitrates) via environment variables
- Log the full FFmpeg command before executing so it is reproducible

```js
import { execSync } from 'child_process'

// Validate at startup
try { execSync('which ffmpeg', { stdio: 'pipe' }) }
catch { throw new Error('FFmpeg not found in PATH. Install via: brew install ffmpeg') }

// Run with visible output
execSync(`ffmpeg -y -i ${inputPath} [options] ${outputPath}`, { stdio: 'inherit' })
```

## Reference: says-the-bible pipeline
The canonical FFmpeg usage in this codebase lives in:
- `scripts/pipeline/02-mix-audio.mjs` — audio mixing with brown noise
- `scripts/pipeline/03-render-video.mjs` — video rendering for YouTube

These are the reference implementations for the audio-mix and static-video patterns above.

## Notes
- FFmpeg installed at: `/opt/homebrew/bin/ffmpeg` (version 8.1, as of 2026-03-29)
- Build includes: libx264, libx265, libopus, libmp3lame, libsvtav1, AAC, VideoToolbox, AudioToolbox
- Install/upgrade: `brew install ffmpeg` / `brew upgrade ffmpeg`
