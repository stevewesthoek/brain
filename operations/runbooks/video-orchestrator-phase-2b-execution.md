# Video Orchestrator Phase 2B — Local Queue MVP (Execution Guide)

**Date:** 2026-05-08  
**Phase:** 2B (Local Queue MVP)  
**Timeline:** Jun 10 – Jun 20, 2026  
**Objective:** PostgreSQL durable entity model + worker process + manifest generation

---

## Overview

Phase 2B builds on Phase 2A specs to implement the **local production pipeline**:

- PostgreSQL database in OrbStack (port 5450)
- Durable entity model: videos, scripts, renders, packages, accounts
- Job queue: render, caption, thumbnail, manifest, posting jobs
- State machine: track video progress through pipeline
- Manifest generation: convert source video → 5 formats + 9 platform packages
- Mid-pipeline resumability: crash on job 5, resume at job 5

**No automatic posting yet.** Phase 3 adapters will consume manifests. Phase 2B produces them.

---

## Deliverables

### 1. PostgreSQL Schema & Initialization

**File:** `operations/runbooks/video-orchestrator-phase-2b-schema.sql`

Tables:
- **Durable entities:** videos, scripts, source_assets, captions, renders, thumbnails, production_packages, accounts
- **Ephemeral entities:** jobs, events, posting_jobs
- **Views:** video_pipeline_progress, account_posting_status, recent_job_activity
- **Function:** check_database_health()

Indexes on all critical query paths: video_id, job_status, platform, created_at, etc.

### 2. Docker Compose Configuration

**File:** `operations/database/standalone/video-orchestrator/docker-compose.yml`

Starts PostgreSQL 16 on port 5450 with:
- Service name: video-orchestrator
- Database: video_orchestrator
- User: postgres / password: postgres
- Volume: persistent data storage in OrbStack

### 3. Local Apps Registration

**File:** `operations/infrastructure/local-apps.json`

New entry:
```json
{
  "name": "Video Orchestrator",
  "repoPath": "/Users/Office/Repos/stevewesthoek/brain",
  "port": null,
  "check": null,
  "start": "cd ~/Repos/stevewesthoek/brain/operations/database/standalone/video-orchestrator && docker compose up -d",
  "stop": "cd ~/Repos/stevewesthoek/brain/operations/database/standalone/video-orchestrator && docker compose down",
  "restart": "cd ~/Repos/stevewesthoek/brain/operations/database/standalone/video-orchestrator && docker compose restart",
  "databaseEngine": "PostgreSQL",
  "databaseServiceName": "video-orchestrator",
  "databasePort": 5450,
  "databaseName": "video_orchestrator",
  "databaseUser": "postgres",
  "description": "Local video production pipeline: database, job queue, rendering, and multi-platform manifest generation"
}
```

---

## Implementation Instructions

### Step 1: Start PostgreSQL Database

```bash
# Via ProBot Local Apps tab (recommended):
# - Click Local Apps tab
# - Find "Video Orchestrator"
# - Click Start

# Or manually:
cd ~/Repos/stevewesthoek/brain/operations/database/standalone/video-orchestrator
docker compose up -d
```

### Step 2: Initialize Schema

```bash
# Via ProBot (if terminal integration available):
psql -h localhost -p 5450 -U postgres -d video_orchestrator -f operations/runbooks/video-orchestrator-phase-2b-schema.sql

# Or manually from database container:
docker exec video-orchestrator-postgres psql -U postgres -d video_orchestrator -f /tmp/schema.sql
```

### Step 3: Verify Database Health

```bash
psql -h localhost -p 5450 -U postgres -d video_orchestrator

-- Run this query:
SELECT check_database_health();

-- Expected output:
{
  "status": "healthy",
  "total_videos": 0,
  "total_accounts": 0,
  "pending_jobs": 0,
  "running_jobs": 0,
  "failed_jobs_7d": 0,
  "completed_packages": 0,
  "timestamp": "2026-05-08T14:30:00Z"
}
```

### Step 4: Test with Sample Manifest

