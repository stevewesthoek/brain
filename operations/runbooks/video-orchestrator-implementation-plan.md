# Video Orchestrator — Implementation Plan (Revised)

**Date:** 2026-05-08 (Post-Review)  
**Status:** Detailed implementation guide — ready for phase-by-phase execution  
**Architecture:** Local-first production + platform adapters  
**Timeline:** 6 months (May 2026 — October 2026)  
**Effort Estimate:** ~50 hours Claude Code (adjusted for adapter complexity)

---

## Executive Summary

Revised implementation plan for a local-first video production studio. The system will:
- **Generate production-ready packages** (locally, on Mac mini)
- **Publish through authorized adapters** (API, n8n, browser-assisted, manual)
- **Manage multi-account distribution safely** (cooldowns, duplicate prevention)
- **Track performance** (local snapshots, optional analytics collection)

**Key change from previous plan:** Separate production (local) from publishing (adapter-dependent). Phases 2A–2B deliver complete production packages; Phases 3–5 add adapters and multi-account support.

**Local infrastructure cost:** $0 (excluding electricity, storage, optional paid APIs)

---

## Architecture Overview (Revised)

```
Mac Mini M4 Pro (24GB RAM, M4 Pro CPU)
├─ Production Layer (Local, Always Available)
│  ├─ 4 Local Models (SDXL, Wave, FLUX, Roop)
│  ├─ Whisper.cpp (local transcription)
│  ├─ PostgreSQL + Worker (job queue, state machine)
│  ├─ FFmpeg + Templates (composition, multi-format)
│  ├─ Safe-Zone Rendering (16:9, 9:16, 1:1, 4:5)
│  ├─ Thumbnail Generation (via `/design` orchestrator)
│  ├─ Manifest Assembly (production packages)
│  └─ Account Registry (OS Keychain)
│
├─ Publishing Layer (Adapter-Dependent, Authorization Required)
│  ├─ YouTube Adapter (API, if oauth credentials valid)
│  ├─ Bluesky Adapter (ATProto, if credentials valid)
│  ├─ Manual Adapter (always available, human uploads)
│  ├─ n8n Wrapper (optional, centralize authorized adapters)
│  └─ Browser-Assisted (Playwright, semi-automated)
│
└─ Analytics Layer (Local Snapshots, Optional API Integration)
   ├─ Performance Snapshots (views, engagement)
   ├─ Learning Engine (best-performer recommendations)
   └─ Optional LoRA Experiments (night batch, does not block production)
```

---

## Phase Structure (Revised)

### Phase 0–1: ✅ DONE
- 4 local models installed and tested
- Smart routing implemented
- Resource constraints documented (85% CPU safe, thermal stable)

### Phase 2A: Production Package MVP (May 30 – June 10)
**Goal:** One video → upload-ready packages for all defined platform targets

**Deliverables:**
1. **Platform Specs** (`platform-specs.json`)
   - Platform targets: YouTube, Shorts, TikTok, Instagram Reels, Instagram Feed, LinkedIn, Facebook, Bluesky, X
   - Per-platform fields: source_url, last_verified_at, verification_frequency_days, posting_modes, adapter_status, hashtag rules, description limits, known_constraints, manual_fallback

2. **Format Specs** (`format-specs.json`)
   - 9 output formats with safe zones: 16:9 (YouTube, LinkedIn), 9:16 (TikTok, Reels, Shorts), 1:1 (Instagram Feed, Facebook), 4:5 (Instagram preferred)
   - Per-format: resolution, aspect ratio, safe area, codec, bitrate

3. **Caption Specs** (`caption-specs.json`)
   - SRT, VTT, JSON formats
   - Burn-in options (FFmpeg overlay)
   - Platform-specific requirements

4. **Whisper.cpp Integration**
   - Local transcription (no API calls)
   - Output: transcript.json, SRT, VTT
   - Keep both raw and burned caption variants

5. **Safe-Zone-Aware Rendering**
   - Simple mode: Master 1920×1080 → FFmpeg transform to all variants (for center-safe content)
   - Canonical mode: One timeline rendered to multiple safe-zone variants (recommended for quality)
   - Recommendation logic: use canonical by default; use simple for simple content

6. **Manifest Schema**
   - Production manifest JSON tracks: scripts, audio, captions, renders, thumbnails, metadata per platform
   - Upload-ready flag: true when all files present and valid

