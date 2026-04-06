-- ============================================================
-- 77STF — Migration 013: client_contacts
-- Links Supabase auth users to client records (for portal access)
-- Paste into Supabase SQL Editor and run.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_contacts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'owner',   -- 'owner' | 'viewer'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

-- Clients can only see their own mappings
CREATE POLICY "client_contacts_select"
  ON client_contacts FOR SELECT
  USING (user_id = auth.uid());

-- Only service_role can insert (admin creates the link)
CREATE POLICY "client_contacts_admin_insert"
  ON client_contacts FOR INSERT
  WITH CHECK (false);  -- service_role bypasses, so clients can't self-register

CREATE INDEX client_contacts_user_idx   ON client_contacts (user_id);
CREATE INDEX client_contacts_client_idx ON client_contacts (client_id);

-- ── Helper: generate portal invite ───────────────────────────────────────────
-- Run this in SQL to link an email to a client:
-- INSERT INTO client_contacts (client_id, user_id)
-- SELECT 'CLIENT_UUID', id FROM auth.users WHERE email = 'client@email.com';
