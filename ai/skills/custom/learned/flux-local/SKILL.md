---
name: flux-local
description: FLUX.1-dev — Premium local image generation. State-of-the-art quality. 2-4 minutes per image. Use for product photography, marketing assets, when quality is critical. Zero platform costs.
---

# FLUX.1-dev (Local) — Premium Image Generation

## What This Skill Is For

Generate premium-quality images locally using FLUX.1-dev. Best-in-class image synthesis for product photography, marketing assets, and content where quality is paramount.

## Use This Skill When

- **Product photography** — E-commerce, marketing, high-end presentation
- **Premium marketing assets** — Hero images, landing page visuals
- **High-quality thumbnails** — When image quality matters more than speed
- **Editorial content** — Magazine-quality visuals
- **Concept exploration** — When precise prompt adherence is critical
- **Custom branding** — Images that match exact brand guidelines

## Do Not Use This Skill For

- **Batch content** — Use `/stable-diffusion-local` instead (faster)
- **Simple graphics** — Use `/stable-diffusion-local` instead (overkill)
- **Time-sensitive work** — FLUX is slow (2–4 min per image)
- **When speed matters** — Default to SDXL
- **On limited VRAM** — Requires 18–20 GB (tight on 24 GB Mac)

## Performance Profile

| Metric | Value |
|--------|-------|
| Speed | 2–4 minutes per image |
| Quality | Premium (state-of-the-art) |
| VRAM | 18–20 GB (tight on 24 GB) |
| Metal acceleration | Yes (Apple Silicon) |
| Model size | ~25 GB total (download once) |
| Prompt adherence | Excellent (better than SDXL) |
| Detail level | Very high |
| Cost | Zero |

## Installation & Setup

See: `operations/runbooks/local-video-generation-setup.md` → Section "3. FLUX.1-dev (Premium Images)"

**Installation summary:**
```bash
git clone https://github.com/black-forest-labs/flux.git ~/ai-models/flux
cd ~/ai-models/flux
pip install -r requirements.txt

# Download model (~25 GB)
huggingface-cli download black-forest-labs/FLUX.1-dev \
  --local-dir ~/ai-models/flux/models
```

**Note:** First run will be slow (4–5 min) as Metal optimizations compile. Subsequent runs cache optimizations (~2 min).

## Usage Patterns

### Pattern 1: Single Premium Image

```python
from diffusers import FluxPipeline
import torch

pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-dev", 
                                     local_files_only=True)
pipe = pipe.to("mps")  # Metal acceleration

image = pipe(
    prompt="professional product photography: modern ergonomic chair, studio lighting, "
           "white background, high-end furniture photography, sharp details"
).images[0]

image.save("product_hero.png")
```

### Pattern 2: Product Series (Multiple angles)

```python
from diffusers import FluxPipeline
import torch

pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-dev", local_files_only=True)
pipe = pipe.to("mps")

product = "minimalist wooden desk"
angles = [
    f"{product}, front view, studio lighting",
    f"{product}, side view, natural light",
    f"{product}, detail shot, macro photography",
    f"{product}, lifestyle shot, person working",
]

for i, prompt in enumerate(angles):
    image = pipe(prompt=prompt).images[0]
    image.save(f"product_angle_{i}.png")
    print(f"✓ Generated angle {i}")
```

### Pattern 3: Batch During Night (Scheduled)

```bash
#!/bin/bash
# Run during night hours (2 AM - 6 AM) with 85% resource limit

if [ "$(date +%H)" -ge 2 ] && [ "$(date +%H)" -lt 6 ]; then
    nice -n 10 python ~/ai-models/flux/generate_batch.py \
      --prompts "prompts.txt" \
      --output-dir "generated_images/" \
      --resolution "1024x1024"
fi
```

## Advanced Usage

### Fine-Grained Control

```python
# Control randomness/creativity
image = pipe(
    prompt="professional portrait",
    height=1024,
    width=1024,
    guidance_scale=7.5,  # Higher = stricter adherence to prompt
    num_inference_steps=25  # More steps = higher quality (slower)
).images[0]
```

### Memory Management

```python
# For 24 GB Mac, monitor before running FLUX

import psutil
mem = psutil.virtual_memory()
available_gb = mem.available / 1e9

if available_gb < 6:
    print("⚠️ Not enough free memory. Close other apps and retry.")
else:
    print(f"✓ {available_gb:.1f} GB available. Starting generation...")
    image = pipe(prompt="...").images[0]
```

