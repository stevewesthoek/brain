# ComfyUI + Stable Diffusion — Setup & Usage Guide

**Version:** 1.0  
**Last Updated:** 2026-04-13  
**Platform:** macOS (Apple Silicon M1/M2/M3/M4)  
**Status:** Production-Ready

---

## Overview

**ComfyUI** is a node-graph-based Stable Diffusion interface with a full REST API.
It runs locally — zero cost, zero external dependencies after model download.

**Benefits:**
- Free — no per-image API costs
- Private — all data stays on your machine
- Fast — Apple Silicon (MPS backend) generates 512×512 in ~10s on M4 Pro
- AI-agnostic — any app, script, or AI agent (Claude, Codex, Gemini) can call the API
- On-demand — started when needed, not a persistent background daemon

**API endpoint:** `http://localhost:8188`

---

## Installation

ComfyUI is installed at `~/.local/share/comfyui`.

### Step 1 — Clone and install

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git ~/.local/share/comfyui
cd ~/.local/share/comfyui
python3 -m venv venv
source venv/bin/activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

### Step 2 — Download Stable Diffusion model

Models live in `~/.local/share/comfyui/models/checkpoints/`.

**Stable Diffusion XL Base 1.0** — recommended for Apple Silicon M4 Pro (24 GB):

- Native 1024×1024 resolution (vs 512×512 for SD 1.5) → much sharper output
- Peak ~10–12 GB during generation — fits easily in 24 GB unified memory
- Best quality for illustration, landscape, and artistic styles

```bash
# From a project that has the helper script:
npm run comfyui:install-model

# Or manually:
curl -L --continue-at - \
  "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors" \
  -o ~/.local/share/comfyui/models/checkpoints/sd_xl_base_1.0.safetensors
```

Download is ~6.9 GB, resume-safe with `--continue-at -`.

### Step 3 — Install lifecycle helpers

```bash
# Copy the lifecycle scripts to your PATH
cp scripts/dev/with-comfyui.sh ~/.local/bin/comfyui-start
chmod +x ~/.local/bin/comfyui-start
```

Or use the standalone scripts at `~/.local/bin/comfyui-start` and `~/.local/bin/comfyui-stop`
(installed during initial setup).

---

## Usage

### Start / Stop manually

```bash
# Start ComfyUI (waits until ready)
comfyui-start

# Stop ComfyUI
comfyui-stop

# Check if running
curl -s http://localhost:8188/api/status | jq '.queue_running'
```

### App-managed lifecycle (recommended)

Projects that need ComfyUI wrap their dev command with `with-comfyui.sh`:

```bash
# package.json:
"dev:thumbnails": "bash scripts/dev/with-comfyui.sh next dev -p 3057"
```

This starts ComfyUI before the app, and stops it automatically on Ctrl+C.
**ComfyUI is not running when the dev server is not running.**

### View logs

```bash
tail -f ~/.local/var/log/comfyui.log
```

---

## REST API Reference

ComfyUI exposes a REST API at `http://localhost:8188`.

### Health check

```bash
curl http://localhost:8188/api/status
# { "queue_running": {...}, "queue_pending": [...] }
```

### Generate an image (full workflow)

ComfyUI uses a **node graph workflow** as JSON. Each node is a processing step.

**Minimal text-to-image workflow:**

```bash
curl -X POST http://localhost:8188/api/prompt \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": {
      "1": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": { "ckpt_name": "stable-diffusion-v1-5.safetensors" }
      },
      "2": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": "serene mountain landscape, misty, purple sky", "clip": ["1", 1] }
      },
      "3": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": "low quality, blurry, distorted", "clip": ["1", 1] }
      },
      "4": {
        "class_type": "KSampler",
        "inputs": {
          "seed": 42,
          "steps": 30,
          "cfg": 7.5,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1.0,
          "model": ["1", 0],
          "positive": ["2", 0],
          "negative": ["3", 0],
          "latent_image": ["5", 0]
        }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": { "width": 1280, "height": 720, "batch_size": 1 }
      },
      "6": {
        "class_type": "VAEDecode",
        "inputs": { "samples": ["4", 0], "vae": ["1", 2] }
      },
      "7": {
        "class_type": "SaveImage",
        "inputs": { "filename_prefix": "output", "images": ["6", 0] }
      }
    }
  }'
# Returns: { "prompt_id": "abc123...", "number": 1, "node_errors": {} }
```

### Poll for completion

