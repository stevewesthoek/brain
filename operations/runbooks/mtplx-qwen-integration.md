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
**File:** `~/.graphify/providers.json`

Uses a **custom "mtplx" backend** registered in graphify's provider system:
```json
{
  "mtplx": {
    "base_url": "http://127.0.0.1:8000/v1",
    "default_model": "mtplx",
    "env_key": "MTPLX_API_KEY",
    "pricing": {"input": 0.0, "output": 0.0},
    "temperature": 0,
    "vision": true
  }
}
```

**Usage:**
```bash
MTPLX_API_KEY="not-needed" graphify extract . --backend mtplx --model mtplx --token-budget 4000 --max-concurrency 1 --api-timeout 900
```

**Key insight:** The `MTPLX_API_KEY` env var just needs a non-empty string (MTPLX doesn't validate it on localhost). The custom provider avoids the "openai" backend's hardcoded `https://api.openai.com/v1` base_url.

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

# Test graphify with MTPLX
cd /path/to/repo
MTPLX_API_KEY="not-needed" graphify extract . --backend mtplx --model mtplx --token-budget 1000 --max-concurrency 1 --api-timeout 900
```

## Unified Backend: Everything Runs on MTPLX

All local AI tasks use the same MTPLX Qwen 3.6 27B Speed model:
- **Terminal coding (aider):** `qwen` command → MTPLX
- **Graphify extraction:** `--backend mtplx` → MTPLX
- **Nightly scheduler:** All 6 phases → MTPLX

No Ollama needed. MTPLX on port 8000 is the single local inference engine.

## Troubleshooting

**"Error: MTPLX not available"**
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.office.mtplx.plist
```

**MTPLX crashes with "Insufficient Memory"**
- Only use Speed variant (16.4 GB), never Quality (30 GB)
- Ensure OS has ≥8GB free memory before starting MTPLX
- Stop Ollama if running: `osascript -e 'quit app "Ollama"'`
- Check memory: `memory_pressure | grep "free percentage"`

**Graphify 401 errors**
- Ensure `~/.graphify/providers.json` exists with the mtplx entry
- Ensure `MTPLX_API_KEY` env var is set (any non-empty value)
- Don't use `--backend openai` — use `--backend mtplx`

**Qwen command returns usage text**
- Verify MTPLX is running: `curl http://127.0.0.1:8000/health`
- Verify aider installed: `aider --version`

## Related Documentation

- MTPLX docs: https://github.com/youssofal/MTPLX
- Model routing: `brain/ai/policy/routing.md`
- LaunchAgent setup: `brain/operations/runbooks/launchagents.md`