### Optimize for Speed (Slight quality reduction)

```python
# Use fewer inference steps
image = pipe(
    prompt="professional product photo",
    num_inference_steps=20  # Default 25–50, reduce to 20 for speed
).images[0]
```

## Prompt Engineering for FLUX

### FLUX Excels At

✅ **Precise object rendering:**
```
"professional product photography: stainless steel water bottle, 
minimalist design, product photography, white background, sharp details"
```

✅ **Consistency across variations:**
```
"same scene, different seasons: modern cafe interior, summer lighting"
```

✅ **Complex compositions:**
```
"dramatic landscape: misty mountain valley at dawn, golden hour light, 
cinematic composition, fine art photography"
```

### Tips

- **Be specific:** FLUX rewards detail
- **Include style:** "professional photography", "cinematic", "fine art"
- **Technical details:** "sharp focus", "depth of field", "lighting quality"
- **Output format:** "8k resolution", "high quality", "detailed"

## Integration with Video Pipeline

**Use case: Generate premium background, then use for video**

```bash
# Step 1: Generate premium background (FLUX)
python ~/ai-models/flux/generate.py \
  --prompt "professional office background, modern, minimalist, warm lighting" \
  --output "background_premium.png"

# Step 2: Composite with talking head (Wave)
python ~/ai-models/wave/inference.py \
  --image "avatar.png" \
  --audio "narration.wav" \
  --background "background_premium.png" \
  --output "talking_head_premium.mp4"

# Step 3: Final composition (FFmpeg)
ffmpeg -i talking_head_premium.mp4 -c copy final_video.mp4
```

## Troubleshooting

### Slow Generation (>5 minutes)

✅ **First run is slow** — Metal optimizations compile. Second run caches them (~2 min).

✅ **Check Metal acceleration:**
```python
import torch
print("Metal available:", torch.backends.mps.is_available())
```

✅ **Reduce steps (trades quality for speed):**
```python
image = pipe(prompt="...", num_inference_steps=20).images[0]  # vs default 25
```

### Out of Memory (VRAM exhaustion)

✅ **Close other applications** — Free up RAM before FLUX

✅ **Use float16 precision:**
```python
pipe = pipe.to(torch.float16)  # Halves VRAM usage, slight quality reduction
```

✅ **Generate at non-peak times** — Use night batch scheduling

### Quality Issues (Blurry, wrong subject)

✅ **More descriptive prompt:**
```
❌ "make a chair"
✅ "professional product photography: modern ergonomic office chair, 
    stainless steel frame, black leather seat, studio lighting, white background,
    sharp details, high quality"
```

✅ **More inference steps:**
```python
image = pipe(prompt="...", num_inference_steps=30).images[0]  # More detail
```

## Comparison to SDXL

| Aspect | SDXL | FLUX | Use |
|--------|------|------|-----|
| Speed | 30–60s | 2–4 min | SDXL for speed |
| Quality | Good | Premium | FLUX for quality |
| Detail | High | Very high | FLUX for precision |
| Batch | ✓ Ideal | ⚠️ Slow | SDXL for batches |
| Prompt adherence | Good | Excellent | FLUX for exact spec |

**Use SDXL for 95% of work. Use FLUX for premium 5%.**

## Scheduling for Night Batch

```bash
# Cron job: 2 AM daily
0 2 * * * /usr/bin/nice -n 10 python ~/pipeline/generate_flux_batch.py

# Or via Office nightly scheduler
# See: operations/runbooks/local-video-generation-setup.md → "Scheduling for Night Batch Processing"
```

## References

- **Repo:** [black-forest-labs/flux](https://github.com/black-forest-labs/flux)
- **Model:** [FLUX.1-dev on HuggingFace](https://huggingface.co/black-forest-labs/FLUX.1-dev)
- **Inference guide:** [GitHub README](https://github.com/black-forest-labs/flux/blob/main/README.md)

## Remember

FLUX is your **premium image generator for when quality is critical**. It's slower than SDXL, so schedule batch runs at night. Use sparingly for hero images, product photography, and marketing assets where the extra quality ROI is worth the compute time.

**Save FLUX for the 5% of images that need premium quality.**