```bash
PROMPT_ID="abc123..."
curl http://localhost:8188/api/history/${PROMPT_ID}
# Returns empty {} while pending, then job result when done
# Image is at: .outputs["7"].images[0]
# { "filename": "output_00001_.png", "subfolder": "", "type": "output" }
```

### Download the generated image

```bash
curl "http://localhost:8188/view?filename=output_00001_.png&subfolder=&type=output" \
  -o result.png
```

### List available models

```bash
curl http://localhost:8188/api/object_info/CheckpointLoaderSimple \
  | jq '.CheckpointLoaderSimple.input.required.ckpt_name[0]'
```

---

## Node.js / TypeScript Integration

```typescript
const COMFYUI_URL = process.env.COMFYUI_API_URL || 'http://localhost:8188'

async function generateImage(prompt: string): Promise<Buffer> {
  // 1. Health check
  const status = await fetch(`${COMFYUI_URL}/api/status`)
  if (!status.ok) throw new Error('ComfyUI not running')

  // 2. Submit workflow
  const workflow = buildComfyUIWorkflow(prompt, 1280, 720)
  const submitRes = await fetch(`${COMFYUI_URL}/api/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  })
  const { prompt_id } = await submitRes.json()

  // 3. Poll for completion
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))
    const hist = await fetch(`${COMFYUI_URL}/api/history/${prompt_id}`).then(r => r.json())
    const job = hist[prompt_id]
    if (!job) continue
    const imageInfo = job.outputs?.['7']?.images?.[0]
    if (!imageInfo) throw new Error('No image in output')

    const imgRes = await fetch(
      `${COMFYUI_URL}/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=&type=output`
    )
    return Buffer.from(await imgRes.arrayBuffer())
  }
  throw new Error('Timed out')
}
```

### Python integration

```python
import requests, time

COMFYUI_URL = "http://localhost:8188"