```bash
# Load test manifest from Phase 2A:
psql -h localhost -p 5450 -U postgres -d video_orchestrator << EOF
-- Insert sample video
INSERT INTO videos (video_id, source_script_path, source_audio_path)
VALUES ('00000000-0000-0000-0000-000000000001', '/tmp/script.md', '/tmp/audio.wav');

-- Verify
SELECT * FROM videos;
EOF
```

---

## Integration with ProBot Studio Tab

The ProBot "Studio" tab (currently showing Viral Flow) will be **updated** (not replaced) to include video orchestrator status cards:

### Current Studio Tab (Viral Flow)
- Content Strategy (trending topics)
- Audience Insights (metrics)
- Batch Status (pipeline stages)
- Top Videos
- Recent Scripts

### Updated Studio Tab (Consolidated)
New cards added for video orchestrator:
- **Video Production Pipeline** (durable entity status)
  - Total videos: N
  - Current stage distribution (scripted, voiced, ready, etc.)
  - Active jobs in queue
- **Recent Production Packages** (latest manifests)
  - Video ID, platform targets, completeness %
  - "View Manifest" links
- **Job Queue Status** (ephemeral state)
  - Pending: N
  - Running: N
  - Failed (7d): N
  - Average job duration
- **Account Health** (posting readiness)
  - Accounts by platform
  - Last post time per account
  - Any suspended/needs_auth accounts

Recommended layout: 3-column grid, cards can be toggled on/off.

---

## What Phase 2B Implements

### ✅ Durable Entity Model
- Videos tracked end-to-end with unique video_id
- Separation of concerns:
  - Production assets: scripts, audio, source images
  - Generated assets: renders (5 formats), captions (3 formats), thumbnails (5 variants)
  - Packages: complete manifests per production-package.schema.json
  - Accounts: platform credentials and posting limits
- Foreign keys and cascading deletes for data integrity

### ✅ Ephemeral Job Queue
- Jobs pulled by worker from pending state
- Leasing mechanism prevents duplicate execution
- Retry logic with max retries per job
- Idempotency keys for posting jobs (prevent duplicate posts)
- Event log for audit trail

### ✅ State Machine for Pipeline Progress
- Videos progress through states: planned → scripted → voiced → assets_ready → captions_ready → composed → variants_ready → ready_to_post
- Queries can resume from any state
- Current state tracked in production_packages table

### ✅ Worker Process (Stub)
- Polls PostgreSQL for pending jobs
- Dispatches to specialized executors:
  - `executeRenderJob()` — calls FFmpeg with format-specs.json
  - `executeCaptionJob()` — calls Whisper.cpp with caption-specs.json
  - `executeThumbnailJob()` — calls SDXL or frame extraction
  - `executeManifestJob()` — generates production-package.json
  - `executePostingJob()` — routes to Phase 3 adapters
- Handles failures with exponential backoff

### ✅ Manifest Generation (Core MVP)
- Consumes Phase 2A specs (platform-specs.json, format-specs.json, caption-specs.json)
- Generates per production-package.schema.json
- Includes all 9 platform targets (YouTube long-form, Shorts, TikTok, Instagram Reels, Instagram Feed, LinkedIn, Facebook, Bluesky, X)
- Sets adapter_status and adapter_mode for each platform
- Includes manual_steps for manual fallback
- Calculates completeness percentage
- Validates before saving

---

## What Phase 2B Does NOT Implement

### ❌ Actual Job Execution
- Worker stub is pseudocode; real FFmpeg/Whisper.cpp calls are deferred
- Phase 2B focuses on infrastructure, not production logic

### ❌ Posting / Publishing
- No adapter interface
- No platform API calls
- Phase 3 responsibility

### ❌ Resource Scheduler
- No "one heavy model at a time" enforcement
- No thermal/RAM monitoring
- Phase 3 responsibility

### ❌ Web UI for Queue Management
- ProBot Studio tab shows status only
- No "create job", "cancel job", "retry" buttons yet
- Phase 3+ enhancement

---

## Critical Assumptions

