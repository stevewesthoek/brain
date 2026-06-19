# Graphify Tools

Brain-owned Graphify scripts and docs live here.

Graphify uses the stock upstream CLI directly. No Brain wrappers, no AI Model Selector.

## Fixed configuration

| Setting | Value |
|---------|-------|
| Backend | `openai` (MTPLX local — no paid API) |
| Model | `Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed` |
| Endpoint | `http://127.0.0.1:8000/v1` |
| Token budget | `4000` |
| Concurrency | `1` |
| API timeout | `900` seconds |

No paid API is used. No Bedrock, no Sonnet, no Opus, no Anthropic cloud model.

## Prerequisites

```bash
curl http://127.0.0.1:8000/health
graphify --help
```

MTPLX must be running locally (LaunchAgent `com.office.mtplx`). It serves Qwen 3.6 27B with MTP acceleration.

## Standard commands

```bash
# Brain knowledge graph, report, and HTML
npm run graphify:brain

# Mind knowledge graph, report, and HTML
npm run graphify:mind

# Brain callflow export (requires graph.json)
npm run graphify:brain:callflow

# Mind callflow export (requires graph.json)
npm run graphify:mind:callflow
```

The Brain/Mind graph scripts run `graphify extract` and then `graphify cluster-only` with `GRAPHIFY_VIZ_NODE_LIMIT=30000` so the normal graph outputs, report, and HTML are created.

## Output

All output lands in `graphify-out/` at the repo root:

```
graphify-out/graph.json                   — queryable graph data
graphify-out/.graphify_analysis.json      — raw analysis data
graphify-out/GRAPH_REPORT.md              — community/report summary from cluster-only
graphify-out/graph.html                   — interactive visualization, generated when `GRAPHIFY_VIZ_NODE_LIMIT` is high enough
```

`graphify-out/` is generated output and must not be committed.

## Scan scoping: `.graphifyignore`

Graphify reads `.graphifyignore` at the repo root (gitignore syntax). This is the only scan scope control. No Brain wrapper adds extra filtering.

## Nightly scheduler

`tools/scripts/graphify-nightly.sh` iterates all repos under `~/Repos` during off-hours (before 07:00 Lisbon time):

- If `graphify-out/graph.json` does not exist: runs first graph generation (`graphify extract`) and report/HTML generation (`graphify cluster-only` with `GRAPHIFY_VIZ_NODE_LIMIT=30000`).
- If it exists: refreshes the graph with the same extract + cluster-only flow.
- Uses MTPLX with Qwen 3.6 27B (MTP-accelerated) — no paid API, no Bedrock, no Sonnet, no Opus, no Anthropic model IDs, no AI Model Selector.
- Refuses non-local backends to prevent accidental paid API usage.
- Logs repo path, model, backend, token budget, max concurrency, API timeout, graph.json presence before run, exit code, and output file presence.
- Does not commit generated outputs.
- Fails clearly if MTPLX or graphify is missing.
- Scheduler stops starting new repos after the cutoff hour but finishes any in-progress repo.
