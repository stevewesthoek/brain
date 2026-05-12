# Video Orchestrator Roadmap — Phase 0 → Phase 5+ (Revised)

**Date Updated:** 2026-05-12 (VO-4E Complete)  
**Status:** Phase 0–1 complete (smart routing, 4 local models). Phase 2A–2E complete (project distribution, packages, drafts, content briefs). Phase 3A–3D complete (media validation, render planning, file existence validation, manifest consistency checks). Phase 3E complete (render execution gate, manual export bundle, operator approval workflow). Phase 3F complete (operator approval records, render-readiness freeze snapshots). Phase 4A complete (render executor contract, dry-run command manifest). Phase 4B complete (renderer preflight environment checks). Phase 4C complete (renderer binary discovery manifests). Phase 4D complete (operator-approved renderer version check plan). Phase 4E complete (mock renderer execution result contract).  
**Roadmap Duration:** 6 months (May 2026 — October 2026)  
**Architecture:** Local-first production + platform adapters (not fully local publishing)

---

## Vision: Local-First Video Production Studio

The `/video` orchestrator will evolve into a **local production control center** that:

- ✅ **Generates production-ready packages** for 7+ platforms (not direct posting)
- ✅ **Local Media Pipeline:** Script generation, TTS, image/video generation, composition, captions, thumbnails — all on Mac mini
- ✅ **Platform Adapters:** Publishing through authorized APIs, n8n, browser-assisted, or manual fallback
- ✅ **Multi-Account Support:** Safe scheduling across many accounts with duplicate-content prevention and cooldowns
- ✅ **Resource-Aware:** Smart scheduling for heavy models (FLUX, LoRA) at night; posting jobs parallel to generation
- ✅ **Resumable:** Mid-pipeline recovery, state tracking, audit logs
- ✅ **Learning Loop:** Track performance snapshots; optionally improve future batches

**NOT included:** Real-time posting to all platforms, guaranteed cloud-free publishing, automatic analytics collection from all APIs, full LoRA training during peak hours.

---

## Architecture Summary

### Local Infrastructure (Mac mini M4 Pro, 24GB RAM)
- 4 local AI models (SDXL, Wave, FLUX, Roop)
- PostgreSQL job queue + worker (Docker)
- Local transcription (Whisper.cpp)
- Script/metadata generation
- Video composition + FFmpeg
- Safe-zone-aware multi-format rendering
- Thumbnail generation
- Manifest and metadata assembly
- Account registry (OS Keychain)
- Performance metrics (local snapshots)

### Publishing Infrastructure (Adapter-Dependent)
- **Authorized APIs:** YouTube, Bluesky (when credentials/auth available)
- **n8n Wrappers:** Optional centralization layer for authorized APIs
- **Browser-Assisted:** Playwright automation for semi-authenticated workflows
- **Manual Fallback:** Always available; user uploads generated package
- Each adapter has status (supported, partial, manual_only, blocked)

### Resource Management
- **Resource Classes:** cpu_light, media_encode, image_fast, image_heavy, talking_head, posting, analytics
- **Scheduling Constraint:** Only one heavy model job at a time (FLUX, LoRA → night mode preferred)
- **Parallelism:** FFmpeg 2–3 concurrent encodes; posting jobs in separate pool
- **Memory:** Track 24 GB shared memory; do not assume all 4 models run concurrently

---

## Phase Summary (Revised Structure)