**Testing:**
- [ ] Generate production package for YouTube longform
- [ ] Generate production package for TikTok (9:16)
- [ ] Verify captions (SRT, VTT) correct
- [ ] Verify all defined platform-target packages are created from one source
- [ ] Manual upload package and confirm compatibility

**Success Criteria:**
- One source video generates complete production packages for all defined platform targets
- Each package includes: video (correct format), captions, thumbnail, metadata
- Manifest tracks all variants and states

---

### Phase 2B: Local Queue MVP (June 10 – June 20)
**Goal:** No lost work; resume from mid-pipeline failure

**Deliverables:**

1. **PostgreSQL Schema** (Docker Compose setup)
   
   Durable entity tables (production objects):
   ```sql
   -- Videos and scripts
   CREATE TABLE videos (
     id UUID PRIMARY KEY,
     series_id UUID,
     title TEXT,
     video_state VARCHAR(50),  -- planned, scripted, voiced, assets_ready, captions_ready, composed, variants_ready, ready_to_post, partially_posted, posted, archived
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   
   CREATE TABLE scripts (
     id UUID PRIMARY KEY,
     video_id UUID REFERENCES videos(id),
     content TEXT,
     created_at TIMESTAMP
   );
   
   -- Assets and captions
   CREATE TABLE captions (
     id UUID PRIMARY KEY,
     video_id UUID REFERENCES videos(id),
     format VARCHAR(20),  -- srt, vtt, json
     content TEXT,
     burn_in_variant BOOLEAN,
     created_at TIMESTAMP
   );
   
   -- Renders (production outputs)
   CREATE TABLE renders (
     id UUID PRIMARY KEY,
     video_id UUID REFERENCES videos(id),
     format_key VARCHAR(50),  -- youtube_longform, tiktok, etc.
     file_path VARCHAR(500),
     codec VARCHAR(20),
     bitrate VARCHAR(20),
     resolution VARCHAR(20),
     created_at TIMESTAMP,
     duration_seconds INT
   );
   
   -- Production packages
   CREATE TABLE production_packages (
     id UUID PRIMARY KEY,
     video_id UUID REFERENCES videos(id),
     platform VARCHAR(50),
     manifest_path VARCHAR(500),
     ready_to_post BOOLEAN,
     package_state VARCHAR(50),  -- draft, ready, posted, archived
     created_at TIMESTAMP
   );
   
   -- Accounts
   CREATE TABLE accounts (
     id UUID PRIMARY KEY,
     platform VARCHAR(50),
     handle VARCHAR(200),
     account_id VARCHAR(200),
     daily_post_limit INT,
     burst_limit_per_hour INT,
     min_cooldown_minutes INT,
     last_posted_at TIMESTAMP,
     posted_count_today INT DEFAULT 0,
     status VARCHAR(20),  -- active, paused, error
     created_at TIMESTAMP
   );
   
   -- Execution-only (ephemeral)
   CREATE TABLE jobs (
     id UUID PRIMARY KEY,
     video_id UUID REFERENCES videos(id),
     job_type VARCHAR(50),  -- generation, rendering, caption, posting
     model VARCHAR(50),
     job_state VARCHAR(20),  -- pending, leased, running, succeeded, failed, dead
     idempotency_key VARCHAR(100),  -- for posting jobs
     retry_count INT DEFAULT 0,
     error_message TEXT,
     created_at TIMESTAMP,
     started_at TIMESTAMP,
     completed_at TIMESTAMP,
     leased_until TIMESTAMP
   );
   
   -- Audit trail
   CREATE TABLE events (
     id UUID PRIMARY KEY,
     entity_type VARCHAR(50),  -- video, job, account, posting_job
     entity_id UUID,
     event_type VARCHAR(50),  -- created, state_changed, error, retry
     details JSONB,
     created_at TIMESTAMP
   );
   
   CREATE INDEX idx_videos_state ON videos(video_state);
   CREATE INDEX idx_jobs_state ON jobs(job_state);
   CREATE INDEX idx_jobs_video ON jobs(video_id);
   CREATE INDEX idx_accounts_platform ON accounts(platform);
   ```

2. **Docker Compose Setup**
   ```yaml
   version: '3.8'
   volumes:
     data:
   services:
     postgres:
       image: postgres:16
       environment:
         POSTGRES_DB: video_orchestrator
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
       volumes:
         - data:/var/lib/postgresql/data
       ports:
         - "5450:5432"
   ```

   Local default connection string: `postgres://postgres:postgres@localhost:5450/video_orchestrator`.

