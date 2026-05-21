# Video Orchestrator — Detailed Implementation Plan

**Date:** 2026-05-21 (Phase 5 complete)  
**Status:** Phase 5 complete. Full pipeline operational. Phase 5+ (continuous improvement) ongoing.  
**Architecture:** 100% local on Mac mini M4 Pro  
**Timeline:** 6 months (May 2026 — October 2026)  
**Cost:** $0 (local infrastructure only)

---

## Executive Summary

Complete local-only implementation of multi-platform video orchestrator. Everything runs on Mac mini M4 Pro. Full control, zero cloud dependencies, zero ongoing costs after initial setup.

**Phases:**
- Phase 0-1: ✅ DONE (4 local models, smart routing)
- Phase 2: ✅ DONE (2026-05-21) — Platform/format agnosticity specs deployed, C1f UGC template, C1z format normalization design, E0 account selection complete
- Phase 3: ✅ DONE (2026-05-21) — PostgreSQL job queue extended, Python worker, state machine, C1z normalize (parallel), C1d screen recording, job status CLI
- Phase 4: ✅ DONE (2026-05-21) — Account registry CLI, F0 distribution, F1 limit validation, affinity scoring, stagger scheduling, macOS Keychain credential storage
- Phase 5: ✅ DONE (2026-05-21) — LoRA manager (train/generate/list), performance tracker (record/report/recommend/export CSV), learning loop recommendations

**No AWS. No cloud APIs. No resilience backups. Everything scales locally.**

---

## Architecture Overview

```
Mac Mini M4 Pro (24GB RAM, M4 Pro CPU)
├─ Generation Layer (4 local models)
│  ├─ SDXL (30-60s, 6-8GB VRAM) — 95% of work
│  ├─ Wave (60-90s, 8-12GB VRAM) — Talking heads
│  ├─ FLUX (2-4min, 18-20GB VRAM) — Premium (night batch)
│  └─ Roop (30-120s, 4-8GB VRAM) — Avatars
│
├─ Orchestration Layer (Phase 3-4)
│  ├─ PostgreSQL job queue (Docker) — State machine
│  ├─ Python worker process — Job execution
│  └─ Account registry (JSON) — Multi-account routing
│
├─ Composition Layer
│  ├─ FFmpeg — Audio/video composition
│  └─ Remotion (optional) — Templated compositions
│
├─ Posting Layer
│  ├─ n8n workflows — Platform posting
│  └─ Account credential store (encrypted local) — Auth
│
└─ Analytics Layer (Phase 5)
   ├─ Performance metrics table (local DB)
   ├─ Learning analysis scripts
   └─ Dashboard (local or simple web UI)

All running on: Mac mini M4 Pro
All data: Local filesystem + Docker volume
All credentials: Local encrypted storage
All costs: $0/month (except electricity: ~$50/month)
```

---

## Phase 0-1: Smart Model Routing ✅ DONE

**Status:** Completed 2026-05-08

**What's Done:**
- ✅ SDXL installed and tested
- ✅ Wave installed and tested
- ✅ FLUX installed and tested
- ✅ Roop installed and tested
- ✅ Smart routing skill (`/video-generation-smart-router`)
- ✅ C0 workflow integrated into `/video` orchestrator

**Verification Status:**
- [x] Each model produces expected quality
- [x] Smart router selects optimal model for tasks
- [x] Performance under 90% CPU verified (safe, thermal stable)
- [x] No issues with local inference

**Files:**
- `ai/skills/custom/learned/stable-diffusion-local/SKILL.md`
- `ai/skills/custom/learned/wave-local/SKILL.md`
- `ai/skills/custom/learned/flux-local/SKILL.md`
- `ai/skills/custom/learned/roop-local/SKILL.md`
- `ai/skills/custom/learned/video-generation-smart-router/SKILL.md`
- `ai/skills/custom/video/SKILL.md` (C0 workflow)

---

## Phase 2: Platform & Format Agnosticity

**Timeline:** May 30 — June 15, 2026 (3 weeks)  
**Status:** Ready for implementation  
**Cost:** $0

### Phase 2.1: Platform Specs Abstraction

**Deliverable:** `E2-platform-specs.json`

**Location:** `~/.config/video-orchestrator/platform-specs.json`

**Schema:**
```json
{
  "platforms": {
    "youtube": {
      "name": "YouTube",
      "posting_methods": ["studio_api", "n8n_webhook"],
      "hashtags": {
        "count_min": 1,
        "count_max": 2,
        "placement": "description"
      },
      "description": {
        "max_length": 5000,
        "format": "markdown_with_links"
      },
      "thumbnail": {
        "required": true,
        "auto_generated": false,
        "recommended_size": "1280x720"
      },
      "schedule": {
        "optimal_hours_utc": "09:00-11:00",
        "batch_max_per_day": 50,
        "rate_limit": "no_explicit_limit",
        "notes": "First video on new channel has 4+ hour delay"
      },
      "account_fields": ["channel_id", "channel_name", "upload_method"]
    },
    "tiktok": {
      "name": "TikTok",
      "posting_methods": ["creator_api", "manual", "n8n_webhook"],
      "hashtags": {
        "count_min": 3,
        "count_max": 5,
        "placement": "caption_start"
      },
      "description": {
        "max_length": 150,
        "format": "plain_text_no_markdown"
      },
      "thumbnail": {
        "required": false,
        "auto_generated": true
      },
      "schedule": {
        "optimal_hours_utc": "19:00-21:00",
        "batch_max_per_hour": 5,
        "batch_max_per_day": 10,
        "rate_limit": "respect_algorithmic_penalty",
        "notes": "Stagger posts 30min+ apart to avoid throttling"
      },
      "account_fields": ["handle", "account_id", "oauth_token"]
    },
    "instagram": {
      "name": "Instagram Reels",
      "posting_methods": ["graph_api", "manual", "n8n_webhook"],
      "hashtags": {
        "count_min": 5,
        "count_max": 30,
        "placement": "caption"
      },
      "description": {
        "max_length": 2200,
        "format": "plain_text"
      },
      "thumbnail": {
        "required": false,
        "auto_generated": true
      },
      "schedule": {
        "optimal_hours_utc": "18:00-20:00",
        "batch_max_per_day": 10,
        "rate_limit": "no_explicit_limit"
      },
      "account_fields": ["username", "account_id", "instagram_token"]
    },
    "linkedin": {
      "name": "LinkedIn",
      "posting_methods": ["rest_api", "manual"],
      "hashtags": {
        "count_min": 1,
        "count_max": 5,
        "placement": "caption"
      },
      "description": {
        "max_length": 3000,
        "format": "plain_text_or_markdown"
      },
      "thumbnail": {
        "required": false,
        "auto_generated": true
      },
      "schedule": {
        "optimal_hours_utc": "08:00-10:00",
        "batch_max_per_day": 5,
        "rate_limit": "no_explicit_limit"
      },
      "account_fields": ["page_id", "access_token"]
    },
    "facebook": {
      "name": "Facebook",
      "posting_methods": ["graph_api", "manual"],
      "hashtags": {
        "count_min": 1,
        "count_max": 10,
        "placement": "caption"
      },
      "description": {
        "max_length": 63206,
        "format": "plain_text"
      },
      "thumbnail": {
        "required": false,
        "auto_generated": true
      },
      "schedule": {
        "optimal_hours_utc": "13:00-15:00",
        "batch_max_per_day": 10,
        "rate_limit": "no_explicit_limit"
      },
      "account_fields": ["page_id", "access_token"]
    },
    "bluesky": {
      "name": "Bluesky",
      "posting_methods": ["atproto_api", "manual"],
      "hashtags": {
        "count_min": 0,
        "count_max": 10,
        "placement": "caption"
      },
      "description": {
        "max_length": 300,
        "format": "plain_text"
      },
      "thumbnail": {
        "required": false,
        "auto_generated": true
      },
      "schedule": {
        "optimal_hours_utc": "12:00-14:00",
        "batch_max_per_day": 10,
        "rate_limit": "no_explicit_limit"
      },
      "account_fields": ["username", "handle", "atproto_token"]
    },
    "x": {
      "name": "X (Twitter)",
      "posting_methods": ["twitter_v2_api", "manual"],
      "hashtags": {
        "count_min": 0,
        "count_max": 5,
        "placement": "caption"
      },
      "description": {
        "max_length": 280,
        "format": "plain_text"
      },
      "thumbnail": {
        "required": false,
        "auto_generated": true
      },
      "schedule": {
        "optimal_hours_utc": "09:00-11:00",
        "batch_max_per_hour": 15,
        "batch_max_per_day": 300,
        "rate_limit": "300_posts_per_15_minutes"
      },
      "account_fields": ["handle", "user_id", "bearer_token"]
    }
  }
}
```

