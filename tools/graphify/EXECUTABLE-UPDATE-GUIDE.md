# Graphify Executable Update Guide

Graphify uses the stock upstream CLI directly with a fixed Bedrock Sonnet configuration.
No orchestrator, no AI Model Selector, no backend adapter.

**Why Sonnet instead of Opus?**
Opus was replaced by Sonnet due to Bedrock daily token throttling. Sonnet is reliable for semantic graph extraction and runs within daily quota. For manual premium runs, override `GRAPHIFY_MODEL=us.anthropic.claude-opus-4-6-v1` on the command line — but not for nightly standard runs.

## Fixed configuration

| Setting | Value |
|---------|-------|
| Backend | `bedrock` |
| Model | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Token budget | `15000` |

## Commands

### Brain

```bash
npm run graphify:brain
```

Equivalent to:
```bash
graphify extract . --backend bedrock --model us.anthropic.claude-sonnet-4-5-20250929-v1:0 --token-budget 15000
```

### Mind

```bash
npm run graphify:mind
```

Equivalent to:
```bash
cd ../mind && graphify extract . --backend bedrock --model us.anthropic.claude-sonnet-4-5-20250929-v1:0 --token-budget 15000
```

### Callflow exports (after graph.json exists)

```bash
npm run graphify:brain:callflow
npm run graphify:mind:callflow
```

## Output

```
graphify-out/graph.json
graphify-out/graph.html
graphify-out/GRAPH_REPORT.md
```

`graphify-out/` is generated output and must not be committed.

## Troubleshooting

**"command not found: graphify"** — Install the CLI:

```bash
npm install -g graphifyy
```

**Auth errors** — Ensure AWS credentials are configured:
```bash
aws sts get-caller-identity
```
