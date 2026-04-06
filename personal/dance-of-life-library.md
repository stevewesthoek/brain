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

The job `dance-of-life-sync` runs automatically as the **last** (lowest priority) job in `office-nightly-scheduler.sh`. It uses `FORCE_RESCAN=1` so each day it rescans the source for new files but never re-downloads files already on Google Drive.

Timeout: 6 hours per run. Timeout does not stop the scheduler chain — remaining files are picked up the next night.

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

## Obsidian / RAG usage

The destination folder is indexed by Obsidian as a vault attachment source. PDFs and documents in `Bible Studies/` are available as RAG sources for Bible study queries. Video files are present but not indexed.

No AI tokens are consumed by the sync process — it is purely a local Playwright + curl pipeline.
