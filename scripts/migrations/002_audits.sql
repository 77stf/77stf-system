-- ============================================================
-- 77STF — Migration 002: Audit Operacyjny
-- Paste into Supabase SQL Editor and run AFTER 001_quotes_tasks.sql
-- ============================================================

-- ── audits ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'Audyt Operacyjny',
  status       text        NOT NULL DEFAULT 'draft',  -- draft | in_progress | completed
  score        integer,                                -- 0-100 overall score
  answers      jsonb       NOT NULL DEFAULT '{}',     -- {category_id: {question_id: answer}}
  findings     jsonb,                                  -- AI generated findings per category
  recommendations jsonb,                               -- AI generated recommendations with quote items
  ai_summary   text,                                  -- executive summary
  ai_brief     text,                                  -- brief for the pitch meeting
  quote_id     uuid        REFERENCES quotes(id) ON DELETE SET NULL,  -- linked quote
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audits_select" ON audits;
CREATE POLICY "audits_select" ON audits
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "audits_insert" ON audits;
CREATE POLICY "audits_insert" ON audits
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "audits_update" ON audits;
CREATE POLICY "audits_update" ON audits
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "audits_delete" ON audits;
CREATE POLICY "audits_delete" ON audits
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── updated_at trigger ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audits_updated_at ON audits;
CREATE TRIGGER audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── verify ────────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'audits';
