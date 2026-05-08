---
name: wave-local
description: Wave — Local talking head synthesis. Generate speaking character videos from static image + audio. 60-90 seconds per 30-second video. Best-in-class quality. Zero platform costs.
---

# Wave (Local) — Talking Head Synthesis

## What This Skill Is For

Generate high-quality talking head videos from a static portrait image + audio narration. Perfect for avatars, characters, presenters, video introductions, and educational content.

## Use This Skill When

- **Talking head intros** — Character speaking directly to camera
- **Avatar videos** — Consistent character across multiple videos
- **Educational content** — Narrator character walking through concepts
- **Sales videos** — Spokesperson delivering pitch
- **Personalized messages** — Custom avatar responses
- **Best quality needed** — Superior to Sadtalker, more natural motion

## Do Not Use This Skill For

- **Screen recording** — Use OBS instead
- **Animated motion graphics** — Use FLUX or design tools instead
- **Simple image generation** — Use `/stable-diffusion-local` instead
- **Face synthesis from scratch** — Use `/roop-local` (though Wave can work with any portrait)

## Performance Profile

| Metric | Value |
|--------|-------|
| Speed | 60–90 seconds per 30-second video |
| Quality | Best-in-class (state-of-the-art) |
| VRAM | 8–12 GB |
| Metal acceleration | Yes (Apple Silicon) |
| Input formats | PNG, JPG, MP4 audio |
| Output | MP4 (H.264) |
| Cost | Zero |

## Installation & Setup

See: `operations/runbooks/local-video-generation-setup.md` → Section "2. Wave (Talking Heads)"

**Installation summary:**
```bash
git clone https://github.com/Stability-AI/stable-audio-tools.git ~/ai-models/wave
cd ~/ai-models/wave
pip install -r requirements.txt
```

## Usage Patterns

### Pattern 1: Simple Talking Head

```bash
# Input: portrait.png (head shot image), narration.wav (audio)
# Output: talking_head.mp4 (person speaking)

python ~/ai-models/wave/inference.py \
  --image portrait.png \
  --audio narration.wav \
  --output talking_head.mp4
```

### Pattern 2: Multiple Takes (A/B Testing)

```python
# Generate same character with different audio

import subprocess

audios = [
    ("welcome.wav", "welcome_video.mp4"),
    ("pitch.wav", "pitch_video.mp4"),
    ("closing.wav", "closing_video.mp4"),
]

for audio_file, output_file in audios:
    cmd = [
        "python", "~/ai-models/wave/inference.py",
        "--image", "avatar.png",
        "--audio", audio_file,
        "--output", output_file
    ]
    subprocess.run(cmd)
    print(f"✓ Generated {output_file}")
```

### Pattern 3: Batch Production (Pipeline)

```bash
#!/bin/bash
# Generate 10 talking head videos from scripts

for i in {1..10}; do
    # Step 1: Generate audio (via TTS — see STB pipeline)
    microsoft_tts --text "script_$i.txt" --output "audio_$i.wav"
    
    # Step 2: Generate talking head
    wave_generate --image "avatar.png" \
                  --audio "audio_$i.wav" \
                  --output "talking_head_$i.mp4"
    
    echo "✓ Completed video $i/10"
done
```

## Input Requirements

### Portrait Image

- **Format:** PNG, JPG, WebP
- **Recommended size:** 512×512 to 1024×1024
- **Content:** Head shot, face visible, neutral or pleasant expression
- **Lighting:** Even lighting, no harsh shadows on face
- **Background:** Simple (can be removed if needed)

### Audio

- **Format:** WAV, MP3, AAC, M4A
- **Sample rate:** 16 kHz or 44.1 kHz recommended
- **Channels:** Mono or stereo
- **Duration:** Any length (longer = longer video)
- **Quality:** Clear speech (script reading or TTS)

## Advanced Options

### Customization Flags

```bash
# Control head movement intensity
wave_generate --image portrait.png \
              --audio narration.wav \
              --head-movement 0.8  # 0–1 scale

# Control eye contact
wave_generate --image portrait.png \
              --audio narration.wav \
              --eye-contact 0.9  # More direct gaze

# Custom background
wave_generate --image portrait.png \
              --audio narration.wav \
              --background "studio.png"

# Output resolution
wave_generate --image portrait.png \
              --audio narration.wav \
              --resolution 1080p  # 720p, 1080p, 2k
```

## Integration with Video Pipeline

**Use case: Generate talking head intro, then compose into final video**

```bash
# Step 1: Generate talking head (Wave)
python wave_generate.py --image avatar.png --audio intro.wav --output intro_video.mp4

# Step 2: Generate background (SDXL or FLUX)
python sdxl_generate.py --prompt "professional office background" --output background.png

# Step 3: Compose into final video (FFmpeg)
ffmpeg -i intro_video.mp4 -i background.png \
       -filter_complex "scale=1920:1080" \
       -c:v libx264 -c:a aac final_video.mp4
```

## Troubleshooting

### Video Quality Issues (Jittery, Artifacts)

✅ **Improve portrait image:**
- Use well-lit headshot
- Neutral expression
- Face visible and centered

✅ **Adjust flags:**
```bash
wave_generate --image portrait.png --audio narration.wav \
              --head-movement 0.6  # Reduce if too jittery
```

### Audio Sync Issues (Lips out of sync)

✅ **Ensure correct audio format:**
```bash
# Resample if needed
ffmpeg -i audio.mp3 -ar 16000 audio-16k.wav
```

✅ **Re-run with resampled audio:**
```bash
wave_generate --image portrait.png --audio audio-16k.wav --output output.mp4
```

### Out of Memory

```bash
# Use float16 precision
wave_generate --image portrait.png --audio narration.wav --precision float16
```

### Installation Issues

See: `operations/runbooks/local-video-generation-setup.md` → Troubleshooting section

## Comparison to Alternatives

| Tool | Speed | Quality | Setup | Cost |
|------|-------|---------|-------|------|
| **Wave** | 60–90s | Best | Medium | Free |
| Sadtalker | 45–60s | Good | Medium | Free |
| HeyGen | 30s | Good | Easy (cloud) | Paid |
| D-ID | 20s | Good | Easy (cloud) | Paid |

**Wave is the best free, local option for high-quality talking heads.**

## References

- **Repo:** [Stability-AI/stable-audio-tools](https://github.com/Stability-AI/stable-audio-tools)
- **Docs:** [GitHub Wiki](https://github.com/Stability-AI/stable-audio-tools/wiki)
- **Model:** [HuggingFace](https://huggingface.co/Stability-AI/stable-audio-tools)

## Remember

Wave is your **high-quality talking head generator**. Use it when character synthesis matters. Combine with Stable Diffusion backgrounds or FLUX premium backgrounds for full production quality.

**Fast enough to batch at night. Good enough for professional content.**
