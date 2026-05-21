-- Phase 3: Lifecycle tracking additions
-- Applied: 2026-05-21

-- Add pipeline_state, model, max_retries to jobs (idempotent)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pipeline_state VARCHAR(50) DEFAULT 'planned';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS model VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Extend job_type constraint to include Phase 3 types (normalize, screen_record)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_job_type_check') THEN
    ALTER TABLE jobs DROP CONSTRAINT jobs_job_type_check;
  END IF;
  ALTER TABLE jobs ADD CONSTRAINT jobs_job_type_check CHECK (job_type IN (
    'render','caption','thumbnail','manifest','post','analytics','normalize','screen_record'
  ));
END $$;

-- Pipeline state constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_pipeline_state_check') THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_pipeline_state_check
      CHECK (pipeline_state IN (
        'planned','assets_generated','audio_ready','composed','rendered','posted','archived'
      ));
  END IF;
END $$;

-- Job state transition log
CREATE TABLE IF NOT EXISTS job_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,
  state_from VARCHAR(50),
  state_to VARCHAR(50),
  transitioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_state_log_job ON job_state_log(job_id);

-- Account posting tracking
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_posted_at TIMESTAMP;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS posted_count_today INTEGER DEFAULT 0;

-- Performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID,
  platform VARCHAR(50),
  account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL,
  posted_at TIMESTAMP,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  estimated_roi FLOAT DEFAULT 0,
  model_used VARCHAR(50),
  hook_used VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metrics_platform ON performance_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_metrics_posted_at ON performance_metrics(posted_at);
CREATE INDEX IF NOT EXISTS idx_metrics_model ON performance_metrics(model_used);
