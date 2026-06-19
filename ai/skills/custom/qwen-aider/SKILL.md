# Qwen 3.6 27B + Aider — Local Terminal Coding

Terminal coding agent powered by Qwen 3.6 27B with MTP acceleration on Apple Silicon.

## Quick Start

```bash
qwen
```

Or via the repo picker:

```bash
repos
# Select: Qwen
# Select your repo
```

## Installation

All dependencies are pre-installed:

- MTPLX: `brew install youssofal/mtplx/mtplx` (pre-installed)
- Aider: `uv tool install aider-chat` (pre-installed)
- qwen-aider script: symlinked to `~/.local/bin/qwen-aider`

## Environment

```bash
OPENAI_API_BASE=http://127.0.0.1:8000/v1
OPENAI_API_KEY=mtplx-local
MODEL=openai/mtplx
```

All three are set by the `qwen-aider` script/alias automatically.

## Commands

### Launch

```bash
qwen                          # Interactive terminal
qwen --subtree-only           # Large repos (skip slow files)
qwen --no-gitignore           # Ignore .gitignore entries
qwen file.ts                  # Start with file in context
```

### Inside Aider

```
/help                  Show help
/add <file>           Add file to context
/drop <file>          Remove file
/git <cmd>            Run git command
/test                 Run tests (if configured)
/exit                 Quit

<ctrl-d>              Exit
```

### Chat Examples

```
Ask: Refactor this component to use hooks
Ask: Add error handling to this function
Ask: Write tests for this module
Ask: Fix the type error in this file
```

## Integration

**repos picker** (`repos` command):
- Select "Qwen (Aider)" from tool menu
- Select repo
- Launches in your terminal

**Direct usage:**
```bash
cd /Users/Office/Repos/stevewesthoek/brain
qwen
```

**With flags:**
```bash
qwen --subtree-only --no-auto-commits
```

## Requirements

**MTPLX must be running:**

```bash
# Start via LaunchAgent (automatic at boot)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.office.mtplx.plist

# Or manual for development
mtplx start --port 8000
```

**Verify health:**
```bash
curl http://127.0.0.1:8000/health
```

## Model Details

- **Base:** Qwen 3.6 27B
- **Quantization:** MTPLX Optimized Speed (16.4 GB)
- **Acceleration:** Multi-Token Prediction (~1.6x faster)
- **Context:** 262K tokens
- **Cost:** $0 (local)
- **Speed:** ~5 tokens/second
- **Hardware:** M4 Pro, 24 GB unified memory

## Comparison

| Feature | Qwen 27B | Claude Sonnet | Claude Haiku |
|---------|----------|---------------|--------------|
| Cost | Free | $15/task | $3/task |
| Speed | 5 tok/s | Fast API | Fastest |
| Reasoning | Strong | Excellent | Good |
| Context | 262K | 200K | 200K |
| Local | Yes | No | No |

**Use Qwen for:** Daily refactoring, bug fixes, documentation, feature work.
**Use Claude for:** Hard architecture, security-critical code, design reviews.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "MTPLX not available" | Check: `curl http://127.0.0.1:8000/health` |
| "aider command not found" | Install: `uv tool install aider-chat` |
| Slow first scan | Normal; cache speeds up subsequent runs. Use `--subtree-only` for large repos. |
| "Unknown context window" | Aider warning; harmless. Suppress with `--no-show-model-warnings` |

## Files

- **Script:** `tools/scripts/qwen` (symlinked to `~/.local/bin/qwen`)
- **Documentation:** `operations/runbooks/qwen-aider-setup.md`
- **Integration:** `tools/scripts/repos.sh` (pick tool step)
- **Alias:** `~/.zshrc` → `alias qwen='...'` (backup for direct shell usage)

## Related

- Graphify: Uses same MTPLX backend (`tools/scripts/graphify-nightly.sh`)
- MTPLX setup: `operations/runbooks/mtplx-setup.md` (future)
- Aider docs: https://aider.chat/docs/
