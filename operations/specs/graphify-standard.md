# Graphify Operating Standard

Graphify uses the stock upstream CLI. No Brain wrappers. No AI Model Selector. No paid API.

## Default operating model

Graphify is an automatic, nightly, phased refinement system for every Git repo under `/Users/Office/Repos`.

The standard is fast-first, then deeper every night:

1. **Pass 1 — fast code/config graph**: skip docs, papers, images, office files, audio/video, deep mode, and labels. Always produce usable `graph.json`, `GRAPH_REPORT.md`, and `graph.html` as quickly as possible.
2. **Pass 2 — docs/Markdown refinement**: add Markdown/docs while still skipping papers, images, office files, and media.
3. **Pass 3 — papers/images/office refinement**: add PDFs, images, and office files while still skipping audio/video.
4. **Pass 4 — deep refinement**: run the broadest/deepest refinement pass.

The scheduler iterates phases `1 2 3 4` for existing repos and newly discovered repos. New repos get a fast usable graph first, then progressively richer graphs on later passes. Generated outputs are never committed.

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

## Automatic nightly scheduler

Install or repair the automatic scheduler from the Brain repo:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
chmod +x tools/scripts/graphify-nightly.sh tools/scripts/install-graphify-nightly-launch-agent.sh
tools/scripts/install-graphify-nightly-launch-agent.sh
```

The installer creates a user LaunchAgent:

```text
~/Library/LaunchAgents/com.office.graphify-nightly.plist
```

It runs daily at `01:15` local time by default and calls:

```text
/Users/Office/Repos/stevewesthoek/brain/tools/scripts/graphify-nightly.sh
```

Logs are written to:

```text
~/Library/Logs/graphify-nightly/stdout.log
~/Library/Logs/graphify-nightly/stderr.log
```

Verify automatic scheduling:

```bash
launchctl print gui/$(id -u)/com.office.graphify-nightly
launchctl print gui/$(id -u) | grep -i graphify || true
grep -R "graphify-nightly.sh" ~/Library/LaunchAgents /Library/LaunchAgents 2>/dev/null || true
```

## Manual commands

Manual commands should follow the same fast-first standard. For a repo that needs an immediate usable graph, use Pass 1 first.

```bash
cd /path/to/repo
GRAPHIFY_PHASES=1 /Users/Office/Repos/stevewesthoek/brain/tools/scripts/graphify-nightly.sh
```

For a full local refinement cycle across all repos:

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

The scheduler writes a managed `.graphifyignore` in each repo for the active phase. This is intentional. It makes every repo follow the same fast-first/refine-later policy automatically.

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
- The scheduler refuses non-Ollama backends.
- The scheduler keeps `max-concurrency=1` for local model stability.
- Passes 1–3 skip labels to finish quickly and reliably.
- Pass 4 is the only deep/label-oriented refinement pass.
- The scheduler stops starting new work after the cutoff hour but finishes any in-progress repo.
