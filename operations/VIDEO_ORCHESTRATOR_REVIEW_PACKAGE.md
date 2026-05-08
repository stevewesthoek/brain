# Video Orchestrator — Complete Review Package (Hardened)

**Date:** 2026-05-08  
**Status:** Revised and hardened after architecture review  
**Architecture:** Local-first production + adapter-dependent publishing  
**Timeline:** 6 months target, phase-by-phase and benchmark-dependent  
**Local Infrastructure Cost:** $0 local infrastructure, excluding electricity, storage, optional paid APIs, optional cloud LLM/TTS, and platform/API plan costs

---

## Review Purpose

This package describes the approved direction for the `/video` orchestrator: a local-first video production system that creates upload-ready packages for many platforms, then publishes only through authorized platform adapters or manual fallback.

The system should not promise automatic posting to every platform. Production is local; publishing is adapter-dependent.

---

## Files for Review

### 1. Roadmap

**File:** `operations/runbooks/video-orchestrator-roadmap.md`

Covers:

- Local-first production studio vision
- Phase 2A / 2B / 3 / 4 / 5 roadmap
- Resource scheduling constraints for Mac mini M4 Pro with 24 GB RAM
- Tiered throughput targets, not guarantees
- Known platform/API limitations
- Manual upload packages as the always-available fallback

### 2. Implementation Plan

**File:** `operations/runbooks/video-orchestrator-implementation-plan.md`

Covers:

- Production, publishing, and analytics layers
- Phase 2A: Production Package MVP
- Phase 2B: Local Queue MVP
- Phase 3: Posting adapters
- Phase 4: Multi-account scheduler
- Phase 5: Optimization and optional LoRA experiments
- Durable production entities separated from execution-only jobs
- State machines for videos, jobs, and posting jobs

### 3. Holistic Architecture Review

**File:** `operations/standards/video-orchestrator-holistic-review.md`

Covers:

- Hardened architecture verdict
- Platform agnosticity versus posting adapter reality
- Format agnosticity with safe-zone-aware templates
- Caption agnosticity with Whisper.cpp as the local default
- Account agnosticity and account-safety policies
- Queue/state design
- Resource scheduling
- Platform fact-check notes

### 4. Lessons Learned

**File:** `operations/standards/video-orchestrator-lessons-learned.md`

Covers:

- Extracted patterns from industry repos
- What is adopted for local production
- What is adapter-dependent for publishing
- What is explicitly out of scope

This file should preserve useful patterns, but any old claims about direct posting or unconstrained parallel model execution should be interpreted through the hardened roadmap.

### 5. Video Skill

**File:** `ai/skills/custom/video/SKILL.md`

Should define the `/video` orchestrator as:

- local production router
- package generator
- caption and safe-zone render coordinator
- publishing coordinator through adapters
- pipeline controller with checkpoint/resume

The skill must not imply that direct posting to all platforms is always available.

---

## Current Approved Architecture

```text
Mac mini local production layer
├─ strategy / hooks / scripts
├─ TTS or voice generation
├─ local transcription and captions
├─ image/video assets
├─ FFmpeg and/or Remotion composition
├─ safe-zone-aware format variants
├─ thumbnails
├─ production manifests
├─ PostgreSQL queue and event log
└─ local performance snapshots

Publishing layer
├─ manual adapter: always available
├─ API adapters: only when credentials, quotas, scopes, and app review allow
├─ n8n wrapper: optional, uses authorized adapters
├─ browser-assisted workflow: optional and fragile
└─ disabled / blocked states for unsupported targets
```

---

## Phase Summary

| Phase | Timeline Target | Focus | Success Criteria |
|---|---:|---|---|
| 0–1 | Done | Smart routing + local models | Local model setup and routing documented |
| 2A | May 30–Jun 10 | Production Package MVP | One source video creates platform-ready packages |
| 2B | Jun 10–Jun 20 | Local Queue MVP | Batch can fail mid-run and resume safely |
| 3 | Jun 20–Jul 15 | Posting Adapters | Manual adapter plus 1–2 real authorized adapters |
| 4 | Jul 15–Aug 15 | Multi-Account Scheduler | Safe account distribution with cooldowns and duplicate-content controls |
| 5 | Aug 15–Sep 15 | Optimization | Metrics snapshots and recommendations; LoRA optional |

