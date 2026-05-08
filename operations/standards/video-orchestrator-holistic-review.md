# Video Orchestrator — Holistic Architecture Review (Hardened)

**Date:** 2026-05-08  
**Purpose:** Validate the revised `/video` orchestrator architecture after the local-first hardening pass.

---

## Executive Summary

The revised architecture is now directionally sound: `/video` should be treated as a **local production orchestrator** first and a **publishing coordinator** second.

The correct target is:

> Generate complete upload-ready packages locally for each target platform, then publish only through authorized adapters or manual upload.

This means the system can be reliable even when platform APIs are unavailable, credentials expire, app review is pending, or rate limits change.

---

## Core Architecture Verdict

### What is approved

- **Local production layer:** Approved. Script, audio, captions, image/video generation, composition, thumbnails, manifests, local queueing, and local analytics snapshots belong on the Mac mini.
- **Production package model:** Approved. Each platform target should receive an upload-ready package containing video, captions, thumbnail, metadata, and a manifest.
- **Adapter-dependent publishing:** Approved. Direct publishing must be treated as optional and authorization-dependent.
- **PostgreSQL + worker queue:** Approved, provided durable production entities are separated from ephemeral job execution rows.
- **Resource-aware scheduling:** Approved. On a 24 GB unified-memory Mac, heavy model jobs should be serialized by default.
- **Multi-account scheduler:** Approved with safety policies: cooldowns, account health, duplicate-content prevention, caption/thumbnail variation, and adapter status checks.

### What is not approved

- Claims that the system can automatically publish to every platform without credentials, app review, API limits, or manual fallbacks.
- Claims that new platforms are JSON-only. New formats can be JSON-only; new platforms require specs plus an adapter.
- Claims that 50–200 videos/week is guaranteed. Throughput must be benchmarked by content tier.
- Treating LoRA training as a core MVP dependency. It belongs in optional Phase 5+ experimentation.
- Treating 16:9 master crop as the default for all vertical/square outputs. Safe-zone templates or canonical timelines should be the default for complex layouts.

---

## 1. Platform Agnosticity

### Revised standard

Platform agnosticity means the production system can prepare packages for platforms without rewriting the core pipeline. It does **not** mean the system can publish to every platform without adapter work.

A platform requires:

- `platform-specs.json` entry
- `format-specs.json` entry
- `caption-specs.json` entry when applicable
- posting adapter status
- auth and credential requirements
- known rate limits / quota limits
- manual fallback path
- last verification metadata

### Required spec fields

```json
{
  "platform": "youtube",
  "source_url": "https://developers.google.com/youtube/v3",
  "last_verified_at": "2026-05-08",
  "verification_frequency_days": 30,
  "posting_modes": ["api", "manual"],
  "adapter_status": "partially_supported",
  "supports_direct_publish": true,
  "supports_scheduling": true,
  "supports_analytics": true,
  "requires_app_review": false,
  "requires_paid_plan": false,
  "known_failure_modes": ["quota_limits", "oauth_expiry", "processing_delay"],
  "manual_fallback": true
}
```

### Adapter statuses

Use these exact statuses unless there is a strong reason to add more:

- `supported`
- `partially_supported`
- `manual_only`
- `blocked_pending_credentials`
- `blocked_pending_app_review`
- `disabled`

### Current target platforms

The orchestrator may target packages for:

- YouTube long-form
- YouTube Shorts
- TikTok
- Instagram Reels
- Instagram Feed
- LinkedIn
- Facebook
- Bluesky
- X

But publishing is adapter-dependent. Phase 3 should target only 1–2 authorized adapters first, plus the manual adapter.

---

## 2. Format Agnosticity

### Revised standard

Format agnosticity means the pipeline can render multiple output variants from a shared production source without duplicating creative work unnecessarily.

The correct default is:

1. Build a canonical production timeline from script, audio, captions, visual assets, and layout metadata.
2. Render aspect-specific variants from that timeline using safe-zone-aware templates.
3. Use simple FFmpeg crop/scale only when the content is center-safe and visually simple.

### Rendering modes

| Mode | Use when | Risk |
|---|---|---|
| Canonical timeline | Talking heads, text overlays, product demos, templates, captions | More render work, better quality |
| Simple transform | Static backgrounds, center-safe visuals, low-risk clips | Can crop faces/text/products |

### Required outputs

Every production package should know:

- resolution
- aspect ratio
- codec
- bitrate target
- audio codec
- captions mode: external, burned-in, both, none
- safe-zone template
- thumbnail requirements
- file size / duration constraints if known

---

## 3. Caption Agnosticity

Captions are first-class production assets, not optional post-processing.

The pipeline should create:

- raw transcript JSON
- SRT
- VTT
- optional burned-in caption video
- caption timing metadata
- caption style metadata for templates