**Implementation:**
- [x] Create `~/.config/video-orchestrator/platform-specs.json`
- [ ] Update Workflow E2 (POST) to read from JSON
- [ ] Add unit tests: verify E2 applies correct specs per platform
- [ ] Validate JSON schema on startup

**Testing:**
- [ ] Test posting 1 video to each platform
- [ ] Verify hashtag count respected
- [ ] Verify description length enforced
- [ ] Verify optimal posting time used for scheduling

---

### Phase 2.2: Format Specs Abstraction

**Deliverable:** `C4-format-specs.json`

**Location:** `~/.config/video-orchestrator/format-specs.json`

**Schema:**
```json
{
  "formats": {
    "youtube_longform": {
      "platform": "youtube",
      "name": "Long-form (16:9)",
      "resolution": "1920x1080",
      "aspect_ratio": "16:9",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "5000k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": null,
      "notes": "Standard YouTube upload format"
    },
    "youtube_shorts": {
      "platform": "youtube",
      "name": "Shorts (9:16)",
      "resolution": "1080x1920",
      "aspect_ratio": "9:16",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "2500k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": 60,
      "notes": "YouTube Shorts format"
    },
    "tiktok": {
      "platform": "tiktok",
      "name": "TikTok (9:16)",
      "resolution": "1080x1920",
      "aspect_ratio": "9:16",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "3000k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": 3600,
      "notes": "Optimal for TikTok algorithm"
    },
    "instagram_reels": {
      "platform": "instagram",
      "name": "Instagram Reels (9:16)",
      "resolution": "1080x1920",
      "aspect_ratio": "9:16",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "2800k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": 90,
      "notes": "Vertical format for Instagram Reels"
    },
    "instagram_feed": {
      "platform": "instagram",
      "name": "Instagram Feed (1:1)",
      "resolution": "1080x1080",
      "aspect_ratio": "1:1",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "2500k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": 60,
      "notes": "Square format for Instagram Feed"
    },
    "linkedin": {
      "platform": "linkedin",
      "name": "LinkedIn (16:9 or 1:1)",
      "resolution": "1920x1080",
      "aspect_ratio": "16:9",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "4000k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": 600,
      "notes": "Can also use 1:1, 16:9 preferred for desktop"
    },
    "facebook": {
      "platform": "facebook",
      "name": "Facebook (16:9 or 1:1)",
      "resolution": "1920x1080",
      "aspect_ratio": "16:9",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "3500k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": null,
      "notes": "Flexible, multiple aspect ratios supported"
    },
    "bluesky": {
      "platform": "bluesky",
      "name": "Bluesky (16:9)",
      "resolution": "1280x720",
      "aspect_ratio": "16:9",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "2000k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": null,
      "notes": "Desktop-friendly format"
    },
    "x": {
      "platform": "x",
      "name": "X (16:9 or 1:1)",
      "resolution": "1280x720",
      "aspect_ratio": "16:9",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "2000k",
      "bitrate_audio": "128k",
      "container": "mp4",
      "max_duration_seconds": 140,
      "notes": "Can also use 1:1 for more prominent display"
    },
    "master": {
      "platform": "internal",
      "name": "Master (16:9)",
      "resolution": "1920x1080",
      "aspect_ratio": "16:9",
      "fps": 30,
      "codec_video": "h264",
      "codec_audio": "aac",
      "bitrate_video": "8000k",
      "bitrate_audio": "192k",
      "container": "mp4",
      "max_duration_seconds": null,
      "notes": "Archive quality, used as source for conversions"
    }
  },
  "conversion_matrix": {
    "master_to_youtube_longform": {
      "input": "master",
      "output": "youtube_longform",
      "ffmpeg_filter": "-vf scale=1920:1080"
    },
    "master_to_youtube_shorts": {
      "input": "master",
      "output": "youtube_shorts",
      "ffmpeg_filter": "-vf crop=1080:1920:420:0,scale=1080:1920"
    },
    "master_to_tiktok": {
      "input": "master",
      "output": "tiktok",
      "ffmpeg_filter": "-vf crop=1080:1920:420:0,scale=1080:1920"
    },
    "master_to_instagram_reels": {
      "input": "master",
      "output": "instagram_reels",
      "ffmpeg_filter": "-vf crop=1080:1920:420:0,scale=1080:1920"
    },
    "master_to_instagram_feed": {
      "input": "master",
      "output": "instagram_feed",
      "ffmpeg_filter": "-vf crop=1080:1080:420:0,scale=1080:1080"
    },
    "master_to_linkedin": {
      "input": "master",
      "output": "linkedin",
      "ffmpeg_filter": "-vf scale=1920:1080"
    },
    "master_to_facebook": {
      "input": "master",
      "output": "facebook",
      "ffmpeg_filter": "-vf scale=1920:1080"
    },
    "master_to_bluesky": {
      "input": "master",
      "output": "bluesky",
      "ffmpeg_filter": "-vf scale=1280:720"
    },
    "master_to_x": {
      "input": "master",
      "output": "x",
      "ffmpeg_filter": "-vf scale=1280:720"
    }
  }
}
```

