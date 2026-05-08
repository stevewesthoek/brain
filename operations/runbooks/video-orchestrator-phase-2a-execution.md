# Video Orchestrator Phase 2A — Production Package MVP (Execution Guide)

**Date:** 2026-05-08  
**Phase:** 2A (Production Package MVP)  
**Timeline:** May 30 – Jun 10, 2026  
**Objective:** Generate upload-ready production packages for 9 platform targets. No automatic posting. Manual fallback always available.

---

## Overview

Phase 2A produces **upload-ready packages**, not published posts. The goal is to generate:

- One source video project
- Multiple platform-optimized variants (5 formats: 16:9, 9:16, 1:1, 4:5, lightweight)
- Captions in multiple formats (SRT, VTT, JSON)
- Platform-specific metadata (titles, descriptions, hashtags)
- Thumbnails optimized per platform
- Complete manifest showing what's ready for each platform
- Manual upload instructions as fallback for all targets

**Adapters (Phase 3A+)** will use these packages to export manual upload folders first, then add authorized posting later. If adapters fail or are unavailable, manual upload packages are always available.

---

## What Was Implemented

### 1. Specification Files

Created four specification files in `operations/specs/video-orchestrator/`:

#### **platform-specs.json**
- 9 platform targets with detailed specs
- Each platform includes:
  - `posting_modes`: How it can be uploaded (api, manual, browser_assisted, n8n, disabled)
  - `adapter_status`: Current readiness (partially_supported, manual_only, blocked_pending_app_review, blocked_pending_credentials, blocked_api_restricted, disabled)
  - `supports_direct_publish`: Can adapters post automatically (Phase 3)
  - `title_rules`, `description_rules`, `hashtags_rules`, `thumbnail_rules`, `caption_rules`: Platform-specific constraints
  - `manual_fallback`: True for all (always available)
  - `known_failure_modes`: Common issues to handle
  - `manual_upload_instructions`: Step-by-step for user

**Platform targets (9):**
- YouTube long-form (partially_supported: OAuth API available)
- YouTube Shorts (partially_supported: OAuth API available)
- TikTok (manual_only: app review required)
- Instagram Reels (manual_only: app review required)
- Instagram Feed (manual_only: app review required)
- LinkedIn (manual_only: experimental API)
- Facebook (manual_only: app review required)
- Bluesky (partially_supported: ATProto API open)
- X (manual_only: requires paid tier, API restricted)

#### **format-specs.json**
- 5 video formats covering all use cases
- Each format specifies:
  - `aspect_ratio`, `resolution`
  - `safe_area`: Safe zone for text/UI (canonical_timeline or simple_transform mode)
  - `codec`, `audio_codec`, `container`, `bitrate_target_kbps`, `fps`
  - `rendering_mode_default`: How to create this format from master
  - `captions_mode_default`: How captions should be applied
  - `notes`: Use cases and platform alignment

**Formats:**
- `landscape_1920x1080_16x9` → YouTube long-form, LinkedIn, Facebook
- `vertical_1080x1920_9x16` → YouTube Shorts, TikTok, Instagram Reels
- `square_1080x1080_1x1` → Instagram Feed, Bluesky, X
- `portrait_1080x1350_4x5` → Instagram Feed (preferred)
- `lightweight_1280x720_16x9` → X, Bluesky (bandwidth-constrained)

#### **caption-specs.json**
- Caption format specifications (SRT, VTT, JSON)
- Whisper.cpp local transcription as default
- Burn-in (hardcoded) support per platform
- External caption support matrix per platform/target
- Caption styling metadata (font, color, position)
- Fallback behavior if transcription/burn-in fails

#### **production-package.schema.json**
- Complete JSON schema for production package manifest
- Required fields: video_id, created_at, render_outputs, package_targets
- Structure supports:
  - Multiple render outputs (all formats)
  - Multiple caption outputs (SRT, VTT, JSON, all languages)
  - Thumbnail outputs per format
  - Per-platform package targets with metadata
  - Verification and completeness tracking
  - Errors and warnings
  - Manual upload instructions

