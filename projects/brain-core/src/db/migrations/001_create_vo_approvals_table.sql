-- Migration 001: Create VO Approvals tables
-- Persists video-orchestrator approval records and decision audit trail.

CREATE TABLE IF NOT EXISTS vo_approvals (
  id               VARCHAR(255)      PRIMARY KEY,
  project_id       VARCHAR(255)      NOT NULL,
  type             VARCHAR(50)       NOT NULL, -- 'content', 'metadata', 'thumbnail', 'package', 'publish'
  actor            VARCHAR(255)      NOT NULL DEFAULT 'system',
  request_payload  JSONB             NOT NULL,
  preview          JSONB,
  status           VARCHAR(20)       NOT NULL, -- 'pending', 'approved', 'rejected'
  decided_by       VARCHAR(255),
  decided_at       TIMESTAMPTZ,
  rejection_reason VARCHAR(1000),
  expires_at       TIMESTAMPTZ       NOT NULL,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vo_approvals_project_status ON vo_approvals (project_id, status);
CREATE INDEX IF NOT EXISTS idx_vo_approvals_expires_at     ON vo_approvals (expires_at);

-- Audit trail: every approve/reject decision is recorded immutably here.
CREATE TABLE IF NOT EXISTS vo_approval_decisions (
  id                  SERIAL          PRIMARY KEY,
  approval_id         VARCHAR(255)    NOT NULL REFERENCES vo_approvals(id) ON DELETE CASCADE,
  decided_by          VARCHAR(255)    NOT NULL,
  decision            VARCHAR(20)     NOT NULL, -- 'approved', 'rejected'
  decision_timestamp  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  metadata            JSONB
);

CREATE INDEX IF NOT EXISTS idx_vo_approval_decisions_approval_id ON vo_approval_decisions (approval_id);
