-- Migration 009: intelligence_digests
-- Stores AI-generated daily digests from Radar agent
-- Triggered manually or by n8n cron

CREATE TABLE IF NOT EXISTS intelligence_digests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  digest_text   TEXT        NOT NULL,
  highlights    JSONB       NOT NULL DEFAULT '[]',
  -- highlights: [{ title, url, score, category, reason }]
  source_count  INT         NOT NULL DEFAULT 0,
  categories    TEXT[]      NOT NULL DEFAULT '{}',
  model         TEXT,
  trigger       TEXT        NOT NULL DEFAULT 'manual', -- manual | n8n | cron
  metadata      JSONB       NOT NULL DEFAULT '{}'
);

ALTER TABLE intelligence_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digests_select" ON intelligence_digests;
CREATE POLICY "digests_select" ON intelligence_digests
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "digests_insert" ON intelligence_digests;
CREATE POLICY "digests_insert" ON intelligence_digests
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS intelligence_digests_generated_at_idx
  ON intelligence_digests (generated_at DESC);

-- Confirm
SELECT 'intelligence_digests table ready' AS status;
