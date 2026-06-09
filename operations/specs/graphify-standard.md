# Graphify Operating Standard

Graphify uses the stock upstream CLI. No Brain wrappers. No AI Model Selector. No paid API.

## Fixed backend

| Setting | Value |
|---------|-------|
| Backend | `ollama` (local — no paid API) |
| Model | `gemma4:12b-mlx` |
| Token budget | `4000` |
| Ollama context | `8192` |
| Concurrency | `1` |
| API timeout | `900` seconds |

No paid API is used. No Bedrock, no Sonnet, no Opus, no Anthropic cloud model.

## Prerequisites

```bash
ollama pull gemma4:12b-mlx
ollama list | grep gemma4
ollama run gemma4:12b-mlx "Reply with OK only."
graphify --help
```

Ollama must be running locally before any Graphify command.

## Commands

```bash
# Brain knowledge graph, report, and HTML
npm run graphify:brain

# Mind knowledge graph, report, and HTML
npm run graphify:mind

# Callflow exports (after graph.json exists)
npm run graphify:brain:callflow
npm run graphify:mind:callflow
```

The graph scripts run `graphify extract` and then `graphify cluster-only` so `GRAPH_REPORT.md` and `graph.html` are produced alongside `graph.json`.

## Output

```
graphify-out/graph.json                 — queryable graph data
graphify-out/.graphify_analysis.json    — raw analysis data
graphify-out/GRAPH_REPORT.md            — cluster/community report
graphify-out/graph.html                 — interactive visualization
```

`graphify-out/` is generated output. Do not commit it.

## Scan scoping

Graphify reads `.graphifyignore` at the repo root (gitignore syntax). This is the only scan scope control.

## Nightly scheduler

`tools/scripts/graphify-nightly.sh` runs during off-hours (before 07:00 Lisbon):
- First build: runs `graphify extract <repo> --backend ollama --token-budget 4000 --max-concurrency 1 --api-timeout 900`, then `graphify cluster-only <repo> --backend ollama` when `graphify-out/graph.json` is missing
- Refresh: same extract + cluster-only command pair when `graphify-out/graph.json` already exists
- Uses only Ollama with `gemma4:12b-mlx` — no paid API, no Bedrock, no AI Model Selector
- Refuses any non-Ollama backend
- Logs: repo path, model, backend, token budget, concurrency, timeout, graph.json presence, exit code, output file presence
- Does not commit generated outputs
- Fails clearly if Ollama or graphify is missing