3. **Worker Process** (TypeScript, implemented)
   - File: `operations/specs/video-orchestrator/video-orchestrator-worker.ts`
   - Pull jobs from `jobs` table (`job_status = 'pending'`)
   - Lease jobs, transition to running, and write event records
   - Execute Phase 2B-safe job types: render, caption, thumbnail, manifest, post no-op, analytics no-op
   - Upsert durable records for renders, captions, thumbnails, and production packages
   - Generate schema-valid production package manifests
   - Mark placeholder artifacts as not upload-ready and emit manifest warnings
   - Auto-retry on failure, then mark dead after max retries

   Implementation note: render/caption/thumbnail commands are adapter hooks supplied through `task_config`. Without real commands, the worker writes explicit placeholder artifacts for queue/resume testing only; placeholders must not count as production-ready media.

### Phase 2C: Local Production Adapters
**Goal:** Replace placeholder-only execution with real local artifacts where local tools are available.

**Implemented scope:**
- FFmpeg render adapter for source video transforms and still-image-plus-audio MP4 generation
- FFmpeg thumbnail extraction/resizing
- Optional Whisper.cpp caption adapter when a compatible binary and model path are configured
- `ffprobe` validation so text placeholders or corrupt media do not count as upload-ready
- Manifest artifact provenance metadata and warnings for placeholder or invalid artifacts

**Out of scope:** Phase 3 posting adapters, platform credentials, OAuth, cookies, `.env` changes, and platform API publishing.

4. **State Transitions**
   - Video states: planned → scripted → voiced → assets_ready → captions_ready → composed → variants_ready → ready_to_post → partially_posted → posted → archived
   - Job states: pending → leased → running → (succeeded | failed | dead)
   - Posting states: draft → scheduled → uploading → published | failed

5. **Resumability**
   - Query last completed state: `SELECT * FROM videos WHERE id=X`
   - Resume from next uncompleted stage
   - Example: If composed but not rendered, resume at rendering stage

**Testing:**
- [ ] Queue 5 videos
- [ ] Worker processes all 5 successfully
- [ ] Simulate failure at render stage
- [ ] Resume batch: completed stages skip, failed stage retries
- [ ] Verify event log has all transitions

**Success Criteria:**
- Batch of 5 videos can fail mid-run and resume without lost work
- All state transitions logged
- No manual intervention needed to resume

---

### Phase 3A: Manual Upload Adapter (June 20 – July 15)
**Goal:** Export a complete local upload package for human review and manual posting

**Deliverables:**

1. **Manual Export Contract**
   - Export a local package directory for each upload-ready package target
   - Copy video, thumbnail, captions, manifest excerpt, metadata, checksums, and human instructions
   - Persist export/audit events in the worker
   - Keep exports idempotent by target folder path

2. **Manual Adapter Behavior**
   - `adapter_mode = manual` triggers export
   - `adapter_mode = api` stays a no-op in Phase 3A
   - Missing `adapter_mode` falls back to manual when the target declares manual fallback
   - Incomplete packages fail safely unless explicit override is enabled

3. **Export Folder Convention**
   - Default root: `/Users/Office/projects/video-orchestrator/upload-packages`
   - Suggested path: `<root>/<video_id>/<platform>__<package_target>/`
   - Files: `video.mp4`, optional `thumbnail.jpg`, `captions/*`, `metadata.json`, `instructions.md`, `package-manifest.json`, `checksums.sha256`

4. **Posting Job State Machine**
   - Phase 3A only marks the export job succeeded after writing the package folder
   - Real publishing states remain Phase 3B+

5. **Phase 3B+ Adapter Architecture**
   - Future work: `PostingAdapter`, credential validation, authorized API upload, polling, scheduling
   - Future work: YouTube and Bluesky API adapters only after manual export is stable

**Testing:**
- [ ] Manual adapter exports a package folder for a real upload-ready target
- [ ] Incomplete export is blocked unless explicit override is enabled
- [ ] Export artifacts include metadata, instructions, manifest excerpt, and checksums
- [ ] Export audit event is written

**Success Criteria:**
- Human-upload packages are reproducible and safe
- No API posting occurs
- Manual export behavior is stable enough to support later authorized adapters

