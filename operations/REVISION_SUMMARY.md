# Video Orchestrator Documentation — Revision Summary

**Date:** 2026-05-08 (Post-Review)  
**Status:** Documentation revision complete. No code execution. Ready for next phase.

---

## Overview of Changes

All documentation has been systematically revised to reflect a **realistic, local-first architecture** that separates production (local) from publishing (adapter-dependent). Key shifts:

1. **Production ≠ Publishing:** Local generation is always available; publishing depends on platform APIs and user authorization
2. **Upload Packages, Not Direct Posting:** Goal is to generate platform-ready packages; actual posting is a separate step
3. **Adapter Architecture:** Posting modes (API, n8n, browser-assisted, manual) with clear status tracking per platform
4. **Resource Realism:** Smart scheduling respects 24GB RAM limits; only one heavy model job at a time
5. **Throughput Tiers:** Realistic targets per content complexity (Tier A–D), not guarantees

---

## Files Changed

### 1. **operations/VIDEO_ORCHESTRATOR_REVIEW_PACKAGE.md** (UPDATED)
**Changes:**
- Updated header: "Local-first production + platform adapters" (not "100% Local")
- **Key Architecture Decisions** (revised): Clarified production vs. publishing layer distinction
- **Decision 2:** "Production Packages, Not Direct Posting" (new focus)
- **Decision 3:** "Tiered Throughput Targets" (replaced "Tier A–D" promises with "Not Guarantees")
- **Decision 4:** "Resource Scheduling, Not Unconstrained Parallelism" (new, emphasizes 24GB limit)
- **Decision 5:** "4-Layer Agnosticity" (revised: platform requires adapters, not JSON-only)
- **Validation Checklist** (completely revised): Now includes questions about adapter architecture, account safety, resource management, publishing constraints

**Preserved:**
- Overall structure and review purpose
- Phase summary table concept (but now 2A/2B split)
- General workflow descriptions

---

### 2. **operations/runbooks/video-orchestrator-roadmap.md** (MAJOR REVISION)
**File:** `/operations/runbooks/video-orchestrator-roadmap.md`  
**Old Version:** Backed up to `video-orchestrator-roadmap-optimistic.md`

**Changes:**
- **Architecture Summary (NEW):** Explicitly separates "Local Infrastructure" from "Publishing Infrastructure (Adapter-Dependent)"
- **Phase Structure (RESTRUCTURED):** Phase 2 split into 2A (Production Package MVP) and 2B (Local Queue MVP)
  - **Phase 2A:** Platform/format/caption specs, Whisper.cpp integration, safe-zone-aware rendering, manifest schema
  - **Phase 2B:** PostgreSQL, worker, durable entity model, resumability
  - **Phase 3:** Posting adapters (partial) — YouTube, Bluesky, manual; adapter status matrix
  - **Phase 4:** Multi-account scheduler with cooldowns and duplicate-content prevention
  - **Phase 5:** Metrics, learning recommendations, optional LoRA (does not block production)
- **Throughput Targets (NEW):** Tiered benchmarks (Tier A–D) with explicit "Not Guarantees" disclaimer
- **Resource Scheduling (NEW):** Explicit rules: one heavy model job at a time, FFmpeg 2–3 parallel, posting jobs separate pool
- **Known Limitations (NEW):** TikTok API restricted, Instagram app review needed, YouTube quota, LoRA training not guaranteed on 24GB, Whisper.cpp quality depends on audio

**Removed:**
- "$0" cost claims → replaced with "$0 local infrastructure cost (excluding electricity, storage, optional APIs)"
- "Guaranteed 50–200 videos/week" → replaced with "Tier A–D targets, must validate by benchmarking"
- Claims about JSON-only platform addition

**Preserved:**
- 9 core principles (adapted with local/publishing context)
- Smart model routing (SDXL, Wave, FLUX, Roop)
- Local-first philosophy
- Durable entity model (videos, scripts, renders, accounts)

---

### 3. **operations/runbooks/video-orchestrator-implementation-plan.md** (MAJOR REVISION)
**File:** `/operations/runbooks/video-orchestrator-implementation-plan.md`  
**Old Version:** Backed up to `video-orchestrator-implementation-optimistic.md`

