# Qwen 3.6 27B + Aider Setup

Use Qwen 3.6 27B (MTPLX-accelerated) as a local terminal coding agent via Aider.

## Prerequisites

- MTPLX running: `launchctl start gui/$(id -u)/com.office.mtplx` or via LaunchAgent
- Aider installed: `uv tool install aider-chat`
- Port 8000 accessible: `curl http://127.0.0.1:8000/health`

## Quick Start

**Via repos picker (recommended):**
```bash
repos
# Select: Qwen
# Select your repo
```

**Standalone from any repo:**
```bash
qwen
```

**Direct command (if needed):**
```bash
OPENAI_API_BASE=http://127.0.0.1:8000/v1 OPENAI_API_KEY=mtplx-local aider --model openai/mtplx
```

The `qwen` command is available system-wide via `~/.local/bin/qwen` (symlink to `tools/scripts/qwen`).

## How It Works

- **Model:** Qwen 3.6 27B, MTP-accelerated on Apple Silicon (~1.6x faster)
- **Context:** 262K tokens (long-context work)
- **Local:** No API costs, no Claude/OpenAI usage
- **Capabilities:** Read/edit files, run commands, suggest shell commands, git integration

## Commands Inside Aider

```
/help              Show all commands
/add <file>        Add file to context
/drop <file>       Remove file from context
/git <cmd>         Run git command
/test              Run tests (if configured)
/<cmd>             Run shell command
/exit              Quit
```

## Configuration

Environment variables (all required):
- `OPENAI_API_BASE=http://127.0.0.1:8000/v1` — MTPLX endpoint
- `OPENAI_API_KEY=mtplx-local` — dummy key (ignored for localhost)
- `--model openai/mtplx` — tells aider to use OpenAI provider

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Connection refused" | Verify MTPLX is running: `curl http://127.0.0.1:8000/health` |
| "LLM Provider NOT provided" | Missing model flag or typo in `openai/mtplx` |
| "Unknown context window" | Normal warning; aider uses safe defaults. Suppress with `--no-show-model-warnings` |
| Slow first scan | Large repos take time on first scan. Subsequent runs are cached. |

## Performance

- Model load: ~20 seconds (first time)
- Response time: 2–5 tokens/second (depends on prompt complexity)
- Context: 262K tokens = full brain repo + extended chat history
- Cost: $0 (local compute only)

## Comparison to Claude Code

| Feature | Qwen 27B | Claude Code |
|---------|----------|------------|
| Cost | Free | Token usage |
| Speed | ~5 tok/s (MTP) | Depends on model |
| Context | 262K | 200K (Haiku), 200K (Sonnet) |
| Local | Yes | No |
| Best for | Daily coding, refactoring | Complex architecture, high-stakes |

## Related

- Graphify nightly scheduler uses the same MTPLX backend: `tools/scripts/graphify-nightly.sh`
- MTPLX setup: `operations/runbooks/mtplx-setup.md` (future doc)
- Aider docs: https://aider.chat/docs/
