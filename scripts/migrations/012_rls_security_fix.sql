-- ============================================================
-- Migration 012: RLS Security Fix
-- Fixes Supabase security warning: "Table publicly accessible"
--
-- WHY service_role bypasses RLS:
-- All API routes use createSupabaseAdminClient() with service_role key.
-- service_role ALWAYS bypasses RLS — enabling RLS here does NOT break
-- any existing functionality. It only blocks anonymous/public REST access.
--
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- ============================================================

-- ── 1. clients ────────────────────────────────────────────────────────────────
-- Core CRM table — must be locked down

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── 2. error_log ──────────────────────────────────────────────────────────────
-- Internal logs — authenticated SELECT only.
-- INSERT via service_role (bypasses RLS) — no policy needed for writes.

ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "error_log_select" ON error_log;
CREATE POLICY "error_log_select" ON error_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 3. ai_usage_log ───────────────────────────────────────────────────────────
-- Cost tracking — authenticated SELECT only.
-- INSERT via service_role (bypasses RLS) — no policy needed for writes.

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_log_select" ON ai_usage_log;
CREATE POLICY "ai_usage_log_select" ON ai_usage_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 4. Legacy tables (may exist from initial setup) ───────────────────────────
-- Enabling RLS with no policies = completely locked (zero public access).
-- If these tables are empty/unused, this is the safest default.

DO $$
DECLARE
  tbl text;
  legacy_tables text[] := ARRAY[
    'projects', 'automations', 'meetings', 'documents',
    'leads', 'monthly_reports', 'referrals'
  ];
BEGIN
  FOREACH tbl IN ARRAY legacy_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      -- Add authenticated-only SELECT policy
      EXECUTE format(
        'DROP POLICY IF EXISTS "%s_select" ON %I',
        tbl, tbl
      );
      EXECUTE format(
        'CREATE POLICY "%s_select" ON %I FOR SELECT USING (auth.role() = ''authenticated'')',
        tbl, tbl
      );

      RAISE NOTICE 'RLS enabled on: %', tbl;
    ELSE
      RAISE NOTICE 'Table does not exist (skipped): %', tbl;
    END IF;
  END LOOP;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
