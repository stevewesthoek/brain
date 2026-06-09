# Graphify Operating Standard

Graphify uses the stock upstream CLI. No Brain wrappers. No AI Model Selector.

## Fixed backend

| Setting | Value |
|---------|-------|
| Backend | `bedrock` |
| Model | `us.anthropic.claude-opus-4-6-v1` |
| Token budget | `15000` |

Auth: ambient AWS credentials (`AWS_PROFILE` / `AWS_REGION`).

## Commands

```bash
# Brain knowledge graph
npm run graphify:brain
# → graphify extract . --backend bedrock --model us.anthropic.claude-opus-4-6-v1 --token-budget 15000

# Mind knowledge graph
npm run graphify:mind
# → cd ../mind && graphify extract . --backend bedrock --model us.anthropic.claude-opus-4-6-v1 --token-budget 15000

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
- First build: `graphify extract <repo> --backend bedrock --model us.anthropic.claude-opus-4-6-v1 --token-budget 15000`
- Refresh: same command when `graphify-out/graph.json` already exists
- Logs: start/end time, repo path, exit code, output file presence
- Does not commit generated outputs