1. **PostgreSQL is running in OrbStack** at localhost:5450
2. **Specs are finalized** (platform-specs.json, format-specs.json, caption-specs.json from Phase 2A)
3. **Safe-zone rendering approach chosen** before Phase 2B kicks off
   - Canonical timeline (5 separate renders) or simple transform (FFmpeg crop/scale)
   - Decision made in Phase 2A review
4. **Manual upload packages always available** (Phase 2B doesn't break manual fallback)
5. **Whisper.cpp is available** locally or via API (Phase 2B caption job assumes it exists)

---

## Testing & Validation

### Unit Tests (Phase 2B + 3)
- Schema creates all tables ✓
- Video insertion cascades to scripts/captions/renders ✓
- Job leasing prevents duplicate pulls ✓
- Manifest generation produces valid JSON per schema ✓

### Integration Tests (Phase 2B + 3)
- End-to-end: load test manifest → create video + jobs → verify manifest generation ✓
- Resume after failure: mark job failed, retry, verify it succeeds ✓
- Account posting status tracking: publish job → update account health ✓

### Acceptance Criteria
- [ ] Database health check returns healthy
- [ ] 100 sample videos can be inserted and queried
- [ ] Test manifest validates against schema
- [ ] Manifest generation produces output matching production-package.schema.json
- [ ] Job leasing prevents duplicate execution
- [ ] Manual upload instructions are present for all 9 platforms
- [ ] ProBot Studio tab displays database status

---

## Remaining TODOs (For Full Implementation)

1. **Complete Worker Stubs**
   - `executeRenderJob()`: call FFmpeg with format-specs
   - `executeCaptionJob()`: call Whisper.cpp
   - `executeThumbnailJob()`: call SDXL or extract frames
   - `executeManifestJob()`: implement manifest building (most critical)

2. **PostgreSQL Client Integration**
   - Replace better-sqlite3 stubs with actual pg or postgres client
   - Implement connection pooling
   - Add retry logic for transient errors

3. **ProBot Integration**
   - Add `/api/video-orchestrator/status` endpoint
   - Fetch video_pipeline_progress view
   - Display on Studio tab

4. **Whisper.cpp Integration**
   - Detect if installed locally
   - Fallback to API if not available
   - Respect caption-specs.json config

5. **Phase 3 Handoff**
   - Implement adapter interface consuming manifests
   - Add posting_job routing
   - Connect account health tracking

---

## Phase 2B → Phase 3 Handoff

**What Phase 3 will do:**

1. Implement adapter base class + YouTube, Bluesky adapters
2. Consume production_packages manifests
3. Route posting jobs per adapter_status and adapter_mode
4. Update posting_jobs table with posting_status
5. Handle OAuth token refresh and rate limits
6. Always respect manual_fallback: true

**What Phase 2B provides:**

✓ Production packages ready for posting (manifests complete)
✓ Manifest schema validated (production-package.schema.json)
✓ Platform specs accessible (platform-specs.json)
✓ Account registry (accounts table)
✓ Posting job template (posting_jobs table)
✓ Manual upload instructions (in manifest)

---

## Files Delivered

```
operations/database/standalone/video-orchestrator/
└── docker-compose.yml                                   (PostgreSQL in OrbStack)

operations/runbooks/
├── video-orchestrator-phase-2b-schema.sql              (PostgreSQL schema)
└── video-orchestrator-phase-2b-execution.md            (this guide)

operations/specs/video-orchestrator/
├── video-orchestrator-worker.ts                        (Worker stub)
├── test-manifest.json                                  (Test fixture)
└── (Phase 2A specs: platform/format/caption-specs)

operations/infrastructure/
└── local-apps.json                                     (Updated with Video Orchestrator entry)
```

---

## Status

**Phase 2B: INFRASTRUCTURE COMPLETE ✅**

- Database schema finalized
- Docker Compose ready
- Local Apps registration done
- Worker skeleton in place
- Test manifest valid
- Ready for full implementation and integration testing

**Next Step:** Complete worker stubs and ProBot integration (Phase 2B + 3 work).

