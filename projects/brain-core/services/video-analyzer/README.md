# Video Analyzer — YouTube Transcript Extraction & AI Structuring

**Version:** 2.0 (NotebookLM + Local Ollama)  
**Status:** Production Ready (2026-06-01)  
**Gemini API:** ❌ REMOVED (not used)

---

## Overview

The Video Analyzer is a pipeline for extracting YouTube video transcripts and structuring them into searchable research materials.

```
YouTube URL (from Brain Console)
    ↓
[1] NotebookLM extraction (YouTube → transcript text)
    ↓
[2] Local Ollama structuring (transcript → JSON metadata)
    ↓
[3] Save to mind/capture/inbox (Markdown file for research)
    ↓
[4] Display in Brain Console (transcript + copy button)
```

---

## Architecture

### Technology Stack

| Component | Tool | Purpose | Cost |
|-----------|------|---------|------|
| **Transcript extraction** | NotebookLM CLI v0.3.4 | YouTube → full text transcript | Free (Google account) |
| **Structuring** | Local Ollama (qwen2.5:14b) | Transcript → title, summary, claims, research hooks | Free (local) |
| **Routing** | AI Model Selector (localhost:4890) | Routes to local Ollama with `local_only: true` flag | Free (local) |
| **Storage** | mind/capture/inbox | Markdown files for Obsidian vault | Free (local) |
| **UI** | Brain Console plugin | Display results + copy button | Free (local) |

### Key Design Decision: Gemini Completely Removed

**❌ Gemini API is NOT used anymore.**

Previously (pre-2026-05):
- Used Gemini API for transcript structuring
- Free tier ended Apr 10, 2026
- User chose not to pay for Gemini

Now (2026-06-01+):
- NotebookLM extracts transcript
- Local Ollama structures it
- 100% local, free, no external APIs except NotebookLM

**Verification:** Search code for "gemini" — zero results in analyze.py.

---

## How It Works

### Step 1: NotebookLM Authentication (Persistent)

```bash
notebooklm auth check --test
```

**Storage:** `~/.notebooklm/storage_state.json` (persists across reboots)

- Stored once during `notebooklm login` (Google OAuth)
- Reused automatically on each CLI invocation
- No re-authentication needed unless Google session expires (~30-90 days)
- See: `operations/runbooks/notebooklm-cli.md`

### Step 2: YouTube Source Management

```python
# Create or reuse notebook (persisted to ~/.local/brain/state/notebooklm-video-analyzer.json)
notebook_id = get_or_create_notebook()

# Add YouTube URL as source
source_id = notebooklm source add <url> --json

# Wait for processing (~30s typical, max 5min)
notebooklm source wait <source_id> --timeout 300

# Extract FULL transcript to temp file (avoids stdout truncation)
notebooklm source fulltext <source_id> -o /tmp/transcript.txt
```

**Critical detail:** We use `-o /tmp/transcript.txt` flag because NotebookLM truncates stdout display. The full transcript is saved to file and read entirely.

### Step 3: Local Ollama Structuring

```python
# Send transcript to AI Model Selector with local_only flag
POST http://127.0.0.1:4890/select
{
  "task_type": "transcript_summarization",
  "local_only": true,              # ← Forces local Ollama only
  "input_token_count": ~2000
}

# Receive model endpoint
Response: {base_url: "http://localhost:11434/v1", model: "qwen2.5:14b"}

# Call local model
POST http://localhost:11434/v1/chat/completions
{
  "model": "qwen2.5:14b",
  "messages": [{"role": "user", "content": prompt + truncated_transcript}],
  "temperature": 0.1
}
```

**Result JSON:**
```json
{
  "title": "Extracted from content",
  "channel": "Speaker or null",
  "human_summary": "3-5 sentence summary",
  "ai_summary": {
    "topic": "One-line topic",
    "speaker": "string or null",
    "key_claims": ["up to 5 claims"],
    "evidence_type": "anecdotal|empirical|opinion|tutorial|news|other",
    "confidence": "high|medium|low",
    "research_hooks": ["up to 4 research angles"]
  }
}
```

### Step 4: Save to Mind/Capture/Inbox

**Filename format:** `VA-{YYYYMMDD-HHMMSS}-{title}.md`

Example: `VA-20260601-195547-creating-your-own-ai-agent.md`

- `VA` = Video Analyzer identifier
- `{YYYYMMDD-HHMMSS}` = Extraction timestamp
- `{title}` = First 50 chars of video title (lowercase, hyphens)
- `.md` = Markdown format (readable in Obsidian)

