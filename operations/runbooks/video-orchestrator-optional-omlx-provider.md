# Video Orchestrator — Optional oMLX Local LLM Provider Adapter

**Status:** Optional future adapter  
**Scope:** Local text/agent inference provider for Apple Silicon  
**Not required for:** FFmpeg rendering, Whisper.cpp captions, thumbnail extraction, manual upload packages, or platform posting

---

## Purpose

`oMLX` can be evaluated as an optional local LLM provider for the Video Orchestrator.

The Video Orchestrator remains the control plane. oMLX is not a replacement for the orchestrator, the PostgreSQL queue, media adapters, manifests, or posting adapters.

Use oMLX only as a provider behind a future LLM-provider interface.

---

## What oMLX Is Useful For

Potential local tasks:

- script drafts
- hook/title/description variants
- hashtag/tag suggestions
- package QA summaries
- caption cleanup
- metadata linting
- local review passes
- low-risk batch text generation
- fallback/offline drafts when cloud LLMs are unavailable or too expensive

---

## What oMLX Is Not For

Do not use oMLX as the primary mechanism for:

- FFmpeg rendering
- media encoding
- thumbnail extraction
- Whisper.cpp transcription
- SDXL/FLUX/Wave/Roop media generation
- CapCut or Remotion rendering
- platform posting
- OAuth or credential flows
- analytics API polling

Those remain separate adapters.

---

## Recommended Architecture

```text
Video Orchestrator
├─ PostgreSQL queue/state
├─ production package manifests
├─ media adapters
│  ├─ FFmpeg render
│  ├─ FFmpeg thumbnail
│  ├─ Whisper.cpp captions
│  ├─ optional Remotion
│  └─ optional CapCut/manual polish
├─ publishing adapters
│  ├─ manual upload
│  ├─ dry-run API preflight
│  └─ future authorized APIs
└─ LLM provider adapters
   ├─ Claude / cloud LLM provider
   ├─ OpenAI-compatible provider
   ├─ oMLX local provider
   └─ fallback provider
```

---

## Proposed Future Job Type

Do not implement this until a dedicated LLM-provider phase.

Example shape:

```json
{
  "job_type": "llm_text",
  "video_id": "00000000-0000-4000-8000-000000000001",
  "task_config": {
    "provider": "omlx",
    "provider_base_url": "http://localhost:8000/v1",
    "model": "local-model-name",
    "task": "metadata_variants",
    "fallback_provider": "cloud_default",
    "input": {
      "script_path": "/path/to/script.md",
      "platform": "youtube",
      "package_target": "long-form"
    },
    "output_path": "/path/to/metadata-variants.json"
  }
}
```

---

## Provider Contract Draft

A future LLM adapter should support:

- `validateConfig()`
- `validateProviderAvailability()`
- `estimateCostAndLatency()`
- `executeTextTask()`
- `validateOutputSchema()`
- `fallback()`

The adapter should return structured results:

```json
{
  "status": "succeeded",
  "provider": "omlx",
  "model": "local-model-name",
  "network_scope": "local_only",
  "tokens_in": 0,
  "tokens_out": 0,
  "output_path": "/path/to/result.json",
  "warnings": []
}
```

---

## Safety Rules

- oMLX is optional.
- Do not make oMLX required for production.
- Do not block the Video Orchestrator if oMLX is offline.
- Do not send secrets, tokens, cookies, platform credentials, `.env` values, or private account credentials to local LLM prompts.
- Do not use oMLX outputs for final publishing metadata without validation.
- Use schema validation for generated metadata.
- Keep cloud LLM fallback available for high-quality reasoning or tasks that exceed the local model.
- Benchmark quality and latency before enabling in batches.

---

## Evaluation Plan

1. Install oMLX separately from the orchestrator.
2. Start the local server.
3. Download or load one model that fits comfortably on the Mac mini.
4. Test OpenAI-compatible local chat calls.
5. Benchmark tasks:
   - 10 titles
   - 10 hook variants
   - 10 YouTube descriptions
   - 10 package QA summaries
6. Compare against current cloud/default model results.
7. Decide which tasks are safe to route locally.
8. Implement the provider adapter only after quality and reliability are acceptable.

---

## Recommended Initial Use Cases

Good first tasks:

- title variants
- hook variants
- hashtag suggestions
- metadata summaries
- low-stakes script rewrites
- package checklist summaries

Avoid at first:

- final compliance-sensitive metadata
- account-specific publishing decisions
- legal/medical/financial claims
- anything requiring current web knowledge unless the prompt includes verified sources

---

## Phase Recommendation

Add this as a later optional phase:

```text
Phase 3X — Optional Local LLM Provider Adapter
```

or after the first posting adapters:

```text
Phase 4X — Local LLM Optimization Provider
```

Do not interrupt the current Phase 3 posting-adapter work.