| Phase | Timeline | Focus | Success Criteria |
|-------|----------|-------|------------------|
| **0–1** | ✅ Done | Smart routing + 4 models installed | Models tested, thermal stable, local setup confirmed |
| **VO-1–1B** | ✅ Done | Scheduler Foundation Hardening | Dry-run scheduler tested, job persistence, quota management, isolated tests |
| **VO-2A** | ✅ Done | Project-Based Distribution Model Foundation | JSON schema for projects; planning model with weekly cadence; dry-run planning only (no job creation, no APIs, no upload) |
| **VO-2B** | ✅ Done | Project Distribution Dry-Run Scheduling | Convert project plans to dry-run scheduler jobs; distribute by posts_per_week and preferred_days; detect duplicates; no APIs, no upload |
| **VO-2C** | ✅ Done | Production Package Foundation (Metadata-Only Drafts) | Metadata-only package draft schema + example + safe draft function; no fake media, no rendering, ready_to_post always false |
| **VO-2D** | ✅ Done | Package Draft Persistence and Local Validation | Local JSON-backed package draft storage; metadata-only validation; no media rendering, no platform APIs, no upload |
| **VO-2E** | ✅ Done | Package Draft CLI, Local Adapter Contracts, and Readiness Reporting | CLI for create/list/validate/status; formal local adapter contract types; readiness summary reporting; no rendering, no APIs, no upload |
| **VO-2F** | ✅ Done | Content Brief/Input Model Foundation | Content brief schema + example; TypeScript validation with safe error messages; local media asset validation contracts (shape/path only); brief-to-draft bridge with safe metadata; no file I/O, no FFmpeg, no upload |
| **VO-3A** | ✅ Done | Local Media Validation Contracts | Media asset validation foundation; blocks absolute paths, URLs, traversal; defers real inspection to VO-3B+; hardened to prevent credential leakage in error messages |
| **VO-3B** | ✅ Done | Local Render Planning & Production Manifest Foundation | Render plan schema + TypeScript types; createLocalRenderPlanFromPackageDraft function; JSON-backed render plan store with sorting; listRenderPlans with project_id/plan_state filters; aggregate readiness report; safe summaries; validates platforms, relative paths, forbidden patterns; dry-run only (ready_for_render=false, ready_for_upload=false); package draft validation (dry-run required, upload-ready blocked, platform matching); 40 tests; no FFmpeg, no file creation, no upload |
| **VO-3C** | ✅ Done | Local File Existence Validation and Manifest Consistency Checks | Safe path resolver (blocks absolute, URLs, traversal, forbidden patterns); file existence validation (disabled/explicit modes); manifest consistency checks for render plans; validation reports with safe summaries; 26 tests; no file creation, no FFmpeg, no upload |
| **VO-3D** | ✅ Done | Manual Render Manifest Checks and Format/Platform Consistency Validation | Spec loaders for format and platform specs (graceful degradation if missing, repo-local only); validateRenderTargetAgainstSpecs validates single targets; validateRenderPlanAgainstLocalSpecs validates all targets; getManualRenderManifestCheckReport aggregates safely; legacy unsafe data sanitization; immutable ready_for_render/upload flags; no file checks/creation/FFmpeg; 23 tests |
| **VO-3E** | ✅ Done | Render Execution Gate, Manual Export Bundle, and Operator Approval Workflow | Four-check render execution gate (plan validation, manifest consistency, file existence, format/platform specs); gate evaluation returns state: blocked/needs_operator_approval/approved_for_manual_render/rejected; manual export bundle schema + example; createManualExportBundleFromGate creates pre-render bundle for operator review; gate and bundle JSON-backed stores with list/get/save functions; sanitized gate/bundle reports with path safety; dry_run=true enforced at type and function level; approval_required=true immutable; no FFmpeg, no file creation, no rendering, no uploads, no platform APIs; ready_for_render/ready_for_upload remain false/0; 14 tests covering gate evaluation, stores, bundle creation, reports, and safety constraints |
| **VO-3F** | ✅ Done | Operator Approval Records and Render-Readiness Freeze | Operator approval record schema + example (immutable audit artifacts); createOperatorApprovalRecord creates approval from gate+bundle with decision state (draft, approved_for_manual_render, rejected, revoked); deterministic freeze snapshots from gate/bundle summaries (no paths, no render_targets, no asset_plan); operator review with checklist/risk acknowledgement; approval validation blocks unsafe content, forbidden patterns, execution commands; JSON-backed approval store with project/platform/state filters; approval revocation with safe reason; aggregated reports with hardcoded ready_for_render/upload=0; all approvals are dry-run only, no rendering capability added, no FFmpeg, no file creation, no uploads, no platform APIs; 14 tests covering schema, creation, validation, stores, reports, freeze snapshots |
| **VO-4A** | ✅ Done | Render Executor Contract and Dry-Run Render Command Manifest | Render command manifest schema + example (planning artifacts only); RenderCommandManifest TypeScript types with immutable constraints (dry_run=true, execution_enabled=false, ready_for_execution/render/upload=false); createRenderCommandManifest builds manifests from approved operator records; validateRenderCommandManifest enforces safety constraints (blocks credentials/execution patterns without echoing); store functions save/list/get manifests with project/platform/state filters; getRenderCommandManifestReport aggregates safe summaries with hardcoded readiness=0; all commands are disabled summaries (no shell syntax, no raw paths); JSON-backed local store; 30 tests covering schema, creation, validation, store, report; no FFmpeg execution, no file creation, no rendering, no uploads, no platform APIs, no executable commands |
| **VO-4B** | ✅ Done | Renderer Preflight Environment Checks | Renderer preflight schema + example (declared-only environment checks, no tool execution); RendererPreflight TypeScript types with immutable safety constraints (dry_run=true, executable_invoked=false const, version_checked=false const, ready flags all false); createRendererPreflight checks command manifest safety and derives tool checks from declared summaries only (no child_process, no version commands, no env vars, no tool execution); validateRendererPreflight blocks unsafe manifests and guards all execution patterns; store functions save/list/get preflights with filters; getRendererPreflightReport aggregates tool check summaries with hardcoded readiness=0; preflight_state: draft/blocked/checked; 38 tests covering schema, creation, validation, store, report, and comprehensive execution blockers; no actual tool checking, no FFmpeg, no version commands, no file creation, no rendering, no uploads, no platform APIs, no executable commands |
| **VO-4C** | ✅ Done | Renderer Binary Discovery Manifests | Renderer binary discovery schema + example (explicit declared-only binary availability planning, no tool execution); RendererBinaryDiscovery TypeScript types with immutable safety constraints (dry_run=true const, discovery_mode="declared_only" const, path_checked/executable_invoked/version_checked all false const, ready flags all false const); createRendererBinaryDiscovery derives binary_checks from preflight tool labels with RenderExecutorKind→schema enum mapping (no child_process, no spawn, no execSync, no version commands, no env vars, no FFmpeg invocation, no path resolution); validateRendererBinaryDiscovery enforces all immutable flags and blocks execution patterns; store functions save/list/get binary discoveries with filters (project_id, platform, discovery_state, preflight_id, command_manifest_id); getRendererBinaryDiscoveryReport aggregates state counts with hardcoded readiness=0; discovery_state: draft/blocked/declared; 27 tests covering schema, creation, validation, store, report, filtering, and execution blockers; no FFmpeg execution, no version checking, no path checks, no file creation, no rendering, no uploads, no platform APIs; next phase may add operator-approved version-check planning contracts (separate approval gate, still no render execution unless separately approved) |
| **VO-4D** | ✅ Done | Operator-Approved Renderer Version Check Plan | Operator-approved version check plan schema + example (planned-only version checks, no execution); RendererVersionCheckPlan TypeScript types with immutable safety constraints (dry_run=true const, approval_required=true const, check_mode="planned_only" const, all execution/capture flags false const, ready flags all false const); createRendererVersionCheckPlan derives planned_checks from binary discovery with safe summaries (e.g., "[would-run-ffmpeg-version-if-approved]", no raw commands, no paths, no version execution); validateRendererVersionCheckPlan enforces all immutable flags and blocks execution patterns; store functions save/list/get plans with filters (project_id, platform, plan_state, discovery_id, preflight_id); getRendererVersionCheckPlanReport aggregates state counts with hardcoded readiness=0; plan_state: draft/blocked/ready_for_operator_review; 46 tests covering schema, creation, validation, store, report, filtering, and execution blockers; no FFmpeg execution, no version checking, no path resolution, no process output capture, no file creation, no rendering, no uploads, no platform APIs; next phase may add explicit mocked executor tests (still no real rendering unless separately approved) |
| **VO-4E** | ✅ Done | Mock Renderer Execution Result Contract | Mock-only execution result schema + example (simulated execution outcomes, no real FFmpeg/rendering); MockRendererExecutionResult TypeScript types with immutable safety constraints (dry_run=true const, execution_mode="mock_only" const, all execution/capture/media-creation flags false const, actual_output_count=0 const, ready flags all false const); createMockRendererExecutionResult derives mock_checks from version check plan with safe simulation results (e.g., "[mock-pass]", no raw commands, no process output, no file creation); validateMockRendererExecutionResult enforces all immutable flags and blocks execution/file-creation patterns; store functions save/list/get results with filters (project_id, platform, result_state, version_check_plan_id, command_manifest_id); getMockRendererExecutionResultReport aggregates state counts with hardcoded readiness=0 and media_files_created=0; result_state: draft/blocked/mock_passed/mock_failed; 50 tests covering schema, creation, validation, store, report, filtering, and execution/file-creation blockers; no FFmpeg execution, no rendering, no file creation, no process output capture, no uploads, no platform APIs; execution result contract ready for future real-execution spike (still behind approval gate, still marked dry_run=true) |
| **2A** | May 30–Jun 10 | Production Package MVP | One video → platform-ready packages for all defined platform targets |
| **2B** | Jun 10–Jun 20 | Local Queue MVP | Batch of 5 videos can fail mid-run and resume without lost work |
| **2C** | Jun 20–Jun 27 | Local Production Adapters | FFmpeg render/thumbnail outputs and optional Whisper.cpp captions produce real local artifacts |
| **3A** | Jun 20–Jul 15 | Manual Upload Adapter | Export complete local upload packages with auditability and idempotent folder paths |
| **3B** | Jun 20–Jul 15 | Posting Adapter Interface + Registry | Add a safe adapter contract with dry-run/blocked routing for non-manual modes |
| **3C** | Jun 20–Jul 15 | YouTube Dry-Run Preflight | Validate YouTube package/config readiness without OAuth or upload |
| **3D** | Jun 20–Jul 15 | YouTube Credential and OAuth Design | Define credential boundaries and approval gates without enabling upload |
| **3E-A** | Jun 20–Jul 15 | Keychain Credential Helper Scaffold | Validate credential references and redact logs without reading or writing secrets |
| **3E-B** | Jun 20–Jul 15 | YouTube OAuth Setup Scaffold | Generate auth metadata and validate callback/state without token exchange |
| **3E-C** | Jun 20–Jul 15 | YouTube OAuth Token Exchange + Keychain Prototype | Explicitly gated token exchange and Keychain storage without upload |
| **3E-D** | Jun 20–Jul 15 | Credential-Backed YouTube Upload Preflight | Verify redacted Keychain summaries and scope readiness without upload |
| **3E-E** | Jul 15–Aug 15 | Authorized Posting Adapters | Add the first real platform API adapters only after credential boundaries and explicit upload approval are complete |
| **3E-F** | Aug 15–Sep 15 | YouTube Upload Lifecycle / Status Handling | Add read-only lifecycle checks for known private uploads without new publishing capability |
| **3E-G** | Aug 15–Sep 15 | Dashboard Surfacing for YouTube Upload Lifecycle | Show read-only lifecycle state in the dashboard without adding controls |
| **3Z** | Sep 15–Sep 20 | Security, Operations, and End-to-End Readiness Review | Review accumulated boundaries and readiness before any broader expansion |
| **3X** | Jun 20–Jul 15 | Optional oMLX Local LLM Provider MVP | Add a localhost-only metadata variants provider for low-risk text tasks |
| **3Y** | Jun 20–Jul 15 | MacBook oMLX Sidecar Worker | Add an opt-in trusted Thunderbolt/LAN worker-node path for low-risk text tasks |
| **4** | Jul 15–Aug 15 | Multi-Account Scheduler | Safe distribution across accounts with duplicate-content prevention |
| **5** | Aug 15–Sep 15 | Optimization + Optional LoRA | Metrics snapshots; optional LoRA experiments (does not block production) |