### 2. Production Package Manifest Structure

Each production package contains:

```
{
  "video_id": "unique-identifier",
  "created_at": "2026-05-08T12:00:00Z",
  "source_script_path": "...",
  "source_audio_path": "...",
  "source_assets": [...],
  
  "render_outputs": [
    { format_key, path, resolution, duration, file_size, bitrate, captions_burned },
    ...
  ],
  
  "caption_outputs": [
    { format: "srt", language: "en", path, transcription_method, confidence },
    ...
  ],
  
  "thumbnail_outputs": [
    { format_key, path, generation_method, extraction_timecode },
    ...
  ],
  
  "package_targets": [
    {
      "platform": "youtube",
      "package_target": "long-form",
      "adapter_mode": "api",
      "adapter_status": "partially_supported",
      "video_path": "...",
      "captions": { primary_format: "srt", caption_files: [...] },
      "thumbnail_path": "...",
      "title": "...",
      "description": "...",
      "hashtags": [...],
      "upload_ready": true,
      "manual_steps": [...],
      "known_limitations": [...]
    },
    ... (one per platform target)
  ],
  
  "verification": {
    "status": "complete",
    "completeness_percent": 100,
    "all_formats_rendered": true,
    "all_captions_generated": true,
    "all_thumbnails_generated": true
  },
  
  "errors": [],
  "warnings": []
}
```

---

## What Is Intentionally NOT Implemented

### 1. No Automatic Posting
- Phase 2A does NOT post to any platform
- Adapters (Phase 3) will handle posting
- All platforms have `manual_fallback: true`

### 2. No Platform API Integration
- No YouTube OAuth token handling
- No Bluesky ATProto authentication
- No Meta/Facebook API credential storage
- Platform integration deferred to Phase 3 adapters

### 3. Database and Queue Were Deferred From Phase 2A, Then Implemented in Phase 2B
- Phase 2A itself was specs-only and did not include PostgreSQL execution.
- Phase 2B added the PostgreSQL-backed worker and durable production package records.
- Phase 2C added real local FFmpeg/thumbnail adapters and optional Whisper.cpp caption execution.

### 4. Posting Adapter Interface Is Still Deferred
- No platform posting adapter is implemented in Phase 2A/2B/2C.
- Posting jobs are intentionally Phase 2B-safe no-ops.
- Adapter architecture remains Phase 3 work.

### 5. Resource Scheduler Is Still Deferred
- The worker can execute jobs and validate artifacts, but full resource-class scheduling is not implemented yet.
- Thermal/RAM monitoring and worker-pool limits remain future work before scaling batches.

---

## How Specs Are Structured

### Platform Specs (`platform-specs.json`)
Each platform entry represents ONE **platform target** (not a single platform):
- YouTube appears **twice** (long-form + shorts)
- Instagram appears **twice** (reels + feed)
- Others appear once

This design supports:
- Different rules per format on same platform
- Different adapters per format (e.g., YouTube API for long-form, manual for Shorts if API breaks)
- Clear package target naming

### Format Specs (`format-specs.json`)
Define **rendering targets**, not platform-specific variants:
- `landscape_1920x1080_16x9`: Source format for YouTube long-form, LinkedIn, Facebook
- `vertical_1080x1920_9x16`: Source format for YouTube Shorts, TikTok, Instagram Reels
- `square_1080x1080_1x1`: Source format for Instagram Feed, Bluesky, X
- Derived from these via safe-zone rendering or simple transform

**Safe Zone Modes:**
- `canonical_timeline`: Render multiple variants separately (16:9, 9:16, 1:1, 4:5) to preserve critical content in safe zones
- `simple_transform`: Render once at highest res, crop/scale for variants (faster, less storage, acceptable for less critical content)