Timelines are targets and should be adjusted after benchmarking.

---

## Key Decisions

### Decision 1: Production is local; publishing is adapter-dependent

Local production includes script, audio, captions, visuals, composition, thumbnails, variants, manifests, job queueing, and local analytics snapshots.

Publishing requires platform-specific credentials, scopes, app review, quotas, API behavior, or manual fallback.

### Decision 2: Production packages are the MVP

The core deliverable is not “post everywhere.” The core deliverable is a complete upload-ready package per target platform.

Each package should include:

- video variant
- captions: SRT/VTT/JSON and optional burned-in video
- thumbnail(s)
- title
- description
- hashtags/tags
- account/platform target metadata
- adapter status
- manifest entry

### Decision 3: New formats can be JSON-only; new platforms cannot

A new output format may only need `format-specs.json` and templates.

A new platform requires:

- platform specs
- format specs
- caption specs if applicable
- posting adapter or manual fallback
- auth/OAuth handling
- rate-limit/quota handling
- scheduling behavior
- analytics adapter if metrics are required

### Decision 4: Safe-zone rendering is the default for complex layouts

Do not rely on 16:9 master crop for all variants. Use canonical timelines and templates for vertical, square, landscape, and 4:5 outputs when text, products, faces, captions, or overlays matter.

Use simple FFmpeg crop/scale only for center-safe content.

### Decision 5: Captions are first-class production assets

Use Whisper.cpp as the local default path for transcription and caption generation.

Keep raw caption files and burned-in variants when useful.

### Decision 6: Resource scheduling is mandatory

On a 24 GB unified-memory Mac mini, do not assume all local AI models can run concurrently.

Default rules:

- one heavy model job at a time
- FLUX / LoRA-like work at night by default
- limited FFmpeg parallelism after benchmarking
- posting jobs in a separate pool
- resource pressure and thermal state observed where possible

### Decision 7: Throughput tiers are targets, not promises

| Tier | Content Type | Target Range |
|---|---|---:|
| A | Simple script + TTS + static image + captions + variants | 30–100/week after automation |
| B | Higher-quality thumbnails + multi-format + review | 15–50/week |
| C | Talking-head / avatar / product-heavy | 5–25/week |
| D | FLUX-heavy / LoRA / complex Remotion / multi-account | 2–10/week, benchmark-dependent |

---

## Validation Checklist Before Phase 2A

- [ ] Specs include `source_url`, `last_verified_at`, and verification cadence.
- [ ] Platform specs distinguish package generation from publishing support.
- [ ] Manual adapter exists as the default fallback.
- [ ] Captions are included as first-class assets.
- [ ] Safe-zone rendering is documented and preferred for complex outputs.
- [ ] PostgreSQL design separates durable production entities from execution-only jobs.
- [ ] State machines are separate for videos, jobs, and posting jobs.
- [ ] Posting jobs have idempotency keys.
- [ ] Multi-account policies include cooldowns and duplicate-content controls.
- [ ] Throughput claims are labeled as benchmark targets.
- [ ] LoRA is optional and non-blocking.
- [ ] The skill file does not promise automatic publishing to all platforms.

---

## Remaining Risks

- Platform API policies, limits, and app review requirements can change.
- Browser-assisted posting may be brittle and should not be the reliability foundation.
- Local model performance must be benchmarked on the actual Mac mini.
- LoRA training may exceed practical memory/runtime limits on 24 GB unified memory.
- Multi-account duplicate posting can create spam risk unless staggered and varied.
- Upload quotas may cap API publishing even when local production is fast.

---

## Implementation Go/No-Go

**Go for Phase 2A** if the implementation stays focused on production packages, captions, safe-zone rendering, manifests, and specs.

**No-go for broad platform automation** until Phase 3 validates real credentials, quotas, app permissions, idempotency, and audit logging on one or two adapters.

---

## Next Step

Start Phase 2A only after the `/video` skill and implementation plan are aligned with this package-first, adapter-dependent architecture.