**Total Timeline:** 6 months  
**Total Resource Estimate:** 50 hours Claude Code (revised for adapter complexity)  
**Local Infrastructure Cost:** $0 (excluding electricity ~$50/month, storage costs, paid platform APIs, optional cloud LLM/TTS)

---

## Phase 0: Smart Model Routing ✅ (DONE)

**Status:** 2026-05-08

**Deliverables:**
- ✅ 4 local models: SDXL (30–60s), Wave (60–90s), FLUX (2–4 min), Roop (30–120s)
- ✅ Smart routing skill with decision matrix
- ✅ Performance profiles (VRAM, speed, quality per model)
- ✅ Thermal stability verified (85% CPU safe)

---

## Phase 1: Local Generation Pipeline ✅ (DONE)

**Status:** 2026-05-08

**Deliverables:**
- ✅ 4 models installed, tested, benchmarked
- ✅ Installation runbook with troubleshooting
- ✅ Resource scheduling guidelines (day/night, model limits)

---

## Phase 2A: Production Package MVP

**Timeline:** May 30–June 10, 2026 (2 weeks)  
**Goal:** Generate complete upload-ready packages for all defined platform targets (not post them; just create them)

### 2A.1: Platform & Format Specifications

**Deliverables:**
- Platform specs JSON: YouTube, YouTube Shorts, TikTok, Instagram Reels, Instagram Feed, LinkedIn, Facebook, Bluesky, X
  - Fields: source_url, last_verified_at, verification_frequency_days, hashtag_count, description_max_length, thumbnail_required, posting_modes, adapter_status, known_constraints, manual_fallback
- Format specs JSON: 9 output formats with safe zones, aspect ratios, bitrates, codecs
- Caption specs JSON: SRT/VTT requirements, burn-in options, platform-specific caption fields

