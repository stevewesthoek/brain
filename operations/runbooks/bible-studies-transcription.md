# Bible Studies Transcription Pipeline

**Classification:** Historical automation design; the current typed registry keeps `bible-studies-pipeline` policy-blocked/disabled and the Brain Scheduler does not call it.

## Overview

Historical pipeline description. The implementation can be run only through a separately approved manual procedure; it is not an unattended Brain Scheduler job.

**Source code:**
- Shell entry point: `tools/scripts/bible-studies-pipeline.sh`
- Implementation: `tools/scripts/bible-studies/pipeline.mjs` (Bun)
- State: `~/.local/state/bible-studies/state.json`
- Log: `~/Library/Logs/office-scheduler/bible-studies.log`

## How It Works

### Phases

1. **Scan** — Recursively discover all `.mp4`, `.mp3`, `.m4a`, `.mov`, `.mkv` files in Google Drive (`Bible Study/Dance of Life/Bible Studies/`)
2. **Transcribe** — Run `mlx-whisper` (large-v3 model) on each untranscribed video
   - Memory gate: waits if <4 GB RAM available (prevents swap exhaustion)
   - CPU priority: runs at `nice 10` so system stays responsive
   - Timeout: 4 hours per video
3. **Format** — Convert JSON segments to timestamped Markdown with frontmatter
4. **Write** — Save to `brain/personal/bible-studies/dance-of-life/[Series]/[NN-of-TT] - Title.md`
5. **Sync to NotebookLM** — Group notes by series, create/update one notebook per series ("DOL - [Series]")
6. **README** — Regenerate index with transcription progress
7. **Commit** — Git-commit new notes to brain repo

### State Tracking

State file: `~/.local/state/bible-studies/state.json`

```json
{
  "transcribed": ["Series Name/video.mp4", ...],
  "nlmSynced": ["Series Name/video.mp4", ...],
  "failed": ["Series Name/corrupted.mp4", ...],
  "notebooks": {
    "Series Name": "notebook_id_xxxx",
    "Another Series": "notebook_id_yyyy"
  },
  "knownSeries": ["Series 1", "Series 2", ...]
}
```

**Meanings:**
- `transcribed` — videos successfully transcribed and written to disk
- `nlmSynced` — videos confirmed synced to NotebookLM (subset of transcribed)
- `failed` — videos where transcription produced empty output or errored; skipped on subsequent runs
- `notebooks` — NotebookLM notebook IDs per series (used for incremental sync)
- `knownSeries` — all series names ever discovered (logged when new series appears)

## Manual Invocation

### Normal run (transcribe new videos only)

```bash
./tools/scripts/bible-studies-pipeline.sh
```

Scans for videos not in `state.transcribed` or `state.failed`. Skips already-transcribed files.

### Retry failed videos

```bash
FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh
```

Clears `state.failed` and retries all videos that previously failed. Use this when:
- Audio files have been fixed or re-uploaded
- Memory issues have been resolved
- Downstream issues (NotebookLM sync failures) have been corrected

### Examples

```bash
# From brain root, run pipeline on new videos
cd /Users/Office/Repos/stevewesthoek/brain
./tools/scripts/bible-studies-pipeline.sh

# Retry all 19 failed transcriptions
cd /Users/Office/Repos/stevewesthoek/brain
FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh

# Force rescan + tail live output
cd /Users/Office/Repos/stevewesthoek/brain
FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh && tail -f ~/Library/Logs/office-scheduler/bible-studies.log
```

## Automation

Historical automation description (not current): this pipeline is not automatically triggered by the production Brain Scheduler:

**Historical caller:** `tools/scripts/office-nightly-scheduler.sh`
**Historical trigger claim:** Last content job, after `dance-of-life-sync` completes
**Historical schedule claim:** Daily via the then-current LaunchAgent design
**Historical implementation note:** the old design allowed a four-hour run and
described remaining videos as being picked up on a later run. This is not a
current scheduler retry or deployment contract.

### How automation works

1. New videos appear in Google Drive (`Bible Study/Dance of Life/Bible Studies/[Series]/`)
2. An approved manual session may run the sync step when explicitly reviewed
3. The approved manual session may then run the transcription wrapper
4. Pipeline checks state: skips already-transcribed files, transcribes new ones
5. Any repository write or commit requires separate explicit approval

This historical description does not establish current deployment, scheduling, or receipt evidence. Manual use requires a separate approved procedure.

## Status Messages

### During transcription

```
[HH:MM:SS] [1/42] Series Name/01 - Title.mp4
   Series: Series Name  |  Part 1 of 42  |  "Title"
   🎙️  Transcribing…
   ✅ Note written: personal/bible-studies/dance-of-life/Series Name/01-of-42 - Title.md
```

### Memory pressure (if <4 GB available)

```
   ⏳ Memory pressure: 2.3 GB available, need 4 GB — waiting 30s
   ⏳ Memory pressure: 2.8 GB available, need 4 GB — waiting 30s
   ⏳ Memory pressure: 4.1 GB available — proceeding
   🎙️  Transcribing…
```

### Transcription failure

```
   ❌ Transcription failed: mlx_whisper exited 1: [error details]
```

### Empty transcript (audio issue, not tool issue)

```
   ⚠️  Empty transcript — skipping
```