### Phase 3B: Posting Adapter Interface + Registry (June 20 – July 15)
**Goal:** Introduce a formal adapter contract and safe routing layer without enabling network posting

**Deliverables:**
- Adapter interface with `validateConfig`, `validateCredentials`, `preflight`, `execute`, and `pollStatus`
- Registry for `manual`, `api`, `n8n`, `browser_assisted`, and `disabled`
- Dry-run/blocked results for non-manual adapters
- Audit events for adapter selection, preflight, blocking, and skip outcomes

**Behavior:**
- Manual remains the only executable adapter
- API/n8n/browser-assisted adapters stay stubbed and safe
- Unknown modes fall back to manual only when the target already supports manual fallback

**Testing:**
- [ ] Manual adapter still exports packages
- [ ] API/n8n/browser-assisted adapters return dry-run or blocked results
- [ ] No network or credential access occurs

**Success Criteria:**
- Posting jobs route through the adapter registry safely
- Real posting remains intentionally out of scope

### Phase 3C: YouTube Dry-Run Preflight (June 20 – July 15)
**Goal:** Add a YouTube-specific dry-run adapter that validates package readiness and emits idempotent audit output without upload

**Deliverables:**
- YouTube-specific `api` dry-run adapter
- Package readiness checks for title, description, real video media, thumbnail, and captions
- Privacy/status config validation with private default
- Idempotency key calculation for later upload phases
- Dry-run audit metadata that reports what would be uploaded

**Behavior:**
- No OAuth or credential reads
- No YouTube API calls
- Manual adapter remains the fallback path
- Non-YouTube API mode still uses the generic safe stub

**Testing:**
- [ ] YouTube dry-run validates a real package/config pair
- [ ] Invalid YouTube config is blocked safely
- [ ] Dry-run metadata includes idempotency and upload intent fields

**Success Criteria:**
- YouTube readiness can be checked without secrets or network access
- Phase 3D can add real upload later without changing the dry-run contract

### Phase 3D: YouTube Credential and OAuth Design (June 20 – July 15)
**Goal:** Define the credential and OAuth boundary for a future YouTube upload adapter without enabling upload or secret handling

**Deliverables:**
- Design-only YouTube credential contract JSON
- Localhost OAuth callback and PKCE-ready flow shape
- Keychain-based token storage recommendation and DB reference model
- Scope, quota, privacy, and approval-gate documentation
- Manual fallback and duplicate-prevention rules

**Behavior:**
- No OAuth execution
- No token storage in repo files or `.env`
- No YouTube API calls
- No upload implementation
- Manual fallback remains required

**Testing:**
- [ ] Credential contract validates as JSON
- [ ] Design notes capture approval gates before a real upload phase
- [ ] No secrets or token values are introduced

**Success Criteria:**
- Future upload work has a clear credential boundary
- Phase 3E can be implemented only after approval and storage decisions are intentionally made

### Phase 3E-A: Keychain Credential Helper Scaffold (June 20 – July 15)
**Goal:** Provide a local-only credential helper scaffold that validates references and redacts logs without reading or writing secrets

**Deliverables:**
- CLI helper for credential reference validation and redaction
- Dry-run Keychain read/write command shapes
- Placeholder-only sample credential reference config
- OAuth setup shape runbook for future phases

**Behavior:**
- No real Keychain reads or writes by default
- No OAuth execution
- No token storage or network calls
- Manual fallback remains the safe path

**Testing:**
- [ ] Credential reference validation passes for the supported shape
- [ ] Redaction removes sensitive-looking values from sample text
- [ ] Dry-run command shapes print without touching Keychain

**Success Criteria:**
- Future credential handling has a standard local-only reference format
- Logs and examples can be redacted safely before any real OAuth work

### Phase 3E-B: YouTube OAuth Setup Scaffold (June 20 – July 15)
**Goal:** Provide a local-only OAuth setup scaffold that generates authorization metadata and validates callback/state shape without exchanging tokens or storing credentials

**Deliverables:**
- PKCE and state generation
- Placeholder-only YouTube authorization URL builder
- Callback validation for localhost redirect shape and state matching
- OAuth scaffold runbook and sample config

**Behavior:**
- No token exchange
- No Keychain read or write
- No YouTube API calls
- No upload implementation
- No browser automation

**Testing:**
- [ ] OAuth scaffold self-test passes
- [ ] Placeholder config builds an authorization URL
- [ ] Callback validation rejects mismatched state