**Schemas:**
```json
{
  "platforms": {
    "youtube": {
      "name": "YouTube",
      "source_url": "https://developers.google.com/youtube/v3",
      "last_verified_at": "2026-05-08",
      "formats": ["longform_16_9", "shorts_9_16"],
      "posting_modes": ["api", "manual"],
      "adapter_status": "supported",
      "supports_direct_publish": true,
      "supports_scheduling": true,
      "supports_analytics": true,
      "hashtag_count": {"min": 1, "max": 2},
      "description_max": 5000,
      "verification_frequency_days": 30,
      "known_failure_modes": ["initial_upload_delay", "quota_limits"],
      "requires_paid_plan": false
    }
  },
  "formats": {
    "youtube_longform": {
      "resolution": "1920×1080",
      "aspect_ratio": "16:9",
      "safe_area": "1760×990",
      "codec": "h264",
      "bitrate_video": "5000k",
      "notes": "YouTube supports up to 8K, but 1080p is standard"
    }
  }
}
```

### 2A.2: Local Transcription & Captions

**Deliverables:**
- Whisper.cpp integration (local transcription, no API calls)
- Caption generation: SRT, VTT, JSON formats
- Burn-in capability (FFmpeg overlay for platforms that require it)
- Caption versioning (keep raw + burned variants)

**Workflow:**
```
Audio → Whisper.cpp → transcript.json
transcript.json → format as SRT/VTT
SRT + video → FFmpeg burn-in (optional)
Keep both burned + raw captions for flexibility
```

### 2A.3: Safe-Zone-Aware Multi-Format Rendering

**Deliverables:**
- Safe-zone definitions per format (title-safe, action-safe areas)
- Two rendering modes:
  1. **Simple Transform:** Master 1920×1080 → FFmpeg crop/scale (for center-safe content)
  2. **Canonical Timeline:** One timeline rendered to 16:9, 9:16, 1:1, 4:5 variants using templates
- Recommendation: Default to canonical timeline for quality; use transform for simple content

**Workflow:**
```
Source: script + audio + assets
  ↓
Canonical Timeline (animated objects positioned in safe zones)
  ├─ 16:9 render (1920×1080, YouTube, LinkedIn)
  ├─ 9:16 render (1080×1920, TikTok, Instagram Reels, Shorts)
  ├─ 1:1 render (1080×1080, Instagram Feed, Facebook)
  └─ 4:5 render (1080×1350, Instagram Feed preferred)

OR (for simple content):
Master 1920×1080 → FFmpeg transform to all variants
```

### 2A.4: Thumbnail Packages

**Deliverables:**
- Design integration (via `/design` orchestrator)
- Per-platform thumbnail specs (sizes, safe zones, format requirements)
- Thumbnail versioning (multiple variants for A/B testing)

### 2A.5: Manifest Schema

**Deliverables:**
- Production manifest JSON: tracks all generated assets, captions, variants, metadata
- Example:
```json
{
  "video_id": "episode-001",
  "created_at": "2026-05-08T14:30:00Z",
  "script": "scripts/episode-001.md",
  "audio": "audio/episode-001-narration.wav",
  "caption_sources": [
    "captions/episode-001.srt",
    "captions/episode-001.vtt",
    "captions/episode-001.json"
  ],
  "thumbnails": [
    {"variant": "v1", "path": "thumbnails/episode-001-v1.png", "size": "1280×720"}
  ],
  "production_packages": {
    "youtube_longform": {
      "video": "variants/episode-001-yt-longform-1920x1080.mp4",
      "captions": "captions/episode-001.srt",
      "thumbnail": "thumbnails/episode-001-v1.png",
      "metadata": {
        "title": "Episode 001: Title Here",
        "description": "Full description...",
        "hashtags": ["#tag1", "#tag2"],
        "upload_ready": true
      }
    },
    "tiktok": {
      "video": "variants/episode-001-tiktok-1080x1920.mp4",
      "captions": "captions/episode-001.vtt",
      "thumbnail": "thumbnails/episode-001-v1.png",
      "metadata": {...}
    }
  }
}
```

### 2A Success Criteria
- ✅ Generate complete production packages for all defined platform targets from one source
- ✅ All packages include: video (correct format), captions (SRT/VTT), thumbnail, metadata
- ✅ Manifest tracks every file and variant
- ✅ Packages are upload-ready (human can upload without further editing)

---

## Phase 2B: Local Queue MVP

**Timeline:** June 10–June 20, 2026 (1.5 weeks)  
**Goal:** No lost work; resume from mid-pipeline failure

### 2B.1: PostgreSQL Schema & Docker Setup

**Deliverables:**
- Docker Compose file for PostgreSQL (local, port 5432)
- Durable entity tables: videos, scripts, assets, renders, captions, production_packages, posting_targets, accounts
- Job table for execution only (separate from video/asset entities)
- Event log for audit trail

**Schema highlights:**
```sql
-- Durable production objects
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  series_id UUID,
  title TEXT,
  video_state VARCHAR(50),  -- planned, scripted, voiced, assets_ready, captions_ready, composed, variants_ready, ready_to_post, partially_posted, posted, archived
  created_at TIMESTAMP
);

CREATE TABLE scripts (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  content TEXT,
  created_at TIMESTAMP
);

CREATE TABLE captions (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  format VARCHAR(20),  -- srt, vtt, json
  content TEXT,
  burn_in_variant BOOLEAN
);

CREATE TABLE renders (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  format_key VARCHAR(50),  -- youtube_longform, tiktok, etc.
  file_path VARCHAR(500),
  codec VARCHAR(20),
  bitrate VARCHAR(20),
  created_at TIMESTAMP
);

CREATE TABLE production_packages (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  platform VARCHAR(50),
  manifest_path VARCHAR(500),
  ready_to_post BOOLEAN,
  created_at TIMESTAMP
);

-- Execution-only, ephemeral
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  job_type VARCHAR(50),  -- generation, rendering, caption, posting, etc.
  model VARCHAR(50),
  job_state VARCHAR(20),  -- pending, leased, running, succeeded, failed, dead
  retry_count INT DEFAULT 0,
  idempotency_key VARCHAR(100),  -- for posting jobs to prevent duplicates
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE events (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),  -- video, job, account, etc.
  entity_id UUID,
  event_type VARCHAR(50),  -- created, state_changed, error, etc.
  details JSONB,
  created_at TIMESTAMP
);
```