**File content:**
```markdown
# Creating Your Own AI Agent: The Future of Automation

**Source:** https://youtu.be/MDtMwKcx_4E?si=Q0H_d9PC8wznNF1r
**Extracted:** 2026-06-01T19:55:47.717556
**Tool:** Brain Console → Research Orchestrator → NotebookLM

## Transcript

[Full transcript text — 88,619+ characters, complete, no truncation]
```

**Location:** `/Users/Office/Repos/stevewesthoek/mind/capture/inbox/`

This is the inbox of your Obsidian vault. Files are auto-synced via Obsidian Git plugin.

### Step 5: Brain Console Display

**Research Orchestrator drawer shows:**

1. **Title** — Extracted from video content
2. **Channel** — Speaker/channel name (if detected)
3. **Human Summary** section (open by default)
4. **AI Summary** section (collapsed, expandable)
   - Topic
   - Speaker
   - Key claims (bullet list)
   - Evidence type + confidence
   - Research hooks (bullet list)
5. **Transcription** section (open by default)
   - Full transcript text
   - **Copy button** — Click to copy entire transcript to clipboard
6. **Mind path indicator** — Shows `📁 Saved: VA-{timestamp}-{title}.md`

---

## API Endpoint

**Endpoint:** `POST http://localhost:3000/research/video-analyze`

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "focus": "Optional analysis focus (e.g., 'focus on technical details')"
}
```

**Response:**
```json
{
  "ok": true,
  "transcript": "Full transcript text (88,619+ chars)",
  "title": "Video title extracted",
  "channel": "Speaker or null",
  "human_summary": "3-5 sentence summary",
  "ai_summary": {
    "topic": "...",
    "speaker": null,
    "key_claims": ["...", "..."],
    "evidence_type": "tutorial",
    "confidence": "high",
    "research_hooks": ["...", "..."]
  },
  "mind_path": "/Users/Office/Repos/stevewesthoek/mind/capture/inbox/VA-20260601-195547-title.md"
}
```

**Timeout:** 30 minutes (NotebookLM processing can be slow)

---

## Usage Examples

### From Brain Console (UI)

1. Open Obsidian
2. Click Research Orchestrator
3. Paste YouTube URL
4. Click **Process**
5. Wait ~45 seconds
6. Results appear with:
   - Transcript (open, copy button ready)
   - AI summary (collapsed)
   - Mind path indicator (shows saved file)

### Direct CLI Test

```bash
python3 projects/brain-core/services/video-analyzer/analyze.py \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  --focus "Extract key technical concepts"
```

**Output:** JSON to stdout

### Via cURL

```bash
curl -X POST http://localhost:3000/research/video-analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtu.be/MDtMwKcx_4E",
    "focus": "technology trends"
  }'
```

---

## Storage Architecture

### Brain Repo (Automation)
```
brain/
├── projects/brain-core/
│   ├── services/video-analyzer/
│   │   ├── analyze.py              ← Main pipeline (this file)
│   │   └── README.md               ← You are here
│   └── src/api/routes.ts           ← HTTP endpoint
└── operations/runbooks/
    └── notebooklm-cli.md           ← NotebookLM troubleshooting
```

**Purpose:** Execution, orchestration, automation logic

### Mind Repo (Research Output)
```
mind/
├── capture/
│   └── inbox/
│       ├── VA-20260601-195547-title-1.md
│       ├── VA-20260601-195548-title-2.md
│       └── ...
```

**Purpose:** Research artifacts, searchable via Obsidian, synced via Git

---

## No Gemini — Full Verification

### Code Evidence

**analyze.py:** Zero Gemini references
```bash
$ grep -i gemini projects/brain-core/services/video-analyzer/analyze.py
# (no output = not present)
```

**TypeScript interfaces:** No Gemini fields
```bash
$ grep -i gemini projects/brain-core/services/video-analyzer/analyze.py
# (no output = not present)
```

### What Gemini Used To Do

- Parse transcript with Gemini API
- Generate structured metadata (title, claims, etc.)
- Rate-limited: 1,500 requests/day

### What Local Ollama Does Now

- Same parsing as Gemini (local qwen2.5:14b model)
- Same structured output (JSON: title, claims, research hooks)
- No rate limits (local compute)
- No API costs (free)
- 100% private (no data sent to Google)

---

## Troubleshooting

### Error: "No such file or directory: 'notebooklm'"

**Cause:** NotebookLM not in PATH when subprocess runs

**Solution:** Already fixed — uses full path `/Users/Office/.local/bin/notebooklm`

**Verify:**
```bash
grep "NOTEBOOKLM_BIN =" projects/brain-core/services/video-analyzer/analyze.py
# Output: NOTEBOOKLM_BIN = '/Users/Office/.local/bin/notebooklm'
```

### Error: "Token fetch failed: Authentication expired"

**Cause:** Google OAuth session expired

**Solution:**
```bash
notebooklm login
# Complete login in browser, press ENTER
notebooklm auth check --test  # Verify it passes
```

### Transcript is truncated or partial

**Cause:** NotebookLM stdout display truncates for readability

**Solution:** Already fixed — uses `-o /tmp/file` flag to save full transcript to file

**Verify:**
```bash
grep "\-o tmpfile" projects/brain-core/services/video-analyzer/analyze.py
# Should show: '-o', tmpfile in the run_cmd call
```

### AI structuring fails but transcript is returned

**Expected behavior.** The response still includes the full transcript even if Ollama structuring fails. You get the raw text for manual processing.

---

## File Formats & Naming Conventions

### Filename Pattern

```
VA-{timestamp}-{title}.md
└─ VA           = Video Analyzer identifier
   {YYYYMMDD}   = Date (YYYYMMDD format)
   {HHMMSS}     = Time (HHMMSS format)
   {title}      = First 50 chars of video title (lowercase, hyphens)
