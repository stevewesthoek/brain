# Graphify Executable Update Guide

Graphify uses the stock upstream CLI directly with a fixed Bedrock Opus configuration.
No orchestrator, no AI Model Selector, no backend adapter.

## Fixed configuration

| Setting | Value |
|---------|-------|
| Backend | `bedrock` |
| Model | `us.anthropic.claude-opus-4-6-v1` |
| Token budget | `15000` |

## Commands

### Brain

```bash
npm run graphify:brain
```

Equivalent to:
```bash
graphify extract . --backend bedrock --model us.anthropic.claude-opus-4-6-v1 --token-budget 15000
```

### Mind

```bash
npm run graphify:mind
```

Equivalent to:
```bash
cd ../mind && graphify extract . --backend bedrock --model us.anthropic.claude-opus-4-6-v1 --token-budget 15000
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