### 2B.2: Worker Process

**Deliverables:**
- Python worker daemon: pull jobs, execute, update states, log events
- Retry logic: exponential backoff, max 3 retries
- Lease-based job pulling (prevent concurrent execution)

### 2B.3: Video/Asset/Render Registry

**Deliverables:**
- Durable tracking of: scripts, assets, renders, captions, packages
- State machine per entity (video_state, render_state, etc.)
- Mid-pipeline resume: query last completed state, resume from next stage

### 2B Success Criteria
- ✅ Queue 5 videos for processing
- ✅ Simulate failure at render stage
- ✅ Resume batch: completed stages skip, failed stage retries
- ✅ All state transitions logged to event table

---

## Phase 3A: Manual Upload Adapter

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Export complete local upload packages for human posting

### 3.1: Manual Export Contract

**Deliverables:**
- Export local package folders for upload-ready targets
- Copy video, thumbnail, captions, metadata, manifest excerpt, and checksums
- Emit audit events for export completion or refusal
- Keep package paths idempotent and target-specific

### 3.2: Manual Adapter Rules

**Behavior:**
- `adapter_mode = manual` exports the package
- Missing `adapter_mode` may fall back to manual when the platform declares manual fallback
- Incomplete packages require an explicit override
- No platform API calls, OAuth, tokens, cookies, or browser automation

### 3.3: Future Posting Adapters

**Deferred until Phase 3B+:**
- YouTube API adapter
- Bluesky API adapter
- Any browser-assisted or n8n wrapper posting flow

### 3.4: Posting Audit Logs

**Deliverables:**
- Table: posting_jobs (video_id, platform, account, adapter_mode, status, error, retry_count, timestamps)
- Event log: all export attempts, refusals, retries

### 3 Success Criteria
- ✅ Manual upload package generated for an upload-ready target
- ✅ Incomplete target exports are blocked unless override is enabled
- ✅ Export audit log shows all attempts

---

## Phase 3B: Posting Adapter Interface + Registry

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Route posting jobs through a formal adapter contract while keeping real posting disabled

### 3.1: Adapter Contract

**Deliverables:**
- `validateConfig()`
- `validateCredentials()`
- `preflight()`
- `execute()`
- `pollStatus()`

### 3.2: Registry Modes

**Deliverables:**
- `manual`
- `api`
- `n8n`
- `browser_assisted`
- `disabled`

### 3.3: Safety Rules

**Behavior:**
- Manual remains the only executable adapter
- Non-manual modes return dry-run or blocked results
- No network calls or credential access

### 3.4: Success Criteria
- ✅ Posting jobs route through the registry
- ✅ Non-manual jobs emit clear blocked/dry-run audit events
- ✅ No real platform posting occurs

---

## Phase 3C: YouTube Dry-Run Preflight

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Validate YouTube readiness and produce a dry-run plan without upload

### 3.1: YouTube Dry-Run Adapter

**Deliverables:**
- `adapter_mode = api` routes to a YouTube-specific dry-run adapter
- Validate title, description, video media, thumbnail, captions, and privacy config
- Compute idempotency key for future upload phases

### 3.2: Safety Rules

**Behavior:**
- No OAuth or credential reads
- No YouTube API calls
- No uploads
- Manual export remains the fallback path

### 3.3: Success Criteria
- ✅ Valid YouTube package/config pair passes dry-run preflight
- ✅ Invalid config is blocked safely
- ✅ Dry-run audit output includes upload intent and idempotency metadata

---

## Phase 3D: YouTube Credential and OAuth Design

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Define the credential and OAuth boundary for a future YouTube upload adapter without enabling upload

### 3.1: Credential Contract

**Deliverables:**
- Design-only credential contract JSON with placeholder-only values
- Local callback path shape for localhost OAuth setup
- DB reference model for Keychain-backed storage

### 3.2: Safety Rules

**Behavior:**
- No OAuth execution
- No token storage in repo files or `.env`
- No YouTube API calls
- No upload implementation
- Manual fallback remains required

### 3.3: Success Criteria
- ✅ Credential boundaries are documented
- ✅ Approval gate exists before any real upload phase
- ✅ No secrets or token values are introduced

---

## Phase 3E-A: Keychain Credential Helper Scaffold

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Provide a local-only credential helper scaffold that validates references and redacts logs without reading or writing secrets

### 3.1: Helper Commands

**Deliverables:**
- Credential reference validation
- Redaction helper
- Dry-run Keychain read/write command shapes
- Self-test for safe outputs

### 3.2: Safety Rules

**Behavior:**
- No real Keychain reads or writes by default
- No OAuth execution
- No token storage or network calls
- Manual fallback remains the safe path

### 3.3: Success Criteria
- ✅ Credential reference validation passes for the supported shape
- ✅ Redaction removes sensitive-looking values from sample text
- ✅ Dry-run command shapes print without touching Keychain

---

## Phase 3E-B: YouTube OAuth Setup Scaffold

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Provide a local-only OAuth setup scaffold that generates authorization metadata and validates callback/state shape without exchanging tokens or storing credentials

### 3.1: OAuth Setup Helper

**Deliverables:**
- PKCE and state generation
- Placeholder-only authorization URL builder
- Callback validation for localhost redirect and state
- Self-test coverage for safe scaffolding

### 3.2: Safety Rules

**Behavior:**
- No token exchange
- No Keychain read or write
- No YouTube API calls
- No upload implementation
- No browser automation

### 3.3: Success Criteria
- ✅ OAuth scaffold self-test passes
- ✅ Placeholder config builds an authorization URL
- ✅ Callback validation rejects mismatched state

---

