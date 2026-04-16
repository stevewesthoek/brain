# QWEN 2.5 coder 14b — Local LLM Setup & Operations

**QWEN 2.5 coder 14b** is a free, open-source coding LLM running locally on your Mac via Ollama. It integrates seamlessly with Claude Code as a fourth AI tool (alongside Claude, Codex, and Gemini) and works completely offline.

## Quick Start

Start the QWEN service:
```bash
qwen-service start
```

Use QWEN interactively:
```bash
qwen "Write a JavaScript hello world function"
qwen  # enter interactive mode
```

Open a repo with QWEN:
```bash
repos      # pick QWEN → pick repo
sessions   # pick QWEN → pick a past session
```

## Architecture

### Dual Ollama Instances

Your setup uses **two separate Ollama instances** to keep workflows isolated:

| Instance | Purpose | Port | Models | Use Case |
|----------|---------|------|--------|----------|
| Default (11434) | [Reserved] Says the Bible Stable Diffusion | 11434 | `stable-diffusion-xl` | Thumbnail generation (local dev only) |
| QWEN (11435) | General-purpose coding | 11435 | `qwen2.5-coder:14b` | Interactive CLI, coding tasks |

This isolation ensures:
- **Safety:** Pulling a new model for one use case doesn't affect the other.
- **Performance:** No model swapping or unloading overhead.
- **Clarity:** Each instance has a clear, single responsibility.

### Components

#### 1. Ollama Binary
- **Source:** Homebrew (`/opt/homebrew/opt/ollama/bin/ollama`)
- **Version:** 0.20.7+ (Intel MLX optimizations)
- **Optimization flags:**
  - `OLLAMA_FLASH_ATTENTION=1` — hardware acceleration
  - `OLLAMA_KV_CACHE_TYPE=q8_0` — quantized caching for memory efficiency

#### 2. Service Management
- **Script:** `~/Repos/stevewesthoek/brain/tools/scripts/qwen-service.sh`
- **Commands:**
  - `qwen-service start` — start QWEN instance on port 11435
  - `qwen-service stop` — stop the instance (graceful shutdown)
  - `qwen-service status` — check if running and list models
  - `qwen-service pull` — pull/update the qwen2.5-coder:14b model