**Success Criteria:**
- Future OAuth work has a defined local setup shape
- Real upload remains gated behind later approval

### Phase 3E-C: YouTube OAuth Token Exchange + Keychain Prototype (June 20 – July 15)
**Goal:** Provide an explicitly gated CLI prototype for exchanging a YouTube authorization code and storing the resulting token JSON in macOS Keychain without enabling upload

**Deliverables:**
- Explicitly gated token exchange command
- Explicitly gated Keychain read/write/delete commands
- Token exchange and storage redaction summaries
- Sample token exchange config and runbook

**Behavior:**
- No upload implementation
- No browser automation
- No `.env` or token file output
- No Google client libraries
- User must explicitly approve each sensitive operation

**Testing:**
- [ ] Token self-test passes without real tokens
- [ ] Confirmation flags are required for sensitive commands
- [ ] Redacted summaries never print raw token values

**Success Criteria:**
- Future upload work can validate the OAuth/token boundary safely
- Manual fallback remains intact until explicit upload approval

### Phase 3E-D: Credential-Backed YouTube Upload Preflight (June 20 – July 15)
**Goal:** Verify Keychain-backed credential presence and youtube.upload scope readiness during dry-run preflight without enabling upload

**Deliverables:**
- Redacted Keychain summary command for YouTube credentials
- Worker support for credential-backed dry-run preflight metadata
- Scope-readiness reporting for `youtube.upload`
- Sample credential-backed dry-run job config and runbook

**Behavior:**
- `credential_preflight_only: true` may trigger a redacted Keychain summary
- Missing or malformed credentials block safely but do not dead-letter
- No upload implementation

**Testing:**
- [ ] Redacted Keychain summary reports token presence without values
- [ ] Worker merges credential-backed preflight metadata safely
- [ ] No upload or YouTube API calls occur

**Success Criteria:**
- YouTube dry-run jobs can verify credential readiness without exposing secrets
- Credential-backed preflight remains separate from the eventual upload phase

### Phase 3E-E: First Private YouTube Upload (July 15 – August 15)
**Goal:** Upload exactly one private YouTube video with explicit approval, one account, and one package target

**Deliverables:**
- Private-only YouTube upload adapter path
- One-job upload gating, idempotency, and private-fallback behavior
- Keychain token read and optional refresh path
- Private upload success/failure audit metadata

**Behavior:**
- `dry_run` must be false
- `real_upload_approved` must be true
- privacy remains private-only
- no thumbnails, captions, bulk, or scheduling

**Testing:**
- [ ] Private-only upload succeeds for one approved job
- [ ] Public and unlisted uploads are blocked
- [ ] Duplicate idempotency skips
- [ ] Manual fallback remains available

**Success Criteria:**
- One private YouTube upload can be executed safely
- The adapter stays narrow and manually gated

### Phase 3E-F: YouTube Upload Lifecycle / Status Handling (August 15 – September 15)
**Goal:** Add read-only lifecycle/status checks for known private YouTube uploads without adding new publishing capability

**Deliverables:**
- YouTube lifecycle state model
- videos.list status check for known uploaded video IDs
- redacted lifecycle metadata emission
- conservative success/failure/unknown states
- manual fallback remains available

**Behavior:**
- No new upload modes
- No public or unlisted publishing
- No thumbnail or caption upload
- No arbitrary polling of unknown videos
- No token logging

**Testing:**
- [ ] Status check returns uploaded/processing/available_private/failed/unknown conservatively
- [ ] Missing credential reference blocks safely
- [ ] Missing YouTube video ID blocks safely
- [ ] videos.insert is not used by lifecycle checks

**Success Criteria:**
- The worker can observe lifecycle state for a known private upload safely
- Upload remains private-only and manually gated

### Phase 3E-G: Dashboard Surfacing for YouTube Upload Lifecycle (August 15 – September 15)
**Goal:** Surface read-only YouTube lifecycle status in the local dashboard without adding any controls

**Deliverables:**
- Dashboard lifecycle panel for YouTube uploads
- Read-only `/api/video-orchestrator/status` surfacing
- Redacted warning/error summary display
- Lifecycle counts and latest-state summary

**Behavior:**
- No upload/OAuth buttons
- No token or credential reference display
- No Keychain or YouTube API calls from the dashboard
- No polling from the dashboard

