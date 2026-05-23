---
name: video-generation-smart-router
description: Smart model selector for local video/image generation. Classifies task intent and routes to best model (SDXL, Wave, FLUX, Roop). Optimizes for quality + resource efficiency. Zero platform costs.
---

# Video Generation Smart Router

## What This Skill Is For

Intelligently route video/image generation tasks to the best local model based on:
- **Task type** (thumbnail, talking head, product photo, etc.)
- **Quality requirements** (quick/good/premium)
- **Speed constraints** (urgent, normal, batch at night)
- **Resource availability** (VRAM, CPU hours available)

## Use This Skill When

- **User says:** "Generate visual content for X" (intentionally vague)
- **Multiple models could work** but you need to choose optimal one
- **Balancing quality vs. speed** (know the tradeoff)
- **Batch processing** at night (schedule heavy models appropriately)
- **Complex workflows** (chaining multiple models)

## Do Not Use This Skill For

- **Single explicit task** — If user says "make a thumbnail", just use SDXL directly
- **Model already specified** — If user says "use FLUX", don't reroute
- **Non-generation tasks** — Routing only helps for image/video generation

## Routing Logic

### Task Classification → Model Selection

```
User request
    ↓
[Classify intent]
    ↓
    ├─→ Thumbnail? → SDXL (fast, good enough)
    ├─→ Talking head? → Wave (best quality)
    ├─→ Product photo (premium)? → FLUX (slow, premium)
    ├─→ Batch Pinterest (50x)? → SDXL Turbo (fast batch)
    ├─→ Avatar/face-swap? → Roop (consistent)
    ├─→ Simple icon/graphic? → SDXL (fast)
    └─→ E-commerce hero image? → FLUX (quality matters)
    ↓
[Execute on selected model]
    ↓
Output to next pipeline stage
```

---

## Routing Decision Matrix

| Task Type | Best Model | Speed | Quality | VRAM | When |
|-----------|-----------|-------|---------|------|------|
| **Thumbnail** | SDXL | 30–60s | Good | 6–8 GB | Anytime |
| **Pinterest batch (50x)** | SDXL | 25–50s each | Good | 6–8 GB | Batch at night |
| **Social graphic** | SDXL | 30–60s | Good | 6–8 GB | Anytime |
| **Talking head** | Wave | 60–90s | Best | 8–12 GB | Anytime |
| **Avatar intro** | Wave | 60–90s | Best | 8–12 GB | Anytime |
| **Product photo** | FLUX | 2–4 min | Premium | 18–20 GB | Batch at night |
| **Marketing hero** | FLUX | 2–4 min | Premium | 18–20 GB | Batch at night |
| **Batch backgrounds** | SDXL | 30–60s each | Good | 6–8 GB | Batch at night |
| **Face swap** | Roop | 30–120s | Good | 4–8 GB | Anytime |
| **Avatar consistency** | Roop | 30–120s | Good | 4–8 GB | Anytime |
| **Simple icon** | SDXL | 30–60s | Adequate | 6–8 GB | Anytime |
| **Detailed graphic** | FLUX | 2–4 min | Premium | 18–20 GB | Batch at night |

---

## Usage: Typical Workflows

### Workflow 1: YouTube Video Production

```
Task: "Create a YouTube video with intro, talking head, and thumbnail"

Router analysis:
  1. Thumbnail → SDXL (fast) ✓
  2. Talking head intro → Wave (quality) ✓
  3. Background visuals → SDXL (fast) ✓
  
Pipeline:
  $ python smart_router.py --task "youtube_video" --title "My Tutorial"
  
Execution order:
  1. Generate thumbnail (SDXL) — 30s
  2. Generate backgrounds (SDXL) — 2 min for 3 images
  3. Generate talking head (Wave) — 60s
  4. Compose video (FFmpeg) — 10s
  
Total time: ~4 minutes
Quality: Professional
```

### Workflow 2: E-commerce Product Shoot

```
Task: "Create product marketing assets (4 hero images, social posts)"

Router analysis:
  1. Hero images (premium) → FLUX (quality) ✓
  2. Social thumbnails → SDXL (fast) ✓
  3. Background variations → SDXL (fast) ✓
  
Pipeline:
  $ python smart_router.py --task "ecommerce_product" --title "New Chair"
  
Execution order:
  1. Generate 4 hero images (FLUX) — 10 min (schedule at night)
  2. Generate 10 social variants (SDXL) — 5 min
  
Total time: 15 minutes
Quality: Premium
Recommendation: Run FLUX at night; SDXL anytime
```

### Workflow 3: Batch Content (50 Pinterest Pins)

```
Task: "Create 50 Pinterest pins for different topics"

Router analysis:
  All → SDXL Turbo (ultra-fast batch) ✓
  
Pipeline:
  $ python smart_router.py --task "batch_social" --count 50
  
Execution order:
  1. Generate all 50 pins (SDXL Turbo) — 15 min total
  
Total time: 15 minutes
Quality: Good (Pinterest doesn't require premium)
Recommendation: Schedule at night with 90% CPU
```

### Workflow 4: Avatar Campaign (10 Videos)

