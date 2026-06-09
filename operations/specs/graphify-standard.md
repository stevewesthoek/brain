# Graphify Operating Standard

Graphify uses the stock upstream CLI. No Brain wrappers. No AI Model Selector. No paid API.

## Fixed backend

| Setting | Value |
|---------|-------|
| Backend | `ollama` (local — no paid API) |
| Model | `gemma4:12b` |
| Token budget | `4000` |
| Ollama context | `8192` |
| Concurrency | `1` |
| API timeout | `900` seconds |

No paid API is used. No Bedrock, no Sonnet, no Opus, no Anthropic cloud model.

## Prerequisites

```bash
ollama pull gemma4:12b
ollama list | grep gemma4
graphify --help
```

Ollama must be running locally before any Graphify command.

## Commands

```bash
# Brain knowledge graph
npm run graphify:brain

# Mind knowledge graph
npm run graphify:mind

# Callflow exports (after graph.json exists)
npm run graphify:brain:callflow
npm run graphify:mind:callflow
```

## Output

```
graphify-out/graph.json                 — queryable graph data
graphify-out/.graphify_analysis.json    — raw analysis data
graphify-out/graph.html                 — interactive visualization (only when --no-viz is not passed)
```

`graphify-out/` is generated output. Do not commit it.

## Scan scoping

Graphify reads `.graphifyignore` at the repo root (gitignore syntax). This is the only scan scope control.

## Nightly scheduler

`tools/scripts/graphify-nightly.sh` runs during off-hours (before 07:00 Lisbon):
- First build: runs `graphify extract <repo> --backend ollama --token-budget 4000 --max-concurrency 1 --api-timeout 900` when `graphify-out/graph.json` is missing
- Refresh: same command when `graphify-out/graph.json` already exists
- Uses only Ollama — no paid API, no Bedrock, no AI Model Selector
- Logs: repo path, model, backend, token budget, concurrency, timeout, graph.json presence, exit code, output file presence
- Does not commit generated outputs
- Fails clearly if Ollama or graphify is missing