Whisper.cpp is the default local transcription path. Cloud transcription can be added as an optional quality fallback, but it is not part of the local-first MVP.

---

## 4. Account Agnosticity

### Revised standard

Account agnosticity means the system can safely choose among many accounts and posting targets without hardcoding account assumptions.

Required pieces:

- account registry
- credential references, not raw secrets
- per-account status
- daily limit
- burst limit
- minimum cooldown
- failure streak
- duplicate-content policy
- account topic fit
- adapter status per platform/account

### Required policy fields

```json
{
  "min_delay_same_platform_minutes": 30,
  "caption_variation_required": true,
  "thumbnail_variation_required": false,
  "duplicate_content_policy": "stagger_and_vary_metadata",
  "account_topic_fit_required": true,
  "manual_approval_required": false
}
```

### Safety rule

Never assume that posting the same video to many accounts simultaneously is safe. The scheduler should stagger posts and, where configured, vary captions, thumbnails, or hooks.

---

## 5. Queue and State Design

### Approved entity split

Durable production entities:

- projects
- series
- videos
- scripts
- audio assets
- image/video assets
- captions
- renders
- production packages
- accounts
- posting targets
- posting jobs
- performance snapshots
- events

Execution entities:

- jobs
- leases
- retries
- worker events

Jobs should not be the source of truth for videos. Jobs execute work; videos and packages preserve production state.

### State machines

Use separate state machines:

```text
video_state:
planned → scripted → voiced → assets_ready → captions_ready → composed → variants_ready → ready_to_post → partially_posted → posted → archived

job_state:
pending → leased → running → succeeded | failed | cancelled | dead

posting_state:
draft → scheduled → uploading → processing → published | failed | needs_manual
```

Posting jobs must use idempotency keys to prevent duplicate uploads after retries.

---

## 6. Resource Scheduling

The Mac mini should be treated as a production control center with constrained local acceleration, not a render farm.

Resource classes:

- `cpu_light`
- `media_encode`
- `image_fast`
- `image_heavy`
- `talking_head`
- `posting`
- `analytics`

Rules:

- Run only one heavy model job at a time by default.
- Prefer FLUX and LoRA-like jobs at night.
- Allow limited FFmpeg parallelism after benchmarking.
- Keep posting and metadata jobs in a separate pool.
- Track RAM pressure and thermal state where possible.
- Treat throughput tiers as benchmark targets, not promises.

---

## 7. Platform Fact-Check Notes

These notes should guide specs and adapter design. They should not be hardcoded as permanent truth; platform docs must be re-verified periodically.

- **YouTube:** Uploads use the YouTube Data API and OAuth. Quota costs and daily quotas can change. Specs must store `last_verified_at`, quota assumptions, and failure modes.
- **TikTok:** Direct posting requires the Content Posting API flow and app/product access. Manual or browser-assisted fallback should remain available.
- **Instagram/Facebook:** Publishing depends on Meta APIs, account type, permissions, app review, and OAuth setup. Manual fallback should remain available.
- **Bluesky:** Video posting is possible through ATProto, but video limits and email verification requirements apply and may change.
- **X/LinkedIn:** Rate limits, API plan restrictions, and permissions must be treated as adapter constraints, not production constraints.

---

## Revised Implementation Roadmap

### Phase 2A — Production Package MVP

Goal: one source video becomes upload-ready packages for every target platform.

Must include:

- platform specs
- format specs
- caption specs
- Whisper.cpp transcription
- safe-zone templates
- production manifest schema
- manual upload package generator

### Phase 2B — Local Queue MVP

Goal: no lost work.

Must include:

- PostgreSQL schema
- durable production entities
- jobs as execution-only rows
- worker leases
- retry/resume
- event log

### Phase 3 — Posting Adapters

Goal: publish only where authorization is real.

Must include:

- adapter interface
- manual adapter
- 1–2 authorized API adapters
- idempotency
- posting audit logs

### Phase 4 — Multi-Account Scheduler

Goal: safe account distribution.

Must include:

- account registry
- cooldowns
- duplicate-content policy
- credential references
- account health
- distribution manifest

### Phase 5 — Optimization

Goal: improve future batches.

Must include:

- performance snapshots
- manual metrics import
- analytics dashboard or CSV export
- learning recommendations
- optional LoRA experiments only after benchmarking

---

## Final Verdict

The revised plan is good enough to move into Phase 2A **only if** the documentation remains aligned with this hardened architecture:

- local production first
- packages before publishing
- adapters are optional and authorization-dependent
- captions are first-class
- safe-zone templates are the default for complex layouts
- queue state is separated from production state
- multi-account posting is safety-gated
- throughput and LoRA remain benchmark-dependent
