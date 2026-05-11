# Video Orchestrator — Implementation Plan (Revised)

**Date:** 2026-05-11 (VO-2E Complete)  
**Status:** VO-2E complete (CLI, adapter contracts, readiness reporting); detailed guide for phases 2A/2B/2C/2D/2E  
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

### Phase VO-2A: Project-Based Distribution Model Foundation (May 11 – May 30)
**Goal:** Create a planning-only schema and dry-run model for multi-platform distribution; does NOT schedule real jobs, does NOT connect accounts, does NOT call platform APIs, does NOT upload

**What VO-2A Does:**
- Defines a JSON Schema for projects with safe account references
- Provides example projects with realistic multi-platform configurations
- Implements a dry-run planning function that calculates weekly cadence per project
- Returns readable plan metadata (platform slots, weekly totals, account IDs) for a later scheduler phase
- Logs planning events for auditability

**What VO-2A Does NOT Do:**
- Does not create jobs in the scheduler queue
- Does not call any platform APIs (YouTube, TikTok, etc.)
- Does not upload or publish content
- Does not store credentials, tokens, keys, or keychain URLs in project configs
- Does not implement OAuth or account onboarding (that's Phase 3+)
- Does not enforce posting quotas or rate limits (that's Phase 4)

**Deliverables:**

1. **Project Distribution Schema** (`operations/specs/video-orchestrator/project-distribution.schema.json`)
   - JSON Schema Draft 7 for projects
   - Root fields: `schema_version` (1.0), `projects` (array)
   - Project fields: `project_id`, `project_name`, `theme` (optional), `enabled`, `platform_accounts`, `content_policy` (optional), `scheduler_policy`
   - Platform account config: `account_id` (required, safe label only), `posts_per_week` (optional, 0–7), `preferred_days` (optional weekday names), `preferred_time_local` (optional HH:MM), `timezone` (optional), `enabled` (optional, defaults true)
   - **Safety guarantees:** account_id is a symbolic label only (e.g., "youtube-channel-main"); never contains credentials, tokens, keychain URLs, or secrets
   - **Schema validation:** Enforces no "daily" keyword (use explicit day names); enforces account_id pattern `^[a-z0-9_-]+$`

2. **Example Projects** (`operations/specs/video-orchestrator/examples/project-distribution.example.json`)
   - Two realistic projects with no real credentials
   - Project Alpha: Educational Technology (YouTube 2/week + Facebook 1/week = 3 weekly slots)
   - Project Beta: Creative Content (YouTube 3/week + TikTok 5/week + Instagram 4/week + Facebook 2/week = 14 weekly slots)
   - Demonstrates multi-platform cadence, preferred days, and timezone handling
   - All account_id values are placeholder labels only

3. **Project Distribution Planning Interfaces & Function** (in `projects/probot/src/bot/video-orchestrator-jobs.ts`)
   - Interface: `ProjectDistribution` — represents the input project config (matches schema structure)
   - Interface: `PlatformSlot` — per-platform info within a plan result (platform, account_id, posts_per_week, preferred_days, timezone, etc.)
   - Interface: `ProjectPlanResult` — output metadata:
     * `project_id`: project identifier
     * `planned_platforms`: count of enabled platforms
     * `planned_weekly_slots`: sum of posts_per_week across enabled platforms (honest cadence measure)
     * `platform_slots`: array of PlatformSlot objects with full cadence details
     * `dry_run_confirmed`: inherits project's scheduler_policy.dry_run_default
     * `next_run_window`: ISO 8601 timestamp
   - Function: `planProjectDistribution(projects: ProjectDistribution[]): ProjectPlanResult[]`
   - Behavior:
     * Filters enabled projects only (skips if project.enabled === false)
     * For each project, iterates platform_accounts
     * Skips disabled platforms (enabled === false)
     * Treats missing posts_per_week as 0
     * Sums posts_per_week to calculate planned_weekly_slots
     * Returns full platform_slots array for downstream scheduler use
     * Logs planning event with project_id, platforms count, weekly_slots, dry_run flag
     * No side effects: does not create jobs, does not call APIs, does not write files

4. **Comprehensive Project Distribution Tests** (in `projects/probot/src/bot/video-orchestrator-jobs.test.ts`)
   - **VO-2A-1:** Planning creates plan without uploading (single project)
   - **VO-2A-2:** Multiple projects with different cadences (Project A: 3 slots, Project B: 14 slots)
   - **VO-2A-3:** Respects enabled flag for both projects and platforms (disabled platform filtered from count)
   - **VO-2A-4:** Planning does not call platform APIs or create jobs (verifies no publish_episode jobs created)
   - **VO-2A-5:** platform_slots includes full cadence details (posts_per_week, preferred_days, timezone, etc.)
   - **VO-2A-6:** Missing posts_per_week treated as 0 (honest default)
   - **VO-2A-7:** Plan output contains no credential references or sensitive data (scans JSON for forbidden strings)
   - **Schema/Example Validation (5 tests):** Validates schema JSON parses, example JSON parses, all preferred_days use valid weekday names only, all platform accounts have account_id, no forbidden sensitive strings in example

**Testing Checklist:**
- ✓ Schema JSON parses (valid JSON)
- ✓ Example JSON parses and conforms to schema structure
- ✓ All preferred_days values are valid weekday names (no "daily")
- ✓ All platform accounts have account_id
- ✓ No forbidden strings in schema or example (access_token, refresh_token, client_secret, keychain://, credential_reference, etc.)
- ✓ All 7 VO-2A planning tests pass
- ✓ All 5 schema/example validation tests pass
- ✓ No video jobs created by planning
- ✓ No platform APIs called
- ✓ TypeScript typecheck: 0 errors
- ✓ All 143 tests pass (cumulative)

**Architecture Decisions:**
- **Planning is separate from execution:** The planner returns metadata; a future VO-2B scheduler will map plans into actual jobs
- **Account references are labels only:** account_id like "youtube-channel-main" maps to real account credentials stored in Keychain (Phase 3+)
- **Weekly cadence is truth:** planned_weekly_slots sums posts_per_week (not platform count); more honest for downstream scheduling
- **Disabled platforms are skipped:** Both project.enabled and platform.enabled are respected; disabled platforms do not appear in platform_slots
- **No upload capability yet:** Schema defines fields but no code reads YouTube channel IDs, no OAuth, no videos.insert

**Success Criteria:**
- Projects defined with safe account references; planning function works
- Example projects validate against schema
- Planning does not create jobs or call APIs
- Weekly cadence calculated correctly per project
- Disabled projects and platforms handled correctly
- Plan output includes all info needed for future scheduler (platform_slots with cadence details)
- Foundation ready for Phase 2B (production package MVP) and Phase 3 (adapter work)

---

### Phase VO-2B: Project Distribution Dry-Run Scheduling (May 11 – May 30)
**Goal:** Convert project distribution plans into safe dry-run scheduler jobs; does NOT publish, does NOT call platform APIs, does NOT add real publishing adapters

**What VO-2B Does:**
- Takes ProjectPlanResult from VO-2A planning
- Creates dry-run `publish_episode` scheduler jobs based on posts_per_week
- Distributes posts across preferred_days when specified
- Applies preferred_time_local to job scheduled_for timestamps
- Attaches safe project/platform/account metadata to each job
- Detects and avoids duplicate jobs on subsequent runs
- Logs all scheduling events for auditability

**What VO-2B Does NOT Do:**
- Does not call YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, or any platform APIs
- Does not upload or publish content
- Does not create real publishing jobs (only dry_run=true jobs)
- Does not store or access credentials, tokens, or keychain URLs
- Does not implement OAuth or account onboarding (Phase 3+)
- Does not enforce posting quotas or rate limits (Phase 4)
- dryRun=false is explicitly blocked with clear error

**Deliverables:**

1. **Dry-Run Job Scheduling Function** (in `projects/probot/src/bot/video-orchestrator-jobs.ts`)
   - Function: `scheduleProjectDistributionPlan(input: ScheduleProjectDistributionInput): ScheduleProjectDistributionResult`
   - Input interface:
     * `projects: ProjectDistribution[]` — array of projects to schedule
     * `dryRun: boolean` — must be true; false throws error
     * `startDate?: Date` — start date for scheduling (default: today)
     * `weeks?: number` — number of weeks to schedule (default: 1)
   - Output interface:
     * `created: number` — jobs created in this run
     * `existing: number` — jobs detected as existing (duplicates)
     * `skipped: number` — projects skipped (no enabled platforms, no weekly slots)
     * `planned: ProjectPlanResult[]` — full plan results
   - Behavior:
     * Blocks if dryRun === false with error message
     * Calls planProjectDistribution to get project plans
     * For each plan, iterates platform_slots
     * Creates dry_run=true jobs for each posts_per_week slot
     * Distributes posts across preferred_days (cycles if slots > days)
     * Sets job.result with safe metadata: project_id, platform, account_id, cadence_source
     * Detects duplicates by checking (type + scheduled_for + project_id + platform + account_id)
     * No credentials, tokens, keychain URLs, or secrets in metadata
     * No platform API calls, no uploads

2. **Duplicate Detection** (built into scheduling function)
   - Checks existing jobs for matching (publish_episode + scheduled_for + project_id + platform + account_id)
   - Increments `existing` counter instead of creating duplicate
   - Ensures idempotent scheduling: running twice with same input creates no new jobs

3. **CLI Command** (`projects/probot/src/scripts/video-orchestrator-project-scheduler.mjs`)
   - Usage: `npm run probot:video:plan-projects -- --dry-run=true --file <path> --weeks <n>`
   - Arguments:
     * `--dry-run=true|false` (required): enable/disable dry-run (false blocked)
     * `--file <path>` (required): path to project distribution JSON file
     * `--weeks <number>` (optional): number of weeks to schedule (default 1)
     * `--start-date <ISO>` (optional): ISO 8601 start date (default today)
   - Behavior:
     * Reads and validates project distribution JSON file
     * Calls scheduleProjectDistributionPlan with dryRun=true
     * Prints summary: created, existing, skipped, total projects, total weekly slots
     * Exits with error if --dry-run=false
   - **Smart path resolution** (VO-2B-H1):
     * Resolves --file paths in order: absolute, cwd-relative, repo-root-relative, projects/probot-relative
     * No need for manual path adjustment across different working directories
     * Throws clear error if file not found (lists attempted paths safely, no secrets)
   - Command examples (from repo root):
     ```bash
     npm run probot:video:plan-projects -- --dry-run=true --file operations/specs/video-orchestrator/examples/project-distribution.example.json --weeks=1
     npm run probot:video:plan-projects -- --dry-run=true --file operations/specs/video-orchestrator/examples/project-distribution.example.json --weeks=4 --start-date=2026-05-15
     ```
   - Command examples (from projects/probot):
     ```bash
     npm run probot:video:plan-projects -- --dry-run=true --file ../../operations/specs/video-orchestrator/examples/project-distribution.example.json --weeks=1
     ```

4. **Tests** (in `projects/probot/src/bot/video-orchestrator-jobs.test.ts`)
   - **VO-2B-1:** scheduleProjectDistributionPlan blocks dryRun=false with clear error
   - **VO-2B-2:** Creates jobs based on posts_per_week (2 YouTube + 1 Facebook = 3 jobs/week)
   - **VO-2B-3:** Scheduled jobs include safe metadata (project_id, platform, account_id) with no secrets
   - **VO-2B-4:** Respects disabled project (skip entirely)
   - **VO-2B-5:** Respects disabled platform (skip that platform only)
   - **VO-2B-6:** Duplicate detection (second run creates 0 jobs, marks as existing)
   - **VO-2B-7:** Does not create real upload jobs (all dry_run=true, no videos.insert)
   - **VO-2B-8:** Result contains no credential references or sensitive strings

**Testing Checklist:**
- ✓ dryRun=false throws error with message
- ✓ Jobs created correctly based on posts_per_week
- ✓ Job metadata includes project/platform/account safely
- ✓ Disabled projects filtered
- ✓ Disabled platforms filtered
- ✓ Duplicate detection works (idempotent)
- ✓ All jobs are dry_run=true
- ✓ No videos.insert calls
- ✓ No credential strings in output
- ✓ CLI command parses args correctly
- ✓ TypeScript typecheck: 0 errors
- ✓ All 148 tests pass

**Architecture Decisions:**
- **Dry-run only:** dryRun=false explicitly blocked; real publishing deferred to Phase 3+
- **Job metadata, not execution:** Jobs are created with safe result metadata; they are not executed/published by VO-2B
- **Safe account references:** account_id is the safe label (e.g., "youtube-channel-main"); credentials not involved
- **Duplicate protection:** Scheduled jobs include enough metadata to detect duplicates; prevents re-scheduling
- **Preferred days distribution:** Posts_per_week slots distributed across preferred_days (cycles if slots > days)
- **Timezone in metadata only:** preferred_time_local stored in job result; no complex timezone conversion in VO-2B

**Success Criteria:**
- Dry-run scheduling creates jobs with correct posts_per_week distribution
- Disabled projects and platforms respected
- Jobs include safe project/platform/account metadata
- Duplicates detected (second run creates 0 new jobs)
- All jobs are dry_run=true (no real publishing)
- CLI command works with --file and --weeks arguments
- dryRun=false blocked with clear error
- Foundation ready for Phase 2C (production packages) and Phase 3 (real adapters)

---

### Phase VO-2C: Production Package Foundation (May 11 – May 30)
**Goal:** Define production package schema, create example, and implement safe package draft function; metadata only, no real rendering.

**What VO-2C Does:**
- Defines production-package.schema.json (existing; describes complete manifest for all platform variants)
- Creates production-package.example.json (safe example with placeholder local paths)
- Implements createProductionPackageDraft function to create package metadata from scheduled jobs
- Package drafts store safe metadata: project_id, platform, account_id, scheduled_for, etc.
- Marks ready_to_post=false with blocking reasons (rendering not implemented)
- Prepares architecture for VO-2D (media adapters) and VO-3A (manual upload)

**What VO-2C Does NOT Do:**
- Does NOT render video files (FFmpeg)
- Does NOT generate thumbnails (beyond placeholder references)
- Does NOT transcribe audio or generate captions (beyond placeholder references)
- Does NOT call platform APIs
- Does NOT publish or upload
- Does NOT store or access credentials
- Does NOT implement OAuth

**Deliverables:**

1. **Production Package Schema (VO-2C Draft Model)** (`operations/specs/video-orchestrator/production-package.schema.json`)
   - JSON schema v7 defining VO-2C draft structure (metadata only, no media rendering)
   - Required fields: schema_version, package_id, project_id, platform, account_id, source_job_id, package_state, dry_run, created_at, scheduled_for, assets, platform_target, readiness, provenance
   - account_id is "local symbolic reference only" — never a token, credential, or keychain URL
   - assets.metadata: scalar-only map (string | number | boolean | null) to prevent credential leakage
   - No file_size_bytes, duration_seconds, or other indicators that media was rendered
   - readiness.ready_to_post always false in VO-2C with blocking reason: "Media rendering is not implemented in VO-2C. Real video/thumbnail/caption rendering deferred to VO-2D."

2. **Production Package Example (VO-2C Metadata-Only Draft)** (`operations/specs/video-orchestrator/examples/production-package.example.json`)
   - True metadata-only draft showing schema structure without fake media indicators
   - package_state: "draft", dry_run: true, ready_to_post: false
   - assets.captions: [] (no rendered file paths)
   - assets.metadata: safe scalars only (job_type, job_status, job_dry_run, job_scheduled_for)
   - platform_target: format_key with aspect_ratio and resolution inferred from key
   - No upload instructions, render outputs, or manual publishing steps
   - Warnings explain: "metadata-only package draft" and "Use for schema validation and planning only"

3. **Package Draft Function (Safe Metadata Handling)** (in `projects/probot/src/bot/video-orchestrator-jobs.ts`)
   - Function: `createProductionPackageDraft(input: CreateProductionPackageDraftInput): ProductionPackageDraft`
   - Input: scheduled job, project_id, platform, account_id, scheduled_for, dryRun
   - Output: package draft with safe metadata only
   - Behavior:
     * Blocks if dryRun === false with error message
     * Generates package_id from job.id
     * Sets package_state = "draft"
     * Sets ready_to_post = false with blocking reason
     * Sanitizes job.result using allowlist-based filter to remove dangerous fields (credential_reference, keychain://, access_token, refresh_token, client_secret, code_verifier, authorization_code, bearer)
     * Only copies scalar values from sanitized result (prevents nested object leakage)
     * Infers aspect_ratio/resolution from format_key
   - Helper function: `sanitizeJobResultForPackageMetadata(result: unknown): Record<string, unknown>`
     * Rejects keys containing credential, keychain, access_token, refresh_token, client_secret, code_verifier, authorization_code, bearer
     * Only copies string | number | boolean | null values
     * Never copies nested objects or arrays (prevents structure-based attacks)

4. **Tests** (in `projects/probot/src/bot/video-orchestrator-jobs.test.ts`)
   - **VO-2C-1:** Schema has required VO-2C draft fields (package_id, source_job_id, package_state, dry_run, readiness, provenance)
   - **VO-2C-2:** Example matches schema structure with all required root fields
   - **VO-2C-3:** Example is metadata-only (no file_size_bytes, no duration_seconds, no upload steps)
   - **VO-2C-4:** Example contains no credential refs, tokens, or secrets
   - **VO-2C-10:** Draft does not copy raw job.result (sanitized only)
     * Metadata includes job_type, job_status, job_dry_run, job_scheduled_for
     * No dangerous key patterns in metadata
   - **VO-2C-11:** Sanitization blocks malicious job.result values
     * access_token, client_secret, sk_test, keychain, and nested objects all blocked
     * Safe fields pass through (job_type, job_status, safe_field)

**Architecture Decisions:**
- **Metadata only:** Package drafts are safe JSON metadata; no FFmpeg, no real files, no fake media indicators
- **Dry-run only:** dryRun=false explicitly blocked with error; real rendering deferred to VO-2D
- **Allowlist-based sanitization:** Job result metadata filtered by dangerous key patterns; only scalars copied (prevents credential leakage and structure-based attacks)
- **account_id as safe reference:** Symbolic reference only — never a token, credential, or keychain URL
- **assets.metadata type restriction:** Scalar-only map (string | number | boolean | null) to prevent nested objects from carrying credentials
- **Format inference:** Aspect ratio and resolution inferred from format_key string (e.g., "landscape_1920x1080_16x9")
- **Blocking transparency:** ready_to_post always false with clear reason explaining why package cannot be uploaded yet
- **Schema-driven validation:** All drafts validated against JSON schema; no draft escapes without required fields

**Success Criteria:**
- Production package schema valid JSON conforming to JSON schema v7 spec
- Example valid JSON matching schema structure exactly
- Example is true metadata-only draft (no file_size_bytes, no duration_seconds, no rendered media paths)
- Example contains no credential/token references, keychain URLs, or unsafe patterns
- createProductionPackageDraft creates safe drafts from scheduled jobs
- Job result sanitization blocks dangerous fields (credential_reference, keychain://, access_token, refresh_token, client_secret, code_verifier, authorization_code, bearer)
- All drafts mark ready_to_post=false with clear blocking reason
- assets.metadata restricted to scalars only (no nested objects or arrays)
- No upload/API capability, no OAuth, no platform calls
- All 163 tests passing including VO-2C-10 and VO-2C-11 sanitization tests

---

### Phase VO-2D: Package Draft Persistence and Local Validation (May 11 – May 25)
**Goal:** Persist production package drafts locally and validate package readiness metadata without rendering media or calling platform APIs.

**What VO-2D Does:**
- Persists package drafts to JSON-backed local store (package-drafts.json in ~/.local/probot/video-orchestrator)
- Provides package draft CRUD operations: save, list, get, update readiness
- Validates package metadata readiness (blocking reasons, warnings)
- Creates package drafts from scheduled dry-run publish_episode jobs with project/platform/account metadata
- Avoids duplicate drafts by package_id
- Handles draft filtering by project_id, platform, package_state
- Stable sort by scheduled_for then created_at

**What VO-2D Does NOT Do:**
- Does NOT render video files (FFmpeg deferred to VO-2E)
- Does NOT generate thumbnails (deferred to VO-2E)
- Does NOT transcribe audio or generate captions (deferred to VO-2E)
- Does NOT call platform APIs
- Does NOT publish or upload
- Does NOT store or access credentials
- Does NOT implement OAuth

**Deliverables:**

1. **Package Draft Store Functions** (in `projects/probot/src/bot/video-orchestrator-jobs.ts`)
   - `saveProductionPackageDraft(draft: ProductionPackageDraft): void` — upsert by package_id
   - `listProductionPackageDrafts(options?: {project_id?, platform?, package_state?}): ProductionPackageDraft[]` — filter and sort by scheduled_for
   - `getProductionPackageDraft(package_id: string): ProductionPackageDraft | null` — single lookup
   - `updateProductionPackageDraftReadiness(package_id: string, readiness: {...}): void` — update validation state

2. **Package Validation Function** (in `projects/probot/src/bot/video-orchestrator-jobs.ts`)
   - `validateProductionPackageDraft(draft: ProductionPackageDraft): PackageValidationResult`
   - Returns: ok, ready_to_post, blocking_reasons, warnings
   - Blocks on missing video asset
   - Warns on missing thumbnail/captions
   - Blocks on invalid platform_target
   - Blocks on invalid package_state
   - Always returns ready_to_post=false for VO-2D (metadata-only, no real validation until VO-2E)

3. **Scheduled-Job-to-Draft Function** (in `projects/probot/src/bot/video-orchestrator-jobs.ts`)
   - `createPackageDraftsForScheduledJobs(input: {dryRun: true; status?: "scheduled"|"completed"; limit?: number}): CreatePackageDraftsForScheduledJobsResult`
   - Processes publish_episode jobs with project/platform/account metadata (from VO-2B scheduling)
   - Calls createProductionPackageDraft for each job
   - Saves drafts using saveProductionPackageDraft
   - Returns: {created, existing, skipped, drafts}
   - Blocks if dryRun !== true
   - Skips jobs without project_id/platform/account_id

4. **Tests** (in `projects/probot/src/bot/video-orchestrator-jobs.test.ts`)
   - **VO-2D-1:** Save and retrieve with temp runtime dir
   - **VO-2D-2:** Save is upsert, no duplicates
   - **VO-2D-3:** List filters by project_id, platform, package_state
   - **VO-2D-4:** Validation returns ready_to_post=false
   - **VO-2D-5:** Validation blocks missing video asset
   - **VO-2D-6:** Validation warns for missing thumbnail/captions
   - **VO-2D-7:** createPackageDraftsForScheduledJobs creates drafts from jobs
   - **VO-2D-8:** Skips jobs without project/platform/account metadata
   - **VO-2D-9:** Avoids duplicate drafts
   - **VO-2D-10:** dryRun=false blocks
   - **VO-2D-11:** Store output contains no credentials/tokens/secrets
   - **VO-2D-12:** No upload/API calls

**Architecture Decisions:**
- **Local JSON store:** Package drafts stored as JSON array in ~/.local/probot/video-orchestrator/package-drafts.json (same runtime dir as jobs/quota)
- **Upsert by package_id:** Saving twice with same package_id updates in place; no duplicates
- **Stable sort:** Drafts sorted by scheduled_for (ascending) then created_at; consistent ordering for planning
- **Metadata-only validation:** No real media inspection; ready_to_post always false until VO-2E adds local media validation
- **No platform APIs:** All validation is metadata structure and schema only; no credentials or network calls
- **Blocking vs. warnings:** Missing video = blocking (hard requirement); missing thumbnail/captions = warnings (can be added later)

**Success Criteria:**
- Package drafts persist to JSON store
- Save is upsert by package_id (no duplicates)
- List filters and sorts correctly
- Validation returns ready_to_post=false for all metadata-only drafts
- Validation correctly blocks missing video asset
- Validation correctly warns for missing optional assets
- createPackageDraftsForScheduledJobs creates drafts from jobs with metadata
- Duplicate drafts avoided
- All 12 VO-2D tests passing
- No credentials, tokens, or secrets in stored output
- No upload/API capability

---

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

### Phase 4C: Dashboard Account Onboarding + OAuth Connect Flow (October 8 – October 22)
**Goal:** Make the dashboard the operator entry point for adding accounts, connecting YouTube OAuth, and regenerating local health state without manual JSON editing

**Deliverables:**
- dashboard account onboarding forms
- safe local account registry write path
- YouTube OAuth connect flow with localhost callback
- macOS Keychain token storage boundary
- automatic health snapshot regeneration after save/connect
- OAuth client configuration state in runtime/local

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

**Testing:**
- [ ] Account onboarding form rejects secret-like fields
- [ ] OAuth start omits code_verifier from responses
- [ ] Callback stores tokens only in Keychain
- [ ] Dashboard does not expose credential references or token values

**Success Criteria:**
- Operators can add and connect YouTube accounts from the dashboard
- Local registry and snapshot update automatically after save/connect
- Dashboard remains read-only for upload actions

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

---

## VO-2E: Package Draft CLI, Local Adapter Contracts, and Readiness Reporting (2026-05-11) ✅

**Status:** Complete

**What VO-2E Adds:**

1. **Package Draft CLI (`npm run probot:video:package-drafts`)**
   - `create-from-jobs --dry-run=true --limit=N`: Create package drafts from scheduled jobs
   - `list [--project-id=<id>] [--platform=<platform>]`: List package drafts safely
   - `validate [--all | --package-id=<id>]`: Validate package readiness
   - `status`: Summary report of all drafts by state and platform
   - All commands: safe output only (no metadata/credentials exposed)
   - dryRun=false blocks safely with helpful error

2. **Local Adapter Contract Types**
   - `LocalAdapterKind`: render, caption, thumbnail, metadata, manual_export
   - `LocalAdapterMode`: not_implemented, dry_run, disabled
   - `LocalPackageAdapter`: Interface for future adapters
   - `LocalAdapterPlan`: Dry-run plan structure (no file creation)
   - `getLocalPackageAdapterRegistry()`: Placeholder adapters (dry-run/not_implemented only)

3. **Readiness Reporting**
   - `getProductionPackageReadinessReport()`: Safe summary-only report
   - Groups drafts by state and platform
   - Excludes: metadata, assets, credentials, Keychain URLs, tokens
   - Counts: ready_to_post (always 0 in VO-2E), blocked, warnings
   - Individual draft summaries include only safe fields

**Key Architecture Decisions:**

- All local adapters are placeholder/not_implemented in VO-2E
- ready_to_post remains false for all VO-2E metadata-only drafts
- No FFmpeg execution, no file creation, no platform APIs, no uploads
- CLI parser supports both `--key=value` and `--key value` formats
- Safe outputs prevent credential/token/path leakage

**Tests Added:**

- VO-2E-1: Registry contains all required adapter kinds
- VO-2E-2: All adapters are not_implemented mode
- VO-2E-3: Adapter validation returns blocking reasons
- VO-2E-4: Adapter plans include blocking reasons (no output files)
- VO-2E-5: Readiness report counts by state/platform
- VO-2E-6: Report excludes unsafe metadata
- VO-2E-7: ready_to_post is 0 for all VO-2E drafts
- VO-2E-8: Report drafts have safe summary fields only
- VO-2E-9: No adapter calls fs/ffmpeg/platform APIs
- VO-2E-10: dryRun=false blocks safely
- CLI parser tests (5): --key=value, --key value, mixed, flags, string values

**Files Created:**
- `projects/probot/src/scripts/video-orchestrator-package-drafts.mjs`
- `projects/probot/src/scripts/video-orchestrator-package-drafts-args.ts`
- `projects/probot/src/scripts/video-orchestrator-package-drafts.test.ts`

**Files Modified:**
- `projects/probot/src/bot/video-orchestrator-jobs.ts`: Added adapter contracts, registry, readiness report
- `projects/probot/package.json`: Added package-drafts script
- `package.json`: Added root proxy for package-drafts
- `operations/runbooks/video-orchestrator-roadmap.md`: Updated status
- `operations/runbooks/video-orchestrator-implementation-plan.md`: Updated status

**What VO-2E Does NOT Do:**
- No real FFmpeg execution (no rendering, compositing, encoding)
- No platform API calls (YouTube, TikTok, Instagram, etc.)
- No upload capability
- No file creation beyond JSON package store
- No credential handling beyond allowlist validation
- No actual media inspection/validation

### VO-2E Phase 2: Read-Path Output Safety (2026-05-11 Revised) ✅

**Problems Identified (ChatGPT Review):**
1. `getProductionPackageReadinessReport()` grouped by raw `draft.package_state` and `draft.platform` — unsafe values leaked through `by_state` and `by_platform` keys
2. `buildProductionPackageDraftSummary()` used raw `draft.readiness.ready_to_post` instead of validation result
3. CLI `validate` and `create-from-jobs` printed raw package IDs without sanitization
4. `formatPackageId()` was not hardened against non-string/null/edge-case inputs

**Solutions Implemented:**

1. **Hardened `buildProductionPackageDraftSummary(draft)`**
   - Now calls `validateProductionPackageDraft(draft)` internally
   - `ready_to_post` from validation (always false in VO-2E), not raw readiness
   - `blocking_reasons_count` and `warnings_count` from validation, not raw arrays
   - Fallback values updated:
     - `package_id`: `[unsafe-package-id]`
     - `project_id`: `[unsafe-project]`
     - `platform`: `[unsafe-platform]`
     - `package_state`: `blocked` (semantic fallback)
     - `scheduled_for`: `[unsafe-scheduled-for]`

2. **Fixed `getProductionPackageReadinessReport()` grouping**
   - Builds safe summary first: `const summary = buildProductionPackageDraftSummary(draft)`
   - Groups by sanitized values: `by_state[summary.package_state]` and `by_platform[summary.platform]`
   - Unsafe legacy values never appear in report keys or draft summaries

3. **Hardened `formatPackageId(id)` in CLI**
   - Rejects non-string input: returns `[unsafe-package-id]`
   - Handles empty strings, null, undefined safely
   - Preserves fallback markers without slicing them

4. **Updated CLI commands to use safe summaries**
   - `create-from-jobs`: builds summary before printing package IDs
   - `validate`: builds summary before printing validation results
   - `list`: already uses summary (verified)
   - `status`: uses `getProductionPackageReadinessReport()` (now sanitized)

5. **Created pure formatting helpers module**
   - `projects/probot/src/scripts/video-orchestrator-package-drafts-format.ts`
   - `formatPackageId(id)`: Safe package ID formatting with fallback handling
   - `formatPackageDraftDate(value)`: Safe date formatting with `[unsafe-scheduled-for]` fallback (never returns Invalid Date)
   - Imported by CLI script and tested directly

**Tests Added:**
- VO-2E-16: `by_platform` keys with unsafe values (e.g., containing `client_secret`) do not leak
- VO-2E-17: `by_state` keys with unsafe values (e.g., containing `access_token`) do not leak
- VO-2E-18: draft `package_id` in report does not leak keychain URLs
- VO-2E-19: draft `project_id` in report does not leak Bearer tokens
- VO-2E-20: `ready_to_post` remains false even if raw `readiness.ready_to_post` was true
- VO-2E-21: `JSON.stringify(report)` contains no forbidden patterns
- CLI formatting helper tests (9): `formatPackageId` and `formatPackageDraftDate` with edge cases

**CLI Safe-Output Validation:**
- `npm run probot:video:package-drafts -- status`: ✅ Safe output, no forbidden strings, sanitized grouping keys
- `npm run probot:video:package-drafts -- list`: ✅ Uses summaries, safe dates (no Invalid Date)
- `npm run probot:video:package-drafts -- validate --all`: ✅ Uses summaries, no leaks
- `npm run probot:video:package-drafts -- create-from-jobs --dry-run=true`: ✅ Uses summaries
- `npm run probot:video:package-drafts -- create-from-jobs --dry-run=false`: ✅ Blocks safely

**Result:**
- All 226 tests pass (6 new unsafe legacy data tests + 9 formatting helper tests)
- TypeScript typecheck passes with no errors
- Report grouping keys are fully sanitized (by_state, by_platform)
- All CLI outputs use safe summaries exclusively
- Date formatting never throws Invalid Date errors
- Legacy/manual JSON data is sanitized on read at all output points
- No forbidden patterns leak through report structure, keys, or CLI output
- No placeholder tests (all real assertions)

---

## VO-2F + VO-3A Foundation: Content Brief & Media Asset Validation (2026-05-11) ✅

**Goal:** Prepare the pipeline for local production by defining:
1. Local media asset validation contracts (shape/path only, no FFmpeg, no file I/O)
2. Content brief/input model specification for one future video
3. Safe schema/examples and comprehensive tests
4. Bridge content briefs into production package draft metadata safely

**Deliverables:**

### VO-2F: Content Brief Schema & Input Validation
- **`content-brief.schema.json`** (5.8 KB): JSON schema with required fields
  - `schema_version`, `brief_id`, `project_id`, `title`, `objective`, `target_platforms`, `content_type`, `source_materials`, `production_constraints`, `created_at`
  - Enum validation: platforms (youtube, tiktok, instagram, etc.), content_type (short_form, long_form, etc.)
  - No credentials, tokens, or secrets allowed
  
- **`content-brief.example.json`**: Safe example with fake data only

- **TypeScript Types & Validation:**
  - `ContentBrief`, `ContentBriefSourceMaterial`, `ContentBriefProductionConstraints`
  - `validateContentBrief(brief): ContentBriefValidationResult`
    - Validates all required fields
    - Checks platform/content_type enums
    - Blocks absolute paths, URLs, path traversal in local_path
    - Recursively scans for 12 forbidden patterns: access_token, refresh_token, keychain://, Bearer, client_secret, code_verifier, authorization_code, private_key, password, token, credential_reference, credentialReference
    - **Safe error messages:** No raw input values echoed in blocking_reasons (prevents credential leakage)
    - Returns `{ok, blocking_reasons, warnings}`

### VO-3A: Local Media Asset Validation
- **TypeScript Types:**
  - `LocalMediaAssetKind`: video | thumbnail | caption | metadata
  - `LocalMediaAssetReference`, `LocalMediaAssetValidationResult`
  
- **Validation Function:**
  - `validateLocalMediaAssetReference(asset): LocalMediaAssetValidationResult`
    - Shape/path validation only (no file existence checks, no media inspection)
    - Blocks absolute paths, URLs, path traversal
    - **Safe error messages:** Does not echo malicious strings in blocking_reasons
    - Returns `ready_for_render=false`, `ready_for_upload=false` (VO-2F behavior; inspection deferred to VO-3B+)

### Content Brief → Package Draft Bridge
- **Function:** `attachContentBriefToPackageDraft(input: {draft, brief, dryRun: true}): ProductionPackageDraft`
  - Requires `dryRun=true` (blocks production mode)
  - Validates brief before attaching
  - Creates safe copy (no mutation of original draft)
  - Adds safe metadata fields only:
    - `brief_id`, `brief_title`, `content_type`
    - `target_platforms_count`, `target_platforms` (as array, validated safe)
    - `constraints_language`, `constraints_captions_required`, `constraints_thumbnail_required`
  - **Does NOT copy:**
    - `source_materials`, `local_path`, `summaries`
    - `prohibited_claims`, `compliance_notes`
  - Preserves `ready_to_post=false`
  - Verifies output is safe via `assertProductionPackageDraftSafeForStorage()`

**Hardening (ChatGPT Verification):**
1. **Safe Validation Messages:** Added `safeValidationLabel(value, fallback)` helper
   - Rejects values >80 chars (token leak prevention)
   - Rejects values containing forbidden patterns
   - Only allows short alphanumeric identifiers in messages
   - Example: `"Unknown platform: youtube-access_token-leak"` → `"Unknown platform at target_platforms[0]"`

2. **Blocked Credential Leakage Vectors:**
   - Removed raw input values from all blocking_reasons (e.g., path validation no longer echoes paths)
   - Media asset validation does not echo URLs or Bearer tokens
   - Error messages use array indices instead of raw values

3. **Metadata Hardening:**
   - Attached brief metadata excludes source_materials and freeform fields
   - Only stores validated/safe summary fields
   - Storage verification ensures no forbidden patterns

**Tests (9 new hardening tests):**
- VO-2F-H1–H9: Safe error messages, credential non-leakage, metadata safety, storage acceptance/rejection
- Content brief validation with malicious platform names, content_types, paths
- Media asset validation with tokens, URLs, Bearer strings
- Attached metadata excludes sensitive fields
- All 34 VO-2F tests passing (25 original + 9 hardening)

**Files Created:**
- `operations/specs/video-orchestrator/content-brief.schema.json`
- `operations/specs/video-orchestrator/examples/content-brief.example.json`

**Files Modified:**
- `projects/probot/src/bot/video-orchestrator-jobs.ts`: +334 lines (types, validation, bridge, helpers)
- `projects/probot/src/bot/video-orchestrator-jobs.test.ts`: +698 lines (34 tests)
- `operations/runbooks/video-orchestrator-roadmap.md`: Added VO-2F, VO-3A status
- `operations/runbooks/video-orchestrator-implementation-plan.md`: Added VO-2F, VO-3A details

**What VO-2F + VO-3A Do NOT Do:**
- No real FFmpeg execution (validation is shape/path only)
- No platform API calls (no YouTube, TikTok, Instagram, etc.)
- No upload capability
- No file creation or file I/O (except JSON schema/example)
- No file existence checks (deferred to VO-3B+)
- No credential handling beyond pattern blocking
- No real media files created

**Test Results:**
- 260 total tests (226 existing VO-1–VO-2E + 34 new VO-2F)
- **260 passing, 0 failing**
- TypeScript: no errors
- Security scan: no forbidden patterns leak in examples or output

**Next Phase (VO-3B):**
Implement local render planning and manifest generation (still dry-run/no FFmpeg execution unless explicitly approved later). Prepare for actual media validation contracts when render pipeline is ready.

---

## VO-3B Foundation: Local Render Planning & Production Manifest (2026-05-11) ✅

**Goal:** Define how package drafts become render plans with target outputs, without executing rendering.

**Scope:** Planning layer only. No FFmpeg, no file creation, no actual rendering. `ready_for_render` and `ready_for_upload` remain `false`.

### VO-3B: Render Plan Schema & TypeScript Types

**Schema:** `operations/specs/video-orchestrator/render-plan.schema.json`
- **Required fields:** schema_version (const "1.0"), render_plan_id, package_id, project_id, platform (8 platforms), dry_run (const true), plan_state (draft|blocked|planned), created_at
- **render_targets:** Array of planned outputs (video, thumbnail, caption, metadata)
  - kind (video|thumbnail|caption|metadata)
  - format_key (reference to format-specs.json)
  - aspect_ratio (16:9|9:16|1:1|4:5)
  - resolution (e.g., "1920x1080")
  - planned_output_path (relative placeholders only, e.g., "renders/pkg-123/video_1920x1080.mp4")
  - expected_bitrate_kbps, expected_duration_seconds, safe_zone_profile (optional)
- **asset_plan:** Summary of planned assets
  - video: count + variants (format_key + planned_output_path)
  - thumbnails: count + variants
  - captions: count + formats + variants (each variant: format + planned_output_path)
- **validation:** Always has ready_for_render=false, ready_for_upload=false, blocking_reasons, warnings
- **provenance:** generated_by ("VO-3B createLocalRenderPlanFromPackageDraft"), source_package_id, checksum

**Safety constraints:**
- All paths must be relative (no `/`, no `..`, no URLs, no credentials)
- Forbidden patterns blocked (access_token, refresh_token, Bearer, keychain://, etc.)
- Paths validated for: absolute paths (rejected), URL detection (rejected), traversal (rejected)

**Example:** `operations/specs/video-orchestrator/examples/render-plan.example.json`
- YouTube render plan for "pkg-example-001"
- 4 render targets: video (1920×1080, H.264, 5Mbps), thumbnail (1280×720), captions (SRT + VTT)
- Asset plan matches targets
- Validation: ready_for_render=false, ready_for_upload=false, blocking_reasons list planning-only implementation

**TypeScript types added to video-orchestrator-jobs.ts:**
```typescript
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
type SafeZoneProfile = "desktop_landscape" | "mobile_vertical" | "square" | "portrait";
type RenderTargetKind = "video" | "thumbnail" | "caption" | "metadata";
type PlanState = "draft" | "blocked" | "planned";

interface RenderTarget { kind, format_key, aspect_ratio, resolution, planned_output_path, ... }
interface AssetVariant { format_key?, planned_output_path }
interface CaptionVariant { format: "srt"|"vtt"|"json", planned_output_path }
interface VideoAssetPlan { count, variants? }
interface ThumbnailAssetPlan { count, variants? }
interface CaptionAssetPlan { count, formats?, variants? }
interface AssetPlan { video, thumbnails, captions }
interface RenderPlanValidation { ready_for_render: false, ready_for_upload: false, blocking_reasons, warnings }
interface RenderPlanProvenance { generated_by, source_package_id, checksum? }
interface RenderPlan { schema_version: "1.0", render_plan_id, package_id, project_id, platform, dry_run: true, plan_state, created_at, render_targets, asset_plan, validation, provenance }
interface RenderPlanValidationResult { ok, blocking_reasons, warnings }
```

### VO-3B: Render Plan Functions

**Validation:**
- `validateRenderPlan(plan: unknown): RenderPlanValidationResult`
  - Validates all required fields
  - Checks schema_version = "1.0"
  - Validates render_plan_id format (lowercase alphanumeric)
  - Checks platform is valid (8 allowed platforms)
  - Ensures dry_run = true (planning only)
  - Validates plan_state in (draft|blocked|planned)
  - Validates created_at is ISO 8601
  - Validates render_targets array (non-empty, each target valid)
  - Validates asset_plan structure (video.count >= 1, thumbnails/captions >= 0)
  - Checks validation object (ready_for_render=false, ready_for_upload=false)
  - Checks provenance fields
  - Recursively blocks forbidden patterns (credentials, tokens, keychain://, Bearer)
  - Returns ok=false if any blocking_reasons
  - Adds warnings for draft state or planning-only notices

**Creation:**
- `createLocalRenderPlanFromPackageDraft(input: CreateRenderPlanInput): RenderPlan`
  - Input: draft (ProductionPackageDraft), platform (string), dryRun (true only)
  - Validates inputs and platform
  - Generates render_plan_id from package_id and platform
  - Builds render_targets based on draft metadata (thumbnail_required, captions_required)
  - Always includes video target (1920×1080, H.264, 5Mbps, 180s expected duration)
  - Conditionally includes thumbnail (if draft.assets.metadata.thumbnail_required)
  - Conditionally includes captions (if draft.assets.metadata.captions_required)
  - Builds asset_plan with matching counts and variants
  - Creates render plan with plan_state="planned"
  - Sets validation.ready_for_render=false, ready_for_upload=false
  - Validates created plan before returning
  - Throws if validation fails

**Persistence:**
- `saveRenderPlan(renderPlan: RenderPlan): void`
  - Validates plan before saving
  - Loads render-plans.json store
  - Updates existing or appends new plan
  - Saves store
  - Logs event
- `loadRenderPlan(renderPlanId: string): RenderPlan | null`
  - Loads render-plans.json store
  - Returns matching plan or null
- `listRenderPlans(options?: { package_id?, platform? }): RenderPlan[]`
  - Loads store
  - Filters by package_id and/or platform if provided
  - Returns array
- `deleteRenderPlan(renderPlanId: string): boolean`
  - Removes plan from store
  - Returns true if found and deleted, false otherwise
  - Logs event

**Readiness Reporting:**
- `generateRenderPlanReadinessReport(renderPlanId: string): RenderPlanReadinessReport | null`
  - Interface: render_plan_id, ready_for_render (false), ready_for_upload (false), plan_state, blocking_reasons, warnings, summary
  - Loads plan by renderPlanId
  - Returns null if not found
  - Includes blocking_reasons from plan.validation
  - Adds blocking reason if plan_state is "draft" or "blocked"
  - Builds human-readable summary based on plan_state
  - Returns comprehensive readiness assessment

**Store Structure:**
```json
{
  "schema_version": "1.0",
  "created_at": "ISO 8601",
  "plans": [ /* array of RenderPlan objects */ ]
}
```
- File path: `~/.local/probot/video-orchestrator/render-plans.json`
- Test override: PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR environment variable

### VO-3B: Safety Guarantees

**Paths Always Relative:**
- No absolute paths (must not start with `/`)
- No URLs (must not contain `://` or `http`)
- No traversal (must not contain `..`)
- Validation rejects all three patterns

**Forbidden Patterns Blocked:**
- credential_reference, credentialreference
- keychain://
- access_token, refresh_token, client_secret, code_verifier, authorization_code
- bearer, private_key, password, token
- Recursive scan catches nested patterns (e.g., in render_targets[i].planned_output_path)

**No Raw Input Echoing:**
- Error messages never include actual paths or values
- Error messages use generic labels ("platform must be valid", "path must be relative", etc.)
- Follows VO-2F pattern: safeValidationLabel() prevents leakage

**Immutable Flags:**
- ready_for_render always false in VO-3B (const false in schema)
- ready_for_upload always false in VO-3B (const false in schema)
- dry_run always true in VO-3B (const true in schema)
- Validation enforces all three; storage rejects violations

### VO-3B: Test Coverage (24 Tests)

**VO-3B-1–7:** Creation & Validation
- VO-3B-1: Create render plan from package draft
- VO-3B-2: Render plan schema version must be 1.0
- VO-3B-3: Invalid platform blocks render plan creation
- VO-3B-4: Render plan requires dryRun=true
- VO-3B-5: Render plan paths are relative, not absolute
- VO-3B-6: Render plan ready_for_render is always false
- VO-3B-7: Render plan includes blocking_reasons

**VO-3B-8–10:** Persistence
- VO-3B-8: Save and load render plan
- VO-3B-9: List render plans by package_id
- VO-3B-10: Delete render plan

**VO-3B-11–14:** Validation Details
- VO-3B-11: Render plan validation rejects invalid platform
- VO-3B-12: Render plan validation requires dry_run=true
- VO-3B-13: Render plan validation rejects absolute paths
- VO-3B-14: Render plan validation rejects URL paths

**VO-3B-15–17:** Readiness & Provenance
- VO-3B-15: Generate render plan readiness report
- VO-3B-16: Save render plan validates before storing
- VO-3B-17: Render plan contains provenance

**VO-3B-18–24:** Edge Cases & Multi-Platform
- VO-3B-18: Render plan with thumbnails required
- VO-3B-19: Render plan with captions required
- VO-3B-20: Render plan asset counts match targets
- VO-3B-21: Render plan validation rejects forbidden patterns
- VO-3B-22: List render plans by platform
- VO-3B-23: Render plan for multiple platforms
- VO-3B-24: Load non-existent render plan returns null

**All 24 tests passing.** (288 total tests: 226 existing VO-1–VO-2E + 34 VO-2F + 24 VO-3B + 4 hardening tests)

### VO-3B: Updated Files

**Created:**
- `operations/specs/video-orchestrator/render-plan.schema.json` (4.8KB JSON schema)
- `operations/specs/video-orchestrator/examples/render-plan.example.json` (Safe example with fake data)

**Modified:**
- `projects/probot/src/bot/video-orchestrator-jobs.ts`
  - Added VO-3B types (AspectRatio, RenderTarget, AssetPlan, RenderPlan, etc.)
  - Added store functions (getRenderPlansPath, loadRenderPlansStore, saveRenderPlansStore)
  - Added CRUD operations (saveRenderPlan, loadRenderPlan, listRenderPlans, deleteRenderPlan)
  - Added createLocalRenderPlanFromPackageDraft (500 lines)
  - Added validateRenderPlan (300 lines)
  - Added generateRenderPlanReadinessReport
  - Exported RenderPlan types and all functions
- `projects/probot/src/bot/video-orchestrator-jobs.test.ts`
  - Added VO-3B imports
  - Added 24 comprehensive tests (1,500+ lines)

### VO-3B: What It Does

✅ Plan render operations (no execution)
✅ Define output paths and formats
✅ Calculate asset counts and variants
✅ Persist plans locally in JSON
✅ Validate paths (relative, no traversal, no credentials)
✅ Generate readiness reports
✅ Support multi-platform planning
✅ Enforce immutable safety flags (dry_run=true, ready_for_render=false, ready_for_upload=false)
✅ Block forbidden patterns recursively
✅ Prevent credential leakage in error messages

### VO-3B: What It Does NOT Do

❌ Execute FFmpeg or any rendering
❌ Create actual output files
❌ Call platform APIs
❌ Upload to any platform
❌ Check if source files exist
❌ Perform real media validation (shape, codec, format)
❌ Generate video, thumbnails, or captions
❌ Check disk space or system resources
❌ Support non-dry-run mode (dryRun must be true)

### VO-3B Hardening (2026-05-11) ✅

**Goal:** Strengthen VO-3B safety and complete missing functionality.

**Hardening Changes:**

1. **Package Draft Validation in createLocalRenderPlanFromPackageDraft:**
   - Blocks non-dry-run package drafts: "VO-3B only supports dry-run package drafts"
   - Blocks upload-ready drafts: "VO-3B cannot create render plans from upload-ready drafts"
   - Platform matching: input.platform must equal draft.platform (no override)

2. **Enhanced listRenderPlans Filtering:**
   - Added filters: project_id, plan_state (in addition to package_id, platform)
   - Stable sorting: by created_at ascending, then render_plan_id
   - Immutable filtering: does not mutate store array

3. **Aggregate Render Plan Readiness Report:**
   - New function: `getLocalRenderPlanReadinessReport(options?: { project_id?, platform? })`
   - Returns: AggregateRenderPlanReadinessReport with counts and summaries
   - Safe output: no planned_output_path, render_targets, asset_plan, source_materials
   - ready_for_render and ready_for_upload always 0 in VO-3B
   - Sanitized keys in by_state and by_platform (no raw unsafe values)

4. **Safe Summary Builder:**
   - New function: `buildRenderPlanSummary(plan) → RenderPlanSummary`
   - Safe string sanitization: blocks long values, forbidden patterns, non-alphanumeric
   - Fallback values for unsafe fields: "[unsafe-render-plan-id]", "[unsafe-platform]", etc.
   - Used by aggregate report for consistent safe output

5. **Store Safety Enhancements:**
   - saveRenderPlansStore now sorts by created_at then render_plan_id before writing
   - Prevents duplicate render_plan_id (upserts instead of appends)
   - Validates before storing (rejects invalid, unsafe, or non-dry-run plans)

6. **Compatibility Wrappers:**
   - `saveLocalRenderPlan` → `saveRenderPlan`
   - `getLocalRenderPlan` → `loadRenderPlan`
   - `listLocalRenderPlans` → `listRenderPlans`
   - Supports code using either naming convention

7. **Test Coverage (40 tests total):**
   - Original 24 VO-3B tests + 16 hardening tests
   - VO-3B-H1: Non-dry-run package draft rejection
   - VO-3B-H2: Upload-ready draft rejection
   - VO-3B-H3: Mismatched platform rejection
   - VO-3B-H4: Platform error does not echo raw values
   - VO-3B-H5: Filter by project_id
   - VO-3B-H6: Filter by plan_state
   - VO-3B-H7: Sorting by created_at then render_plan_id
   - VO-3B-H8: Store sorted on write
   - VO-3B-H9: Aggregate report counts total
   - VO-3B-H10: Groups by sanitized state/platform
   - VO-3B-H11: ready_for_render is 0
   - VO-3B-H12: ready_for_upload is 0
   - VO-3B-H13: Report excludes paths/targets/asset_plan
   - VO-3B-H14: JSON.stringify report contains no forbidden strings
   - VO-3B-H15: Compatibility wrappers work
   - VO-3B-H16: buildRenderPlanSummary sanitizes unsafe values
   - **All 304 tests passing** (264 existing + 40 VO-3B)

### VO-3B: Hardening Summary

**Safety:**
- ✅ Package drafts must be dry-run (non-dry-run rejected)
- ✅ Upload-ready drafts rejected (VO-2E concern only)
- ✅ Platform must match between draft and plan (no multi-platform override)
- ✅ Error messages never echo raw platform/plan_id/project_id values
- ✅ Aggregate report sanitizes all output (no paths, targets, or assets)
- ✅ Store always sorted and validated before writing
- ✅ ready_for_render and ready_for_upload remain false (immutable in VO-3B)

**Functionality:**
- ✅ Complete list filtering (package_id, project_id, platform, plan_state)
- ✅ Stable sorting (by created_at then render_plan_id)
- ✅ Aggregate readiness reporting
- ✅ Safe summaries for CLI/reports
- ✅ Compatibility naming conventions

**Verification:**
- ✅ All 304 tests passing
- ✅ No raw unsafe values in reports
- ✅ No credential leakage in error messages
- ✅ No upload capability added
- ✅ No platform API calls
- ✅ No FFmpeg execution
- ✅ No real media files created

### VO-3C: Local File Existence Validation and Manifest Consistency Checks ✅ (2026-05-11)

**Goal:** Validate that source and output paths are safe and exist before rendering

**Delivered:**
1. **Safe Local Path Resolver** (`resolveSafeLocalValidationPath`)
   - Validates relative paths within baseDir only
   - Blocks absolute paths, URLs, path traversal, forbidden patterns
   - Returns safe absolute path or blocking reasons
   - Never echoes raw unsafe paths in error messages

2. **Local File Existence Validation** (`validateLocalFileExistence`)
   - Check mode: `disabled` (no filesystem checks) or `explicit` (check fs.existsSync)
   - Kind: `input` (files must exist or block) or `planned_output` (warnings only, VO-3C does not create)
   - Returns: checked flag, exists flag, safe path, blocking reasons, warnings
   - No directory creation, no file creation

3. **Render Plan Manifest Consistency** (`validateRenderPlanManifestConsistency`)
   - Validates render plan schema first (leverages VO-3B)
   - Checks all planned output paths in render_targets
   - Disabled mode: no fs checks, files_checked=0
   - Explicit mode: checks each planned output, missing outputs warn (not block)
   - Always returns: ready_for_render=false, ready_for_upload=false

4. **Validation Report** (`getLocalRenderPlanValidationReport`)
   - Summarizes all plans with optional filters (project_id, platform)
   - Disabled mode: files_checked=0, warnings about disabled checks
   - Explicit mode: counts total files checked, files missing, blocked plans
   - Returns safe summary only (no raw paths)

**Test Coverage:** 19 tests
- VO-3C-PR1–PR7: Safe path resolver (relative, absolute, URL, traversal, forbidden patterns, escape, no echo)
- VO-3C-FX1–FX5: File existence validation (disabled, exists, missing, input blocking, output warning)
- VO-3C-MC1–MC4: Manifest consistency (disabled mode, explicit mode, warnings, ready flags)
- VO-3C-VR1–VR3: Validation report (disabled, explicit, no path leakage)

**What It Does NOT Do:**
- Does NOT create directories or files
- Does NOT execute FFmpeg
- Does NOT upload
- Does NOT call platform APIs
- Filesystem checks only with explicit check mode

**What It Does:**
- Validates path safety before any filesystem operations
- Checks file existence only in explicit mode (not by default)
- Categorizes missing input (blocking) vs missing output (warning)
- Provides safe summaries without path echoing

**Integration:**
- New types: `LocalFileExistenceCheckMode`, `LocalFileExistenceCheckResult`, `ManifestConsistencyValidationResult`, `LocalValidationReportSummary`
- All checks optional in existing VO-3B reports (backward compatible)
- Explicit check mode available for new workflows

**Status:** Ready for rendering phases (VO-3D+)

---

---

### VO-3D: Manual Render Manifest Checks and Format/Platform Consistency Validation ✅ (2026-05-11)

**Status:** Complete with 11 comprehensive tests

**Implementation:**

1. **Function: `loadVideoOrchestratorFormatSpecs()`**
   - Safely loads `operations/specs/video-orchestrator/format-specs.json`
   - Returns `undefined` if file missing or malformed (graceful degradation)
   - Validates shape: must have `formats` array
   - No throws; warnings logged instead

2. **Function: `loadVideoOrchestratorPlatformSpecs()`**
   - Safely loads `operations/specs/video-orchestrator/platform-specs.json`
   - Returns `undefined` if file missing or malformed (graceful degradation)
   - Validates shape: must have `platforms` array
   - No throws; warnings logged instead

3. **Function: `validateRenderTargetAgainstSpecs(input: {target, platform, formatSpecs?, platformSpecs?})`**
   - Validates single render target against optional format/platform specs
   - Checks required fields: `format_key`, `aspect_ratio`, `resolution`
   - Blocks forbidden patterns using `isForbiddenStringPattern()` (case-insensitive)
   - Compares target against specs if available (warns on mismatch)
   - Returns `RenderManifestConsistencyCheckResult` with `checked_targets: 1`
   - **Immutable flags:** `ready_for_render: false`, `ready_for_upload: false`

4. **Function: `validateRenderPlanAgainstLocalSpecs(input: {plan, formatSpecs?, platformSpecs?})`**
   - Calls `validateRenderPlan()` first (VO-3B validation)
   - Validates each `render_target` against specs
   - Gracefully warns if specs unavailable (conservative, non-blocking)
   - Aggregates blocking reasons and warnings across all targets
   - Returns `RenderManifestConsistencyCheckResult`
   - **Immutable flags:** `ready_for_render: false`, `ready_for_upload: false`
   - **No file existence checks** (VO-3C responsibility)

5. **Function: `getManualRenderManifestCheckReport(input?: {project_id?, platform?, useLocalSpecs?})`**
   - Aggregates all render plans matching `project_id` and/or `platform` filters
   - Loads specs if `useLocalSpecs: true`
   - Validates each plan against specs
   - Returns `ManualRenderManifestCheckReport` with:
     - `total`: count of all plans
     - `checked_targets`: total targets validated
     - `blocked`: count of plans with blocking reasons
     - `warnings`: total warning count
     - `ready_for_render: 0` (immutable)
     - `ready_for_upload: 0` (immutable)
     - `plans[]`: sanitized summaries of each plan (no raw paths, no sensitive data)

**Safety Guarantees:**
- ✅ No file creation (read-only validation)
- ✅ No FFmpeg execution
- ✅ No platform API calls
- ✅ No secret leakage (paths sanitized, forbidden patterns blocked)
- ✅ Immutable `ready_for_render: false`, `ready_for_upload: false`
- ✅ Graceful degradation when specs unavailable

**Test Coverage (23 tests):**
- VO-3D-SL1-4: Spec loaders (load repo-local specs, no URLs/APIs, degrade safely)
- VO-3D-TV1-5: Target validation (missing fields, forbidden patterns, valid targets, optional fields, path sanitization)
- VO-3D-PV1-4: Plan validation (all targets, missing specs, schema validation, no file checks)
- VO-3D-MR1-5: Manifest reporting (aggregated summary, aggregated plans, upload immutable, legacy unsafe data sanitization, exclude raw targets/paths)
- VO-3D-SAFE1-3: Safety proofs (no file checks, no file creation, no FFmpeg/child_process)

**Total Test Count:** 354 (original 331 + 26 VO-3C hardening + 23 VO-3D)
**All Passing:** ✅ (354/354 tests passing)

---

### VO-3B + VO-3C + VO-3D: Next Steps (VO-3E+)

**VO-3E: Real Render Execution** — Implement actual FFmpeg rendering based on render plans (when approved)
- Execute render plans with real FFmpeg composition
- Create actual output files to planned_output_path
- Verify files meet expected specifications (duration, resolution, codec)
- Update render plan state to track execution progress
- **EXPLICIT APPROVAL REQUIRED** before this phase

**VO-3F: Render Status Tracking** — Track render job status
- Queuing (pending, in_progress, completed, failed)
- Progress reporting (percentage complete, ETA)
- Error recovery and retry logic

**VO-3G: Upload Orchestration** — Implement platform upload based on rendered assets
- Prepare upload manifests for each platform
- Call platform adapters to upload videos, thumbnails, metadata
- Set ready_for_upload=true when all uploads complete

**VO-3H: Multi-Account Distribution** — Extend to multiple accounts per platform
- Account registry lookup
- Per-account cooldowns and duplicate prevention
- Queuing and scheduling across accounts