def generate_image(prompt: str, width=1280, height=720) -> bytes:
    workflow = {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "stable-diffusion-v1-5.safetensors"}},
        "2": {"class_type": "CLIPTextEncode",
              "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode",
              "inputs": {"text": "low quality, blurry", "clip": ["1", 1]}},
        "4": {"class_type": "KSampler",
              "inputs": {"seed": 42, "steps": 30, "cfg": 7.5,
                         "sampler_name": "euler", "scheduler": "normal",
                         "denoise": 1.0, "model": ["1", 0],
                         "positive": ["2", 0], "negative": ["3", 0],
                         "latent_image": ["5", 0]}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "VAEDecode",
              "inputs": {"samples": ["4", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage",
              "inputs": {"filename_prefix": "output", "images": ["6", 0]}},
    }

    res = requests.post(f"{COMFYUI_URL}/api/prompt", json={"prompt": workflow})
    prompt_id = res.json()["prompt_id"]

    for _ in range(150):  # 5 min timeout
        time.sleep(2)
        hist = requests.get(f"{COMFYUI_URL}/api/history/{prompt_id}").json()
        job = hist.get(prompt_id)
        if not job: continue
        image_info = job["outputs"]["7"]["images"][0]
        img_res = requests.get(
            f"{COMFYUI_URL}/view",
            params={"filename": image_info["filename"], "type": "output"}
        )
        return img_res.content

    raise TimeoutError("ComfyUI generation timed out")
```

### cURL (bash scripts)

```bash
#!/bin/bash
# Quick text-to-image via ComfyUI
PROMPT="serene mountain landscape with misty forest, purple sky, twilight"

# Submit
RESULT=$(curl -s -X POST http://localhost:8188/api/prompt \
  -H 'Content-Type: application/json' \
  -d "{\"prompt\": $(cat comfyui-workflow.json | sed "s/PROMPT_HERE/$PROMPT/g")}")

PROMPT_ID=$(echo "$RESULT" | jq -r '.prompt_id')

# Poll
while true; do
  sleep 2
  HIST=$(curl -s "http://localhost:8188/api/history/$PROMPT_ID")
  FILENAME=$(echo "$HIST" | jq -r ".[\"$PROMPT_ID\"].outputs[\"7\"].images[0].filename // empty")
  if [ -n "$FILENAME" ]; then
    curl -s "http://localhost:8188/view?filename=$FILENAME&type=output" -o output.png
    echo "✓ Saved: output.png"
    break
  fi
done
```

---

## Performance (Apple Silicon)

Tested on Mac Mini M4 Pro (24GB Unified Memory):

| Resolution | Steps | Time    |
|------------|-------|---------|
| 512×512    | 20    | ~8s     |
| 512×512    | 30    | ~12s    |
| 768×512    | 30    | ~18s    |
| 1280×720   | 30    | ~45s    |
| 1024×1024  | 30    | ~60s    |

ComfyUI uses the **MPS** (Metal Performance Shaders) backend automatically on Apple Silicon.
No configuration needed — it detects and uses GPU memory.

**Tip:** For faster iterations during testing, use 512×512 at 20 steps.
Use 1280×720 at 30 steps for final production thumbnails.

---

## Model Management

Models live at `~/.local/share/comfyui/models/`:

```
checkpoints/   — Main SD models (safetensors)
loras/         — LoRA fine-tuning adapters
vae/           — Custom VAE decoders
controlnet/    — ControlNet models
embeddings/    — Textual inversion embeddings
```

### Check disk usage

```bash
du -sh ~/.local/share/comfyui/models/
du -sh ~/.local/share/comfyui/models/checkpoints/*
```

### Remove a model to free space

```bash
rm ~/.local/share/comfyui/models/checkpoints/model-name.safetensors
```

### Other recommended models

| Model | Size | Best For | M4 Pro 24 GB |
|-------|------|---------|---|
| `sd_xl_base_1.0.safetensors` | 6.9 GB | **Recommended** — best quality, illustration, landscape | ✅ Excellent |
| `stable-diffusion-v1-5.safetensors` | 4.2 GB | Legacy / fast prototyping | ✅ Fine |
| `dreamshaper_8.safetensors` | 2.1 GB | Artistic, painterly (SD 1.5 finetune) | ✅ Fine |
| FLUX.1 schnell (quantized) | ~12 GB | State of the art, needs extra ComfyUI nodes | ✅ Possible |

Download from [civitai.com](https://civitai.com) or [Hugging Face](https://huggingface.co/models).

---

## Troubleshooting

### Port 8188 already in use

```bash
lsof -i :8188
# Kill the old process then restart
comfyui-stop && comfyui-start
```

### Out of memory errors

Reduce resolution or steps. On 16GB machines, keep to 768×512 max.

On 24GB+ (M4 Pro), 1280×720 works comfortably.

### Model not loading

```bash
# Verify the checkpoint file exists
ls -lh ~/.local/share/comfyui/models/checkpoints/

# Check ComfyUI logs
tail -50 ~/.local/var/log/comfyui.log
```

### Slow first generation

First generation after startup loads the model into memory (~10–15s extra).
Subsequent generations are much faster (model stays in memory while running).

### Check what ComfyUI sees

```bash
curl http://localhost:8188/api/object_info/CheckpointLoaderSimple \
  | jq '.CheckpointLoaderSimple.input.required.ckpt_name[0]'
```

---

## Resource Management

ComfyUI is **on-demand** — not a background daemon.

- Started by app wrappers when needed (`with-comfyui.sh`)
- Stopped automatically on app shutdown (trap on EXIT/INT/TERM)
- Idle memory usage when running: ~0.5 GB (model not loaded)
- Memory usage during generation: ~6–8 GB (model in unified memory)
- After generation: model stays loaded for fast repeat generation

To check memory while running:

```bash
# Check if ComfyUI is running
cat ~/.local/var/run/comfyui.pid 2>/dev/null && echo "Running" || echo "Stopped"

# Memory usage
ps -o rss= -p $(cat ~/.local/var/run/comfyui.pid) | awk '{print $1/1024 " MB"}'
```

---

## Storage Layout

```
~/.local/share/comfyui/          — ComfyUI installation
  venv/                          — Python virtualenv
  models/
    checkpoints/                 — SD model files (.safetensors)
    loras/                       — LoRA adapters
  output/                        — Generated images (auto-created)
  custom_nodes/                  — ComfyUI extensions

~/.local/var/
  run/comfyui.pid                — PID file (managed by lifecycle scripts)
  log/comfyui.log                — Server log

~/.local/bin/
  comfyui-start                  — Start script
  comfyui-stop                   — Stop script
```

---

## Projects Using ComfyUI

| Project | Use Case | Script |
|---------|---------|--------|
| Says the Bible | Episode thumbnail generation | `npm run dev:thumbnails` |
| — | Add yours here | — |

---

## References

- **ComfyUI repo:** https://github.com/comfyanonymous/ComfyUI
- **ComfyUI API docs:** https://github.com/comfyanonymous/ComfyUI/blob/master/server.py
- **Model hub:** https://huggingface.co/models?pipeline_tag=text-to-image
- **Community models:** https://civitai.com
- **Workflow examples:** https://comfyworkflows.com
