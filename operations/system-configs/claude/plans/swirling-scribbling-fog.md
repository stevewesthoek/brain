# Plan: Remove Gemini, Reconnect Decomposer + Video Analyzer to Local Model Selector

## Context

The Gemini API free trial ended on 10 April 2026. The account is now on a paid plan with no credits.
The user has decided: **Gemini will never be used again.** Every service that calls Gemini must either
switch to a local model via the AI Model Selector, or be disabled. In addition two existing bugs must
be fixed: (1) the project-decomposer cron has been stuck retrying a failed Gemini call every 15
minutes since April 17, and (2) the AI Model Selector HTTP service does not yet accept a
`local_only` flag, which means callers cannot force local-only selection without touching core.py.

---

## Phase 1 — IMMEDIATE: Disable cron & fix selector HTTP API (no API calls, no money burned)

### 1a. Add `local_only` to selector_service.py POST /select

`selector_service.py` currently only reads `task_type`, `input_token_count`, `urgent`,
`previous_failures` from the POST body. It does NOT forward `task_metadata` to `core.py`.

**Change:** Add `local_only` boolean field to the POST body. If `true`, construct
`TaskMetadata(external_provider_disallowed=True, offline=True)` and pass it to `_selector.select()`.
This will skip Gemini and any future external provider, leaving only Ollama providers.

File: `operations/system-configs/model-selector/runtime/selector_service.py`
- Lines 93-104: add `local_only = bool(body.get("local_only", False))`
- Construct `task_metadata = TaskMetadata(external_provider_disallowed=True, offline=True) if local_only else TaskMetadata()`
- Pass to `_selector.select(task_type=..., task_metadata=task_metadata, ...)`

Also add `TaskMetadata` import from `core`.

### 1b. Fix cron entry while we work (comment it out immediately)

Remove from crontab:
```
*/15 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```
This stops the bleeding. The proper cron is re-added at the end of Phase 1 after the script is fixed.

---

## Phase 2 — Fix mind-project-decomposer.py (robust, local-only, never stuck)

### Problems to fix

1. **Gemini dependency** — calls `/opt/homebrew/bin/gemini` binary via subprocess. Replace with HTTP
   call to AI Model Selector (`http://127.0.0.1:4890`) with `local_only: true`.
2. **Stuck on one project** — once a project causes repeated failures, the cron retries forever
   because status is only updated on SUCCESS (after commit). If Gemini fails, the project stays
   `status: ready-for-review` and is picked up every run. Fix: after N failures, mark the project
   as `status: decompose-failed` so it is skipped on future runs.
3. **Push/rebase collision** — two overlapping cron instances can fight over git. Fix: use a lockfile
   (`~/.local/brain/locks/decomposer.lock`). If the lock is held, exit immediately (skip silently).
4. **Local git reads stale data** — `git show main:path` reads the LOCAL main branch, which may
   lag origin. Fix: add a `git fetch --quiet` at start of run to sync before scanning.
5. **No exit code on total failure** — any uncaught exception at module level hangs. Fix: wrap
   `main()` in try/except with `sys.exit(1)` on error.

### New LLM call design

Replace the `decompose_with_gemini()` function with `decompose_with_local_model()`:

```python
def decompose_with_local_model(content: str) -> Optional[Dict]:
    # 1. POST to AI Model Selector to get a local provider
    selector_url = os.environ.get("AI_SELECTOR_URL", "http://127.0.0.1:4890")
    sel_resp = requests.post(f"{selector_url}/select", json={
        "task_type": "text/small",
        "local_only": True,
        "input_token_count": len(prompt) // 4
    }, timeout=5)
    if not sel_resp.ok:
        raise RuntimeError(f"Selector unavailable: {sel_resp.status_code}")
    sel = sel_resp.json()
    if sel.get("deferred"):
        raise RuntimeError("Local model deferred — no local provider available")
    base_url = sel["base_url"]           # e.g. http://localhost:11434/v1
    model    = sel["model"]              # e.g. qwen2.5:14b

    # 2. Call the local model via OpenAI-compatible API
    response = requests.post(f"{base_url}/chat/completions", json={
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    }, timeout=sel.get("timeout_inference_sec", 120))
    ...
```

The `requests` library is used (already available in the venv or stdlib). No new dependencies.

### Failure tracking (never-stuck fix)

Add a failure state file at `~/.local/brain/state/decomposer-failures.json`:
```json
{ "projects/03-projects/foo.md": 3 }
```

- Before calling the LLM: check if failure count >= `MAX_FAILURES` (3). If so, update project
  frontmatter to `status: decompose-failed`, commit, and skip.
- After a failed LLM call: increment failure count, save, continue to next project.
- After a successful commit: remove project from failure tracking.

### Cron re-entry

After the script is fixed, add back:
```
*/15 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
```

The script now exits in under 5 seconds if there's nothing to do (just a git fetch + scan).

---

## Phase 3 — Video Analyzer: disable with clear message (local models can't do YouTube)

The video analyzer uses Gemini's native YouTube URL ingestion. Local Ollama models CANNOT accept
a YouTube URL as input — you would need to download the video (yt-dlp), extract frames/audio,
and build a separate pipeline. The prior local pipeline (Qwen2.5-VL + MLX Whisper) took 14 min
for an 8-min video and was abandoned for this reason.

**Decision: Disable the video analyzer gracefully.**

`analyze.py` change: Replace the entire Gemini client setup and API calls at the top of
`analyze_video()` with an early exit:

```python
raise RuntimeError(
    "Video analysis is disabled: Gemini API is no longer available (free trial expired).\n"
    "To re-enable: set up a paid Gemini API key, or implement a local pipeline using\n"
    "yt-dlp (download) + local Whisper model (transcription)."
)
```

This way Brain Console shows a clean error instead of a confusing quota error.

Update Brain Core routes.ts to surface this error message to the UI.

---

## Phase 4 — Remove Gemini from Model Selector

### 4a. ai-providers.json — remove gemini-free entry
File: `operations/system-configs/model-selector/config/ai-providers.json`
- Remove the entire `gemini-free` object (first entry in the array).

### 4b. core.py — remove dead Gemini code
File: `operations/system-configs/model-selector/runtime/core.py`
- Remove `_check_gemini_health()` method
- Remove `_gemini_quota_reserve()`, `_gemini_quota_exhausted()`, `_gemini_quota_load/save()` methods
- Remove Gemini-specific branch in `select()` (the `if ptype == "gemini":` block and privacy gate)
- Remove `GEMINI_QUOTA_STATE_PATH` constant and related state file references
- Keep `TaskMetadata` dataclass as-is (it's now used by the new `local_only` feature)

### 4c. tests — remove/update
- Delete `tests/test_model_selector_gemini.py` entirely
- Update `tests/test_model_selector_fallback_ladder.py`: remove the step that expects Gemini to be
  tried first; the new ladder should be: local → Bedrock → Codex → defer

### 4d. Restart model selector service
```bash
launchctl kickstart -k gui/$(id -u)/com.office.ai-model-selector
```

---

## Phase 5 — Remove Gemini card from Brain Console

### Files
- `projects/brain-console-obsidian/src/view.ts` — remove Gemini card HTML block and
  `readGeminiUsage()` call
- `projects/brain-console-obsidian/src/client.ts` — remove `readGeminiUsage()` / `getGeminiQuota()`
  methods
- `projects/brain-core/src/adapters/system-metrics.ts` — remove `geminiQuota` field from metrics
- `projects/brain-core/src/types/api.ts` — remove `GeminiMetrics` type
- After changes: rebuild brain-console-obsidian (`npm run build`) and restart brain-core service

---

## Phase 6 — Low-impact cleanup

### repos.sh
- Remove `Gemini` from the `fzf` tool-picker menu
- Remove `elif [[ "$tool" == "Gemini" ]]; then exec gemini` dispatch branch

### sessions.sh
- Remove `list_gemini_sessions()` function (lines 216-270 approx)
- Remove `Gemini` from the fzf tool-picker menu (line 329)
- Remove Gemini session-resume dispatch branch (lines 375-391 approx)

### Documentation files — delete entirely
```
operations/runbooks/gemini-quota-management.md
operations/runbooks/gemini-preprocessing-hook.md
ai/skills/custom/gemini/SKILL.md  (+ remove active/ symlink)
operations/accounts/gemini-quota-audit-2026-05-30.md
operations/accounts/gemini-polling-audit-2026-05-30-REAL.md
operations/accounts/gemini-polling-solution-2026-05-30.md
operations/accounts/GEMINI-QUOTA-QUICK-REF.md
operations/system-configs/claude/hooks/gemini-preprocess-hook.sh
tools/gemini-review.sh
```

### Documentation files — update to remove Gemini references
- `ai/policy/routing.md` — remove Gemini row from routing table
- `CLAUDE.md` — remove `/gemini` from available skills list; remove Gemini from routing table
- `operations/runbooks/research-orchestrator.md` — remove "Gemini preprocessing" step
- `operations/runbooks/model-tracking-reference.md` — remove Gemini entries

### settings.json hooks
- `operations/system-configs/claude/settings.json` — check for gemini-preprocess-hook references;
  remove any hook that calls `gemini-preprocess-hook.sh`

### Gemini CLI config directory — DO NOT DELETE yet
Keep `operations/system-configs/gemini/` for now: it is symlinked to `~/.gemini` and deleting it
could break other references. Defer this to a separate cleanup after verifying nothing reads it.

---

## Phase 7 — Disable cron decomposer cron for project-decomposer log cleanup

Clear the stale error log (19,849 lines, all from the same stuck project):
```bash
> ~/.local/share/brain/logs/project-decomposer-error.log
> ~/.local/share/brain/logs/project-decomposer.log
```

Also fix the stuck project in the mind repo — set its frontmatter `status: decompose-failed` so
the new script doesn't try it and fail:
- Project: `03-projects/AI Cost Router — Product Strategy & Market Analysis.md`
- Change: `status: ready-for-review` → `status: decompose-failed`

---

## Verification

1. **Model Selector local_only:** `curl -s -X POST http://127.0.0.1:4890/select -H 'Content-Type: application/json' -d '{"task_type":"text/small","local_only":true}'` — should return Ollama provider, never gemini-free.
2. **Decomposer:** Run script manually: `python3 ~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py` — should exit cleanly in < 5s with "No project files ready".
3. **Video Analyzer:** Trigger a video analysis from Brain Console — should show a clear disabled message, not a quota error.
4. **Gemini grep:** `grep -r "gemini-free\|GEMINI_API_KEY\|genai.Client" ~/Repos/stevewesthoek/brain --include="*.py" --include="*.ts" --include="*.sh" --exclude-dir=node_modules --exclude-dir=.claude` — should return nothing except historical logs and n8n backups.
5. **Model selector tests:** `cd operations/system-configs/model-selector && python -m pytest tests/ -q` — all pass, no Gemini tests remain.
6. **Brain Console:** Open console and confirm no Gemini card visible.