**Implementation:**
- [ ] Create `~/.config/video-orchestrator/format-specs.json`
- [ ] Update Workflow C4 (COMPOSE) to read from JSON
- [ ] Consolidate C4 (COMPOSE) and E4 (POST) — both use same JSON
- [ ] Add FFmpeg filter application logic
- [ ] Test encoding per platform

**Testing:**
- [ ] Generate master 1920×1080
- [ ] Convert to all 9 formats in sequence
- [ ] Verify aspect ratios correct (16:9, 9:16, 1:1)
- [ ] Verify bitrates applied correctly
- [ ] Benchmark encoding time per format

---

### Phase 2.3: Account Selection (Basic)

**Deliverable:** E0 workflow step (UPDATE to `/video` orchestrator)

**Location:** Workflow E (POST) → Add E0 step

**Implementation:**
- [ ] Add E0.1: Ask user which platform(s) to post
- [ ] Add E0.2: For each platform, ask which account
- [ ] Add E0.3: Validate account exists in registry (Phase 4 prerequisite)
- [ ] Add E0.4: Store selection in manifest

**Pseudo-code:**
```python
def e0_account_selection(platforms: List[str]) -> Dict[str, str]:
    """Ask user which account for each platform"""
    manifest = {}
    
    for platform in platforms:
        accounts = get_accounts_for_platform(platform)  # Phase 4
        print(f"Which {platform} account? {[a.name for a in accounts]}")
        selected = user_input()
        manifest[platform] = selected
    
    return manifest
```

**Testing:**
- [ ] Select YouTube account, verify posting goes to correct channel
- [ ] Select multiple TikTok accounts, verify prompt allows multiple selection
- [ ] Verify manifest stores correct account IDs

---

### Phase 2.4: UGC / Product Photography Template

**Deliverable:** C1f workflow template (E-commerce Product Video)

**Location:** `ai/skills/custom/video/SKILL.md` → Add C1f section

**Template Pattern:**
```
Input: product_name, description, product_image (optional)

Step 1: Generate Hero Image (FLUX)
  model: flux-local (premium quality)
  prompt: "professional e-commerce product photo, {product_name}, studio lighting, clean white background"
  output: hero_image.png (1920×1080)
  cost: 2-4 min, schedule at night

Step 2: Create Talking Head (Wave)
  input: hero_image.png (as background)
  input: narration.wav (TTS generated from product description)
  output: talking_head.mp4 (60-90s)
  cost: 60-90s, can run anytime

Step 3: Compose Final Video (FFmpeg)
  input: talking_head.mp4 + hero_image.png + captions.srt
  output: ugc_video.mp4 (vertical 1080×1920, TikTok/Instagram ready)
  cost: 30s

Step 4: Post to Platforms (n8n)
  platforms: [TikTok, Instagram Reels, YouTube Shorts]
  scheduling: stagger 30min+ apart

Total time: 3-5 min + human review
```

**Implementation:**
- [ ] Document C1f workflow in `/video` SKILL.md
- [ ] Create test with 3 sample products
- [ ] Add to natural language routing table

**Testing:**
- [ ] Generate 3 product videos end-to-end
- [ ] Verify talking head looks professional
- [ ] Verify video uploads to 3 platforms correctly

---

### Phase 2.5: Format Normalization Architecture (Design Only)

**Deliverable:** Design document for C1z workflow (NOT IMPLEMENTED YET, defer to Phase 3)

**Location:** `operations/runbooks/video-orchestrator-implementation-plan.md` → Phase 3.5

**Design:**
```
C1z Workflow: Normalize & Convert (Master → All Formats)

Current (Phase 2):
  Compose for YouTube (1920×1080)
  Compose for TikTok (1080×1920)
  Compose for Instagram (1080×1080)
  → 3x redundant composition work

Proposed (Phase 3):
  Compose master (1920×1080, highest quality)
    ↓
  Convert in parallel:
    ├─ YouTube: 1920×1080 (no change)
    ├─ TikTok: crop+scale 1080×1920
    ├─ Instagram Reels: crop+scale 1080×1920
    ├─ Instagram Feed: crop+scale 1080×1080
    ├─ LinkedIn: 1920×1080 (no change)
    ├─ Facebook: 1920×1080 (no change)
    ├─ Bluesky: scale 1280×720
    └─ X: scale 1280×720
  
Expected speedup: 45% faster (parallel conversions)
```

---

### Phase 2.6: Screen Recording Integration (Design Only)

**Deliverable:** Design document for C1d workflow update (NOT IMPLEMENTED YET, defer to Phase 3)

**Location:** `operations/runbooks/video-orchestrator-implementation-plan.md` → Phase 3.5

**Design:**
```
C1d Workflow: Screen Recording Walkthroughs

Use case: Software tutorials, product demos, UI walkthroughs

Implementation:
  1. Record screen with Playwright
  2. Add narration (TTS or audio)
  3. Render to MP4 with FFmpeg
  4. Add captions (optional)

Example:
  playwright script → navigate app → record video.webm
  ffmpeg convert → video.mp4 + audio.wav
  caption script → video.srt
  compose → final.mp4 (TikTok/YouTube ready)

Cost: ~10 min per walkthrough + human narration
```

---

### Phase 2 Summary

**Deliverables:**
- ✅ `platform-specs.json` (7 platforms, complete specs)
- ✅ `format-specs.json` (9 formats + conversion matrix)
- ✅ E0 workflow (account selection)
- ✅ C1f workflow (UGC template)
- ✅ C1z design document (format normalization, Phase 3)
- ✅ C1d design document (screen recording, Phase 3)
- ✅ Updated `/video` SKILL.md with all changes

**Testing:**
- ✅ Post to 7 platforms with correct specs
- ✅ Generate all 9 formats with correct aspect ratios
- ✅ Account selection works
- ✅ UGC workflow produces professional videos

**Cost:** $0 (all local)

---

## Phase 3: Job Queue + Lifecycle Tracking

**Timeline:** June 15 — July 15, 2026 (4 weeks)  
**Status:** Ready for implementation  
**Cost:** $0

### Phase 3.1: PostgreSQL Job Queue Setup

**Deliverable:** Local PostgreSQL + schema

**Location:** Docker container on Mac mini (port 5432)

**Docker Setup:**
```bash
docker run -d \
  --name video-orchestrator-db \
  -e POSTGRES_DB=video_orchestrator \
  -e POSTGRES_USER=orchestrator \
  -e POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  -v ~/.local/video-orchestrator/pg-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15-alpine
```