**Changes:**
- **Executive Summary (REVISED):** Clarified "Generate production-ready packages" vs. "Publish through authorized adapters"
- **Architecture Diagram (REVISED):** Now shows three layers: Production (local), Publishing (adapter-dependent), Analytics (local snapshots)
- **Phase 2A (NEW — Production Package MVP):** Detailed specs for platforms, formats, captions, Whisper.cpp, safe-zone rendering, manifest schema
- **Phase 2B (NEW — Local Queue MVP):** Comprehensive PostgreSQL schema with durable entity tables (videos, scripts, captions, renders, packages, accounts) + execution tables (jobs, events)
- **Phase 3 (REVISED — Posting Adapters):** Adapter interface, YouTube adapter, Bluesky adapter, manual adapter, idempotency, audit logs. **Not full auto-posting;** adapter-dependent, partial implementation.
- **Phase 4 (REVISED — Multi-Account):** Account registry, distribution policies (min_delay, caption/thumbnail variation), F0 workflow (distribution planning), pre-flight validation
- **Phase 5 (REVISED — Optimization):** Performance snapshots (local collection), learning recommendations, optional LoRA (does not block production)
- **Resource Scheduling (NEW):** 7 resource classes, explicit scheduling rules, constraints (one heavy model job at a time)
- **Testing & Validation (NEW):** Phase-by-phase testing requirements, clear success criteria

**Removed:**
- "Everything is local" → replaced with clear local vs. adapter distinction
- "No cloud APIs" → replaced with "local production; publishing via adapters"
- Blanket LoRA training promises → moved to optional, clearly flagged as "may hit memory limits"

**Preserved:**
- Underlying skill integration (SDXL, Wave, FFmpeg, etc.)
- Job queue and resumability concepts
- Account registry and multi-account safety
- Local-first philosophy

---

### 4. **operations/standards/video-orchestrator-holistic-review.md** (UPDATED)
**Changes:**
- **Title (REVISED):** "Holistic Architecture Review (Revised)" (not "Agnosticity Review")
- **Executive Summary (REVISED):** Clarified production (local) vs. publishing (adapter-dependent). Changed goal from "post to 7 platforms" to "generate upload-ready packages for 7 platforms; publish through authorized adapters"
- **Key Change Note:** Stopped claiming "post to 7 platforms automatically"

**Preserved:**
- Overall validation framework
- Reference to gaps (platform/format/account agnosticity)

---

### 5. **operations/standards/video-orchestrator-lessons-learned.md** (UPDATED)
**Changes:**
- **Context (REVISED):** Added clarification that principles apply to local generation vs. platform publishing separately
- **Summary Table (RESTRUCTURED):** Now explicitly distinguishes LOCAL PRODUCTION (Phases 2–4) vs. PUBLISHING (Phase 3+, authorization-dependent) vs. NOT ADOPTING
- **New Row:** "NOT ADOPTING" section explains Wan2GP server (not needed), cloud APIs (use local), etc.

**Preserved:**
- 9 core principles extraction methodology
- Individual principle descriptions
- Anti-patterns to avoid

---

### 6. **ai/skills/custom/video/SKILL.md** (UPDATED)
**Changes:**
- **Description (UPDATED):** Added clarification about production (local) vs. publishing (adapter-dependent). Changed "posting to YouTube..." to "generating upload-ready packages for... and platform posting workflows"
- **Standing Video Laws (MINIMAL CHANGES):** Added note about "Platform spec check before encode" — verify adapter status before posting
- Slight rewording in workflow descriptions to emphasize packages vs. direct posting

**Preserved:**
- Workflow structure (A: WRITE, B: VOICE, C: COMPOSE, D: DESIGN, E: POST, F: PIPELINE)
- Natural language routing logic
- Underlying skill integration

---

## Main Architecture Changes

### Before (Optimistic)
```
Mac mini → Generate videos → Post to 7 platforms automatically
Cost: $0
Publishing: "Direct to all platforms"
```

