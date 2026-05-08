---
name: stable-diffusion-local
description: Local Stable Diffusion SDXL for fast image generation. Use for thumbnails, quick visuals, batch content. 30-60 seconds per image. Zero platform costs. Metal-accelerated on Apple Silicon.
---

# Stable Diffusion (Local) — Fast Image Generation

## What This Skill Is For

Generate images quickly and locally using Stable Diffusion SDXL without any platform costs. Optimized for thumbnails, social media graphics, batch content, and quick visual prototypes.

## Use This Skill When

- **Thumbnails** — YouTube, social media (need 30-second turnaround)
- **Batch content** — 50 Pinterest pins, 20 promotional graphics
- **Quick mockups** — Visual prototypes, concept exploration
- **Social graphics** — Instagram posts, Twitter headers, LinkedIn banners
- **Fast iteration** — Multiple variations for A/B testing

## Do Not Use This Skill For

- **Premium product photography** — Use `/flux-local` instead (better quality, slower)
- **Talking head synthesis** — Use `/wave-local` instead
- **Avatar/face synthesis** — Use `/roop-local` instead
- **When quality matters most** — If image perfection is critical, upgrade to FLUX.1-dev

## Performance Profile

| Metric | Value |
|--------|-------|
| Speed | 30–60 seconds per image |
| Quality | Good (baseline) |
| VRAM | 6–8 GB |
| Metal acceleration | Yes (Apple Silicon) |
| Batch friendly | Yes (can run 50x in series) |
| Cost | Zero |

## Installation & Setup

See: `operations/runbooks/local-video-generation-setup.md` → Section "1. Stable Diffusion (SDXL)"

**Verify installation:**
```bash
python3 << 'EOF'
from diffusers import StableDiffusionXLPipeline
import torch
pipe = StableDiffusionXLPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0")
print("✓ Stable Diffusion loaded successfully")
EOF
```

## Usage Patterns

### Pattern 1: Single Image (Quick)

```python
from diffusers import StableDiffusionXLPipeline
import torch

pipe = StableDiffusionXLPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0")
pipe = pipe.to("mps")  # Metal acceleration

image = pipe(
    prompt="YouTube thumbnail: bold typography, high contrast, modern design, bright colors"
).images[0]

image.save("thumbnail.png")
```

### Pattern 2: Batch Generation (Pinterest)

```python
from diffusers import StableDiffusionXLPipeline
import torch

pipe = StableDiffusionXLPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0")
pipe = pipe.to("mps")

prompts = [
    "minimalist design: plant on white background",
    "minimalist design: coffee cup on marble",
    "minimalist design: productivity planner",
    # ... more prompts
]

for i, prompt in enumerate(prompts):
    image = pipe(prompt=prompt).images[0]
    image.save(f"pin_{i:02d}.png")
    print(f"✓ Generated pin_{i:02d}.png")
```

### Pattern 3: Image Variations (A/B Testing)

```python
pipe = StableDiffusionXLPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0")
pipe = pipe.to("mps")

base_prompt = "professional product photo: modern chair"

variations = [
    base_prompt + ", studio lighting, white background",
    base_prompt + ", natural lighting, wooden floor",
    base_prompt + ", dramatic lighting, dark background",
]

for i, prompt in enumerate(variations):
    image = pipe(prompt=prompt).images[0]
    image.save(f"variation_{i}.png")
```

## Prompt Engineering Tips

### Good Prompts

✅ **Specific and visual:**
```
"YouTube thumbnail: bold red text saying 'How To Make $10K', shocked face reaction, 
high contrast, 1280x720"
```

✅ **Style indicators:**
```
"minimalist flat design, modern, clean, white space, high quality"
```

✅ **Include aspect ratio:**
```
"Instagram post, 1080x1080, colorful gradient, product mockup"
```

### Avoid

❌ **Vague:**
```
"make something nice"
```

❌ **Over-constrained:**
```
"exact photorealistic rendering of the Mona Lisa with exact color correction"
```

## Performance Optimization

### Speed Up Generation

```python
# Use float16 precision (halves quality slightly, 20% faster)
pipe = pipe.to(torch.float16)

# Or use smaller model variant (faster, lower quality)
pipe = StableDiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5")
```

### Memory Management

```python
# Clear memory between batches
import torch
torch.mps.empty_cache()

# Monitor memory
import psutil
mem = psutil.virtual_memory()
print(f"Available: {mem.available / 1e9:.1f} GB")
```

## Integration with Video Pipeline

**Use case: Generate backgrounds for video composition**

```bash
# Step 1: Generate background image
python generate_sdxl.py --prompt "abstract gradient background, modern, blue and purple"

# Step 2: Compose into video (via FFmpeg in `/video` skill)
ffmpeg -i background.png -i narration.wav -c:v libx264 output.mp4
```

## Troubleshooting

### Slow Generation (>2 minutes per image)

✅ **Check Metal acceleration:**
```python
import torch
print("Metal available:", torch.backends.mps.is_available())
```

✅ **Use smaller model:**
```python
from diffusers import StableDiffusionPipeline
pipe = StableDiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5")
```

### Out of Memory Error

```python
# Use float16
pipe = pipe.to(torch.float16)

# Or unload model, generate one at a time
pipe = None  # Clear model
torch.mps.empty_cache()
```

### Installation Issues

See: `operations/runbooks/local-video-generation-setup.md` → Troubleshooting section

## References

- **Repo:** [Stable Diffusion XL](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
- **Docs:** [Diffusers Library](https://huggingface.co/docs/diffusers)
- **Model card:** [SDXL](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)

## Remember

Stable Diffusion is your **fast, lightweight workhorse for batch content**. For premium quality, upgrade to FLUX.1-dev. For talking heads, use Wave. This skill handles 80% of image generation needs quickly.

**Use it for volume. Use FLUX for quality.**