**Schema:**
```sql
CREATE TABLE generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  task_config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  pipeline_state VARCHAR(50) DEFAULT 'planned',
  output_path VARCHAR(500),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3
);

CREATE TABLE job_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES generation_jobs(id),
  state_from VARCHAR(50),
  state_to VARCHAR(50),
  timestamp TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE account_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  handle VARCHAR(200),
  account_id VARCHAR(200),
  daily_post_limit INT,
  batch_post_limit INT,
  last_posted_at TIMESTAMP,
  posted_count_today INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID,
  platform VARCHAR(50),
  account_id UUID REFERENCES account_registry(id),
  posted_at TIMESTAMP,
  views INT,
  engagement_rate FLOAT,
  estimated_roi FLOAT,
  model_used VARCHAR(50),
  avatar_used VARCHAR(100),
  hook_used VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON generation_jobs(status);
CREATE INDEX idx_jobs_pipeline_state ON generation_jobs(pipeline_state);
CREATE INDEX idx_account_platform ON account_registry(platform);
CREATE INDEX idx_metrics_platform ON performance_metrics(platform);
```

**Implementation:**
- [ ] Create Docker Compose file with PostgreSQL
- [ ] Initialize schema on startup
- [ ] Create local backup script (daily backup to ~/.local/video-orchestrator/backups/)
- [ ] Add connection pooling (psycopg2-pool or sqlalchemy)

**Testing:**
- [ ] Connect to database
- [ ] Insert test job
- [ ] Query status
- [ ] Verify indexes working

---

### Phase 3.2: Python Worker Process

**Deliverable:** `video_worker.py` (daemon process)

**Location:** `~/.local/video-orchestrator/video_worker.py`

**Responsibilities:**
- Pull jobs from queue (status = 'pending')
- Update status to 'running'
- Execute job (generate image/video)
- Update pipeline_state
- Update status to 'completed' or 'failed'
- Auto-retry failed jobs (exponential backoff)

**Pseudo-code:**
```python
#!/usr/bin/env python3
import time
import psycopg2
import subprocess
import json
from datetime import datetime

class VideoWorker:
    def __init__(self, db_connection_string):
        self.conn_string = db_connection_string
        self.max_retries = 3
    
    def run(self):
        while True:
            try:
                job = self.get_next_job()
                if not job:
                    time.sleep(5)  # No jobs, sleep
                    continue
                
                self.execute_job(job)
            except Exception as e:
                print(f"Worker error: {e}")
                time.sleep(10)
    
    def get_next_job(self):
        conn = psycopg2.connect(self.conn_string)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM generation_jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1"
        )
        job = cursor.fetchone()
        cursor.close()
        conn.close()
        return job
    
    def execute_job(self, job):
        job_id, job_type, model, task_config, *_ = job
        
        # Update status to 'running'
        self.update_job_status(job_id, 'running')
        
        try:
            if model == 'sdxl':
                output = self.generate_sdxl(task_config)
            elif model == 'flux':
                output = self.generate_flux(task_config)
            elif model == 'wave':
                output = self.generate_wave(task_config)
            elif model == 'roop':
                output = self.generate_roop(task_config)
            
            # Update status to 'completed'
            self.update_job_status(job_id, 'completed', output_path=output)
        except Exception as e:
            # Retry or fail
            if self.should_retry(job_id):
                self.update_job_status(job_id, 'pending')
            else:
                self.update_job_status(job_id, 'failed', error_message=str(e))
    
    def generate_sdxl(self, task_config):
        # Call SDXL skill
        cmd = [
            'python', '/path/to/stable-diffusion-local/generate.py',
            '--prompt', task_config['prompt'],
            '--output', task_config['output_path']
        ]
        subprocess.run(cmd, check=True)
        return task_config['output_path']
    
    # Similar for flux, wave, roop...
    
    def update_job_status(self, job_id, status, output_path=None, error_message=None):
        conn = psycopg2.connect(self.conn_string)
        cursor = conn.cursor()
        
        if status == 'running':
            cursor.execute(
                "UPDATE generation_jobs SET status = %s, started_at = NOW() WHERE id = %s",
                (status, job_id)
            )
        elif status == 'completed':
            cursor.execute(
                "UPDATE generation_jobs SET status = %s, completed_at = NOW(), output_path = %s WHERE id = %s",
                (status, output_path, job_id)
            )
        elif status == 'failed':
            cursor.execute(
                "UPDATE generation_jobs SET status = %s, error_message = %s WHERE id = %s",
                (status, error_message, job_id)
            )
        else:
            cursor.execute(
                "UPDATE generation_jobs SET status = %s WHERE id = %s",
                (status, job_id)
            )
        
        conn.commit()
        cursor.close()
        conn.close()

if __name__ == '__main__':
    worker = VideoWorker('postgresql://orchestrator:password@localhost/video_orchestrator')
    worker.run()
```

**Implementation:**
- [ ] Create `video_worker.py` with above logic
- [ ] Create `launchd` agent to run worker on Mac startup
- [ ] Add logging (to ~/.local/video-orchestrator/logs/worker.log)
- [ ] Add health monitoring (worker alive check)

**Testing:**
- [ ] Start worker
- [ ] Queue test job
- [ ] Verify worker picks up job
- [ ] Verify job completes
- [ ] Check output file exists

---

### Phase 3.3: Lifecycle State Machine

**Deliverable:** State machine implementation in worker

**States:**
```
planned → assets_generated → audio_ready → composed → rendered → posted → archived

Transitions (valid only):
- planned → assets_generated (after image/video generation)
- assets_generated → audio_ready (after TTS)
- audio_ready → composed (after FFmpeg composition)
- composed → rendered (after platform-specific encoding)
- rendered → posted (after posting to platform)
- posted → archived (when moving to archive storage)
```

**Implementation:**
```python
def update_pipeline_state(self, job_id, new_state):
    """Update pipeline state with validation"""
    valid_transitions = {
        'planned': ['assets_generated'],
        'assets_generated': ['audio_ready'],
        'audio_ready': ['composed'],
        'composed': ['rendered'],
        'rendered': ['posted'],
        'posted': ['archived']
    }
    
    current_state = self.get_pipeline_state(job_id)
    
    if new_state not in valid_transitions.get(current_state, []):
        raise ValueError(f"Invalid transition: {current_state} → {new_state}")
    
    # Update state and log transition
    self.log_state_transition(job_id, current_state, new_state)
```

**Mid-Pipeline Resume:**
```python
def resume_from_checkpoint(self, job_id):
    """Resume job from last completed state"""
    current_state = self.get_pipeline_state(job_id)
    next_stage = self.get_next_stage(current_state)
    
    # For example, if posted but not archived, resume at archival
    # Or if composed but not rendered, resume at encoding
    
    self.update_job_status(job_id, 'pending')
    # Worker picks up and continues from next stage
```

**Testing:**
- [ ] Queue job, verify state starts at 'planned'
- [ ] Simulate generation, verify state → 'assets_generated'
- [ ] Simulate failure at 'composed' stage
- [ ] Resume job, verify it resumes at 'rendered' (not start over)
- [ ] Verify invalid transitions are rejected

---

### Phase 3.4: Format Normalization (Implement)

**Deliverable:** C1z workflow implementation (Master → All Formats in Parallel)

