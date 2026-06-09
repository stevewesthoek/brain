# Graphify Tools

Brain-owned Graphify scripts and docs live here.

Graphify uses the stock upstream CLI directly. No Brain wrappers, no AI Model Selector.

## Fixed configuration

| Setting | Value |
|---------|-------|
| Backend | `ollama` (local — no paid API) |
| Model | `gemma3:12b` |
| Token budget | `4000` |
| Ollama context | `8192` |
| Concurrency | `1` |
| API timeout | `900` seconds |

No paid API is used. No Bedrock, no Sonnet, no Opus, no Anthropic cloud model.

## Prerequisites

```bash
ollama pull gemma3:12b
ollama list | grep gemma3
graphify --help
```

Ollama must be running locally before any Graphify command.

## Standard commands

```bash
# Brain knowledge graph
npm run graphify:brain

# Mind knowledge graph
npm run graphify:mind

# Brain callflow export (requires graph.json)
npm run graphify:brain:callflow

# Mind callflow export (requires graph.json)
npm run graphify:mind:callflow
```

## Output

All output lands in `graphify-out/` at the repo root:

```
graphify-out/graph.json                   — queryable graph data
graphify-out/.graphify_analysis.json      — raw analysis data
graphify-out/graph.html                   — interactive visualization (only when --no-viz is not passed)
```

`graphify-out/` is generated output and must not be committed.

## Scan scoping: `.graphifyignore`

Graphify reads `.graphifyignore` at the repo root (gitignore syntax). This is the only scan scope control. No Brain wrapper adds extra filtering.

## Nightly scheduler

`tools/scripts/graphify-nightly.sh` iterates all repos under `~/Repos` during off-hours (before 07:00 Lisbon time):

- If `graphify-out/graph.json` does not exist: runs first graph generation (`graphify extract`).
- If it exists: refreshes the graph (`graphify extract`).
- Uses only Ollama — no paid API, no Bedrock, no Sonnet, no Opus, no Anthropic model IDs, no AI Model Selector.
- Logs repo path, model, backend, token budget, max concurrency, API timeout, graph.json presence before run, exit code, and output file presence.
- Does not commit generated outputs.
- Fails clearly if Ollama or graphify is missing — does not attempt to start Ollama.
- Scheduler stops starting new repos after the cutoff hour but finishes any in-progress repo.
