# Graphify Operating Standard

Graphify uses the stock upstream CLI. No Brain wrappers. No AI Model Selector. No paid API.

## Canonical scheduler

The canonical scheduler is the **Office Nightly Scheduler**.

All recurring automation jobs belong in the Office Nightly Scheduler. Do not create separate LaunchAgents, cron jobs, or standalone schedulers for Graphify.

Every new recurring automation job must be added to the Office Nightly Scheduler job chain. The Office Nightly Scheduler is the single central scheduler for job ordering, machine-load control, status reporting, and Brain Console visibility.

Graphify is one job inside the Office Nightly Scheduler:

```text
Scheduler: Office Nightly Scheduler
Scheduler script: tools/scripts/office-nightly-scheduler.sh
Scheduler LaunchAgent: operations/system-configs/launchagents/com.office.nightly-scheduler.plist
Dashboard: Brain Console
Job label: Graphify Nightly
Job id: graphify-nightly
Job implementation: tools/scripts/graphify-nightly.sh
```

ProBot is deprecated and must not be used for scheduler ownership or dashboard wiring.

## Default Graphify operating model

Graphify is an automatic, nightly, phased refinement system for every Git repo under `/Users/Office/Repos`.

The standard is fast-first, then deeper every night:

1. **Pass 1 — fast code/config graph**: skip docs, papers, images, office files, audio/video, and deep mode, but keep community labels so the graph is immediately human-readable. Pass 1 is atomic: it lets `graphify extract` produce `graph.json`, `GRAPH_REPORT.md`, and `graph.html` in one flow instead of running a separate `cluster-only` step that can create graph.json node-count drift.
2. **Pass 2 — docs/Markdown refinement**: add Markdown/docs while still skipping papers, images, office files, and media.
3. **Pass 3 — papers/images/office refinement**: add PDFs, images, and office files while still skipping audio/video.
4. **Pass 4 — deep refinement**: run the broadest/deepest refinement pass.

The Office Nightly Scheduler calls `tools/scripts/graphify-nightly.sh`, and that script iterates phases `1 2 3 4` for existing repos and newly discovered repos. New repos get a fast usable graph first, then progressively richer graphs on later passes. Generated outputs are never committed.

## Fixed backend

| Setting | Value |
|---------|-------|
| Backend | `ollama` (local — no paid API) |
| Model | `gemma4:12b-mlx` |
| Ollama context | `8192` |
| Concurrency | `1` |
| API timeout | `900` seconds |
| HTML node limit | `30000` |
| Repo roots | `/Users/Office/Repos` |

No paid API is used. No Bedrock, no Sonnet, no Opus, no Anthropic cloud model.

## Automatic nightly execution

Install, repair, or inspect the central Office Nightly Scheduler only. Do not install a separate Graphify LaunchAgent.

Verify the central scheduler LaunchAgent:

```bash
launchctl print gui/$(id -u) | grep -i office.nightly || true
ls -lah ~/Library/LaunchAgents | grep -i office.nightly || true
grep -R "office-nightly-scheduler.sh" ~/Library/LaunchAgents /Library/LaunchAgents 2>/dev/null || true
```

Verify the Graphify job is registered in Brain Console data:

```bash
grep -R "graphify-nightly" \
  projects/brain-core/src/adapters \
  tools/scripts/office-nightly-scheduler.sh \
  tools/scripts/render-office-scheduler-report.sh
```

Run the central scheduler manually when needed:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
tools/scripts/office-nightly-scheduler.sh
```

Run only the Graphify job manually when debugging:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
GRAPHIFY_PHASES="1 2 3 4" tools/scripts/graphify-nightly.sh
```

## Output

Every successful pass should leave these usable outputs in the target repo:

```text
graphify-out/graph.json                 — queryable graph data
graphify-out/.graphify_analysis.json    — raw analysis data
graphify-out/GRAPH_REPORT.md            — cluster/community report
graphify-out/graph.html                 — interactive visualization, generated when `GRAPHIFY_VIZ_NODE_LIMIT` is high enough
```

`graphify-out/` is generated output. Do not commit it.

## Scan scoping

The Graphify job writes a managed `.graphifyignore` in each repo for the active phase. This is intentional. It makes every repo follow the same fast-first/refine-later policy automatically.

The base exclusions always remove generated output and runtime/build noise:

```text
.git/
node_modules/
**/node_modules/
graphify-out/
.graphify-out/
.ai/
.claude/
.local/
.gstack/
.pytest_cache/
__pycache__/
**/__pycache__/
.next/
dist/
build/
coverage/
*.tsbuildinfo
.DS_Store
**/.DS_Store
.wrangler/
**/.wrangler/
```

## Reliability rules

- Do not actively edit a repo while Graphify is scanning that same repo.
- Commit or stash work before a clean graph run when possible.
- The Office Nightly Scheduler is the only scheduler owner.
- The Graphify job refuses non-Ollama backends.
- The Graphify job keeps `max-concurrency=1` for local model stability.
- Passes 1–3 skip labels to finish quickly and reliably.
- Pass 4 is the only deep/label-oriented refinement pass.
- The Office Nightly Scheduler controls ordering so local machine load stays bounded.