```
Task: "Create 10 avatar videos with same character, different scripts"

Router analysis:
  1. Audio generation (TTS) — STB pipeline ✓
  2. Talking head (Wave) — 10 videos ✓
  3. Avatar variations (Roop) — if needed ✓
  
Pipeline:
  $ python smart_router.py --task "avatar_batch" --count 10
  
Execution order:
  1. Generate audio (TTS) — 5 min
  2. Generate talking heads (Wave) — 10 min
  3. Post-processing — 2 min
  
Total time: 17 minutes
Quality: Best-in-class
Recommendation: Schedule at night, 85% CPU
```

---

## Smart Router Implementation

### Pseudo-code

```python
def route_generation_task(task_type, **kwargs):
    """
    Classify task and route to best model
    """
    
    routing = {
        "thumbnail": {
            "model": "stable-diffusion-local",
            "speed": "fast",
            "time_estimate": "45s",
            "quality": "good",
            "schedule": "anytime",
            "vram_needed": "6–8 GB",
            "batch_friendly": True,
        },
        "talking_head": {
            "model": "wave-local",
            "speed": "medium",
            "time_estimate": "75s",
            "quality": "best",
            "schedule": "anytime",
            "vram_needed": "8–12 GB",
            "batch_friendly": False,
        },
        "product_photo_premium": {
            "model": "flux-local",
            "speed": "slow",
            "time_estimate": "3–4 min",
            "quality": "premium",
            "schedule": "batch_night",
            "vram_needed": "18–20 GB",
            "batch_friendly": True,
        },
        "avatar": {
            "model": "roop-local",
            "speed": "medium",
            "time_estimate": "60–90s",
            "quality": "good",
            "schedule": "anytime",
            "vram_needed": "4–8 GB",
            "batch_friendly": True,
        },
        # ... more mappings
    }
    
    # Get route
    route = routing.get(task_type, "stable-diffusion-local")  # default to SDXL
    
    # Check constraints
    if kwargs.get("quality") == "premium":
        route = routing["flux-local"]  # Upgrade to FLUX
    
    if kwargs.get("urgent"):
        route = routing["stable-diffusion-local"]  # Downgrade to SDXL if urgent
    
    return route
```

### CLI Usage

```bash
# Simple classification
python smart_router.py --classify "I need a thumbnail for YouTube"
# Output: stable-diffusion-local, 45s, good quality, 6–8 GB

# Complex workflow
python smart_router.py --task "youtube_video" \
  --title "Tutorial" \
  --quality "high" \
  --batch "no"
# Output: Multi-step pipeline with model selection for each step

# Batch scheduling
python smart_router.py --task "batch_content" \
  --count 50 \
  --schedule "night"
# Output: Optimal schedule (which models run at night, which daytime)
```

---

## Integration with `/video` Orchestrator

The smart router becomes **Workflow C1f: Smart Model Selection**

```
Video Orchestrator → Workflow C (COMPOSE)
    ├── C1a: Narrated slideshow
    ├── C1b: Short-form reel
    ├── C1c: Talking-head
    ├── C1d: Audio-first
    ├── C1e: Animated sequences (Phase 5+)
    └── C1f: Smart Model Selection ← NEW
            ├── Classify task
            ├── Select best model
            ├── Execute pipeline
            └── Schedule optimization
```

---

## Key Decision Points

### Speed vs. Quality Tradeoff

| Priority | Model | Reason |
|----------|-------|--------|
| **Speed critical** | SDXL | 30–60s, acceptable quality |
| **Balanced** | Wave (if talking head) | 60–90s, best quality |
| **Quality critical** | FLUX | 2–4 min, premium quality |

### Resource Constraints

| Scenario | Action |
|----------|--------|
| **VRAM low** (<12 GB free) | Use SDXL, avoid FLUX |
| **VRAM high** (>16 GB free) | Can use FLUX or Wave |
| **Urgent deadline** | Use SDXL regardless |
| **Night batch time** | Use FLUX or Wave (slower models) |

### Batch Optimization

| Task | Strategy |
|------|----------|
| **50 thumbnails** | All SDXL at night (25 min total) |
| **10 hero images** | FLUX at night (40 min), 2 VRAM-intensive, staggered |
| **5 talking heads** | Wave (5–8 min each, or batch 2x parallel if resources allow) |
| **Mix of above** | SDXL first (thumbnails, quick backgrounds), then FLUX, then Wave |

---

## Scheduling Recommendations

### Daytime (You using Mac)

Use fast models only:
- ✅ SDXL (30–60s)
- ✅ Roop (30–120s)
- ⚠️ Wave (60–90s if needed, ok but slower)
- ❌ FLUX (too slow, blocks daytime work)

### Night (90% Resources Available)

Use all models, prioritize by VRAM:
- ✅ SDXL (batch mode, multiple at once if parallelized)
- ✅ Wave (high quality talking heads)
- ✅ FLUX (premium images, schedule first)
- ✅ Roop (avatar batches)

---

## References

- `/stable-diffusion-local` — SDXL skill
- `/wave-local` — Wave skill
- `/flux-local` — FLUX skill
- `/roop-local` — Roop skill
- `operations/runbooks/local-video-generation-setup.md` — Full setup guide

---

## Remember

The smart router is about **efficiency**: right tool for the job, resource optimization, schedule awareness.

**Default rule:** Use SDXL for 95% of work. Use Wave for talking heads. Use FLUX for 5% premium work. Use Roop for avatars. Let the router decide, but understand the tradeoffs.

**Think about quality + speed + resources. Don't just pick the fanciest model.**