## Phase 3E-C: YouTube OAuth Token Exchange + Keychain Prototype

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Provide an explicitly gated CLI prototype for exchanging a YouTube authorization code and storing the resulting token JSON in macOS Keychain without enabling upload

### 3.1: Token Exchange and Keychain Commands

**Deliverables:**
- Explicitly gated token exchange command
- Explicitly gated Keychain read/write/delete commands
- Redacted summaries for sensitive results
- Sample token exchange config and runbook

### 3.2: Safety Rules

**Behavior:**
- No upload implementation
- No browser automation
- No `.env` or token file output
- No Google client libraries
- User must explicitly approve each sensitive operation

### 3.3: Success Criteria
- ✅ Token self-test passes without real tokens
- ✅ Confirmation flags are required for sensitive commands
- ✅ Redacted summaries never print raw token values

---

## Phase 3E-D: Credential-Backed YouTube Upload Preflight

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Verify redacted Keychain-backed credential readiness during YouTube dry-run preflight without upload

### 3.1: Credential Summary Read

**Deliverables:**
- Redacted Keychain summary command for YouTube credentials
- Worker support for credential-backed dry-run preflight metadata
- Scope-readiness reporting for `youtube.upload`

### 3.2: Safety Rules

**Behavior:**
- No upload implementation
- No YouTube API calls
- No raw token values
- Missing or malformed credentials block safely but do not dead-letter

### 3.3: Success Criteria
- ✅ Redacted summaries report presence/absence without values
- ✅ Worker merges credential-backed preflight metadata safely
- ✅ Production remains upload-free in this phase

---

## Phase 3E-E: Authorized Posting Adapters

**Timeline:** July 15–August 15, 2026 (4 weeks)  
**Goal:** Add the first real platform API adapters only after credential boundaries and explicit upload approval are complete, starting with a private-only YouTube path

### 3.1: Authorized Adapter Gate

**Deliverables:**
- Real platform adapter approval checklist
- Explicit upload authorization gate
- Safety review for credential handling and logging
- Private-only YouTube upload adapter shape

### 3.2: Safety Rules

**Behavior:**
- No upload implementation until the gate is approved
- No Google client libraries unless explicitly required later
- Manual upload remains the fallback path
- First upload is private-only and one job at a time

### 3.3: Success Criteria
- ✅ Credential boundaries are approved before upload work begins
- ✅ Authorized adapters remain separate from dry-run preflight

---

## Phase 3E-F: YouTube Upload Lifecycle / Status Handling

**Timeline:** August 15–September 15, 2026 (4 weeks)  
**Goal:** Add read-only lifecycle checks for known private uploads without adding any new publishing capability

### 3.1: Lifecycle Model

**Deliverables:**
- conservative lifecycle states: not_started, uploading, uploaded, processing, available_private, failed, unknown
- redacted metadata for status checks
- status events tied to known orchestrator-owned uploads

### 3.2: Status Check Boundary

**Deliverables:**
- `videos.list` read path for known uploaded IDs
- explicit `status_check_only` job mode
- no arbitrary polling of unknown videos
- no new upload capabilities

### 3.3: Safety Rules

**Behavior:**
- Private-only uploads remain the base boundary
- No public or unlisted publishing
- No thumbnails, captions, or playlists
- No token logging
- Manual fallback remains available

### 3.4: Success Criteria
- ✅ The worker can report conservative lifecycle status for a known private upload
- ✅ Unknown or failed checks return safe redacted metadata
- ✅ No new publishing mode is introduced

---

## Phase 3E-G: Dashboard Surfacing for YouTube Upload Lifecycle

**Timeline:** August 15–September 15, 2026 (4 weeks)  
**Goal:** Surface read-only lifecycle state in the dashboard without adding any new control surface

### 3.1: Dashboard Summary

**Deliverables:**
- latest YouTube lifecycle state
- YouTube video ID when already known locally
- privacy status, last checked, upload event timestamp
- lifecycle counts and redacted warnings/errors

### 3.2: Read-Only Boundary

**Behavior:**
- No upload buttons
- No OAuth buttons
- No credential reference display
- No token display
- No Keychain or YouTube API calls from the dashboard

### 3.3: Success Criteria
- ✅ The dashboard shows lifecycle state for known uploads
- ✅ Empty state is safe and informative
- ✅ No new publishing capability is introduced

---

## Phase 3Z: Security, Operations, and End-to-End Readiness Review

**Timeline:** September 15–September 20, 2026 (1 week)  
**Goal:** Review the accumulated Video Orchestrator security boundaries, operational constraints, and end-to-end readiness without adding runtime capability

### 3.1: Readiness Package

**Deliverables:**
- readiness report covering upload, token, dashboard, and sidecar boundaries
- first-real-private-upload operator checklist
- security boundary checklist for future phases
- doc corrections where current text is inconsistent with the implementation

### 3.2: Review Boundary

**Behavior:**
- No new upload capabilities
- No new OAuth scopes or credential storage locations
- No Keychain, dashboard, or API behavior changes
- No public or unlisted upload expansion

### 3.3: Success Criteria
- ✅ The current phase boundaries are clearly documented
- ✅ The first private upload path is reviewed honestly, including remaining operator prerequisites
- ✅ The docs no longer imply broader upload capability than the implementation supports

---

## Phase 4A: Account Registry + Credential Health Center

**Timeline:** September 20–October 1, 2026 (2 weeks)  
**Goal:** Add a read-only account registry and credential health center so operators can automate readiness checks before the first private upload and future account expansion

### 4.1: Account Registry

**Deliverables:**
- account registry schema and placeholder examples
- account capability, privacy, and notification metadata
- placeholder-only registry validation

### 4.2: Credential Health Center

**Deliverables:**
- local account-health dry-run script
- redacted credential summary checks for approved accounts
- safe snapshot generation for the dashboard

### 4.3: Read-Only Dashboard Surface

**Deliverables:**
- account health panel in the dashboard
- read-only status summaries
- no credential display and no control actions

### 4.4: Readiness Automation