**Testing:**
- [ ] Status endpoint includes a `youtube_lifecycle` object
- [ ] Dashboard renders lifecycle state without controls
- [ ] No credential references or token values appear in output
- [ ] Empty lifecycle state renders a safe placeholder

**Success Criteria:**
- Operators can read lifecycle state safely from the dashboard
- The dashboard remains read-only and does not widen the upload surface

### Phase 3Z: Security, Operations, and End-to-End Readiness Review (September 15 – September 20)
**Goal:** Review the accumulated Video Orchestrator security boundaries, operational constraints, and end-to-end readiness without adding runtime capability

**Deliverables:**
- readiness report covering upload, token, dashboard, and sidecar boundaries
- first-real-private-upload operator checklist
- security boundary checklist for future phases
- doc corrections where current text is inconsistent with the implementation

**Behavior:**
- No new upload capabilities
- No new OAuth scopes or credential storage locations
- No Keychain, dashboard, or API behavior changes
- No public or unlisted upload expansion

**Testing:**
- [ ] Boundary review docs are explicit and consistent
- [ ] First-real-private-upload checklist is complete and honest about manual prerequisites
- [ ] Security checklist covers secrets, Keychain, OAuth, dashboard, sidecar, and fallback

**Success Criteria:**
- The current phase boundaries are clearly documented
- The first private upload path is reviewed honestly, including remaining operator prerequisites
- The docs no longer imply broader upload capability than the implementation supports

### Phase 3X: Optional oMLX Local LLM Provider MVP (June 20 – July 15)
**Goal:** Add a narrow local-only text provider for metadata variants without making oMLX required

**Deliverables:**
- `llm_text` job path for metadata variants
- localhost-only oMLX availability check
- OpenAI-compatible chat completion call for prompt-to-JSON metadata variants
- Safe fallback/skip behavior when oMLX is unavailable
- Optional runbook-only integration guidance for future expansion

**Behavior:**
- No media rendering, transcription, or posting
- No secrets, OAuth, or external network calls
- Production continues when oMLX is offline

**Testing:**
- [ ] Local metadata variants job succeeds or skips safely
- [ ] Non-localhost oMLX URLs are rejected
- [ ] Invalid JSON response is handled safely

**Success Criteria:**
- One low-risk text task is available locally
- oMLX remains optional and non-blocking

---

### Phase 3Y: MacBook oMLX Sidecar Worker
**Goal:** Route opt-in low-risk text jobs to a trusted MacBook oMLX node over Thunderbolt Bridge without making remote execution required

**Deliverables:**
- local worker-node schema for oMLX sidecars
- trusted Thunderbolt/LAN node validation and health checks
- opt-in routing for low-risk `llm_text` jobs
- secret-field guards for remote payloads
- local fallback/skip when the MacBook sidecar is unavailable

**Behavior:**
- Only text tasks remain eligible
- No secrets, credentials, posting, uploads, or media generation
- The Mac mini remains the control plane
- Remote sidecar calls are opt-in and non-blocking

**Testing:**
- [ ] Localhost oMLX still works or skips safely
- [ ] Trusted Thunderbolt/LAN endpoint is rejected unless explicitly enabled
- [ ] Secret-shaped payload keys are blocked before a network call
- [ ] Unavailable sidecar falls back locally or skips safely

**Success Criteria:**
- One optional MacBook oMLX sidecar node can serve safe text jobs
- Production continues when the MacBook is offline

---

### Phase 4: Multi-Account Scheduler (July 15 – August 15)
**Goal:** Safely distribute across many accounts without spam risk

### Phase 4A: Account Registry + Credential Health Center (September 20 – October 1)
**Goal:** Add a read-only account registry and credential health center so operators can automate readiness checks before the first private upload and future account expansion

**Deliverables:**
- account registry schema and placeholder examples
- account capability, privacy, and notification metadata
- local account-health dry-run script
- redacted credential summary checks for approved accounts
- safe snapshot generation for the dashboard
- read-only dashboard account health panel
- readiness dry-run command for the first private upload checklist
- nightly health-check support

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

**Testing:**
- [ ] Registry validation accepts placeholder refs
- [ ] Registry validation rejects secret-looking values
- [ ] Health summaries redact credential references and token material
- [ ] Dashboard shows account health without display of credential references
- [ ] Readiness dry-run requires manual confirmation before any real private upload

**Success Criteria:**
- Operators can register accounts using placeholder-only schemas
- Credential health can be checked safely without exposing token values
- The dashboard shows read-only account status without exposing credential references
- The first private upload checklist is automated as far as local state allows