### Caption Specs (`caption-specs.json`)
Maps caption capabilities per platform:
- YouTube: External SRT/VTT upload supported
- TikTok/Instagram: Hardcoded only (burned into video)
- Others: Hardcoded recommended for accessibility

**Transcription:**
- Default: Whisper.cpp local (no cloud cost)
- Fallback: User may opt-in to API if quality insufficient

---

## How Manual Fallback Works

Every platform target in `package_targets` includes:

1. **Complete metadata**
   - Title, description, hashtags, tags
   - All platform rules applied
   - Upload-ready format

2. **Manual upload instructions**
   - Step-by-step for web/app upload
   - Required vs. optional fields listed
   - Links to platform upload pages

3. **File paths**
   - Video file (platform-optimized format)
   - Caption files (SRT, VTT, or hardcoded)
   - Thumbnail

4. **Known limitations**
   - Platform-specific gotchas documented
   - Workarounds if available

**User flow if adapters fail:**
1. Open production package manifest
2. Find desired platform target in `package_targets` array
3. Follow `manual_steps` for that platform
4. Copy video, captions, thumbnail from paths provided
5. Fill in title, description, hashtags from manifest
6. Upload manually via platform web/app

**Manual fallback is always complete and usable**, even if adapters are not yet implemented or are blocked.

---

## Package Targets vs. Platforms

| Concept | Definition | Count | Example |
|---------|-----------|-------|---------|
| **Platform** | Social media service | ~9 | YouTube, TikTok, Instagram, etc. |
| **Platform Target** | Specific format on platform | ~13 | YouTube long-form, YouTube Shorts, Instagram Reels, Instagram Feed |
| **Package Target** | Upload package for one platform target | ~13 | One complete set of video, captions, metadata for YouTube Shorts |
| **Format** | Video rendering specification | ~5 | 16:9 1920x1080, 9:16 1080x1920, etc. |

**One source video produces:**
- 5 rendered format variants (covers all platform needs)
- 3 caption variants (SRT, VTT, JSON)
- 5 thumbnail variants (one per format)
- 13 package targets (one per platform target)

Total output per source: ~26 files (5 videos + 3 captions + 5 thumbnails + 13 metadata/manifest = 26 logical files, may be combined).

---

## Safe-Zone Rendering Approaches

### Canonical Timeline Mode (Preferred for Quality)
Render each format separately at its native resolution:
- `16:9 1920x1080`: Master format, render once, use as-is for YouTube long-form / LinkedIn / Facebook
- `9:16 1080x1920`: Render separately (vertical timeline), preserve all content in safe zone
- `1:1 1080x1080`: Render separately (square timeline), center critical content
- `4:5 1080x1350`: Render separately, tailored for Instagram Feed

**Pros:**
- Optimal for each platform (no cropping artifacts)
- Safe zones are truly safe (no content loss)
- Pixel-perfect per format

**Cons:**
- Requires separate render for each format (~5x rendering time)
- Higher storage (separate video files)
- Slower throughput

### Simple Transform Mode (Fast, Acceptable)
Render master format once (e.g., 1920x1080), derive others via FFmpeg:
- Render `16:9 1920x1080` once
- Crop to `1:1 1080x1080` from center (fast FFmpeg crop)
- Upscale/downscale to `9:16` (fast FFmpeg scale)
- Resample to `4:5` (fast FFmpeg scale)

**Pros:**
- Single render, ~5x faster
- Lower storage
- Suitable for simple content

**Cons:**
- Potential cropping of critical content (edges cut off)
- Scaling artifacts on very simple graphics
- Less predictable output

**Recommendation:**
- Use **canonical timeline** for content-heavy, high-quality productions (avatars, talking heads, product videos)
- Use **simple transform** for text-over-image, music videos, animations where centering is safe

Both approaches are supported by `format-specs.json`. The Phase 2C worker uses FFmpeg for simple local transforms and still-image-plus-audio renders where enough local inputs are provided.

---

## What Must Be Verified Before Phase 3 Posting Adapters

