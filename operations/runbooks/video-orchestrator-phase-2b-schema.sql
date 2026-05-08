-- Video Orchestrator Phase 2B: PostgreSQL Schema
-- Durable Entity Model with Job Queue and State Machine
-- Created: 2026-05-08
-- Database: video_orchestrator (port 5450 in OrbStack)

-- ============================================================================
-- DURABLE ENTITIES (Production Packages & Content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS videos (
  video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  series_id UUID,
  source_script_path VARCHAR NOT NULL,
  source_audio_path VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT videos_unique_source UNIQUE(source_script_path)
);

CREATE TABLE IF NOT EXISTS scripts (
  script_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  word_count INT,
  estimated_duration_seconds INT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT scripts_one_per_video UNIQUE(video_id)
);

CREATE TABLE IF NOT EXISTS source_assets (
  asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  asset_type VARCHAR NOT NULL CHECK (asset_type IN ('image', 'video', 'audio', 'animation')),
  file_path VARCHAR NOT NULL,
  duration_seconds INT,
  file_size_bytes BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS captions (
  caption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  language VARCHAR NOT NULL,
  format VARCHAR NOT NULL CHECK (format IN ('srt', 'vtt', 'json')),
  file_path VARCHAR NOT NULL,
  transcription_method VARCHAR NOT NULL CHECK (transcription_method IN ('whisper_cpp', 'api', 'manual')),
  transcription_confidence FLOAT CHECK (transcription_confidence >= 0 AND transcription_confidence <= 1),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT captions_unique_per_video_lang_format UNIQUE(video_id, language, format)
);

CREATE TABLE IF NOT EXISTS renders (
  render_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  format_key VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  resolution VARCHAR NOT NULL,
  aspect_ratio VARCHAR NOT NULL,
  duration_seconds INT NOT NULL,
  file_size_bytes BIGINT,
  bitrate_kbps INT,
  captions_burned BOOLEAN DEFAULT FALSE,
  rendering_mode VARCHAR NOT NULL DEFAULT 'canonical_timeline' CHECK (rendering_mode IN ('canonical_timeline', 'simple_transform')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT renders_unique_per_video_format UNIQUE(video_id, format_key)
);

CREATE TABLE IF NOT EXISTS thumbnails (
  thumbnail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  format_key VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  generation_method VARCHAR NOT NULL CHECK (generation_method IN ('generated_sdxl', 'generated_flux', 'extracted_frame', 'manual')),
  extraction_timecode VARCHAR,
  file_size_bytes BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT thumbnails_unique_per_video_format UNIQUE(video_id, format_key)
);

CREATE TABLE IF NOT EXISTS production_packages (
  package_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  manifest_path VARCHAR NOT NULL,
  manifest_content JSONB NOT NULL,
  completeness_percent INT NOT NULL DEFAULT 0 CHECK (completeness_percent >= 0 AND completeness_percent <= 100),
  package_status VARCHAR NOT NULL DEFAULT 'incomplete' CHECK (package_status IN ('incomplete', 'complete', 'errors', 'warnings')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT production_packages_one_per_video UNIQUE(video_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR NOT NULL,
  account_handle VARCHAR NOT NULL,
  account_identifier VARCHAR,
  daily_post_limit INT,
  burst_limit_per_hour INT,
  min_cooldown_minutes INT DEFAULT 0,
  account_status VARCHAR NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'paused', 'suspended', 'needs_auth')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT accounts_unique_per_platform UNIQUE(platform, account_handle)
);

-- ============================================================================
-- EPHEMERAL ENTITIES (Job Execution & Events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(video_id) ON DELETE SET NULL,
  job_type VARCHAR NOT NULL CHECK (job_type IN ('render', 'caption', 'thumbnail', 'manifest', 'post', 'analytics')),
  job_status VARCHAR NOT NULL DEFAULT 'pending' CHECK (job_status IN ('pending', 'leased', 'running', 'succeeded', 'failed', 'dead')),
  task_config JSONB NOT NULL,
  output_path VARCHAR,
  error_message TEXT,
  idempotency_key UUID,
  retry_count INT DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(video_id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL,
  event_data JSONB,
  severity VARCHAR NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- POSTING & DISTRIBUTION STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS posting_jobs (
  posting_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES production_packages(package_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
  platform VARCHAR NOT NULL,
  adapter_mode VARCHAR NOT NULL CHECK (adapter_mode IN ('api', 'n8n', 'manual', 'browser_assisted', 'disabled')),
  posting_status VARCHAR NOT NULL DEFAULT 'draft' CHECK (posting_status IN ('draft', 'scheduled', 'uploading', 'processing', 'published', 'failed')),
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  platform_post_id VARCHAR,
  posting_url VARCHAR,
  error_message TEXT,
  retry_count INT DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_videos_project ON videos(project_id);
CREATE INDEX IF NOT EXISTS idx_videos_series ON videos(series_id);
CREATE INDEX IF NOT EXISTS idx_scripts_video ON scripts(video_id);
CREATE INDEX IF NOT EXISTS idx_source_assets_video ON source_assets(video_id);
CREATE INDEX IF NOT EXISTS idx_captions_video ON captions(video_id);
CREATE INDEX IF NOT EXISTS idx_captions_language ON captions(language);
CREATE INDEX IF NOT EXISTS idx_renders_video ON renders(video_id);
CREATE INDEX IF NOT EXISTS idx_renders_format ON renders(format_key);
CREATE INDEX IF NOT EXISTS idx_thumbnails_video ON thumbnails(video_id);
CREATE INDEX IF NOT EXISTS idx_production_packages_video ON production_packages(video_id);
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(account_status);
CREATE INDEX IF NOT EXISTS idx_jobs_video ON jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_events_job ON events(job_id);
CREATE INDEX IF NOT EXISTS idx_events_video ON events(video_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_posting_jobs_package ON posting_jobs(package_id);
CREATE INDEX IF NOT EXISTS idx_posting_jobs_account ON posting_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_posting_jobs_platform ON posting_jobs(platform);
CREATE INDEX IF NOT EXISTS idx_posting_jobs_status ON posting_jobs(posting_status);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Video pipeline progress: current stage of each video
CREATE OR REPLACE VIEW video_pipeline_progress AS
SELECT
  v.video_id,
  v.created_at,
  COUNT(DISTINCT s.script_id) > 0 AS has_script,
  COUNT(DISTINCT c.caption_id) > 0 AS has_captions,
  COUNT(DISTINCT r.render_id) AS render_count,
  COUNT(DISTINCT t.thumbnail_id) AS thumbnail_count,
  (SELECT package_status FROM production_packages WHERE video_id = v.video_id LIMIT 1) AS package_status,
  (SELECT COUNT(*) FROM jobs WHERE video_id = v.video_id AND job_status = 'running') AS running_jobs,
  (SELECT COUNT(*) FROM jobs WHERE video_id = v.video_id AND job_status = 'failed') AS failed_jobs
FROM videos v
LEFT JOIN scripts s ON v.video_id = s.video_id
LEFT JOIN captions c ON v.video_id = c.video_id
LEFT JOIN renders r ON v.video_id = r.video_id
LEFT JOIN thumbnails t ON v.video_id = t.video_id
GROUP BY v.video_id;

-- Account health and posting status
CREATE OR REPLACE VIEW account_posting_status AS
SELECT
  a.account_id,
  a.platform,
  a.account_handle,
  a.account_status,
  COUNT(DISTINCT pj.posting_job_id) AS total_posts_attempted,
  COUNT(DISTINCT CASE WHEN pj.posting_status = 'published' THEN pj.posting_job_id END) AS successful_posts,
  MAX(pj.published_at) AS last_post_time,
  COUNT(DISTINCT CASE WHEN pj.posting_status = 'failed' THEN pj.posting_job_id END) AS failed_posts
FROM accounts a
LEFT JOIN posting_jobs pj ON a.account_id = pj.account_id
GROUP BY a.account_id, a.platform, a.account_handle, a.account_status;

-- Recent job activity
CREATE OR REPLACE VIEW recent_job_activity AS
SELECT
  j.job_id,
  j.video_id,
  j.job_type,
  j.job_status,
  j.error_message,
  j.created_at,
  j.started_at,
  j.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(j.completed_at, NOW()) - j.started_at))::INT AS duration_seconds
FROM jobs j
WHERE j.created_at > NOW() - INTERVAL '7 days'
ORDER BY j.created_at DESC;

-- ============================================================================
-- HEALTH CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_database_health() RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'status', 'healthy',
    'total_videos', (SELECT COUNT(*) FROM videos),
    'total_accounts', (SELECT COUNT(*) FROM accounts),
    'pending_jobs', (SELECT COUNT(*) FROM jobs WHERE job_status = 'pending'),
    'running_jobs', (SELECT COUNT(*) FROM jobs WHERE job_status = 'running'),
    'failed_jobs_7d', (SELECT COUNT(*) FROM jobs WHERE job_status = 'failed' AND created_at > NOW() - INTERVAL '7 days'),
    'completed_packages', (SELECT COUNT(*) FROM production_packages WHERE package_status = 'complete'),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================
-- To initialize: psql -h localhost -p 5450 -U postgres -d video_orchestrator -f video-orchestrator-phase-2b-schema.sql
-- Then verify: SELECT check_database_health();