### Phase 4B: Operator Account Snapshot + Nightly Health Job (October 1 – October 8)
**Goal:** Turn the account-health workflow into a set-and-forget local flow using an untracked operator registry and a safe dashboard snapshot

**Deliverables:**
- operator-owned local registry under `runtime/local`
- init command to copy the placeholder registry into the local path
- nightly snapshot command for the safe dashboard file
- local log path for nightly runs
- docs for scheduler wiring without enabling destructive jobs

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

**Testing:**
- [ ] Local registry initialization refuses overwrite without `--force`
- [ ] Nightly snapshot writes a redacted dashboard file
- [ ] Dashboard reads the snapshot only
- [ ] Snapshot never exposes credential references or token values

**Success Criteria:**
- Operators can initialize a local registry in one command
- Nightly health checks produce a safe dashboard snapshot
- Runtime files remain untracked and outside the repo history

**Deliverables:**

1. **Account Registry** (Phase 2B schema already includes)
   - Per-account fields: platform, handle, account_id, daily_post_limit, burst_limit_per_hour, min_cooldown_minutes
   - Credentials: stored in OS Keychain, referenced in DB
   - Health: last_posted_at, posted_count_today, failure_streak, status

2. **Content Distribution Policies**
   - Duplicate-content policy: min_delay_same_platform (e.g., 30 min between posts to same platform)
   - Caption variation: optional require different captions per account posting (soft constraint)
   - Thumbnail variation: optional require different thumbnails (soft constraint)
   - Account topic fit: soft constraint (e.g., brand accounts reject casual content)

3. **F0 Workflow** (Distribution Planning)
   User action: "Distribute this batch to YouTube, TikTok, Instagram"
   
   Workflow:
   ```
   F0.1: List available accounts per platform
   F0.2: Ask user which accounts per platform
   F0.3: Pre-flight validation:
     - Adapter status (supported / manual / blocked)
     - Credential validity
     - Account daily limits (won't exceed)
     - Duplicate-content policy (30 min delay)
     - Resource availability (thermal, CPU)
   F0.4: Output distribution manifest
     video_id → [(platform, account), (platform, account), ...]
   ```

4. **Pre-Flight Validation** (F1 Workflow)
   - Account limits: will batch exceed daily_post_limit?
   - Cooldowns: enforce min_delay_same_platform
   - Adapter status: can we actually post to this platform?
   - Credentials: are they still valid?
   - Resource: is Mac mini available?

5. **Posting Job Scheduling**
   - Stagger posts per account: enforce min_cooldown_minutes
   - Respect adapter limits: YouTube quota, TikTok rate limits, X rate limits
   - Separate thread pool: posting jobs don't compete with generation
   - Idempotency: same posting job never posts twice

**Testing:**
- [ ] Register 2+ accounts per platform
- [ ] F0 workflow distributes batch to multiple accounts
- [ ] Pre-flight validation blocks if limits exceeded
- [ ] Post 10 videos across 3 YouTube accounts with 30-min cooldown respected

**Success Criteria:**
- Multi-account posting without spam risk
- Cooldowns and rate limits enforced
- Audit logs show all posts per account

---

### Phase 5: Optimization & Optional LoRA (August 15 – September 15)
**Goal:** Data-driven improvements; optional brand customization

**Deliverables:**

1. **Performance Metrics** (Local Snapshots)
   - Table: performance_snapshots (video_id, platform, account_id, posted_at, hook, model, avatar, template_id, views, likes, comments, shares, engagement_rate, estimated_roi)
   - Collection: Manual snapshots (no automated API polling; user enters data or optionally integrates API)
   - Storage: Durable (not lost if Mac reboots)

2. **Analytics Dashboard**
   - Option A: CSV export (simple, user imports to Excel/Sheets)
   - Option B: Simple web UI (Flask, localhost:5000) showing:
     - Best-performing model last 30 days
     - Best-performing hook
     - Best-performing avatar
     - Per-account performance

3. **Learning Recommendations**
   - Query: which model/hook/avatar performed best in last 30 days?
   - Recommendation engine: suggest best performers for next batch
   - User can accept or override

4. **Optional LoRA Experiments** (NOT blocking production)
   - LoRA training scripts: train on 50 brand images (optional)
   - LoRA model manager: load fine-tuned model if available
   - **Important:** LoRA training on 24 GB Mac mini may succeed or may hit memory limits
   - **Fallback:** If training fails, production continues; fall back to base FLUX
   - **Schedule:** Night batch only (90% resources available)