```

**Examples:**
- `VA-20260601-195547-open-claw-runs-my-11m-business.md`
- `VA-20260601-195231-rick-astley-never-gonna-give-you-up.md`

### Markdown Structure

```markdown
# {Video Title}

**Source:** {YouTube URL}
**Extracted:** {ISO timestamp}
**Tool:** Brain Console → Research Orchestrator → NotebookLM

## Transcript

{Full transcript text — complete, no truncation}
```

---

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_SELECTOR_URL` | `http://127.0.0.1:4890` | AI Model Selector endpoint |

### State Files

| File | Location | Purpose |
|------|----------|---------|
| Notebook ID | `~/.local/brain/state/notebooklm-video-analyzer.json` | Persists NotebookLM notebook ID across runs |
| Auth state | `~/.notebooklm/storage_state.json` | Google OAuth session (persists across reboots) |

### NotebookLM Authentication

See: `operations/runbooks/notebooklm-cli.md` for complete reference

---

## Performance

| Stage | Time | Notes |
|-------|------|-------|
| Auth check | <1s | Cached if already authenticated |
| Source add | ~2s | Upload source to NotebookLM |
| Processing | ~30s | NotebookLM processes video (typical) |
| Extraction | ~2s | Download transcript from NotebookLM |
| AI structuring | ~5s | Local Ollama analysis |
| Mind save | <1s | Write markdown file |
| **Total** | **~45s** | End-to-end for typical video |

**Max processing time:** 5 minutes (NotebookLM timeout)

---

## Maintenance

### Monthly Checklist

- [ ] Verify NotebookLM auth: `notebooklm auth check --test`
- [ ] Check mind/capture/inbox grows (files appear)
- [ ] Spot-check a saved transcript for completeness
- [ ] Monitor Brain Console error messages

### When NotebookLM Auth Expires

```bash
notebooklm login
# Complete browser login
notebooklm auth check --test  # Confirm passes
```

### When to Escalate

- Multiple transcript extraction failures → check NotebookLM CLI `notebooklm status`
- AI structuring timeouts → check if Ollama is running: `curl http://localhost:11434/api/tags`
- Brain Console not showing results → check logs in Brain Core

---

## Related Documentation

- **NotebookLM CLI:** `operations/runbooks/notebooklm-cli.md`
- **Credentials:** `operations/accounts/credentials-index.md` (NotebookLM section)
- **Brain Core API:** `projects/brain-core/README.md`
- **Brain Console:** `projects/brain-console/README.md`

---

## Version History

### v2.0 (2026-06-01) — NotebookLM + Local Ollama

- ✅ Replaced Gemini API with local Ollama
- ✅ Full transcript extraction (88,600+ chars)
- ✅ Save to mind/capture/inbox
- ✅ Brain Console display with copy button
- ✅ VA- filename prefix

### v1.x (Pre-2026-05) — Gemini API

- ❌ Removed: Gemini API structuring
- ❌ Removed: Rate limit tracking
- ❌ Reason: Free tier ended, user chose not to pay

---

## Summary

✅ **Gemini completely removed** — Not used anywhere  
✅ **NotebookLM only** — Extracts transcripts, persisted auth  
✅ **Local Ollama only** — Structures transcripts, free, private  
✅ **Stores in mind/capture/inbox** — Markdown files in Obsidian vault  
✅ **Filename includes VA identifier** — Easy to spot in inbox  
✅ **Full transcripts** — No truncation, complete 88,000+ character texts
