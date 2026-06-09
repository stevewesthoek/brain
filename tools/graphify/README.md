# Graphify Tools

Brain-owned Graphify scripts and docs live here.

Graphify uses the stock upstream CLI directly. No Brain wrappers, no AI Model Selector.

## Fixed configuration

| Setting | Value |
|---------|-------|
| Backend | `bedrock` |
| Model | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Token budget | `15000` |

Auth: ambient AWS credentials (`AWS_PROFILE` / `AWS_REGION`).

**Why Sonnet instead of Opus?**
Opus was replaced by Sonnet due to Bedrock daily token throttling. Sonnet is reliable for semantic graph extraction and runs within daily quota. Opus may be used for manual premium runs by overriding `GRAPHIFY_MODEL`, but is not the standard nightly model.

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
graphify-out/graph.json       — queryable graph data
graphify-out/graph.html       — interactive visualization
graphify-out/GRAPH_REPORT.md  — god nodes + surprising connections + suggested questions
```

`graphify-out/` is generated output and must not be committed.

## Scan scoping: `.graphifyignore`

Graphify reads `.graphifyignore` at the repo root (gitignore syntax). This is the only scan scope control. No Brain wrapper adds extra filtering.

## Nightly scheduler

`tools/scripts/graphify-nightly.sh` iterates all repos under `~/Repos` during off-hours (before 07:00 Lisbon time):

- If `graphify-out/graph.json` does not exist: runs first graph generation (`graphify extract`).
- If it exists: refreshes the graph (`graphify extract`).
- Same fixed command for every repo: `graphify extract <repo> --backend bedrock --model us.anthropic.claude-sonnet-4-5-20250929-v1:0 --token-budget 15000`.
- Logs start/end time, repo path, exit code, and output file presence.
- Does not commit generated outputs.
- Scheduler stops starting new repos after the cutoff hour but finishes any in-progress repo.
