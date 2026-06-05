# Graphify Nightly — Codebase Knowledge Graph Maintenance

**Purpose:** Automatically maintain semantic knowledge graphs for all repositories in `/Users/Office/Repos/` during the nightly maintenance window (1 AM - 7 AM Lisbon time).

**Status:** Active  
**Last updated:** 2026-06-05  
**Coordinator:** office-nightly-scheduler.sh

---

## Architecture

Graphify nightly is **integrated into the office scheduler's sequential task chain**, not a standalone automation.

```
office-nightly-scheduler (runs daily at 3:00 AM Lisbon)
  ├─ stb-pipeline-batch
  ├─ n8n-backup
  ├─ claude-session-cleanup
  ├─ dance-of-life-sync
  ├─ bible-studies-pipeline
  ├─ [lightweight reports/cleanup]
  ├─ run_graphify_nightly ← Position 11 in chain
  ├─ ing-bank-statement-download (1st of month)
  └─ skill-prune (7th of month)
```

**Key principle:** One task executes at a time. No concurrent resource contention.

---

## Time Window & Cutoff Logic

| Parameter | Value | Meaning |
|-----------|-------|---------|
| **Scheduler window** | 1:00 AM - 7:00 AM (Lisbon) | Available time for graphify work |
| **Launch time** | 3:00 AM (Lisbon) | When `office-nightly-scheduler.sh` starts |
| **Cutoff hour** | 7 AM (Lisbon) | Stop starting NEW repos; finish in-progress tasks |
| **Config** | `SCHEDULER_CUTOFF_HOUR` | Default: 7; override via environment |

**Logic:**
- Before 7 AM: process repos (updates + new extractions)
- At 7 AM: stop starting new repos, but complete the current one
- After 7 AM: no new graphify tasks start (other jobs continue as scheduled)

---

## Repository Processing

### Discovery
- Scans `/Users/Office/Repos/` recursively (max depth 3)
- Finds all `.git` directories and sorts uniquely
- Processes in alphabetical order

### Per-Repository Decision

```bash
if repo_has_graph.json:
  action = UPDATE (no LLM, fast, free)
else:
  action = EXTRACT (LLM required, slower, local-only via selector)
```

**Updates** — Re-scan code files for changes, rebuild AST + clustering, update graph.json (no semantic extraction cost).

**Extractions** — First-time graph creation. Routes through AI Model Selector with `local_only=true` to ensure Ollama is used.

### AI Model Selection

All graphify tasks route through the **AI Model Selector** at `http://127.0.0.1:4890`:

```json
POST /select
{
  "task_type": "codebase_semantic_graph",
  "input_token_count": 50000,
  "urgent": true,
  "local_only": true
}
```

**Response:**
```json
{
  "provider_id": "ollama-m4pro",
  "model": "qwen2.5:14b",
  "base_url": "http://localhost:11434/v1",
  "reason": "free; local; priority=2",
  "timeout_inference_sec": 120
}
```

**Local resource policy** (enforced by selector):
- `qwen2.5:32b` — Selected only when memory pressure >= 60% free and load/CPU <= 0.75
- `qwen2.5:14b` — Fallback; requires memory pressure >= 30% free
- If no model passes resource gates → deferred to next batch window

---

## Outcome Reporting

After each repo operation, graphify reports to the selector:

```bash
POST /report-success
{
  "provider_id": "ollama-m4pro",
  "model": "qwen2.5:14b"
}
```

Or on failure:

```bash
POST /report-failure
{
  "provider_id": "ollama-m4pro",
  "model": "qwen2.5:14b",
  "error_type": "graphify_failed",
  "error_message": "graphify extract exited 1"
}
```

The selector uses this feedback to learn model performance and inform future selections.

---

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GRAPHIFY_REPO_ROOTS` | `/Users/Office/Repos` | Where to discover repos |
| `GRAPHIFY_SELECTOR_TASK_TYPE` | `codebase_semantic_graph` | Task type for selector |
| `AI_SELECTOR_URL` | `http://127.0.0.1:4890` | AI Model Selector endpoint |
| `REPO_TIMEOUT_SECONDS` | 7200 (2 hours) | Max time per repo operation |
| `GRAPHIFY_BIN` | `graphify` | Path to graphify CLI |
| `SCHEDULER_CUTOFF_HOUR` | 7 | Stop starting new repos at this hour (Lisbon) |

### Example Override

```bash
# Run graphify with earlier cutoff (e.g., for testing)
SCHEDULER_CUTOFF_HOUR=6 /Users/Office/Repos/stevewesthoek/brain/tools/scripts/graphify-nightly.sh
```

---

## Execution Flow

```
START graphify-nightly.sh
  ├─ Verify graphify binary is available
  ├─ Create state directory
  ├─ Discover all repos in REPO_ROOTS
  │
  └─ FOR each repo (sorted):
      ├─ Check time boundary (cutoff check)
      │   └─ If hour >= SCHEDULER_CUTOFF_HOUR: skip all remaining repos
      │
      ├─ IF repo/graphify-out/graph.json EXISTS:
      │   ├─ Run: graphify update <repo>
      │   ├─ Report: /report-success
      │   └─ Counter: updates++
      │
      ├─ ELSE (no existing graph):
      │   ├─ Estimate tokens in repo
      │   ├─ Query AI Selector with local_only=true
      │   ├─ If selector returns deferred → skip (no local model available)
      │   ├─ If selector returns model → extract with that model
      │   ├─ Report: /report-success or /report-failure
      │   ├─ Unload Ollama model (free memory)
      │   └─ Counter: first_builds++ or failed++
      │
      └─ Log: repo state + outcome
  
  Log summary: first_builds, updates, skipped, failed
  Exit code: 0 if no failures; 1 if any failed
END
```

