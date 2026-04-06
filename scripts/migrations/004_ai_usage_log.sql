-- ============================================================
-- 77STF — Migration 004: ai_usage_log (Etap 5b)
-- Śledzenie zużycia tokenów i kosztów Claude API
-- Paste into Supabase SQL Editor and run.
-- ============================================================

CREATE TABLE ai_usage_log (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  feature        text          NOT NULL,           -- np. 'meetingBrief', 'auditAnalysis'
  model          text          NOT NULL,           -- np. 'claude-sonnet-4-6'
  input_tokens   integer       NOT NULL,
  output_tokens  integer       NOT NULL,
  cost_usd       numeric(10,6) NOT NULL DEFAULT 0, -- koszt aproksymowany
  client_id      uuid          REFERENCES clients(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

-- RLS added in migration 012_rls_security_fix.sql
-- service_role bypasses RLS anyway — INSERT from API routes always works

CREATE INDEX ai_usage_log_created_at_idx ON ai_usage_log (created_at DESC);
CREATE INDEX ai_usage_log_feature_idx    ON ai_usage_log (feature);
CREATE INDEX ai_usage_log_client_idx     ON ai_usage_log (client_id) WHERE client_id IS NOT NULL;

-- ── Verification — should return all tables including ai_usage_log ────────────
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'clients', 'projects', 'automations', 'meetings', 'documents',
    'leads', 'monthly_reports', 'guardian_reports', 'referrals',
    'quotes', 'quote_items', 'tasks', 'client_notes', 'audits',
    'error_log', 'ai_usage_log'
  )
ORDER BY table_name;
