-- ============================================================
-- 77STF — Migration 003: error_log (fix)
-- Tabela istniała z błędnymi kolumnami — DROP + CREATE
-- Paste into Supabase SQL Editor and run.
-- Bezpieczne: error_log nie przechowuje krytycznych danych.
-- ============================================================

DROP TABLE IF EXISTS error_log;

CREATE TABLE error_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text        NOT NULL,       -- np. 'api/clients/meeting-prep'
  message     text        NOT NULL,       -- treść błędu (err.message)
  metadata    jsonb,                      -- kontekst: {client_id, model, ...}
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS added in migration 012_rls_security_fix.sql
-- service_role bypasses RLS anyway — INSERT from API routes always works

-- Index for fast desc queries (panel errors page)
CREATE INDEX error_log_created_at_idx ON error_log (created_at DESC);

-- ── Verification — should return all 10 tables ───────────────────────────────
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'clients', 'projects', 'automations', 'meetings', 'documents',
    'leads', 'monthly_reports', 'guardian_reports', 'referrals',
    'quotes', 'quote_items', 'tasks', 'client_notes', 'audits', 'error_log'
  )
ORDER BY table_name;