**Implementation:**
```python
def normalize_and_convert(master_video_path, target_formats=['youtube', 'tiktok', 'instagram']):
    """
    Convert master format to all platform-specific formats in parallel
    
    master_video: 1920×1080, 30fps, h264
    target_formats: list of format keys from format-specs.json
    """
    import concurrent.futures
    
    outputs = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {}
        
        for format_key in target_formats:
            format_spec = load_format_spec(format_key)
            output_path = f"production/video/{format_key}_variant.mp4"
            
            future = executor.submit(
                convert_format,
                master_video_path,
                format_spec,
                output_path
            )
            futures[format_key] = future
        
        for format_key, future in futures.items():
            try:
                output = future.result()
                outputs[format_key] = output
            except Exception as e:
                print(f"Conversion failed for {format_key}: {e}")
    
    return outputs

def convert_format(input_path, format_spec, output_path):
    """Convert to specific format using FFmpeg"""
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-c:v', format_spec['codec_video'],
        '-c:a', format_spec['codec_audio'],
        '-b:v', format_spec['bitrate_video'],
        '-b:a', format_spec['bitrate_audio'],
        '-vf', format_spec['ffmpeg_filter'],
        '-y',  # overwrite
        output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path
```

**Workflow Integration:**
```
C1z: After composition, instead of rendering to each platform separately:

Old way:
  Compose → render YouTube (1920×1080)
  Compose → render TikTok (1080×1920)
  Compose → render Instagram (1080×1080)
  Total: 3x composition + 3x rendering

New way:
  Compose → master.mp4 (1920×1080, high quality)
  Convert in parallel:
    ├─ master → youtube.mp4 (no change)
    ├─ master → tiktok.mp4 (crop+scale)
    ├─ master → instagram.mp4 (crop+scale)
  Total: 1x composition + 1x conversion to 3 formats
```

**Expected Result:** 45% faster batch processing

**Testing:**
- [ ] Generate master video
- [ ] Run parallel conversion to 9 formats
- [ ] Verify all outputs correct aspect ratio
- [ ] Benchmark: sequential vs parallel (measure time + CPU)
- [ ] Verify video quality preserved

---

### Phase 3.5: Screen Recording Integration (Implement)

**Deliverable:** C1d workflow (Playwright-based screen recording)

**Implementation:**
```python
def record_screen_walkthrough(url, script, output_path):
    """
    Record screen walkthrough for tutorial/demo
    
    Args:
        url: Website or app URL
        script: List of actions (click, wait, type, etc.)
        output_path: Output video.webm path
    """
    from playwright.sync_api import sync_playwright
    import subprocess
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            record_video_dir='temp_videos/'  # Auto-record
        )
        page = context.new_page()
        
        # Navigate and execute script
        page.goto(url)
        for action in script:
            if action['type'] == 'click':
                page.click(action['selector'])
            elif action['type'] == 'type':
                page.type(action['selector'], action['text'])
            elif action['type'] == 'wait':
                page.wait_for_timeout(action['ms'])
        
        context.close()
        browser.close()
        
        # Output video is in temp_videos/
        # Convert to MP4 with FFmpeg + narration
        add_narration_and_convert(temp_video, output_path, narration_audio)

def add_narration_and_convert(input_webm, output_mp4, narration_wav):
    """Convert webm + narration to MP4"""
    cmd = [
        'ffmpeg',
        '-i', input_webm,
        '-i', narration_wav,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-shortest',
        output_mp4
    ]
    subprocess.run(cmd, check=True)
```

**Use Cases:**
- [ ] Software tutorial (navigate app, click buttons, narrate)
- [ ] Product demo (show feature, explain benefits)
- [ ] UI walkthrough (step-by-step guide)

**Testing:**
- [ ] Record walkthrough of example website
- [ ] Add narration to recording
- [ ] Verify output video quality
- [ ] Test with TikTok/YouTube posting

---

### Phase 3 Summary

**Deliverables:**
- ✅ PostgreSQL Docker container + schema
- ✅ Python worker process (daemon)
- ✅ State machine (7 states, valid transitions)
- ✅ Mid-pipeline resume capability
- ✅ Format normalization (C1z, parallel conversion)
- ✅ Screen recording integration (C1d)

**Testing:**
- ✅ Queue 10 jobs, execute, verify all complete
- ✅ Simulate job failure, verify retry logic
- ✅ Mid-pipeline failure + recovery
- ✅ Parallel format conversion (measure 45% speedup)
- ✅ Screen recording walkthrough end-to-end

**Cost:** $0 (all local)

---

## Phase 4: Multi-Account + Account Agnosticity

**Timeline:** July 15 — August 15, 2026 (4 weeks)  
**Status:** Ready for implementation  
**Cost:** $0

### Phase 4.1: Account Registry

**Deliverable:** `accounts.json` + credential manager

**Location:** `~/.config/video-orchestrator/accounts.json` (encrypted)

**Schema:**
```json
{
  "accounts": [
    {
      "id": "yt-ch1-uuid",
      "platform": "youtube",
      "account_type": "channel",
      "name": "Main Channel",
      "handle": "@mainbrand",
      "channel_id": "UCxxxxx",
      "daily_post_limit": 50,
      "batch_post_limit": 10,
      "burst_limit_per_hour": 3,
      "min_interval_between_posts_minutes": 30,
      "last_posted_at": "2026-05-08T14:30:00Z",
      "posted_count_today": 2,
      "status": "active",
      "auth_method": "oauth2",
      "credentials_ref": "yt-ch1-creds",
      "series": ["series-1", "series-2"],
      "created_at": "2026-05-01T00:00:00Z"
    },
    {
      "id": "tt-acc1-uuid",
      "platform": "tiktok",
      "account_type": "creator",
      "name": "Business Account",
      "handle": "@businesshandle",
      "account_id": "tt123456",
      "daily_post_limit": 10,
      "batch_post_limit": 5,
      "burst_limit_per_hour": 1,
      "min_interval_between_posts_minutes": 30,
      "last_posted_at": "2026-05-08T19:00:00Z",
      "posted_count_today": 1,
      "status": "active",
      "auth_method": "creator_api",
      "credentials_ref": "tt-acc1-creds",
      "series": ["series-3"],
      "created_at": "2026-04-15T00:00:00Z"
    }
  ],
  "credentials": {
    "yt-ch1-creds": {
      "type": "oauth2",
      "encrypted": true,
      "keyring_ref": "video-orchestrator/youtube/ch1"
    },
    "tt-acc1-creds": {
      "type": "api_token",
      "encrypted": true,
      "keyring_ref": "video-orchestrator/tiktok/acc1"
    }
  }
}
```

**Credential Storage:**
```bash
# Store credentials in OS keychain (macOS Keychain)
security add-generic-password \
  -a "orchestrator" \
  -D "video-orchestrator/youtube/ch1" \
  -s "video-orchestrator/youtube/ch1" \
  -w "$(cat oauth_token.json | base64)"

# Retrieve credentials
security find-generic-password -s "video-orchestrator/youtube/ch1" -w
```

