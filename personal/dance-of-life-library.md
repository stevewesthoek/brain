# Dance of Life Library

A permanent personal project. The Dance of Life is a Bible study video and document library published on sync.com. This project mirrors the entire library to Google Drive and keeps it in sync daily, so it can be used as a RAG source in Obsidian for personal Bible studies.

## Source

```
https://ln5.sync.com/dl/8cd2a10a0?sync_id=16714321270009#j6eaxvtw-p6bejis7-qpswiw7h-9wbzk3vm
```

~794 files, ~496 GB (as of 2026-04).

## Destination

```
~/Library/CloudStorage/GoogleDrive-info@prochat.tools/My Drive/Bible Study/Dance of Life/Bible Studies/
```

Folder structure mirrors the source exactly. Never delete, only add.

## How it works

The source is a sync.com shared folder with E2E encryption. File names are encrypted in API responses and only decrypted by the browser using the URL hash key. Direct API downloads are not possible without reimplementing sync.com's client-side crypto.

The downloader uses headless Chromium (Playwright via bun) to drive the sync.com Angular app. The browser handles all decryption transparently. The script intercepts the final signed download URL and hands it to `curl` for the actual transfer.

Key technical details:
- `POST /api/v1/linkpathlist` — lists folder contents (returns encrypted names + sync_ids + sizes)
- `data-row-id` attributes on DOM rows — used to correlate decrypted names with API metadata
- `viewport: { width: 1280, height: 6000 }` — forces Angular CDK virtual scroller to render all rows at once
- `page.route('**syncusercontent**')` — intercepts the signed download URL before the browser starts downloading
- `curl -C -` — resumes partial downloads; handles files up to 4 hours
- `com.google.drivefs.item-id` xattr — detects files already synced to Google Drive without Drive API

## Running it

### First-time / resume bulk download

```bash
# The download is already in progress. State is saved to:
#   ~/.local/state/dance-of-life/state.json
# Logs are at:
#   ~/Library/Logs/office-scheduler/dance-of-life.log

# To resume if it stopped:
FORCE_RESCAN=0 bun ~/brain/tools/scripts/dance-of-life/sync_downloader.mjs
```

### Manual rescan (check for new source files)

```bash
# Via wrapper (FORCE_RESCAN=1 by default):
~/brain/tools/scripts/dance-of-life-sync.sh

# Or directly:
FORCE_RESCAN=1 bun ~/brain/tools/scripts/dance-of-life/sync_downloader.mjs
```

### Daily scheduler

The job `dance-of-life-sync` runs automatically as chain member **#4** in `office-nightly-scheduler.sh`. It uses `FORCE_RESCAN=1` so each day it rescans the source for new files but never re-downloads files already on Google Drive.

Timeout: 6 hours per run. Timeout does not stop the scheduler chain — remaining files are picked up the next night.

Immediately after `dance-of-life-sync`, the `bible-studies-pipeline` job (#5) runs to transcribe any newly downloaded videos. See [Transcription Pipeline](#transcription-pipeline) below.

## Disk space management

The script needs ~20 GB free at all times. The source is ~496 GB but Google Drive is the permanent home — local files are temporary.

When the script pauses with "Only X.X GB free":
1. Open Finder → `My Drive/Bible Study/Dance of Life/Bible Studies/`
2. Right-click completed folders → **"Make available online only"**
3. Wait for the cloud icon to appear (files are offloaded, space freed)
4. The script resumes automatically within 2 minutes

## State and logs

| File | Purpose |
|------|---------|
| `~/.local/state/dance-of-life/state.json` | Download manifest + done/failed lists. Persistent between runs. |
| `~/Library/Logs/office-scheduler/dance-of-life.log` | Append-only log of all runs. |

`FORCE_RESCAN=1` clears only the manifest (forces a fresh source scan) but preserves the `done` list — already-downloaded files are never re-downloaded.

## Scripts

| File | Purpose |
|------|---------|
| `brain/tools/scripts/dance-of-life/sync_downloader.mjs` | Main downloader (Playwright + curl) |
| `brain/tools/scripts/dance-of-life-sync.sh` | Shell wrapper, called by nightly scheduler |
| `brain/tools/scripts/bible-studies/pipeline.mjs` | Transcription pipeline (mlx-whisper + NotebookLM sync) |
| `brain/tools/scripts/bible-studies-pipeline.sh` | Shell wrapper for transcription pipeline |

## Transcription Pipeline

Videos are transcribed nightly by the `bible-studies-pipeline` scheduler job, which runs immediately after `dance-of-life-sync` so newly downloaded videos are transcribed the same night.

**How it works:**
1. Scans `Bible Studies/` for `.mp4`/`.mp3` files not yet in state
2. Transcribes each with `mlx-whisper` (`mlx-community/whisper-large-v3`, highest quality) — runs on Apple Silicon Neural Engine overnight
3. Formats transcript as an Obsidian markdown note with `[HH:MM:SS]` timestamped segments
4. Writes to `brain/personal/bible-studies/dance-of-life/[Series]/[NN-of-TT] - Title.md`
5. Syncs notes + series PDFs/RTFs to NotebookLM via `claude --print` — one `DOL - [Series]` notebook per series, auto-created on first encounter
6. Git-commits new notes so they appear in Obsidian immediately

**Dynamic growth:** new series folders, new videos, and new sub-series are all detected automatically on every run. No manual reconfiguration needed.

**State:** `~/.local/state/bible-studies/state.json`
**Log:** `~/Library/Logs/office-scheduler/bible-studies.log`
**Timeout:** 4 hours per night (idempotent — resumes from where it stopped)

## Obsidian / RAG usage

Two complementary query layers, both reading from `brain/personal/bible-studies/dance-of-life/`:

| Layer | How to use | Token cost |
|-------|-----------|------------|
| **Smart Connections** (Obsidian plugin) | Local semantic search — find notes by concept across all series | 0 tokens |
| **NotebookLM** (`DOL - [Series]` notebooks) | Deep Q&A with citation — query via Claude Code CLI using `mcp__notebooklm__notebook_query` | ~200–500 tokens per question (not per document) |

Query pattern from Claude Code CLI:
```
Ask the DOL - Synagogue of Satan notebook: what does the series say about the Council of Nicaea?
```
NotebookLM does the retrieval; Claude only pays for the question + answer, not the transcripts.

No AI tokens are consumed by the sync process itself — it is purely a local Playwright + curl pipeline. The transcription pipeline uses local CPU/ANE (no API calls). Tokens are only used during the NotebookLM sync step (`claude --print`) and when querying notebooks.