**Deliverables:**
- readiness dry-run command for the first private upload checklist
- nightly health-check support
- manual-only fallback visibility

### 4.5: Behavior

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

### 4.6: Success Criteria
- ✅ Operators can register accounts using placeholder-only schemas
- ✅ Credential health can be checked safely without exposing token values
- ✅ The dashboard shows read-only account status without exposing credential references
- ✅ The first private upload checklist is automated as far as local state allows

## Phase 4B: Operator Account Snapshot + Nightly Health Job

**Timeline:** October 1–October 8, 2026 (1 week)  
**Goal:** Make account health a set-and-forget local flow with an untracked operator registry and a nightly dashboard snapshot

### 4B.1: Local Registry Bootstrap

**Deliverables:**
- init command for the operator-owned local registry
- default local registry paths under `runtime/local`
- ignore-safe runtime artifact guidance

### 4B.2: Nightly Snapshot Job

**Deliverables:**
- dry-run nightly snapshot command
- safe dashboard snapshot file
- local log path for snapshot runs

### 4B.3: Dashboard Read Path

**Deliverables:**
- dashboard reads snapshot only
- no credential-reference display
- no Keychain access from dashboard

### 4B.4: Behavior

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

### 4B.5: Success Criteria
- ✅ Operators can initialize a local registry in one command
- ✅ Nightly health checks produce a safe dashboard snapshot
- ✅ Runtime files remain untracked and outside the repo history

## Phase 4C: Dashboard Account Onboarding + OAuth Connect Flow

**Timeline:** October 8–October 22, 2026 (2 weeks)  
**Goal:** Make the dashboard the operator entry point for adding accounts, connecting YouTube OAuth, and regenerating local health state without manual JSON editing

### 4C.1: Dashboard Onboarding

**Deliverables:**
- account onboarding form for YouTube
- safe local registry write path
- update-safe account metadata editing

### 4C.2: OAuth Connect Flow

**Deliverables:**
- YouTube OAuth start button/link
- localhost callback handling
- Keychain token storage

### 4C.3: Automatic Health Refresh

**Deliverables:**
- snapshot regeneration after save/connect
- safe account status refresh
- read-only health display in dashboard

### 4C.4: Behavior

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

### 4C.5: Success Criteria
- ✅ Operators can add and connect YouTube accounts from the dashboard
- ✅ Local registry and snapshot update automatically after save/connect
- ✅ Dashboard remains read-only for upload actions

---

## Phase 3X: Optional oMLX Local LLM Provider MVP

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Add a localhost-only local LLM provider path for metadata variants

### 3.1: Metadata Variants Task

**Deliverables:**
- `llm_text` job path for metadata variants
- Prompt-to-JSON generation for title variants, hook variants, description draft, and hashtag suggestions
- Local fallback/skip when oMLX is unavailable

### 3.2: Safety Rules

**Behavior:**
- No media generation
- No transcription
- No posting
- No secrets, OAuth, or external network access
- oMLX stays optional and non-blocking

### 3.3: Success Criteria
- ✅ Metadata variants job returns valid structured JSON when oMLX is available
- ✅ Unavailable oMLX returns a safe skip/warning result
- ✅ Production remains healthy when oMLX is offline

---

## Phase 3Y: MacBook oMLX Sidecar Worker

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Add an opt-in trusted Thunderbolt/LAN worker-node path for low-risk local text tasks

### 3.1: Sidecar Node Registry

**Deliverables:**
- local worker-node schema for oMLX sidecars
- example MacBook node config
- allowed task list for future text-only work

### 3.2: Routing and Health Checks

**Deliverables:**
- trusted Thunderbolt/LAN endpoint validation
- short-timeout health check against the models endpoint
- explicit opt-in for remote sidecar calls
- secret-field guards before any remote payload is sent

### 3.3: Safety Rules

**Behavior:**
- No secrets, OAuth, posting, uploads, or media generation
- Only low-risk text tasks are eligible
- The Mac mini remains the control plane
- Remote sidecar use is optional and non-blocking

### 3.4: Success Criteria
- ✅ The worker can route allowed text jobs to an enabled MacBook sidecar
- ✅ Public IPs and untrusted endpoints are rejected
- ✅ Sidecar unavailability falls back locally or skips safely

---

## Phase 4: Multi-Account Scheduler

**Timeline:** July 15–August 15, 2026 (4 weeks)  
**Goal:** Safely distribute across many accounts without spam risk

### 4.1: Account Registry

**Deliverables:**
- Table: accounts (platform, handle, account_id, status, daily_limit, per_hour_burst_limit, min_cooldown_minutes)
- Credentials: OS Keychain (encrypted local storage, reference in DB)
- Account health: last_posted_at, posted_count_today, failure_streak

### 4.2: Content Distribution Policies

**Deliverables:**
- Duplicate-content policy: min_delay_same_platform (e.g., 30 min between posts to same platform)
- Caption variation: optional require different captions per account posting
- Thumbnail variation: optional require different thumbnails
- Account topic fit: soft constraint (e.g., brand accounts reject casual content)

### 4.3: F0 Workflow (Distribution Planning)