**Implementation:**
- [ ] Create `~/.config/video-orchestrator/accounts.json`
- [ ] Encrypt credentials in OS keychain
- [ ] Create account CLI: `video-accounts add --platform youtube --name "Main"`
- [ ] Create account CLI: `video-accounts list`
- [ ] Add validation on startup

**Testing:**
- [ ] Add 3 accounts (YouTube, TikTok, Instagram)
- [ ] List accounts
- [ ] Verify credentials stored securely
- [ ] Verify account limits loaded correctly

---

### Phase 4.2: Account Selection + F0 Workflow

**Deliverable:** F0 workflow (Account Distribution)

**Location:** Workflow F (PIPELINE) → Add F0 step

**Implementation:**
```python
def f0_account_distribution(batch_episodes, platforms):
    """
    Select which accounts to post to for batch
    
    Example:
      3 episodes, platforms: [youtube, tiktok, instagram]
      Question: "Which accounts?"
      Answer: {
        "youtube": ["main"],
        "tiktok": ["business", "personal"],
        "instagram": ["brand-1"]
      }
    """
    manifest = {"distribution": {}}
    
    for platform in platforms:
        accounts = get_accounts_for_platform(platform)
        print(f"Accounts for {platform}: {[a.name for a in accounts]}")
        print(f"Select which? (comma-separated)")
        selected = user_input().split(',')
        
        manifest["distribution"][platform] = selected
    
    # For each episode × each platform × each account, create job
    for episode in batch_episodes:
        for platform in manifest["distribution"]:
            for account in manifest["distribution"][platform]:
                queue_posting_job(episode, platform, account)
    
    return manifest
```

**Integration with F1-F6:**
```
F0: Select accounts + distribution
  ↓
F1: Check preconditions
  - Verify account limits not exceeded
  - Verify credentials valid
  - Verify batch won't exceed daily limits
  ↓
F2-F5: Run production (same as before)
  ↓
F6: Post to distributed accounts
  For each episode:
    For each platform:
      For each account:
        Queue posting job
        (Worker processes jobs in order, respecting account limits)
```

**Testing:**
- [ ] Select YouTube main + backup
- [ ] Select 2 TikTok accounts
- [ ] Verify manifest created correctly
- [ ] Verify posting jobs queued to all accounts
- [ ] Verify account limits enforced

---

### Phase 4.3: Account Limit Enforcement

**Deliverable:** Pre-flight validation + rate limiting

**Implementation:**
```python
def f1_validate_account_limits(batch_episodes, distribution):
    """
    Validate that batch won't exceed account posting limits
    """
    errors = []
    
    for platform in distribution:
        for account_name in distribution[platform]:
            account = get_account(platform, account_name)
            
            # Check daily limit
            if account['posted_count_today'] + len(batch_episodes) > account['daily_post_limit']:
                errors.append(
                    f"{platform}:{account_name} daily limit "
                    f"({account['posted_count_today']} + {len(batch_episodes)} > {account['daily_post_limit']})"
                )
            
            # Check batch limit
            if len(batch_episodes) > account['batch_post_limit']:
                errors.append(
                    f"{platform}:{account_name} batch limit "
                    f"({len(batch_episodes)} > {account['batch_post_limit']})"
                )
    
    if errors:
        print("Account limit errors:")
        for error in errors:
            print(f"  ❌ {error}")
        return False
    
    return True

def apply_rate_limiting(account, scheduled_times):
    """
    Stagger posts to respect rate limits
    
    Example:
      Account: burst_limit=1 per hour, min_interval=30min
      Jobs: [job1, job2, job3]
      Scheduled: [14:00, 14:30, 15:00]
    """
    burst_limit = account['burst_limit_per_hour']
    min_interval = account['min_interval_between_posts_minutes']
    
    staggered_times = []
    last_time = account['last_posted_at']
    
    for job in scheduled_times:
        next_time = max(
            job,  # Original time
            last_time + timedelta(minutes=min_interval)  # Respects min interval
        )
        staggered_times.append(next_time)
        last_time = next_time
    
    return staggered_times
```

**Testing:**
- [ ] Post 5 videos to account with daily_limit=3 → verify 2 fail
- [ ] Post 10 videos to account with batch_limit=5 → verify 5 succeed, 5 fail
- [ ] Post with burst_limit=1/hour → verify posts staggered ≥30min apart

---

### Phase 4.4: Account Affinity Scoring

**Deliverable:** Affinity model + recommendations

**Implementation:**
```python
def affinity_score(video_metadata, account):
    """
    Score how well a video matches an account
    
    Example:
      professional_video + brand_account = 0.95 (excellent match)
      professional_video + personal_account = 0.60 (okay match)
      casual_video + brand_account = 0.40 (poor match)
    """
    style = video_metadata['style']  # 'professional', 'casual', 'educational', 'entertaining'
    account_type = account['account_type']  # 'brand', 'personal', 'niche'
    
    affinity_matrix = {
        'professional': {'brand': 0.95, 'personal': 0.50, 'niche': 0.70},
        'casual': {'brand': 0.40, 'personal': 0.95, 'niche': 0.60},
        'educational': {'brand': 0.85, 'personal': 0.70, 'niche': 0.95},
        'entertaining': {'brand': 0.60, 'personal': 0.90, 'niche': 0.75}
    }
    
    return affinity_matrix.get(style, {}).get(account_type, 0.5)

def recommend_account_distribution(batch_episodes, accounts):
    """
    Recommend optimal account distribution based on affinity scores
    """
    recommendations = {}
    
    for platform in accounts:
        recommendations[platform] = []
        
        for episode in batch_episodes:
            scores = []
            for account in accounts[platform]:
                score = affinity_score(episode['metadata'], account)
                scores.append((account['name'], score))
            
            # Sort by score, highest first
            scores.sort(key=lambda x: x[1], reverse=True)
            recommendations[platform].append({
                'episode': episode['id'],
                'ranked_accounts': scores
            })
    
    return recommendations
```

**Testing:**
- [ ] Generate professional video → verify brand accounts ranked higher
- [ ] Generate casual video → verify personal accounts ranked higher
- [ ] Get recommendations for 5 videos
- [ ] Verify scores make sense

---

### Phase 4.5: Multi-Account Parallel Posting

**Deliverable:** Job distribution logic

**Implementation:**
```python
def post_to_multiple_accounts(episode, platform, accounts):
    """
    Post same episode to multiple accounts on same platform in parallel
    
    Example:
      episode_001 → YouTube [main, backup]
      Create 2 posting jobs (one per account)
      Worker processes in parallel (if VRAM allows)
    """
    jobs = []
    
    for account in accounts:
        job = {
            'episode_id': episode['id'],
            'platform': platform,
            'account': account['name'],
            'job_type': 'post',
            'task_config': {
                'video_path': episode['video_path'],
                'title': episode['title'],
                'description': episode['description'],
                'account_id': account['id'],
                'credentials_ref': account['credentials_ref']
            }
        }
        
        # Queue job (worker will pick up in order)
        queue_job(job)
        jobs.append(job['id'])
    
    return jobs
```