#### 3. CLI Wrapper
- **Script:** `~/Repos/stevewesthoek/brain/tools/scripts/qwen`
- **Features:**
  - Health check (fails gracefully if service isn't running)
  - Interactive mode: `qwen` (REPL with streaming output)
  - Non-interactive: `qwen "prompt"` (pipe-friendly)
  - Auto-formats JSON payloads for Ollama API

#### 4. LaunchD Service (optional auto-start)
- **Plist:** `~/Repos/stevewesthoek/brain/operations/system-configs/launchd/com.office.qwen-ollama.plist`
- **Behavior:** Restarts on crash, runs at login
- **Setup:**
  ```bash
  ln -sf ~/Repos/stevewesthoek/brain/operations/system-configs/launchd/com.office.qwen-ollama.plist ~/Library/LaunchAgents/
  launchctl load ~/Library/LaunchAgents/com.office.qwen-ollama.plist
  ```

#### 5. Shell Integration
- **PATH:** Brain scripts directory added to `~/.zshrc`
- **Functions:**
  - `repos` — unified repo picker (Claude/Codex/Gemini/**QWEN**)
  - `sessions` — session picker (QWEN sessions stored in `~/.qwen/sessions/`)
  - `qwen-service` — service management wrapper

## Usage Patterns

### Pattern 1: Quick Coding Task
```bash
qwen "Debug this JavaScript async/await code: $(cat my-file.js)"
```

### Pattern 2: Interactive Session
```bash
qwen
# Starts REPL
# qwen> explain how closures work in JavaScript
# qwen> write a closure example
# qwen> exit
```

### Pattern 3: Repo-Based Development
```bash
repos           # pick QWEN
# Select a repo
# Opens Claude Code in the repo, ready for QWEN queries
```

### Pattern 4: Resume a Session
```bash
sessions        # pick QWEN
# Select a past QWEN session
# Resumes in that repo with the session history
```

## Performance & Specs

- **Model:** qwen2.5-coder:14b (14 billion parameters)
- **Memory:** ~9–11 GB RAM (depending on quantization)
- **Speed:** ~3–5 tokens/sec (Intel M4 Max, optimized)
- **First response:** 2–3 seconds (model loading cached after first run)
- **Cost:** Free (runs locally, offline-capable)
- **Accuracy:** Good for coding, debugging, explanations; not a replacement for Claude for complex reasoning

## Troubleshooting

### QWEN service fails to start
```bash
# Check logs
cat ~/.ollama-qwen/qwen.log

# Verify Ollama binary exists
which ollama
```

### "QWEN instance not running" when running `qwen` command
```bash
qwen-service start
# or check status
qwen-service status
```

### Service keeps crashing
```bash
# Kill any orphaned processes
pkill -f "OLLAMA_HOST=127.0.0.1:11435" || true

# Restart
qwen-service stop
qwen-service start

# If still failing, check logs
tail -f ~/.ollama-qwen/qwen.log
```

### Model not found after pulling
```bash
# Verify the model was downloaded
qwen-service status

# If not listed, pull again
qwen-service pull

# Check models directory
ls -lh ~/.ollama-qwen/models/manifests/registry.ollama.ai/library/
```

### Service won't stop cleanly
```bash
# Force kill (last resort)
pkill -9 -f "OLLAMA_HOST=127.0.0.1:11435" || true
```

## Integration with Other Tools

### With `repos` picker
- `repos` → select QWEN → select repo → opens Claude Code targeting that repo with QWEN context

### With `sessions` picker
- `sessions` → select QWEN → select past session → resumes that QWEN session in the original repo

### With Claude Code
- **Not a replacement:** QWEN is a free local alternative for straightforward coding tasks. For complex reasoning, architecture, or multi-file refactors, use Claude/Sonnet.
- **Complementary:** Use QWEN for syntax checks, quick explanations, debugging; use Claude for design decisions and architectural guidance.

## Maintenance

### Updating the Model
```bash
# Pull latest version of qwen2.5-coder:14b
qwen-service pull

# Verify update
qwen-service status
```

### Monitoring Disk Usage
```bash
du -sh ~/.ollama-qwen
# Usually 8–9 GB for qwen2.5-coder:14b
```

### Auto-Start Setup
If you want QWEN to start automatically at login:
```bash
ln -sf ~/Repos/stevewesthoek/brain/operations/system-configs/launchd/com.office.qwen-ollama.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.office.qwen-ollama.plist
```

Verify it's loaded:
```bash
launchctl list | grep qwen
```

### Disabling Auto-Start
```bash
launchctl unload ~/Library/LaunchAgents/com.office.qwen-ollama.plist
rm ~/Library/LaunchAgents/com.office.qwen-ollama.plist
```

## Sessions & Context Persistence

QWEN sessions are stored in `~/.qwen/sessions/` as JSON files. Each session includes:
- Conversation history (user → assistant messages)
- Timestamp (for sorting in the `sessions` picker)
- Optional title

**Note:** Session management for QWEN is basic compared to Claude/Codex. For complex, long-running work, prefer Claude.

## Offline Capability

Once the model is downloaded:
- **No internet required** for inference
- **Pure local execution** — all compute stays on your Mac
- **Privacy:** No prompts leave your machine

## Costs & Transparency

| Tool | Model | Cost | Speed | Best For |
|------|-------|------|-------|----------|
| Claude | Claude 4.6 / Sonnet | $$ | High | Complex reasoning, architecture |
| Codex | GPT-5.4 | $ | High | Code review, second opinions |
| Gemini | Gemini Flash | Free | High | Large context, summarization |
| **QWEN** | **qwen2.5-coder:14b** | **Free** | Medium | Quick coding, syntax, debugging |

Use QWEN to save on API costs for high-volume coding tasks. Use Claude/Sonnet for decisions that require human-level reasoning.

## References

- **Ollama:** https://ollama.com
- **QWEN Model:** https://huggingface.co/Qwen/Qwen2.5-Coder-14B
- **Brain repo:** `~/Repos/stevewesthoek/brain/CLAUDE.md` (setup reference)
- **Service script:** `~/Repos/stevewesthoek/brain/tools/scripts/qwen-service.sh`
- **CLI wrapper:** `~/Repos/stevewesthoek/brain/tools/scripts/qwen`