### 1. Format Rendering
- [ ] Test canonical timeline: Do all 5 formats render correctly from source timeline?
- [ ] Test simple transform: Does FFmpeg crop/scale maintain quality for each target?
- [ ] Test safe zones: Are critical elements (captions, faces, logos) preserved in safe zones?
- [ ] Test with 1–2 real videos before full Phase 3 rollout

### 2. Caption Integration
- [ ] Does Whisper.cpp produce acceptable SRT quality? (Manually review 2–3 samples)
- [ ] Can SRT/VTT files be hardcoded into video without artifacts?
- [ ] Do hardcoded captions appear correctly in all 5 formats?
- [ ] Test external caption upload for YouTube (SRT via YouTube API)

### 3. Thumbnail Generation
- [ ] SDXL thumbnail generation: Does it align with platform aspect ratios?
- [ ] Frame extraction: Is selected frame representative of video?
- [ ] Resizing: Do thumbnails scale properly to format-specific resolutions?

### 4. Manifest Schema
- [ ] Does manifest validate against `production-package.schema.json`?
- [ ] Can manifest be parsed by downstream tools (Phase 3 adapters, user interface)?
- [ ] Are all required fields populated?

### 5. Platform Spec Accuracy
- [ ] Verify platform rules with official documentation (may have changed)
- [ ] Test manual uploads for 2–3 platforms using specs as guide
- [ ] Update `last_verified_at` and `verification_frequency_days` after testing

### 6. Manual Upload Workflow
- [ ] Follow manual instructions for YouTube long-form: Does package work end-to-end?
- [ ] Follow manual instructions for TikTok: Does package work end-to-end?
- [ ] Verify all file paths in manifest are correct
- [ ] Verify all metadata (title, description, hashtags) comply with platform rules

---

## Acceptance Checklist

### Deliverables
- [x] `platform-specs.json` created with 9 platform targets
- [x] `format-specs.json` created with 5 video formats
- [x] `caption-specs.json` created with transcription + caption styles
- [x] `production-package.schema.json` created and validates as JSON Schema
- [x] `video-orchestrator-phase-2a-execution.md` created (this file)
- [x] Phase 2B/2C implementation code created to consume these specs

### Verification
- [x] JSON files are valid JSON (run `python -m json.tool` on each)
- [x] Schema is valid JSON Schema (structured per draft-07 spec)
- [x] No raw secrets or credentials in any file
- [x] No hardcoded API keys or tokens
- [x] No direct platform posting code
- [x] Docs do not claim automatic posting
- [x] All 9 platform targets referenced consistently
- [x] Manual fallback documented for all targets
- [x] Safe-zone rendering approaches documented and optional
- [x] Captions as first-class asset in schema

### Documentation
- [ ] Update `ai/skills/custom/video/SKILL.md` to reference Phase 2A specs (optional, only if needed)
- [ ] Update decision-log.md with Phase 2A completion (do this after approval)

### Code Readiness for Phase 2B
- [x] Specs are final and ready for Phase 2B worker to consume
- [x] Schema is final; Phase 2B will populate manifests per this schema
- [x] Format specs ready for FFmpeg composition logic
- [x] Caption specs ready for Whisper.cpp integration
- [x] Platform specs ready for adapter interface design (Phase 3)

---

## Next Review Checklist (Before Phase 3 Posting Adapters)

Verify with implementer:

- [x] Specifications are clear and actionable
- [x] Format choices (5 formats) sufficient for all 9 platform targets
- [x] Safe-zone rendering approach supports simple FFmpeg transform first
- [ ] Whisper.cpp transcription acceptable as default once a local binary/model are configured
- [x] Manifest schema matches implementation expectations
- [ ] Platform specs match latest platform documentation (rules may change)
- [ ] Any missing platforms or package targets to add?
- [ ] Storage plan for manifest + all variants (estimated file count and size)?

---

## Phase 2A → Phase 2B/2C Handoff

