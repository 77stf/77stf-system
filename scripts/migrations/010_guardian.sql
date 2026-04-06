-- Migration 010: guardian_reports
-- Stores results from Guardian Agent monitoring cycles

CREATE TABLE IF NOT EXISTS guardian_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alerts       JSONB       NOT NULL DEFAULT '[]',
  -- alerts: [{ type, severity, client_id?, client_name?, title, detail, action }]
  summary      TEXT,
  alert_count  INT         NOT NULL DEFAULT 0,
  critical     INT         NOT NULL DEFAULT 0,
  warnings     INT         NOT NULL DEFAULT 0,
  trigger      TEXT        NOT NULL DEFAULT 'manual', -- manual | cron
  metadata     JSONB       NOT NULL DEFAULT '{}'
);

ALTER TABLE guardian_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardian_reports_select" ON guardian_reports;
CREATE POLICY "guardian_reports_select" ON guardian_reports
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "guardian_reports_insert" ON guardian_reports;
CREATE POLICY "guardian_reports_insert" ON guardian_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS guardian_reports_generated_at_idx
  ON guardian_reports (generated_at DESC);

SELECT 'guardian_reports table ready' AS status;
