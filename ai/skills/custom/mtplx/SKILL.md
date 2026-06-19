# MTPLX — Local MTP-Accelerated Inference

MTPLX serves Qwen 3.6 27B with Multi-Token Prediction acceleration on Apple Silicon (~1.6x faster than standard MLX autoregressive decoding).

## Provider Details

- **Endpoint:** `http://127.0.0.1:8000/v1` (OpenAI-compatible)
- **Health:** `http://127.0.0.1:8000/health`
- **LaunchAgent:** `com.office.mtplx`
- **Model:** `Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed`
- **Config:** `~/.config/video-orchestrator/ai-providers.json` → `mtplx-m4pro`

## Memory Safety

MTPLX loads the full model into unified memory. On 24 GB M4 Pro:

- Qwen 3.6 27B quantized fits within ~16 GB — leaves room for OS + light Ollama models
- Do not run simultaneously with Ollama's qwen2.5:32b (would exceed memory)
- If memory pressure is high, stop large Ollama models first: `ollama stop qwen2.5:32b`

## Model Management

```bash
# Install MTPLX
brew install youssofal/mtplx/mtplx

# Download model and configure
mtplx setup --model Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed --profile sustained --download

# Service management
launchctl load ~/Library/LaunchAgents/com.office.mtplx.plist
launchctl unload ~/Library/LaunchAgents/com.office.mtplx.plist

# Health check
curl http://127.0.0.1:8000/health

# List cached models
mtplx models
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| MTPLX won't start | Check `~/.local/video-orchestrator/logs/mtplx.err` |
| Out of memory | Stop large Ollama model: `ollama stop qwen2.5:32b` |
| Port 8000 in use | `lsof -i :8000` then kill conflicting process |
| Model not cached | Run `mtplx setup --download` |
