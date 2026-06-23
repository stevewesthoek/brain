# MTPLX + Qwen 3.6 27B Integration Guide

## Overview

MTPLX is integrated as the primary local AI inference engine for Apple Silicon Macs. It uses native MTP (Multi-Token Prediction) for ~1.6–2.2x speedup compared to standard MLX inference.

**Qwen 3.6 27B** is the default model because:
- Supports native MTP (speculative decoding with draft heads)
- 27B parameter sweet spot: better quality than 7B/14B, fits in 24GB memory (Speed variant)
- Speed variant = 16.4 GB base + ~8 GB runtime = ~24 GB total (safe for M4 Pro)

## System Components

### 1. MTPLX LaunchAgent (Auto-Start)
**File:** `~/.local/LaunchAgents/com.office.mtplx.plist` (symlink to brain repo)

Starts MTPLX daemon on login with:
- **Profile:** `sustained` — long-context MTP path with bounded memory
- **Port:** 8000
- **Model:** Uses cached Speed variant (no --model flag to avoid forcing re-download)
- **API Key:** Not required for localhost

```xml
<string>/opt/homebrew/bin/mtplx</string>
<string>quickstart</string>
<string>--profile sustained</string>
<string>--port 8000</string>
```

### 2. Qwen Terminal Agent (`qwen` command)
**File:** `/Users/Office/Repos/stevewesthoek/brain/tools/scripts/qwen`

Launches Aider with MTPLX backend directly:
```bash
aider \
  --model openai/mtplx \
  --openai-api-base http://127.0.0.1:8000/v1 \
  --openai-api-key "sk-proj-mtplx-dummy-00000000000000000000" \
  --no-show-model-warnings "$@"
```

**Usage:**
```bash
qwen [aider-flags]
qwen --subtree-only   # work on subtree only
qwen /path/to/file    # start with specific file
```

### 3. Graphify Backend
**File:** `/Users/Office/Repos/stevewesthoek/buildflow/graphify-run.sh`

Uses **Ollama backend** (not MTPLX) because:
- graphify's `openai-python` SDK does client-side validation on API keys
- MTPLX's OpenAI-compatible endpoint tries to validate keys as real OpenAI keys
- Ollama doesn't have this validation and works seamlessly

```bash
graphify extract . --backend ollama --model qwen2.5:32b
```

**Why not MTPLX for graphify?**
- Technical: openai-python SDK validates key format before sending request
- MTPLX's OpenAI endpoint validates against real OpenAI key format
- Incompatible validation requirements → 401 errors

**Workaround:** Use Ollama's qwen2.5:32b which is fast enough and has no validation issues.

## File Locations

| Component | File |
|-----------|------|
| LaunchAgent plist | `~/.local/LaunchAgents/com.office.mtplx.plist` → `brain/operations/system-configs/launchagents/com.office.mtplx.plist` |
| Qwen script | `/usr/local/bin/qwen` → `brain/tools/scripts/qwen` |
| MTPLX logs | `~/.local/video-orchestrator/logs/mtplx.log` |
| MTPLX models | `~/.mtplx/models/` |
| Repos picker | `brain/tools/scripts/repos.sh` (includes Qwen option) |

## Verification

```bash
# Check MTPLX is running
curl -s http://127.0.0.1:8000/health | jq '.model, .api_key_required'

# Expected output:
# "mtplx-qwen36-27b-optimized-speed"
# false

# Test qwen command
qwen --version  # Should show aider version

# Test graphify
cd /path/to/repo
graphify extract . --backend ollama --model qwen2.5:32b --token-budget 1000
```

## Key Decision: Ollama for Graphify, MTPLX for Terminal

This split approach is intentional:
- **Terminal coding (aider):** MTPLX Qwen 3.6 27B → Maximum speed (native MTP)
- **Graphify:** Ollama qwen2.5 → No API key validation issues, sufficient performance

Both run simultaneously without conflict. MTPLX stays on port 8000, Ollama on 11434.

## Troubleshooting

**"Error: MTPLX not available"**
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.office.mtplx.plist
```

**MTPLX crashes with "Insufficient Memory"**
- Only use Speed variant (16.4 GB), never Quality (30 GB)
- Ensure OS has ≥8GB free memory
- Check `top -o MEM` to see current usage

**Graphify hangs**
- Verify Ollama is running: `ollama list`
- If qwen2.5:32b not loaded: `ollama pull qwen2.5:32b`

**Qwen command returns usage text**
- Verify MTPLX is running: `curl http://127.0.0.1:8000/health`
- Verify aider installed: `aider --version`

## Related Documentation

- MTPLX docs: https://github.com/youssofal/MTPLX
- Model routing: `brain/ai/policy/routing.md`
- LaunchAgent setup: `brain/operations/runbooks/launchagents.md`