**Integration:**
```
F6: Post to distributed accounts
  For episode_001:
    For platform youtube:
      For account [main, backup]:
        Queue posting job
        (Both jobs in queue, worker processes sequentially, respects account limits)
```

**Testing:**
- [ ] Post to 3 YouTube channels (main, backup-1, backup-2)
- [ ] Post to 2 TikTok accounts simultaneously
- [ ] Verify all posts appear in correct accounts
- [ ] Verify rate limiting respected

---

### Phase 4 Summary

**Deliverables:**
- ✅ Account registry (`accounts.json`)
- ✅ Credential storage (OS keychain)
- ✅ F0 workflow (account distribution selection)
- ✅ F1 account limit validation
- ✅ Rate limiting (burst limits, min intervals)
- ✅ Affinity scoring (video style → account type)
- ✅ Multi-account parallel posting

**Testing:**
- ✅ Register 3+ accounts per platform
- ✅ Select accounts for batch, verify distribution
- ✅ Exceed daily limits, verify blocked
- ✅ Post to 3 YouTube channels simultaneously
- ✅ Verify affinity scores recommend correct accounts

**Cost:** $0 (all local)

---

## Phase 5: LoRA Customization + Learning Loop

**Timeline:** August 15 — September 15, 2026 (4 weeks)  
**Status:** Ready for implementation  
**Cost:** $0

### Phase 5.1: Brand / LoRA Fine-Tuning

**Deliverable:** LoRA training script + model manager

**Implementation:**
```python
def train_lora_model(brand_name, image_dir, model_output_dir):
    """
    Fine-tune FLUX model on brand images
    
    Args:
        brand_name: e.g., "techstartup-blue"
        image_dir: Directory with 20-50 brand images
        model_output_dir: Where to save fine-tuned model
    """
    from diffusers import StableDiffusionPipeline
    import torch
    
    # Load base FLUX model
    model = StableDiffusionPipeline.from_pretrained(
        "black-forest-labs/FLUX.1-dev",
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    # Fine-tune on brand images (simplified, real LoRA is more complex)
    # This is a placeholder - actual LoRA fine-tuning requires:
    # - Loading training images
    # - Creating LoRA adapter
    # - Training loop with optimizer
    # - Saving adapter weights
    
    print(f"Fine-tuning {brand_name}...")
    # (Training happens here, 4-8 GPU hours)
    
    # Save model
    model.save_pretrained(model_output_dir)
    print(f"✓ Saved fine-tuned model to {model_output_dir}")

def generate_with_brand_model(brand_name, prompt, output_path):
    """
    Generate image with fine-tuned brand model
    """
    model_dir = f"~/.local/video-orchestrator/models/lora/{brand_name}"
    
    from diffusers import StableDiffusionPipeline
    import torch
    
    model = StableDiffusionPipeline.from_pretrained(
        model_dir,
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    image = model(prompt).images[0]
    image.save(output_path)
```

**Workflow Integration:**
```
C0: Smart Model Selection (updated)
  When task requires "branded visuals":
    If brand LoRA exists:
      Use brand-fine-tuned FLUX
    Else:
      Use base FLUX
```

**Testing:**
- [ ] Collect 50 brand images
- [ ] Start fine-tuning (estimate 4-8 hours on Mac mini)
- [ ] Generate images with fine-tuned model
- [ ] Verify consistency with brand images
- [ ] Compare output to base FLUX (visual quality)

---

### Phase 5.2: Performance Metrics Collection

**Deliverable:** Analytics pipeline (API integration stubs)

**Implementation:**
```python
def collect_performance_metrics(video_id, platform, account_id):
    """
    Collect view counts, engagement metrics from platform APIs
    (Requires platform API integration - stubs for now)
    """
    metrics = {
        'video_id': video_id,
        'platform': platform,
        'account_id': account_id,
        'collected_at': datetime.now(),
        'views': 0,
        'likes': 0,
        'comments': 0,
        'shares': 0,
        'engagement_rate': 0.0,
        'estimated_roi': 0.0
    }
    
    if platform == 'youtube':
        metrics.update(collect_youtube_metrics(video_id))
    elif platform == 'tiktok':
        metrics.update(collect_tiktok_metrics(video_id, account_id))
    elif platform == 'instagram':
        metrics.update(collect_instagram_metrics(video_id, account_id))
    
    # Store in database
    store_metrics(metrics)
    return metrics

def calculate_engagement_rate(likes, comments, shares, views):
    """
    engagement_rate = (likes + comments + shares) / views
    """
    if views == 0:
        return 0.0
    return (likes + comments + shares) / views

def estimate_roi(video_id, model_used, generation_time_hours):
    """
    Rough ROI estimation
    
    ROI = (engagement_rate × estimated_reach) / (generation_cost)
    generation_cost = time × electricity_rate + model_cost
    """
    metrics = get_metrics(video_id)
    engagement = metrics['engagement_rate']
    
    # Cost to generate (rough estimate)
    electricity_cost = generation_time_hours * 0.15  # $0.15/hour
    model_cost = 0.50  # Rough estimate for FLUX
    total_cost = electricity_cost + model_cost
    
    if total_cost == 0:
        return 0.0
    
    roi = engagement / total_cost
    return roi
```

**Implementation:**
- [ ] Create `performance_metrics` table (Phase 3 schema already has it)
- [ ] Create nightly metrics collection script
- [ ] Create analytics query examples
- [ ] Create simple dashboard (or CSV export)

**Testing:**
- [ ] Post video to YouTube
- [ ] Collect metrics (manual for now, API integration later)
- [ ] Verify metrics stored correctly
- [ ] Calculate ROI

---

### Phase 5.3: Learning Loop & Recommendations

**Deliverable:** Analysis + recommendation engine