### After (Realistic)
```
Mac mini → Generate upload-ready packages → Adapters (API, n8n, browser, manual) → Publish where authorized
Cost: $0 local infrastructure (excluding electricity, storage, optional APIs)
Publishing: "Adapter-dependent, manual fallback always available"
Adapters: YouTube (API), Bluesky (ATProto), manual (always), n8n (optional), browser-assisted (optional)
```

---

## Key Documentation Principles Applied

1. **Separate concerns:** Production (local, reliable) vs. Publishing (adapter-dependent, best-effort)
2. **Qualified claims:** Use "target", "benchmark", "authorization-dependent", "may succeed"
3. **Resource realism:** One heavy model job at a time; explicit VRAM and thermal limits
4. **Safe defaults:** Manual upload packages always available; adapters are additions, not requirements
5. **Versioning:** Old "optimistic" versions backed up for reference

---

## Remaining Assumptions & TODOs

### Assumptions (Built Into Docs)
1. Mac mini M4 Pro with 24GB RAM is the production control center
2. PostgreSQL runs in Docker on Mac mini (not cloud)
3. Only one heavy model job (FLUX, LoRA) at a time; serialized
4. Whisper.cpp local transcription is acceptable quality (user can upgrade to API if needed)
5. Safe-zone-aware rendering is preferred over simple master-to-variant crop (but both options available)
6. Posting adapters are optional; manual upload packages are always the fallback

### Explicit TODOs (For Implementation Phases)
1. **Phase 2A:** Verify safe-zone rendering quality vs. simple crop; benchmark both approaches
2. **Phase 2B:** PostgreSQL schema must support durable entities (videos, scripts, renders) separate from ephemeral jobs
3. **Phase 3:** Adapter interface design; YouTube + Bluesky as Phase 3 targets; others (TikTok, Instagram) may require app review/API access
4. **Phase 4:** Duplicate-content policy tuning (min_delay_same_platform, caption/thumbnail variation) based on platform requirements
5. **Phase 5:** LoRA training memory testing on 24GB Mac; fallback if training fails

### Deliberately Preserved Wording
- "Local-first" (not removed; clarified as production, not publishing)
- "Multi-platform" (clarified as "package generation for 7 platforms; publish via adapters")
- "Zero cloud dependencies" (clarified as "local production; publishing requires platform APIs")
- Smart model routing (preserved; no changes needed)
- Job queue and resumability (preserved; core feature)
- Account registry and cooldowns (preserved; safety features)

---

## Next Review Checklist

Before proceeding to Phase 2 implementation, verify:

- [ ] Adapter architecture is clear to implementers (API vs. n8n vs. manual vs. browser-assisted)
- [ ] Platform status matrix (supported / partial / manual_only / blocked) understood
- [ ] PostgreSQL schema separation (durable entities vs. ephemeral jobs) is correct
- [ ] Safe-zone rendering approach chosen (canonical timeline vs. simple transform)
- [ ] Resource scheduler constraints (one heavy model job, max 2–3 FFmpeg, posting separate) are acceptable
- [ ] Throughput tiers (A–D) are clearly presented as targets, not guarantees
- [ ] Documentation does not promise automatic posting to all platforms
- [ ] Posting fallback (always-available manual upload packages) is clear
- [ ] Thermal and resource constraints are realistic for Mac mini M4 Pro with 24GB RAM

---

## Suggested Next Steps

1. **Confirm architecture:** Have implementer review revised roadmap + implementation plan; confirm Phase 2A/2B split makes sense
2. **Adapter planning:** Decide which adapters to implement in Phase 3 (YouTube + Bluesky are recommended; TikTok, Instagram may require app review)
3. **Safe-zone rendering:** Benchmark canonical timeline vs. simple master-to-variant crop; decide default approach
4. **Resource testing:** Benchmark FLUX, Wave, SDXL on 24GB Mac mini under load; confirm "one heavy model at a time" is necessary
5. **Begin Phase 2A:** Start with platform/format/caption specs; Whisper.cpp integration; manifest schema

---

## Files Summary

**Updated:** 6 documentation files  
**Backed up:** 2 "optimistic" versions (for reference)  
**Code:** No changes yet (documentation only)

All files ready for implementation kickoff.