**Testing:**
- [ ] Collect performance snapshots for 10 videos
- [ ] Query: best model/hook/avatar last 30 days
- [ ] Generate recommendations
- [ ] (Optional) Train LoRA on 50 brand images; test inference
- [ ] (Optional) Verify production continues if LoRA training fails

**Success Criteria:**
- Metrics collected reliably
- Learning recommendations accurate
- (Optional) LoRA experiments working or failing gracefully

---

## Resource Scheduling & Constraints

### Resource Classes
- **cpu_light:** Metadata, script gen (negligible CPU, anytime)
- **media_encode:** FFmpeg (2–3 parallel, limit VRAM pressure)
- **image_fast:** SDXL (30–60s, daytime OK)
- **image_heavy:** FLUX, LoRA (2–4 min, night preferred)
- **talking_head:** Wave, Roop (60–120s, anytime but lighter times preferred)
- **posting:** n8n, API, manual (separate pool, parallel to media)
- **analytics:** Metrics, LoRA training (night batch)

### Scheduling Rules
1. **Only one heavy model job at a time** (FLUX, LoRA)
2. **FFmpeg:** 2–3 concurrent encodes if VRAM permits
3. **Posting:** Separate thread pool (parallel to generation)
4. **Night mode:** ~90% CPU/GPU; safe for FLUX, LoRA
5. **Day mode:** SDXL + posting + analytics
6. **Monitor:** Track RAM, thermal state, CPU load; throttle if > 85%

---

## Testing & Validation

### Phase 2A Testing
- [ ] Generate production packages for all 8 platforms
- [ ] Verify captions (SRT, VTT, JSON)
- [ ] Verify safe-zone rendering
- [ ] Manual upload one package

### Phase 2B Testing
- [ ] Queue 5 videos; all complete successfully
- [ ] Simulate failure at render stage; resume batch
- [ ] Verify event log complete

### Phase 3 Testing
- [ ] YouTube adapter uploads successfully (valid credentials)
- [ ] YouTube adapter fails gracefully (invalid credentials)
- [ ] Bluesky adapter posts successfully
- [ ] Manual adapter generates package
- [ ] Audit log tracks all attempts

### Phase 4 Testing
- [ ] Distribute batch to 3 YouTube accounts with 30-min cooldown
- [ ] Cooldown enforced: posts staggered correctly
- [ ] Pre-flight validation blocks if daily_limit exceeded

### Phase 5 Testing
- [ ] Collect performance snapshots for 10 videos
- [ ] Recommendations generated correctly
- [ ] (Optional) LoRA training succeeds or fails gracefully

---

## Known Limitations & Workarounds

**Platform Publishing:**
- TikTok direct posting requires Content Posting API product access and the official creator-info → initialize → export flow; fallback to manual upload or browser-assisted workflows when not approved.
- Instagram/Facebook publishing depends on Meta API permissions, account type, OAuth setup, and app review; fallback to manual packages when not authorized.
- YouTube upload quota costs and daily quota limits can change; store current quota assumptions and `last_verified_at` in platform specs instead of hardcoding a videos/day claim.
- Bluesky video posting requires account eligibility and must respect daily video/CDN limits; verify current limits before adapter implementation.
- X and LinkedIn publishing are constrained by API plan, permissions, and rate limits; verify before implementation.

**Local Execution:**
- Only one heavy model job at a time; serialize FLUX jobs
- 24 GB shared memory; don't assume all 4 models concurrent

**LoRA Training:**
- May hit memory limits on 24 GB Mac; benchmark first
- Training time: 4–8 GPU hours (night only)
- Fallback: if training fails, fall back to base FLUX

**Captions:**
- Whisper.cpp local; quality depends on audio input
- Fallback: optional cloud TTS/transcription API

---

## Next Steps

1. **Phase 2A (May 30):** Start platform/format/caption specs and Whisper.cpp integration
2. **Phase 2B (June 10):** PostgreSQL + worker setup
3. **Phase 3 (June 20):** YouTube + Bluesky adapters
4. **Phase 4 (July 15):** Multi-account scheduler
5. **Phase 5 (Aug 15):** Metrics + optional LoRA

All timelines assume feedback and iteration; adjust as needed.