---

## Monitoring & Debugging

### Log Location
```bash
tail -f ~/Library/Logs/office-scheduler/graphify-nightly.log
```

### State Files
```bash
ls -la ~/.local/state/office-scheduler/graphify-nightly/
```

### Check Specific Repo Status

```bash
# After a run, check if graph exists
ls -lh /Users/Office/Repos/<repo>/graphify-out/graph.json

# View graph report
head -100 /Users/Office/Repos/<repo>/graphify-out/GRAPH_REPORT.md

# View graph size
du -sh /Users/Office/Repos/<repo>/graphify-out/
```

### Verify Selector Health

```bash
# Check AI Model Selector is running
curl -s http://127.0.0.1:4890/health | jq '.status'

# Check available models for graphify task
curl -s -X POST http://127.0.0.1:4890/select \
  -H 'Content-Type: application/json' \
  -d '{"task_type":"codebase_semantic_graph","input_token_count":50000,"urgent":true,"local_only":true}' \
  | jq '{provider_id, model, base_url}'
```

---

## Dry Run & Testing

### Test Time Boundary Logic

```bash
# Override cutoff to test early exit
SCHEDULER_CUTOFF_HOUR=2 \
  /Users/Office/Repos/stevewesthoek/brain/tools/scripts/graphify-nightly.sh
```

### Test Single Repo

```bash
# Manually extract one repo with explicit model
cd /Users/Office/Repos/prochattools/saas/fala
OLLAMA_API_KEY=local graphify extract . \
  --backend ollama \
  --model qwen2.5:14b \
  --out .
```

### Dry Run with FORCE_RUN

```bash
# Run the full scheduler in test mode (ignore time checks, run once)
FORCE_RUN=1 /Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh
```

---

## Scheduling & Integration

### LaunchAgent Configuration

Graphify does NOT have its own LaunchAgent. It runs **only** as part of `office-nightly-scheduler`:

**Service:** `com.office.nightly-scheduler`  
**Launch:** Daily at 3:00 AM (Lisbon)  
**Config:** `~/Library/LaunchAgents/com.office.nightly-scheduler.plist`  
**Script:** `tools/scripts/office-nightly-scheduler.sh`

### Position in Scheduler Chain

Graphify runs **after lightweight maintenance tasks** (line 579 in office-nightly-scheduler.sh):

1. Heavy tasks (STB, n8n, cleanup) — stop-chain on timeout
2. Medium tasks (dance-of-life, bible-studies) — continue on failure
3. Lightweight reports (Gemini, Ads, GWS, Mind, reports)
4. **Graphify nightly** ← HERE
5. Monthly-only tasks (ING, skill-prune)

This ordering ensures:
- ✅ System cleanup completes before graphify starts
- ✅ Graphify gets most of the 1 AM - 7 AM window
- ✅ Monthly tasks run after graphify if time permits

---

## Known Limitations & Notes

1. **Ollama model selection** — Controlled entirely by AI Model Selector resource gating. Graphify does not choose models; it receives a selection.

2. **No manual per-repo ordering** — All repos process in alphabetical order. Use GRAPHIFY_REPO_ROOTS to change source directory.

3. **One task at a time** — Sequential execution via office-nightly-scheduler. No parallelization.

4. **Time boundary is soft** — A repo extraction in progress at 7 AM will complete. Only NEW repos are blocked.

5. **Large repos** — May take most of the available window. Very large repos may not complete before 7 AM cutoff.

6. **State persistence** — No tracking of which repos were processed. The scheduler runs daily regardless. Use `graphify update` (fast) for already-graphified repos.

---

## Troubleshooting

### "graphify unavailable path=graphify"
**Cause:** graphify binary not in PATH  
**Fix:** Verify `~/.local/bin/graphify` exists and is in the scheduler's PATH (see launchd plist)

### "no safe local model cached"
**Cause:** AI Selector returned no available Ollama model  
**Fix:** Check Ollama is running (`ollama list`) and models are loaded; verify selector health

### Task takes >2 hours
**Cause:** Large repo or slow machine  
**Fix:** Increase `REPO_TIMEOUT_SECONDS` or break repo into smaller pieces; increase available memory

### Graphs not updating
**Cause:** Graphs may be stale if code hasn't changed  
**Fix:** Use `graphify update --force` to rebuild regardless; this is automatic on stale commits

---

## Related Documentation

- **AI Model Selector:** `operations/system-configs/model-selector/README.md`
- **Office Nightly Scheduler:** `operations/runbooks/office-nightly-scheduler.md` (create if needed)
- **Graphify CLI:** https://github.com/anthropics/graphify
- **Task Types:** `operations/system-configs/model-selector/config/ai-task-types.json`
