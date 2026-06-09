# Graphify Executable Update Guide

Graphify uses the stock upstream CLI directly with a local Ollama configuration.
No orchestrator, no AI Model Selector, no paid backend.

## Fixed configuration

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

### Brain

```bash
npm run graphify:brain
```

Equivalent to:
```bash
OLLAMA_API_KEY=ollama OLLAMA_MODEL=gemma4:12b-mlx GRAPHIFY_OLLAMA_NUM_CTX=8192 GRAPHIFY_OLLAMA_KEEP_ALIVE=30 \
  graphify extract . --backend ollama --token-budget 4000 --max-concurrency 1 --api-timeout 900 && \
OLLAMA_API_KEY=ollama OLLAMA_MODEL=gemma4:12b-mlx GRAPHIFY_OLLAMA_NUM_CTX=8192 GRAPHIFY_OLLAMA_KEEP_ALIVE=30 \
  graphify cluster-only . --backend ollama
```

### Mind

```bash
npm run graphify:mind
```

Equivalent to:
```bash
cd ../mind && OLLAMA_API_KEY=ollama OLLAMA_MODEL=gemma4:12b-mlx GRAPHIFY_OLLAMA_NUM_CTX=8192 GRAPHIFY_OLLAMA_KEEP_ALIVE=30 \
  graphify extract . --backend ollama --token-budget 4000 --max-concurrency 1 --api-timeout 900 && \
OLLAMA_API_KEY=ollama OLLAMA_MODEL=gemma4:12b-mlx GRAPHIFY_OLLAMA_NUM_CTX=8192 GRAPHIFY_OLLAMA_KEEP_ALIVE=30 \
  graphify cluster-only . --backend ollama
```

### Callflow exports (after graph.json exists)

```bash
npm run graphify:brain:callflow
npm run graphify:mind:callflow
```

## Output

```
graphify-out/graph.json                 — queryable graph data
graphify-out/.graphify_analysis.json    — raw analysis data
graphify-out/GRAPH_REPORT.md            — cluster/community report
graphify-out/graph.html                 — interactive visualization
```

`graphify-out/` is generated output and must not be committed.

## Troubleshooting

**"command not found: graphify"** — Install the CLI:

```bash
uv tool install "graphifyy[ollama]" --force
```

**"ollama unavailable"** — Ensure Ollama is installed and running:
```bash
ollama list
ollama run gemma4:12b-mlx "Reply with OK only."
```

**Model not found** — Pull the model:
```bash
ollama pull gemma4:12b-mlx
```
