# Graphify Operating Standard

Graphify uses the stock upstream CLI. No Brain wrappers. No AI Model Selector.

## Fixed backend

| Setting | Value |
|---------|-------|
| Backend | `bedrock` |
| Model | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Token budget | `15000` |

Auth: ambient AWS credentials (`AWS_PROFILE` / `AWS_REGION`).

**Why Sonnet instead of Opus?**
Opus was replaced by Sonnet due to Bedrock daily token throttling. Sonnet is reliable for semantic graph extraction and runs within daily quota. Opus may be used for manual premium runs by overriding `GRAPHIFY_MODEL`, but is not the standard nightly model.

## Commands

```bash
# Brain knowledge graph
npm run graphify:brain
# → graphify extract . --backend bedrock --model us.anthropic.claude-sonnet-4-5-20250929-v1:0 --token-budget 15000

# Mind knowledge graph
npm run graphify:mind
# → cd ../mind && graphify extract . --backend bedrock --model us.anthropic.claude-sonnet-4-5-20250929-v1:0 --token-budget 15000

# Callflow exports (after graph.json exists)
npm run graphify:brain:callflow
npm run graphify:mind:callflow
```

## Output

```
graphify-out/graph.json       — queryable graph data
graphify-out/graph.html       — interactive visualization
graphify-out/GRAPH_REPORT.md  — god nodes, surprising connections, suggested questions
```

`graphify-out/` is generated output. Do not commit it.

## Scan scoping

Graphify reads `.graphifyignore` at the repo root (gitignore syntax). This is the only scan scope control.

## Nightly scheduler

`tools/scripts/graphify-nightly.sh` runs during off-hours (before 07:00 Lisbon):
- First build: `graphify extract <repo> --backend bedrock --model us.anthropic.claude-sonnet-4-5-20250929-v1:0 --token-budget 15000`
- Refresh: same command when `graphify-out/graph.json` already exists
- Logs: start/end time, repo path, exit code, output file presence
- Does not commit generated outputs