**What Phase 2B/2C does with Phase 2A specs:**

1. **Implement PostgreSQL schema** to store video entities (separate from jobs)
   - Manifests will be serialized/stored in database per video_id
   - Queries will reference format-specs, platform-specs, caption-specs

2. **Implement worker process** to execute rendering jobs
   - Worker calls FFmpeg with specs from format-specs.json when local source media is provided
   - Worker calls Whisper.cpp only when a compatible local binary and model path are configured
   - Worker generates manifests per production-package.schema.json

3. **Implement safe-zone rendering**
   - Phase 2C chooses local FFmpeg transform behavior per format
   - Placeholder or invalid media remains excluded from upload-ready completeness

4. **Implement caption integration**
   - Phase 2C integrates Whisper.cpp using caption-specs config when available
   - Generates or preserves SRT, VTT, JSON outputs
   - Burn-in captions remain a later production quality pass

5. **Implement manual upload instructions**
   - Phase 2B/2C populates manual_steps per platform from platform-specs.json
   - Includes file paths, metadata, and local artifact provenance in the manifest

**Phase 3 will do with Phase 2A + 2B:**

1. Implement adapter interface (base class + per-platform adapters)
2. Consume manifests from Phase 2B
3. Post to platforms using adapter_mode, adapter_status, and manual_fallback as guides
4. Log posting results to job queue / event log

---

## Assumptions

1. **Mac mini M4 Pro (24GB RAM)** is production control center
   - Phase 2B worker will run on this hardware
   - Resource constraints apply (one heavy model at a time)

2. **Whisper.cpp quality is acceptable** as default local transcription
   - If not, user can configure API fallback
   - Quality will be verified in acceptance phase

3. **Safe-zone rendering is preferred but optional**
   - Both approaches (canonical timeline, simple transform) supported
   - Implementation choice made in Phase 2B

4. **Manual upload is always fallback**, even if adapters available
   - Users should never be forced to use adapters
   - Manual packages must always be complete and usable

5. **Platform specs are current as of 2026-05-08**
   - Verification frequency noted (90 days typical)
   - Specs will be updated before Phase 3 if platforms change

---

## TODOs (Deferred to Phase 2B)

1. **Implement manifest generation logic**
   - Code to populate production-package manifest per schema
   - Validation logic to ensure completeness

2. **Implement safe-zone rendering**
   - FFmpeg/Remotion composition logic
   - Test with real videos

3. **Implement Whisper.cpp integration**
   - Local transcription pipeline
   - Multi-format caption output (SRT, VTT, JSON)

4. **Implement thumbnail generation**
   - SDXL + frame extraction
   - Format-specific resizing

5. **Implement manual upload documentation**
   - Generate per platform-specs.json
   - Include in manifest per platform target

6. **Implement acceptance testing**
   - End-to-end test with 1–2 real videos
   - Validate all 5 formats, captions, thumbnails
   - Manual upload test for 2–3 platforms

---

## Files Delivered

```
operations/specs/video-orchestrator/
├── platform-specs.json                     (9 platform targets, adapter status, rules)
├── format-specs.json                       (5 video formats, safe zones, codec specs)
├── caption-specs.json                      (transcription, burn-in, external caption support)
├── production-package.schema.json          (manifest schema for complete video package)
└── (this file)

operations/runbooks/
├── video-orchestrator-phase-2a-execution.md (Phase 2A guide and acceptance checklist)
└── (other existing files unchanged)
```

---

## Status

**Phase 2A Documentation Complete ✅**

- Specifications finalized and ready for Phase 2B implementation
- No code executed (specs-only phase as intended)
- All 9 platform targets specified with conservative adapter statuses
- Manual fallback available for all targets
- Production package manifest schema ready
- Safe-zone rendering approaches documented and optional

**Phase 2A Ready for Review**

Next step: Submit specs to user/stakeholders for approval before Phase 2B implementation begins (Jun 10).