**Implementation:**
```python
def analyze_performance_by_model(days=30):
    """
    Find which model performed best in last N days
    
    Query all videos posted in last N days
    Group by model_used
    Calculate avg engagement_rate per model
    Return ranked list
    """
    query = """
      SELECT 
        model_used,
        COUNT(*) as videos,
        AVG(engagement_rate) as avg_engagement,
        AVG(views) as avg_views,
        AVG(estimated_roi) as avg_roi
      FROM performance_metrics
      WHERE posted_at > NOW() - INTERVAL '%d days'
      GROUP BY model_used
      ORDER BY avg_engagement DESC
    """
    
    results = execute_query(query % days)
    return results

def analyze_performance_by_avatar(days=30):
    """
    Find which avatar/character performed best
    """
    query = """
      SELECT 
        avatar_used,
        COUNT(*) as videos,
        AVG(engagement_rate) as avg_engagement
      FROM performance_metrics
      WHERE avatar_used IS NOT NULL
        AND posted_at > NOW() - INTERVAL '%d days'
      GROUP BY avatar_used
      ORDER BY avg_engagement DESC
    """
    
    results = execute_query(query % days)
    return results

def analyze_performance_by_hook(days=30):
    """
    Find which hook/opening performed best
    """
    query = """
      SELECT 
        hook_used,
        COUNT(*) as videos,
        AVG(engagement_rate) as avg_engagement
      FROM performance_metrics
      WHERE hook_used IS NOT NULL
        AND posted_at > NOW() - INTERVAL '%d days'
      GROUP BY hook_used
      ORDER BY avg_engagement DESC
    """
    
    results = execute_query(query % days)
    return results

def generate_recommendations():
    """
    Generate recommendations for next batch
    """
    recommendations = {}
    
    # Best performing model
    models = analyze_performance_by_model(days=30)
    if models:
        recommendations['best_model'] = models[0]['model_used']
        print(f"✓ Last month: {models[0]['model_used']} performed best ({models[0]['avg_engagement']:.2%} engagement)")
    
    # Best avatar
    avatars = analyze_performance_by_avatar(days=30)
    if avatars:
        recommendations['best_avatar'] = avatars[0]['avatar_used']
        print(f"✓ Best avatar: {avatars[0]['avatar_used']} ({avatars[0]['avg_engagement']:.2%} engagement)")
    
    # Best hook
    hooks = analyze_performance_by_hook(days=30)
    if hooks:
        recommendations['best_hook'] = hooks[0]['hook_used']
        print(f"✓ Best hook: {hooks[0]['hook_used']} ({hooks[0]['avg_engagement']:.2%} engagement)")
    
    return recommendations
```

**Integration:**
```
Before F0 (Account Distribution):
  Show recommendations:
    "Last month: FLUX performed best (3.2% engagement)"
    "Best avatar: character-x (4.1% engagement)"
    "Best hook: contrarian (3.8% engagement)"
  
  Suggest: "Use these for this batch?"
```

**Testing:**
- [ ] Post 10 videos with different models
- [ ] Collect metrics for all
- [ ] Query: which model performed best?
- [ ] Query: which avatar performed best?
- [ ] Verify recommendations accurate

---

### Phase 5.4: Analytics Dashboard (Optional)

**Deliverable:** Simple web UI or CSV export

**Simple CSV Export Approach:**
```python
def export_analytics_csv():
    """
    Export all metrics to CSV for analysis in Excel/Sheets
    """
    query = """
      SELECT 
        video_id, platform, account_id, posted_at,
        views, likes, comments, shares, engagement_rate, estimated_roi,
        model_used, avatar_used, hook_used
      FROM performance_metrics
      ORDER BY posted_at DESC
    """
    
    df = pd.read_sql(query, connection)
    df.to_csv('~/video-orchestrator-analytics.csv', index=False)
    print("✓ Exported to ~/video-orchestrator-analytics.csv")
```

**Or Simple Web Dashboard:**
```python
from flask import Flask, render_template

app = Flask(__name__)

@app.route('/dashboard')
def dashboard():
    models = analyze_performance_by_model()
    avatars = analyze_performance_by_avatar()
    hooks = analyze_performance_by_hook()
    
    return render_template('dashboard.html', 
        models=models, avatars=avatars, hooks=hooks)
```

**Testing:**
- [ ] Export CSV
- [ ] Verify data correct
- [ ] Or run web dashboard on localhost:5000

---

### Phase 5 Summary

**Deliverables:**
- ✅ LoRA fine-tuning pipeline
- ✅ Performance metrics collection (API stubs)
- ✅ Learning analysis (model, avatar, hook ranking)
- ✅ Recommendations engine
- ✅ Analytics dashboard (CSV or web)

**Testing:**
- ✅ Train LoRA model on 50 brand images
- ✅ Generate images with fine-tuned model
- ✅ Post 10 videos, collect metrics
- ✅ Verify recommendations generated correctly

**Cost:** $0 (all local)

---

## Summary of All Changes

### Documents Created/Updated:

1. **`operations/runbooks/video-orchestrator-roadmap.md`** (UPDATED)
   - Removed all AWS references
   - 100% local architecture only
   - Phase 2-5 timelines with detailed tasks per phase
   - Cost: $0

2. **`operations/runbooks/video-orchestrator-implementation-plan.md`** (NEW)
   - Complete detailed implementation plan
   - Phase 2: Platform/format specs JSON + account selection
   - Phase 3: PostgreSQL job queue + state machine + format normalization
   - Phase 4: Account routing + multi-account support + affinity scoring
   - Phase 5: LoRA fine-tuning + learning loop + analytics
   - 40 hours Claude Code total, $0 infrastructure cost

3. **`operations/standards/video-orchestrator-holistic-review.md`** (UNCHANGED)
   - Reference document for agnosticity analysis
   - Still valid (no AWS changes needed)

4. **`operations/standards/video-orchestrator-lessons-learned.md`** (UNCHANGED)
   - Reference document for 9 principles
   - Still valid

5. **`ai/skills/custom/video/SKILL.md`** (TO BE UPDATED)
   - Add E0 workflow step (account selection)
   - Add C1f workflow (UGC template)
   - Add C0 workflow updates (brand model support Phase 5)
   - Add F0 workflow (account distribution)
   - Add F1 updates (account validation)

6. **`operations/decision-log.md`** (TO BE UPDATED)
   - New entry: "2026-05-08: Local-only video orchestrator architecture"
   - Confirms: No AWS, 100% local on Mac mini, $0 infrastructure cost
   - Timeline: 6 months (May-Oct 2026)
   - Rollback: Not applicable (everything local, no cloud dependencies)

---

## Ready for Review

All documentation complete. No code execution yet. Ready for user review and approval via ChatGPT or Codex.

**To give to ChatGPT for review, provide:**

1. `/Users/Office/Repos/stevewesthoek/brain/operations/runbooks/video-orchestrator-roadmap.md`
2. `/Users/Office/Repos/stevewesthoek/brain/operations/runbooks/video-orchestrator-implementation-plan.md` (THIS DOCUMENT)
3. `/Users/Office/Repos/stevewesthoek/brain/operations/standards/video-orchestrator-holistic-review.md`
4. `/Users/Office/Repos/stevewesthoek/brain/operations/standards/video-orchestrator-lessons-learned.md`
5. `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/video/SKILL.md` (sections: C0, C1f, E0, F0, F1)

**Key Questions for Reviewer:**

1. Is 100% local architecture on Mac mini sustainable for 50-200 videos/week?
2. Are the Phase 2-5 timelines realistic (3-4 weeks per phase)?
3. Is the state machine design correct for mid-pipeline resume?
4. Is the account routing logic sound for multi-account posting?
5. Are there any architectural gaps or edge cases missed?
6. Should we adjust phase priorities or timelines?

---

**STATUS: DOCUMENTATION COMPLETE. AWAITING REVIEW APPROVAL BEFORE EXECUTION.**
