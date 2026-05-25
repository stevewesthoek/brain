# Stable Audio 3 CLI

## Overview

Stable Audio 3 is Stability AI's local audio generation stack. The repo provides the `stable-audio` CLI for:

- text-to-audio generation
- audio-to-audio restyling
- inpainting and continuation
- LoRA-driven personalization

This repo-local install follows the same wrapper pattern as the other machine CLIs in `operations/system-configs/bin/`.

## Installed Location

- Repo checkout: `~/ai-models/stable-audio-3`
- Wrapper: `operations/system-configs/bin/stable-audio-cli`
- Entry point: `stable-audio-cli`

The wrapper resolves to:

```bash
uv run --directory ~/ai-models/stable-audio-3 stable-audio
```

If you need to override the repo path for debugging:

```bash
STABLE_AUDIO_3_REPO=/path/to/stable-audio-3 stable-audio-cli --help
```

## Installation

### 1. Clone the repo

```bash
mkdir -p ~/ai-models
git clone https://github.com/Stability-AI/stable-audio-3.git ~/ai-models/stable-audio-3
```

### 2. Sync dependencies

From the repo directory:

```bash
cd ~/ai-models/stable-audio-3
uv sync
```

Base install is enough for the CLI. Add extras only if you need them:

```bash
uv sync --extra ui
uv sync --extra lora
uv sync --extra ui --extra lora
```

### 3. Make the wrapper available

The wrapper is stored in `operations/system-configs/bin/stable-audio-cli`. On this machine, the usual `~/.local/bin` symlink setup should expose it in `PATH`.

If the symlink is missing, create it the same way as other local wrappers on this machine.

### 4. Warm the model caches

Use the helper to download the three models this repo cares about:

```bash
stable-audio-warmup
```

That runs short generations for:

- `small-music`
- `small-sfx`
- `medium`

You can warm a subset too:

```bash
stable-audio-warmup small-music small-sfx
```

## How It Works

`stable-audio-cli` is only a thin launcher. It does not implement audio generation itself.

What happens when you call it:

1. `uv` enters the cloned Stable Audio 3 checkout.
2. `uv run` resolves the repo's pinned Python environment.
3. The `stable-audio` console entry point from the repo runs.
4. The first model request downloads the selected weights into the local Hugging Face cache.

Model selection is done with `--model`:

- `small-music` for music-only, CPU-friendly generation
- `small-sfx` for sound effects-only, CPU-friendly generation
- `medium` for highest local quality, GPU/CUDA required

## CLI Usage

### Help

```bash
stable-audio-cli --help
stable-audio-cli --model medium --help
```

### Text-to-audio

```bash
stable-audio-cli --model small-music -p "lo-fi hip hop beat, 90 BPM" --duration 30 -o beat.wav
stable-audio-cli --model small-sfx -p "a short camera shutter and film rewind" --duration 5 -o sfx.wav
stable-audio-cli --model medium -p "lush cinematic ambient pad with evolving textures" --duration 30 -o ambient.wav
```

### Audio-to-audio

```bash
stable-audio-cli -p "bossa nova bassline" --init-audio input.wav --init-noise-level 0.8 -o out.wav
```

### Inpainting

```bash
stable-audio-cli -p "punchy kick drum fill" --inpaint-audio input.wav --inpaint-start 4 --inpaint-end 8 -o out.wav
```

### Continuation

```bash
stable-audio-cli -p "dreamy synth outro" --inpaint-audio input.wav --inpaint-start 10 --inpaint-end 30 --duration 30 -o out.wav
```

### LoRA

```bash
stable-audio-cli -p "orchestral strings" --lora-ckpt-path my_lora.safetensors --lora-strength 0.8 -o out.wav
```

## Downloading Models

Stable Audio 3 downloads models automatically on first use. The cleanest way to warm the cache is to run a short generation for each model you want available locally.

### Access requirement

The Stable Audio 3 Hugging Face repos are gated. If your Hugging Face account has not been granted access, the first download will fail with `403 Forbidden`.

If that happens:

1. Request access on the model page.
2. Log in locally with `huggingface-cli login` or `hf auth login`.
3. Re-run the warmup helper.

### Small music

```bash
stable-audio-cli --model small-music -p "test tone" --duration 5 -o /tmp/stable-audio-small-music.wav
```

### Small SFX

```bash
stable-audio-cli --model small-sfx -p "test effect" --duration 5 -o /tmp/stable-audio-small-sfx.wav
```

### Medium

```bash
stable-audio-cli --model medium -p "test pad" --duration 5 -o /tmp/stable-audio-medium.wav
```

On first run, each command downloads the selected weights and then caches them locally for later use.

## Hardware Notes

- `small-music` and `small-sfx` are CPU-friendly
- `medium` requires a CUDA-capable GPU
- `medium` also requires Flash Attention 2; if output sounds like static, check that `flash_attn` imports correctly
- On this macOS machine, the upstream `flash-attn` package is not currently installable in the same way it is on Linux/CUDA hosts, so `medium` falls back to the non-Flash Attention path here.

Reference check:

```bash
cd ~/ai-models/stable-audio-3
uv run python -c "import flash_attn; from flash_attn import flash_attn_func; print('Version:', flash_attn.__version__, '| flash_attn_func:', flash_attn_func)"
```

## Troubleshooting

- If `stable-audio-cli` is not found, confirm `~/.local/bin` is in `PATH`.
- If the wrapper fails, confirm `~/ai-models/stable-audio-3` exists and `uv sync` completed successfully.
- If `medium` produces static, reinstall or verify Flash Attention before retrying.
- If the first run is slow, that is expected while the model downloads and caches.
- If `flash_attn` cannot be installed on this machine, that is a platform limitation rather than a repo problem.
- If model download fails with `403 Forbidden`, the Hugging Face repo is gated for your account and you need access approval.

## References

- Repo: https://github.com/Stability-AI/stable-audio-3
- Models: https://huggingface.co/collections/stabilityai/stable-audio-3
- Extra models: https://huggingface.co/collections/stabilityai/stable-audio-3-extra
