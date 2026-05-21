-- Phase 4: Account registry additions
-- Applied: 2026-05-21

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS batch_post_limit INTEGER DEFAULT 10;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS content_style VARCHAR(50) DEFAULT 'general';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_method VARCHAR(50) DEFAULT 'manual';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credentials_ref VARCHAR(200);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_content_style_check') THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_content_style_check
      CHECK (content_style IN ('professional','casual','educational','entertaining','general'));
  END IF;
END $$;