This means mlx-whisper ran to completion but produced no segments. Possible causes:
- Audio file is corrupted
- Audio format not supported by the model
- Audio was silent or very low quality
- File metadata has wrong extension (e.g., mp3 that's actually wav)

**Recovery:** Re-upload or re-encode the file in Google Drive, then run `FORCE_RESCAN=1`.

### NotebookLM sync failure

```
  ⚠️  claude exited 128: [error details]
  ⚠️  No JSON found in claude response (sync may still have succeeded)
```

NotebookLM sync failures are **non-blocking**:
- Notes are written to disk regardless
- Failed series are queued for retry on the next run
- No need to re-transcribe

## Troubleshooting

### Pipeline hangs on memory wait

If the pipeline is waiting at "Memory pressure: X GB available" for >5 min:

1. Close unnecessary apps (browsers, IDEs, etc.)
2. Force free memory:
   ```bash
   purge  # or install: brew install purge
   ```
3. Let the pipeline wait (it will retry every 30s, max 30 min)
4. If still hung after 30 min, manually stop and re-run:
   ```bash
   # Kill the pipeline
   pkill -f "mlx_whisper|bible-studies"
   # Clear the lock file (stale PID)
   rm ~/.local/state/bible-studies/pipeline.lock
   # Rerun
   ./tools/scripts/bible-studies-pipeline.sh
   ```

### Single video keeps failing

1. Check the log for the exact error:
   ```bash
   tail -100 ~/Library/Logs/office-scheduler/bible-studies.log | grep -A5 "video-name.mp4"
   ```

2. If "Empty transcript" — audio file issue:
   - Re-upload to Google Drive
   - Re-encode: `ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4`
   - Run `FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh`

3. If mlx_whisper error — transcription model issue:
   - Check mlx-whisper installation: `mlx_whisper --version`
   - Reinstall if needed: `pipx install --force mlx-whisper`
   - Run `FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh`

### NotebookLM sync issues

Sync failures are **automatically queued for retry**. The pipeline won't re-transcribe; it will just retry the sync on the next run.

To manually retry NotebookLM sync:
1. Run the pipeline normally (no state change needed)
   ```bash
   ./tools/scripts/bible-studies-pipeline.sh
   ```
2. It will detect already-transcribed notes and retry sync

### State corruption or reset

If you need to completely reset state and re-transcribe everything:

```bash
rm ~/.local/state/bible-studies/state.json
FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh
```

⚠️ **Warning:** This will re-transcribe all videos (hours of processing) and re-sync to NotebookLM. Only do this if state is corrupted.

## Logs

### Live log stream

```bash
tail -f ~/Library/Logs/office-scheduler/bible-studies.log
```

### View last run

```bash
tail -100 ~/Library/Logs/office-scheduler/bible-studies.log
```

### Search for specific series

```bash
grep "Series Name" ~/Library/Logs/office-scheduler/bible-studies.log
```

### Search for failures

```bash
grep "❌\|⚠️" ~/Library/Logs/office-scheduler/bible-studies.log
```

## Architecture Notes

### Why local transcription (mlx-whisper)?

- **No API costs** — large-v3 model runs locally on Apple Silicon (MLX acceleration)
- **Privacy** — audio never leaves the machine
- **Offline** — works without internet (after first model download)
- **Fast** — ~10 min per 1-hour video on M-series Mac

### Why NotebookLM notebooks per series?

- **Organization** — one notebook = one Bible study series
- **Incremental** — Claude CLI adds new notes to existing notebook each night
- **Searchable** — NotebookLM indexes all notes per series for cross-reference

### Memory gate purpose

MLX Whisper loads the 3 GB model into RAM. Running 100+ models back-to-back without recovery pauses causes swap thrashing and kernel watchdog panics. The memory gate:

- Checks available RAM before each transcription
- Waits 30s if <4 GB available
- Sleeps 5s after each video (lets macOS reclaim memory)
- Prevents system instability

### Why state.json?

- **Resilience** — if pipeline crashes mid-run, next invocation resumes from last saved state
- **Idempotency** — same file never transcribed twice (avoids duplicates in NotebookLM)
- **Auditability** — state serves as a manifest of what's been done

## Related

- **Historical automation:** `tools/scripts/office-nightly-scheduler.sh` (the old design called this pipeline nightly; it is not current)
- **Sync to local:** `tools/scripts/dance-of-life-sync.sh` (pulls videos from Google Drive to `Bible Studies/` folder)
- **Notes destination:** `personal/bible-studies/dance-of-life/` (organized by series, then sub-series)
- **NotebookLM:** `operations/runbooks/notebooklm.md` (manual notebook management)

## Quick Reference

| Task | Command |
|------|---------|
| Run pipeline (new videos only) | `./tools/scripts/bible-studies-pipeline.sh` |
| Retry failed videos | `FORCE_RESCAN=1 ./tools/scripts/bible-studies-pipeline.sh` |
| View live log | `tail -f ~/Library/Logs/office-scheduler/bible-studies.log` |
| Check state | `cat ~/.local/state/bible-studies/state.json \| jq` |
| Reset state (⚠️ re-transcribe all) | `rm ~/.local/state/bible-studies/state.json` |
| View last error | `grep "❌\|⚠️" ~/Library/Logs/office-scheduler/bible-studies.log \| tail -20` |