**Deliverables:**
- User selects: platforms + accounts for batch
- Pre-flight validation:
  - Adapter status check (supported / manual)
  - Credential validity
  - Account daily limits (won't exceed)
  - Duplicate-content policy compliance
  - Thermal/resource availability
- Output: distribution manifest (video → platforms → accounts)

### 4.4: Posting Job Scheduling

**Deliverables:**
- Stagger posts per account: enforce min_cooldown_minutes
- Respect adapter limits: YouTube quota, TikTok rate limits
- Separate thread pool: posting jobs don't compete with generation jobs
- Idempotency: same posting job never posts twice (via idempotency_key)

### 4 Success Criteria
- ✅ Register 2+ accounts per platform
- ✅ F0 workflow selects distribution
- ✅ Pre-flight validation blocks if limits exceeded
- ✅ Post 10 videos across 3 YouTube accounts with 30-min cooldown respected

---

## Phase 5: Optimization & Optional LoRA

**Timeline:** August 15–September 15, 2026 (4 weeks)  
**Goal:** Data-driven future improvements; optional brand customization

### 5.1: Performance Metrics (Local Snapshots)

**Deliverables:**
- Table: performance_snapshots (video_id, platform, account, posted_at, hook, model, avatar, template_id, views, likes, comments, shares)
- Collection: Manual snapshots (no automated analytics API polling; use manual data entry + optional API integration)
- Dashboard: CSV export or simple web UI (localhost:5000)

### 5.2: Learning Recommendations

**Deliverables:**
- Query: which model/hook/avatar performed best in last 30 days?
- Recommendation engine: suggest best performers for next batch
- Example output: "Last month: hook X averaged 3.2% engagement; recommend for this batch"

### 5.3: Optional LoRA Experiments (Not Blocking)

**Deliverables:**
- LoRA fine-tuning scripts: train on 50 brand images (optional, 4–8 GPU hours)
- LoRA model manager: load fine-tuned model if available
- Caution: LoRA training on 24 GB Mac mini may succeed or may hit memory limits; benchmark first
- **Does NOT block production:** If LoRA fails, fall back to base FLUX

### 5 Success Criteria
- ✅ Collect performance snapshots for 10 videos
- ✅ Generate recommendations: best model, hook, avatar
- ✅ (Optional) Train LoRA on 50 brand images; test inference
- ✅ Production continues even if LoRA training fails

---

## Resource Scheduling & Constraints

### Resource Classes
- **cpu_light:** Metadata, script gen (can run anytime, negligible CPU)
- **media_encode:** FFmpeg encoding (2–3 parallel, limit VRAM pressure)
- **image_fast:** SDXL (30–60s, daytime OK)
- **image_heavy:** FLUX, LoRA (2–4 min, schedule at night)
- **talking_head:** Wave, Roop (60–120s, can run anytime but prefer lighter times)
- **posting:** n8n, API, manual (separate thread pool, parallel to media jobs)
- **analytics:** Metrics collection, LoRA training (night batch)

### Scheduling Rules
1. **Only one heavy model job at a time** (FLUX, LoRA → night mode preferred)
2. **FFmpeg:** 2–3 concurrent encodes if VRAM + CPU permit; monitor pressure
3. **Posting jobs:** Separate thread pool; can run while generation jobs run
4. **Night mode:** ~90% CPU/GPU available; safe for FLUX, LoRA, heavy batches
5. **Day mode:** SDXL + posting + analytics only; reserve thermal headroom
6. **Monitor:** Track RAM usage, thermal state, CPU load; throttle if exceeding 85% CPU

---

## Throughput Targets (Not Guarantees)

Validate each tier by benchmarking; actual throughput depends on content complexity, model selection, and resource availability.

### Tier A (Simple): 30–100 videos/week
- Script + TTS + static image + captions + all format variants
- No talking-head, no FLUX, no LoRA
- Minimal manual review

### Tier B (Higher Quality): 15–50 videos/week
- Custom thumbnails + multi-format rendering + manual review
- SDXL or Wave (not FLUX)
- 1–2 accounts per platform

### Tier C (Avatar/Product): 5–25 videos/week
- Talking-head (Wave) or avatar (Roop) or product photos
- Higher generation time per video
- 2–5 accounts per platform

### Tier D (FLUX/LoRA/Complex): 2–10 videos/week
- FLUX-heavy, LoRA, complex Remotion compositions
- 4–8 hour batch jobs at night only
- Benchmark required before committing

---

## Known Limitations & Workarounds

### Posting
- **TikTok API:** Direct posting requires TikTok Content Posting API product access and the official creator-info → initialize → export flow; fallback to manual upload or browser-assisted workflows when not approved.
- **Instagram/Facebook:** Publishing depends on Meta API permissions, account type, OAuth setup, and app review; fallback to manual upload packages when not authorized.
- **YouTube Quota:** YouTube upload quota costs and daily quota limits change over time. Store `last_verified_at`, quota assumptions, and failure modes in platform specs instead of hardcoding a videos/day claim.
- **Bluesky:** Video posting is feasible through ATProto, but email verification, daily video limits, CDN limits, and moderation requirements apply and should be represented in adapter specs.
- **X / LinkedIn:** Rate limits, API plan restrictions, and permissions are adapter constraints. Do not hardcode one global limit; verify before each implementation cycle.

### LoRA Training
- **FLUX LoRA on 24 GB Mac:** May succeed with careful memory management; not guaranteed
- **Training time:** 4–8 GPU hours (run at night only)
- **Fallback:** If training fails, fall back to base FLUX; do not block production

### Captions
- **Whisper.cpp:** Local, no API costs; quality depends on audio input
- **Fallback:** Optional integration with cloud TTS/transcription APIs (user chooses)

### Safe-Zone Rendering
- **Simple content:** FFmpeg crop/scale sufficient
- **Complex layouts:** Use canonical timeline (separate render per format)
- **Benchmark:** Measure quality + time for both approaches; choose per project

---

## Cost Summary

**Local Infrastructure:** $0
- Docker + PostgreSQL: free
- Worker process: free
- Whisper.cpp: free
- Python scripts: free

**Not Included (User Responsibility):**
- Electricity and wear from sustained local workloads
- Storage: local SSD/NAS/cloud backup if desired
- Optional paid APIs or platform plans where a platform requires them
- Optional cloud LLM/TTS/transcription services if the user chooses quality or speed over fully local execution
- Platform-specific business/app review costs, verification requirements, or developer-account constraints where applicable

---

## Next Steps

1. **Phase 2A (May 30):** Start platform/format/caption specs
2. **Phase 2B (June 10):** Implement PostgreSQL queue
3. **Phase 3 (June 20):** Begin posting adapter work; target YouTube + Bluesky
4. **Phase 4 (July 15):** Multi-account scheduler
5. **Phase 5 (Aug 15):** Metrics + optional LoRA

All phases assume feedback and iteration; do not treat timelines as fixed.
