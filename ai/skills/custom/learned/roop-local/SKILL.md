---
name: roop-local
description: Roop — Local face synthesis and avatar creation. Generate face-swap videos, consistent avatars, character variations. 30-120 seconds per video. Zero platform costs.
---

# Roop (Local) — Face Synthesis & Avatar Creation

## What This Skill Is For

Generate face-swap videos, create consistent avatars, and produce character variations using local face synthesis. Perfect for avatar-based content, character consistency, and visual variety.

## Use This Skill When

- **Avatar creation** — Consistent character across multiple videos
- **Face swaps** — Apply one face to different body/contexts
- **Character variations** — Same character, different outfits/settings
- **Personalization** — Viewers see their face in videos (if applicable)
- **Quick character generation** — Generate speaking character without Wave

## Do Not Use This Skill For

- **Talking head synthesis** — Use `/wave-local` instead (better quality)
- **Static character images** — Use `/stable-diffusion-local` instead
- **Premium avatar quality** — Wave produces better results
- **Complex animations** — Use dedicated animation tools

## Performance Profile

| Metric | Value |
|--------|-------|
| Speed | 30–120 seconds per video |
| Quality | Good (character consistent) |
| VRAM | 4–8 GB |
| Metal acceleration | Partial (depends on libfacedet) |
| Input formats | MP4, WebM, MOV (video); PNG, JPG (face) |
| Output | MP4 (H.264) |
| Cost | Zero |

## Installation & Setup

See: `operations/runbooks/local-video-generation-setup.md` → Section "4. Roop (Face Synthesis)"

**Installation summary:**
```bash
git clone https://github.com/s0md3v/roop.git ~/ai-models/roop
cd ~/ai-models/roop
pip install -r requirements.txt
```

**Verify:**
```bash
cd ~/ai-models/roop
python roop/main.py --help
```

## Usage Patterns

### Pattern 1: Simple Face Swap

```bash
# Input: target_face.png (face to apply), base_video.mp4 (video to modify)
# Output: swapped_video.mp4 (video with face applied)

python ~/ai-models/roop/main.py \
  --source target_face.png \
  --target base_video.mp4 \
  --output swapped_video.mp4
```

### Pattern 2: Generate Avatar from Headshot

```bash
# Step 1: Record base body motion (stock video, actor, etc.)
# Step 2: Apply consistent face to base video

python ~/ai-models/roop/main.py \
  --source avatar_headshot.png \
  --target actor_walking.mp4 \
  --output avatar_walking.mp4
```

### Pattern 3: Batch Avatar Generation

```python
import subprocess

# Base videos (body/motion templates)
base_videos = [
    "walking.mp4",
    "sitting.mp4",
    "presenting.mp4",
]

# Apply same face to all
for base_video in base_videos:
    output = base_video.replace(".mp4", "_avatar.mp4")
    cmd = [
        "python", "~/ai-models/roop/main.py",
        "--source", "avatar_face.png",
        "--target", base_video,
        "--output", output
    ]
    subprocess.run(cmd)
    print(f"✓ Generated {output}")
```

## Input Requirements

### Source Face Image

- **Format:** PNG, JPG
- **Size:** 256×256 to 512×512
- **Content:** Clear face, neutral lighting
- **Quality:** High-quality headshot preferred
- **Background:** Can be anything (will be extracted)

### Target Video

- **Format:** MP4, WebM, MOV
- **Resolution:** 720p or higher recommended
- **Content:** Person in video (body/motion to reuse)
- **FPS:** 24–60 fps (any common fps works)
- **Duration:** Any length

## Advanced Options

### Quality Control

```bash
# Upscale output to 4K
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --upscale 4

# Blend strength (0–1, higher = more pronounced swap)
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --blend 0.7
```

### Performance Tuning

```bash
# Faster processing (lower quality)
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --quality fast

# Higher quality (slower)
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --quality ultra
```

## Integration with Video Pipeline

**Use case: Generate avatar video, then compose into final production**

```bash
# Step 1: Create base video (real actor or stock footage)
# Step 2: Apply avatar face (Roop)
python ~/ai-models/roop/main.py \
  --source "avatar_face.png" \
  --target "actor_base.mp4" \
  --output "avatar_video.mp4"

# Step 3: Add background (optional)
ffmpeg -i avatar_video.mp4 -i background.png \
       -filter_complex "scale=1920:1080" \
       -c:v libx264 final_video.mp4

# Step 4: Post to platforms (via n8n)
```

## Troubleshooting

### Face Not Detected

✅ **Ensure source face is clear:**
- Good lighting
- Face fully visible
- Neutral expression recommended

✅ **Try different source image:**
```bash
# Use a clearer headshot
python ~/ai-models/roop/main.py \
  --source better_headshot.png \
  --target video.mp4 \
  --output output.mp4
```

### Video Quality Degradation

✅ **Increase quality flag:**
```bash
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --quality ultra
```

✅ **Upscale output:**
```bash
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --upscale 4
```

### Slow Processing

✅ **Use faster quality setting:**
```bash
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video.mp4 \
  --output output.mp4 \
  --quality fast
```

✅ **Reduce video resolution first:**
```bash
# Downscale to 720p, process, upscale result
ffmpeg -i video.mp4 -vf "scale=1280:720" video_720p.mp4
python ~/ai-models/roop/main.py \
  --source avatar.png \
  --target video_720p.mp4 \
  --output output_720p.mp4

# Then upscale result back
ffmpeg -i output_720p.mp4 -vf "scale=1920:1080" output.mp4
```

### Installation Issues

See: `operations/runbooks/local-video-generation-setup.md` → Troubleshooting section

## Comparison to Alternatives

| Tool | Speed | Quality | Avatar Consistency | Cost |
|------|-------|---------|-------------------|------|
| **Roop** | 30–120s | Good | Excellent | Free |
| Wave | 60–90s | Best | N/A | Free |
| HeyGen | 20s | Good | Good | Paid |
| Synthesia | 15s | Good | Good | Paid |

**Roop is the best free option for consistent avatar synthesis.**

## Use Case: Batch Avatar Production

```bash
#!/bin/bash
# Generate 10 avatar videos from different scripts

# Step 1: Generate audio for each script
for i in {1..10}; do
    microsoft_tts --text "script_$i.txt" --output "audio_$i.wav"
done

# Step 2: Create base body motion (reuse same actor video)
# (Assume actor_base.mp4 exists)

# Step 3: Apply face to all
for i in {1..10}; do
    python ~/ai-models/roop/main.py \
      --source "avatar_face.png" \
      --target "actor_base.mp4" \
      --output "avatar_$i.mp4"
    
    # Step 4: Compose with audio
    ffmpeg -i "avatar_$i.mp4" -i "audio_$i.wav" \
           -c:v copy -c:a aac -shortest "final_$i.mp4"
done

echo "✓ Batch complete: 10 avatar videos generated"
```

## References

- **Repo:** [s0md3v/roop](https://github.com/s0md3v/roop)
- **Wiki:** [roop Wiki](https://github.com/s0md3v/roop/wiki)
- **Installation:** [GitHub README](https://github.com/s0md3v/roop)

## Remember

Roop is your **consistent avatar generator**. Use it to apply the same face across multiple video contexts and characters. For pure talking head synthesis, Wave is better. For quick avatar generation, Roop is ideal.

**Great for character consistency, batch avatar production, and visual variety with a single identity.**
