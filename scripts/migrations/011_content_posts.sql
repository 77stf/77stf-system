-- Migration 011: content_posts
-- Content management for social media (77STF internal + client product)

CREATE TABLE IF NOT EXISTS content_posts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        REFERENCES clients(id) ON DELETE SET NULL,
  -- null = internal 77STF post

  title         TEXT        NOT NULL,
  caption       TEXT,
  platform      TEXT        NOT NULL DEFAULT 'instagram', -- instagram | linkedin | youtube | tiktok | twitter
  status        TEXT        NOT NULL DEFAULT 'idea',      -- idea | draft | ready | scheduled | published
  post_type     TEXT        NOT NULL DEFAULT 'post',      -- post | reel | story | carousel | video | thread
  scheduled_at  TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,

  media_urls    TEXT[]      NOT NULL DEFAULT '{}',
  hashtags      TEXT[]      NOT NULL DEFAULT '{}',
  topics        TEXT[]      NOT NULL DEFAULT '{}',        -- tools | ai | business | lifestyle | promo

  engagement    JSONB       NOT NULL DEFAULT '{}',
  -- { likes, comments, shares, views, reach, saves }

  notes         TEXT,
  ai_generated  BOOLEAN     NOT NULL DEFAULT false,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-updated_at
CREATE OR REPLACE FUNCTION update_content_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_posts_updated_at ON content_posts;
CREATE TRIGGER content_posts_updated_at
  BEFORE UPDATE ON content_posts
  FOR EACH ROW EXECUTE FUNCTION update_content_posts_updated_at();

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_posts_select" ON content_posts;
CREATE POLICY "content_posts_select" ON content_posts
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "content_posts_insert" ON content_posts;
CREATE POLICY "content_posts_insert" ON content_posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "content_posts_update" ON content_posts;
CREATE POLICY "content_posts_update" ON content_posts
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "content_posts_delete" ON content_posts;
CREATE POLICY "content_posts_delete" ON content_posts
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS content_posts_status_idx     ON content_posts (status);
CREATE INDEX IF NOT EXISTS content_posts_platform_idx   ON content_posts (platform);
CREATE INDEX IF NOT EXISTS content_posts_scheduled_idx  ON content_posts (scheduled_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS content_posts_client_idx     ON content_posts (client_id);

SELECT 'content_posts table ready' AS status;
