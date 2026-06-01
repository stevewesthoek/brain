# Plan: Replace Gemini Video Analyzer with NotebookLM + Local AI

## Context

The video analyzer used Gemini's native YouTube URL ingestion, which was disabled when the free trial ended (10 Apr 2026). The new pipeline replaces it with NotebookLM CLI (native YouTube URL support, no download needed) for transcript extraction, plus a local Ollama model via AI Model Selector (`local_only: true`) to structure the raw transcript into the JSON Brain Console already consumes.

The mode radio buttons ("Video" / "Transcript only") are removed — they were rendered but never wired to the API anyway. The new flow is: paste URL → click Process → TRANSCRIPTION section auto-opens with transcript → click "copy".

---

## Architecture

```
Brain Console UI (view.ts)
  → POST /research/video-analyze {url, focus?}   (routes.ts — unchanged)
    → analyze.py (full rewrite)
        1. notebooklm auth check --test   (fail fast with clear error)
        2. Get/create notebook via state file (~/.local/brain/state/notebooklm-video-analyzer.json)
        3. notebooklm source add <url> --json  → source_id
        4. notebooklm source wait <source_id> --timeout 300
        5. notebooklm source fulltext <source_id>  → raw transcript text
        6. notebooklm source remove <source_id>   (cleanup)
        7. POST to AI Model Selector (local_only=true, task_type="text/medium") → Ollama
           → structured JSON: title, channel, human_summary, ai_summary
        8. Return {ok, transcript, title, channel, human_summary, ai_summary}
```

---

## Files to Change

### 1. `projects/brain-core/services/video-analyzer/analyze.py` — full rewrite

Remove all Gemini/rate-limit code. Shebang stays: `#!/Users/Office/.local/video-orchestrator/venv/bin/python3`

**Imports**: `subprocess`, `json`, `os`, `sys`, `re`, `time`, `argparse`, `requests`, `pathlib`

**Auth check**:
```python
result = subprocess.run(['notebooklm', 'auth', 'check', '--test'], capture_output=True, text=True)
if result.returncode != 0:
    return {"ok": False, "error": "NotebookLM auth expired — run: notebooklm login", "step": "auth"}
```

**Notebook state** — `STATE_FILE = Path.home() / '.local/brain/state/notebooklm-video-analyzer.json'`:
- If state file exists and has `notebook_id`, use `notebooklm use <id>`.
- If not, run `notebooklm create "Brain Video Analyzer" --json`, parse `id`, save to state file, then `notebooklm use <id>`.
- If `notebooklm use` fails, re-create the notebook (notebook was deleted externally).

**Source pipeline** — each step via `subprocess.run`, stderr captured for error messages:
```python
# Add
add_result = subprocess.run(['notebooklm', 'source', 'add', youtube_url, '--json'], ...)
source_id = json.loads(add_result.stdout)['id']

# Wait
subprocess.run(['notebooklm', 'source', 'wait', source_id, '--timeout', '300'], ...)

# Get fulltext
fulltext = subprocess.run(['notebooklm', 'source', 'fulltext', source_id], ...).stdout.strip()

# Cleanup (non-fatal if fails)
subprocess.run(['notebooklm', 'source', 'remove', source_id], ...)
```

**AI structuring** — POST to `http://127.0.0.1:4890/select` with `local_only: true, task_type: "text/medium"`, then call `base_url/chat/completions`:

```
Prompt:
Analyze this video transcript. Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "title": "video title (infer from content if not stated)",
  "channel": "speaker or channel name, or null",
  "human_summary": "3-5 sentence prose summary of main points",
  "ai_summary": {
    "topic": "one-line topic description",
    "speaker": "string or null",
    "key_claims": ["up to 5 short claim strings"],
    "evidence_type": "anecdotal|empirical|opinion|tutorial|news|other",
    "confidence": "high|medium|low",
    "research_hooks": ["up to 4 short research angle strings"]
  }
}
[FOCUS: {focus}]   ← only appended if focus was provided
TRANSCRIPT:
{transcript[:12000]}   ← truncate for local model context window
```

Strip markdown fences from model response before `json.loads`. If AI selector is unavailable or structuring fails → return `{ok: true, transcript: fulltext, title: null, ...}` (transcript is returned regardless).

**CLI entry point** (`main()`):
- `argparse` with `url` positional + optional `--focus`
- No `--usage` flag (rate limit tracking removed)
- Errors printed as `json.dumps({"ok": False, "error": str(e), "step": "..."})` to stdout
- Success printed as `json.dumps(result)` to stdout

---

### 2. `projects/brain-console-obsidian/src/view.ts`

**Remove** the "Mode" row entirely inside `bcOrchBuildResearchDrawer` (~lines 2586–2610):
- Remove `const modeRow`, `modeVideoCb`, `modeTranscriptCb` variables and their DOM creation
- Remove the mode label and the two radio `<input>` elements

**Change** TRANSCRIPTION foldable section to open by default. In `bcOrchRenderResult` (~line 2927), the call to `bcOrchFoldableSection` for the transcript section currently passes `isOpen: false` — change to `isOpen: true`.

No other changes to view.ts.

---

### 3. `projects/brain-core/src/adapters/research-video.ts`

Simplify `VideoAnalysisResult` interface — remove Gemini/frame fields, ensure `transcript` is present:

```typescript
export interface VideoAnalysisResult {
  ok: boolean;
  title?: string;
  channel?: string;
  transcript?: string;
  human_summary?: string;
  ai_summary?: {
    topic?: string;
    speaker?: string | null;
    key_claims?: string[];
    evidence_type?: string;
    confidence?: string;
    research_hooks?: string[];
  };
  error?: string;
  step?: string;
}
```

Remove: `video_id`, `duration_seconds`, `frame_count`, `frames_analyzed`, `frames_escalated`, `chapters`, `frame_analyses`.

---

### 4. `projects/brain-console-obsidian/src/client.ts`

Update `BrainCoreVideoAnalysisResult` interface to match above shape. The `analyzeYouTubeVideo()` function itself is unchanged.

---

### 5. `projects/brain-core/src/api/routes.ts`

**No changes.** The endpoint already accepts `{url, focus}`, spawns analyze.py with the correct args, parses stdout JSON, and returns it. Timeout is already 1,800,000 ms (30 min).

---

## Build & Deploy

```bash
# Rebuild Brain Console (view.ts + client.ts changed)
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian
npm run build && npm run package && npm run install:active-vault
pkill -x "Obsidian" && sleep 2 && open -a Obsidian

# Restart Brain Core (analyze.py changed — process restart needed to pick up Python changes)
# Brain Core restarts take effect immediately since analyze.py is spawned fresh each call —
# no restart needed for Brain Core itself, only for the UI plugin.
```

---

## Pre-flight requirement

Before first use, user must run once (auth persists after):
```bash
notebooklm login
notebooklm auth check --test   # confirm exit 0
```

The analyzer returns a clear JSON error if auth is expired: `"error": "NotebookLM auth expired — run: notebooklm login"`.

---

## Verification

1. `notebooklm auth check --test` → exit 0
2. Run manually: `python3 /Users/Office/Repos/stevewesthoek/brain/projects/brain-core/services/video-analyzer/analyze.py https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Should print JSON with `"ok": true` and non-empty `"transcript"`
3. Open Brain Console → Research Orchestrator drawer → confirm no mode radio buttons
4. Paste a YouTube URL → click Process → TRANSCRIPTION section opens automatically
5. Click "copy" in TRANSCRIPTION header → clipboard contains raw transcript text
6. AI SUMMARY section shows structured fields from local Ollama
