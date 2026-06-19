# Graphify Executable Update Guide

Graphify uses the stock upstream CLI directly with MTPLX local inference (Qwen 3.6 27B MTP-accelerated).
No orchestrator, no AI Model Selector, no paid backend.

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

MTPLX must be running locally (LaunchAgent `com.office.mtplx`).

## Commands

### Brain

```bash
npm run graphify:brain
```

Equivalent to:
```bash
OPENAI_BASE_URL=http://127.0.0.1:8000/v1 OPENAI_API_KEY=none \
  graphify extract . --backend openai --model Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed --token-budget 4000 --max-concurrency 1 --api-timeout 900 && \
OPENAI_BASE_URL=http://127.0.0.1:8000/v1 OPENAI_API_KEY=none \
  GRAPHIFY_VIZ_NODE_LIMIT=30000 graphify cluster-only . --backend=openai --model Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed
```

### Mind

```bash
npm run graphify:mind
```

Equivalent to:
```bash
cd ../mind && OPENAI_BASE_URL=http://127.0.0.1:8000/v1 OPENAI_API_KEY=none \
  graphify extract . --backend openai --model Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed --token-budget 4000 --max-concurrency 1 --api-timeout 900 && \
OPENAI_BASE_URL=http://127.0.0.1:8000/v1 OPENAI_API_KEY=none \
  GRAPHIFY_VIZ_NODE_LIMIT=30000 graphify cluster-only . --backend=openai --model Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed
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
graphify-out/graph.html                 — interactive visualization, generated when `GRAPHIFY_VIZ_NODE_LIMIT` is high enough
```

`graphify-out/` is generated output and must not be committed.

## Troubleshooting

**"command not found: graphify"** — Install the CLI:

```bash
uv tool install "graphifyy[ollama]" --force
```

**"MTPLX unavailable"** — Ensure MTPLX is running:
```bash
curl http://127.0.0.1:8000/health
launchctl load ~/Library/LaunchAgents/com.office.mtplx.plist
```
